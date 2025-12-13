# Production Integration - TechShop Storefront

Документація по інтеграції production сервісів для TechShop.

## 📚 Огляд

Цей проект включає повну інтеграцію production-ready сервісів:

- **Cloud Storage** (AWS S3 / Cloudinary)
- **WebSocket Server** для real-time чату
- **Web Push Notifications** з VAPID
- **Error Tracking** з Sentry
- **Українські платіжні системи та доставка**

## 🗂 Структура файлів

```
services/storefront/
├── lib/
│   ├── storage/
│   │   ├── s3-client.ts          # AWS S3 клієнт
│   │   ├── cloudinary-client.ts  # Cloudinary клієнт
│   │   └── index.ts              # Unified storage interface
│   └── websocket/
│       ├── ws-server.ts          # WebSocket server (Node.js)
│       └── ws-client.ts          # WebSocket client (Browser)
├── scripts/
│   └── generate-vapid-keys.ts    # Генератор VAPID ключів
├── docs/
│   ├── PRODUCTION_SETUP.md       # Повний гайд з розгортання
│   └── PRODUCTION_INTEGRATION.md # Цей файл
└── .env.example                  # Оновлений з production змінними
```

## 🚀 Швидкий старт

### 1. Встановіть залежності

```bash
npm install
```

Додаткові пакети для production:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner ws web-push
```

### 2. Налаштуйте змінні оточення

```bash
cp .env.example .env
```

Відредагуйте `.env` та додайте ваші credentials.

### 3. Згенеруйте VAPID ключі

```bash
npm run generate-vapid-keys
```

Додайте згенеровані ключі в `.env`.

### 4. Запустіть development сервер

```bash
npm run dev
```

## 📦 Cloud Storage

### Вибір провайдера

Проект підтримує 3 storage провайдери:

1. **AWS S3** - рекомендовано для великих проектів
2. **Cloudinary** - найпростіший у налаштуванні, має built-in трансформації
3. **Local** - тільки для development

### AWS S3

#### Переваги
- Масштабованість
- Низька ціна
- Повний контроль
- Підтримка presigned URLs

#### Налаштування

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=techshop-images
AWS_REGION=eu-central-1
STORAGE_PROVIDER=s3
```

#### Приклад використання

```typescript
import { s3Client } from '@/lib/storage/s3-client';

// Завантаження файлу
const result = await s3Client.upload(file, {
  key: 'products/product-123.jpg',
  acl: 'public-read',
  contentType: 'image/jpeg',
  tags: { product: '123' },
});

console.log(result.url); // https://bucket.s3.region.amazonaws.com/...

// Генерація presigned URL (для приватних файлів)
const url = await s3Client.getPresignedUrl('private/invoice.pdf', {
  expiresIn: 3600, // 1 година
});

// Видалення файлу
await s3Client.delete('products/old-image.jpg');
```

### Cloudinary

#### Переваги
- Автоматична оптимізація
- On-the-fly трансформації
- CDN включений
- Responsive images

#### Налаштування

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz12
STORAGE_PROVIDER=cloudinary
```

#### Приклад використання

```typescript
import { cloudinaryClient } from '@/lib/storage/cloudinary-client';

// Завантаження з трансформацією
const result = await cloudinaryClient.upload(file, {
  folder: 'products',
  transformation: {
    width: 1200,
    height: 800,
    crop: 'fill',
    quality: 'auto',
  },
});

// Отримання оптимізованого URL
const url = cloudinaryClient.getOptimizedUrl(result.publicId, 800, 600);

// Генерація responsive URLs
const srcSet = cloudinaryClient.generateSrcSet(result.publicId);
// Використання в HTML: <img srcset={srcSet} />

// WebP/AVIF формати
const webpUrl = cloudinaryClient.getWebPUrl(result.publicId);
const avifUrl = cloudinaryClient.getAvifUrl(result.publicId);
```

### Unified Storage API

Використовуйте unified interface для роботи з будь-яким провайдером:

```typescript
import { storage } from '@/lib/storage';

// Автоматично використає налаштованого провайдера (S3/Cloudinary/Local)
const result = await storage.upload(file, {
  folder: 'products',
  fileName: 'product-image.jpg',
});

// Працює з будь-яким провайдером
const url = storage.getOptimizedUrl(result.id, 800, 600);
const thumbnail = storage.getThumbnailUrl(result.id, 200, 200);

// Видалення
await storage.delete(result.id);
```

## 🔌 WebSocket для Real-Time чату

### Архітектура

- **Server**: Node.js WebSocket server (`ws-server.ts`)
- **Client**: Browser WebSocket client (`ws-client.ts`)
- **Features**: Rooms, typing indicators, read receipts, auto-reconnect

### Server (Backend)

```typescript
import { getWSServer } from '@/lib/websocket/ws-server';

// Створюємо та запускаємо сервер
const wsServer = getWSServer({
  port: 3001,
  authRequired: true,
  maxConnections: 1000,
  pingInterval: 30000,
});

wsServer.start();

// Broadcast повідомлення всім
wsServer.broadcastToAll({
  type: 'message',
  payload: { text: 'Server announcement' },
  timestamp: Date.now(),
});

// Статистика
const stats = wsServer.getStats();
console.log(`Active connections: ${stats.connections}`);
```

### Client (Frontend)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { ChatWebSocketClient } from '@/lib/websocket/ws-client';

export default function ChatComponent() {
  const [client] = useState(() => new ChatWebSocketClient({
    autoConnect: true,
    debug: true,
  }));

  useEffect(() => {
    // Встановлюємо токен (JWT)
    client.setToken(session.token);

    // Підключаємось
    client.connect();

    // Приєднуємось до кімнати
    client.joinRoom('support-123');

    // Слухаємо повідомлення
    const unsubscribe = client.on('message', (data) => {
      if (data.type === 'chat') {
        console.log('New message:', data.message);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
      client.disconnect();
    };
  }, [client]);

  const sendMessage = (text: string) => {
    client.sendMessage({
      roomId: 'support-123',
      message: text,
    });
  };

  const sendTyping = (isTyping: boolean) => {
    client.sendTyping('support-123', isTyping);
  };

  return (
    <div>
      {/* Chat UI */}
    </div>
  );
}
```

### WebSocket Events

#### Client → Server

```typescript
// Приєднання до кімнати
client.joinRoom('room-id');

// Відправка повідомлення
client.sendMessage({
  roomId: 'room-id',
  message: 'Hello!',
  attachments: ['url1', 'url2'],
});

// Індикатор набору
client.sendTyping('room-id', true);

// Підтвердження прочитання
client.sendReadReceipt('room-id', 'message-id');
```

#### Server → Client

```typescript
// Нове повідомлення
client.on('message', (data) => {
  console.log(data.message);
});

// Користувач приєднався
client.on('user-joined', (data) => {
  console.log(`${data.userName} joined`);
});

// Користувач пішов
client.on('user-left', (data) => {
  console.log(`${data.userName} left`);
});

// Хтось набирає
client.on('typing', (data) => {
  console.log(`${data.userName} is typing...`);
});

// Статус підключення
client.on('connected', () => console.log('Connected'));
client.on('disconnected', () => console.log('Disconnected'));
client.on('reconnecting', (data) => console.log(`Reconnecting... (${data.attempt})`));
```

### Розгортання WebSocket

#### Окремий сервер (рекомендовано)

Створіть `server.js`:

```javascript
const { getWSServer } = require('./lib/websocket/ws-server');

const server = getWSServer({
  port: process.env.WS_SERVER_PORT || 3001,
  authRequired: process.env.NODE_ENV === 'production',
});

server.start();

process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});
```

Запустіть:
```bash
node server.js
```

Або з PM2:
```bash
pm2 start server.js --name techshop-ws
```

#### Nginx конфігурація

```nginx
location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 7d;
}
```

## 🔔 Web Push Notifications

### Генерація VAPID ключів

```bash
npm run generate-vapid-keys
```

Додайте в `.env`:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEl6...
VAPID_PRIVATE_KEY=mVN3...
VAPID_SUBJECT=mailto:admin@techshop.ua
```

### Підписка на notifications (Client)

```typescript
'use client';

export async function subscribeToNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('Push notifications not supported');
    return;
  }

  // Запитуємо дозвіл
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return;
  }

  // Реєструємо service worker
  const registration = await navigator.serviceWorker.register('/sw.js');

  // Підписуємось на push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  // Зберігаємо на сервері
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
}
```

### Відправка notifications (Server)

```typescript
// app/api/push/send/route.ts
import webPush from 'web-push';

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  const { subscription, title, body } = await req.json();

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: 'https://techshop.ua/notifications',
    },
  });

  try {
    await webPush.sendNotification(subscription, payload);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Push notification error:', error);
    return Response.json({ error: 'Failed to send' }, { status: 500 });
  }
}
```

## 🎯 Інтеграція з Next.js

### API Routes

```typescript
// app/api/upload/route.ts
import { storage } from '@/lib/storage';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return Response.json({ error: 'No file' }, { status: 400 });
  }

  // Завантаження через unified storage
  const result = await storage.upload(file, {
    folder: 'products',
  });

  return Response.json({
    success: true,
    url: result.url,
    id: result.id,
  });
}
```

### React Component

```typescript
'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function ImageUploader() {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setImageUrl(data.url);
    setUploading(false);
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={uploading} />
      {uploading && <p>Завантаження...</p>}
      {imageUrl && (
        <Image src={imageUrl} alt="Uploaded" width={400} height={300} />
      )}
    </div>
  );
}
```

## 📊 Моніторинг та Debugging

### Логування

Всі модулі включають детальне логування:

```typescript
// Увімкніть debug mode
const client = new ChatWebSocketClient({
  debug: true, // Логи в консолі
});

// Storage також логує операції
const result = await storage.upload(file);
// [Storage] Using provider: cloudinary
// [Storage] Uploading to cloudinary...
```

### Health Checks

```typescript
// app/api/health/route.ts
import { storage } from '@/lib/storage';

export async function GET() {
  const health = {
    storage: {
      provider: storage.getProvider(),
      configured: storage.isCloudStorageEnabled(),
    },
    websocket: {
      // Статистика WS сервера
    },
  };

  return Response.json(health);
}
```

## 🔒 Безпека

### Storage Security

```typescript
// Валідація файлів
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file type');
}

if (file.size > MAX_SIZE) {
  throw new Error('File too large');
}

// Санітизація назви файлу
const safeName = file.name
  .replace(/[^a-zA-Z0-9.-]/g, '_')
  .toLowerCase();
```

### WebSocket Security

```typescript
// Тільки автентифіковані користувачі
const wsServer = getWSServer({
  authRequired: true, // Вимагає JWT токен
});

// Валідація повідомлень
if (message.length > 10000) {
  throw new Error('Message too long');
}
```

## 📈 Production Checklist

- [ ] **Storage**
  - [ ] S3 або Cloudinary налаштовані
  - [ ] CORS налаштований правильно
  - [ ] Bucket має правильні permissions
  - [ ] CDN увімкнений (якщо використовується)

- [ ] **WebSocket**
  - [ ] WS сервер запущений окремо
  - [ ] Nginx proxy налаштований
  - [ ] SSL/TLS сертифікат встановлений (wss://)
  - [ ] Автентифікація увімкнена

- [ ] **Web Push**
  - [ ] VAPID ключі згенеровані
  - [ ] Service Worker зареєстрований
  - [ ] Permissions налаштовані

- [ ] **Environment**
  - [ ] Всі змінні в `.env` встановлені
  - [ ] Секрети не комітяться в git
  - [ ] Production режим увімкнений

## 🆘 Troubleshooting

### Storage не працює

```bash
# Перевірте провайдера
curl http://localhost:3000/api/health

# Тестовий upload
node -e "const {storage} = require('./lib/storage'); storage.getStorageInfo()"
```

### WebSocket не підключається

```bash
# Перевірте чи WS сервер працює
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:3001/ws

# Перевірте Nginx logs
tail -f /var/log/nginx/error.log
```

### VAPID ключі не працюють

```bash
# Перегенеруйте ключі
npm run generate-vapid-keys

# Перевірте чи вони в .env
grep VAPID .env
```

## 📚 Додаткові ресурси

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)

## 📞 Підтримка

Для питань та проблем відкрийте issue в GitHub репозиторії.

---

**Версія:** 1.0.0
**Останнє оновлення:** 2025-12-13
