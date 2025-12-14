# FAQ (Frequently Asked Questions)

Часті запитання та відповіді.

## Загальні питання

### Що таке Shop Platform?

Shop Platform - це SaaS e-commerce платформа для створення та управління інтернет-магазинами. Підтримує multi-tenancy, інтеграції з українськими платіжними системами та службами доставки.

### Які технології використовуються?

- **Backend:** Go 1.24
- **Frontend:** Next.js 16, React 19
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **Search:** Elasticsearch 8.11
- **Queue:** RabbitMQ
- **Infrastructure:** Docker, Kubernetes, Terraform

### Чи підтримується українська мова?

Так, платформа повністю локалізована українською мовою. Підтримуються також англійська та російська мови.

---

## Встановлення та налаштування

### Як запустити проект локально?

```bash
# Клонування
git clone https://github.com/your-org/shop-platform.git
cd shop-platform

# Налаштування
cp .env.example .env

# Запуск інфраструктури
docker compose up -d

# Міграції
make migrate-up

# Запуск сервісів
make run
```

### Які системні вимоги?

| Компонент | Мінімум | Рекомендовано |
|-----------|---------|---------------|
| CPU | 2 cores | 4+ cores |
| RAM | 8 GB | 16+ GB |
| Disk | 20 GB | 50+ GB SSD |
| Docker | 24+ | Latest |
| Go | 1.24+ | Latest |
| Node.js | 20+ | Latest |

### Як налаштувати HTTPS локально?

```bash
# Використовуйте mkcert
brew install mkcert  # macOS
mkcert -install
mkcert localhost 127.0.0.1

# Або через docker-compose з traefik
docker compose -f docker-compose.https.yml up
```

---

## API

### Як отримати API ключ?

1. Увійдіть в Admin панель
2. Settings → API Keys
3. Create New Key
4. Збережіть ключ (показується один раз)

### Який ліміт запитів до API?

| Endpoint | Ліміт |
|----------|-------|
| Default | 1000/хв |
| Auth | 10/хв |
| Search | 100/хв |
| Webhooks | 100/сек |

При перевищенні ліміту отримаєте `429 Too Many Requests`.

### Як працює автентифікація?

Платформа підтримує:
- **JWT Tokens** - для користувачів (access + refresh)
- **API Keys** - для сервісної інтеграції
- **OAuth2 PKCE** - для сторонніх додатків

```http
Authorization: Bearer <token>
```

### Чому отримую 401 Unauthorized?

Можливі причини:
1. Токен прострочений - оновіть через refresh token
2. Токен невалідний - перевірте формат
3. Відсутній header Authorization
4. API Key відкликаний

---

## Платежі

### Які платіжні системи підтримуються?

- **LiqPay** - картки Visa/Mastercard
- **Monobank** - Apple Pay, Google Pay
- **PrivatBank** - Приват24
- **Stripe** - міжнародні платежі
- **Готівка** - оплата при доставці

### Як налаштувати LiqPay?

```bash
# .env
LIQPAY_PUBLIC_KEY=your_public_key
LIQPAY_PRIVATE_KEY=your_private_key
LIQPAY_SANDBOX=true  # для тестування
```

### Як тестувати платежі?

Використовуйте тестові картки:
- **Успішна оплата:** 4242 4242 4242 4242
- **Відхилена:** 4000 0000 0000 0002
- CVV: будь-які 3 цифри
- Дата: будь-яка майбутня

---

## Доставка

### Які служби доставки підтримуються?

- **Нова Пошта** - відділення та кур'єр
- **Meest** - відділення
- **Justin** - відділення
- **Укрпошта** - відділення
- **Самовивіз** - з магазину

### Як отримати список відділень?

```http
GET /api/v1/checkout/warehouses?city=Київ&provider=nova_poshta
```

### Як відстежити посилку?

```http
GET /api/v1/tracking/{tracking_number}
```

Або через публічний URL: `https://novaposhta.ua/tracking?number=XXX`

---

## Товари та каталог

### Як додати товар через API?

```http
POST /api/v1/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Назва товару",
  "sku": "SKU-001",
  "price": 1000.00,
  "category_id": "cat_123"
}
```

### Як працює пошук?

Пошук базується на Elasticsearch з підтримкою:
- Повнотекстовий пошук по назві та опису
- Фільтри (категорія, ціна, бренд)
- Фасетна навігація
- Автозаповнення

### Як імпортувати товари з CSV?

```bash
# Admin Panel: Products → Import
# Або через API:
POST /api/v1/admin/products/import
Content-Type: multipart/form-data

file=@products.csv
```

Формат CSV:
```csv
sku,name,price,category,stock
SKU-001,Product 1,1000,electronics,50
```

### Як працюють варіанти товару?

Варіанти - це модифікації товару (колір, розмір):

```json
{
  "product_id": "prod_123",
  "variants": [
    {
      "sku": "SKU-001-BLK-M",
      "attributes": {"color": "Black", "size": "M"},
      "price": 1000,
      "stock": 10
    }
  ]
}
```

---

## Замовлення

### Які статуси замовлення?

| Статус | Опис |
|--------|------|
| `pending` | Очікує підтвердження |
| `confirmed` | Підтверджено |
| `processing` | В обробці |
| `shipped` | Відправлено |
| `delivered` | Доставлено |
| `completed` | Виконано |
| `cancelled` | Скасовано |

### Як скасувати замовлення?

```http
POST /api/v1/orders/{id}/cancel
Authorization: Bearer <token>

{
  "reason": "Причина скасування"
}
```

Скасування можливе тільки до відправки.

### Як оформити повернення?

```http
POST /api/v1/orders/{id}/return
Authorization: Bearer <token>

{
  "items": [
    {"order_item_id": "item_1", "quantity": 1, "reason": "defective"}
  ]
}
```

---

## Інтеграції

### Як налаштувати Telegram бот?

1. Створіть бота через @BotFather
2. Отримайте токен
3. Налаштуйте в `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF
   ```
4. Встановіть webhook:
   ```bash
   make telegram-webhook
   ```

### Як інтегрувати з маркетплейсами?

Платформа підтримує експорт в:
- **Rozetka** - XML фід
- **Prom.ua** - YML фід
- **Google Shopping** - Product Feed

Налаштування: Admin → Integrations → Marketplaces

### Як налаштувати webhooks?

```http
POST /api/v1/webhooks
Authorization: Bearer <token>

{
  "url": "https://your-server.com/webhook",
  "events": ["order.created", "order.shipped"]
}
```

---

## Безпека

### Як захищені паролі?

Паролі хешуються алгоритмом Argon2id - найсучаснішим методом хешування.

### Чи є двофакторна автентифікація?

Так, для адмін-користувачів доступна 2FA через TOTP (Google Authenticator).

### Як працює RBAC?

Ролі: `super_admin`, `admin`, `manager`, `warehouse`, `support`, `viewer`

Кожна роль має набір дозволів:
```
admin: products:*, orders:*, customers:*
manager: products:read, orders:*, customers:*
warehouse: products:read, inventory:*, orders:ship
```

---

## Продуктивність

### Як оптимізувати пошук?

1. Використовуйте фільтри замість повнотекстового пошуку
2. Обмежуйте кількість результатів (`limit`)
3. Використовуйте `fields` для вибірки потрібних полів
4. Кешуйте часті запити

### Чому повільні запити до БД?

1. Перевірте наявність індексів
2. Аналізуйте запити через `EXPLAIN ANALYZE`
3. Увімкніть connection pooling
4. Перевірте N+1 проблеми

### Як масштабувати систему?

- **Horizontal scaling** - збільшення replicas в Kubernetes
- **Database** - read replicas для читання
- **Cache** - Redis cluster
- **Search** - Elasticsearch cluster

---

## Troubleshooting

### Сервіс не запускається

1. Перевірте логи: `docker compose logs <service>`
2. Перевірте змінні середовища
3. Перевірте з'єднання з БД
4. Перевірте порти

### Помилка міграції БД

```bash
# Перевірте статус
migrate -path migrations -database "$DB_URL" version

# Примусовий reset (обережно!)
migrate -path migrations -database "$DB_URL" force <version>
```

### Redis не відповідає

```bash
docker compose exec redis redis-cli ping
# Очікується: PONG

# Перевірка пам'яті
docker compose exec redis redis-cli info memory
```

---

## Контакти

### Де отримати підтримку?

- **Documentation:** https://docs.yourstore.com
- **GitHub Issues:** https://github.com/your-org/shop-platform/issues
- **Email:** support@yourstore.com
- **Slack:** #shop-platform

### Як повідомити про баг?

Створіть issue на GitHub з:
1. Описом проблеми
2. Кроками відтворення
3. Очікуваною поведінкою
4. Версією системи
5. Логами (якщо є)
