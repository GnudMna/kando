import { pool } from "../db.js";
import type { DbTaskComment } from "../types.js";
import { NotFoundError } from "../errors.js";
import { verifyTaskOwnedByUser } from "../repositories/ownershipRepository.js";
import {
  deleteTaskComment as deleteTaskCommentQuery,
  insertTaskComment,
  nextCommentPosition,
  updateTaskComment as updateTaskCommentQuery,
} from "../repositories/taskCommentsRepository.js";

/**
 * タスクコメントを新規作成する。
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (
      !(await verifyTaskOwnedByUser(client, taskId, userId, {
        forUpdate: true,
      }))
    ) {
      throw new NotFoundError("Task not found");
    }
    const position = await nextCommentPosition(client, taskId);
    const comment = await insertTaskComment(client, taskId, content, position);
    await client.query("COMMIT");
    return comment;
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

type TaskCommentPatch = {
  content?: string;
  position?: number;
};

/**
 * タスクコメントを部分更新する。
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
  const comment = await updateTaskCommentQuery(pool, id, patch, userId);
  if (!comment) {
    throw new NotFoundError("Comment not found");
  }
  return comment;
}

/**
 * タスクコメントを削除する。
 * @param id - 削除対象 ID
 * @param userId - 操作ユーザー ID
 * @returns `true`: 削除成功
 * @throws NotFoundError コメントが見つからない場合
 */
export async function deleteTaskComment(
  id: number,
  userId: number,
): Promise<boolean> {
  const deleted = await deleteTaskCommentQuery(pool, id, userId);
  if (deleted === 0) {
    throw new NotFoundError("Comment not found");
  }
  return true;
}
