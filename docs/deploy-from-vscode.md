# Deploy tseeder from VS Code — Beginner Guide

> **Time**: ~30 minutes from zero to live.
> **No Docker, no Kubernetes** — just your terminal.

---

## What You Need Before Starting

| Thing | Where to get it |
|-------|----------------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) — download LTS |
| **VS Code** | [code.visualstudio.com](https://code.visualstudio.com) |
| **Cloudflare account** | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) (free plan works) |
| **A domain on Cloudflare** | Add your domain in Cloudflare Dashboard → Websites |

---

## Step 0 — Open Project in VS Code

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

Open terminal: **Ctrl + `** (backtick) or menu → Terminal → New Terminal.

---

## Step 1 — Login to Cloudflare

```bash
npx wrangler login
```

A browser window opens → click **Allow**. Done. ✅

---

## Step 2 — Create All Cloud Resources

Run these **one by one**, and **save the IDs** that get printed:

```bash
# Database (SAVE THE database_id!)
npx wrangler d1 create rdm-database

# Storage bucket
npx wrangler r2 bucket create rdm-files

# Job queues
npx wrangler queues create rdm-job-queue
npx wrangler queues create rdm-job-dlq

# Rate-limit store (SAVE THE id!)
npx wrangler kv:namespace create RATE_LIMIT_KV

# CSRF token store (SAVE THE id!)
npx wrangler kv:namespace create CSRF_KV
```

> 📝 **Write down these 3 IDs** — you need them in the next step:
> - D1 database ID
> - RATE_LIMIT_KV ID
> - CSRF_KV ID

---

## Step 3 — Paste IDs into wrangler.toml

Open `infra/wrangler.toml` in VS Code. Find and replace:

| Find this text | Replace with |
|----------------|-------------|
| `REPLACE_WITH_YOUR_D1_ID` | Your D1 database ID |
| `REPLACE_WITH_YOUR_KV_ID` | Your RATE_LIMIT_KV ID |
| `REPLACE_WITH_YOUR_CSRF_KV_ID` | Your CSRF_KV ID |

Also update `APP_DOMAIN` near the top:
```toml
APP_DOMAIN = "https://yourdomain.com"
```

And in `[env.production]` near the bottom:
```toml
vars = { ENVIRONMENT = "production", APP_DOMAIN = "https://yourdomain.com", API_DOMAIN = "https://api.yourdomain.com", ... }
```

**Save** the file (`Ctrl+S`).

---

## Step 4 — Run Database Migrations

This creates all your tables:

```bash
cd apps/api
npx wrangler d1 migrations apply rdm-database --config ../../infra/wrangler.toml --remote
```

You'll see migrations 0001 through 0012 applied. ✅

Go back to root when done:
```bash
cd ../..
```

---

## Step 5 — Set Secrets

Each secret is entered interactively (it will ask you to type/paste the value).

### First, generate random keys

**Mac/Linux:**
```bash
openssl rand -hex 32
```
Run this 4 times and save each output — you'll use them below.

**Windows (PowerShell):**
```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

### Now set each secret

```bash
cd apps/api

# 🔑 Random hex values (paste a different generated value for each)
npx wrangler secret put SESSION_SECRET --config ../../infra/wrangler.toml
npx wrangler secret put CSRF_SECRET --config ../../infra/wrangler.toml
npx wrangler secret put CALLBACK_SIGNING_SECRET --config ../../infra/wrangler.toml
npx wrangler secret put WORKER_CLUSTER_TOKEN --config ../../infra/wrangler.toml
```

### Turnstile (bot protection)

1. Go to [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click **Add Site** → enter your domain → choose **Managed** → **Create**
3. Copy the **Secret Key**

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY --config ../../infra/wrangler.toml
# Paste the secret key
```

> 📝 Also save the **Site Key** — you'll need it for the frontend (Step 7).

### R2 API Keys (for compute agent uploads)

1. Go to [Cloudflare Dashboard → R2 → Overview](https://dash.cloudflare.com/?to=/:account/r2)
2. Click **Manage R2 API Tokens** → **Create API Token**
3. Give it **Object Read & Write** permission on `rdm-files` bucket
4. Copy the **Access Key ID** and **Secret Access Key**

```bash
npx wrangler secret put R2_ACCESS_KEY_ID --config ../../infra/wrangler.toml
npx wrangler secret put R2_SECRET_ACCESS_KEY --config ../../infra/wrangler.toml
npx wrangler secret put R2_ENDPOINT --config ../../infra/wrangler.toml
# Value: https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

npx wrangler secret put R2_ACCOUNT_ID --config ../../infra/wrangler.toml
# Value: your Cloudflare account ID (visible in dashboard URL)
```

### Compute Agent URL

```bash
npx wrangler secret put WORKER_CLUSTER_URL --config ../../infra/wrangler.toml
# Value: http://YOUR_VM_IP:8787  (your compute agent VM address)
```

> ⏭️ **Don't have a VM yet?** That's OK — set a placeholder like `http://localhost:8787`.
> You can update it later with the same command.

---

## Step 6 — Deploy the Backend 🚀

```bash
# Still in apps/api/
npx wrangler deploy --config ../../infra/wrangler.toml --env production
```

You should see:
```
Published rdm-api
  api.yourdomain.com/*
```

### Verify it works:

```bash
curl https://api.yourdomain.com/health
```

Expected: `{"status":"ok",...}` ✅

---

## Step 7 — Deploy the Frontend

```bash
cd ../..   # back to project root
```

### Set frontend environment variables

Create a `.env.production` file in the project root (this is for build only, not committed):

```bash
echo 'VITE_API_BASE_URL=https://api.yourdomain.com' > .env.production
echo 'VITE_TURNSTILE_SITE_KEY=0x4AAAA...' >> .env.production
```

Replace `0x4AAAA...` with the **Site Key** from Turnstile (Step 5).

### Build and deploy:

```bash
npm run build
npx wrangler pages deploy dist --project-name tseeder
```

First time it asks to create the project → type **Y**.

Visit `https://yourdomain.com` — your site is live! ✅

---

## Step 8 — DNS Setup (One Time)

Go to **Cloudflare Dashboard → your domain → DNS** and add:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `rdm-api.YOUR-SUBDOMAIN.workers.dev` | ☁️ Proxied |
| CNAME | `@` | `tseeder.pages.dev` | ☁️ Proxied |

> 💡 Your Workers subdomain is shown after `wrangler deploy`. It looks like `rdm-api.username.workers.dev`.

---

## Step 9 — Set Up Compute Agent (Your VM)

Follow the [VM Installation Guide](./vm-install.md) to install the download agent.

**Short version:**
```bash
# SSH into your VM, then:
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/workers/compute-agent/install.sh | sudo bash

# Edit the config:
sudo nano /etc/tseeder-agent.env

# Start it:
sudo systemctl start tseeder-agent
```

> The `WORKER_CLUSTER_TOKEN` and `CALLBACK_SIGNING_SECRET` on the VM must match what you set in Step 5.

---

## Step 10 — Security Checklist

- [ ] Change default passwords (`admin@tseeder.cc` / `demo@tseeder.cc`) — see [go-live-checklist.md](./go-live-checklist.md)
- [ ] Verify Turnstile is **not** using `BYPASS_FOR_DEV`
- [ ] R2 bucket has no public access policy
- [ ] Compute agent VM firewall only allows your Cloudflare Worker IP

---

## Everyday Commands

| I want to... | Command |
|--------------|---------|
| Redeploy backend | `cd apps/api && npx wrangler deploy --config ../../infra/wrangler.toml --env production` |
| Redeploy frontend | `npm run build && npx wrangler pages deploy dist --project-name tseeder` |
| View live logs | `cd apps/api && npx wrangler tail --config ../../infra/wrangler.toml --env production` |
| Change a secret | `cd apps/api && npx wrangler secret put SECRET_NAME --config ../../infra/wrangler.toml` |
| Check DB tables | `cd apps/api && npx wrangler d1 execute rdm-database --config ../../infra/wrangler.toml --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` |

---

## Common Problems

| Error | Fix |
|-------|-----|
| `wrangler: command not found` | Run `npm install` at project root |
| `Authentication error` | Run `npx wrangler login` again |
| `no such table: users` | You skipped Step 4 — run migrations |
| `Missing binding DB` | IDs in `wrangler.toml` don't match (Step 3) |
| `500 on any endpoint` | Check all secrets are set (Step 5) — `npx wrangler secret list --config ../../infra/wrangler.toml` |
| CORS errors | `APP_DOMAIN` in wrangler.toml must match your frontend URL exactly |
| `Queue not found` | Run the queue create commands from Step 2 |
| Turnstile always fails | Make sure you used the **Secret Key** (not Site Key) for the secret |

---

## 🎉 You're Live!

```
Frontend  →  Cloudflare Pages   →  yourdomain.com
Backend   →  Cloudflare Workers →  api.yourdomain.com
Database  →  Cloudflare D1
Storage   →  Cloudflare R2
Queues    →  Cloudflare Queues
Downloads →  Your VM (tseeder-agent)
```

No Seedr.cc required — everything runs on your own infra!
