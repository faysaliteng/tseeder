# Architecture — tseeder

## Overview

A production-grade, multi-tenant remote download manager using Cloudflare as the
primary control plane and an external compute cluster for heavy torrent work.
No third-party BaaS. All state lives in D1 (relational) and Durable Objects (ephemeral/realtime).

---

## Repository Layout

```
/apps/web              → React + Vite frontend (Cloudflare Pages)
/apps/api              → Cloudflare Workers API gateway + Durable Objects
/packages/shared       → Zod schemas, TypeScript types, D1 migrations (shared by all)
/infra                 → wrangler.toml, KV namespaces, rate-limit configs
/workers/compute-agent → External torrent worker service (Node/Bun, containerised)
ARCHITECTURE.md        → This file
DEPLOYMENT.md          → Deployment runbook
OBSERVABILITY.md       → Metrics, alerts, SLOs, runbooks
```

---

## Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│  React SPA (Cloudflare Pages)                               │
│  • Auth, Dashboard, File Browser, Admin                     │
└──────────────┬──────────────────────────────────────────────┘
               │  HTTPS (REST + SSE)
               ▼
┌─────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKERS — API GATEWAY               │
│  • Auth middleware (session cookie / JWT)                    │
│  • RBAC, CSRF validation, Turnstile verification            │
│  • Rate limiting (WAF rules + Workers KV counters)          │
│  • Zod input validation on every handler                    │
│  • Audit log writes on every mutation                       │
└──────┬───────────┬──────────────┬──────────────────────────-┘
       │           │              │
       ▼           ▼              ▼
  ┌────────┐  ┌─────────┐  ┌──────────────────┐
  │   D1   │  │  Queue  │  │  Durable Objects  │
  │(SQLite)│  │(Dispatch│  │  JobProgressDO    │
  │        │  │ + retry)│  │  UserSessionDO    │
  └────────┘  └────┬────┘  └──────┬───────────┘
                   │              │ SSE / WS fanout
                   ▼              │ to browser
        ┌──────────────────────┐  │
        │  QUEUE CONSUMER WKR  │  │
        │  Orchestrates agent  │  │
        │  Retry + backoff     │  │
        └──────────┬───────────┘  │
                   │ HTTPS + mTLS │
                   ▼              │
        ┌──────────────────────┐  │
        │  COMPUTE AGENT       │  │
        │  (Container Cluster) │  │
        │  /start /stop        │  │
        │  /status /files      │  │
        │  TorrentEngine iface │  │
        └──────┬───────────────┘  │
               │ Multipart upload │
               ▼                  │
        ┌──────────┐   callback   │
        │  R2      │──────────────┘
        │  Object  │  progress + finalization POSTed
        │  Storage │  to Workers /jobs/callback
        └──────────┘
               │ Signed URLs
               ▼
        ┌──────────────┐
        │  Cloudflare  │
        │  CDN edge    │
        └──────────────┘
               │
               ▼ (download)
        USER BROWSER
```

---

## Data Flow — Add Download (happy path)

1. User pastes magnet link or uploads `.torrent` → POST /jobs
2. Worker validates input (Zod + infohash blocklist check)
3. Worker inserts `jobs` row with `status=submitted`
4. Worker dispatches message to **Cloudflare Queue** (idempotency key = infohash + user_id)
5. Worker initialises **JobProgressDO** for this job_id
6. Response to browser: job object (status=submitted) — appears within ~200ms
7. Queue Consumer picks up message, selects least-loaded compute agent, calls `POST /start`
8. Compute agent begins torrent metadata fetch, POSTs `metadata_ready` event to `/jobs/callback`
9. `/jobs/callback` updates D1 + writes `job_events` + updates Durable Object state
10. Durable Object broadcasts SSE event to all connected browser tabs
11. Metadata appears in UI file tree
12. Agent downloads content to local disk, uploads each file to R2 via presigned multipart
13. Agent POSTs `progress_update` events every 2s → callback → DO → SSE
14. On completion: D1 `status=completed`, R2 signed URL generated on demand

---

## Deduplication / Instant Availability

- On job creation, check D1 for existing `completed` job with same infohash
- If found and within retention window: immediately return file links (zero download cost)
- If found and in-progress: subscribe browser to existing `JobProgressDO`

---

## Durable Object Design

### `JobProgressDO` (one per job)

```typescript
interface ProgressState {
  jobId: string;
  status: JobStatus;
  progressPct: number;
  downloadSpeed: number;   // bytes/s
  uploadSpeed: number;
  eta: number;             // seconds
  peers: number;
  seeds: number;
  bytesDownloaded: number;
  bytesTotal: number;
  lastHeartbeat: number;   // unix ms
  workerId: string | null;
}
```

- Serves SSE at `GET /do/job/:id/sse` — browser EventSource connects here
- Accepts `POST /do/job/:id/update` — only from internal Workers (signed token)
- Heartbeat detection: if `lastHeartbeat` > 30s stale → emit `worker_stale` event, trigger re-queue
- All updates idempotent — uses event sequence numbers

### `UserSessionDO` (one per user)

- Tracks active device sessions
- Used for concurrent session limits on Free plan

---

## Queue & Job Lifecycle

```
submitted
  └──► metadata_fetch   (agent fetches .torrent metadata)
         └──► queued    (waiting for worker slot)
               └──► downloading  (active transfer)
                     └──► uploading  (to R2)
                           └──► completed
                     └──► paused      (user action)
                     └──► failed      (retry eligible)
                           └──► queued  (on retry)
                     └──► cancelled   (terminal)
```

**Retry policy:**
- max_retries: 5
- backoff: exponential, base 15s, cap 10 min
- Dead-letter: after 5 failures → `failed` (permanent), alert fired

---

## Security Controls

| Control | Implementation |
|---|---|
| Authentication | Secure HttpOnly SameSite=Strict session cookie; JWT in Authorization header for DO/SSE |
| CSRF | Custom `X-CSRF-Token` header checked on all state-changing requests |
| Bot mitigation | Cloudflare Turnstile on register/login |
| Rate limiting | Cloudflare WAF rules + KV-based per-user counters |
| Input validation | Zod schemas on every endpoint (shared package) |
| RBAC | Role checked in middleware before every handler |
| Audit logs | Append-only `audit_logs` D1 table; no UPDATE/DELETE |
| Data encryption | R2: AES-256 SSE; D1: encrypted at rest by Cloudflare |
| Secrets | Wrangler secrets; never in code or wrangler.toml plaintext |
| mTLS | Between Queue Consumer and Compute Agent cluster |
| Infohash blocklist | Checked on every job creation before Queue dispatch |
| AUP gate | First-login flow forces AUP acknowledgement stored in `users` |

---

## Plans & Quotas

| Plan | Max Jobs | Storage | Max File | Bandwidth/mo | Retention |
|---|---|---|---|---|---|
| Free | 2 | 5 GB | 500 MB | 50 GB | 7 days |
| Pro | 10 | 50 GB | 5 GB | 500 GB | 30 days |
| Business | 50 | 500 GB | 25 GB | 5 TB | 90 days |
| Enterprise | Unlimited | Custom | Custom | Custom | Custom |

Quota enforcement happens in the Workers API before job creation and on a daily cron cleanup job.

---

## Technology Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend hosting | Cloudflare Pages | Co-located with Workers, global CDN |
| API gateway | Cloudflare Workers | Runs at edge, <1ms cold start |
| Relational DB | Cloudflare D1 | Serverless SQLite, no connection pool issues |
| Realtime fanout | Durable Objects | Single-writer, consistent SSE per job |
| Job queue | Cloudflare Queues | Native retry + DLQ, at-least-once delivery |
| Object storage | Cloudflare R2 | Zero egress cost, S3-compatible |
| Compute | External cluster | Torrent engine needs persistent disk + network |
| Bot protection | Turnstile | CAPTCHA-free, good UX |
