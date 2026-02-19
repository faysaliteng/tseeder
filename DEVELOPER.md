# Developer Guide — tseeder

## 1. Monorepo Structure

```
apps/api/src/
  index.ts          Entry: registers all routes + Env interface
  router.ts         URLPattern-based router
  middleware.ts     Auth, RBAC, CSRF, rate-limit middleware
  crypto.ts         PBKDF2, HMAC, token helpers (SubtleCrypto only)
  d1-helpers.ts     Typed D1 query helpers
  handlers/
    auth.ts         POST /auth/* (register, login, verify-email, reset, api-keys)
    jobs.ts         POST/GET /jobs/*
    files.ts        GET/POST/DELETE /files/*
    admin.ts        GET/PATCH /admin/* (users, jobs, workers, storage, DLQ, search)
    stripe.ts       POST /billing/* (checkout, portal, webhook)
    providers.ts    GET/POST /admin/providers/*
    articles.ts     GET/POST /blog/articles/* + /admin/articles/*
  durable-objects.ts  JobProgressDO + UserSessionDO
  queue-consumer.ts   Cloudflare Queues handler
  seedr-poller.ts     Cron: polls Seedr.cc for active job progress

packages/shared/src/
  enums.ts          JobStatus, UserRole, PlanName, EventType
  schemas.ts        Zod schemas for every API shape
  index.ts          Re-exports

packages/shared/migrations/
  0001_initial.sql
  0002_api_keys.sql
  0003_admin_extended.sql
  0004_provider_configs.sql
  0005_worker_heartbeats.sql
  0006_articles.sql
  0007_article_bodies.sql
  0008_api_keys_user.sql     ← adds user_id + key_prefix columns
  0009_stripe_billing.sql    ← stripe_customers + stripe_subscriptions

workers/compute-agent/src/
  index.ts          HTTP server entry (Node/Bun)
  engine.ts         TorrentEngine interface + WebTorrentEngine (production)
  routes/start.ts   POST /agent/jobs/start — download pipeline
  routes/stop.ts    POST /agent/jobs/:id/stop
  routes/health.ts  GET /agent/health
  r2-upload.ts      Real SigV4 multipart R2 upload (no AWS SDK, pure crypto)
  callback.ts       HMAC-signed progress callbacks to Workers API
  job-registry.ts   In-memory job state registry

src/                React frontend (Vite + Tailwind + shadcn/ui)
  lib/api.ts        Typed fetch client (all 47+ endpoints)
  hooks/useSSE.ts   EventSource hook (real-time SSE progress)
  pages/            Auth, Dashboard, JobDetail, Settings, Blog, Admin
  components/       Sidebar, TopHeader, AddDownloadModal, StatusBadge

infra/
  wrangler.toml     Cloudflare deployment config

public/extension/   Chrome Extension (Manifest v3)
docs/               Architecture, runbooks, threat model, go-live checklist
scripts/            smoke-test.sh
```

---

## 2. Local Development Setup

### Prerequisites

```bash
node -v    # >= 20.0.0
bun -v     # >= 1.1.0
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

# Apply migrations to local D1
for f in ../../packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --local --file "$f"
done

# Start dev server (uses infra/wrangler.toml)
npx wrangler dev --config ../../infra/wrangler.toml \
  --var ENVIRONMENT=development \
  --var TURNSTILE_SECRET_KEY=BYPASS_FOR_DEV
```

API listens on `http://localhost:8787`.

### Compute Agent

```bash
cd workers/compute-agent
bun install   # installs webtorrent
cp .env.example .env
# Fill: WORKER_ID, R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID,
#       R2_SECRET_ACCESS_KEY, CALLBACK_SIGNING_SECRET, DOWNLOAD_DIR

bun run dev
```

### Stripe Local Testing

```bash
# Install Stripe CLI
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

---

## 5. Adding D1 Migrations

```bash
# Create migration file
touch packages/shared/migrations/NNNN_describe_the_change.sql

# Apply locally
for f in packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --local --file "$f"
done

# Apply to production (AFTER code deploy)
for f in packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --env production --file "$f"
done
```

**Migration rules:**
- Never drop columns on a live table without a deprecation window
- Always add nullable columns or columns with defaults
- Migration files are immutable once deployed

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

**Error code prefixes:** `AUTH_*`, `CSRF_*`, `VALIDATION_*`, `NOT_FOUND`, `QUOTA_*`, `RATE_*`, `BILLING_*`, `INTERNAL_ERROR`

---

## 8. Release Process

```bash
# 1. Apply migrations first
for f in packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --env production --file "$f"
done

# 2. Deploy Workers API
cd apps/api && npx wrangler deploy --env production

# 3. Build + deploy Pages
npm run build
npx wrangler pages deploy dist --project-name tseeder --branch main

# 4. Verify
curl https://api.tseeder.cc/health

# 5. Smoke test
API_URL=https://api.tseeder.cc ./scripts/smoke-test.sh
```

---

## 9. Browser Extension — Manual Test Checklist

See checklist in `public/extension/` — tests: auth bridge, magnet submission, context menu, content script injection, ZIP download, error cases.
