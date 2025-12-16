# Product Bundles

Система комплектів товарів (бандлів) зі знижками.

## Overview

Модуль bundles забезпечує:
- Створення комплектів товарів
- Знижки на комплекти
- Динамічні бандли ("Разом дешевше")
- Автоматичні пропозиції
- Аналітика продажів бандлів

## Bundle Types

| Type | Description | Example |
|------|-------------|---------|
| `fixed` | Фіксований набір товарів | iPhone + чохол + захисне скло |
| `flexible` | Вибір з варіантів | Ноутбук + будь-яка миша зі списку |
| `tiered` | Знижка за кількість | Купи 2 - знижка 10%, 3 - 15% |
| `bogo` | Buy One Get One | Купи 2, отримай 3-й безкоштовно |

## Data Model

```typescript
interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: 'fixed' | 'flexible' | 'tiered' | 'bogo';
  items: BundleItem[];
  pricing: BundlePricing;
  image?: string;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  maxPurchases?: number;
  purchaseCount: number;
  createdAt: Date;
}

interface BundleItem {
  productId: string;
  quantity: number;
  isRequired: boolean;         // For flexible bundles
  options?: string[];          // Product IDs for flexible selection
  discount?: number;           // Per-item discount
}

interface BundlePricing {
  strategy: 'fixed_price' | 'percentage' | 'fixed_discount';
  originalPrice: number;       // Sum of individual prices
  bundlePrice?: number;        // For fixed_price
  discountPercent?: number;    // For percentage
  discountAmount?: number;     // For fixed_discount
  savingsAmount: number;
  savingsPercent: number;
}
```

## Usage

### Create Fixed Bundle

```typescript
import { bundlesService } from '@/lib/bundles';

const bundle = await bundlesService.create({
  name: 'iPhone Starter Kit',
  type: 'fixed',
  items: [
    { productId: 'iphone-15', quantity: 1, isRequired: true },
    { productId: 'case-leather', quantity: 1, isRequired: true },
    { productId: 'screen-protector', quantity: 1, isRequired: true },
  ],
  pricing: {
    strategy: 'percentage',
    discountPercent: 15,
  },
  startsAt: new Date('2024-01-15'),
  endsAt: new Date('2024-02-15'),
});
```

### Create Flexible Bundle

```typescript
const flexibleBundle = await bundlesService.create({
  name: 'Ноутбук + Аксесуар',
  type: 'flexible',
  items: [
    { productId: 'laptop-123', quantity: 1, isRequired: true },
    {
      productId: null,
      quantity: 1,
      isRequired: true,
      options: ['mouse-1', 'mouse-2', 'mouse-3'],  // Choose one
    },
  ],
  pricing: {
    strategy: 'fixed_discount',
    discountAmount: 500,  // 500 грн off
  },
});
```

### Create Tiered Bundle

```typescript
const tieredBundle = await bundlesService.create({
  name: 'Більше купуєш - більше економиш',
  type: 'tiered',
  items: [
    {
      productId: 'tshirt-123',
      quantity: 1,
      isRequired: true,
      tiers: [
        { minQuantity: 2, discountPercent: 10 },
        { minQuantity: 3, discountPercent: 15 },
        { minQuantity: 5, discountPercent: 20 },
      ],
    },
  ],
});
```

### Get Bundle Price

```typescript
const pricing = await bundlesService.calculatePrice({
  bundleId: 'bundle-123',
  selections: {
    'item-2': 'mouse-2',  // For flexible items
  },
  quantity: 1,
});

// pricing = {
//   originalPrice: 50000,
//   bundlePrice: 42500,
//   savingsAmount: 7500,
//   savingsPercent: 15,
//   items: [...]
// }
```

### Add Bundle to Cart

```typescript
await cartService.addBundle({
  bundleId: 'bundle-123',
  selections: {
    'item-2': 'mouse-2',
  },
  quantity: 1,
});
```

### Check Bundle Availability

```typescript
const available = await bundlesService.checkAvailability('bundle-123');

// available = {
//   isAvailable: true,
//   unavailableItems: [],
//   remainingStock: 50,
// }
```

## API Endpoints

```
GET    /api/v1/bundles                    # List active bundles
GET    /api/v1/bundles/:slug              # Get bundle
POST   /api/v1/bundles/:id/calculate      # Calculate price
POST   /api/v1/cart/bundle                # Add bundle to cart

# Admin
POST   /api/v1/admin/bundles              # Create bundle
PUT    /api/v1/admin/bundles/:id          # Update bundle
DELETE /api/v1/admin/bundles/:id          # Delete bundle
GET    /api/v1/admin/bundles/:id/stats    # Bundle stats
```

### Calculate Price Request

```json
POST /api/v1/bundles/bundle-123/calculate
{
  "selections": {
    "item-2": "mouse-wireless-black"
  },
  "quantity": 1
}
```

### Response

```json
{
  "bundleId": "bundle-123",
  "originalPrice": 50000,
  "bundlePrice": 42500,
  "savingsAmount": 7500,
  "savingsPercent": 15,
  "items": [
    {
      "productId": "laptop-123",
      "name": "Ноутбук ASUS",
      "price": 45000,
      "bundlePrice": 38250,
      "quantity": 1
    },
    {
      "productId": "mouse-wireless-black",
      "name": "Миша бездротова",
      "price": 5000,
      "bundlePrice": 4250,
      "quantity": 1
    }
  ]
}
```

## Bundle Widget

```tsx
function BundleCard({ bundle }: { bundle: Bundle }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{bundle.name}</h3>
        <Badge variant="success">
          Економія {bundle.pricing.savingsPercent}%
        </Badge>
      </div>

      <div className="flex gap-2 mt-4">
        {bundle.items.map(item => (
          <div key={item.productId} className="flex-1">
            <img src={item.product.image} className="w-full rounded" />
            <p className="text-sm mt-1">{item.product.name}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <span className="text-gray-500 line-through">
            {bundle.pricing.originalPrice} грн
          </span>
          <span className="text-xl font-bold text-teal-600 ml-2">
            {bundle.pricing.bundlePrice} грн
          </span>
        </div>
        <button className="bg-teal-600 text-white px-4 py-2 rounded">
          Додати в кошик
        </button>
      </div>
    </div>
  );
}
```

## "Frequently Bought Together" Widget

```tsx
function FrequentlyBoughtTogether({ productId }: { productId: string }) {
  const { data: suggestions } = useQuery(
    ['fbt', productId],
    () => bundlesService.getSuggestions(productId)
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="font-medium">Разом дешевше</h3>
      <div className="flex items-center gap-4 mt-4">
        {suggestions.products.map((product, i) => (
          <React.Fragment key={product.id}>
            {i > 0 && <span className="text-2xl">+</span>}
            <ProductMini product={product} />
          </React.Fragment>
        ))}
        <span className="text-2xl">=</span>
        <div className="text-center">
          <div className="text-gray-500 line-through">
            {suggestions.originalPrice} грн
          </div>
          <div className="text-xl font-bold text-teal-600">
            {suggestions.bundlePrice} грн
          </div>
        </div>
      </div>
      <button className="w-full mt-4 bg-teal-600 text-white py-2 rounded">
        Додати все в кошик
      </button>
    </div>
  );
}
```

## Configuration

```bash
# Bundles settings
BUNDLES_ENABLED=true
BUNDLES_MAX_ITEMS=10
BUNDLES_MIN_DISCOUNT=5
BUNDLES_MAX_DISCOUNT=50
```

## See Also

- [Products](./PRODUCTS.md)
- [Pricing](./PRICING.md)
- [Cart](./CART.md)
- [Recommendations](./RECOMMENDATIONS.md)
