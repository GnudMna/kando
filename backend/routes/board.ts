// ボード全体のデータを返す GET /api/board エンドポイント
// rows → columns → tasks → subtasks → checklist_items の順にネストして返す
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
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

/** クエリパラメータ検証失敗を 400 エラーへ変換するための内部エラー。 */
class BoardQueryError extends Error {}

/**
 * query 文字列を正の整数として検証する。
 * パラメータ未指定時は `null` を返し、`max` 指定時は上限チェックも行う。
 * @param raw - クエリ値（`req.query[field]`）
 * @param fieldName - エラーメッセージに表示するフィールド名
 * @param max - 許容上限（指定時のみ検証）
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
 * @param raw - クエリ値（`req.query[field]`）
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
 * Map<K, V[]> のキーごと配列に値を追加する共通ヘルパー。
 * @param map - 追記対象のグループ化 Map
 * @param key - グループキー
 * @param value - 追加する値
 * @returns なし
 */
function pushToGroupMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
    return;
  }
  map.set(key, [value]);
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

// ボード全体のデータを一括取得して階層構造に組み立てて返す
router.get(
  "/",
  /**
   * ボード全体を取得し、行・カラム・タスクの階層構造で返す。
   * @param req - クエリ `row_id` `limit` `offset` を含むリクエスト
   * @param res - ボード階層データを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 取得処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    let rowIdFilter: number | null;
    let limit: number | null;
    let offset: number | null;

    try {
      rowIdFilter = parsePositiveIntQuery(req.query.row_id, "row_id");
      limit = parsePositiveIntQuery(req.query.limit, "limit", MAX_BOARD_LIMIT);
      offset = parseNonNegativeIntQuery(req.query.offset, "offset");
    } catch (err) {
      if (err instanceof BoardQueryError) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
      return;
    }

    try {
      const rowQueryParams: number[] = [];
      const rowWhereClauses: string[] = [];

      // 認証済みユーザーの行のみを取得する
      rowQueryParams.push(req.userId!);
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

      const rowIds = rows.map((row) => row.id);

      // 単一の CTE クエリでネスト階層全体を一括取得する（複数往復を 1 往復に削減）
      const hierarchyResult = await pool.query<Row>(
        `WITH
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
        ORDER BY r.position ASC`,
        [rowIds],
      );

      res.json(hierarchyResult.rows);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
