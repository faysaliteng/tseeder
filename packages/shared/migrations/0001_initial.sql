-- ============================================================
-- D1 Schema Migration: 0001_initial
-- Enterprise Remote Download Manager
-- ============================================================

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT NOT NULL UNIQUE CHECK (name IN ('free', 'pro', 'business', 'enterprise')),
  max_jobs     INTEGER NOT NULL DEFAULT 2,
  max_storage_gb    INTEGER NOT NULL DEFAULT 5,
  max_file_size_mb  INTEGER NOT NULL DEFAULT 500,
  bandwidth_gb      INTEGER NOT NULL DEFAULT 50,
  retention_days    INTEGER NOT NULL DEFAULT 7,
  price_cents       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default plans
INSERT OR IGNORE INTO plans (name, max_jobs, max_storage_gb, max_file_size_mb, bandwidth_gb, retention_days, price_cents)
VALUES
  ('free',       2,   5,    500,   50,   7,   0),
  ('pro',        10,  50,   5120,  500,  30,  900),
  ('business',   50,  500,  25600, 5000, 90,  2900),
  ('enterprise', -1,  -1,   -1,    -1,   -1,  0);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'user'
                   CHECK (role IN ('user', 'support', 'admin', 'superadmin')),
  email_verified   INTEGER NOT NULL DEFAULT 0,
  accepted_aup     INTEGER NOT NULL DEFAULT 0,
  suspended        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TEXT NOT NULL,
  device_info  TEXT,
  ip_address   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions(expires_at);

-- User Plan Assignments
CREATE TABLE IF NOT EXISTS user_plan_assignments (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id    TEXT NOT NULL REFERENCES plans(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  PRIMARY KEY (user_id, plan_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_plan_assignments_user ON user_plan_assignments(user_id);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  infohash     TEXT,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('submitted','metadata_fetch','queued','downloading',
                                 'uploading','completed','paused','failed','cancelled')),
  magnet_uri   TEXT,
  worker_id    TEXT,
  idempotency_key TEXT UNIQUE,
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id    ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_infohash   ON jobs(infohash);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_worker_id  ON jobs(worker_id);

-- Job Events (append-only audit trail)
CREATE TABLE IF NOT EXISTS job_events (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',  -- JSON
  sequence    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_created ON job_events(created_at);

-- Files
CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  mime_type   TEXT,
  r2_key      TEXT,
  is_complete INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_files_job_id ON files(job_id);
CREATE INDEX IF NOT EXISTS idx_files_r2_key ON files(r2_key);

-- Usage Metrics Daily
CREATE TABLE IF NOT EXISTS usage_metrics_daily (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,  -- YYYY-MM-DD
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  bytes_uploaded   INTEGER NOT NULL DEFAULT 0,
  jobs_count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_metrics_daily(user_id, date);

-- Audit Logs (append-only, no UPDATE/DELETE allowed by policy)
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  metadata     TEXT NOT NULL DEFAULT '{}',  -- JSON
  ip_address   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor  ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Infohash Blocklist
CREATE TABLE IF NOT EXISTS blocklist (
  infohash   TEXT PRIMARY KEY,
  reason     TEXT,
  added_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Email Verification Tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
