import type { DbSubtask } from "../types.js";
import type { Queryable } from "./rowsRepository.js";

/**
 * サブタスクを新規作成する。
 * @param client - クエリ実行クライアント
 * @param taskId - 親タスク ID
 * @param content - サブタスク本文
 * @returns 作成されたサブタスクレコード
 */
export async function insertSubtask(
  client: Queryable,
  taskId: number,
  content: string,
): Promise<DbSubtask> {
  const result = await client.query<DbSubtask>(
    "INSERT INTO subtasks (task_id, content) VALUES ($1, $2) RETURNING *",
    [taskId, content],
  );
  return result.rows[0];
}

/**
 * サブタスク本文を更新する。
 * @param client - クエリ実行クライアント
 * @param id - 更新対象サブタスク ID
 * @param content - 新しい本文
 * @param userId - 操作ユーザー ID
 * @returns 更新後サブタスク。対象なしは `null`
 */
export async function updateSubtaskContent(
  client: Queryable,
  id: number,
  content: string,
  userId: number,
): Promise<DbSubtask | null> {
  const result = await client.query<DbSubtask>(
    `UPDATE subtasks SET content = $1
     WHERE id = $2 AND task_id IN (
       SELECT t.id FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE r.user_id = $3
     ) RETURNING *`,
    [content, id, userId],
  );
  return result.rows[0] ?? null;
}

/**
 * サブタスクを削除する。
 * @param client - クエリ実行クライアント
 * @param id - 削除対象サブタスク ID
 * @param userId - 操作ユーザー ID
 * @returns 削除件数
 */
export async function deleteSubtask(
  client: Queryable,
  id: number,
  userId: number,
): Promise<number> {
  const result = await client.query(
    `DELETE FROM subtasks WHERE id = $1 AND task_id IN (
       SELECT t.id FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE r.user_id = $2
     )`,
    [id, userId],
  );
  return result.rowCount ?? 0;
}
