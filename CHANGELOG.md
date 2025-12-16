# Журнал змін

Всі значні зміни в цьому проекті будуть задокументовані в цьому файлі.

Формат базується на [Keep a Changelog](https://keepachangelog.com/uk/1.0.0/),
і цей проект дотримується [Semantic Versioning](https://semver.org/lang/uk/).

## [Unreleased]

### Додано
- Документація для всіх модулів системи
- E2E тести з Playwright
- CI/CD pipeline з GitHub Actions

### Змінено
- Оновлено залежності до останніх версій

### Виправлено
- Виправлено помилку з кешуванням в Redis

## [1.0.0] - 2024-01-15

### Додано
- **Core Service**: Основний Go сервіс з API для продуктів, замовлень, клієнтів
- **OMS Service**: Сервіс управління замовленнями
- **CRM Service**: Сервіс управління клієнтами
- **Notification Service**: Сервіс сповіщень (email, SMS, push)
- **Storefront**: Next.js фронтенд для покупців
- **Admin Panel**: Next.js адмін-панель
- **Superadmin**: Панель управління платформою

### Інтеграції
- LiqPay для онлайн платежів
- Monobank для оплати карткою
- Nova Poshta для доставки
- Checkbox для фіскалізації
- Rozetka маркетплейс

### Інфраструктура
- Docker та Docker Compose
- Kubernetes Helm charts
- GitHub Actions CI/CD
- Prometheus + Grafana моніторинг

## [0.9.0] - 2024-01-01

### Додано
- Multi-tenancy підтримка
- GraphQL API
- WebSocket для real-time оновлень
- A/B тестування

### Змінено
- Перехід на PostgreSQL 15
- Оновлено Redis до версії 7

## [0.8.0] - 2023-12-15

### Додано
- AI-powered рекомендації товарів
- Динамічне ціноутворення
- Прогнозування попиту

### Виправлено
- Оптимізовано повільні SQL запити
- Виправлено витік пам'яті в worker-ах

## [0.7.0] - 2023-12-01

### Додано
- PWA підтримка
- Push сповіщення
- Offline режим для каталогу

### Змінено
- Покращено Core Web Vitals
- Оптимізовано завантаження зображень

## [0.6.0] - 2023-11-15

### Додано
- Elasticsearch для повнотекстового пошуку
- Фасетний пошук
- Автодоповнення пошуку

### Змінено
- Рефакторинг пошукового модуля

## [0.5.0] - 2023-11-01

### Додано
- RabbitMQ для черг
- Event-driven архітектура
- Асинхронна обробка замовлень

## [0.4.0] - 2023-10-15

### Додано
- Rate limiting
- Circuit breaker
- Distributed tracing з Jaeger

## [0.3.0] - 2023-10-01

### Додано
- Redis кешування
- Session management
- API keys для інтеграцій

## [0.2.0] - 2023-09-15

### Додано
- JWT авторизація
- RBAC система ролей
- OAuth2 підтримка

## [0.1.0] - 2023-09-01

### Додано
- Початкова структура проекту
- Базові CRUD операції
- Docker конфігурація

---

## Типи змін

- **Додано** для нових функцій.
- **Змінено** для змін в існуючій функціональності.
- **Застаріло** для функцій, які скоро будуть видалені.
- **Видалено** для видалених функцій.
- **Виправлено** для виправлення помилок.
- **Безпека** для виправлень вразливостей.

[Unreleased]: https://github.com/shop/shop-platform/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/shop/shop-platform/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/shop/shop-platform/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/shop/shop-platform/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/shop/shop-platform/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/shop/shop-platform/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/shop/shop-platform/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/shop/shop-platform/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/shop/shop-platform/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/shop/shop-platform/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/shop/shop-platform/releases/tag/v0.1.0
