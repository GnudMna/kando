import type { Pool, PoolClient } from "pg";
import type { DbColumn } from "../types.js";
import { assignPosition, type PositionSlot } from "../positionSlot.js";

/** Pool または PoolClient の両方を受け付けるユニオン型。トランザクション外・内の両方で利用できる。 */
export type Queryable = Pool | PoolClient;

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
 * カラムタイトルを更新して更新後レコードを返す。
 * @param client - クエリ実行クライアント
 * @param id - カラム ID
 * @param title - 新しいタイトル
 * @param userId - 所有者ユーザー ID。権限確認に使用
 * @returns 更新後のカラムレコード。対象が見つからない場合は `null`
 */
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

/**
 * カラムの表示順を更新して更新後レコードを返す。
 * @param client - クエリ実行クライアント
 * @param id - カラム ID
 * @param position - 新しい表示順
 * @param userId - 所有者ユーザー ID。権限確認に使用
 * @returns 更新後のカラムレコードと振り直された他カラムの position。対象が見つからない場合は `null`
 */
export async function moveColumn(
  client: PoolClient,
  id: number,
  position: number,
  userId: number,
): Promise<{ column: DbColumn; rebalanced: PositionSlot[] } | null> {
  const owner = await client.query<{ row_id: number }>(
    `SELECT c.row_id FROM columns c
     JOIN rows r ON r.id = c.row_id
     WHERE c.id = $1 AND r.user_id = $2`,
    [id, userId],
  );
  if (!owner.rows[0]) return null;

  const locked = await client.query<PositionSlot>(
    `SELECT id, position FROM columns
     WHERE row_id = $1
     ORDER BY id
     FOR UPDATE`,
    [owner.rows[0].row_id],
  );
  const placed = assignPosition(locked.rows, id, position);
  if (placed.rebalance.length > 0) {
    await client.query(
      `UPDATE columns SET position = data.position
       FROM unnest($1::int[], $2::float8[]) AS data(id, position)
       WHERE columns.id = data.id`,
      [
        placed.rebalance.map((item) => item.id),
        placed.rebalance.map((item) => item.position),
      ],
    );
  }
  const result = await client.query<DbColumn>(
    `UPDATE columns SET position = $1
     WHERE id = $2
     RETURNING *`,
    [placed.position, id],
  );
  const column = result.rows[0];
  return column ? { column, rebalanced: placed.rebalance } : null;
}

/**
 * カラムを DB から削除する。配下タスクも CASCADE で削除される。
 * @param client - クエリ実行クライアント
 * @param id - カラム ID
 * @param userId - 所有者ユーザー ID。権限確認に使用
 * @returns 削除に成功した場合は `true`、対象が見つからない場合は `false`
 */
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
