# Fiscal Integration (ПРРО / Checkbox)

Система фіскалізації для українського ринку з інтеграцією Checkbox API та підтримкою ПРРО.

## Overview

Модуль fiscal забезпечує:
- Реєстрацію фіскальних чеків через Checkbox API
- Підтримку ПРРО (Програмний Реєстратор Розрахункових Операцій)
- Генерацію QR-кодів для чеків
- Формування Z-звітів
- Відповідність вимогам ДПС України

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FISCAL SYSTEM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                    ┌───────────────────────┐  │
│  │     POS      │                    │   Checkbox API        │  │
│  │   System     │───────────────────▶│                       │  │
│  └──────────────┘                    │  - Реєстрація чеків   │  │
│                                      │  - Z-звіти            │  │
│  ┌──────────────┐                    │  - X-звіти            │  │
│  │   Online     │───────────────────▶│  - Повернення         │  │
│  │   Orders     │                    │                       │  │
│  └──────────────┘                    └───────────┬───────────┘  │
│                                                   │              │
│                                                   ▼              │
│                                      ┌───────────────────────┐  │
│                                      │   ДПС України         │  │
│                                      │   (Фіскальний сервер) │  │
│                                      └───────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Checkbox API Integration

### Configuration

```bash
# Checkbox API
CHECKBOX_API_URL=https://api.checkbox.ua
CHECKBOX_LICENSE_KEY=your_license_key
CHECKBOX_CASHIER_LOGIN=cashier@shop.ua
CHECKBOX_CASHIER_PASSWORD=password
CHECKBOX_CASH_REGISTER_ID=uuid

# Tax settings
FISCAL_TAX_RATE=20          # ПДВ 20%
FISCAL_TAX_RATE_REDUCED=7   # Пільгова ставка 7%
FISCAL_TAX_EXEMPT=0         # Звільнено від ПДВ
```

### Receipt Types

| Type | Code | Description |
|------|------|-------------|
| Sale | `SELL` | Продаж товарів/послуг |
| Return | `RETURN` | Повернення товару |
| Service In | `SERVICE_IN` | Службове внесення |
| Service Out | `SERVICE_OUT` | Службове вилучення |

## Data Models

### Receipt (Чек)

```typescript
interface FiscalReceipt {
  id: string;
  type: 'SELL' | 'RETURN';
  fiscalCode: string;         // Фіскальний номер
  fiscalDate: Date;
  cashRegisterNum: string;    // Номер каси
  items: ReceiptItem[];
  payments: Payment[];
  totals: {
    sum: number;              // Загальна сума
    discount: number;         // Знижка
    taxSum: number;           // Сума ПДВ
  };
  taxes: TaxInfo[];
  qrCode: string;             // QR-код чека
  textReceipt: string;        // Текстове представлення
}

interface ReceiptItem {
  name: string;
  code: string;               // Код товару
  quantity: number;
  price: number;
  sum: number;
  discount?: number;
  taxCode: string;            // Код податку
}

interface TaxInfo {
  code: string;               // Код ПДВ (A, B, C...)
  rate: number;               // Ставка (20, 7, 0)
  sum: number;                // Сума податку
  turnover: number;           // Оборот
}
```

### Shift (Зміна)

```typescript
interface CashierShift {
  id: string;
  cashRegisterNum: string;
  openedAt: Date;
  closedAt?: Date;
  status: 'OPEN' | 'CLOSED';
  balance: number;
  salesCount: number;
  salesSum: number;
  returnsCount: number;
  returnsSum: number;
}
```

## Usage

### Initialize Fiscal Service

```typescript
import { FiscalService } from '@/lib/fiscal';

const fiscal = new FiscalService({
  apiUrl: process.env.CHECKBOX_API_URL,
  licenseKey: process.env.CHECKBOX_LICENSE_KEY,
  cashierLogin: process.env.CHECKBOX_CASHIER_LOGIN,
  cashierPassword: process.env.CHECKBOX_CASHIER_PASSWORD,
});
```

### Open Shift

```typescript
// Відкрити зміну
const shift = await fiscal.openShift({
  cashRegisterId: 'uuid',
});

console.log(`Shift opened: ${shift.id}`);
```

### Create Receipt

```typescript
// Створити чек продажу
const receipt = await fiscal.createReceipt({
  type: 'SELL',
  items: [
    {
      name: 'iPhone 15 Pro',
      code: 'PROD-123',
      quantity: 1,
      price: 45000.00,
      taxCode: 'A', // ПДВ 20%
    },
    {
      name: 'Чохол для iPhone',
      code: 'PROD-456',
      quantity: 2,
      price: 500.00,
      discount: 100.00,
      taxCode: 'A',
    },
  ],
  payments: [
    {
      type: 'CARD',
      sum: 45900.00,
    },
  ],
  footer: 'Дякуємо за покупку!',
});

console.log(`Fiscal code: ${receipt.fiscalCode}`);
console.log(`QR: ${receipt.qrCode}`);
```

### Process Return

```typescript
// Оформити повернення
const returnReceipt = await fiscal.createReceipt({
  type: 'RETURN',
  relatedReceiptId: 'original-receipt-id',
  items: [
    {
      name: 'Чохол для iPhone',
      code: 'PROD-456',
      quantity: 1,
      price: 450.00,
      taxCode: 'A',
    },
  ],
  payments: [
    {
      type: 'CASH',
      sum: 450.00,
    },
  ],
});
```

### Close Shift (Z-Report)

```typescript
// Закрити зміну та отримати Z-звіт
const zReport = await fiscal.closeShift({
  shiftId: shift.id,
});

console.log('Z-Report:', {
  salesCount: zReport.salesCount,
  salesSum: zReport.salesSum,
  returnsCount: zReport.returnsCount,
  returnsSum: zReport.returnsSum,
  balance: zReport.balance,
});
```

### Get X-Report

```typescript
// Отримати X-звіт (без закриття зміни)
const xReport = await fiscal.getXReport({
  shiftId: shift.id,
});
```

## Tax Codes

| Code | Rate | Description |
|------|------|-------------|
| A | 20% | Стандартна ставка ПДВ |
| B | 7% | Пільгова ставка |
| C | 0% | Нульова ставка |
| D | 0% | Звільнено від ПДВ |

## Receipt Format

```
======================================
         ТОВ "МОЙ МАГАЗИН"
      м. Київ, вул. Хрещатик, 1
         тел. 044-123-45-67
--------------------------------------
ФН: 4000123456
ІД: 12345678901234
--------------------------------------
iPhone 15 Pro
    1 x 45000.00 =           45000.00
Чохол для iPhone
    2 x 500.00 =              1000.00
    Знижка                    -100.00
--------------------------------------
СУМА                         45900.00
ПДВ A 20%                     7650.00
--------------------------------------
Картка                       45900.00
======================================
           ФІСКАЛЬНИЙ ЧЕК
ФН чека: 1234567890
Дата: 15.01.2024 14:30:00
======================================
[QR CODE]
```

## API Endpoints

```
POST /api/v1/fiscal/shifts/open      # Відкрити зміну
POST /api/v1/fiscal/shifts/close     # Закрити зміну (Z-звіт)
GET  /api/v1/fiscal/shifts/current   # Поточна зміна
GET  /api/v1/fiscal/shifts/:id       # Інформація про зміну

POST /api/v1/fiscal/receipts         # Створити чек
GET  /api/v1/fiscal/receipts/:id     # Отримати чек
GET  /api/v1/fiscal/receipts/:id/qr  # QR-код чека
GET  /api/v1/fiscal/receipts/:id/pdf # PDF чека

GET  /api/v1/fiscal/reports/x        # X-звіт
GET  /api/v1/fiscal/reports/z/:date  # Z-звіт за дату

POST /api/v1/fiscal/service/in       # Службове внесення
POST /api/v1/fiscal/service/out      # Службове вилучення
```

## POS Integration

```typescript
// In POS component
const handlePayment = async (transaction: POSTransaction) => {
  // 1. Create fiscal receipt
  const receipt = await fiscal.createReceipt({
    type: 'SELL',
    items: transaction.items.map(item => ({
      name: item.name,
      code: item.sku,
      quantity: item.quantity,
      price: item.price,
      taxCode: 'A',
    })),
    payments: transaction.payments.map(p => ({
      type: p.method === 'cash' ? 'CASH' : 'CARD',
      sum: p.amount,
    })),
  });

  // 2. Print receipt
  await printReceipt(receipt.textReceipt);

  // 3. Update order with fiscal data
  await updateOrder(transaction.orderId, {
    fiscalCode: receipt.fiscalCode,
    fiscalDate: receipt.fiscalDate,
  });
};
```

## Error Handling

| Error Code | Description | Action |
|------------|-------------|--------|
| `SHIFT_NOT_OPENED` | Зміна не відкрита | Відкрити зміну |
| `SHIFT_ALREADY_OPENED` | Зміна вже відкрита | Використати поточну |
| `RECEIPT_VALIDATION_ERROR` | Помилка валідації | Перевірити дані |
| `FISCAL_SERVER_ERROR` | Помилка сервера ДПС | Повторити пізніше |
| `CONNECTION_ERROR` | Немає з'єднання | Перевірити інтернет |

## Offline Mode

При відсутності інтернету:
1. Чеки зберігаються локально
2. При відновленні з'єднання - автоматична синхронізація
3. Є ліміт на кількість офлайн чеків

```typescript
// Check online status
const isOnline = await fiscal.checkConnection();

if (!isOnline) {
  // Save to offline queue
  await fiscal.queueOfflineReceipt(receipt);
}

// Sync offline receipts
await fiscal.syncOfflineReceipts();
```

## Reporting

### Daily Report
```typescript
const dailyReport = await fiscal.getDailyReport(new Date('2024-01-15'));
// Includes: sales, returns, taxes, cash movements
```

### Monthly Report
```typescript
const monthlyReport = await fiscal.getMonthlyReport(2024, 1);
// Aggregated data for the month
```

## Compliance

- Відповідність Закону України "Про застосування РРО"
- Сертифікація ПРРО згідно вимог ДПС
- Зберігання даних протягом 3 років
- Автоматична передача даних до ДПС

## See Also

- [POS System](./WAREHOUSE.md#pos-point-of-sale)
- [Payments](./PAYMENTS.md)
- [Orders](./ORDERS.md)
- [Hardware Integration](./HARDWARE.md)
