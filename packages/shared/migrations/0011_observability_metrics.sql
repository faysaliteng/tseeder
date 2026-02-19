-- 0011_observability_metrics.sql
-- Stores hourly API metrics (latency, error rates) and queue depth snapshots

CREATE TABLE IF NOT EXISTS api_metrics (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hour_bucket  TEXT NOT NULL,  -- "2026-02-19T14:00" (hourly, UTC)
  endpoint     TEXT NOT NULL,
  method       TEXT NOT NULL,
  status_class TEXT NOT NULL CHECK (status_class IN ('2xx','3xx','4xx','5xx')),
  count        INTEGER NOT NULL DEFAULT 0,
  total_ms     INTEGER NOT NULL DEFAULT 0,  -- sum for avg latency
  p95_ms       INTEGER,
  UNIQUE(hour_bucket, endpoint, method, status_class)
);

CREATE INDEX IF NOT EXISTS idx_api_metrics_hour ON api_metrics(hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_status ON api_metrics(status_class, hour_bucket DESC);

CREATE TABLE IF NOT EXISTS queue_depth_snapshots (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  queue_depth INTEGER NOT NULL DEFAULT 0,
  dlq_depth   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_snapshots_time ON queue_depth_snapshots(captured_at DESC);
