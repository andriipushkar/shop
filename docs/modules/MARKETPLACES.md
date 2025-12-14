# Marketplace Integrations

Integrate with major Ukrainian and international marketplaces to expand sales channels and sync inventory.

## Supported Marketplaces

| Marketplace | Region | Features |
|-------------|--------|----------|
| Rozetka | Ukraine | Products, Orders, Stock, Prices |
| Prom.ua | Ukraine | Products, Orders, Stock, Prices |
| Hotline | Ukraine | Price comparison, Feed |
| Google Shopping | Global | Product Feed |
| Facebook/Instagram | Global | Catalog, Pixel |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   MARKETPLACE INTEGRATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                    ┌────────────────────┐  │
│  │   Your Store    │◄──── Sync ────────▶│   Marketplace      │  │
│  │   (Products)    │                    │   (Rozetka/Prom)   │  │
│  └────────┬────────┘                    └────────┬───────────┘  │
│           │                                      │              │
│           ▼                                      ▼              │
│  ┌─────────────────┐                    ┌────────────────────┐  │
│  │   Inventory     │◄──── Sync ────────▶│   Stock Levels     │  │
│  └─────────────────┘                    └────────────────────┘  │
│           │                                      │              │
│           ▼                                      ▼              │
│  ┌─────────────────┐                    ┌────────────────────┐  │
│  │   Orders        │◄──── Import ──────│   Orders           │  │
│  └─────────────────┘                    └────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Rozetka Integration

### Configuration

```bash
ROZETKA_API_KEY=your_api_key
ROZETKA_SELLER_ID=your_seller_id
ROZETKA_API_URL=https://api-seller.rozetka.com.ua/
```

### Product Sync

#### Export Products to Rozetka

```typescript
import { RozetkaClient } from '@/lib/marketplace/rozetka';

const rozetka = new RozetkaClient(apiKey, sellerId);

// Map your product to Rozetka format
const rozetkaProduct = {
  id: product.sku,
  name: product.name,
  name_ua: product.nameUa,
  description: product.description,
  description_ua: product.descriptionUa,
  price: product.price,
  old_price: product.oldPrice,
  currency: 'UAH',
  stock: product.stock,
  brand: product.brand,
  category_id: categoryMapping[product.categoryId],
  images: product.images.map(img => img.url),
  parameters: product.attributes.map(attr => ({
    id: attr.rozetkaParamId,
    value: attr.value,
  })),
};

await rozetka.createProduct(rozetkaProduct);
```

#### Update Stock

```typescript
// Bulk stock update
await rozetka.updateStock([
  { id: 'SKU001', stock: 50 },
  { id: 'SKU002', stock: 0 },
  { id: 'SKU003', stock: 120 },
]);
```

#### Update Prices

```typescript
await rozetka.updatePrices([
  { id: 'SKU001', price: 1500, old_price: 1800 },
  { id: 'SKU002', price: 2500 },
]);
```

### Category Mapping

```typescript
// Map your categories to Rozetka categories
const categoryMapping = {
  'electronics/phones': 80003,      // Rozetka category ID
  'electronics/laptops': 80004,
  'home/kitchen': 130000,
};

// Get Rozetka categories
const rozetkaCategories = await rozetka.getCategories();
```

### Order Import

```typescript
// Fetch new orders
const orders = await rozetka.getOrders({
  status: 'new',
  from: lastSyncDate,
});

for (const rozetkaOrder of orders) {
  // Create order in your system
  const order = await createOrder({
    source: 'rozetka',
    externalId: rozetkaOrder.id,
    customer: {
      name: rozetkaOrder.customer_name,
      phone: rozetkaOrder.customer_phone,
      email: rozetkaOrder.customer_email,
    },
    items: rozetkaOrder.items.map(item => ({
      sku: item.id,
      quantity: item.quantity,
      price: item.price,
    })),
    shipping: {
      carrier: rozetkaOrder.delivery_service,
      city: rozetkaOrder.delivery_city,
      warehouse: rozetkaOrder.delivery_warehouse,
    },
    total: rozetkaOrder.amount,
  });

  // Confirm order on Rozetka
  await rozetka.confirmOrder(rozetkaOrder.id);
}
```

### Order Status Updates

```typescript
// Update status on Rozetka when order ships
await rozetka.updateOrderStatus(orderId, {
  status: 'shipped',
  tracking_number: '20450000000000',
  delivery_service: 'nova_poshta',
});
```

## Prom.ua Integration

### Configuration

```bash
PROM_API_KEY=your_api_key
PROM_API_URL=https://my.prom.ua/api/v1/
```

### Product Feed (YML/XML)

Generate XML feed for Prom.ua:

```typescript
import { generatePromFeed } from '@/lib/marketplace/prom';

// Generate YML feed
const feed = await generatePromFeed({
  products: await getActiveProducts(),
  shopName: 'Your Store',
  company: 'Your Company LLC',
  url: 'https://yourstore.com',
  currencies: [{ id: 'UAH', rate: 1 }],
});

// Save to public/feeds/prom.xml
await saveFeed('/public/feeds/prom.xml', feed);
```

### YML Feed Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2024-01-15 12:00">
  <shop>
    <name>Your Store</name>
    <company>Your Company LLC</company>
    <url>https://yourstore.com</url>
    <currencies>
      <currency id="UAH" rate="1"/>
    </currencies>
    <categories>
      <category id="1">Electronics</category>
      <category id="2" parentId="1">Phones</category>
    </categories>
    <offers>
      <offer id="SKU001" available="true">
        <url>https://yourstore.com/product/sku001</url>
        <price>1500</price>
        <currencyId>UAH</currencyId>
        <categoryId>2</categoryId>
        <picture>https://yourstore.com/images/product1.jpg</picture>
        <name>Product Name</name>
        <vendor>Brand Name</vendor>
        <description>Product description</description>
        <param name="Color">Black</param>
        <param name="Size">Large</param>
      </offer>
    </offers>
  </shop>
</yml_catalog>
```

### Order Import (API)

```typescript
import { PromClient } from '@/lib/marketplace/prom';

const prom = new PromClient(apiKey);

// Get new orders
const orders = await prom.getOrders({
  status: 'pending',
  date_from: lastSyncDate.toISOString(),
});

for (const promOrder of orders) {
  await createOrderFromProm(promOrder);
  await prom.updateOrderStatus(promOrder.id, 'received');
}
```

## Google Shopping

### Merchant Center Feed

```typescript
import { generateGoogleFeed } from '@/lib/marketplace/google';

const feed = await generateGoogleFeed({
  products: await getActiveProducts(),
  targetCountry: 'UA',
  language: 'uk',
});

// Save as TSV or XML
await saveFeed('/public/feeds/google.xml', feed);
```

### Feed Format (RSS 2.0)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Your Store</title>
    <link>https://yourstore.com</link>
    <description>Product Feed</description>
    <item>
      <g:id>SKU001</g:id>
      <g:title>Product Name</g:title>
      <g:description>Product description</g:description>
      <g:link>https://yourstore.com/product/sku001</g:link>
      <g:image_link>https://yourstore.com/images/product1.jpg</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>1500.00 UAH</g:price>
      <g:brand>Brand Name</g:brand>
      <g:gtin>1234567890123</g:gtin>
      <g:product_type>Electronics > Phones</g:product_type>
      <g:google_product_category>267</g:google_product_category>
    </item>
  </channel>
</rss>
```

### Required Fields

| Field | Description | Required |
|-------|-------------|----------|
| `id` | Unique SKU | Yes |
| `title` | Product name | Yes |
| `description` | Description | Yes |
| `link` | Product URL | Yes |
| `image_link` | Main image | Yes |
| `availability` | in_stock/out_of_stock | Yes |
| `price` | Price with currency | Yes |
| `brand` | Brand name | Yes* |
| `gtin` | Barcode (EAN/UPC) | Yes* |
| `mpn` | Manufacturer part number | Yes* |

*One of brand + (gtin OR mpn) required

## Facebook/Instagram Catalog

### Configuration

```bash
FACEBOOK_CATALOG_ID=your_catalog_id
FACEBOOK_ACCESS_TOKEN=your_access_token
FACEBOOK_PIXEL_ID=your_pixel_id
```

### Feed Generation

```typescript
import { generateFacebookFeed } from '@/lib/marketplace/facebook';

const feed = await generateFacebookFeed({
  products: await getActiveProducts(),
});

// Upload to Facebook
await facebook.uploadFeed(catalogId, feed);
```

### CSV Feed Format

```csv
id,title,description,availability,condition,price,link,image_link,brand
SKU001,Product Name,Description,in stock,new,1500 UAH,https://store.com/p1,https://store.com/img1.jpg,Brand
```

## Feed Generation Scheduler

### Cron Jobs

```typescript
// Schedule feed generation
import { schedule } from 'node-cron';

// Every hour
schedule('0 * * * *', async () => {
  await generateAllFeeds();
});

async function generateAllFeeds() {
  const products = await getActiveProducts();

  await Promise.all([
    generatePromFeed(products),
    generateGoogleFeed(products),
    generateFacebookFeed(products),
    generateRozetkaFeed(products),
  ]);

  console.log('All feeds generated');
}
```

### Feed URLs

| Marketplace | Feed URL |
|-------------|----------|
| Prom.ua | `https://yourstore.com/feeds/prom.xml` |
| Google | `https://yourstore.com/feeds/google.xml` |
| Facebook | `https://yourstore.com/feeds/facebook.csv` |
| Hotline | `https://yourstore.com/feeds/hotline.xml` |

## Stock Synchronization

### Real-time Stock Sync

```typescript
// When stock changes in your system
async function onStockChange(sku: string, newStock: number) {
  // Update all connected marketplaces
  await Promise.all([
    rozetka.updateStock([{ id: sku, stock: newStock }]),
    prom.updateStock(sku, newStock),
  ]);
}

// Subscribe to inventory events
eventBus.on('inventory.updated', async (event) => {
  await onStockChange(event.sku, event.newQuantity);
});
```

### Scheduled Sync

```typescript
// Full stock sync every 15 minutes
schedule('*/15 * * * *', async () => {
  const stockLevels = await getStockLevels();

  await rozetka.bulkUpdateStock(stockLevels);
  await regenerateFeeds(); // Update XML feeds
});
```

## Order Synchronization

### Order Import Flow

```
Marketplace Order ──▶ Webhook/Poll ──▶ Validate ──▶ Create Order
                                                        │
                                                        ▼
                                               Confirm on Marketplace
                                                        │
                                                        ▼
                                               Ship & Update Status
```

### Unified Order Model

```typescript
interface MarketplaceOrder {
  source: 'rozetka' | 'prom' | 'direct';
  externalId: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  shipping: {
    method: string;
    address?: string;
    city?: string;
    warehouse?: string;
  };
  payment: {
    method: string;
    status: string;
  };
  total: number;
  createdAt: Date;
}
```

## Price Monitoring

### Competitor Price Tracking

```typescript
import { PriceMonitor } from '@/lib/marketplace/price-monitor';

const monitor = new PriceMonitor();

// Add competitor URLs to track
await monitor.addCompetitor('SKU001', [
  'https://rozetka.com.ua/product/123',
  'https://prom.ua/p456',
]);

// Get competitor prices
const prices = await monitor.getCompetitorPrices('SKU001');
// [{ source: 'rozetka', price: 1450 }, { source: 'prom', price: 1520 }]

// Auto-repricing
await monitor.autoReprice('SKU001', {
  strategy: 'match_lowest',
  minMargin: 0.15, // 15% minimum margin
});
```

## Analytics

### Marketplace Performance

```typescript
const report = await analytics.getMarketplaceReport({
  period: 'month',
  groupBy: 'marketplace',
});

// {
//   summary: {
//     totalOrders: 500,
//     totalRevenue: 750000,
//   },
//   byMarketplace: {
//     rozetka: { orders: 300, revenue: 450000, avgOrder: 1500 },
//     prom: { orders: 150, revenue: 225000, avgOrder: 1500 },
//     direct: { orders: 50, revenue: 75000, avgOrder: 1500 },
//   }
// }
```

## Error Handling

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Category mismatch | Wrong category mapping | Update category mapping |
| Missing attributes | Required fields empty | Fill mandatory attributes |
| Price out of range | Price below minimum | Adjust price or margin |
| Stock sync failed | API rate limit | Implement backoff/retry |
| Order duplicate | Already imported | Check externalId before import |

### Retry Logic

```typescript
async function syncWithRetry(operation: () => Promise<void>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await operation();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

## Configuration Summary

```bash
# Rozetka
ROZETKA_API_KEY=
ROZETKA_SELLER_ID=

# Prom.ua
PROM_API_KEY=

# Google Shopping
GOOGLE_MERCHANT_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=

# Facebook
FACEBOOK_CATALOG_ID=
FACEBOOK_ACCESS_TOKEN=
FACEBOOK_PIXEL_ID=

# Feed generation
FEED_BASE_URL=https://yourstore.com
FEED_OUTPUT_DIR=/public/feeds
FEED_REFRESH_INTERVAL=3600  # seconds
```
