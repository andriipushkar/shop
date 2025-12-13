# API Reference

Повна документація всіх API endpoints системи.

## Зміст

- [Автентифікація](#автентифікація)
- [Fiscal API](#fiscal-api)
- [B2B API](#b2b-api)
- [Supplier API](#supplier-api)
- [Hardware API](#hardware-api)
- [AI Repricing API](#ai-repricing-api)
- [AI Forecasting API](#ai-forecasting-api)
- [Коди помилок](#коди-помилок)

---

## Автентифікація

Більшість API endpoints вимагають автентифікації.

### Типи автентифікації

**1. JWT Token (веб-клієнти)**
```http
Authorization: Bearer <jwt_token>
```

**2. API Key (постачальники)**
```http
X-API-Key: <api_key>
```

**3. Session (admin panel)**
```http
Cookie: next-auth.session-token=<session>
```

---

## Fiscal API

### POST /api/admin/fiscal/shift/open

Відкрити касову зміну.

**Request:**
```json
{
  "cashierId": "cashier-123"
}
```

**Response (200):**
```json
{
  "success": true,
  "shift": {
    "id": "shift-456",
    "serial": 1,
    "status": "OPENED",
    "openedAt": "2025-12-14T10:00:00Z",
    "balance": 0,
    "receiptsCount": 0,
    "totalSales": 0,
    "totalReturns": 0
  },
  "message": "Зміну відкрито успішно"
}
```

**Errors:**
- `400` - Зміна вже відкрита
- `500` - Помилка відкриття зміни

---

### POST /api/admin/fiscal/shift/close

Закрити касову зміну та створити Z-звіт.

**Request:**
```json
{
  "cashierId": "cashier-123"
}
```

**Response (200):**
```json
{
  "success": true,
  "zReport": {
    "id": "zreport-789",
    "serial": 1,
    "fiscalCode": "1234567890",
    "createdAt": "2025-12-14T20:00:00Z",
    "paymentsSum": 45000,
    "returnsSum": 2000,
    "receiptsCount": 15,
    "returnsCount": 2,
    "taxes": [
      {
        "rate": 20,
        "label": "ПДВ 20%",
        "sellSum": 37500,
        "returnSum": 1667
      }
    ]
  },
  "message": "Зміну закрито, Z-звіт створено"
}
```

**Errors:**
- `400` - Зміна не відкрита
- `500` - Помилка закриття зміни

---

### GET /api/admin/fiscal/shift/status

Отримати статус поточної зміни.

**Query Parameters:**
- `cashierId` - ID касира (опційно)

**Response (200):**
```json
{
  "isOpen": true,
  "shift": {
    "id": "shift-456",
    "serial": 1,
    "status": "OPENED",
    "openedAt": "2025-12-14T10:00:00Z",
    "balance": 15000,
    "receiptsCount": 5,
    "totalSales": 15000,
    "totalReturns": 0
  }
}
```

---

### POST /api/admin/fiscal/receipt

Створити фіскальний чек.

**Request:**
```json
{
  "orderId": "order-123",
  "items": [
    {
      "sku": "PROD-001",
      "name": "iPhone 15 Pro",
      "price": 45000,
      "quantity": 1,
      "taxRate": 20,
      "uktzed": "8517120000",
      "barcode": "1234567890123"
    }
  ],
  "payments": [
    {
      "type": "card",
      "amount": 45000
    }
  ],
  "customer": {
    "email": "customer@example.com",
    "phone": "+380501234567"
  },
  "header": "ТОВ \"Магазин\"",
  "footer": "Дякуємо за покупку!"
}
```

**Response (200):**
```json
{
  "success": true,
  "fiscalCode": "1234567890",
  "receiptId": "receipt-123",
  "receiptUrl": "https://checkbox.ua/receipts/...",
  "qrCodeUrl": "https://checkbox.ua/qr/...",
  "pdfUrl": "https://checkbox.ua/pdf/...",
  "receiptText": "===== ЧЕК =====\n..."
}
```

**Errors:**
- `400` - Невалідні дані
- `500` - Помилка створення чеку

---

### POST /api/admin/fiscal/return

Створити чек повернення.

**Request:**
```json
{
  "originalFiscalCode": "1234567890",
  "items": [
    {
      "sku": "PROD-001",
      "name": "iPhone 15 Pro",
      "price": 45000,
      "quantity": 1,
      "taxRate": 20
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "fiscalCode": "0987654321",
  "receiptId": "receipt-456",
  "receiptUrl": "https://checkbox.ua/receipts/...",
  "qrCodeUrl": "https://checkbox.ua/qr/...",
  "pdfUrl": "https://checkbox.ua/pdf/..."
}
```

---

### GET /api/admin/fiscal/receipt/:id

Отримати інформацію про чек.

**Response (200):**
```json
{
  "id": "receipt-123",
  "fiscalCode": "1234567890",
  "type": "SELL",
  "date": "2025-12-14T15:30:00Z",
  "total": 45000,
  "items": [
    {
      "name": "iPhone 15 Pro",
      "quantity": 1,
      "price": 45000,
      "total": 45000
    }
  ],
  "payments": [
    {
      "type": "CARD",
      "amount": 45000
    }
  ],
  "pdfUrl": "https://checkbox.ua/pdf/...",
  "qrCodeUrl": "https://checkbox.ua/qr/..."
}
```

---

### POST /api/admin/fiscal/service/deposit

Службове внесення коштів.

**Request:**
```json
{
  "amount": 10000,
  "comment": "Розмінна готівка"
}
```

**Response (200):**
```json
{
  "success": true,
  "fiscalCode": "1111111111",
  "receiptId": "receipt-789"
}
```

---

### POST /api/admin/fiscal/service/withdraw

Службове винесення коштів.

**Request:**
```json
{
  "amount": 5000,
  "comment": "Здача в банк"
}
```

**Response (200):**
```json
{
  "success": true,
  "fiscalCode": "2222222222",
  "receiptId": "receipt-790"
}
```

---

### GET /api/admin/fiscal/reports/daily

Отримати денний звіт.

**Query Parameters:**
- `date` - дата (YYYY-MM-DD)

**Response (200):**
```json
{
  "date": "2025-12-14",
  "totalSales": 150000,
  "totalReturns": 5000,
  "receiptsCount": 25,
  "returnsCount": 2,
  "cashPayments": 50000,
  "cardPayments": 95000,
  "onlinePayments": 5000,
  "shifts": [
    {
      "id": "shift-1",
      "openedAt": "2025-12-14T09:00:00Z",
      "closedAt": "2025-12-14T20:00:00Z",
      "receiptsCount": 25,
      "totalSales": 150000
    }
  ]
}
```

---

### GET /api/admin/fiscal/reports/period

Отримати звіт за період.

**Query Parameters:**
- `from` - початкова дата (YYYY-MM-DD)
- `to` - кінцева дата (YYYY-MM-DD)

**Response (200):**
```json
{
  "from": "2025-12-01",
  "to": "2025-12-14",
  "totalSales": 500000,
  "totalReturns": 15000,
  "receiptsCount": 120,
  "returnsCount": 8,
  "dailyReports": [
    {
      "date": "2025-12-01",
      "totalSales": 35000,
      "receiptsCount": 10
    }
  ]
}
```

---

## B2B API

### GET /api/b2b/prices

Отримати ціни для B2B клієнта.

**Authentication:** Required (JWT)

**Query Parameters:**
- `productIds` - список ID товарів (через кому)

**Example:**
```
GET /api/b2b/prices?productIds=prod-1,prod-2,prod-3
```

**Response (200):**
```json
{
  "customerId": "customer-1",
  "tier": "wholesale_medium",
  "prices": [
    {
      "productId": "prod-1",
      "customerPrice": 850,
      "retail": 1000,
      "savings": 150,
      "savingsPercent": "15.00"
    },
    {
      "productId": "prod-2",
      "customerPrice": 1700,
      "retail": 2000,
      "savings": 300,
      "savingsPercent": "15.00"
    }
  ]
}
```

**Errors:**
- `400` - Не вказано productIds
- `401` - Не автентифіковано
- `500` - Внутрішня помилка

---

### GET /api/b2b/price-list

Завантажити прайс-лист.

**Authentication:** Required (JWT)

**Query Parameters:**
- `format` - формат файлу (`xlsx`, `csv`, `xml`)
- `categoryId` - фільтр по категорії (опційно)

**Example:**
```
GET /api/b2b/price-list?format=xlsx
```

**Response (200):**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="price-list-2025-12-14.xlsx"

[Binary file content]
```

---

### GET /api/b2b/credit

Отримати інформацію про кредитний ліміт.

**Authentication:** Required (JWT)

**Response (200):**
```json
{
  "customerId": "customer-1",
  "creditLimit": 100000,
  "availableCredit": 75000,
  "usedCredit": 25000,
  "paymentTermDays": 30,
  "overdueAmount": 0,
  "nextPaymentDue": "2025-12-20",
  "creditStatus": "good"
}
```

---

### POST /api/b2b/order

Створити B2B замовлення.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "items": [
    {
      "productId": "prod-1",
      "quantity": 50
    },
    {
      "productId": "prod-2",
      "quantity": 100
    }
  ],
  "deliveryAddress": {
    "company": "ТОВ Партнер",
    "address": "вул. Хрещатик, 1",
    "city": "Київ",
    "postalCode": "01001",
    "country": "Україна",
    "contactPerson": "Іван Іваненко",
    "phone": "+380501234567"
  },
  "paymentMethod": "credit",
  "comment": "Термінове замовлення"
}
```

**Response (201):**
```json
{
  "orderId": "B2B-2025-001",
  "status": "pending",
  "items": [
    {
      "productId": "prod-1",
      "quantity": 50,
      "price": 850,
      "total": 42500
    },
    {
      "productId": "prod-2",
      "quantity": 100,
      "price": 1700,
      "total": 170000
    }
  ],
  "subtotal": 212500,
  "tax": 42500,
  "total": 255000,
  "discount": 37500,
  "createdAt": "2025-12-14T10:00:00Z",
  "estimatedDelivery": "2025-12-18"
}
```

---

### GET /api/b2b/orders

Отримати історію замовлень.

**Authentication:** Required (JWT)

**Query Parameters:**
- `status` - фільтр по статусу (`pending`, `confirmed`, `shipped`, `delivered`, `cancelled`)
- `from` - початкова дата (YYYY-MM-DD)
- `to` - кінцева дата (YYYY-MM-DD)
- `page` - номер сторінки (за замовчуванням 1)
- `limit` - кількість на сторінку (за замовчуванням 20, макс 100)

**Response (200):**
```json
{
  "orders": [
    {
      "orderId": "B2B-2025-001",
      "status": "shipped",
      "total": 255000,
      "createdAt": "2025-12-14T10:00:00Z",
      "itemsCount": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### GET /api/b2b/invoices

Отримати рахунки.

**Authentication:** Required (JWT)

**Query Parameters:**
- `status` - фільтр по статусу (`unpaid`, `paid`, `overdue`)
- `page` - номер сторінки
- `limit` - кількість на сторінку

**Response (200):**
```json
{
  "invoices": [
    {
      "invoiceId": "INV-2025-001",
      "orderId": "B2B-2025-001",
      "amount": 255000,
      "status": "unpaid",
      "dueDate": "2025-12-20",
      "createdAt": "2025-12-14T10:00:00Z",
      "pdfUrl": "/invoices/INV-2025-001.pdf"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

---

## Supplier API

### POST /api/supplier/register

Реєстрація постачальника.

**Request:**
```json
{
  "companyName": "ТОВ Постачальник",
  "contactPerson": "Петро Петренко",
  "email": "supplier@example.com",
  "phone": "+380501234567",
  "edrpou": "12345678",
  "address": "вул. Промислова, 10, Київ",
  "bankDetails": {
    "bankName": "ПриватБанк",
    "iban": "UA123456789012345678901234567",
    "mfo": "305299"
  }
}
```

**Response (201):**
```json
{
  "id": "SUP-123",
  "companyName": "ТОВ Постачальник",
  "status": "pending",
  "message": "Заявка на реєстрацію надіслана. Очікуйте підтвердження адміністратора."
}
```

**Note:** API ключ буде надіслано на email після підтвердження адміністратором.

---

### GET /api/supplier/products

Отримати список товарів постачальника.

**Authentication:** Required (API Key)

**Query Parameters:**
- `status` - фільтр по статусу (`active`, `inactive`, `pending`)
- `page` - номер сторінки
- `limit` - кількість на сторінку

**Response (200):**
```json
{
  "products": [
    {
      "id": "prod-123",
      "sku": "SUP-PROD-001",
      "name": "Товар 1",
      "price": 1000,
      "stock": 100,
      "status": "active",
      "commissionRate": 15,
      "createdAt": "2025-12-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150
  }
}
```

---

### POST /api/supplier/products

Додати новий товар.

**Authentication:** Required (API Key)

**Request:**
```json
{
  "sku": "SUP-PROD-002",
  "name": "Новий товар",
  "description": "Опис товару",
  "price": 1500,
  "comparePrice": 2000,
  "costPrice": 1000,
  "stock": 50,
  "categoryId": "cat-electronics",
  "brand": "Samsung",
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "specifications": {
    "weight": "0.5 kg",
    "dimensions": "20x10x5 cm",
    "color": "Чорний"
  },
  "barcode": "1234567890123",
  "active": true
}
```

**Response (201):**
```json
{
  "id": "prod-124",
  "sku": "SUP-PROD-002",
  "status": "pending",
  "message": "Товар додано. Очікує модерації."
}
```

---

### PUT /api/supplier/products/:id

Оновити товар.

**Authentication:** Required (API Key)

**Request:**
```json
{
  "price": 1600,
  "stock": 75,
  "description": "Оновлений опис"
}
```

**Response (200):**
```json
{
  "id": "prod-124",
  "message": "Товар оновлено успішно"
}
```

---

### DELETE /api/supplier/products/:id

Видалити товар.

**Authentication:** Required (API Key)

**Response (200):**
```json
{
  "message": "Товар видалено успішно"
}
```

---

### POST /api/supplier/products/import

Масовий імпорт товарів.

**Authentication:** Required (API Key)

**Request:**
```
Content-Type: multipart/form-data

file: products.xlsx
```

**Формат файлу (XLSX/CSV):**
| sku | name | price | stock | category | brand | barcode |
|-----|------|-------|-------|----------|-------|---------|
| SUP-001 | Товар 1 | 1000 | 50 | electronics | Samsung | 1234567890123 |
| SUP-002 | Товар 2 | 1500 | 30 | electronics | Apple | 1234567890124 |

**Response (200):**
```json
{
  "total": 100,
  "imported": 95,
  "failed": 5,
  "errors": [
    {
      "row": 10,
      "sku": "SUP-010",
      "error": "Невалідна ціна"
    }
  ]
}
```

---

### GET /api/supplier/products/export

Експортувати товари.

**Authentication:** Required (API Key)

**Query Parameters:**
- `format` - формат (`xlsx`, `csv`)

**Response (200):**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="products-2025-12-14.xlsx"

[Binary file]
```

---

### POST /api/supplier/stock

Оновити залишки товарів.

**Authentication:** Required (API Key)

**Request:**
```json
{
  "updates": [
    {
      "sku": "SUP-PROD-001",
      "stock": 120
    },
    {
      "sku": "SUP-PROD-002",
      "stock": 80
    }
  ]
}
```

**Response (200):**
```json
{
  "updated": 2,
  "errors": []
}
```

---

### GET /api/supplier/orders

Отримати замовлення.

**Authentication:** Required (API Key)

**Query Parameters:**
- `status` - фільтр по статусу (`new`, `confirmed`, `shipped`, `cancelled`)
- `from` - початкова дата
- `to` - кінцева дата
- `page` - номер сторінки
- `limit` - кількість на сторінку

**Response (200):**
```json
{
  "orders": [
    {
      "orderId": "ORD-2025-123",
      "status": "new",
      "items": [
        {
          "sku": "SUP-PROD-001",
          "name": "Товар 1",
          "quantity": 2,
          "price": 1000,
          "commission": 150,
          "supplierEarnings": 850
        }
      ],
      "total": 2000,
      "supplierEarnings": 1700,
      "commission": 300,
      "customer": {
        "name": "Іван Іваненко",
        "phone": "+380501234567",
        "address": "вул. Хрещатик, 1, Київ"
      },
      "createdAt": "2025-12-14T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

---

### POST /api/supplier/orders/:id/confirm

Підтвердити замовлення.

**Authentication:** Required (API Key)

**Request:**
```json
{
  "estimatedShippingDate": "2025-12-16"
}
```

**Response (200):**
```json
{
  "orderId": "ORD-2025-123",
  "status": "confirmed",
  "message": "Замовлення підтверджено"
}
```

---

### POST /api/supplier/orders/:id/ship

Відправити замовлення.

**Authentication:** Required (API Key)

**Request:**
```json
{
  "trackingNumber": "59000123456789",
  "carrier": "Нова Пошта",
  "shippingDate": "2025-12-16",
  "estimatedDelivery": "2025-12-18"
}
```

**Response (200):**
```json
{
  "orderId": "ORD-2025-123",
  "status": "shipped",
  "message": "Замовлення відправлено. Клієнта сповіщено."
}
```

---

### GET /api/supplier/earnings

Отримати інформацію про виплати.

**Authentication:** Required (API Key)

**Query Parameters:**
- `from` - початкова дата
- `to` - кінцева дата

**Response (200):**
```json
{
  "totalEarnings": 50000,
  "pendingPayout": 25000,
  "paidOut": 25000,
  "nextPayoutDate": "2025-12-20",
  "payouts": [
    {
      "id": "payout-1",
      "amount": 25000,
      "status": "paid",
      "paidAt": "2025-12-01T10:00:00Z"
    }
  ],
  "orders": [
    {
      "orderId": "ORD-2025-120",
      "supplierEarnings": 1700,
      "commission": 300,
      "status": "delivered",
      "deliveredAt": "2025-12-10T10:00:00Z"
    }
  ]
}
```

---

### POST /api/supplier/payout

Запит на виплату.

**Authentication:** Required (API Key)

**Request:**
```json
{
  "amount": 25000,
  "method": "bank_transfer"
}
```

**Response (200):**
```json
{
  "payoutId": "payout-2",
  "amount": 25000,
  "status": "pending",
  "estimatedDate": "2025-12-20",
  "message": "Запит на виплату створено. Обробка до 3 робочих днів."
}
```

---

### GET /api/supplier/profile

Отримати профіль постачальника.

**Authentication:** Required (API Key)

**Response (200):**
```json
{
  "id": "SUP-123",
  "companyName": "ТОВ Постачальник",
  "contactPerson": "Петро Петренко",
  "email": "supplier@example.com",
  "phone": "+380501234567",
  "status": "active",
  "commissionRate": 15,
  "paymentTermDays": 14,
  "autoApprove": false,
  "stats": {
    "totalProducts": 150,
    "activeProducts": 120,
    "totalOrders": 250,
    "totalEarnings": 500000,
    "rating": 4.8
  },
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

### POST /api/supplier/webhook

Webhook для сповіщень (налаштовується в профілі).

**Events:**
- `order.created` - нове замовлення
- `order.cancelled` - скасування замовлення
- `product.approved` - товар схвалено
- `product.rejected` - товар відхилено
- `payout.completed` - виплата виконана

**Example payload (order.created):**
```json
{
  "event": "order.created",
  "data": {
    "orderId": "ORD-2025-123",
    "items": [...],
    "total": 2000,
    "customer": {...}
  },
  "timestamp": "2025-12-14T10:00:00Z"
}
```

---

## Hardware API

### GET /api/hardware/printers

Отримати список принтерів.

**Authentication:** Required (JWT)

**Response (200):**
```json
{
  "printers": [
    {
      "id": "printer-1",
      "name": "Thermal Printer POS-80",
      "type": "thermal",
      "connection": "usb",
      "status": "online",
      "default": true,
      "capabilities": ["receipt", "label", "barcode"]
    },
    {
      "id": "printer-2",
      "name": "Zebra ZD420",
      "type": "label",
      "connection": "network",
      "ip": "192.168.1.100",
      "status": "online",
      "default": false,
      "capabilities": ["label", "barcode", "qr"]
    }
  ]
}
```

---

### POST /api/hardware/printers

Додати принтер.

**Authentication:** Required (JWT, Admin)

**Request:**
```json
{
  "name": "New Printer",
  "type": "thermal",
  "connection": "network",
  "ip": "192.168.1.101",
  "port": 9100,
  "default": false
}
```

**Response (201):**
```json
{
  "id": "printer-3",
  "name": "New Printer",
  "status": "testing",
  "message": "Принтер додано. Перевірте підключення."
}
```

---

### GET /api/hardware/printers/:id

Отримати інформацію про принтер.

**Authentication:** Required (JWT)

**Response (200):**
```json
{
  "id": "printer-1",
  "name": "Thermal Printer POS-80",
  "type": "thermal",
  "connection": "usb",
  "status": "online",
  "stats": {
    "totalPrints": 1250,
    "failedPrints": 5,
    "lastPrint": "2025-12-14T15:30:00Z"
  }
}
```

---

### PUT /api/hardware/printers/:id

Оновити налаштування принтера.

**Authentication:** Required (JWT, Admin)

**Request:**
```json
{
  "name": "Updated Name",
  "default": true
}
```

**Response (200):**
```json
{
  "id": "printer-1",
  "message": "Налаштування оновлено"
}
```

---

### DELETE /api/hardware/printers/:id

Видалити принтер.

**Authentication:** Required (JWT, Admin)

**Response (200):**
```json
{
  "message": "Принтер видалено"
}
```

---

### POST /api/hardware/print/label

Друк етикетки.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "printerId": "printer-2",
  "type": "product",
  "data": {
    "barcode": "1234567890123",
    "name": "iPhone 15 Pro",
    "price": 45000,
    "sku": "PROD-001"
  },
  "quantity": 10
}
```

**Response (200):**
```json
{
  "success": true,
  "jobId": "print-job-123",
  "message": "Етикетки надіслано на друк (10 шт)"
}
```

---

### POST /api/hardware/print/product-label

Друк етикетки товару.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "productId": "prod-123",
  "quantity": 5,
  "includePrice": true,
  "includeQR": true
}
```

**Response (200):**
```json
{
  "success": true,
  "jobId": "print-job-124"
}
```

---

### POST /api/hardware/print

Універсальний друк.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "printerId": "printer-1",
  "type": "receipt",
  "content": "===== ЧЕК =====\n...",
  "format": "text"
}
```

**Response (200):**
```json
{
  "success": true,
  "jobId": "print-job-125"
}
```

---

## AI Repricing API

### GET /api/ai/repricing

Отримати правила репрайсингу.

**Authentication:** Required (JWT, Admin)

**Query Parameters:**
- `productId` - фільтр по товару
- `enabled` - тільки активні (`true`/`false`)

**Response (200):**
```json
{
  "rules": [
    {
      "id": "rule-1",
      "productId": "prod-123",
      "enabled": true,
      "strategy": {
        "type": "beat_lowest",
        "margin": 10
      },
      "competitors": ["comp-1", "comp-2"],
      "constraints": {
        "minPrice": 900,
        "maxPrice": 1200,
        "minMargin": 15,
        "roundTo": 0.99
      },
      "createdAt": "2025-12-01T00:00:00Z",
      "updatedAt": "2025-12-14T10:00:00Z"
    }
  ]
}
```

---

### POST /api/ai/repricing

Створити правило репрайсингу.

**Authentication:** Required (JWT, Admin)

**Request:**
```json
{
  "productId": "prod-123",
  "enabled": true,
  "strategy": {
    "type": "beat_lowest",
    "margin": 10
  },
  "competitors": ["comp-1", "comp-2", "comp-3"],
  "constraints": {
    "minPrice": 900,
    "maxPrice": 1200,
    "minMargin": 15,
    "maxDiscount": 25,
    "roundTo": 0.99
  }
}
```

**Response (201):**
```json
{
  "id": "rule-2",
  "message": "Правило репрайсингу створено"
}
```

---

### PUT /api/ai/repricing/:id

Оновити правило репрайсингу.

**Authentication:** Required (JWT, Admin)

**Request:**
```json
{
  "enabled": false,
  "strategy": {
    "type": "match_lowest"
  }
}
```

**Response (200):**
```json
{
  "id": "rule-1",
  "message": "Правило оновлено"
}
```

---

### DELETE /api/ai/repricing/:id

Видалити правило репрайсингу.

**Authentication:** Required (JWT, Admin)

**Response (200):**
```json
{
  "message": "Правило видалено"
}
```

---

### POST /api/ai/repricing/run

Запустити репрайсинг.

**Authentication:** Required (JWT, Admin)

**Request (одного товару):**
```json
{
  "productId": "prod-123"
}
```

**Request (категорії):**
```json
{
  "categoryId": "cat-electronics"
}
```

**Request (запланований для всіх):**
```json
{
  "scheduled": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Price updated successfully",
  "data": {
    "id": "pc-123",
    "productId": "prod-123",
    "oldPrice": 1150,
    "newPrice": 1049.99,
    "reason": "Ціна нижче найнижчої конкурентної на 10 грн",
    "margin": 18.5,
    "competitorPrices": [
      {
        "competitorId": "comp-1",
        "competitorName": "Конкурент 1",
        "price": 1060,
        "inStock": true
      }
    ],
    "appliedAt": "2025-12-14T10:00:00Z"
  }
}
```

---

### GET /api/ai/repricing/history

Історія змін цін.

**Authentication:** Required (JWT, Admin)

**Query Parameters:**
- `productId` - фільтр по товару
- `days` - кількість днів (за замовчуванням 30)

**Response (200):**
```json
{
  "productId": "prod-123",
  "changes": [
    {
      "id": "pc-123",
      "oldPrice": 1150,
      "newPrice": 1049.99,
      "reason": "Ціна нижче найнижчої конкурентної на 10 грн",
      "margin": 18.5,
      "appliedAt": "2025-12-14T10:00:00Z",
      "ruleId": "rule-1"
    }
  ]
}
```

---

### GET /api/ai/repricing/suggestions

Отримати рекомендації щодо цін.

**Authentication:** Required (JWT, Admin)

**Query Parameters:**
- `productId` - ID товару

**Response (200):**
```json
{
  "productId": "prod-123",
  "currentPrice": 1150,
  "suggestedPrice": 1049.99,
  "reason": "Ціна нижче найнижчої конкурентної на 10 грн",
  "competitorData": [
    {
      "competitorId": "comp-1",
      "competitorName": "Конкурент 1",
      "price": 1060,
      "url": "https://competitor1.com/product",
      "lastChecked": "2025-12-14T09:00:00Z",
      "inStock": true,
      "position": 1
    }
  ],
  "margin": 18.5,
  "estimatedImpact": {
    "salesIncrease": "15%",
    "revenueChange": "+5%"
  }
}
```

---

### GET /api/ai/repricing/alerts

Отримати цінові сповіщення.

**Authentication:** Required (JWT, Admin)

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "alert-1",
      "productId": "prod-123",
      "productName": "Product 123",
      "competitorId": "comp-1",
      "competitorName": "Конкурент 1",
      "ourPrice": 1150,
      "competitorPrice": 1000,
      "difference": 150,
      "differencePercent": 13.04,
      "severity": "high",
      "createdAt": "2025-12-14T10:00:00Z"
    }
  ]
}
```

---

## AI Forecasting API

### GET /api/ai/forecast

Прогноз продажів для товару.

**Authentication:** Required (JWT, Admin)

**Query Parameters:**
- `productId` - ID товару
- `days` - кількість днів прогнозу (за замовчуванням 30)
- `method` - метод прогнозування (`sma`, `exponential`, `linear`, `auto`)

**Response (200):**
```json
{
  "productId": "prod-123",
  "method": "exponential",
  "forecast": [
    {
      "date": "2025-12-15",
      "predicted": 15.5,
      "confidence": 0.85
    },
    {
      "date": "2025-12-16",
      "predicted": 16.2,
      "confidence": 0.83
    }
  ],
  "accuracy": 0.87,
  "trend": "increasing"
}
```

---

### GET /api/ai/forecast/seasonality

Виявлення сезонності.

**Authentication:** Required (JWT, Admin)

**Query Parameters:**
- `productId` - ID товару
- `categoryId` - ID категорії (альтернативно)

**Response (200):**
```json
{
  "productId": "prod-123",
  "hasSeasonality": true,
  "seasonalPattern": "monthly",
  "peakMonths": [11, 12],
  "lowMonths": [2, 3],
  "seasonalityStrength": 0.75,
  "recommendations": [
    "Збільшити запаси на 30% у листопаді та грудні",
    "Розпродажі у лютому та березні"
  ]
}
```

---

### GET /api/ai/forecast/trends

Виявлення трендів.

**Authentication:** Required (JWT, Admin)

**Query Parameters:**
- `productId` - ID товару

**Response (200):**
```json
{
  "productId": "prod-123",
  "trend": "increasing",
  "trendStrength": 0.65,
  "growthRate": 5.2,
  "changePoints": [
    {
      "date": "2025-11-01",
      "type": "increase",
      "magnitude": 25
    }
  ]
}
```

---

### GET /api/ai/forecast/recommendations

Рекомендації щодо закупівель.

**Authentication:** Required (JWT, Admin)

**Query Parameters:**
- `productId` - ID товару

**Response (200):**
```json
{
  "productId": "prod-123",
  "currentStock": 50,
  "recommendedOrder": 150,
  "expectedDemand": {
    "week1": 45,
    "week2": 48,
    "week3": 52,
    "week4": 55
  },
  "reorderPoint": 100,
  "safetyStock": 30,
  "leadTime": 7,
  "confidenceLevel": 0.90,
  "notes": [
    "Очікується збільшення попиту",
    "Рекомендується замовити до 2025-12-20"
  ]
}
```

---

### POST /api/ai/forecast/simulate

Симуляція різних сценаріїв.

**Authentication:** Required (JWT, Admin)

**Request:**
```json
{
  "productId": "prod-123",
  "scenarios": [
    {
      "name": "Знижка 20%",
      "priceChange": -20,
      "promotionDays": 7
    },
    {
      "name": "Збільшення реклами",
      "marketingBudget": 5000
    }
  ]
}
```

**Response (200):**
```json
{
  "productId": "prod-123",
  "results": [
    {
      "scenarioName": "Знижка 20%",
      "expectedSales": 450,
      "expectedRevenue": 360000,
      "roi": 1.8,
      "confidence": 0.82
    },
    {
      "scenarioName": "Збільшення реклами",
      "expectedSales": 380,
      "expectedRevenue": 475000,
      "roi": 2.1,
      "confidence": 0.75
    }
  ],
  "recommendation": "Знижка 20%"
}
```

---

## Коди помилок

### HTTP Status Codes

| Код | Значення | Опис |
|-----|----------|------|
| 200 | OK | Успішний запит |
| 201 | Created | Ресурс створено |
| 400 | Bad Request | Невалідні дані запиту |
| 401 | Unauthorized | Не автентифіковано |
| 403 | Forbidden | Немає доступу |
| 404 | Not Found | Ресурс не знайдено |
| 409 | Conflict | Конфлікт (дублікат) |
| 422 | Unprocessable Entity | Невалідні дані |
| 429 | Too Many Requests | Перевищено ліміт запитів |
| 500 | Internal Server Error | Внутрішня помилка сервера |
| 503 | Service Unavailable | Сервіс недоступний |

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "fieldName",
    "message": "Detailed error message"
  }
}
```

### Common Error Codes

| Код | Опис |
|-----|------|
| `INVALID_REQUEST` | Невалідний запит |
| `AUTHENTICATION_FAILED` | Помилка автентифікації |
| `INSUFFICIENT_PERMISSIONS` | Недостатньо прав |
| `RESOURCE_NOT_FOUND` | Ресурс не знайдено |
| `DUPLICATE_RESOURCE` | Дублікат ресурсу |
| `VALIDATION_ERROR` | Помилка валідації |
| `RATE_LIMIT_EXCEEDED` | Перевищено ліміт запитів |
| `EXTERNAL_SERVICE_ERROR` | Помилка зовнішнього сервісу |
| `DATABASE_ERROR` | Помилка бази даних |

---

## Rate Limiting

### Ліміти за замовчуванням:

- **Supplier API:** 100 запитів/хвилину
- **B2B API:** 60 запитів/хвилину
- **Admin API:** 120 запитів/хвилину
- **Public API:** 30 запитів/хвилину

### Headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702555200
```

---

Створено: 2025-12-14
Версія: 1.0
