# Developer Guide — tseeder

## Contents

1. [Monorepo Structure](#1-monorepo-structure)
2. [Local Development Setup](#2-local-development-setup)
3. [Running Tests](#3-running-tests)
4. [Adding Routes](#4-adding-routes)
5. [Adding D1 Migrations](#5-adding-d1-migrations)
6. [Error Handling Guidelines](#6-error-handling-guidelines)
7. [Logging & Tracing Standards](#7-logging--tracing-standards)
8. [Release Process](#8-release-process)
9. [Code Style & Contributing](#9-code-style--contributing)
10. [Browser Extension — Manual Test Checklist](#10-browser-extension--manual-test-checklist)

---

## 1. Monorepo Structure

```
apps/api/src/
  index.ts          Entry: registers all routes + queue consumer
  router.ts         Minimal URLPattern-based router
  middleware.ts     Auth, RBAC, CSRF, rate-limit middleware
  crypto.ts         PBKDF2, HMAC, token helpers (SubtleCrypto only)
  d1-helpers.ts     Typed D1 query helpers
  r2-helpers.ts     Signed URL generation (SigV4)
  handlers/
    auth.ts         POST /auth/*
    jobs.ts         POST/GET /jobs/*
    files.ts        GET/POST/DELETE /files/*
    usage.ts        GET /usage, GET /plans
    admin.ts        GET/PATCH /admin/*
  durable-objects.ts  JobProgressDO + UserSessionDO
  queue-consumer.ts   Cloudflare Queues handler
  types.ts          Env + internal types

apps/web/src/
  lib/
    api.ts          Typed fetch client (all endpoints)
    mock-data.ts    REMOVED — no mock data in production
  hooks/
    useSSE.ts       EventSource hook (real-time job progress)
    useJobs.ts      react-query job hooks
    useUsage.ts     react-query usage hook
  pages/
    auth/           Login / Register / Reset
    Dashboard.tsx   Job list
    JobDetail.tsx   Realtime progress + file browser
    Admin.tsx       Admin panel

services/compute-agent/src/
  index.ts          HTTP server entry
  engine.ts         DownloadEngine interface + implementations
  routes/           /agent/* handlers
  r2-upload.ts      SigV4 multipart upload
  callback.ts       Progress callbacks to Workers DO
  registry.ts       In-memory + optional Redis job registry

packages/shared/src/
  enums.ts          JobStatus, UserRole, PlanName, EventType
  schemas.ts        Zod schemas for every API shape
  types.ts          TypeScript interfaces derived from schemas
  index.ts          Re-exports everything

packages/shared/migrations/
  0001_initial.sql
  0002_api_keys.sql
```

---

## 2. Local Development Setup

### Prerequisites

```bash
node -v    # >= 20.0.0
bun -v     # >= 1.1.0
wrangler --version  # >= 3.60.0
```

### Workers API

```bash
cd apps/api

# Install dependencies
npm install

# Create local D1 database
npx wrangler d1 create rdm-database --local

# Run migrations
for f in ../../packages/shared/migrations/*.sql; do
  npx wrangler d1 execute rdm-database --local --file "$f"
done

# Start dev server
npx wrangler dev --config ../../infra/wrangler.toml \
  --var "ENVIRONMENT=development"
```

The API listens on `http://localhost:8787`.

### Frontend

```bash
cd apps/web
npm install

# Point API to local Workers dev server
echo "VITE_API_BASE_URL=http://localhost:8787" > .env.local

npm run dev   # Vite on http://localhost:5173
```

### Compute Agent

```bash
cd services/compute-agent
bun install
cp .env.example .env
# Fill in R2 credentials, callback URL (http://localhost:8787), etc.

bun run dev
```

### Using Wrangler D1 directly

```bash
# Query local D1
npx wrangler d1 execute rdm-database --local \
  --command "SELECT id, email, role FROM users LIMIT 5"

# Run arbitrary SQL
npx wrangler d1 execute rdm-database --local --file schema-check.sql
```

---

## 3. Running Tests

```bash
# All tests (Vitest)
npm run test --workspaces

# API unit tests (Miniflare-based)
cd apps/api && npm test

# Shared schema tests
cd packages/shared && npm test

# Frontend component tests
cd apps/web && npm test

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage
```

Test files live alongside their source:
```
apps/api/src/handlers/__tests__/auth.test.ts
apps/api/src/handlers/__tests__/jobs.test.ts
packages/shared/src/__tests__/schemas.test.ts
```

Integration tests use `@cloudflare/vitest-pool-workers` to run in a real Workers runtime.

---

## 4. Adding Routes

1. Create handler in `apps/api/src/handlers/<feature>.ts`
2. Define Zod schemas in `packages/shared/src/schemas.ts`
3. Register route in `apps/api/src/index.ts` with appropriate middlewares
4. Add typed client method to `apps/web/src/lib/api.ts`
5. Write unit test in `apps/api/src/handlers/__tests__/<feature>.test.ts`
6. Document in `docs/api.md`

**Every route must:**
- Validate all inputs with Zod (use `safeParse`, never `parse`)
- Return `{ error: { code, message, requestId } }` on failure
- Log structured JSON with correlationId
- Write audit log for every mutation

---

## 5. Adding D1 Migrations

```bash
# Create a new migration file
npx wrangler d1 migrations create rdm-database "describe_the_change"
# This creates packages/shared/migrations/NNNN_describe_the_change.sql

# Write SQL in the new file (only CREATE/ALTER/INSERT, no DROP data)

# Apply locally
npx wrangler d1 migrations apply rdm-database --local

# Apply to production (after code deploy)
npx wrangler d1 migrations apply rdm-database --env production
```

**Migration rules:**
- Never drop columns on a live table without a deprecation window
- Always add nullable columns or columns with defaults
- Test with `--local` first
- Migration files are immutable once merged to main

---

## 6. Error Handling Guidelines

**Standard error response shape:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "magnetUri: Invalid magnet URI format",
    "requestId": "8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B"
  }
}
```

**Error codes (prefix with category):**
| Prefix | Examples |
|---|---|
| `AUTH_*` | `AUTH_REQUIRED`, `AUTH_INVALID`, `AUTH_EMAIL_UNVERIFIED` |
| `CSRF_*` | `CSRF_REQUIRED`, `CSRF_INVALID` |
| `VALIDATION_*` | `VALIDATION_ERROR` |
| `NOT_FOUND` | `NOT_FOUND` |
| `QUOTA_*` | `QUOTA_JOBS`, `QUOTA_STORAGE` |
| `RATE_*` | `RATE_LIMITED` |
| `INTERNAL` | `INTERNAL_ERROR` |

**Rules:**
- Never expose stack traces or SQL errors to clients
- Log the real error server-side; return a sanitised message
- Use `try/catch` at the handler level, never swallow errors silently

---

## 7. Logging & Tracing Standards

Every log line is **JSON** with these mandatory fields:

```typescript
interface LogEntry {
  ts: string;          // ISO 8601
  level: "debug" | "info" | "warn" | "error";
  correlationId: string; // UUID, threaded from edge to agent
  service: string;     // "workers-api" | "queue-consumer" | "compute-agent" | "do"
  handler?: string;    // "POST /jobs"
  userId?: string;
  jobId?: string;
  durationMs?: number;
  statusCode?: number;
  msg: string;
}
```

**`correlationId` propagation:**
- Generated at Workers API edge (`crypto.randomUUID()`)
- Set as `X-Correlation-ID` response header
- Forwarded to Queue messages in body
- Forwarded to compute agent as `X-Correlation-ID` header
- Forwarded in all DO `fetch` calls
- Written into `job_events.payload`

**Log levels:**
- `debug`: detailed tracing, disabled in production
- `info`: request processed, job state transitions
- `warn`: retryable errors, near-quota states
- `error`: unrecoverable errors, 5xx responses

---

## 8. Release Process

```
feature branch → PR → code review → merge to main → CI → staging deploy → smoke tests → production deploy
```

### Staging

```bash
npx wrangler deploy --env staging
```

### Production

```bash
# 1. Run D1 migrations (always before code deploy)
npx wrangler d1 migrations apply rdm-database --env production

# 2. Deploy Workers API
cd apps/api && npx wrangler deploy --env production

# 3. Deploy Pages
cd apps/web && npm run build
npx wrangler pages deploy dist --project-name torrentflow --branch main

# 4. Verify health
curl https://api.torrentflow.example.com/health
```

### Rollback

```bash
# Workers API (instant)
npx wrangler rollback

# D1 (write and apply a down migration)
npx wrangler d1 execute rdm-database --env production \
  --file packages/shared/migrations/NNNN_rollback.sql
```

---

## 9. Code Style & Contributing

**Formatter:** Prettier (`npm run format`)
**Linter:** ESLint with `@typescript-eslint` (`npm run lint`)

**Key rules:**
- TypeScript strict mode (`"strict": true`)
- No `any` — use `unknown` + type narrowing
- No secrets in source code
- All env vars accessed via typed `Env` interface in Workers
- 100-char line limit
- Named exports preferred over default exports in non-page files
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`

```bash
npm run lint      # Check
npm run lint:fix  # Auto-fix
npm run format    # Prettier
npm run type-check  # tsc --noEmit
```

---

## 10. Browser Extension — Manual Test Checklist

Use this checklist after every change to files under `public/extension/`.

### Prerequisites

- Chrome or Brave (v109+)
- The frontend running locally at `http://localhost:5173`
- Set `VITE_EXTENSION_ID` in `.env.local` to the value from `chrome://extensions` after loading

### A. Load Extension

```
□ Open chrome://extensions
□ Enable "Developer mode" (top-right toggle)
□ Click "Load unpacked" → select the public/extension/ directory
□ No error badges appear in the extensions dashboard
□ "tseeder" icon appears in the browser toolbar
□ Clicking the icon opens the popup (styled, not blank/unstyled)
□ Popup shows "Sign in to tseeder" state (if not yet logged in)
```

### B. Auth Bridge (Web App → Extension)

```
□ Open http://localhost:5173/auth/login
□ Enter valid credentials and click "Sign in"
□ After redirect to /app/dashboard, click the tseeder toolbar icon
□ Popup now shows the logged-in state (email displayed, avatar initial correct)
□ "● Online" green dot is visible
□ "Sign out" link appears
```

### C. Sign Out

```
□ Click "Sign out" in the extension popup
□ Popup reverts to "Sign in to tseeder" state
□ Re-opening the popup still shows the login state (persisted)
```

### D. Popup — Manual Magnet Submission

```
□ Sign back in so the popup is in the logged-in state
□ Paste a valid magnet URI (e.g. magnet:?xt=urn:btih:ABCD...&dn=Test+File)
□ Click "⚡ Send to Cloud"
□ Button shows "⏳ Sending…" while the request is in-flight
□ Success: green status message "✅ Sent to your cloud vault!" appears
□ Desktop notification "Torrent added to your cloud queue!" fires
□ Job appears in /app/dashboard within a few seconds
```

### E. Context Menu — Right-click Magnet Link

```
□ Navigate to any public torrent index page that has magnet links
□ Right-click a magnet link
□ "⚡ Send to tseeder Cloud" appears in the context menu
□ Click it
□ Desktop notification "Added to your cloud vault!" fires
□ Job appears in dashboard
```

### F. Content Script — ⚡ Button on Magnet Links

```
□ Navigate to a page with magnet links (e.g. any open torrent index)
□ Small ⚡ button appears next to each magnet link (purple gradient)
□ Clicking ⚡ immediately turns it to ✅ for 2.5 seconds, then back to ⚡
□ Desktop notification fires
□ Job appears in dashboard
```

### G. Extension ZIP Download (from /extension page)

```
□ Open /extension in the browser
□ Click "Download Extension (.zip)"
□ Button shows "Bundling…" with spinner while JSZip runs
□ File "tseeder-extension.zip" downloads automatically
□ Unzip it — should contain: manifest.json, background.js, content.js,
  popup.html, popup.js, popup.css, icon16.svg, icon48.svg, icon128.svg
□ Load the unzipped folder via "Load unpacked" — no errors
```

### H. Error Cases

```
□ Expired token: revoke API key in Settings → reopen popup → paste magnet → Send
  → Status shows "Session expired — please sign in again"
  → Popup reverts to login state after 1.5 s
□ Network offline: turn off Wi-Fi → paste magnet → Send
  → Error notification with "Failed to fetch"
□ Empty input: click Send without pasting anything
  → Status shows "Paste a magnet link or URL first"
```

