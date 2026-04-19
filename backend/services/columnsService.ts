import { pool } from "../db.js";
import type { DbColumn } from "../types.js";
import {
  deleteColumn as deleteColumnQuery,
  insertColumn as insertColumnQuery,
  moveColumn as moveColumnQuery,
  updateColumnTitle as updateColumnTitleQuery,
} from "../repositories/columnsRepository.js";

export async function createColumn(
  title: string,
  position: number,
  row_id: number,
): Promise<DbColumn> {
  return insertColumnQuery(pool, title, position, row_id);
}

export async function updateColumnTitle(
  id: number,
  title: string,
): Promise<DbColumn | null> {
  return updateColumnTitleQuery(pool, id, title);
}

export async function moveColumn(
  id: number,
  position: number,
): Promise<DbColumn | null> {
  return moveColumnQuery(pool, id, position);
}

export async function deleteColumn(id: number): Promise<boolean> {
  return deleteColumnQuery(pool, id);
}
