-- Crypto Payment Gateway tables

CREATE TABLE IF NOT EXISTS crypto_wallets (
  coin       TEXT PRIMARY KEY CHECK (coin IN ('BTC','USDT','LTC','BNB')),
  address    TEXT NOT NULL,
  network    TEXT NOT NULL DEFAULT '',
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crypto_orders (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name       TEXT NOT NULL,
  coin            TEXT NOT NULL,
  network         TEXT NOT NULL DEFAULT '',
  wallet_address  TEXT NOT NULL,
  amount_usd      REAL NOT NULL,
  amount_crypto   REAL NOT NULL,
  tx_hash         TEXT,
  confirmations   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirming','confirmed','expired','failed')),
  expires_at      TEXT NOT NULL,
  confirmed_at    TEXT,
  confirmed_by    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crypto_orders_user   ON crypto_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_status ON crypto_orders(status);

CREATE TABLE IF NOT EXISTS crypto_prices (
  plan_name   TEXT PRIMARY KEY,
  price_usd   REAL NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
