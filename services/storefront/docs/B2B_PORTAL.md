# B2B Wholesale Portal

Complete B2B wholesale portal for business customers with multi-tier pricing, credit management, and advanced ordering features.

## Features

### 1. Multi-Tier Pricing System

The B2B portal supports 6 different price tiers with automatic discounts:

| Tier | Name (UK) | Min Order Value | Min Quantity | Discount |
|------|-----------|-----------------|--------------|----------|
| `retail` | Роздріб | 0 грн | 1 | 0% |
| `wholesale_small` | Малий опт | 5,000 грн | 10 | 10% |
| `wholesale_medium` | Середній опт | 20,000 грн | 50 | 15% |
| `wholesale_large` | Великий опт | 50,000 грн | 100 | 20% |
| `partner` | Партнер | 10,000 грн | 20 | 25% |
| `distributor` | Дистриб'ютор | 100,000 грн | 200 | 30% |

**Features:**
- Automatic tier assignment based on order volume
- Custom pricing for specific customers
- Category-specific discounts
- Individual product price overrides

### 2. Credit Management System

Complete credit limit and payment terms management:

**Credit Account Features:**
- Credit limit allocation per customer
- Available credit tracking
- Payment terms (e.g., Net 30, Net 60)
- Automatic credit reservation on orders
- Overdue payment tracking
- Account blocking for late payments (>7 days)

**Invoice Management:**
- Automatic invoice generation
- Outstanding invoice tracking
- FIFO payment allocation
- Overdue invoice alerts
- Payment history

### 3. Price List Generator

Generate price lists in multiple formats for distribution:

**Supported Formats:**
- **Excel (XLSX)** - Full price list with images and stock
- **CSV** - Simple format for import/export
- **XML** - Universal format
- **YML** - Yandex Market Language for marketplaces

**Marketplace Integration:**
- Rozetka XML feed
- Prom.ua XML feed
- Custom marketplace formats

**Configuration Options:**
- Filter by categories
- Include/exclude images
- Include/exclude stock levels
- Minimum stock threshold

### 4. Quick Order Interface

Excel-like interface for rapid order placement:

**Features:**
- Table-based input similar to Excel
- Auto-complete for SKU codes
- Keyboard navigation (Enter to move between fields)
- Paste from Excel support (Ctrl+V)
- CSV file import
- Real-time price lookup
- Running total calculation
- Credit limit checking

**Usage:**
1. Enter SKU code
2. System auto-fills product name and price
3. Enter quantity
4. Press Enter to move to next line
5. Review total and submit

### 5. B2B Portal Pages

#### Main Portal (`/b2b`)
- Credit limit dashboard
- Quick order mini-form
- Recent orders overview
- Price list downloads
- Manager contact info

#### Quick Order (`/b2b/quick-order`)
- Excel-like table interface
- SKU lookup with auto-complete
- CSV/Excel import
- Paste from clipboard support
- Real-time total calculation
- Credit availability check

#### Account Dashboard (`/b2b/account`)
- Credit account status
- Order history
- Invoice management
- Payment history
- Price list downloads
- Company settings
- Notification preferences

## File Structure

```
lib/b2b/
├── types.ts                    # TypeScript type definitions
├── pricing.ts                  # B2B pricing service
├── credit.ts                   # Credit management service
└── price-list-generator.ts     # Price list export service

app/b2b/
├── layout.tsx                  # B2B portal layout with navigation
├── page.tsx                    # Main B2B portal page
├── quick-order/
│   └── page.tsx               # Excel-like quick order interface
└── account/
    └── page.tsx               # Account dashboard with tabs

app/api/b2b/
├── prices/route.ts            # GET - Customer-specific pricing
├── price-list/route.ts        # GET - Download price lists
├── credit/route.ts            # GET - Credit account info
├── order/route.ts             # POST - Place B2B order
├── orders/route.ts            # GET - Order history
└── invoices/route.ts          # GET - Invoice list
```

## API Endpoints

### GET /api/b2b/prices
Get customer-specific prices for products.

**Query Parameters:**
- `productIds` - Comma-separated list of product IDs

**Response:**
```json
{
  "customerId": "customer-1",
  "tier": "wholesale_medium",
  "prices": [
    {
      "productId": "product-1",
      "customerPrice": 25000,
      "retail": 30000,
      "savings": 5000,
      "savingsPercent": "16.67"
    }
  ]
}
```

### GET /api/b2b/price-list
Download price list in various formats.

**Query Parameters:**
- `format` - xlsx, csv, xml, or yml (default: csv)
- `includeImages` - true/false
- `includeStock` - true/false
- `categories` - Comma-separated category IDs

**Response:**
Binary file download with appropriate Content-Type header.

### GET /api/b2b/credit
Get credit account information.

**Response:**
```json
{
  "account": {
    "customerId": "customer-1",
    "creditLimit": 100000,
    "usedCredit": 25000,
    "availableCredit": 75000,
    "paymentTermDays": 30,
    "overdueDays": 0,
    "isBlocked": false
  },
  "outstandingInvoices": [...],
  "recentTransactions": [...],
  "summary": {
    "totalOutstanding": 25000,
    "overdueInvoices": 0,
    "creditUtilization": "25.00"
  }
}
```

### POST /api/b2b/order
Place a new B2B order.

**Request Body:**
```json
{
  "items": [
    {
      "productId": "product-1",
      "sku": "PROD-001",
      "name": "Premium Laptop",
      "quantity": 2,
      "basePrice": 30000
    }
  ],
  "paymentMethod": "credit",
  "deliveryAddress": "вул. Хрещатик 1, Київ",
  "notes": "Терміново"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order-123",
    "orderNumber": "ORD-123",
    "total": 60000,
    "status": "pending"
  },
  "message": "Замовлення успішно створено"
}
```

### GET /api/b2b/orders
Get order history.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status

**Response:**
```json
{
  "orders": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### GET /api/b2b/invoices
Get invoice list.

**Query Parameters:**
- `status` - 'outstanding' or 'all' (default: all)

**Response:**
```json
{
  "invoices": [...],
  "summary": {
    "totalInvoices": 10,
    "totalAmount": 250000,
    "totalPaid": 100000,
    "totalOutstanding": 150000,
    "overdueInvoices": 2,
    "overdueAmount": 50000
  }
}
```

## Usage Examples

### Setting Up Customer Pricing

```typescript
import { pricingService } from '@/lib/b2b/pricing';

// Set customer tier
pricingService.setCustomerTier('customer-1', 'wholesale_medium');

// Set custom price for specific product
pricingService.setCustomerPrice('customer-1', 'product-1', 22000);

// Set category discount
pricingService.setCategoryDiscount('customer-1', 'electronics', 5);

// Get customer price
const price = pricingService.getCustomerPrice('product-1', 'customer-1');
```

### Managing Credit Accounts

```typescript
import { creditService } from '@/lib/b2b/credit';

// Create/update credit account
creditService.setAccount({
  customerId: 'customer-1',
  creditLimit: 100000,
  usedCredit: 0,
  availableCredit: 100000,
  paymentTermDays: 30,
  overdueDays: 0,
  isBlocked: false
});

// Check if order can be placed
const check = creditService.canPlaceOrder('customer-1', 50000);
if (check.allowed) {
  // Reserve credit for order
  creditService.reserveCredit('customer-1', 'order-123', 50000);
}

// Record payment
creditService.recordPayment('customer-1', 25000, 'payment-456');

// Check overdue accounts (cron job)
const blockedCustomers = await creditService.checkOverdueAccounts();
```

### Generating Price Lists

```typescript
import { priceListGenerator } from '@/lib/b2b/price-list-generator';

// Generate CSV
const csv = priceListGenerator.generateCSV(products);

// Generate Excel
const xlsx = await priceListGenerator.generateXLSX(products);

// Generate YML for marketplaces
const yml = priceListGenerator.generateYML(products, {
  name: 'Your Shop',
  company: 'Your Company',
  url: 'https://yourshop.com',
  currencies: ['UAH']
});

// Generate Rozetka feed
const rozetkaXML = priceListGenerator.generateRozetkaFeed(products);

// Generate Prom.ua feed
const promXML = priceListGenerator.generatePromFeed(products);
```

## Ukrainian Translations

All UI elements include Ukrainian translations:

- **Роздріб** - Retail
- **Малий опт** - Small Wholesale
- **Середній опт** - Medium Wholesale
- **Великий опт** - Large Wholesale
- **Партнер** - Partner
- **Дистриб'ютор** - Distributor
- **Кредитний ліміт** - Credit Limit
- **Використано** - Used
- **Доступно** - Available
- **Прострочення** - Overdue
- **Рахунки** - Invoices
- **Платежі** - Payments
- **Замовлення** - Orders

## Security Considerations

1. **Authentication**: All B2B routes should require authentication
2. **Authorization**: Verify customer access to their own data only
3. **Credit Limits**: Enforce credit limits before order placement
4. **Price Integrity**: Validate prices server-side
5. **Data Privacy**: Protect sensitive business information

## Future Enhancements

1. **Advanced Features:**
   - Volume discounts (buy more, save more)
   - Time-based pricing (seasonal discounts)
   - Contract pricing (annual agreements)
   - Tiered shipping rates

2. **Reporting:**
   - Sales analytics dashboard
   - Purchase history reports
   - Credit utilization reports
   - Top products analysis

3. **Integration:**
   - ERP system integration
   - Accounting software sync
   - Warehouse management system
   - Payment gateway integration

4. **Mobile App:**
   - Native mobile app for B2B customers
   - Push notifications for order updates
   - Mobile-optimized quick order

## Testing

Test the B2B portal features:

1. **Pricing:**
   ```bash
   # Test customer pricing
   curl http://localhost:3000/api/b2b/prices?productIds=product-1,product-2
   ```

2. **Credit:**
   ```bash
   # Test credit info
   curl http://localhost:3000/api/b2b/credit
   ```

3. **Price List:**
   ```bash
   # Download CSV price list
   curl http://localhost:3000/api/b2b/price-list?format=csv -o pricelist.csv
   ```

4. **Order:**
   ```bash
   # Place order
   curl -X POST http://localhost:3000/api/b2b/order \
     -H "Content-Type: application/json" \
     -d '{"items":[...],"paymentMethod":"credit"}'
   ```

## Support

For B2B portal support:
- Email: b2b@example.com
- Phone: +380 44 123 45 67
- Hours: Mon-Fri 9:00-18:00 (Kyiv time)

---

**Note:** This is a demonstration implementation. In production, integrate with:
- Real database for persistence
- Authentication system (NextAuth, etc.)
- Payment processing
- ERP/accounting systems
- Email/SMS notification services
