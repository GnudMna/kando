import { pool } from "../db.js";
import type { DbColumn } from "../types.js";
import {
  deleteColumn as deleteColumnQuery,
  moveColumn as moveColumnQuery,
  updateColumnTitle as updateColumnTitleQuery,
} from "../repositories/columnsRepository.js";

/**
 * カラムを作成する。親行の所有権を確認してから挿入する。
 * @param title - カラムタイトル
 * @param position - 表示順
 * @param row_id - 所属行 ID
 * @param userId - リクエストユーザー ID（所有権確認に使用）
 * @returns 作成されたカラムレコード。所有者の行が見つからない場合は `null`
 */
export async function createColumn(
  title: string,
  position: number,
  row_id: number,
  userId: number,
): Promise<DbColumn | null> {
  // 所有権確認と INSERT を1クエリに統合してラウンドトリップを削減する
  const result = await pool.query<DbColumn>(
    `INSERT INTO columns (title, position, row_id)
     SELECT $1, $2, id FROM rows WHERE id = $3 AND user_id = $4
     RETURNING id, title, position, row_id`,
    [title, position, row_id, userId],
  );
  return result.rows[0] ?? null;
}

/**
 * カラムタイトルを更新する。
 * @param id - カラム ID
 * @param title - 新しいタイトル
 * @param userId - リクエストユーザー ID（所有権確認に使用）
 * @returns 更新後のカラムレコード。対象が見つからない場合は `null`
 */
export async function updateColumnTitle(
  id: number,
  title: string,
  userId: number,
): Promise<DbColumn | null> {
  return updateColumnTitleQuery(pool, id, title, userId);
}

/**
 * カラムの表示順を更新する。
 * @param id - カラム ID
 * @param position - 新しい表示順
 * @param userId - リクエストユーザー ID（所有権確認に使用）
 * @returns 更新後のカラムレコード。対象が見つからない場合は `null`
 */
export async function moveColumn(
  id: number,
  position: number,
  userId: number,
): Promise<DbColumn | null> {
  return moveColumnQuery(pool, id, position, userId);
}

/**
 * カラムを削除する（配下タスクも CASCADE で削除される）。
 * @param id - カラム ID
 * @param userId - リクエストユーザー ID（所有権確認に使用）
 * @returns 削除に成功した場合は `true`、対象が見つからない場合は `false`
 */
export async function deleteColumn(
  id: number,
  userId: number,
): Promise<boolean> {
  return deleteColumnQuery(pool, id, userId);
}
