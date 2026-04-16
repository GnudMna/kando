// PostgreSQL接続プールとDBの初期化処理を管理するモジュール
import { Pool } from 'pg';

// 環境変数 DATABASE_URL を元にコネクションプールを生成する
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * テーブルが存在しない場合は作成し、初期データが未投入であれば投入する。
 * 既存の columns テーブルに row_id が未設定の場合はデフォルト行へのマイグレーションも行う。
 * @throws DB 操作に失敗した場合はエラーをそのまま再スローする
 */
async function initDB(): Promise<void> {
  const client = await pool.connect();
  try {
    // 行（プロジェクト単位）テーブルを作成する
    await client.query(`
      CREATE TABLE IF NOT EXISTS rows (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        position FLOAT NOT NULL
      );
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
        position FLOAT NOT NULL
      );
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

    // rowsが空の場合のみ初期データを投入する
    const { rowCount: existingRows } = await client.query('SELECT 1 FROM rows LIMIT 1');
    if ((existingRows ?? 0) === 0) {
      const { rowCount: existingCols } = await client.query('SELECT 1 FROM columns LIMIT 1');
      if ((existingCols ?? 0) > 0) {
        // 既存columnsをデフォルト行に紐付けるマイグレーション処理
        console.log('Migrating existing columns into a default row...');
        const { rows: [defaultRow] } = await client.query(
          "INSERT INTO rows (title, position) VALUES ('プロジェクト', 1000) RETURNING *"
        );
        await client.query('UPDATE columns SET row_id = $1 WHERE row_id IS NULL', [defaultRow.id]);
      } else {
        console.log('Inserting initial data...');
        const rowRes = await client.query(
          "INSERT INTO rows (title, position) VALUES ('プロジェクト1', 1000) RETURNING id;"
        );
        const rowId = rowRes.rows[0].id;

        const colRes = await client.query(
          `INSERT INTO columns (title, position, row_id) VALUES
           ('未着手', 1000, $1),
           ('進行中', 2000, $1),
           ('完了', 3000, $1)
           RETURNING id;`,
          [rowId]
        );
        const todoId = colRes.rows[0].id;

        const tRes = await client.query(
          `INSERT INTO tasks (column_id, content, position) VALUES
           ($1, 'Kandoへようこそ!', 1000),
           ($1, '下のボタンから新しいタスクを追加できます', 2000)
           RETURNING id;`,
          [todoId]
        );
        const firstTaskId = tRes.rows[0].id;

        const subRes = await client.query(
          `INSERT INTO subtasks (task_id, content) VALUES ($1, 'サブタスクのサンプル') RETURNING id;`,
          [firstTaskId]
        );
        const subId = subRes.rows[0].id;

        await client.query(
          `INSERT INTO checklist_items (task_id, content) VALUES ($1, 'これはタスク直下のチェックリストです')`,
          [firstTaskId]
        );
        await client.query(
          `INSERT INTO checklist_items (subtask_id, content) VALUES ($1, 'これはサブタスク内のチェックリストです')`,
          [subId]
        );
      }
    }
  } catch (err) {
    console.error('Error initializing db:', err);
    throw err;
  } finally {
    // 接続をプールに返却する
    client.release();
  }
}

/**
 * DB 初期化をリトライ付きで実行する。
 * PostgreSQL の起動完了前にアプリが先行した場合でも接続を待機できるよう、
 * 指定回数だけリトライを行う。全リトライ失敗時はエラーログを出力して処理を終了する。
 * @param retries - リトライ上限回数（デフォルト: 10）
 * @param delayMs - リトライ間隔（ミリ秒、デフォルト: 3000）
 */
export async function initDBWithRetry(retries = 10, delayMs = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await initDB();
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`DB init attempt ${i + 1}/${retries} failed: ${message}`);
      if (i < retries - 1) await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }
  console.error('DB init failed after all retries.');
}
