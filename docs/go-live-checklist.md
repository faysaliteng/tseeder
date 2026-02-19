# tseeder Go-Live Checklist

Complete this checklist before accepting real traffic. Check every item — no shortcuts.

---

## Phase 1 — Infrastructure Provisioning

```bash
# Create all Cloudflare resources
wrangler d1 create rdm-database
wrangler r2 bucket create rdm-files
wrangler queues create rdm-job-queue
wrangler queues create rdm-job-dlq
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "CSRF_KV"
```

- [ ] D1 database created — ID pasted into `infra/wrangler.toml`
- [ ] R2 bucket created (`rdm-files`)
- [ ] Queues created: `rdm-job-queue` + `rdm-job-dlq`
- [ ] KV namespace IDs pasted into `infra/wrangler.toml` (RATE_LIMIT_KV, CSRF_KV)
- [ ] Cloudflare Turnstile site created — Site Key + Secret Key noted

---

## Phase 2 — Secrets (`wrangler secret put <NAME> --env production`)

```bash
wrangler secret put SESSION_SECRET --env production          # openssl rand -hex 32
wrangler secret put CSRF_SECRET --env production             # openssl rand -hex 32
wrangler secret put CALLBACK_SIGNING_SECRET --env production # openssl rand -hex 32
wrangler secret put TURNSTILE_SECRET_KEY --env production    # from Turnstile dashboard
wrangler secret put WORKER_CLUSTER_TOKEN --env production    # openssl rand -hex 32
wrangler secret put WORKER_CLUSTER_URL --env production      # https://agent.example.com
wrangler secret put R2_ACCESS_KEY_ID --env production        # from R2 API token
wrangler secret put R2_SECRET_ACCESS_KEY --env production    # from R2 API token
wrangler secret put STRIPE_SECRET_KEY --env production       # sk_live_...
wrangler secret put STRIPE_WEBHOOK_SECRET --env production   # whsec_...
wrangler secret put STRIPE_PRICE_IDS --env production        # {"pro":"price_xxx","business":"price_yyy"}
```

- [ ] `SESSION_SECRET` set (64-char hex)
- [ ] `CSRF_SECRET` set (64-char hex)
- [ ] `CALLBACK_SIGNING_SECRET` set — **also added to compute agent K8s secret**
- [ ] `TURNSTILE_SECRET_KEY` set
- [ ] `WORKER_CLUSTER_TOKEN` set — **also added to compute agent K8s secret**
- [ ] `WORKER_CLUSTER_URL` set (points to compute agent cluster)
- [ ] `R2_ACCESS_KEY_ID` set
- [ ] `R2_SECRET_ACCESS_KEY` set
- [ ] `STRIPE_SECRET_KEY` set
- [ ] `STRIPE_WEBHOOK_SECRET` set
- [ ] `STRIPE_PRICE_IDS` set (JSON map of plan → Stripe price ID)
- [ ] `SEEDR_EMAIL` + `SEEDR_PASSWORD` set (only if using Seedr provider)

---

## Phase 3 — wrangler.toml Configuration

Edit `infra/wrangler.toml`:

- [ ] `APP_DOMAIN` = your real frontend domain
- [ ] `STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
- [ ] D1 `database_id` filled in
- [ ] Both KV namespace `id` fields filled in
- [ ] R2 `bucket_name` = `rdm-files`

---

## Phase 4 — D1 Migrations (all 9)

```bash
for f in packages/shared/migrations/*.sql; do
  echo "Applying: $f"
  npx wrangler d1 execute rdm-database --env production --file "$f"
done

# Verify table count
npx wrangler d1 execute rdm-database --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected tables: `api_keys`, `audit_logs`, `blocklist`, `config_changes`,
`email_verification_tokens`, `feature_flags`, `files`, `job_events`, `jobs`,
`password_reset_tokens`, `plans`, `security_events`, `sessions`,
`storage_snapshots`, `stripe_customers`, `stripe_subscriptions`,
`usage_metrics_daily`, `user_plan_assignments`, `users`,
`worker_heartbeats`, `worker_registry`

- [ ] All 9 migrations applied without errors
- [ ] `plans` table contains free/pro/business/enterprise rows
- [ ] `feature_flags` table populated

---

## Phase 5 — Workers API Deployment

```bash
cd apps/api
npm install
npx wrangler deploy --env production

# Health check
curl https://api.tseeder.cc/health
# Expected: {"status":"ok","ts":"..."}
```

- [ ] `wrangler deploy` succeeds without errors
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] `GET /plans` returns plan list (no auth required)
- [ ] CORS headers present (`Access-Control-Allow-Origin`)

---

## Phase 6 — Frontend Deployment (Cloudflare Pages)

```bash
# Set VITE_API_BASE_URL in Cloudflare Pages env (not in code)
# Dashboard → Pages → tseeder → Settings → Environment variables
#   VITE_API_BASE_URL = https://api.tseeder.cc
#   VITE_TURNSTILE_SITE_KEY = 0x4AAAA...

npm run build
npx wrangler pages deploy dist --project-name tseeder --branch main
```

- [ ] `VITE_API_BASE_URL` set in Pages environment variables (Production)
- [ ] `VITE_TURNSTILE_SITE_KEY` set in Pages environment variables
- [ ] Build succeeds without errors
- [ ] Pages deployment succeeds
- [ ] Landing page loads at `https://tseeder.cc`
- [ ] Login page renders Turnstile widget

---

## Phase 7 — Compute Agent Deployment

```bash
cd workers/compute-agent
bun install   # installs webtorrent and deps

docker build -t tseeder-agent:latest .
docker tag tseeder-agent:latest registry.example.com/tseeder-agent:latest
docker push registry.example.com/tseeder-agent:latest

kubectl create secret generic tseeder-agent-secrets \
  --from-literal=WORKER_CLUSTER_TOKEN="<token>" \
  --from-literal=CALLBACK_SIGNING_SECRET="<secret>" \
  --from-literal=R2_ACCESS_KEY_ID="<key>" \
  --from-literal=R2_SECRET_ACCESS_KEY="<secret>"

kubectl apply -f infra/k8s/compute-agent.yaml
kubectl rollout status deployment/tseeder-agent
```

- [ ] Docker image built with `webtorrent` dependency installed
- [ ] K8s deployment rollout successful
- [ ] Agent `/agent/health` reachable from Workers API
- [ ] Agent heartbeat appearing in `/admin/workers`

---

## Phase 8 — Stripe Configuration

- [ ] Stripe webhook endpoint registered: `https://api.tseeder.cc/billing/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.created`,
    `customer.subscription.updated`, `customer.subscription.deleted`,
    `invoice.payment_failed`
- [ ] Stripe products + prices created for Pro and Business plans
- [ ] Price IDs stored in `STRIPE_PRICE_IDS` secret
- [ ] Test checkout flow works with Stripe test mode

---

## Phase 9 — Email (MailChannels)

- [ ] MailChannels SPF/DKIM records added to DNS for your domain
- [ ] Password reset email sends and link works
- [ ] Email verification email sends on registration
- [ ] `noreply@tseeder.cc` is deliverable (check spam folder)

---

## Phase 10 — Security Hardening

- [ ] Default test accounts (`admin@tseeder.cc`, `demo@tseeder.cc`) **passwords rotated**
- [ ] `TURNSTILE_SECRET_KEY` is the real production key (not `BYPASS_FOR_DEV`)
- [ ] CORS `Access-Control-Allow-Origin` restricted to exact production domain
- [ ] `APP_DOMAIN` is the real production domain (used in email links)
- [ ] R2 bucket is **not** publicly readable (no public access policy)
- [ ] Rate limiting KV is production (not local)

---

## Phase 11 — End-to-End Smoke Test

```bash
API_URL=https://api.tseeder.cc \
TURNSTILE_TOKEN=<real_token> \
./scripts/smoke-test.sh
```

- [ ] All smoke test checks pass
- [ ] Job progresses from `submitted` → `downloading` in dashboard
- [ ] Completed file appears in R2 bucket
- [ ] Signed download URL works (expires correctly)
- [ ] Audit log entry visible at `/admin/audit`

---

## Phase 12 — Monitoring

- [ ] `wrangler tail` configured for error alerting
- [ ] Cloudflare Analytics enabled on Workers
- [ ] Uptime check on `https://api.tseeder.cc/health` (e.g. BetterUptime, UptimeRobot)
- [ ] Alert on DLQ depth (`/admin/dlq` shows 0 failed jobs)

---

## ✅ Launch

When all items are checked, tseeder is production-ready.

Post-launch:
1. Monitor `/admin/overview` for system health
2. Watch `/admin/audit` for unexpected activity
3. Set up regular storage cleanup via `/admin/storage/cleanup` (dry-run first)
4. Review `/admin/security-events` weekly
