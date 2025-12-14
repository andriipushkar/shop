# Changelog

Усі значні зміни в проекті документуються тут.

Формат базується на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
проект дотримується [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Terraform infrastructure для AWS (EKS, RDS, S3, ALB)
- API Gateway з usage metering
- App Store ecosystem з OAuth2 PKCE
- Global Search (Cross-Tenant Elasticsearch)
- Domain Management з SSL автоматизацією
- Повна документація платформи

### Changed
- Оновлено Go до версії 1.24
- Покращено продуктивність пошуку

### Fixed
- Виправлено race condition в обробці замовлень

---

## [2.0.0] - 2024-01-15

### Added
- Multi-tenant архітектура
- CRM модуль з RFM сегментацією
- Програма лояльності (бали, рівні, реферали)
- WMS (Warehouse Management System)
- POS система для роздрібних продажів
- Telegram бот з FSM checkout
- Інтеграція з маркетплейсами (Rozetka, Prom.ua)
- Аналітика з когортним аналізом
- Webhooks система
- i18n підтримка (UK, EN, RU)

### Changed
- Повний редизайн Admin панелі
- Новий API формат відповідей
- Оновлено автентифікацію на JWT RS256

### Deprecated
- REST API v1 (буде видалено в v3.0)
- Basic Auth для API

### Removed
- Застарілий XML export формат
- Legacy payment gateway

### Security
- Оновлено залежності з CVE
- Додано rate limiting
- Впроваджено RBAC

---

## [1.5.0] - 2023-10-01

### Added
- Інтеграція з Monobank
- Apple Pay / Google Pay підтримка
- Push notifications
- Bulk product import/export
- Advanced product filters

### Changed
- Оптимізовано Elasticsearch queries
- Покращено UX checkout процесу

### Fixed
- Виправлено калькуляцію знижок з промокодами
- Виправлено проблему з кешуванням категорій

---

## [1.4.0] - 2023-07-15

### Added
- Інтеграція з Justin доставкою
- Product variants (колір, розмір)
- Customer reviews та ratings
- Wishlist функціональність
- Email templates з MJML

### Changed
- Оновлено Next.js до версії 14
- Міграція на новий Redis client

### Fixed
- Виправлено проблему з UTF-8 в CSV import
- Виправлено таймаут при великих замовленнях

---

## [1.3.0] - 2023-04-01

### Added
- Інтеграція з Укрпоштою
- Order tracking в реальному часі
- Automated email campaigns
- A/B testing для landing pages

### Changed
- Оновлено структуру БД для кращої продуктивності
- Рефакторинг order processing pipeline

### Security
- Впроваджено CSRF protection
- Додано аудит логування

---

## [1.2.0] - 2023-01-15

### Added
- Інтеграція з PrivatBank
- SMS notifications через TurboSMS
- Product recommendations
- SEO оптимізації (sitemap, meta tags)

### Changed
- Покращено швидкість завантаження сторінок
- Оновлено дизайн мобільної версії

### Fixed
- Виправлено проблему з паралельними платежами
- Виправлено відображення цін з копійками

---

## [1.1.0] - 2022-10-01

### Added
- Інтеграція з Нова Пошта API v2.0
- Промокоди та знижки
- Customer groups
- Export замовлень в Excel

### Changed
- Оновлено React до версії 18
- Покращено обробку помилок

### Fixed
- Виправлено проблему з сесіями
- Виправлено пагінацію в каталозі

---

## [1.0.0] - 2022-07-01

### Added
- Core e-commerce функціональність
- Product catalog з категоріями
- Shopping cart та checkout
- Інтеграція з LiqPay
- Інтеграція з Нова Пошта
- Admin панель
- Customer accounts
- Order management
- Inventory tracking
- Basic analytics
- Email notifications
- Responsive design

---

## Версіонування

Проект використовує Semantic Versioning:

- **MAJOR** (X.0.0) - Breaking changes, несумісні зміни API
- **MINOR** (0.X.0) - Нова функціональність, зворотно сумісна
- **PATCH** (0.0.X) - Bug fixes, зворотно сумісні

## Міграція

Для кожного major релізу надається [Migration Guide](./guides/MIGRATION.md).

## Підтримка версій

| Версія | Статус | Підтримка до |
|--------|--------|--------------|
| 2.x | Active | - |
| 1.5.x | Security | 2024-10-01 |
| 1.4.x | EOL | 2024-01-01 |
| < 1.4 | EOL | - |

## Зворотній зв'язок

Для повідомлення про баги або пропозицій використовуйте:
- [GitHub Issues](https://github.com/your-org/shop-platform/issues)
- [Discussions](https://github.com/your-org/shop-platform/discussions)
