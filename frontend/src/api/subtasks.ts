import type { Subtask } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export const createSubtask = (
  task_id: number,
  content: string,
): Promise<Subtask> =>
  apiClient.request<Subtask>(
    `${API_URL}/subtasks`,
    apiClient.json("POST", { task_id, content }),
  );

export const updateSubtask = (id: number, content: string): Promise<Subtask> =>
  apiClient.request<Subtask>(
    `${API_URL}/subtasks/${id}`,
    apiClient.json("PUT", { content }),
  );

export const deleteSubtask = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/subtasks/${id}`, { method: "DELETE" });
