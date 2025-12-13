// Enhanced Service Worker for TechShop PWA
// Version 1.0.0

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE_NAME = `techshop-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `techshop-dynamic-${CACHE_VERSION}`;
const API_CACHE_NAME = `techshop-api-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `techshop-images-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/products/,
  /\/api\/categories/,
  /\/api\/catalog/,
];

// Maximum cache sizes
const MAX_CACHE_SIZE = {
  images: 50,
  dynamic: 30,
  api: 20,
};

// Maximum cache age (in milliseconds)
const MAX_CACHE_AGE = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
  dynamic: 24 * 60 * 60 * 1000,    // 1 day
  api: 5 * 60 * 1000,              // 5 minutes
  images: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Background sync queue
const SYNC_QUEUE = 'techshop-sync-queue';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('techshop-') &&
                     cacheName !== STATIC_CACHE_NAME &&
                     cacheName !== DYNAMIC_CACHE_NAME &&
                     cacheName !== API_CACHE_NAME &&
                     cacheName !== IMAGE_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - Network First strategy with cache fallback
    event.respondWith(handleApiRequest(request));
  } else if (request.destination === 'image') {
    // Images - Cache First strategy
    event.respondWith(handleImageRequest(request));
  } else if (STATIC_ASSETS.includes(url.pathname)) {
    // Static assets - Cache First strategy
    event.respondWith(handleStaticRequest(request));
  } else {
    // Dynamic content - Network First with cache fallback
    event.respondWith(handleDynamicRequest(request));
  }
});

// Handle static requests (Cache First)
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached && !isCacheExpired(cached, MAX_CACHE_AGE.static)) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Handle dynamic requests (Network First)
async function handleDynamicRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
      limitCacheSize(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE.dynamic);
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached && !isCacheExpired(cached, MAX_CACHE_AGE.dynamic)) {
      return cached;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline');
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

// Handle API requests (Network First with short-term cache)
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      const clonedResponse = response.clone();
      cache.put(request, clonedResponse);
      limitCacheSize(API_CACHE_NAME, MAX_CACHE_SIZE.api);
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached && !isCacheExpired(cached, MAX_CACHE_AGE.api)) {
      // Add custom header to indicate cached response
      const clonedResponse = cached.clone();
      return new Response(clonedResponse.body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: new Headers({
          ...Object.fromEntries(clonedResponse.headers.entries()),
          'X-Cache': 'HIT',
          'X-Cache-Date': clonedResponse.headers.get('date') || new Date().toUTCString(),
        }),
      });
    }

    throw error;
  }
}

// Handle image requests (Cache First)
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached && !isCacheExpired(cached, MAX_CACHE_AGE.images)) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
      limitCacheSize(IMAGE_CACHE_NAME, MAX_CACHE_SIZE.images);
    }

    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Check if cache entry is expired
function isCacheExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;

  const cachedDate = new Date(dateHeader).getTime();
  const now = Date.now();

  return (now - cachedDate) > maxAge;
}

// Limit cache size by removing oldest entries
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxSize) {
    const entriesToDelete = keys.length - maxSize;
    for (let i = 0; i < entriesToDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Background Sync - for cart and order operations
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  } else if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  } else if (event.tag.startsWith('sync-')) {
    event.waitUntil(syncGeneric(event.tag));
  }
});

// Sync cart data
async function syncCart() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['syncQueue'], 'readonly');
    const store = tx.objectStore('syncQueue');
    const requests = await store.getAll();

    const cartRequests = requests.filter(req => req.type === 'cart');

    for (const request of cartRequests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        if (response.ok) {
          // Remove from queue
          const deleteTx = db.transaction(['syncQueue'], 'readwrite');
          const deleteStore = deleteTx.objectStore('syncQueue');
          await deleteStore.delete(request.id);
        }
      } catch (error) {
        console.error('[Service Worker] Failed to sync cart request:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync cart failed:', error);
  }
}

// Sync orders
async function syncOrders() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['syncQueue'], 'readonly');
    const store = tx.objectStore('syncQueue');
    const requests = await store.getAll();

    const orderRequests = requests.filter(req => req.type === 'order');

    for (const request of orderRequests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        if (response.ok) {
          // Remove from queue
          const deleteTx = db.transaction(['syncQueue'], 'readwrite');
          const deleteStore = deleteTx.objectStore('syncQueue');
          await deleteStore.delete(request.id);

          // Notify clients
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'ORDER_SYNCED',
              orderId: request.orderId,
            });
          });
        }
      } catch (error) {
        console.error('[Service Worker] Failed to sync order request:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync orders failed:', error);
  }
}

// Generic sync handler
async function syncGeneric(tag) {
  console.log('[Service Worker] Syncing:', tag);
  // Implement generic sync logic
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');

  const options = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'techshop-notification',
    requireInteraction: false,
  };

  let notification = {
    title: 'TechShop',
    body: 'У вас нове повідомлення',
    ...options,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notification = {
        title: data.title || notification.title,
        body: data.body || notification.body,
        icon: data.icon || options.icon,
        badge: data.badge || options.badge,
        data: data.data || {},
        actions: data.actions || [],
        ...options,
      };
    } catch (error) {
      console.error('[Service Worker] Failed to parse push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notification.title, notification)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification.tag);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE_NAME)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('techshop-')) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  }
});

// Open IndexedDB database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TechShopDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
      }

      if (!db.objectStoreNames.contains('cart')) {
        db.createObjectStore('cart', { keyPath: 'id' });
      }
    };
  });
}

console.log('[Service Worker] Loaded');
