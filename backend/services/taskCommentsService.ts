import type { DbTaskComment } from "../types.js";
import { NotFoundError } from "../errors.js";
import {
  lockTaskOfComment,
  verifyTaskOwnedByUser,
} from "../repositories/ownershipRepository.js";
import { bumpTaskRevision } from "../repositories/tasksRepository.js";
import { withTransaction } from "../transaction.js";
import {
  deleteTaskComment as deleteTaskCommentQuery,
  insertTaskComment,
  nextCommentPosition,
  updateTaskComment as updateTaskCommentQuery,
} from "../repositories/taskCommentsRepository.js";

/**
 * タスクコメントを新規作成する。親タスクの `revision` も進める。
 * @param taskId - 親タスク ID
 * @param content - コメント本文
 * @param userId - 操作ユーザー ID
 * @returns 作成されたコメント
 * @throws NotFoundError 親タスクが見つからない場合
 */
export async function createTaskComment(
  taskId: number,
  content: string,
  userId: number,
): Promise<DbTaskComment> {
  return withTransaction(async (client) => {
    if (
      !(await verifyTaskOwnedByUser(client, taskId, userId, {
        forUpdate: true,
      }))
    ) {
      throw new NotFoundError("Task not found");
    }
    const position = await nextCommentPosition(client, taskId);
    const comment = await insertTaskComment(client, taskId, content, position);
    await bumpTaskRevision(client, taskId);
    return comment;
  });
}

type TaskCommentPatch = {
  content?: string;
  position?: number;
};

/**
 * タスクコメントを部分更新する。親タスクの `revision` も進める。
 * @param id - 更新対象 ID
 * @param patch - 更新フィールド
 * @param userId - 操作ユーザー ID
 * @returns 更新後コメント
 * @throws NotFoundError コメントが見つからない場合
 */
export async function updateTaskComment(
  id: number,
  patch: TaskCommentPatch,
  userId: number,
): Promise<DbTaskComment> {
  return withTransaction(async (client) => {
    const parentTaskId = await lockTaskOfComment(client, id, userId);
    if (parentTaskId === null) {
      throw new NotFoundError("Comment not found");
    }
    const comment = await updateTaskCommentQuery(client, id, patch, userId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }
    await bumpTaskRevision(client, parentTaskId);
    return comment;
  });
}

/**
 * タスクコメントを削除する。親タスクの `revision` も進める。
 * @param id - 削除対象 ID
 * @param userId - 操作ユーザー ID
 * @returns `true`: 削除成功
 * @throws NotFoundError コメントが見つからない場合
 */
export async function deleteTaskComment(
  id: number,
  userId: number,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const parentTaskId = await lockTaskOfComment(client, id, userId);
    if (parentTaskId === null) {
      throw new NotFoundError("Comment not found");
    }
    const deleted = await deleteTaskCommentQuery(client, id, userId);
    if (deleted === 0) {
      throw new NotFoundError("Comment not found");
    }
    await bumpTaskRevision(client, parentTaskId);
    return true;
  });
}
