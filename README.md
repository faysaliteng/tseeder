# fseeder — Remote Download Manager

A production-grade remote torrent/magnet-link download manager built on the **Cloudflare-first stack** (Pages · Workers · Durable Objects · Queues · R2 · D1). Self-hosted compute agents handle heavy torrent work on DigitalOcean VMs with multi-region load balancing.

**Live:** [fseeder.cc](https://fseeder.cc) · **API:** [api.fseeder.cc](https://api.fseeder.cc)

---

## Architecture

```
Browser (React/Vite)          ← Cloudflare Pages (fseeder.cc)
    ↕  REST + SSE
Workers API                   ← Cloudflare Workers (api.fseeder.cc)
    ↕           ↕          ↕            ↕
   D1 (SQL)   Durable Obj  Queues     R2 Storage
               (SSE fanout) (dispatch)  (files)
                                ↕
              ┌─────────────────┼─────────────────┐
              ↓                 ↓                 ↓
       Agent BLR1         Agent FRA1         Agent NYC1
       (DigitalOcean)     (DigitalOcean)     (DigitalOcean)
       Node.js 20 +       Node.js 20 +       Node.js 20 +
       WebTorrent          WebTorrent          WebTorrent
              ↓                 ↓                 ↓
         Local disk → API proxy → User download
```

Full spec: [`docs/architecture.md`](docs/architecture.md)

---

## Features

- **Magnet link & .torrent file downloads** — paste a magnet URI or upload a .torrent
- **Real-time progress** — Server-Sent Events via Durable Objects (speed, ETA, peers, seeds)
- **Multi-region compute cluster** — load-balanced across DigitalOcean droplets worldwide
- **Virus scanning** — ClamAV scans every download before marking complete
- **Crypto payments** — BTC, USDT (TRC-20, Solana, Polygon), LTC, BNB checkout with QR codes
- **Stripe billing** — subscription management with checkout + customer portal
- **Browser extension** — Chrome/Firefox extension for one-click magnet link capture
- **FTP/WebDAV mount** — mount your storage as a network drive
- **HD/FHD/4K streaming** — in-browser media player with adaptive quality
- **Organizations** — multi-tenant team workspaces with role-based access
- **Referral system** — invite users and earn rewards
- **Blog/CMS** — built-in article system with admin editor
- **Admin panel** — user management, job control, worker monitoring, DLQ, audit logs, global search
- **Infohash blocklist** — automatic DMCA/AUP enforcement
- **API keys** — programmatic access with scoped permissions

---

## Repository Layout

```
apps/api/                Cloudflare Workers API gateway
  src/handlers/          auth, jobs, files, admin, stripe, crypto, providers, articles, orgs
  src/index.ts           Route registration + Env interface
  src/queue-consumer.ts  Job dispatch with multi-worker load balancing
  src/durable-objects.ts JobProgressDO (SSE) + UserSessionDO
  src/retention-sweeper.ts  Cron: cleanup expired files
  src/uptime-sweeper.ts     Cron: worker health monitoring
  src/seedr-poller.ts       Cron: Seedr.cc provider polling
packages/shared/
  migrations/            D1 SQL migrations (0001–0015)
  src/schemas.ts         Zod schemas for every API shape
  src/enums.ts           JobStatus, UserRole, PlanName, EventType
infra/
  wrangler.toml          Cloudflare deployment config
workers/compute-agent/   External torrent engine (Node.js 20 + WebTorrent)
  src/engine.ts          WebTorrent engine (seeding disabled, 1 B/s upload limit)
  src/virus-scan.ts      ClamAV integration
  src/routes/            start, stop, status, health, download, cleanup
  install.sh             Automated VM installer
  update.sh              GitHub-based code sync + restart
src/                     React frontend (Vite + Tailwind + shadcn/ui)
  pages/                 Landing, Dashboard, JobDetail, Settings, CryptoCheckout, Admin/*
  components/            Sidebar, PricingModal, AddDownloadModal, MediaPlayer, OrgSwitcher
  lib/api.ts             Typed fetch client (50+ endpoints)
  hooks/useSSE.ts        Real-time SSE progress hook
docs/                    Architecture, runbooks, threat model
public/extension/        Chrome/Firefox Extension (Manifest v3)
scripts/                 smoke-test.sh
```

---

## D1 Migrations

| # | File | Description |
|---|---|---|
| 0001 | `initial.sql` | Users, jobs, files, plans, audit_logs, sessions |
| 0002 | `api_keys.sql` | API key authentication |
| 0003 | `admin_extended.sql` | Admin features, infohash blocklist, job events |
| 0004 | `provider_configs.sql` | Multi-provider support (Seedr/Cloudflare) |
| 0005 | `worker_heartbeats.sql` | Worker registry for multi-agent load balancing |
| 0006 | `articles.sql` | Blog/CMS articles |
| 0007 | `article_bodies.sql` | Article content (separated for performance) |
| 0008 | `api_keys_user.sql` | User-scoped API keys with key_prefix |
| 0009 | `stripe_billing.sql` | Stripe customers + subscriptions |
| 0010 | `uptime_history.sql` | Worker uptime tracking |
| 0011 | `observability_metrics.sql` | Platform metrics collection |
| 0012 | `organizations.sql` | Multi-tenant organizations |
| 0013 | `scan_status.sql` | Virus scan status + detail on jobs |
| 0014 | `crypto_payments.sql` | Crypto wallets, orders, prices |
| 0015 | `referrals.sql` | Referral/invite system |

---

## Quick Start

See [`WORKING-INSTRUCTIONS.md`](WORKING-INSTRUCTIONS.md) for the complete, tested deployment guide (including multi-droplet cluster setup).

### Deploy Backend

```powershell
cd apps/api
npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production
```

### Deploy Frontend

Push to GitHub — auto-deploys via Cloudflare Pages.

### Update VM Agent (single node)

```bash
ssh root@YOUR_VM_IP
cd /opt/tseeder-agent && ./update.sh
```

### Update All Agents (multi-node)

```bash
for IP in DROPLET_1_IP DROPLET_2_IP DROPLET_3_IP; do
  ssh root@$IP 'cd /opt/tseeder-agent && ./update.sh'
done
```

---

## Pricing Plans

| Display Name | DB `plan_name` | Monthly | Yearly (2 mo free) | Storage | Parallel Links |
|---|---|---|---|---|---|
| Free | `free` | $0 | — | 5 GB | 1 |
| Basic | `pro` | $4.85 | $48.50 | 50 GB | 2 |
| Pro | `business` | $8.85 | $88.50 | 150 GB | 8 |
| Master | `enterprise` | $15.89 | $158.90 | 1 TB | 25 |

> ⚠️ Frontend display names (Basic/Pro/Master) map to **different** database plan names (pro/business/enterprise).

---

## Security

- RBAC: `user` · `support` · `admin` · `superadmin`
- CSRF token on every mutating request (HMAC-signed, single-use)
- HttpOnly Secure session cookies (30-day TTL)
- PBKDF2-SHA256 password hashing via Web Crypto API
- Immutable audit log for all admin actions
- Infohash blocklist with automatic job termination
- Rate limiting via Cloudflare KV (sliding window)
- Agent auth: Bearer token + HMAC-SHA256 callback signing
- ClamAV virus scanning on every completed download
- Quota enforcement: storage, concurrent jobs, file size limits

See [`docs/threat-model.md`](docs/threat-model.md).

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui |
| State | TanStack Query · React hooks |
| Realtime | Server-Sent Events via Durable Objects |
| API | Cloudflare Workers · Custom router · Zod validation |
| Database | Cloudflare D1 (SQLite) — 15 migrations |
| Storage | Cloudflare R2 (S3-compatible, zero egress) |
| Queue | Cloudflare Queues + DLQ (at-least-once delivery) |
| Compute | Node.js 20 · WebTorrent · DigitalOcean VMs |
| Connectivity | Cloudflare Tunnel (agent-tunnel.fseeder.cc) |
| Payments | Crypto (BTC/USDT/LTC/BNB) + Stripe subscriptions |
| Security | ClamAV virus scanning · HMAC callbacks · KV rate limiting |
| Extension | Chrome Manifest v3 + Firefox WebExtension |
| Package Manager | Bun (monorepo workspace resolution) |

---

## Documentation

| Document | Description |
|---|---|
| [`WORKING-INSTRUCTIONS.md`](WORKING-INSTRUCTIONS.md) | **Complete tested deployment guide** — start here (includes multi-droplet cluster) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | High-level architecture overview |
| [`DEVELOPER.md`](DEVELOPER.md) | Developer guide — local setup, adding routes, migrations, API reference |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Deployment runbook |
| [`OBSERVABILITY.md`](OBSERVABILITY.md) | Metrics, alerts, SLOs |
| [`docs/architecture.md`](docs/architecture.md) | Detailed component diagrams and data flows |
| [`docs/threat-model.md`](docs/threat-model.md) | Security threat model |
| [`docs/runbooks.md`](docs/runbooks.md) | Incident response runbooks |
| [`docs/ops-admin.md`](docs/ops-admin.md) | Operations & admin guide |

---

## Accounts (Development/Staging)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@fseeder.cc` | `Nexload#Admin2025!` |
| Demo User | `demo@fseeder.cc` | `Nexload#Demo2025!` |
