-- ─── Articles / Blog CMS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS articles (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  excerpt      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  cover_image  TEXT,
  category     TEXT NOT NULL DEFAULT 'General',
  tags         TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'published', 'archived')),
  read_time    TEXT,
  author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT,
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_slug      ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status    ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);

-- Seed the 8 real articles from the landing page as published records
INSERT OR IGNORE INTO articles
  (slug, title, excerpt, cover_image, category, read_time, status, published_at, body)
VALUES
  (
    'stremio-plugin-setup',
    'How to Set Up the tseeder Stremio Plugin: The Complete Guide',
    'Connect tseeder to Stremio and stream your torrents directly without waiting for downloads to finish. We walk you through installing the plugin, authenticating with your API key, and configuring subtitle sources — all in under 10 minutes.',
    'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1200&h=630&fit=crop&q=80',
    'Tutorials',
    '7 min',
    'published',
    '2026-02-10',
    '## Getting Started

tseeder integrates natively with Stremio via a community addon that translates Stremio''s catalog requests into tseeder API calls.

## Step 1: Install the Addon

Open Stremio and navigate to the Addon Catalog. Search for "tseeder" or install directly via the community URL provided in your tseeder dashboard under **Settings → Integrations**.

## Step 2: Authenticate

The addon requires your tseeder **API key**. Generate one under **Settings → API Keys**, then paste it into the addon configuration screen.

## Step 3: Configure Subtitles

tseeder passes subtitle files alongside video streams. Enable "External Subtitles" in Stremio''s playback settings to pick them up automatically.

## Troubleshooting

- **Buffering**: Increase the buffer size in Stremio''s settings to at least 2 GB for large files.
- **No streams shown**: Verify your API key is active and your plan has remaining bandwidth.'
  ),
  (
    'sonarr-radarr-automation',
    'How to Automate Your Media Library with Sonarr & Radarr',
    'Point Sonarr and Radarr at tseeder as your download client and let automation handle the rest. This guide covers configuring the tseeder download client plugin, setting quality profiles, and mapping paths so your media server sees files the moment they are ready.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=80',
    'Tutorials',
    '11 min',
    'published',
    '2026-01-25',
    '## Overview

Sonarr and Radarr are the gold-standard tools for automated media management. With tseeder as the download client, all torrent traffic routes through our secure cloud infrastructure — your IP is never exposed.

## Installing the tseeder Download Client Plugin

Download the plugin from the tseeder GitHub releases page. Drop the `.dll` (Windows) or `.so` (Linux/macOS) into your Sonarr/Radarr plugins directory and restart the service.

## Configuration

In Sonarr, navigate to **Settings → Download Clients → Add**. Select **tseeder** from the list. Enter:

- **API Base URL**: `https://api.tseeder.com`
- **API Key**: your tseeder API key
- **Category**: `sonarr` (used for path mapping)

## Path Mapping

tseeder uses WebDAV to expose completed files. Map the WebDAV mount point to the path Sonarr expects. See the [WebDAV guide](/blog/webdav-mount) for detailed mounting instructions.

## Quality Profiles

Set your quality profiles as normal — tseeder supports any content Sonarr/Radarr can find a torrent for. We recommend enabling "Prefer Torrent" in your indexer settings for fastest acquisition.'
  ),
  (
    'webdav-mount',
    'How to Mount tseeder Like a Drive (FTP, SFTP & WebDAV)',
    'Mount your tseeder vault as a local drive on Windows, macOS, or Linux using WebDAV, SFTP, or rclone. Once mounted, files appear in Finder or Explorer just like a local disk — no downloads required.',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop&q=80',
    'Tutorials',
    '9 min',
    'published',
    '2026-01-19',
    '## Why Mount?

Mounting tseeder as a drive lets you browse, stream, and manage files without downloading them locally. Perfect for media servers, NAS devices, and power users.

## WebDAV (Recommended)

WebDAV is the most universally supported protocol. Enable it under **Settings → Integrations → WebDAV**.

### Windows
Map a network drive using the WebDAV URL. In File Explorer, right-click **This PC → Map network drive** and enter:
```
https://webdav.tseeder.com/your-username
```

### macOS
In Finder, press `⌘K` and enter the WebDAV URL. Authenticate with your tseeder email and a generated app password.

### Linux
```bash
sudo mount -t davfs https://webdav.tseeder.com/your-username /mnt/tseeder
```

## rclone (Power Users)

rclone gives you advanced sync and mount options:
```bash
rclone config  # select WebDAV, enter tseeder URL
rclone mount tseeder: ~/tseeder --vfs-cache-mode full
```

## SFTP

SFTP access is available on Business plans and above. Generate an SSH key pair in **Settings → SSH Keys** and connect to `sftp.tseeder.com`.'
  ),
  (
    'streaming-vlc-kodi',
    'Streaming tseeder Files Directly in VLC and Kodi',
    'Generate a signed streaming URL from tseeder and open it in VLC, Kodi, or Infuse without downloading a single byte locally. We show the one-click method via the dashboard and the API method for power users.',
    'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1200&h=630&fit=crop&q=80',
    'Guides',
    '5 min',
    'published',
    '2026-01-08',
    '## One-Click Streaming

In your tseeder dashboard, click any completed file and select **Stream**. A signed URL is generated and copied to your clipboard — valid for 1 hour by default.

## Open in VLC

Paste the URL directly into VLC via **Media → Open Network Stream** (`⌘N` on Mac, `Ctrl+N` on Windows/Linux).

## Open in Kodi

In Kodi, navigate to **Videos → Enter Location** and paste the signed URL. Kodi will begin buffering immediately using its native HTTP source.

## API Method

Generate a signed URL programmatically:

```bash
curl -X POST https://api.tseeder.com/files/{fileId}/signed-url \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d ''{"expiresIn": 3600}''
```

The response contains a `url` field you can pass directly to any media player.

## Infuse (Apple TV / iOS)

Infuse supports direct URL playback. Add your signed URL as a "URL" source in Infuse''s server settings. For persistent access, use the WebDAV integration instead.'
  ),
  (
    'api-automation',
    'Using the tseeder API: Automate Downloads from Any Script',
    'tseeder exposes a full REST API so you can submit magnet links, poll job progress, and retrieve signed download URLs from Python, Node.js, or any HTTP client. This tutorial covers authentication with API keys, the job state machine, and a practical Python automation example.',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop&q=80',
    'Developer',
    '13 min',
    'published',
    '2025-12-20',
    '## Authentication

All API requests require an API key passed as a Bearer token:

```
Authorization: Bearer tsdr_live_xxxxxxxxxxxxxxxxxxxx
```

Generate keys under **Settings → API Keys** in the dashboard.

## Submitting a Magnet Link

```python
import httpx

client = httpx.Client(
    base_url="https://api.tseeder.com",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)

job = client.post("/jobs", json={
    "type": "magnet",
    "magnetUri": "magnet:?xt=urn:btih:..."
}).raise_for_status().json()

print(f"Job ID: {job[''id'']}, Status: {job[''status'']}")
```

## Polling Job Progress

```python
import time

while True:
    job = client.get(f"/jobs/{job_id}").raise_for_status().json()
    print(f"Progress: {job[''progressPct'']}% — {job[''status'']}")
    if job["status"] in ("completed", "failed", "cancelled"):
        break
    time.sleep(5)
```

## Downloading Files

```python
files = client.get(f"/jobs/{job_id}/files").raise_for_status().json()
for f in files["files"]:
    url_data = client.post(f"/files/{f[''id'']}/signed-url", json={"expiresIn": 3600}).json()
    print(f"Download: {url_data[''url'']}")
```

## Job Status Machine

Jobs transition through: `queued → dispatched → downloading → seeding → completed` (or `failed`/`cancelled`).'
  ),
  (
    'tseeder-vs-seedr-premiumize',
    'tseeder vs. Seedr.cc vs. Premiumize: Which Cloud Downloader Is Right for You?',
    'We compare tseeder, Seedr.cc, and Premiumize across storage limits, speed, pricing, API access, and privacy policy. Spoiler: if you want self-hostable infrastructure and full API control, there is one clear winner.',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop&q=80',
    'Comparison',
    '8 min',
    'published',
    '2025-12-05',
    '## The Contenders

Three major cloud torrent services dominate the market in 2025-2026: **tseeder**, **Seedr.cc**, and **Premiumize**. Here is how they stack up.

## Storage & Bandwidth

| Feature | tseeder | Seedr.cc | Premiumize |
|---------|---------|----------|------------|
| Free storage | 5 GB | 2 GB | None |
| Pro storage | 2 TB | 500 GB | 1 TB |
| Bandwidth | Unmetered | Metered | Metered |

## API Access

tseeder is the only service with a **full, documented REST API** that supports magnet links, torrent file uploads, signed URL generation, and webhook callbacks. Seedr.cc has a limited unofficial API. Premiumize has a semi-official API with rate limits and no webhook support.

## Privacy

tseeder routes all BitTorrent traffic through Cloudflare''s edge network. Your home IP is never exposed to trackers or peers. Seedr and Premiumize also proxy traffic, but neither offers the transparency of tseeder''s open-source infrastructure.

## Verdict

For developers and power users who need API access, tseeder is the clear winner. For casual users who just want a simple web UI, Seedr.cc is a reasonable free option.'
  ),
  (
    'qbittorrent-remote',
    'Setting Up tseeder with qBittorrent''s Remote Control Interface',
    'The tseeder remote-client bridge lets existing qBittorrent-compatible apps (nzb360, Flud, and others) talk to your tseeder account using the native qBittorrent WebUI protocol — no app changes needed.',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&h=630&fit=crop&q=80',
    'Tutorials',
    '6 min',
    'published',
    '2025-11-18',
    '## What Is the qBittorrent Bridge?

tseeder implements a compatibility layer that speaks the qBittorrent WebUI API. This means any app that can control qBittorrent remotely can also control tseeder — without any modification.

## Supported Apps

- **nzb360** (Android) — full support including labels and categories
- **Flud** (Android) — add/remove torrents, view progress
- **LunaSea** (iOS/Android) — dashboard integration
- **Sonarr/Radarr** — via the qBittorrent download client plugin

## Configuration

Enable the bridge under **Settings → Integrations → qBittorrent Bridge**. You will receive:

- **Host**: `qbt.tseeder.com`
- **Port**: `443` (HTTPS)
- **Username**: your tseeder email
- **Password**: a generated app password

Enter these into your remote app exactly as you would for a local qBittorrent instance.

## Limitations

The bridge supports the core qBittorrent API surface. Some advanced features (RSS rules, sequential download toggling) are not available. The bridge is read-write: you can add and remove jobs, but advanced torrent manipulation is handled via the native tseeder API.'
  ),
  (
    'privacy-ip-protection',
    'Protecting Your Privacy: How tseeder Hides Your Real IP',
    'When you submit a magnet link to tseeder, our Cloudflare-edge infrastructure performs the actual BitTorrent connections from a datacenter IP — your home IP is never exposed to peers, trackers, or ISP monitoring. Here is exactly how it works.',
    'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=1200&h=630&fit=crop&q=80',
    'Privacy',
    '6 min',
    'published',
    '2025-11-03',
    '## The Problem with Direct Downloads

When you download a torrent directly, your IP address is visible to every peer in the swarm, every tracker you announce to, and your ISP via deep packet inspection. This creates a clear record of your activity.

## How tseeder Protects You

When you submit a magnet link to tseeder:

1. **Your browser** sends the magnet link to our API over HTTPS.
2. **Our Cloudflare Workers API** validates the request and queues a job.
3. **Our compute agent** (running in a data center) performs the actual BitTorrent download from a datacenter IP.
4. **Completed files** are stored encrypted in Cloudflare R2.
5. **You download** the finished file over HTTPS — never touching BitTorrent directly.

Your home IP never appears in any tracker log or peer list.

## What We Log

tseeder logs job submissions (magnet URI, timestamp, user ID) as required for abuse prevention and DMCA compliance. We do not log your browsing behavior or share data with third parties.

## ISP Monitoring

Because all communication between you and tseeder uses HTTPS, your ISP sees only encrypted traffic to Cloudflare''s CDN — not the content of what you are downloading.

## Jurisdiction

tseeder''s infrastructure runs on Cloudflare, which operates globally. Data processing follows Cloudflare''s DPA and GDPR commitments. See our [Privacy Policy](/privacy) for full details.'
  );
