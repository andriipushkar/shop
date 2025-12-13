# Dropshipping Quick Start Guide

Швидкий старт для роботи з модулем дропшипінгу.

## Для постачальників

### Крок 1: Реєстрація

1. Перейдіть на `/supplier/register`
2. Заповніть форму реєстрації:
   - Назва компанії
   - Контактна особа
   - Email
   - Телефон
   - ЄДРПОУ (опціонально)

3. Очікуйте підтвердження від адміністратора

### Крок 2: Додавання товарів

#### Варіант А: Ручне додавання

```typescript
import { SupplierService } from '@/lib/dropshipping/supplier-service';

const service = new SupplierService();

await service.addProduct('YOUR_SUPPLIER_ID', {
  sku: 'UNIQUE-SKU-001',
  name: 'Назва товару',
  description: 'Детальний опис товару',
  price: 1000, // Ваша ціна (без комісії)
  retailPrice: 1200, // Рекомендована роздрібна (опціонально)
  stock: 50,
  category: 'Електроніка',
  brand: 'Samsung',
  images: [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
  ],
  attributes: {
    color: 'Чорний',
    size: 'M',
    warranty: '12 місяців',
  },
});
```

#### Варіант Б: Масовий імпорт CSV

Створіть CSV файл:

```csv
SKU,Name,Description,Price,RetailPrice,Stock,Category,Brand
PROD-001,Ноутбук HP,Потужний ноутбук,15000,18000,10,Електроніка,HP
PROD-002,Миша Logitech,Бездротова миша,500,700,100,Аксесуари,Logitech
```

Імпортуйте через інтерфейс `/supplier/products/import`

#### Варіант В: Автоматична синхронізація

Налаштуйте фід у профілі:

```typescript
import { StockSyncService } from '@/lib/dropshipping/stock-sync';

const syncService = new StockSyncService();

await syncService.configureFeed({
  supplierId: 'YOUR_SUPPLIER_ID',
  feedUrl: 'https://yoursite.com/feed.csv',
  format: 'csv',
  updateInterval: 60, // хвилини
  fieldMapping: {
    sku: 'article',
    stock: 'quantity',
    price: 'price',
    name: 'title',
  },
});
```

### Крок 3: Обробка замовлень

Коли ви отримуєте замовлення:

1. **Підтвердження** (статус: new → confirmed)
   ```typescript
   await service.confirmOrder('ORDER-ID');
   ```

2. **Відправка** (статус: confirmed → shipped)
   ```typescript
   await service.shipOrder('ORDER-ID', {
     trackingNumber: 'NP1234567890',
     trackingUrl: 'https://novaposhta.ua/tracking/NP1234567890',
     carrier: 'Нова Пошта',
   });
   ```

### Крок 4: Виплати

Запит на виплату прибутків:

```typescript
await service.requestPayout('YOUR_SUPPLIER_ID', 10000); // ₴10,000
```

## Для адміністраторів

### Схвалення постачальника

1. Перейдіть `/admin/suppliers`
2. Знайдіть постачальника зі статусом "Очікує"
3. Натисніть "Схвалити"
4. Встановіть ставку комісії

### Налаштування комісії

#### Глобальна ставка

```typescript
import { CommissionCalculator } from '@/lib/dropshipping/commission-calculator';

const calculator = new CommissionCalculator(15); // 15% для всіх
```

#### Індивідуальна для постачальника

```typescript
calculator.setCommissionRule({
  id: 'rule-supplier-001',
  type: 'supplier',
  targetId: 'SUP-001',
  rate: 12, // 12% для цього постачальника
  priority: 100,
});
```

#### Для категорії

```typescript
calculator.setCommissionRule({
  id: 'rule-category-electronics',
  type: 'category',
  targetId: 'electronics',
  rate: 10, // 10% для електроніки
  priority: 50,
});
```

#### Для конкретного товару

```typescript
calculator.setCommissionRule({
  id: 'rule-product-001',
  type: 'product',
  targetId: 'PROD-001',
  rate: 8, // 8% для цього товару
  priority: 200, // Найвищий пріоритет
});
```

### Схвалення товарів

Якщо `autoApprove = false`:

1. Перейдіть `/admin/suppliers/[id]/products`
2. Перегляньте нові товари
3. Схваліть або відхиліть з причиною

## Інтеграції

### Webhook для оновлень залишків

Постачальник може надіслати:

```bash
curl -X POST https://yourplatform.com/api/supplier/webhook \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "stock_update",
    "updates": [
      {
        "sku": "PROD-001",
        "stock": 150
      },
      {
        "sku": "PROD-002",
        "stock": 0,
        "price": 1500
      }
    ]
  }'
```

### API ключ

Отримайте API ключ після схвалення постачальника:
- Формат: `sk_SUPPLIER-ID_randomstring`
- Використовуйте в header `X-API-Key`

## Приклади використання

### Повний цикл роботи постачальника

```typescript
import { SupplierService } from '@/lib/dropshipping/supplier-service';

const service = new SupplierService();
const supplierId = 'SUP-001';

// 1. Додати товари
const product1 = await service.addProduct(supplierId, {
  sku: 'LAPTOP-HP-001',
  name: 'HP Pavilion 15',
  price: 15000,
  stock: 5,
  category: 'Ноутбуки',
});

// 2. Оновити залишки
await service.updateStock(supplierId, [
  { sku: 'LAPTOP-HP-001', stock: 10 },
]);

// 3. Перевірити замовлення
const orders = await service.getSupplierOrders(supplierId, {
  status: 'new',
});

// 4. Обробити замовлення
for (const order of orders) {
  // Підтвердити
  await service.confirmOrder(order.id);

  // Відправити
  await service.shipOrder(order.id, {
    trackingNumber: generateTrackingNumber(),
  });
}

// 5. Перевірити прибутки
const earnings = await service.getEarnings(supplierId, {
  from: new Date('2024-01-01'),
  to: new Date(),
});

console.log(`Прибуток: ₴${earnings.netEarnings}`);

// 6. Запросити виплату
if (earnings.netEarnings >= 1000) {
  await service.requestPayout(supplierId, earnings.netEarnings);
}
```

### Робота з комісією

```typescript
import { CommissionCalculator } from '@/lib/dropshipping/commission-calculator';

const calculator = new CommissionCalculator();

// Встановити правила
calculator.setCommissionRule({
  id: 'premium-supplier',
  type: 'supplier',
  targetId: 'SUP-001',
  rate: 8, // 8% для преміум постачальника
  priority: 100,
});

calculator.setCommissionRule({
  id: 'electronics-category',
  type: 'category',
  targetId: 'electronics',
  rate: 12,
  priority: 50,
});

// Розрахувати роздрібну ціну
const supplierPrice = 1000;
const retailPrice = calculator.calculateRetailPrice(
  supplierPrice,
  'SUP-001',
  'electronics'
);

console.log(`Ціна постачальника: ₴${supplierPrice}`);
console.log(`Роздрібна ціна: ₴${retailPrice}`);
console.log(`Комісія: ${calculator.getCommissionRate('SUP-001', 'electronics')}%`);

// Валідувати ціноутворення
const validation = calculator.validatePricing(
  retailPrice,
  supplierPrice,
  'SUP-001',
  'electronics'
);

if (!validation.valid) {
  console.error(validation.message);
}
```

### Синхронізація залишків

```typescript
import { StockSyncService } from '@/lib/dropshipping/stock-sync';

const syncService = new StockSyncService();

// Налаштувати CSV фід
await syncService.configureFeed({
  id: 'feed-001',
  supplierId: 'SUP-001',
  feedUrl: 'https://supplier.com/products.csv',
  format: 'csv',
  updateInterval: 60,
  enabled: true,
  fieldMapping: {
    sku: 'article',
    stock: 'qty',
    price: 'price',
    name: 'title',
  },
});

// Запустити синхронізацію вручну
const result = await syncService.syncNow('SUP-001');

console.log(`Успіх: ${result.success}`);
console.log(`Оновлено: ${result.updated} товарів`);

if (result.errors.length > 0) {
  console.error('Помилки:', result.errors);
}

// Планова синхронізація (викликається cron)
// Додайте в cron: */30 * * * * (кожні 30 хвилин)
await syncService.runScheduledSync();
```

## Тестування

### Mock дані для розробки

```typescript
// Mock supplier
const mockSupplier: Supplier = {
  id: 'SUP-TEST',
  companyName: 'Тестовий постачальник',
  contactPerson: 'Тест Тестович',
  email: 'test@test.com',
  phone: '+380501111111',
  status: 'active',
  commissionRate: 15,
  paymentTermDays: 14,
  autoApprove: true,
  createdAt: new Date(),
};

// Mock product
const mockProduct: SupplierProduct = {
  id: 'PROD-TEST',
  supplierId: 'SUP-TEST',
  sku: 'TEST-001',
  name: 'Тестовий товар',
  description: 'Опис',
  price: 1000,
  stock: 100,
  category: 'Тест',
  images: [],
  attributes: {},
  status: 'approved',
  lastStockUpdate: new Date(),
};

// Mock order
const mockOrder: SupplierOrder = {
  id: 'ORD-TEST',
  supplierId: 'SUP-TEST',
  platformOrderId: 'PLT-123',
  items: [
    {
      productId: 'PROD-TEST',
      sku: 'TEST-001',
      name: 'Тестовий товар',
      quantity: 2,
      price: 1000,
    },
  ],
  shippingAddress: {
    street: 'вул. Тестова, 1',
    city: 'Київ',
    postalCode: '01001',
    country: 'Україна',
  },
  status: 'new',
  supplierTotal: 2000,
  platformCommission: 300,
  createdAt: new Date(),
};
```

## Поширені помилки

### Помилка: "Товар з таким SKU вже існує"

**Рішення:** Використовуйте унікальні SKU для кожного товару.

### Помилка: "Роздрібна ціна нижче точки беззбитковості"

**Рішення:** Збільште роздрібну ціну або зменшіть ставку комісії.

### Помилка: "У вас вже є очікуюча виплата"

**Рішення:** Дочекайтеся обробки попередньої виплати.

### Помилка: "Замовлення повинно бути підтверджене перед відправкою"

**Рішення:** Спочатку підтвердіть замовлення, потім відправте.

## Підтримка

- Документація: `/docs/DROPSHIPPING.md`
- Email: support@example.com
- Telegram: @support_bot

## Наступні кроки

1. Ознайомтеся з повною документацією
2. Налаштуйте автоматичну синхронізацію
3. Інтегруйте webhook для реал-тайм оновлень
4. Налаштуйте автоматичні звіти
5. Оптимізуйте комісії для кращого прибутку
