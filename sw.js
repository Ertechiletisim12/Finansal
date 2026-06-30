const CACHE_NAME = 'finansal-analiz-v57';
const ASSETS = [
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Kurulum: tüm varlıkları önbellekle
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Bazı varlıklar önbelleklenemedi:', err);
      });
    })
  );
  self.skipWaiting();
});

// Aktivasyon: eski önbellekleri temizle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: index.html için ağ-öncelikli (her zaman güncel), diğerleri için önbellek-öncelikli
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first: önce ağdan dene, başarısız olursa önbellekten
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Diğer dosyalar: önbellek-öncelikli (eski davranış)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => {
        return new Response('Çevrimdışı mod - bu içerik önbellekte yok.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
