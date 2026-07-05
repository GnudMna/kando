import { Pool } from "pg";

/**
 * PostgreSQL 接続プール。
 * 環境変数 `DATABASE_URL` を接続文字列として使用する。
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * DB への疎通確認をリトライ付きで実行する。
 * PostgreSQL の起動完了前にアプリが先行した場合でも接続を待機できるよう、
 * 指定回数だけリトライを行う。全リトライ失敗時はエラーを投げる。
 * @param retries - リトライ上限回数(デフォルト: 10)
 * @param delayMs - リトライ間隔(ミリ秒、デフォルト: 3000)
 * @returns 接続確認完了時に解決される Promise
 * @throws Error 全リトライで接続に失敗した場合
 */
export async function waitForDbWithRetry(
  retries = 10,
  delayMs = 3000,
): Promise<void> {
  let lastError: unknown = null;
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `DB connection attempt ${i + 1}/${retries} failed: ${message}`,
      );
      if (i < retries - 1)
        await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }
  const suffix =
    lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  const finalMessage = `DB connection failed after all retries.${suffix}`;
  console.error(finalMessage);
  throw new Error(finalMessage);
}
