# Dropshipping (Supplier Portal)

Платформа для постачальників та dropshipping партнерів.

## Overview

Модуль dropshipping забезпечує:
- Портал для постачальників
- Синхронізація товарів та залишків
- Автоматична обробка замовлень
- Прайс-листи та маржа
- Аналітика продажів

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DROPSHIPPING PLATFORM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                    ┌───────────────────────┐  │
│  │   Supplier   │                    │   Shop Platform       │  │
│  │   Portal     │                    │                       │  │
│  │              │                    │  ┌─────────────────┐  │  │
│  │  - Products  │◄────API Sync──────▶│  │   Product       │  │  │
│  │  - Stock     │                    │  │   Catalog       │  │  │
│  │  - Prices    │                    │  └─────────────────┘  │  │
│  │  - Orders    │                    │                       │  │
│  └──────────────┘                    │  ┌─────────────────┐  │  │
│                                      │  │   Order         │  │  │
│  ┌──────────────┐                    │  │   Management    │  │  │
│  │   Supplier   │◄────Orders────────▶│  │                 │  │  │
│  │   Warehouse  │                    │  └─────────────────┘  │  │
│  └──────────────┘                    │                       │  │
│         │                            └───────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │   Customer   │                                              │
│  │   Delivery   │                                              │
│  └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Supplier

```typescript
interface Supplier {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  status: 'pending' | 'active' | 'suspended';
  type: 'dropship' | 'wholesale' | 'manufacturer';

  settings: {
    autoSync: boolean;
    syncInterval: number;          // minutes
    autoProcessOrders: boolean;
    markupPercent: number;         // Default markup
    minOrderAmount: number;
    currency: string;
  };

  apiCredentials?: {
    apiKey: string;
    apiSecret: string;
    webhookUrl: string;
  };

  contacts: {
    manager: string;
    managerPhone: string;
    accountant?: string;
  };

  bankDetails?: {
    name: string;
    iban: string;
    edrpou: string;
  };

  createdAt: Date;
}
```

### Supplier Product

```typescript
interface SupplierProduct {
  id: string;
  supplierId: string;
  supplierSku: string;
  productId?: string;           // Linked shop product
  name: string;
  description?: string;
  price: number;                // Supplier price
  retailPrice?: number;         // Recommended retail
  currency: string;
  stock: number;
  images: string[];
  attributes: Record<string, string>;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  isActive: boolean;
  lastSyncAt: Date;
}
```

### Dropship Order

```typescript
interface DropshipOrder {
  id: string;
  orderId: string;              // Shop order ID
  supplierId: string;
  status: DropshipOrderStatus;
  items: DropshipOrderItem[];
  shippingAddress: Address;
  totalCost: number;            // Supplier cost
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  createdAt: Date;
  processedAt?: Date;
  shippedAt?: Date;
}

type DropshipOrderStatus =
  | 'pending'          // Очікує обробки
  | 'processing'       // В обробці
  | 'shipped'          // Відправлено
  | 'delivered'        // Доставлено
  | 'cancelled'        // Скасовано
  | 'returned';        // Повернуто

interface DropshipOrderItem {
  supplierProductId: string;
  supplierSku: string;
  name: string;
  quantity: number;
  price: number;                // Supplier price per unit
}
```

## Usage

### Supplier Registration

```typescript
import { supplierService } from '@/lib/dropshipping';

// Register new supplier
const supplier = await supplierService.register({
  name: 'Tech Wholesale UA',
  email: 'manager@techwholesale.ua',
  phone: '+380991234567',
  type: 'dropship',
  contacts: {
    manager: 'Іван Петренко',
    managerPhone: '+380991234567',
  },
});

// Generate API credentials
const credentials = await supplierService.generateApiCredentials(supplier.id);
// { apiKey: 'sk_sup_...', apiSecret: '...' }
```

### Product Sync

```typescript
// Supplier uploads products
await supplierService.syncProducts(supplierId, [
  {
    supplierSku: 'TWU-001',
    name: 'iPhone 15 Pro 256GB',
    price: 40000,
    stock: 50,
    images: ['https://...'],
    attributes: {
      color: 'Black Titanium',
      storage: '256GB',
    },
  },
  // ...more products
]);

// Or via API endpoint
POST /api/v1/suppliers/products/sync
Authorization: Bearer sk_sup_...
{
  "products": [...]
}
```

### Link Products

```typescript
// Link supplier product to shop product
await supplierService.linkProduct({
  supplierProductId: 'sp-123',
  productId: 'prod-456',
  markup: 15,  // 15% markup
});

// Auto-link by barcode/SKU
await supplierService.autoLinkProducts(supplierId);
```

### Process Order

```typescript
// When shop receives order with supplier products
const dropshipOrder = await supplierService.createOrder({
  orderId: 'order-123',
  supplierId: supplier.id,
  items: [
    {
      supplierProductId: 'sp-123',
      supplierSku: 'TWU-001',
      quantity: 1,
    },
  ],
  shippingAddress: order.shippingAddress,
});

// Auto-process enabled - order sent to supplier automatically
// Or manual processing via supplier portal
```

### Supplier Updates Shipping

```typescript
// Supplier updates tracking
await supplierService.updateShipping({
  dropshipOrderId: 'dso-123',
  trackingNumber: '20450123456789',
  carrier: 'novaposhta',
  status: 'shipped',
});

// This updates the main order status
```

## API Endpoints

### Shop API

```
# Supplier management
POST   /api/v1/admin/suppliers              # Create supplier
GET    /api/v1/admin/suppliers              # List suppliers
GET    /api/v1/admin/suppliers/:id          # Get supplier
PUT    /api/v1/admin/suppliers/:id          # Update supplier
DELETE /api/v1/admin/suppliers/:id          # Delete supplier

# Product linking
GET    /api/v1/admin/suppliers/:id/products # Supplier products
POST   /api/v1/admin/suppliers/products/link    # Link product
DELETE /api/v1/admin/suppliers/products/:id/link # Unlink

# Dropship orders
GET    /api/v1/admin/dropship-orders        # List orders
GET    /api/v1/admin/dropship-orders/:id    # Get order
```

### Supplier API

```
# Authentication
POST   /api/v1/supplier/auth                # Login

# Products
GET    /api/v1/supplier/products            # My products
POST   /api/v1/supplier/products/sync       # Sync products
PUT    /api/v1/supplier/products/:id        # Update product

# Stock updates
POST   /api/v1/supplier/stock/update        # Update stock
POST   /api/v1/supplier/stock/bulk          # Bulk update

# Orders
GET    /api/v1/supplier/orders              # My orders
GET    /api/v1/supplier/orders/:id          # Get order
PUT    /api/v1/supplier/orders/:id          # Update order
POST   /api/v1/supplier/orders/:id/ship     # Mark shipped

# Reports
GET    /api/v1/supplier/reports/sales       # Sales report
GET    /api/v1/supplier/reports/payouts     # Payouts report
```

## Supplier Portal UI

```
/supplier
├── /dashboard              # Overview, stats
├── /products               # Product management
│   ├── /new               # Add product
│   └── /:id               # Edit product
├── /orders                 # Orders list
│   └── /:id               # Order details
├── /stock                  # Stock management
├── /price-lists            # Price list upload
├── /reports                # Sales reports
│   ├── /sales             # Sales analytics
│   └── /payouts           # Payout history
└── /settings               # Account settings
    ├── /profile           # Company info
    ├── /api               # API credentials
    └── /integration       # Sync settings
```

## Price List Import

```typescript
// Import from Excel/CSV
await supplierService.importPriceList({
  supplierId: supplier.id,
  file: uploadedFile,
  mapping: {
    sku: 'A',
    name: 'B',
    price: 'C',
    stock: 'D',
  },
  updateExisting: true,
});
```

## Webhooks

```typescript
// Supplier receives order webhook
POST https://supplier-api.com/webhooks/orders
{
  "event": "order.created",
  "data": {
    "orderId": "dso-123",
    "items": [...],
    "shippingAddress": {...}
  }
}

// Shop receives shipping update
POST https://shop.ua/api/v1/webhooks/supplier
{
  "event": "order.shipped",
  "data": {
    "orderId": "dso-123",
    "trackingNumber": "20450123456789",
    "carrier": "novaposhta"
  }
}
```

## Configuration

```bash
# Dropshipping settings
DROPSHIPPING_ENABLED=true
DROPSHIPPING_AUTO_PROCESS_ORDERS=true
DROPSHIPPING_DEFAULT_MARKUP=20

# Supplier API
SUPPLIER_API_RATE_LIMIT=100
SUPPLIER_WEBHOOK_TIMEOUT=30
```

## See Also

- [B2B Sales](../features/B2B.md)
- [Supplier Portal](../features/SUPPLIER_PORTAL.md)
- [Inventory](./INVENTORY.md)
- [Orders](./ORDERS.md)
