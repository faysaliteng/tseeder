
# Phase 1 Enterprise Completion Plan — tseeder

## Honest Gap Analysis After Full Audit

### What the backend already has (do not reimplement)
- All 6 Phase 1 backend API endpoints are partially or fully real:
  - DLQ: `GET /admin/dlq`, `POST /admin/dlq/:id/replay` — **100% real**
  - Global Search: `GET /admin/search` — **100% real**
  - Config History: `GET /admin/config-history` — **100% real**
  - System Health: `GET /admin/system-health` — **real** (used by Status page)
  - Worker heartbeats in D1: `worker_heartbeats` table — **real**
  - Storage snapshot in D1: `storage_snapshots` table — **real**
- WebTorrentEngine: **real implementation** (engine.ts lines 110-354)
- SigV4: **real implementation** (r2-upload.ts)
- Stripe billing handlers: **real** (handlers/stripe.ts)
- All migrations 0001–0009: **applied**

### What is MISSING — the exact gaps Phase 1 must fill

**Gap A: Uptime history — no D1 table, no snapshot writer, no frontend**
- No `uptime_snapshots` table exists in any migration
- No cron-triggered snapshot writer
- Status page shows real-time health only — no 24h/7d/30d/90d history bars
- No incident markers

**Gap B: Admin UI — DLQ/Search/ConfigHistory pages don't exist**
- Backend endpoints exist and are wired
- No frontend pages/routes for these three features
- `AdminLayout` nav has no links to DLQ, Search, or Config History
- `App.tsx` has no routes for them

**Gap C: Observability Dashboard — no page exists**
- No `/admin/observability` page
- `worker_heartbeats` table has CPU/bandwidth data — not surfaced
- No latency tracking table (needs new backend + migration)
- Admin has no charts for queue depth, error rates, or fleet capacity over time

**Gap D: Multi-Region Failover — worker selection is single-worker**
- `queue-consumer.ts` dispatches to `WORKER_CLUSTER_URL` (single static URL)
- No region-aware routing, no priority, no failover logic
- `worker_registry` has `region` column — unused in dispatch

**Gap E: Retention Sweeper — no scheduled cron**
- Manual cleanup in `handleAdminStorageCleanup` exists and is real
- No automated `scheduled()` cron for retention enforcement per plan
- No per-plan enforcement (`retention_days` column exists but nothing reads it for sweeps)

**Gap F: Organizations / Multi-Tenancy — zero implementation**
- All tables are user-scoped (no org tables exist)
- No migrations for `organizations`, `org_members`, `org_invites`
- No API endpoints for org CRUD, member management, shared quotas
- No frontend for org management
- Billing is user-scoped, not org-scoped

**Gap G: Admin UI notifications are fake**
- `AdminLayout.tsx` lines 35-39: `ALERTS` is a hardcoded constant with fake data
- Notification bell shows "Agent memory usage >85%" regardless of real state

---

## Implementation Plan

### Feature 1: Uptime History (90-Day)

**New migration: `0010_uptime_history.sql`**
```sql
CREATE TABLE IF NOT EXISTS uptime_snapshots (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  date           TEXT NOT NULL,          -- "2026-02-19" (UTC date)
  component      TEXT NOT NULL,          -- "api" | "queue" | "agents"
  is_operational INTEGER NOT NULL DEFAULT 1,
  incident_note  TEXT,
  captured_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, component)
);
CREATE INDEX IF NOT EXISTS idx_uptime_date ON uptime_snapshots(date DESC);
```

**Backend — `apps/api/src/index.ts` scheduled() handler**

Add a new cron expression `"0 * * * *"` (hourly) to `wrangler.toml`. In `scheduled()`, import and call a new `runUptimeSweeper(env)` function.

**New backend function — `apps/api/src/uptime-sweeper.ts`**
```typescript
export async function runUptimeSweeper(env: Env) {
  const today = new Date().toISOString().slice(0, 10);
  
  // Check API health (if we're running, API is operational)
  // Check agent health
  const agentHealth = await fetch(`${env.WORKER_CLUSTER_URL}/agent/health`, ...)
    .then(r => r.ok).catch(() => false);
  
  // Check queue depth (jobs stuck > 10 min = queue incident)
  const queueStuck = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM jobs WHERE status = 'submitted' AND created_at < datetime('now', '-10 minutes')"
  ).first<{ cnt: number }>();
  
  // Upsert today's snapshot (UNIQUE on date+component prevents duplicates)
  await Promise.all([
    env.DB.prepare(`INSERT OR REPLACE INTO uptime_snapshots (date, component, is_operational, incident_note) VALUES (?, 'api', 1, NULL)`).bind(today).run(),
    env.DB.prepare(`INSERT OR REPLACE INTO uptime_snapshots (date, component, is_operational, incident_note) VALUES (?, 'agents', ?, ?)`).bind(today, agentHealth ? 1 : 0, agentHealth ? null : 'Agent unreachable').run(),
    env.DB.prepare(`INSERT OR REPLACE INTO uptime_snapshots (date, component, is_operational, incident_note) VALUES (?, 'queue', ?, ?)`).bind(today, (queueStuck?.cnt ?? 0) > 10 ? 0 : 1, (queueStuck?.cnt ?? 0) > 10 ? `${queueStuck?.cnt} jobs stuck` : null).run(),
  ]);
}
```

**New API endpoint — `GET /status/history`** (public, no auth)

Returns 90 days of snapshots grouped by component + date. Added to `admin.ts` as `handleUptimeHistory` and registered in `index.ts`.

**New frontend API client method — `src/lib/api.ts`**
```typescript
export const statusHistory = {
  get: (days = 90) => request<{ snapshots: UptimeSnapshot[]; components: string[] }>(`/status/history?days=${days}`),
};
```

**Status page update — `src/pages/Status.tsx`**
- Fetch from `/status/history` (public endpoint, no auth required)
- Compute 24h / 7d / 30d / 90d uptime % per component
- Render 90 colored bars for each component (green/red/amber)
- Hover tooltip showing date + incident note
- Replace the static SLA section with real computed numbers

---

### Feature 2: Admin UI — DLQ Replay, Global Search, Config Diff

All three backend endpoints already exist. Need:

**New page: `src/pages/admin/DLQ.tsx`**

A full-page admin UI that:
- Fetches `GET /admin/dlq` (using `adminDlq.list()`)
- Shows a table: Job Name, User, Status, Error (truncated), Created, Last Updated
- Expandable row: full error payload in a dark code block
- "Replay" button per row → opens DangerModal variant requiring:
  - `reason` (≥10 chars)
  - `ticketId` (required)
  - typed confirmation phrase "replay"
- `DangerModal` needs to be updated to accept `ticketId` field (currently only has `reason`)
- On confirm: calls `adminDlq.replay(id, reason, ticketId)`
- Real-time audit confirmation toast

**New page: `src/pages/admin/GlobalSearch.tsx`**

- Full-width search input at the top
- Calls `adminSearch.search(q)` on input with 300ms debounce
- Three result groups rendered as separate cards: Users, Jobs, Audit Logs
- Each result is clickable:
  - User → navigate to `/admin/users/:id`
  - Job → navigate to `/admin/jobs` (with job highlighted)
  - Audit log → navigate to `/admin/audit`
- Empty state with search icon when `q.length < 2`
- Shows `totals.users`, `totals.jobs`, `totals.auditLogs` counts in group headers

**New page: `src/pages/admin/ConfigHistory.tsx`**

- Table of config changes from `adminConfig.history()`
- Columns: Key, Changed By, Old Value, New Value, Reason, Timestamp
- Expandable diff view: shows old_value and new_value side by side
- JSON auto-formatted for values that are valid JSON
- Paginated using existing `Paginator` component
- Filter by key using a dropdown

**`src/App.tsx` updates**
```tsx
import AdminDLQ from "./pages/admin/DLQ";
import AdminGlobalSearch from "./pages/admin/GlobalSearch";
import AdminConfigHistory from "./pages/admin/ConfigHistory";

// Add routes:
<Route path="/admin/dlq" element={<AdminDLQ />} />
<Route path="/admin/search" element={<AdminGlobalSearch />} />
<Route path="/admin/config-history" element={<AdminConfigHistory />} />
```

**`src/components/admin/AdminLayout.tsx` nav updates**
- Add to `NAV` array:
  ```ts
  { to: "/admin/dlq", label: "DLQ Replay", icon: AlertOctagon, color: "text-destructive" },
  { to: "/admin/search", label: "Search", icon: Search, color: "text-info" },
  { to: "/admin/config-history", label: "Config History", icon: History, color: "text-muted-foreground" },
  ```
- Replace hardcoded `ALERTS` with a real query to `adminApi.systemHealth()` to populate alerts

**`src/components/admin/AdminUI.tsx` updates**
- Extend `DangerModal` to accept an optional `ticketIdRequired?: boolean` prop
- When true: add a second input for `ticketId`
- Pass `{ reason, ticketId }` to `onConfirm` callback
- All existing callers still work (backward compatible via optional prop)

---

### Feature 3: Observability Dashboard

**New migration: `0011_observability_metrics.sql`**
```sql
CREATE TABLE IF NOT EXISTS api_metrics (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hour_bucket  TEXT NOT NULL,  -- "2026-02-19T14:00" (hourly)
  endpoint     TEXT NOT NULL,
  method       TEXT NOT NULL,
  status_class TEXT NOT NULL CHECK (status_class IN ('2xx','3xx','4xx','5xx')),
  count        INTEGER NOT NULL DEFAULT 0,
  total_ms     INTEGER NOT NULL DEFAULT 0,  -- sum for avg latency
  p95_ms       INTEGER,
  UNIQUE(hour_bucket, endpoint, method, status_class)
);
CREATE INDEX IF NOT EXISTS idx_api_metrics_hour ON api_metrics(hour_bucket DESC);

CREATE TABLE IF NOT EXISTS queue_depth_snapshots (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  queue_depth INTEGER NOT NULL DEFAULT 0,
  dlq_depth   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_queue_snapshots_time ON queue_depth_snapshots(captured_at DESC);
```

**Backend middleware update — `apps/api/src/middleware.ts`**

Add a thin metrics recorder: after each request, upsert into `api_metrics`:
```typescript
// In the router's after-handler (or wrapped in index.ts fetch):
const hourBucket = new Date().toISOString().slice(0, 13) + ":00";
const statusClass = `${Math.floor(res.status / 100)}xx`;
await env.DB.prepare(`
  INSERT INTO api_metrics (hour_bucket, endpoint, method, status_class, count, total_ms)
  VALUES (?, ?, ?, ?, 1, ?)
  ON CONFLICT(hour_bucket, endpoint, method, status_class)
  DO UPDATE SET count = count + 1, total_ms = total_ms + excluded.total_ms
`).bind(hourBucket, path, method, statusClass, durationMs).run();
```
> Note: this uses `ctx.waitUntil()` so it doesn't block the response.

**Cron update — `uptime-sweeper.ts`** also writes a `queue_depth_snapshots` row hourly.

**New API endpoint — `GET /admin/observability`** (admin RBAC)

Returns:
```json
{
  "apiLatency": { "p50": 45, "p95": 180, "lastHour": [...hourly buckets...] },
  "errorRates": { "4xx": 0.02, "5xx": 0.001, "trend": [...] },
  "queueDepth": { "current": 3, "trend": [...24h hourly snapshots...] },
  "workerFleet": { "total": 3, "healthy": 2, "stale": 1, "totalCapacity": 30, "usedCapacity": 12 },
  "dlqGrowth": { "current": 5, "24hChange": +2 }
}
```

**New API client method — `src/lib/api.ts`**
```typescript
export const adminObservability = {
  get: () => request<ObservabilityData>("/admin/observability"),
};
```

**New page: `src/pages/admin/Observability.tsx`**

Uses recharts (already in dependencies) to render:
- API Latency line chart (p50 + p95 over 24h)
- Error Rate bar chart (4xx/5xx per hour)
- Queue Depth area chart (24h)
- Worker Fleet grid: each worker as a card with capacity bar, last heartbeat, region badge
- DLQ Growth number with trend indicator

Add to `AdminLayout` nav and `App.tsx` routes.

---

### Feature 4: Multi-Region Compute Agent Routing + Failover

**Backend — `apps/api/src/queue-consumer.ts`**

Replace single-URL dispatch with smart worker selection:
```typescript
async function selectWorker(env: Env): Promise<{ url: string; id: string } | null> {
  // Get all healthy workers ordered by: region preference, lowest load, freshest heartbeat
  const workers = await env.DB.prepare(`
    SELECT id, region, active_jobs, max_jobs, last_heartbeat,
           CAST(active_jobs AS REAL) / NULLIF(max_jobs, 0) AS load_factor
    FROM worker_registry
    WHERE status = 'healthy'
      AND last_heartbeat >= datetime('now', '-5 minutes')
      AND (max_jobs = 0 OR active_jobs < max_jobs)
    ORDER BY load_factor ASC, last_heartbeat DESC
    LIMIT 1
  `).first<{ id: string; region: string | null; active_jobs: number; max_jobs: number }>();
  
  if (!workers) return null;
  
  // Build URL: if WORKER_CLUSTER_URL contains {region}, substitute
  const baseUrl = env.WORKER_CLUSTER_URL.replace("{region}", workers.region ?? "default");
  return { url: baseUrl, id: workers.id };
}
```

**If no eligible worker found**: return job to queue with delay (backoff), log to `security_events` as `compute.no_worker_available`.

**Admin visibility**: `/admin/workers` already shows fleet. Add a "Region" column + stale indicator. The existing `handleAdminListWorkers` already computes `is_stale` — just surface it in `Workers.tsx`.

**`Workers.tsx` update**: Add region badge, stale warning row highlight, capacity bar per worker.

---

### Feature 5: Automated Retention Sweeper + Orphan Cleanup

**Backend — `apps/api/src/retention-sweeper.ts`** (new file)
```typescript
export async function runRetentionSweeper(env: Env) {
  // Find files that exceed their plan's retention_days
  const expired = await env.DB.prepare(`
    SELECT f.id, f.r2_key, f.size_bytes, f.job_id, p.retention_days, u.id as user_id
    FROM files f
    JOIN jobs j ON j.id = f.job_id
    JOIN users u ON u.id = j.user_id
    LEFT JOIN user_plan_assignments upa ON upa.user_id = u.id
    LEFT JOIN plans p ON p.id = upa.plan_id
    WHERE p.retention_days > 0
      AND j.status = 'completed'
      AND j.completed_at < datetime('now', '-' || p.retention_days || ' days')
      AND f.is_complete = 1
    LIMIT 500
  `).all<{ id: string; r2_key: string | null; size_bytes: number; job_id: string; retention_days: number; user_id: string }>();
  
  let deleted = 0, bytes = 0;
  for (const f of expired.results) {
    if (f.r2_key) { await env.FILES_BUCKET.delete(f.r2_key).catch(() => {}); }
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(f.id).run();
    deleted++; bytes += f.size_bytes;
  }
  
  // Write audit log if anything was swept
  if (deleted > 0) {
    await writeAuditLog(env.DB, {
      actorId: null, action: "retention.sweep",
      targetType: "storage", targetId: "cron",
      metadata: { deletedFiles: deleted, bytesReclaimed: bytes },
    });
  }
  
  // Snapshot storage metrics
  const stats = await env.DB.prepare(`
    SELECT COUNT(*) as total_files, COALESCE(SUM(size_bytes), 0) as total_bytes FROM files WHERE is_complete = 1
  `).first<{ total_files: number; total_bytes: number }>();
  
  await env.DB.prepare(
    "INSERT INTO storage_snapshots (total_files, total_bytes, orphan_files) VALUES (?, ?, 0)"
  ).bind(stats?.total_files ?? 0, stats?.total_bytes ?? 0).run();
}
```

**`apps/api/src/index.ts` scheduled() handler** — add call to `runRetentionSweeper(env)` alongside existing Seedr poller. The existing cron `"*/2 * * * *"` already runs; add a separate `"0 3 * * *"` (3 AM UTC daily) for retention by adding to `wrangler.toml` crons array.

**Admin Storage page update** — Add a "Retention Sweep" section showing:
- Last sweep timestamp (from latest audit_log with action `retention.sweep`)
- Files swept, bytes reclaimed
- Per-plan retention windows table

---

### Feature 6: Team / Organization Accounts

This is the largest feature. It requires new DB tables, new API endpoints, frontend pages, and migration of existing users.

**New migration: `0012_organizations.sql`**
```sql
CREATE TABLE IF NOT EXISTS organizations (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  plan_id      TEXT REFERENCES plans(id),
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
             CHECK (role IN ('owner', 'admin', 'member')),
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_invites (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email      TEXT NOT NULL COLLATE NOCASE,
  role       TEXT NOT NULL DEFAULT 'member',
  token      TEXT NOT NULL UNIQUE,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+7 days')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON org_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites(email);

-- Migration: wrap all existing users in a personal default org
INSERT OR IGNORE INTO organizations (id, name, slug, created_by)
SELECT 'org_' || id, email || ' (Personal)', lower(hex(randomblob(8))), id
FROM users;

INSERT OR IGNORE INTO org_members (org_id, user_id, role)
SELECT 'org_' || id, id, 'owner'
FROM users;
```

**New API handler: `apps/api/src/handlers/orgs.ts`**

Endpoints:
- `GET /orgs` — list orgs the current user is a member of
- `POST /orgs` — create new org (auto-add creator as owner)
- `GET /orgs/:slug` — org detail (members, plan, usage)
- `PATCH /orgs/:slug` — update org name (owner/admin only)
- `GET /orgs/:slug/members` — list members
- `POST /orgs/:slug/invites` — invite user by email (owner/admin)
- `DELETE /orgs/:slug/members/:userId` — remove member (owner/admin)
- `POST /orgs/accept-invite/:token` — accept org invite

**Middleware addition**: `orgMiddleware` — reads `X-Org-Slug` header to set org context on requests when org-scoped operations are needed.

**Jobs/files scoping**: When a user operates within an org context, jobs are visible to all org members who have the `admin` or `owner` role. Regular members see only their own jobs. This is enforced at the query level in `handleListJobs`.

**Per-org billing**: `stripe_subscriptions` already has `user_id` — add `org_id` column in migration 0012 as nullable. When billing in org context, subscription attaches to org not user.

**Frontend — new pages**:

`src/pages/OrgSettings.tsx` — org management page accessible at `/app/org/:slug/settings`:
- Members table (with role badges, remove button for owner/admin)
- Invite member by email form
- Org plan display
- Danger zone: Delete org

`src/pages/OrgSwitcher.tsx` component — added to `TopHeader.tsx`:
- Dropdown showing personal account + all org memberships
- Selecting an org sets `localStorage: activeOrgSlug`
- All subsequent API calls include `X-Org-Slug: <slug>` header
- The `request()` function in `api.ts` reads this header from localStorage

**Admin visibility**: New admin endpoint `GET /admin/orgs` listing all organizations with member count, storage usage, plan.

---

## File Summary

| File | Action |
|------|--------|
| `packages/shared/migrations/0010_uptime_history.sql` | Create |
| `packages/shared/migrations/0011_observability_metrics.sql` | Create |
| `packages/shared/migrations/0012_organizations.sql` | Create |
| `apps/api/src/uptime-sweeper.ts` | Create |
| `apps/api/src/retention-sweeper.ts` | Create |
| `apps/api/src/handlers/orgs.ts` | Create |
| `apps/api/src/handlers/admin.ts` | Modify (uptime history, observability, multi-region, org admin endpoints) |
| `apps/api/src/queue-consumer.ts` | Modify (multi-region worker selection) |
| `apps/api/src/index.ts` | Modify (new routes, cron handlers) |
| `infra/wrangler.toml` | Modify (add hourly + daily cron) |
| `src/lib/api.ts` | Modify (statusHistory, adminObservability, orgs endpoints) |
| `src/pages/Status.tsx` | Modify (90-day uptime history bars, real uptime %) |
| `src/pages/admin/DLQ.tsx` | Create |
| `src/pages/admin/GlobalSearch.tsx` | Create |
| `src/pages/admin/ConfigHistory.tsx` | Create |
| `src/pages/admin/Observability.tsx` | Create |
| `src/pages/admin/Workers.tsx` | Modify (region badges, capacity bars, stale highlight) |
| `src/pages/admin/Storage.tsx` | Modify (retention sweep section, last sweep timestamp) |
| `src/pages/OrgSettings.tsx` | Create |
| `src/components/OrgSwitcher.tsx` | Create |
| `src/components/TopHeader.tsx` | Modify (add OrgSwitcher) |
| `src/components/admin/AdminLayout.tsx` | Modify (DLQ/Search/ConfigHistory/Observability nav links, real alerts) |
| `src/components/admin/AdminUI.tsx` | Modify (DangerModal: add ticketId field) |
| `src/App.tsx` | Modify (register new routes) |

## Implementation Order

1. **Migrations** (0010, 0011, 0012) — all other work depends on schema
2. **Backend sweepers** (uptime-sweeper.ts, retention-sweeper.ts) + cron wiring
3. **Backend handlers** (orgs.ts, observability endpoint, uptime history endpoint)
4. **Queue consumer** (multi-region dispatch)
5. **Frontend API client** (api.ts additions)
6. **Status page** (uptime history bars)
7. **New admin pages** (DLQ, Search, ConfigHistory, Observability)
8. **AdminLayout** (nav links, real alerts)
9. **AdminUI** (DangerModal ticketId)
10. **Workers.tsx, Storage.tsx** updates
11. **Org pages** (OrgSettings, OrgSwitcher, TopHeader)

## Technical Notes

- **Recharts** is already installed (`recharts ^2.15.4`) — used for Observability charts
- **No new npm packages** needed for the frontend
- **WebTorrentEngine** is already real — multi-region routing is purely server-side queue consumer logic
- The `scheduled()` handler in `index.ts` already runs on cron; we extend it with new callers
- The `DangerModal`'s `onConfirm` signature changes from `(reason: string) => void` to `(params: { reason: string; ticketId?: string }) => void` — all existing callers must be updated to match
- Org context is opt-in via header — single-user flows are unaffected when no `X-Org-Slug` is sent
- The `0012` migration includes the user→org migration INSERT statements so existing users are automatically wrapped in personal orgs on first migration apply
