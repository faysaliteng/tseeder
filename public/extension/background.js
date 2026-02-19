// fseeder Extension — Background Service Worker
// Deployers: update API_BASE to your Cloudflare Workers API URL.
const API_BASE = 'https://api.fseeder.cc';
const ICON = 'icon48.svg';

// ── Context menus ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'fsdr-send-magnet',
    title: '⚡ Send to fseeder Cloud',
    contexts: ['link'],
    targetUrlPatterns: ['magnet:*'],
  });

  chrome.contextMenus.create({
    id: 'fsdr-send-link',
    title: '⚡ Send URL to fseeder',
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
      iconUrl: ICON,
      title: 'fseeder',
      message: 'Please sign in to fseeder first.',
    });
    chrome.tabs.create({ url: 'https://fseeder.cc/auth/login?ext=1' });
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
          iconUrl: ICON,
          title: 'fseeder',
          message: 'Please sign in to fseeder first.',
        });
        return;
      }
      await sendJob({ type: 'magnet', magnetUri: msg.magnetUri }, auth.tsdr_api_key);
    });
  }
  return false;
});

// ── External message from web app (auth bridge) ───────────────────────────────

chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TSDR_AUTH') {
    chrome.storage.local.set({
      tsdr_api_key: msg.token,
      tsdr_email: msg.email,
    }, () => {
      sendResponse({ ok: true });
    });
    return true;
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
        iconUrl: ICON,
        title: 'fseeder ✅',
        message: 'Added to your cloud vault!',
      });
    } else if (res.status === 401) {
      await chrome.storage.local.remove(['tsdr_api_key', 'tsdr_email']);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: ICON,
        title: 'fseeder — Session expired',
        message: 'Please sign in again at fseeder.cc.',
      });
      chrome.tabs.create({ url: 'https://fseeder.cc/auth/login?ext=1&reason=expired' });
    } else {
      throw new Error(`API error ${res.status}`);
    }
  } catch (err) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: ICON,
      title: 'fseeder ❌',
      message: `Failed: ${err.message}`,
    });
  }
}
