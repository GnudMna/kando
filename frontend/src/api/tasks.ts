import type { Task, TaskSnapshotPayload, WithRebalanced } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export type { TaskSnapshotPayload } from "@kando/types";

/**
 * 新しいタスクを作成する。
 * @param column_id - 所属カラム ID
 * @param content - タスク内容
 * @param position - 表示順
 * @param due_date - 期限日(`YYYY-MM-DD`、省略時は未設定)
 * @returns 作成したタスク。position の衝突で振り直しが起きた場合は `rebalanced` を含む
 */
export const createTask = (
  column_id: number,
  content: string,
  position: number,
  due_date: string | null = null,
): Promise<WithRebalanced<Task>> =>
  apiClient.request<WithRebalanced<Task>>(
    `${API_URL}/tasks`,
    apiClient.json("POST", {
      column_id,
      content,
      position,
      ...(due_date != null ? { due_date } : {}),
    }),
  );

/**
 * タスクの内容・期限・完了状態を部分更新する。
 * @param id - タスク ID
 * @param patch - 更新フィールド
 * @returns 更新後のタスク
 */
export const updateTask = (
  id: number,
  patch: { content?: string; due_date?: string | null; completed?: boolean },
): Promise<Task> =>
  apiClient.request<Task>(
    `${API_URL}/tasks/${id}`,
    apiClient.json("PUT", patch),
  );

/**
 * タスク編集モーダルの内容を単一リクエストで一括保存する。
 * @param id - タスク ID
 * @param payload - スナップショット保存ペイロード
 * @returns 保存後のタスク(子要素含む)
 */
export const saveTaskSnapshot = (
  id: number,
  payload: TaskSnapshotPayload,
): Promise<Task> =>
  apiClient.request<Task>(
    `${API_URL}/tasks/${id}/snapshot`,
    apiClient.json("PUT", payload),
  );

/**
 * タスクを別カラムへ移動する。
 * @param id - 移動対象タスク ID
 * @param column_id - 移動先カラム ID
 * @param position - 移動先の表示順
 * @returns 移動後のタスク。position の衝突で振り直しが起きた場合は `rebalanced` を含む
 */
export const moveTask = (
  id: number,
  column_id: number,
  position: number,
): Promise<WithRebalanced<Task>> =>
  apiClient.request<WithRebalanced<Task>>(
    `${API_URL}/tasks/${id}/move`,
    apiClient.json("PUT", { column_id, position }),
  );

/**
 * タスクを削除する。
 * @param id - タスク ID
 */
export const deleteTask = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/tasks/${id}`, { method: "DELETE" });

/**
 * タスクを複製する(未完了状態でコピー)。
 * @param id - 複製元タスク ID
 * @returns 複製されたタスク
 */
export const copyTask = (id: number): Promise<Task> =>
  apiClient.request<Task>(`${API_URL}/tasks/${id}/copy`, { method: "POST" });

/**
 * タスク詳細(サブタスク・チェックリスト・コメント含む)を取得する。
 * @param id - タスク ID
 * @returns 詳細付きタスク
 */
export const fetchTask = (id: number): Promise<Task> =>
  apiClient.request<Task>(`${API_URL}/tasks/${id}`);
