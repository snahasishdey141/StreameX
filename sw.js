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

self.addEventListener('push', function(event) {
  // Check if the push message has data
  const payload = event.data ? event.data.text() : 'New movies are available on StreameX!';

  const options = {
    body: payload,
    icon: '/assets/icon-192.png', // Your app icon
    badge: '/favicon.png', // A small monochrome icon for the Android status bar
    vibrate: [200, 100, 200],
    data: {
      url: 'https://streamex.pages.dev/' // Where to take them when they click it
    }
  };

  // Show the notification
  event.waitUntil(
    self.registration.showNotification('StreameX', options)
  );
});

// Handle what happens when the user clicks the notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});