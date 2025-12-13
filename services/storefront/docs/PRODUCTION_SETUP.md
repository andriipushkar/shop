# Налаштування Production Environment

Повний гайд з розгортання TechShop Storefront в production середовищі.

## 📋 Зміст

1. [Передумови](#передумови)
2. [Змінні оточення](#змінні-оточення)
3. [Налаштування бази даних](#налаштування-бази-даних)
4. [Налаштування Redis](#налаштування-redis)
5. [Налаштування Cloud Storage](#налаштування-cloud-storage)
6. [Налаштування WebSocket](#налаштування-websocket)
7. [Налаштування Web Push](#налаштування-web-push)
8. [Налаштування Sentry](#налаштування-sentry)
9. [Інтеграції українських сервісів](#інтеграції-українських-сервісів)
10. [Розгортання](#розгортання)
11. [Моніторинг та логування](#моніторинг-та-логування)
12. [Безпека](#безпека)
13. [Оптимізація продуктивності](#оптимізація-продуктивності)

---

## Передумови

### Мінімальні вимоги до сервера

- **Node.js**: 18.x або новіше
- **PostgreSQL**: 14.x або новіше
- **Redis**: 6.x або новіше
- **RAM**: мінімум 2GB (рекомендовано 4GB+)
- **CPU**: мінімум 2 cores
- **Диск**: мінімум 20GB вільного місця

### Необхідні облікові записи

- [ ] AWS account (для S3) або Cloudinary
- [ ] Sentry account (для error tracking)
- [ ] LiqPay account (для прийому платежів)
- [ ] Monobank acquiring (опціонально)
- [ ] Nova Poshta API key
- [ ] Rozetka/Prom.ua API (для маркетплейсів)

---

## Змінні оточення

### 1. Створіть `.env` файл

```bash
cp .env.example .env
```

### 2. Базова конфігурація

```env
# Node Environment
NODE_ENV=production

# Site URLs
NEXT_PUBLIC_SITE_URL=https://techshop.ua
NEXT_PUBLIC_BASE_URL=https://techshop.ua
NEXT_PUBLIC_SITE_NAME=TechShop

# Security
NEXTAUTH_URL=https://techshop.ua
NEXTAUTH_SECRET=<GENERATE_SECURE_SECRET>

# Генеруйте secret:
# openssl rand -base64 32
```

### 3. База даних та Cache

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/techshop?schema=public&connection_limit=20&pool_timeout=20

# Redis
REDIS_URL=redis://:password@host:6379
```

**💡 Порада:** Для production використовуйте connection pooling (PgBouncer або Prisma Accelerate).

### 4. Перевірка конфігурації

Перевірте чи всі критичні змінні встановлені:

```bash
# Створіть скрипт check-env.sh
#!/bin/bash

required_vars=(
  "DATABASE_URL"
  "REDIS_URL"
  "NEXTAUTH_SECRET"
  "LIQPAY_PUBLIC_KEY"
  "LIQPAY_PRIVATE_KEY"
  "NOVA_POSHTA_API_KEY"
)

missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo "❌ Відсутні обов'язкові змінні:"
  printf '%s\n' "${missing_vars[@]}"
  exit 1
else
  echo "✅ Всі обов'язкові змінні присутні"
fi
```

---

## Налаштування бази даних

### 1. Створення бази даних

```sql
-- Підключіться до PostgreSQL
psql -U postgres

-- Створіть базу даних
CREATE DATABASE techshop;

-- Створіть користувача
CREATE USER techshop_user WITH ENCRYPTED PASSWORD 'your_secure_password';

-- Надайте права
GRANT ALL PRIVILEGES ON DATABASE techshop TO techshop_user;

-- Увімкніть необхідні розширення
\c techshop
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Для full-text search
```

### 2. Міграції Prisma

```bash
# Застосувати міграції
npx prisma migrate deploy

# Генерація Prisma Client
npx prisma generate

# (Опціонально) Seed початкові дані
npx prisma db seed
```

### 3. Backup стратегія

```bash
# Додайте в crontab:
# Щоденний backup о 3:00
0 3 * * * pg_dump -U techshop_user techshop | gzip > /backups/techshop_$(date +\%Y\%m\%d).sql.gz

# Видалення старих backups (>30 днів)
0 4 * * * find /backups -name "techshop_*.sql.gz" -mtime +30 -delete
```

---

## Налаштування Redis

### 1. Конфігурація Redis

```bash
# Відредагуйте /etc/redis/redis.conf

# Встановіть пароль
requirepass your_secure_password

# Налаштуйте persistence
save 900 1
save 300 10
save 60 10000

# Обмежте memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Увімкніть AOF для надійності
appendonly yes
appendfsync everysec
```

### 2. Моніторинг Redis

```bash
# Перевірка стану
redis-cli --pass your_password ping

# Статистика
redis-cli --pass your_password info stats

# Моніторинг в реальному часі
redis-cli --pass your_password monitor
```

---

## Налаштування Cloud Storage

### Варіант A: AWS S3

#### 1. Створення S3 Bucket

```bash
# AWS CLI
aws s3 mb s3://techshop-images --region eu-central-1

# Налаштування CORS
aws s3api put-bucket-cors --bucket techshop-images --cors-configuration file://cors.json
```

**cors.json:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://techshop.ua"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

#### 2. IAM User для додатку

```bash
# Створіть IAM policy
aws iam create-policy --policy-name TechShopS3Access --policy-document file://s3-policy.json

# Створіть IAM user
aws iam create-user --user-name techshop-app

# Прикріпіть policy
aws iam attach-user-policy --user-name techshop-app --policy-arn arn:aws:iam::ACCOUNT_ID:policy/TechShopS3Access

# Створіть access keys
aws iam create-access-key --user-name techshop-app
```

**s3-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::techshop-images",
        "arn:aws:s3:::techshop-images/*"
      ]
    }
  ]
}
```

#### 3. Змінні для S3

```env
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_S3_BUCKET=techshop-images
AWS_REGION=eu-central-1
STORAGE_PROVIDER=s3
```

### Варіант B: Cloudinary

#### 1. Реєстрація

1. Зареєструйтесь на https://cloudinary.com
2. Знайдіть ваші credentials в Dashboard

#### 2. Змінні для Cloudinary

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz12
CLOUDINARY_UPLOAD_PRESET=techshop_preset
STORAGE_PROVIDER=cloudinary
```

#### 3. Створення Upload Preset

В Cloudinary Dashboard:
1. Settings → Upload
2. Add upload preset
3. Name: `techshop_preset`
4. Signing Mode: `Signed`
5. Folder: `techshop/products`

### 3. Використання в коді

```typescript
import { storage } from '@/lib/storage';

// Завантаження зображення
const result = await storage.upload(file, {
  folder: 'products',
  fileName: `product-${productId}`,
});

// Отримання оптимізованого URL
const url = storage.getOptimizedUrl(result.id, 800, 600);

// Генерація responsive URLs
const srcSet = storage.generateSrcSet(result.id);
```

---

## Налаштування WebSocket

### 1. Окремий WebSocket сервер

Створіть файл `server.js`:

```javascript
// server.js
const { getWSServer } = require('./lib/websocket/ws-server');

const wsServer = getWSServer({
  port: 3001,
  authRequired: true,
  maxConnections: 1000,
});

wsServer.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  wsServer.stop();
  process.exit(0);
});
```

### 2. Systemd service

Створіть `/etc/systemd/system/techshop-ws.service`:

```ini
[Unit]
Description=TechShop WebSocket Server
After=network.target

[Service]
Type=simple
User=techshop
WorkingDirectory=/var/www/techshop
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/techshop/.env

[Install]
WantedBy=multi-user.target
```

### 3. Nginx reverse proxy для WebSocket

```nginx
# /etc/nginx/sites-available/techshop

# WebSocket upstream
upstream websocket {
    server localhost:3001;
}

server {
    listen 443 ssl http2;
    server_name techshop.ua;

    # WebSocket location
    location /ws {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout налаштування
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

### 4. Змінні для WebSocket

```env
# WebSocket Configuration
WEBSOCKET_URL=wss://techshop.ua/ws
NEXT_PUBLIC_WEBSOCKET_URL=wss://techshop.ua/ws
WS_SERVER_PORT=3001
```

---

## Налаштування Web Push

### 1. Генерація VAPID ключів

```bash
npm run generate-vapid-keys
```

### 2. Додайте ключі в `.env`

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEl6...
VAPID_PRIVATE_KEY=mVN3...
VAPID_SUBJECT=mailto:admin@techshop.ua
```

### 3. Використання в коді

```typescript
// app/api/push/subscribe/route.ts
import webPush from 'web-push';

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Відправка push-повідомлення
export async function POST(req: Request) {
  const subscription = await req.json();

  const payload = JSON.stringify({
    title: 'Нове повідомлення',
    body: 'У вас є нове повідомлення в чаті',
  });

  await webPush.sendNotification(subscription, payload);

  return Response.json({ success: true });
}
```

---

## Налаштування Sentry

### 1. Створення Sentry проекту

1. Зареєструйтесь на https://sentry.io
2. Створіть новий проект (Next.js)
3. Скопіюйте DSN

### 2. Змінні для Sentry

```env
NEXT_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_AUTH_TOKEN=your_auth_token
SENTRY_ORG=your-org
SENTRY_PROJECT=techshop-storefront
SENTRY_ENVIRONMENT=production
```

### 3. Конфігурація Sentry

Sentry вже налаштований через `@sentry/nextjs`. Додайте `sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  tracesSampleRate: 1.0,

  // Не логуємо особисті дані
  beforeSend(event, hint) {
    // Видаляємо sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
```

---

## Інтеграції українських сервісів

### 1. LiqPay (Платежі)

```env
LIQPAY_PUBLIC_KEY=sandbox_i00000000
LIQPAY_PRIVATE_KEY=sandbox_aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

**Отримання ключів:**
1. https://www.liqpay.ua/cabinet
2. API → Ключі

### 2. Monobank Acquiring

```env
MONOBANK_TOKEN=uXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Отримання токену:**
1. https://api.monobank.ua
2. Acquiring API

### 3. Nova Poshta API

```env
NOVA_POSHTA_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Отримання ключа:**
1. https://my.novaposhta.ua/settings/index#apikeys
2. Генерувати новий ключ

### 4. Rozetka Seller API

```env
ROZETKA_API_KEY=your_api_key
ROZETKA_SELLER_ID=123456
```

### 5. Prom.ua API

```env
PROM_API_KEY=your_api_key
PROM_SHOP_ID=123456
```

---

## Розгортання

### Варіант 1: Vercel (Рекомендовано)

```bash
# Встановіть Vercel CLI
npm i -g vercel

# Деплой
vercel --prod

# Налаштуйте env змінні в Vercel Dashboard
```

**Важливо для WebSocket:**
- WebSocket сервер має бути розгорнутий окремо (наприклад, на VPS)
- Налаштуйте `NEXT_PUBLIC_WEBSOCKET_URL` на адресу WS сервера

### Варіант 2: Docker

**Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  websocket:
    build: .
    command: node server.js
    ports:
      - "3001:3001"
    env_file:
      - .env
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: techshop
      POSTGRES_USER: techshop_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Варіант 3: VPS з PM2

```bash
# Встановіть PM2
npm install -g pm2

# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'techshop-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'techshop-ws',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

# Запуск
pm2 start ecosystem.config.js

# Автозапуск після перезавантаження
pm2 startup
pm2 save
```

---

## Моніторинг та логування

### 1. PM2 Monitoring

```bash
# Моніторинг процесів
pm2 monit

# Логи
pm2 logs

# Статус
pm2 status
```

### 2. Налаштування логування

```typescript
// lib/logger.ts вже налаштований
import logger from '@/lib/logger';

logger.info('Application started');
logger.error('Error occurred', { error });
logger.warn('Warning message');
```

### 3. Health check endpoint

```typescript
// app/api/health/route.ts
import { db } from '@/lib/db';
import { redis } from '@/lib/cache/redis';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    await db.$queryRaw`SELECT 1`;
    health.services.database = 'ok';
  } catch (error) {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  try {
    await redis.ping();
    health.services.redis = 'ok';
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'degraded';
  }

  const status = health.status === 'ok' ? 200 : 503;
  return Response.json(health, { status });
}
```

---

## Безпека

### 1. HTTPS (обов'язково!)

```bash
# Використовуйте Let's Encrypt з certbot
sudo certbot --nginx -d techshop.ua -d www.techshop.ua
```

### 2. Security Headers

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};
```

### 3. Rate Limiting

Rate limiting вже налаштований через `/lib/rate-limit`. Переконайтесь що Redis працює.

### 4. Environment Variables

```bash
# Ніколи не комітьте .env файл!
# Додайте в .gitignore:
.env
.env.local
.env.production
```

---

## Оптимізація продуктивності

### 1. Caching Strategy

```typescript
// Використовуйте Redis для кешування
import { cache } from '@/lib/cache';

// Кешуємо на 1 годину
const products = await cache.get('products:featured', async () => {
  return await db.product.findMany({ where: { featured: true } });
}, 3600);
```

### 2. Database Indexing

```sql
-- Створіть індекси для популярних запитів
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Full-text search
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('ukrainian', name || ' ' || description));
```

### 3. Image Optimization

Використовуйте Next.js Image компонент:

```typescript
import Image from 'next/image';

<Image
  src={product.image}
  alt={product.name}
  width={800}
  height={600}
  quality={85}
  loading="lazy"
/>
```

### 4. CDN

```env
CDN_URL=https://cdn.techshop.ua
CDN_ENABLED=true
```

---

## Checklist перед запуском

- [ ] Всі env змінні встановлені
- [ ] Database міграції застосовані
- [ ] Redis працює та доступний
- [ ] S3/Cloudinary налаштовані
- [ ] WebSocket сервер запущений
- [ ] VAPID ключі згенеровані
- [ ] Sentry налаштований
- [ ] HTTPS сертифікат встановлений
- [ ] Backup стратегія налаштована
- [ ] Моніторинг працює
- [ ] Health check endpoint доступний
- [ ] Rate limiting активний
- [ ] Security headers встановлені
- [ ] Логування налаштоване

---

## Підтримка

При виникненні проблем:

1. Перевірте логи: `pm2 logs` або в Vercel Dashboard
2. Перевірте Sentry для errors
3. Перевірте health endpoint: `https://techshop.ua/api/health`
4. Перевірте Redis: `redis-cli ping`
5. Перевірте Database: `npx prisma db execute --stdin < test.sql`

---

## Корисні команди

```bash
# Backup бази даних
pg_dump -U techshop_user techshop > backup.sql

# Restore бази даних
psql -U techshop_user techshop < backup.sql

# Очистка Redis cache
redis-cli FLUSHALL

# Restart PM2 процесів
pm2 restart all

# Перегляд логів
pm2 logs --lines 100

# Оновлення залежностей
npm update

# Prisma studio (БД UI)
npx prisma studio
```

---

**Успішного запуску! 🚀**
