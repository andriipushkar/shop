# TechShop - Повний список функціоналу

> Документація всіх можливостей інтернет-магазину TechShop

**Версія:** 2.0
**Технології:** Next.js 16, React 19, TypeScript, Tailwind CSS
**Тести:** 1394 passed, 97%+ coverage

---

## Зміст

1. [Клієнтська частина](#клієнтська-частина)
2. [Адмін-панель](#адмін-панель)
3. [WMS (Система управління складом)](#wms-система-управління-складом)
4. [Платіжні системи](#платіжні-системи)
5. [Маркетплейси](#маркетплейси)
6. [API](#api)
7. [Бібліотеки та сервіси](#бібліотеки-та-сервіси)
8. [PWA та оптимізація](#pwa-та-оптимізація)
9. [Тестування](#тестування)
10. [DevOps](#devops)

---

## Клієнтська частина

### Головна сторінка та каталог

| Функція | Файл | Опис |
|---------|------|------|
| Головна сторінка | `app/page.tsx` | Hero секція, промо, популярні товари |
| Категорії | `app/category/[slug]/page.tsx` | Перегляд товарів за категоріями |
| Товар | `app/product/[id]/page.tsx` | Детальна сторінка товару |
| Пошук | `app/search/page.tsx` | Повнотекстовий пошук |
| Акції | `app/sale/page.tsx` | Товари зі знижками |

### Кошик та оформлення замовлення

| Функція | Файл | Опис |
|---------|------|------|
| Кошик | `app/cart/page.tsx` | Управління кошиком |
| Checkout | `app/checkout/page.tsx` | Оформлення замовлення |
| Статус замовлення | `app/order-status/page.tsx` | Відстеження замовлення |
| Трекінг | `app/tracking/page.tsx` | Відстеження доставки |

### Особистий кабінет

| Функція | Файл | Опис |
|---------|------|------|
| Профіль | `app/profile/page.tsx` | Дані користувача |
| Замовлення | `app/profile/orders/page.tsx` | Історія замовлень |
| Адреси | `app/profile/addresses/page.tsx` | Збережені адреси |
| Лояльність | `app/profile/loyalty/page.tsx` | Бали та рівень |
| Сповіщення | `app/profile/notifications/page.tsx` | Налаштування сповіщень |

### Додаткові функції

| Функція | Файл | Опис |
|---------|------|------|
| Список бажань | `app/wishlist/page.tsx` | Збереження товарів |
| Порівняння | `app/comparison/page.tsx` | Порівняння товарів |
| Подарункові сертифікати | `app/gift-cards/page.tsx` | Купівля та використання |
| Авторизація | `app/auth/login/page.tsx` | Вхід (email, Google OAuth) |
| Реєстрація | `app/auth/register/page.tsx` | Реєстрація користувача |

### Інформаційні сторінки

- `/about` - Про компанію
- `/contact` - Контакти
- `/delivery` - Доставка
- `/returns` - Повернення
- `/faq` - Питання та відповіді

---

## Адмін-панель

### Дашборд (`/admin`)

- Статистика продажів (за день/тиждень/місяць)
- Кількість замовлень та клієнтів
- Графік доходів
- Топ товарів
- Останні замовлення
- Сповіщення про низький запас

### Управління товарами

| Сторінка | URL | Функції |
|----------|-----|---------|
| Список товарів | `/admin/products` | CRUD, фільтри, пошук |
| Новий товар | `/admin/products/new` | Створення товару |
| Редагування | `/admin/products/[id]` | Редагування товару |
| Категорії | `/admin/categories` | Ієрархія категорій |
| Атрибути (EAV) | `/admin/attributes` | Динамічні характеристики |
| Імпорт | `/admin/import` | Імпорт з CSV/Excel |

### Управління замовленнями

| Сторінка | URL | Функції |
|----------|-----|---------|
| Список замовлень | `/admin/orders` | Всі замовлення, фільтри |
| Деталі замовлення | `/admin/orders/[id]` | Повна інформація |
| Статистика | API `/api/admin/orders/stats` | Метрики замовлень |

### Клієнти

| Сторінка | URL | Функції |
|----------|-----|---------|
| Список клієнтів | `/admin/customers` | База клієнтів |
| Профіль клієнта | API `/api/admin/customers/[id]` | Історія, LTV |

### Маркетинг

| Сторінка | URL | Функції |
|----------|-----|---------|
| Промокоди | `/admin/marketing/promo-codes` | Створення знижок |
| Email кампанії | `/admin/marketing/email-campaigns` | Розсилки |
| Маркетплейси | `/admin/marketplaces` | Rozetka, Prom.ua |

### Звіти та аналітика

| Сторінка | URL | Функції |
|----------|-----|---------|
| Аналітика | `/admin/analytics` | Загальна статистика |
| Продажі | `/admin/reports/sales` | Звіт продажів |
| Клієнти | `/admin/reports/customers` | Аналіз клієнтів |
| Платежі | `/admin/reports/payments` | Звіт оплат |

### Контент та налаштування

| Сторінка | URL | Функції |
|----------|-----|---------|
| CMS | `/admin/cms` | Управління сторінками |
| Контент | `/admin/content` | Банери, блоки |
| Відгуки | `/admin/reviews` | Модерація відгуків |
| Підтримка | `/admin/support` | Тікети |
| Користувачі | `/admin/users` | Ролі та права |
| Налаштування | `/admin/settings` | Конфігурація |
| Bulk операції | `/admin/bulk` | Масові дії |
| Інтеграції | `/admin/integrations` | Зовнішні сервіси |

---

## WMS (Система управління складом)

### Основні функції (`/admin/warehouse`)

| Модуль | URL | Опис |
|--------|-----|------|
| Дашборд | `/admin/warehouse` | Огляд всіх складів |
| Склади | `/admin/warehouse/warehouses` | Управління складами |
| Залишки | `/admin/warehouse/stock` | Поточні залишки |
| Приймання | `/admin/warehouse/receipt/new` | Оприбуткування |
| Відвантаження | `/admin/warehouse/shipment/new` | Відправка |
| Переміщення | `/admin/warehouse/transfer/new` | Між складами |
| Інвентаризація | `/admin/warehouse/inventory/new` | Перевірка |
| Списання | `/admin/warehouse/writeoff/new` | Акти списання |

### Довідники

| Модуль | URL | Опис |
|--------|-----|------|
| Локації | `/admin/warehouse/locations` | Зони, стелажі, полиці |
| Постачальники | `/admin/warehouse/suppliers` | База постачальників |
| Закупівлі | `/admin/warehouse/purchases` | Замовлення постачальникам |
| Серійні номери | `/admin/warehouse/serials` | Облік серійників |
| Резервування | `/admin/warehouse/reservations` | Резерви товарів |
| Історія рухів | `/admin/warehouse/movements` | Журнал операцій |

### POS та сканер

| Модуль | URL | Опис |
|--------|-----|------|
| POS (Каса) | `/admin/warehouse/pos` | Роздрібні продажі |
| Сканер | `/admin/warehouse/scanner` | Мобільний сканер штрих-кодів |

### Аналітика складу

| Модуль | URL | Опис |
|--------|-----|------|
| Аналітика | `/admin/warehouse/analytics` | Загальна аналітика |
| ABC аналіз | `/admin/warehouse/analytics` | Класифікація товарів |
| Прогнозування | `/admin/warehouse/analytics/forecast` | Прогноз попиту |
| Аномалії | `/admin/warehouse/analytics/anomalies` | Виявлення проблем |
| Wave picking | `/admin/warehouse/analytics/wave-picking` | Оптимізація збору |
| Reorder | `/admin/warehouse/analytics/reorder` | Точки перезамовлення |
| Ship from Store | `/admin/warehouse/analytics/ship-from-store` | Відправка з магазинів |
| Зони | `/admin/warehouse/analytics/zones` | Аналіз зон |
| Звіти | `/admin/warehouse/reports` | Складські звіти |
| Налаштування | `/admin/warehouse/settings` | Конфігурація WMS |

---

## Платіжні системи

### LiqPay (`lib/payments/liqpay.ts`)

```typescript
// Можливості:
- Створення платежу (card, liqpay, privat24, masterpass)
- Оплата частинами (moment_part)
- Перевірка статусу платежу
- Повернення коштів (refund)
- Callback обробка
- Генерація підпису
```

**Env змінні:**
```env
LIQPAY_PUBLIC_KEY=your-public-key
LIQPAY_PRIVATE_KEY=your-private-key
```

### Monobank Acquiring (`lib/payments/monobank.ts`)

```typescript
// Можливості:
- Створення інвойсу
- Перевірка статусу
- Webhook верифікація
- Повернення коштів
- Оплата частинами
```

**Env змінні:**
```env
MONOBANK_TOKEN=your-token
```

### Webhook endpoints

- `/api/payments/liqpay/callback` - LiqPay callback
- `/api/payments/monobank/webhook` - Monobank webhook

---

## Маркетплейси

### Rozetka (`lib/marketplaces/rozetka.ts`)

```typescript
// Можливості:
- Синхронізація товарів
- Оновлення залишків та цін
- Отримання замовлень
- Оновлення статусів замовлень
- Webhook обробка
```

### Prom.ua (`lib/marketplaces/prom.ts`)

```typescript
// Можливості:
- Синхронізація товарів
- YML/XML фід генерація
- Замовлення та статуси
- Повідомлення клієнтам
- Знижки
```

### Уніфікований інтерфейс (`lib/marketplaces/index.ts`)

```typescript
import { marketplaces } from '@/lib/marketplaces';

// Синхронізація на всі маркетплейси
await marketplaces.syncProduct(product);
await marketplaces.syncStock(productId, quantity);

// Всі замовлення
const orders = await marketplaces.getAllOrders();
```

### Webhook endpoints

- `/api/webhooks/rozetka` - Rozetka events
- `/api/webhooks/prom` - Prom.ua events
- `/api/marketplaces/sync` - Синхронізація

---

## API

### Публічні endpoints

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/products` | GET | Список товарів |
| `/api/products/[id]` | GET | Деталі товару |
| `/api/products/featured` | GET | Рекомендовані |
| `/api/products/[id]/related` | GET | Схожі товари |
| `/api/categories` | GET | Категорії |
| `/api/search` | GET | Пошук |
| `/api/cart/[userId]` | GET/POST | Кошик |
| `/api/orders` | POST | Створення замовлення |
| `/api/promo/validate` | POST | Перевірка промокоду |
| `/api/promo/use` | POST | Застосування промокоду |

### Адмін endpoints

| Endpoint | Методи | Опис |
|----------|--------|------|
| `/api/admin/products` | CRUD | Управління товарами |
| `/api/admin/categories` | CRUD | Управління категоріями |
| `/api/admin/orders` | GET/PUT | Замовлення |
| `/api/admin/orders/stats` | GET | Статистика |
| `/api/admin/customers` | GET | Клієнти |
| `/api/admin/warehouse` | CRUD | Склад |

### Документація API

- `/api/docs` - Swagger UI

---

## Бібліотеки та сервіси

### Context Providers (стан)

| Context | Файл | Призначення |
|---------|------|-------------|
| Cart | `lib/cart-context.tsx` | Кошик |
| Auth | `lib/auth-context.tsx` | Авторизація |
| Wishlist | `lib/wishlist-context.tsx` | Список бажань |
| Comparison | `lib/comparison-context.tsx` | Порівняння |
| Reviews | `lib/reviews-context.tsx` | Відгуки |
| Loyalty | `lib/loyalty-context.tsx` | Лояльність |
| GiftCards | `lib/gift-cards-context.tsx` | Сертифікати |
| Promo | `lib/promo-context.tsx` | Промокоди |
| RecentlyViewed | `lib/recently-viewed-context.tsx` | Переглянуті |
| Chat | `lib/chat/chat-context.tsx` | Чат підтримки |

### Система лояльності (`lib/loyalty/index.ts`)

| Рівень | Мін. витрати | Cashback | Множник |
|--------|-------------|----------|---------|
| Bronze | 0 грн | 3% | x1 |
| Silver | 5,000 грн | 5% | x1.25 |
| Gold | 20,000 грн | 7% | x1.5 |
| Platinum | 50,000 грн | 10% | x2 |
| Diamond | 100,000 грн | 15% | x3 |

**Можливості:**
- Нарахування балів за покупки
- Використання балів як знижка
- Реферальна програма (500 балів)
- Бонус на день народження (x2 бали)
- Історія транзакцій

### Чат підтримки (`lib/chat/`)

- `chat-service.ts` - Сервіс чату
- `chat-context.tsx` - React context
- Бот з автоматичними відповідями
- Швидкі відповіді для операторів
- Передача оператору

### Доставка

| Сервіс | Файл | Можливості |
|--------|------|------------|
| Нова Пошта | `lib/nova-poshta.ts` | Міста, відділення, вартість, трекінг |
| Email | `lib/email.ts` | Шаблони, підтвердження, newsletter |
| SMS | `lib/sms-service.ts` | Статуси замовлень |

### Аналітика та моніторинг

| Сервіс | Файл | Можливості |
|--------|------|------------|
| Analytics | `lib/analytics/advanced-analytics.ts` | E-commerce tracking, воронки, когорти |
| Warehouse | `lib/warehouse-analytics.ts` | ABC/XYZ аналіз, оборотність |
| Sentry | `lib/monitoring/sentry.ts` | Error tracking |
| Metrics | `lib/monitoring/metrics.ts` | Performance metrics |
| Logger | `lib/monitoring/logger.ts` | Логування |

### Кешування

| Сервіс | Файл | Можливості |
|--------|------|------------|
| Redis | `lib/cache/redis-cache.ts` | Кешування, rate limiting, locks |

### Інші сервіси

| Сервіс | Файл | Можливості |
|--------|------|------------|
| Price Alerts | `lib/price-alerts/price-alerts.ts` | Сповіщення про ціни |
| Product Bundles | `lib/bundles/product-bundles.ts` | Комплекти товарів |
| Wishlist Sharing | `lib/wishlist/wishlist-sharing.ts` | Поширення списків |
| Push Notifications | `lib/notifications/push-notifications.ts` | Web push |
| CMS | `lib/admin/cms.ts` | Управління контентом |
| Bulk Operations | `lib/admin/bulk-operations.ts` | Масові дії |
| Job Queue | `lib/jobs/queue.ts` | Фонові задачі |
| AB Testing | `lib/experiments/ab-testing.ts` | Експерименти |

---

## PWA та оптимізація

### Progressive Web App

| Файл | Опис |
|------|------|
| `public/manifest.json` | PWA маніфест |
| `public/sw.js` | Service Worker |

**Можливості:**
- Офлайн режим
- Push-сповіщення
- Add to Home Screen
- Background Sync

### Оптимізація

| Функція | Файл/Конфіг | Опис |
|---------|-------------|------|
| Bundle Analyzer | `next.config.ts` | `ANALYZE=true npm run build` |
| Lazy Loading | `lib/lazy-components.tsx` | Dynamic imports |
| Image Optimization | `next.config.ts` | AVIF, WebP |
| Modular Imports | `next.config.ts` | Tree shaking для heroicons, lodash, date-fns |

### Безпека

| Функція | Файл | Опис |
|---------|------|------|
| Rate Limiting | `middleware.ts` | 100 req/min |
| Auth Protection | `middleware.ts` | Захист /admin та /profile |
| Security Headers | `middleware.ts` | CSP, X-Frame-Options |

---

## Тестування

### Статистика

- **Тестів:** 1394
- **Test Suites:** 65
- **Покриття:** 97%+

### Категорії тестів

| Категорія | Кількість | Приклади |
|-----------|-----------|----------|
| Components | 50+ | ProductCard, Header, Footer |
| Contexts | 100+ | Cart, Auth, Wishlist, Loyalty |
| Pages | 150+ | Checkout, Orders, Warehouse |
| API | 50+ | Products, Orders, Webhooks |
| Services | 100+ | Payments, Analytics, Cache |

### Запуск тестів

```bash
# Всі тести
npm test

# З покриттям
npm test -- --coverage

# Watch mode
npm test -- --watch

# E2E тести
npm run test:e2e
```

---

## DevOps

### CI/CD (GitHub Actions)

**Файл:** `.github/workflows/ci.yml`

| Job | Опис |
|-----|------|
| test | Go та Node.js тести |
| build | Build всіх сервісів |
| lint | ESLint, golangci-lint |
| docker | Docker images |
| coverage | Звіт покриття |
| security | Gosec сканування |
| integration | Тести з PostgreSQL та Redis |
| storefront | Next.js build |

### Docker

| Файл | Опис |
|------|------|
| `Dockerfile` | Development build |
| `Dockerfile.prod` | Production build |

### Скрипти

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "jest",
  "test:coverage": "jest --coverage",
  "test:e2e": "playwright test",
  "storybook": "storybook dev -p 6006",
  "build-storybook": "storybook build"
}
```

---

## Компоненти

### UI компоненти

| Компонент | Файл | Опис |
|-----------|------|------|
| Header | `components/Header.tsx` | Навігація, пошук, кошик |
| Footer | `components/Footer.tsx` | Підвал сайту |
| ProductCard | `components/ProductCard.tsx` | Картка товару |
| ProductReviews | `components/ProductReviews.tsx` | Відгуки |
| HeroSection | `components/HeroSection.tsx` | Головний банер |
| PromoSection | `components/PromoSection.tsx` | Промо блок |
| SearchFilter | `components/SearchFilter.tsx` | Фільтри каталогу |
| NovaPoshtaSelector | `components/NovaPoshtaSelector.tsx` | Вибір відділення |
| PaymentSelector | `components/PaymentSelector.tsx` | Вибір оплати |
| SocialShare | `components/social-share.tsx` | Поширення |
| ChatWidget | `components/chat/ChatWidget.tsx` | Чат підтримки |
| BarcodeScanner | `components/BarcodeScanner.tsx` | Сканер штрих-кодів |
| RecentlyViewed | `components/RecentlyViewed.tsx` | Переглянуті товари |

### Storybook

**Запуск:** `npm run storybook`

| Story | Файл |
|-------|------|
| ProductCard | `stories/ProductCard.stories.tsx` |
| Button | `stories/Button.stories.tsx` |
| Header | `stories/Header.stories.tsx` |
| Introduction | `stories/Introduction.mdx` |

---

## Статистика проекту

| Метрика | Значення |
|---------|----------|
| Сторінок (клієнт) | 26 |
| Сторінок (адмін) | 57 |
| API routes | 30+ |
| Компонентів | 18+ |
| Бібліотек | 70+ |
| Тестів | 1394 |
| Покриття | 97%+ |
| Мок товарів | 5000+ |
| Категорій | 86 |

---

## Env змінні

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/shop

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret

# Payments
LIQPAY_PUBLIC_KEY=your-key
LIQPAY_PRIVATE_KEY=your-key
MONOBANK_TOKEN=your-token

# Marketplaces
ROZETKA_API_KEY=your-key
ROZETKA_SELLER_ID=your-id
PROM_API_KEY=your-key

# Nova Poshta
NOVA_POSHTA_API_KEY=your-key

# Monitoring
SENTRY_DSN=your-dsn
DATADOG_API_KEY=your-key

# API
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

*Документація оновлена: Грудень 2025*
