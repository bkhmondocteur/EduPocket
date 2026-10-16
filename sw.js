const CACHE_NAME = 'edupocket-v21';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './license-manager.js',
    './keygen.html',
    './firebase-config.js',
    './app.js',
    './manifest.json',
    './logo.png',
    './logo.jpg'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(ASSETS))
    );
});

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
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Ne pas intercepter les requêtes externes (Firestore, CDNs, etc.)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Stratégie Réseau d'abord (Network-First) pour toujours obtenir les derniers scripts à jour
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Secours hors-ligne depuis le cache
                return caches.match(event.request);
            })
    );
});
