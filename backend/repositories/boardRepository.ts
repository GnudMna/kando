import type { DbRow, Row } from "../types.js";
import type { Queryable } from "./rowsRepository.js";

/** ボード取得の詳細度。`summary` は子要素を件数のみ返し、表示時に遅延読み込みする。 */
export type BoardDetailLevel = "summary" | "full";

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
 * ユーザー配下で検索クエリに一致するタスク ID を取得する。
 * @param client - クエリ実行クライアント
 * @param userId - 操作ユーザー ID
 * @param searchPattern - ILIKE 用パターン(`%keyword%` 形式)
 * @returns 一致タスク ID の配列
 */
export async function findMatchingTaskIds(
  client: Queryable,
  userId: number,
  searchPattern: string,
): Promise<number[]> {
  const result = await client.query<{ id: number }>(
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
 * @param client - クエリ実行クライアント
 * @param userId - 操作ユーザー ID
 * @param taskIds - 対象タスク ID 配列
 * @returns 行レコード配列
 */
export async function fetchRowsForTaskIds(
  client: Queryable,
  userId: number,
  taskIds: number[],
): Promise<DbRow[]> {
  const result = await client.query<DbRow>(
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

/**
 * 行 ID 群に対するボード階層を DB から取得する。
 * @param client - クエリ実行クライアント
 * @param rowIds - 取得対象の行 ID 配列
 * @param detail - 詳細度
 * @param taskIdsFilter - タスク ID で絞り込む場合の配列(検索時)
 * @returns ネスト済み行配列
 */
export async function fetchBoardHierarchy(
  client: Queryable,
  rowIds: number[],
  detail: BoardDetailLevel,
  taskIdsFilter: number[] | null = null,
): Promise<Row[]> {
  if (rowIds.length === 0) return [];

  if (detail === "summary") {
    const result = await client.query<Row>(SUMMARY_HIERARCHY_SQL, [rowIds]);
    return result.rows;
  }

  const result = await client.query<Row>(FULL_HIERARCHY_SQL, [
    rowIds,
    taskIdsFilter,
  ]);
  return result.rows;
}

export type FetchUserRowsOptions = {
  rowIdFilter?: number | null;
  limit?: number | null;
  offset?: number | null;
};

/**
 * ユーザーの行一覧を取得する。
 * @param client - クエリ実行クライアント
 * @param userId - 操作ユーザー ID
 * @param options - 絞り込み・ページング
 * @returns 行レコード配列
 */
export async function fetchUserRows(
  client: Queryable,
  userId: number,
  options: FetchUserRowsOptions = {},
): Promise<DbRow[]> {
  const { rowIdFilter = null, limit = null, offset = null } = options;
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

  const result = await client.query<DbRow>(rowsQuery, rowQueryParams);
  return result.rows;
}
