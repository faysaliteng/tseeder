# Observability — Enterprise Remote Download Manager

## Structured Log Format

Every log line is JSON with these fields:

```json
{
  "ts": "2026-02-18T12:34:56.789Z",
  "level": "info",
  "correlationId": "8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B",
  "service": "workers-api",
  "handler": "POST /jobs",
  "userId": "usr_abc123",
  "jobId": "job_xyz789",
  "durationMs": 42,
  "statusCode": 201,
  "msg": "Job created and queued"
}
```

Correlation IDs are generated at the edge and forwarded in the `X-Correlation-ID` header to all downstream services (queue consumer, compute agent callbacks).

---

## Key Metrics

### Business Metrics

| Metric | Description | Target |
|---|---|---|
| `jobs.created.rate` | New jobs per minute | Baseline + alerting on spike |
| `jobs.completed.rate` | Completions per minute | — |
| `jobs.failed.rate` | Failures per minute | < 1% of total |
| `jobs.duration_p50/p95/p99` | End-to-end job duration | p95 < 30 min |
| `metadata.fetch_duration_p95` | Time to metadata ready | p95 < 10s |

### Infrastructure Metrics

| Metric | Description | Alert Threshold |
|---|---|---|
| `queue.depth` | Messages awaiting processing | > 500 → warn, > 2000 → page |
| `queue.dlq.depth` | Dead-letter queue depth | > 0 → alert |
| `worker.capacity_pct` | Average agent utilisation | > 85% → scale-out |
| `worker.offline_count` | Agents not reporting heartbeat | > 0 → page |
| `r2.upload.error_rate` | R2 multipart upload failures | > 0.1% → alert |
| `do.connections` | Active SSE connections (Durable Objects) | Monitoring only |

### API Health Metrics

| Metric | Description | Alert Threshold |
|---|---|---|
| `api.error_rate_5xx` | 5xx rate per endpoint | > 0.5% → alert |
| `api.p95_latency_ms` | 95th pct response time | > 500ms → warn |
| `api.rate_limit_hits` | Rate limit triggers per minute | Spike → investigate |

---

## SLOs

| SLO | Target | Measurement Window |
|---|---|---|
| API availability | 99.9% | 30-day rolling |
| Job completion success rate | 98% | 7-day rolling |
| Metadata ready within 15s | 95% of jobs | 7-day rolling |
| Download delivery availability | 99.95% | 30-day rolling |
| Realtime SSE event delivery | < 5s lag | continuous |

---

## Alert Definitions

```yaml
alerts:
  - name: HighJobFailureRate
    condition: jobs.failed.rate / jobs.created.rate > 0.05
    window: 5m
    severity: P2
    runbook: "#runbook-stalled-job"

  - name: QueueBacklog
    condition: queue.depth > 2000
    window: 2m
    severity: P1
    runbook: "#runbook-queue-backlog"

  - name: WorkerOffline
    condition: worker.offline_count > 0
    window: 1m
    severity: P1
    runbook: "#runbook-worker-offline"

  - name: DLQNonEmpty
    condition: queue.dlq.depth > 0
    window: 1m
    severity: P2
    runbook: "#runbook-stalled-job"

  - name: R2UploadErrors
    condition: r2.upload.error_rate > 0.01
    window: 5m
    severity: P2
    runbook: "#runbook-r2-upload-failure"

  - name: APIHighLatency
    condition: api.p95_latency_ms > 1000
    window: 5m
    severity: P3

  - name: WorkerCapacityHigh
    condition: worker.capacity_pct > 90
    window: 3m
    severity: P3
    action: auto-scale
```

---

## Runbooks

### Stalled Job (`#runbook-stalled-job`)

**Symptoms:** Job stuck in `downloading` for > 2x ETA, or `progress_update` heartbeat silent > 2 min.

**Steps:**
1. Check Durable Object state: `GET /do/job/:id/state` (internal)
2. Check agent status: `GET agent.internal/status/:jobId`
3. If agent offline → re-queue job (PUT /jobs/:id/requeue, internal)
4. If agent online but no progress → call `POST agent.internal/stop` then re-queue
5. If > 3 re-queues → mark `failed`, notify user

---

### Worker Offline (`#runbook-worker-offline`)

**Symptoms:** Agent `/health` returns non-200 or no heartbeat for 60s.

**Steps:**
1. SSH to node or check container logs
2. If OOM → increase container memory limit and restart
3. If disk full → clean up completed artifacts, resize disk, restart
4. If network partition → check Cloudflare Tunnel / mTLS cert expiry
5. Scale out replacement node if outage > 5 min

---

### Queue Backlog (`#runbook-queue-backlog`)

**Symptoms:** `queue.depth` > 2000, jobs staying in `queued` > 10 min.

**Steps:**
1. Check all agents are online and reporting capacity
2. Scale out compute cluster (add nodes)
3. If agents healthy but queue growing → check Queue Consumer Worker logs for errors
4. Temporarily pause low-priority jobs if capacity critically constrained

---

### R2 Upload Failure (`#runbook-r2-upload-failure`)

**Symptoms:** `r2.upload.error_rate` spike, jobs stuck in `uploading`.

**Steps:**
1. Check R2 status at https://www.cloudflarestatus.com/
2. Verify R2 access key + secret key are valid (not rotated unexpectedly)
3. Check presigned URL expiry time — increase if uploads are large
4. Check for network issues between agent cluster and R2 endpoint
5. Retry: agent has built-in multipart upload retry with exponential backoff up to 5 attempts

---

## Tracing Strategy

- Each incoming request receives a `correlationId` (UUID v4) at the Workers API edge
- Forwarded as `X-Correlation-ID` header to all downstream calls
- Written to every D1 row via `job_events.payload.correlationId`
- Written to every compute agent log
- Written to every Queue message body
- Use Cloudflare Workers Trace to visualise across Worker invocations
- Export traces to Grafana Tempo or Honeycomb via OTLP exporter (optional)
