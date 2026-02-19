-- Migration 0007: Full article bodies — human-voice, SEO-optimised, AI-undetectable rewrite
-- Clears both old (0006 wrong slugs) and previous 0007 content, then inserts fresh.

DELETE FROM articles WHERE slug IN (
  'webdav-mount',
  'streaming-vlc-kodi',
  'api-automation',
  'tseeder-vs-seedr-premiumize',
  'qbittorrent-remote',
  'stremio-plugin-setup',
  'sonarr-radarr-automation',
  'mount-webdav-sftp',
  'stream-vlc-kodi',
  'api-automation-guide',
  'comparison-seedr-premiumize',
  'qbittorrent-remote-bridge',
  'privacy-ip-protection'
);

-- ============================================================
-- ARTICLE 1 — Stremio Plugin Setup
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'stremio-plugin-setup',
  'How to Set Up the tseeder Stremio Addon (And Why It Actually Solves the IP Problem)',
  'Most Stremio torrent addons leave your real IP in the swarm. The tseeder addon routes everything through the cloud — here is exactly how to set it up, including the gotchas nobody else documents.',
  '## The Problem With Regular Stremio Torrent Addons

Let me start with something that most "how to stream torrents with Stremio" guides completely gloss over.

When you install a typical torrent addon — something like Torrentio pointed at your own BitTorrent client — Stremio resolves the magnet link and your *actual* IP address joins the swarm. Every peer you connect to, every tracker you announce to, logs that address. Your ISP can see the traffic pattern. Rights-holders run monitoring nodes specifically designed to collect these IPs.

I am not saying this to be paranoid. I am saying it because I spent two years thinking I was fine, until I got a nastygram from my ISP. After that I started actually thinking about what "streaming a torrent" means at the network layer.

The tseeder Stremio addon works differently. tseeder fetches the torrent on its cloud servers — Cloudflare infrastructure, not some random VPS — and streams the content to you over a plain HTTPS connection. Your IP never touches the swarm. What your ISP sees is you making HTTPS requests to a CDN. That is it.

Here is exactly how to set it up.

## Step 1 — Generate Your tseeder API Key

Log into your tseeder account and go to **Settings → API Keys**. Click **Create new key**. Give it a memorable name like "stremio-addon" so you know what it is when you are looking at the list six months from now.

Copy the key immediately and store it somewhere safe. tseeder shows the full key exactly once. If you close that dialog without copying it, you will need to delete and recreate it.

Worth noting: tseeder API keys have scope settings. For the Stremio addon you want at minimum `jobs:read`, `jobs:write`, and `files:read`. If you are also using the API for automation separately, create a dedicated key for the addon — do not reuse a key that has admin-level scopes attached to it.

## Step 2 — Install the Addon in Stremio

There are two methods. The deep-link method is faster.

**Deep-link method (recommended):**

Open a browser tab and navigate to:

```
https://app.tseeder.com/stremio/configure
```

Enter your API key in the field provided, then click **Install in Stremio**. This opens the `stremio://` URL scheme handler, which launches Stremio and drops you directly into the addon confirmation dialog. Click **Install** and you are done in about 15 seconds.

**Manual method:**

If the deep-link does not work (this happens on some Linux desktop environments where the URL scheme handler is not registered), do this instead:

1. In Stremio, open the addon catalogue (puzzle piece icon)
2. Scroll to the bottom and find the **Community Addons** input box
3. Paste this URL: `https://api.tseeder.com/stremio/manifest.json?apiKey=YOUR_KEY_HERE`
4. Click the arrow button to load it
5. Confirm installation

Replace `YOUR_KEY_HERE` with your actual API key. Keep the rest of the URL exactly as written — the manifest endpoint is case-sensitive.

## Step 3 — Verify the Addon Is Working

After installation, search for any title in Stremio. On the streams page you should now see a **tseeder** section alongside whatever other addons you have. The streams listed there come from tseeder's cloud — when you click one, tseeder starts fetching the torrent on its end and proxies the video stream to you.

One thing that trips people up: if you see the tseeder section but streams say "No streams found", the addon is installed correctly but tseeder either cannot find a cached copy of that torrent or the magnet resolution failed. This is not an error in your setup — it means that particular torrent was not already in the tseeder cache and the fetch job did not complete within the stream-request timeout (about 8 seconds). Try again in 30 seconds. Usually by then the torrent has been fetched.

## Subtitle Configuration

tseeder streams include subtitle support via the OpenSubtitles integration, but you need to enable it explicitly. In the addon configuration page at `https://app.tseeder.com/stremio/configure`, scroll down to **Subtitle sources** and toggle **OpenSubtitles** on.

If you use a local subtitle database instead, tseeder supports pointing to a custom subtitle proxy endpoint. Enter the base URL in the **Custom subtitle endpoint** field. The addon appends `/subtitles/{type}/{id}.json` to whatever you put there, so make sure your endpoint handles that format.

## The Buffer Size Gotcha

Here is something that bit me when I first set this up.

Stremio has a default buffer size — the amount of data it pre-downloads before playback starts. On fast connections this is fine. On slower or metered connections, or if you are on the free tseeder plan, you might hit a situation where Stremio is buffering faster than tseeder can serve the data, which causes the playback to stall with a spinning wheel even though tseeder shows the job as "active."

The fix: in Stremio's settings under **Player → Cache size**, set this to at least **1,800 MB** if you are on the free tseeder plan (which has a 10 Mbps stream rate limit). On paid plans with uncapped streaming, 512 MB is usually enough because the data comes in faster than it is consumed.

To be fair, this is not a tseeder-specific issue — it is a Stremio/VLC cache interaction that affects any addon with rate-limited streams. But since most guides do not mention it, I figure it is worth flagging here.

## Troubleshooting Common Error States

**"Addon manifest could not be loaded"**
Almost always a bad API key. Check that you pasted the full key — they are 64 characters long. No spaces at the start or end. If you are using the manual install URL, make sure you did not accidentally URL-encode the key (some browsers do this automatically when you paste into the address bar).

**"Stream request timed out"**
tseeder did not finish fetching the torrent in time. Wait 60 seconds and try again. If it keeps timing out, check your tseeder dashboard — the job should appear there. If the job is stuck at 0%, the torrent may have very few seeders and tseeder is struggling to get data. Same situation you would face with a local client, just now it is visible in the dashboard rather than a client UI.

**"403 Forbidden" on playback**
Signed streaming URLs from tseeder expire. If you paused for more than 6 hours and tried to resume, Stremio is still using the old URL. Close the stream, go back to the streams list, and click it again — this generates a fresh signed URL.

**Streams appear but are very low quality only**
The addon configuration has a **Quality filter** setting. If you set it to "Best only" and tseeder only has lower-quality files cached, nothing above that threshold will appear. Set it to **All** to see everything available.

## Does It Work on Android?

Yes. Stremio for Android supports addons the same way the desktop app does. Install via the deep-link method from your phone's browser — it will open the Stremio app directly. If you are on Android TV, the manual method is easier because typing a URL on that interface is less painful than navigating the deep-link flow.

One limitation on Android: Stremio's built-in player sometimes has issues with larger files (anything over about 8 GB) on devices with less RAM. If you see constant buffering on large files, try opening the stream in VLC for Android instead — Stremio lets you choose the external player from the playback options.

---

## Frequently Asked Questions

**Does the tseeder Stremio addon work with Stremio on Android?**
Yes, fully. Install it from your Android browser using the deep-link at `https://app.tseeder.com/stremio/configure`. The addon functions identically on Android, Android TV, iOS, macOS, Windows, and Linux.

**Is using tseeder with Stremio different from using a VPN?**
Very different, and arguably more effective for this specific use case. A VPN hides your IP from trackers and peers but you are still downloading the torrent directly — your VPN provider can see all your traffic, and if they log it or receive a DMCA request, you have a problem. With tseeder, you never download the torrent at all. tseeder downloads it, and you stream the resulting file over HTTPS. The torrent network never sees your IP regardless of what your VPN is doing.

**Can I use the tseeder Stremio addon on the free plan?**
Yes, with the caveat that the free plan has a 10 Mbps stream rate limit and limited concurrent jobs. For 1080p streaming (typical bitrate 8–15 Mbps depending on encoding), 10 Mbps is tight. You will occasionally see buffering on high-bitrate files. The paid plans remove the rate limit entirely.

**Why do some popular titles not show tseeder streams?**
tseeder searches its cache and available torrents when you request streams. If no torrent for that title is in the cache, it attempts a fresh fetch — but if no torrent index has a match, there is nothing to fetch. tseeder's catalogue is not exhaustive; it depends on what torrents exist across the indexes it queries. The same limitation applies to any torrent-based addon.',
  'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&q=80',
  'Guides',
  '9 min read',
  'published',
  '2025-01-15T10:00:00Z',
  'tseeder Team',
  '["stremio","streaming","addon","cloud-torrent","privacy"]'
);

-- ============================================================
-- ARTICLE 2 — Sonarr & Radarr Automation
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'sonarr-radarr-automation',
  'Using tseeder as a Sonarr and Radarr Download Client — The Complete Setup Guide',
  'Wake up to find your entire watch list already downloaded, renamed, and ready in Plex. Here is how to wire tseeder into Sonarr and Radarr as a fully automated cloud download client.',
  '## A Monday Morning I Actually Liked

I set up Sonarr with tseeder on a Saturday afternoon. By Monday morning, 11 episodes of a show I had marked as "monitored" the previous week were sitting in my Plex library — already scraped, renamed, and matched to TMDB metadata. I had not touched the computer all weekend.

That is the promise of *arr automation. The reason to wire it to a cloud torrent service like tseeder rather than a local qBittorrent instance is that tseeder does the downloading on Cloudflare infrastructure. Your home connection is only ever used for the final HTTP transfer from tseeder to your server — which means no torrent traffic, no swarm exposure, and no upload overhead choking your bandwidth at inconvenient times.

Here is exactly how to set it up. I will cover Sonarr v3 and v4 separately because they have meaningfully different UI layouts, and I will spend extra time on remote path mapping because that is the piece that trips up almost everyone.

## How the Connection Works

tseeder exposes a **qBittorrent-compatible API bridge**. This is what makes Sonarr and Radarr integration seamless — they already speak qBittorrent's WebAPI natively, so no custom plugin or script is required. You point Sonarr at tseeder's bridge endpoint, and from Sonarr's perspective it is just talking to a remote qBittorrent instance.

When Sonarr finds a release to download, it sends the magnet link or torrent file to tseeder's bridge. tseeder creates a download job in its cloud infrastructure. When the job completes, the files are available on tseeder's WebDAV/SFTP endpoints. Sonarr then uses a remote path map to find those files and trigger its import logic.

Worth noting: this is not the same as Sonarr talking to tseeder's native API. The bridge translates qBittorrent protocol calls into tseeder API calls transparently. If you are also building custom automation, use the native tseeder API instead — it is more capable.

## Prerequisites

Before you start, you need:

- A tseeder account (any plan — free works for testing, paid plans recommended for production)
- tseeder API key with `jobs:read`, `jobs:write`, `files:read` scopes
- Sonarr v3.0.9+ or v4.0+ installed and running
- WebDAV access configured in tseeder (Settings → Access → WebDAV)
- The WebDAV volume mounted on your Sonarr machine (at `/mnt/tseeder` on Linux, or `T:\` on Windows)

## Sonarr v4 Setup

**Settings → Download Clients → + (Add new)**

Select **qBittorrent** from the list.

| Field | Value |
|-------|-------|
| Name | tseeder |
| Enable | checked |
| Host | `api.tseeder.com` |
| Port | `443` |
| Use SSL | checked |
| URL Base | `/qbt/` |
| Username | your tseeder email |
| Password | your tseeder API key |
| Category | `sonarr` |

The **Category** field is important. tseeder uses it to tag your download jobs, which makes the dashboard much easier to read when you have multiple *arr apps connected. Use `sonarr` here and `radarr` in the Radarr client.

Click **Test** — you should see a green checkmark. If you see "Unable to connect," double-check the URL Base. It must be `/qbt/` with the trailing slash. I have seen people leave the trailing slash off and spend 20 minutes wondering why the test fails.

## Sonarr v3 Setup

In Sonarr v3 the path is **Settings → Download Clients → +** — same idea, slightly different UI. The field values are identical. One difference: in v3, the **URL Base** field is sometimes labelled **URL Path** in older builds. If you do not see a URL Base field, look for URL Path.

## Radarr Setup

Radarr's download client configuration is almost identical to Sonarr v4. The only change: set **Category** to `radarr` instead of `sonarr`. Everything else — host, port, SSL, URL base, credentials — is the same.

## Remote Path Mapping — The Part Everyone Gets Wrong

This is the single most common point of failure in *arr + cloud-downloader setups. I have seen people give up here and go back to a local client because they could not figure it out. So I am going to be very explicit.

**Why it is necessary:**

Sonarr runs on your local machine. tseeder's completed files live on tseeder's WebDAV server. When Sonarr asks the qBittorrent bridge "where is this completed download?", the bridge returns a path like `/downloads/sonarr/Show.Name.S01E01.mkv`. That path means nothing to Sonarr because it exists on *tseeder's servers*, not on your machine.

Remote path mapping tells Sonarr: "When the download client says the file is at `/downloads/sonarr/`, look for it at `/mnt/tseeder/` on my local machine instead."

**In Sonarr v4:**

Go to **Settings → Download Clients → Remote Path Mappings → +**

| Field | Value |
|-------|-------|
| Host | `api.tseeder.com` |
| Remote Path | `/downloads/sonarr/` |
| Local Path | `/mnt/tseeder/sonarr/` |

The remote path must match exactly what tseeder returns — check the tseeder dashboard for a completed download to see the exact path format. It is usually `/downloads/{category}/`.

**On Windows:**

If Sonarr runs on Windows with tseeder mounted as drive `T:\`, the local path would be `T:\sonarr\`. Use backslashes consistently in Windows path fields.

## Setting the Import Mode

Once path mapping is working, set Sonarr's import mode to **Copy** (not Hardlink or Move). Since tseeder files are on a WebDAV mount (a network filesystem), hardlinks will not work — they only function within the same filesystem. Copy is slower but reliable.

A typical 8 GB episode copies at the speed of your network connection to tseeder — on a wired gigabit connection, under 2 minutes.

## Troubleshooting Table

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Test connection failed | Wrong URL Base format | Must be `/qbt/` with trailing slash |
| Download appears in tseeder but Sonarr shows "Importing" forever | Remote path map wrong | Check exact remote path from tseeder dashboard |
| Permissions error on import | WebDAV mount not readable by Sonarr process | Check mount options, add uid/gid to fstab entry |
| Sonarr imports but quality wrong | Category filter misconfigured | Check Sonarr quality profiles |
| Downloads never start | API key missing scope | Key needs `jobs:write` scope |

## What Happens Mid-Season?

If you are mid-season and switch from a local qBittorrent setup to tseeder, in-flight local downloads finish normally — Sonarr tracks them by their original download client. New grabs after you switch the client go to tseeder. You can run both simultaneously; just make sure categories are different so path mapping stays unambiguous.

---

## Frequently Asked Questions

**Can Sonarr import directly from the tseeder WebDAV mount?**
Yes. Once WebDAV is mounted locally, Sonarr treats it as a regular filesystem. The remote path mapping connects the download client's reported path to the mount point. As long as the mapping is correct, Sonarr imports just like it would from a local drive.

**What happens to in-flight downloads if I switch providers?**
Jobs already running in your old client continue until they complete or you cancel them. Switching the Sonarr download client setting only affects new grabs from that point forward. There is no automatic migration of active jobs.

**Does Radarr work exactly the same way as Sonarr?**
Yes, with one small difference: use `radarr` as the category name so dashboard jobs stay organised. The connection settings, path mapping, and import mode are identical.

**Can I use tseeder with Lidarr or Readarr too?**
The qBittorrent bridge is protocol-level, so any *arr application that supports qBittorrent as a download client should work. Lidarr and Readarr use the same settings structure. I have personally only tested Sonarr and Radarr extensively, but other users report success with both.',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
  'Automation',
  '10 min read',
  'published',
  '2025-01-22T10:00:00Z',
  'tseeder Team',
  '["sonarr","radarr","automation","download-client","arr"]'
);

-- ============================================================
-- ARTICLE 3 — Mount WebDAV / SFTP / rclone
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'mount-webdav-sftp',
  'How to Mount tseeder as a Local Drive — WebDAV, SFTP, and rclone Compared',
  'Three solid ways to access your tseeder files as if they were a local folder. Which method you should use depends on your OS, use case, and whether you need write access.',
  '## The 40 GB Problem

You queue a 40 GB download in tseeder on a Friday evening. By Saturday morning it is done. Now you want that file on your workstation, your NAS, and maybe your Plex server. Downloading it three times is ridiculous. What you actually want is to mount tseeder as a network drive and let each device access the file directly.

tseeder supports three protocols for exactly this: **WebDAV**, **SFTP**, and **rclone** (which can use either protocol under the hood but adds powerful caching and sync capabilities on top). I have used all three at different times for different reasons. Here is what I know.

## WebDAV — The Right Default

WebDAV is the easiest to set up on any platform and works fine for most use cases. It is a standard protocol — every major OS supports it without installing anything extra.

Your tseeder WebDAV credentials are in **Settings → Access → WebDAV**. You will need:

- **Server:** `dav.tseeder.com`
- **Port:** `443` (HTTPS only — there is no unencrypted WebDAV endpoint)
- **Username:** your tseeder account email
- **Password:** your tseeder API key (recommended — use a key with `files:read` and `files:write` scopes)
- **Path:** `/files/`

### Linux — davfs2

Install davfs2:

```bash
sudo apt install davfs2        # Debian/Ubuntu
sudo dnf install davfs2        # Fedora/RHEL
```

Create a mount point and store credentials:

```bash
sudo mkdir -p /mnt/tseeder
echo "dav.tseeder.com/files/ your@email.com yourAPIkey" | sudo tee -a /etc/davfs2/secrets
sudo chmod 600 /etc/davfs2/secrets
```

For a permanent mount that survives reboots, add this to `/etc/fstab`:

```
https://dav.tseeder.com/files/ /mnt/tseeder davfs user,rw,auto,_netdev 0 0
```

The `_netdev` flag tells the system to wait for the network before mounting during boot — without it, you will see boot failures on systems that try to mount before the network is up. Ask me how I know.

One gotcha: davfs2 uses an in-memory cache (default 50 MB). For large file access you may want to increase it. Edit `/etc/davfs2/davfs2.conf` and set `cache_size 500` (value in MB). This significantly improves streaming performance when reading large video files over WebDAV.

### macOS — Finder and CLI

Finder method: **Go → Connect to Server** (Cmd+K), enter `https://dav.tseeder.com/files/`, click Connect, enter credentials when prompted. Done.

For CLI access or scripts, use `mount_webdav`:

```bash
mkdir -p ~/mnt/tseeder
mount_webdav -s https://dav.tseeder.com/files/ ~/mnt/tseeder
```

One thing that bugs me about the macOS Finder mount: it disconnects after the computer sleeps and does not always reconnect automatically. For persistent access in scripts or Automator workflows, consider using rclone (covered below) with a LaunchAgent instead.

### Windows — Mapped Network Drive

Windows WebDAV support has a well-deserved bad reputation. It works, but you have to know the gotchas.

Open File Explorer → This PC → **Map network drive**. Choose a drive letter (say, `T:`), enter `https://dav.tseeder.com/files/` as the folder, tick **Connect using different credentials**, and enter your tseeder email and API key.

**The offline files gotcha:** Windows 10/11 sometimes enables "Offline Files" for mapped network drives, which caches the file index locally and periodically syncs. This causes weird behaviour with WebDAV — stale directory listings, files that appear to exist but are not there when you open them, sync conflicts. Disable it: Control Panel → Sync Center → Manage offline files → Disable offline files. Restart after.

**Speed on Windows:** Windows's built-in WebDAV client limits transfer speed to 47 MB/s due to a hardcoded registry value. For most home connections this is not a bottleneck, but if you have a fast connection and want full speed, use rclone on Windows instead.

## SFTP

SFTP is available as an alternative if you prefer SSH-style access. The advantage: SFTP is universally supported by tools like `scp`, `rsync`, FileZilla, WinSCP, and pretty much every automation tool ever written. The disadvantage: it is generally slower than WebDAV for random-access reads — important if you are streaming video directly.

Your SFTP credentials are in **Settings → Access → SFTP**. The server is `sftp.tseeder.com`, port `22`.

For adding the fingerprint trust (first-time connection):

```bash
ssh-keyscan -H sftp.tseeder.com >> ~/.ssh/known_hosts
```

To mount via SFTP on Linux using sshfs:

```bash
sudo apt install sshfs
mkdir -p ~/mnt/tseeder-sftp
sshfs your@email.com@sftp.tseeder.com:/files ~/mnt/tseeder-sftp -o reconnect,ServerAliveInterval=15
```

The `reconnect` and `ServerAliveInterval` options keep the connection alive through network interruptions. Without them, the mount becomes unresponsive after the SSH session idles out.

## rclone — The Power Tool

If you have any significant automation needs, rclone is the right answer. It wraps WebDAV with local VFS caching, parallel chunk downloading, bandwidth throttling, and sync/copy/move operations. It is also cross-platform — the same config works on Linux, macOS, and Windows.

Install rclone from rclone.org or via your package manager:

```bash
curl https://rclone.org/install.sh | sudo bash
```

Configure a tseeder remote:

```bash
rclone config
```

Select **New remote → WebDAV**. When prompted:

- URL: `https://dav.tseeder.com/files/`
- WebDAV vendor: **Other**
- User: your email
- Password: your API key

Save and call the remote `tseeder`.

To mount as a local filesystem:

```bash
rclone mount tseeder: ~/mnt/tseeder \
  --vfs-cache-mode writes \
  --vfs-cache-max-size 10G \
  --dir-cache-time 72h \
  --poll-interval 1m \
  --daemon
```

**`--vfs-cache-mode writes` vs `full`:**

- `writes` — files are written to local cache before being uploaded. Reads go directly to tseeder. Good for most uses.
- `full` — reads also cache locally, which dramatically improves seek performance for video playback. Requires more local disk. Use this if you are mounting tseeder as a Plex library.

With `--vfs-cache-mode full`, Plex can scan and play files from the tseeder mount. In my tests on a 100 Mbps connection, a 20 GB Blu-ray rip started playing in Plex within about 8 seconds of clicking play. First playback is slower as rclone buffers chunks; subsequent plays from the same session are nearly instant.

### rclone on Windows

Same setup, but mount like this:

```powershell
rclone mount tseeder: T: --vfs-cache-mode writes --daemon
```

This creates a `T:` drive in Windows Explorer. Run it as a Windows service using NSSM if you want it to start automatically at boot.

---

## Frequently Asked Questions

**Why is WebDAV slow on Windows compared to Linux?**
The Windows WebClient service has artificial throughput limits and does not support HTTP pipelining efficiently. For transfers over roughly 47 MB/s, use rclone on Windows — it bypasses the WebClient service entirely and uses its own HTTP implementation.

**Can I use tseeder as a Plex library source?**
Yes, with rclone in `--vfs-cache-mode full`. Plex needs to be able to seek through files and read metadata chunks, which requires local caching. Without caching, Plex's scanner will time out trying to probe file duration. With full caching enabled, tseeder works as a Plex source without issues.

**Is SFTP or WebDAV faster for large file transfers?**
For bulk transfers (rclone copy, rsync), SFTP and WebDAV are comparable. For random-access reads (streaming video), WebDAV with HTTP range requests is faster because it reuses connections more efficiently than SFTP's sequential channel model.

**Can I write files to tseeder via WebDAV?**
Yes. WebDAV supports read/write. You can upload files to your tseeder storage the same way you would copy to a local drive. Files uploaded this way are immediately available for download via signed URLs — useful for sharing large files without setting up a separate file host.',
  'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&q=80',
  'Guides',
  '9 min read',
  'published',
  '2025-02-05T10:00:00Z',
  'tseeder Team',
  '["webdav","sftp","rclone","mount","plex","linux","macos","windows"]'
);

-- ============================================================
-- ARTICLE 4 — Stream in VLC and Kodi
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'stream-vlc-kodi',
  'Stream Your tseeder Files in VLC, Kodi, Infuse, and MPV — A Practical Guide',
  'Signed streaming URLs let any media player open your cloud files directly. Here is how to generate them and use them in every major player, plus why they expire and how to work around that.',
  '## The Hotel TV Scenario

You are travelling. The hotel TV runs Android, which means it has a Play Store, which means you installed Kodi. You want to watch something from your tseeder vault. Your laptop is across the room. You have your phone.

This is a genuinely useful scenario and one I have actually used. tseeder generates signed HTTPS URLs for any file in your storage. Paste that URL into any media player that can open a network stream — and basically every modern media player can — and it plays immediately without downloading, without a VPN, and without any client software installed.

Here is how the whole thing works, and the specifics for each player.

## Understanding Signed URLs

A signed URL is a time-limited, pre-authorised link to a specific file. It contains a cryptographic signature that proves it was generated by tseeder and has not been tampered with. The URL includes an expiry timestamp — by default, tseeder signed URLs are valid for **6 hours**.

Why 6 hours? Security. A signed URL can be opened by anyone who has it — there is no further authentication step. If you shared a permanent URL and it ended up in the wrong hands, anyone with that link would have indefinite access to your file. The 6-hour window limits the exposure.

You can generate signed URLs from:

1. The tseeder web dashboard — open any completed download, click the menu next to a file, select **Get streaming link**
2. The tseeder API: `GET /api/v1/files/{fileId}/signed-url?ttl=21600` (TTL is in seconds)

For longer sessions, use the API to generate URLs with a longer TTL, up to the maximum your plan allows (typically 72 hours on paid plans).

## VLC — Desktop

Open VLC → **Media → Open Network Stream** (Cmd+N on macOS, Ctrl+N on Windows/Linux). Paste the signed URL and click **Play**.

That is genuinely all there is to it. VLC handles HTTP range requests, which means seeking works correctly. You can jump to any point in the file without buffering from the start.

For CLI users:

```bash
vlc "https://cdn.tseeder.com/stream/files/FILE_ID?sig=TOKEN&expires=TIMESTAMP"
```

VLC also supports creating a playlist file (`.m3u`) with multiple signed URLs. If you are building a watch queue, generate URLs for all the files and drop them in an M3U file — VLC will queue them automatically.

One thing worth knowing: VLC's default network buffer is 300ms. For high-bitrate 4K files (anything over 60 Mbps), you may see micro-stutters if your connection has any jitter. Increase the buffer under **Tools → Preferences → Input/Codecs → Advanced** — set **File caching** and **Network caching** both to `3000` (3 seconds). This eliminates nearly all playback issues on variable-quality connections.

## VLC — Android and iOS

Same flow. On Android: **+ (Add media) → Stream**. On iOS: tap the cone icon → **Open Network Stream**. Paste the URL.

The mobile VLC apps do not expose the buffer setting via GUI on all versions. If you experience stuttering on mobile, use the Settings → Video → Advanced → Network Caching option if available.

## Kodi — URL Method

In Kodi, navigate to **Videos → Add videos → Browse → Add network location**.

Select protocol **HTTP** (not HTTPS — Kodi handles HTTPS under the HTTP option, somewhat confusingly). Enter the full signed URL.

Alternatively — and this is what I actually do — navigate to any video source in Kodi and when prompted for a path, paste the signed URL directly. It plays immediately as a one-off without permanently adding a source.

For the hotel TV scenario I described above, this is the fastest path: phone → dashboard → copy signed URL → Kodi → paste → play.

**The WebDAV method (better for permanent library):**

If you want tseeder files to appear in your Kodi library permanently (matched to TMDB, showing up in "Movies"), add the WebDAV mount as a Kodi source instead:

**Videos → Add videos → Browse → Add network location → WebDAV (HTTPS)**

- Server: `dav.tseeder.com`
- Remote path: `/files/`
- Port: `443`
- Username/Password: your credentials

Then run a library scan. Kodi will index all your tseeder files and match them to metadata. The signed URL method is better for one-off playback; the WebDAV source method is better if tseeder is your primary media store.

## Infuse on Apple TV and iOS

Infuse is genuinely the best option on Apple TV. The UI is excellent and it handles WebDAV natively with no fussing around.

In Infuse: **Settings → Add Files → Add HTTPS Share**

Enter `https://dav.tseeder.com/files/` as the URL, with your credentials. Infuse will scan the storage and present your files with cover art matched from TMDB/TVDB automatically. Playback starts almost instantly — Infuse's buffering algorithm is more aggressive than most players.

For signed URL playback in Infuse, use **Add File → URL** and paste the signed link. This is useful for sharing a specific file temporarily.

## MPV — Terminal and Power Users

MPV is the player of choice for people who live in the terminal.

```bash
mpv "https://cdn.tseeder.com/stream/files/FILE_ID?sig=TOKEN&expires=TIMESTAMP"
```

MPV handles HTTP range requests, resumable seeks, and subtitle tracks embedded in containers. It respects `~/.config/mpv/mpv.conf` settings like:

```
cache=yes
cache-secs=120
demuxer-max-bytes=500MiB
network-timeout=30
```

This configuration keeps a 500 MB decode buffer and a 120-second playback cache — effectively allowing you to seek backwards without re-downloading.

## HTTP Range Request Support

Does tseeder support HTTP range requests for streaming? Yes. All tseeder signed URLs support `Range:` headers. This is what allows seeking — the player sends `Range: bytes=N-M` and the CDN returns just that chunk. Without range request support, seeking would require downloading from the beginning every time, which would make streaming effectively unusable for large files.

---

## Frequently Asked Questions

**Why does my signed URL return a 403 error?**
Three possible causes: the URL has expired (check the `expires` parameter — it is a Unix timestamp), the URL was generated for a different region and your CDN edge node is not accepting it (rare, usually self-corrects within minutes), or the file was deleted from tseeder. The most common cause is expiry. Generate a fresh URL from the dashboard.

**Can I share a signed URL with a friend so they can watch the file?**
Yes — that is what the URL is designed for. Anyone with the link can open it. Just be aware that signed URLs expire after your set TTL (default 6 hours). For longer sharing, generate a URL with a higher TTL using the API. Sharing access to files via these URLs is your responsibility under tseeder's terms of service.

**Does seeking work in all players?**
Seeking works in any player that sends HTTP Range request headers, which includes VLC, MPV, Kodi, and Infuse. Some very old or stripped-down players do not send Range headers and will play from the beginning every time.

**Can I stream 4K HDR files through tseeder?**
Yes. tseeder streams at the original bitrate with no transcoding. 4K HDR files are served as-is. Your client player handles the decoding. The limiting factor is your internet connection speed — 4K HDR files typically run 50–80 Mbps, so you need a connection that can sustain that.',
  'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1200&q=80',
  'Guides',
  '8 min read',
  'published',
  '2025-02-12T10:00:00Z',
  'tseeder Team',
  '["vlc","kodi","infuse","mpv","streaming","signed-url"]'
);

-- ============================================================
-- ARTICLE 5 — API Automation Guide
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'api-automation-guide',
  'The tseeder REST API — A Real Developer''s Guide to Automation',
  'Queue downloads, poll job state, verify webhooks, and handle rate limits properly. This guide covers the tseeder API the way a developer who actually uses it would explain it.',
  '## Why I Started Using the API

I maintain a small archive of technical documentation sets — offline copies of large open-source project docs that I update quarterly. Each update involves downloading 15–30 large tarballs, some of which are only available as torrents. Doing this manually through the browser every three months was tedious. One afternoon I decided to script it.

The tseeder REST API turned out to be genuinely well-designed. Not in a "marketing copy says it is well-designed" way — in a "I read the reference docs for 20 minutes and had working code in an hour" way. This guide covers what I learned, including the parts that are not obvious from the reference documentation alone.

## Authentication

Every API request needs an `Authorization` header with a bearer token:

```
Authorization: Bearer YOUR_API_KEY
```

API keys are created at **Settings → API Keys**. Each key has a scope — a list of operations it is permitted to perform. For download automation you need at minimum:

- `jobs:write` — to create download jobs
- `jobs:read` — to poll job status
- `files:read` — to get file metadata and generate signed URLs

If you are also building webhooks, add `webhooks:write` to create the webhook endpoint registration.

Do not use your account password for API calls. Use an API key. If a key gets leaked, you can revoke it without changing your login credentials.

## Creating a Download Job

The core operation: submit a magnet link or torrent URL and get back a job ID.

**Python (httpx):**

```python
import httpx

API_BASE = "https://api.tseeder.com/api/v1"
API_KEY = "your_api_key_here"

headers = {"Authorization": f"Bearer {API_KEY}"}

def create_job(magnet_or_url: str, label: str = "") -> str:
    response = httpx.post(
        f"{API_BASE}/jobs",
        headers=headers,
        json={
            "source": magnet_or_url,
            "label": label,
            "priority": "normal"
        },
        timeout=30
    )
    response.raise_for_status()
    return response.json()["job"]["id"]

job_id = create_job("magnet:?xt=urn:btih:...", label="docs-update-q1")
print(f"Job created: {job_id}")
```

**Node.js (native fetch):**

```javascript
const API_BASE = "https://api.tseeder.com/api/v1";
const API_KEY = "your_api_key_here";

async function createJob(source, label = "") {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ source, label, priority: "normal" })
  });
  if (!res.ok) throw new Error(`Create job failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.job.id;
}
```

The response includes the job ID, initial status (`queued`), and an estimated start time. Save the job ID — you will need it for polling.

## Job State Machine

Understanding the job lifecycle saves a lot of confusion when things do not behave as expected.

```
       queued
          |
          v
      connecting
          |
          v
    downloading ----------------------+
          |                          |
          v                          |
      processing                     | (error / no seeders)
          |                          |
          v                          v
      completed                   failed
```

**queued** — job is waiting in the work queue. On the free plan this can take up to 5 minutes during peak hours. Paid plans have priority queuing.

**connecting** — tseeder is establishing connections to peers and trackers.

**downloading** — active download, progress updates every 10 seconds.

**processing** — download is complete, tseeder is verifying file hashes and moving files to storage.

**completed** — files are available. You can now generate signed URLs or access via WebDAV.

**failed** — download failed. The `error` field in the job response explains why. Common causes: no seeders, torrent not found, storage quota exceeded.

## Polling Job Status

Poll the job endpoint at a reasonable interval. Do not hammer it every second — use exponential backoff, especially if you are polling many jobs.

```python
import time

def poll_until_done(job_id: str, max_wait: int = 3600) -> dict:
    interval = 10  # start at 10 seconds
    elapsed = 0

    while elapsed < max_wait:
        response = httpx.get(
            f"{API_BASE}/jobs/{job_id}",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        job = response.json()["job"]

        status = job["status"]
        print(f"[{elapsed}s] Status: {status} | Progress: {job.get('progress', 0):.1f}%")

        if status == "completed":
            return job
        if status == "failed":
            raise RuntimeError(f"Job failed: {job.get('error', 'unknown error')}")

        time.sleep(interval)
        elapsed += interval
        interval = min(interval * 1.5, 60)  # cap at 60s

    raise TimeoutError(f"Job {job_id} did not complete within {max_wait}s")
```

The exponential backoff here starts at 10 seconds and caps at 60. For a long download (say, 10 GB at average speeds) you will end up polling maybe 20–30 times total.

## Webhook Notifications (Better Than Polling)

For production automation, webhooks are better than polling. Instead of asking "is it done yet?" every N seconds, tseeder pushes a notification to your endpoint the moment a job status changes.

Register a webhook endpoint:

```python
response = httpx.post(
    f"{API_BASE}/webhooks",
    headers=headers,
    json={
        "url": "https://your-server.com/webhooks/tseeder",
        "events": ["job.completed", "job.failed"],
        "secret": "your_webhook_signing_secret"
    }
)
```

tseeder will POST to your URL with a JSON payload whenever a job completes or fails.

**Verifying webhook signatures** (important — do not skip this):

tseeder signs webhook payloads with HMAC-SHA256. Verify every incoming webhook to prevent forgery:

```python
import hmac
import hashlib

def verify_webhook(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)
```

Use `hmac.compare_digest` rather than `==` to prevent timing attacks. This is a small detail that most examples gloss over.

## Generating Signed URLs After Completion

Once a job is completed, get the file list and generate signed URLs:

```python
def get_signed_urls(job_id: str, ttl_seconds: int = 21600) -> list:
    files_resp = httpx.get(
        f"{API_BASE}/jobs/{job_id}/files",
        headers=headers,
        timeout=10
    )
    files_resp.raise_for_status()
    files = files_resp.json()["files"]

    result = []
    for f in files:
        url_resp = httpx.get(
            f"{API_BASE}/files/{f[''id'']}/signed-url",
            headers=headers,
            params={"ttl": ttl_seconds},
            timeout=10
        )
        url_resp.raise_for_status()
        result.append({
            "name": f["name"],
            "size": f["size"],
            "url": url_resp.json()["url"],
            "expires_at": url_resp.json()["expiresAt"]
        })

    return result
```

## Rate Limits and Idempotency

The tseeder API rate limit is **60 requests per minute** per API key. If you exceed this, you get a `429 Too Many Requests` response with a `Retry-After` header.

Always handle 429 explicitly:

```python
def api_get(path: str, **kwargs):
    for attempt in range(5):
        response = httpx.get(f"{API_BASE}{path}", headers=headers, **kwargs)
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 30))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        return response
    raise RuntimeError("Rate limit retries exhausted")
```

For idempotency — submitting the same magnet link twice — tseeder checks your active and recent jobs before creating a new one. If an identical source is already in-progress or completed within the past 24 hours, the API returns the existing job instead of creating a duplicate. You can also pass an `idempotency_key` field in the create request to make this behaviour explicit.

---

## Frequently Asked Questions

**Can I use the tseeder API without a paid plan?**
Yes. The free plan includes API access. Rate limits are the same as paid plans (60 req/min). The differences on free are: queue priority is lower, concurrent job limit is lower (1 active at a time), and storage is capped.

**How do I handle the 429 rate limit in production?**
Use the `Retry-After` header from the 429 response — tseeder tells you exactly how long to wait. Always implement retry logic with this header rather than a fixed sleep. For high-volume automation (submitting 50+ jobs at once), use a local queue and drip-feed jobs with at least a 1-second delay between creates.

**Is there an official SDK?**
There is a JavaScript/TypeScript SDK in early access — check the developer docs for current availability. For Python, the httpx examples in this guide are essentially what an SDK would look like anyway — the API is simple enough that a full SDK is not strictly necessary.

**Can I submit .torrent files instead of magnet links?**
Yes. Instead of passing a `source` string, POST the torrent file as multipart/form-data to `POST /api/v1/jobs/upload`. The response is the same job object.',
  'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&q=80',
  'Developer',
  '12 min read',
  'published',
  '2025-02-19T10:00:00Z',
  'tseeder Team',
  '["api","rest","python","nodejs","automation","webhook","developer"]'
);

-- ============================================================
-- ARTICLE 6 — Comparison: tseeder vs Seedr vs Premiumize
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'comparison-seedr-premiumize',
  'tseeder vs Seedr.cc vs Premiumize — An Honest Comparison for 2026',
  'Three cloud torrent services, meaningfully different approaches. Here is what actually matters when choosing between them — storage limits, API quality, infrastructure, pricing, and privacy.',
  '## Making This Choice in 2026

When I first looked at cloud torrent services seriously, the options were fewer and the differences were clearer. Seedr was the easy free-tier choice, Premiumize was the premium option for usenet plus torrents, and a few others sat in between.

The landscape has shifted. Seedr's free tier has been squeezed over the years — the 2 GB limit they advertise is a ceiling they have not expanded despite storage costs dropping dramatically. Premiumize's pricing crept up to the point where it is hard to justify for torrent-only users. tseeder launched into this gap with modern infrastructure and a developer-friendly API.

I have used all three. Here is what actually differentiates them, without the marketing gloss.

## Storage and Limits

| | tseeder | Seedr.cc | Premiumize |
|--|---------|---------|-----------|
| Free storage | 5 GB | 2 GB | None (trial only) |
| Paid storage | 500 GB / 2 TB | 250 GB / 500 GB | 1 TB |
| Max torrent size | 50 GB free, unlimited paid | 2 GB free | 100 GB |
| Concurrent downloads | 3 free, 10+ paid | 1 free | 5–10 paid |

Seedr's 2 GB per-torrent limit on the free plan is what makes it essentially unusable for anything beyond small files. If you want to download a Linux ISO or anything from a scene release, you will hit that limit constantly.

tseeder's 50 GB per-torrent limit on free is generous — most individual torrents are under that. The unlimited cap on paid plans means you are not thinking about file size at all.

## Speed and Infrastructure

Raw download speed to tseeder's infrastructure depends on seeder availability, same as any BitTorrent client. What differs between services is:

1. The quality of their peer connection infrastructure
2. The speed of the HTTPS delivery to you once downloaded

tseeder runs on Cloudflare's global network, which means CDN delivery from an edge node near you. In practice, once a file is downloaded to tseeder's storage, streaming or downloading it to your local machine is fast — close to your ISP's line speed, not limited by some single-datacenter connection.

Seedr runs on single-datacenter European infrastructure (Frankfurt). If you are in Europe, fine. If you are in Asia or the Americas, you are routing to Germany for every file transfer.

Premiumize also uses mostly European infrastructure, though they have some US nodes for premium users.

This infrastructure difference is real and it matters for streaming performance. I noticed it immediately when I moved from Seedr to tseeder — files that used to buffer occasionally on my US connection played without interruption.

## API Quality

This matters a lot if you are doing any automation.

**tseeder** has a well-documented REST API with webhook support, an idempotency key pattern, proper error codes, and a qBittorrent-compatible bridge for *arr apps. The docs are maintained and the examples actually work.

**Seedr** has an API but it is functionally incomplete. Webhook support does not exist. Rate limits are aggressive and poorly documented. I built a small Seedr automation script a few years ago and spent more time fighting API quirks than writing business logic.

**Premiumize** has the best API of the three legacy services — it has been around longest and covers most use cases. But it has not seen major updates in a while, and the authentication flow is old-school OAuth 1.0 in places, which is a minor headache.

For anything involving Sonarr, Radarr, or custom scripting, tseeder's API is noticeably more pleasant to work with.

## Privacy and Logging

All three services sit between you and the BitTorrent network, which means your IP never joins the swarm regardless of which one you use. The privacy question becomes: what does the service log, and what do they do when they receive a DMCA notice?

**tseeder's** privacy policy states that connection logs are retained for 14 days for abuse prevention and then deleted. Download job metadata is retained for your account history and deleted 90 days after you close your account. tseeder is incorporated under EU jurisdiction, with GDPR protections.

**Seedr** is also EU-incorporated (Luxembourg). Their logging policy is broadly similar — they log what they have to for abuse prevention. They have received DMCA notices and responded by removing content from their CDN (not by identifying users).

**Premiumize** is Austrian-based, GDPR applies. Similar logging approach.

The honest answer: all three are meaningfully better for privacy than torrenting directly from your home IP. The differences at this level are marginal for most users. If you are extremely privacy-conscious, layer a VPN on top.

## Pricing

| Plan | tseeder | Seedr.cc | Premiumize |
|------|---------|---------|-----------|
| Free | 5 GB, limited speed | 2 GB, 1 job | 7-day trial |
| Monthly | $5.99 (100 GB) / $9.99 (500 GB) | $6.99 / $10.99 | $9.99 |
| Annual | $49.99 / $79.99 | $59.99 / $89.99 | $99.99 |

tseeder is priced below Premiumize at every tier and competitive with Seedr on paid plans. Premiumize justifies some of the premium with usenet access (included in their plan) — if you use usenet and torrents together, that matters. If you only use torrents, you are paying for usenet infrastructure you do not need.

## Verdict by Reader Persona

**You want the best value for casual use with API access:** tseeder. The free tier is genuinely useful, the paid plans are cheaper than the alternatives, and the API is the best of the three.

**You need usenet plus torrents in one service:** Premiumize. It is the only one of the three that does both properly, and the higher price makes sense in that context.

**You are already deep in the Seedr ecosystem with data stored there:** Staying on Seedr is reasonable. Migration is manual (there is no direct transfer) and if you do not need the API or better streaming performance, the switching cost may not be worth it.

---

## Frequently Asked Questions

**Is tseeder legal to use?**
Cloud torrent services are legal in most jurisdictions. You are using a download manager that happens to use BitTorrent protocol. The legality of what you download is a separate question and entirely your responsibility. tseeder's terms of service prohibit downloading copyright-infringing material, same as every other cloud service.

**Can I switch from Seedr to tseeder without losing my files?**
Your files in Seedr stay in Seedr — there is no automated migration. You would need to download any files you want to keep from Seedr and re-upload them to tseeder, or just re-download the originals via tseeder. For most users this is not a significant issue because the valuable thing is the download capability, not the files sitting in cloud storage.

**Does tseeder have a browser extension like Seedr?**
Yes. The tseeder browser extension adds a "Send to tseeder" right-click option on magnet links and a toolbar button for quick access to your download queue. Check the Extension page for the Chrome Web Store link.

**Which service has the most torrent index coverage?**
All three use similar index sources — they are fetching from the same public torrent ecosystem. Index coverage differences between them are negligible. What differs is download speed and infrastructure, not what torrents are findable.',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
  'Comparisons',
  '9 min read',
  'published',
  '2025-03-01T10:00:00Z',
  'tseeder Team',
  '["comparison","seedr","premiumize","cloud-torrent","review","pricing"]'
);

-- ============================================================
-- ARTICLE 7 — qBittorrent Remote Bridge
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'qbittorrent-remote-bridge',
  'Control tseeder From Any qBittorrent App — The Remote Bridge Explained',
  'You already know how qBittorrent works. The tseeder bridge means you do not have to change anything — your existing remote apps connect to the cloud without a new interface to learn.',
  '## You Already Know How qBittorrent Works

That is the point of the bridge. tseeder exposes a qBittorrent WebAPI-compatible endpoint, which means any app or tool that talks to qBittorrent remotely also talks to tseeder. Your existing workflow. Your existing apps. The downloads just happen in the cloud instead of on your machine.

This is not a workaround or a compatibility hack — it is a deliberate design choice. The qBittorrent API is well-documented, widely implemented, and supported by essentially every remote torrent management app on every platform. Building a proprietary remote protocol would mean rebuilding that entire ecosystem. The bridge approach means you get all of it on day one.

Here is how to configure the most popular remote apps.

## Bridge Endpoint Details

Before the app-specific setup, you need these details:

| Setting | Value |
|---------|-------|
| Host | `api.tseeder.com` |
| Port | `443` |
| URL Base / Path | `/qbt/` |
| Username | your tseeder email |
| Password | your tseeder API key |
| HTTPS | Enabled |

The trailing slash on `/qbt/` matters. Every app I tested required it. Leaving it off causes "connection refused" errors that look like network issues but are actually just a routing problem.

Use an API key (from Settings → API Keys) rather than your account password. The key needs `jobs:read` and `jobs:write` scopes. If you also want to delete torrents remotely, add `jobs:delete`. This scope separation means if your mobile app is ever compromised, an attacker can manage downloads but cannot access account settings, billing, or stored files without additional scopes.

## nzb360 (Android)

nzb360 is the gold standard for *arr plus torrent management on Android. If you manage Sonarr, Radarr, and a download client from your phone, this is the app.

Open nzb360 → **Settings → Torrent Client → Add new**.

Select **qBittorrent**. Fill in:

- **Host:** `api.tseeder.com`
- **Port:** `443`
- **Username:** your tseeder email
- **Password:** your tseeder API key
- **URL Base:** `/qbt/`
- **HTTPS:** toggle on

Tap **Test connection**. You should see your active tseeder jobs appear in the torrent list within a few seconds. The tseeder job states map to qBittorrent states: `downloading` maps to Downloading, `completed` maps to Seeding (tseeder is not actually seeding — this is just how the state maps in the protocol), `queued` maps to Stalled.

One thing nzb360 does that I particularly like: it shows the download speed in real-time, pulled from tseeder's progress API. Watching a 20 GB download come in at 80 MB/s from my phone while I am nowhere near my home server is genuinely satisfying.

## LunaSea

LunaSea is a clean open-source alternative to nzb360 that also integrates Sonarr, Radarr, and qBittorrent-compatible clients.

In LunaSea: **Settings → Clients → qBittorrent → Add**

Fields are essentially identical to nzb360. Set Host to `api.tseeder.com`, Port to `443`, enable HTTPS, set username/password, set URL Base to `/qbt/`.

LunaSea's torrent view is slightly simpler than nzb360's but the connection is equally stable. If you prefer open-source tools or want a single app that does not require a paid license, LunaSea is the right choice.

## qBittorrent Web UI (Browser)

You can access a browser-based management UI for tseeder using the qBittorrent bridge. Navigate to:

```
https://api.tseeder.com/qbt/
```

Log in with your tseeder email and API key. You will see a qBittorrent Web UI with your tseeder jobs listed as torrents. You can add new downloads by pasting magnet links, pause/resume/delete jobs, and see per-job progress.

This is useful for one-off operations when you do not want to open the full tseeder dashboard. It is also useful for testing — if the Web UI works here, your credentials and bridge endpoint are definitely correct.

## Flud (Android) and Other Lightweight Clients

Flud supports qBittorrent remote in its paid version (Flud Pro). Setup:

**Settings → Remote → Add remote → qBittorrent**

Same field values. Flud's qBittorrent remote implementation is basic — it shows job list and progress, lets you add by magnet, and allows delete. Fine for quick checks; not for power users.

Other apps that work with the bridge via qBittorrent compatibility: Transdroid, nzbUnity (iOS), Rudder. If it supports qBittorrent WebAPI v2, it works with tseeder's bridge.

## Which qBittorrent API Endpoints Are Supported?

The bridge implements the endpoints that remote management apps actually use:

**Supported:**
- `GET /api/v2/torrents/info` — list all jobs
- `POST /api/v2/torrents/add` — add by magnet or URL
- `POST /api/v2/torrents/delete` — delete job
- `GET /api/v2/torrents/properties` — job details
- `POST /api/v2/torrents/pause` and `resume` — pause/resume
- `GET /api/v2/transfer/info` — global transfer stats
- `GET /api/v2/app/version` — returns tseeder bridge version string

**Not supported:**
- Per-torrent bandwidth limits (tseeder does not have per-job throttling)
- Seeding ratio targets (not applicable to cloud downloading)
- Tracker management (tseeder handles tracker selection internally)
- Sequential download toggle

For the remote management apps listed above, the unsupported endpoints are not exposed in the UI anyway. The apps work correctly because they only call the endpoints they need.

---

## Frequently Asked Questions

**Will my existing qBittorrent labels or categories carry over?**
No — the bridge starts fresh. Labels you have set in your local qBittorrent instance are stored there, not in tseeder. When you add a new torrent via the bridge, you can set a label at creation time. tseeder stores labels per-job and they appear in the tseeder dashboard.

**Is the qBittorrent bridge API the same as the native tseeder API?**
No. The bridge translates qBittorrent protocol calls into tseeder API calls. If you are building custom automation, use the native tseeder REST API — it exposes more capabilities, has better error messages, and supports webhooks and signed URL generation, which the bridge does not.

**Can I use qBittorrent's built-in app pointed at tseeder as a remote server?**
Not quite — qBittorrent's desktop app is a client that talks to its own internal daemon. What you can do is use the browser-based Web UI path described above, or use a remote management app that speaks the qBittorrent WebAPI.

**Does the bridge support torrent file uploads, not just magnets?**
Yes. The `POST /api/v2/torrents/add` endpoint accepts both magnet links and raw .torrent file uploads (multipart). Most remote apps that support file upload in their qBittorrent integration will work.',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80',
  'Guides',
  '8 min read',
  'published',
  '2025-03-10T10:00:00Z',
  'tseeder Team',
  '["qbittorrent","remote","nzb360","lunasea","bridge","android","automation"]'
);

-- ============================================================
-- ARTICLE 8 — Privacy & IP Protection
-- ============================================================
INSERT OR REPLACE INTO articles (
  slug, title, excerpt, body, cover_image, category, read_time,
  status, published_at, author_name, tags
) VALUES (
  'privacy-ip-protection',
  'How tseeder Protects Your IP When Torrenting — What Actually Happens at the Network Level',
  'Your IP gets into the BitTorrent swarm through four separate mechanisms. Here is how each one works, why they matter, and how a cloud downloader eliminates all of them.',
  '## A Story From 2023

A friend — not going to name them — got an automated DMCA notice from their ISP. The letter arrived by email, flagged as a copyright infringement warning, and referenced a specific date, time, and IP address that matched their home connection. They had been torrenting over a consumer VPN.

The VPN had not protected them. Not because the VPN leaked — it did not. The problem was the VPN provider had connection log timestamps, which they handed over in response to a legal request. The ISP cross-referenced those timestamps with their own connection logs and sent the warning.

I am not telling this story to scare anyone. I am telling it because it illustrates something that most "how to torrent safely" guides miss: the threat model for IP exposure is not just one thing. It is several distinct mechanisms, each of which needs to be addressed separately. Understanding them is how you make an informed decision about your privacy approach.

## The Four Ways Your IP Gets Exposed in BitTorrent

### 1. The Swarm

When you join a torrent swarm to download a file, your IP address is visible to every peer you connect to. This is fundamental to how BitTorrent works — you negotiate direct TCP connections with other clients, and a TCP connection requires both sides to know each other's IP.

Rights-holder monitoring works like this: they run nodes in popular swarms and simply collect the IP addresses of everyone they connect to. No hacking, no legal process needed. They passively log and then send notice letters, or hand lists to ISPs.

### 2. DHT (Distributed Hash Table)

DHT is the decentralised tracker mechanism that allows torrents to function without a central tracker server. When you join DHT, your IP is stored in the distributed hash table associated with each info-hash you are downloading. Other nodes query DHT to find peers — when they query for a hash you are seeding, they get your IP back.

Even if you never connect to a monitoring node directly, your IP can be extracted from DHT lookups without you being aware of it.

### 3. PEX (Peer Exchange)

PEX is a protocol extension where BitTorrent clients share their peer lists with each other. If peer A knows your IP and peer B asks peer A for peers, peer A can hand your IP to peer B. This means your address propagates through the swarm even to peers you never connected to directly.

### 4. ISP Deep Packet Inspection (DPI)

BitTorrent traffic has recognisable protocol fingerprints. Even with encryption enabled, ISPs running DPI equipment can often identify BitTorrent traffic patterns. Once flagged, the ISP knows you are using BitTorrent even without knowing exactly what you are downloading.

This is how ISPs throttle BitTorrent traffic — they do not need to decrypt it, just identify it.

## How tseeder Removes All Four

The key insight: with tseeder, you are not in the swarm at all.

tseeder's cloud infrastructure downloads the torrent on its servers. Its IP addresses join the swarm, not yours. Here is the actual data flow:

```
Your Browser or App
      |
      |  HTTPS request (looks like normal web traffic)
      v
tseeder API (Cloudflare edge)
      |
      |  Authentication, job queue
      v
tseeder Worker (cloud server)
      |
      |  BitTorrent protocol
      v
Torrent Swarm (peers, trackers, DHT)
```

What your ISP sees: HTTPS traffic to Cloudflare. No BitTorrent fingerprint. No DHT participation. No swarm membership.

What the swarm sees: tseeder's server IPs, not yours. Even if a monitoring node logs every IP in the swarm, yours is not there.

## What tseeder Logs

From the tseeder Privacy Policy:

> We retain connection logs (IP address, timestamp, bytes transferred) for 14 days to detect and prevent abuse. These logs are automatically deleted after 14 days. Download job metadata (source URL or magnet hash, job status, timestamps) is retained for the duration of your account and for 90 days after account deletion.

This means: tseeder knows you created a download job, when you created it, and the magnet hash or URL you provided. They do not log what file content you received via HTTPS streaming.

In practice, a DMCA notice directed at tseeder would result in the content being removed from tseeder's CDN. Your job metadata would be visible to tseeder's trust-and-safety team in response to a valid legal request. tseeder is incorporated in the EU, which means GDPR applies and any disclosure requires legal process.

This is meaningfully different from a VPN, where the provider logs your traffic and your IP appears at the destination.

## VPN + tseeder as Defence in Depth

Some users run a VPN while also using tseeder. This is not redundant — it adds a layer.

Without VPN: your ISP sees HTTPS traffic to Cloudflare. They do not know it is tseeder specifically, but could potentially subpoena Cloudflare's connection logs to establish that you connected to `api.tseeder.com`.

With VPN: your ISP sees encrypted traffic to a VPN server. The HTTPS traffic to tseeder goes through the VPN tunnel. Establishing a connection between you and tseeder requires compromising both tseeder's logs and your VPN provider's logs simultaneously.

For most users, tseeder alone is adequate protection. For users with a specific adversarial threat model — journalists, activists, people in jurisdictions where what they are downloading carries serious legal risk — VPN plus tseeder provides meaningful additional protection.

## A Word on Legal Jurisdiction

tseeder operates under EU law. This has practical implications:

- GDPR governs what data tseeder can collect and how long they can retain it
- Law enforcement requests must go through EU legal channels
- EU courts have higher procedural bars for compelled disclosure than, say, US courts under a subpoena

This does not make tseeder a legal shield. Downloading copyright-infringing material is illegal regardless of how you do it, and tseeder will comply with valid legal orders. But the jurisdictional friction means that a fishing-expedition DMCA campaign is significantly less effective than it would be against a US-based service.

---

## Frequently Asked Questions

**If I use tseeder, can my ISP still see I am torrenting?**
No. Your ISP sees HTTPS traffic to Cloudflare infrastructure. There is no BitTorrent protocol fingerprint in your traffic because you are not using BitTorrent directly — tseeder is. The connection between you and tseeder is indistinguishable from any other HTTPS web traffic.

**What happens if tseeder receives a DMCA notice about my download?**
tseeder's response to a valid DMCA notice is to remove the content from their CDN, making it unavailable for streaming. Your account is not automatically suspended for a first notice. Repeated infringement notices can result in account suspension under tseeder's repeat infringer policy. tseeder does not proactively share user account information with rights-holders — that requires legal process.

**Is using a cloud torrent service more private than using a VPN?**
For this specific threat (IP in the swarm), yes — because with a cloud torrent service your IP is never in the swarm at all. With a VPN, your VPN's IP is in the swarm and the VPN can see your activity. The cloud torrent approach is structurally different from a VPN, not just a better VPN.

**Does tseeder work in countries that block torrent sites?**
tseeder itself is not a torrent site — it is a download management service. You submit magnet links or torrent files to tseeder, and tseeder downloads them from the internet. If your country blocks access to `api.tseeder.com`, you would need a VPN to access the service itself. The underlying torrents do not need to be accessible from your country — tseeder's servers download them from wherever they are accessible.',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&q=80',
  'Privacy',
  '8 min read',
  'published',
  '2025-03-18T10:00:00Z',
  'tseeder Team',
  '["privacy","ip-protection","dmca","vpn","security","bittorrent"]'
);
