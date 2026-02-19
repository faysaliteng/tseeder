
## What Has Already Been Built (Real Code)

The codebase is more complete than it appears. Here is the genuine state:

**Fully Real (no mocks):**
- Cloudflare Workers API (`apps/api/`) — all handler files are real D1/R2 code
- Auth: real PBKDF2 hashing, real HTTP-only cookie sessions, real CSRF, real Turnstile verification, real rate limiting via KV
- Jobs pipeline: POST /jobs → D1 insert → Queue dispatch → real Seedr.cc REST calls OR real compute agent HTTP dispatch
- Queue consumer: reads active provider from D1, routes to Seedr.cc or compute agent
- Durable Objects: JobProgressDO (SSE fanout), UserSessionDO — both complete
- Admin handlers: Users CRUD, Jobs, Audit, Security events, Feature flags, Provider switch/verify/history — all real D1 queries
- D1 schema: migrations 0001–0004, comprehensive with all required tables
- Compute agent skeleton: Dockerfile, real HTTP server, real job registry
- Extension: fixed in previous sessions — all 11 bugs resolved, 28 tests passing
- Frontend API client (`src/lib/api.ts`): all endpoints wired, no mock data
- Dashboard: real TanStack Query → real API, real SSE hooks
- Admin Overview: live data from `adminApi.systemHealth()` and `adminApi.audit()`

---

## What Remains Mocked or Incomplete

After deep analysis of every file, the remaining gaps are:

### 1. Frontend Auth — Turnstile Widget Placeholder
**Files:** `src/pages/auth/Login.tsx` (line 204), `src/pages/auth/Register.tsx` (line 171)
Both pages show `<div>Cloudflare Turnstile (configure site key)</div>` — a placeholder div. The backend *verifies* Turnstile tokens correctly (with a `BYPASS_FOR_DEV` escape). The frontend never submits a real token — it hard-codes `"dev-bypass"` (Login.tsx line 103, Register.tsx line 65).
**Fix:** Integrate `@marsidev/react-turnstile` (lightweight React Turnstile wrapper). Read `VITE_TURNSTILE_SITE_KEY` from env. Wire the token into login/register mutations.

### 2. Password Reset — Email Sending is a TODO Stub
**File:** `apps/api/src/handlers/auth.ts` line 225
```typescript
// TODO: Send email with reset link: `${env.APP_DOMAIN}/auth/reset?token=${token}`
```
The token is generated and stored in D1 correctly. But no email is ever sent. The `/auth/reset` page (`src/pages/auth/Reset.tsx`) submits to `auth.resetRequest()` correctly.
**Fix:** Add a real `POST /auth/reset/confirm` endpoint that verifies the token and updates the password. Add email sending via Cloudflare Email Workers or MailChannels (free with CF Workers). Update the Reset page to handle the confirm flow.

### 3. `handleGetUsage` in `apps/api/src/handlers/usage.ts` — Entirely Commented Out
This is the biggest backend mock. The entire D1 query is commented out with TODO stubs. It returns hardcoded:
```typescript
return Response.json({
  plan: { name: "pro", maxJobs: 10, maxStorageGb: 50, bandwidthGb: 500, retentionDays: 30 },
  storageUsedBytes: 0, bandwidthUsedBytes: 0, activeJobs: 0, totalJobs: 0,
});
```
Every user sees "pro plan" with zero usage regardless of their actual plan/data.
**Fix:** Implement all four D1 queries: plan lookup via `user_plan_assignments`, storage sum from `files`, active jobs count from `jobs`, bandwidth from `usage_metrics_daily`.

### 4. Admin Users Page (`src/pages/admin/Users.tsx`) — Mock Static Data
The page structure uses `useQuery` with `admin.listUsers()` which IS a real API call. However, inspecting the render: it shows hardcoded/static mock data inline for at least the "role" column display. Needs to wire the real `updateUser` and `forceLogout` mutations to the PATCH/POST endpoints.
**Fix:** Wire existing `admin.updateUser()` and `admin.forceLogout()` API functions to the UI buttons in the Users page.

### 5. Admin Workers Page (`src/pages/admin/Workers.tsx`) — No Real Worker Registry API
The Workers page calls `adminApi.systemHealth()` but there is **no** `/admin/workers` endpoint in the API router. The Worker registry in D1 (`worker_registry` table from migration 0003) has no corresponding API handler or frontend queries.
**Fix:** Add `GET /admin/workers` handler that reads from `worker_registry` + `worker_heartbeats`. Add `POST /admin/workers/:id/cordon` and `/drain`. Wire the Workers page to the real query.

### 6. Admin Storage Page (`src/pages/admin/Storage.tsx`) — No Real R2 Usage API
No `/admin/storage` endpoint exists. The Storage page has no API to call.
**Fix:** Add `GET /admin/storage` that queries R2 bucket stats (total objects, bytes) and orphan detection (files in D1 not in R2). Add an orphan cleanup `POST /admin/storage/cleanup`.

### 7. `handleGetPlans` (`/plans`) — Returns Hardcoded Array
**File:** `apps/api/src/handlers/admin.ts` (implied from `handleGetPlans` import)
Plans should come from D1, not be hardcoded.
**Fix:** Query `SELECT * FROM plans` in D1.

### 8. Seedr Cron Polling — No Mechanism to Poll Transfer Status
When Seedr provider is active, `dispatchToSeedr()` submits the transfer but never polls for progress. The Durable Object is updated once with `status: downloading` but is never updated again until... nothing. Users will see jobs stuck at "Downloading 0%" forever.
**Fix:** Add a Cloudflare Cron Trigger (`scheduled()` handler) that runs every 2 minutes, queries D1 for jobs with `worker_id LIKE 'seedr:%'` and status `downloading`, hits `GET /rest/transfer/{id}` on Seedr.cc, and updates the DO + D1 with real progress.

### 9. `src/pages/admin/Infrastructure.tsx` — Provider Switch UI Has No Real Config Form
The Infrastructure page shows provider health but the "Switch Provider" form for Seedr credentials (email/password) doesn't persist them to D1 or Workers secrets. The `providers.switch()` call sends the config but the `handleSwitchProvider` stores it in `provider_configs.config` as JSON — however credentials stored plaintext in D1 JSON is a security concern.
**Fix:** The switch handler already stores config. The UI form needs validation and the password field needs to be masked. The handler should store only a reference, not plaintext creds — instead, credentials should reference the Worker secrets (SEEDR_EMAIL/SEEDR_PASSWORD). The config.json in D1 should only store non-secret options like `{ workerClusterUrl, maxConcurrentJobs }` for cloudflare or `{ endpoint }` for seedr.

### 10. `src/pages/JobDetail.tsx` — May Have Mock Data
Need to verify job detail page wires to real API.

### 11. Missing `adminApi` entries for Storage and Workers in `src/lib/api.ts`
No `adminApi.storage.*` or `adminApi.workers.*` functions exist — these API surfaces are entirely missing from both backend and frontend.

### 12. `handleAdminSystemHealth` — Real Worker Health Check But Falls Back to `env.WORKER_CLUSTER_URL`
The health check calls the external worker cluster. Fine as-is since if the cluster is down, it returns an error state correctly.

### 13. `src/pages/Privacy.tsx`, `src/pages/Terms.tsx`, `src/pages/DMCA.tsx` — Need Real Content
These pages exist but likely have placeholder/generic content rather than real legal text appropriate for a torrent hosting service.

---

## Implementation Plan

### Phase 1 — Backend Fixes (High Priority, Blocking)

**1A. Uncomment and implement real `handleGetUsage`**
- File: `apps/api/src/handlers/usage.ts`
- Implement all 4 D1 queries: plan, storage sum, bandwidth, active jobs count
- Add default free plan assignment if user has none

**1B. Add Seedr Cron Poller**
- File: `apps/api/src/index.ts` — add `scheduled()` export
- New file: `apps/api/src/seedr-poller.ts`
- Query D1 for active Seedr jobs, poll `GET /rest/transfer/{id}`, update DO + D1
- Handle completion: map Seedr `progress === 101` to completed, fetch folder contents

**1C. Add `GET /admin/workers` + cordon/drain endpoints**
- File: `apps/api/src/handlers/admin.ts` (extend)
- Queries: `SELECT * FROM worker_registry ORDER BY last_heartbeat DESC`
- Add cordon/drain: `UPDATE worker_registry SET status = 'cordoned' WHERE id = ?`
- Register in `apps/api/src/index.ts`

**1D. Add `GET /admin/storage` + cleanup endpoints**
- File: `apps/api/src/handlers/admin.ts` (extend)
- Query D1 for total file sizes, orphan detection
- Add POST `/admin/storage/cleanup` that deletes orphaned D1 file records

**1E. Fix `handleGetPlans` to query D1**
- Return `SELECT * FROM plans` instead of hardcoded array

**1F. Add `POST /auth/reset/confirm`**
- Verify token from D1, hash new password, update users, mark token used
- Add MailChannels email sending for reset request

**1G. Add `POST /admin/workers/:id/heartbeat`**
- Allow compute agents to self-register and send heartbeats to D1

### Phase 2 — Frontend Fixes (Medium Priority)

**2A. Real Cloudflare Turnstile in Login + Register**
- Install `@marsidev/react-turnstile`
- Replace placeholder div with `<Turnstile siteKey={VITE_TURNSTILE_SITE_KEY} onSuccess={setToken} />`
- Wire token into `auth.login()` and `auth.register()` calls (replace `"dev-bypass"`)

**2B. Wire Admin Users page mutations**
- Connect role-change dropdown to `admin.updateUser({ role })`
- Connect suspend/unsuspend button to `admin.updateUser({ suspended })`
- Connect "Force logout" to `admin.forceLogout(id)`
- Add confirmation dialog (already have DangerModal pattern)

**2C. Wire Admin Workers page to new real API**
- Add `adminApi.workers.list()`, `adminApi.workers.cordon()`, `adminApi.workers.drain()`
- Replace static data with `useQuery`

**2D. Wire Admin Storage page to new real API**
- Add `adminApi.storage.get()` and `adminApi.storage.cleanup()`
- Replace static data with `useQuery`

**2E. Password Reset Confirm flow**
- Add token parsing from URL in `src/pages/auth/Reset.tsx`
- Show "Enter new password" form when `?token=` is present
- Call `POST /auth/reset/confirm`

**2F. Add `adminApi` functions for new endpoints**
- `admin.workers.*`, `admin.storage.*` to `src/lib/api.ts`

### Phase 3 — New Migration for Worker Heartbeats

**3A. Migration `0005_worker_heartbeats.sql`**
- Add `worker_heartbeats` table (separate from registry for time-series)
- Add index on `worker_id, created_at`
- Add retention: heartbeats older than 7 days are irrelevant

### Phase 4 — Security Hardening

**4A. Provider credentials — remove plaintext from D1**
- Modify `handleSwitchProvider`: for seedr provider, only store non-secret config in D1 JSON (endpoint override, options). Actual credentials (`SEEDR_EMAIL`, `SEEDR_PASSWORD`) must come from Worker secrets, not D1.
- Document this clearly in the switch UI with a tooltip: "Credentials are read from SEEDR_EMAIL / SEEDR_PASSWORD Worker secrets. Update them via: `wrangler secret put SEEDR_EMAIL`"

---

## Files to Create/Modify

| Action | File | What |
|--------|------|-------|
| Modify | `apps/api/src/handlers/usage.ts` | Implement real D1 queries for plan + storage + usage |
| Create | `apps/api/src/seedr-poller.ts` | Cron poller for Seedr transfer progress |
| Modify | `apps/api/src/index.ts` | Add `scheduled()` handler + new admin routes |
| Modify | `apps/api/src/handlers/admin.ts` | Add workers + storage handlers |
| Modify | `apps/api/src/handlers/auth.ts` | Add real `POST /auth/reset/confirm` + MailChannels |
| Create | `packages/shared/migrations/0005_worker_heartbeats.sql` | Heartbeat time-series table |
| Modify | `src/lib/api.ts` | Add `adminApi.workers.*`, `adminApi.storage.*` |
| Modify | `src/pages/auth/Login.tsx` | Real Turnstile widget |
| Modify | `src/pages/auth/Register.tsx` | Real Turnstile widget |
| Modify | `src/pages/auth/Reset.tsx` | Token confirm flow |
| Modify | `src/pages/admin/Workers.tsx` | Wire to real `/admin/workers` API |
| Modify | `src/pages/admin/Storage.tsx` | Wire to real `/admin/storage` API |
| Modify | `src/pages/admin/Users.tsx` | Wire mutations (updateUser, forceLogout) |
| Modify | `src/pages/admin/Infrastructure.tsx` | Credential security note, form hardening |
| Modify | `infra/wrangler.toml` | Add `[triggers]` cron schedule |
