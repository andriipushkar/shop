# API Quick Start Guide

Швидкий старт для роботи з Storefront API.

## Доступ до документації

### Інтерактивна Swagger UI

Відкрийте у браузері:

```
http://localhost:3000/api-docs
```

Тут ви можете:
- Переглянути всі доступні ендпоінти
- Протестувати API запити безпосередньо з браузера
- Переглянути схеми даних
- Експортувати OpenAPI специфікацію

### JSON специфікація

Отримати OpenAPI специфікацію у форматі JSON:

```bash
curl http://localhost:3000/api/docs
```

## Швидкі приклади

### 1. Отримати список продуктів

```bash
curl http://localhost:3000/api/products
```

### 2. Пошук продуктів

```bash
curl "http://localhost:3000/api/search?q=laptop"
```

### 3. Отримати категорії

```bash
curl http://localhost:3000/api/categories
```

### 4. Створити замовлення

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "test@example.com",
    "customerPhone": "+380501234567",
    "customerName": "Test User",
    "items": [
      {
        "productId": "prod123",
        "sku": "SKU-001",
        "name": "Product",
        "price": 999.99,
        "quantity": 1
      }
    ]
  }'
```

## Адміністративні API

Для адміністративних endpoints потрібна автентифікація:

```bash
# 1. Отримати JWT токен через NextAuth
# (зазвичай автоматично при вході в систему)

# 2. Використовувати токен в запитах
curl http://localhost:3000/api/admin/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Структура файлів

```
├── lib/api-docs/
│   └── openapi.ts              # OpenAPI 3.0 специфікація
├── app/api/docs/
│   └── route.ts                # Endpoint для JSON специфікації
├── app/api-docs/
│   └── page.tsx                # Swagger UI сторінка
└── docs/api/
    ├── README.md               # Повна документація
    └── QUICK_START.md          # Цей файл
```

## Наступні кроки

1. Ознайомтесь з повною документацією: [README.md](./README.md)
2. Відкрийте Swagger UI: http://localhost:3000/api-docs
3. Протестуйте API endpoints
4. Інтегруйте у свій додаток

## Корисні посилання

- OpenAPI Specification: https://swagger.io/specification/
- Swagger UI: https://swagger.io/tools/swagger-ui/
- NextAuth.js: https://next-auth.js.org/
