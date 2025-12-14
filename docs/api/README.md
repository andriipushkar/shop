# API Reference

Документація REST API платформи.

## Огляд

| Властивість | Значення |
|-------------|----------|
| Base URL | `https://api.yourstore.com/api/v1` |
| Формат | JSON |
| Автентифікація | Bearer Token / API Key |
| Rate Limit | 1000 req/min |

## Сервіси

| Сервіс | Base Path | Опис |
|--------|-----------|------|
| [Core API](./CORE_API.md) | `/api/v1` | Продукти, категорії, інвентар |
| [OMS API](./OMS_API.md) | `/api/v1` | Замовлення, кошик, checkout |
| [Authentication](./AUTHENTICATION.md) | `/api/v1/auth` | Автентифікація, токени |

## Автентифікація

### Bearer Token (JWT)

```http
GET /api/v1/products
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### API Key

```http
GET /api/v1/products
Authorization: Bearer sk_live_abc123xyz...
```

Детальніше: [Authentication](./AUTHENTICATION.md)

## Request Format

### Headers

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-Tenant-ID: tenant_abc       # Optional, extracted from token
X-Request-ID: req_123         # Optional, for tracing
Accept-Language: uk           # Optional, for i18n
```

### Query Parameters

| Параметр | Тип | Опис |
|----------|-----|------|
| `page` | integer | Номер сторінки (default: 1) |
| `limit` | integer | Кількість на сторінку (default: 20, max: 100) |
| `sort` | string | Поле сортування |
| `order` | string | Напрямок: `asc` або `desc` |
| `search` | string | Пошуковий запит |

### Request Body

```json
{
  "field": "value",
  "nested": {
    "key": "value"
  },
  "array": ["item1", "item2"]
}
```

## Response Format

### Success Response

```json
{
  "data": {
    "id": "prod_123",
    "name": "Product Name",
    "price": 100.00
  }
}
```

### List Response

```json
{
  "data": [
    { "id": "prod_1", "name": "Product 1" },
    { "id": "prod_2", "name": "Product 2" }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK - Успішний запит |
| `201` | Created - Ресурс створено |
| `204` | No Content - Успішно, без тіла відповіді |
| `400` | Bad Request - Невалідні дані |
| `401` | Unauthorized - Потрібна автентифікація |
| `403` | Forbidden - Недостатньо прав |
| `404` | Not Found - Ресурс не знайдено |
| `409` | Conflict - Конфлікт (duplicate) |
| `422` | Unprocessable Entity - Validation error |
| `429` | Too Many Requests - Rate limit |
| `500` | Internal Server Error - Помилка сервера |

## Error Codes

| Code | Description |
|------|-------------|
| `validation_error` | Помилка валідації вхідних даних |
| `not_found` | Ресурс не знайдено |
| `unauthorized` | Потрібна автентифікація |
| `forbidden` | Недостатньо прав |
| `conflict` | Конфлікт (duplicate resource) |
| `rate_limited` | Перевищено ліміт запитів |
| `internal_error` | Внутрішня помилка сервера |
| `payment_failed` | Помилка оплати |
| `out_of_stock` | Товару немає в наявності |

## Rate Limiting

### Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1704096060
```

### Limits

| Endpoint | Limit |
|----------|-------|
| Default | 1000/min |
| Auth endpoints | 10/min |
| Search | 100/min |
| Webhooks | 100/sec |

### 429 Response

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests",
    "retry_after": 60
  }
}
```

## Pagination

### Request

```http
GET /api/v1/products?page=2&limit=20
```

### Response

```json
{
  "data": [...],
  "meta": {
    "total": 156,
    "page": 2,
    "limit": 20,
    "pages": 8,
    "has_next": true,
    "has_prev": true
  }
}
```

### Cursor-based (for large datasets)

```http
GET /api/v1/events?cursor=eyJpZCI6MTIzfQ&limit=100
```

```json
{
  "data": [...],
  "meta": {
    "next_cursor": "eyJpZCI6MjIzfQ",
    "has_more": true
  }
}
```

## Filtering

### Simple Filters

```http
GET /api/v1/products?category_id=cat_123&in_stock=true
```

### Range Filters

```http
GET /api/v1/products?price_min=100&price_max=500
GET /api/v1/orders?created_after=2024-01-01&created_before=2024-01-31
```

### Array Filters

```http
GET /api/v1/products?category_id[]=cat_1&category_id[]=cat_2
GET /api/v1/products?status=active,featured
```

## Sorting

```http
GET /api/v1/products?sort=price&order=asc
GET /api/v1/products?sort=-price              # "-" prefix for desc
GET /api/v1/products?sort=category,price      # Multiple fields
```

## Field Selection

```http
GET /api/v1/products?fields=id,name,price
GET /api/v1/products?fields=id,name,category.name
```

## Expanding Relations

```http
GET /api/v1/orders/ord_123?expand=customer,items.product
```

```json
{
  "data": {
    "id": "ord_123",
    "customer": {
      "id": "cust_456",
      "name": "John Doe"
    },
    "items": [
      {
        "product": {
          "id": "prod_789",
          "name": "Product Name"
        }
      }
    ]
  }
}
```

## Versioning

API версіонується через URL path:

```
/api/v1/products
/api/v2/products
```

### Deprecation

Застарілі endpoints повертають header:
```http
Deprecation: true
Sunset: Sat, 01 Jan 2025 00:00:00 GMT
Link: </api/v2/products>; rel="successor-version"
```

## CORS

Дозволені origins налаштовуються через конфігурацію:

```
Access-Control-Allow-Origin: https://yourstore.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-ID
Access-Control-Max-Age: 86400
```

## Webhooks

Для отримання подій в реальному часі використовуйте webhooks:

```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["order.created", "order.shipped"]
}
```

Детальніше: [Webhooks Module](../modules/WEBHOOKS.md)

## SDKs

### JavaScript/TypeScript

```bash
npm install @shop-platform/api-client
```

```typescript
import { ShopAPI } from '@shop-platform/api-client';

const api = new ShopAPI({
  apiKey: 'sk_live_xxx',
  baseURL: 'https://api.yourstore.com',
});

const products = await api.products.list({ limit: 10 });
```

### Go

```bash
go get github.com/shop-platform/go-sdk
```

```go
import "github.com/shop-platform/go-sdk"

client := shopsdk.NewClient("sk_live_xxx")
products, err := client.Products.List(ctx, &shopsdk.ListOptions{
    Limit: 10,
})
```

## Testing

### Sandbox Environment

```
Base URL: https://sandbox.api.yourstore.com/api/v1
```

### Test Credentials

```
API Key: sk_test_xxx
Test Card: 4242 4242 4242 4242
```

## Support

- **Documentation**: https://docs.yourstore.com
- **Status**: https://status.yourstore.com
- **Support**: support@yourstore.com
