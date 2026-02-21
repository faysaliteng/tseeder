

## Fix Extension: Replace All Broken Files with Working Reference Versions

### Problem
The current extension popup files have a broken HTML structure that doesn't match the CSS, causing the oversized logo and broken UI you're seeing. The uploaded reference files (popup-2.html, popup-2.css, popup-2.js, background-2.js, manifest-2.json) are the working versions.

### What Changes

**1. Replace `popup.html` and `popup-firefox.html`** with the reference `popup-2.html`
- Single shared header (not duplicated per view)
- Logo uses class `header-logo` (36x36, properly constrained)
- Brand text uses `.brand` class instead of `.app-title`
- Textarea for magnet input instead of text input
- User row with sign-out button inside Add tab
- Proper send-row layout with Dashboard link
- Footer with tagline

**2. Replace `popup.css`** with reference `popup-2.css`
- `.header-logo` at 36x36px with `border-radius: 10px` and proper glow
- `.brand` and `.subtitle` classes for header text
- All button styles (`.btn-send`, `.btn-dash`, `.btn-signout`, `.btn-refresh`) properly defined
- No `!important` hacks needed

**3. Replace `popup.js` (Chrome)** with reference `popup-2.js`
- Uses `chrome.storage.local` API directly
- Uses `chrome.scripting.executeScript` for magnet scanning (MV3)
- ICON set to `icon48.svg` (for notifications)

**4. Replace `popup-firefox.js`** - same as popup-2.js but adapted for Firefox MV2
- Keep using `browser.*` API wrapper
- Keep using `tabs.executeScript` instead of `scripting.executeScript`

**5. Replace `background.js` (Chrome)** with reference `background-2.js`
- Clean MV3 service worker with external message listener

**6. Replace `background-firefox.js`** - keep current Firefox version (already correct)

**7. Replace `manifest.json` (Chrome)** with reference `manifest-2.json`
- Uses `icon128.png` for all icon sizes (simpler, Chrome auto-scales)
- Includes `externally_connectable` and `host_permissions`

**8. Extension toolbar icon** - The generic "f" icon in Chrome (image-203) is because icon16.png/icon48.png may not be the right bolt icon. The manifest update uses icon128.png for all sizes which has the correct bolt.

### Technical Details

Files to update:
- `public/extension/popup.html` -- from popup-2.html
- `public/extension/popup-firefox.html` -- from popup-2.html (same HTML, different script tag)
- `public/extension/popup.css` -- from popup-2.css
- `public/extension/popup.js` -- from popup-2.js
- `public/extension/popup-firefox.js` -- adapted from popup-2.js with browser.* API
- `public/extension/background.js` -- from background-2.js
- `public/extension/manifest.json` -- from manifest-2.json

The Firefox popup HTML will be identical to Chrome except the script tag points to `popup.js` (which gets renamed from `popup-firefox.js` during ZIP packaging).

