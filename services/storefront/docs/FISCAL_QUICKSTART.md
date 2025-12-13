# ПРРО Quick Start Guide

Quick guide to get started with the Ukrainian fiscal integration.

## 5-Minute Setup

### Step 1: Configure Environment

```bash
# Copy environment template
cp .env.fiscal.example .env.local
```

Edit `.env.local`:
```env
CHECKBOX_API_URL=https://api.checkbox.ua/api/v1
CHECKBOX_LICENSE_KEY=your_license_key
CHECKBOX_CASHIER_LOGIN=your_login
CHECKBOX_CASHIER_PASSWORD=your_password
```

### Step 2: Open Admin UI

Navigate to: `http://localhost:3000/admin/pos/fiscal`

### Step 3: Open Shift

Click "Відкрити зміну" (Open Shift) button.

### Step 4: Create Your First Receipt

Use the API or integrate into your checkout flow:

```typescript
import { prroService } from '@/lib/fiscal/prro-service';

// Fiscalize a sale
const result = await prroService.fiscalizeOrder({
  orderId: 'ORDER-001',
  items: [
    {
      sku: 'PROD-001',
      name: 'Product Name',
      price: 100.00, // UAH
      quantity: 1,
      taxRate: 20, // 20% VAT
    }
  ],
  payments: [
    { type: 'cash', amount: 100.00 }
  ],
  customer: {
    email: 'customer@example.com'
  }
});

console.log('Fiscal code:', result.fiscalCode);
console.log('Receipt URL:', result.receiptUrl);
```

## Common Operations

### Open Shift (Start of Day)

```typescript
await prroService.openCashierShift('cashier-1');
```

### Close Shift (End of Day)

```typescript
const zReport = await prroService.closeCashierShift('cashier-1');
console.log('Z-Report:', zReport.serial);
```

### Deposit Cash

```typescript
await prroService.depositCash(5000.00); // 5000 UAH
```

### Withdraw Cash

```typescript
await prroService.withdrawCash(3000.00); // 3000 UAH
```

### Process Return

```typescript
const returnResult = await prroService.fiscalizeReturn(
  'FISCAL-CODE-FROM-ORIGINAL-RECEIPT',
  [
    {
      sku: 'PROD-001',
      name: 'Product Name',
      price: 100.00,
      quantity: 1,
    }
  ]
);
```

### Search Receipt

```typescript
const receipt = await prroService.getReceiptByFiscalCode('FISCAL123');
if (receipt) {
  console.log('Total:', receipt.total);
  console.log('Items:', receipt.items);
}
```

## Integration with Your Checkout

### Example: Next.js API Route

```typescript
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

export async function POST(request: NextRequest) {
  const order = await request.json();

  // Fiscalize the order
  const fiscalResult = await prroService.fiscalizeOrder({
    orderId: order.id,
    items: order.items.map(item => ({
      sku: item.sku,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      taxRate: 20,
    })),
    payments: [
      {
        type: order.paymentMethod, // 'cash', 'card', 'online'
        amount: order.total,
      }
    ],
    customer: {
      email: order.customerEmail,
    },
  });

  if (!fiscalResult.success) {
    return NextResponse.json(
      { error: 'Fiscal error: ' + fiscalResult.error },
      { status: 500 }
    );
  }

  // Save fiscal code to order
  await saveOrderFiscalCode(order.id, fiscalResult.fiscalCode);

  return NextResponse.json({
    success: true,
    fiscalCode: fiscalResult.fiscalCode,
    receiptUrl: fiscalResult.receiptUrl,
  });
}
```

### Example: Client Component

```typescript
'use client';

import { useState } from 'react';

export function CheckoutButton({ order }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });

      const data = await response.json();

      if (data.success) {
        alert('Оплата успішна! Фіскальний код: ' + data.fiscalCode);
        // Show receipt or redirect
        if (data.receiptUrl) {
          window.open(data.receiptUrl, '_blank');
        }
      } else {
        alert('Помилка: ' + data.error);
      }
    } catch (error) {
      alert('Помилка оплати');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Обробка...' : 'Оплатити'}
    </button>
  );
}
```

## Daily Routine

### Morning (Opening)

1. Navigate to `/admin/pos/fiscal`
2. Click "Відкрити зміну" (Open Shift)
3. Optional: Deposit initial cash if needed

### During Day

- Process sales normally
- Use service operations (deposit/withdraw) as needed
- Search receipts if customers need reprints

### Evening (Closing)

1. Navigate to `/admin/pos/fiscal`
2. Click "Закрити зміну (Z-звіт)" (Close Shift / Z-Report)
3. Print or save Z-report for records
4. Prepare cash for bank deposit

## Troubleshooting

### "No open shift"
**Solution**: Click "Відкрити зміну" before creating receipts.

### "Authentication failed"
**Solution**: Check credentials in `.env.local`.

### "No active cash register"
**Solution**: Register cash register in Checkbox admin panel.

### "Amount mismatch"
**Solution**: Ensure items total equals payments total:
```typescript
const itemsTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
// These must match
```

## Testing

### Test Environment

Use Checkbox test API for development:

```env
CHECKBOX_API_URL=https://dev-api.checkbox.ua/api/v1
```

### Test Checklist

- [ ] Can open shift
- [ ] Can create receipt
- [ ] Can deposit cash
- [ ] Can withdraw cash
- [ ] Can search receipt
- [ ] Can close shift
- [ ] Receipt has fiscal code
- [ ] QR code works

## Next Steps

1. **Customize Receipts**: Edit header/footer in fiscalization calls
2. **Add Reports**: Implement daily/period report viewing
3. **Email Receipts**: Set up email service for customer receipts
4. **Print Receipts**: Connect thermal printer for physical receipts
5. **Monitor**: Set up logging and monitoring for fiscal operations

## Support

- Documentation: `/docs/FISCAL_INTEGRATION.md`
- Checkbox Docs: https://docs.checkbox.ua/
- Support: support@checkbox.ua

## Legal Requirements

Remember:
- ✅ All sales MUST be fiscalized
- ✅ Keep receipts for 3 years
- ✅ Generate Z-report daily
- ✅ Register with tax authorities

---

**Ready to start?** Open `/admin/pos/fiscal` and click "Відкрити зміну"!
