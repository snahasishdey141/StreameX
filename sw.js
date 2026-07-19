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
      
      // 1. Create a background network request to fetch the newest data
      const fetchPromise = fetch(event.request).then(networkResponse => {
        
        // 2. Open the cache and silently update it with the fresh data
        caches.open(CACHE_NAME).then(cache => {
          // We clone the response because it can only be consumed once
          cache.put(event.request, networkResponse.clone());
        });
        
        return networkResponse;
      }).catch(err => {
        // If the network completely fails, do nothing. 
        // The user will just continue using the cached version.
        console.log('Network request failed, relying completely on cache.', err);
      });

      // 3. IMMEDIATELY return the cached response so the site loads instantly.
      // If there is no cached response (first time visit), wait for the network fetch.
      return cachedResponse || fetchPromise;
    })
  );
});