import type { Pool, PoolClient } from "pg";
import type { DbColumn } from "../types.js";

export type Queryable = Pool | PoolClient;

export async function insertColumn(
  client: Queryable,
  title: string,
  position: number,
  row_id: number,
): Promise<DbColumn> {
  const result = await client.query<DbColumn>(
    "INSERT INTO columns (title, position, row_id) VALUES ($1, $2, $3) RETURNING *",
    [title, position, row_id],
  );
  return result.rows[0];
}

export async function updateColumnTitle(
  client: Queryable,
  id: number,
  title: string,
  userId: number,
): Promise<DbColumn | null> {
  const result = await client.query<DbColumn>(
    `UPDATE columns SET title = $1
     WHERE id = $2 AND row_id IN (SELECT id FROM rows WHERE user_id = $3)
     RETURNING *`,
    [title, id, userId],
  );
  return result.rows[0] ?? null;
}

export async function moveColumn(
  client: Queryable,
  id: number,
  position: number,
  userId: number,
): Promise<DbColumn | null> {
  const result = await client.query<DbColumn>(
    `UPDATE columns SET position = $1
     WHERE id = $2 AND row_id IN (SELECT id FROM rows WHERE user_id = $3)
     RETURNING *`,
    [position, id, userId],
  );
  return result.rows[0] ?? null;
}

export async function deleteColumn(
  client: Queryable,
  id: number,
  userId: number,
): Promise<boolean> {
  const result = await client.query(
    "DELETE FROM columns WHERE id = $1 AND row_id IN (SELECT id FROM rows WHERE user_id = $2)",
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
