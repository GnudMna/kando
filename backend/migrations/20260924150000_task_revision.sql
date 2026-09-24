-- Up Migration

ALTER TABLE tasks
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

-- Down Migration

ALTER TABLE tasks DROP COLUMN IF EXISTS revision;
