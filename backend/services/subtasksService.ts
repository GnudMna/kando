import { pool } from "../db.js";
import type { DbSubtask } from "../types.js";
import { NotFoundError } from "../errors.js";
import { verifyTaskOwnedByUser } from "../repositories/ownershipRepository.js";
import {
  deleteSubtask as deleteSubtaskQuery,
  insertSubtask,
  updateSubtaskContent,
} from "../repositories/subtasksRepository.js";

/**
 * サブタスクを新規作成する。
 * @param taskId - 親タスク ID
 * @param content - サブタスク本文
 * @param userId - 操作ユーザー ID
 * @returns 作成されたサブタスク(チェックリストは空)
 * @throws NotFoundError 親タスクが見つからない場合
 */
export async function createSubtask(
  taskId: number,
  content: string,
  userId: number,
): Promise<DbSubtask & { checklists: [] }> {
  if (!(await verifyTaskOwnedByUser(pool, taskId, userId))) {
    throw new NotFoundError("Task not found");
  }
  const subtask = await insertSubtask(pool, taskId, content);
  return { ...subtask, checklists: [] };
}

/**
 * サブタスク本文を更新する。
 * @param id - 更新対象サブタスク ID
 * @param content - 新しい本文
 * @param userId - 操作ユーザー ID
 * @returns 更新後サブタスク
 * @throws NotFoundError サブタスクが見つからない場合
 */
export async function updateSubtask(
  id: number,
  content: string,
  userId: number,
): Promise<DbSubtask> {
  const subtask = await updateSubtaskContent(pool, id, content, userId);
  if (!subtask) {
    throw new NotFoundError("Subtask not found");
  }
  return subtask;
}

/**
 * サブタスクを削除する。
 * @param id - 削除対象サブタスク ID
 * @param userId - 操作ユーザー ID
 * @returns `true`: 削除成功
 * @throws NotFoundError サブタスクが見つからない場合
 */
export async function deleteSubtask(
  id: number,
  userId: number,
): Promise<boolean> {
  const deleted = await deleteSubtaskQuery(pool, id, userId);
  if (deleted === 0) {
    throw new NotFoundError("Subtask not found");
  }
  return true;
}
