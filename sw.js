// Er-Tech İletişim — Service Worker
// Ayrı dosya olarak sunulur (same-origin) — PWA kurulabilirliği bunu gerektirir.
//
// v261 düzeltmeleri:
//  1) CDN kütüphaneleri (xlsx, jspdf, autotable, html2canvas) artık precache'leniyor.
//     Eskiden `r.type==='basic'` filtresi cross-origin yanıtları elediği için bunlar
//     ASLA cache'lenmiyordu → offline'da Excel/PDF/PNG dışa aktarma çalışmıyordu.
//  2) İkonlar precache listesine eklendi.
//  3) CACHE_VER, index.html içindeki APP_VERSION ile hizalandı. HER YAYINDA BUNU BUMP ET.

const APP_VER   = 'v358';
const CACHE_VER = 'finansal-' + APP_VER;

// Same-origin çekirdek dosyalar — biri bile inmezse install başarısız olsun istemiyoruz,
// bu yüzden tek tek ekliyoruz (addAll hepsi-ya-hiç çalışır).
const CEKIRDEK = [
  './',
  './index.html',
  './manifest.json',
  './xlsx-style.min.js',   // v265: stil destekli SheetJS catali (renkli/formatli Excel)
  './pdf-font-tr.js',      // v265: PDF icin Turkce alt-kumelenmis Roboto
  './icon192.png',
  './icon512.png',
  './icon192-maskable.png',
  './icon512-maskable.png'
];

// Cross-origin kütüphaneler. `no-cors` ile çekilir → opaque response.
// Opaque yanıtlar cache'lenebilir ve <script src> ile sorunsuz kullanılabilir.
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

async function tekTekCachele(cache, urls, opts) {
  await Promise.all(urls.map(async (u) => {
    try {
      const req = new Request(u, opts || {});
      const res = await fetch(req);
      // opaque (status 0) yanıtları da kabul et — cross-origin script için normaldir
      if (res && (res.ok || res.type === 'opaque')) {
        await cache.put(req, res.clone());
      }
    } catch (e) { /* tek dosya inmezse install'ı düşürme */ }
  }));
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_VER);
    await tekTekCachele(cache, CEKIRDEK, { cache: 'reload' });
    await tekTekCachele(cache, CDN, { mode: 'no-cors', cache: 'reload' });
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Cache'lenmesi YASAK olan hedefler: canlı veri uçları.
// Bunlar hiçbir koşulda cache'e yazılmamalı, cache'den okunmamalı.
function canliVeriMi(url) {
  return /(^|\.)googleapis\.com$/.test(url.hostname)
      || /(^|\.)firebaseio\.com$/.test(url.hostname)
      || /(^|\.)firebasedatabase\.app$/.test(url.hostname)
      || /(^|\.)github\.com$/.test(url.hostname);
}

self.addEventListener('fetch', e => {
  const req = e.request;

  // GET dışındaki her şey (POST/PUT/PATCH...) doğrudan ağa. cache.put(POST) hata fırlatır.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase / GitHub API → asla cache. Ağ yoksa hata dönsün, uygulama kuyruğa alsın.
  if (canliVeriMi(url)) return;

  // Sayfa gezinmesi → network-first (yeni sürüm hemen gelsin), offline'da cache'ten index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(r => {
          if (r && r.ok) {
            const kopya = r.clone();
            caches.open(CACHE_VER).then(c => c.put('./index.html', kopya)).catch(() => {});
          }
          return r;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Diğer her şey → cache-first, yoksa ağdan çek ve cache'e yaz
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: false });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // basic = same-origin, cors = izinli cross-origin, opaque = no-cors script/img
      if (res && (res.ok || res.type === 'opaque')) {
        const kopya = res.clone();
        caches.open(CACHE_VER).then(c => c.put(req, kopya)).catch(() => {});
      }
      return res;
    } catch (err) {
      // Son çare: gezinme olmayan istek başarısız → cache'te herhangi bir eşleşme var mı
      const yedek = await caches.match(req, { ignoreSearch: true });
      if (yedek) return yedek;
      throw err;
    }
  })());
});

// index.html'den gelen "hemen aktive ol" mesajı (isteğe bağlı kullanım)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
