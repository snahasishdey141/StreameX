const CACHE_NAME = 'streamex-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      
      const fetchPromise = fetch(event.request).then(networkResponse => {
        
        // 1. CLONE THE RESPONSE IMMEDIATELY before doing anything else
        const responseToCache = networkResponse.clone();
        
        // 2. Now open the cache and save the clone
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        // 3. Return the original to the browser
        return networkResponse;
        
      }).catch(err => {
        console.log('Network request failed, relying completely on cache.', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});