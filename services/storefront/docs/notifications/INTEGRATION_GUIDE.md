# Push Notifications Integration Guide

Швидкий старт для інтеграції системи push-сповіщень у ваш проект.

## 1. Додайте NotificationBell до Header

Найпростіший спосіб почати - додати компонент NotificationBell до вашого header.

```tsx
// components/Header.tsx або app/layout.tsx
'use client';

import NotificationBell from '@/components/NotificationBell';

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <div className="logo">My Shop</div>

      <nav className="flex items-center gap-4">
        <a href="/cart">Кошик</a>
        <a href="/profile">Профіль</a>

        {/* Додайте дзвіночок сповіщень */}
        <NotificationBell />
      </nav>
    </header>
  );
}
```

## 2. Ініціалізуйте Service Worker

Service Worker вже налаштований у `/public/sw.js`. Переконайтеся, що він автоматично реєструється при завантаженні додатка:

```tsx
// app/layout.tsx або components/AppInitializer.tsx
'use client';

import { useEffect } from 'react';
import { pushNotifications } from '@/lib/notifications/push-notifications';

export default function RootLayout({ children }) {
  useEffect(() => {
    // Ініціалізувати push notifications
    if (typeof window !== 'undefined') {
      pushNotifications.initialize();
    }
  }, []);

  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
```

## 3. Налаштуйте VAPID ключі

Для production вам потрібні VAPID ключі. Згенеруйте їх:

```bash
npx web-push generate-vapid-keys
```

Додайте до `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here (тільки на сервері)
```

## 4. Відправка сповіщень

### З клієнта (локальні сповіщення)

```typescript
import { notificationService } from '@/lib/notifications';

// Додати локальне сповіщення
await notificationService.addNotification({
  type: 'order_status',
  title: 'Замовлення #12345 відправлено',
  message: 'Ваше замовлення в дорозі',
  data: {
    orderId: '12345',
    actionUrl: '/profile/orders/12345'
  }
});
```

### З сервера (реальні push-сповіщення)

```bash
npm install web-push
```

```typescript
// app/api/orders/[id]/ship/route.ts
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// Налаштуйте VAPID
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;

  // Оновіть статус замовлення в БД
  // ...

  // Отримайте підписку користувача з БД
  const subscription = await db.pushSubscription.findUnique({
    where: { userId: order.userId }
  });

  if (subscription) {
    const payload = JSON.stringify({
      title: `Замовлення #${orderId} відправлено`,
      body: 'Ваше замовлення в дорозі',
      icon: '/icons/icon-192x192.png',
      data: {
        type: 'order_status',
        orderId,
        actionUrl: `/profile/orders/${orderId}`
      }
    });

    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      }, payload);
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  return NextResponse.json({ success: true });
}
```

## 5. Приклади використання

### Приклад 1: Моніторинг зниження цін

```typescript
// app/api/cron/check-price-drops/route.ts
import { NextResponse } from 'next/server';
import { notificationService } from '@/lib/notifications';

export async function GET() {
  // Отримати всі відстежувані товари
  const watchedProducts = await db.priceWatch.findMany({
    include: { product: true, user: true }
  });

  for (const watch of watchedProducts) {
    const currentPrice = watch.product.price;
    const targetPrice = watch.targetPrice;

    if (currentPrice < targetPrice) {
      // Створити сповіщення в БД
      await db.notification.create({
        data: {
          userId: watch.userId,
          type: 'price_drop',
          title: 'Ціна знизилась!',
          message: `${watch.product.name} тепер коштує ${currentPrice} ₴`,
          data: {
            productId: watch.product.id,
            oldPrice: watch.targetPrice,
            newPrice: currentPrice
          }
        }
      });

      // Відправити push
      await sendPushNotification(watch.userId, {
        title: 'Ціна знизилась!',
        body: `${watch.product.name} тепер ${currentPrice} ₴`,
        data: {
          type: 'price_drop',
          productId: watch.product.id
        }
      });
    }
  }

  return NextResponse.json({ success: true });
}
```

### Приклад 2: Сповіщення про наявність товару

```typescript
// app/api/products/[id]/restock/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;

  // Оновити кількість на складі
  const product = await db.product.update({
    where: { id: productId },
    data: { inStock: true, quantity: 100 }
  });

  // Знайти користувачів, які очікують на товар
  const waitingUsers = await db.stockAlert.findMany({
    where: { productId },
    include: { user: true }
  });

  // Відправити сповіщення кожному
  for (const alert of waitingUsers) {
    await db.notification.create({
      data: {
        userId: alert.userId,
        type: 'back_in_stock',
        title: 'Товар знову в наявності!',
        message: `${product.name} знову доступний для замовлення`,
        data: { productId }
      }
    });

    await sendPushNotification(alert.userId, {
      title: 'Товар знову в наявності!',
      body: `${product.name} знову доступний`,
      data: {
        type: 'back_in_stock',
        productId
      }
    });
  }

  return NextResponse.json({ notified: waitingUsers.length });
}
```

### Приклад 3: Промо-кампанія

```typescript
// app/api/marketing/promo/send/route.ts
export async function POST(request: NextRequest) {
  const { title, message, promoCode, targetSegment } = await request.json();

  // Отримати цільову аудиторію
  let users;
  if (targetSegment === 'all') {
    users = await db.user.findMany({
      where: {
        notificationPreferences: {
          promotions: true // Тільки користувачі, які підписані на промо
        }
      }
    });
  }

  // Відправити сповіщення
  for (const user of users) {
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'promotion',
        title,
        message,
        data: { promoCode, actionUrl: '/sale' }
      }
    });

    await sendPushNotification(user.id, {
      title,
      body: message,
      data: {
        type: 'promotion',
        promoCode
      }
    });
  }

  return NextResponse.json({ sent: users.length });
}
```

## 6. Налаштування користувачів

Користувачі можуть налаштувати сповіщення на сторінці `/profile/notifications`. Компонент `NotificationPreferences` вже інтегровано.

## 7. Перегляд сповіщень

Користувачі можуть переглядати всі сповіщення на сторінці `/notifications`.

## 8. Best Practices

### Не спамте користувачів

```typescript
// Перевірте, чи не надсилали ви вже схоже сповіщення
const recentNotifications = await db.notification.findMany({
  where: {
    userId,
    type: 'promotion',
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // За останні 24 години
  }
});

if (recentNotifications.length >= 3) {
  console.log('User already received 3 promo notifications today');
  return;
}
```

### Поважайте режим "Не турбувати"

```typescript
// Перевірте налаштування користувача
const preferences = await db.notificationPreferences.findUnique({
  where: { userId }
});

if (preferences.quietHoursEnabled) {
  const now = new Date();
  const currentTime = `${now.getHours()}:${now.getMinutes()}`;

  // Перевірте, чи зараз режим "Не турбувати"
  if (isWithinQuietHours(currentTime, preferences.quietHoursStart, preferences.quietHoursEnd)) {
    // Відкласти сповіщення на пізніше
    await scheduleNotification(userId, notificationData, preferences.quietHoursEnd);
    return;
  }
}
```

### Персоналізуйте сповіщення

```typescript
const user = await db.user.findUnique({ where: { id: userId } });

const message = `Привіт, ${user.firstName}! Ваше замовлення #${orderId} відправлено`;
```

### Тестуйте на різних пристроях

- Chrome/Edge (Desktop & Mobile)
- Firefox (Desktop & Mobile)
- Safari (macOS & iOS) - обмежена підтримка
- Opera

## 9. Troubleshooting

### Push сповіщення не приходять

1. Перевірте VAPID ключі
2. Перевірте, чи користувач надав дозвіл
3. Перевірте консоль браузера
4. Перевірте, чи HTTPS (або localhost)
5. Перевірте, чи Service Worker активний

### Сповіщення приходять, але не відображаються

1. Перевірте формат payload
2. Перевірте, чи Service Worker правильно обробляє push event
3. Перевірте дозволи операційної системи

### Підписка не зберігається

1. Перевірте API endpoint `/api/notifications/subscribe`
2. Перевірте з'єднання з базою даних
3. Перевірте логи сервера

## 10. Моніторинг та аналітика

Відстежуйте метрики:

```typescript
// Створіть таблицю для метрик
await db.notificationMetrics.create({
  data: {
    userId,
    notificationId,
    type: 'order_status',
    sent: true,
    delivered: true,
    clicked: false,
    sentAt: new Date()
  }
});

// Оновіть при кліку
await db.notificationMetrics.update({
  where: { id: metricId },
  data: {
    clicked: true,
    clickedAt: new Date()
  }
});
```

Аналізуйте дані:

```sql
-- CTR по типу сповіщень
SELECT
  type,
  COUNT(*) as total,
  SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as clicks,
  ROUND(SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::float / COUNT(*) * 100, 2) as ctr
FROM notification_metrics
WHERE sent_at >= NOW() - INTERVAL '30 days'
GROUP BY type;
```

## Готово!

Тепер ваш e-commerce має повноцінну систему push-сповіщень.

Для додаткової інформації див:
- [Повна документація](./PUSH_NOTIFICATIONS.md)
- [API Reference](./API.md)
- [Приклади](./examples/)
