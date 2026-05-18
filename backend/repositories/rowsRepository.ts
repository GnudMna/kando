import type { Pool, PoolClient } from "pg";
import type { DbColumn, DbRow } from "../types.js";

export type Queryable = Pool | PoolClient;

export async function insertRow(
  client: Queryable,
  title: string,
  position: number,
  userId: number,
): Promise<DbRow> {
  const result = await client.query<DbRow>(
    "INSERT INTO rows (title, position, user_id) VALUES ($1, $2, $3) RETURNING *",
    [title, position, userId],
  );
  return result.rows[0];
}

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

export async function updateRowTitle(
  client: Queryable,
  id: number,
  title: string,
  userId: number,
): Promise<DbRow | null> {
  const result = await client.query<DbRow>(
    "UPDATE rows SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
    [title, id, userId],
  );
  return result.rows[0] ?? null;
}

export async function deleteRow(
  client: Queryable,
  id: number,
  userId: number,
): Promise<boolean> {
  const result = await client.query(
    "DELETE FROM rows WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
