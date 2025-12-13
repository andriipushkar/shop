# Push Notifications Feature

Комплексна система push-сповіщень для e-commerce storefront з підтримкою Web Push API, управлінням підписками та налаштуваннями користувачів.

## Зміст

- [Огляд](#огляд)
- [Архітектура](#архітектура)
- [Встановлення](#встановлення)
- [Використання](#використання)
- [API](#api)
- [Компоненти](#компоненти)
- [Типи сповіщень](#типи-сповіщень)
- [Тестування](#тестування)
- [Налаштування Production](#налаштування-production)

## Огляд

Система push-сповіщень надає:

- ✅ Web Push API інтеграція
- ✅ Service Worker для фонових сповіщень
- ✅ Управління підписками
- ✅ 4 категорії сповіщень (замовлення, ціни, наявність, акції)
- ✅ Налаштування користувача (Email/Push/SMS)
- ✅ Режим "Не турбувати" (Quiet Hours)
- ✅ UI компоненти (дзвіночок, список, налаштування)
- ✅ Повна сторінка сповіщень з фільтрами
- ✅ Синхронізація з сервером
- ✅ Offline підтримка
- ✅ Unit тести

## Архітектура

```
/lib/notifications/
├── push-notifications.ts    # Базовий сервіс Web Push API
├── push-service.ts          # Розширений сервіс з бізнес-логікою
└── index.ts                 # Експорти

/components/
├── NotificationBell.tsx          # Дзвіночок з випадаючим списком
└── NotificationPreferences.tsx   # Налаштування користувача

/app/
├── notifications/page.tsx             # Повна сторінка сповіщень
├── profile/notifications/page.tsx     # Налаштування в профілі
└── api/notifications/
    ├── route.ts                      # GET, PATCH, DELETE
    ├── subscribe/route.ts            # POST, DELETE (підписка)
    ├── preferences/route.ts          # GET, PUT, PATCH
    ├── mark-all-read/route.ts        # POST
    ├── delete-all/route.ts           # DELETE
    └── unsubscribe/route.ts          # POST

/public/
└── sw.js                    # Service Worker

/__tests__/
└── lib/push-service.test.ts
```

## Встановлення

### 1. Перевірте залежності

Всі необхідні пакети вже включені в `package.json`:

```json
{
  "dependencies": {
    "next": "16.0.7",
    "react": "19.2.0"
  }
}
```

### 2. Згенеруйте VAPID ключі

Для production вам потрібні VAPID ключі:

```bash
npx web-push generate-vapid-keys
```

### 3. Додайте змінні оточення

`.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

### 4. Переконайтеся, що Service Worker зареєстровано

Service Worker вже налаштований у `/public/sw.js` і автоматично реєструється.

## Використання

### Інтеграція NotificationBell в Header

```tsx
// components/Header.tsx
import NotificationBell from '@/components/NotificationBell';

export default function Header() {
  return (
    <header>
      {/* Інші елементи header */}
      <NotificationBell />
    </header>
  );
}
```

### Відправка сповіщення з коду

```typescript
import { notificationService } from '@/lib/notifications/push-service';

// Додати нове сповіщення
await notificationService.addNotification({
  type: 'order_status',
  title: 'Замовлення відправлено',
  message: 'Ваше замовлення #12345 було відправлено',
  data: {
    orderId: '12345',
    actionUrl: '/profile/orders/12345'
  }
});
```

### Відправка з API (server-side)

```typescript
// app/api/orders/[id]/route.ts
import webpush from 'web-push';

export async function POST(request: Request) {
  // ... логіка оновлення замовлення

  // Отримати підписку користувача з БД
  const subscription = await db.pushSubscription.findUnique({
    where: { userId }
  });

  if (subscription) {
    const payload = JSON.stringify({
      title: 'Замовлення відправлено',
      body: `Ваше замовлення #${orderId} в дорозі`,
      data: {
        type: 'order_status',
        orderId,
      }
    });

    await webpush.sendNotification(subscription, payload);
  }
}
```

## API

### NotificationService

```typescript
import { notificationService } from '@/lib/notifications/push-service';

// Отримати всі сповіщення
const notifications = notificationService.getNotifications();

// Фільтрувати сповіщення
const unread = notificationService.getNotifications({ unreadOnly: true });
const orderNotifications = notificationService.getNotifications({ type: 'order_status' });

// Управління сповіщеннями
await notificationService.markAsRead(notificationId);
await notificationService.markAllAsRead();
await notificationService.deleteNotification(notificationId);
await notificationService.deleteAllNotifications();

// Підписка на зміни
const unsubscribe = notificationService.subscribeToUnreadCount((count) => {
  console.log('Unread count:', count);
});

// Налаштування
const preferences = notificationService.getPreferences();
await notificationService.updateChannelPreferences('orderStatus', { push: true });
await notificationService.updateQuietHours({ enabled: true, start: '22:00', end: '08:00' });

// Push підписка
await notificationService.subscribeToPush();
await notificationService.unsubscribeFromPush();
const isEnabled = await notificationService.isPushEnabled();
```

### PushNotificationService (Low-level)

```typescript
import { pushNotifications } from '@/lib/notifications/push-notifications';

// Перевірити підтримку
const isSupported = pushNotifications.isSupported();

// Ініціалізувати
await pushNotifications.initialize();

// Підписатися
const subscription = await pushNotifications.subscribe();

// Створити notification payload
const payload = pushNotifications.createOrderNotification('12345', 'shipped');
await pushNotifications.showNotification(payload);
```

## Компоненти

### NotificationBell

Дзвіночок з випадаючим списком останніх сповіщень.

```tsx
<NotificationBell />
```

**Функції:**
- Показує кількість непрочитаних
- Випадаючий список з останніми 5 сповіщеннями
- Кнопка "Позначити прочитаним"
- Лінк на повну сторінку сповіщень

### NotificationPreferences

Повні налаштування сповіщень користувача.

```tsx
<NotificationPreferences />
```

**Функції:**
- Увімкнення/вимкнення push-сповіщень
- Налаштування за категоріями (Email/Push/SMS)
- Режим "Не турбувати" з вибором часу
- Автоматичне збереження

### Повна сторінка сповіщень

Доступна за адресою `/notifications`

**Функції:**
- Список всіх сповіщень
- Фільтр за типом
- Фільтр "Тільки непрочитані"
- Позначити всі прочитаними
- Видалити всі
- Видалити окремі
- Форматування дат

## Типи сповіщень

### 1. Order Status (`order_status`)

Сповіщення про статус замовлення.

```typescript
await notificationService.addNotification({
  type: 'order_status',
  title: 'Замовлення #12345 оброблюється',
  message: 'Ваше замовлення прийнято в обробку',
  data: {
    orderId: '12345'
  }
});
```

### 2. Price Drop (`price_drop`)

Сповіщення про зниження ціни.

```typescript
await notificationService.addNotification({
  type: 'price_drop',
  title: 'Ціна знизилась на 20%!',
  message: 'iPhone 15 Pro тепер 38999 ₴',
  data: {
    productId: 'iphone-15-pro'
  }
});
```

### 3. Back in Stock (`back_in_stock`)

Сповіщення про появу товару.

```typescript
await notificationService.addNotification({
  type: 'back_in_stock',
  title: 'Товар знову в наявності!',
  message: 'PlayStation 5 знову доступна для замовлення',
  data: {
    productId: 'ps5'
  }
});
```

### 4. Promotion (`promotion`)

Сповіщення про акції та знижки.

```typescript
await notificationService.addNotification({
  type: 'promotion',
  title: 'Чорна п\'ятниця!',
  message: 'Знижки до 50% на всю електроніку',
  data: {
    promoCode: 'BLACKFRIDAY',
    actionUrl: '/sale'
  }
});
```

## Тестування

### Запуск тестів

```bash
npm test -- push-service.test.ts
```

### Покриття тестами

Тести покривають:
- ✅ Додавання/видалення сповіщень
- ✅ Позначення прочитаними
- ✅ Фільтрування
- ✅ Підрахунок непрочитаних
- ✅ Підписка на зміни
- ✅ Налаштування користувача
- ✅ Режим "Не турбувати"
- ✅ Синхронізація з сервером
- ✅ Збереження в localStorage

### Ручне тестування

1. Відкрийте `/notifications` в браузері
2. Клікніть на дзвіночок в header
3. Перейдіть в `/profile/notifications` для налаштувань
4. Увімкніть push-сповіщення (дозвольте в браузері)
5. Викличте `notificationService.addNotification()` з консолі

## Налаштування Production

### 1. База даних

Створіть таблиці для збереження:

**PushSubscription**
```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);
```

**Notification**
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**NotificationPreferences**
```sql
CREATE TABLE notification_preferences (
  user_id INTEGER PRIMARY KEY,
  order_status_email BOOLEAN DEFAULT TRUE,
  order_status_push BOOLEAN DEFAULT TRUE,
  order_status_sms BOOLEAN DEFAULT FALSE,
  price_drop_email BOOLEAN DEFAULT FALSE,
  price_drop_push BOOLEAN DEFAULT TRUE,
  price_drop_sms BOOLEAN DEFAULT FALSE,
  back_in_stock_email BOOLEAN DEFAULT FALSE,
  back_in_stock_push BOOLEAN DEFAULT TRUE,
  back_in_stock_sms BOOLEAN DEFAULT FALSE,
  promotion_email BOOLEAN DEFAULT TRUE,
  promotion_push BOOLEAN DEFAULT TRUE,
  promotion_sms BOOLEAN DEFAULT FALSE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Налаштуйте Web Push

```typescript
// lib/web-push-config.ts
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export { webpush };
```

### 3. Реалізуйте API endpoints

Замініть mock-реалізації в API routes на реальні запити до БД:

```typescript
// app/api/notifications/subscribe/route.ts
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subscription } = await request.json();

  await db.pushSubscription.create({
    data: {
      userId: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return NextResponse.json({ success: true });
}
```

### 4. Фонові задачі

Налаштуйте cron jobs для:
- Відправки запланованих сповіщень
- Очищення старих сповіщень
- Синхронізації з зовнішніми сервісами

```typescript
// app/api/cron/send-notifications/route.ts
export async function GET() {
  const pendingNotifications = await db.notification.findMany({
    where: {
      sent: false,
      scheduledFor: { lte: new Date() }
    }
  });

  for (const notification of pendingNotifications) {
    await sendPushNotification(notification);
  }

  return NextResponse.json({ processed: pendingNotifications.length });
}
```

## Приклади використання

### Приклад 1: Сповіщення про зміну статусу замовлення

```typescript
// При оновленні статусу замовлення
export async function updateOrderStatus(orderId: string, status: string) {
  // Оновити в БД
  await db.order.update({
    where: { id: orderId },
    data: { status }
  });

  // Отримати користувача
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: true }
  });

  // Створити сповіщення
  await db.notification.create({
    data: {
      userId: order.userId,
      type: 'order_status',
      title: `Замовлення #${orderId}`,
      message: getStatusMessage(status),
      data: { orderId }
    }
  });

  // Відправити push
  await sendPushToUser(order.userId, {
    title: `Замовлення #${orderId}`,
    body: getStatusMessage(status),
    data: { type: 'order_status', orderId }
  });
}
```

### Приклад 2: Моніторинг цін

```typescript
// Scheduled job кожні 30 хвилин
export async function checkPriceDrops() {
  const watchedProducts = await db.priceWatch.findMany({
    include: { product: true, user: true }
  });

  for (const watch of watchedProducts) {
    if (watch.product.price < watch.targetPrice) {
      await notifyPriceDrop(watch.userId, watch.product);
    }
  }
}

async function notifyPriceDrop(userId: string, product: Product) {
  await db.notification.create({
    data: {
      userId,
      type: 'price_drop',
      title: 'Ціна знизилась!',
      message: `${product.name} тепер ${product.price} ₴`,
      data: { productId: product.id }
    }
  });

  await sendPushToUser(userId, {
    title: 'Ціна знизилась!',
    body: `${product.name} тепер ${product.price} ₴`,
    data: { type: 'price_drop', productId: product.id }
  });
}
```

## Безпека

### Permissions

- Push notifications вимагають явного дозволу користувача
- Сервіс автоматично запитує дозвіл при підписці
- Користувач може відписатися в будь-який момент

### VAPID

- Використовуйте безпечні VAPID ключі
- Ніколи не публікуйте приватний ключ
- Зберігайте ключі в змінних оточення

### Rate Limiting

Рекомендовано обмежити кількість сповіщень:
- Максимум 10 сповіщень на користувача на день
- Поважайте режим "Не турбувати"
- Дозволяйте користувачам налаштовувати частоту

## Troubleshooting

### Push сповіщення не працюють

1. Перевірте, чи HTTPS (локально - localhost допускається)
2. Перевірте, чи Service Worker зареєстровано: `navigator.serviceWorker.controller`
3. Перевірте дозвіл: `Notification.permission`
4. Перевірте VAPID ключі в `.env.local`
5. Перевірте консоль браузера на помилки

### Сповіщення не зберігаються

1. Перевірте localStorage в DevTools
2. Перевірте, чи API endpoints повертають 200
3. Перевірте Network tab на помилки fetch

### Service Worker не оновлюється

1. Закрийте всі вкладки з сайтом
2. Очистіть cache браузера
3. Видаліть Service Worker в DevTools > Application
4. Оновіть сторінку

## Ліцензія

MIT

## Підтримка

Для питань та проблем створюйте issue в GitHub repository.
