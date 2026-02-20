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
npx wrangler deploy --env production
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
npx wrangler deploy --env production
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

### Update Agent Code

```powershell
# From your local machine
scp -r workers/compute-agent/src root@YOUR_VM_IP:/opt/tseeder-agent/
scp workers/compute-agent/package.json root@YOUR_VM_IP:/opt/tseeder-agent/
```

```bash
# On the VM
cd /opt/tseeder-agent
npm install
chown -R tseeder-agent:tseeder-agent /opt/tseeder-agent
systemctl restart tseeder-agent
journalctl -u tseeder-agent -f
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

### ❌ `.env` file has UTF-16 encoding (Windows)

**Symptom:** Secrets don't load correctly, agent gets 403 errors despite correct values.

**Cause:** If you created the env file on Windows (e.g. with PowerShell's `Set-Content`), it may be saved as UTF-16-LE with a BOM. Linux reads the BOM bytes as part of the first variable name.

**Fix:** On Windows, use `WriteAllText` to force UTF-8:

```powershell
[System.IO.File]::WriteAllText("path\to\.env", $content, [System.Text.UTF8Encoding]::new($false))
```

Or just create the file directly on the VM with `cat >` or `nano`.

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

### ❌ Agent shows "Unreachable" in Admin > Infrastructure

**Causes & Fixes (check in order):**

1. **WORKER_CLUSTER_TOKEN mismatch** — The token in `/etc/tseeder-agent.env` must be identical to the one set via `wrangler secret put`. Even a trailing newline will cause 403.

2. **WORKER_CLUSTER_URL has trailing slash** — Set it as `http://IP:8787` not `http://IP:8787/`.

3. **CALLBACK_SIGNING_SECRET not set on API** — If this secret is missing from the Worker, progress callbacks from the agent will fail with 500 errors.

4. **Firewall blocking port 8787** — Run `ufw allow 8787/tcp`.

5. **Didn't redeploy after setting secrets** — Secrets only take effect after `npx wrangler deploy --env production`.

---

### ❌ Secrets don't take effect after `wrangler secret put`

**Cause:** Cloudflare Workers cache the previous deployment. Setting a secret does NOT automatically deploy.

**Fix:** Always redeploy after changing secrets:

```powershell
cd apps/api
wrangler secret put YOUR_SECRET --env production
npx wrangler deploy --env production
```

---

## Quick Reference Card

| Action | Command |
|---|---|
| Deploy backend | `cd apps/api && npx wrangler deploy --env production` |
| Deploy frontend | Push to GitHub (auto) or `npx wrangler pages deploy dist` |
| Set a secret | `wrangler secret put NAME --env production` + redeploy |
| Run D1 migration | `npx wrangler d1 migrations apply rdm-database --env production --remote` |
| Query database | `npx wrangler d1 execute rdm-database --env production --remote --command "SQL"` |
| Live Worker logs | `npx wrangler tail --env production` |
| Restart agent | `ssh root@VM && systemctl restart tseeder-agent` |
| Agent logs | `journalctl -u tseeder-agent -f` |
| Agent health | `curl -H "Authorization: Bearer $TOKEN" http://VM_IP:8787/health` |

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
| `WORKER_CLUSTER_URL` | Cloudflare only | `http://VM_IP:8787` (no trailing slash) |
| `R2_ACCESS_KEY_ID` | **Both** Cloudflare + VM | From R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | **Both** Cloudflare + VM | From R2 API Tokens |
| `R2_ENDPOINT` | **Both** Cloudflare + VM | `https://ACCT_ID.r2.cloudflarestorage.com` |
| `R2_ACCOUNT_ID` | Cloudflare only | Your Cloudflare account ID |
