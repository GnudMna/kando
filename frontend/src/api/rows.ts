import type { Row } from "@kando/types";
import { API_URL, apiClient } from "./client.js";

export const createRow = (title: string, position: number): Promise<Row> =>
  apiClient.request<Row>(
    `${API_URL}/rows`,
    apiClient.json("POST", { title, position }),
  );

export const createRowWithDefaultColumns = (
  title: string,
  position: number,
): Promise<Row> =>
  apiClient.request<Row>(
    `${API_URL}/rows/with-default-columns`,
    apiClient.json("POST", { title, position }),
  );

export const updateRow = (id: number, title: string): Promise<Row> =>
  apiClient.request<Row>(
    `${API_URL}/rows/${id}`,
    apiClient.json("PUT", { title }),
  );

export const deleteRow = (id: number): Promise<void> =>
  apiClient.request<void>(`${API_URL}/rows/${id}`, { method: "DELETE" });
