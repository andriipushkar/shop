# API Reference

## Core Service (Port 8080)

### Health Check
```http
GET /health
```
**Response:** `200 OK` - `"OK"`

### Products

#### Create Product
```http
POST /products
Content-Type: application/json

{
  "name": "Product Name",
  "price": 99.99,
  "sku": "SKU-001",
  "category_id": "category-uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Product Name",
  "price": 99.99,
  "sku": "SKU-001",
  "stock": 0,
  "category_id": "category-uuid",
  "created_at": "2025-12-05T12:00:00Z"
}
```

#### List Products
```http
GET /products
GET /products?search=phone
GET /products?category_id=uuid
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Product",
    "price": 99.99,
    "sku": "SKU-001",
    "stock": 10,
    "category": {"id": "uuid", "name": "Category"}
  }
]
```

#### Get Product
```http
GET /products/{id}
```

#### Update Stock
```http
PATCH /products/{id}/stock
Content-Type: application/json

{"stock": 50}
```

#### Update Image
```http
PATCH /products/{id}/image
Content-Type: application/json

{"image_url": "https://example.com/image.jpg"}
```

#### Decrement Stock
```http
POST /products/{id}/decrement
Content-Type: application/json

{"quantity": 1}
```

#### Delete Product
```http
DELETE /products/{id}
```

#### Get Price History
```http
GET /products/{id}/price-history
```

**Response:** `200 OK`
```json
[
  {
    "id": "ph-uuid",
    "product_id": "product-uuid",
    "old_price": 1000.00,
    "new_price": 899.99,
    "changed_at": "2025-12-09T14:30:00Z"
  },
  {
    "id": "ph-uuid-2",
    "product_id": "product-uuid",
    "old_price": 1200.00,
    "new_price": 1000.00,
    "changed_at": "2025-12-08T10:00:00Z"
  }
]
```

**Note:** Історія цін записується автоматично при оновленні товару через PUT /products/{id}, якщо ціна змінилася.

#### Get Latest Price Change
```http
GET /products/{id}/latest-price-change
```

**Response:** `200 OK`
```json
{
  "id": "ph-uuid",
  "product_id": "product-uuid",
  "old_price": 1000.00,
  "new_price": 899.99,
  "changed_at": "2025-12-09T14:30:00Z"
}
```

### Categories

#### List Categories
```http
GET /categories
```

#### Get Category
```http
GET /categories/{id}
```

#### Create Category
```http
POST /categories
Content-Type: application/json

{"name": "Electronics"}
```

#### Delete Category
```http
DELETE /categories/{id}
```

### Cart

#### Get Cart
```http
GET /cart/{user_id}
```

**Response:** `200 OK`
```json
[
  {
    "user_id": 123456789,
    "product_id": "product-uuid",
    "name": "iPhone 15",
    "price": 35000,
    "quantity": 2,
    "image_url": "https://example.com/img.jpg",
    "added_at": "2025-12-09T10:00:00Z"
  }
]
```

#### Add to Cart
```http
POST /cart/{user_id}
Content-Type: application/json

{
  "product_id": "product-uuid",
  "quantity": 1
}
```

**Response:** `201 Created`

**Note:** Якщо товар вже в кошику, кількість збільшується.

#### Update Cart Item Quantity
```http
PATCH /cart/{user_id}/item/{product_id}
Content-Type: application/json

{"quantity": 3}
```

**Response:** `200 OK`

#### Remove from Cart
```http
DELETE /cart/{user_id}/item/{product_id}
```

**Response:** `204 No Content`

#### Clear Cart
```http
DELETE /cart/{user_id}
```

**Response:** `204 No Content`

### Wishlist

#### Get Wishlist
```http
GET /wishlist/{user_id}
```

**Response:** `200 OK`
```json
[
  {
    "user_id": 123456789,
    "product_id": "product-uuid",
    "name": "iPhone 15",
    "price": 35000,
    "image_url": "https://example.com/img.jpg",
    "added_at": "2025-12-09T10:00:00Z"
  }
]
```

#### Add to Wishlist
```http
POST /wishlist/{user_id}
Content-Type: application/json

{
  "product_id": "product-uuid"
}
```

**Response:** `201 Created`

**Note:** Повторне додавання того ж товару ігнорується (ON CONFLICT DO NOTHING).

#### Check if Product in Wishlist
```http
GET /wishlist/{user_id}/item/{product_id}
```

**Response:** `200 OK`
```json
{
  "in_wishlist": true
}
```

#### Remove from Wishlist
```http
DELETE /wishlist/{user_id}/item/{product_id}
```

**Response:** `204 No Content`

#### Clear Wishlist
```http
DELETE /wishlist/{user_id}
```

**Response:** `204 No Content`

#### Move Item to Cart
```http
POST /wishlist/{user_id}/item/{product_id}/to-cart
```

**Response:** `200 OK`

**Note:** Переміщує товар зі списку бажань до кошика (кількість = 1) та видаляє зі списку бажань.

---

## OMS Service (Port 8081)

### Health Check
```http
GET /health
```
**Response:** `200 OK` - `"OK"`

### Orders

#### Create Order
```http
POST /orders
Content-Type: application/json

{
  "product_id": "product-uuid",
  "quantity": 1,
  "user_id": 123456789,
  "phone": "+380991234567",
  "address": "Київ, вул. Хрещатик 1"
}
```

**Response:** `201 Created`
```json
{
  "id": "ORD-1234567890",
  "product_id": "product-uuid",
  "product_name": "iPhone 15",
  "quantity": 1,
  "status": "NEW",
  "user_id": 123456789,
  "phone": "+380991234567",
  "address": "Київ, вул. Хрещатик 1",
  "created_at": "2025-12-05T12:00:00Z"
}
```

#### List Orders (Admin)
```http
GET /orders
```

#### Get User Orders
```http
GET /orders/user/{user_id}
```

#### Get Order by ID
```http
GET /orders/{id}
```

#### Update Order Status
```http
PATCH /orders/{id}
Content-Type: application/json

{"status": "PROCESSING"}
```

**Valid statuses:** `NEW`, `PROCESSING`, `DELIVERED`

**Status Transitions:**
- `NEW` → `PROCESSING` ✅
- `NEW` → `DELIVERED` ✅
- `PROCESSING` → `DELIVERED` ✅
- `DELIVERED` → `NEW` ❌
- `DELIVERED` → `PROCESSING` ❌

#### Update Tracking
```http
PATCH /orders/{id}/tracking
Content-Type: application/json

{
  "tracking_num": "NP20450123456789",
  "delivery_note": "Нова Пошта, відділення 5"
}
```

### Statistics

#### Get Stats
```http
GET /stats
```

**Response:** `200 OK`
```json
{
  "total_orders": 150,
  "orders_by_status": {
    "NEW": 10,
    "PROCESSING": 25,
    "DELIVERED": 115
  },
  "top_products": [
    {"product_id": "uuid", "product_name": "iPhone 15", "total_sold": 50}
  ],
  "orders_today": 5,
  "orders_this_week": 30,
  "orders_this_month": 150
}
```

### Promo Codes

#### List Promo Codes
```http
GET /promo
```

**Response:** `200 OK`
```json
[
  {
    "code": "SALE20",
    "discount": 20,
    "max_uses": 100,
    "used_count": 15,
    "active": true
  }
]
```

#### Create Promo Code
```http
POST /promo
Content-Type: application/json

{
  "code": "SALE20",
  "discount": 20,
  "max_uses": 100
}
```

**Response:** `201 Created`

**Validation:**
- `code` - required, non-empty
- `discount` - required, 0 < discount <= 100
- `max_uses` - optional, default unlimited

#### Validate Promo Code
```http
POST /promo/validate
Content-Type: application/json

{"code": "SALE20"}
```

**Response:** `200 OK`
```json
{
  "valid": true,
  "discount": 20
}
```

---

## CRM Service (Port 8082)

### Health Check
```http
GET /health
```
**Response:** `200 OK` - `"OK"`

### Customers

#### Register/Update Customer
```http
POST /customers
Content-Type: application/json

{
  "telegram_id": 123456789,
  "first_name": "Іван",
  "last_name": "Петренко"
}
```

**Response:** `200 OK`
```json
{
  "id": "CUST-123456789",
  "telegram_id": 123456789,
  "first_name": "Іван",
  "last_name": "Петренко",
  "created_at": "2025-12-05T12:00:00Z",
  "updated_at": "2025-12-05T12:00:00Z"
}
```

---

## RabbitMQ Events

### order.created
Published when a new order is created.
```json
{
  "id": "ORD-123",
  "product_id": "uuid",
  "product_name": "iPhone 15",
  "quantity": 1,
  "status": "NEW",
  "user_id": 123456789
}
```

### order.status.updated
Published when order status changes.
```json
{
  "id": "ORD-123",
  "product_id": "uuid",
  "product_name": "iPhone 15",
  "quantity": 1,
  "status": "DELIVERED",
  "user_id": 123456789
}
```

---

## Telegram Bot Commands

### User Commands

| Command | Description |
|---------|-------------|
| `/start` | Привітання та показ головного меню |
| `/products` | Список товарів з пагінацією |
| `/categories` | Перегляд категорій |
| `/search [запит]` | Пошук товарів |
| `/cart` | Перегляд кошика |
| `/myorders` | Мої замовлення з трекінгом |
| `/info` | Довідка по командах |

### Admin Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/orders` | Керування замовленнями | `/orders` |
| `/create` | Створити товар | `/create Laptop 1200 LPT-001` |
| `/stock` | Встановити залишок | `/stock product-uuid 50` |
| `/setimage` | Встановити фото товару | `/setimage product-uuid https://example.com/img.jpg` |
| `/track` | Трекінг доставки | `/track ORD-123 NP20450123 Нова Пошта` |
| `/stats` | Статистика продажів | `/stats` |
| `/promo` | Список промокодів | `/promo` |
| `/newpromo` | Створити промокод | `/newpromo SALE20 20 100` |
| `/import` | Імпорт товарів з CSV | `/import` + надіслати файл |
| `/export` | Експорт замовлень в CSV | `/export` |
| `/newcat` | Створити категорію | `/newcat Електроніка` |
| `/delcat` | Видалити категорію | `/delcat category-uuid` |

### Menu Buttons

Головне меню (ReplyKeyboard):
- 🛍 Товари
- 📁 Категорії
- 🔍 Пошук
- 🛒 Кошик
- 📦 Мої замовлення
- ℹ️ Допомога

### Product Card Buttons

- 🛒 В кошик - додати товар в кошик
- 💳 Купити - швидка покупка
- 🔔 Повідомити - підписка на товар (якщо немає в наявності)
- ⭐ Відгук - залишити відгук

### Checkout Flow (FSM)

1. Користувач натискає "✅ Оформити замовлення" в кошику
2. Бот запитує номер телефону
3. Бот запитує адресу доставки (або локацію 📍)
4. Показує підсумок для підтвердження
5. Створює замовлення в OMS

### Review Flow (FSM)

1. Користувач натискає "⭐ Відгук" на картці товару
2. Бот показує існуючі відгуки та середню оцінку
3. Користувач обирає рейтинг (1-5 зірок)
4. Користувач пише коментар
5. Відгук зберігається

### Subscription Feature

Якщо товар закінчився:
1. Користувач натискає "🔔 Повідомити"
2. Коли адмін поповнює залишок через `/stock`
3. Всі підписані користувачі отримують сповіщення

### Notifications

Notification Service надсилає повідомлення користувачам:

**При створенні замовлення:**
```
✅ Ваше замовлення ORD-123 прийнято!

📦 Товар: iPhone 15
📊 Кількість: 1
```

**При зміні статусу:**
```
⏳ Статус замовлення ORD-123 змінено на: PROCESSING

📦 Товар: iPhone 15
```

**При відправленні (трекінг):**
```
📦 Ваше замовлення відправлено!

🔖 Номер: ORD-123
📮 Трекінг: NP20450123456789
📝 Нова Пошта, відділення 5
```

**При поповненні залишку (для підписаних):**
```
🔔 Товар знову в наявності!

📦 iPhone 15

Поспішайте замовити!
```

**Адміну при новому замовленні:**
```
🆕 Нове замовлення!

🔖 ID: ORD-123
📦 Товар: iPhone 15
📊 Кількість: 1
👤 User ID: 123456789
📱 Телефон: +380991234567
📍 Адреса: Київ, вул. Хрещатик 1
```

---

## Import/Export

### CSV Import Format

Для імпорту товарів використовуйте команду `/import` та надішліть CSV файл.

**Формат файлу:**
```csv
name,price,sku,stock,category_id
iPhone 15,35000,IP15-001,10,
MacBook Pro,75000,MBP-001,5,category-uuid
AirPods,8000,AP-001,20,
```

**Поля:**
| Поле | Обов'язкове | Опис |
|------|-------------|------|
| name | ✅ | Назва товару |
| price | ✅ | Ціна (число) |
| sku | ✅ | Унікальний артикул |
| stock | ❌ | Кількість на складі (за замовч. 0) |
| category_id | ❌ | UUID категорії |

### CSV Export Format

Команда `/export` генерує CSV файл з усіма замовленнями.

**Формат файлу:**
```csv
ID,Product,Quantity,Status,Phone,Address,Tracking,Created
ORD-123,iPhone 15,1,NEW,+380991234567,Київ,NP123,2025-12-08T10:00:00Z
```

---

## Testing

### Unit Tests

Запуск тестів для окремих сервісів:

```bash
# Core Service
cd services/core && go test -v ./...

# OMS Service
cd services/oms && go test -v ./...

# Telegram Bot
cd services/telegram-bot && go test -v ./...

# CRM Service
cd services/crm && go test -v ./...

# Notification Service
cd services/notification && go test -v ./...
```

### Integration Tests

```bash
# Потребує запущених сервісів
go test -v -tags=integration ./tests/...
```

### Coverage

```bash
# Генерація HTML звітів
./scripts/coverage.sh

# Або через Makefile
make coverage
```

---

## Caching

Core Service використовує Redis для кешування. Відповіді для списків товарів та категорій кешуються автоматично.

### Cache Headers

Рекомендовані заголовки для клієнтів:

```http
Cache-Control: no-cache
```

### Cache TTL

| Endpoint | TTL |
|----------|-----|
| `GET /products` | 2 хв |
| `GET /products/{id}` | 5 хв |
| `GET /categories` | 2 хв |
| `GET /categories/{id}` | 5 хв |
| `GET /cart/{user_id}` | Не кешується |

### Cache Invalidation

Кеш автоматично інвалідується при модифікаціях:
- `POST /products` → очищує список товарів
- `PATCH /products/{id}/*` → очищує товар та список
- `DELETE /products/{id}` → очищує товар та список
- Аналогічно для категорій

---

## Error Responses

Всі сервіси повертають помилки у форматі:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**
- `400 Bad Request` - невалідний запит
- `404 Not Found` - ресурс не знайдено
- `500 Internal Server Error` - внутрішня помилка сервера

---

## Environment Variables

### Core Service

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 8080 |
| `DATABASE_URL` | PostgreSQL connection string | required |
| `REDIS_URL` | Redis connection string | optional |

### OMS Service

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 8081 |
| `DATABASE_URL` | PostgreSQL connection string | required |
| `RABBITMQ_URL` | RabbitMQ connection string | required |
| `CORE_SERVICE_URL` | Core service URL | required |

### Telegram Bot

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | required |
| `CORE_SERVICE_URL` | Core service URL | required |
| `OMS_SERVICE_URL` | OMS service URL | required |
| `CRM_SERVICE_URL` | CRM service URL | optional |
| `ADMIN_IDS` | Comma-separated admin Telegram IDs | required |
