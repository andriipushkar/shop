# Postman Collection

Колекція Postman для тестування Shop Platform API.

## Імпорт колекції

### Варіант 1: З файлу

1. Завантажте файл `Shop_Platform.postman_collection.json`
2. В Postman: **Import** → **Upload Files** → виберіть файл
3. Імпортуйте environment `Shop_Platform.postman_environment.json`

### Варіант 2: З URL

```
https://api.yourstore.com/docs/postman/collection.json
```

---

## Environment Variables

Створіть environment з наступними змінними:

| Variable | Initial Value | Description |
|----------|--------------|-------------|
| `base_url` | `http://localhost:8080/api/v1` | Base URL API |
| `access_token` | | JWT access token |
| `refresh_token` | | JWT refresh token |
| `admin_token` | | Admin JWT token |
| `customer_id` | | ID поточного користувача |
| `product_id` | | ID тестового товару |
| `order_id` | | ID тестового замовлення |
| `cart_id` | | ID кошика |

---

## Колекція

### Структура

```
Shop Platform API/
├── Auth/
│   ├── Register
│   ├── Login
│   ├── Refresh Token
│   ├── Get Current User
│   └── Logout
├── Products/
│   ├── List Products
│   ├── Get Product
│   ├── Create Product (Admin)
│   ├── Update Product (Admin)
│   ├── Delete Product (Admin)
│   └── Get Product Variants
├── Categories/
│   ├── List Categories
│   ├── Get Category
│   ├── Get Category Products
│   └── Create Category (Admin)
├── Cart/
│   ├── Get Cart
│   ├── Add Item
│   ├── Update Item Quantity
│   ├── Remove Item
│   ├── Apply Promo Code
│   └── Clear Cart
├── Orders/
│   ├── List Orders
│   ├── Get Order
│   ├── Create Order
│   ├── Cancel Order
│   └── Pay Order
├── Delivery/
│   ├── Search Cities
│   ├── Get Warehouses
│   ├── Calculate Delivery
│   └── Track Shipment
├── Search/
│   ├── Search Products
│   └── Search Suggestions
└── Admin/
    ├── Dashboard Stats
    ├── List All Orders
    └── Update Order Status
```

---

## Pre-request Scripts

### Auto-refresh токена

Додайте цей скрипт до Collection Pre-request Script:

```javascript
// Перевірка та оновлення токена
const accessToken = pm.environment.get("access_token");
const tokenExpiry = pm.environment.get("token_expiry");

if (accessToken && tokenExpiry) {
    const now = Date.now();
    const expiry = parseInt(tokenExpiry);

    // Якщо токен закінчується через 5 хвилин - оновлюємо
    if (expiry - now < 5 * 60 * 1000) {
        const refreshToken = pm.environment.get("refresh_token");

        if (refreshToken) {
            pm.sendRequest({
                url: pm.environment.get("base_url") + "/auth/refresh",
                method: "POST",
                header: {
                    "Content-Type": "application/json"
                },
                body: {
                    mode: "raw",
                    raw: JSON.stringify({ refresh_token: refreshToken })
                }
            }, function(err, res) {
                if (!err && res.code === 200) {
                    const data = res.json();
                    pm.environment.set("access_token", data.access_token);
                    pm.environment.set("refresh_token", data.refresh_token);
                    pm.environment.set("token_expiry", Date.now() + (data.expires_in * 1000));
                }
            });
        }
    }
}
```

---

## Request Examples

### Auth

#### Register

```http
POST {{base_url}}/auth/register
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "Тест Користувач",
    "phone": "+380501234567"
}
```

**Tests:**

```javascript
pm.test("Status code is 201", function() {
    pm.response.to.have.status(201);
});

pm.test("Response has tokens", function() {
    const data = pm.response.json();
    pm.expect(data).to.have.property("access_token");
    pm.expect(data).to.have.property("refresh_token");

    // Зберігаємо токени
    pm.environment.set("access_token", data.access_token);
    pm.environment.set("refresh_token", data.refresh_token);
    pm.environment.set("customer_id", data.user.id);
});
```

#### Login

```http
POST {{base_url}}/auth/login
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "securePassword123"
}
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Save tokens", function() {
    const data = pm.response.json();
    pm.environment.set("access_token", data.access_token);
    pm.environment.set("refresh_token", data.refresh_token);
    pm.environment.set("token_expiry", Date.now() + (data.expires_in * 1000));
    pm.environment.set("customer_id", data.user.id);
});
```

---

### Products

#### List Products

```http
GET {{base_url}}/products?page=1&limit=20&sort=price_asc
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Response has items array", function() {
    const data = pm.response.json();
    pm.expect(data.items).to.be.an("array");
    pm.expect(data.pagination).to.exist;

    // Зберігаємо перший product_id
    if (data.items.length > 0) {
        pm.environment.set("product_id", data.items[0].id);
    }
});
```

#### Get Product

```http
GET {{base_url}}/products/{{product_id}}
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Product has required fields", function() {
    const data = pm.response.json();
    pm.expect(data).to.have.property("id");
    pm.expect(data).to.have.property("name");
    pm.expect(data).to.have.property("price");
    pm.expect(data).to.have.property("sku");
});
```

#### Create Product (Admin)

```http
POST {{base_url}}/products
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
    "name": "Новий товар",
    "name_uk": "Новий товар",
    "description": "Опис товару",
    "sku": "SKU-12345",
    "price": 99900,
    "category_id": "{{category_id}}",
    "brand": "Brand Name",
    "stock": 100,
    "images": [
        "https://cdn.example.com/image1.jpg",
        "https://cdn.example.com/image2.jpg"
    ],
    "attributes": [
        {"name": "Колір", "value": "Чорний"},
        {"name": "Розмір", "value": "M"}
    ]
}
```

---

### Cart

#### Get Cart

```http
GET {{base_url}}/cart
Authorization: Bearer {{access_token}}
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Cart structure is valid", function() {
    const data = pm.response.json();
    pm.expect(data).to.have.property("items");
    pm.expect(data).to.have.property("total");
    pm.environment.set("cart_id", data.id);
});
```

#### Add Item to Cart

```http
POST {{base_url}}/cart/items
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
    "product_id": "{{product_id}}",
    "quantity": 2
}
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Item was added", function() {
    const data = pm.response.json();
    pm.expect(data.items.length).to.be.above(0);

    // Зберігаємо cart_item_id
    pm.environment.set("cart_item_id", data.items[0].id);
});
```

#### Update Item Quantity

```http
PUT {{base_url}}/cart/items/{{cart_item_id}}
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
    "quantity": 3
}
```

#### Apply Promo Code

```http
POST {{base_url}}/cart/promo
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
    "code": "DISCOUNT10"
}
```

**Tests:**

```javascript
pm.test("Promo code applied", function() {
    const data = pm.response.json();
    pm.expect(data.promo_code).to.equal("DISCOUNT10");
    pm.expect(data.discount).to.be.above(0);
});
```

---

### Orders

#### Create Order

```http
POST {{base_url}}/orders
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
    "customer": {
        "name": "Іван Петренко",
        "email": "ivan@example.com",
        "phone": "+380501234567"
    },
    "delivery": {
        "type": "nova_poshta",
        "city_ref": "8d5a980d-391c-11dd-90d9-001a92567626",
        "warehouse_ref": "1ec09d88-e1c2-11e3-8c4a-0050568002cf"
    },
    "payment_method": "online",
    "notes": "Зателефонуйте перед доставкою"
}
```

**Tests:**

```javascript
pm.test("Status code is 201", function() {
    pm.response.to.have.status(201);
});

pm.test("Order created", function() {
    const data = pm.response.json();
    pm.expect(data).to.have.property("id");
    pm.expect(data).to.have.property("number");
    pm.expect(data.status).to.equal("new");

    pm.environment.set("order_id", data.id);
});
```

#### Pay Order

```http
POST {{base_url}}/orders/{{order_id}}/pay
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
    "provider": "monobank"
}
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Payment URL returned", function() {
    const data = pm.response.json();
    pm.expect(data).to.have.property("payment_id");
    pm.expect(data).to.have.property("redirect_url");

    pm.environment.set("payment_url", data.redirect_url);
});
```

---

### Delivery

#### Search Cities

```http
GET {{base_url}}/delivery/cities?q=Київ
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Cities found", function() {
    const data = pm.response.json();
    pm.expect(data).to.be.an("array");

    if (data.length > 0) {
        pm.environment.set("city_ref", data[0].ref);
    }
});
```

#### Get Warehouses

```http
GET {{base_url}}/delivery/warehouses?city_ref={{city_ref}}
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Warehouses found", function() {
    const data = pm.response.json();
    pm.expect(data).to.be.an("array");

    if (data.length > 0) {
        pm.environment.set("warehouse_ref", data[0].ref);
    }
});
```

#### Calculate Delivery

```http
POST {{base_url}}/delivery/calculate
Content-Type: application/json

{
    "city_ref": "{{city_ref}}",
    "weight": 1.5,
    "service_type": "WarehouseWarehouse",
    "declared_value": 1000,
    "seats_amount": 1
}
```

---

### Search

#### Search Products

```http
GET {{base_url}}/search?q=телефон&page=1&limit=20
```

**Tests:**

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Search results structure", function() {
    const data = pm.response.json();
    pm.expect(data).to.have.property("items");
    pm.expect(data).to.have.property("total");
    pm.expect(data).to.have.property("filters");
});
```

#### Search with Filters

```http
GET {{base_url}}/search?q=телефон&filters[brand]=Apple&filters[price_min]=10000&filters[price_max]=50000
```

---

## Test Suites

### Smoke Tests

Базові тести для перевірки доступності API:

```javascript
// Collection-level test
pm.test("Response time is less than 500ms", function() {
    pm.expect(pm.response.responseTime).to.be.below(500);
});

pm.test("Content-Type is JSON", function() {
    pm.response.to.have.header("Content-Type", /application\/json/);
});
```

### E2E Order Flow

Повний цикл створення замовлення:

1. **Login** → отримати токен
2. **Get Products** → вибрати товар
3. **Add to Cart** → додати в кошик
4. **Apply Promo** → застосувати промокод
5. **Search Cities** → знайти місто
6. **Get Warehouses** → вибрати відділення
7. **Create Order** → створити замовлення
8. **Pay Order** → отримати URL оплати

---

## Newman (CLI)

### Встановлення

```bash
npm install -g newman
npm install -g newman-reporter-htmlextra
```

### Запуск тестів

```bash
# Базовий запуск
newman run Shop_Platform.postman_collection.json \
  -e Shop_Platform.postman_environment.json

# З HTML звітом
newman run Shop_Platform.postman_collection.json \
  -e Shop_Platform.postman_environment.json \
  -r htmlextra \
  --reporter-htmlextra-export ./reports/report.html

# Тільки певна папка
newman run Shop_Platform.postman_collection.json \
  -e Shop_Platform.postman_environment.json \
  --folder "Auth"

# З ітераціями
newman run Shop_Platform.postman_collection.json \
  -e Shop_Platform.postman_environment.json \
  -n 10
```

### CI/CD Integration

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  api-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Newman
        run: |
          npm install -g newman
          npm install -g newman-reporter-htmlextra

      - name: Start API server
        run: |
          docker-compose up -d
          sleep 30

      - name: Run API tests
        run: |
          newman run docs/api/Shop_Platform.postman_collection.json \
            -e docs/api/Shop_Platform.postman_environment.json \
            -r cli,htmlextra \
            --reporter-htmlextra-export ./reports/api-test-report.html

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: api-test-report
          path: ./reports/
```

---

## Monitors

### Налаштування в Postman

1. Перейдіть до колекції
2. **Monitors** → **Create a monitor**
3. Налаштуйте:
   - Schedule: Every 5 minutes
   - Environment: Production
   - Regions: Multiple regions

### Сповіщення

```javascript
// В Tests скрипті
if (pm.response.code !== 200) {
    // Postman автоматично надішле сповіщення
    // якщо тест провалиться
}

// Для custom метрик
pm.test("Response time SLA", function() {
    // SLA: 99% запитів < 500ms
    pm.expect(pm.response.responseTime).to.be.below(500);
});
```

---

## Mock Server

### Створення Mock Server

1. Збережіть приклади відповідей для кожного request
2. **Mock Servers** → **Create Mock Server**
3. Виберіть колекцію
4. Отримайте URL mock сервера

### Використання

```bash
# Замініть base_url на mock URL
base_url=https://abc123-mock.pstmn.io/api/v1
```

---

## Корисні посилання

- [Postman Learning Center](https://learning.postman.com/)
- [Newman Documentation](https://www.npmjs.com/package/newman)
- [Postman API](https://www.postman.com/postman/workspace/postman-public-workspace/documentation/12959542-c8142d51-e97c-46b6-bd77-52bb66712c9a)
