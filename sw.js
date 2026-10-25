/* Source Check service worker: works offline, refreshes the list when online. */
const CACHE = 'source-check-v1.1.0';
const SHELL = ['./', 'index.html', 'matcher.js', 'sources.json', 'quality.json', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Shared links arrive as ./?url=… — serve the cached page for any query string.
  const isPage = e.request.mode === 'navigate';
  const isList = /\/(sources|quality)\.json$/.test(url.pathname);

  if (isList || isPage) {
    // Network first so list updates arrive quickly; fall back to cache offline.
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(isPage ? 'index.html' : e.request, copy)); }
      return res;
    }).catch(() => caches.match(isPage ? 'index.html' : e.request, { ignoreSearch: true })));
    return;
  }

  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
