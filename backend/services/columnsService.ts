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
  userId: number,
): Promise<DbColumn | null> {
  // 親行がユーザーのものであることを確認してから挿入する
  const check = await pool.query<{ id: number }>(
    "SELECT id FROM rows WHERE id = $1 AND user_id = $2",
    [row_id, userId],
  );
  if (!check.rows[0]) return null;
  return insertColumnQuery(pool, title, position, row_id);
}

export async function updateColumnTitle(
  id: number,
  title: string,
  userId: number,
): Promise<DbColumn | null> {
  return updateColumnTitleQuery(pool, id, title, userId);
}

export async function moveColumn(
  id: number,
  position: number,
  userId: number,
): Promise<DbColumn | null> {
  return moveColumnQuery(pool, id, position, userId);
}

export async function deleteColumn(
  id: number,
  userId: number,
): Promise<boolean> {
  return deleteColumnQuery(pool, id, userId);
}
