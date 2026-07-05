import type { TaskComment } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export const createTaskComment = (
  task_id: number,
  content: string,
): Promise<TaskComment> =>
  apiClient.request<TaskComment>(
    `${API_URL}/task-comments`,
    apiClient.json("POST", { task_id, content }),
  );

export const updateTaskComment = (
  id: number,
  patch: { content?: string; position?: number },
): Promise<TaskComment> =>
  apiClient.request<TaskComment>(
    `${API_URL}/task-comments/${id}`,
    apiClient.json("PUT", patch),
  );

export const deleteTaskComment = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/task-comments/${id}`, {
    method: "DELETE",
  });
