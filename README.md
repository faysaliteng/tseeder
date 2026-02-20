# tseeder — Remote Download Manager

A production-grade remote torrent/magnet-link download manager built on the **Cloudflare-first stack** (Pages · Workers · Durable Objects · Queues · R2 · D1).

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
                      Compute Agent (DigitalOcean VM)
                      Node.js 20 + WebTorrent
                                ↕
                         Local disk → API proxy → User
```

Full spec: [`docs/architecture.md`](docs/architecture.md)

---

## Repository Layout

```
apps/api/              Cloudflare Workers API gateway
  src/handlers/        auth, jobs, files, admin, stripe, providers, articles
  src/index.ts         Route registration + Env interface
packages/shared/
  migrations/          D1 SQL migrations (0001–0012)
  src/schemas.ts       Zod schemas for every API shape
infra/
  wrangler.toml        Cloudflare deployment config
workers/compute-agent/ External torrent engine (Node.js 20 + WebTorrent)
src/                   React frontend (Vite + Tailwind + shadcn/ui)
docs/                  Architecture, runbooks, threat model
scripts/               smoke-test.sh
public/extension/      Chrome Extension (Manifest v3)
```

---

## Quick Start

See [`WORKING-INSTRUCTIONS.md`](WORKING-INSTRUCTIONS.md) for the complete, tested deployment guide.

### Deploy Backend

```powershell
cd apps/api
npx wrangler deploy src/index.ts --config ..\..\infra\wrangler.toml --env production
```

### Deploy Frontend

Push to GitHub — auto-deploys via Cloudflare Pages.

### Update VM Agent

```bash
cd /tmp && rm -rf tseeder-repo && git clone https://github.com/faysaliteng/tseeder.git tseeder-repo
sudo cp /tmp/tseeder-repo/workers/compute-agent/src/index.ts /opt/tseeder-agent/src/index.ts
sudo cp -r /tmp/tseeder-repo/workers/compute-agent/src/routes/ /opt/tseeder-agent/src/routes/
sudo systemctl restart tseeder-agent
```

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

See [`docs/threat-model.md`](docs/threat-model.md).

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui |
| State | TanStack Query · React hooks |
| Realtime | Server-Sent Events via Durable Objects |
| API | Cloudflare Workers · Custom router · Zod |
| Database | Cloudflare D1 (SQLite) — 12 migrations |
| Storage | Cloudflare R2 (S3-compatible) |
| Queue | Cloudflare Queues + DLQ |
| Compute | Node.js 20 · WebTorrent · DigitalOcean VM |
| Connectivity | Cloudflare Tunnel (agent-tunnel.fseeder.cc) |

---

## Documentation

| Document | Description |
|---|---|
| [`WORKING-INSTRUCTIONS.md`](WORKING-INSTRUCTIONS.md) | **Complete tested deployment guide** — start here |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | High-level architecture overview |
| [`docs/architecture.md`](docs/architecture.md) | Detailed component diagrams and data flows |
| [`DEVELOPER.md`](DEVELOPER.md) | Developer guide — local setup, adding routes, migrations |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Deployment runbook |
| [`OBSERVABILITY.md`](OBSERVABILITY.md) | Metrics, alerts, SLOs |
| [`docs/threat-model.md`](docs/threat-model.md) | Security threat model |
| [`docs/runbooks.md`](docs/runbooks.md) | Incident response runbooks |
