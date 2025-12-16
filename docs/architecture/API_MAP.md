# API Map

Карта всіх API ендпоінтів системи.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                         api.shop.ua / shop.ua/api                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   /api/v1   │  │  /graphql   │  │    /ws      │  │  /webhooks  │        │
│  │   REST API  │  │   GraphQL   │  │  WebSocket  │  │   Callbacks │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │               │
│         ▼                ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Service Mesh                                 │   │
│  │    Core Service │ OMS Service │ CRM Service │ Notification Service  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.shop.ua/api/v1` |
| Staging | `https://staging-api.shop.ua/api/v1` |
| Development | `http://localhost:8080/api/v1` |

## Authentication

### Headers

```http
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_uuid>
X-Request-ID: <request_uuid>
```

### API Key (для інтеграцій)

```http
X-API-Key: <api_key>
```

## Core Service API

### Products

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/products` | List products | Public |
| GET | `/products/:id` | Get product | Public |
| POST | `/products` | Create product | Admin |
| PUT | `/products/:id` | Update product | Admin |
| DELETE | `/products/:id` | Delete product | Admin |
| POST | `/products/bulk` | Bulk import | Admin |
| GET | `/products/:id/variants` | List variants | Public |
| POST | `/products/:id/variants` | Create variant | Admin |

#### GET /products

```http
GET /api/v1/products?category=electronics&sort=-created_at&page=1&limit=20

Response 200:
{
  "data": [
    {
      "id": "prod_abc123",
      "name": "Смартфон Samsung Galaxy S24",
      "slug": "samsung-galaxy-s24",
      "sku": "SAM-S24-128",
      "price": 35999.00,
      "compare_at_price": 39999.00,
      "quantity": 50,
      "status": "active",
      "images": [
        { "url": "https://cdn.shop.ua/...", "position": 1 }
      ],
      "category": {
        "id": "cat_123",
        "name": "Смартфони"
      },
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

#### POST /products

```http
POST /api/v1/products
Content-Type: application/json

{
  "name": "Новий продукт",
  "sku": "NEW-001",
  "category_id": "cat_123",
  "price": 1999.00,
  "quantity": 100,
  "description": "Опис продукту",
  "images": [
    { "url": "https://...", "position": 1 }
  ]
}

Response 201:
{
  "data": {
    "id": "prod_xyz789",
    "name": "Новий продукт",
    ...
  }
}
```

### Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/categories` | List categories | Public |
| GET | `/categories/:id` | Get category | Public |
| GET | `/categories/tree` | Category tree | Public |
| POST | `/categories` | Create category | Admin |
| PUT | `/categories/:id` | Update category | Admin |
| DELETE | `/categories/:id` | Delete category | Admin |

### Orders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/orders` | List orders | Admin |
| GET | `/orders/:id` | Get order | Admin/Customer |
| POST | `/orders` | Create order | Customer |
| PUT | `/orders/:id` | Update order | Admin |
| POST | `/orders/:id/confirm` | Confirm order | Admin |
| POST | `/orders/:id/cancel` | Cancel order | Admin/Customer |
| GET | `/orders/:id/history` | Order history | Admin |

#### GET /orders

```http
GET /api/v1/orders?status=pending&from=2024-01-01&to=2024-01-31

Response 200:
{
  "data": [
    {
      "id": "ord_123456",
      "number": "UA-2024-001234",
      "status": "pending",
      "payment_status": "paid",
      "customer": {
        "id": "cust_789",
        "name": "Іван Петренко",
        "email": "ivan@example.com"
      },
      "items": [
        {
          "product_id": "prod_abc",
          "name": "Product Name",
          "quantity": 2,
          "price": 1500.00,
          "total": 3000.00
        }
      ],
      "subtotal": 3000.00,
      "shipping_cost": 70.00,
      "total": 3070.00,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "total": 45
  }
}
```

#### POST /orders

```http
POST /api/v1/orders
Content-Type: application/json

{
  "customer": {
    "email": "customer@example.com",
    "phone": "+380501234567",
    "first_name": "Іван",
    "last_name": "Петренко"
  },
  "items": [
    {
      "product_id": "prod_abc",
      "variant_id": "var_xyz",
      "quantity": 2
    }
  ],
  "shipping_address": {
    "city": "Київ",
    "address": "вул. Хрещатик, 1",
    "postal_code": "01001"
  },
  "shipping_method": "nova_poshta",
  "payment_method": "liqpay",
  "notes": "Подзвоніть перед доставкою"
}

Response 201:
{
  "data": {
    "id": "ord_789xyz",
    "number": "UA-2024-001235",
    "status": "pending",
    "total": 3070.00,
    "payment_url": "https://www.liqpay.ua/..."
  }
}
```

### Customers

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/customers` | List customers | Admin |
| GET | `/customers/:id` | Get customer | Admin |
| POST | `/customers` | Create customer | Admin |
| PUT | `/customers/:id` | Update customer | Admin |
| GET | `/customers/:id/orders` | Customer orders | Admin |
| GET | `/customers/:id/addresses` | Customer addresses | Admin |

### Inventory

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/inventory` | List inventory | Admin |
| GET | `/inventory/:product_id` | Get stock levels | Admin |
| PUT | `/inventory/:product_id` | Update stock | Admin |
| POST | `/inventory/adjust` | Adjust inventory | Admin |
| GET | `/inventory/low-stock` | Low stock items | Admin |
| GET | `/warehouses` | List warehouses | Admin |

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/search` | Search products | Public |
| GET | `/search/suggest` | Autocomplete | Public |
| GET | `/search/filters` | Get available filters | Public |

#### GET /search

```http
GET /api/v1/search?q=samsung&category=phones&price_min=10000&price_max=50000

Response 200:
{
  "data": [...],
  "facets": {
    "categories": [
      { "id": "cat_123", "name": "Смартфони", "count": 45 }
    ],
    "brands": [
      { "id": "brand_1", "name": "Samsung", "count": 23 }
    ],
    "price_range": {
      "min": 12999,
      "max": 89999
    }
  },
  "meta": {
    "total": 45,
    "took_ms": 23
  }
}
```

## OMS Service API

### Fulfillment

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/fulfillments` | List fulfillments | Admin |
| GET | `/fulfillments/:id` | Get fulfillment | Admin |
| POST | `/fulfillments` | Create fulfillment | Admin |
| POST | `/fulfillments/:id/ship` | Mark as shipped | Admin |
| POST | `/fulfillments/:id/deliver` | Mark as delivered | Admin |
| GET | `/fulfillments/:id/tracking` | Get tracking info | Public |

### Shipping

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/shipping/rates` | Calculate rates | Public |
| GET | `/shipping/methods` | Available methods | Public |
| POST | `/shipping/labels` | Generate label | Admin |
| GET | `/shipping/tracking/:number` | Track shipment | Public |

#### GET /shipping/rates

```http
GET /api/v1/shipping/rates?city=Київ&weight=0.5&total=3000

Response 200:
{
  "data": [
    {
      "method": "nova_poshta",
      "name": "Нова Пошта",
      "options": [
        {
          "type": "warehouse",
          "name": "На відділення",
          "price": 70.00,
          "delivery_days": "1-2"
        },
        {
          "type": "courier",
          "name": "Кур'єр",
          "price": 120.00,
          "delivery_days": "1"
        }
      ]
    },
    {
      "method": "ukrposhta",
      "name": "Укрпошта",
      "options": [
        {
          "type": "standard",
          "name": "Стандарт",
          "price": 45.00,
          "delivery_days": "3-5"
        }
      ]
    }
  ]
}
```

### Returns

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/returns` | List returns | Admin |
| GET | `/returns/:id` | Get return | Admin |
| POST | `/returns` | Create return | Customer |
| PUT | `/returns/:id` | Update return | Admin |
| POST | `/returns/:id/approve` | Approve return | Admin |
| POST | `/returns/:id/reject` | Reject return | Admin |

## CRM Service API

### Customer Segments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/segments` | List segments | Admin |
| GET | `/segments/:id` | Get segment | Admin |
| POST | `/segments` | Create segment | Admin |
| PUT | `/segments/:id` | Update segment | Admin |
| GET | `/segments/:id/customers` | Segment customers | Admin |

### Marketing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/campaigns` | List campaigns | Admin |
| POST | `/campaigns` | Create campaign | Admin |
| POST | `/campaigns/:id/send` | Send campaign | Admin |
| GET | `/campaigns/:id/stats` | Campaign stats | Admin |

### Promotions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/promotions` | List promotions | Admin |
| POST | `/promotions` | Create promotion | Admin |
| GET | `/promotions/validate` | Validate code | Public |
| POST | `/promotions/apply` | Apply to cart | Customer |

#### POST /promotions/validate

```http
POST /api/v1/promotions/validate
Content-Type: application/json

{
  "code": "WINTER2024",
  "cart": {
    "items": [...],
    "subtotal": 5000.00
  }
}

Response 200:
{
  "data": {
    "valid": true,
    "discount": {
      "type": "percentage",
      "value": 15,
      "amount": 750.00
    },
    "message": "Знижка 15% застосована"
  }
}
```

## Notification Service API

### Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | List notifications | Customer |
| POST | `/notifications/mark-read` | Mark as read | Customer |
| GET | `/notifications/settings` | Get settings | Customer |
| PUT | `/notifications/settings` | Update settings | Customer |

### Templates

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/templates` | List templates | Admin |
| GET | `/templates/:id` | Get template | Admin |
| PUT | `/templates/:id` | Update template | Admin |
| POST | `/templates/:id/preview` | Preview template | Admin |

## Storefront API (Public)

### Cart

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/cart` | Get cart | Session |
| POST | `/cart/items` | Add item | Session |
| PUT | `/cart/items/:id` | Update item | Session |
| DELETE | `/cart/items/:id` | Remove item | Session |
| DELETE | `/cart` | Clear cart | Session |

#### POST /cart/items

```http
POST /api/v1/cart/items
Content-Type: application/json

{
  "product_id": "prod_abc",
  "variant_id": "var_xyz",
  "quantity": 2
}

Response 200:
{
  "data": {
    "id": "cart_123",
    "items": [
      {
        "id": "item_1",
        "product_id": "prod_abc",
        "name": "Product Name",
        "quantity": 2,
        "price": 1500.00,
        "total": 3000.00
      }
    ],
    "subtotal": 3000.00,
    "discount": 0,
    "shipping": null,
    "total": 3000.00
  }
}
```

### Checkout

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/checkout` | Create checkout | Session |
| GET | `/checkout/:id` | Get checkout | Session |
| PUT | `/checkout/:id` | Update checkout | Session |
| POST | `/checkout/:id/complete` | Complete checkout | Session |

### Wishlist

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/wishlist` | Get wishlist | Customer |
| POST | `/wishlist` | Add product | Customer |
| DELETE | `/wishlist/:product_id` | Remove product | Customer |

### Reviews

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/products/:id/reviews` | Product reviews | Public |
| POST | `/products/:id/reviews` | Create review | Customer |
| PUT | `/reviews/:id` | Update review | Customer |
| DELETE | `/reviews/:id` | Delete review | Customer/Admin |

## Admin API

### Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/dashboard` | Dashboard stats | Admin |
| GET | `/admin/analytics` | Analytics data | Admin |
| GET | `/admin/reports/:type` | Generate report | Admin |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | List users | Admin |
| POST | `/admin/users` | Create user | Admin |
| PUT | `/admin/users/:id` | Update user | Admin |
| DELETE | `/admin/users/:id` | Delete user | Admin |
| PUT | `/admin/users/:id/role` | Change role | Admin |

### Settings

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/settings` | Get settings | Admin |
| PUT | `/admin/settings` | Update settings | Admin |
| GET | `/admin/settings/:key` | Get setting | Admin |
| PUT | `/admin/settings/:key` | Update setting | Admin |

## Webhooks

### Outgoing Webhooks

| Event | Payload |
|-------|---------|
| `order.created` | Order data |
| `order.paid` | Payment confirmation |
| `order.shipped` | Shipping info |
| `product.created` | Product data |
| `product.updated` | Updated fields |
| `inventory.low_stock` | Stock alert |

### Webhook Registration

```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://yoursite.com/webhook",
  "events": ["order.created", "order.paid"],
  "secret": "your_webhook_secret"
}
```

### Incoming Webhooks

| Source | Endpoint | Description |
|--------|----------|-------------|
| LiqPay | `/webhooks/liqpay` | Payment callbacks |
| Monobank | `/webhooks/monobank` | Payment status |
| Nova Poshta | `/webhooks/novaposhta` | Tracking updates |
| Checkbox | `/webhooks/checkbox` | Fiscal receipts |

## Error Responses

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
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid input |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public API | 100 | 1 minute |
| Authenticated | 1000 | 1 minute |
| Admin API | 5000 | 1 minute |
| Webhooks | 100 | 1 minute |

## See Also

- [GraphQL Schema](./GRAPHQL.md)
- [WebSocket Events](../api/WEBSOCKET.md)
- [API Versioning](../adr/ADR-008-api-versioning.md)
- [Authentication](../modules/AUTH.md)
