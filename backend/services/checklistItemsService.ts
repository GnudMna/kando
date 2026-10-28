import type { DbChecklistItem } from "../types.js";
import { HttpError, NotFoundError } from "../errors.js";
import {
  deleteChecklistItem as deleteChecklistItemQuery,
  insertChecklistItem,
  nextChecklistPositionForSubtask,
  nextChecklistPositionForTask,
  updateChecklistItem as updateChecklistItemQuery,
} from "../repositories/checklistItemsRepository.js";
import {
  lockTaskOfChecklistItem,
  lockTaskOfSubtask,
  verifyTaskOwnedByUser,
} from "../repositories/ownershipRepository.js";
import { bumpTaskRevision } from "../repositories/tasksRepository.js";
import { withTransaction } from "../transaction.js";

/**
 * チェックリスト項目を新規作成する。親タスクの `revision` も進める。
 * @param content - 項目本文
 * @param taskId - 親タスク ID
 * @param subtaskId - 親サブタスク ID
 * @param userId - 操作ユーザー ID
 * @returns 作成されたチェックリスト項目
 * @throws NotFoundError 親が見つからない場合
 * @throws HttpError 親参照が不正な場合
 */
export async function createChecklistItem(
  content: string,
  taskId: number | null,
  subtaskId: number | null,
  userId: number,
): Promise<DbChecklistItem> {
  return withTransaction(async (client) => {
    let parentTaskId: number;
    let nextPosition: number;
    if (taskId !== null) {
      if (
        !(await verifyTaskOwnedByUser(client, taskId, userId, {
          forUpdate: true,
        }))
      ) {
        throw new NotFoundError("Task not found");
      }
      parentTaskId = taskId;
      nextPosition = await nextChecklistPositionForTask(client, taskId);
    } else if (subtaskId !== null) {
      const lockedTaskId = await lockTaskOfSubtask(client, subtaskId, userId);
      if (lockedTaskId === null) {
        throw new NotFoundError("Subtask not found");
      }
      parentTaskId = lockedTaskId;
      nextPosition = await nextChecklistPositionForSubtask(client, subtaskId);
    } else {
      throw new HttpError(500, "Invalid checklist parent refs");
    }

    const item = await insertChecklistItem(
      client,
      taskId,
      subtaskId,
      content.trim(),
      nextPosition,
    );
    await bumpTaskRevision(client, parentTaskId);
    return item;
  });
}

type ChecklistItemPatch = {
  completed?: boolean;
  content?: string;
  position?: number;
};

/**
 * チェックリスト項目を部分更新する。親タスクの `revision` も進める。
 * @param id - 更新対象 ID
 * @param patch - 更新フィールド
 * @param userId - 操作ユーザー ID
 * @returns 更新後項目
 * @throws NotFoundError 項目が見つからない場合
 */
export async function updateChecklistItem(
  id: number,
  patch: ChecklistItemPatch,
  userId: number,
): Promise<DbChecklistItem> {
  return withTransaction(async (client) => {
    const parentTaskId = await lockTaskOfChecklistItem(client, id, userId);
    if (parentTaskId === null) {
      throw new NotFoundError("Checklist item not found");
    }
    const item = await updateChecklistItemQuery(client, id, patch, userId);
    if (!item) {
      throw new NotFoundError("Checklist item not found");
    }
    await bumpTaskRevision(client, parentTaskId);
    return item;
  });
}

/**
 * チェックリスト項目を削除する。親タスクの `revision` も進める。
 * @param id - 削除対象 ID
 * @param userId - 操作ユーザー ID
 * @returns `true`: 削除成功
 * @throws NotFoundError 項目が見つからない場合
 */
export async function deleteChecklistItem(
  id: number,
  userId: number,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const parentTaskId = await lockTaskOfChecklistItem(client, id, userId);
    if (parentTaskId === null) {
      throw new NotFoundError("Checklist item not found");
    }
    const deleted = await deleteChecklistItemQuery(client, id, userId);
    if (deleted === 0) {
      throw new NotFoundError("Checklist item not found");
    }
    await bumpTaskRevision(client, parentTaskId);
    return true;
  });
}
