-- Up Migration

-- ユーザーテーブル（認証用）
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 行（プロジェクト単位）テーブル
CREATE TABLE rows (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  position FLOAT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

-- ステータス列テーブル
CREATE TABLE columns (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  position FLOAT NOT NULL,
  row_id INTEGER REFERENCES rows(id) ON DELETE CASCADE
);

-- タスクテーブル
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  column_id INTEGER REFERENCES columns(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  due_date DATE,
  position FLOAT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false
);

-- タスクコメントテーブル
CREATE TABLE task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  position FLOAT NOT NULL DEFAULT 0
);

-- サブタスクテーブル
CREATE TABLE subtasks (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);

-- チェックリスト項目テーブル
CREATE TABLE checklist_items (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  position FLOAT NOT NULL DEFAULT 0,
  CONSTRAINT checklist_items_parent_xor_chk CHECK (
    (task_id IS NOT NULL AND subtask_id IS NULL) OR
    (task_id IS NULL AND subtask_id IS NOT NULL)
  ) NOT VALID
);

-- メモテーブル
CREATE TABLE memos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- タスクとメモの中間テーブル（多対多）
CREATE TABLE task_memo_links (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  memo_id INTEGER NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, memo_id)
);

-- インデックス
CREATE INDEX idx_rows_position ON rows (position);
CREATE INDEX idx_rows_user_id ON rows (user_id);
CREATE INDEX idx_columns_row_id_position ON columns (row_id, position);
CREATE INDEX idx_tasks_column_id_position ON tasks (column_id, position);
CREATE INDEX idx_subtasks_task_id_id ON subtasks (task_id, id);
CREATE INDEX idx_checklist_items_task_id_position ON checklist_items (task_id, position);
CREATE INDEX idx_checklist_items_subtask_id_position ON checklist_items (subtask_id, position);
CREATE INDEX idx_task_comments_task_id_position_created ON task_comments (task_id, position, created_at, id);
CREATE INDEX idx_memos_user_id_updated ON memos (user_id, updated_at DESC);
CREATE INDEX idx_task_memo_links_memo_id ON task_memo_links (memo_id);

-- Down Migration

DROP TABLE IF EXISTS task_memo_links;
DROP TABLE IF EXISTS memos;
DROP TABLE IF EXISTS checklist_items;
DROP TABLE IF EXISTS task_comments;
DROP TABLE IF EXISTS subtasks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS columns;
DROP TABLE IF EXISTS rows;
DROP TABLE IF EXISTS users;
