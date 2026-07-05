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

/**
 * 行を作成する。
 * @param title - 行タイトル
 * @param position - 表示順
 * @param userId - 所有者ユーザー ID
 * @returns 作成された行レコード
 */
export async function createRow(
  title: string,
  position: number,
  userId: number,
): Promise<DbRow> {
  return insertRow(pool, title, position, userId);
}

/**
 * 行とデフォルト3カラムを単一トランザクションで作成する。
 * @param title - 行タイトル
 * @param position - 行の表示順
 * @param userId - 所有者ユーザー ID
 * @returns 作成された行(デフォルトカラムを含む)
 * @throws Error トランザクションが失敗した場合
 */
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

/**
 * 行タイトルを更新する。
 * @param id - 行 ID
 * @param title - 新しいタイトル
 * @param userId - リクエストユーザー ID(所有権確認に使用)
 * @returns 更新後の行レコード。対象が見つからない場合は `null`
 */
export async function updateRowTitle(
  id: number,
  title: string,
  userId: number,
): Promise<DbRow | null> {
  return updateRowTitleQuery(pool, id, title, userId);
}

/**
 * 行を削除する(配下カラム・タスクも CASCADE で削除される)。
 * @param id - 行 ID
 * @param userId - リクエストユーザー ID(所有権確認に使用)
 * @returns 削除に成功した場合は `true`、対象が見つからない場合は `false`
 */
export async function deleteRow(id: number, userId: number): Promise<boolean> {
  return deleteRowQuery(pool, id, userId);
}
