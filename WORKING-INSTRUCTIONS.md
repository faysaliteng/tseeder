# tseeder — Working Deployment Instructions

## Cloudflare × DigitalOcean — Tested & Verified

> **Last verified:** February 2026  
> **Status:** ✅ Fully working — torrents downloading, progress streaming, R2 uploads confirmed.

This document covers the **exact steps** used to deploy tseeder from zero to a working production environment. Every command is copy-paste ready. Every gotcha we hit is documented.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Cloudflare Setup](#3-cloudflare-setup)
4. [DigitalOcean VM Setup](#4-digitalocean-vm-setup)
5. [Connecting Agent to API](#5-connecting-agent-to-api)
6. [Turnstile Removal](#6-turnstile-removal)
7. [Everyday Operations](#7-everyday-operations)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                           │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Pages       │  │  Workers    │  │  D1      │  │  R2       │ │
│  │  (Frontend)  │  │  (API)      │  │  (SQLite)│  │  (Storage)│ │
│  │  fseeder.cc  │  │  api.       │  │          │  │           │ │
│  │              │  │  fseeder.cc │  │          │  │           │ │
│  └─────────────┘  └──────┬──────┘  └──────────┘  └───────────┘ │
│                          │                                       │
│  ┌───────────────┐  ┌────┴────────┐                              │
│  │ Durable       │  │  Queues     │                              │
│  │ Objects (SSE) │  │  (Job DLQ)  │                              │
│  └───────────────┘  └─────────────┘                              │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS (Bearer token + HMAC callbacks)
                               ▼
                ┌──────────────────────────────┐
                │   DigitalOcean Droplet       │
                │   Ubuntu 24.04               │
                │                              │
                │   Node.js 20 + tsx            │
                │   WebTorrent (node-datachannel)│
                │   systemd service             │
                │   Port 8787                   │
                └──────────────────────────────┘
```

| Component | Technology | Location |
|---|---|---|
| Frontend | React + Vite + Tailwind | Cloudflare Pages (`fseeder.cc`) |
| Backend API | Hono on Cloudflare Workers | `api.fseeder.cc` |
| Database | Cloudflare D1 (SQLite) | Edge |
| File Storage | Cloudflare R2 (S3-compatible) | Edge |
| Job Queues | Cloudflare Queues + DLQ | Edge |
| Real-time SSE | Durable Objects | Edge |
| Compute Agent | Node.js 20 + WebTorrent | DigitalOcean VM |

---

## 2. Prerequisites

### Development Machine (Windows 11)

- VS Code with Wrangler extension
- PowerShell 7+
- Node.js 20+ and npm
- Git

### Cloudflare

- Cloudflare account on **Workers Paid plan** (required for Durable Objects, Queues)
- Domain registered and DNS managed by Cloudflare
- Wrangler CLI v3+: `npm install -g wrangler`
- Authenticated: `wrangler login`

### DigitalOcean

- Droplet running **Ubuntu 24.04** (minimum 1 vCPU / 2 GB RAM)
- SSH access as root
- Firewall: **port 8787 open** for Cloudflare callbacks

---

## 3. Cloudflare Setup

### Step 1: Login to Wrangler

```powershell
wrangler login
```

### Step 2: Create D1 Database

```powershell
cd apps/api
wrangler d1 create rdm-database
```

Copy the returned `database_id` (e.g., `94e5cda1-5065-4f5b-9f3e-5b1394c2aafd`).

### Step 3: Create R2 Bucket

```powershell
wrangler r2 bucket create rdm-files
```

### Step 4: Create Queues

```powershell
wrangler queues create rdm-job-queue
wrangler queues create rdm-job-dlq
```

### Step 5: Create KV Namespaces

```powershell
wrangler kv:namespace create RATE_LIMIT_KV
wrangler kv:namespace create CSRF_KV
```

Copy the returned `id` values for each.

### Step 6: Edit `infra/wrangler.toml`

Update the `[env.production]` section with your real IDs:

```toml
# Production D1
[[env.production.d1_databases]]
binding = "DB"
database_name = "rdm-database"
database_id = "YOUR_ACTUAL_D1_DATABASE_ID"
migrations_dir = "../../packages/shared/migrations"

# Production KV
[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_ACTUAL_RATE_LIMIT_KV_ID"

[[env.production.kv_namespaces]]
binding = "CSRF_KV"
id = "YOUR_ACTUAL_CSRF_KV_ID"
```

Also set the `APP_DOMAIN` in the production vars:

```toml
[env.production]
name = "rdm-api"
vars = { ENVIRONMENT = "production", APP_DOMAIN = "https://fseeder.cc", API_DOMAIN = "https://api.fseeder.cc", R2_BUCKET_NAME = "rdm-files", MAX_UPLOAD_BYTES = "5368709120" }

routes = [
  { pattern = "api.fseeder.cc/*", zone_name = "fseeder.cc" }
]
```

### Step 7: Run D1 Migrations

```powershell
cd apps/api
npx wrangler d1 migrations apply rdm-database --env production --remote
```

This runs all 12 migration files from `packages/shared/migrations/`.

### Step 8: Generate and Set All Secrets

Generate secrets (PowerShell):

```powershell
# Generate three 32-byte hex secrets
openssl rand -hex 32  # → SESSION_SECRET
openssl rand -hex 32  # → CSRF_SECRET
openssl rand -hex 32  # → CALLBACK_SIGNING_SECRET
openssl rand -hex 32  # → WORKER_CLUSTER_TOKEN
```

Set each secret on the Worker:

```powershell
cd apps/api
wrangler secret put SESSION_SECRET --env production
wrangler secret put CSRF_SECRET --env production
wrangler secret put CALLBACK_SIGNING_SECRET --env production
wrangler secret put WORKER_CLUSTER_TOKEN --env production
```

R2 credentials (get from Cloudflare Dashboard → R2 → Manage R2 API Tokens):

```powershell
wrangler secret put R2_ACCESS_KEY_ID --env production
wrangler secret put R2_SECRET_ACCESS_KEY --env production
wrangler secret put R2_ENDPOINT --env production        # https://<ACCOUNT_ID>.r2.cloudflarestorage.com
wrangler secret put R2_ACCOUNT_ID --env production       # Your Cloudflare account ID
```

Compute agent URL (set after VM is ready — see Step 5):

```powershell
wrangler secret put WORKER_CLUSTER_URL --env production  # http://YOUR_VM_IP:8787
```

> ⚠️ **IMPORTANT:** After setting/changing any secret, you **must redeploy** the Worker for it to take effect.

### Step 9: Deploy Backend Worker

```powershell
cd apps/api
npx wrangler deploy --env production
```

### Step 10: Deploy Frontend to Cloudflare Pages

**Option A: GitHub Auto-Deploy (recommended)**

1. Go to Cloudflare Dashboard → Pages → Create a project
2. Connect your GitHub repo
3. Build settings:
   - Build command: `npm install && npm run build`
   - Output directory: `dist`
   - Root directory: (leave empty — project root)
4. Set environment variable: `VITE_API_BASE_URL` = `https://api.fseeder.cc`

**Option B: Manual CLI Deploy**

```powershell
npm run build
npx wrangler pages deploy dist --project-name fseeder
```

### Step 11: DNS Records

In Cloudflare DNS dashboard for `fseeder.cc`:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `fseeder.pages.dev` | ☁️ Proxied |
| CNAME | `api` | `rdm-api.your-subdomain.workers.dev` | ☁️ Proxied |

> The `api` CNAME is automatically handled when you set `routes` in `wrangler.toml`.

---

## 4. DigitalOcean VM Setup

This is the section that required the most debugging. Follow these steps exactly.

### Step 1: SSH into the Droplet

```bash
ssh root@YOUR_VM_IP
```

### Step 2: Install System Dependencies

```bash
apt update && apt upgrade -y
apt install -y curl git ca-certificates build-essential cmake python3
```

> **`build-essential`, `cmake`, `python3`** are required to build `node-datachannel` from source.

### Step 3: Install Node.js 20

> ⚠️ **DO NOT USE BUN.** The `node-datachannel` native module requires full `libuv` support (specifically `uv_timer_init`). Bun does not provide this and **will crash** with a panic. Node.js 20 is the tested, working runtime.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version   # Should show v20.x.x
npm --version
```

### Step 4: Create Service User and Directories

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin tseeder-agent
mkdir -p /opt/tseeder-agent
mkdir -p /var/lib/tseeder-agent/downloads
chown -R tseeder-agent:tseeder-agent /var/lib/tseeder-agent
```

### Step 5: Copy Agent Source Files

From your local machine, upload the compute-agent code:

```powershell
# From project root on your local machine
scp -r workers/compute-agent/src root@YOUR_VM_IP:/opt/tseeder-agent/
scp workers/compute-agent/package.json root@YOUR_VM_IP:/opt/tseeder-agent/
scp workers/compute-agent/tsconfig.json root@YOUR_VM_IP:/opt/tseeder-agent/
```

### Step 6: Install npm Dependencies

```bash
cd /opt/tseeder-agent
npm install
```

Install `node-datachannel` built from source (required for WebRTC):

```bash
npm install node-datachannel --build-from-source
```

> If you get `ENOTEMPTY` errors, manually delete `node_modules/node-datachannel` and any `.node-datachannel-*` temp directories, then retry.

Install `tsx` locally (NOT globally — systemd cannot find globally installed packages):

```bash
npm install tsx
```

Fix ownership:

```bash
chown -R tseeder-agent:tseeder-agent /opt/tseeder-agent
```

### Step 7: Create Environment File

```bash
cat > /etc/tseeder-agent.env << 'EOF'
# ── Agent identity ─────────────────────────────────────────────
WORKER_ID=agent-do-blr1-01
PORT=8787

# ── Cloudflare Worker auth ─────────────────────────────────────
# Must match WORKER_CLUSTER_TOKEN in Cloudflare Worker secrets
WORKER_CLUSTER_TOKEN=YOUR_WORKER_CLUSTER_TOKEN_HERE

# Must match CALLBACK_SIGNING_SECRET in Cloudflare Worker secrets
CALLBACK_SIGNING_SECRET=YOUR_CALLBACK_SIGNING_SECRET_HERE

# ── R2 Storage ─────────────────────────────────────────────────
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET=rdm-files
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_KEY

# ── Download settings ──────────────────────────────────────────
DOWNLOAD_DIR=/var/lib/tseeder-agent/downloads
MAX_CONCURRENT_JOBS=10
EOF

chown root:tseeder-agent /etc/tseeder-agent.env
chmod 640 /etc/tseeder-agent.env
```

> ⚠️ **Critical:** `WORKER_CLUSTER_TOKEN` and `CALLBACK_SIGNING_SECRET` must be **identical** to the secrets set on the Cloudflare Worker. If they don't match, the agent will return 403 Forbidden or callbacks will fail with 500.

### Step 8: Install systemd Service

The key difference from the repo's default service file: we use **Node.js with tsx** instead of Bun.

```bash
cat > /etc/systemd/system/tseeder-agent.service << 'EOF'
[Unit]
Description=tseeder Compute Agent
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=120
StartLimitBurst=5

[Service]
Type=simple
User=tseeder-agent
Group=tseeder-agent
WorkingDirectory=/opt/tseeder-agent
EnvironmentFile=/etc/tseeder-agent.env

# ── THE WORKING COMMAND ──────────────────────────────────────────────────────
# Uses Node.js 20 with tsx loader (NOT Bun — Bun crashes with node-datachannel)
# tsx MUST be installed locally in /opt/tseeder-agent (npm install tsx)
ExecStart=/usr/bin/node --import tsx /opt/tseeder-agent/src/index.ts

Restart=on-failure
RestartSec=5s
TimeoutStartSec=30s
TimeoutStopSec=30s

# ── Security hardening ──────────────────────────────────────────────────────
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
AmbientCapabilities=

# IMPORTANT: Both /opt/tseeder-agent (for node_modules) and
# /var/lib/tseeder-agent (for downloads) must be writable
ReadWritePaths=/var/lib/tseeder-agent /opt/tseeder-agent

# ── Resource limits ─────────────────────────────────────────────────────────
LimitNOFILE=65536
LimitNPROC=4096

# ── Logging ─────────────────────────────────────────────────────────────────
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tseeder-agent

[Install]
WantedBy=multi-user.target
EOF
```

### Step 9: Start the Agent

```bash
systemctl daemon-reload
systemctl enable tseeder-agent
systemctl start tseeder-agent
systemctl status tseeder-agent
```

Verify it's running:

```bash
journalctl -u tseeder-agent -f
```

You should see:

```json
{"level":"info","ts":"...","msg":"Compute agent started","port":8787}
```

### Step 10: Open Firewall

```bash
ufw allow 8787/tcp
ufw status
```

> Port 8787 must be open for the Cloudflare Worker to reach the agent for job dispatch and health checks.

---

## 5. Connecting Agent to API

### Step 1: Set WORKER_CLUSTER_URL on Cloudflare

```powershell
cd apps/api
wrangler secret put WORKER_CLUSTER_URL --env production
# Enter: http://YOUR_VM_IP:8787
```

> ⚠️ **No trailing slash.** `http://1.2.3.4:8787` ✅ — `http://1.2.3.4:8787/` ❌

### Step 2: Redeploy the Worker

```powershell
npx wrangler deploy --env production
```

> **Secrets don't take effect until you redeploy.** This is the #1 cause of "why isn't it working after I changed a secret."

### Step 3: Verify

1. Go to the **Admin panel** → **Infrastructure** page
2. The agent should show as **Online** with a green status
3. Alternatively, test from the VM itself:

```bash
curl -H "Authorization: Bearer YOUR_WORKER_CLUSTER_TOKEN" http://localhost:8787/health
```

Expected response:

```json
{"status":"ok","activeJobs":0,"maxConcurrent":10}
```

---

## 6. Turnstile Removal

Cloudflare Turnstile was removed because it caused hostname mismatch errors between the Pages domain and the custom domain. The Turnstile widget would reject verification when the configured hostname didn't match the actual domain serving the frontend.

Files that were modified to remove Turnstile:

- `src/pages/auth/Login.tsx` — removed Turnstile widget and token submission
- `src/pages/auth/Register.tsx` — removed Turnstile widget and token submission
- `apps/api/src/handlers/auth.ts` — removed server-side Turnstile verification
- `apps/api/src/middleware.ts` — removed Turnstile middleware checks

If you want to re-enable Turnstile later, add your domain to the Turnstile widget's allowed hostnames in the Cloudflare dashboard.

---

## 7. Everyday Operations

### Redeploy Backend (after code changes)

```powershell
cd apps/api
npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production
```

### Redeploy Frontend

**If using GitHub auto-deploy:** Just push to main.

**Manual deploy:**

```powershell
npm run build
npx wrangler pages deploy dist --project-name fseeder
```

### Change a Cloudflare Secret

```powershell
cd apps/api
wrangler secret put SECRET_NAME --env production
# Then REDEPLOY:
npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production
```

### Check the Database

```powershell
cd apps/api
# List all users
npx wrangler d1 execute rdm-database --env production --remote --command "SELECT id, email, role FROM users"

# List recent jobs
npx wrangler d1 execute rdm-database --env production --remote --command "SELECT id, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 10"
```

### View Worker Logs (live)

```powershell
cd apps/api
npx wrangler tail --env production
```

### Restart Compute Agent

```bash
ssh root@YOUR_VM_IP
sudo systemctl restart tseeder-agent
```

### View Agent Logs

```bash
ssh root@YOUR_VM_IP
sudo journalctl -u tseeder-agent -f          # Live tail
sudo journalctl -u tseeder-agent -n 100      # Last 100 lines
sudo journalctl -u tseeder-agent --since "1 hour ago"
```

### Update Agent Code (from GitHub)

```bash
cd /tmp && rm -rf tseeder-repo && git clone https://github.com/faysaliteng/tseeder.git tseeder-repo
sudo cp /tmp/tseeder-repo/workers/compute-agent/src/index.ts /opt/tseeder-agent/src/index.ts
sudo cp -r /tmp/tseeder-repo/workers/compute-agent/src/routes/ /opt/tseeder-agent/src/routes/
sudo chown -R tseeder-agent:tseeder-agent /opt/tseeder-agent
sudo systemctl restart tseeder-agent
sudo systemctl status tseeder-agent
```

### Change Agent Environment Variables

```bash
sudo nano /etc/tseeder-agent.env
# Edit values, then:
sudo systemctl restart tseeder-agent
```

> ⚠️ When using `tee -a` to append to the env file, be careful not to duplicate keys. Use `nano` for edits.

---

## 8. Troubleshooting

These are real issues encountered during deployment, with their solutions.

### ❌ Agent shows "Unreachable" in Admin > Infrastructure

**Quick diagnostic (run on VM):**

```bash
# 1. Check if agent is running
sudo systemctl status tseeder-agent

# 2. Check recent logs
sudo journalctl -u tseeder-agent -n 50 --no-pager

# 3. Test health endpoint locally
curl -H "Authorization: Bearer $(grep WORKER_CLUSTER_TOKEN /etc/tseeder-agent.env | cut -d= -f2)" http://localhost:8787/health
```

**Causes & Fixes (check in order):**

1. **Agent crashed** — Check logs with `sudo journalctl -u tseeder-agent -n 50 --no-pager`. Fix the error, then:
   ```bash
   sudo systemctl reset-failed tseeder-agent
   sudo systemctl restart tseeder-agent
   ```

2. **Missing module after code update** — If logs show `Cannot find module './routes/cleanup'` or similar:
   ```bash
   ls -la /opt/tseeder-agent/src/routes/   # Check if the file exists
   # If missing, re-copy from GitHub:
   cd /tmp && rm -rf tseeder-repo && git clone https://github.com/faysaliteng/tseeder.git tseeder-repo
   sudo cp -r /tmp/tseeder-repo/workers/compute-agent/src/routes/ /opt/tseeder-agent/src/routes/
   sudo systemctl restart tseeder-agent
   ```

3. **WORKER_CLUSTER_TOKEN mismatch** — The token in `/etc/tseeder-agent.env` must be identical to the one set via `wrangler secret put`. Even a trailing newline will cause 403.

4. **WORKER_CLUSTER_URL has trailing slash** — Set it as `https://agent-tunnel.fseeder.cc` not `https://agent-tunnel.fseeder.cc/`.

5. **CALLBACK_SIGNING_SECRET not set on API** — If this secret is missing from the Worker, progress callbacks from the agent will fail with 500 errors.

6. **Firewall blocking port 8787** — Run `ufw allow 8787/tcp`.

7. **Didn't redeploy after setting secrets** — Secrets only take effect after redeploying the Worker.

---

### ❌ Agent crashed — full recovery procedure

```bash
# Step 1: Check what happened
sudo journalctl -u tseeder-agent -n 100 --no-pager

# Step 2: Reset the failed state
sudo systemctl reset-failed tseeder-agent

# Step 3: Restart
sudo systemctl restart tseeder-agent

# Step 4: Verify it's running
sudo systemctl status tseeder-agent

# Step 5: Watch live logs
sudo journalctl -u tseeder-agent -f
```

If the agent keeps crash-looping (restarts too quickly), systemd will refuse to restart it. Fix:

```bash
sudo systemctl reset-failed tseeder-agent
# Fix the underlying issue in the code, then:
sudo systemctl start tseeder-agent
```

---

### ❌ `Cannot find module` after code update

**Symptom:** Agent crashes immediately with `Error: Cannot find module './routes/cleanup'` or similar.

**Cause:** New source files weren't copied to the VM. The `cp -r` command may not have included new files.

**Fix:**

```bash
# Re-clone and copy ALL agent files
cd /tmp && rm -rf tseeder-repo && git clone https://github.com/faysaliteng/tseeder.git tseeder-repo
sudo cp /tmp/tseeder-repo/workers/compute-agent/src/index.ts /opt/tseeder-agent/src/index.ts
sudo cp -r /tmp/tseeder-repo/workers/compute-agent/src/routes/ /opt/tseeder-agent/src/routes/
sudo chown -R tseeder-agent:tseeder-agent /opt/tseeder-agent
sudo systemctl restart tseeder-agent
sudo systemctl status tseeder-agent
```

---

### ❌ Bun crashes with `uv_timer_init` panic

**Symptom:** Agent immediately crashes with a Bun panic mentioning `uv_timer_init`.

**Cause:** The `node-datachannel` native module (used by WebTorrent for WebRTC) calls `uv_timer_init` from libuv. Bun does not implement this function.

**Fix:** Use Node.js 20 instead of Bun. Update the systemd `ExecStart` line:

```
ExecStart=/usr/bin/node --import tsx /opt/tseeder-agent/src/index.ts
```

---

### ❌ `ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'`

**Symptom:** Node.js can't find the `tsx` package when started by systemd.

**Cause:** `tsx` was installed globally with `npm install -g tsx`, but systemd's restricted `PATH` cannot see globally installed packages.

**Fix:** Install `tsx` locally in the project directory:

```bash
cd /opt/tseeder-agent
npm install tsx
```

---

### ❌ `ENOTEMPTY` when installing `node-datachannel`

**Symptom:** `npm install node-datachannel` fails with `ENOTEMPTY: directory not empty`.

**Fix:** Manually clean up and retry:

```bash
rm -rf node_modules/node-datachannel
rm -rf .node-datachannel-*
npm install node-datachannel --build-from-source
```

---

### ❌ SSE shows "Reconnecting…" instead of "Live"

**Symptom:** The job detail page shows a yellow "Reconnecting…" indicator. Download speed shows 0 B/s.

**Cause:** The SSE proxy in the API Worker was forwarding the full URL path (`/do/job/:id/sse`) to the Durable Object, but the DO only matches `/sse`.

**Fix:** The SSE proxy in `apps/api/src/index.ts` must rewrite the path:

```typescript
router.get("/do/job/:id/sse", [authMiddleware], async (req, env, ctx) => {
  const doId = env.JOB_PROGRESS_DO.idFromName(ctx.params.id);
  const doUrl = new URL(req.url);
  doUrl.pathname = "/sse";
  const doReq = new Request(doUrl.toString(), req);
  return env.JOB_PROGRESS_DO.get(doId).fetch(doReq);
});
```

Redeploy the Worker after fixing.

---

### ❌ Total Size shows "—" for completed jobs

**Symptom:** Completed jobs show "—" for Total Size instead of the actual file size.

**Cause:** The `jobRowToApi()` function hardcodes `bytesTotal: 0` because this field normally comes from SSE (Durable Objects), not D1.

**Fix:** The `handleGetJob` and `handleListJobs` handlers in `apps/api/src/handlers/jobs.ts` must query the `files` table to compute total size for completed jobs:

```sql
SELECT COALESCE(SUM(size_bytes), 0) as total FROM files WHERE job_id = ? AND is_complete = 1
```

---

### ❌ Downloads stuck at 0 B/s (no progress)

**Possible causes:**

1. **SSE not connected** — Check if "Live" indicator is green. If "Reconnecting", see SSE fix above.
2. **Agent not receiving job** — Check agent logs: `sudo journalctl -u tseeder-agent -f`
3. **Torrent has no seeds** — Check peers/seeds count. If 0 peers and 0 seeds, the torrent may be dead.
4. **Cloudflare Tunnel down** — If using a tunnel, check: `sudo systemctl status cloudflared`

---

### ❌ `.env` file has UTF-16 encoding (Windows)

**Symptom:** Secrets don't load correctly, agent gets 403 errors despite correct values.

**Cause:** If you created the env file on Windows (e.g. with PowerShell's `Set-Content`), it may be saved as UTF-16-LE with a BOM.

**Fix:** Create the file directly on the VM with `cat >` or `nano`. Never transfer env files from Windows.

---

### ❌ CORS errors in the browser

**Symptom:** Frontend requests to `api.fseeder.cc` fail with CORS errors.

**Cause:** `APP_DOMAIN` in the Worker's `vars` doesn't match the actual frontend domain.

**Fix:** Ensure `APP_DOMAIN` in `wrangler.toml` `[env.production]` vars matches exactly:

```toml
vars = { ..., APP_DOMAIN = "https://fseeder.cc", ... }
```

Then redeploy.

---

### ❌ Secrets don't take effect after `wrangler secret put`

**Cause:** Cloudflare Workers cache the previous deployment. Setting a secret does NOT automatically deploy.

**Fix:** Always redeploy after changing secrets:

```powershell
cd apps/api
wrangler secret put YOUR_SECRET --env production
npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production
```

---

### ❌ Bash `event not found` when pasting code with `!`

**Symptom:** Pasting TypeScript code containing `!` into bash fails with `-bash: !variable: event not found`.

**Cause:** Bash interprets `!` as history expansion in interactive mode.

**Fix:** Use base64 encoding to create files on the VM:

```bash
# On your local machine, encode the file:
base64 -w0 < path/to/file.ts

# On the VM, decode and write:
echo 'BASE64_STRING_HERE' | base64 -d | sudo tee /opt/tseeder-agent/src/routes/file.ts > /dev/null
```

Or use the GitHub clone method instead (recommended).

---

### ❌ Cloudflare Tunnel not connecting

**Symptom:** Agent shows unreachable even though it's running locally.

**Fix:**

```bash
# Check tunnel status
sudo systemctl status cloudflared

# Restart tunnel
sudo systemctl restart cloudflared

# Check tunnel logs
sudo journalctl -u cloudflared -f

# Verify tunnel works locally
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8787/health
```

---

### ❌ Files not deleted from VM when user deletes job

**Symptom:** VM disk fills up over time. Files remain after job deletion.

**Cause:** The API's `DELETE /jobs/:id` handler wasn't calling the agent's cleanup endpoint.

**Fix:** The API now calls `DELETE /cleanup/:jobId` on the agent during job deletion and retention sweeps. Additionally, the agent auto-purges files older than 2 days on startup and every 6 hours.

If disk is already full, manually clean:

```bash
# Check disk usage
df -h

# See download directory size
du -sh /var/lib/tseeder-agent/downloads/*

# Manually delete old job folders
find /var/lib/tseeder-agent/downloads -maxdepth 1 -type d -mtime +2 -exec rm -rf {} +
```

---

### ❌ `webtorrent` import fails at runtime

**Symptom:** Agent crashes with `Cannot find module 'webtorrent'` or resolution error.

**Fix:** WebTorrent must be loaded asynchronously in `engine.ts`:

```typescript
const WebTorrent = (await import("webtorrent")).default;
```

Not as a top-level `import WebTorrent from "webtorrent"`.

---

## 9. File Cleanup & Retention

### Automatic Cleanup

- **Agent auto-purge:** On startup and every 6 hours, deletes job directories older than 2 days from `DOWNLOAD_DIR`
- **Retention sweeper:** Daily cron at 03:00 UTC deletes files exceeding plan retention window from both R2 and the agent VM
- **User deletion:** When a user deletes a job, the API calls `DELETE /cleanup/:jobId` on the agent

### Manual Disk Cleanup

```bash
# Check disk usage
df -h
du -sh /var/lib/tseeder-agent/downloads

# Delete all job files older than 2 days
find /var/lib/tseeder-agent/downloads -maxdepth 1 -type d -mtime +2 -exec rm -rf {} +

# Nuclear option — delete everything (caution: active downloads will break)
rm -rf /var/lib/tseeder-agent/downloads/*
```

---

## Quick Reference Card

| Action | Command |
|---|---|
| Deploy backend | `cd apps/api && npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production` |
| Deploy frontend | Push to GitHub (auto) or `npx wrangler pages deploy dist` |
| Set a secret | `wrangler secret put NAME --env production` + redeploy |
| Run D1 migration | `npx wrangler d1 migrations apply rdm-database --env production --remote` |
| Query database | `npx wrangler d1 execute rdm-database --env production --remote --command "SQL"` |
| Live Worker logs | `npx wrangler tail --env production` |
| Restart agent | `ssh root@VM && sudo systemctl restart tseeder-agent` |
| Agent logs (live) | `sudo journalctl -u tseeder-agent -f` |
| Agent logs (last 100) | `sudo journalctl -u tseeder-agent -n 100 --no-pager` |
| Agent health | `curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/health` |
| Reset crashed agent | `sudo systemctl reset-failed tseeder-agent && sudo systemctl restart tseeder-agent` |
| Update agent code | See "Update Agent Code (from GitHub)" section above |
| Check disk usage | `df -h && du -sh /var/lib/tseeder-agent/downloads` |
| Manual file cleanup | `find /var/lib/tseeder-agent/downloads -maxdepth 1 -type d -mtime +2 -exec rm -rf {} +` |
| Restart tunnel | `sudo systemctl restart cloudflared` |
| Tunnel logs | `sudo journalctl -u cloudflared -f` |

---

## Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@fseeder.cc` | `Nexload#Admin2025!` |
| Demo User | `demo@fseeder.cc` | `Nexload#Demo2025!` |

---

## Secrets Inventory

All secrets must be synchronized between Cloudflare Worker and the VM agent:

| Secret | Set On | Notes |
|---|---|---|
| `SESSION_SECRET` | Cloudflare only | 64-char hex, `openssl rand -hex 32` |
| `CSRF_SECRET` | Cloudflare only | 64-char hex |
| `CALLBACK_SIGNING_SECRET` | **Both** Cloudflare + VM | Must match exactly |
| `WORKER_CLUSTER_TOKEN` | **Both** Cloudflare + VM | Must match exactly |
| `WORKER_CLUSTER_URL` | Cloudflare only | `https://agent-tunnel.fseeder.cc` (no trailing slash) |
| `R2_ACCESS_KEY_ID` | **Both** Cloudflare + VM | From R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | **Both** Cloudflare + VM | From R2 API Tokens |
| `R2_ENDPOINT` | **Both** Cloudflare + VM | `https://ACCT_ID.r2.cloudflarestorage.com` |
| `R2_ACCOUNT_ID` | Cloudflare only | Your Cloudflare account ID |

---

## 10. ClamAV Virus Scanning

Every downloaded torrent is virus-scanned before being marked as "completed". Infected files are **automatically deleted** and the job is marked as failed.

### VM Setup

```bash
# Install ClamAV
sudo apt install -y clamav

# Update virus definitions (takes 2-3 minutes first time)
sudo freshclam

# Verify it works
clamscan --version
echo "Test" > /tmp/testfile.txt && clamscan /tmp/testfile.txt
```

### How It Works

1. Torrent download completes → agent sends `scan_started` callback
2. `clamscan -r` runs on the job directory (recursive scan)
3. **If clean** → job marked `completed` with `scan_status = "clean"`
4. **If infected** → files deleted from disk, job marked `failed` with error "Virus detected: ..."
5. **If ClamAV not installed** → job completes with `scan_status = "error"` (graceful degradation)

### D1 Migration

Run this migration on your D1 database:

```sql
ALTER TABLE jobs ADD COLUMN scan_status TEXT DEFAULT NULL
  CHECK (scan_status IN ('scanning', 'clean', 'infected', 'error', NULL));
ALTER TABLE jobs ADD COLUMN scan_detail TEXT DEFAULT NULL;
```

### Keeping Definitions Updated

ClamAV needs fresh virus definitions. Set up a cron:

```bash
# Update definitions daily at 3 AM
echo "0 3 * * * /usr/bin/freshclam --quiet" | sudo crontab -
```

### Troubleshooting

| Issue | Fix |
|---|---|
| `clamscan: command not found` | `sudo apt install -y clamav` |
| Scan takes too long (>5 min) | Large downloads — scan times out gracefully, job still completes |
| Old virus definitions | Run `sudo freshclam` manually |
| `freshclam` fails | Check DNS, run `sudo freshclam --debug` |

### Files Changed

| File | Change |
|---|---|
| `workers/compute-agent/src/virus-scan.ts` | New — ClamAV scanner module |
| `workers/compute-agent/src/routes/start.ts` | Integrated scan after download completion |
| `apps/api/src/handlers/jobs.ts` | Persists `scan_status` + `scan_detail` from callback |
| `apps/api/src/d1-helpers.ts` | `updateJobStatus` supports scan fields |
| `packages/shared/migrations/0013_scan_status.sql` | Adds scan columns to jobs table |
| `src/pages/JobDetail.tsx` | Shows virus scan badge (✅ Virus-free / ⚠️ Threat detected) |
| `src/pages/Dashboard.tsx` | Shows shield icon on completed jobs |
