# Deployment Runbook

## Prerequisites

- Cloudflare account with Workers Paid plan (for Durable Objects)
- Wrangler CLI v3+ installed: `npm install -g wrangler`
- Authenticated: `wrangler login`
- Bun or Node 20+ for compute-agent

---

## Environment Variables (Wrangler Secrets)

Set each with: `wrangler secret put <NAME> --env production`

| Secret | Description |
|---|---|
| `SESSION_SECRET` | 32-byte random hex — HMAC key for session tokens |
| `CSRF_SECRET` | 32-byte random hex — CSRF token signing |
| `CALLBACK_SIGNING_SECRET` | Shared secret between Workers API and compute agents |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret from dashboard |
| `WORKER_CLUSTER_URL` | Base URL of your compute agent orchestrator |
| `WORKER_CLUSTER_TOKEN` | Bearer token for authenticating to agent API |
| `R2_ACCOUNT_ID` | Cloudflare account ID for R2 |
| `R2_ACCESS_KEY_ID` | R2 access key (from Cloudflare dashboard) |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |

---

## Wrangler.toml Variables (non-secret)

```toml
[vars]
ENVIRONMENT = "production"
APP_DOMAIN = "https://your-app.pages.dev"
R2_BUCKET_NAME = "rdm-files"
MAX_UPLOAD_SIZE_BYTES = "5368709120"  # 5 GB
TURNSTILE_SITE_KEY = "0x4AAAAA..."    # public key, safe in config
```

---

## Step-by-Step Deploy

### 1. Create D1 Database

```bash
wrangler d1 create rdm-database
# Copy the database_id into infra/wrangler.toml [d1_databases] binding
```

### 2. Run D1 Migrations

```bash
wrangler d1 migrations apply rdm-database --env production
# Migrations live in packages/shared/migrations/
```

### 3. Create R2 Bucket

```bash
wrangler r2 bucket create rdm-files
```

### 4. Create Cloudflare Queue

```bash
wrangler queues create rdm-job-queue
wrangler queues create rdm-job-dlq   # dead-letter queue
```

### 5. Deploy the Workers API

```bash
cd apps/api
wrangler deploy --env production
```

### 6. Deploy the Frontend (Cloudflare Pages)

```bash
cd apps/web
npm run build
wrangler pages deploy dist --project-name rdm-frontend
```

### 7. Deploy the Compute Agent

```bash
cd workers/compute-agent
# Build Docker image
docker build -t rdm-compute-agent:latest .

# Push to your container registry
docker tag rdm-compute-agent:latest <registry>/rdm-compute-agent:latest
docker push <registry>/rdm-compute-agent:latest

# Deploy to your cluster (Kubernetes, Fly.io, etc.)
# Set environment variables:
#   CLOUDFLARE_CALLBACK_URL = https://your-worker.your-subdomain.workers.dev
#   CALLBACK_SIGNING_SECRET  = <same as Workers secret>
#   R2_ENDPOINT              = https://<account-id>.r2.cloudflarestorage.com
#   R2_ACCESS_KEY_ID         = <from Cloudflare>
#   R2_SECRET_ACCESS_KEY     = <from Cloudflare>
#   R2_BUCKET                = rdm-files
```

### 8. Configure mTLS (recommended for production)

1. Generate CA + client certificate pair for each agent instance
2. Upload CA cert to Cloudflare (Zero Trust → Access → Service Auth → mTLS)
3. Configure your Cloudflare hostname policy to require mTLS for `/internal/*` routes
4. Mount client cert + key in each compute-agent container

---

## D1 Migration Commands

```bash
# Apply all pending migrations
wrangler d1 migrations apply rdm-database

# Create a new migration file
wrangler d1 migrations create rdm-database "add_blocklist_table"

# List migrations
wrangler d1 migrations list rdm-database

# Execute ad-hoc query (dev)
wrangler d1 execute rdm-database --command "SELECT * FROM jobs LIMIT 10"
```

---

## DNS & Routing

```
your-app.com          → Cloudflare Pages (frontend)
api.your-app.com      → Cloudflare Workers (apps/api)
agent.internal.com    → Compute agent cluster (private network / Cloudflare Tunnel)
```

---

## Rollback

```bash
# Workers: list deployments and roll back
wrangler deployments list
wrangler rollback <deployment-id>

# D1: rollback migration (write a down migration manually)
wrangler d1 migrations apply rdm-database --rollback
```

---

## Health Checks

```bash
# Workers API
curl https://api.your-app.com/health

# Compute agent
curl https://agent.internal.com/health

# Queue depth (via Cloudflare dashboard or API)
curl -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/queues/$QUEUE_ID"
```
