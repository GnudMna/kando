import type { Row } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

/** `fetchBoard` のクエリパラメータオプション。 */
export interface FetchBoardOptions {
  row_id?: number;
  limit?: number;
  offset?: number;
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

  const query = params.toString();
  const url = query ? `${API_URL}/board?${query}` : `${API_URL}/board`;
  return apiClient.request<Row[]>(url);
};
