// fseeder Extension — Firefox Background Script (MV2)
const API_BASE = 'https://api.fseeder.cc';
const ICON = 'icon48.png';

// Use browser.* with chrome.* fallback
const B = typeof browser !== 'undefined' ? browser : chrome;

// ── Context menus ──────────────────────────────────────────────────────────────

B.runtime.onInstalled.addListener(() => {
  B.contextMenus.create({
    id: 'fsdr-send-magnet',
    title: '⚡ Send to fseeder Cloud',
    contexts: ['link'],
    targetUrlPatterns: ['magnet:*'],
  });

  B.contextMenus.create({
    id: 'fsdr-send-link',
    title: '⚡ Send URL to fseeder',
    contexts: ['link'],
  });
});

B.contextMenus.onClicked.addListener(async (info) => {
  const url = info.linkUrl;
  if (!url) return;

  const auth = await B.storage.local.get(['tsdr_token', 'tsdr_email']);
  if (!auth.tsdr_token) {
    B.notifications.create({
      type: 'basic',
      iconUrl: ICON,
      title: 'fseeder',
      message: 'Please sign in to fseeder first — click the extension icon.',
    });
    return;
  }

  const isMagnet = url.startsWith('magnet:');
  const body = isMagnet
    ? { type: 'magnet', magnetUri: url }
    : { type: 'url', url };

  await sendJob(body, auth.tsdr_token);
});

// ── Internal message from content script ───────────────────────────────────────

B.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === 'TSDR_QUEUE_MAGNET' && msg.magnetUri) {
    B.storage.local.get(['tsdr_token']).then(async (auth) => {
      if (!auth.tsdr_token) {
        B.notifications.create({
          type: 'basic',
          iconUrl: ICON,
          title: 'fseeder',
          message: 'Please sign in to fseeder first.',
        });
        return;
      }
      await sendJob({ type: 'magnet', magnetUri: msg.magnetUri }, auth.tsdr_token);
    });
  }
  return false;
});

// ── Core job POST ──────────────────────────────────────────────────────────────

async function sendJob(body, token) {
  try {
    const res = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      B.notifications.create({
        type: 'basic',
        iconUrl: ICON,
        title: 'fseeder ✅',
        message: 'Added to your cloud vault!',
      });
    } else if (res.status === 401) {
      await B.storage.local.remove(['tsdr_token', 'tsdr_email']);
      B.notifications.create({
        type: 'basic',
        iconUrl: ICON,
        title: 'fseeder — Session expired',
        message: 'Please sign in again via the extension.',
      });
    } else {
      throw new Error(`API error ${res.status}`);
    }
  } catch (err) {
    B.notifications.create({
      type: 'basic',
      iconUrl: ICON,
      title: 'fseeder ❌',
      message: `Failed: ${err.message}`,
    });
  }
}