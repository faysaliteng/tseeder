-- D1 Migration: 0003_admin_extended
-- Extended admin tables: feature_flags, security_events, worker_registry, config_changes

-- Feature flags (per-platform, can be extended for per-tenant later)
CREATE TABLE IF NOT EXISTS feature_flags (
  key         TEXT PRIMARY KEY,
  value       INTEGER NOT NULL DEFAULT 1,  -- 1=enabled, 0=disabled
  description TEXT,
  updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO feature_flags (key, value, description) VALUES
  ('registration_open',   1, 'Allow new user registrations'),
  ('email_verification',  1, 'Require email verification before login'),
  ('torrent_upload',      1, 'Allow .torrent file uploads'),
  ('magnet_links',        1, 'Allow magnet link submissions'),
  ('free_plan_active',    1, 'Allow signups on the free plan');

-- Security events (separate from audit_logs for faster security queries)
CREATE TABLE IF NOT EXISTS security_events (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_type  TEXT NOT NULL,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  payload     TEXT NOT NULL DEFAULT '{}',  -- JSON
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info', 'warn', 'critical')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_events_type      ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_actor     ON security_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity  ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created   ON security_events(created_at);

-- Worker registry (heartbeats from compute agents)
CREATE TABLE IF NOT EXISTS worker_registry (
  id              TEXT PRIMARY KEY,
  version         TEXT,
  status          TEXT NOT NULL DEFAULT 'healthy'
                  CHECK (status IN ('healthy', 'draining', 'cordoned', 'offline')),
  region          TEXT,
  active_jobs     INTEGER NOT NULL DEFAULT 0,
  max_jobs        INTEGER NOT NULL DEFAULT 0,
  disk_free_gb    REAL,
  disk_total_gb   REAL,
  bandwidth_mbps  REAL,
  last_heartbeat  TEXT NOT NULL DEFAULT (datetime('now')),
  registered_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Config changes (audit trail for feature flag and runtime config changes)
CREATE TABLE IF NOT EXISTS config_changes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key         TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_config_changes_key  ON config_changes(key);
