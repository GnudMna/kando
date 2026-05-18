import { pool } from "../db.js";
import type { DbColumn, DbRow, Row } from "../types.js";
import {
  deleteRow as deleteRowQuery,
  insertColumn,
  insertRow,
  updateRowTitle as updateRowTitleQuery,
} from "../repositories/rowsRepository.js";

const DEFAULT_COLUMN_TITLES = ["未着手", "進行中", "完了"];
const DEFAULT_COLUMN_POSITION_GAP = 1000;

export async function createRow(
  title: string,
  position: number,
  userId: number,
): Promise<DbRow> {
  return insertRow(pool, title, position, userId);
}

export async function createRowWithDefaultColumns(
  title: string,
  position: number,
  userId: number,
): Promise<Row> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await insertRow(client, title, position, userId);
    const columns: DbColumn[] = [];

    for (const [index, columnTitle] of DEFAULT_COLUMN_TITLES.entries()) {
      const columnPosition = (index + 1) * DEFAULT_COLUMN_POSITION_GAP;
      columns.push(
        await insertColumn(client, columnTitle, columnPosition, row.id),
      );
    }

    await client.query("COMMIT");

    return {
      ...row,
      columns: columns.map((column) => ({ ...column, tasks: [] })),
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function updateRowTitle(
  id: number,
  title: string,
  userId: number,
): Promise<DbRow | null> {
  return updateRowTitleQuery(pool, id, title, userId);
}

export async function deleteRow(id: number, userId: number): Promise<boolean> {
  return deleteRowQuery(pool, id, userId);
}
