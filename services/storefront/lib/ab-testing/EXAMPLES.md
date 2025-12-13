# A/B Testing Framework - Usage Examples

This document provides comprehensive examples of how to use the A/B testing framework in your storefront application.

## Table of Contents

1. [Setup](#setup)
2. [Basic Usage](#basic-usage)
3. [React Components](#react-components)
4. [React Hooks](#react-hooks)
5. [Programmatic API](#programmatic-api)
6. [Admin Dashboard](#admin-dashboard)
7. [Advanced Examples](#advanced-examples)

---

## Setup

### 1. Wrap your app with ABTestProvider

```tsx
// app/layout.tsx
import { ABTestProvider } from '@/lib/ab-testing';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ABTestProvider userId={userId}>
          {children}
        </ABTestProvider>
      </body>
    </html>
  );
}
```

### 2. Configure the service (optional)

```tsx
<ABTestProvider
  userId={userId}
  config={{
    storageKey: 'my_experiments',
    apiEndpoint: '/api/ab',
    autoTrackExposure: true,
    significanceThreshold: 95,
    minSampleSize: 100,
  }}
>
  {children}
</ABTestProvider>
```

---

## Basic Usage

### Simple A/B Test with Component

```tsx
import { ABTest } from '@/components/ABTest';

function CheckoutPage() {
  return (
    <div>
      <h1>Оформлення замовлення</h1>

      <ABTest
        experiment="checkout-button"
        variants={{
          control: <button className="btn-default">Купити</button>,
          variant_a: <button className="btn-green">Замовити зараз</button>,
          variant_b: <button className="btn-blue">Оформити замовлення</button>,
        }}
      />
    </div>
  );
}
```

### With Auto-tracking

```tsx
<ABTest
  experiment="checkout-button"
  variants={{
    control: <button>Купити</button>,
    variant_a: <button>Замовити зараз</button>,
  }}
  trackConversions={{
    onClick: 'button_clicked',  // Track click events
    onView: 'button_viewed',    // Track when variant is shown
  }}
/>
```

---

## React Components

### 1. ABTest Component

```tsx
import { ABTest } from '@/components/ABTest';

<ABTest
  experiment="product-card-layout"
  variants={{
    control: <ProductCardVertical product={product} />,
    variant_a: <ProductCardHorizontal product={product} />,
  }}
  onVariantAssigned={(variantId) => {
    console.log('User assigned to:', variantId);
  }}
/>
```

### 2. ABTestGroup Component

```tsx
import { ABTestGroup, Variant } from '@/components/ABTest';

<ABTestGroup experiment="pricing-display">
  <Variant id="control" isControl>
    <PriceStandard price={price} />
  </Variant>

  <Variant id="variant_a">
    <PriceBold price={price} />
  </Variant>

  <Variant id="variant_b">
    <PriceHighlight price={price} discount={discount} />
  </Variant>
</ABTestGroup>
```

### 3. ABConditional Component

```tsx
import { ABConditional } from '@/components/ABTest';

<ABConditional
  experiment="new-feature"
  variant="variant_a"
  fallback={<OldFeature />}
>
  <NewFeature />
</ABConditional>
```

### 4. FeatureFlag Component

```tsx
import { FeatureFlag } from '@/components/ABTest';

<FeatureFlag
  flag="dark-mode-toggle"
  fallback={<div>Темна тема недоступна</div>}
>
  <DarkModeToggle />
</FeatureFlag>
```

### 5. ConversionTrigger Component

```tsx
import { ConversionTrigger } from '@/components/ABTest';

<ConversionTrigger
  experiment="add-to-cart-button"
  event="add_to_cart"
  value={product.price}
  metadata={{ productId: product.id }}
  on="click"
>
  <button>Додати до кошика</button>
</ConversionTrigger>
```

---

## React Hooks

### 1. useExperiment Hook

```tsx
import { useExperiment } from '@/lib/ab-testing';

function ProductPage() {
  const { variant, isInExperiment, trackConversion } = useExperiment('product-layout');

  const handleAddToCart = () => {
    // Track conversion
    trackConversion('add_to_cart', product.price, {
      productId: product.id,
    });
  };

  if (!isInExperiment) {
    return <DefaultLayout />;
  }

  return (
    <div>
      <h2>Variant: {variant?.name}</h2>
      {variant?.id === 'variant_a' ? <LayoutA /> : <LayoutB />}
    </div>
  );
}
```

### 2. useVariant Hook

```tsx
import { useVariant } from '@/lib/ab-testing';

function PricingSection() {
  const { variant, config } = useVariant('pricing-experiment');

  if (!variant) return <DefaultPricing />;

  return (
    <div
      style={{
        backgroundColor: config.bgColor,
        fontSize: config.fontSize,
      }}
    >
      <PriceDisplay />
    </div>
  );
}
```

### 3. useVariantConfig Hook

```tsx
import { useVariantConfig } from '@/lib/ab-testing';

interface ButtonConfig {
  color: string;
  size: 'small' | 'medium' | 'large';
  text: string;
}

function CTAButton() {
  const config = useVariantConfig<ButtonConfig>('cta-button-test');

  if (!config) return <button>Купити</button>;

  return (
    <button
      className={`btn-${config.color} btn-${config.size}`}
    >
      {config.text}
    </button>
  );
}
```

### 4. useFeatureFlag Hook

```tsx
import { useFeatureFlag } from '@/lib/ab-testing';

function Navigation() {
  const showNewMenu = useFeatureFlag('new-navigation', 'enabled');

  return (
    <nav>
      {showNewMenu ? <NewNavigation /> : <OldNavigation />}
    </nav>
  );
}
```

### 5. useConversionTracking Hook

```tsx
import { useConversionTracking } from '@/lib/ab-testing';

function CheckoutButton() {
  const trackConversion = useConversionTracking('checkout-flow');

  const handleClick = async () => {
    await trackConversion('checkout_started');
    router.push('/checkout');
  };

  return <button onClick={handleClick}>Оформити</button>;
}
```

---

## Programmatic API

### 1. Initialize Service

```typescript
import { getABTestingService } from '@/lib/ab-testing';

const service = getABTestingService({
  apiEndpoint: '/api/ab',
  autoTrackExposure: true,
});

await service.initialize(userId);
```

### 2. Create Experiment

```typescript
const experiment = await service.createExperiment({
  name: 'Тест кнопки checkout',
  description: 'Порівняння різних текстів на кнопці',
  status: 'draft',
  type: 'ab_test',
  variants: [
    {
      id: 'control',
      name: 'Контроль',
      weight: 50,
      isControl: true,
      config: { text: 'Купити' },
    },
    {
      id: 'variant_a',
      name: 'Варіант A',
      weight: 50,
      isControl: false,
      config: { text: 'Замовити зараз' },
    },
  ],
  targeting: {
    deviceTypes: ['mobile', 'desktop'],
    countries: ['UA'],
  },
  metrics: [
    { id: 'conversion', name: 'Conversion', type: 'conversion', isPrimary: true },
  ],
  allocation: 100,
  createdBy: 'admin',
});
```

### 3. Get Variant

```typescript
const variant = service.getVariant('checkout-button');

if (variant) {
  console.log('Assigned variant:', variant.name);
  console.log('Config:', variant.config);
}
```

### 4. Track Conversion

```typescript
await service.trackConversion(
  'checkout-button',
  'purchase_completed',
  totalAmount,
  { orderId, items }
);
```

### 5. Get Results

```typescript
const results = await service.getResults('checkout-button');

console.log('Total participants:', results.totalParticipants);
console.log('Statistical significance:', results.statisticalSignificance);
console.log('Uplift:', results.uplift);

results.variantResults.forEach(result => {
  console.log(`${result.variantId}: ${result.conversionRate}%`);
});
```

### 6. Declare Winner

```typescript
if (results.statisticalSignificance >= 95 && results.recommendedVariant) {
  await service.declareWinner('checkout-button', results.recommendedVariant);
}
```

---

## Admin Dashboard

Access the admin dashboard at: `/admin/ab-testing`

### Features:

- View all experiments
- Create new experiments
- View real-time results
- See statistical significance
- Declare winners
- Pause/resume experiments

---

## Advanced Examples

### 1. Multi-page Experiment

```tsx
// Track across multiple pages
function ProductPage() {
  const { trackConversion } = useExperiment('product-to-checkout');

  return <ProductDetails onAddToCart={() => trackConversion('added_to_cart')} />;
}

function CheckoutPage() {
  const { trackConversion } = useExperiment('product-to-checkout');

  return <Checkout onComplete={() => trackConversion('purchase_completed')} />;
}
```

### 2. Personalized Experiments

```tsx
const experiment = await service.createExperiment({
  name: 'VIP Pricing',
  type: 'personalization',
  variants: [
    { id: 'standard', name: 'Standard', weight: 50, isControl: true, config: {} },
    { id: 'vip', name: 'VIP Discount', weight: 50, isControl: false, config: { discount: 10 } },
  ],
  targeting: {
    userSegments: ['vip', 'premium'],
    isLoggedIn: true,
  },
  allocation: 100,
});
```

### 3. Multivariate Test

```tsx
const experiment = await service.createExperiment({
  name: 'Button Color and Text',
  type: 'multivariate',
  variants: [
    { id: 'control', name: 'Blue/Buy', weight: 25, isControl: true, config: { color: 'blue', text: 'Buy' } },
    { id: 'v1', name: 'Green/Buy', weight: 25, isControl: false, config: { color: 'green', text: 'Buy' } },
    { id: 'v2', name: 'Blue/Order', weight: 25, isControl: false, config: { color: 'blue', text: 'Order Now' } },
    { id: 'v3', name: 'Green/Order', weight: 25, isControl: false, config: { color: 'green', text: 'Order Now' } },
  ],
  allocation: 100,
});
```

### 4. Sequential Testing

```tsx
// First experiment
const layoutTest = useExperiment('layout-test');

// Second experiment (only for users in variant_a of first)
const colorTest = useExperiment('color-test');

if (layoutTest.variantId === 'variant_a' && colorTest.isInExperiment) {
  return <NewLayoutWithColor />;
}
```

### 5. Real-time Monitoring

```tsx
function ExperimentMonitor() {
  const [results, setResults] = useState(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await service.getResults('checkout-button');
      setResults(data);

      // Auto-stop if losing badly
      if (data.statisticalSignificance >= 95 && data.uplift < -20) {
        await service.stopExperiment('checkout-button');
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return <ResultsDisplay results={results} />;
}
```

---

## API Endpoints

### GET /api/ab/experiments
Get all experiments (optionally filtered by status)

### POST /api/ab/experiments
Create new experiment

### GET /api/ab/experiments/:id
Get single experiment

### PUT /api/ab/experiments/:id
Update experiment

### DELETE /api/ab/experiments/:id
Delete experiment

### POST /api/ab/track
Track conversion/exposure event

### GET /api/ab/results/:id
Get experiment results with statistical analysis

---

## Best Practices

1. **Always have a control variant** - Mark exactly one variant as `isControl: true`

2. **Ensure weights sum to 100** - Variant weights must add up to 100%

3. **Use consistent hashing** - Same user always gets same variant

4. **Track both exposure and conversion** - Track when variant is shown and when goal is achieved

5. **Wait for statistical significance** - Don't declare winner until 95%+ confidence

6. **Set minimum sample size** - Ensure enough data before making decisions

7. **Use meaningful metric names** - Make event names descriptive

8. **Clean up old experiments** - Archive or delete completed experiments

---

## Troubleshooting

### Variant not showing up
- Check experiment status is 'running'
- Verify allocation is > 0
- Check targeting rules match user

### No tracking events
- Ensure autoTrackExposure is enabled
- Check API endpoint is correct
- Verify network requests in DevTools

### Results not updating
- Check events are being sent to server
- Verify experiment ID matches
- Ensure enough participants for statistics

---

## Support

For issues or questions, check the source code in:
- `/lib/ab-testing/ab-service.ts` - Core service
- `/lib/ab-testing/ab-context.tsx` - React hooks
- `/components/ABTest.tsx` - React components
- `/app/api/ab/` - API routes
