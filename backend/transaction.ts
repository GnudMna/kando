import type { PoolClient } from "pg";
import { pool } from "./db.js";

/**
 * 専用接続でトランザクションを張り、`fn` の成否に応じて COMMIT / ROLLBACK する。
 * @param fn - トランザクション内で実行する処理
 * @returns `fn` の戻り値
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
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
