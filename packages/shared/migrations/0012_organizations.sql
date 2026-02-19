-- 0012_organizations.sql
-- Multi-tenant organization accounts with owners, admins, members, and invites

CREATE TABLE IF NOT EXISTS organizations (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  plan_id      TEXT REFERENCES plans(id),
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
             CHECK (role IN ('owner', 'admin', 'member')),
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_invites (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL COLLATE NOCASE,
  role        TEXT NOT NULL DEFAULT 'member',
  token       TEXT NOT NULL UNIQUE,
  invited_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TEXT NOT NULL DEFAULT (datetime('now', '+7 days')),
  accepted_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON org_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites(email);

-- Add org_id to stripe_subscriptions for per-org billing (nullable for backwards compat)
ALTER TABLE stripe_subscriptions ADD COLUMN org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;

-- Migration: wrap all existing users in a personal default org
-- Uses deterministic id prefix "org_" + user id so this is idempotent
INSERT OR IGNORE INTO organizations (id, name, slug, created_by)
SELECT
  'org_' || id,
  COALESCE(email, id) || ' (Personal)',
  REPLACE(REPLACE(LOWER(COALESCE(email, id)), '@', '-'), '.', '-') || '-' || SUBSTR(id, 1, 8),
  id
FROM users;

INSERT OR IGNORE INTO org_members (org_id, user_id, role)
SELECT 'org_' || id, id, 'owner'
FROM users;
