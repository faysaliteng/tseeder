// tseeder Extension Popup Script
const API_BASE = 'https://tseeder.cc';

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
  setTimeout(() => { statusMsg.className = 'status-msg'; }, 4000);
}

async function checkAuth() {
  return new Promise(resolve => {
    chrome.storage.local.get(['tsdr_email', 'tsdr_token'], data => {
      resolve(data);
    });
  });
}

async function init() {
  const auth = await checkAuth();
  if (auth.tsdr_token && auth.tsdr_email) {
    loginState.style.display  = 'none';
    loggedState.style.display = 'block';
    userEmail.textContent = auth.tsdr_email;
    userInitial.textContent   = auth.tsdr_email[0].toUpperCase();
    scanPageForMagnets();
  }
}

function scanPageForMagnets() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links
          .map(a => a.href)
          .filter(h => h.startsWith('magnet:'))
          .slice(0, 5);
      }
    }, results => {
      const magnets = results?.[0]?.result ?? [];
      if (magnets.length === 0) {
        quickActions.innerHTML = '<span style="font-size:12px;color:#475569;">No magnets found on this page</span>';
        return;
      }
      quickActions.innerHTML = '';
      magnets.forEach(m => {
        const name = decodeURIComponent(m.match(/dn=([^&]*)/)?.[1] ?? 'Unknown torrent').slice(0, 30);
        const chip = document.createElement('button');
        chip.className = 'qa-chip';
        chip.title = m;
        chip.textContent = '⚡ ' + name;
        chip.onclick = () => { magnetInput.value = m; sendBtn.click(); };
        quickActions.appendChild(chip);
      });
    });
  });
}

sendBtn.addEventListener('click', async () => {
  const val = magnetInput.value.trim();
  if (!val) { showStatus('Paste a magnet link or URL first', 'error'); return; }

  const auth = await checkAuth();
  if (!auth.tsdr_token) { showStatus('Not signed in', 'error'); return; }

  sendBtn.textContent = '⏳ Sending…';
  sendBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.tsdr_token}`,
      },
      body: JSON.stringify({ type: 'magnet', magnetUri: val }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    magnetInput.value = '';
    showStatus('✅ Sent to your cloud vault!', 'success');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'tseeder',
      message: 'Torrent added to your cloud queue!',
    });
  } catch (err) {
    showStatus('Failed: ' + err.message, 'error');
  } finally {
    sendBtn.textContent = '⚡ Send to Cloud';
    sendBtn.disabled = false;
  }
});

init();
