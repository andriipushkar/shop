# Shop Core Service - Документація

Повна документація українською мовою для інтернет-магазину на базі Go.

## Зміст

1. [Встановлення та налаштування](#встановлення-та-налаштування)
2. [Архітектура системи](#архітектура-системи)
3. [API документація](#api-документація)
4. [Модулі та функціонал](#модулі-та-функціонал)
5. [База даних](#база-даних)
6. [Інтеграції](#інтеграції)
7. [Запуск та розгортання](#запуск-та-розгортання)

---

## Встановлення та налаштування

### Системні вимоги

- Go 1.21+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (опціонально)

### Швидкий старт

```bash
# Клонування репозиторію
git clone https://github.com/your-org/shop.git
cd shop/services/core

# Встановлення залежностей
go mod download

# Налаштування змінних середовища
cp .env.example .env
# Відредагуйте .env файл

# Запуск міграцій бази даних
migrate -path migrations -database "$DATABASE_URL" up

# Запуск сервісу
go run cmd/main.go
```

### Змінні середовища

| Змінна | Опис | Приклад |
|--------|------|---------|
| `DATABASE_URL` | URL підключення до PostgreSQL | `postgres://user:pass@localhost:5432/shop?sslmode=disable` |
| `REDIS_URL` | URL підключення до Redis | `redis://localhost:6379` |
| `JWT_SECRET` | Секретний ключ для JWT токенів | `your-secret-key-min-32-chars` |
| `PORT` | Порт HTTP сервера | `8080` |
| `NOVAPOSHTA_API_KEY` | API ключ Нової Пошти | `your-api-key` |
| `UKRPOSHTA_BEARER_TOKEN` | Bearer токен Укрпошти | `your-token` |
| `SENDPULSE_CLIENT_ID` | Client ID SendPulse | `your-client-id` |
| `SENDPULSE_CLIENT_SECRET` | Client Secret SendPulse | `your-secret` |

---

## Архітектура системи

### Структура проекту

```
services/core/
├── cmd/
│   └── main.go              # Точка входу
├── internal/
│   ├── auth/                # Автентифікація (JWT, OAuth, паролі)
│   ├── logistics/           # Логістика (Нова Пошта, Укрпошта, Meest)
│   ├── email/               # Email провайдери (SendPulse, eSputnik, Mailchimp)
│   ├── marketplace/         # Маркетплейси (Rozetka, Prom, OLX)
│   ├── analytics/           # Аналітика (RFM, ABC-XYZ)
│   ├── inventory/           # Управління запасами
│   ├── payment/             # Платіжні системи
│   ├── warehouse/           # Склад та WMS
│   ├── export/              # Експорт даних (CSV, Excel, JSON)
│   ├── search/              # Пошук (Elasticsearch)
│   ├── cache/               # Кешування (Redis)
│   ├── pim/                 # Product Information Management
│   ├── loyalty/             # Програма лояльності
│   └── ...
├── migrations/              # SQL міграції
├── docs/                    # Документація
└── go.mod
```

### Основні компоненти

1. **Auth** - автентифікація та авторизація
2. **PIM** - управління товарами
3. **OMS** - управління замовленнями
4. **Logistics** - доставка
5. **Payment** - оплата
6. **Analytics** - аналітика

---

## Модулі та функціонал

### Автентифікація (`internal/auth`)

#### JWT токени

```go
// Генерація пари токенів
tokens, err := jwtManager.GenerateTokenPair(userID, email, phone, role)

// Валідація токена
claims, err := jwtManager.ValidateToken(accessToken)

// Оновлення токенів
newTokens, err := jwtManager.RefreshTokens(refreshToken, getUserRole)
```

#### Паролі (Argon2id)

```go
// Хешування пароля
hash, err := hasher.Hash("SecurePassword123!")

// Перевірка пароля
err := hasher.Verify(password, hash)

// Перевірка необхідності рехешування
needsRehash := hasher.NeedsRehash(hash)
```

#### OAuth (Google, Facebook)

```go
// Отримання URL для авторизації
authURL := googleOAuth.GetAuthURL(state)

// Обробка callback
tokens, err := googleOAuth.ExchangeCode(ctx, code)
user, err := googleOAuth.GetUserInfo(ctx, tokens.AccessToken)
```

#### Ролі користувачів

- `customer` - покупець (за замовчуванням)
- `admin` - адміністратор
- `manager` - менеджер
- `support` - підтримка

### Логістика (`internal/logistics`)

#### Нова Пошта

```go
client := logistics.NewNovaPoshtaClient(apiKey)

// Пошук міст
cities, err := client.SearchCities(ctx, "Київ")

// Отримання відділень
warehouses, err := client.GetWarehouses(ctx, cityRef)

// Розрахунок вартості доставки
cost, err := client.CalculateDeliveryCost(ctx, citySender, cityRecipient, weight, declaredValue)

// Створення накладної
doc, err := client.CreateInternetDocument(ctx, request)

// Відстеження посилки
tracking, err := client.TrackDocument(ctx, ttn)
```

#### Укрпошта

```go
client := logistics.NewUkrPoshtaClient(bearerToken, counterpartyToken)

// Створення адреси
addr, err := client.CreateAddress(ctx, &UPAddress{
    PostCode: "01001",
    City:     "Київ",
    Street:   "Хрещатик",
    HouseNumber: "1",
})

// Створення відправлення
shipment, err := client.CreateShipment(ctx, &UPShipment{
    DeliveryType: "W2W",
    Parcels: []UPParcel{{
        Weight: 1.0,
        DeclaredPrice: 500,
    }},
})

// Друк етикетки
label, err := client.GetShipmentLabel(ctx, uuid, "pdf_a4")
```

#### Meest Express

```go
client := logistics.NewMeestClient(login, password)

// Аутентифікація
err := client.Authenticate(ctx)

// Пошук міст
cities, err := client.SearchCities(ctx, "Львів")

// Пошук відділень
branches, err := client.GetBranches(ctx, cityID)

// Створення відправлення
shipment, err := client.CreateShipment(ctx, &MeestShipment{
    // ...
})
```

### Email маркетинг (`internal/email`)

#### Базове використання

```go
service := email.NewEmailService()
service.RegisterProvider(sendpulse.NewSendPulseClient(clientID, secret))
service.SetDefaultProvider("sendpulse")
service.SetDefaultFrom("shop@example.com", "Магазин")

// Відправка листа
result, err := service.SendEmail(ctx, "", &email.Email{
    To:      []string{"customer@example.com"},
    Subject: "Підтвердження замовлення",
    HTML:    "<h1>Дякуємо за замовлення!</h1>",
})
```

#### Шаблонні листи

```go
// Підтвердження замовлення
err := service.SendOrderConfirmation(ctx, "customer@example.com", "ORD-123", items, total)

// Повідомлення про доставку
err := service.SendShippingNotification(ctx, email, orderID, ttn, "Nova Poshta")

// Скидання пароля
err := service.SendPasswordReset(ctx, email, resetLink)

// Вітальний лист
err := service.SendWelcome(ctx, email, firstName)
```

### Аналітика (`internal/analytics`)

#### RFM аналіз

```go
analyzer := analytics.NewRFMAnalyzer(db)

// Розрахунок RFM сегментів
segments, err := analyzer.CalculateRFM(ctx, time.Now().AddDate(0, -12, 0))

// Отримання клієнтів за сегментом
customers, err := analyzer.GetCustomersBySegment(ctx, "Champions")
```

#### ABC-XYZ аналіз

```go
analyzer := analytics.NewABCXYZAnalyzer(db)

// Розрахунок категорій
results, err := analyzer.Analyze(ctx, startDate, endDate)

// Отримання товарів за категорією
products, err := analyzer.GetProductsByCategory(ctx, "AX")
```

### Експорт даних (`internal/export`)

```go
exporter := export.NewExporter()

// Експорт в CSV
data, err := exporter.ExportCSV(products)

// Експорт в Excel
data, err := exporter.ExportExcel(products)

// Експорт в JSON
data, err := exporter.ExportJSON(products)

// Потоковий експорт великих даних
err := exporter.StreamExport(ctx, writer, products)
```

---

## База даних

### Основні таблиці

| Таблиця | Опис |
|---------|------|
| `users` | Користувачі |
| `products` | Товари |
| `categories` | Категорії |
| `orders` | Замовлення |
| `order_items` | Позиції замовлень |
| `cart_items` | Кошик |
| `wishlist_items` | Список бажань |
| `reviews` | Відгуки |
| `promo_codes` | Промокоди |
| `loyalty_points` | Бонусні бали |

### Запуск міграцій

```bash
# Встановлення migrate
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Виконання міграцій
migrate -path migrations -database "$DATABASE_URL" up

# Відкат міграцій
migrate -path migrations -database "$DATABASE_URL" down 1

# Перевірка версії
migrate -path migrations -database "$DATABASE_URL" version
```

---

## Інтеграції

### Маркетплейси

| Маркетплейс | Статус | Функціонал |
|-------------|--------|------------|
| Rozetka | ✅ | Синхронізація товарів, замовлень |
| Prom.ua | ✅ | Синхронізація товарів, замовлень |
| OLX | ✅ | Публікація оголошень |
| Hotline | ✅ | Вивантаження прайсу |

### Платіжні системи

| Система | Статус | Методи |
|---------|--------|--------|
| LiqPay | ✅ | Card, Apple Pay, Google Pay |
| Fondy | ✅ | Card |
| Monobank | ✅ | Card |
| Privat24 | ✅ | Card |

### Логістика

| Перевізник | Статус | Функціонал |
|------------|--------|------------|
| Нова Пошта | ✅ | Повна інтеграція |
| Укрпошта | ✅ | Повна інтеграція |
| Meest Express | ✅ | Повна інтеграція |

---

## Запуск та розгортання

### Локальний запуск

```bash
# З Docker Compose
docker-compose up -d

# Без Docker
go run cmd/main.go
```

### Production

```bash
# Збірка
go build -o shop-core ./cmd/main.go

# Запуск
./shop-core
```

### Docker

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o shop-core ./cmd/main.go

FROM alpine:latest
COPY --from=builder /app/shop-core /usr/local/bin/
EXPOSE 8080
CMD ["shop-core"]
```

---

## Тестування

### Запуск тестів

```bash
# Всі тести
go test ./...

# З покриттям
go test -cover ./...

# Конкретний пакет
go test ./internal/auth/...

# З детальним виводом
go test -v ./...

# Benchmark тести
go test -bench=. ./...
```

### Покриття тестами (поточне)

| Пакет | Покриття |
|-------|----------|
| `auth` | 74% |
| `logistics` | ~1% (data structures) |
| `email` | 8% |
| `analytics` | 35% |
| `inventory` | 86% |
| `marketplace/feeds` | 94% |

---

## Контакти

- GitHub Issues: [github.com/your-org/shop/issues](https://github.com/your-org/shop/issues)
- Email: support@example.com
