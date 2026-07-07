import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import { pushToGroupMap } from "../utils/groupMap.js";
import type {
  DbRow,
  DbColumn,
  DbTask,
  DbTaskComment,
  DbSubtask,
  DbChecklistItem,
  Row,
} from "../types.js";

const router = Router();

const MAX_BOARD_LIMIT = 100;
const MAX_SEARCH_QUERY_LENGTH = 200;

/** ボード取得の詳細度。`summary` は子要素を件数のみ返し、表示時に遅延読み込みする。 */
export type BoardDetailLevel = "summary" | "full";

/** クエリパラメータ検証失敗を 400 エラーへ変換するための内部エラー。 */
class BoardQueryError extends Error {}

/**
 * query 文字列を正の整数として検証する。
 * パラメータ未指定時は `null` を返し、`max` 指定時は上限チェックも行う。
 * @param raw - クエリ値(`req.query[field]`)
 * @param fieldName - エラーメッセージに表示するフィールド名
 * @param max - 許容上限(指定時のみ検証)
 * @returns 検証済みの正の整数。未指定時は `null`
 * @throws BoardQueryError 値が整数として不正な場合
 */
function parsePositiveIntQuery(
  raw: unknown,
  fieldName: string,
  max?: number,
): number | null {
  if (raw === undefined) return null;
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BoardQueryError(`'${fieldName}' must be a positive integer`);
  }
  if (max !== undefined && value > max) {
    throw new BoardQueryError(
      `'${fieldName}' must be an integer between 1 and ${max}`,
    );
  }
  return value;
}

/**
 * query 文字列を 0 以上の整数として検証する。
 * パラメータ未指定時は `null` を返す。
 * @param raw - クエリ値(`req.query[field]`)
 * @param fieldName - エラーメッセージに表示するフィールド名
 * @returns 検証済みの非負整数。未指定時は `null`
 * @throws BoardQueryError 値が整数として不正な場合
 */
function parseNonNegativeIntQuery(
  raw: unknown,
  fieldName: string,
): number | null {
  if (raw === undefined) return null;
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BoardQueryError(`'${fieldName}' must be a non-negative integer`);
  }
  return value;
}

/**
 * `detail` クエリを検証する。未指定時はパフォーマンス重視の `summary`。
 * @param raw - クエリ値
 * @returns 検証済み詳細度
 * @throws BoardQueryError 値が不正な場合
 */
function parseDetailQuery(raw: unknown): BoardDetailLevel {
  if (raw === undefined) return "summary";
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError("'detail' must be 'summary' or 'full'");
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "summary" || normalized === "full") {
    return normalized;
  }
  throw new BoardQueryError("'detail' must be 'summary' or 'full'");
}

/**
 * 検索クエリ文字列を検証する。
 * @param raw - クエリ値
 * @returns 正規化済み検索文字列。未指定・空文字は `null`
 * @throws BoardQueryError 値が不正または長すぎる場合
 */
function parseSearchQuery(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError("'q' must be a string");
  }
  const normalized = raw.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new BoardQueryError(
      `'q' must be at most ${MAX_SEARCH_QUERY_LENGTH} characters`,
    );
  }
  return normalized;
}

/**
 * ユーザー配下で検索クエリに一致するタスク ID を取得する。
 * @param userId - 操作ユーザー ID
 * @param searchPattern - ILIKE 用パターン(`%keyword%` 形式)
 * @returns 一致タスク ID の配列
 */
async function findMatchingTaskIds(
  userId: number,
  searchPattern: string,
): Promise<number[]> {
  const result = await pool.query<{ id: number }>(
    `SELECT DISTINCT t.id
     FROM tasks t
     JOIN columns c ON c.id = t.column_id
     JOIN rows r ON r.id = c.row_id
     LEFT JOIN subtasks s ON s.task_id = t.id
     LEFT JOIN checklist_items ci
       ON (ci.task_id = t.id AND ci.subtask_id IS NULL)
       OR ci.subtask_id IN (SELECT id FROM subtasks WHERE task_id = t.id)
     LEFT JOIN task_comments tc ON tc.task_id = t.id
     WHERE r.user_id = $1
       AND (
         t.content ILIKE $2
         OR s.content ILIKE $2
         OR ci.content ILIKE $2
         OR tc.content ILIKE $2
       )
     ORDER BY t.id ASC`,
    [userId, searchPattern],
  );
  return result.rows.map((row) => row.id);
}

/**
 * タスク ID 群が属する行 ID を position 順で取得する。
 * @param userId - 操作ユーザー ID
 * @param taskIds - 対象タスク ID 配列
 * @returns 行レコード配列
 */
async function fetchRowsForTaskIds(
  userId: number,
  taskIds: number[],
): Promise<DbRow[]> {
  const result = await pool.query<DbRow>(
    `SELECT DISTINCT r.*
     FROM rows r
     JOIN columns c ON c.row_id = r.id
     JOIN tasks t ON t.column_id = c.id
     WHERE r.user_id = $1 AND t.id = ANY($2::int[])
     ORDER BY r.position ASC`,
    [userId, taskIds],
  );
  return result.rows;
}

/** フル詳細の階層取得 SQL(オプションでタスク ID を絞り込み可能)。 */
const FULL_HIERARCHY_SQL = `WITH
  sub_chk AS (
    SELECT
      ci.subtask_id,
      json_agg(
        json_build_object(
          'id', ci.id,
          'task_id', ci.task_id,
          'subtask_id', ci.subtask_id,
          'content', ci.content,
          'completed', ci.completed,
          'position', ci.position
        ) ORDER BY ci.position ASC
      ) AS checklists
    FROM checklist_items ci
    WHERE ci.subtask_id IS NOT NULL
      AND ci.subtask_id IN (
        SELECT s.id FROM subtasks s
        JOIN tasks t ON t.id = s.task_id
        JOIN columns c ON c.id = t.column_id
        WHERE c.row_id = ANY($1::int[])
      )
    GROUP BY ci.subtask_id
  ),
  agg_subtasks AS (
    SELECT
      s.task_id,
      json_agg(
        json_build_object(
          'id', s.id,
          'task_id', s.task_id,
          'content', s.content,
          'checklists', COALESCE(sc.checklists, '[]'::json)
        ) ORDER BY s.id ASC
      ) AS subtasks
    FROM subtasks s
    JOIN tasks t ON t.id = s.task_id
    JOIN columns c ON c.id = t.column_id
    LEFT JOIN sub_chk sc ON sc.subtask_id = s.id
    WHERE c.row_id = ANY($1::int[])
    GROUP BY s.task_id
  ),
  task_chk AS (
    SELECT
      ci.task_id,
      json_agg(
        json_build_object(
          'id', ci.id,
          'task_id', ci.task_id,
          'subtask_id', ci.subtask_id,
          'content', ci.content,
          'completed', ci.completed,
          'position', ci.position
        ) ORDER BY ci.position ASC
      ) AS checklists
    FROM checklist_items ci
    JOIN tasks t ON t.id = ci.task_id
    JOIN columns c ON c.id = t.column_id
    WHERE ci.task_id IS NOT NULL AND ci.subtask_id IS NULL
      AND c.row_id = ANY($1::int[])
    GROUP BY ci.task_id
  ),
  task_cmt AS (
    SELECT
      tc.task_id,
      json_agg(
        json_build_object(
          'id', tc.id,
          'task_id', tc.task_id,
          'content', tc.content,
          'created_at', tc.created_at,
          'position', tc.position
        ) ORDER BY tc.position ASC, tc.created_at ASC, tc.id ASC
      ) AS comments
    FROM task_comments tc
    JOIN tasks t ON t.id = tc.task_id
    JOIN columns c ON c.id = t.column_id
    WHERE c.row_id = ANY($1::int[])
    GROUP BY tc.task_id
  ),
  agg_tasks AS (
    SELECT
      t.column_id,
      json_agg(
        json_build_object(
          'id', t.id,
          'column_id', t.column_id,
          'content', t.content,
          'due_date', t.due_date::text,
          'position', t.position,
          'completed', t.completed,
          'subtasks', COALESCE(asts.subtasks, '[]'::json),
          'checklists', COALESCE(tc.checklists, '[]'::json),
          'comments', COALESCE(tca.comments, '[]'::json)
        ) ORDER BY t.position ASC
      ) AS tasks
    FROM tasks t
    JOIN columns c ON c.id = t.column_id
    LEFT JOIN agg_subtasks asts ON asts.task_id = t.id
    LEFT JOIN task_chk tc ON tc.task_id = t.id
    LEFT JOIN task_cmt tca ON tca.task_id = t.id
    WHERE c.row_id = ANY($1::int[])
      AND ($2::int[] IS NULL OR t.id = ANY($2::int[]))
    GROUP BY t.column_id
  ),
  agg_cols AS (
    SELECT
      c.row_id,
      json_agg(
        json_build_object(
          'id', c.id,
          'title', c.title,
          'position', c.position,
          'row_id', c.row_id,
          'tasks', COALESCE(at.tasks, '[]'::json)
        ) ORDER BY c.position ASC
      ) AS columns
    FROM columns c
    LEFT JOIN agg_tasks at ON at.column_id = c.id
    WHERE c.row_id = ANY($1::int[])
    GROUP BY c.row_id
  )
SELECT
  r.id,
  r.title,
  r.position,
  COALESCE(ac.columns, '[]'::json) AS columns
FROM rows r
LEFT JOIN agg_cols ac ON ac.row_id = r.id
WHERE r.id = ANY($1::int[])
ORDER BY r.position ASC`;

/** サマリー取得用の軽量階層 SQL(子要素のネストを省略し件数のみ返す)。 */
const SUMMARY_HIERARCHY_SQL = `WITH
  agg_tasks AS (
    SELECT
      t.column_id,
      json_agg(
        json_build_object(
          'id', t.id,
          'column_id', t.column_id,
          'content', t.content,
          'due_date', t.due_date::text,
          'position', t.position,
          'completed', t.completed,
          'comment_count', (
            SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id
          ),
          'subtask_count', (
            SELECT COUNT(*)::int FROM subtasks s WHERE s.task_id = t.id
          ),
          'checklist_count', (
            SELECT COUNT(*)::int
            FROM checklist_items ci
            WHERE (ci.task_id = t.id AND ci.subtask_id IS NULL)
               OR ci.subtask_id IN (SELECT id FROM subtasks WHERE task_id = t.id)
          ),
          'subtasks', '[]'::json,
          'checklists', '[]'::json,
          'comments', '[]'::json
        ) ORDER BY t.position ASC
      ) AS tasks
    FROM tasks t
    JOIN columns c ON c.id = t.column_id
    WHERE c.row_id = ANY($1::int[])
    GROUP BY t.column_id
  ),
  agg_cols AS (
    SELECT
      c.row_id,
      json_agg(
        json_build_object(
          'id', c.id,
          'title', c.title,
          'position', c.position,
          'row_id', c.row_id,
          'tasks', COALESCE(at.tasks, '[]'::json)
        ) ORDER BY c.position ASC
      ) AS columns
    FROM columns c
    LEFT JOIN agg_tasks at ON at.column_id = c.id
    WHERE c.row_id = ANY($1::int[])
    GROUP BY c.row_id
  )
SELECT
  r.id,
  r.title,
  r.position,
  COALESCE(ac.columns, '[]'::json) AS columns
FROM rows r
LEFT JOIN agg_cols ac ON ac.row_id = r.id
WHERE r.id = ANY($1::int[])
ORDER BY r.position ASC`;

/**
 * 行 ID 群に対するボード階層を DB から取得する。
 * @param rowIds - 取得対象の行 ID 配列
 * @param detail - 詳細度
 * @param taskIdsFilter - タスク ID で絞り込む場合の配列(検索時)
 * @returns ネスト済み行配列
 */
async function fetchBoardHierarchy(
  rowIds: number[],
  detail: BoardDetailLevel,
  taskIdsFilter: number[] | null = null,
): Promise<Row[]> {
  if (rowIds.length === 0) return [];

  if (detail === "summary") {
    const result = await pool.query<Row>(SUMMARY_HIERARCHY_SQL, [rowIds]);
    return result.rows;
  }

  const result = await pool.query<Row>(FULL_HIERARCHY_SQL, [
    rowIds,
    taskIdsFilter,
  ]);
  return result.rows;
}

/**
 * 検索結果向けに、一致タスクのみを含む行階層へ整形する。
 * @param rows - 取得済み行階層
 * @returns 空カラム・空行を除外した行配列
 */
export function filterBoardToNonEmptyTasks(rows: Row[]): Row[] {
  return rows
    .map((row) => ({
      ...row,
      columns: row.columns
        .map((column) => ({
          ...column,
          tasks: column.tasks,
        }))
        .filter((column) => column.tasks.length > 0),
    }))
    .filter((row) => row.columns.length > 0);
}

type NestedSubtask = DbSubtask & { checklists: DbChecklistItem[] };
type NestedTask = DbTask & {
  subtasks: NestedSubtask[];
  checklists: DbChecklistItem[];
  comments: DbTaskComment[];
};

/**
 * フラットに取得した DB 行を rows -> columns -> tasks の階層へ組み立てる。
 * 配列の走査順を保持するため、SQL の `ORDER BY` 結果がそのままレスポンス順になる。
 * @param rows - 行レコード配列
 * @param columns - カラムレコード配列
 * @param tasks - タスクレコード配列
 * @param subtasks - サブタスクレコード配列
 * @param checklistItems - チェックリストレコード配列
 * @param taskComments - コメントレコード配列
 * @returns ネスト済みのボード階層
 */
export function buildBoardHierarchy(
  rows: DbRow[],
  columns: DbColumn[],
  tasks: DbTask[],
  subtasks: DbSubtask[],
  checklistItems: DbChecklistItem[],
  taskComments: DbTaskComment[],
): Row[] {
  const taskChecklistMap = new Map<number, DbChecklistItem[]>();
  const subtaskChecklistMap = new Map<number, DbChecklistItem[]>();
  const taskCommentMap = new Map<number, DbTaskComment[]>();

  for (const item of checklistItems) {
    if (item.subtask_id !== null) {
      pushToGroupMap(subtaskChecklistMap, item.subtask_id, item);
      continue;
    }
    if (item.task_id !== null) {
      pushToGroupMap(taskChecklistMap, item.task_id, item);
    }
  }

  for (const comment of taskComments) {
    pushToGroupMap(taskCommentMap, comment.task_id, comment);
  }

  const subtasksByTaskId = new Map<number, NestedSubtask[]>();
  for (const subtask of subtasks) {
    const nestedSubtask = {
      ...subtask,
      checklists: subtaskChecklistMap.get(subtask.id) ?? [],
    };
    pushToGroupMap(subtasksByTaskId, subtask.task_id, nestedSubtask);
  }

  const tasksByColumnId = new Map<number, NestedTask[]>();

  for (const task of tasks) {
    const nestedTask = {
      ...task,
      subtasks: subtasksByTaskId.get(task.id) ?? [],
      checklists: taskChecklistMap.get(task.id) ?? [],
      comments: taskCommentMap.get(task.id) ?? [],
    };
    pushToGroupMap(tasksByColumnId, task.column_id, nestedTask);
  }

  const columnsByRowId = new Map<
    number,
    Array<
      DbColumn & {
        tasks: NestedTask[];
      }
    >
  >();

  for (const column of columns) {
    const nestedColumn = {
      ...column,
      tasks: tasksByColumnId.get(column.id) ?? [],
    };
    pushToGroupMap(columnsByRowId, column.row_id, nestedColumn);
  }

  return rows.map((row) => ({
    ...row,
    columns: columnsByRowId.get(row.id) ?? [],
  }));
}

/**
 * GET /api/board
 * ボード全体を取得し、行・カラム・タスクの階層構造で返す。
 * `detail=summary` 時は子要素を件数のみ返し、`q` 指定時はサーバー側検索を行う。
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  let rowIdFilter: number | null;
  let limit: number | null;
  let offset: number | null;
  let detail: BoardDetailLevel;
  let searchQuery: string | null;

  try {
    rowIdFilter = parsePositiveIntQuery(req.query.row_id, "row_id");
    limit = parsePositiveIntQuery(req.query.limit, "limit", MAX_BOARD_LIMIT);
    offset = parseNonNegativeIntQuery(req.query.offset, "offset");
    detail = parseDetailQuery(req.query.detail);
    searchQuery = parseSearchQuery(req.query.q);
  } catch (err) {
    if (err instanceof BoardQueryError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
    return;
  }

  try {
    const userId = req.userId!;

    // サーバー側検索: 一致タスクのみフル詳細で返す(未読み込み行も横断検索可能)
    if (searchQuery !== null) {
      const searchPattern = `%${searchQuery.replace(/[%_\\]/g, "\\$&")}%`;
      const matchingTaskIds = await findMatchingTaskIds(userId, searchPattern);
      if (matchingTaskIds.length === 0) {
        res.json([]);
        return;
      }

      const rows = await fetchRowsForTaskIds(userId, matchingTaskIds);
      const hierarchy = await fetchBoardHierarchy(
        rows.map((row) => row.id),
        "full",
        matchingTaskIds,
      );
      res.json(filterBoardToNonEmptyTasks(hierarchy));
      return;
    }

    const rowQueryParams: number[] = [];
    const rowWhereClauses: string[] = [];

    rowQueryParams.push(userId);
    rowWhereClauses.push(`user_id = $${rowQueryParams.length}`);

    if (rowIdFilter !== null) {
      rowQueryParams.push(rowIdFilter);
      rowWhereClauses.push(`id = $${rowQueryParams.length}`);
    }

    let rowsQuery = "SELECT * FROM rows";
    if (rowWhereClauses.length > 0) {
      rowsQuery += ` WHERE ${rowWhereClauses.join(" AND ")}`;
    }
    rowsQuery += " ORDER BY position ASC";

    if (limit !== null) {
      rowQueryParams.push(limit);
      rowsQuery += ` LIMIT $${rowQueryParams.length}`;
    }
    if (offset !== null) {
      rowQueryParams.push(offset);
      rowsQuery += ` OFFSET $${rowQueryParams.length}`;
    }

    const rowsResult = await pool.query<DbRow>(rowsQuery, rowQueryParams);
    const rows = rowsResult.rows;

    if (rows.length === 0) {
      res.json([]);
      return;
    }

    const hierarchy = await fetchBoardHierarchy(
      rows.map((row) => row.id),
      detail,
    );
    res.json(hierarchy);
  } catch (err) {
    next(err);
  }
});

/** ボード階層データ取得 API の Express ルーター。 */
export default router;
