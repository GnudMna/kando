import type { Subtask } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

/**
 * サブタスクを作成する。
 * @param task_id - 親タスク ID
 * @param content - サブタスク内容
 * @returns 作成したサブタスク
 */
export const createSubtask = (
  task_id: number,
  content: string,
): Promise<Subtask> =>
  apiClient.request<Subtask>(
    `${API_URL}/subtasks`,
    apiClient.json("POST", { task_id, content }),
  );

/**
 * サブタスクの内容を更新する。
 * @param id - サブタスク ID
 * @param content - 新しい内容
 * @returns 更新後のサブタスク
 */
export const updateSubtask = (id: number, content: string): Promise<Subtask> =>
  apiClient.request<Subtask>(
    `${API_URL}/subtasks/${id}`,
    apiClient.json("PUT", { content }),
  );

/**
 * サブタスクを削除する(配下のチェックリストも CASCADE で削除される)。
 * @param id - サブタスク ID
 */
export const deleteSubtask = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/subtasks/${id}`, { method: "DELETE" });
