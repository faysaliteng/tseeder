-- 0010_uptime_history.sql
-- Persists daily uptime snapshots per component for 90-day history on /status

CREATE TABLE IF NOT EXISTS uptime_snapshots (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  date           TEXT NOT NULL,          -- "2026-02-19" (UTC date)
  component      TEXT NOT NULL,          -- "api" | "queue" | "agents"
  is_operational INTEGER NOT NULL DEFAULT 1,
  incident_note  TEXT,
  captured_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, component)
);

CREATE INDEX IF NOT EXISTS idx_uptime_date ON uptime_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_component ON uptime_snapshots(component, date DESC);
