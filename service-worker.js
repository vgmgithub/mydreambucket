// My Dream Bucket - works offline: the app's own files are kept on the phone; anything from another site (the map
// library, map outlines and pictures) goes to the network as usual. Bump CACHE with every release.
const CACHE = 'mydreambucket-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/core/app.js',
  './js/core/db.js',
  './js/core/core.js',
  './js/core/backup.js',
  './js/money/personal-ui.js',
  './js/shell/bucket.js',
  './js/shell/bucket-ui.js',
  './js/shell/bucket-geo.js',
  './js/shell/bucket-map.js',
  './js/shell/bucket-plan.js',
  './js/shell/bucket-plan-ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // The network first (so a new release shows at once), the kept copy when offline.
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
});
