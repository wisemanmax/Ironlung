// ═══ IRONLOG Service Worker v5.0 ═══
// Phase 5: Offline fallback, background sync, push hardening, cache tuning
var SW_VERSION = 'ironlog-v6.0';
var CACHE_NAME = SW_VERSION;
var OFFLINE_PAGE = './offline.html';
var APP_FILES = ['./', './index.html', './icon.svg', './manifest.json', OFFLINE_PAGE];
var CDN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days for CDN assets

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(APP_FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
      .then(function() { return self.clients.matchAll({type:'window'}); })
      .then(function(clients) { clients.forEach(function(c) { c.postMessage({type:'SW_UPDATED',version:SW_VERSION}); }); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (url.indexOf('/api/') !== -1) return;

  // HTML: NETWORK FIRST — always get latest code
  if (e.request.mode === 'navigate' || url.indexOf('index.html') !== -1 || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(function(nr) {
        if (nr.ok) {
          var rc = nr.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, rc); });
        }
        return nr;
      }).catch(function() {
        return caches.match(e.request).then(function(cr) {
          // #1: Offline fallback — serve offline.html if no cache
          return cr || caches.match(OFFLINE_PAGE);
        });
      })
    );
    return;
  }

  // #5: CDN/Library assets — cache first with max-age
  if (url.indexOf('cdnjs.cloudflare.com') !== -1 || url.indexOf('fonts.googleapis.com') !== -1 ||
      url.indexOf('fonts.gstatic.com') !== -1 || url.indexOf('unpkg.com') !== -1) {
    e.respondWith(
      caches.match(e.request).then(function(cr) {
        if (cr) {
          // Check if cached version is still fresh (7 days)
          var cachedDate = cr.headers.get('date');
          if (cachedDate && (Date.now() - new Date(cachedDate).getTime()) < CDN_MAX_AGE) {
            return cr;
          }
        }
        return fetch(e.request).then(function(nr) {
          if (nr.ok) {
            var rc = nr.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(e.request, rc); });
          }
          return nr;
        }).catch(function() { return cr; });
      })
    );
    return;
  }

  // Other assets: STALE WHILE REVALIDATE
  e.respondWith(
    caches.match(e.request).then(function(cr) {
      var fn = fetch(e.request).then(function(nr) {
        if (nr.ok) {
          var rc = nr.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, rc); });
        }
        return nr;
      }).catch(function() { return cr; });
      return cr || fn;
    })
  );
});

// ═══ #2: Background Sync ═══
self.addEventListener('sync', function(e) {
  if (e.tag === 'ironlog-sync' || e.tag === 'ironlog-periodic') {
    e.waitUntil(doBackgroundSync());
  }
});

// #2: Periodic background sync (where supported)
self.addEventListener('periodicsync', function(e) {
  if (e.tag === 'ironlog-periodic-sync') {
    e.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Notify all clients to trigger sync
  return self.clients.matchAll({type: 'window'}).then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({type: 'BACKGROUND_SYNC'});
    });
  });
}

// ═══ #3: Web Push Hardening ═══
self.addEventListener('push', function(e) {
  var data = {title: 'IRONLOG', body: 'You have a new notification'};
  try {
    if (e.data) data = e.data.json();
  } catch(err) {
    if (e.data) {
      var text = e.data.text();
      if (text) data.body = text;
    }
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'IRONLOG', {
      body: data.body || '',
      icon: './icon.svg',
      badge: './icon.svg',
      tag: data.tag || 'ironlog-notif',
      renotify: true,
      data: data.data || data.url || '/'
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var notifData = e.notification.data || '/';
  e.waitUntil(
    self.clients.matchAll({type: 'window'}).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf('ironlog') !== -1) {
          clients[i].focus();
          // Tell client to navigate to chat
          if (typeof notifData === 'object' && notifData.type === 'dm') {
            clients[i].postMessage({type: 'OPEN_DM', from: notifData.from});
          }
          return;
        }
      }
      return self.clients.openWindow('/');
    })
  );
});

// #3: Re-subscribe on push subscription change
self.addEventListener('pushsubscriptionchange', function(e) {
  // oldSubscription can be null if the previous subscription is no longer available
  if (!e.oldSubscription) {
    // Notify the client to prompt the user to re-subscribe manually
    e.waitUntil(
      self.clients.matchAll({type: 'window'}).then(function(clients) {
        clients.forEach(function(c) {
          c.postMessage({type: 'PUSH_SUBSCRIPTION_LOST'});
        });
      })
    );
    return;
  }
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options).then(function(sub) {
      // Notify client to update server with new subscription
      return self.clients.matchAll({type: 'window'}).then(function(clients) {
        clients.forEach(function(c) {
          c.postMessage({type: 'PUSH_RESUBSCRIBED', subscription: sub.toJSON()});
        });
      });
    })
  );
});

// ═══ Message handler ═══
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'CHECK_PUSH_HEALTH') {
    self.registration.pushManager.getSubscription().then(function(sub) {
      e.source.postMessage({
        type: 'PUSH_HEALTH',
        active: !!sub,
        endpoint: sub ? sub.endpoint : null,
        expirationTime: sub ? sub.expirationTime : null
      });
    });
  }
});
