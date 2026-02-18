# Threat Model — TorrentFlow

## Scope

This document covers threats to the TorrentFlow platform: the Cloudflare Workers API, Durable Objects, compute agent cluster, R2 storage, D1 database, and frontend.

---

## Assets

| Asset | Sensitivity | Impact if Compromised |
|---|---|---|
| User credentials | High | Account takeover |
| Session tokens | High | Impersonation |
| R2 signed URLs | Medium | Unauthorised file access |
| D1 database | High | Data breach, data loss |
| R2 bucket | High | Data leak, costly egress |
| Admin RBAC | Critical | Full platform control |
| Agent ↔ API channel | High | Job injection, data exfiltration |
| Rate limit counters | Low | Abuse |

---

## Threat Table

| ID | Threat | Component | Mitigation |
|---|---|---|---|
| T01 | Credential stuffing / brute force login | Auth | Rate limit (10/min per IP), PBKDF2 (slow hash), Turnstile |
| T02 | Account registration bot abuse | Auth | Turnstile, rate limit (5/hr per IP), email verification |
| T03 | Session hijacking | Sessions | HttpOnly, Secure, SameSite=Strict cookie; 30-day rolling expiry |
| T04 | CSRF attack | Any mutation | X-CSRF-Token header; SameSite=Strict cookie |
| T05 | JWT/token forgery | Agent auth | HMAC-SHA256 with per-request timestamp; 5-min replay window |
| T06 | Agent impersonation (rogue agent) | Queue → Agent | `WORKER_CLUSTER_TOKEN` Bearer auth; HMAC callback signing |
| T07 | R2 path traversal | Files | Validated key naming: `{userId}/{jobId}/{safePath}` stripping `..` |
| T08 | R2 unauthorised access | Files | Private bucket; signed URLs only; ownership check in Workers |
| T09 | SQL injection | D1 | Parameterised queries (`?` bindings) everywhere; no string concatenation |
| T10 | XSS | Frontend | React DOM (safe by default); no `dangerouslySetInnerHTML`; CSP header |
| T11 | Mass assignment | Any POST | Zod `strict()` schema parsing; explicit field selection |
| T12 | Insecure direct object reference | Jobs/Files | User ownership check on every resource fetch |
| T13 | Admin privilege escalation | Admin routes | RBAC middleware: role must be >= `admin` |
| T14 | Audit log tampering | Audit logs | Append-only D1 table; no UPDATE/DELETE in application code |
| T15 | Queue message injection | Queue Consumer | Messages validated against `JobQueueMessageSchema`; source is internal Workers only |
| T16 | DoS via large file upload | POST /jobs | `MAX_UPLOAD_BYTES` enforced; content-length check |
| T17 | DDoS / volumetric flood | All | Cloudflare WAF + Auto-DDoS mitigation |
| T18 | Content abuse (illegal downloads) | Jobs | Infohash blocklist; AUP gate; abuse reporting hook; DMCA takedown flow |
| T19 | Data retention breach (GDPR) | D1 / R2 | Per-plan retention policy; automated cleanup job; GDPR delete API |
| T20 | Secret leak | API/Agent | No secrets in code; Wrangler secrets + K8s secrets; env template with example values only |
| T21 | Stale worker / zombie job | DO / Queue | Heartbeat detection in DO (30s timeout); DLQ; admin terminate endpoint |
| T22 | Replay attack on agent callback | Callback | HMAC-SHA256 + timestamp header; reject if timestamp > ±5 minutes |

---

## Abuse Scenarios

### Scenario A: Copyright Infringement

**Attack:** User submits infohash of known infringing content.

**Mitigations:**
1. AUP accepted at registration (stored in `users.accepted_aup`)
2. Infohash blocklist checked at `POST /jobs` before queue dispatch
3. Admin blocklist management UI
4. DMCA takedown hook: `handleBlocklist` endpoint; deletes job + R2 objects + updates blocklist table
5. Account suspension by admin

### Scenario B: Storage Exhaustion

**Attack:** User creates many jobs to exhaust quotas or R2 capacity.

**Mitigations:**
1. Per-plan `max_jobs` and `max_storage_gb` limits enforced at job creation
2. Rate limiting on `POST /jobs` endpoint
3. Retention policy enforcement (automated cleanup)
4. Admin can inspect and terminate any job

### Scenario C: Agent Cluster API Abuse

**Attack:** External party sends fake progress callbacks to the Workers API.

**Mitigations:**
1. Callbacks require `Authorization: Bearer <HMAC-SHA256(body, CALLBACK_SIGNING_SECRET)>`
2. Worker verifies HMAC on every `/internal/jobs/:id/progress` request
3. Timestamp header required; reject if `|now - timestamp| > 300s`
4. Idempotency keys prevent replaying the same update

### Scenario D: Admin Account Compromise

**Attack:** Attacker gains admin credentials.

**Mitigations:**
1. Strong password policy enforced at register
2. All admin actions written to `audit_logs` (immutable)
3. Suspicious admin activity alerting (high frequency actions)
4. Superadmin role can revoke admin sessions via `UserSessionDO`

---

## Security Controls Summary

| Category | Control |
|---|---|
| Authentication | PBKDF2-SHA256 (100k iterations), HttpOnly cookie |
| Authorization | RBAC (user < support < admin < superadmin) |
| Input validation | Zod strict parsing on all endpoints |
| Transport | HTTPS enforced by Cloudflare; HSTS |
| Content security | CSP header, X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| Bot mitigation | Cloudflare Turnstile |
| Rate limiting | KV counters + WAF rules |
| Secrets management | Wrangler secrets (Workers) + Kubernetes secrets (agent) |
| Logging | Append-only audit_logs; structured JSON; immutable |
| Compliance | AUP flow, GDPR delete workflow, data retention policies |
