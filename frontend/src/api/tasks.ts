import type { Task, TaskSnapshotPayload } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export type { TaskSnapshotPayload } from "@kando/types";

export const createTask = (
  column_id: number,
  content: string,
  position: number,
  due_date: string | null = null,
): Promise<Task> =>
  apiClient.request<Task>(
    `${API_URL}/tasks`,
    apiClient.json("POST", {
      column_id,
      content,
      position,
      ...(due_date != null ? { due_date } : {}),
    }),
  );

export const updateTask = (
  id: number,
  patch: { content?: string; due_date?: string | null; completed?: boolean },
): Promise<Task> =>
  apiClient.request<Task>(
    `${API_URL}/tasks/${id}`,
    apiClient.json("PUT", patch),
  );

export const saveTaskSnapshot = (
  id: number,
  payload: TaskSnapshotPayload,
): Promise<Task> =>
  apiClient.request<Task>(
    `${API_URL}/tasks/${id}/snapshot`,
    apiClient.json("PUT", payload),
  );

export const moveTask = (
  id: number,
  column_id: number,
  position: number,
): Promise<Task> =>
  apiClient.request<Task>(
    `${API_URL}/tasks/${id}/move`,
    apiClient.json("PUT", { column_id, position }),
  );

export const deleteTask = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/tasks/${id}`, { method: "DELETE" });

export const copyTask = (id: number): Promise<Task> =>
  apiClient.request<Task>(`${API_URL}/tasks/${id}/copy`, { method: "POST" });
