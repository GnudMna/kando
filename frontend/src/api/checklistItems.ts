import type { ChecklistItem } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

/**
 * チェックリスト項目を作成する。
 * `task_id` または `subtask_id` のどちらか一方を指定する。
 * @param content - 項目内容
 * @param task_id - 親タスク ID(サブタスク配下の場合は省略)
 * @param subtask_id - 親サブタスク ID(タスク直下の場合は省略)
 * @returns 作成したチェックリスト項目
 */
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

/**
 * チェックリスト項目の内容・完了状態・表示順を部分更新する。
 * @param id - 項目 ID
 * @param patch - 更新フィールド
 * @returns 更新後の項目
 */
export const updateChecklistItem = (
  id: number,
  patch: { completed?: boolean; content?: string; position?: number },
): Promise<ChecklistItem> =>
  apiClient.request<ChecklistItem>(
    `${API_URL}/checklist-items/${id}`,
    apiClient.json("PUT", patch),
  );

/**
 * チェックリスト項目を削除する。
 * @param id - 項目 ID
 */
export const deleteChecklistItem = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/checklist-items/${id}`, {
    method: "DELETE",
  });
