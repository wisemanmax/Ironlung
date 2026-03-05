// ═══ IRONLOG Service Worker v4.1.1 ═══
// IMPORTANT: Increment SW_VERSION on every deploy
var SW_VERSION = 'ironlog-v4.2';
var CACHE_NAME = SW_VERSION;
var APP_FILES = ['./', './index.html', './icon.svg', './manifest.json'];

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
        return caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, nr.clone()); return nr; });
      }).catch(function() {
        return caches.match(e.request).then(function(c) { return c || caches.match('./index.html'); });
      })
    );
    return;
  }

  // CDN + static: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        var fp = fetch(e.request).then(function(nr) { cache.put(e.request, nr.clone()); return nr; }).catch(function() { return cached; });
        return cached || fp;
      });
    })
  );
});

self.addEventListener('push', function(e) {
  var data = {title:'IRONLOG',body:'Time to train!',tag:'default'};
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch(err) {}
  var options = {body:data.body,icon:'./icon.svg',badge:'./icon.svg',tag:data.tag||'ironlog-'+Date.now(),renotify:true,vibrate:[100,50,100],data:data,actions:[]};
  if (data.tag==='workout-reminder') options.actions=[{action:'log_workout',title:'Log Workout'},{action:'dismiss',title:'Skip'}];
  else if (data.tag==='checkin-reminder') options.actions=[{action:'checkin',title:'Check In'},{action:'dismiss',title:'Later'}];
  else options.actions=[{action:'open',title:'Open App'}];
  e.waitUntil(self.registration.showNotification(data.title||'IRONLOG',options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var action=e.action,tab='home';
  if(action==='log_workout')tab='log_workout';else if(action==='checkin')tab='home';else if(action==='log_nutrition')tab='log_nutrition';else if(action==='dismiss')return;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(clients){
    for(var i=0;i<clients.length;i++){if('focus' in clients[i]){clients[i].focus();clients[i].postMessage({type:'NAVIGATE',tab:tab});return;}}
    if(self.clients.openWindow)return self.clients.openWindow('./#'+tab);
  }));
});

self.addEventListener('sync', function(e) { if(e.tag==='ironlog-sync')e.waitUntil(processSyncQueue()); });

function openSyncDB(){return new Promise(function(res,rej){var r=indexedDB.open('ironlog-sync-queue',1);r.onupgradeneeded=function(e){var db=e.target.result;if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'id',autoIncrement:true});};r.onsuccess=function(e){res(e.target.result);};r.onerror=function(e){rej(e.target.error);};});}

function processSyncQueue(){return openSyncDB().then(function(db){return new Promise(function(resolve){var tx=db.transaction('queue','readonly');var ga=tx.objectStore('queue').getAll();ga.onsuccess=function(){var items=ga.result;if(!items||!items.length){resolve();return;}var latest=items[items.length-1];var stale=items.slice(0,-1);if(new Date(latest.timestamp).getTime()+86400000<Date.now()){db.transaction('queue','readwrite').objectStore('queue').clear();resolve();return;}if(stale.length>0){var dt=db.transaction('queue','readwrite');stale.forEach(function(i){dt.objectStore('queue').delete(i.id);});}if((latest.retries||0)>=5){db.transaction('queue','readwrite').objectStore('queue').delete(latest.id);resolve();return;}fetch(latest.url,{method:'POST',headers:{'Content-Type':'application/json'},body:latest.body}).then(function(r){if(r.ok)db.transaction('queue','readwrite').objectStore('queue').delete(latest.id);resolve();}).catch(function(){db.transaction('queue','readwrite').objectStore('queue').put(Object.assign({},latest,{retries:(latest.retries||0)+1}));resolve();});};ga.onerror=function(){resolve();};});}).catch(function(){});}

self.addEventListener('message', function(e) {
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
  if(e.data&&e.data.type==='GET_VERSION')e.source.postMessage({type:'SW_VERSION',version:SW_VERSION});
  if(e.data&&e.data.type==='GET_QUEUE_COUNT'){openSyncDB().then(function(db){var tx=db.transaction('queue','readonly');var c=tx.objectStore('queue').count();c.onsuccess=function(){e.source.postMessage({type:'QUEUE_COUNT',count:c.result});};}).catch(function(){e.source.postMessage({type:'QUEUE_COUNT',count:0});});}
});
