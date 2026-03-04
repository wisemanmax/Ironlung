var CACHE_NAME = 'ironlog-v7-' + Date.now();
var APP_FILES = ['./', './index.html', './icon.svg', './manifest.json'];

// ─── Install ───
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(APP_FILES); }));
  self.skipWaiting();
});

// ─── Activate ───
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// ─── Fetch: stale-while-revalidate ───
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

// ─── Push Notifications with Action Buttons ───
self.addEventListener('push', function(e) {
  var data = {title: 'IRONLOG', body: 'Time to train!', tag: 'default'};
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch(err) {}
  
  var options = {
    body: data.body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: data.tag || 'ironlog-' + Date.now(),
    renotify: true,
    vibrate: [100, 50, 100],
    data: data,
    actions: []
  };

  // Add context-specific action buttons
  if (data.tag === 'workout-reminder') {
    options.actions = [
      { action: 'log_workout', title: 'Log Workout', icon: './icon.svg' },
      { action: 'dismiss', title: 'Skip Today', icon: './icon.svg' }
    ];
  } else if (data.tag === 'checkin-reminder') {
    options.actions = [
      { action: 'checkin', title: 'Check In', icon: './icon.svg' },
      { action: 'dismiss', title: 'Later', icon: './icon.svg' }
    ];
  } else if (data.tag === 'hydration') {
    options.actions = [
      { action: 'log_nutrition', title: 'Log Water', icon: './icon.svg' },
      { action: 'dismiss', title: 'Done', icon: './icon.svg' }
    ];
  } else {
    options.actions = [
      { action: 'open', title: 'Open App', icon: './icon.svg' }
    ];
  }

  e.waitUntil(self.registration.showNotification(data.title || 'IRONLOG', options));
});

// ─── Notification Click: route to correct page ───
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var action = e.action;
  var targetTab = 'home';

  if (action === 'log_workout') targetTab = 'log_workout';
  else if (action === 'checkin') targetTab = 'home'; // check-in modal is on home
  else if (action === 'log_nutrition') targetTab = 'log_nutrition';
  else if (action === 'dismiss') return;

  e.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clients) {
      // Focus existing window and navigate
      for (var i = 0; i < clients.length; i++) {
        if ('focus' in clients[i]) {
          clients[i].focus();
          clients[i].postMessage({type: 'NAVIGATE', tab: targetTab});
          return;
        }
      }
      // No window open, open new one
      if (self.clients.openWindow) {
        return self.clients.openWindow('./#' + targetTab);
      }
    })
  );
});

// ─── Background Sync: retry failed pushes ───
self.addEventListener('sync', function(e) {
  if (e.tag === 'ironlog-sync') {
    e.waitUntil(processSyncQueue());
  }
});

function openSyncDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('ironlog-sync-queue', 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function(e) { reject(e.target.error); };
  });
}

function processSyncQueue() {
  return openSyncDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('queue', 'readonly');
      var store = tx.objectStore('queue');
      var getAll = store.getAll();
      getAll.onsuccess = function() {
        var items = getAll.result;
        if (!items || items.length === 0) { resolve(); return; }
        
        // #9 Queue compaction: if multiple items, keep only the latest (full-state push)
        var latest = items[items.length - 1];
        var stale = items.slice(0, -1);
        
        // #9 TTL: expire items older than 24 hours
        var now = Date.now();
        var ttl = 24 * 60 * 60 * 1000;
        if (new Date(latest.timestamp).getTime() + ttl < now) {
          // All expired, clear queue
          var clearTx = db.transaction('queue', 'readwrite');
          clearTx.objectStore('queue').clear();
          resolve(); return;
        }

        // Remove stale items (compaction)
        if (stale.length > 0) {
          var delTx = db.transaction('queue', 'readwrite');
          stale.forEach(function(item) { delTx.objectStore('queue').delete(item.id); });
        }

        // Process latest item with retry
        var retries = latest.retries || 0;
        if (retries >= 5) {
          // Max retries, remove
          var rmTx = db.transaction('queue', 'readwrite');
          rmTx.objectStore('queue').delete(latest.id);
          self.clients.matchAll().then(function(clients) {
            clients.forEach(function(c) { c.postMessage({type: 'SYNC_COMPLETE', synced: 0, remaining: 0, failed: true}); });
          });
          resolve(); return;
        }

        fetch(latest.url, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: latest.body
        }).then(function(res) {
          if (res.ok) {
            var okTx = db.transaction('queue', 'readwrite');
            okTx.objectStore('queue').delete(latest.id);
            self.clients.matchAll().then(function(clients) {
              clients.forEach(function(c) { c.postMessage({type: 'SYNC_COMPLETE', synced: 1, remaining: 0}); });
            });
          } else {
            // Increment retry count with backoff
            var retryTx = db.transaction('queue', 'readwrite');
            retryTx.objectStore('queue').put(Object.assign({}, latest, {retries: retries + 1}));
          }
          resolve();
        }).catch(function() {
          var retryTx = db.transaction('queue', 'readwrite');
          retryTx.objectStore('queue').put(Object.assign({}, latest, {retries: (latest.retries || 0) + 1}));
          resolve();
        });
      };
      getAll.onerror = function() { resolve(); };
    });
  }).catch(function() { /* IndexedDB not available */ });
}

// ─── Message handler ───
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'GET_QUEUE_COUNT') {
    openSyncDB().then(function(db) {
      var tx = db.transaction('queue', 'readonly');
      var count = tx.objectStore('queue').count();
      count.onsuccess = function() {
        e.source.postMessage({type: 'QUEUE_COUNT', count: count.result});
      };
    }).catch(function() {
      e.source.postMessage({type: 'QUEUE_COUNT', count: 0});
    });
  }
});
