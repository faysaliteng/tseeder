

# Crypto Payment Gateway

## Overview
Build a self-hosted crypto payment gateway that accepts BTC, USDT (TRC-20/ERC-20), LTC, and BNB. Admin configures destination wallet addresses in the admin panel. Users see a QR code + wallet address when upgrading, and the system polls blockchain explorers to verify payment and activate the plan.

## Architecture

```text
User clicks "Pay with Crypto"
        |
        v
Frontend creates a crypto payment order via API
        |
        v
API generates a unique payment record in D1
  (coin, amount, destination wallet, expiry, user_id, plan)
        |
        v
Frontend shows QR code + address + countdown timer
        |
        v
API has a scheduled CRON or Durable Object alarm
  that polls public blockchain APIs to check for incoming tx
        |
        v
Once confirmed (enough confirmations), API marks payment as "confirmed"
  and activates the user's plan (same applyPlanByName logic as Stripe)
```

## What Changes

### Frontend Only (auto-deploys via GitHub)

1. **`src/pages/CryptoCheckout.tsx`** (new) -- Full-page checkout with:
   - Plan summary (name, price in USD)
   - Coin selector (BTC / USDT / LTC / BNB)
   - QR code generated client-side from the wallet address (using a lightweight QR library or inline SVG generator)
   - Wallet address with copy button
   - Expected amount display
   - Countdown timer (30-minute expiry)
   - Live status polling every 10s via React Query to check payment confirmation
   - Auto-redirect to settings on success

2. **`src/pages/admin/CryptoWallets.tsx`** (new) -- Admin page to:
   - View/add/edit destination wallet addresses per coin (BTC, USDT, LTC, BNB)
   - Set USD prices per plan
   - View pending/confirmed/expired crypto payments
   - Manually confirm a payment (emergency override)

3. **`src/components/admin/AdminLayout.tsx`** (edit) -- Add "Crypto Wallets" nav item to sidebar

4. **`src/pages/Settings.tsx`** (edit) -- Add "Pay with Crypto" button alongside existing Stripe billing section

5. **`src/App.tsx`** (edit) -- Add routes:
   - `/app/crypto-checkout` for the checkout page
   - `/admin/crypto-wallets` for the admin wallet management

6. **`src/lib/api.ts`** (edit) -- Add crypto billing API client methods:
   - `cryptoBilling.getWallets()` -- get available coins + addresses
   - `cryptoBilling.createOrder(planName, coin)` -- create payment order
   - `cryptoBilling.getOrder(orderId)` -- poll payment status
   - `cryptoBilling.adminListWallets()` / `adminSetWallet()` / `adminListOrders()` / `adminConfirmOrder()`

7. **`src/lib/qr.ts`** (new) -- Lightweight QR code generator (pure JS, no external dependency) to render wallet addresses as QR codes

### Backend -- API Worker (manual deploy from PC)

8. **`apps/api/src/handlers/crypto.ts`** (new) -- All crypto payment handlers:
   - `GET /crypto/wallets` -- public: returns enabled coins + wallet addresses
   - `POST /crypto/orders` -- authenticated: creates a payment order with amount, coin, expiry
   - `GET /crypto/orders/:id` -- authenticated: returns order status (pending/confirming/confirmed/expired)
   - `GET /admin/crypto/wallets` -- admin: list all wallet configs
   - `POST /admin/crypto/wallets` -- admin: set wallet address for a coin
   - `GET /admin/crypto/orders` -- admin: list all crypto orders with filters
   - `POST /admin/crypto/orders/:id/confirm` -- admin: manually confirm payment

9. **`apps/api/src/crypto-verifier.ts`** (new) -- Blockchain verification module:
   - Polls public APIs (blockstream.info for BTC, tronscan for USDT TRC-20, blockcypher for LTC, bscscan for BNB)
   - Checks if the destination address received the expected amount after the order was created
   - Returns confirmation count
   - No API keys needed for basic public blockchain queries

10. **`apps/api/src/index.ts`** (edit) -- Register new crypto routes

11. **D1 Migration `0014_crypto_payments.sql`** (new):
```sql
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
```

### Compute Agent (no changes needed)

## Security Measures

- All wallet addresses are stored server-side in D1 only -- never hardcoded in frontend
- Admin-only access to wallet configuration (rbacMiddleware("superadmin"))
- Orders expire after 30 minutes to prevent stale payment windows
- Blockchain verification uses multiple public APIs with fallback
- Amount matching uses a tolerance window (e.g., +/- 0.5%) to account for network fees
- Admin manual confirm requires DangerModal with reason + audit log
- Rate limiting on order creation (5 per hour per user)
- All actions logged to audit trail

## Deployment After Implementation

| Component | Deploy Method |
|-----------|--------------|
| Frontend (Settings, CryptoCheckout, AdminCryptoWallets, api.ts, App.tsx) | Auto-deploy via GitHub push |
| API Worker (crypto.ts, crypto-verifier.ts, index.ts) | Manual: `cd apps/api && npx wrangler deploy src/index.ts --config ../../infra/wrangler.toml --env production` |
| D1 Migration | Manual: `npx wrangler d1 execute tseeder-db --file=packages/shared/migrations/0014_crypto_payments.sql --env production` |
| Compute Agent | No changes needed |

## Price Conversion
The API will fetch live crypto prices from CoinGecko's free public API (`/api/v3/simple/price?ids=bitcoin,tether,litecoin,binancecoin&vs_currencies=usd`) to calculate the exact crypto amount the user needs to send. Price is locked at order creation time.

