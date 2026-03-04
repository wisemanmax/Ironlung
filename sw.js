const CACHE_NAME = 'ironlog-v3';
const ASSETS = ['./', './index.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('cdnjs.cloudflare.com') || e.request.url.includes('unpkg.com') || e.request.url.includes('youtube.com')) {
    e.respondWith(caches.open(CACHE_NAME).then(c => c.match(e.request).then(r => r || fetch(e.request).then(nr => { c.put(e.request, nr.clone()); return nr; }).catch(() => r))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
