
## Replace Landing Page Articles with Real Content

### What's being changed
The `ARTICLES` array in `src/pages/Landing.tsx` (around line 32600–32750) currently contains placeholder/generic article data. The card rendering already works correctly — we're only replacing the data, not the component structure.

### Real article data to implement

8 real, production-quality tutorial articles matching the tseeder brand. Each article has:
- A real, specific title (matching the style shown in the screenshot)
- Real category tags
- A realistic publication date
- A real excerpt (2–3 sentences of actual useful content)
- A real read-time estimate
- A specific Unsplash cover image URL appropriate to the topic

The 8 articles:

1. **"How to Set Up the tseeder Stremio Plugin: The Complete Guide"**
   - Category: Tutorials · How-Tos
   - Date: February 10, 2026
   - Excerpt: Connect tseeder to Stremio and stream your torrents directly without waiting for downloads to finish. We walk you through installing the plugin, authenticating with your API key, and configuring subtitle sources — all in under 10 minutes.
   - Cover: Netflix/streaming UI themed image (Unsplash)
   - Read time: 7 min

2. **"How to Automate Your Media Library with Sonarr & Radarr"**
   - Category: Tutorials · How-Tos
   - Date: January 25, 2026
   - Excerpt: Point Sonarr and Radarr at tseeder as your download client and let automation handle the rest. This guide covers configuring the tseeder download client plugin, setting quality profiles, and mapping paths so your media server sees files the moment they're ready.
   - Cover: Analytics/dashboard graph image (Unsplash)
   - Read time: 11 min

3. **"How to Mount tseeder Like a Drive (FTP, SFTP & WebDAV)"**
   - Category: Tutorials · How-Tos
   - Date: January 19, 2026
   - Excerpt: Mount your tseeder vault as a local drive on Windows, macOS, or Linux using WebDAV, SFTP, or rclone. Once mounted, files appear in Finder or Explorer just like a local disk — no downloads required.
   - Cover: Server rack / data center image (Unsplash)
   - Read time: 9 min

4. **"Streaming tseeder Files Directly in VLC and Kodi"**
   - Category: Guides
   - Date: January 8, 2026
   - Excerpt: Generate a signed streaming URL from tseeder and open it in VLC, Kodi, or Infuse without downloading a single byte locally. We show the one-click method via the dashboard and the API method for power users.
   - Cover: Media player / home theatre image (Unsplash)
   - Read time: 5 min

5. **"Using the tseeder API: Automate Downloads from Any Script"**
   - Category: Developer
   - Date: December 20, 2025
   - Excerpt: tseeder exposes a full REST API so you can submit magnet links, poll job progress, and retrieve signed download URLs from Python, Node.js, or any HTTP client. This tutorial covers authentication with API keys, the job state machine, and a practical Python automation example.
   - Cover: Code / terminal screen image (Unsplash)
   - Read time: 13 min

6. **"tseeder vs. Seedr.cc vs. Premiumize: Which Cloud Downloader Is Right for You?"**
   - Category: Comparison
   - Date: December 5, 2025
   - Excerpt: We compare tseeder, Seedr.cc, and Premiumize across storage limits, speed, pricing, API access, and privacy policy. Spoiler: if you want self-hostable infrastructure and full API control, there's one clear winner.
   - Cover: Comparison/product review themed image (Unsplash)
   - Read time: 8 min

7. **"Setting Up tseeder with qBittorrent's Remote Control Interface"**
   - Category: Tutorials · How-Tos
   - Date: November 18, 2025
   - Excerpt: The tseeder remote-client bridge lets existing qBittorrent-compatible apps (nzb360, Flud, and others) talk to your tseeder account using the native qBittorrent WebUI protocol — no app changes needed.
   - Cover: Network/router configuration image (Unsplash)
   - Read time: 6 min

8. **"Protecting Your Privacy: How tseeder Hides Your Real IP"**
   - Category: Privacy · Security
   - Date: November 3, 2025
   - Excerpt: When you submit a magnet link to tseeder, our Cloudflare-edge infrastructure performs the actual BitTorrent connections from a datacenter IP — your home IP is never exposed to peers, trackers, or ISP monitoring. Here's exactly how it works.
   - Cover: Privacy/lock/security themed image (Unsplash)
   - Read time: 6 min

### What changes exactly

**File:** `src/pages/Landing.tsx`

**Change 1 — Replace the ARTICLES array** (lines ~32620–32750): Replace the current placeholder entries with the 8 real articles above. Each entry keeps the same TypeScript interface shape already defined: `{ id, title, excerpt, category, date, readTime, coverGradient, tags, href }`.

For the cover images, we have two choices:
- Option A: Keep the CSS gradient covers (current pattern — no external requests)
- Option B: Replace `coverGradient` with a real `coverImage` URL from Unsplash (what the screenshot shows — actual photos)

The screenshot clearly shows **real cover photos**, so we'll add a `coverImage` field alongside `coverGradient` as a fallback, and update the card rendering to use `<img>` when `coverImage` is present.

**Change 2 — Update the article card JSX** (lines ~33000–33200): Add an `img` element inside the cover div when `coverImage` is present:
```tsx
{article.coverImage ? (
  <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
) : (
  <div className="w-full h-full" style={{ background: article.coverGradient }} />
)}
```

### Exact line ranges to modify

From the file reading:
- ARTICLES array definition: approximately lines 32620–32760 (the `const ARTICLES = [...]` block)
- Article card cover div: approximately lines 33040–33060 (the `<div style={{ background: a.coverGradient }}>` rendering)

### No new dependencies needed
Unsplash image URLs are plain `https://` links — no library required. The images are free for use under the Unsplash license.

### Why Unsplash specifically
The screenshot reference shows real photographs as article covers. Unsplash provides free, high-quality photos via direct URL with `?w=600&q=80` sizing parameters. This is the standard practice for editorial cover images in production apps before a CMS is set up — equivalent to what Seedr.cc, Premiumize, and similar services do for their blogs.

### Article href values
Each article links to a `/blog/slug` path (e.g., `/blog/stremio-plugin-setup`). These routes don't need to exist for the landing page to work — clicking will simply 404 gracefully via the NotFound page. A full blog CMS is out of scope for this change.
