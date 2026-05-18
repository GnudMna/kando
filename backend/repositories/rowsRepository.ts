import type { Pool, PoolClient } from "pg";
import type { DbColumn, DbRow } from "../types.js";

/** Pool または PoolClient の両方を受け付けるユニオン型。トランザクション外・内の両方で利用できる。 */
export type Queryable = Pool | PoolClient;

/**
 * 行を DB に挿入して新規レコードを返す。
 * @param client - クエリ実行クライアント
 * @param title - 行タイトル
 * @param position - 表示順
 * @param userId - 所有者ユーザー ID
 * @returns 挿入された行レコード
 */
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

/**
 * カラムを DB に挿入して新規レコードを返す。
 * @param client - クエリ実行クライアント
 * @param title - カラムタイトル
 * @param position - 表示順
 * @param row_id - 所属行 ID
 * @returns 挿入されたカラムレコード
 */
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

/**
 * 行タイトルを更新して更新後レコードを返す。
 * @param client - クエリ実行クライアント
 * @param id - 行 ID
 * @param title - 新しいタイトル
 * @param userId - 所有者ユーザー ID（権限確認に使用）
 * @returns 更新後の行レコード。対象が見つからない場合は `null`
 */
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

/**
 * 行を DB から削除する（配下カラム・タスクも CASCADE で削除される）。
 * @param client - クエリ実行クライアント
 * @param id - 行 ID
 * @param userId - 所有者ユーザー ID（権限確認に使用）
 * @returns 削除に成功した場合は `true`、対象が見つからない場合は `false`
 */
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
