# Real Deployment Guide — What We Actually Did (Start to Finish)

> **This is the actual working procedure** we followed to deploy tseeder from a fresh GitHub download to a fully live production app. Updated every time we make changes.
>
> **Environment**: Windows 11 + VS Code + PowerShell
> **Domain**: fseeder.cc (Cloudflare)
> **Last updated**: 2026-02-20

---

## Step 1 — Download & Open Project

```powershell
# Downloaded the repo from GitHub (ZIP or git clone)
# Extracted to: C:\Users\saimo\Downloads\tseeder\tseeder-main\tseeder-main
# Opened folder in VS Code
```

Open VS Code terminal: **Ctrl + `**

```powershell
npm install
```

---

## Step 2 — Login to Cloudflare

```powershell
npx wrangler login
```

Browser opens → click **Allow** → done.

---

## Step 3 — Create Cloud Resources

Run each command one by one and **save the IDs** printed:

```powershell
# Database
npx wrangler d1 create rdm-database

# Storage bucket
npx wrangler r2 bucket create rdm-files

# Job queues
npx wrangler queues create rdm-job-queue
npx wrangler queues create rdm-job-dlq

# KV namespaces
npx wrangler kv:namespace create RATE_LIMIT_KV
npx wrangler kv:namespace create CSRF_KV
```

Save these 3 IDs:
- D1 database ID
- RATE_LIMIT_KV ID
- CSRF_KV ID

---

## Step 4 — Edit wrangler.toml

Open `infra/wrangler.toml` and replace:

| Find | Replace with |
|------|-------------|
| `REPLACE_WITH_YOUR_D1_ID` | Your D1 database ID |
| `REPLACE_WITH_YOUR_KV_ID` | Your RATE_LIMIT_KV ID |
| `REPLACE_WITH_YOUR_CSRF_KV_ID` | Your CSRF_KV ID |

Update domains in `[env.production]`:
```toml
vars = { ENVIRONMENT = "production", APP_DOMAIN = "https://fseeder.cc", API_DOMAIN = "https://api.fseeder.cc", R2_BUCKET_NAME = "rdm-files", MAX_UPLOAD_BYTES = "5368709120" }

routes = [
  { pattern = "api.fseeder.cc/*", zone_name = "fseeder.cc" }
]
```

Also update the production D1 database_id in `[[env.production.d1_databases]]`.

---

## Step 5 — Run Database Migrations

```powershell
cd apps/api
npx wrangler d1 migrations apply rdm-database --config ../../infra/wrangler.toml --remote
```

You'll see migrations 0001 through 0012 applied. Go back:

```powershell
cd ../..
```

---

## Step 6 — Set Secrets

### Generate random hex keys (PowerShell):

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

Run 4 times, save each output.

### Set each secret:

```powershell
cd apps/api

npx wrangler secret put SESSION_SECRET --config ../../infra/wrangler.toml
npx wrangler secret put CSRF_SECRET --config ../../infra/wrangler.toml
npx wrangler secret put CALLBACK_SIGNING_SECRET --config ../../infra/wrangler.toml
npx wrangler secret put WORKER_CLUSTER_TOKEN --config ../../infra/wrangler.toml
```

### R2 API Keys:

1. Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
2. Give **Object Read & Write** on `rdm-files` bucket

```powershell
npx wrangler secret put R2_ACCESS_KEY_ID --config ../../infra/wrangler.toml
npx wrangler secret put R2_SECRET_ACCESS_KEY --config ../../infra/wrangler.toml
npx wrangler secret put R2_ENDPOINT --config ../../infra/wrangler.toml
# Value: https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

npx wrangler secret put R2_ACCOUNT_ID --config ../../infra/wrangler.toml
# Value: your Cloudflare account ID
```

### Compute Agent URL:

```powershell
npx wrangler secret put WORKER_CLUSTER_URL --config ../../infra/wrangler.toml
# Value: http://YOUR_VM_IP:8787
```

Go back:
```powershell
cd ../..
```

---

## Step 7 — Deploy Backend

```powershell
cd apps/api
npx wrangler deploy src/index.ts --config ../../infra/wrangler.toml --env production
cd ../..
```

Verify:
```powershell
curl https://api.fseeder.cc/health
```

Expected: `{"status":"ok",...}`

---

## Step 8 — Deploy Frontend (Cloudflare Pages)

### Create .env.production (IMPORTANT: UTF-8 encoding on Windows!)

**Do NOT use `echo` in PowerShell** — it creates UTF-16 files that break Vite.

```powershell
[System.IO.File]::WriteAllText("$PWD\.env.production", "VITE_API_BASE_URL=https://api.fseeder.cc`n", [System.Text.UTF8Encoding]::new($false))
```

### Build and deploy:

```powershell
npm run build
npx wrangler pages deploy dist --project-name fseeder
```

First time it asks to create the project → type **Y**.

### Alternative: Connect GitHub for auto-deploy

1. Cloudflare Dashboard → Pages → Create Project → Connect to Git
2. Select your repo
3. Build settings:
   - Build command: `npm install && npm run build`
   - Output directory: `dist`
4. Environment variables:
   - `VITE_API_BASE_URL` = `https://api.fseeder.cc`
   - `NODE_VERSION` = `18`

---

## Step 9 — DNS Setup

Cloudflare Dashboard → fseeder.cc → DNS → Add records:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `rdm-api.YOUR-SUBDOMAIN.workers.dev` | ☁️ Proxied |
| CNAME | `@` | `fseeder.pages.dev` | ☁️ Proxied |

> **What we actually did**: `api.fseeder.cc` was set as a CNAME pointing to the Pages deployment (e.g., `3cd4feb3.fseeder.pages.dev`), proxied through Cloudflare.

---

## Step 10 — Compute Agent (DigitalOcean / Oracle Cloud VM)

### VM Requirements:
- Ubuntu 24.04
- Bun runtime at `/usr/local/bin/bun` (chmod 755)

### Install:

```bash
# SSH into your VM
ssh root@YOUR_VM_IP

# Install Bun
curl -fsSL https://bun.sh/install | bash
sudo cp ~/.bun/bin/bun /usr/local/bin/bun
sudo chmod 755 /usr/local/bin/bun

# Create agent directory
sudo mkdir -p /opt/tseeder-agent/src

# Copy all files from workers/compute-agent/src/ to /opt/tseeder-agent/src/
# Copy workers/compute-agent/package.json to /opt/tseeder-agent/

# Install dependencies
cd /opt/tseeder-agent
bun install
```

### Configure environment:

```bash
sudo nano /etc/tseeder-agent.env
```

Contents:
```env
PORT=8787
WORKER_ID=agent-1
DOWNLOAD_DIR=/tmp/rdm-downloads
MAX_CONCURRENT_JOBS=5
CALLBACK_SIGNING_SECRET=<same as Workers secret from Step 6>
WORKER_CLUSTER_TOKEN=<same as Workers secret from Step 6>
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your R2 key>
R2_SECRET_ACCESS_KEY=<your R2 secret>
R2_BUCKET=rdm-files
CLOUDFLARE_CALLBACK_URL=https://api.fseeder.cc
```

### Set up systemd service:

```bash
sudo cp /opt/tseeder-agent/tseeder-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tseeder-agent
sudo systemctl start tseeder-agent

# Check status
sudo systemctl status tseeder-agent
sudo journalctl -u tseeder-agent -f
```

### Update WORKER_CLUSTER_URL secret with real VM IP:

```powershell
# Back on your Windows machine
cd apps/api
npx wrangler secret put WORKER_CLUSTER_URL --config ../../infra/wrangler.toml
# Value: http://YOUR_VM_IP:8787
```

---

## Turnstile — REMOVED

We removed Cloudflare Turnstile completely because of persistent `AUTH_TURNSTILE_FAILED` errors caused by hostname mismatches between the Turnstile site key and the deployment domain.

### Files changed to remove Turnstile:

1. **`packages/shared/src/schemas.ts`** — Removed `turnstileToken` from `RegisterRequestSchema` and `LoginRequestSchema`
2. **`apps/api/src/handlers/auth.ts`** — Deleted `verifyTurnstile()` function, removed verification calls from `handleRegister` and `handleLogin`
3. **`src/lib/api.ts`** — Removed `turnstileToken` from login/register API calls
4. **`src/pages/auth/Login.tsx`** — Removed dev-bypass token
5. **`src/pages/auth/Register.tsx`** — Removed dev-bypass token
6. **`src/pages/admin/AdminLogin.tsx`** — Removed dev-bypass token

After editing the backend files locally, redeploy:

```powershell
cd apps/api
npx wrangler deploy src/index.ts --config ../../infra/wrangler.toml --env production
cd ../..
```

---

## Everyday Commands (Windows PowerShell)

| I want to... | Command |
|--------------|---------|
| Redeploy backend | `cd apps/api; npx wrangler deploy src/index.ts --config ../../infra/wrangler.toml --env production` |
| Redeploy frontend | `npm run build; npx wrangler pages deploy dist --project-name fseeder` |
| View live logs | `cd apps/api; npx wrangler tail --config ../../infra/wrangler.toml --env production` |
| Change a secret | `cd apps/api; npx wrangler secret put SECRET_NAME --config ../../infra/wrangler.toml` |
| Check DB | `cd apps/api; npx wrangler d1 execute rdm-database --config ../../infra/wrangler.toml --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` |

---

## Common Problems We Hit

| Problem | Solution |
|---------|----------|
| `AUTH_TURNSTILE_FAILED` on login/register | Removed Turnstile entirely (see above) |
| `.env.production` not working on Windows | PowerShell `echo` creates UTF-16 — use `[System.IO.File]::WriteAllText()` instead |
| CORS errors | `APP_DOMAIN` in wrangler.toml must exactly match frontend URL |
| Bindings missing in production | Must redefine all bindings under `[env.production]` block |
| Compute agent won't start | Check `/usr/local/bin/bun` exists with 755 permissions |

---

## Architecture Summary

```
Frontend  →  Cloudflare Pages    →  fseeder.cc
Backend   →  Cloudflare Workers  →  api.fseeder.cc
Database  →  Cloudflare D1
Storage   →  Cloudflare R2
Queues    →  Cloudflare Queues
Downloads →  VM (tseeder-agent on port 8787)
```
