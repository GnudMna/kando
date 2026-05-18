// DB スキーマ変更と初期データ投入を実行するマイグレーションエントリーポイント
import { pool, waitForDbWithRetry } from "./db.js";

/**
 * スキーマ作成・制約追加・初期データ投入を実行する。
 * @returns マイグレーション完了時に解決される Promise
 * @throws Error SQL 実行に失敗した場合
 */
async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ユーザーテーブルを作成する（認証用）
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // 行（プロジェクト単位）テーブルを作成する
    await client.query(`
      CREATE TABLE IF NOT EXISTS rows (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        position FLOAT NOT NULL
      );
    `);
    // rows テーブルに user_id 列を追加する（認証対応マイグレーション）
    await client.query(`
      ALTER TABLE rows ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);
    // ステータス列テーブルを作成する
    await client.query(`
      CREATE TABLE IF NOT EXISTS columns (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        position FLOAT NOT NULL
      );
    `);
    // columns テーブルに row_id 列を追加する（既存DBへのマイグレーション対応）
    await client.query(`
      ALTER TABLE columns ADD COLUMN IF NOT EXISTS row_id INTEGER REFERENCES rows(id) ON DELETE CASCADE;
    `);
    // タスクテーブルを作成する
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        column_id INTEGER REFERENCES columns(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        due_date DATE,
        position FLOAT NOT NULL
      );
    `);
    // tasks に期限（due_date）カラムを追加する（既存 DB へのマイグレーション対応）
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
    `);
    // tasks に完了フラグ（completed）カラムを追加する（既存 DB へのマイグレーション対応）
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;
    `);
    // タスクコメントテーブルを作成する
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        position FLOAT NOT NULL DEFAULT 0
      );
    `);
    // task_comments に並び替え用の position カラムを追加する（既存 DB へのマイグレーション対応）
    await client.query(`
      ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS position FLOAT NOT NULL DEFAULT 0;
    `);
    // position が未設定（0）の既存コメントに task ごとの連番位置を割り当てる
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
        AND tc.position = 0;
    `);
    // サブタスクテーブルを作成する
    await client.query(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL
      );
    `);
    // チェックリスト項目テーブルを作成する
    await client.query(`
      CREATE TABLE IF NOT EXISTS checklist_items (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        completed BOOLEAN DEFAULT false
      );
    `);
    // checklist_items に並び替え用の position カラムを追加する（既存 DB へのマイグレーション対応）
    await client.query(`
      ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS position FLOAT NOT NULL DEFAULT 0;
    `);
    // position が未設定（0）の既存行に連番で位置を割り当てる
    await client.query(`
      UPDATE checklist_items SET position = id * 1000 WHERE position = 0;
    `);
    // checklist_items は task_id / subtask_id のどちらか一方のみを保持する
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'checklist_items_parent_xor_chk'
        ) THEN
          ALTER TABLE checklist_items
            ADD CONSTRAINT checklist_items_parent_xor_chk
            CHECK (
              (task_id IS NOT NULL AND subtask_id IS NULL) OR
              (task_id IS NULL AND subtask_id IS NOT NULL)
            ) NOT VALID;
        END IF;
      END $$;
    `);

    // ボード取得のスケーラビリティ向上のため、親参照と並び順の複合インデックスを作成する
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_rows_position ON rows (position)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_rows_user_id ON rows (user_id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_columns_row_id_position ON columns (row_id, position)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_tasks_column_id_position ON tasks (column_id, position)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_subtasks_task_id_id ON subtasks (task_id, id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_checklist_items_task_id_position ON checklist_items (task_id, position)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_checklist_items_subtask_id_position ON checklist_items (subtask_id, position)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_task_comments_task_id_position_created ON task_comments (task_id, position, created_at, id)",
    );

    // 既存データが有効な場合は制約を validate して完全適用する
    const { rowCount: invalidChecklistRefs } = await client.query(`
      SELECT 1
      FROM checklist_items
      WHERE (task_id IS NULL AND subtask_id IS NULL)
         OR (task_id IS NOT NULL AND subtask_id IS NOT NULL)
      LIMIT 1;
    `);
    if ((invalidChecklistRefs ?? 0) === 0) {
      await client.query(
        "ALTER TABLE checklist_items VALIDATE CONSTRAINT checklist_items_parent_xor_chk;",
      );
    } else {
      console.warn(
        "Found invalid checklist_items rows; skipped constraint validation.",
      );
    }

    // rowsが空の場合のみ初期データを投入する
    const { rowCount: existingRows } = await client.query(
      "SELECT 1 FROM rows LIMIT 1",
    );
    if ((existingRows ?? 0) === 0) {
      const { rowCount: existingCols } = await client.query(
        "SELECT 1 FROM columns LIMIT 1",
      );
      if ((existingCols ?? 0) > 0) {
        // 既存columnsをデフォルト行に紐付けるマイグレーション処理
        console.log("Migrating existing columns into a default row...");
        const {
          rows: [defaultRow],
        } = await client.query(
          "INSERT INTO rows (title, position) VALUES ('プロジェクト', 1000) RETURNING *",
        );
        await client.query(
          "UPDATE columns SET row_id = $1 WHERE row_id IS NULL",
          [defaultRow.id],
        );
      } else {
        console.log("Inserting initial data...");
        const rowRes = await client.query(
          "INSERT INTO rows (title, position) VALUES ('プロジェクト1', 1000) RETURNING id;",
        );
        const rowId = rowRes.rows[0].id;

        const colRes = await client.query(
          `INSERT INTO columns (title, position, row_id) VALUES
           ('未着手', 1000, $1),
           ('進行中', 2000, $1),
           ('完了', 3000, $1)
           RETURNING id;`,
          [rowId],
        );
        const todoId = colRes.rows[0].id;

        const tRes = await client.query(
          `INSERT INTO tasks (column_id, content, position) VALUES
           ($1, 'Kandoへようこそ!', 1000),
           ($1, '下のボタンから新しいタスクを追加できます', 2000)
           RETURNING id;`,
          [todoId],
        );
        const firstTaskId = tRes.rows[0].id;

        const subRes = await client.query(
          `INSERT INTO subtasks (task_id, content) VALUES ($1, 'サブタスクのサンプル') RETURNING id;`,
          [firstTaskId],
        );
        const subId = subRes.rows[0].id;

        await client.query(
          `INSERT INTO checklist_items (task_id, content) VALUES ($1, 'これはタスク直下のチェックリストです')`,
          [firstTaskId],
        );
        await client.query(
          `INSERT INTO checklist_items (subtask_id, content) VALUES ($1, 'これはサブタスク内のチェックリストです')`,
          [subId],
        );
      }
    }

    await client.query("COMMIT");
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
