/* BillKit service worker — © 2026 Shaik Gouse Kareem. All rights reserved.
 * Caches the app shell and static assets so the installed app opens offline.
 * API responses are NOT cached here (bill data offline-copies live in IndexedDB,
 * per signed-in user, and are cleared on sign-out). */
const VERSION = 'billkit-shell-v1';
const SHELL = ['/', '/app', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Network first for pages; fall back to the cached app shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/app')) || (await caches.match('/'))),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webp|woff2|ico|webmanifest)$/.test(url.pathname)) {
    // Static, content-hashed assets: cache first.
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
