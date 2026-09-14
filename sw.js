// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  Loren Service Worker
//  Change CACHE_VERSION whenever you update Loren.html
//  so the SW picks up the new file immediately.
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const CACHE_VERSION  = 'Loren-r1';           // \u2190 bump this (e.g. Loren-r2) after every update to Loren.html
const CACHE_NAME     = 'loren-' + CACHE_VERSION;
const OFFLINE_URL    = './Loren.html';

// Files to cache on install
const PRECACHE = [
  './Loren.html',          // was './v3.html' \u2014 fixed
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// \u2500\u2500 Install: cache the shell immediately \u2500\u2500\u2500\u2500\u2500\u2500
self.addEventListener('install', (event) => {
  self.skipWaiting();   // activate right away, don't wait for old SW to die
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

// \u2500\u2500 Activate: delete ALL old caches \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)   // keep only current version
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())    // take control of all open tabs now
  );
});

// ── Fetch: network-first for HTML, cache-first for assets ──
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and cross-origin
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // ?reset= busts the cache entirely
  if (url.searchParams.has('reset')) {
    event.respondWith(fetch(req));
    return;
  }

  // Network-first for HTML
  if (req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

// ── Message: clear cache on reset ──────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => event.source.postMessage({ type: 'CACHE_CLEARED' }));
  }
});
