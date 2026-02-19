-- ─── Real full-length blog article bodies ─────────────────────────────────────
-- Fixes slug mismatches from 0006 and writes complete long-form article content.
-- Safe to run multiple times (ON CONFLICT DO UPDATE).

-- Remove old rows with wrong slugs so the correct ones below can be inserted
DELETE FROM articles WHERE slug IN (
  'stremio-plugin-setup',
  'sonarr-radarr-automation',
  'webdav-mount',
  'streaming-vlc-kodi',
  'api-automation',
  'tseeder-vs-seedr-premiumize',
  'qbittorrent-remote',
  'privacy-ip-protection'
);

-- ─── 1 ─── Stremio plugin setup ──────────────────────────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'stremio-plugin-setup',
  'How to Set Up the tseeder Stremio Plugin: The Complete Guide',
  'Connect tseeder to Stremio and stream your torrents directly without waiting for downloads to finish.',
  'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1200&h=630&fit=crop&q=80',
  'Tutorials · How-Tos',
  '7 min',
  'published',
  '2026-02-10',
  '## What You Will Build

By the end of this guide, Stremio will use tseeder as its torrent back-end. Every time Stremio finds a stream via its torrent addons, the actual download happens in our cloud and the media is served back as an HTTP stream — your IP never touches a peer.

---

## Prerequisites

- A tseeder account (free tier is fine to start)
- Stremio v4.4 or later installed on any device
- An active tseeder API key (Settings → API Keys → Create key)

---

## Step 1 — Generate Your API Key

Log in to tseeder and open **Settings → API Keys**. Click **Create key**, give it a name like `stremio`, and copy the key. It looks like:

```
tsdr_live_a1b2c3d4e5f6g7h8i9j0
```

Store it somewhere safe — it will not be shown again.

---

## Step 2 — Install the tseeder Stremio Addon

The addon is installed through Stremio''s community addon mechanism. There are two ways:

### Method A — Install from the tseeder Dashboard

1. In the tseeder dashboard go to **Settings → Integrations → Stremio**
2. Click **Install in Stremio** — the button generates a deep-link and opens it in Stremio
3. Confirm the installation prompt

### Method B — Manual URL Install

Open Stremio and navigate to the **Addons** screen. Paste the following URL into the "Community Addons" search box:

```
https://api.tseeder.com/stremio/manifest.json?token=YOUR_API_KEY
```

Replace `YOUR_API_KEY` with the key you generated in Step 1. Stremio will display the addon details — click **Install**.

---

## Step 3 — Verify the Addon Is Active

After installation, the tseeder addon should appear under **Addons → Installed**. You should see three capabilities listed:

- `stream` — provides torrent-backed streams for movie/series catalogs
- `subtitles` — passes subtitle files from the torrent
- `catalog` — shows your tseeder vault as a Stremio library

If the addon shows an error, double-check that your API key is correct and has not been revoked.

---

## Step 4 — Test a Stream

Search for any movie in Stremio. In the stream selection popup, scroll to the **tseeder** section. Click a stream to start. Stremio will:

1. Send the magnet link to tseeder
2. tseeder queues the job and begins downloading in the cloud
3. As soon as the first few percent is downloaded, tseeder opens an HTTP range-request endpoint
4. Stremio buffers from that endpoint — playback starts in seconds

---

## Step 5 — Subtitle Configuration

tseeder automatically passes `.srt` and `.ass` subtitle files that are part of the torrent alongside the video stream. To ensure Stremio picks them up:

1. Go to Stremio **Settings → Player**
2. Enable **"Subtitles from addon sources"**
3. Set **Language** to your preferred language

---

## Buffering & Quality Tips

| Setting | Recommended Value |
|---------|------------------|
| Player buffer size | 2 048 MB (2 GB) |
| Hardware decoding | On |
| Stream quality | Auto (let tseeder select the fastest peer) |

If you experience buffering, the issue is almost always the buffer size. Stremio defaults to 512 MB which is too small for 4K streams.

---

## Troubleshooting

**No tseeder streams appear in search results**
→ The addon may have failed to install. Uninstall and reinstall using Method B above.

**"Job failed" error in tseeder dashboard**
→ The torrent may have no healthy seeds. Try a different stream in Stremio.

**Buffering stops at the same point every time**
→ The compute agent hit a storage limit. Check your quota under **Settings → Plan**.

**Stremio on Android / Apple TV does not see the addon**
→ Stremio syncs addons across devices. Open Stremio on your desktop first and install there; it will propagate within a few minutes.

---

## Summary

You now have Stremio using tseeder as a transparent cloud torrent back-end. Every stream request is routed through our Cloudflare edge infrastructure, your ISP sees only HTTPS traffic, and completed files stay available in your vault for the duration of your plan''s retention period.'
);

-- ─── 2 ─── Sonarr & Radarr automation ────────────────────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'sonarr-radarr-automation',
  'How to Automate Your Media Library with Sonarr & Radarr',
  'Point Sonarr and Radarr at tseeder as your download client and let automation handle the rest.',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=80',
  'Tutorials · How-Tos',
  '11 min',
  'published',
  '2026-01-25',
  '## Overview

Sonarr monitors RSS feeds and auto-downloads new episodes of your favourite shows. Radarr does the same for movies. Both tools support pluggable download clients — and tseeder is a fully supported client that routes all BitTorrent traffic through the cloud.

The result: Sonarr/Radarr run as usual, but instead of qBittorrent on your home machine, jobs are executed by tseeder''s infrastructure. Your home IP is never involved.

---

## Prerequisites

- Sonarr v3 or v4 (the process is identical for both)
- Radarr v4 or later
- A tseeder Pro or Business account (the automation integration requires API key access)
- tseeder API key (Settings → API Keys)

---

## Part 1 — Configure tseeder as a Download Client in Sonarr

### 1.1 Open Download Client Settings

In Sonarr, navigate to **Settings → Download Clients** and click the **+** icon.

### 1.2 Select tseeder

Scroll down to the **Custom** section and select **qBittorrent**. tseeder implements the full qBittorrent WebUI protocol, so the built-in plugin works perfectly.

### 1.3 Enter Connection Details

| Field | Value |
|-------|-------|
| Name | tseeder |
| Host | `qbt.tseeder.com` |
| Port | `443` |
| Use SSL | ✓ Enabled |
| Username | Your tseeder email address |
| Password | A generated app password (Settings → Integrations → App Passwords) |
| Category | `sonarr` |

Click **Test** — you should see a green checkmark. Then click **Save**.

### 1.4 Set Remote Path Mappings

Sonarr needs to know where completed files appear after download. Since tseeder exposes files over WebDAV, map:

- **Remote path**: `/sonarr/` (tseeder''s virtual folder for this category)
- **Local path**: the path your media server expects, e.g. `/media/tv/`

If you have not yet mounted the WebDAV share, see our [WebDAV mounting guide](/blog/mount-webdav-sftp).

---

## Part 2 — Configure Radarr

The process is identical to Sonarr. In Radarr:

1. **Settings → Download Clients → +**
2. Select **qBittorrent**
3. Use the same host/port/credentials as above
4. Change **Category** to `radarr`
5. Map Remote path `/radarr/` → your movies folder

---

## Part 3 — Quality Profiles & Indexers

### Indexers

tseeder is indexer-agnostic — it accepts any magnet link that Sonarr/Radarr produce. Configure your preferred indexers (Prowlarr, Jackett, etc.) as usual.

### Quality Profiles

Set quality profiles as you normally would. tseeder handles all file sizes and codecs. For 4K/HDR content, ensure your plan has sufficient storage.

### Preferred Words / Custom Formats

Custom formats work normally since Sonarr/Radarr score releases independently before handing the magnet to tseeder.

---

## Part 4 — Testing the Full Flow

1. In Sonarr, find a monitored series and click **Interactive Search**
2. Manually grab a release
3. Watch the **Queue** in Sonarr — it should show the job with tseeder as the client
4. In the tseeder dashboard, navigate to **Downloads** — the job should appear within seconds
5. Once complete, Sonarr imports the file from the WebDAV mount

The entire flow is automatic after this point — Sonarr and Radarr operate exactly as they would with a local client.

---

## Troubleshooting

**Sonarr shows "Download client tseeder is unavailable"**
→ Check that your app password is correct and the qBittorrent bridge is enabled in Settings.

**Files are not imported after download completes**
→ Verify your remote path mapping. The category folder must match exactly.

**Download stuck at 0%**
→ The torrent has no seeds. Sonarr will retry automatically when a seeded release becomes available.

**Storage quota exceeded**
→ Files from old jobs count toward your quota. Delete completed jobs in tseeder to free space, or upgrade your plan.'
);

-- ─── 3 ─── Mount WebDAV/SFTP ─────────────────────────────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'mount-webdav-sftp',
  'How to Mount tseeder Like a Drive (FTP, SFTP & WebDAV)',
  'Mount your tseeder vault as a local drive on Windows, macOS, or Linux using WebDAV, SFTP, or rclone. Once mounted, files appear in Finder or Explorer just like a local disk — no downloads required.',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop&q=80',
  'Tutorials · How-Tos',
  '9 min',
  'published',
  '2026-01-19',
  '## Why Mount Your Vault?

Mounting tseeder as a drive means you can:

- **Browse** all your completed files in Finder, Explorer, or any file manager
- **Stream** directly to VLC, Infuse, Kodi, or any media player that supports network paths
- **Use tseeder as a NAS** — plug it into Plex, Jellyfin, or Emby
- **Sync selectively** with rclone — copy only the files you actually want locally

No downloads required for browsing. Files are fetched on demand.

---

## Protocols Supported

| Protocol | Plans | Best for |
|----------|-------|---------|
| WebDAV (HTTPS) | All plans | Universal, works everywhere |
| SFTP | Pro, Business | CLI tools, rsync, FileZilla |
| rclone | All plans | Advanced sync, mounting, scripting |

---

## Part 1 — WebDAV

Enable WebDAV under **Settings → Integrations → WebDAV**. Note your WebDAV URL — it will look like:

```
https://webdav.tseeder.com/u/your-username/
```

Generate an **app password** under **Settings → Integrations → App Passwords** (do not use your account password for WebDAV).

### Windows

1. Open **File Explorer**
2. Right-click **This PC** → **Map network drive…**
3. Choose a drive letter (e.g. `T:`)
4. In the Folder field enter your WebDAV URL
5. Check **Connect using different credentials**
6. Enter your tseeder email and app password
7. Click Finish

Windows mounts the drive and it appears in This PC immediately.

### macOS

1. In Finder press **⌘K** (Connect to Server…)
2. Enter your WebDAV URL
3. Click **Connect** and authenticate with your email and app password

The vault appears in the Finder sidebar under **Locations**.

### Linux — davfs2

```bash
# Install
sudo apt install davfs2   # Debian/Ubuntu
sudo dnf install davfs2   # Fedora

# Create a mount point
sudo mkdir -p /mnt/tseeder

# Mount
sudo mount -t davfs https://webdav.tseeder.com/u/your-username/ /mnt/tseeder

# You will be prompted for username (your email) and password (app password)
```

For permanent mounts, add to `/etc/fstab`:

```
https://webdav.tseeder.com/u/your-username/ /mnt/tseeder davfs user,noauto 0 0
```

---

## Part 2 — rclone (Recommended for Power Users)

rclone gives you the most control — you can mount, sync, copy, and script your vault.

### Install rclone

```bash
curl https://rclone.org/install.sh | sudo bash
```

### Configure

```bash
rclone config
```

Follow the prompts:
- **Type**: `webdav`
- **URL**: `https://webdav.tseeder.com/u/your-username/`
- **Vendor**: `other`
- **User**: your tseeder email
- **Password**: your app password (rclone will obscure it)
- **Name**: `tseeder` (or any name you like)

### Mount

```bash
mkdir -p ~/tseeder
rclone mount tseeder: ~/tseeder \
  --vfs-cache-mode full \
  --vfs-cache-max-age 24h \
  --buffer-size 256M \
  --daemon
```

The `--vfs-cache-mode full` flag buffers full files for seamless streaming. Reduce to `writes` for lower disk usage.

### Sync

Copy all files from a specific job folder to your local machine:

```bash
rclone copy tseeder:completed/my-movie/ ~/Downloads/my-movie/ -P
```

---

## Part 3 — SFTP (Pro and Business)

SFTP access is available on Pro and Business plans.

### Generate an SSH Key

In tseeder go to **Settings → SSH Keys → Add key**. Paste your public key (`~/.ssh/id_ed25519.pub`).

### Connect with FileZilla

| Field | Value |
|-------|-------|
| Protocol | SFTP |
| Host | `sftp.tseeder.com` |
| Port | `22` |
| Logon Type | Key file |
| User | your tseeder email |
| Key file | path to your private key |

### Connect from Terminal

```bash
sftp -i ~/.ssh/id_ed25519 you@example.com@sftp.tseeder.com
```

---

## Streaming via Mounted Drive

Once mounted, open any media player and point it at the mount path:

- **VLC** — Media → Open File → navigate to `/mnt/tseeder/completed/`
- **Plex** — add `/mnt/tseeder/` as a library folder
- **Jellyfin** — same as Plex

Files stream on demand — only the parts you are playing are downloaded.'
);

-- ─── 4 ─── Stream in VLC & Kodi ──────────────────────────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'stream-vlc-kodi',
  'Streaming tseeder Files Directly in VLC and Kodi',
  'Generate a signed streaming URL from tseeder and open it in VLC, Kodi, or Infuse without downloading a single byte locally.',
  'https://images.unsplash.com/photo-1586899028174-e7098604235b?w=1200&h=630&fit=crop&q=80',
  'Guides',
  '5 min',
  'published',
  '2026-01-08',
  '## How tseeder Streaming Works

tseeder stores all completed files in Cloudflare R2 — our encrypted object store. To stream a file, tseeder generates a **signed URL**: a time-limited HTTPS link that points directly to the file bytes. No authentication header is needed — the signature is embedded in the URL query string.

Signed URLs support HTTP range requests, which means any media player that supports seeking (VLC, Kodi, Infuse, MPV) can jump to any position in the file instantly.

---

## Method 1 — Dashboard (No Code Needed)

1. Open the tseeder dashboard and navigate to **Downloads**
2. Click on any completed job to expand it
3. Click the file you want to stream
4. Click **Copy stream URL** (the link icon)
5. A signed URL valid for **1 hour** is copied to your clipboard

Paste it directly into your media player.

---

## Method 2 — API

Generate a signed URL for any file programmatically:

```bash
curl -X POST https://api.tseeder.com/files/FILE_ID/signed-url \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d ''{"expiresIn": 7200, "disposition": "inline"}''
```

Response:

```json
{
  "url": "https://files.tseeder.com/r2/abc123?X-Amz-Signature=...",
  "expiresAt": "2026-02-10T14:00:00Z"
}
```

The `expiresIn` field accepts any value from 60 seconds to 86 400 seconds (24 hours). Set `disposition` to `attachment` to force a browser download.

---

## Opening in VLC

### Desktop

1. In VLC go to **Media → Open Network Stream** (shortcut: `Ctrl+N` / `⌘N`)
2. Paste the signed URL
3. Click **Play**

VLC will buffer the first few seconds and begin playback. You can seek freely — VLC sends range requests and tseeder fulfils them from R2.

### VLC on iOS / Android

1. Open VLC
2. Tap the **Network** tab
3. Paste the URL and tap **Open Network Stream**

---

## Opening in Kodi

1. In Kodi go to **Videos → Files → Add videos…** (for permanent sources) or press `Y` on any empty list entry
2. Alternatively, for one-off playback: navigate to **Videos → Enter location** and paste the URL
3. Kodi begins buffering immediately

For persistent Kodi integration, use the **WebDAV mount** approach instead — it exposes all your tseeder files as a Kodi library source. See the [WebDAV guide](/blog/mount-webdav-sftp).

---

## Opening in Infuse (Apple TV, iPhone, iPad)

1. Open Infuse and tap **+** (Add Files)
2. Select **URL**
3. Paste the signed URL and tap **Add**

Infuse supports HDR, Dolby Vision, and multi-track audio out of the box — tseeder serves the raw file bytes unchanged.

---

## Opening in MPV (Linux / macOS Power Users)

```bash
mpv "https://files.tseeder.com/r2/abc123?X-Amz-Signature=..."
```

MPV supports every codec and container. Pass `--cache=yes --cache-secs=120` for smoother playback on slower connections.

---

## Automating Stream URLs

If you use tseeder with Sonarr/Radarr/Plex, you do not need manual signed URLs — mount the WebDAV share and your media server streams directly from the mount. Signed URLs are best for **ad-hoc playback** or **sharing** a single file temporarily.

---

## Security Notes

- Signed URLs are time-limited and single-user. Do not share them publicly.
- Each URL contains your user ID in the path. If you accidentally publish a URL, revoke it by deleting the job in the dashboard (this invalidates all existing signed URLs for that job).
- Signed URLs are served over HTTPS with TLS 1.3. The content is encrypted in transit.'
);

-- ─── 5 ─── API automation guide ──────────────────────────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'api-automation-guide',
  'Using the tseeder API: Automate Downloads from Any Script',
  'tseeder exposes a full REST API so you can submit magnet links, poll job progress, and retrieve signed download URLs from Python, Node.js, or any HTTP client.',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop&q=80',
  'Developer',
  '13 min',
  'published',
  '2025-12-20',
  '## Introduction

The tseeder REST API gives programmatic access to every feature in the dashboard. This guide walks through the most important endpoints with working code examples in Python and Node.js.

**Base URL**: `https://api.tseeder.com`

All requests require an API key in the `Authorization` header:

```
Authorization: Bearer tsdr_live_xxxxxxxxxxxxxxxxxxxx
```

Generate a key under **Settings → API Keys** in the dashboard.

---

## Authentication

### Create a client (Python)

```python
import httpx

API_KEY = "tsdr_live_xxxxxxxxxxxxxxxxxxxx"

client = httpx.Client(
    base_url="https://api.tseeder.com",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30.0,
)
```

### Create a client (Node.js / TypeScript)

```typescript
import fetch from "node-fetch";

const API_KEY = "tsdr_live_xxxxxxxxxxxxxxxxxxxx";
const BASE = "https://api.tseeder.com";

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}
```

---

## Submitting a Magnet Link

```python
job = client.post("/jobs", json={
    "type": "magnet",
    "magnetUri": "magnet:?xt=urn:btih:a1b2c3d4e5f6g7h8i9j0&dn=Example+File",
}).raise_for_status().json()

job_id = job["id"]
print(f"Job created: {job_id} — status: {job['status']}")
```

The response contains the full job object:

```json
{
  "id": "01j8xyz...",
  "status": "queued",
  "magnetUri": "magnet:?xt=urn:btih:...",
  "progressPct": 0,
  "createdAt": "2026-02-10T09:00:00Z"
}
```

---

## Submitting a .torrent File

```python
with open("linux-mint.torrent", "rb") as f:
    job = client.post(
        "/jobs",
        content=f.read(),
        headers={"Content-Type": "application/x-bittorrent"},
    ).raise_for_status().json()
```

---

## Polling Job Progress

### Simple polling loop (Python)

```python
import time

def wait_for_job(job_id: str, interval: int = 5) -> dict:
    while True:
        job = client.get(f"/jobs/{job_id}").raise_for_status().json()
        print(
            f"Status: {job['status']:20s} | "
            f"Progress: {job['progressPct']:5.1f}% | "
            f"Speed: {job.get('downloadSpeedBytesPerSec', 0) // 1024} KB/s"
        )
        if job["status"] in ("completed", "failed", "cancelled"):
            return job
        time.sleep(interval)

result = wait_for_job(job_id)
```

### Server-Sent Events (real-time, recommended)

For real-time progress without polling, connect to the SSE endpoint:

```python
import sseclient

with client.stream("GET", f"/do/job/{job_id}/sse") as response:
    for event in sseclient.SSEClient(response).events():
        data = json.loads(event.data)
        print(f"Progress: {data[''progressPct'']}%")
        if data["status"] in ("completed", "failed"):
            break
```

---

## Job State Machine

Jobs transition through these states in order:

```
queued → dispatched → downloading → seeding → completed
                                 ↘ failed
                                 ↘ cancelled
```

| State | Meaning |
|-------|---------|
| `queued` | Waiting for a compute agent |
| `dispatched` | Assigned to an agent, starting download |
| `downloading` | Active BitTorrent download in progress |
| `seeding` | Download complete, uploading to R2 |
| `completed` | Files available in your vault |
| `failed` | Permanent error — check `errorMessage` field |
| `cancelled` | Cancelled by user |

---

## Listing Files for a Job

```python
files_resp = client.get(f"/jobs/{job_id}/files").raise_for_status().json()

for f in files_resp["files"]:
    print(f"{f['name']:50s} {f['sizeMb']:.1f} MB")
```

---

## Generating Signed Download URLs

```python
for f in files_resp["files"]:
    url_data = client.post(
        f"/files/{f['id']}/signed-url",
        json={"expiresIn": 3600},
    ).raise_for_status().json()
    print(f"Download: {url_data['url']}")
```

URLs are valid for `expiresIn` seconds (max 86 400). After expiry they return HTTP 403.

---

## Cancelling a Job

```python
client.delete(f"/jobs/{job_id}").raise_for_status()
print("Job cancelled")
```

---

## Listing All Jobs

```python
jobs = client.get("/jobs", params={"limit": 20, "status": "completed"}).raise_for_status().json()
for j in jobs["jobs"]:
    print(f"{j['id']} — {j['name']} — {j['status']}")
```

---

## Webhooks

Instead of polling, register a webhook to be called when a job state changes:

```python
client.post("/webhooks", json={
    "url": "https://yourserver.com/hooks/tseeder",
    "events": ["job.completed", "job.failed"],
    "secret": "your-hmac-secret",
}).raise_for_status()
```

tseeder signs each webhook request with HMAC-SHA256. Verify the `X-tseeder-Signature` header:

```python
import hmac, hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## Rate Limits

| Plan | Requests / minute |
|------|------------------|
| Free | 60 |
| Pro | 300 |
| Business | 1 000 |

When you exceed the limit, the API returns `429 Too Many Requests` with a `Retry-After` header.'
);

-- ─── 6 ─── Comparison: tseeder vs Seedr vs Premiumize ────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'comparison-seedr-premiumize',
  'tseeder vs. Seedr.cc vs. Premiumize: Which Cloud Downloader Is Right for You?',
  'We compare tseeder, Seedr.cc, and Premiumize across storage limits, speed, pricing, API access, and privacy policy.',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop&q=80',
  'Comparison',
  '8 min',
  'published',
  '2025-12-05',
  '## The Contenders

In 2025-2026, three services dominate the cloud torrent space: **tseeder**, **Seedr.cc**, and **Premiumize**. All three take your magnet links, download the torrent in their datacenter, and serve you the finished file — keeping your home IP out of the swarm.

But they differ significantly in storage, pricing, API quality, and privacy posture. Here is the full breakdown.

---

## Storage & Bandwidth

| Feature | tseeder | Seedr.cc | Premiumize |
|---------|---------|----------|------------|
| Free storage | 5 GB | 2 GB | None |
| Entry paid plan | 2 TB | 500 GB | 1 TB |
| Bandwidth | Unmetered | Metered (downloads count) | Metered (fair use) |
| File retention (free) | 7 days | 7 days | — |
| File retention (paid) | 30–90 days | 30 days | Unlimited* |
| Concurrent jobs (free) | 1 | 1 | 0 |

*Premiumize stores files "forever" but enforces a fair-use policy with no published limit.

---

## Speed

tseeder runs on the Cloudflare edge network, meaning compute agents connect to peers from multiple geographic locations simultaneously — significantly improving torrent speeds for popular content.

Seedr.cc uses a single data-center cluster in Germany. For users in Europe the speed is comparable. For US/Asia users, downloads can be noticeably slower.

Premiumize operates a cluster in Austria with additional nodes in the US. Their hosters (usenet/direct downloads) are fast, but BitTorrent speeds vary more than tseeder.

---

## API Access

This is where tseeder pulls ahead decisively.

| API Feature | tseeder | Seedr.cc | Premiumize |
|-------------|---------|----------|------------|
| Full documented REST API | ✓ | Unofficial only | Partial |
| API key auth | ✓ | Cookie-based | API key |
| Signed download URLs | ✓ | No | ✓ |
| Webhook events | ✓ | No | No |
| SSE real-time progress | ✓ | No | No |
| qBittorrent protocol bridge | ✓ | No | No |
| WebDAV mount | ✓ | No | ✓ |
| SFTP access | ✓ (Pro+) | No | No |
| Rate limits | 60–1000 req/min | Very limited | 100 req/min |

If you are a developer building on top of a cloud downloader, tseeder is the only service with a production-grade API.

---

## Pricing (as of 2026-02-01)

| Plan | tseeder | Seedr.cc | Premiumize |
|------|---------|----------|------------|
| Free | ✓ 5 GB | ✓ 2 GB | — |
| Entry paid | $4.99/mo · 2 TB | $6.99/mo · 500 GB | $9.99/mo · 1 TB |
| Power plan | $9.99/mo · Unlimited | $12.99/mo · 1 TB | $19.99/mo · Unlimited |

tseeder offers the best GB-per-dollar at every tier.

---

## Privacy

All three services proxy your BitTorrent traffic, so your home IP never touches a peer. The differences are in what they log.

**tseeder**
- Logs job metadata (infohash, timestamp, user ID) for DMCA compliance
- Does not log peer IPs or swarm data beyond what is required
- Infrastructure is Cloudflare-based; subject to Cloudflare''s DPA
- Open about logging policy in the Privacy Policy

**Seedr.cc**
- Similar logging policy
- Servers based in Germany (EU GDPR protections apply)
- Less transparent about infrastructure

**Premiumize**
- Based in Austria (EU)
- Explicitly states it logs infohashes for 14 days
- Has received DMCA notices; maintains a repeat-infringer policy

---

## Supported Content Types

All three support:
- Magnet links
- .torrent files
- Direct HTTP/HTTPS downloads (not just torrents)

tseeder additionally supports:
- Torrent file upload via drag-and-drop
- URL queuing from the browser extension (right-click → Send to tseeder)

---

## Verdict

**Choose tseeder if:**
- You are a developer who wants API/webhook/SSE integration
- You use Sonarr, Radarr, Stremio, or any automation tool
- You want the best storage-per-dollar and unmetered bandwidth
- You want WebDAV/SFTP mount support

**Choose Seedr.cc if:**
- You are a casual user who wants a simple web UI with no setup
- You primarily need free storage for small files

**Choose Premiumize if:**
- You heavily use Usenet (their hoster acceleration is strong)
- You want multi-hoster support for direct link downloads'
);

-- ─── 7 ─── qBittorrent remote control bridge ─────────────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'qbittorrent-remote-bridge',
  'Setting Up tseeder with qBittorrent''s Remote Control Interface',
  'The tseeder remote-client bridge lets existing qBittorrent-compatible apps talk to your tseeder account using the native qBittorrent WebUI protocol — no app changes needed.',
  'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&h=630&fit=crop&q=80',
  'Tutorials · How-Tos',
  '6 min',
  'published',
  '2025-11-18',
  '## What Is the qBittorrent Bridge?

qBittorrent exposes a WebUI HTTP API that dozens of apps use to control it remotely — everything from mobile dashboards to download automation tools. tseeder implements this same API protocol behind a compatibility layer.

The result: any app that talks to qBittorrent also talks to tseeder — without any modification or special plugin. Your app thinks it is talking to qBittorrent; tseeder translates every call into its own API and executes the job in the cloud.

---

## Enable the Bridge

1. Log in to tseeder and go to **Settings → Integrations**
2. Find **qBittorrent Bridge** and toggle it **On**
3. Generate an **app password** (do not use your main account password)
4. Note your connection details:

| Field | Value |
|-------|-------|
| Host | `qbt.tseeder.com` |
| Port | `443` |
| Protocol | HTTPS |
| Username | Your tseeder email |
| Password | The app password you just generated |

---

## Supported Apps

### nzb360 (Android)

nzb360 is the gold-standard qBittorrent remote client for Android. Configure it as follows:

1. Open nzb360 → **Settings → qBittorrent**
2. Enter the host, port, username, and password from above
3. Enable **HTTPS**
4. Tap **Test Connection** — it should show "Connected"

nzb360 full feature support:
- ✓ Add/remove torrents
- ✓ Pause/resume
- ✓ View progress, speed, ETA
- ✓ Labels and categories
- ✓ File priority within a torrent

### Flud (Android)

Flud is a simpler option focused on torrent management:

1. Open Flud → **Settings → Remote → qBittorrent**
2. Enter host, port, credentials
3. Enable SSL and save

### LunaSea (iOS/Android)

LunaSea is a unified media management app that supports qBittorrent along with Sonarr, Radarr, and others.

1. Open LunaSea → **Settings → Clients → qBittorrent → Add**
2. Enter connection details

### Sonarr and Radarr

As documented in the [Sonarr/Radarr guide](/blog/sonarr-radarr-automation), both tools use the qBittorrent download client plugin. This means the bridge is what powers that integration.

### Web Browser

You can also use the official qBittorrent WebUI in a browser:

```
https://qbt.tseeder.com/
```

Log in with your tseeder email and app password. The familiar qBittorrent interface appears with your tseeder jobs listed as torrents.

---

## API Endpoints Supported

The bridge implements the full qBittorrent v2 API surface that most apps use:

| Endpoint | Status |
|---------|--------|
| `GET /api/v2/torrents/info` | ✓ Full support |
| `POST /api/v2/torrents/add` | ✓ Magnet + .torrent file |
| `POST /api/v2/torrents/delete` | ✓ With/without data |
| `POST /api/v2/torrents/pause` | ✓ |
| `POST /api/v2/torrents/resume` | ✓ |
| `GET /api/v2/torrents/files` | ✓ |
| `GET /api/v2/app/version` | ✓ Returns tseeder version |
| `GET /api/v2/transfer/info` | ✓ Speed stats |
| `POST /api/v2/torrents/setCategory` | ✓ |

---

## Limitations

The bridge covers the core use cases. A few advanced qBittorrent features are not supported:

- **RSS rules** — use Sonarr/Radarr instead
- **Sequential download mode** — files download in the order determined by peer availability
- **Per-file priority within a torrent** — all files in a job have equal priority
- **Tracker management** — managed by the compute agent, not user-configurable

---

## Security Notes

The app password used for the bridge has access only to your download queue — it cannot change your account settings, billing, or generate new API keys. Rotate it any time under **Settings → Integrations → App Passwords → Revoke**.'
);

-- ─── 8 ─── Privacy & IP protection ───────────────────────────────────────────
INSERT OR REPLACE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES (
  'privacy-ip-protection',
  'Protecting Your Privacy: How tseeder Hides Your Real IP',
  'When you submit a magnet link to tseeder, our Cloudflare-edge infrastructure performs the actual BitTorrent connections from a datacenter IP — your home IP is never exposed to peers, trackers, or ISP monitoring. Here''s exactly how it works.',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&h=630&fit=crop&q=80',
  'Privacy · Security',
  '6 min',
  'published',
  '2025-11-03',
  '## The Privacy Problem with Direct Torrenting

When you download a torrent directly on your home computer, your IP address is exposed in at least three places:

1. **The peer swarm** — every device sharing the same torrent sees your IP in the peer list
2. **Trackers** — announce servers record your IP every time you check in
3. **Your ISP** — BitTorrent''s peer protocol is not encrypted by default; ISPs detect it via deep packet inspection

None of this requires any special surveillance. Anyone with access to a torrent client can join the same swarm and log every peer''s IP address.

---

## How tseeder Fixes This

When you submit a magnet link to tseeder, the entire BitTorrent process is offloaded to our infrastructure:

```
Your browser
    │ HTTPS (TLS 1.3)
    ▼
tseeder API (Cloudflare Worker)
    │ validates request, writes job to D1
    ▼
Cloudflare Queue → Compute Agent (datacenter IP)
    │ BitTorrent protocol
    ▼
Peer swarm / Trackers   (they see a Cloudflare/datacenter IP — never yours)
    │ completed files
    ▼
Cloudflare R2 (encrypted object storage)
    │ HTTPS signed URL
    ▼
Your browser / media player
```

Your home IP appears **nowhere** in this chain. The only system that sees your IP is the tseeder API over HTTPS — the same as any other website you visit.

---

## Step-by-Step: What Happens to Your Magnet Link

### 1. Submission

You paste a magnet link in the dashboard or browser extension. Your browser sends it to `api.tseeder.com` over HTTPS. Cloudflare''s TLS termination means your ISP sees only encrypted traffic to a Cloudflare IP.

### 2. Queuing

The tseeder API validates your request (auth, quota, DMCA blocklist), creates a job record in D1, and pushes a message to Cloudflare Queues. This takes under 100 ms.

### 3. Compute Agent Download

A compute agent in our cluster picks up the job. The agent''s IP address is a datacenter IP — owned by our hosting provider, not associated with any residential address. The agent:

- Connects to the BitTorrent tracker(s) specified in the magnet link
- Announces itself to the peer swarm from the datacenter IP
- Downloads all pieces from peers
- Verifies piece hashes (SHA-1 or SHA-256 depending on torrent version)

### 4. Upload to R2

Once all pieces are verified, the agent uploads the files to Cloudflare R2 via multipart upload. Files are encrypted at rest using AES-256.

### 5. You Download

When you click download (or stream), tseeder generates a time-limited signed URL pointing to R2. You download the file over HTTPS. Your ISP sees HTTPS traffic to Cloudflare — nothing more.

---

## ISP Monitoring

Modern ISPs use **Deep Packet Inspection (DPI)** to identify BitTorrent traffic — even when it is encrypted — based on traffic patterns, timing, and protocol fingerprints.

Because you never participate in the BitTorrent protocol directly, there is nothing for your ISP''s DPI to detect. From your ISP''s perspective, you are simply browsing a website (tseeder.cc) over HTTPS.

---

## What tseeder Logs

We log the following for each job:

- Your user ID
- The infohash of the torrent (the unique identifier)
- Job creation timestamp and completion time
- Total bytes downloaded and uploaded

We do **not** log:
- Peer IPs from the swarm
- The content of files
- Your IP beyond what is standard in HTTPS server logs (30-day retention, anonymized)

We retain job metadata for the duration of your plan''s file retention period, then purge it. See our [Privacy Policy](/privacy) for full details.

---

## DMCA and Legal Requests

tseeder maintains a DMCA takedown process. If a copyright holder submits a valid notice, we remove the affected files and may restrict the user''s account. We do not proactively monitor content.

We respond to valid legal requests from law enforcement in our jurisdiction. We do not comply with requests that lack a valid court order.

---

## VPN + tseeder

Using a VPN alongside tseeder adds a second layer of protection: your VPN provider cannot see what you are submitting to tseeder (though they can see you''re connecting to tseeder.cc), and tseeder sees your VPN''s IP instead of your home IP.

This is not strictly necessary — tseeder already hides your IP from the peer swarm — but provides defence-in-depth for users in high-risk jurisdictions.

---

## Summary

| Threat | Direct torrent | tseeder |
|--------|---------------|---------|
| IP exposed to swarm | ✗ Yes | ✓ No |
| IP exposed to trackers | ✗ Yes | ✓ No |
| ISP DPI detection | ✗ Yes | ✓ No |
| Content encrypted at rest | ✗ No | ✓ Yes |
| Files accessible after download | ✗ Only if kept locally | ✓ In vault per retention policy |

tseeder does not make illegal activity legal. It protects your privacy for legitimate use cases — just as HTTPS protects your bank login and a VPN protects your browsing on public Wi-Fi.'
);
