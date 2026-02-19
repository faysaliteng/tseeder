# TorrentFlow — Enterprise Remote Download Manager

A production-grade remote torrent/magnet-link download manager built on the **Cloudflare-first stack** (Pages · Workers · Durable Objects · Queues · R2 · D1).

---

## Architecture at a Glance

```
Browser (React/Vite)       ← Cloudflare Pages
    ↕  REST + SSE
Workers API (Hono)         ← Cloudflare Workers
    ↕                 ↕           ↕             ↕
   D1 (SQL)   Durable Objects  Queues       R2 Storage
                 (SSE fanout)  (dispatch)   (files)
                                   ↕
                         Compute Agent Cluster
                         (Node/Bun containers)
                                   ↕
                              R2 multipart upload
```

Full architecture spec: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Repository Layout

```
/apps/api              Cloudflare Workers API gateway (Hono)
/packages/shared       Zod schemas, TypeScript types, D1 migrations
/infra                 wrangler.toml, environment config
/workers/compute-agent External torrent-engine skeleton (Node/Bun)
/src                   React frontend (Vite + Tailwind + shadcn/ui)
/docs                  Architecture, runbooks, threat model
```

---

## Frontend Routes

| Route | Description |
|---|---|
| `/` | Redirects to `/app/dashboard` |
| `/auth/login` | User login (email + password + Turnstile) |
| `/auth/register` | User registration |
| `/auth/reset` | Password reset request |
| `/app/dashboard` | Main file manager / download list |
| `/app/dashboard/:jobId` | Job detail with realtime progress + file browser |
| `/app/settings` | Account, storage, API keys, danger zone |
| `/admin/login` | Admin-only login gate |
| `/admin/overview` | System health overview |
| `/admin/users` | User management (RBAC) |
| `/admin/users/:id` | User detail with audit timeline |
| `/admin/jobs` | Global job operations |
| `/admin/workers` | Compute agent fleet status |
| `/admin/storage` | R2 storage and blocklist |
| `/admin/security` | Security events and feature flags |
| `/admin/audit` | Immutable audit log |
| `/admin/settings` | Feature flags and operational controls |

---

## Environment Variables

### Frontend (Vite)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the Workers API | `""` (same origin) |

### Workers API

All set via `wrangler secret put` — see [`INSTRUCTIONS.md`](INSTRUCTIONS.md) for the full list.

---

## Local Development

```bash
# Install dependencies
npm install

# Start the frontend dev server (Vite)
npm run dev
# → http://localhost:5173
```

Point `VITE_API_BASE_URL` to your deployed or locally-running Workers API.

### Running the Workers API locally

```bash
cd apps/api
npm install
npx wrangler dev --env local
# → http://localhost:8787
```

---

## Production Deployment

Full step-by-step: [`INSTRUCTIONS.md`](INSTRUCTIONS.md)

Quick summary:
1. Create D1, R2, Queues, KV namespaces via `wrangler`
2. Set all secrets via `wrangler secret put`
3. Run D1 migrations: `packages/shared/migrations/*.sql`
4. Deploy Workers API: `npx wrangler deploy --env production`
5. Build + deploy frontend to Cloudflare Pages
6. Deploy compute agent containers (Docker/K8s)

---

## Security

- RBAC: `user`, `support`, `admin`, `superadmin`
- CSRF token on every mutating request
- HttpOnly secure session cookies
- Cloudflare Turnstile bot protection on auth
- Immutable audit log for all admin actions
- Infohash blocklist with auto-termination
- Rate limiting via KV

See [`docs/threat-model.md`](docs/threat-model.md) for full threat analysis.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui |
| State | TanStack Query (server state) · React hooks (local) |
| Realtime | Server-Sent Events via Durable Objects |
| API | Cloudflare Workers · Hono · Zod |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Queue | Cloudflare Queues |
| Realtime state | Cloudflare Durable Objects |
| Compute | Node.js/Bun containers (K8s or VMs) |
