/* -- Service Worker for TvSuper (GitHub Pages) -- */
const CACHE_NAME = 'tvsuper-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/detail.css',
  '/js/shared.js',
  '/js/auth.js',
  '/js/indexeddb.js',
  '/js/tmdb.js',
  '/js/ui.js',
  '/js/search.js',
  '/js/favorites.js',
  '/js/rendering.js',
  '/js/app.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Only cache same-origin requests and Google Fonts
  var url = new URL(event.request.url);
  if (url.pathname.endsWith('.json')) {
    // Network-first for JSON data
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request).then(function(fetchResponse) {
        if (fetchResponse && fetchResponse.status === 200 && !url.pathname.includes('api.themoviedb.org')) {
          var responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      });
    }).catch(function() {
      // Offline fallback for navigations
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
