-- D1 Migration: 0005_worker_heartbeats
-- Adds time-series heartbeat table for compute agent fleet monitoring.
-- worker_registry holds the latest state; worker_heartbeats is the immutable time-series.

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  worker_id       TEXT NOT NULL,
  status          TEXT NOT NULL,
  active_jobs     INTEGER NOT NULL DEFAULT 0,
  max_jobs        INTEGER NOT NULL DEFAULT 0,
  disk_free_gb    REAL,
  cpu_pct         REAL,
  mem_used_mb     INTEGER,
  bandwidth_mbps  REAL,
  version         TEXT,
  region          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for time-series queries (last N heartbeats per worker)
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_worker    ON worker_heartbeats(worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_created   ON worker_heartbeats(created_at DESC);

-- Partial index for recent heartbeats (SQLite supports expression indexes)
-- Rows older than 7 days can be pruned by a scheduled cleanup
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_recent
  ON worker_heartbeats(worker_id, created_at)
  WHERE created_at >= datetime('now', '-7 days');

-- Admin storage metrics snapshot table for trending
CREATE TABLE IF NOT EXISTS storage_snapshots (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  total_files    INTEGER NOT NULL DEFAULT 0,
  total_bytes    INTEGER NOT NULL DEFAULT 0,
  orphan_files   INTEGER NOT NULL DEFAULT 0,
  captured_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_storage_snapshots_captured ON storage_snapshots(captured_at DESC);
