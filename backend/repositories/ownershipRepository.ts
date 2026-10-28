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
 * 子要素の親タスクを所有確認のうえ `FOR UPDATE` でロックし、その ID を返す。
 * @param client - クエリ実行クライアント
 * @param parentTaskIdSql - 親タスク ID を返す、`$1` を子要素 ID とする副問い合わせ
 * @param childId - 子要素 ID
 * @param userId - 操作ユーザー ID
 * @returns 親タスク ID。子要素が存在しない、または他ユーザーのものは `null`
 */
async function lockOwnedParentTask(
  client: Queryable,
  parentTaskIdSql: string,
  childId: number,
  userId: number,
): Promise<number | null> {
  const result = await client.query<{ id: number }>(
    `SELECT t.id FROM tasks t
     JOIN columns c ON c.id = t.column_id
     JOIN rows r ON r.id = c.row_id
     WHERE t.id = (${parentTaskIdSql}) AND r.user_id = $2
     FOR UPDATE OF t`,
    [childId, userId],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * サブタスクの親タスクをロックして ID を返す。
 * @param client - クエリ実行クライアント
 * @param subtaskId - サブタスク ID
 * @param userId - 操作ユーザー ID
 * @returns 親タスク ID。対象なしは `null`
 */
export function lockTaskOfSubtask(
  client: Queryable,
  subtaskId: number,
  userId: number,
): Promise<number | null> {
  return lockOwnedParentTask(
    client,
    "SELECT s.task_id FROM subtasks s WHERE s.id = $1",
    subtaskId,
    userId,
  );
}

/**
 * チェックリスト項目の親タスク(サブタスク配下ならその親タスク)をロックして ID を返す。
 * @param client - クエリ実行クライアント
 * @param itemId - チェックリスト項目 ID
 * @param userId - 操作ユーザー ID
 * @returns 親タスク ID。対象なしは `null`
 */
export function lockTaskOfChecklistItem(
  client: Queryable,
  itemId: number,
  userId: number,
): Promise<number | null> {
  return lockOwnedParentTask(
    client,
    `SELECT COALESCE(ci.task_id, s.task_id)
     FROM checklist_items ci
     LEFT JOIN subtasks s ON s.id = ci.subtask_id
     WHERE ci.id = $1`,
    itemId,
    userId,
  );
}

/**
 * タスクコメントの親タスクをロックして ID を返す。
 * @param client - クエリ実行クライアント
 * @param commentId - コメント ID
 * @param userId - 操作ユーザー ID
 * @returns 親タスク ID。対象なしは `null`
 */
export function lockTaskOfComment(
  client: Queryable,
  commentId: number,
  userId: number,
): Promise<number | null> {
  return lockOwnedParentTask(
    client,
    "SELECT tc.task_id FROM task_comments tc WHERE tc.id = $1",
    commentId,
    userId,
  );
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
