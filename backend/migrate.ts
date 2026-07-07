import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { pool, waitForDbWithRetry } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * マイグレーションファイルのディレクトリを解決する。
 * 開発時(backend/migrate.ts)と本番ビルド後(backend/dist/migrate.js)の両方に対応する。
 * @returns migrations ディレクトリの絶対パス
 * @throws Error ディレクトリが見つからない場合
 */
function resolveMigrationsDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 3; i++) {
    const candidate = path.join(dir, "migrations");
    if (existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Migrations directory not found");
}

const MIGRATIONS_DIR = resolveMigrationsDir();
const MIGRATIONS_TABLE = "pgmigrations";

/**
 * 旧 migrate.ts で構築済みの DB かどうかを判定する。
 * users テーブルは存在するが pgmigrations に記録がない場合はレガシー DB とみなす。
 * @returns レガシー DB の場合 true
 */
async function isLegacyDatabase(): Promise<boolean> {
  const client = await pool.connect();
  try {
    const { rows: legacyRows } = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `);
    if (!legacyRows[0]?.exists) {
      return false;
    }

    const { rows: tableRows } = await client.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
      [MIGRATIONS_TABLE],
    );
    if (!tableRows[0]?.exists) {
      return true;
    }

    const { rows: countRows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${MIGRATIONS_TABLE}`,
    );
    return countRows[0]?.count === "0";
  } finally {
    client.release();
  }
}

/**
 * 旧 migrate.ts が起動時に実行していたデータ修復を行う。
 * fake ベースラインでは SQL マイグレーションがスキップされるため、レガシー DB 向けに別途実行する。
 * @returns 修復完了時に解決される Promise
 */
async function repairLegacyData(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      UPDATE task_comments tc
      SET position = ordered.rn * 1000
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at ASC, id ASC) AS rn
        FROM task_comments
      ) AS ordered
      WHERE tc.id = ordered.id
        AND tc.position = 0
    `);

    await client.query(`
      UPDATE checklist_items SET position = id * 1000 WHERE position = 0
    `);

    const { rowCount: invalidChecklistRefs } = await client.query(`
      SELECT 1
      FROM checklist_items
      WHERE (task_id IS NULL AND subtask_id IS NULL)
         OR (task_id IS NOT NULL AND subtask_id IS NOT NULL)
      LIMIT 1
    `);
    if ((invalidChecklistRefs ?? 0) === 0) {
      await client.query(
        "ALTER TABLE checklist_items VALIDATE CONSTRAINT checklist_items_parent_xor_chk",
      );
    } else {
      console.warn(
        "Found invalid checklist_items rows; skipped constraint validation.",
      );
    }

    await client.query("COMMIT");
    console.log("Legacy data repair completed.");
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
 * 保留中のマイグレーションを適用する。
 * レガシー DB の場合は fake モードで履歴のみ登録する。
 * @returns マイグレーション完了時に解決される Promise
 */
async function runMigrations(): Promise<void> {
  const legacy = await isLegacyDatabase();

  if (legacy) {
    console.log(
      "Legacy database detected. Marking existing migrations as applied (fake mode).",
    );
  }

  const applied = await runner({
    databaseUrl: process.env.DATABASE_URL!,
    migrationsTable: MIGRATIONS_TABLE,
    dir: MIGRATIONS_DIR,
    direction: "up",
    fake: legacy,
    log: (msg) => {
      console.log(msg);
    },
  });

  if (applied.length === 0 && !legacy) {
    console.log("No pending migrations.");
  } else if (legacy) {
    console.log(`Baselined ${applied.length} migration(s).`);
    await repairLegacyData();
  } else {
    console.log(`Applied ${applied.length} migration(s).`);
  }
}

/**
 * DB 接続待機後にマイグレーションを起動し、終了処理まで行う。
 * @returns 実行完了時に解決される Promise
 */
async function main(): Promise<void> {
  try {
    await waitForDbWithRetry();
    await runMigrations();
    console.log("Database migration finished successfully.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FATAL: Database migration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
