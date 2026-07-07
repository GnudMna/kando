import type { DbMemo } from "@kando/types";
import type { Queryable } from "./rowsRepository.js";

export type MemoWithTasks = DbMemo & {
  tasks: { id: number; content: string }[];
};

const MEMO_WITH_TASKS_SELECT = `SELECT m.*,
  COALESCE(
    JSON_AGG(JSON_BUILD_OBJECT('id', t.id, 'content', t.content)
      ORDER BY t.id) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  ) AS tasks
FROM memos m
LEFT JOIN task_memo_links tml ON tml.memo_id = m.id
LEFT JOIN tasks t ON t.id = tml.task_id`;

/**
 * ユーザーのメモ一覧を関連タスク付きで取得する。
 * @param client - クエリ実行クライアント
 * @param userId - 操作ユーザー ID
 * @returns 更新日時降順のメモ配列
 */
export async function fetchMemosWithTasks(
  client: Queryable,
  userId: number,
): Promise<MemoWithTasks[]> {
  const result = await client.query<MemoWithTasks>(
    `${MEMO_WITH_TASKS_SELECT}
     WHERE m.user_id = $1
     GROUP BY m.id
     ORDER BY m.updated_at DESC`,
    [userId],
  );
  return result.rows;
}

/**
 * メモ1件を関連タスク付きで取得する。
 * @param client - クエリ実行クライアント
 * @param memoId - 取得対象メモ ID
 * @param userId - 操作ユーザー ID
 * @returns メモ。該当なしは `null`
 */
export async function fetchMemoWithTasks(
  client: Queryable,
  memoId: number,
  userId: number,
): Promise<MemoWithTasks | null> {
  const result = await client.query<MemoWithTasks>(
    `${MEMO_WITH_TASKS_SELECT}
     WHERE m.id = $1 AND m.user_id = $2
     GROUP BY m.id`,
    [memoId, userId],
  );
  return result.rows[0] ?? null;
}

/**
 * メモを新規作成する。
 * @param client - クエリ実行クライアント
 * @param userId - 所有者ユーザー ID
 * @param title - タイトル
 * @param content - 本文
 * @returns 作成されたメモレコード
 */
export async function insertMemo(
  client: Queryable,
  userId: number,
  title: string,
  content: string,
): Promise<DbMemo> {
  const result = await client.query<DbMemo>(
    "INSERT INTO memos (user_id, title, content) VALUES ($1, $2, $3) RETURNING *",
    [userId, title, content],
  );
  return result.rows[0];
}

/**
 * メモを部分更新する。
 * @param client - クエリ実行クライアント
 * @param id - 更新対象メモ ID
 * @param userId - 操作ユーザー ID
 * @param title - 新しいタイトル。未指定時は変更しない
 * @param content - 新しい本文。未指定時は変更しない
 * @returns 更新件数
 */
export async function updateMemo(
  client: Queryable,
  id: number,
  userId: number,
  title: string | undefined,
  content: string | undefined,
): Promise<number> {
  const result = await client.query(
    `UPDATE memos
     SET title = COALESCE($1, title),
         content = COALESCE($2, content),
         updated_at = NOW()
     WHERE id = $3 AND user_id = $4`,
    [title ?? null, content ?? null, id, userId],
  );
  return result.rowCount ?? 0;
}

/**
 * メモを削除する。
 * @param client - クエリ実行クライアント
 * @param id - 削除対象メモ ID
 * @param userId - 操作ユーザー ID
 * @returns 削除件数
 */
export async function deleteMemo(
  client: Queryable,
  id: number,
  userId: number,
): Promise<number> {
  const result = await client.query(
    "DELETE FROM memos WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return result.rowCount ?? 0;
}

/**
 * タスクとメモの関連付けを追加する(重複は無視)。
 * @param client - クエリ実行クライアント
 * @param taskId - タスク ID
 * @param memoId - メモ ID
 */
export async function linkMemoTask(
  client: Queryable,
  taskId: number,
  memoId: number,
): Promise<void> {
  await client.query(
    "INSERT INTO task_memo_links (task_id, memo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [taskId, memoId],
  );
}

/**
 * タスクとメモの関連付けを解除する。
 * @param client - クエリ実行クライアント
 * @param taskId - タスク ID
 * @param memoId - メモ ID
 */
export async function unlinkMemoTask(
  client: Queryable,
  taskId: number,
  memoId: number,
): Promise<void> {
  await client.query(
    "DELETE FROM task_memo_links WHERE task_id = $1 AND memo_id = $2",
    [taskId, memoId],
  );
}
