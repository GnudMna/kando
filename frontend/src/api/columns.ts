import type { Column } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export const createColumn = (
  title: string,
  position: number,
  row_id: number,
): Promise<Column> =>
  apiClient.request<Column>(
    `${API_URL}/columns`,
    apiClient.json("POST", { title, position, row_id }),
  );

export const updateColumn = (id: number, title: string): Promise<Column> =>
  apiClient.request<Column>(
    `${API_URL}/columns/${id}`,
    apiClient.json("PUT", { title }),
  );

export const deleteColumn = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/columns/${id}`, { method: "DELETE" });

export const moveColumn = (id: number, position: number): Promise<Column> =>
  apiClient.request<Column>(
    `${API_URL}/columns/${id}/move`,
    apiClient.json("PUT", { position }),
  );
