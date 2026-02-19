# tseeder — Enterprise Remote Download Manager

A production-grade remote torrent/magnet-link download manager built on the **Cloudflare-first stack** (Pages · Workers · Durable Objects · Queues · R2 · D1).

---

## Architecture

```
Browser (React/Vite)          ← Cloudflare Pages
    ↕  REST + SSE
Workers API                   ← Cloudflare Workers (apps/api)
    ↕           ↕          ↕            ↕
   D1 (SQL)   Durable Obj  Queues     R2 Storage
               (SSE fanout) (dispatch)  (files)
                                ↕
                      Compute Agent Cluster
                      (Node/Bun, workers/compute-agent)
                                ↕
                         R2 multipart upload (SigV4)
```

Full spec: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Repository Layout

```
apps/api/              Cloudflare Workers API gateway
  src/handlers/        auth, jobs, files, admin, stripe, providers, articles
  src/index.ts         Route registration + Env interface
packages/shared/
  migrations/          D1 SQL migrations (0001–0009)
  src/schemas.ts       Zod schemas for every API shape
infra/
  wrangler.toml        Cloudflare deployment config (edit before deploy)
workers/compute-agent/ External torrent engine (Node/Bun + WebTorrent)
src/                   React frontend (Vite + Tailwind + shadcn/ui)
docs/                  Architecture, runbooks, threat model, go-live checklist
scripts/               smoke-test.sh
public/extension/      Chrome Extension (Manifest v3)
```

---

## Environment Variables

### Frontend (Cloudflare Pages → Settings → Environment variables)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | **YES** | Base URL of your Workers API e.g. `https://api.tseeder.cc` |
| `VITE_TURNSTILE_SITE_KEY` | YES | Cloudflare Turnstile site key (public) |

### Workers API Secrets (`wrangler secret put <NAME> --env production`)

| Secret | Description |
|---|---|
| `SESSION_SECRET` | 64-char hex — `openssl rand -hex 32` |
| `CSRF_SECRET` | 64-char hex |
| `CALLBACK_SIGNING_SECRET` | Shared with compute agents |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server secret |
| `WORKER_CLUSTER_TOKEN` | Bearer token for compute agent auth |
| `WORKER_CLUSTER_URL` | `https://your-agent-cluster.example.com` |
| `R2_ACCESS_KEY_ID` | R2 S3-compat API token |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compat API secret |
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe Dashboard |
| `STRIPE_PRICE_IDS` | JSON: `{"pro":"price_xxx","business":"price_yyy"}` |
| `SEEDR_EMAIL` | (optional) Seedr.cc account email |
| `SEEDR_PASSWORD` | (optional) Seedr.cc account password |

### Workers API Vars (`infra/wrangler.toml [vars]`)

| Var | Description |
|---|---|
| `APP_DOMAIN` | Frontend URL e.g. `https://tseeder.cc` |
| `R2_BUCKET_NAME` | `rdm-files` |
| `MAX_UPLOAD_BYTES` | `5368709120` (5 GB) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (safe to commit) |

### Compute Agent (K8s secret / `.env`)

| Var | Description |
|---|---|
| `WORKER_ID` | Unique ID per pod e.g. `agent-1` |
| `WORKER_CLUSTER_TOKEN` | Same as Workers API secret |
| `CALLBACK_SIGNING_SECRET` | Same as Workers API secret |
| `R2_ENDPOINT` | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `rdm-files` |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `DOWNLOAD_DIR` | `/data/downloads` |

---

## Quick Start (5 commands)

```bash
# 1. Clone and install
git clone https://github.com/your-org/tseeder && cd tseeder
npm install

# 2. Start frontend (Vite)
echo "VITE_API_BASE_URL=http://localhost:8787" > .env.local
npm run dev

# 3. Start Workers API locally (separate terminal)
cd apps/api && npm install
npx wrangler dev --config ../../infra/wrangler.toml

# 4. Apply D1 migrations locally
for f in packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --local --file "$f"
done

# 5. (Optional) Start compute agent
cd workers/compute-agent && bun install && bun run dev
```

---

## Production Deployment

Full step-by-step: [`INSTRUCTIONS.md`](INSTRUCTIONS.md)  
Go-live checklist: [`docs/go-live-checklist.md`](docs/go-live-checklist.md)  
Smoke test: [`scripts/smoke-test.sh`](scripts/smoke-test.sh)

---

## Frontend Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/auth/login` | Login (email + Turnstile) |
| `/auth/register` | Registration |
| `/auth/reset` | Password reset |
| `/auth/verify` | Email verification |
| `/app/dashboard` | Job list (real-time SSE) |
| `/app/dashboard/:jobId` | Job detail + file browser |
| `/app/settings` | Account, billing, API keys |
| `/blog` | Public blog |
| `/admin/login` | Admin gate |
| `/admin/*` | Admin console (RBAC enforced) |

---

## Security

- RBAC: `user` · `support` · `admin` · `superadmin`
- CSRF token on every mutating request (HMAC-signed, single-use)
- HttpOnly Secure session cookies (30-day TTL)
- Cloudflare Turnstile bot protection on all auth routes
- PBKDF2-SHA256 password hashing via Web Crypto API
- Immutable audit log for all admin actions
- Mandatory `reason` + `ticketId` on destructive admin operations
- Infohash blocklist with automatic job termination
- Rate limiting via Cloudflare KV (sliding window)

See [`docs/threat-model.md`](docs/threat-model.md).

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui |
| State | TanStack Query · React hooks |
| Realtime | Server-Sent Events via Durable Objects |
| API | Cloudflare Workers · Custom router · Zod |
| Database | Cloudflare D1 (SQLite) — 9 migrations |
| Storage | Cloudflare R2 (S3-compatible) |
| Queue | Cloudflare Queues + DLQ |
| Realtime state | Cloudflare Durable Objects |
| Compute | Node.js/Bun containers · WebTorrent |
| Billing | Stripe Checkout + Customer Portal + Webhooks |
| Email | MailChannels (via Cloudflare Workers) |
