import type { Row } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

/** `fetchBoard` のクエリパラメータオプション。 */
export interface FetchBoardOptions {
  row_id?: number;
  limit?: number;
  offset?: number;
  /** 既定 `summary`（軽量）。`full` で子要素をすべて含める。 */
  detail?: "summary" | "full";
  /** サーバー側横断検索（指定時は `detail` を無視して一致タスクのみ返す） */
  q?: string;
}

/** ボード全体のデータ（行 -> カラム -> タスク の階層構造）を取得する。 */
export const fetchBoard = (options?: FetchBoardOptions): Promise<Row[]> => {
  const params = new URLSearchParams();

  if (options?.row_id !== undefined) {
    params.set("row_id", String(options.row_id));
  }
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set("offset", String(options.offset));
  }
  if (options?.detail !== undefined) {
    params.set("detail", options.detail);
  }
  if (options?.q !== undefined && options.q.trim()) {
    params.set("q", options.q.trim());
  }

  const query = params.toString();
  const url = query ? `${API_URL}/board?${query}` : `${API_URL}/board`;
  return apiClient.request<Row[]>(url);
};
