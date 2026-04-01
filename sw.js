const CACHE = 'zso-v3';
const FONTS_CACHE = 'zso-fonts-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== FONTS_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Cache-first for Google Fonts (CSS + binary)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(FONTS_CACHE).then(cache =>
        cache.match(e.request).then(cached =>
          cached || fetch(e.request).then(response => {
            cache.put(e.request, response.clone());
            return response;
          })
        )
      )
    );
    return;
  }

  // Network-first for HTML navigation
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for all other assets
  e.respondWith(
    caches.match(e.request).then(r =>
      r || fetch(e.request).then(resp => {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      })
    )
  );
});
