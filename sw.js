const CACHE_NAME = 'finansal-analiz-v110';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['./index.html','./manifest.json']).catch(()=>{})
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// index.html ve kök → HER ZAMAN ağdan al
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isNav = event.request.mode === 'navigate'
    || url.pathname.endsWith('index.html')
    || url.pathname.endsWith('/');

  if (isNav) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(r => {
        if (r && r.status === 200 && r.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
        }
        return r;
      })
    )
  );
});
