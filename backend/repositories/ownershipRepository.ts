import type { Queryable } from "./rowsRepository.js";

/**
 * タスクが指定ユーザーに属するか確認する。
 * @param client - クエリ実行クライアント
 * @param taskId - 確認対象タスク ID
 * @param userId - 操作ユーザー ID
 * @param options.forUpdate - `true` のとき `FOR UPDATE` で行ロックする
 * @returns 所有している場合は `true`
 */
export async function verifyTaskOwnedByUser(
  client: Queryable,
  taskId: number,
  userId: number,
  options?: { forUpdate?: boolean },
): Promise<boolean> {
  const lock = options?.forUpdate ? " FOR UPDATE" : "";
  const result = await client.query<{ id: number }>(
    `SELECT t.id FROM tasks t
     JOIN columns c ON c.id = t.column_id
     JOIN rows r ON r.id = c.row_id
     WHERE t.id = $1 AND r.user_id = $2${lock}`,
    [taskId, userId],
  );
  return !!result.rows[0];
}

/**
 * サブタスクが指定ユーザーに属するか確認する。
 * @param client - クエリ実行クライアント
 * @param subtaskId - 確認対象サブタスク ID
 * @param userId - 操作ユーザー ID
 * @param options.forUpdate - `true` のとき `FOR UPDATE` で行ロックする
 * @returns 所有している場合は `true`
 */
export async function verifySubtaskOwnedByUser(
  client: Queryable,
  subtaskId: number,
  userId: number,
  options?: { forUpdate?: boolean },
): Promise<boolean> {
  const lock = options?.forUpdate ? " FOR UPDATE" : "";
  const result = await client.query<{ id: number }>(
    `SELECT s.id FROM subtasks s
     JOIN tasks t ON t.id = s.task_id
     JOIN columns c ON c.id = t.column_id
     JOIN rows r ON r.id = c.row_id
     WHERE s.id = $1 AND r.user_id = $2${lock}`,
    [subtaskId, userId],
  );
  return !!result.rows[0];
}

/**
 * メモが指定ユーザーに属するか確認する。
 * @param client - クエリ実行クライアント
 * @param memoId - 確認対象メモ ID
 * @param userId - 操作ユーザー ID
 * @returns 所有している場合は `true`
 */
export async function verifyMemoOwnedByUser(
  client: Queryable,
  memoId: number,
  userId: number,
): Promise<boolean> {
  const result = await client.query(
    "SELECT id FROM memos WHERE id = $1 AND user_id = $2",
    [memoId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
