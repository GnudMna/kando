import type { ChecklistItem } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export const createChecklistItem = (
  content: string,
  task_id?: number | null,
  subtask_id?: number | null,
): Promise<ChecklistItem> =>
  apiClient.request<ChecklistItem>(
    `${API_URL}/checklist-items`,
    apiClient.json("POST", {
      task_id: task_id ?? null,
      subtask_id: subtask_id ?? null,
      content,
    }),
  );

export const updateChecklistItem = (
  id: number,
  patch: { completed?: boolean; content?: string; position?: number },
): Promise<ChecklistItem> =>
  apiClient.request<ChecklistItem>(
    `${API_URL}/checklist-items/${id}`,
    apiClient.json("PUT", patch),
  );

export const deleteChecklistItem = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/checklist-items/${id}`, {
    method: "DELETE",
  });
