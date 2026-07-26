// Import Firebase scripts (Compat version is safest for Service Workers)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCvJxtMLl-M21Kpi5JkcpioLGI9RMwD3R0",
  authDomain: "streamex-v1.firebaseapp.com",
  projectId: "streamex-v1",
  storageBucket: "streamex-v1.firebasestorage.app",
  messagingSenderId: "87040295346",
  appId: "1:87040295346:web:4369ebb00242756e5f24ab"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- SMART CACHING LOGIC STARTS HERE ---

// CHANGED TO v2: This forces the browser to delete the old 1GB v1 cache!
const CACHE_NAME = 'streamex-cache-v2'; 
const IMAGE_CACHE = 'streamex-images-v2';
const MAX_IMAGE_CACHE_ITEMS = 50; // Keeps only the last 50 posters

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
  self.skipWaiting();
});

// Activate Event - Crucial for deleting the old 1GB v1 cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== IMAGE_CACHE) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    
    // 🔥 FIX ADDED HERE: Do not attempt to cache POST, PUT, or DELETE requests
    if (event.request.method !== 'GET') {
        return; 
    }

    const url = new URL(event.request.url);

    // 1. DO NOT cache video streams, APIs, or workers
    if (url.pathname.includes('/play') || url.hostname.includes('workers.dev') || url.hostname.includes('api.themoviedb.org')) {
        return; 
    }

    // 2. Limit Image Caching (wsrv.nl proxy and TMDB images)
    if (url.hostname.includes('wsrv.nl') || url.hostname.includes('tmdb.org')) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;

                try {
                    const fetchResponse = await fetch(event.request);
                    if (fetchResponse.ok) {
                        cache.put(event.request, fetchResponse.clone());
                        limitCacheSize(IMAGE_CACHE, MAX_IMAGE_CACHE_ITEMS); // Prune old images
                    }
                    return fetchResponse;
                } catch (e) {
                    return cachedResponse;
                }
            })
        );
        return;
    }

    // 3. Static UI files (HTML, CSS, JS) - Cache falling back to network
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(err => {
                console.log('Network request failed, relying completely on cache.', err);
            });

            return cachedResponse || fetchPromise;
        })
    );
});

// Helper Function: Prunes cache when it gets too big
async function limitCacheSize(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await cache.delete(keys[0]); 
        limitCacheSize(cacheName, maxItems);
    }
}

// --- PUSH NOTIFICATION LOGIC STARTS HERE ---

self.addEventListener('push', function(event) {
  let notificationTitle = 'StreameX';
  let notificationBody = 'New movies are available!';

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.notification) {
        notificationTitle = payload.notification.title || notificationTitle;
        notificationBody = payload.notification.body || notificationBody;
      }
    } catch (e) {
      notificationBody = event.data.text();
    }
  }

  const options = {
    body: notificationBody,
    icon: '/assets/icon-192.png',
    badge: '/favicon.png', 
    vibrate: [200, 100, 200],
    data: {
      url: 'https://streamex.pages.dev/' 
    }
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
