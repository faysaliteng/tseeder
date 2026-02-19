-- D1 Migration: 0004_provider_configs
-- Provider configuration system: versioned, RBAC-protected, audit-logged

-- Provider configurations (versioned history)
CREATE TABLE IF NOT EXISTS provider_configs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider    TEXT NOT NULL CHECK (provider IN ('cloudflare', 'seedr')),
  is_active   INTEGER NOT NULL DEFAULT 0,
  config      TEXT NOT NULL DEFAULT '{}',  -- JSON: endpoint, options (NO plaintext secrets)
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_configs_active   ON provider_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_provider_configs_provider ON provider_configs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_configs_created  ON provider_configs(created_at);

-- Provider health snapshots (written by worker on each health-check)
CREATE TABLE IF NOT EXISTS provider_health (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  latency_ms  INTEGER,
  error       TEXT,
  checked_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_health_provider ON provider_health(provider);
CREATE INDEX IF NOT EXISTS idx_provider_health_checked  ON provider_health(checked_at);

-- Seed default active provider (cloudflare)
INSERT OR IGNORE INTO provider_configs (id, provider, is_active, config, note)
VALUES (
  'default-cloudflare-provider',
  'cloudflare',
  1,
  '{"workerClusterUrl":"","maxConcurrentJobs":10}',
  'Default provider on first deploy'
);
