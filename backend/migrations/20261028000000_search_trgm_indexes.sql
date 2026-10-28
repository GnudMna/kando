-- Up Migration

-- ILIKE '%keyword%' の部分一致検索でインデックスを使えるようにする
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_tasks_content_trgm ON tasks USING GIN (content gin_trgm_ops);
CREATE INDEX idx_subtasks_content_trgm ON subtasks USING GIN (content gin_trgm_ops);
CREATE INDEX idx_checklist_items_content_trgm ON checklist_items USING GIN (content gin_trgm_ops);
CREATE INDEX idx_task_comments_content_trgm ON task_comments USING GIN (content gin_trgm_ops);

-- Down Migration

DROP INDEX IF EXISTS idx_task_comments_content_trgm;
DROP INDEX IF EXISTS idx_checklist_items_content_trgm;
DROP INDEX IF EXISTS idx_subtasks_content_trgm;
DROP INDEX IF EXISTS idx_tasks_content_trgm;
-- 拡張は他で使われている可能性があるため削除しない
