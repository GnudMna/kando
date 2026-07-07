import type { DbTaskComment } from "../types.js";
import type { Queryable } from "./rowsRepository.js";

export const COMMENT_POSITION_INCREMENT = 1000;

/**
 * タスク配下の次のコメント position を取得する。
 * @param client - クエリ実行クライアント
 * @param taskId - 親タスク ID
 * @returns 次に採番する position 値
 */
export async function nextCommentPosition(
  client: Queryable,
  taskId: number,
): Promise<number> {
  const result = await client.query<{ next_position: number }>(
    `SELECT COALESCE(MAX(position), 0) + ${COMMENT_POSITION_INCREMENT} AS next_position FROM task_comments WHERE task_id = $1`,
    [taskId],
  );
  return result.rows[0]?.next_position ?? COMMENT_POSITION_INCREMENT;
}

/**
 * タスクコメントを新規作成する。
 * @param client - クエリ実行クライアント
 * @param taskId - 親タスク ID
 * @param content - コメント本文
 * @param position - 表示順
 * @returns 作成されたコメント
 */
export async function insertTaskComment(
  client: Queryable,
  taskId: number,
  content: string,
  position: number,
): Promise<DbTaskComment> {
  const result = await client.query<DbTaskComment>(
    "INSERT INTO task_comments (task_id, content, position) VALUES ($1, $2, $3) RETURNING *",
    [taskId, content, position],
  );
  return result.rows[0];
}

type TaskCommentPatch = {
  content?: string;
  position?: number;
};

/**
 * タスクコメントを部分更新する。
 * @param client - クエリ実行クライアント
 * @param id - 更新対象 ID
 * @param patch - 更新フィールド
 * @param userId - 操作ユーザー ID
 * @returns 更新後コメント。対象なしは `null`
 */
export async function updateTaskComment(
  client: Queryable,
  id: number,
  patch: TaskCommentPatch,
  userId: number,
): Promise<DbTaskComment | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (patch.content !== undefined) {
    fields.push(`content = $${idx++}`);
    vals.push(patch.content);
  }
  if (patch.position !== undefined) {
    fields.push(`position = $${idx++}`);
    vals.push(patch.position);
  }

  vals.push(id);
  vals.push(userId);

  const result = await client.query<DbTaskComment>(
    `UPDATE task_comments SET ${fields.join(", ")} WHERE id = $${idx}
     AND task_id IN (
       SELECT t.id FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE r.user_id = $${idx + 1}
     ) RETURNING *`,
    vals,
  );
  return result.rows[0] ?? null;
}

/**
 * タスクコメントを削除する。
 * @param client - クエリ実行クライアント
 * @param id - 削除対象 ID
 * @param userId - 操作ユーザー ID
 * @returns 削除件数
 */
export async function deleteTaskComment(
  client: Queryable,
  id: number,
  userId: number,
): Promise<number> {
  const result = await client.query(
    `DELETE FROM task_comments WHERE id = $1
     AND task_id IN (
       SELECT t.id FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE r.user_id = $2
     )`,
    [id, userId],
  );
  return result.rowCount ?? 0;
}
