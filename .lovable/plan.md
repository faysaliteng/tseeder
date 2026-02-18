
## Enterprise Remote Download Manager — Full Architecture + Frontend (Seedr-like)

### What we're building
A complete, production-grade remote torrent/magnet download manager using Cloudflare as the control plane. Lovable will produce every layer of the repository that it can own: the frontend, shared TypeScript types & validation, Workers stubs, and written architecture specs — all wired to be deployed with Wrangler by you.

---

### Repository Structure

```
/apps/web              → React frontend (Cloudflare Pages)
/apps/api              → Cloudflare Workers API gateway
/packages/shared       → Zod schemas, TypeScript types, D1 migrations
/infra                 → wrangler.toml, environment configs
/workers/compute-agent → External torrent worker skeleton (Node/Bun)
```

---

### 1. Architecture Blueprint (written spec inside repo)

A `ARCHITECTURE.md` at root describing:

**Data flow:**
- Browser → Cloudflare Pages UI
- UI → Workers API (REST + SSE/WebSocket)
- Workers ↔ D1 (users, jobs, plans, files, audit logs)
- Workers ↔ Durable Objects (per-job state + realtime fanout)
- Workers → Cloudflare Queues (job dispatch)
- Queue Consumer → External Torrent Worker Cluster API
- Torrent Worker → R2 multipart upload
- Torrent Worker → Workers callback endpoint (progress + finalization)
- Download delivery: R2 signed URLs via Cloudflare CDN

---

### 2. Shared Package (`/packages/shared`)

Full TypeScript types and Zod schemas for every entity:

**D1 Schema + migration files:**
- `users` (id, email, password_hash, role, email_verified, created_at)
- `sessions` (id, user_id, token_hash, expires_at, device_info)
- `plans` (id, name, max_jobs, max_storage_gb, max_file_size_mb, bandwidth_gb, retention_days)
- `user_plan_assignments` (user_id, plan_id, started_at, expires_at)
- `jobs` (id, user_id, infohash, name, status, magnet_uri, worker_id, created_at, updated_at, completed_at, error)
- `job_events` (id, job_id, event_type, payload, created_at) — append-only
- `files` (id, job_id, path, size_bytes, mime_type, r2_key, is_complete)
- `usage_metrics_daily` (user_id, date, bytes_downloaded, bytes_uploaded, jobs_count)
- `audit_logs` (id, actor_id, action, target_type, target_id, metadata, created_at)

**Zod schemas for all API request/response shapes**

**Shared enums:** `JobStatus`, `UserRole`, `PlanName`, `EventType`

---

### 3. Workers API Stubs (`/apps/api`)

Cloudflare Worker files with full routing, type-safe handlers, and TODOs where you plug in real logic:

**Auth endpoints:**
- `POST /auth/register` — email + password, Turnstile token required
- `POST /auth/login` — returns secure HttpOnly cookie session
- `POST /auth/logout`
- `POST /auth/reset` — password reset flow
- `POST /auth/verify-email`

**Jobs endpoints:**
- `POST /jobs` — accepts multipart (torrent file) or JSON (magnet link), validates, creates job, dispatches to Queue
- `GET /jobs` — paginated list with filters (status, date)
- `GET /jobs/:id` — full job details + file tree
- `POST /jobs/:id/pause` / `/resume` / `/cancel`
- `POST /jobs/callback` — internal endpoint for worker cluster progress reports (authenticated via signed token)

**Files endpoints:**
- `GET /jobs/:id/files` — directory tree
- `POST /files/:fileId/signed-url` — generate R2 signed download URL
- `DELETE /files/:fileId`

**Usage:**
- `GET /usage` — current plan, storage used, bandwidth, active jobs

**Admin endpoints (RBAC guarded):**
- `GET /admin/users`, `PATCH /admin/users/:id`
- `GET /admin/jobs` — all users' jobs
- `POST /admin/jobs/:id/terminate`
- `GET /admin/system-health`
- `POST /admin/blocklist` — add infohash to blocklist

**Durable Objects stub:**
- `JobProgressDO` — per-job, stores latest progress state, serves SSE stream, heartbeat detection, stale worker eviction
- `UserSessionDO` (optional) — per-user session registry

**Queue consumer stub:**
- Handles job dispatch messages, calls Torrent Worker Orchestrator, handles retries with exponential backoff, dead-letter queue

**`wrangler.toml`** — D1 binding, R2 binding, DO bindings, Queue bindings, env vars list

---

### 4. External Torrent Worker Skeleton (`/workers/compute-agent`)

Node.js/Bun service skeleton:

- `POST /start` — receives job payload, starts torrent engine (abstracted interface)
- `POST /stop` — graceful stop
- `GET /status/:jobId` — current speed, ETA, peers, progress %
- `GET /files/:jobId` — file listing once metadata available
- `GET /health` — capacity reporting
- Upload pipeline: multipart upload to R2 using presigned URLs
- Progress callback to Workers API with idempotency keys
- mTLS / signed Bearer token auth
- Abstract `TorrentEngine` interface so you can plug in any library

---

### 5. Frontend UI — Full Phases 1–3 (`/apps/web`)

**Premium dark SaaS design** (dark navy/slate, indigo/purple accents, clean typography)

**Pages & routes:**
- `/auth/login`, `/auth/register`, `/auth/reset` — auth screens with Turnstile widget placeholder
- `/dashboard` — main view with job cards, "Add Download" button
- `/dashboard/:jobId` — job detail with realtime progress + file browser
- `/admin` — admin panel (role-guarded)

**Components:**

*Add Download flow:*
- Modal with tab toggle: "Magnet Link" vs "Torrent File"
- Magnet input with instant validation (magnet URI format)
- File upload with drag-and-drop, .torrent validation
- Submission triggers optimistic UI — job card appears within ~1s

*Job Dashboard:*
- Job cards with status badge (`Queued`, `Fetching Metadata`, `Downloading`, `Completed`, `Failed`)
- Live progress bar, download speed, ETA, peer count
- Realtime updates via SSE (connected to Durable Object endpoint)
- Pause / Resume / Cancel controls
- Empty state with call to action

*File Browser Panel:*
- Collapsible folder/file tree
- File icons by mime type
- Per-file: Download button (fetches signed URL), file size, completion indicator
- Breadcrumb navigation for deep folders

*Usage & Quota Panel:*
- Storage used / total (visual bar)
- Bandwidth this month
- Active jobs vs limit
- Plan badge + upgrade prompt

*Admin Panel:*
- User table with plan assignment, status, actions
- Job inspection table (all users)
- System health cards (queue depth, worker capacity, error rate)
- Blocklist management

*Global:*
- Sidebar navigation (collapsible on mobile)
- Toast notifications
- Loading skeletons throughout
- Mobile responsive
- WCAG AA basics (focus rings, aria labels, color contrast)

---

### 6. Security Posture (coded into stubs)

- CSRF token validation middleware stub
- Rate limiting headers/config in wrangler.toml
- RBAC middleware (role check on every admin route)
- Input validation via Zod on every endpoint
- Audit log write on every mutating action
- Infohash blocklist check before job creation
- Acceptable Use Policy gate on first login
- Secure cookie flags (HttpOnly, Secure, SameSite=Strict)

---

### 7. Observability Setup

- Structured log format (JSON, correlation ID threaded through every request)
- `OBSERVABILITY.md` with metrics to wire up (job duration, error rate, queue depth, worker capacity)
- Alert thresholds and SLO definitions documented
- Runbooks for: stalled job, worker offline, queue backlog, R2 upload failure

---

### 8. Environment Variables & Deployment

`DEPLOYMENT.md` covering:
- All required env vars (D1 ID, R2 bucket, DO namespace, Queue ID, Worker cluster URL, signing secret, Turnstile key)
- Step-by-step `wrangler deploy` sequence
- D1 migration commands
- How to register compute-agent workers and configure mTLS

---

### Phase Delivery (all in one build)

| Deliverable | Status |
|---|---|
| Repo structure + all config files | ✅ |
| Shared types, Zod schemas, D1 migrations | ✅ |
| Workers API stubs (all endpoints) | ✅ |
| Durable Object + Queue consumer stubs | ✅ |
| Compute agent skeleton | ✅ |
| Frontend — Auth + Dashboard + Add Download | ✅ |
| Frontend — Realtime progress + File browser | ✅ |
| Frontend — Usage panel + Admin panel | ✅ |
| Architecture + Deployment docs | ✅ |

This gives you a fully runnable frontend with mock data, all backend interfaces defined and stubbed, and every config file needed to deploy with Wrangler. You plug in real torrent engine logic in the compute agent and wire up D1/R2 bindings — no Supabase, no Lovable backend dependencies.
