# Підтримка

Як отримати допомогу з Shop Platform.

## Канали підтримки

### GitHub Issues

Для повідомлень про помилки та запитів на нові функції:
- [Створити Issue](https://github.com/shop/shop-platform/issues/new)
- [Переглянути відкриті Issues](https://github.com/shop/shop-platform/issues)

**Перед створенням Issue:**
1. Перевірте [FAQ](#faq)
2. Пошукайте серед існуючих issues
3. Підготуйте мінімальний приклад для відтворення

### Документація

- [Документація проекту](./docs/README.md)
- [API Reference](./docs/api/README.md)
- [Guides](./docs/guides/README.md)

### Спільнота

- **Telegram**: [@shop_platform_ua](https://t.me/shop_platform_ua)
- **Discord**: [Shop Platform Community](https://discord.gg/shop-platform)

## FAQ

### Встановлення

**Q: Як швидко розгорнути проект локально?**
```bash
git clone https://github.com/shop/shop-platform.git
cd shop-platform
make setup
make dev
```

**Q: Які системні вимоги?**
- Docker 24+
- Docker Compose 2.20+
- Node.js 18+ (для фронтенду)
- Go 1.21+ (для бекенду)
- 8GB RAM мінімум

### Конфігурація

**Q: Де знаходяться конфігураційні файли?**
```
.env.example          # Приклад змінних середовища
config/               # Конфігураційні файли
docker-compose.yml    # Docker конфігурація
```

**Q: Як налаштувати інтеграцію з Nova Poshta?**

Додайте API ключ в `.env`:
```env
NOVA_POSHTA_API_KEY=your_api_key
```

### Розробка

**Q: Як запустити тести?**
```bash
# Backend тести
make test-backend

# Frontend тести
make test-frontend

# E2E тести
make test-e2e
```

**Q: Як додати нову міграцію?**
```bash
make migration-create name=add_new_table
```

### Deployment

**Q: Як деплоїти на production?**

Див. [Deployment Guide](./docs/deployment/KUBERNETES.md)

**Q: Як налаштувати SSL сертифікати?**

Використовуйте cert-manager з Let's Encrypt:
```bash
kubectl apply -f k8s/cert-manager/
```

## Повідомлення про помилки

При створенні Issue про помилку, включіть:

### Обов'язкова інформація

1. **Опис проблеми** - чітко опишіть, що відбувається
2. **Кроки для відтворення** - як відтворити проблему
3. **Очікувана поведінка** - що мало відбутися
4. **Фактична поведінка** - що відбулося насправді

### Додаткова інформація

```markdown
**Середовище:**
- OS: Ubuntu 22.04
- Docker: 24.0.5
- Go: 1.21.0
- Node: 18.17.0

**Версія Shop Platform:** v1.0.0

**Логи:**
```
Вставте релевантні логи тут
```
```

## Запити на функції

При запиті нової функції:

1. **Опишіть проблему** - яку проблему вирішує функція
2. **Опишіть рішення** - як ви бачите реалізацію
3. **Альтернативи** - які альтернативи ви розглядали
4. **Додатковий контекст** - скріншоти, приклади

## Security Issues

Для повідомлень про вразливості безпеки:

**НЕ створюйте публічні Issues!**

Надішліть звіт на: **security@shop.ua**

Включіть:
- Тип вразливості
- Шлях до файлу з проблемою
- Кроки для відтворення
- Потенційний вплив

Див. [SECURITY.md](./SECURITY.md) для деталей.

## Комерційна підтримка

Для enterprise клієнтів доступна комерційна підтримка:

| План | SLA | Підтримка | Ціна |
|------|-----|-----------|------|
| Basic | 48h | Email | $500/міс |
| Professional | 24h | Email + Chat | $1500/міс |
| Enterprise | 4h | 24/7 Phone | Custom |

**Контакт:** enterprise@shop.ua

## Внесок у проект

Хочете допомогти? Див:
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [Дорожня карта](./ROADMAP.md)
- [Good first issues](https://github.com/shop/shop-platform/labels/good%20first%20issue)

## Корисні посилання

- [Статус сервісів](https://status.shop.ua)
- [Release Notes](./CHANGELOG.md)
- [API Status](https://api.shop.ua/health)
