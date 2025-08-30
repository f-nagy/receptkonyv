// Service Worker a PWA funkcionalitáshoz
const CACHE_NAME = 'receptkonyv-v2.3.3.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/index-demo.html',
  '/index.css',
  '/index.tsx',
  '/manifest.json',
  '/version.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm'
];

// Service Worker telepítése
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache megnyitva');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Kérések elfogása és cache-ből kiszolgálása
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Ha van cache-ben, akkor azt adjuk vissza
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Régi cache-ek törlése
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
