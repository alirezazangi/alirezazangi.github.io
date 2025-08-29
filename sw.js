
const CACHE_NAME = 'dua-app-cache-v4'; // Incremented cache version
const urlsToCache = [
  './',
  './index.html',
  './index.css',
  './index.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Vazirmatn:wght@400;700&family=Noto+Naskh+Arabic:wght@700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('Failed to cache resources during install:', err);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
              return networkResponse;
            }
            
            if (event.request.url.startsWith('chrome-extension://')) {
                return networkResponse;
            }

            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.warn('Fetch failed; returning offline page instead.', error);
            // You can return a fallback offline page here if you have one cached.
            // return caches.match('/offline.html');
        });
      })
  );
});


self.addEventListener('message', event => {
    if (event.data.action === 'cachePrayer') {
        const { url, cache: shouldCache } = event.data;
        caches.open(CACHE_NAME).then(cache => {
            if (shouldCache) {
                console.log('Caching audio:', url);
                // Removed { mode: 'no-cors' } because the proxy provides correct CORS headers
                fetch(url)
                    .then(response => {
                        if (!response.ok) throw new Error(`Fetch failed for ${url} with status ${response.status}`);
                        return cache.put(url, response);
                    })
                    .catch(err => console.error(`Failed to cache ${url}`, err));
            } else {
                console.log('Deleting audio from cache:', url);
                cache.delete(url);
            }
        });
    } else if (event.data.action === 'clearAllCache') {
        console.log('Received request to clear all caches.');
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('Deleting cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }).then(() => {
                console.log('All caches cleared.');
            })
        );
    } else if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
