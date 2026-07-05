import type { TaskComment } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

/**
 * タスクコメントを作成する。
 * @param task_id - 親タスク ID
 * @param content - コメント内容
 * @returns 作成したコメント
 */
export const createTaskComment = (
  task_id: number,
  content: string,
): Promise<TaskComment> =>
  apiClient.request<TaskComment>(
    `${API_URL}/task-comments`,
    apiClient.json("POST", { task_id, content }),
  );

/**
 * タスクコメントの内容・表示順を部分更新する。
 * @param id - コメント ID
 * @param patch - 更新フィールド
 * @returns 更新後のコメント
 */
export const updateTaskComment = (
  id: number,
  patch: { content?: string; position?: number },
): Promise<TaskComment> =>
  apiClient.request<TaskComment>(
    `${API_URL}/task-comments/${id}`,
    apiClient.json("PUT", patch),
  );

/**
 * タスクコメントを削除する。
 * @param id - コメント ID
 */
export const deleteTaskComment = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/task-comments/${id}`, {
    method: "DELETE",
  });
