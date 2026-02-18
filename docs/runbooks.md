# Runbooks — TorrentFlow

Incident response guides for on-call operators.

---

## RB-01: Queue Backlog

**Alert:** `queue.depth > 500` for > 2 min

**Symptoms:** Jobs stuck in `queued`/`submitted` for > 10 min. Queue Consumer logs showing backlog.

**Steps:**

1. Check all compute agents are online:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" https://agent.internal/agent/health | jq .
   ```

2. Check Queue Consumer Worker is deployed and healthy:
   ```bash
   wrangler tail rdm-api --env production | grep "queue"
   ```

3. Check D1 for jobs stuck in wrong state:
   ```bash
   wrangler d1 execute rdm-database --env production \
     --command "SELECT status, COUNT(*) FROM jobs GROUP BY status"
   ```

4. If agents healthy but queue still growing → scale agent cluster:
   ```bash
   kubectl scale deployment torrentflow-agent --replicas=10
   ```

5. If Queue Consumer is failing → check Worker error logs:
   ```bash
   wrangler tail rdm-api --env production --format json | grep '"level":"error"'
   ```

6. If DLQ is non-empty, inspect and optionally replay:
   ```bash
   # Via Cloudflare dashboard → Queues → rdm-job-dlq → Messages
   # Or via API: https://api.cloudflare.com/client/v4/accounts/{id}/queues/{id}/messages
   ```

**Recovery time target:** < 15 min

---

## RB-02: Compute Agent Offline

**Alert:** `worker.offline_count > 0` (heartbeat silent > 60s)

**Symptoms:** Agent `/agent/health` returns non-200 or no heartbeat in JobProgressDO.

**Steps:**

1. Check pod status:
   ```bash
   kubectl get pods -l app=torrentflow-agent
   kubectl describe pod <pod-name>
   kubectl logs <pod-name> --tail=100
   ```

2. Common causes and fixes:
   - **OOM:** Increase pod memory limit; restart pod
     ```bash
     kubectl set resources deployment torrentflow-agent \
       --limits=memory=8Gi
     kubectl rollout restart deployment torrentflow-agent
     ```
   - **Disk full:** Check volume usage; clean `/data/downloads` for completed jobs:
     ```bash
     kubectl exec <pod-name> -- df -h /data/downloads
     kubectl exec <pod-name> -- find /data/downloads -mtime +1 -delete
     ```
   - **Network partition:** Check Cloudflare Tunnel status; restart tunnel
   - **mTLS cert expired:** Rotate cert, restart pods

3. Jobs that were assigned to the offline agent will auto-timeout via DO heartbeat detection (30s).
   Queue Consumer will re-queue them automatically.

4. Verify re-queued jobs proceed:
   ```bash
   wrangler d1 execute rdm-database --env production \
     --command "SELECT id, status, worker_id, updated_at FROM jobs WHERE status='queued' ORDER BY updated_at DESC LIMIT 10"
   ```

**Recovery time target:** < 10 min

---

## RB-03: R2 Upload Failures

**Alert:** `r2.upload.error_rate > 1%` for > 5 min, or agent logs showing repeated upload errors.

**Symptoms:** Jobs stuck in `uploading`; agent logs `R2 upload error`.

**Steps:**

1. Check R2 status: https://www.cloudflarestatus.com/

2. Verify R2 credentials still valid:
   ```bash
   # R2 API token may have been rotated
   # Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
   # Regenerate if needed, then update secret:
   wrangler secret put R2_ACCESS_KEY_ID --env production
   wrangler secret put R2_SECRET_ACCESS_KEY --env production
   ```

3. Check presigned URL expiry time:
   - Large files (>50GB) may exceed the presigned URL TTL
   - Increase `PRESIGNED_URL_TTL_SECONDS` env var on agent

4. Verify R2 bucket name matches config:
   ```bash
   wrangler r2 bucket list
   ```

5. Agent has built-in retry (5 attempts, exponential backoff). After fix, stuck jobs:
   - Will auto-retry if worker is still running
   - Or operator can terminate + re-submit via admin panel

**Recovery time target:** < 20 min

---

## RB-04: D1 Errors / Contention

**Alert:** 5xx errors on any endpoint that writes D1; D1 error logs.

**Symptoms:** API returns 500; `wrangler tail` shows D1 errors like `D1_ERROR` or `SQLITE_BUSY`.

**Steps:**

1. Check D1 health and size:
   ```bash
   wrangler d1 info rdm-database --env production
   ```

2. Check for runaway queries (large table scans):
   ```bash
   wrangler d1 execute rdm-database --env production \
     --command "SELECT name, COUNT(*) FROM sqlite_master WHERE type='index' GROUP BY name"
   ```

3. Check `job_events` table size (append-only, grows fast):
   ```bash
   wrangler d1 execute rdm-database --env production \
     --command "SELECT COUNT(*) as events FROM job_events"
   # If > 1M rows, run retention cleanup:
   wrangler d1 execute rdm-database --env production \
     --command "DELETE FROM job_events WHERE created_at < datetime('now', '-90 days')"
   ```

4. D1 has a 2GB per-database limit. If approaching:
   - Archive old `job_events` rows
   - Archive old `audit_logs` rows
   - Consider splitting audit/events to a secondary D1 database

5. Cloudflare D1 supports up to 6M reads/day on paid plans. Check quota:
   - Dashboard → D1 → rdm-database → Metrics

**Recovery time target:** < 30 min

---

## RB-05: Auth / Session Issues

**Alert:** Spike in 401 responses; users reporting they're being logged out.

**Symptoms:** API returns `AUTH_REQUIRED` or `SESSION_INVALID` unexpectedly.

**Steps:**

1. Check session table for expiry issues:
   ```bash
   wrangler d1 execute rdm-database --env production \
     --command "SELECT COUNT(*) FROM sessions WHERE expires_at > datetime('now')"
   ```

2. Check `SESSION_SECRET` hasn't changed (changing it invalidates all sessions):
   ```bash
   wrangler secret list --env production
   # Verify SESSION_SECRET exists
   ```

3. If `SESSION_SECRET` was rotated accidentally, all users must re-login. 
   Communicate via status page.

4. Check for clock skew: session expiry uses `datetime('now')` in D1 (UTC). 
   Ensure server clocks are synced (Cloudflare Workers always use UTC).

5. If tokens suddenly expire early, check that the session creation logic 
   sets `expires_at = datetime('now', '+30 days')` correctly.

---

## RB-06: Frontend Blank / Not Loading

**Symptoms:** App shows blank page or "Failed to fetch" errors.

**Steps:**

1. Check Cloudflare Pages deployment status:
   ```bash
   npx wrangler pages deployment list --project-name torrentflow
   ```

2. Check if `VITE_API_BASE_URL` is set in Pages environment:
   - Dashboard → Pages → torrentflow → Settings → Environment variables

3. Check CORS: API must return `Access-Control-Allow-Origin` matching Pages domain:
   ```bash
   curl -I -H "Origin: https://torrentflow.pages.dev" \
     https://api.torrentflow.example.com/health
   ```

4. Check browser console for specific errors (share with on-call developer).

5. Rollback Pages deployment if needed:
   ```bash
   npx wrangler pages deployment rollback <deployment-id> \
     --project-name torrentflow
   ```

---

## Alert Thresholds Reference

| Alert | Threshold | Window | Severity | Runbook |
|---|---|---|---|---|
| Queue backlog | depth > 500 | 2 min | P2 | RB-01 |
| Queue backlog critical | depth > 2000 | 2 min | P1 | RB-01 |
| DLQ non-empty | depth > 0 | 1 min | P2 | RB-01 |
| Worker offline | count > 0 | 1 min | P1 | RB-02 |
| R2 error rate | > 1% | 5 min | P2 | RB-03 |
| API 5xx rate | > 0.5% | 5 min | P2 | on-call |
| API p95 latency | > 1000ms | 5 min | P3 | on-call |
| D1 error rate | > 0.1% | 5 min | P1 | RB-04 |
| 401 spike | > 10x baseline | 5 min | P2 | RB-05 |
| Agent capacity | > 90% | 3 min | P3 (auto-scale) | RB-02 |
