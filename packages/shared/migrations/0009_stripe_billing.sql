-- D1 Migration: 0009_stripe_billing
-- Adds Stripe customer + subscription tables for plan management via Stripe billing.

CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  stripe_price_id         TEXT NOT NULL,
  plan_name               TEXT NOT NULL CHECK (plan_name IN ('free', 'pro', 'business', 'enterprise')),
  status                  TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'paused')),
  current_period_start    TEXT,
  current_period_end      TEXT,
  cancel_at_period_end    INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_subs_user    ON stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_stripe  ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_status  ON stripe_subscriptions(status);
