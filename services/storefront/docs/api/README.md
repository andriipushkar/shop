# Storefront API Documentation

Повна документація REST API для інтернет-магазину з підтримкою адміністративних функцій, управління замовленнями, продуктами та користувачами.

## Зміст

- [Огляд API](#огляд-api)
- [Автентифікація](#автентифікація)
- [Обмеження швидкості запитів](#обмеження-швидкості-запитів)
- [Формат відповідей](#формат-відповідей)
- [Коди помилок](#коди-помилок)
- [Основні ендпоінти](#основні-ендпоінти)
- [Адміністративні ендпоінти](#адміністративні-ендпоінти)
- [Приклади використання](#приклади-використання)
- [Інтерактивна документація](#інтерактивна-документація)

## Огляд API

Storefront API побудований на основі REST архітектури і використовує стандартні HTTP методи:

- `GET` - отримання ресурсів
- `POST` - створення нових ресурсів
- `PUT` - оновлення існуючих ресурсів
- `DELETE` - видалення ресурсів

### Базові URL

- **Development:** `http://localhost:3000`
- **Production:** `https://api.example.com`

### Особливості

- ✅ Пагінація для великих колекцій
- ✅ Фільтрація та сортування
- ✅ Кешування відповідей (Redis)
- ✅ Підтримка Unicode (українська мова)
- ✅ JWT автентифікація для адмінських ендпоінтів
- ✅ Валідація даних на рівні API

## Автентифікація

### Публічні ендпоінти

Більшість публічних ендпоінтів (продукти, категорії, пошук) не вимагають автентифікації:

```bash
curl -X GET "http://localhost:3000/api/products"
```

### Адміністративні ендпоінти

Для доступу до адміністративних ендпоінтів потрібен JWT токен, отриманий через NextAuth:

```bash
curl -X GET "http://localhost:3000/api/admin/products" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Отримання токену

1. Автентифікація через NextAuth:

```bash
POST /api/auth/signin
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your_password"
}
```

2. Використання токену в запитах:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Ролі користувачів

API підтримує наступні ролі:

- **CUSTOMER** - звичайний покупець (доступ до публічних API)
- **ADMIN** - повний доступ до всіх ендпоінтів
- **MANAGER** - управління продуктами, категоріями, замовленнями
- **WAREHOUSE** - управління інвентарем та замовленнями
- **SUPPORT** - перегляд замовлень та клієнтів

## Обмеження швидкості запитів

Для захисту API від зловживань діють наступні обмеження:

### Публічні ендпоінти

- **Ліміт:** 100 запитів на хвилину з одного IP
- **Заголовки відповіді:**
  - `X-RateLimit-Limit` - максимальна кількість запитів
  - `X-RateLimit-Remaining` - залишилось запитів
  - `X-RateLimit-Reset` - час скидання ліміту (Unix timestamp)

### Адміністративні ендпоінти

- **Ліміт:** 300 запитів на хвилину для авторизованих користувачів

### При перевищенні ліміту

```json
{
  "error": "Too many requests, please try again later",
  "retryAfter": 60
}
```

HTTP статус: `429 Too Many Requests`

## Формат відповідей

### Успішні відповіді

#### Одиничний ресурс

```json
{
  "id": "clu123abc",
  "name": "Product Name",
  "price": 999.99,
  "status": "ACTIVE"
}
```

#### Колекція з пагінацією

```json
{
  "data": [
    { "id": "1", "name": "Product 1" },
    { "id": "2", "name": "Product 2" }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

### Кешування

API використовує Redis для кешування відповідей. Статус кешу вказується в заголовку:

```
X-Cache: HIT  # Дані з кешу
X-Cache: MISS # Дані з бази даних
```

Час кешування:

- Продукти: 5 хвилин
- Категорії: 1 година
- Результати пошуку: 2 хвилини

## Коди помилок

API використовує стандартні HTTP коди статусів:

### 2xx - Успіх

- **200 OK** - Запит виконано успішно
- **201 Created** - Ресурс створено
- **204 No Content** - Запит виконано, немає даних для відповіді

### 4xx - Помилки клієнта

- **400 Bad Request** - Невалідні дані запиту
- **401 Unauthorized** - Не авторизовано
- **403 Forbidden** - Доступ заборонено
- **404 Not Found** - Ресурс не знайдено
- **409 Conflict** - Конфлікт (наприклад, дублікат SKU)
- **422 Unprocessable Entity** - Помилка валідації даних
- **429 Too Many Requests** - Перевищено ліміт запитів

### 5xx - Помилки сервера

- **500 Internal Server Error** - Внутрішня помилка сервера
- **503 Service Unavailable** - Сервіс тимчасово недоступний

### Формат помилок

```json
{
  "error": "Detailed error message in Ukrainian or English"
}
```

Приклад:

```json
{
  "error": "Product with this SKU already exists"
}
```

## Основні ендпоінти

### Продукти

#### Отримати список продуктів

```
GET /api/products
```

**Параметри запиту:**

| Параметр | Тип | Опис | За замовчуванням |
|----------|-----|------|------------------|
| page | integer | Номер сторінки | 1 |
| pageSize | integer | Розмір сторінки (max 100) | 20 |
| categoryId | string | Фільтр за категорією | - |
| brandId | string | Фільтр за брендом | - |
| minPrice | number | Мінімальна ціна | - |
| maxPrice | number | Максимальна ціна | - |
| isNew | boolean | Тільки нові товари | - |
| isBestseller | boolean | Тільки бестселери | - |
| isFeatured | boolean | Тільки рекомендовані | - |
| sort | string | Поле сортування (createdAt, price, name, soldCount, rating) | createdAt |
| order | string | Напрямок сортування (asc, desc) | desc |

**Приклад запиту:**

```bash
curl "http://localhost:3000/api/products?page=1&pageSize=20&categoryId=cat123&sort=price&order=asc"
```

**Приклад відповіді:**

```json
{
  "data": [
    {
      "id": "prod123",
      "sku": "SKU-001",
      "name": "Product Name",
      "nameUa": "Назва Продукту",
      "slug": "product-name",
      "price": 999.99,
      "compareAtPrice": 1299.99,
      "categoryId": "cat123",
      "brandId": "brand456",
      "status": "ACTIVE",
      "isNew": true,
      "isBestseller": false,
      "isFeatured": true,
      "rating": 4.5,
      "reviewCount": 23,
      "soldCount": 156,
      "viewCount": 1234,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

#### Отримати продукт за ID

```
GET /api/products/{id}
```

**Приклад:**

```bash
curl "http://localhost:3000/api/products/prod123"
```

#### Отримати рекомендовані продукти

```
GET /api/products/featured
```

### Категорії

#### Отримати категорії

```
GET /api/categories
```

**Параметри запиту:**

| Параметр | Тип | Опис | За замовчуванням |
|----------|-----|------|------------------|
| tree | boolean | Повернути у вигляді дерева | true |

**Приклад:**

```bash
curl "http://localhost:3000/api/categories?tree=true"
```

**Відповідь (дерево):**

```json
[
  {
    "id": "cat123",
    "name": "Electronics",
    "nameUa": "Електроніка",
    "slug": "electronics",
    "isActive": true,
    "order": 1,
    "children": [
      {
        "id": "cat456",
        "name": "Smartphones",
        "nameUa": "Смартфони",
        "slug": "smartphones",
        "parentId": "cat123",
        "isActive": true,
        "order": 1,
        "children": []
      }
    ]
  }
]
```

#### Отримати категорію за slug

```
GET /api/categories/{slug}
```

### Пошук

#### Пошук продуктів

```
GET /api/search
```

**Параметри запиту:**

| Параметр | Тип | Обов'язковий | Опис |
|----------|-----|--------------|------|
| q | string | Так | Пошуковий запит (мін. 2 символи) |
| page | integer | Ні | Номер сторінки |
| pageSize | integer | Ні | Розмір сторінки |
| categoryId | string | Ні | Фільтр за категорією |
| brandId | string | Ні | Фільтр за брендом |
| minPrice | number | Ні | Мінімальна ціна |
| maxPrice | number | Ні | Максимальна ціна |
| sort | string | Ні | relevance, price, name, rating, newest, bestselling |

**Приклад:**

```bash
curl "http://localhost:3000/api/search?q=smartphone&categoryId=cat123&minPrice=5000&maxPrice=15000"
```

#### Підказки для пошуку

```
GET /api/search/suggestions
```

**Приклад:**

```bash
curl "http://localhost:3000/api/search/suggestions?q=smart&limit=10"
```

**Відповідь:**

```json
["smartphone", "smart watch", "smart tv", "smart home"]
```

### Кошик

#### Отримати кошик

```
GET /api/cart/{userId}
```

#### Додати товар до кошика

```
POST /api/cart/{userId}
```

**Тіло запиту:**

```json
{
  "productId": "prod123",
  "variantId": "var456",
  "quantity": 2
}
```

#### Видалити товар з кошика

```
DELETE /api/cart/{userId}/item/{productId}
```

#### Очистити кошик

```
DELETE /api/cart/{userId}
```

### Замовлення

#### Створити замовлення

```
POST /api/orders
```

**Тіло запиту:**

```json
{
  "customerEmail": "customer@example.com",
  "customerPhone": "+380501234567",
  "customerName": "Іван Петренко",
  "userId": "user123",
  "addressId": "addr456",
  "shippingMethod": "nova_poshta",
  "paymentMethod": "liqpay",
  "shippingCost": 50,
  "discount": 100,
  "notes": "Дзвонити після 18:00",
  "items": [
    {
      "productId": "prod123",
      "variantId": "var456",
      "sku": "SKU-001",
      "name": "Product Name",
      "price": 999.99,
      "quantity": 2,
      "discount": 0
    }
  ]
}
```

## Адміністративні ендпоінти

Всі адміністративні ендпоінти вимагають JWT автентифікації через заголовок `Authorization: Bearer {token}`.

### Продукти (Адмін)

#### Отримати всі продукти

```
GET /api/admin/products
```

**Підтримує фільтрацію за:**
- search (назва або SKU)
- categoryId
- brandId
- status (DRAFT, ACTIVE, ARCHIVED, OUT_OF_STOCK)

#### Створити продукт

```
POST /api/admin/products
```

**Тіло запиту:**

```json
{
  "name": "New Product",
  "nameUa": "Новий Продукт",
  "sku": "SKU-NEW-001",
  "slug": "new-product",
  "description": "Product description",
  "descriptionUa": "Опис продукту",
  "price": 1299.99,
  "compareAtPrice": 1599.99,
  "costPrice": 800,
  "categoryId": "cat123",
  "brandId": "brand456",
  "status": "DRAFT",
  "isNew": true,
  "isBestseller": false,
  "isFeatured": false,
  "weight": 0.5,
  "length": 20,
  "width": 15,
  "height": 5,
  "metaTitle": "New Product - Buy Online",
  "metaDescription": "Buy new product at best price"
}
```

#### Оновити продукт

```
PUT /api/admin/products/{id}
```

#### Видалити продукт

```
DELETE /api/admin/products/{id}
```

### Категорії (Адмін)

#### Отримати всі категорії

```
GET /api/admin/categories
```

**Параметри:**
- tree (boolean) - повернути дерево
- includeInactive (boolean) - включити неактивні

#### Створити категорію

```
POST /api/admin/categories
```

**Тіло запиту:**

```json
{
  "name": "New Category",
  "nameUa": "Нова Категорія",
  "slug": "new-category",
  "description": "Category description",
  "image": "https://example.com/image.jpg",
  "parentId": "cat123",
  "order": 10,
  "isActive": true
}
```

#### Оновити категорію

```
PUT /api/admin/categories/{id}
```

#### Видалити категорію

```
DELETE /api/admin/categories/{id}
```

### Замовлення (Адмін)

#### Отримати всі замовлення

```
GET /api/admin/orders
```

**Підтримує фільтрацію за:**
- search (номер замовлення, ім'я клієнта)
- status (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, RETURNED)
- paymentStatus
- shippingStatus
- marketplace
- dateFrom, dateTo

#### Отримати статистику замовлень

```
GET /api/admin/orders/stats
```

**Відповідь:**

```json
{
  "total": 1523,
  "pending": 45,
  "processing": 89,
  "completed": 1234,
  "cancelled": 155,
  "totalRevenue": 1567890.50,
  "averageOrderValue": 1029.45
}
```

#### Створити замовлення вручну

```
POST /api/admin/orders
```

#### Оновити замовлення

```
PUT /api/admin/orders/{id}
```

**Тіло запиту:**

```json
{
  "status": "SHIPPED",
  "paymentStatus": "PAID",
  "shippingStatus": "IN_TRANSIT",
  "trackingNumber": "59001234567890",
  "adminNotes": "Shipped via Nova Poshta"
}
```

### Клієнти (Адмін)

#### Отримати всіх клієнтів

```
GET /api/admin/customers
```

**Підтримує фільтрацію за:**
- search (email, телефон, ім'я)
- role
- isVerified
- isActive

#### Створити клієнта

```
POST /api/admin/customers
```

**Тіло запиту:**

```json
{
  "email": "newcustomer@example.com",
  "password": "SecurePassword123",
  "firstName": "Олександр",
  "lastName": "Коваленко",
  "phone": "+380501234567",
  "role": "CUSTOMER"
}
```

#### Оновити клієнта

```
PUT /api/admin/customers/{id}
```

#### Видалити клієнта

```
DELETE /api/admin/customers/{id}
```

## Приклади використання

### Приклад 1: Отримати продукти з фільтрацією

```javascript
// JavaScript/TypeScript
const response = await fetch(
  'http://localhost:3000/api/products?categoryId=electronics&minPrice=1000&maxPrice=5000&sort=price&order=asc',
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }
);

const data = await response.json();
console.log(data);
```

### Приклад 2: Пошук продуктів

```javascript
const searchQuery = 'smartphone';
const response = await fetch(
  `http://localhost:3000/api/search?q=${encodeURIComponent(searchQuery)}&page=1&pageSize=20`,
  {
    method: 'GET',
  }
);

const results = await response.json();
console.log(`Знайдено ${results.total} продуктів`);
```

### Приклад 3: Створити замовлення

```javascript
const orderData = {
  customerEmail: 'customer@example.com',
  customerPhone: '+380501234567',
  customerName: 'Іван Петренко',
  shippingMethod: 'nova_poshta',
  paymentMethod: 'liqpay',
  items: [
    {
      productId: 'prod123',
      sku: 'SKU-001',
      name: 'Smartphone XYZ',
      price: 9999.99,
      quantity: 1,
    },
  ],
};

const response = await fetch('http://localhost:3000/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(orderData),
});

const order = await response.json();
console.log('Замовлення створено:', order.orderNumber);
```

### Приклад 4: Додати товар до кошика

```javascript
const userId = 'user123';
const cartItem = {
  productId: 'prod456',
  quantity: 2,
};

const response = await fetch(`http://localhost:3000/api/cart/${userId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(cartItem),
});

const result = await response.json();
```

### Приклад 5: Створити продукт (адмін)

```javascript
const token = 'your_jwt_token_here';

const productData = {
  name: 'New Laptop',
  nameUa: 'Новий Ноутбук',
  sku: 'LAPTOP-001',
  slug: 'new-laptop-2025',
  price: 25999.99,
  categoryId: 'cat-laptops',
  status: 'ACTIVE',
};

const response = await fetch('http://localhost:3000/api/admin/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(productData),
});

const product = await response.json();
```

### Приклад 6: Оновити статус замовлення (адмін)

```javascript
const token = 'your_jwt_token_here';
const orderId = 'order123';

const updateData = {
  status: 'SHIPPED',
  shippingStatus: 'IN_TRANSIT',
  trackingNumber: '59001234567890',
};

const response = await fetch(`http://localhost:3000/api/admin/orders/${orderId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(updateData),
});
```

## Інтерактивна документація

Для зручності тестування API доступний Swagger UI інтерфейс:

### Локальна розробка

```
http://localhost:3000/api-docs
```

### Production

```
https://your-domain.com/api-docs
```

### Можливості Swagger UI

- Перегляд всіх ендпоінтів та їх параметрів
- Інтерактивне тестування запитів
- Перегляд схем запитів/відповідей
- Автоматична валідація даних
- Експорт OpenAPI специфікації

## Додаткові ресурси

- [OpenAPI Specification (JSON)](/api/docs) - Повна специфікація у форматі JSON
- [Prisma Schema](../../prisma/schema.prisma) - Схема бази даних
- [NextAuth Documentation](https://next-auth.js.org/) - Документація по автентифікації

## Підтримка

Для питань та підтримки звертайтесь:

- **Email:** support@example.com
- **GitHub Issues:** [github.com/yourorg/yourrepo/issues](https://github.com/yourorg/yourrepo/issues)

## Changelog

### v1.0.0 (2025-01-15)

- Початковий реліз API
- Публічні ендпоінти для продуктів, категорій, пошуку
- Адміністративні ендпоінти для управління
- JWT автентифікація
- Swagger UI документація
- Кешування відповідей
- Rate limiting
