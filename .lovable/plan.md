
## Extension Analysis — Bugs Found & Fix Plan

### What Was Analysed

Every extension file was read end-to-end and cross-referenced against the Chrome Manifest v3 specification and the web app's auth flow. **11 bugs** were found across 5 files. Below is the complete audit and fix plan.

---

### Bug Report

#### Critical (extension will not function at all)

| # | File | Bug | Impact |
|---|------|-----|--------|
| 1 | `manifest.json` | `scripting` permission missing | `chrome.scripting.executeScript` in popup.js throws a permission error — magnet scanning on the page never works |
| 2 | `manifest.json` | `externally_connectable` key missing | `chrome.runtime.onMessageExternal` never fires — the web app can never send the auth token to the extension after login |
| 3 | `background.js` | No listener for `TSDR_QUEUE_MAGNET` message | Content script's ⚡ button click sends a message that nobody handles — button is completely broken |
| 4 | `popup.html` | References `popup.css` which does not exist | Popup throws a 404 for the stylesheet — all custom styles silently fail, popup may render unstyled |

#### High (wrong production URL / auth broken)

| # | File | Bug | Impact |
|---|------|-----|--------|
| 5 | `background.js` | Job POSTed to hardcoded `https://tseeder.cc/jobs` | Must point to the real Workers API URL; context-menu "Send to tseeder" silently fails or hits wrong host |
| 6 | `popup.js` | `API_BASE` hardcoded to `'https://tseeder.cc'` | Same wrong URL; popup "Send to Cloud" button always fails in dev/staging |
| 7 | `src/pages/auth/Login.tsx` | No `chrome.runtime.sendMessage` call after successful login | Auth token is never sent to extension; user logs into web app but extension stays unauthenticated forever |

#### Medium (missing assets)

| # | File | Bug | Impact |
|---|------|-----|--------|
| 8 | `public/extension/` | `icon16.png`, `icon48.png`, `icon128.png` missing | Extension won't install in Chrome — manifest references non-existent files; Chrome rejects the extension |
| 9 | `src/pages/Extension.tsx` | "Download Extension" button has no zip file to serve | Users click download and nothing happens |

#### Low (logic gap)

| # | File | Bug | Impact |
|---|------|-----|--------|
| 10 | `popup.js` | `scanPageForMagnets` relies on `chrome.scripting.executeScript` but `scripting` is missing | Even after fix #1, the host must be listed in `host_permissions` which already exists — low risk after permission fix |
| 11 | `background.js` | Bearer token in job POST uses `auth.tsdr_token` — this is the session cookie value, not an API key | The Workers API expects a Bearer token from `/auth/api-keys`, not the session cookie; job POST will return 401 |

---

### Fix Plan (file by file)

#### 1. `public/extension/manifest.json` — Add missing permissions + `externally_connectable`

```json
{
  "permissions": [
    "activeTab",
    "contextMenus",
    "scripting",        // ADD — needed for executeScript
    "storage",
    "notifications"
  ],
  "externally_connectable": {
    "matches": [
      "https://tseeder.cc/*",
      "https://*.tseeder.cc/*",
      "https://id-preview--*.lovable.app/*"
    ]
  }
}
```

#### 2. `public/extension/popup.css` — Create the missing stylesheet

Full CSS for the popup: layout, magnet chip buttons, status message colours, login/logged-in state transitions, send button gradient — all self-contained in ~80 lines.

#### 3. `public/extension/background.js` — Fix all three issues

- Add `TSDR_QUEUE_MAGNET` message listener (routes to same job-POST logic)
- Replace hardcoded `https://tseeder.cc` with a constant `API_BASE` at the top (with a config comment so deployers can change it)
- Add an `onMessage` listener (internal) for the queue-magnet message from content.js

```js
const API_BASE = 'https://api.tseeder.cc'; // change to your Workers API URL

// Internal message from content script
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'TSDR_QUEUE_MAGNET') {
    await sendJob(msg.magnetUri);
  }
});
```

#### 4. `public/extension/popup.js` — Fix API_BASE + use correct auth

- Update `API_BASE` to read from extension storage first (set by web app after login), fall back to default
- Add a check: after login, the web app POSTs the extension ID + sets the API key in storage under `tsdr_api_key`

#### 5. `src/pages/auth/Login.tsx` — Send token to extension after successful login

After a successful `/auth/login` API call, inject a `chrome.runtime.sendMessage` call targeting the extension ID stored in a known constant. This is the bridge that makes "login on web → extension is authenticated" work.

```typescript
// After login success
const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID ?? "";
if (typeof chrome !== "undefined" && chrome.runtime && EXTENSION_ID) {
  chrome.runtime.sendMessage(EXTENSION_ID, {
    type: "TSDR_AUTH",
    token: apiKey,    // from POST /auth/api-keys
    email: user.email,
  });
}
```

#### 6. Extension Icons — Generate placeholder SVG-based PNGs

Create `icon16.png`, `icon48.png`, `icon128.png` using a Vite build script or pre-built assets. Since we cannot run scripts in this environment, we will replace the icon references in `manifest.json` with SVG data URIs (via a `web_accessible_resources` trick) OR generate minimal valid PNG placeholders as base64-encoded static files.

The simplest reliable approach: create an `icons/` folder entry in the build pipeline and generate three PNG files with the tseeder purple gradient "T" logo using an HTML Canvas at build time.

#### 7. `src/pages/Extension.tsx` — Wire up real ZIP download

Use the `JSZip` library to dynamically bundle all extension files client-side and trigger a real download — no server required. The `Download Extension` button will:
1. Fetch each extension file from `/extension/*.js`, `/extension/manifest.json`, `/extension/popup.html`, `/extension/popup.css`
2. Bundle them into a `.zip` with JSZip
3. Trigger browser download of `tseeder-extension.zip`

---

### Test Plan

#### Unit tests (Vitest) — `src/test/extension.test.ts`

```text
background.js logic:
  ✓ sendJob() posts to correct API_BASE with Bearer token
  ✓ sendJob() shows error notification on 401
  ✓ TSDR_AUTH message stores token + email to chrome.storage.local
  ✓ TSDR_QUEUE_MAGNET message routes to sendJob()
  ✓ Context menu click with no auth redirects to login tab

content.js logic:
  ✓ addTseederButton() adds button to magnet anchor
  ✓ addTseederButton() is idempotent (does not add twice)
  ✓ button click sends TSDR_QUEUE_MAGNET to runtime
  ✓ MutationObserver picks up dynamically added magnet links

popup.js logic:
  ✓ init() shows login state when no token in storage
  ✓ init() shows loggedin state when token exists
  ✓ sendBtn click with empty input shows error status
  ✓ sendBtn click calls fetch with correct headers
  ✓ scanPageForMagnets renders chips for found magnets

Extension manifest:
  ✓ manifest.json is valid JSON
  ✓ Required permissions present: scripting, contextMenus, storage, notifications
  ✓ externally_connectable matches array is non-empty
  ✓ background.service_worker points to existing file
  ✓ All icon sizes referenced exist as files
```

#### Integration test (manual verification checklist in `DEVELOPER.md`)

```text
Load extension:
  □ chrome://extensions → Load Unpacked → select public/extension/
  □ No errors in Extensions dashboard
  □ Icon appears in toolbar

Auth bridge:
  □ Log in at tseeder.cc → extension popup shows email + avatar initial
  □ Log out → popup shows login state

Job submission:
  □ Paste magnet link in popup → "Added to your cloud vault!" notification
  □ Right-click magnet link on any site → "Send to tseeder Cloud" menu item → notification
  □ Content script adds ⚡ button to magnet links on public tracker sites
  □ ⚡ button click → turns to ✅ → job appears in dashboard
```

---

### Files to Create / Modify

| Action | File |
|--------|------|
| **Modify** | `public/extension/manifest.json` — add `scripting` permission + `externally_connectable` |
| **Create** | `public/extension/popup.css` — full popup stylesheet |
| **Modify** | `public/extension/background.js` — fix API_BASE, add `TSDR_QUEUE_MAGNET` listener, fix auth |
| **Modify** | `public/extension/popup.js` — fix API_BASE, read api key from storage correctly |
| **Modify** | `src/pages/auth/Login.tsx` — send TSDR_AUTH to extension after login |
| **Create** | `public/extension/icon16.svg`, `icon48.svg`, `icon128.svg` + update manifest to use SVGs |
| **Modify** | `src/pages/Extension.tsx` — real JSZip-based download button |
| **Create** | `src/test/extension.test.ts` — full Vitest unit test suite |
| **Modify** | `DEVELOPER.md` — add manual extension test checklist |
