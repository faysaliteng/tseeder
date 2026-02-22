# Developer Guide — fseeder

## 1. Monorepo Structure

```
apps/api/src/
  index.ts          Entry: registers all routes + Env interface
  router.ts         URLPattern-based router
  middleware.ts     Auth, RBAC, CSRF, rate-limit middleware
  crypto.ts         PBKDF2, HMAC, token helpers (SubtleCrypto only)
  crypto-verifier.ts  Blockchain verification helpers
  d1-helpers.ts     Typed D1 query helpers (quota enforcement, job CRUD, audit logs)
  durable-objects.ts  JobProgressDO (SSE fanout) + UserSessionDO
  queue-consumer.ts   Cloudflare Queues handler (multi-worker load balancing)
  seedr-poller.ts     Cron: polls Seedr.cc for active job progress
  retention-sweeper.ts  Cron: cleanup expired files based on plan retention
  uptime-sweeper.ts     Cron: worker health monitoring + heartbeat checks
  handlers/
    auth.ts         POST /auth/* (register, login, verify-email, reset, api-keys)
    jobs.ts         POST/GET /jobs/* (create, list, detail, delete, callback)
    files.ts        GET/POST/DELETE /files/* (download proxy, upload, delete)
    admin.ts        GET/PATCH /admin/* (users, jobs, workers, storage, DLQ, search, settings)
    stripe.ts       POST /billing/* (checkout, portal, webhook)
    crypto.ts       GET/POST /crypto/* (wallets, orders, confirm) + /admin/crypto/*
    providers.ts    GET/POST /admin/providers/* (Seedr/Cloudflare toggle)
    articles.ts     GET/POST /blog/articles/* + /admin/articles/*
    orgs.ts         GET/POST /orgs/* (create, list, members, switch)

packages/shared/src/
  enums.ts          JobStatus, UserRole, PlanName, EventType
  schemas.ts        Zod schemas for every API shape
  index.ts          Re-exports

packages/shared/migrations/
  0001_initial.sql           Users, jobs, files, plans, audit_logs, sessions
  0002_api_keys.sql          API key authentication
  0003_admin_extended.sql    Admin features, infohash blocklist, job events
  0004_provider_configs.sql  Multi-provider support (Seedr/Cloudflare)
  0005_worker_heartbeats.sql Worker registry for multi-agent load balancing
  0006_articles.sql          Blog/CMS articles
  0007_article_bodies.sql    Article content bodies
  0008_api_keys_user.sql     User-scoped API keys with key_prefix
  0009_stripe_billing.sql    Stripe customers + subscriptions
  0010_uptime_history.sql    Worker uptime tracking history
  0011_observability_metrics.sql  Platform metrics collection
  0012_organizations.sql     Multi-tenant organizations + members
  0013_scan_status.sql       Virus scan status + detail columns on jobs
  0014_crypto_payments.sql   Crypto wallets, orders, prices
  0015_referrals.sql         Referral/invite system

workers/compute-agent/src/
  index.ts          HTTP server entry (Node.js 20 + tsx)
  engine.ts         WebTorrentEngine — seeding disabled, 1 B/s upload limit
  virus-scan.ts     ClamAV integration (recursive scan, auto-delete infected)
  r2-upload.ts      SigV4 multipart R2 upload (pure crypto, no AWS SDK)
  callback.ts       HMAC-signed progress callbacks to Workers API
  job-registry.ts   In-memory job state registry (pause/stop support)
  logger.ts         Structured JSON logger
  routes/
    start.ts        POST /start — full download pipeline
    stop.ts         POST /stop/:id — terminate active job
    status.ts       GET /status/:id — job progress
    health.ts       GET /health — agent health + capacity
    download.ts     GET /download/:jobId/:fileId — stream file from disk
    cleanup.ts      DELETE /cleanup/:jobId — remove job files from disk

src/                React frontend (Vite + Tailwind + shadcn/ui)
  lib/api.ts        Typed fetch client (50+ endpoints)
  lib/qr.ts         QR code generator for crypto wallet addresses
  lib/seedr-api.ts  Seedr.cc API client
  lib/mock-data.ts  Development mock data
  hooks/
    useSSE.ts         EventSource hook (real-time SSE progress)
    useAuthGuard.ts   Route protection hook
    useSessionRestore.ts  Session persistence hook
    use-mobile.tsx    Mobile breakpoint detection
  pages/
    Landing.tsx       Public landing page with pricing
    Index.tsx         Root redirect
    Dashboard.tsx     Main file manager + download list
    JobDetail.tsx     Single job view with real-time progress
    Settings.tsx      User settings + billing management
    CryptoCheckout.tsx  Crypto payment flow with QR code + countdown
    Automation.tsx    Automation rules
    Integrations.tsx  Third-party integrations
    Mount.tsx         FTP/WebDAV mount instructions
    Status.tsx        Platform status page
    Blog.tsx          Public blog listing
    BlogPost.tsx      Single blog post
    Extension.tsx     Browser extension download page
    Install.tsx       Installation guide
    CreateOrg.tsx     Organization creation
    OrgSettings.tsx   Organization settings
    DMCA.tsx          DMCA policy
    Privacy.tsx       Privacy policy
    Terms.tsx         Terms of service
    auth/
      Login.tsx       Email/password login
      Register.tsx    User registration
      Reset.tsx       Password reset
    admin/
      AdminLogin.tsx    Admin authentication
      Overview.tsx      Admin dashboard
      Users.tsx         User management
      UserDetail.tsx    User detail + actions
      Jobs.tsx          Job management
      Workers.tsx       Compute agent monitoring
      Infrastructure.tsx  Worker health + connectivity
      Storage.tsx       R2 storage management
      DLQ.tsx           Dead letter queue viewer
      Observability.tsx Metrics + analytics
      Security.tsx      Security audit
      Audit.tsx         Audit log viewer
      GlobalSearch.tsx  Cross-entity search
      Blog.tsx          Blog post management
      BlogEditor.tsx    WYSIWYG blog editor
      CryptoWallets.tsx Crypto wallet configuration
      AdminSettings.tsx Admin settings + configuration
      ConfigHistory.tsx Config change history
  components/
    AppSidebar.tsx      Main navigation sidebar
    TopHeader.tsx       Header with search + notifications
    AddDownloadModal.tsx  Magnet/torrent upload dialog (with quota enforcement)
    PricingModal.tsx    Plan selection popup (Basic/Pro/Master)
    MediaPlayer.tsx     In-browser video/audio player
    StatusBadge.tsx     Job status indicator
    OrgSwitcher.tsx     Organization context switcher
    PublicNav.tsx       Public page navigation
    NavLink.tsx         Sidebar navigation link
    admin/
      AdminLayout.tsx   Admin panel layout wrapper
      AdminUI.tsx       Admin UI components

infra/
  wrangler.toml     Cloudflare deployment config (D1, R2, Queues, KV, DO bindings)

public/extension/   Chrome/Firefox Extension (Manifest v3)
  background.js     Service worker (magnet interception)
  content.js        Content script (page magnet scanning)
  popup.js          Extension popup UI logic
  popup.html        Extension popup markup
  popup.css         Extension popup styles
  manifest.json     Chrome manifest
  manifest-firefox.json  Firefox manifest

docs/               Architecture, runbooks, threat model, go-live checklist
scripts/            smoke-test.sh
```

---

## 2. Local Development Setup

### Prerequisites

```bash
node -v    # >= 20.0.0
bun -v     # >= 1.1.0 (package manager only — runtime is Node.js for agent)
wrangler --version  # >= 3.60.0
```

### Frontend

```bash
# From repo root
echo "VITE_API_BASE_URL=http://localhost:8787" > .env.local
npm install
npm run dev   # → http://localhost:5173
```

### Workers API

```bash
cd apps/api
npm install

# Apply ALL migrations to local D1
for f in ../../packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --local --file "$f"
done

# Seed plans table
npx wrangler d1 execute rdm-database --local --command "INSERT INTO plans (name, max_storage_gb, max_concurrent_jobs, max_file_bytes, retention_days) VALUES ('free', 5, 1, 524288000, 7), ('pro', 50, 2, 5368709120, 30), ('business', 150, 8, 26843545600, 60), ('enterprise', 1024, 25, 107374182400, 90) ON CONFLICT DO NOTHING"

# Start dev server
npx wrangler dev --config ../../infra/wrangler.toml \
  --var ENVIRONMENT=development
```

API listens on `http://localhost:8787`.

### Compute Agent

> ⚠️ The compute agent requires **Node.js 20** (not Bun) because `node-datachannel` needs full `libuv` support. Bun will crash with `uv_timer_init` panic.

```bash
cd workers/compute-agent
npm install
npm install node-datachannel --build-from-source
npm install tsx
cp .env.example .env
# Fill: WORKER_ID, R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID,
#       R2_SECRET_ACCESS_KEY, CALLBACK_SIGNING_SECRET, DOWNLOAD_DIR,
#       WORKER_CLUSTER_TOKEN

# Start with Node.js + tsx
node --import tsx src/index.ts
```

### Stripe Local Testing

```bash
stripe listen --forward-to localhost:8787/billing/webhook
# Copy the printed webhook secret → set as STRIPE_WEBHOOK_SECRET in dev
```

---

## 3. Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage

# Specific test file
npm run test -- src/test/extension.test.ts
```

---

## 4. Adding Routes

1. Create handler in `apps/api/src/handlers/<feature>.ts`
2. Define Zod schemas in `packages/shared/src/schemas.ts`
3. Register route in `apps/api/src/index.ts` with appropriate middlewares
4. Add typed client method to `src/lib/api.ts`
5. Write audit log entry for every mutation

**Every route must:**
- Validate all inputs with Zod (`safeParse`, never `parse`)
- Return `{ error: { code, message, requestId } }` on failure
- Log structured JSON with correlationId
- Write audit log for mutations
- Enforce RBAC via middleware

---

## 5. Adding D1 Migrations

```bash
# Create migration file (use next sequential number)
touch packages/shared/migrations/NNNN_describe_the_change.sql

# Apply locally
for f in packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --local --file "$f"
done

# Apply to production
cd apps/api
npx wrangler d1 migrations apply rdm-database --env production --remote
```

**Migration rules:**
- Never drop columns on a live table without a deprecation window
- Always add nullable columns or columns with defaults
- Migration files are immutable once deployed
- Current range: 0001–0015

---

## 6. API Key Lifecycle

1. User calls `POST /auth/api-keys` with a name → receives `{ key: {...}, secret: "tsk_..." }`
2. Secret is shown **once** — user must copy it immediately
3. Key is stored as `key_hash` (SHA-256) in D1; `key_prefix` (first 8 chars) shown in UI
4. API key auth: send `Authorization: Bearer tsk_...` header
5. Revoke via `DELETE /auth/api-keys/:id`
6. Keys expire if `expires_at` is set

DB columns: `id, user_id, name, key_hash, key_prefix, role, revoked, expires_at, last_used_at, created_at`

---

## 7. Error Handling

**Standard error shape:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "uuid" } }
```

**Error code prefixes:** `AUTH_*`, `CSRF_*`, `VALIDATION_*`, `NOT_FOUND`, `QUOTA_STORAGE`, `QUOTA_JOBS`, `RATE_*`, `BILLING_*`, `INTERNAL_ERROR`

**Quota errors:** When a user exceeds storage or concurrent job limits, the API returns `QUOTA_STORAGE` or `QUOTA_JOBS`. The frontend `AddDownloadModal` intercepts these and shows upgrade/manage options.

---

## 8. Release Process

```bash
# 1. Apply migrations first
cd apps/api
npx wrangler d1 migrations apply rdm-database --env production --remote

# 2. Deploy Workers API
npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production

# 3. Build + deploy Pages (or push to GitHub for auto-deploy)
cd ../..
npm run build
npx wrangler pages deploy dist --project-name fseeder --branch main

# 4. Update compute agents (all droplets)
for IP in DROPLET_1_IP DROPLET_2_IP DROPLET_3_IP; do
  ssh root@$IP 'cd /opt/tseeder-agent && ./update.sh'
done

# 5. Verify
curl https://api.fseeder.cc/health

# 6. Smoke test
API_URL=https://api.fseeder.cc ./scripts/smoke-test.sh
```

---

## 9. Crypto Payment System

### Supported Coins

| Coin | Network | CMC Ticker |
|---|---|---|
| BTC | Bitcoin | BTC |
| USDT | TRC-20 (Tron) | USDT |
| USDT-SOL | Solana (SPL) | USDT |
| USDT-POLYGON | Polygon | USDT |
| LTC | Litecoin | LTC |
| BNB | BEP-20 (BSC) | BNB |

### Flow

1. User selects plan → picks coin → `POST /crypto/orders`
2. API fetches live crypto price from CoinMarketCap (`CMC_API_KEY`)
3. Order created with wallet address, crypto amount, 30-minute expiry
4. Frontend shows QR code + countdown timer
5. Admin manually confirms payment via `POST /admin/crypto/orders/:id/confirm`
6. User plan is upgraded in D1

### API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/crypto/wallets` | Public | List enabled coins + addresses |
| POST | `/crypto/orders` | User | Create payment order |
| GET | `/crypto/orders/:id` | User | Poll order status |
| GET | `/admin/crypto/wallets` | Admin | List all wallet configs |
| POST | `/admin/crypto/wallets` | Admin | Set wallet address for a coin |
| GET | `/admin/crypto/orders` | Admin | List all orders with filters |
| POST | `/admin/crypto/orders/:id/confirm` | Admin | Manually confirm order |

### Database Tables

- `crypto_wallets` — coin, address, network, is_active
- `crypto_orders` — user_id, plan_name, coin, amount_usd, amount_crypto, tx_hash, status, expires_at
- `crypto_prices` — plan_name, price_usd

---

## 10. Virus Scanning (ClamAV)

Every download is scanned before being marked complete:

1. Download finishes → `clamscan -r` runs on job directory
2. **Clean** → `scan_status = "clean"`, job completes normally
3. **Infected** → files deleted, `scan_status = "infected"`, job marked failed
4. **ClamAV not installed** → `scan_status = "error"`, job completes (graceful degradation)

Frontend shows scan badge: ✅ Virus-free / ⚠️ Threat detected

---

## 11. Multi-Worker Compute Cluster

The queue consumer (`queue-consumer.ts`) supports multiple compute agents via the `worker_registry` D1 table:

- **selectWorker()** queries for healthy workers with capacity, sorted by load factor
- Selects the **least-loaded** agent (lowest `active_jobs / max_jobs` ratio)
- Workers older than 5 minutes without a heartbeat are excluded
- Falls back to `WORKER_CLUSTER_URL` (single-node mode) if registry is empty

See `WORKING-INSTRUCTIONS.md` Section 12 for complete multi-droplet deployment guide.

---

## 12. Organizations (Multi-Tenant)

- Users can create organizations and invite members
- Organization context switcher in the sidebar
- Jobs and files scoped to organization context
- Roles within orgs: owner, admin, member
- Migration: `0012_organizations.sql`

---

## 13. Browser Extension

Supports Chrome (Manifest v3) and Firefox:

- **Magnet link interception** — captures magnet links from any page
- **Content script** — scans pages for magnet URIs
- **Popup UI** — shows active downloads, allows magnet/torrent submission
- **Auth bridge** — uses API session token stored in local storage

Files: `public/extension/` — separate manifests for Chrome and Firefox.

### Testing

1. Load unpacked extension from `public/extension/`
2. Log in via the popup
3. Navigate to a page with magnet links
4. Click a magnet link — should route to fseeder
5. Verify context menu "Download with fseeder" works

---

## 14. Key Architecture Decisions

| Decision | Rationale |
|---|---|
| Node.js 20 on VM, not Bun | `node-datachannel` requires libuv (`uv_timer_init`) — Bun panics |
| WebTorrent with seeding disabled | Preserve bandwidth + privacy; 1 B/s upload limit |
| Files on local disk, not R2 | Faster downloads via API proxy; R2 for backup only |
| tsx loaded locally, not globally | systemd cannot resolve global npm packages |
| Async `import("webtorrent")` | Top-level import causes resolution errors at runtime |
| Cloudflare Tunnel, not open ports | HTTPS everywhere, DDoS protection on agents |
| HMAC-signed callbacks | Prevent spoofed progress updates from reaching the API |

---

## 15. Secrets Inventory

| Secret | Set On | Notes |
|---|---|---|
| `SESSION_SECRET` | Cloudflare only | 64-char hex |
| `CSRF_SECRET` | Cloudflare only | 64-char hex |
| `CALLBACK_SIGNING_SECRET` | **Both** CF + VM | Must match exactly |
| `WORKER_CLUSTER_TOKEN` | **Both** CF + VM | Must match exactly |
| `WORKER_CLUSTER_URL` | Cloudflare only | `https://agent-tunnel.fseeder.cc` (no trailing slash) |
| `R2_ACCESS_KEY_ID` | **Both** CF + VM | From R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | **Both** CF + VM | From R2 API Tokens |
| `R2_ENDPOINT` | **Both** CF + VM | `https://ACCT_ID.r2.cloudflarestorage.com` |
| `R2_ACCOUNT_ID` | Cloudflare only | Cloudflare account ID |
| `CMC_API_KEY` | Cloudflare only | CoinMarketCap API for live crypto prices |
| `STRIPE_SECRET_KEY` | Cloudflare only | Stripe billing (if enabled) |
| `STRIPE_WEBHOOK_SECRET` | Cloudflare only | Stripe webhook verification |

> ⚠️ After setting/changing any Cloudflare secret, you **must redeploy** the Worker for it to take effect.

---

## 16. Quick Reference

| Action | Command |
|---|---|
| Deploy backend | `cd apps/api && npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production` |
| Deploy frontend | Push to GitHub (auto) or `npx wrangler pages deploy dist` |
| Set a secret | `wrangler secret put NAME --env production` + redeploy |
| Run D1 migration | `npx wrangler d1 migrations apply rdm-database --env production --remote` |
| Query database | `npx wrangler d1 execute rdm-database --env production --remote --command "SQL"` |
| Live Worker logs | `npx wrangler tail --env production` |
| Restart agent | `ssh root@VM && sudo systemctl restart tseeder-agent` |
| Agent logs | `sudo journalctl -u tseeder-agent -f` |
| Agent health | `curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/health` |
| Update all agents | `for IP in IPs; do ssh root@$IP 'cd /opt/tseeder-agent && ./update.sh'; done` |
