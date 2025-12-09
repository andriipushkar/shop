# Інструкція з ручного тестування

Детальна покрокова інструкція для тестування всіх модулів системи.

## Зміст

1. [Підготовка середовища](#підготовка-середовища)
2. [Автоматизовані тести](#автоматизовані-тести)
3. [Ручне тестування API](#ручне-тестування-api)
4. [Тестування інтеграцій](#тестування-інтеграцій)
5. [Чекліст тестування](#чекліст-тестування)

---

## Етап 1: Підготовка середовища

### 1.1 Встановлення залежностей

```bash
cd services/core
go mod download
```

### 1.2 Налаштування бази даних

```bash
# Запуск PostgreSQL через Docker
docker run -d \
  --name shop-postgres \
  -e POSTGRES_USER=shop \
  -e POSTGRES_PASSWORD=shop \
  -e POSTGRES_DB=shop_test \
  -p 5432:5432 \
  postgres:15

# Перевірка підключення
psql "postgres://shop:shop@localhost:5432/shop_test?sslmode=disable"
```

### 1.3 Запуск Redis

```bash
docker run -d \
  --name shop-redis \
  -p 6379:6379 \
  redis:7
```

### 1.4 Виконання міграцій

```bash
export DATABASE_URL="postgres://shop:shop@localhost:5432/shop_test?sslmode=disable"
migrate -path migrations -database "$DATABASE_URL" up
```

### 1.5 Налаштування .env

```bash
cat > .env << 'EOF'
DATABASE_URL=postgres://shop:shop@localhost:5432/shop_test?sslmode=disable
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-key-minimum-32-characters
PORT=8080

# Опціонально для тестування інтеграцій
NOVAPOSHTA_API_KEY=your-api-key
UKRPOSHTA_BEARER_TOKEN=your-token
SENDPULSE_CLIENT_ID=your-client-id
SENDPULSE_CLIENT_SECRET=your-secret
EOF
```

---

## Етап 2: Автоматизовані тести

### 2.1 Запуск всіх тестів

```bash
# Базовий запуск
go test ./...

# З покриттям
go test -cover ./...

# Детальний вивід
go test -v ./...

# Конкретний пакет
go test -v ./internal/auth/...
```

### 2.2 Запуск тестів з race detector

```bash
go test -race ./...
```

### 2.3 Benchmark тести

```bash
# Всі benchmark тести
go test -bench=. ./...

# Конкретний пакет
go test -bench=. ./internal/auth/...

# З результатами памʼяті
go test -bench=. -benchmem ./...
```

### 2.4 Генерація звіту покриття

```bash
# Генерація профілю
go test -coverprofile=coverage.out ./...

# Перегляд в терміналі
go tool cover -func=coverage.out

# HTML звіт
go tool cover -html=coverage.out -o coverage.html
```

### 2.5 Очікувані результати

| Пакет | Мінімальне покриття | Статус |
|-------|-------------------|--------|
| `auth` | 70%+ | ✅ |
| `inventory` | 80%+ | ✅ |
| `logistics` | Структури даних | ✅ |
| `email` | 5%+ | ✅ |

---

## Етап 3: Ручне тестування API

### 3.1 Запуск сервера

```bash
go run cmd/main.go
# Сервер запуститься на http://localhost:8080
```

### 3.2 Тестування автентифікації

#### Реєстрація користувача

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "first_name": "Тест",
    "last_name": "Користувач"
  }'
```

**Очікуваний результат:**
```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "role": "customer"
  },
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "Bearer",
    "expires_at": "..."
  }
}
```

#### Авторизація

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

#### Оновлення токенів

```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your-refresh-token"
  }'
```

### 3.3 Тестування товарів

#### Створення товару (потрібна роль admin/manager)

```bash
curl -X POST http://localhost:8080/api/v1/products \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовий товар",
    "slug": "test-product",
    "price": 999.99,
    "stock": 100,
    "sku": "TEST-001"
  }'
```

#### Отримання товарів

```bash
# Список товарів
curl http://localhost:8080/api/v1/products

# Конкретний товар
curl http://localhost:8080/api/v1/products/{id}

# Пошук
curl "http://localhost:8080/api/v1/products?search=тест"

# Фільтрація
curl "http://localhost:8080/api/v1/products?category_id=uuid&min_price=100&max_price=1000"
```

### 3.4 Тестування кошика

#### Додавання до кошика

```bash
curl -X POST http://localhost:8080/api/v1/cart/items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "product-uuid",
    "quantity": 2
  }'
```

#### Перегляд кошика

```bash
curl http://localhost:8080/api/v1/cart \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 3.5 Тестування замовлень

#### Створення замовлення

```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_method": "nova_poshta",
    "shipping_city": "Київ",
    "shipping_city_ref": "8d5a980d-391c-11dd-90d9-001a92567626",
    "shipping_warehouse": "Відділення №1",
    "payment_method": "cod"
  }'
```

#### Перегляд замовлень

```bash
# Список замовлень
curl http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Конкретне замовлення
curl http://localhost:8080/api/v1/orders/{order_number} \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## Етап 4: Тестування інтеграцій

### 4.1 Нова Пошта

#### Тест пошуку міст

```bash
# В коді тестів
go test -v -run TestSearchCities ./internal/logistics/...
```

#### Ручний тест API (потрібен реальний API ключ)

```bash
curl -X POST https://api.novaposhta.ua/v2.0/json/ \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "modelName": "Address",
    "calledMethod": "searchSettlements",
    "methodProperties": {
      "CityName": "Київ",
      "Limit": "5"
    }
  }'
```

### 4.2 Email (SendPulse)

```bash
# Тест з'єднання
go test -v -run TestSendPulseClient ./internal/email/...
```

### 4.3 Маркетплейси

```bash
# Rozetka
go test -v ./internal/marketplace/rozetka/...

# Prom.ua
go test -v ./internal/marketplace/prom/...
```

---

## Етап 5: Чекліст тестування

### 5.1 Автентифікація

- [ ] Реєстрація з email
- [ ] Реєстрація з телефоном
- [ ] Логін з email
- [ ] Логін з телефоном
- [ ] Оновлення токенів
- [ ] Логаут
- [ ] Зміна пароля
- [ ] Скидання пароля
- [ ] OAuth Google (якщо налаштовано)
- [ ] OAuth Facebook (якщо налаштовано)
- [ ] Перевірка ролей (customer, admin, manager)

### 5.2 Товари

- [ ] Створення товару
- [ ] Оновлення товару
- [ ] Видалення товару
- [ ] Пошук товарів
- [ ] Фільтрація за категорією
- [ ] Фільтрація за ціною
- [ ] Сортування
- [ ] Пагінація
- [ ] Завантаження зображень

### 5.3 Категорії

- [ ] Створення категорії
- [ ] Створення підкатегорії
- [ ] Оновлення категорії
- [ ] Видалення категорії
- [ ] Дерево категорій

### 5.4 Кошик

- [ ] Додавання товару
- [ ] Оновлення кількості
- [ ] Видалення товару
- [ ] Очищення кошика
- [ ] Кошик для гостя (session)
- [ ] Merge кошика при логіні

### 5.5 Замовлення

- [ ] Створення замовлення
- [ ] Перегляд замовлення
- [ ] Список замовлень
- [ ] Зміна статусу (admin)
- [ ] Скасування замовлення
- [ ] Історія статусів

### 5.6 Логістика

- [ ] Пошук міст Нової Пошти
- [ ] Пошук відділень
- [ ] Розрахунок вартості доставки
- [ ] Створення накладної
- [ ] Відстеження посилки
- [ ] Друк етикетки

### 5.7 Email

- [ ] Відправка підтвердження замовлення
- [ ] Відправка сповіщення про доставку
- [ ] Відправка скидання пароля
- [ ] Відправка вітального листа

### 5.8 Аналітика

- [ ] RFM аналіз
- [ ] ABC-XYZ аналіз
- [ ] Дашборд продажів

### 5.9 Експорт

- [ ] Експорт в CSV
- [ ] Експорт в Excel
- [ ] Експорт в JSON

---

## Типові помилки та їх вирішення

### Помилка підключення до БД

```
Error: dial tcp 127.0.0.1:5432: connect: connection refused
```

**Рішення:** Переконайтеся, що PostgreSQL запущено:
```bash
docker ps | grep postgres
# Якщо не запущено:
docker start shop-postgres
```

### Помилка JWT токена

```
Error: token is expired
```

**Рішення:** Оновіть токен через `/api/v1/auth/refresh`

### Помилка 403 Forbidden

```
Error: insufficient permissions
```

**Рішення:** Перевірте роль користувача. Деякі ендпоінти потребують ролі `admin` або `manager`.

### Помилка валідації

```
Error: validation failed: password too short
```

**Рішення:** Пароль повинен бути мінімум 8 символів.

---

## Корисні команди

```bash
# Перезапуск бази даних
docker-compose down && docker-compose up -d

# Очищення тестової бази
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
migrate -path migrations -database "$DATABASE_URL" up

# Перегляд логів
docker logs -f shop-core

# Перевірка здоровʼя сервісу
curl http://localhost:8080/health

# Метрики
curl http://localhost:8080/metrics
```

---

## Звіт про тестування

Після завершення тестування заповніть звіт:

```
Дата тестування: _______________
Тестувальник: _______________

Автоматизовані тести:
- Всього тестів: ___
- Пройдено: ___
- Провалено: ___
- Покриття: ___%

Ручне тестування:
- Пройдено сценаріїв: ___/___
- Виявлено помилок: ___

Критичні проблеми:
1. _______________
2. _______________

Рекомендації:
1. _______________
2. _______________
```
