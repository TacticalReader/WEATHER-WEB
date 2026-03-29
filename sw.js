const CACHE_NAME = 'skycast-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/config.js',
  '/icons.js',
  '/particles.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/openweather.png'
];

// Install Event - Cache Core Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Intercept Network Requests
self.addEventListener('fetch', event => {
  // Pass through non-GET requests instantly
  if (event.request.method !== 'GET') return;

  // Bypass cache for external APIs (Weather & GitHub) for fresh data
  if (event.request.url.includes('api.openweathermap.org') || event.request.url.includes('api.github.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache First, Network Fallback strategy for App Shell
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If it's not in the cache, fetch it from the network
      return fetch(event.request).then(fetchResponse => {
        // Dynamically cache incoming images (e.g., dynamic weather background images)
        if (event.request.url.includes('/images/')) {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        }
        return fetchResponse;
      }).catch(() => {
        // Option to return an offline page here if HTML fetch fails
      });
    })
  );
});
