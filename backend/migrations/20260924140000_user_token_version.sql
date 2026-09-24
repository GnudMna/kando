-- Up Migration

-- ログアウト時に世代を進め、発行済み JWT を無効化する
ALTER TABLE users
  ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Down Migration

ALTER TABLE users DROP COLUMN IF EXISTS token_version;
