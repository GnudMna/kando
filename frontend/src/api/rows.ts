import type { Row } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

/**
 * 行を作成する。
 * @param title - 行タイトル
 * @param position - 表示順
 * @returns 作成した行
 */
export const createRow = (title: string, position: number): Promise<Row> =>
  apiClient.request<Row>(
    `${API_URL}/rows`,
    apiClient.json("POST", { title, position }),
  );

/**
 * 行とデフォルト3カラムを一括作成する。
 * @param title - 行タイトル
 * @param position - 表示順
 * @returns デフォルト3カラム付きの行
 */
export const createRowWithDefaultColumns = (
  title: string,
  position: number,
): Promise<Row> =>
  apiClient.request<Row>(
    `${API_URL}/rows/with-default-columns`,
    apiClient.json("POST", { title, position }),
  );

/**
 * 行タイトルを更新する。
 * @param id - 行 ID
 * @param title - 新しいタイトル
 * @returns 更新後の行
 */
export const updateRow = (id: number, title: string): Promise<Row> =>
  apiClient.request<Row>(
    `${API_URL}/rows/${id}`,
    apiClient.json("PUT", { title }),
  );

/**
 * 行を削除する(配下のカラム・タスクも CASCADE で削除される)。
 * @param id - 行 ID
 */
export const deleteRow = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/rows/${id}`, { method: "DELETE" });
