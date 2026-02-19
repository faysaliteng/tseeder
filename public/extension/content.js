// tseeder Content Script — auto-intercept magnet clicks (optional)
// Adds a small "Send to tseeder" button next to magnet links on any page

(function () {
  'use strict';

  const isMagnetPage = document.querySelectorAll('a[href^="magnet:"]').length > 0;
  if (!isMagnetPage) return;

  function addTseederButton(anchor) {
    if (anchor.dataset.tsdrAdded) return;
    anchor.dataset.tsdrAdded = 'true';

    const btn = document.createElement('button');
    btn.textContent = '⚡';
    btn.title = 'Send to tseeder Cloud';
    btn.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'margin-left:5px',
      'padding:1px 7px',
      'background:linear-gradient(135deg,#6366f1,#8b5cf6)',
      'color:white',
      'border:none',
      'border-radius:5px',
      'font-size:11px',
      'font-weight:700',
      'cursor:pointer',
      'vertical-align:middle',
      'box-shadow:0 0 8px rgba(99,102,241,0.4)',
    ].join(';');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Send message to background to queue this magnet
      chrome.runtime.sendMessage({
        type: 'TSDR_QUEUE_MAGNET',
        magnetUri: anchor.href,
      });
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = '⚡'; }, 2500);
    });

    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
  }

  document.querySelectorAll('a[href^="magnet:"]').forEach(addTseederButton);

  // Observe dynamic pages (trackers that load results via JS)
  const observer = new MutationObserver(() => {
    document.querySelectorAll('a[href^="magnet:"]').forEach(addTseederButton);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
