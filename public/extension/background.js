// tseeder Extension — Background Service Worker
// Deployers: update API_BASE to your Cloudflare Workers API URL.
const API_BASE = 'https://api.tseeder.cc';

// ── Context menus ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'tsdr-send-magnet',
    title: '⚡ Send to tseeder Cloud',
    contexts: ['link'],
    targetUrlPatterns: ['magnet:*'],
  });

  chrome.contextMenus.create({
    id: 'tsdr-send-link',
    title: '⚡ Send URL to tseeder',
    contexts: ['link'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const url = info.linkUrl;
  if (!url) return;

  const auth = await chrome.storage.local.get(['tsdr_api_key', 'tsdr_email']);
  if (!auth.tsdr_api_key) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'tseeder',
      message: 'Please sign in to tseeder first.',
    });
    chrome.tabs.create({ url: 'https://tseeder.cc/auth/login?ext=1' });
    return;
  }

  const isMagnet = url.startsWith('magnet:');
  const body = isMagnet
    ? { type: 'magnet', magnetUri: url }
    : { type: 'url', url };

  await sendJob(body, auth.tsdr_api_key);
});

// ── Internal message from content script ───────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === 'TSDR_QUEUE_MAGNET' && msg.magnetUri) {
    chrome.storage.local.get(['tsdr_api_key'], async (auth) => {
      if (!auth.tsdr_api_key) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'tseeder',
          message: 'Please sign in to tseeder first.',
        });
        return;
      }
      await sendJob({ type: 'magnet', magnetUri: msg.magnetUri }, auth.tsdr_api_key);
    });
  }
  // Return false — we don't use sendResponse here.
  return false;
});

// ── External message from web app (auth bridge) ───────────────────────────────

chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TSDR_AUTH') {
    chrome.storage.local.set({
      tsdr_api_key: msg.token,   // API key from /auth/api-keys
      tsdr_email: msg.email,
    }, () => {
      sendResponse({ ok: true });
    });
    return true; // keep port open for async sendResponse
  }

  if (msg.type === 'TSDR_SIGNOUT') {
    chrome.storage.local.remove(['tsdr_api_key', 'tsdr_email'], () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

// ── Core job POST ──────────────────────────────────────────────────────────────

async function sendJob(body, apiKey) {
  try {
    const res = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'tseeder ✅',
        message: 'Added to your cloud vault!',
      });
    } else if (res.status === 401) {
      // Token expired or revoked — clear stored key
      await chrome.storage.local.remove(['tsdr_api_key', 'tsdr_email']);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'tseeder — Session expired',
        message: 'Please sign in again at tseeder.cc.',
      });
      chrome.tabs.create({ url: 'https://tseeder.cc/auth/login?ext=1&reason=expired' });
    } else {
      throw new Error(`API error ${res.status}`);
    }
  } catch (err) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'tseeder ❌',
      message: `Failed: ${err.message}`,
    });
  }
}
