// tseeder Extension Popup Script
// API_BASE is read from storage (set by web app) and falls back to production.
const DEFAULT_API_BASE = 'https://api.tseeder.cc';
const ICON = 'icon48.svg';

const loginState   = document.getElementById('state-login');
const loggedState  = document.getElementById('state-loggedin');
const magnetInput  = document.getElementById('magnet-input');
const sendBtn      = document.getElementById('send-btn');
const statusMsg    = document.getElementById('status-msg');
const quickActions = document.getElementById('quick-actions');
const userEmail    = document.getElementById('user-email');
const userInitial  = document.getElementById('user-initial');

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg ' + type;
  setTimeout(() => {
    statusMsg.textContent = '';
    statusMsg.className = 'status-msg';
  }, 4000);
}

async function getStorage(...keys) {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, resolve);
  });
}

async function init() {
  const data = await getStorage('tsdr_email', 'tsdr_api_key', 'tsdr_api_base');
  if (data.tsdr_api_key && data.tsdr_email) {
    loginState.style.display  = 'none';
    loggedState.style.display = 'block';
    userEmail.textContent     = data.tsdr_email;
    userInitial.textContent   = data.tsdr_email[0].toUpperCase();
    scanPageForMagnets();
  } else {
    loginState.style.display  = 'block';
    loggedState.style.display = 'none';
  }
}

function scanPageForMagnets() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(h => h.startsWith('magnet:'))
          .slice(0, 5);
      },
    }, results => {
      const magnets = results?.[0]?.result ?? [];
      if (magnets.length === 0) {
        quickActions.innerHTML =
          '<span style="font-size:12px;color:#475569;">No magnets found on this page</span>';
        return;
      }
      quickActions.innerHTML = '';
      magnets.forEach(m => {
        const dn   = m.match(/dn=([^&]*)/)?.[1] ?? '';
        const name = decodeURIComponent(dn).slice(0, 32) || 'Unknown torrent';
        const chip = document.createElement('button');
        chip.className   = 'qa-chip';
        chip.title       = m;
        chip.textContent = '⚡ ' + name;
        chip.onclick = () => {
          magnetInput.value = m;
          sendBtn.click();
        };
        quickActions.appendChild(chip);
      });
    });
  });
}

sendBtn.addEventListener('click', async () => {
  const val = magnetInput.value.trim();
  if (!val) {
    showStatus('Paste a magnet link or URL first', 'error');
    return;
  }

  const data = await getStorage('tsdr_api_key', 'tsdr_api_base');
  if (!data.tsdr_api_key) {
    showStatus('Not signed in — please log in at tseeder.cc', 'error');
    return;
  }

  const apiBase = data.tsdr_api_base || DEFAULT_API_BASE;

  sendBtn.textContent = '⏳ Sending…';
  sendBtn.disabled    = true;

  try {
    const isMagnet = val.startsWith('magnet:');
    const body     = isMagnet
      ? { type: 'magnet', magnetUri: val }
      : { type: 'url',    url: val };

    const res = await fetch(`${apiBase}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.tsdr_api_key}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      await new Promise(r => chrome.storage.local.remove(['tsdr_api_key', 'tsdr_email'], r));
      showStatus('Session expired — please sign in again', 'error');
      setTimeout(init, 1500);
      return;
    }

    if (!res.ok) throw new Error(`API error ${res.status}`);

    magnetInput.value = '';
    showStatus('✅ Sent to your cloud vault!', 'success');
    chrome.notifications.create({
      type:     'basic',
      iconUrl:  ICON,
      title:    'tseeder',
      message:  'Torrent added to your cloud queue!',
    });
  } catch (err) {
    showStatus('Failed: ' + err.message, 'error');
  } finally {
    sendBtn.textContent = '⚡ Send to Cloud';
    sendBtn.disabled    = false;
  }
});

// Sign-out button (if present)
const signOutBtn = document.getElementById('sign-out-btn');
if (signOutBtn) {
  signOutBtn.addEventListener('click', async () => {
    await new Promise(r => chrome.storage.local.remove(['tsdr_api_key', 'tsdr_email', 'tsdr_api_base'], r));
    init();
  });
}

init();
