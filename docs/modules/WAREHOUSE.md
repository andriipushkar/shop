# Warehouse Management System (WMS)

Comprehensive warehouse management for inventory tracking, order fulfillment, and logistics operations.

## Overview

The WMS module provides enterprise-grade warehouse operations including:
- Multi-warehouse inventory tracking
- Receipt and shipment processing
- Bin/location management
- Wave picking
- Barcode scanning (mobile)
- Quality control
- Cross-docking
- Ship-from-store
- ABC/XYZ analysis

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WAREHOUSE MANAGEMENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Inventory  │  │   Operations │  │   Analytics          │  │
│  │   Management │  │   Management │  │                      │  │
│  │              │  │              │  │  - ABC Analysis      │  │
│  │  - Stock     │  │  - Receipts  │  │  - XYZ Analysis      │  │
│  │  - Locations │  │  - Shipments │  │  - Turnover rates    │  │
│  │  - Reserves  │  │  - Transfers │  │  - Dead stock        │  │
│  │  - Counts    │  │  - Pick/Pack │  │  - Forecasting       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   POS System │  │   Mobile App │  │   Quality Control    │  │
│  │              │  │   (Scanner)  │  │                      │  │
│  │  - Sales     │  │              │  │  - Inspection        │  │
│  │  - Returns   │  │  - Receive   │  │  - Hold status       │  │
│  │  - Cash mgmt │  │  - Pick      │  │  - Defect tracking   │  │
│  └──────────────┘  │  - Count     │  └──────────────────────┘  │
│                    └──────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Features

### 1. Multi-Warehouse Support

```typescript
interface Warehouse {
  id: string;
  name: string;
  code: string;           // Short code (e.g., "WH-KYIV")
  type: 'warehouse' | 'store' | 'dropship';
  address: Address;
  isActive: boolean;
  zones: Zone[];          // Storage zones
  settings: {
    allowNegativeStock: boolean;
    defaultBinLocation: string;
    autoReplenish: boolean;
    pickStrategy: 'FIFO' | 'FEFO' | 'LIFO';
  };
}
```

### 2. Location/Bin Management

```
Warehouse Structure:
├── Zone A (Bulk Storage)
│   ├── Aisle 01
│   │   ├── Rack 01
│   │   │   ├── Shelf A: A-01-01-A (Location Code)
│   │   │   ├── Shelf B: A-01-01-B
│   │   │   └── Shelf C: A-01-01-C
│   │   └── Rack 02
│   └── Aisle 02
├── Zone B (Pick Area)
└── Zone C (Shipping)
```

Location attributes:
- Capacity (weight, volume, units)
- Product restrictions (category, temperature)
- Pick priority
- Replenishment threshold

### 3. Inventory Operations

#### Receipt (Inbound)

```typescript
interface ReceiptDocument {
  id: string;
  type: 'purchase' | 'return' | 'transfer';
  warehouseId: string;
  supplierId?: string;
  items: ReceiptItem[];
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  expectedDate: Date;
  receivedDate?: Date;
}

interface ReceiptItem {
  productId: string;
  expectedQty: number;
  receivedQty: number;
  binLocation: string;
  lotNumber?: string;
  expiryDate?: Date;
  qualityStatus: 'pending' | 'passed' | 'failed' | 'hold';
}
```

**Receipt Process:**
1. Create receipt document
2. Scan items with mobile scanner
3. Verify quantities
4. Assign bin locations
5. Quality inspection (if required)
6. Update inventory
7. Generate receipt confirmation

#### Shipment (Outbound)

```typescript
interface ShipmentDocument {
  id: string;
  type: 'sales' | 'transfer' | 'disposal';
  warehouseId: string;
  orderId?: string;
  items: ShipmentItem[];
  status: 'draft' | 'picking' | 'packing' | 'shipped' | 'cancelled';
  carrier?: string;
  trackingNumber?: string;
  shippedDate?: Date;
}
```

**Shipment Process:**
1. Order received → Create shipment
2. Generate pick list
3. Wave picking (batch multiple orders)
4. Pick items (scan verification)
5. Pack items
6. Print shipping label
7. Confirm shipment
8. Update inventory & order status

#### Transfer (Warehouse to Warehouse)

```typescript
interface TransferDocument {
  id: string;
  sourceWarehouseId: string;
  destWarehouseId: string;
  items: TransferItem[];
  status: 'draft' | 'in_transit' | 'completed';
  shippedDate?: Date;
  receivedDate?: Date;
}
```

### 4. Wave Picking

Optimize picking by batching orders:

```typescript
interface PickWave {
  id: string;
  warehouseId: string;
  orders: string[];           // Order IDs
  pickList: PickItem[];       // Consolidated items
  assignedTo: string;         // Picker user ID
  status: 'created' | 'in_progress' | 'completed';
  strategy: 'zone' | 'batch' | 'cluster';
  startedAt?: Date;
  completedAt?: Date;
}

interface PickItem {
  productId: string;
  sku: string;
  totalQty: number;           // Sum across all orders
  locations: {
    binLocation: string;
    qty: number;
    orderId: string;
  }[];
  pickedQty: number;
}
```

**Wave Strategies:**
- **Zone Picking**: Each picker covers specific zones
- **Batch Picking**: Pick multiple orders simultaneously
- **Cluster Picking**: Group orders by shipping zone

### 5. FEFO (First Expired, First Out)

For perishable goods:

```typescript
interface InventoryLot {
  productId: string;
  warehouseId: string;
  binLocation: string;
  lotNumber: string;
  quantity: number;
  expiryDate: Date;
  receivedDate: Date;
  status: 'available' | 'reserved' | 'quarantine' | 'expired';
}

// Auto-select oldest expiring stock
function allocateStock(productId: string, qty: number): Allocation[] {
  return inventoryLots
    .filter(lot => lot.productId === productId && lot.status === 'available')
    .sort((a, b) => a.expiryDate - b.expiryDate)  // FEFO
    .reduce((acc, lot) => {
      // Allocate from earliest expiring first
    }, []);
}
```

### 6. Quality Control

```typescript
interface QualityInspection {
  id: string;
  receiptId: string;
  productId: string;
  inspectedQty: number;
  passedQty: number;
  failedQty: number;
  holdQty: number;
  defects: Defect[];
  inspectedBy: string;
  inspectedAt: Date;
  notes: string;
}

interface Defect {
  type: string;            // 'damaged', 'wrong_item', 'expired', etc.
  quantity: number;
  photos: string[];
  action: 'return_supplier' | 'dispose' | 'discount';
}
```

### 7. Cycle Counting

Regular inventory verification:

```typescript
interface CycleCount {
  id: string;
  warehouseId: string;
  type: 'full' | 'partial' | 'abc';
  locations: string[];        // Bin locations to count
  status: 'scheduled' | 'in_progress' | 'completed';
  scheduledDate: Date;
  counts: CountResult[];
}

interface CountResult {
  productId: string;
  binLocation: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  adjustmentApproved: boolean;
}
```

### 8. Cross-Docking

Direct transfer without storage:

```
Inbound Truck → Sorting → Outbound Truck
    ↓              ↓           ↓
 Receive       Sort by      Ship to
              Destination   Stores
```

### 9. Ship-from-Store

Use retail stores as fulfillment points:

```typescript
interface ShipFromStoreOrder {
  orderId: string;
  storeId: string;          // Fulfilling store
  status: 'assigned' | 'picking' | 'ready' | 'shipped';
  assignedAt: Date;
  pickupDeadline: Date;
  shippingMethod: 'carrier' | 'customer_pickup';
}
```

## POS (Point of Sale)

Retail sales functionality:

```typescript
interface POSTransaction {
  id: string;
  storeId: string;
  cashierId: string;
  items: POSItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mixed';
  payments: Payment[];
  status: 'open' | 'completed' | 'voided' | 'refunded';
  receiptNumber: string;
  createdAt: Date;
}
```

**POS Features:**
- Barcode scanning
- Customer lookup
- Loyalty points
- Discounts & promo codes
- Multiple payment methods
- Cash drawer management
- End-of-day reconciliation
- Receipt printing

## Mobile Scanner App

### Supported Operations

| Operation | Description |
|-----------|-------------|
| Receive | Scan items during receipt |
| Pick | Scan during order picking |
| Pack | Verify items before shipping |
| Count | Cycle counting |
| Transfer | Scan for transfers |
| Lookup | Check item info/stock |

### Scanning Workflow

```
1. Login → Select Warehouse → Select Operation
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
               [Receive]       [Pick List]      [Count]
                    │               │               │
                    ▼               ▼               ▼
              Scan Barcode   Scan Location    Scan Location
                    │               │               │
                    ▼               ▼               ▼
             Enter Quantity   Scan Product    Scan Product
                    │               │               │
                    ▼               ▼               ▼
            Assign Location  Confirm Pick    Enter Count
                    │               │               │
                    ▼               ▼               ▼
                 Complete        Complete       Submit
```

## Analytics

### ABC Analysis

Classify products by value/velocity:

| Class | Criteria | % Items | % Value |
|-------|----------|---------|---------|
| A | High value/velocity | 10-20% | 70-80% |
| B | Medium | 20-30% | 15-20% |
| C | Low value/velocity | 50-70% | 5-10% |

### XYZ Analysis

Classify by demand variability:

| Class | Criteria | Action |
|-------|----------|--------|
| X | Stable demand | Just-in-time |
| Y | Variable demand | Safety stock |
| Z | Unpredictable | Make-to-order |

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Inventory Accuracy | Counted vs System | >99% |
| Order Accuracy | Correct items shipped | >99.5% |
| Pick Rate | Items picked/hour | 50-100 |
| Dock-to-Stock | Receipt to available | <24h |
| Order Cycle Time | Order to ship | <4h |
| Inventory Turnover | Annual turns | 12x |
| Fill Rate | Orders filled completely | >95% |

## API Endpoints

### Inventory

```
GET    /api/v1/warehouse/inventory
GET    /api/v1/warehouse/inventory/:productId
POST   /api/v1/warehouse/inventory/adjust
GET    /api/v1/warehouse/inventory/low-stock
GET    /api/v1/warehouse/inventory/by-location/:location
```

### Operations

```
POST   /api/v1/warehouse/receipts
GET    /api/v1/warehouse/receipts/:id
PUT    /api/v1/warehouse/receipts/:id/complete

POST   /api/v1/warehouse/shipments
GET    /api/v1/warehouse/shipments/:id
PUT    /api/v1/warehouse/shipments/:id/pick
PUT    /api/v1/warehouse/shipments/:id/pack
PUT    /api/v1/warehouse/shipments/:id/ship

POST   /api/v1/warehouse/transfers
GET    /api/v1/warehouse/transfers/:id
PUT    /api/v1/warehouse/transfers/:id/ship
PUT    /api/v1/warehouse/transfers/:id/receive
```

### Analytics

```
GET    /api/v1/warehouse/analytics/abc
GET    /api/v1/warehouse/analytics/xyz
GET    /api/v1/warehouse/analytics/turnover
GET    /api/v1/warehouse/analytics/velocity
GET    /api/v1/warehouse/analytics/dead-stock
```

### POS

```
POST   /api/v1/pos/transactions
GET    /api/v1/pos/transactions/:id
POST   /api/v1/pos/transactions/:id/void
POST   /api/v1/pos/transactions/:id/refund
GET    /api/v1/pos/end-of-day
POST   /api/v1/pos/cash-drawer/open
POST   /api/v1/pos/cash-drawer/close
```

## Configuration

```bash
# Warehouse Settings
WAREHOUSE_DEFAULT_PICK_STRATEGY=FIFO
WAREHOUSE_LOW_STOCK_THRESHOLD=10
WAREHOUSE_REORDER_POINT_MULTIPLIER=1.5
WAREHOUSE_SAFETY_STOCK_DAYS=7

# Quality Control
WAREHOUSE_QC_REQUIRED_CATEGORIES=food,electronics
WAREHOUSE_QC_SAMPLE_RATE=0.1

# POS
POS_RECEIPT_PRINTER=EPSON_TM_T20III
POS_CASH_DRAWER_PORT=/dev/ttyUSB0
POS_TAX_RATE=0.20
```

## Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `inventory.received` | Receipt completed | Items, quantities |
| `inventory.shipped` | Shipment completed | Items, order ID |
| `inventory.adjusted` | Manual adjustment | Item, reason |
| `inventory.low_stock` | Below threshold | Item, current qty |
| `inventory.expired` | Item expired | Item, location |
| `pick_wave.completed` | Wave finished | Wave ID, items |
| `pos.sale_completed` | POS transaction | Transaction data |

See also:
- [Warehouse Zones](./warehouse/zones.md)
- [Wave Picking Guide](./warehouse/wave-picking.md)
- [Ship from Store](./warehouse/ship-from-store.md)
- [WMS Analytics](./warehouse/analytics.md)
