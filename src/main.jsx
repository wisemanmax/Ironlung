import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';

// ─── Mount ───
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// ─── Hide loader after mount ───
setTimeout(() => {
  document.getElementById('loader')?.classList.add('done');
  setTimeout(() => {
    const l = document.getElementById('loader');
    if (l) l.style.display = 'none';
  }, 500);
}, 200);

// ─── Service Worker Registration ───
(function () {
  const isGitHubPages = location.hostname.endsWith('github.io');
  const parts = location.pathname.split('/').filter(Boolean);
  const basePath = (isGitHubPages && parts.length) ? '/' + parts[0] + '/' : '/';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(basePath + 'sw.js', { scope: basePath }).then(function (reg) {
      // Check for updates on every app open
      reg.update();
      // Also check every 5 minutes while app is open
      setInterval(function () { reg.update(); }, 5 * 60 * 1000);
      // When new SW is found and waiting, tell it to activate immediately
      reg.addEventListener('updatefound', function () {
        const newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener('statechange', function () {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // New version installed but old one still active — force activation
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    }).catch(function () {});

    // Listen for SW_UPDATED message — reload when new SW activates
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'SW_UPDATED') {
        // New SW activated — reload to get fresh code
        window.location.reload();
      }
    });
  }
})();
