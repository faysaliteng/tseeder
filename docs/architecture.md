# Architecture — TorrentFlow

## System Purpose

TorrentFlow is a multi-tenant remote download manager. Users submit download jobs; the platform fetches content via an external compute cluster, stores results in Cloudflare R2, and delivers files via authenticated signed URLs.

**Key architectural decisions:**
- All user-facing traffic routes through Cloudflare Workers (sub-ms cold start, global PoP)
- Heavy I/O (downloading, disk, upload to R2) is isolated to external compute workers — never runs in Cloudflare
- Per-job Durable Objects provide linearised state + SSE fanout without polling
- D1 (SQLite on Cloudflare) handles all relational state; chosen over external Postgres to avoid connection pooling complexity at the edge

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                              │
│  React SPA (Cloudflare Pages — global CDN)                        │
│  • React Query + typed API client (src/lib/api.ts)                │
│  • EventSource (SSE) for real-time job progress                   │
│  • Accessible, mobile-responsive UI                               │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS (REST + SSE)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                 CLOUDFLARE WORKERS — API GATEWAY                  │
│  Entry: apps/api/src/index.ts                                     │
│  • URLPattern router (src/router.ts)                              │
│  • Auth middleware: session cookie → D1 lookup                    │
│  • RBAC middleware: role >= required                              │
│  • CSRF middleware: X-CSRF-Token header check                     │
│  • Rate limit middleware: KV-backed per-IP + per-user             │
│  • Zod validation: every request body + query + path param       │
│  • Correlation ID: generated at edge, threaded everywhere         │
│  • Structured JSON logging to Cloudflare Logpush                  │
│  • Audit log write on every mutating handler                     │
└──────┬──────────────┬────────────────┬────────────────┬──────────┘
       │              │                │                │
       ▼              ▼                ▼                ▼
  ┌─────────┐  ┌──────────┐  ┌────────────────┐  ┌──────────────┐
  │   D1    │  │ Queues   │  │ Durable Objects│  │     KV       │
  │ SQLite  │  │ rdm-job  │  │ JobProgressDO  │  │ Rate limits  │
  │ (relat.)│  │ -queue   │  │ UserSessionDO  │  │ CSRF tokens  │
  │         │  │ rdm-job  │  │                │  │              │
  │ 13 tbls │  │ -dlq     │  │ SSE fanout     │  │              │
  └─────────┘  └────┬─────┘  └───────┬────────┘  └──────────────┘
                    │                │ SSE stream to browser
                    ▼                │
         ┌────────────────────────┐  │
         │  QUEUE CONSUMER WKR    │  │
         │  (same Worker process) │  │
         │  • Selects agent       │  │
         │  • Sends start payload │  │
         │  • 5 retries + backoff │  │
         │  • Dead-letter queue   │  │
         └──────────┬─────────────┘  │
                    │ HTTPS + HMAC   │
                    ▼                │
         ┌────────────────────────┐  │
         │  COMPUTE AGENT CLUSTER │  │
         │  (Docker / K8s)        │  │
         │                        │  │
         │  DownloadEngine (iface)│  │
         │  ├─ HTTPFetchEngine    │  │
         │  └─ BitTorrentEngine*  │  │
         │     * plug-in          │  │
         │                        │  │
         │  POST /agent/jobs/start│  │
         │  GET  /agent/health    │  │
         │  Heartbeat every 10s   │  │
         └────────────────────────┘  │
                    │                │
         ┌──────────▼──────────┐     │
         │     R2 Bucket       │     │
         │  (multipart upload) │     │
         │  SigV4 signed       │     │
         │  rdm-files/         │     │
         │  └─ {userId}/       │     │
         │     └─ {jobId}/     │     │
         │        └─ {path}    │     │
         └─────────────────────┘     │
                    │                │
         Callback: POST /internal/jobs/:id/progress
                    │
                    └──────────────► DO update → SSE → Browser
```

---

## Job State Machine

```
                    ┌─────────────────────────────────────────────────┐
                    │                  submit()                        │
                    ▼                                                  │
              ┌──────────┐                                            │
              │ submitted │◄──────────────────────────── idempotency  │
              └────┬──────┘                                            │
                   │ Queue Consumer picks up                           │
                   ▼                                                  │
         ┌─────────────────┐                                          │
         │ metadata_fetch  │◄─── agent reports metadata_ready event   │
         └────────┬────────┘                                          │
                  │ agent begins downloading                           │
                  ▼                                                   │
           ┌───────────┐     pause()    ┌────────┐                   │
           │downloading│◄──────────────►│ paused │                   │
           └─────┬─────┘     resume()   └────────┘                   │
                 │ 100% done            cancel()↓                     │
                 ▼                   ┌───────────┐                   │
           ┌──────────┐              │ cancelled │ (terminal)         │
           │ uploading │             └───────────┘                   │
           └─────┬────┘                                              │
                 │ R2 upload done                                    │
                 ▼                                                   │
           ┌───────────┐                                             │
           │ completed │ (terminal) — R2 signed URLs generated       │
           └───────────┘                                             │
                                    ┌────────┐                       │
         error → retry (max 5)      │ failed │ (terminal, ≥5 fails)  │
                 └──────────────────┤        │                       │
                                    └────────┘                       │
                                         │                           │
                                         └───────────────────────────┘
                                           admin can re-queue (manual)
```

### State Transition Rules

| From | To | Who | Conditions |
|---|---|---|---|
| `submitted` | `metadata_fetch` | Queue Consumer | Agent accepted job |
| `metadata_fetch` | `downloading` | Agent callback | Metadata payload received |
| `downloading` | `uploading` | Agent callback | Progress = 100% |
| `uploading` | `completed` | Agent callback | R2 upload confirmed |
| `downloading` | `paused` | User API | Job not in terminal state |
| `paused` | `downloading` | User API | Agent resumes |
| any non-terminal | `cancelled` | User API or Admin | — |
| any non-terminal | `failed` | Queue Consumer | 5 retries exhausted |

---

## Deduplication / Instant Availability

1. On `POST /jobs`, extract `infohash` from magnet URI or `.torrent` parse
2. Check `jobs` table: `SELECT id FROM jobs WHERE infohash = ? AND status = 'completed'`
3. If found within retention window: return existing job ID + file list immediately (no queue dispatch)
4. If found and in-progress: subscribe to existing `JobProgressDO` — client sees live progress

---

## Durable Object Strategy

**One DO per job** (not per user).

**Justification:**
- Progress updates are per-job, not per-user
- SSE streams are per-job
- Avoids fan-out contention — multiple users watching the same dedup'd job connect to one DO
- Per-user DO would still need per-job fan-out, adding one extra hop

**JobProgressDO state:**
```typescript
interface DOState {
  jobId: string;
  status: JobStatus;
  progressPct: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  peers: number;
  seeds: number;
  bytesDownloaded: number;
  bytesTotal: number;
  lastHeartbeat: number;   // ms timestamp
  workerId: string | null;
  lastEventSeq: number;    // monotonic counter, for dedup
}
```

---

## R2 Object Naming

```
rdm-files/
└── {userId}/
    └── {jobId}/
        ├── metadata.json          (job metadata snapshot)
        └── files/
            └── {relativePath}     (preserves torrent directory structure)
```

**Security:**
- Object keys are validated to prevent path traversal (no `..`)
- R2 bucket is **private** — no public access
- Downloads require signed URL generated by Workers API after ownership check

---

## Data Flow: Download Request

```
1.  User → POST /jobs  { magnetUri }
2.  Worker validates magnet URI with Zod
3.  Worker checks blocklist table (infohash)
4.  Worker checks dedup (existing completed job)
5.  Worker checks quota (active jobs, storage)
6.  Worker inserts job row (status = submitted)
7.  Worker initialises JobProgressDO
8.  Worker enqueues message → rdm-job-queue
9.  Worker returns 201 { job }  ← browser shows job card

10. Queue Consumer receives message
11. Queue Consumer calls GET /agent/health → picks least-loaded agent
12. Queue Consumer sends POST /agent/jobs/start
13. Agent starts download engine, responds 202

14. Agent → heartbeat callback every 10s → POST /internal/jobs/:id/progress
15. Worker validates callback HMAC signature + timestamp
16. Worker updates D1 job row + job_events
17. Worker sends update to JobProgressDO via internal fetch
18. JobProgressDO fanouts → all connected SSE clients
19. Browser EventSource fires → React state update → UI refresh

20. Agent completes download → starts R2 multipart upload
21. Agent POSTs final callback (status=completed, files=[...])
22. Worker updates D1: job status=completed, inserts files rows
23. DO broadcasts completion event
24. Browser: job card shows ✓ Completed, file browser populates
```

---

## Security Architecture

See [docs/threat-model.md](docs/threat-model.md) for full threat modelling.

**Defence in depth layers:**
1. Cloudflare WAF + DDoS protection (Cloudflare-managed)
2. Turnstile bot mitigation (register + login)
3. Rate limiting: per-IP (KV counter) + per-user (KV counter) + WAF rules
4. Input validation: Zod on every endpoint
5. Auth: PBKDF2-SHA256 password hashing; HttpOnly+Secure+SameSite=Strict session cookie
6. CSRF: X-CSRF-Token header; cookie-to-header pattern
7. RBAC: role hierarchy enforced in middleware
8. Agent auth: HMAC-SHA256 request signing + 5-minute replay window
9. Signed R2 URLs: time-limited, per-file, no guessable paths
10. Audit logs: append-only, immutable, no UPDATE/DELETE

---

## Quota Enforcement

Quotas checked at `POST /jobs` time:

```sql
-- Active job count
SELECT COUNT(*) FROM jobs
WHERE user_id = ? AND status IN
  ('submitted','metadata_fetch','queued','downloading','uploading','paused')

-- Storage used
SELECT SUM(f.size_bytes) FROM files f
JOIN jobs j ON j.id = f.job_id
WHERE j.user_id = ? AND f.is_complete = 1
```

If quota exceeded → `HTTP 429 { error: { code: "QUOTA_JOBS" | "QUOTA_STORAGE" } }`
