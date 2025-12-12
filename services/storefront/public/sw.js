// TechShop Service Worker
const CACHE_NAME = 'techshop-v1';
const STATIC_CACHE = 'techshop-static-v1';
const DYNAMIC_CACHE = 'techshop-dynamic-v1';
const IMAGE_CACHE = 'techshop-images-v1';

// Static assets to cache
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/offline.html',
];

// Cache strategies
const CACHE_STRATEGIES = {
    // Cache first, then network
    cacheFirst: async (request, cacheName) => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        try {
            const networkResponse = await fetch(request);
            if (networkResponse.ok) {
                const cache = await caches.open(cacheName);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        } catch (error) {
            return new Response('Offline', { status: 503 });
        }
    },

    // Network first, then cache
    networkFirst: async (request, cacheName) => {
        try {
            const networkResponse = await fetch(request);
            if (networkResponse.ok) {
                const cache = await caches.open(cacheName);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        } catch (error) {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
                return caches.match('/offline.html');
            }
            return new Response('Offline', { status: 503 });
        }
    },

    // Stale while revalidate
    staleWhileRevalidate: async (request, cacheName) => {
        const cachedResponse = await caches.match(request);
        const fetchPromise = fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
                const cache = caches.open(cacheName);
                cache.then(c => c.put(request, networkResponse.clone()));
            }
            return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
    }
};

// Install event
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== IMAGE_CACHE)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // API requests - network first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(CACHE_STRATEGIES.networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // Images - cache first
    if (request.destination === 'image') {
        event.respondWith(CACHE_STRATEGIES.cacheFirst(request, IMAGE_CACHE));
        return;
    }

    // Static assets - cache first
    if (url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)) {
        event.respondWith(CACHE_STRATEGIES.cacheFirst(request, STATIC_CACHE));
        return;
    }

    // HTML pages - network first
    if (request.mode === 'navigate') {
        event.respondWith(CACHE_STRATEGIES.networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // Default - stale while revalidate
    event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// Push notification event
self.addEventListener('push', event => {
    const options = {
        body: event.data?.text() || 'Нове сповіщення від TechShop',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'explore', title: 'Переглянути', icon: '/icons/checkmark.png' },
            { action: 'close', title: 'Закрити', icon: '/icons/xmark.png' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('TechShop', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-cart') {
        event.waitUntil(syncCart());
    }
    if (event.tag === 'sync-wishlist') {
        event.waitUntil(syncWishlist());
    }
});

async function syncCart() {
    // Sync cart data when back online
    console.log('[SW] Syncing cart...');
}

async function syncWishlist() {
    // Sync wishlist data when back online
    console.log('[SW] Syncing wishlist...');
}
