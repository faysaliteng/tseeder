# Fix: Download Pipeline Stuck at metadata_fetch

## Problem

The job gets created and dispatched to the compute agent successfully (the agent returns 202), but then **every progress callback from the agent is rejected** by the API with a 400 error. The job stays stuck at `metadata_fetch` forever with 0 speed.

## Root Cause

The WebTorrent engine sends `eta: -1` when the ETA is unknown (which it always is during the metadata phase). But the Zod validation schema (`CallbackProgressSchema`) requires `eta: z.number().min(0)` — meaning **-1 is rejected**.

Every callback the agent sends gets a 400 response. The agent retries 5 times, gives up, and the job stays stuck.

## Fix (2 files to change)

### 1. Clamp `eta` to 0 in the agent (workers/compute-agent/src/routes/start.ts)

In the `runDownloadPipeline` function, clamp `eta` before sending callbacks:

Change the progress callback spread from:

```
...progress,
```

to explicitly clamp eta:

```
progressPct: progress.progressPct,
downloadSpeed: progress.downloadSpeed,
uploadSpeed: progress.uploadSpeed,
peers: progress.peers,
seeds: progress.seeds,
bytesDownloaded: progress.bytesDownloaded,
bytesTotal: progress.bytesTotal,
eta: Math.max(0, progress.eta),
```

### 2. Also allow -1 in the schema as a safety net (packages/shared/src/schemas.ts)

Change:

```
eta: z.number().min(0),
```

to:

```
eta: z.number().min(-1),
```

## Deployment Steps (for you, the user)

After I make these changes and they get pushed to GitHub:

1. **Frontend** auto-deploys via Cloudflare Pages (nothing for you to do)
2. **API Worker** — run from your local machine:

```powershell
cd C:\Users\saimo\Downloads\tseeder\tseeder-main\tseeder-main\apps\api
npx wrangler deploy src/index.ts --config ../../infra/wrangler.toml --env production
```

3. **Compute Agent on VM** — SSH into your DigitalOcean droplet and update:

```bash
cd /opt/tseeder-agent
# Pull the updated start.ts file (or copy it manually)
sudo systemctl restart tseeder-agent
```

Then submit a new magnet link and it should start downloading with speed showing.  
  
  
remember that i am a noob. and i am deplloying backend from local machine vs code. so if anyhting need to chnage in backaned, you need to tell me and what to look for and what to add or replace. then step by step