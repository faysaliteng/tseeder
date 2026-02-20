# Operations Guide — tseeder

Step-by-step guide for operators deploying and running tseeder in production.

---

## Prerequisites

Before you begin, ensure you have:
- Cloudflare account on the **Workers Paid** plan (required for Durable Objects)
- Wrangler CLI authenticated: `wrangler login`
- Docker + kubectl (for compute agents)
- Access to a container registry (Docker Hub, GCR, ECR, etc.)

---

## Step 1: Create Cloudflare Resources

### 1a. D1 Database

```bash
wrangler d1 create rdm-database
# Output:
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# Paste this ID into infra/wrangler.toml under [[d1_databases]]
```

### 1b. R2 Bucket

```bash
wrangler r2 bucket create rdm-files
# No ID needed — reference by name in wrangler.toml
```

### 1c. Cloudflare Queues

```bash
wrangler queues create rdm-job-queue
wrangler queues create rdm-job-dlq

# After deployment, get queue IDs:
wrangler queues list
```

### 1d. KV Namespaces

```bash
wrangler kv:namespace create "RATE_LIMIT_KV"
# Output: id = "xxxxxxxx..."
# Paste into wrangler.toml [[kv_namespaces]] binding RATE_LIMIT_KV

wrangler kv:namespace create "CSRF_KV"
# Paste into wrangler.toml [[kv_namespaces]] binding CSRF_KV
```

### 1e. Cloudflare Turnstile

1. Go to Cloudflare Dashboard → Turnstile
2. Create a new site
3. Note the **Site Key** (public) and **Secret Key** (private)

---

## Step 2: Configure Environment Variables & Secrets

### Secrets (set via Wrangler, never commit to repo)

```bash
# Run each command — paste the value when prompted

wrangler secret put SESSION_SECRET --env production
# Generate: openssl rand -hex 32

wrangler secret put CSRF_SECRET --env production
# Generate: openssl rand -hex 32

wrangler secret put CALLBACK_SIGNING_SECRET --env production
# Generate: openssl rand -hex 32
# This is shared with compute agents — store in agent K8s secret too

wrangler secret put TURNSTILE_SECRET_KEY --env production
# Paste the Turnstile secret key from Step 1e

wrangler secret put WORKER_CLUSTER_TOKEN --env production
# Generate: openssl rand -hex 32
# This is the Bearer token compute agents use to authenticate

wrangler secret put R2_ACCESS_KEY_ID --env production
# Create R2 API token: Cloudflare Dashboard → R2 → Manage R2 API Tokens

wrangler secret put R2_SECRET_ACCESS_KEY --env production
# From the same R2 API token
```

### Public vars (edit in infra/wrangler.toml)

```toml
[vars]
ENVIRONMENT = "production"
APP_DOMAIN = "https://app.torrentflow.example.com"
API_DOMAIN = "https://api.torrentflow.example.com"
R2_BUCKET_NAME = "rdm-files"
R2_ACCOUNT_ID = "your-cloudflare-account-id"
R2_ENDPOINT = "https://your-account-id.r2.cloudflarestorage.com"
TURNSTILE_SITE_KEY = "0x4AAAAA..."
MAX_UPLOAD_BYTES = "5368709120"
```

### Replace placeholder IDs in infra/wrangler.toml

```toml
[[d1_databases]]
database_id = "PASTE_D1_ID_HERE"

[[kv_namespaces]]
# RATE_LIMIT_KV
id = "PASTE_RATE_LIMIT_KV_ID"

# CSRF_KV
id = "PASTE_CSRF_KV_ID"
```

---

## Step 3: Run D1 Migrations

```bash
cd apps/api

# Apply all migrations to production
for f in ../../packages/shared/migrations/*.sql; do
  echo "Applying: $f"
  npx wrangler d1 execute rdm-database --env production --file "$f"
done

# Verify
npx wrangler d1 execute rdm-database --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected tables: `api_keys`, `audit_logs`, `blocklist`, `email_verification_tokens`,
`files`, `job_events`, `jobs`, `password_reset_tokens`, `plans`, `sessions`,
`usage_metrics_daily`, `user_plan_assignments`, `users`.

---

## Step 4: Deploy the Workers API

```bash
cd apps/api
npm install

# Type-check first
npm run type-check

# Deploy
npx wrangler deploy --env production

# Verify
curl https://api.torrentflow.example.com/health
# Expected: {"status":"ok","ts":"..."}
```

---

## Step 5: Deploy the Frontend (Cloudflare Pages)

```bash
cd apps/web
npm install

# Set production API URL
echo "VITE_API_BASE_URL=https://api.torrentflow.example.com" > .env.production

npm run build    # Outputs to dist/

# Deploy to Pages
npx wrangler pages deploy dist \
  --project-name torrentflow \
  --branch main
```

Configure environment variable in Cloudflare Dashboard → Pages → torrentflow → Settings → Environment variables:
- `VITE_API_BASE_URL` = `https://api.torrentflow.example.com`

---

## Step 6: Deploy the Compute Agent

### 6a. Build Docker Image

```bash
cd services/compute-agent
docker build -t torrentflow-agent:latest .

# Tag and push to your registry
docker tag torrentflow-agent:latest registry.example.com/torrentflow-agent:latest
docker push registry.example.com/torrentflow-agent:latest
```

### 6b. Create Kubernetes Secret

```bash
kubectl create secret generic torrentflow-agent-secrets \
  --from-literal=WORKER_CLUSTER_TOKEN="<your-token>" \
  --from-literal=CALLBACK_SIGNING_SECRET="<your-secret>" \
  --from-literal=R2_ACCESS_KEY_ID="<r2-access-key>" \
  --from-literal=R2_SECRET_ACCESS_KEY="<r2-secret-key>"
```

### 6c. Apply Kubernetes Deployment

```yaml
# infra/k8s/compute-agent.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: torrentflow-agent
  labels:
    app: torrentflow-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: torrentflow-agent
  template:
    metadata:
      labels:
        app: torrentflow-agent
    spec:
      containers:
        - name: agent
          image: registry.example.com/torrentflow-agent:latest
          ports:
            - containerPort: 8787
          env:
            - name: PORT
              value: "8787"
            - name: WORKER_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: CLOUDFLARE_CALLBACK_URL
              value: "https://api.torrentflow.example.com"
            - name: R2_ENDPOINT
              value: "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com"
            - name: R2_BUCKET
              value: "rdm-files"
            - name: MAX_CONCURRENT_JOBS
              value: "10"
            - name: DOWNLOAD_DIR
              value: "/data/downloads"
            - name: WORKER_CLUSTER_TOKEN
              valueFrom:
                secretKeyRef:
                  name: torrentflow-agent-secrets
                  key: WORKER_CLUSTER_TOKEN
            - name: CALLBACK_SIGNING_SECRET
              valueFrom:
                secretKeyRef:
                  name: torrentflow-agent-secrets
                  key: CALLBACK_SIGNING_SECRET
            - name: R2_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: torrentflow-agent-secrets
                  key: R2_ACCESS_KEY_ID
            - name: R2_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: torrentflow-agent-secrets
                  key: R2_SECRET_ACCESS_KEY
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "4Gi"
              cpu: "4"
          volumeMounts:
            - name: download-storage
              mountPath: /data/downloads
          livenessProbe:
            httpGet:
              path: /agent/health
              port: 8787
            initialDelaySeconds: 10
            periodSeconds: 30
      volumes:
        - name: download-storage
          emptyDir:
            sizeLimit: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: torrentflow-agent-svc
spec:
  selector:
    app: torrentflow-agent
  ports:
    - port: 8787
      targetPort: 8787
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: torrentflow-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: torrentflow-agent
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

```bash
kubectl apply -f infra/k8s/compute-agent.yaml
kubectl rollout status deployment/torrentflow-agent
```

### 6d. Register Agent with Wrangler Secret

The `WORKER_CLUSTER_URL` secret should point to the Kubernetes service (via Cloudflare Tunnel or internal load balancer):

```bash
wrangler secret put WORKER_CLUSTER_URL --env production
# Enter: https://agent-internal.torrentflow.example.com
```

---

## Step 7: Verify System Health End-to-End

```bash
# 1. API health
curl -s https://api.torrentflow.example.com/health | jq .

# 2. Auth (register a test user)
curl -s -X POST https://api.torrentflow.example.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","turnstileToken":"test","acceptedAup":true}' | jq .

# 3. Login
TOKEN=$(curl -s -X POST https://api.torrentflow.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","turnstileToken":"test"}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt -w "%{http_code}" | tail -1)
echo "Login HTTP status: $TOKEN"

# 4. Submit a job (magnet link — use a public, legal torrent)
curl -s -X POST https://api.torrentflow.example.com/jobs \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $(cat /tmp/csrf.txt)" \
  -b /tmp/cookies.txt \
  -d '{"type":"magnet","magnetUri":"magnet:?xt=urn:btih:a04e6cdb4d64c7d1df5d13cf2e6e0c27b2aae12f&dn=Ubuntu+24.04"}' | jq .

# 5. List jobs
curl -s -b /tmp/cookies.txt https://api.torrentflow.example.com/jobs | jq .

# 6. Admin health check (must be logged in as admin)
curl -s -b /tmp/cookies.txt https://api.torrentflow.example.com/admin/system-health | jq .

# 7. Compute agent health (internal network)
curl -s -H "Authorization: Bearer $WORKER_CLUSTER_TOKEN" \
  https://agent-internal.torrentflow.example.com/agent/health | jq .
```

---

## Troubleshooting Checklist

| Symptom | Check |
|---|---|
| `500` on all API routes | `wrangler tail` for Worker errors; check D1 binding |
| Login returns 401 | D1 migrations not applied; Turnstile secret wrong |
| Jobs stuck in `queued` | Queue Consumer deployed? `wrangler queues list` |
| No SSE updates | Durable Object bindings in wrangler.toml; DO migration tag applied |
| R2 upload fails | R2 access key valid? Check `R2_ENDPOINT` in agent .env |
| Compute agent unreachable | Check `WORKER_CLUSTER_URL` secret + Cloudflare Tunnel |
| Frontend shows blank | `VITE_API_BASE_URL` set in Pages env? CORS headers on API? |
| Rate limits firing incorrectly | KV namespace IDs correct in wrangler.toml? |

See [docs/runbooks.md](docs/runbooks.md) for detailed incident response guides.
