# OMS API Reference

API для роботи з замовленнями, кошиком та checkout.

## Cart

### Get Cart

```http
GET /api/v1/cart
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": {
    "id": "cart_abc123",
    "items": [
      {
        "id": "item_1",
        "product_id": "prod_123",
        "variant_id": "var_456",
        "sku": "SKU-001-BLK",
        "name": "iPhone 15 Pro",
        "variant_name": "Black / 256GB",
        "image": "https://cdn.yourstore.com/products/iphone.jpg",
        "price": 49999.00,
        "quantity": 2,
        "total": 99998.00,
        "in_stock": true,
        "max_quantity": 10
      }
    ],
    "items_count": 2,
    "subtotal": 99998.00,
    "discount": 0,
    "shipping": null,
    "total": 99998.00,
    "currency": "UAH",
    "promocode": null
  }
}
```

### Add to Cart

```http
POST /api/v1/cart/items
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "product_id": "prod_123",
  "variant_id": "var_456",
  "quantity": 1
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "item_1",
    "product_id": "prod_123",
    "quantity": 1,
    "price": 49999.00,
    "total": 49999.00
  }
}
```

### Update Cart Item

```http
PATCH /api/v1/cart/items/{item_id}
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "quantity": 3
}
```

### Remove from Cart

```http
DELETE /api/v1/cart/items/{item_id}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

### Clear Cart

```http
DELETE /api/v1/cart
Authorization: Bearer <token>
```

### Apply Promocode

```http
POST /api/v1/cart/promocode
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "code": "SALE20"
}
```

**Response:**

```json
{
  "data": {
    "promocode": {
      "code": "SALE20",
      "type": "percentage",
      "value": 20,
      "description": "Знижка 20%"
    },
    "discount": 19999.60,
    "new_total": 79998.40
  }
}
```

### Remove Promocode

```http
DELETE /api/v1/cart/promocode
Authorization: Bearer <token>
```

---

## Checkout

### Calculate Shipping

```http
POST /api/v1/checkout/shipping
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "city": "Київ",
  "method": "nova_poshta"
}
```

**Response:**

```json
{
  "data": {
    "methods": [
      {
        "id": "nova_poshta_warehouse",
        "name": "Нова Пошта - Відділення",
        "provider": "nova_poshta",
        "type": "warehouse",
        "price": 70.00,
        "estimated_days": "1-2",
        "description": "Доставка у відділення"
      },
      {
        "id": "nova_poshta_courier",
        "name": "Нова Пошта - Кур'єр",
        "provider": "nova_poshta",
        "type": "courier",
        "price": 120.00,
        "estimated_days": "1-2",
        "description": "Адресна доставка кур'єром"
      },
      {
        "id": "pickup",
        "name": "Самовивіз",
        "provider": "internal",
        "type": "pickup",
        "price": 0,
        "estimated_days": "Сьогодні",
        "description": "Самовивіз з магазину"
      }
    ]
  }
}
```

### Get Warehouses

```http
GET /api/v1/checkout/warehouses
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `city` | string | Назва міста |
| `provider` | string | `nova_poshta`, `meest`, `ukrposhta` |
| `search` | string | Пошук по назві |

**Response:**

```json
{
  "data": [
    {
      "id": "np_123",
      "ref": "1ec09d88-e1c2-11e3-8c4a-0050568002cf",
      "name": "Відділення №1",
      "address": "вул. Хрещатик, 1",
      "city": "Київ",
      "schedule": "Пн-Сб: 09:00-20:00, Нд: 10:00-18:00",
      "max_weight": 30
    }
  ]
}
```

### Get Payment Methods

```http
GET /api/v1/checkout/payment-methods
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": [
    {
      "id": "card",
      "name": "Банківська картка",
      "icon": "credit-card",
      "description": "Visa, Mastercard",
      "available": true
    },
    {
      "id": "liqpay",
      "name": "LiqPay",
      "icon": "liqpay",
      "description": "Оплата через LiqPay",
      "available": true
    },
    {
      "id": "privat24",
      "name": "Приват24",
      "icon": "privat24",
      "description": "Оплата через Приват24",
      "available": true
    },
    {
      "id": "cash",
      "name": "Готівкою при отриманні",
      "icon": "cash",
      "description": "Оплата при доставці",
      "available": true,
      "fee": 20.00
    },
    {
      "id": "invoice",
      "name": "Рахунок-фактура",
      "icon": "document",
      "description": "Для юридичних осіб",
      "available": true
    }
  ]
}
```

### Create Order

```http
POST /api/v1/orders
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "customer": {
    "first_name": "Іван",
    "last_name": "Петренко",
    "email": "ivan@example.com",
    "phone": "+380991234567"
  },
  "shipping": {
    "method": "nova_poshta_warehouse",
    "city": "Київ",
    "warehouse_ref": "1ec09d88-e1c2-11e3-8c4a-0050568002cf"
  },
  "payment_method": "card",
  "comment": "Зателефонувати перед доставкою",
  "use_bonus_points": 500
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "ord_xyz789",
    "order_number": "ORD-2024-001234",
    "status": "pending",
    "payment_status": "pending",
    "customer": {
      "first_name": "Іван",
      "last_name": "Петренко",
      "email": "ivan@example.com",
      "phone": "+380991234567"
    },
    "items": [
      {
        "product_id": "prod_123",
        "sku": "SKU-001-BLK",
        "name": "iPhone 15 Pro",
        "quantity": 2,
        "price": 49999.00,
        "total": 99998.00
      }
    ],
    "subtotal": 99998.00,
    "shipping_cost": 70.00,
    "discount": 500.00,
    "total": 99568.00,
    "currency": "UAH",
    "shipping": {
      "method": "Нова Пошта - Відділення",
      "city": "Київ",
      "address": "Відділення №1, вул. Хрещатик, 1"
    },
    "payment": {
      "method": "card",
      "url": "https://checkout.liqpay.ua/checkout?token=xxx"
    },
    "created_at": "2024-01-15T14:30:00Z"
  }
}
```

---

## Orders

### List Orders

```http
GET /api/v1/orders
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Статус замовлення |
| `payment_status` | string | Статус оплати |
| `created_after` | datetime | Дата від |
| `created_before` | datetime | Дата до |
| `search` | string | Пошук по номеру |

**Response:**

```json
{
  "data": [
    {
      "id": "ord_xyz789",
      "order_number": "ORD-2024-001234",
      "status": "shipped",
      "payment_status": "paid",
      "items_count": 2,
      "total": 99568.00,
      "currency": "UAH",
      "tracking_number": "20450000123456",
      "created_at": "2024-01-15T14:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

### Get Order

```http
GET /api/v1/orders/{id}
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": {
    "id": "ord_xyz789",
    "order_number": "ORD-2024-001234",
    "status": "shipped",
    "status_history": [
      {
        "status": "pending",
        "timestamp": "2024-01-15T14:30:00Z"
      },
      {
        "status": "confirmed",
        "timestamp": "2024-01-15T14:35:00Z"
      },
      {
        "status": "processing",
        "timestamp": "2024-01-15T15:00:00Z"
      },
      {
        "status": "shipped",
        "timestamp": "2024-01-16T10:00:00Z",
        "comment": "Передано перевізнику"
      }
    ],
    "payment_status": "paid",
    "customer": {
      "id": "cust_123",
      "first_name": "Іван",
      "last_name": "Петренко",
      "email": "ivan@example.com",
      "phone": "+380991234567"
    },
    "items": [
      {
        "id": "item_1",
        "product_id": "prod_123",
        "sku": "SKU-001-BLK",
        "name": "iPhone 15 Pro",
        "image": "https://cdn.yourstore.com/products/iphone.jpg",
        "quantity": 2,
        "price": 49999.00,
        "total": 99998.00
      }
    ],
    "subtotal": 99998.00,
    "shipping_cost": 70.00,
    "discount": 500.00,
    "total": 99568.00,
    "currency": "UAH",
    "shipping": {
      "method": "nova_poshta_warehouse",
      "provider": "nova_poshta",
      "city": "Київ",
      "address": "Відділення №1, вул. Хрещатик, 1",
      "tracking_number": "20450000123456",
      "tracking_url": "https://novaposhta.ua/tracking?number=20450000123456",
      "estimated_delivery": "2024-01-17"
    },
    "payment": {
      "method": "card",
      "status": "paid",
      "paid_at": "2024-01-15T14:32:00Z",
      "transaction_id": "txn_abc123"
    },
    "comment": "Зателефонувати перед доставкою",
    "created_at": "2024-01-15T14:30:00Z",
    "updated_at": "2024-01-16T10:00:00Z"
  }
}
```

### Cancel Order

```http
POST /api/v1/orders/{id}/cancel
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "reason": "Передумав купувати"
}
```

**Response:**

```json
{
  "data": {
    "id": "ord_xyz789",
    "status": "cancelled",
    "refund": {
      "amount": 99568.00,
      "status": "pending"
    }
  }
}
```

### Request Return

```http
POST /api/v1/orders/{id}/return
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "items": [
    {
      "order_item_id": "item_1",
      "quantity": 1,
      "reason": "defective",
      "comment": "Не працює камера"
    }
  ]
}
```

---

## Admin Orders API

### List All Orders (Admin)

```http
GET /api/v1/admin/orders
Authorization: Bearer <admin_token>
```

**Additional Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `customer_id` | string | Фільтр по клієнту |
| `warehouse_id` | string | Фільтр по складу |
| `manager_id` | string | Фільтр по менеджеру |

### Update Order Status

```http
PATCH /api/v1/admin/orders/{id}/status
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "status": "processing",
  "comment": "Замовлення передано на комплектацію"
}
```

### Ship Order

```http
POST /api/v1/admin/orders/{id}/ship
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "tracking_number": "20450000123456",
  "carrier": "nova_poshta",
  "notify_customer": true
}
```

### Add Order Comment

```http
POST /api/v1/admin/orders/{id}/comments
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "text": "Клієнт просив перенести доставку на понеділок",
  "internal": true
}
```

### Process Refund

```http
POST /api/v1/admin/orders/{id}/refund
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "amount": 49999.00,
  "reason": "Повернення товару",
  "items": [
    {
      "order_item_id": "item_1",
      "quantity": 1
    }
  ]
}
```

---

## Payments

### Get Payment Status

```http
GET /api/v1/payments/{payment_id}
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": {
    "id": "pay_abc123",
    "order_id": "ord_xyz789",
    "amount": 99568.00,
    "currency": "UAH",
    "status": "completed",
    "method": "card",
    "provider": "liqpay",
    "provider_transaction_id": "liqpay_txn_123",
    "paid_at": "2024-01-15T14:32:00Z",
    "receipt_url": "https://liqpay.ua/receipt/xxx"
  }
}
```

### Initiate Payment

```http
POST /api/v1/payments
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "order_id": "ord_xyz789",
  "method": "liqpay",
  "return_url": "https://yourstore.com/checkout/success",
  "cancel_url": "https://yourstore.com/checkout/cancel"
}
```

**Response:**

```json
{
  "data": {
    "id": "pay_abc123",
    "redirect_url": "https://checkout.liqpay.ua/checkout?token=xxx",
    "expires_at": "2024-01-15T15:00:00Z"
  }
}
```

### Payment Callback (Webhook)

```http
POST /api/v1/payments/callback/liqpay
Content-Type: application/x-www-form-urlencoded

data=<base64_encoded_data>&signature=<signature>
```

---

## Tracking

### Get Tracking Info

```http
GET /api/v1/tracking/{tracking_number}
```

**Response:**

```json
{
  "data": {
    "tracking_number": "20450000123456",
    "carrier": "nova_poshta",
    "status": "in_transit",
    "status_description": "Прямує до міста отримувача",
    "estimated_delivery": "2024-01-17",
    "history": [
      {
        "status": "created",
        "description": "Створено ТТН",
        "location": "Київ",
        "timestamp": "2024-01-15T10:00:00Z"
      },
      {
        "status": "received",
        "description": "Прийнято на склад",
        "location": "Київ, Відділення №50",
        "timestamp": "2024-01-15T12:00:00Z"
      },
      {
        "status": "in_transit",
        "description": "Прямує до міста отримувача",
        "location": "В дорозі",
        "timestamp": "2024-01-16T08:00:00Z"
      }
    ]
  }
}
```

---

## Order Statuses

| Status | Description |
|--------|-------------|
| `pending` | Очікує підтвердження |
| `confirmed` | Підтверджено |
| `processing` | В обробці |
| `packed` | Запаковано |
| `shipped` | Відправлено |
| `in_transit` | В дорозі |
| `delivered` | Доставлено |
| `completed` | Виконано |
| `cancelled` | Скасовано |
| `returned` | Повернуто |

## Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Очікує оплати |
| `processing` | В процесі |
| `paid` | Оплачено |
| `failed` | Помилка оплати |
| `refunded` | Повернуто |
| `partially_refunded` | Частково повернуто |

---

## Error Responses

### Out of Stock

```json
{
  "error": {
    "code": "out_of_stock",
    "message": "Product is out of stock",
    "details": {
      "product_id": "prod_123",
      "available": 0,
      "requested": 2
    }
  }
}
```

### Invalid Promocode

```json
{
  "error": {
    "code": "invalid_promocode",
    "message": "Promocode is invalid or expired"
  }
}
```

### Payment Failed

```json
{
  "error": {
    "code": "payment_failed",
    "message": "Payment was declined",
    "details": {
      "reason": "insufficient_funds"
    }
  }
}
```

### Order Cannot Be Cancelled

```json
{
  "error": {
    "code": "cannot_cancel",
    "message": "Order cannot be cancelled in current status",
    "details": {
      "current_status": "shipped"
    }
  }
}
```
