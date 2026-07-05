import type { Memo } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export type { Memo } from "@kando/types";

/**
 * メモ一覧を取得する。
 * @returns 認証ユーザーのメモ配列
 */
export const fetchMemos = (): Promise<Memo[]> =>
  apiClient.request<Memo[]>(`${API_URL}/memos`);

/**
 * メモを作成する。
 * @param title - メモタイトル
 * @param content - メモ内容
 * @returns 作成したメモ
 */
export const createMemo = (title: string, content: string): Promise<Memo> =>
  apiClient.request<Memo>(
    `${API_URL}/memos`,
    apiClient.json("POST", { title, content }),
  );

/**
 * メモのタイトル・内容を部分更新する。
 * @param id - メモ ID
 * @param patch - 更新フィールド
 * @returns 更新後のメモ
 */
export const updateMemo = (
  id: number,
  patch: { title?: string; content?: string },
): Promise<Memo> =>
  apiClient.request<Memo>(
    `${API_URL}/memos/${id}`,
    apiClient.json("PUT", patch),
  );

/**
 * メモを削除する。
 * @param id - メモ ID
 */
export const deleteMemo = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/memos/${id}`, { method: "DELETE" });

/**
 * メモにタスクを関連付ける。
 * @param memoId - メモ ID
 * @param taskId - 関連付けるタスク ID
 * @returns 関連付け後のメモ
 */
export const linkMemoTask = (memoId: number, taskId: number): Promise<Memo> =>
  apiClient.request<Memo>(
    `${API_URL}/memos/${memoId}/tasks`,
    apiClient.json("POST", { task_id: taskId }),
  );

/**
 * メモとタスクの関連付けを解除する。
 * @param memoId - メモ ID
 * @param taskId - 解除するタスク ID
 * @returns 解除後のメモ
 */
export const unlinkMemoTask = (memoId: number, taskId: number): Promise<Memo> =>
  apiClient.request<Memo>(`${API_URL}/memos/${memoId}/tasks/${taskId}`, {
    method: "DELETE",
  });
