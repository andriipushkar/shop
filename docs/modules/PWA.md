# Progressive Web App (PWA)

Функціональність Progressive Web App для офлайн-роботи та push-сповіщень.

## Overview

Модуль PWA забезпечує:
- Встановлення як додаток
- Офлайн режим
- Push-сповіщення
- Background sync
- Кешування ресурсів

## Features

| Feature | Description |
|---------|-------------|
| Installable | Встановлення на головний екран |
| Offline | Робота без інтернету |
| Push | Push-сповіщення |
| Background Sync | Синхронізація при відновленні зв'язку |
| App-like | Повноекранний режим |

## Manifest

```json
// public/manifest.json
{
  "name": "My Shop - Інтернет-магазин",
  "short_name": "My Shop",
  "description": "Найкращі товари за найкращими цінами",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0d9488",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["shopping"],
  "lang": "uk",
  "shortcuts": [
    {
      "name": "Каталог",
      "url": "/catalog",
      "icons": [{ "src": "/icons/catalog.png", "sizes": "96x96" }]
    },
    {
      "name": "Кошик",
      "url": "/cart",
      "icons": [{ "src": "/icons/cart.png", "sizes": "96x96" }]
    }
  ]
}
```

## Service Worker

```typescript
// public/sw.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/products'),
  new StaleWhileRevalidate({
    cacheName: 'api-products',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Network first for user-specific data
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/cart') ||
               url.pathname.startsWith('/api/v1/orders'),
  new NetworkFirst({
    cacheName: 'api-user',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60, // 1 minute
      }),
    ],
  })
);

// Offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline');
      })
    );
  }
});

// Background sync for cart
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      data: data.data,
      actions: data.actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    clients.openWindow(event.notification.data.url);
  }
});
```

## Push Notifications

### Subscribe to Push

```typescript
import { pushService } from '@/lib/pwa/push';

// Request permission
const permission = await Notification.requestPermission();
if (permission !== 'granted') {
  return;
}

// Subscribe
const subscription = await pushService.subscribe();

// Save subscription to server
await fetch('/api/v1/push/subscribe', {
  method: 'POST',
  body: JSON.stringify(subscription),
});
```

### Send Push Notification

```typescript
// Server-side
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@shop.ua',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Send notification
await webpush.sendNotification(
  subscription,
  JSON.stringify({
    title: 'Ваше замовлення відправлено!',
    body: 'Замовлення #12345 вже в дорозі',
    data: {
      url: '/orders/12345',
    },
    actions: [
      { action: 'view', title: 'Переглянути' },
      { action: 'dismiss', title: 'Закрити' },
    ],
  })
);
```

### Notification Types

```typescript
// Order status
await pushService.send(userId, {
  type: 'order_status',
  title: 'Замовлення #12345',
  body: 'Статус: Відправлено',
  url: '/orders/12345',
});

// Price drop
await pushService.send(userId, {
  type: 'price_drop',
  title: 'Ціна знизилась!',
  body: 'iPhone 15 Pro тепер 40000 грн',
  url: '/product/iphone-15-pro',
});

// Back in stock
await pushService.send(userId, {
  type: 'back_in_stock',
  title: 'Товар знову в наявності',
  body: 'Samsung Galaxy S24 доступний для замовлення',
  url: '/product/samsung-galaxy-s24',
});

// Promo
await pushService.sendBulk({
  type: 'promo',
  title: 'Знижки до 50%!',
  body: 'Тільки сьогодні - розпродаж електроніки',
  url: '/sale',
});
```

## Offline Page

```tsx
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <WifiOffIcon className="w-16 h-16 mx-auto text-gray-400" />
        <h1 className="text-2xl font-bold mt-4">Немає з'єднання</h1>
        <p className="text-gray-600 mt-2">
          Перевірте підключення до інтернету та спробуйте знову
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 bg-teal-600 text-white px-6 py-2 rounded"
        >
          Оновити сторінку
        </button>

        {/* Show cached content */}
        <div className="mt-8">
          <h2 className="font-medium">Нещодавно переглянуті</h2>
          <RecentlyViewedOffline />
        </div>
      </div>
    </div>
  );
}
```

## Install Prompt

```tsx
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    });
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div>
          <h3 className="font-medium">Встановити додаток</h3>
          <p className="text-sm text-gray-600">
            Швидкий доступ та офлайн режим
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrompt(false)}
            className="text-gray-500"
          >
            Пізніше
          </button>
          <button
            onClick={handleInstall}
            className="bg-teal-600 text-white px-4 py-2 rounded"
          >
            Встановити
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Configuration

```bash
# PWA settings
PWA_ENABLED=true
PWA_OFFLINE_ENABLED=true
PWA_PUSH_ENABLED=true

# VAPID keys (generate with web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@shop.ua
```

## next.config.js

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  // Next.js config
});
```

## See Also

- [Performance](../guides/PERFORMANCE.md)
- [Push Notifications](./SMS.md)
- [Offline Support](./CACHE.md)
