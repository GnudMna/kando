import type { Column } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

/**
 * カラムを作成する。
 * @param title - カラムタイトル
 * @param position - 表示順
 * @param row_id - 所属行 ID
 * @returns 作成したカラム
 */
export const createColumn = (
  title: string,
  position: number,
  row_id: number,
): Promise<Column> =>
  apiClient.request<Column>(
    `${API_URL}/columns`,
    apiClient.json("POST", { title, position, row_id }),
  );

/**
 * カラムタイトルを更新する。
 * @param id - カラム ID
 * @param title - 新しいタイトル
 * @returns 更新後のカラム
 */
export const updateColumn = (id: number, title: string): Promise<Column> =>
  apiClient.request<Column>(
    `${API_URL}/columns/${id}`,
    apiClient.json("PUT", { title }),
  );

/**
 * カラムを削除する(配下のタスクも CASCADE で削除される)。
 * @param id - カラム ID
 */
export const deleteColumn = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/columns/${id}`, { method: "DELETE" });

/**
 * カラムの表示順を更新する。
 * @param id - カラム ID
 * @param position - 新しい表示順
 * @returns 移動後のカラム
 */
export const moveColumn = (id: number, position: number): Promise<Column> =>
  apiClient.request<Column>(
    `${API_URL}/columns/${id}/move`,
    apiClient.json("PUT", { position }),
  );
