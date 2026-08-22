-- Up Migration

-- 既存コメントの position を連番で割り当てる（レガシーデータ移行）
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

-- 既存チェックリストの position を割り当てる
UPDATE checklist_items SET position = id * 1000 WHERE position = 0;

-- 不正な checklist_items がなければ制約を validate する
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM checklist_items
    WHERE (task_id IS NULL AND subtask_id IS NULL)
       OR (task_id IS NOT NULL AND subtask_id IS NOT NULL)
    LIMIT 1
  ) THEN
    ALTER TABLE checklist_items VALIDATE CONSTRAINT checklist_items_parent_xor_chk;
  END IF;
END $$;

-- rows が空の場合のみ初期データを投入する
DO $$
DECLARE
  new_row_id INTEGER;
  todo_col_id INTEGER;
  first_task_id INTEGER;
  sub_id INTEGER;
  existing_cols INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM rows LIMIT 1) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO existing_cols FROM columns;

  IF existing_cols > 0 THEN
    -- 既存 columns をデフォルト行に紐付ける
    INSERT INTO rows (title, position) VALUES ('プロジェクト', 1000) RETURNING id INTO new_row_id;
    UPDATE columns SET row_id = new_row_id WHERE columns.row_id IS NULL;
    RETURN;
  END IF;

  INSERT INTO rows (title, position) VALUES ('プロジェクト1', 1000) RETURNING id INTO new_row_id;

  INSERT INTO columns (title, position, row_id) VALUES
    ('未着手', 1000, new_row_id),
    ('進行中', 2000, new_row_id),
    ('完了', 3000, new_row_id);

  SELECT c.id INTO todo_col_id
  FROM columns c
  WHERE c.row_id = new_row_id
  ORDER BY c.position
  LIMIT 1;

  INSERT INTO tasks (column_id, content, position) VALUES
    (todo_col_id, 'Kandoへようこそ!', 1000)
  RETURNING id INTO first_task_id;

  INSERT INTO tasks (column_id, content, position) VALUES
    (todo_col_id, '下のボタンから新しいタスクを追加できます', 2000);

  INSERT INTO subtasks (task_id, content) VALUES (first_task_id, 'サブタスクのサンプル') RETURNING id INTO sub_id;

  INSERT INTO checklist_items (task_id, content) VALUES (first_task_id, 'これはタスク直下のチェックリストです');
  INSERT INTO checklist_items (subtask_id, content) VALUES (sub_id, 'これはサブタスク内のチェックリストです');
END $$;

-- Down Migration

-- シードデータの削除は破壊的なため、down では何もしない
