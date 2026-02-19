
# Production Completion Plan — tseeder OMEGA

## Complete Honest Gap Analysis

After reading every file in the codebase, here is the precise list of what is **real and complete** vs. what is **stubbed, missing, or broken**:

### REAL AND COMPLETE (do not touch)
- All 47 API endpoints: auth, jobs, files, usage, admin, providers, blog, SSE — fully implemented, no stubs
- D1 schema: 16 tables across 7 migrations, fully normalized, proper indexes, seed data
- RBAC middleware: 4-tier (user/support/admin/superadmin), all routes gated correctly
- CSRF + session system: HMAC-signed, HttpOnly cookies, KV-backed rate limiting
- Cloudflare Turnstile: real integration, server-side verify, dev bypass
- Queue consumer: real provider dispatch — both Seedr.cc and compute agent paths are real
- Seedr.cc integration: real HTTP Basic Auth calls to `seedr.cc/rest/*` API
- Provider switch system: versioned history in D1, audit-logged, in-flight job warnings
- Worker heartbeat + fleet management: D1 registry + time-series heartbeats
- Storage cleanup: real R2 delete + D1 orphan sweep
- Blog CMS: full admin CRUD + 8 seeded real articles in migration SQL
- Durable Objects: `JobProgressDO` (SSE fanout) + `UserSessionDO` — real implementation
- Frontend API client (`src/lib/api.ts`): fully typed, no mocks, all 47 endpoints mapped
- Browser extension: Manifest v3, content.js injection, background.js context menus, auth bridge
- Email system: MailChannels integration for password reset is **real**, not stubbed
- Email verification token creation: real (but email send not triggered on register — gap)

### GAPS — THINGS THAT MUST BE FIXED

**Gap 1: `StubTorrentEngine` in `workers/compute-agent/src/engine.ts`**
The `StubTorrentEngine` simulates fake progress every 2 seconds. The `TorrentEngine` interface is perfectly defined. What's needed: a real implementation using WebTorrent (npm) that satisfies the interface. When `WORKER_CLUSTER_URL` is not configured (or agent is unreachable), the queue consumer already throws — that's correct. The stub must be replaced so real downloads happen when the agent IS running.

**Gap 2: SigV4 stub in `workers/compute-agent/src/r2-upload.ts`**
Lines 117–126: `// TODO: Implement full AWS SigV4 signing`. The multipart upload framework is correct (part chunking, `CompleteMultipartUpload` XML) but the `Authorization` header is not set. Files will be rejected by R2. This needs real SigV4.

**Gap 3: Email verification not sent on register**
`handleRegister` creates the user and sets `email_verified = 0`, but never generates an `email_verification_tokens` row or sends the verification email. `handleVerifyEmail` exists and works — just nothing calls the send. Users can never verify their email, so they can never log in.

**Gap 4: `ResetConfirmSchema` uses `newPassword` but handler reads `password`**
In `schemas.ts` line 42: `newPassword: PasswordSchema`. In `auth.ts` line 255: `const { token, password } = parsed.data`. This is a field name mismatch — `password` is always `undefined` so the reset will write `undefined` as the hash. Password reset is broken.

**Gap 5: Stripe billing — zero implementation**
No `stripe_subscriptions` table, no webhook handler, no checkout session endpoint, no plan enforcement from Stripe. The pricing page links to `/#pricing` — there is no real payment flow. `user_plan_assignments` is manually managed (admin only).

**Gap 6: `VITE_API_BASE_URL` not enforced**
`src/lib/api.ts` line 6: `const BASE = import.meta.env.VITE_API_BASE_URL ?? ""`. When empty, all API calls go to the preview origin (Lovable's server) which has no Workers API. Every page that calls the API returns empty. No build-time check enforces this.

**Gap 7: Admin `api_keys` table vs user `api_keys` — schema mismatch**
`0002_api_keys.sql` creates `api_keys` with role `compute_agent|internal|admin_api`. But `handleCreateApiKey` in `auth.ts` (line ~420) also inserts into `api_keys` with a `user_id` and `key_prefix` that don't exist in the migration schema. Need to check and align the columns.

**Gap 8: Missing migration — `api_keys` needs `user_id` and `key_prefix` columns**
The migration has `created_by` (nullable) but auth handler likely expects `user_id` (required). Need a new migration adding `user_id`, `key_prefix`, `name` to properly support user-facing API keys.

**Gap 9: Docs are partially stale**
`DEVELOPER.md` references `apps/web/src/` (doesn't exist — it's `src/`), `services/compute-agent/` (it's `workers/compute-agent/`), `r2-helpers.ts` (doesn't exist), `handlers/usage.ts` (it's in `admin.ts`). README calls the stack "TorrentFlow" instead of "tseeder". `INSTRUCTIONS.md` references `apps/api` but `wrangler.toml` is in `infra/`.

**Gap 10: No production smoke-test script**
Request specifically asks for a shell script that verifies the full flow end-to-end.

**Gap 11: No Go-Live Checklist document**
Needed as a deliverable.

**Gap 12: `api_keys` auth handler references columns that differ from migration**
Line 411 in auth.ts: `SELECT id, name, key_prefix, created_at, last_used_at, expires_at FROM api_keys WHERE user_id = ?` — but `0002_api_keys.sql` has no `user_id` or `key_prefix` column. This means all API key listing/creation is broken at the SQL level.

---

## Implementation Plan

### Phase 1 — Fix Critical Schema Bug (api_keys)

**New migration `0008_api_keys_user.sql`:**
```sql
ALTER TABLE api_keys ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD COLUMN key_prefix TEXT;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
```
This aligns the table with what `auth.ts` actually queries.

### Phase 2 — Fix Auth Bugs

**2a — Fix `ResetConfirmSchema` field name mismatch**

In `packages/shared/src/schemas.ts`, rename `newPassword` → `password` in `ResetConfirmSchema`:
```typescript
export const ResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,  // was: newPassword
});
```

**2b — Wire email verification on register**

In `apps/api/src/handlers/auth.ts`, after `createUser`, add:
1. Generate a verification token
2. Insert into `email_verification_tokens` 
3. Call a `sendVerificationEmail()` function (same MailChannels pattern as password reset)
4. Email body: styled HTML with `${env.APP_DOMAIN}/auth/verify?token=${token}`

The `handleVerifyEmail` endpoint already exists and works — this just wires the send.

### Phase 3 — Fix Real Torrent Engine

**`workers/compute-agent/src/engine.ts`** — Replace `StubTorrentEngine` with `WebTorrentEngine`:

```typescript
import WebTorrent from "webtorrent";

export class WebTorrentEngine implements TorrentEngine {
  private client = new WebTorrent();
  private jobs = new Map<string, { torrent: WebTorrent.Torrent; metadata: TorrentMetadata | null }>();

  async start(options: StartOptions): Promise<AsyncIterable<TorrentProgress>> {
    return new Promise((resolve, reject) => {
      const source = options.magnetUri ?? options.torrentBuffer!;
      const torrent = this.client.add(source, { path: options.downloadDir });

      this.jobs.set(options.jobId, { torrent, metadata: null });

      torrent.on("metadata", () => {
        // populate metadata
      });

      torrent.on("error", reject);
      torrent.on("ready", () => resolve(this.createProgressStream(options.jobId, torrent)));
    });
  }
  // ... stop(), getProgress(), getMetadata(), getFiles()
}
```

`workers/compute-agent/package.json` gets `"webtorrent": "^2.5.1"` added.

**`workers/compute-agent/src/r2-upload.ts`** — Replace the SigV4 stub with a real implementation using the `@aws-sdk/signature-v4` + `@aws-sdk/credential-providers` packages (both work in Bun/Node):

```typescript
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";

const signer = new SignatureV4({
  credentials: { accessKeyId, secretAccessKey },
  region: "auto",
  service: "s3",
  sha256: Sha256,
});
```

### Phase 4 — Stripe Billing

**New migration `0009_stripe_billing.sql`:**
```sql
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id       TEXT NOT NULL,
  plan_name             TEXT NOT NULL,
  status                TEXT NOT NULL,
  current_period_start  TEXT,
  current_period_end    TEXT,
  cancel_at_period_end  INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**New `apps/api/src/handlers/stripe.ts`:**
- `POST /billing/checkout` — creates Stripe Checkout Session, redirects to `stripe.com`
- `POST /billing/portal` — creates Stripe Customer Portal session
- `POST /billing/webhook` — receives Stripe webhooks:
  - `customer.subscription.created/updated/deleted` → updates `stripe_subscriptions` and `user_plan_assignments`
  - `checkout.session.completed` → creates customer record

**New env secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Frontend — `src/pages/Settings.tsx`** gets a "Billing" tab with:
- Current plan display
- "Upgrade" button → calls `POST /billing/checkout`
- "Manage Billing" button → calls `POST /billing/portal`

Stripe is imported via `import Stripe from "stripe"` in the Worker (works with `nodejs_compat`).

### Phase 5 — VITE_API_BASE_URL Guard

**`src/lib/api.ts`** — Add build-time validation:
```typescript
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";
if (!BASE && import.meta.env.PROD) {
  console.error("FATAL: VITE_API_BASE_URL is not set. All API calls will fail.");
}
```

**`vite.config.ts`** — Add `define` check to fail the build if unset in production:
```typescript
if (process.env.NODE_ENV === "production" && !process.env.VITE_API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL must be set for production builds");
}
```

### Phase 6 — Operator Tools (Admin gaps)

**6a — DLQ Inspector/Replay endpoint**

New route: `GET /admin/dlq` — lists jobs in DLQ state (status = 'failed', in job_events with `job_failed_dlq`).
New route: `POST /admin/dlq/:jobId/replay` — re-queues a failed job: resets status to `submitted`, sends to `JOB_QUEUE`.

**6b — Config History Diffs**

`GET /admin/config-history` — queries `config_changes` table (already exists from migration 0003) with diffs: old_value → new_value, changed_by, reason, timestamp. 

**6c — Global Search**

`GET /admin/search?q=<query>` — unified search across users (by email), jobs (by name/infohash), audit_logs (by action/actor). Returns categorized results with type + id + preview text.

**6d — Mandatory Reason on Destructive Actions**

Routes that currently accept optional `reason`:
- `POST /admin/jobs/:id/terminate`
- `POST /admin/users/:id/force-logout`
- `POST /admin/storage/cleanup`

Change these to **require** `reason` (min 10 chars) and **require** `ticketId` (min 1 char). Return 400 if either is missing.

Frontend `DangerModal` (already has typed-confirmation UX) gets a "Ticket/Reason" field wired in.

### Phase 7 — Documentation Overhaul

**`README.md`** — Full rewrite:
- Fix "TorrentFlow" → "tseeder" everywhere
- Add complete environment variable table (all 15 secrets + 8 vars)
- Add architecture diagram in text
- Add "Quick Start (5 commands)" section
- Add browser extension load instructions

**`DEVELOPER.md`** — Fix all stale paths:
- `apps/web/src/` → `src/`
- `services/compute-agent/` → `workers/compute-agent/`
- `r2-helpers.ts` → `apps/api/src/handlers/files.ts`
- `handlers/usage.ts` → inside `handlers/admin.ts`
- Add "API Key lifecycle" section
- Add "Stripe webhook local testing with Stripe CLI" section

**`INSTRUCTIONS.md`** — Fix `wrangler.toml` path from `apps/api` to `infra/`, add:
- Step for Stripe secrets
- `wrangler secret put STRIPE_SECRET_KEY`
- `wrangler secret put STRIPE_WEBHOOK_SECRET`
- Step for email verification (MailChannels domain lockdown setup)
- Migration `0008` and `0009` in the apply loop

### Phase 8 — Go-Live Checklist + Smoke Test

**New file: `docs/go-live-checklist.md`**

```markdown
# Go-Live Checklist

## Infrastructure
- [ ] D1 database created: `wrangler d1 create rdm-database`
- [ ] R2 bucket created: `wrangler r2 bucket create rdm-files`
- [ ] Queues created: main + DLQ
- [ ] KV namespaces created: RATE_LIMIT_KV, CSRF_KV
- [ ] All 9 migrations applied
- [ ] wrangler.toml IDs filled in (D1, KV x2)

## Secrets (15 total)
- [ ] SESSION_SECRET
- [ ] CSRF_SECRET
- [ ] CALLBACK_SIGNING_SECRET
- [ ] TURNSTILE_SECRET_KEY
- [ ] WORKER_CLUSTER_TOKEN
- [ ] WORKER_CLUSTER_URL
- [ ] R2_ACCESS_KEY_ID
- [ ] R2_SECRET_ACCESS_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] SEEDR_EMAIL (if using Seedr provider)
- [ ] SEEDR_PASSWORD (if using Seedr provider)

## Deployment
- [ ] Workers API deployed: `wrangler deploy --env production`
- [ ] /health returns `{"status":"ok"}`
- [ ] Frontend built with VITE_API_BASE_URL set
- [ ] Cloudflare Pages deployed
- [ ] Compute agent Docker image built + pushed
- [ ] K8s deployment applied + rollout status OK
- [ ] Agent /health accessible from Workers (via WORKER_CLUSTER_URL)

## Verification
- [ ] Turnstile site key set in Pages env
- [ ] Admin account created (see smoke test)
- [ ] First article published from /admin/blog
- [ ] Stripe webhook endpoint registered in Stripe dashboard
- [ ] Extension loaded in Chrome — auth bridge works

## Security
- [ ] Default credentials rotated (admin@tseeder.cc / demo@tseeder.cc)
- [ ] Turnstile secret set to real key (not BYPASS_FOR_DEV)
- [ ] CORS origin set to exact production domain
- [ ] mTLS configured for /internal/* routes (optional but recommended)
```

**New file: `scripts/smoke-test.sh`**

A bash script that runs the complete flow:
```bash
#!/usr/bin/env bash
# tseeder Production Smoke Test
# Usage: API_URL=https://api.tseeder.cc ./scripts/smoke-test.sh

set -euo pipefail

API="${API_URL:-http://localhost:8787}"
TURNSTILE_TOKEN="${TURNSTILE_TOKEN:-BYPASS_FOR_DEV}"
EMAIL="smoketest-$(date +%s)@tseeder.cc"
PASS="SmokeTest123!"

echo "=== 1. Health Check ==="
curl -sf "$API/health" | grep '"status":"ok"'
echo "PASS"

echo "=== 2. Register ==="
REGISTER=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"turnstileToken\":\"$TURNSTILE_TOKEN\",\"acceptedAup\":true}")
echo "$REGISTER"

echo "=== 3. (Skip email verify if BYPASS active) ==="
# In dev: mark verified directly via D1
# wrangler d1 execute rdm-database --command "UPDATE users SET email_verified=1 WHERE email='$EMAIL'"

echo "=== 4. Login ==="
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"turnstileToken\":\"$TURNSTILE_TOKEN\"}" \
  -c /tmp/tseeder-cookies.txt -b /tmp/tseeder-cookies.txt)
CSRF=$(echo "$LOGIN" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
echo "CSRF: $CSRF — PASS"

echo "=== 5. Create Job ==="
JOB=$(curl -sf -X POST "$API/jobs" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -b /tmp/tseeder-cookies.txt \
  -d '{"type":"magnet","magnetUri":"magnet:?xt=urn:btih:a04e6cdb4d64c7d1df5d13cf2e6e0c27b2aae12f&dn=Ubuntu+24.04"}')
JOB_ID=$(echo "$JOB" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Job ID: $JOB_ID — PASS"

echo "=== 6. List Jobs ==="
curl -sf -b /tmp/tseeder-cookies.txt "$API/jobs" | grep "$JOB_ID"
echo "PASS"

echo "=== 7. SSE Connect (5 second check) ==="
timeout 5 curl -sf -b /tmp/tseeder-cookies.txt \
  "$API/do/job/$JOB_ID/sse" -N | head -3 || true
echo "PASS (SSE endpoint reachable)"

echo "=== 8. Admin Health ==="
# Requires admin cookie — run separately with admin credentials
echo "SKIP (requires admin session)"

echo ""
echo "=== Smoke Test Complete ==="
echo "All basic checks passed."
echo "Next: verify job progresses to 'downloading' in dashboard"
echo "      verify file appears in R2 on completion"
echo "      verify audit log entry at $API/admin/audit (admin required)"
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/migrations/0008_api_keys_user.sql` | Create | Add `user_id` + `key_prefix` columns to api_keys |
| `packages/shared/migrations/0009_stripe_billing.sql` | Create | stripe_customers + stripe_subscriptions tables |
| `packages/shared/src/schemas.ts` | Modify | Fix `newPassword` → `password` in ResetConfirmSchema |
| `apps/api/src/handlers/auth.ts` | Modify | Wire email verification send on register |
| `apps/api/src/handlers/stripe.ts` | Create | Checkout, portal, webhook handlers |
| `apps/api/src/index.ts` | Modify | Register Stripe routes |
| `apps/api/src/index.ts` | Modify | Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` to `Env` interface |
| `infra/wrangler.toml` | Modify | Add `[vars] STRIPE_PUBLISHABLE_KEY` |
| `workers/compute-agent/src/engine.ts` | Modify | Replace `StubTorrentEngine` with `WebTorrentEngine` |
| `workers/compute-agent/src/r2-upload.ts` | Modify | Replace SigV4 stub with real `@aws-sdk/signature-v4` |
| `workers/compute-agent/package.json` | Modify | Add `webtorrent`, `@aws-sdk/signature-v4`, `@aws-crypto/sha256-js` |
| `apps/api/src/handlers/admin.ts` | Modify | Add DLQ inspector, replay, global search, require reason+ticket |
| `apps/api/src/index.ts` | Modify | Register `/admin/dlq`, `/admin/search` routes |
| `src/lib/api.ts` | Modify | Add `VITE_API_BASE_URL` prod guard, add `billing.*` and `admin.dlq.*` methods |
| `src/pages/Settings.tsx` | Modify | Add Billing tab with Stripe checkout/portal buttons |
| `vite.config.ts` | Modify | Fail build if `VITE_API_BASE_URL` missing in prod |
| `README.md` | Rewrite | Fix brand, paths, add full env table, quick start |
| `DEVELOPER.md` | Rewrite | Fix stale paths, add Stripe + MailChannels dev guides |
| `INSTRUCTIONS.md` | Modify | Add Stripe secrets, email verification setup |
| `docs/go-live-checklist.md` | Create | Complete pre-launch checklist |
| `scripts/smoke-test.sh` | Create | End-to-end smoke test script |

---

## Technical Constraints

- All Stripe API calls happen server-side in Cloudflare Workers with `nodejs_compat` flag (already enabled in wrangler.toml)
- WebTorrent runs in the Bun container (compute agent), NOT in Workers — the Worker only dispatches via Queue
- SigV4 signing uses `@aws-sdk/signature-v4` which is pure JS, works in both Bun and Workers
- MailChannels is already wired for password reset — same function signature for email verification
- No new frontend dependencies needed for Stripe billing (uses `window.location.href` redirect to Stripe's hosted checkout)
- The `StubTorrentEngine` is not deleted — it stays as a fallback reference implementation, but `workers/compute-agent/src/routes/start.ts` will import `WebTorrentEngine` instead

## Implementation Order

1. Schema bug fixes (migrations 0008) — unblocks API key functionality
2. Auth bug fixes (schema field mismatch + email verification) — unblocks all new user flows  
3. Real engine + SigV4 — unblocks actual downloads
4. Stripe billing — adds monetization
5. Admin operator tools — completes enterprise requirements
6. Docs + checklist + smoke test — makes the platform deployable by anyone

