# ops-admin.md — Operating the tseeder Admin Console

## Access Control

- Admin console at `/admin/*` is RBAC-enforced server-side
- Roles: `user` < `support` < `admin` < `superadmin`
- `/admin/login` is completely separate from user auth
- Admin sessions expire after 30 days; force-logout available per user

## Safe Provider Switching

1. Navigate to `/admin/infrastructure`
2. Click **Verify** on target provider first — confirms credentials work
3. Wait for in-flight jobs to finish (or accept graceful handoff)
4. Click **Switch** — this writes a versioned config to `provider_configs` and logs to `audit_logs`
5. New jobs will route to the new provider immediately
6. Roll back: click the previous config in **Change History** and switch back

**Rules:**
- Never switch providers with >50 jobs actively downloading unless under maintenance window
- Seedr provider: ensure `SEEDR_EMAIL` and `SEEDR_PASSWORD` are set in Wrangler secrets
- Cloudflare provider: ensure `WORKER_CLUSTER_URL` and `WORKER_CLUSTER_TOKEN` are set

## Suspending a User

1. Go to `/admin/users` → find user
2. Click **View** → **Suspend Account**
3. Enter a reason (required)
4. All existing sessions are invalidated immediately
5. User cannot log in while suspended
6. Action is logged to `audit_logs`

## Force-Logout All Sessions

From `/admin/users/:id`:
- Click **Force Logout** — deletes all sessions from `sessions` table
- Useful for compromised accounts

## Rotating Secrets

1. Generate new secret: `openssl rand -hex 32`
2. Update via: `wrangler secret put SECRET_NAME`
3. For `SESSION_SECRET`: all existing sessions become invalid — use during maintenance
4. For `CALLBACK_SIGNING_SECRET`: must also update on compute agents

## Queue Backlog Response

1. Check queue depth at `/admin/overview`
2. If DLQ has messages: go to Cloudflare dashboard → Queues → re-drive DLQ
3. If agents are down: check `/admin/workers` for heartbeat status
4. If provider is down: switch provider at `/admin/infrastructure`

## Audit Log Export

From `/admin/audit`:
- Filter by action, actor, date range
- All audit logs are append-only (no DELETE allowed by policy)
- For bulk export: run SQL directly via Wrangler: `wrangler d1 execute rdm-database --remote --command "SELECT * FROM audit_logs WHERE created_at > '2026-01-01' ORDER BY created_at DESC" > audit_export.json`

## Emergency Actions

### Rate limit reset (user locked out):
```bash
wrangler kv key delete --binding=RATE_LIMIT_KV "rl:login:<ip>"
```

### Clear all sessions (security incident):
```bash
wrangler d1 execute rdm-database --remote --command "DELETE FROM sessions"
```

### Mark infohash as blocked:
POST `/admin/blocklist` with `{"infohash": "<40 hex chars>", "reason": "DMCA"}`

### Feature flag kill switch (disable registrations):
PATCH `/admin/feature-flags/registration_open` with `{"value": 0, "reason": "Abuse spike"}`
