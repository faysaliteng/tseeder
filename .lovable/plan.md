
# Working Instructions: tseeder Deployment (Cloudflare x DigitalOcean)

Create a new file `WORKING-INSTRUCTIONS.md` at the project root documenting the complete, tested A-to-Z deployment procedure based on what was actually done and verified working.

## Document Structure

The file will cover these sections in order:

### 1. Overview and Architecture
- Frontend: Cloudflare Pages (fseeder.cc)
- Backend API: Cloudflare Workers (api.fseeder.cc)
- Database: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2 (S3-compatible)
- Queues: Cloudflare Queues (job dispatch + DLQ)
- Real-time: Durable Objects (SSE progress streaming)
- Compute Agent: DigitalOcean VM running Node.js 20 with WebTorrent

### 2. Prerequisites
- Windows 11 + VS Code + PowerShell (for development)
- Cloudflare account on Workers Paid plan
- DigitalOcean droplet (Ubuntu 24.04, minimum 1 vCPU / 2 GB RAM)
- Domain registered and DNS managed by Cloudflare

### 3. Cloudflare Setup (Steps 1-9)
- Wrangler login
- Create D1, R2, Queues, KV namespaces
- Edit wrangler.toml with real IDs
- Run D1 migrations
- Generate and set all secrets (SESSION_SECRET, CSRF_SECRET, CALLBACK_SIGNING_SECRET, WORKER_CLUSTER_TOKEN, R2 keys, WORKER_CLUSTER_URL)
- Deploy backend Worker
- Deploy frontend to Pages (manual CLI or GitHub auto-deploy)
- DNS records (api CNAME, root CNAME)

### 4. DigitalOcean VM Setup (the part that required debugging)
- SSH into VM
- Install Node.js 20 (NOT Bun -- documented why: `node-datachannel` requires full libuv, Bun crashes with `uv_timer_init` panic)
- Install tsx locally
- Copy compute-agent source files
- Install npm dependencies including `node-datachannel` built from source
- Create `/etc/tseeder-agent.env` with all required variables
- Update systemd service to use `node --import tsx` instead of `bun run`
- Handle systemd security hardening (ReadWritePaths for download directory)
- Start and verify agent

### 5. Connecting Agent to API
- Set WORKER_CLUSTER_URL secret on Cloudflare to point to VM IP
- Redeploy Worker to activate new secret
- Verify via Admin > Infrastructure panel

### 6. Turnstile Removal
- Document that Turnstile was removed due to hostname mismatch issues
- List all files that were modified

### 7. Everyday Operations
- Redeploy backend command
- Redeploy frontend command
- View live logs
- Change a secret
- Check database
- Restart compute agent
- View agent logs

### 8. Troubleshooting (real issues we hit)
- Bun crashes with `uv_timer_init` -- switch to Node.js 20
- `tsx` not found by systemd -- install locally, not globally
- `ERR_MODULE_NOT_FOUND` for tsx -- npm install tsx in project dir
- `.env.production` UTF-16 on Windows -- use WriteAllText
- CORS errors -- APP_DOMAIN must match
- Agent shows "Unreachable" -- check WORKER_CLUSTER_TOKEN match, trailing slashes, CALLBACK_SIGNING_SECRET
- Secrets don't take effect -- must redeploy Worker after setting secrets

## Technical Details

- Single new file: `WORKING-INSTRUCTIONS.md` at project root
- Approximately 400-500 lines of markdown
- All commands are copy-paste ready
- Includes the exact working systemd ExecStart line: `/usr/bin/node --import tsx /opt/tseeder-agent/src/index.ts`
- Documents the correct `/etc/tseeder-agent.env` format with all required variables
- Notes the firewall requirement (port 8787 open for Cloudflare callbacks)
