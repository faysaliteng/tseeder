// fseeder Extension Popup Script
const API_BASE = 'https://api.fseeder.cc';
const ICON = 'icon48.svg';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewLogin     = document.getElementById('view-login');
const viewMain      = document.getElementById('view-main');
const viewJobDetail = document.getElementById('view-job-detail');

const loginEmail    = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginBtn      = document.getElementById('login-btn');
const loginStatus   = document.getElementById('login-status');

const userEmail     = document.getElementById('user-email');
const userInitial   = document.getElementById('user-initial');
const magnetInput   = document.getElementById('magnet-input');
const sendBtn       = document.getElementById('send-btn');
const statusMsg     = document.getElementById('status-msg');
const quickActions  = document.getElementById('quick-actions');

const torrentFile   = document.getElementById('torrent-file');
const filePickBtn   = document.getElementById('file-pick-btn');
const fileName      = document.getElementById('file-name');
const uploadBtn     = document.getElementById('upload-btn');
const fileDrop      = document.getElementById('file-drop');

const jobsList      = document.getElementById('jobs-list');
const refreshBtn    = document.getElementById('refresh-jobs-btn');
const backBtn       = document.getElementById('back-to-jobs');
const jobDetailContent = document.getElementById('job-detail-content');

// ── Helpers ───────────────────────────────────────────────────────────────────
function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = 'status-msg ' + type;
  if (type !== 'loading') {
    setTimeout(() => { el.textContent = ''; el.className = 'status-msg'; }, 4000);
  }
}

async function getStorage(...keys) {
  return new Promise(r => chrome.storage.local.get(keys, r));
}

async function apiCall(path, opts = {}) {
  const data = await getStorage('tsdr_token');
  const headers = { ...opts.headers };
  if (data.tsdr_token) headers['Authorization'] = `Bearer ${data.tsdr_token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    await new Promise(r => chrome.storage.local.remove(['tsdr_token', 'tsdr_email'], r));
    init();
    throw new Error('Session expired — please sign in again');
  }
  return res;
}

function showView(view) {
  [viewLogin, viewMain, viewJobDetail].forEach(v => v.style.display = 'none');
  view.style.display = 'block';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const data = await getStorage('tsdr_token', 'tsdr_email');
  if (data.tsdr_token && data.tsdr_email) {
    showView(viewMain);
    userEmail.textContent = data.tsdr_email;
    userInitial.textContent = data.tsdr_email[0].toUpperCase();
    scanPageForMagnets();
  } else {
    showView(viewLogin);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    showStatus(loginStatus, 'Enter email and password', 'error');
    return;
  }

  loginBtn.textContent = '⏳ Signing in…';
  loginBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/auth/login/extension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!res.ok) {
      const msg = json?.error?.message ?? json?.error ?? `Error ${res.status}`;
      showStatus(loginStatus, msg, 'error');
      return;
    }

    // Store token and email
    await new Promise(r => chrome.storage.local.set({
      tsdr_token: json.token,
      tsdr_email: json.user.email,
    }, r));

    showStatus(loginStatus, '✅ Signed in!', 'success');
    setTimeout(init, 500);
  } catch (err) {
    showStatus(loginStatus, 'Connection failed: ' + err.message, 'error');
  } finally {
    loginBtn.textContent = 'Sign in';
    loginBtn.disabled = false;
  }
});

// Enter key on password field
loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

    if (tab.dataset.tab === 'jobs') loadJobs();
  });
});

// ── Send magnet/URL ───────────────────────────────────────────────────────────
sendBtn.addEventListener('click', async () => {
  const val = magnetInput.value.trim();
  if (!val) { showStatus(statusMsg, 'Paste a magnet link or URL first', 'error'); return; }

  sendBtn.textContent = '⏳ Sending…';
  sendBtn.disabled = true;

  try {
    const isMagnet = val.startsWith('magnet:');
    const body = isMagnet
      ? { type: 'magnet', magnetUri: val }
      : { type: 'url', url: val };

    const res = await apiCall('/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);

    magnetInput.value = '';
    showStatus(statusMsg, '✅ Sent to your cloud vault!', 'success');
    chrome.notifications.create({
      type: 'basic', iconUrl: ICON,
      title: 'fseeder', message: 'Torrent added to your cloud queue!',
    });
  } catch (err) {
    showStatus(statusMsg, 'Failed: ' + err.message, 'error');
  } finally {
    sendBtn.textContent = '⚡ Send to Cloud';
    sendBtn.disabled = false;
  }
});

// ── Torrent file upload ───────────────────────────────────────────────────────
filePickBtn.addEventListener('click', () => torrentFile.click());

torrentFile.addEventListener('change', () => {
  const file = torrentFile.files[0];
  if (file) {
    fileName.textContent = file.name;
    uploadBtn.style.display = 'block';
  } else {
    fileName.textContent = '';
    uploadBtn.style.display = 'none';
  }
});

uploadBtn.addEventListener('click', async () => {
  const file = torrentFile.files[0];
  if (!file) { showStatus(statusMsg, 'Select a .torrent file first', 'error'); return; }

  uploadBtn.textContent = '⏳ Uploading…';
  uploadBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('torrent', file);

    const data = await getStorage('tsdr_token');
    const res = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${data.tsdr_token}` },
      body: formData,
    });

    if (res.status === 401) {
      await new Promise(r => chrome.storage.local.remove(['tsdr_token', 'tsdr_email'], r));
      init();
      return;
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);

    torrentFile.value = '';
    fileName.textContent = '';
    uploadBtn.style.display = 'none';
    showStatus(statusMsg, '✅ Torrent uploaded to cloud!', 'success');
    chrome.notifications.create({
      type: 'basic', iconUrl: ICON,
      title: 'fseeder', message: 'Torrent file uploaded!',
    });
  } catch (err) {
    showStatus(statusMsg, 'Upload failed: ' + err.message, 'error');
  } finally {
    uploadBtn.textContent = '⬆ Upload Torrent';
    uploadBtn.disabled = false;
  }
});

// ── Scan page for magnets ─────────────────────────────────────────────────────
function scanPageForMagnets() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href).filter(h => h.startsWith('magnet:')).slice(0, 5),
    }, results => {
      const magnets = results?.[0]?.result ?? [];
      if (magnets.length === 0) {
        quickActions.innerHTML = '<span class="muted-sm">No magnets found on this page</span>';
        return;
      }
      quickActions.innerHTML = '';
      magnets.forEach(m => {
        const dn = m.match(/dn=([^&]*)/)?.[1] ?? '';
        const name = decodeURIComponent(dn).slice(0, 32) || 'Unknown torrent';
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

// ── Jobs list ─────────────────────────────────────────────────────────────────
async function loadJobs() {
  jobsList.innerHTML = '<span class="muted-sm">Loading…</span>';
  try {
    const res = await apiCall('/jobs?limit=15&sortBy=created_at&sortDir=desc');
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    const jobs = json.jobs ?? json.data ?? [];

    if (jobs.length === 0) {
      jobsList.innerHTML = '<span class="muted-sm">No jobs yet. Send a magnet to get started!</span>';
      return;
    }

    jobsList.innerHTML = '';
    jobs.forEach(job => {
      const el = document.createElement('div');
      el.className = 'job-item';
      const statusClass = {
        completed: 'st-done', downloading: 'st-active', seeding: 'st-active',
        queued: 'st-pending', submitted: 'st-pending',
        failed: 'st-error', cancelled: 'st-error',
      }[job.status] ?? 'st-pending';

      const pct = job.progressPct != null ? `${Math.round(job.progressPct)}%` : '';

      el.innerHTML = `
        <div class="job-name">${escapeHtml(job.name || 'Unnamed')}</div>
        <div class="job-meta">
          <span class="job-status ${statusClass}">${job.status}</span>
          ${pct ? `<span class="job-pct">${pct}</span>` : ''}
          ${job.bytesTotal ? `<span class="job-size">${formatBytes(job.bytesTotal)}</span>` : ''}
        </div>
      `;
      el.addEventListener('click', () => openJobDetail(job.id));
      jobsList.appendChild(el);
    });
  } catch (err) {
    jobsList.innerHTML = `<span class="muted-sm error">Failed to load: ${err.message}</span>`;
  }
}

refreshBtn.addEventListener('click', loadJobs);

// ── Job detail + files ────────────────────────────────────────────────────────
async function openJobDetail(jobId) {
  showView(viewJobDetail);
  jobDetailContent.innerHTML = '<span class="muted-sm">Loading…</span>';

  try {
    const [jobRes, filesRes] = await Promise.all([
      apiCall(`/jobs/${jobId}`),
      apiCall(`/jobs/${jobId}/files`),
    ]);

    if (!jobRes.ok) throw new Error(`Job: ${jobRes.status}`);
    const job = await jobRes.json();
    const filesData = filesRes.ok ? await filesRes.json() : { files: [] };
    const files = filesData.files ?? [];

    let html = `
      <h3 class="detail-title">${escapeHtml(job.name || 'Unnamed')}</h3>
      <div class="detail-meta">
        <span class="job-status ${job.status === 'completed' ? 'st-done' : 'st-active'}">${job.status}</span>
        ${job.progressPct != null ? `<span>${Math.round(job.progressPct)}%</span>` : ''}
        ${job.bytesTotal ? `<span>${formatBytes(job.bytesTotal)}</span>` : ''}
      </div>
    `;

    if (files.length > 0) {
      html += '<div class="divider"></div><label>Files</label><div class="files-list">';
      files.forEach(f => {
        const fname = f.path ? f.path.split('/').pop() : 'Unknown';
        const size = f.sizeBytes ? formatBytes(f.sizeBytes) : '';
        const ready = f.isComplete;
        html += `
          <div class="file-item">
            <div class="file-info">
              <span class="file-fname">${escapeHtml(fname)}</span>
              <span class="file-size">${size}</span>
            </div>
            ${ready
              ? `<button class="btn-dl" data-file-id="${f.id}" data-fname="${escapeHtml(fname)}">⬇</button>`
              : '<span class="muted-sm">pending</span>'
            }
          </div>
        `;
      });
      html += '</div>';
    } else if (job.status === 'completed') {
      html += '<div class="divider"></div><span class="muted-sm">No files registered for this job</span>';
    }

    jobDetailContent.innerHTML = html;

    // Attach download handlers
    jobDetailContent.querySelectorAll('.btn-dl').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fileId = btn.dataset.fileId;
        btn.textContent = '⏳';
        btn.disabled = true;
        try {
          const dlRes = await apiCall(`/files/${fileId}/download`);
          if (!dlRes.ok) throw new Error(`${dlRes.status}`);
          // Get the download URL from the response - it's a proxied stream
          const blob = await dlRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = btn.dataset.fname || 'download';
          a.click();
          URL.revokeObjectURL(url);
          btn.textContent = '✅';
        } catch (err) {
          btn.textContent = '❌';
          console.error('Download failed:', err);
        }
        setTimeout(() => { btn.textContent = '⬇'; btn.disabled = false; }, 2000);
      });
    });
  } catch (err) {
    jobDetailContent.innerHTML = `<span class="muted-sm error">Failed: ${err.message}</span>`;
  }
}

backBtn.addEventListener('click', () => {
  showView(viewMain);
  // Re-select jobs tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="jobs"]').classList.add('active');
  document.getElementById('tab-jobs').classList.add('active');
});

// ── Sign out ──────────────────────────────────────────────────────────────────
document.getElementById('sign-out-btn').addEventListener('click', async () => {
  await new Promise(r => chrome.storage.local.remove(['tsdr_token', 'tsdr_email', 'tsdr_api_base'], r));
  init();
});

// ── Utils ─────────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

init();
