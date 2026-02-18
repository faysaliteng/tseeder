-- D1 Migration: 0002_api_keys
-- API keys for compute agents + internal service auth

CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'compute_agent'
              CHECK (role IN ('compute_agent', 'internal', 'admin_api')),
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TEXT,
  expires_at  TEXT,
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON api_keys(revoked);

-- Add missing index on files for dedup/path constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_job_path ON files(job_id, path);
