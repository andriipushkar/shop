# API Changelog

Історія змін API Shop Platform.

## Versioning Policy

API використовує семантичне версіонування (SemVer):
- **Major (v1 → v2)**: Breaking changes
- **Minor (v1.1 → v1.2)**: New features, backwards compatible
- **Patch (v1.1.1 → v1.1.2)**: Bug fixes

### API Lifecycle

| Stage | Duration | Description |
|-------|----------|-------------|
| Current | - | Активна версія |
| Deprecated | 12 місяців | Працює, але не рекомендується |
| Sunset | 3 місяці | Попередження про вимкнення |
| Retired | - | Вимкнено |

## Current Version: v1.4.0

**Release Date**: 2024-12-01

---

## [v1.4.0] - 2024-12-01

### Added
- **Gift Cards API** - Повна підтримка подарункових карт
  - `POST /api/v1/gift-cards` - Створення подарункової карти
  - `GET /api/v1/gift-cards/:code` - Перевірка балансу
  - `POST /api/v1/gift-cards/:code/redeem` - Погашення
  - `POST /api/v1/gift-cards/:code/reload` - Поповнення

- **B2B Features** - API для B2B клієнтів
  - `POST /api/v1/companies` - Реєстрація компанії
  - `GET /api/v1/companies/:id/pricing` - Отримання B2B цін
  - `POST /api/v1/quotes` - Створення запиту на ціну
  - `POST /api/v1/purchase-orders` - Створення замовлення на закупівлю

- **Wishlist Sharing**
  - `POST /api/v1/wishlists/:id/share` - Створення публічного посилання
  - `GET /api/v1/wishlists/shared/:token` - Доступ до спільного списку

### Changed
- **Cart API** - Додано поле `gift_card_code` для застосування подарункової карти
- **Order Response** - Включає інформацію про застосовані подарункові карти
- **Product Response** - Додано поле `b2b_pricing` для авторизованих B2B користувачів

### Fixed
- Виправлено помилку з кешуванням цін для різних валют
- Виправлено race condition при одночасному оновленні кошика

### Migration Guide

```diff
// Cart creation - new gift card field
{
  "items": [...],
+ "gift_card_code": "GIFT-XXXX-XXXX"
}

// Order response - new payment breakdown
{
  "total": 1000,
+ "gift_card_amount": 200,
+ "amount_due": 800
}
```

---

## [v1.3.0] - 2024-10-15

### Added
- **Visual Search API**
  - `POST /api/v1/search/visual` - Пошук за зображенням
  - Підтримка форматів: JPEG, PNG, WebP
  - Максимальний розмір: 5MB

- **Product Comparison**
  - `POST /api/v1/compare` - Додати до порівняння
  - `GET /api/v1/compare` - Отримати порівняння
  - `DELETE /api/v1/compare/:productId` - Видалити з порівняння

- **Price Alerts**
  - `POST /api/v1/products/:id/alerts` - Створити сповіщення про ціну
  - `GET /api/v1/alerts` - Список активних сповіщень
  - `DELETE /api/v1/alerts/:id` - Видалити сповіщення

### Changed
- **Search API** - Покращено релевантність результатів
- **Product API** - Додано поле `availability_date` для товарів на замовлення

### Deprecated
- `GET /api/v1/products/search` - Використовуйте `GET /api/v1/search` замість цього

### Security
- Додано rate limiting для Visual Search (10 req/min)

---

## [v1.2.0] - 2024-08-20

### Added
- **GraphQL API** (Beta)
  - Endpoint: `/graphql`
  - Підтримка queries, mutations, subscriptions
  - Документація: `/graphql/playground`

- **Webhook Events**
  - `order.created` - Нове замовлення
  - `order.paid` - Оплата отримана
  - `order.shipped` - Замовлення відправлено
  - `order.delivered` - Замовлення доставлено
  - `product.updated` - Товар оновлено
  - `inventory.low` - Низький залишок

- **Bulk Operations**
  - `POST /api/v1/products/bulk` - Масове створення товарів
  - `PATCH /api/v1/products/bulk` - Масове оновлення
  - `POST /api/v1/inventory/bulk` - Масове оновлення залишків

### Changed
- **Authentication** - Збільшено час життя access token до 24 годин
- **Pagination** - Максимальний ліміт збільшено до 100 елементів

### Performance
- Оптимізовано запити до бази даних (зменшено latency на 30%)
- Додано кешування для списків категорій

---

## [v1.1.0] - 2024-06-01

### Added
- **Multi-currency Support**
  - Header: `X-Currency: USD|EUR|UAH`
  - Автоматична конвертація цін

- **Multi-language Support**
  - Header: `Accept-Language: uk|en|ru`
  - Локалізовані назви та описи товарів

- **Review API**
  - `POST /api/v1/products/:id/reviews` - Додати відгук
  - `GET /api/v1/products/:id/reviews` - Список відгуків
  - `POST /api/v1/reviews/:id/helpful` - Відмітити як корисний

- **Inventory API**
  - `GET /api/v1/inventory/:productId` - Залишки по локаціях
  - `GET /api/v1/inventory/:productId/history` - Історія змін

### Changed
- **Product Response** - Ціни тепер включають валюту
- **Error Responses** - Стандартизовано формат помилок

### Fixed
- Виправлено помилку з некоректним підрахунком податків

---

## [v1.0.0] - 2024-03-01

### Initial Release

#### Products
- `GET /api/v1/products` - Список товарів
- `GET /api/v1/products/:id` - Деталі товару
- `GET /api/v1/products/:slug` - Товар за slug
- `POST /api/v1/products` - Створення (admin)
- `PUT /api/v1/products/:id` - Оновлення (admin)
- `DELETE /api/v1/products/:id` - Видалення (admin)

#### Categories
- `GET /api/v1/categories` - Список категорій
- `GET /api/v1/categories/:id` - Деталі категорії
- `GET /api/v1/categories/:id/products` - Товари категорії

#### Cart
- `GET /api/v1/cart` - Поточний кошик
- `POST /api/v1/cart/items` - Додати товар
- `PUT /api/v1/cart/items/:id` - Оновити кількість
- `DELETE /api/v1/cart/items/:id` - Видалити товар
- `DELETE /api/v1/cart` - Очистити кошик

#### Orders
- `GET /api/v1/orders` - Список замовлень
- `GET /api/v1/orders/:id` - Деталі замовлення
- `POST /api/v1/orders` - Створення замовлення
- `POST /api/v1/orders/:id/cancel` - Скасування

#### Checkout
- `POST /api/v1/checkout` - Ініціювання оплати
- `POST /api/v1/checkout/confirm` - Підтвердження
- `GET /api/v1/checkout/shipping-methods` - Методи доставки

#### Users
- `POST /api/v1/auth/register` - Реєстрація
- `POST /api/v1/auth/login` - Авторизація
- `POST /api/v1/auth/logout` - Вихід
- `POST /api/v1/auth/refresh` - Оновлення токена
- `GET /api/v1/users/me` - Поточний користувач
- `PUT /api/v1/users/me` - Оновлення профілю
- `GET /api/v1/users/me/addresses` - Адреси
- `POST /api/v1/users/me/addresses` - Додати адресу

#### Search
- `GET /api/v1/search` - Пошук товарів
- `GET /api/v1/search/suggest` - Автодоповнення

---

## Upcoming Changes

### v1.5.0 (Planned: Q1 2025)

#### New Features
- **Subscriptions API** - Підписки на товари
- **Loyalty Points API** - Бонусна програма
- **Store Locator API** - Пошук магазинів

#### Deprecations
- `GET /api/v1/products/search` буде видалено

---

## Error Codes Reference

### Client Errors (4xx)

| Code | Error | Description |
|------|-------|-------------|
| 400 | `BAD_REQUEST` | Невалідні дані запиту |
| 401 | `UNAUTHORIZED` | Потрібна авторизація |
| 403 | `FORBIDDEN` | Доступ заборонено |
| 404 | `NOT_FOUND` | Ресурс не знайдено |
| 409 | `CONFLICT` | Конфлікт даних |
| 422 | `VALIDATION_ERROR` | Помилка валідації |
| 429 | `RATE_LIMITED` | Перевищено ліміт запитів |

### Server Errors (5xx)

| Code | Error | Description |
|------|-------|-------------|
| 500 | `INTERNAL_ERROR` | Внутрішня помилка сервера |
| 502 | `BAD_GATEWAY` | Помилка upstream сервера |
| 503 | `SERVICE_UNAVAILABLE` | Сервіс тимчасово недоступний |
| 504 | `GATEWAY_TIMEOUT` | Timeout upstream сервера |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "request_id": "req_abc123"
  }
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/v1/*` | 100 | 1 minute |
| `/api/v1/search/*` | 30 | 1 minute |
| `/api/v1/search/visual` | 10 | 1 minute |
| `/api/v1/auth/*` | 10 | 1 minute |
| `/graphql` | 60 | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

---

## Deprecation Notices

### Currently Deprecated

| Endpoint | Deprecated | Sunset | Replacement |
|----------|------------|--------|-------------|
| `GET /api/v1/products/search` | v1.3.0 | v2.0.0 | `GET /api/v1/search` |

### Deprecation Headers

```http
Deprecation: true
Sunset: Sat, 01 Jun 2025 00:00:00 GMT
Link: </api/v1/search>; rel="successor-version"
```

---

## SDK Updates

### JavaScript/TypeScript

```bash
npm install @shop-platform/sdk@latest
```

```typescript
// v1.4.0 changes
import { ShopClient, GiftCard } from '@shop-platform/sdk';

const client = new ShopClient({ apiKey: 'your-key' });

// New Gift Card API
const giftCard = await client.giftCards.create({
  amount: 1000,
  recipient_email: 'user@example.com'
});

// New B2B API
const quote = await client.quotes.create({
  company_id: 'comp_123',
  items: [{ product_id: 'prod_123', quantity: 100 }]
});
```

### Go

```bash
go get github.com/shop-platform/sdk-go@v1.4.0
```

```go
// v1.4.0 changes
import "github.com/shop-platform/sdk-go"

client := shopplatform.NewClient("your-key")

// New Gift Card API
giftCard, err := client.GiftCards.Create(ctx, &shopplatform.GiftCardParams{
    Amount:         1000,
    RecipientEmail: "user@example.com",
})

// New B2B API
quote, err := client.Quotes.Create(ctx, &shopplatform.QuoteParams{
    CompanyID: "comp_123",
    Items: []shopplatform.QuoteItem{
        {ProductID: "prod_123", Quantity: 100},
    },
})
```

---

## Migration Guides

### Migrating to v1.4.0

1. **Gift Cards in Cart**
```diff
// Before
POST /api/v1/cart
{
  "items": [...]
}

// After
POST /api/v1/cart
{
  "items": [...],
+ "gift_card_code": "GIFT-XXXX-XXXX"  // Optional
}
```

2. **Order Response Changes**
```diff
{
  "id": "ord_123",
  "total": 1000,
+ "gift_card_amount": 200,
+ "amount_due": 800,
  "payment_status": "paid"
}
```

### Migrating from Deprecated Endpoints

```diff
// Before (deprecated)
- GET /api/v1/products/search?q=phone

// After
+ GET /api/v1/search?q=phone&type=products
```

---

## Webhook Changelog

### v1.2.0
- Added: `order.created`, `order.paid`, `order.shipped`, `order.delivered`
- Added: `product.updated`, `inventory.low`

### v1.4.0
- Added: `gift_card.created`, `gift_card.redeemed`
- Added: `quote.requested`, `quote.approved`
- Added: `company.registered`, `company.approved`

---

## Support

- **API Status**: https://status.shop-platform.com
- **Documentation**: https://docs.shop-platform.com
- **Support**: api-support@shop-platform.com

## Див. також

- [API Reference](./README.md)
- [Authentication](./AUTHENTICATION.md)
- [Webhooks](./WEBHOOKS.md)
