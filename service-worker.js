// My Dream Bucket - works offline: the app's and the website's own files are kept on the phone, and the fonts from
// Google Fonts once they have loaded; anything else from another site (the map library, map outlines and pictures) goes
// to the network as usual. Bump CACHE with every release.
const CACHE = 'mydreambucket-v2';
const FONTS = 'mydreambucket-fonts-v1';
const ASSETS = [
  './',
  './index.html',
  './app.html',
  './styles.css',
  './app.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon.ico',
  './js/mode.js',
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
  './site/site.css',
  './site/site.js',
  './site/shot-list.webp',
  './site/shot-places.webp',
  './site/shot-milestones.webp',
  './site/shot-insights.webp',
  './site/shot-plan.webp',
  './site/shot-map.webp',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The fonts: the kept copy at once, refreshed in the background.
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // The network first (so a new release shows at once), the kept copy when offline.
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((r) => r || caches.match(req.mode === 'navigate' && /app\.html/.test(url.pathname) ? './app.html' : './index.html'))));
});
