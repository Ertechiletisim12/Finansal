// Er-Tech İletişim — Service Worker (v186+)
// Ayrı dosya olarak sunulur (same-origin) — PWA kurulabilirliği bunu gerektirir.
const CACHE_VER = 'finansal-v212';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VER).then(c => c.addAll(['./index.html','./manifest.json']).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_VER).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
    if(r&&r.status===200&&r.type==='basic'){
      caches.open(CACHE_VER).then(c=>c.put(e.request,r.clone()));
    }
    return r;
  })));
});
