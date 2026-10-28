import type { DbSubtask } from "../types.js";
import { NotFoundError } from "../errors.js";
import {
  lockTaskOfSubtask,
  verifyTaskOwnedByUser,
} from "../repositories/ownershipRepository.js";
import { bumpTaskRevision } from "../repositories/tasksRepository.js";
import { withTransaction } from "../transaction.js";
import {
  deleteSubtask as deleteSubtaskQuery,
  insertSubtask,
  updateSubtaskContent,
} from "../repositories/subtasksRepository.js";

/**
 * サブタスクを新規作成する。親タスクの `revision` も進める。
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
  return withTransaction(async (client) => {
    if (
      !(await verifyTaskOwnedByUser(client, taskId, userId, {
        forUpdate: true,
      }))
    ) {
      throw new NotFoundError("Task not found");
    }
    const subtask = await insertSubtask(client, taskId, content);
    await bumpTaskRevision(client, taskId);
    return { ...subtask, checklists: [] as [] };
  });
}

/**
 * サブタスク本文を更新する。親タスクの `revision` も進める。
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
  return withTransaction(async (client) => {
    const parentTaskId = await lockTaskOfSubtask(client, id, userId);
    if (parentTaskId === null) {
      throw new NotFoundError("Subtask not found");
    }
    const subtask = await updateSubtaskContent(client, id, content, userId);
    if (!subtask) {
      throw new NotFoundError("Subtask not found");
    }
    await bumpTaskRevision(client, parentTaskId);
    return subtask;
  });
}

/**
 * サブタスクを削除する。親タスクの `revision` も進める。
 * @param id - 削除対象サブタスク ID
 * @param userId - 操作ユーザー ID
 * @returns `true`: 削除成功
 * @throws NotFoundError サブタスクが見つからない場合
 */
export async function deleteSubtask(
  id: number,
  userId: number,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const parentTaskId = await lockTaskOfSubtask(client, id, userId);
    if (parentTaskId === null) {
      throw new NotFoundError("Subtask not found");
    }
    const deleted = await deleteSubtaskQuery(client, id, userId);
    if (deleted === 0) {
      throw new NotFoundError("Subtask not found");
    }
    await bumpTaskRevision(client, parentTaskId);
    return true;
  });
}
