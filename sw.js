// Service Worker v25.2.46 - Limpiador de Caché
const CACHE_NAME = 'rose-inventory-v25';
const SW_VERSION = '25.2.46';
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
