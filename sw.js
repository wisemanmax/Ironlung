var CACHE_NAME = 'ironlog-v5';
var APP_FILES = ['./', './index.html', './icon.svg', './manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(APP_FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (url.indexOf('/api/') !== -1) return;

  // CDN: stale-while-revalidate
  if (url.indexOf('jsdelivr.net') !== -1 || url.indexOf('unpkg.com') !== -1 || 
      url.indexOf('googleapis.com') !== -1 || url.indexOf('gstatic.com') !== -1 ||
      url.indexOf('cdnjs.cloudflare.com') !== -1) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var fp = fetch(e.request).then(function(nr) {
            cache.put(e.request, nr.clone()); return nr;
          }).catch(function() { return cached; });
          return cached || fp;
        });
      })
    );
    return;
  }

  // App shell: stale-while-revalidate + update notification
  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        var fp = fetch(e.request).then(function(nr) {
          if (cached && nr.ok && url.indexOf('index.html') !== -1) {
            self.clients.matchAll().then(function(clients) {
              clients.forEach(function(c) { c.postMessage({type:'UPDATE_AVAILABLE'}); });
            });
          }
          cache.put(e.request, nr.clone()); return nr;
        }).catch(function() { return cached; });
        return cached || fp;
      });
    })
  );
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
