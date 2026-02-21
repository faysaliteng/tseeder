-- 0015_referrals.sql
-- Referral/invitation system: track invites and award 2GB bonus storage

CREATE TABLE IF NOT EXISTS referrals (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  referrer_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  referee_email TEXT COLLATE NOCASE,
  code          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'registered', 'upgraded', 'rewarded')),
  bonus_bytes   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  upgraded_at   TEXT,
  rewarded_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code     ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referee  ON referrals(referee_id);

-- Track bonus storage awarded to users from referrals
ALTER TABLE users ADD COLUMN bonus_storage_bytes INTEGER NOT NULL DEFAULT 0;
