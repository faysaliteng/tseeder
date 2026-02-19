
# The Omega Upgrade — TorrentFlow $1,000,000,000,000 Edition

## Current State Assessment

After a full audit of every page and component, here is what exists and what needs to be elevated:

**User-facing (good foundation, needs dramatic uplift):**
- `TopHeader` — functional but basic. Plain icon buttons, no glow, no animated storage ring, no live provider chip.
- `Dashboard` — plain flat list rows. No glassmorphism, no per-row status glow, no hover micro-animations, no ambient gradient background.
- `JobDetail` — stat cards are plain `<div>` boxes. Progress bar is minimal. Files panel is utilitarian.
- `AddDownloadModal` — standard Dialog, no visual drama.
- `Settings` — dark grey section cards with a flat `bg-slate-700` header. Looks like a template.
- `Login/Register/Reset` — basic centered card. No particle effects, no ambient glow layers.

**Admin-facing (Infrastructure is premium, others are generic):**
- `AdminLayout` — clean sidebar but standard. No glass top bar, no notification badge, no user avatar.
- `AdminOverview` — `StatCard` components are basic. No animated numbers, no glow, no sparklines.
- `AdminUsers`, `AdminJobs`, `AdminSecurity`, `AdminAudit`, `AdminStorage`, `AdminWorkers`, `AdminSettings` — all use the basic `AdminUI` shared components (plain table with `bg-card` rows).
- `AdminUI.tsx` (`StatCard`, `AdminPageHeader`, `AdminTable`, `Paginator`, `DangerModal`) — the shared admin component library itself needs the biggest upgrade.

---

## The Omega Upgrade Plan

### Phase 1 — Design System Tokens & Global Atmosphere

**`src/index.css`** — Add new design tokens and global effects:
- `--glow-primary`, `--glow-success`, `--glow-danger` token for consistent neon shadows
- `.ambient-bg` utility: layered radial gradients that pulse subtly
- `.glass-card`: `backdrop-filter: blur(20px)` + `bg-white/[0.03]` + `border-white/10` — the real glassmorphism
- `.neon-border`: animated gradient border using `@keyframes border-flow`
- `.shimmer`: scan-line shimmer loading animation replacing the plain `animate-pulse`
- Custom scrollbar with primary-glow thumb on hover
- `@keyframes float` for floating cards
- `@keyframes glow-pulse` for live indicator dots

---

### Phase 2 — Shared Admin Component Library (`src/components/admin/AdminUI.tsx`)

This is the multiplier — every admin page uses it.

**`StatCard`** — Complete redesign:
- Glassmorphism card: `backdrop-blur`, gradient border, hover lift
- Large animated number (count-up on mount, like Infrastructure page already does)
- Colored icon container with matching glow ring
- Micro sparkline area inside the card (7-point fake data rendered with a small inline SVG)
- Trend arrow badge (↑ +12% / ↓ -3%) with color coding

**`AdminTable`** — Elevated:
- Frosted glass header row with sticky positioning
- Row hover: left accent border slides in + row background shifts
- Status-aware row coloring (failed rows get subtle red tint, active get blue)
- Column headers get sort indicators with animated chevrons
- Empty state: illustrated SVG placeholder instead of plain text

**`DangerModal`** — Elevated:
- Full-screen overlay with radial red glow centered on modal
- Modal itself gets a pulsing red border animation
- Shake animation on wrong confirm phrase
- Animated warning icon

**`Paginator`** — Elevated:
- Page number pills with hover glow instead of plain Prev/Next buttons

---

### Phase 3 — Auth Pages (`src/pages/auth/`)

**Login, Register, Reset** — Complete visual overhaul:
- Full-viewport animated background: three slow-moving radial blobs (indigo, violet, teal) using `@keyframes` position shifts
- Floating particle dots (CSS-only, 12 `<span>` elements with `animation-delay` stagger)
- The form card gets `glass-card` treatment with a glowing border on focus
- Logo animates in on mount with scale + fade
- Plan pills upgrade: animated gradient border around the Premium pill
- Input fields: bottom-border-only style that fills with gradient on focus
- Submit button: gradient with shimmer sweep on hover (`::after` pseudo-element)
- "Sign in" text animates character-by-character on success (CSS `animation-delay`)

---

### Phase 4 — TopHeader (`src/components/TopHeader.tsx`)

Largest visible impact for users:

- **Storage ring**: Replace the plain rectangular bar with a circular SVG arc (like Apple Watch rings). Animated `stroke-dashoffset` fill. Color shifts green→yellow→red based on usage.
- **Provider chip**: Small pill next to logo showing `⚡ CF` (orange) or `🌱 Seedr` (green) with a live pulse dot — reads from `localStorage`
- **Add button**: Replace plain Plus icon with a glowing gradient circle button with ripple effect on click
- **Paste bar expansion**: When open, the entire header transitions — blur-in overlay effect, the input has a neon underline focus
- **Mobile hamburger menu**: Slide-up sheet with frosted glass, showing avatar, plan badge, storage ring miniature, and nav links with icon + label
- **Notification dot**: Red badge count on the menu icon (static for now, wired to show count > 0)

---

### Phase 5 — Dashboard (`src/pages/Dashboard.tsx`)

- **Ambient background**: Subtle radial gradient top-left (indigo glow) that doesn't interfere with readability
- **Toolbar**: Glass pill style — `backdrop-blur` container, inputs have glow on focus
- **Empty state**: Animated illustration — pulsing folder icon with orbiting dots, gradient "Add Download" button with particle burst on click
- **JobRow** — The biggest change:
  - Left accent strip: 3px vertical bar colored by status (green=completed, blue=downloading, amber=queued, red=failed)
  - Status icon replaced with animated badge chip (like the Infrastructure `PulseDot`)
  - Progress bar: taller (4px), glowing version with percentage counter overlay
  - Hover state: entire row lifts with `translateY(-1px)` + deepened shadow
  - File type icon: colored glyph inside a colored rounded square (matching mime type color)
  - Action buttons: appear with slide-in from right on hover
- **Bulk action bar**: Already floats — upgrade to full glass pill with gradient buttons and count badge with bounce animation

---

### Phase 6 — JobDetail (`src/pages/JobDetail.tsx`)

- **Stat cards** (Download/Upload/Peers/Seeds): Match Infrastructure's `MetricCard` — glassmorphism, icon glow ring, animated number
- **Progress bar**: Full-width with overlay showing speed + ETA in the center of the bar
- **SSE live indicator**: Animated wifi-strength icon (4 bars animate in sequence)
- **File browser**: Each row gets left-border color by mime type, hover lift, icon glow
- **Completed banner**: Green frosted glass banner at the top of the file list with checkmark animation

---

### Phase 7 — Admin Overview (`src/pages/admin/Overview.tsx`)

Replace the entire page with Infrastructure-level quality:

- 6 KPI cards in a grid — all using the upgraded `StatCard` (animated numbers, sparklines, trend badges)
- **Global health ring**: A large circular gauge (SVG arc) in the center showing overall system health %, with red/amber/green zones
- **Live job feed**: Real-time scrolling ticker of job events (simulated) like a trading terminal
- **Geographic distribution**: Placeholder world map with dots showing worker locations
- **Activity heatmap**: 7×24 grid of colored squares showing job activity by day/hour (GitHub-style)

---

### Phase 8 — AdminLayout (`src/components/admin/AdminLayout.tsx`)

- **Sidebar**: Each nav item gets a colored left accent on active state + icon glow
- **Sidebar hover**: Items slide right 2px + glow on hover
- **Top bar**: Glass morphism — `backdrop-blur` + gradient separator
- **Notification bell**: Red badge counter + dropdown panel with 3 simulated system alerts
- **Admin Session badge**: Becomes a user avatar circle (first letter of email) + role chip
- **Command palette**: Press `Cmd+K` opens a search overlay (using `cmdk` already installed) with fuzzy search over users, jobs, nav items

---

### Phase 9 — AddDownloadModal (`src/components/AddDownloadModal.tsx`)

- **Dialog**: Glowing border, radial gradient behind the modal
- **Tabs**: Pill style with gradient active state
- **Magnet input**: Monospace with syntax highlight (magnet: prefix in purple, hash in green)
- **Torrent drop zone**: Animated dashed border (marching ants) on drag, particle burst on file drop
- **Submit button**: Ripple animation on click, transforms to progress indicator then checkmark on success

---

### Phase 10 — Settings Page (`src/pages/Settings.tsx`)

- **Section cards**: Replace `bg-slate-700` headers with gradient headers using brand colors per section
- **Account section**: Avatar upload area with drag-to-replace, gradient ring around avatar
- **Storage bars**: Match the TopHeader ring style — circular arc for storage, linear gradient bar for bandwidth
- **Provider toggle**: Replace plain radio with the same `ProviderCard` component from Infrastructure (smaller variant)
- **API Keys**: Terminal-style monospace card with green cursor blink, copy confirmation with checkmark animation
- **Upgrade button**: Full-width gradient CTA with shimmer animation

---

## Implementation Order (sequential, each builds on previous)

```text
1. index.css — new tokens + keyframes (foundation for everything)
2. AdminUI.tsx — StatCard, AdminTable, DangerModal (multiplier component)
3. TopHeader.tsx — SVG storage ring, provider chip, glow button
4. Dashboard.tsx — ambient bg, JobRow redesign, empty state, bulk bar
5. auth/Login.tsx + Register.tsx + Reset.tsx — blob bg, glass form
6. JobDetail.tsx — MetricCard upgrade, enhanced progress, file browser
7. AddDownloadModal.tsx — glow dialog, animated drop zone
8. Settings.tsx — gradient headers, circular storage, provider cards
9. admin/Overview.tsx — health ring, live feed, heatmap
10. AdminLayout.tsx — glass topbar, cmd+k palette, notification bell
```

## Files to be Modified

| File | Change Scope |
|---|---|
| `src/index.css` | New tokens, keyframes, utility classes |
| `src/components/admin/AdminUI.tsx` | Full component redesign |
| `src/components/TopHeader.tsx` | SVG ring, provider chip, glow buttons |
| `src/pages/Dashboard.tsx` | Ambient bg, JobRow, toolbar, empty state |
| `src/pages/auth/Login.tsx` | Blob bg, glass card, animations |
| `src/pages/auth/Register.tsx` | Same treatment as Login |
| `src/pages/auth/Reset.tsx` | Same treatment |
| `src/pages/JobDetail.tsx` | Metric cards, progress, file browser |
| `src/components/AddDownloadModal.tsx` | Glow dialog, drop zone animations |
| `src/pages/Settings.tsx` | Gradient headers, circular storage |
| `src/pages/admin/Overview.tsx` | Full premium redesign |
| `src/components/admin/AdminLayout.tsx` | Glass topbar, cmd+k, notifications |

No new dependencies needed — everything uses the existing stack (Tailwind, Lucide, Recharts for any charts, `cmdk` for command palette already installed).
