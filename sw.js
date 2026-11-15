const CACHE_NAME = 'daymark-shell-v4';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'core.js',
  'app.js',
  'manifest.webmanifest',
  'assets/daymark-icon.svg',
  'assets/daymark-180.png',
  'assets/daymark-192.png',
  'assets/daymark-512.png'
].map(path => new URL(path, self.registration.scope).toString());

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