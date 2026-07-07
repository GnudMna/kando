import { pool } from "../db.js";
import { NotFoundError } from "../errors.js";
import {
  deleteMemo as deleteMemoQuery,
  fetchMemoWithTasks,
  fetchMemosWithTasks,
  insertMemo,
  linkMemoTask,
  unlinkMemoTask,
  updateMemo as updateMemoQuery,
  type MemoWithTasks,
} from "../repositories/memosRepository.js";
import {
  verifyMemoOwnedByUser,
  verifyTaskOwnedByUser,
} from "../repositories/ownershipRepository.js";

/**
 * ユーザーのメモ一覧を取得する。
 * @param userId - 操作ユーザー ID
 * @returns 関連タスク付きメモ配列
 */
export async function listMemos(userId: number): Promise<MemoWithTasks[]> {
  return fetchMemosWithTasks(pool, userId);
}

/**
 * メモを新規作成する。
 * @param userId - 所有者ユーザー ID
 * @param title - タイトル
 * @param content - 本文
 * @returns 作成されたメモ(関連タスクは空)
 */
export async function createMemo(
  userId: number,
  title: string,
  content: string,
): Promise<MemoWithTasks> {
  const memo = await insertMemo(pool, userId, title, content);
  return { ...memo, tasks: [] };
}

/**
 * メモを更新する。
 * @param id - 更新対象メモ ID
 * @param userId - 操作ユーザー ID
 * @param title - 新しいタイトル
 * @param content - 新しい本文
 * @returns 更新後メモ
 * @throws NotFoundError メモが見つからない場合
 */
export async function updateMemo(
  id: number,
  userId: number,
  title: string | undefined,
  content: string | undefined,
): Promise<MemoWithTasks> {
  const updated = await updateMemoQuery(pool, id, userId, title, content);
  if (updated === 0) {
    throw new NotFoundError("Memo not found");
  }
  const memo = await fetchMemoWithTasks(pool, id, userId);
  if (!memo) {
    throw new NotFoundError("Memo not found");
  }
  return memo;
}

/**
 * メモを削除する。
 * @param id - 削除対象メモ ID
 * @param userId - 操作ユーザー ID
 * @throws NotFoundError メモが見つからない場合
 */
export async function deleteMemo(id: number, userId: number): Promise<void> {
  const deleted = await deleteMemoQuery(pool, id, userId);
  if (deleted === 0) {
    throw new NotFoundError("Memo not found");
  }
}

/**
 * タスクとメモを関連付ける。
 * @param memoId - メモ ID
 * @param taskId - タスク ID
 * @param userId - 操作ユーザー ID
 * @returns 更新後メモ
 * @throws NotFoundError メモまたはタスクが見つからない場合
 */
export async function linkTaskToMemo(
  memoId: number,
  taskId: number,
  userId: number,
): Promise<MemoWithTasks> {
  if (!(await verifyMemoOwnedByUser(pool, memoId, userId))) {
    throw new NotFoundError("Memo not found");
  }
  if (!(await verifyTaskOwnedByUser(pool, taskId, userId))) {
    throw new NotFoundError("Task not found");
  }
  await linkMemoTask(pool, taskId, memoId);
  const memo = await fetchMemoWithTasks(pool, memoId, userId);
  if (!memo) {
    throw new NotFoundError("Memo not found");
  }
  return memo;
}

/**
 * タスクとメモの関連付けを解除する。
 * @param memoId - メモ ID
 * @param taskId - タスク ID
 * @param userId - 操作ユーザー ID
 * @returns 更新後メモ
 * @throws NotFoundError メモが見つからない場合
 */
export async function unlinkTaskFromMemo(
  memoId: number,
  taskId: number,
  userId: number,
): Promise<MemoWithTasks> {
  if (!(await verifyMemoOwnedByUser(pool, memoId, userId))) {
    throw new NotFoundError("Memo not found");
  }
  await unlinkMemoTask(pool, taskId, memoId);
  const memo = await fetchMemoWithTasks(pool, memoId, userId);
  if (!memo) {
    throw new NotFoundError("Memo not found");
  }
  return memo;
}
