

## Fix: Extension Logo Rendering Too Large

### Problem
The `logo.png` in the extension popup renders at its full intrinsic size (likely 512x512+), breaking the entire popup layout. The current CSS uses `width: 25px; height: 25px` but lacks `max-width` and `max-height` constraints. Firefox in particular can ignore `width`/`height` on images when the intrinsic size is large.

### Solution

**File: `public/extension/popup.css`**
- Add `max-width: 25px; max-height: 25px;` to the `.header-logo, .logo-img` rule to enforce a hard cap
- Add `!important` to ensure no browser default or specificity issue overrides the sizing

**Files: `public/extension/popup.html` and `public/extension/popup-firefox.html`**
- Add inline `width="25" height="25"` attributes directly on the `<img>` tags for `logo.png` so the browser knows the intended size before CSS loads
- This prevents the flash-of-large-image issue

### Technical Details

CSS change:
```css
.header-logo, .logo-img {
  width: 25px !important;
  height: 25px !important;
  max-width: 25px;
  max-height: 25px;
  border-radius: 6px;
  box-shadow: 0 0 12px rgba(99,102,241,0.35);
  flex-shrink: 0;
  object-fit: cover;
}
```

HTML change (both popup.html and popup-firefox.html):
```html
<img src="logo.png" alt="fseeder" class="logo-img" width="25" height="25" />
```

This two-layer approach (HTML attributes + CSS with `!important` and `max-*`) ensures the logo stays at 25x25 regardless of the source image dimensions in both Chrome and Firefox.

