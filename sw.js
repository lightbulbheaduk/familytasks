const CACHE_NAME = 'daymark-shell-v3';
const APP_SHELL = ['/', '/index.html', '/styles.css', '/core.js', '/app.js', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith('daymark-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});