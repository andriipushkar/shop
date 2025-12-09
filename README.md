# Microservices Shop

Мікросервісний інтернет-магазин з Telegram Bot інтерфейсом.

## Features

- **Telegram Bot** з головним меню та inline-кнопками
- **Каталог товарів** з категоріями, пошуком та пагінацією
- **Кошик** з можливістю додавання/очищення
- **Checkout FSM** - покроковий збір телефону та адреси доставки
- **Геолокація** - можливість надіслати локацію замість ручного вводу адреси
- **Сповіщення** - автоматичні повідомлення про статус замовлення
- **Трекінг доставки** - номер відстеження з автосповіщенням клієнта
- **Підписка на товар** - сповіщення коли товар з'явиться в наявності
- **Відгуки** - система рейтингів та коментарів до товарів
- **Промокоди** - знижки з обмеженням використань
- **Статистика** - аналітика продажів для адміна
- **Адмін-панель** - керування замовленнями та товарами
- **Імпорт/Експорт** - масове завантаження товарів з CSV та вивантаження замовлень
- **Сповіщення адміну** - автоматичні алерти при нових замовленнях

## Quick Start

```bash
# 1. Створіть .env файл
cat > .env << EOF
TELEGRAM_BOT_TOKEN=your_token
ADMIN_IDS=your_telegram_id
EOF

# 2. Запустіть всі сервіси
docker compose up --build
```

## Bot Commands

### Клієнт

| Команда | Опис |
|---------|------|
| `/start` | Головне меню |
| `/products` | Список товарів |
| `/categories` | Категорії |
| `/search [запит]` | Пошук товарів |
| `/cart` | Кошик |
| `/myorders` | Мої замовлення з трекінгом |
| `/info` | Довідка по командах |

### Адмін

| Команда | Опис |
|---------|------|
| `/orders` | Всі замовлення |
| `/create [назва] [ціна] [sku]` | Створити товар |
| `/stock [ID] [кількість]` | Встановити залишок |
| `/setimage [ID] [URL]` | Встановити фото товару |
| `/track [ID] [номер] [примітка]` | Трекінг доставки |
| `/stats` | Статистика продажів |
| `/promo` | Список промокодів |
| `/newpromo [код] [%] [ліміт]` | Створити промокод |
| `/import` | Імпорт товарів з CSV |
| `/export` | Експорт замовлень в CSV |
| `/newcat [назва]` | Створити категорію |
| `/delcat [ID]` | Видалити категорію |

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐
│ Telegram Bot│────▶│   Core   │────▶│ PostgreSQL  │
│             │     │  (PIM)   │     │             │
└─────────────┘     └──────────┘     └─────────────┘
       │                                    ▲
       │            ┌──────────┐            │
       └───────────▶│   OMS    │────────────┘
                    └──────────┘
                         │
                         ▼
                    ┌──────────┐     ┌─────────────┐
                    │ RabbitMQ │────▶│Notification │
                    └──────────┘     └─────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Core | 8080 | Товари, категорії, залишки, фото |
| OMS | 8081 | Замовлення, статуси, трекінг, промокоди, статистика |
| CRM | 8082 | Клієнти |
| Bot | - | Telegram інтерфейс |
| Notification | - | Сповіщення |
| Storefront | 3000 | Web UI (Next.js) |

## Development

### Prerequisites

- Go 1.21+
- Docker & Docker Compose
- Make (optional)

### Running Tests

```bash
# Всі тести
make test

# Окремі сервіси
make test-core
make test-oms
make test-bot
make test-crm
make test-notif

# Integration тести (потребує запущених сервісів)
make test-integration

# Coverage report
make coverage
```

### Building

```bash
# Всі сервіси
make build

# Окремі сервіси
make build-core
make build-oms
make build-bot
```

### Docker

```bash
# Запуск
make docker-up

# Зупинка
make docker-down

# Логи
make docker-logs

# Перезапуск
make docker-restart
```

### Code Quality

```bash
# Linter
make lint

# Tidy modules
make tidy
```

## Testing

### Unit Tests

Проект містить ~70+ unit тестів для всіх сервісів:

- **Core Service** - PIM (products, categories, stock management)
- **OMS Service** - Orders, promo codes, statistics
- **Telegram Bot** - Handlers, cart, checkout FSM, reviews
- **CRM Service** - Customer management
- **Notification Service** - Event processing, message formatting

### Integration Tests

```bash
# Запуск integration тестів
go test -v -tags=integration ./tests/...
```

### Coverage

```bash
# Генерація HTML coverage reports
./scripts/coverage.sh

# Відкрити звіт
open coverage/core-coverage.html
```

## CI/CD

Проект використовує GitHub Actions для CI/CD:

- **Test** - запуск тестів для всіх сервісів
- **Build** - компіляція всіх сервісів
- **Lint** - golangci-lint
- **Docker** - збірка Docker images
- **Coverage** - генерація coverage reports

Конфігурація: `.github/workflows/ci.yml`

## Documentation

- [API Reference](docs/api.md) - HTTP endpoints та команди бота
- [Architecture](docs/architecture.md) - Діаграми та потоки даних
- [Setup Guide](docs/setup.md) - Встановлення та налаштування

## Tech Stack

- **Go 1.21** - Backend services
- **PostgreSQL 15** - Database
- **Redis 7** - Cache (products, categories)
- **RabbitMQ 3** - Event bus
- **telebot v3** - Telegram Bot framework
- **Docker** - Containerization

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI/CD
├── docs/
│   ├── api.md               # API documentation
│   ├── architecture.md      # Architecture diagrams
│   └── setup.md             # Setup guide
├── scripts/
│   └── coverage.sh          # Coverage report generator
├── services/
│   ├── core/                # Product Information Management
│   │   ├── cmd/
│   │   └── internal/
│   │       ├── pim/         # Products, categories
│   │       ├── cache/       # Redis cache
│   │       ├── transport/   # HTTP handlers
│   │       └── eventbus/    # RabbitMQ publisher
│   ├── oms/                 # Order Management System
│   │   ├── cmd/
│   │   └── internal/
│   │       └── order/       # Orders, promo codes
│   ├── crm/                 # Customer Relationship Management
│   │   ├── cmd/
│   │   └── internal/
│   │       └── customer/    # Customer data
│   ├── telegram-bot/        # Telegram Bot interface
│   │   ├── cmd/
│   │   └── internal/
│   │       └── bot/         # Handlers, FSM, cart
│   ├── notification/        # Event consumer & notifications
│   │   └── cmd/
│   └── storefront/          # Web UI (Next.js)
├── tests/
│   └── integration_test.go  # Integration tests
├── docker-compose.yml
├── Makefile
└── README.md
```

## New Features (v2.0)

### Infrastructure
- [x] **CI/CD Pipeline** - GitHub Actions with multi-stage deployment
- [x] **Docker Production** - Optimized multi-stage builds for all services
- [x] **Database Migrations** - golang-migrate integration
- [x] **Prometheus + Grafana** - Metrics and dashboards
- [x] **Alerting** - Prometheus Alertmanager with Slack/PagerDuty integration
- [x] **Graceful Shutdown** - Proper shutdown with cleanup hooks

### API & Backend
- [x] **API Documentation** - OpenAPI 3.1 specification
- [x] **API Versioning** - URL/Header-based version negotiation
- [x] **Authentication** - JWT + OAuth2 (Google, Facebook)
- [x] **Image Upload** - S3/MinIO storage
- [x] **Cursor Pagination** - Efficient large dataset handling
- [x] **i18n** - Multilanguage support (UK, EN, RU)

### Business Features
- [x] **Admin Panel** - Next.js dashboard with React Query
- [x] **A/B Testing** - Feature experiments with targeting
- [x] **Loyalty Program** - Points, tiers, rewards
- [x] **Inventory Sync** - 1C/ERP integration

### Testing & Quality
- [x] **Load Testing** - k6 performance tests
- [x] **Extended Tests** - 250+ unit tests across all services
- [x] **E2E Tests** - End-to-end flow testing

## Roadmap

### Пріоритет 1 (критично)
- [ ] Оплата (LiqPay/Mono інтеграція)
- [ ] Валідація промокоду при checkout
- [x] Persistence для кошика (PostgreSQL)
- [x] JWT Authentication
- [x] API Documentation

### Пріоритет 2 (важливо)
- [ ] Nova Poshta API (автоматичний трекінг)
- [ ] Wishlist (список бажань)
- [ ] Редагування кошика (зміна кількості)
- [ ] Історія цін
- [x] Admin Panel
- [x] Loyalty Program

### Пріоритет 3 (покращення)
- [x] Redis кеш (товари, категорії з автоматичною інвалідацією)
- [ ] Elasticsearch (повнотекстовий пошук)
- [x] S3/MinIO (зберігання зображень)
- [ ] Rate limiting
- [ ] Structured logging (ELK)
- [x] i18n (multilanguage)

### Пріоритет 4 (масштабування)
- [ ] Kubernetes configs
- [x] Prometheus + Grafana
- [ ] Distributed tracing (Jaeger)
- [x] Load Testing (k6)
- [x] A/B Testing

## License

MIT
