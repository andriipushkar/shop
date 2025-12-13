/**
 * Service Worker для TechShop PWA
 * Enhanced offline support and caching strategies
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `techshop-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `techshop-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `techshop-images-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/offline',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/faq',
    '/about',
    '/contact',
];

// API routes that should use network-first strategy
const API_ROUTES = ['/api/', '/products', '/categories'];

// Image extensions to cache
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];

// Max cache sizes
const MAX_DYNAMIC_CACHE = 100;
const MAX_IMAGE_CACHE = 50;

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await cache.delete(keys[0]);
        await limitCacheSize(cacheName, maxItems);
    }
}

/**
 * Check if request is for an image
 */
function isImageRequest(request) {
    return IMAGE_EXTENSIONS.some(ext => request.url.toLowerCase().includes(ext));
}

/**
 * Check if request is for API
 */
function isApiRequest(request) {
    return API_ROUTES.some(route => request.url.includes(route));
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[SW] Cache install failed:', error);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => {
                    // Delete old version caches
                    return !key.includes(CACHE_VERSION);
                }).map((key) => {
                    console.log('[SW] Deleting old cache:', key);
                    return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - handle network requests with caching strategies
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const { request } = event;

    // API requests: Network first, fallback to cache
    if (isApiRequest(request)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(request, clone);
                            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Image requests: Cache first, then network
    if (isImageRequest(request)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;

                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(IMAGE_CACHE).then((cache) => {
                            cache.put(request, clone);
                            limitCacheSize(IMAGE_CACHE, MAX_IMAGE_CACHE);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Return placeholder image for failed image requests
                    return caches.match('/icons/icon-192x192.png');
                });
            })
        );
        return;
    }

    // Static assets and pages: Stale-while-revalidate
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, clone);
                        limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE);
                    });
                }
                return response;
            }).catch(() => {
                // Return offline page if navigation request fails
                if (request.mode === 'navigate') {
                    return caches.match('/offline');
                }
                return cached;
            });

            return cached || fetchPromise;
        })
    );
});

// Push notification event - handle incoming push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let notificationData = {
        title: 'TechShop',
        body: 'Нове сповіщення',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'notification',
        requireInteraction: false,
        data: {},
        actions: [],
    };

    // Parse notification data
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = { ...notificationData, ...data };
        } catch (error) {
            console.error('[SW] Error parsing push data:', error);
            notificationData.body = event.data.text();
        }
    }

    // Add default actions based on notification type
    if (notificationData.data?.type) {
        switch (notificationData.data.type) {
            case 'order_status':
                notificationData.actions = [
                    { action: 'view', title: 'Переглянути' },
                ];
                break;
            case 'price_drop':
            case 'back_in_stock':
                notificationData.actions = [
                    { action: 'buy', title: 'Купити' },
                    { action: 'view', title: 'Детальніше' },
                ];
                break;
            case 'promotion':
                notificationData.actions = [
                    { action: 'shop', title: 'До магазину' },
                ];
                break;
        }
    }

    // Show notification
    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction,
            data: notificationData.data,
            actions: notificationData.actions,
            vibrate: [200, 100, 200],
            timestamp: Date.now(),
        })
    );
});

// Notification click event - handle user interaction with notifications
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');

    event.notification.close();

    // Handle action clicks
    if (event.action) {
        console.log('[SW] Action clicked:', event.action);
        event.waitUntil(handleNotificationAction(event.action, event.notification.data));
        return;
    }

    // Get the URL to open
    let urlToOpen = '/notifications';

    if (event.notification.data) {
        const { type, orderId, productId, actionUrl, url } = event.notification.data;

        if (url || actionUrl) {
            urlToOpen = url || actionUrl;
        } else if (type === 'order_status' && orderId) {
            urlToOpen = `/profile/orders/${orderId}`;
        } else if ((type === 'price_drop' || type === 'back_in_stock') && productId) {
            urlToOpen = `/product/${productId}`;
        } else if (type === 'promotion') {
            urlToOpen = '/sale';
        }
    }

    // Focus or open window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window open with this URL
            for (const client of clientList) {
                if (client.url.includes(urlToOpen.split('?')[0]) && 'focus' in client) {
                    return client.focus();
                }
            }

            // Open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle notification actions
async function handleNotificationAction(action, data) {
    let urlToOpen = '/';

    switch (action) {
        case 'view':
            if (data?.orderId) {
                urlToOpen = `/profile/orders/${data.orderId}`;
            } else if (data?.productId) {
                urlToOpen = `/product/${data.productId}`;
            } else {
                urlToOpen = '/notifications';
            }
            break;
        case 'buy':
            if (data?.productId) {
                urlToOpen = `/product/${data.productId}`;
            }
            break;
        case 'track':
            if (data?.orderId) {
                urlToOpen = `/profile/orders/${data.orderId}`;
            }
            break;
        case 'shop':
            urlToOpen = '/';
            break;
        case 'checkout':
            urlToOpen = '/cart';
            break;
        default:
            console.log('[SW] Unknown action:', action);
            urlToOpen = '/notifications';
    }

    // Open the URL
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
        if (client.url.includes(urlToOpen.split('?')[0]) && 'focus' in client) {
            return client.focus();
        }
    }

    if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
    }
}

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'SYNC_NOTIFICATIONS') {
        event.waitUntil(syncNotifications());
    }
});

// Sync notifications with server
async function syncNotifications() {
    try {
        const response = await fetch('/api/notifications');
        if (response.ok) {
            const data = await response.json();
            console.log('[SW] Notifications synced successfully');

            // Store in cache for offline access
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put('/api/notifications', new Response(JSON.stringify(data)));
        }
    } catch (error) {
        console.error('[SW] Error syncing notifications:', error);
    }
}

// Background sync event (if supported)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event');

    if (event.tag === 'sync-notifications') {
        event.waitUntil(syncNotifications());
    }
});
