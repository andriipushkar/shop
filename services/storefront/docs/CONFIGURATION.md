# Конфігурація

Повний посібник з налаштування змінних оточення та конфігурації системи.

## Зміст

- [Змінні оточення](#змінні-оточення)
- [Приклад .env файлу](#приклад-env-файлу)
- [Production vs Development](#production-vs-development)
- [Конфігурація за модулями](#конфігурація-за-модулями)
- [Безпека](#безпека)

---

## Змінні оточення

### Базові налаштування

```bash
# Next.js
NODE_ENV=development  # development | production | test
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shop
DATABASE_POOL_SIZE=20
DATABASE_SSL=false

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

---

### Fiscal (ПРРО / Checkbox)

```bash
# Checkbox API
CHECKBOX_API_URL=https://api.checkbox.ua/api/v1
CHECKBOX_LICENSE_KEY=your-license-key-here
CHECKBOX_CASHIER_LOGIN=cashier@example.com
CHECKBOX_CASHIER_PASSWORD=secure-password

# Optional
CHECKBOX_CASH_REGISTER_ID=
CHECKBOX_ORGANIZATION_ID=
```

**Отримання credentials:**
1. Реєстрація на https://checkbox.ua
2. Створення каси в особистому кабінеті
3. Отримання ліцензійного ключа
4. Створення користувача-касира

---

### B2B

```bash
# B2B Settings
B2B_ENABLED=true
B2B_MIN_ORDER_VALUE=5000
B2B_DEFAULT_COMMISSION_RATE=15
B2B_PAYMENT_TERM_DAYS=30

# Price Tiers (optional, override defaults)
B2B_WHOLESALE_SMALL_DISCOUNT=10
B2B_WHOLESALE_MEDIUM_DISCOUNT=15
B2B_WHOLESALE_LARGE_DISCOUNT=20
B2B_PARTNER_DISCOUNT=25
B2B_DISTRIBUTOR_DISCOUNT=30
```

---

### Dropshipping / Supplier

```bash
# Supplier Settings
SUPPLIER_ENABLED=true
SUPPLIER_DEFAULT_COMMISSION_RATE=15
SUPPLIER_PAYMENT_TERM_DAYS=14
SUPPLIER_AUTO_APPROVE_PRODUCTS=false
SUPPLIER_REQUIRE_MODERATION=true

# Supplier Payouts
SUPPLIER_MIN_PAYOUT_AMOUNT=1000
SUPPLIER_PAYOUT_SCHEDULE=weekly  # daily | weekly | monthly
```

---

### Платіжні системи

```bash
# LiqPay
LIQPAY_PUBLIC_KEY=your-public-key
LIQPAY_PRIVATE_KEY=your-private-key
LIQPAY_ENABLED=true

# Monobank
MONOBANK_TOKEN=your-token
MONOBANK_ENABLED=true

# ПриватБанк
PRIVATBANK_MERCHANT_ID=your-merchant-id
PRIVATBANK_MERCHANT_SECRET=your-secret
PRIVATBANK_ENABLED=true

# Payment settings
PAYMENT_DEFAULT_CURRENCY=UAH
PAYMENT_ALLOWED_METHODS=card,cash,online,installment
```

**Де отримати:**
- **LiqPay:** https://www.liqpay.ua/admin/business
- **Monobank:** https://api.monobank.ua/
- **ПриватБанк:** Зв'яжіться з менеджером банку

---

### Служби доставки

```bash
# Нова Пошта
NOVAPOSHTA_API_KEY=your-api-key
NOVAPOSHTA_ENABLED=true

# Meest
MEEST_API_KEY=your-api-key
MEEST_API_URL=https://api.meest.com
MEEST_ENABLED=true

# Justin
JUSTIN_API_KEY=your-api-key
JUSTIN_ENABLED=true

# Укрпошта
UKRPOSHTA_API_KEY=your-api-key
UKRPOSHTA_ENABLED=true

# Delivery settings
DELIVERY_FREE_SHIPPING_THRESHOLD=1000
DELIVERY_DEFAULT_WAREHOUSE=warehouse-1
```

---

### AI Репрайсинг

```bash
# AI Repricing
AI_REPRICING_ENABLED=true
AI_REPRICING_SCHEDULE=0 */4 * * *  # Every 4 hours (cron format)
AI_REPRICING_AUTO_APPLY=false
AI_REPRICING_MIN_MARGIN=15
AI_REPRICING_MAX_DISCOUNT=30

# Competitor Price Monitoring
COMPETITOR_SCRAPING_ENABLED=true
COMPETITOR_API_KEYS={"rozetka":"key1","citrus":"key2"}
COMPETITOR_CHECK_INTERVAL=3600  # seconds
```

---

### AI Прогнозування

```bash
# AI Forecasting
AI_FORECASTING_ENABLED=true
AI_FORECASTING_METHOD=auto  # sma | exponential | linear | auto
AI_FORECASTING_CONFIDENCE_LEVEL=0.90
AI_FORECASTING_DAYS_HISTORY=90
AI_FORECASTING_DAYS_FORECAST=30

# Auto Purchase Recommendations
AI_AUTO_PURCHASE_ENABLED=false
AI_SAFETY_STOCK_MULTIPLIER=1.5
```

---

### Апаратне забезпечення

```bash
# Thermal Printers
THERMAL_PRINTER_ENABLED=true
THERMAL_PRINTER_DEFAULT_IP=192.168.1.100
THERMAL_PRINTER_DEFAULT_PORT=9100
THERMAL_PRINTER_ENCODING=cp866  # or utf-8

# Label Printers
LABEL_PRINTER_ENABLED=true
LABEL_PRINTER_TYPE=zpl  # zpl | epl
LABEL_PRINTER_DPI=203  # 203 | 300 | 600

# Barcode Scanners
BARCODE_SCANNER_TYPE=datawedge  # datawedge | keyboard_wedge
BARCODE_SCANNER_PREFIX=
BARCODE_SCANNER_SUFFIX=\n
```

---

### Email

```bash
# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME=TechShop
SMTP_FROM_EMAIL=noreply@techshop.ua

# Email Templates
EMAIL_TEMPLATES_DIR=/app/email-templates
EMAIL_LOGO_URL=https://techshop.ua/logo.png
```

**Для Gmail:**
1. Увімкніть двофакторну автентифікацію
2. Створіть пароль додатка: https://myaccount.google.com/apppasswords

---

### SMS

```bash
# Turbosms
TURBOSMS_LOGIN=your-login
TURBOSMS_PASSWORD=your-password
TURBOSMS_SENDER=TechShop
TURBOSMS_ENABLED=true

# SMS Settings
SMS_ENABLED=true
SMS_PROVIDER=turbosms  # turbosms | smsclub | kyivstar
SMS_SEND_ORDER_NOTIFICATIONS=true
SMS_SEND_SHIPPING_NOTIFICATIONS=true
```

---

### Маркетплейси

```bash
# Rozetka
ROZETKA_API_KEY=your-api-key
ROZETKA_SELLER_ID=your-seller-id
ROZETKA_ENABLED=true

# Prom.ua
PROM_API_KEY=your-api-key
PROM_ENABLED=true

# Marketplace Sync
MARKETPLACE_SYNC_ENABLED=true
MARKETPLACE_SYNC_SCHEDULE=0 */2 * * *  # Every 2 hours
MARKETPLACE_AUTO_UPDATE_STOCK=true
MARKETPLACE_AUTO_UPDATE_PRICES=false
```

---

### Storage (S3)

```bash
# AWS S3 / MinIO
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=eu-central-1
S3_BUCKET=techshop-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_USE_PATH_STYLE=false
S3_PUBLIC_URL=https://cdn.techshop.ua

# Upload Settings
UPLOAD_MAX_FILE_SIZE=10485760  # 10MB in bytes
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp,application/pdf
```

---

### Authentication

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here

# Session
SESSION_COOKIE_NAME=next-auth.session-token
SESSION_MAX_AGE=2592000  # 30 days in seconds
SESSION_UPDATE_AGE=86400  # 1 day

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=7d
JWT_REFRESH_EXPIRATION=30d
```

**Генерація секретів:**
```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### Monitoring та Logging

```bash
# Sentry
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
SENTRY_TRACE_SAMPLE_RATE=0.1

# Datadog
DATADOG_API_KEY=your-api-key
DATADOG_APP_KEY=your-app-key
DATADOG_ENABLED=false

# Logging
LOG_LEVEL=info  # error | warn | info | debug
LOG_FORMAT=json  # json | pretty
LOG_FILE=/var/log/shop.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7
```

---

### Безпека

```bash
# CORS
CORS_ENABLED=true
CORS_ORIGIN=https://techshop.ua,https://www.techshop.ua
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=60000  # 1 minute in ms
RATE_LIMIT_MAX_REQUESTS=100

# CSRF
CSRF_ENABLED=true
CSRF_SECRET=your-csrf-secret

# IP Whitelist (для webhooks)
IP_WHITELIST_MONOBANK=3.126.73.0/24,52.59.74.0/24
IP_WHITELIST_LIQPAY=91.230.252.0/24
```

---

### Feature Flags

```bash
# Features
FEATURE_B2B=true
FEATURE_SUPPLIER=true
FEATURE_FISCAL=true
FEATURE_AI_REPRICING=true
FEATURE_AI_FORECASTING=true
FEATURE_MARKETPLACES=true
FEATURE_LOYALTY=true
FEATURE_GIFT_CARDS=true
FEATURE_REVIEWS=true
FEATURE_CHAT=true
FEATURE_PUSH_NOTIFICATIONS=true

# Experimental
EXPERIMENTAL_WAREHOUSE_MAP=false
EXPERIMENTAL_CROSS_DOCKING=false
```

---

## Приклад .env файлу

### Development (.env.local)

```bash
# App
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shop_dev
REDIS_URL=redis://localhost:6379

# Checkbox (Test API)
CHECKBOX_API_URL=https://api.checkbox.in.ua/api/v1
CHECKBOX_LICENSE_KEY=test-license-key
CHECKBOX_CASHIER_LOGIN=test@example.com
CHECKBOX_CASHIER_PASSWORD=test123

# Payments (Test mode)
LIQPAY_PUBLIC_KEY=sandbox_public_key
LIQPAY_PRIVATE_KEY=sandbox_private_key

# Email (MailHog for development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=

# Features
FEATURE_B2B=true
FEATURE_FISCAL=true
AI_REPRICING_AUTO_APPLY=false

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
SENTRY_ENABLED=false
```

### Production (.env.production)

```bash
# App
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://techshop.ua

# Database (with SSL)
DATABASE_URL=postgresql://user:password@db.example.com:5432/shop
DATABASE_SSL=true
DATABASE_POOL_SIZE=50

# Redis (with password)
REDIS_URL=redis://:password@redis.example.com:6379
REDIS_DB=0

# Checkbox (Production)
CHECKBOX_API_URL=https://api.checkbox.ua/api/v1
CHECKBOX_LICENSE_KEY=prod-license-key-here
CHECKBOX_CASHIER_LOGIN=cashier@techshop.ua
CHECKBOX_CASHIER_PASSWORD=secure-production-password

# Payments (Production)
LIQPAY_PUBLIC_KEY=prod_public_key
LIQPAY_PRIVATE_KEY=prod_private_key
MONOBANK_TOKEN=prod_token

# Email (SendGrid/AWS SES)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@techshop.ua

# SMS
TURBOSMS_LOGIN=techshop
TURBOSMS_PASSWORD=secure-password
SMS_ENABLED=true

# S3 Storage
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
S3_BUCKET=techshop-prod
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
S3_PUBLIC_URL=https://cdn.techshop.ua

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENABLED=true
DATADOG_API_KEY=...
DATADOG_ENABLED=true

# Security
CORS_ORIGIN=https://techshop.ua
RATE_LIMIT_ENABLED=true
CSRF_ENABLED=true

# Features
FEATURE_B2B=true
FEATURE_SUPPLIER=true
FEATURE_FISCAL=true
AI_REPRICING_ENABLED=true
AI_REPRICING_AUTO_APPLY=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/var/log/shop/app.log
```

---

## Production vs Development

### Development

**Особливості:**
- Verbose logging (debug рівень)
- Hot reload
- Детальні помилки в браузері
- MailHog для email
- Mock external services
- Відключені rate limits
- Source maps увімкнені

**Налаштування:**
```bash
NODE_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=pretty
RATE_LIMIT_ENABLED=false
SENTRY_ENABLED=false
```

### Production

**Особливості:**
- Minimal logging (info/warn/error)
- Оптимізований build
- Generic error messages
- Real email service
- Real external services
- Rate limits увімкнені
- Source maps вимкнені
- HTTPS only
- HTTP-only cookies
- CSRF захист

**Налаштування:**
```bash
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
RATE_LIMIT_ENABLED=true
SENTRY_ENABLED=true
CORS_ENABLED=true
CSRF_ENABLED=true
DATABASE_SSL=true
```

---

## Конфігурація за модулями

### Fiscal Module

**Обов'язкові:**
```bash
CHECKBOX_LICENSE_KEY
CHECKBOX_CASHIER_LOGIN
CHECKBOX_CASHIER_PASSWORD
```

**Опційні:**
```bash
CHECKBOX_API_URL=https://api.checkbox.ua/api/v1
CHECKBOX_CASH_REGISTER_ID=  # Auto-select if empty
```

**Валідація:**
```bash
# Перевірка підключення
npm run test:fiscal
```

### B2B Module

**Обов'язкові:**
```bash
B2B_ENABLED=true
```

**Опційні (з defaults):**
```bash
B2B_MIN_ORDER_VALUE=5000
B2B_DEFAULT_COMMISSION_RATE=15
B2B_PAYMENT_TERM_DAYS=30
```

### Supplier Module

**Обов'язкові:**
```bash
SUPPLIER_ENABLED=true
SUPPLIER_DEFAULT_COMMISSION_RATE=15
```

**Опційні:**
```bash
SUPPLIER_AUTO_APPROVE_PRODUCTS=false
SUPPLIER_REQUIRE_MODERATION=true
SUPPLIER_MIN_PAYOUT_AMOUNT=1000
```

### AI Repricing

**Обов'язкові:**
```bash
AI_REPRICING_ENABLED=true
```

**Опційні:**
```bash
AI_REPRICING_SCHEDULE=0 */4 * * *
AI_REPRICING_AUTO_APPLY=false
AI_REPRICING_MIN_MARGIN=15
COMPETITOR_SCRAPING_ENABLED=true
```

**Competitor API Keys (JSON):**
```bash
COMPETITOR_API_KEYS='{"rozetka":"key1","citrus":"key2","foxtrot":"key3"}'
```

### Hardware Module

**Thermal Printer:**
```bash
THERMAL_PRINTER_ENABLED=true
THERMAL_PRINTER_DEFAULT_IP=192.168.1.100
THERMAL_PRINTER_DEFAULT_PORT=9100
```

**Label Printer:**
```bash
LABEL_PRINTER_ENABLED=true
LABEL_PRINTER_TYPE=zpl
LABEL_PRINTER_DPI=203
```

---

## Безпека

### Секрети

**НІКОЛИ не коммітьте секрети в Git!**

**Використовуйте:**
- `.env.local` для локальної розробки (в .gitignore)
- Environment variables в production
- Secret management tools (AWS Secrets Manager, HashiCorp Vault)

### Файл .gitignore

```gitignore
# Environment
.env
.env.local
.env.production
.env.*.local

# Secrets
*.key
*.pem
credentials.json
```

### Обертання секретів

**Рекомендації:**
- Змінюйте `NEXTAUTH_SECRET` кожні 90 днів
- Змінюйте `JWT_SECRET` при компрометації
- Змінюйте API ключі постачальників при підозрі
- Логуйте всі зміни секретів

### Валідація конфігурації

Створіть скрипт валідації:

```typescript
// scripts/validate-env.ts
const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'JWT_SECRET',
];

const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:');
  missingVars.forEach((varName) => console.error(`- ${varName}`));
  process.exit(1);
}

console.log('Environment validation passed ✓');
```

Запуск:
```bash
npm run validate-env
```

---

## Troubleshooting

### Checkbox API

**Помилка:** "Invalid credentials"
```bash
# Перевірте
echo $CHECKBOX_CASHIER_LOGIN
echo $CHECKBOX_CASHIER_PASSWORD

# Спробуйте тестові credentials
CHECKBOX_API_URL=https://api.checkbox.in.ua/api/v1
```

### Database Connection

**Помилка:** "Connection refused"
```bash
# Перевірте чи запущена БД
pg_isready -h localhost -p 5432

# Перевірте connection string
echo $DATABASE_URL
```

### Redis

**Помилка:** "ECONNREFUSED"
```bash
# Перевірте чи запущений Redis
redis-cli ping

# Перевірте URL
echo $REDIS_URL
```

### SMTP

**Помилка:** "Authentication failed"
```bash
# Для Gmail - використовуйте App Password
# https://myaccount.google.com/apppasswords

# Тест SMTP
npm run test:email
```

---

## Приклади для різних середовищ

### Docker Compose (.env.docker)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:postgres@db:5432/shop
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Kubernetes (ConfigMap + Secrets)

**ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: shop-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  FEATURE_B2B: "true"
```

**Secret:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: shop-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  JWT_SECRET: "..."
  CHECKBOX_LICENSE_KEY: "..."
```

### AWS ECS (Task Definition)

```json
{
  "environment": [
    {
      "name": "NODE_ENV",
      "value": "production"
    }
  ],
  "secrets": [
    {
      "name": "DATABASE_URL",
      "valueFrom": "arn:aws:secretsmanager:..."
    }
  ]
}
```

---

Створено: 2025-12-14
Версія: 1.0
