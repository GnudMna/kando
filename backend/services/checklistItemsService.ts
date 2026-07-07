import { pool } from "../db.js";
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
  verifySubtaskOwnedByUser,
  verifyTaskOwnedByUser,
} from "../repositories/ownershipRepository.js";

/**
 * チェックリスト項目を新規作成する。
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let nextPosition: number;
    if (taskId !== null) {
      if (
        !(await verifyTaskOwnedByUser(client, taskId, userId, {
          forUpdate: true,
        }))
      ) {
        throw new NotFoundError("Task not found");
      }
      nextPosition = await nextChecklistPositionForTask(client, taskId);
    } else if (subtaskId !== null) {
      if (
        !(await verifySubtaskOwnedByUser(client, subtaskId, userId, {
          forUpdate: true,
        }))
      ) {
        throw new NotFoundError("Subtask not found");
      }
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

    await client.query("COMMIT");
    return item;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

type ChecklistItemPatch = {
  completed?: boolean;
  content?: string;
  position?: number;
};

/**
 * チェックリスト項目を部分更新する。
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
  const item = await updateChecklistItemQuery(pool, id, patch, userId);
  if (!item) {
    throw new NotFoundError("Checklist item not found");
  }
  return item;
}

/**
 * チェックリスト項目を削除する。
 * @param id - 削除対象 ID
 * @param userId - 操作ユーザー ID
 * @returns `true`: 削除成功
 * @throws NotFoundError 項目が見つからない場合
 */
export async function deleteChecklistItem(
  id: number,
  userId: number,
): Promise<boolean> {
  const deleted = await deleteChecklistItemQuery(pool, id, userId);
  if (deleted === 0) {
    throw new NotFoundError("Checklist item not found");
  }
  return true;
}
