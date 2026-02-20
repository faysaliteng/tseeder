// fseeder Extension — Background Service Worker
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

  const auth = await chrome.storage.local.get(['tsdr_token', 'tsdr_email']);
  if (!auth.tsdr_token) {
    chrome.notifications.create({
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

chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === 'TSDR_QUEUE_MAGNET' && msg.magnetUri) {
    chrome.storage.local.get(['tsdr_token'], async (auth) => {
      if (!auth.tsdr_token) {
        chrome.notifications.create({
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

// ── External message from web app (auth bridge — still supported) ─────────────

chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TSDR_AUTH') {
    chrome.storage.local.set({
      tsdr_token: msg.token,
      tsdr_email: msg.email,
    }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'TSDR_SIGNOUT') {
    chrome.storage.local.remove(['tsdr_token', 'tsdr_email'], () => {
      sendResponse({ ok: true });
    });
    return true;
  }
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
      chrome.notifications.create({
        type: 'basic',
        iconUrl: ICON,
        title: 'fseeder ✅',
        message: 'Added to your cloud vault!',
      });
    } else if (res.status === 401) {
      await chrome.storage.local.remove(['tsdr_token', 'tsdr_email']);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: ICON,
        title: 'fseeder — Session expired',
        message: 'Please sign in again via the extension.',
      });
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
