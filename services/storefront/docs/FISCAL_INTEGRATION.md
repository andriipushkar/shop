# ПРРО - Checkbox Integration Documentation

## Документація інтеграції з Checkbox (Програмний Реєстратор Розрахункових Операцій)

This document describes the complete Ukrainian fiscal cash register integration with Checkbox API.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

This integration provides full support for Ukrainian fiscal compliance using the Checkbox ПРРО service. It includes:

- **Shift Management**: Open/close shifts with automatic Z-report generation
- **Receipt Creation**: Generate fiscal receipts for sales and returns
- **Service Operations**: Cash deposits and withdrawals
- **Reporting**: Daily and period reports
- **Receipt Lookup**: Search receipts by fiscal code

### Features

- ✅ Full TypeScript support with comprehensive types
- ✅ Automatic token management and refresh
- ✅ Amount handling in kopecks (100 kopecks = 1 UAH)
- ✅ Ukrainian tax rates support (0%, 7%, 20% VAT)
- ✅ PDF and QR code receipt generation
- ✅ Admin UI for fiscal operations
- ✅ Error handling and validation

## Setup

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.fiscal.example .env.local
```

Edit `.env.local` and add your Checkbox credentials:

```env
CHECKBOX_API_URL=https://api.checkbox.ua/api/v1
CHECKBOX_LICENSE_KEY=your_license_key_here
CHECKBOX_CASHIER_LOGIN=your_cashier_login
CHECKBOX_CASHIER_PASSWORD=your_cashier_password
DEFAULT_TAX_RATE=20
```

### 2. Getting Checkbox Credentials

1. Register at [checkbox.ua](https://checkbox.ua/)
2. Get your license key from the admin panel
3. Create a cashier account with login and password
4. Register your cash register and get the fiscal number

### 3. Install Dependencies

All required dependencies are already included in the Next.js project.

## Architecture

### File Structure

```
services/storefront/
├── lib/fiscal/
│   ├── checkbox-api.ts          # Low-level Checkbox API client
│   └── prro-service.ts           # High-level business logic service
├── app/api/admin/fiscal/
│   ├── shift/
│   │   ├── open/route.ts        # Open shift
│   │   ├── close/route.ts       # Close shift (Z-report)
│   │   └── status/route.ts      # Get shift status
│   ├── receipt/
│   │   ├── route.ts             # Create receipt
│   │   └── [id]/route.ts        # Get receipt by ID
│   ├── return/route.ts          # Process return
│   ├── service/
│   │   ├── deposit/route.ts     # Cash deposit
│   │   └── withdraw/route.ts    # Cash withdrawal
│   └── reports/
│       ├── daily/route.ts       # Daily report
│       └── period/route.ts      # Period report
└── app/admin/pos/fiscal/
    └── page.tsx                  # Admin UI
```

### Components

#### 1. CheckboxClient (`lib/fiscal/checkbox-api.ts`)

Low-level API client that handles:
- Authentication and token management
- HTTP requests to Checkbox API
- Amount conversion (UAH ↔ kopecks)
- Error handling

```typescript
import { CheckboxClient } from '@/lib/fiscal/checkbox-api';

const client = new CheckboxClient({
  apiUrl: 'https://api.checkbox.ua/api/v1',
  licenseKey: 'your_key',
  cashierLogin: 'login',
  cashierPassword: 'password',
});

// Sign in and select cash register
await client.signIn();
const registers = await client.getCashRegisters();
await client.selectCashRegister(registers[0].id);

// Open shift
const shift = await client.openShift();

// Create receipt
const receipt = await client.createReceipt({
  goods: [{
    good: {
      code: 'SKU001',
      name: 'Product Name',
      price: 10000, // 100.00 UAH in kopecks
    },
    quantity: 1000, // 1.000 pieces
  }],
  payments: [{
    type: 'CASH',
    value: 10000, // 100.00 UAH
  }],
});
```

#### 2. PRROService (`lib/fiscal/prro-service.ts`)

High-level service that wraps CheckboxClient with business logic:
- Automatic initialization
- Simplified API (amounts in UAH, not kopecks)
- Tax handling
- Receipt mapping

```typescript
import { prroService } from '@/lib/fiscal/prro-service';

// Initialize (happens automatically on first use)
await prroService.initialize();

// Fiscalize an order
const result = await prroService.fiscalizeOrder({
  orderId: 'ORDER-123',
  items: [{
    sku: 'SKU001',
    name: 'Product Name',
    price: 100.00, // UAH
    quantity: 1,
    taxRate: 20, // 20% VAT
  }],
  payments: [{
    type: 'cash',
    amount: 100.00, // UAH
  }],
  customer: {
    email: 'customer@example.com',
  },
});

if (result.success) {
  console.log('Fiscal code:', result.fiscalCode);
  console.log('Receipt URL:', result.receiptUrl);
}
```

## API Endpoints

### Shift Management

#### Open Shift
```http
POST /api/admin/fiscal/shift/open
Content-Type: application/json

{
  "cashierId": "optional_cashier_id"
}
```

Response:
```json
{
  "success": true,
  "shift": {
    "id": "shift-id",
    "serial": 1,
    "openedAt": "2025-12-14T10:00:00Z",
    "balance": 0
  },
  "message": "Зміну відкрито успішно"
}
```

#### Close Shift (Z-Report)
```http
POST /api/admin/fiscal/shift/close
Content-Type: application/json

{
  "cashierId": "optional_cashier_id"
}
```

#### Get Shift Status
```http
GET /api/admin/fiscal/shift/status?cashierId=optional_cashier_id
```

### Receipt Operations

#### Create Receipt
```http
POST /api/admin/fiscal/receipt
Content-Type: application/json

{
  "orderId": "ORDER-123",
  "items": [{
    "sku": "SKU001",
    "name": "Product Name",
    "price": 100.00,
    "quantity": 1,
    "taxRate": 20
  }],
  "payments": [{
    "type": "cash",
    "amount": 100.00
  }],
  "customer": {
    "email": "customer@example.com"
  }
}
```

#### Get Receipt
```http
GET /api/admin/fiscal/receipt/{id_or_fiscal_code}
```

#### Process Return
```http
POST /api/admin/fiscal/return
Content-Type: application/json

{
  "originalFiscalCode": "FISCAL123",
  "items": [{
    "sku": "SKU001",
    "name": "Product Name",
    "price": 100.00,
    "quantity": 1
  }]
}
```

### Service Operations

#### Cash Deposit
```http
POST /api/admin/fiscal/service/deposit
Content-Type: application/json

{
  "amount": 1000.00
}
```

#### Cash Withdrawal
```http
POST /api/admin/fiscal/service/withdraw
Content-Type: application/json

{
  "amount": 500.00
}
```

### Reports

#### Daily Report
```http
GET /api/admin/fiscal/reports/daily?date=2025-12-14
```

#### Period Report
```http
GET /api/admin/fiscal/reports/period?from=2025-12-01&to=2025-12-14
```

## Usage Examples

### Example 1: Complete Sales Flow

```typescript
// 1. Open shift at the start of the day
const shift = await prroService.openCashierShift('cashier-1');

// 2. Process a sale
const saleResult = await prroService.fiscalizeOrder({
  orderId: 'ORDER-001',
  items: [
    {
      sku: 'PROD-1',
      name: 'Laptop',
      price: 25000.00,
      quantity: 1,
      taxRate: 20,
      barcode: '4820000000001',
    },
    {
      sku: 'PROD-2',
      name: 'Mouse',
      price: 500.00,
      quantity: 2,
      taxRate: 20,
    }
  ],
  payments: [
    { type: 'card', amount: 26000.00 }
  ],
  customer: {
    email: 'customer@example.com',
    phone: '+380501234567',
  },
  header: 'ТОВ "Моя Компанія"',
  footer: 'Дякуємо за покупку!',
});

console.log('Fiscal code:', saleResult.fiscalCode);

// 3. Process a return
const returnResult = await prroService.fiscalizeReturn(
  saleResult.fiscalCode!,
  [{
    sku: 'PROD-2',
    name: 'Mouse',
    price: 500.00,
    quantity: 1,
  }]
);

// 4. Close shift at end of day
const zReport = await prroService.closeCashierShift('cashier-1');
console.log('Z-Report:', zReport.serial, zReport.fiscalCode);
```

### Example 2: Service Operations

```typescript
// Deposit cash at the start of the day
await prroService.depositCash(5000.00);

// Withdraw cash for bank deposit
await prroService.withdrawCash(10000.00);
```

### Example 3: Receipt Lookup

```typescript
// Get receipt by fiscal code
const receipt = await prroService.getReceiptByFiscalCode('FISCAL123');

if (receipt) {
  console.log('Receipt total:', receipt.total);
  console.log('Items:', receipt.items);

  // Get PDF
  const pdf = await prroService.getReceiptPdf(receipt.id);

  // Resend to customer
  await prroService.resendReceiptToCustomer(
    receipt.id,
    'newcustomer@example.com'
  );
}
```

## Testing

### Testing with Checkbox Test Environment

Checkbox provides a test environment for development:

```env
CHECKBOX_API_URL=https://dev-api.checkbox.ua/api/v1
```

### Manual Testing Steps

1. **Open Admin UI**: Navigate to `/admin/pos/fiscal`
2. **Open Shift**: Click "Відкрити зміну"
3. **Test Service Operations**:
   - Deposit 1000 UAH
   - Withdraw 500 UAH
4. **Create Test Receipt**: Use API or create order
5. **Search Receipt**: Enter fiscal code in search
6. **Close Shift**: Generate Z-report

### Testing Checklist

- [ ] Can sign in to Checkbox
- [ ] Can select cash register
- [ ] Can open shift
- [ ] Can create sale receipt
- [ ] Can create return receipt
- [ ] Can deposit cash
- [ ] Can withdraw cash
- [ ] Can search receipt by fiscal code
- [ ] Can close shift and generate Z-report
- [ ] PDF receipts are generated
- [ ] QR codes work

## Troubleshooting

### Common Issues

#### 1. "No active cash register found"

**Solution**: Register a cash register in Checkbox admin panel and ensure it's marked as active.

#### 2. "No open shift"

**Solution**: Open a shift before creating receipts:
```typescript
await prroService.openCashierShift('cashier-id');
```

#### 3. "Authentication failed"

**Solution**: Check credentials in `.env.local`:
- Verify license key
- Verify cashier login/password
- Ensure using correct API URL (prod vs dev)

#### 4. "Amount mismatch"

**Solution**: Ensure total of items equals total of payments:
```typescript
const itemsTotal = items.reduce((sum, item) =>
  sum + (item.price * item.quantity), 0
);
const paymentsTotal = payments.reduce((sum, p) =>
  sum + p.amount, 0
);
// These should match
```

#### 5. Token expired

The service automatically handles token refresh. If issues persist:
```typescript
await prroService.signOut();
await prroService.initialize(); // Will sign in again
```

### Debug Mode

Enable detailed logging:

```typescript
// In checkbox-api.ts, add logging to request method
console.log('Checkbox API Request:', endpoint, options);
console.log('Checkbox API Response:', response);
```

## Ukrainian Tax Rates

Standard VAT rates in Ukraine:

- **0%**: Export, some medical supplies
- **7%**: Pharmaceuticals, some food products
- **20%**: Standard rate (default)

Configure default rate in `.env.local`:
```env
DEFAULT_TAX_RATE=20
```

## Legal Compliance

### Requirements

✅ All sales must be fiscalized in real-time
✅ Receipts must include fiscal code and QR code
✅ Z-reports must be generated at end of each shift
✅ Data must be stored for 3 years
✅ Cash register must be registered with tax authorities

### Fiscal Receipt Requirements

Each receipt must include:
- Fiscal number of cash register
- Fiscal code (unique identifier)
- Date and time
- Items with quantities and prices
- Tax amounts
- Payment methods
- QR code for verification

## Support

- Checkbox Documentation: https://docs.checkbox.ua/
- Checkbox Support: support@checkbox.ua
- Tax Service: tax.gov.ua

## License

This integration is part of the storefront service. See main project license.
