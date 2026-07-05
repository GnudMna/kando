import type { Memo } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export type { Memo } from "@kando/types";

export const fetchMemos = (): Promise<Memo[]> =>
  apiClient.request<Memo[]>(`${API_URL}/memos`);

export const createMemo = (title: string, content: string): Promise<Memo> =>
  apiClient.request<Memo>(
    `${API_URL}/memos`,
    apiClient.json("POST", { title, content }),
  );

export const updateMemo = (
  id: number,
  patch: { title?: string; content?: string },
): Promise<Memo> =>
  apiClient.request<Memo>(
    `${API_URL}/memos/${id}`,
    apiClient.json("PUT", patch),
  );

export const deleteMemo = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/memos/${id}`, { method: "DELETE" });

export const linkMemoTask = (memoId: number, taskId: number): Promise<Memo> =>
  apiClient.request<Memo>(
    `${API_URL}/memos/${memoId}/tasks`,
    apiClient.json("POST", { task_id: taskId }),
  );

export const unlinkMemoTask = (memoId: number, taskId: number): Promise<Memo> =>
  apiClient.request<Memo>(`${API_URL}/memos/${memoId}/tasks/${taskId}`, {
    method: "DELETE",
  });
