// Basic service worker for PinBoard PWA
// Provides app shell caching + offline support for the main page.
// Notes are stored in localStorage / IndexedDB so they survive offline anyway.

const CACHE_NAME = 'pinboard-v1';
const APP_SHELL = [
  '/',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => {
      // Skip waiting so the new service worker activates immediately
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Allow the page to trigger skipWaiting for immediate update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Network first for API-ish, cache first for shell + static
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Cache successful static assets
          if (response && response.status === 200 && (request.url.includes('/_next/') || request.url.endsWith('.svg') || request.url.endsWith('.css'))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback to index for navigation
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});
