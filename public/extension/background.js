// tseeder Extension — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for magnet links
  chrome.contextMenus.create({
    id: 'tsdr-send-magnet',
    title: '⚡ Send to tseeder Cloud',
    contexts: ['link'],
    targetUrlPatterns: ['magnet:*'],
  });

  // Create context menu for any link
  chrome.contextMenus.create({
    id: 'tsdr-send-link',
    title: '⚡ Send URL to tseeder',
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
      iconUrl: 'icon48.png',
      title: 'tseeder',
      message: 'Please sign in to tseeder first.',
    });
    chrome.tabs.create({ url: 'https://tseeder.cc/auth/login?ext=1' });
    return;
  }

  try {
    const isMagnet = url.startsWith('magnet:');
    const body = isMagnet
      ? { type: 'magnet', magnetUri: url }
      : { type: 'url', url };

    const res = await fetch('https://tseeder.cc/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.tsdr_token}`,
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
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'tseeder ❌',
      message: `Failed to add: ${err.message}`,
    });
  }
});

// Listen for auth token from the web app (set after login)
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TSDR_AUTH') {
    chrome.storage.local.set({
      tsdr_token: msg.token,
      tsdr_email: msg.email,
    });
    sendResponse({ ok: true });
  }
});
