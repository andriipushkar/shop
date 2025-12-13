# Dropshipping/Supplier Portal Module

Повний модуль управління постачальниками та дропшипінгом з українською локалізацією.

## Огляд

Цей модуль надає повнофункціональну систему для роботи з постачальниками у моделі дропшипінгу:

- **Кабінет постачальника** - повний функціонал для управління товарами та замовленнями
- **Адміністрування** - контроль над постачальниками, комісіями та затвердженням товарів
- **Автоматизація** - синхронізація залишків, webhook інтеграції
- **Фінанси** - облік прибутків, комісій та виплат

## Структура файлів

### Core Services (lib/dropshipping/)

#### 1. supplier-service.ts
Основний сервіс для роботи з постачальниками:

```typescript
import { SupplierService } from '@/lib/dropshipping/supplier-service';

const service = new SupplierService();

// Реєстрація постачальника
await service.registerSupplier({
  companyName: 'ТОВ "Постачальник"',
  contactPerson: 'Іван Іванов',
  email: 'ivan@supplier.ua',
  phone: '+380501234567',
  edrpou: '12345678',
});

// Додавання товару
await service.addProduct(supplierId, {
  sku: 'PROD-001',
  name: 'Товар 1',
  description: 'Опис товару',
  price: 1000,
  stock: 50,
  category: 'Електроніка',
});

// Управління замовленнями
await service.confirmOrder(orderId);
await service.shipOrder(orderId, {
  trackingNumber: 'TRK123456789',
  trackingUrl: 'https://tracking.example.com/TRK123456789',
});
```

**Основні можливості:**
- Реєстрація та управління постачальниками
- CRUD операції з товарами
- Масовий імпорт/експорт товарів
- Управління залишками
- Обробка замовлень
- Фінансова звітність

#### 2. commission-calculator.ts
Розрахунок комісії платформи:

```typescript
import { CommissionCalculator } from '@/lib/dropshipping/commission-calculator';

const calculator = new CommissionCalculator(15); // 15% default

// Розрахунок комісії для замовлення
const breakdown = calculator.calculateOrderCommission(order);
console.log(`Комісія: ₴${breakdown.commission}`);
console.log(`Постачальник отримає: ₴${breakdown.supplierAmount}`);

// Розрахунок роздрібної ціни
const retailPrice = calculator.calculateRetailPrice(
  supplierPrice: 1000,
  supplierId: 'SUP-001',
  categoryId: 'electronics'
);

// Встановлення правил комісії
calculator.setCommissionRule({
  id: 'rule-1',
  type: 'category',
  targetId: 'electronics',
  rate: 12, // 12% для категорії електроніки
  priority: 100,
});
```

**Функціонал:**
- Розрахунок комісії на рівні товару/категорії/постачальника
- Автоматичний розрахунок роздрібних цін
- Валідація ціноутворення
- Гнучкі правила комісії з пріоритетами

#### 3. stock-sync.ts
Автоматична синхронізація залишків:

```typescript
import { StockSyncService } from '@/lib/dropshipping/stock-sync';

const syncService = new StockSyncService();

// Налаштування фіду
await syncService.configureFeed({
  id: 'feed-1',
  supplierId: 'SUP-001',
  feedUrl: 'https://supplier.com/feed.csv',
  format: 'csv',
  updateInterval: 60, // кожну годину
  enabled: true,
  fieldMapping: {
    sku: 'article',
    stock: 'quantity',
    price: 'price',
  },
});

// Ручна синхронізація
const result = await syncService.syncNow('SUP-001');
console.log(`Оновлено ${result.updated} товарів`);

// Webhook обробка
await syncService.handleStockWebhook('SUP-001', [
  { sku: 'PROD-001', stock: 100 },
  { sku: 'PROD-002', stock: 50, price: 1500 },
]);
```

**Підтримувані формати:**
- CSV
- XML
- YML (Yandex Market Language)
- JSON

### API Routes (app/api/supplier/)

#### Endpoints

**Реєстрація та профіль:**
- `POST /api/supplier/register` - Реєстрація нового постачальника
- `GET /api/supplier/profile` - Отримання профілю
- `PUT /api/supplier/profile` - Оновлення профілю

**Товари:**
- `GET /api/supplier/products` - Список товарів з фільтрами
- `POST /api/supplier/products` - Додавання товару
- `PUT /api/supplier/products/[id]` - Оновлення товару
- `DELETE /api/supplier/products/[id]` - Видалення товару
- `POST /api/supplier/products/import` - Масовий імпорт
- `GET /api/supplier/products/export` - Експорт товарів

**Залишки:**
- `POST /api/supplier/stock` - Оновлення залишків

**Замовлення:**
- `GET /api/supplier/orders` - Список замовлень
- `PUT /api/supplier/orders/[id]/confirm` - Підтвердити замовлення
- `PUT /api/supplier/orders/[id]/ship` - Відправити замовлення

**Фінанси:**
- `GET /api/supplier/earnings` - Звіт про прибутки
- `GET /api/supplier/payout` - Список виплат
- `POST /api/supplier/payout` - Запит на виплату

**Інтеграції:**
- `POST /api/supplier/webhook` - Webhook для оновлень

#### Приклади запитів

**Додавання товару:**
```bash
curl -X POST https://example.com/api/supplier/products \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "SUP-001",
    "sku": "PROD-001",
    "name": "Ноутбук HP",
    "description": "Потужний ноутбук",
    "price": 15000,
    "retailPrice": 18000,
    "stock": 10,
    "category": "Електроніка",
    "images": ["https://example.com/image.jpg"]
  }'
```

**Оновлення залишків:**
```bash
curl -X POST https://example.com/api/supplier/stock \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "SUP-001",
    "updates": [
      { "sku": "PROD-001", "stock": 20 },
      { "sku": "PROD-002", "stock": 15, "price": 5000 }
    ]
  }'
```

**Webhook від постачальника:**
```bash
curl -X POST https://example.com/api/supplier/webhook \
  -H "X-API-Key: sk_SUP-001_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "stock_update",
    "updates": [
      { "sku": "PROD-001", "stock": 25 }
    ]
  }'
```

### Supplier Portal Pages (app/supplier/)

#### 1. Dashboard (/supplier/page.tsx)
Головна панель постачальника:

**Функції:**
- Статистика (товари, замовлення, прибутки)
- Останні замовлення
- Сповіщення про низькі залишки
- Швидкі дії

**Використовувані компоненти:**
- StatCard - картки статистики
- OrderStatusBadge - бейджі статусу

#### 2. Products (/supplier/products/page.tsx)
Управління товарами:

**Функції:**
- Перегляд всіх товарів
- Фільтрація (статус, категорія, залишки)
- Пошук по SKU/назві
- Експорт в CSV
- Масове редагування

**Фільтри:**
- Статус: pending, approved, rejected
- Залишки: in-stock, low-stock, out-of-stock
- Категорії
- Пошуковий запит

#### 3. Orders (/supplier/orders/page.tsx)
Обробка замовлень:

**Функції:**
- Перегляд замовлень з фільтрацією
- Підтвердження нових замовлень
- Додавання трекінг-номерів
- Перегляд адрес доставки

**Статуси замовлень:**
- new - Нове замовлення (потрібне підтвердження)
- confirmed - Підтверджено (готове до відправки)
- shipped - Відправлено
- delivered - Доставлено
- cancelled - Скасовано

#### 4. Earnings (/supplier/earnings/page.tsx)
Фінанси та виплати:

**Функції:**
- Звіт про прибутки (тиждень/місяць/рік)
- Графік прибутків по днях
- Розбивка комісії
- Запит на виплату
- Історія виплат

**Показники:**
- Загальний дохід
- Комісія платформи
- Чистий прибуток
- Кількість замовлень

### Admin Pages (app/admin/suppliers/)

#### Supplier Management (/admin/suppliers/page.tsx)

**Функції адміністратора:**
- Перегляд всіх постачальників
- Схвалення нових постачальників
- Призупинення постачальників
- Налаштування індивідуальних ставок комісії
- Перегляд товарів та замовлень постачальника

**Статуси постачальників:**
- pending - Очікує схвалення
- active - Активний
- suspended - Призупинений

**Фільтрація:**
- За статусом
- За датою реєстрації

## Workflow

### 1. Реєстрація постачальника

```
Постачальник                    Система                     Адміністратор
     |                             |                              |
     |--POST /api/supplier/------→|                              |
     |    register                 |                              |
     |                             |                              |
     |←--201 Created--------------| Status: pending             |
     |    (waiting approval)       |                              |
     |                             |                              |
     |                             |---Email notification--------→|
     |                             |                              |
     |                             |                              |
     |                             |←--Approve supplier----------|
     |                             | Status: active              |
     |←--Email notification--------|                              |
     |    (approved)               |                              |
```

### 2. Додавання товару

```
Постачальник                    Система                     Адміністратор
     |                             |                              |
     |--POST /api/supplier/------→|                              |
     |    products                 |                              |
     |                             |                              |
     |←--201 Created--------------| Status: pending             |
     |                             | (if autoApprove = false)    |
     |                             |                              |
     |                             |---Notification--------------→|
     |                             |                              |
     |                             |←--Approve/Reject product----|
     |                             |                              |
     |←--Notification-------------|                              |
```

### 3. Обробка замовлення

```
Клієнт          Платформа           Постачальник           Система
  |                 |                     |                    |
  |--Place order---→|                     |                    |
  |                 |                     |                    |
  |                 |---Create supplier--→|                    |
  |                 |    order (new)      |                    |
  |                 |                     |                    |
  |                 |                     |←--Notification-----|
  |                 |                     |                    |
  |                 |                     |--Confirm order----→|
  |                 |                     |                    |
  |                 |                     |--Ship order-------→|
  |                 |                     | (tracking number)  |
  |                 |                     |                    |
  |                 |←--Update order------|                    |
  |                 |    status           |                    |
  |                 |                     |                    |
  |←--Notification--|                     |                    |
  | (tracking info) |                     |                    |
```

### 4. Виплата прибутків

```
Постачальник                    Система                     Фінанси
     |                             |                              |
     |--Request payout------------→|                              |
     |    ₴10,000                  |                              |
     |                             |                              |
     |←--201 Created--------------| Status: pending             |
     |    Payout request           |                              |
     |                             |                              |
     |                             |---Process payout------------→|
     |                             |                              |
     |                             |←--Confirm transfer----------|
     |                             | Status: completed           |
     |                             |                              |
     |←--Email notification--------|                              |
     |    (payout completed)       |                              |
```

## Інтеграції

### 1. Stock Feed Sync

Автоматична синхронізація залишків з фідів постачальників:

**CSV приклад:**
```csv
SKU,Name,Stock,Price
PROD-001,Товар 1,100,1000
PROD-002,Товар 2,50,2000
```

**XML приклад:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <products>
    <product>
      <sku>PROD-001</sku>
      <name>Товар 1</name>
      <stock>100</stock>
      <price>1000</price>
    </product>
  </products>
</catalog>
```

**YML приклад:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog>
  <shop>
    <offers>
      <offer id="PROD-001" available="true">
        <price>1000</price>
        <name>Товар 1</name>
      </offer>
    </offers>
  </shop>
</yml_catalog>
```

### 2. Webhook Integration

Постачальники можуть надсилати реал-тайм оновлення:

```javascript
// Приклад webhook від постачальника
fetch('https://platform.com/api/supplier/webhook', {
  method: 'POST',
  headers: {
    'X-API-Key': 'sk_SUP-001_xxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'stock_update',
    updates: [
      { sku: 'PROD-001', stock: 25 },
      { sku: 'PROD-002', stock: 0 },
    ],
  }),
});
```

## Комісії

### Ієрархія правил

Система застосовує комісію в наступному порядку (від вищого до нижчого пріоритету):

1. **Product-specific** - індивідуальна ставка для товару
2. **Category-specific** - ставка для категорії
3. **Supplier-specific** - ставка для постачальника
4. **Default** - базова ставка (15%)

### Приклади розрахунку

**Приклад 1: Базова комісія**
```
Ціна постачальника: ₴1,000
Комісія платформи: 15%
Комісія: ₴150
Постачальник отримує: ₴850
```

**Приклад 2: Роздрібна ціна**
```
Ціна постачальника: ₴1,000
Комісія: 15%
Роздрібна ціна: ₴1,000 / (1 - 0.15) = ₴1,176.47
Маржа магазину: ₴176.47
```

**Приклад 3: Індивідуальна комісія**
```
Категорія: Електроніка
Базова комісія: 15%
Комісія для електроніки: 10%

Ціна постачальника: ₴1,000
Застосовується: 10%
Комісія: ₴100
Постачальник отримує: ₴900
```

## Безпека

### API Authentication

Всі запити постачальників повинні включати API ключ:

```javascript
headers: {
  'X-API-Key': 'sk_SUP-001_xxxxxxxxxxxxx'
}
```

### Validation

- Перевірка ЄДРПОУ коду (опціонально)
- Валідація email та телефону
- Перевірка цін та залишків
- Sanitization даних

### Permissions

**Постачальник може:**
- Переглядати тільки свої товари
- Переглядати тільки свої замовлення
- Оновлювати тільки свої товари
- Запитувати виплати в межах балансу

**Адміністратор може:**
- Переглядати всіх постачальників
- Схвалювати/відхиляти постачальників
- Схвалювати/відхиляти товари
- Встановлювати комісії
- Обробляти виплати

## Переклади (Ukrainian)

Всі інтерфейси та повідомлення українською мовою:

```typescript
const translations = {
  // Статуси постачальників
  'supplier.status.pending': 'Очікує схвалення',
  'supplier.status.active': 'Активний',
  'supplier.status.suspended': 'Призупинений',

  // Статуси товарів
  'product.status.pending': 'Очікує схвалення',
  'product.status.approved': 'Схвалено',
  'product.status.rejected': 'Відхилено',

  // Статуси замовлень
  'order.status.new': 'Новий',
  'order.status.confirmed': 'Підтверджено',
  'order.status.shipped': 'Відправлено',
  'order.status.delivered': 'Доставлено',
  'order.status.cancelled': 'Скасовано',

  // Статуси виплат
  'payout.status.pending': 'Очікує',
  'payout.status.processing': 'Обробляється',
  'payout.status.completed': 'Завершено',
  'payout.status.failed': 'Помилка',
};
```

## Майбутні покращення

### Planned Features

1. **Multi-warehouse support** - підтримка кількох складів
2. **Advanced analytics** - детальна аналітика продажів
3. **Automatic pricing** - автоматичне ціноутворення
4. **Product recommendations** - рекомендації товарів
5. **Rating system** - система рейтингу постачальників
6. **Dispute resolution** - система вирішення спорів
7. **Bulk operations** - масові операції
8. **API documentation** - повна документація API

### Optimization Ideas

- Кешування списків товарів
- Queue system для синхронізації
- Асинхронна обробка імпорту
- CDN для зображень товарів
- Elasticsearch для пошуку

## Підтримка

Для питань та підтримки:
- Email: support@example.com
- Документація: https://docs.example.com
- GitHub: https://github.com/example/dropshipping

## Ліцензія

MIT License - see LICENSE file for details
