# A/B Testing Framework

Комплексна система A/B тестування для storefront з підтримкою статистичного аналізу, React hooks та адмін панеллю.

## Особливості

- ✅ Consistent hashing для стабільного призначення варіантів
- ✅ Автоматичний розрахунок статистичної значущості
- ✅ React hooks та компоненти для легкої інтеграції
- ✅ Відстеження конверсій та подій
- ✅ Адмін панель для управління експериментами
- ✅ Підтримка таргетингу (пристрої, країни, сегменти)
- ✅ LocalStorage + server sync для зберігання даних
- ✅ Автоматичне визначення переможця
- ✅ Multivariate testing
- ✅ Feature flags

## Швидкий старт

### 1. Обгорнути додаток провайдером

```tsx
// app/layout.tsx
import { ABTestProvider } from '@/lib/ab-testing';

export default function RootLayout({ children }) {
  return (
    <ABTestProvider userId={userId}>
      {children}
    </ABTestProvider>
  );
}
```

### 2. Використати компонент ABTest

```tsx
import { ABTest } from '@/components/ABTest';

function ProductPage() {
  return (
    <ABTest
      experiment="checkout-button"
      variants={{
        control: <button>Купити</button>,
        variant_a: <button className="bg-green-600">Замовити зараз</button>,
      }}
    />
  );
}
```

### 3. Відстежувати конверсії

```tsx
import { useExperiment } from '@/lib/ab-testing';

function CheckoutPage() {
  const { trackConversion } = useExperiment('checkout-button');

  const handlePurchase = () => {
    trackConversion('purchase', totalAmount, { orderId });
  };

  return <button onClick={handlePurchase}>Оплатити</button>;
}
```

## Структура файлів

```
lib/ab-testing/
├── ab-service.ts          # Core A/B testing service
├── ab-context.tsx         # React context and hooks
├── index.ts              # Main exports
├── EXAMPLES.md           # Detailed usage examples
└── README.md            # This file

components/
└── ABTest.tsx            # React components for A/B testing

app/api/ab/
├── route.ts                      # GET/POST experiments
├── experiments/[id]/route.ts     # Single experiment CRUD
├── track/route.ts                # Tracking events
└── results/[id]/route.ts         # Results and statistics

app/admin/ab-testing/
└── page.tsx              # Admin dashboard

__tests__/lib/
├── ab-testing.test.ts    # Tests for original module
└── ab-service.test.ts    # Tests for service
```

## Основні компоненти

### ABTestProvider

Провайдер React Context для A/B тестування.

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

### ABTest Component

Декларативний компонент для A/B тестів.

```tsx
<ABTest
  experiment="product-layout"
  variants={{
    control: <LayoutA />,
    variant_a: <LayoutB />,
  }}
  trackConversions={{
    onClick: 'clicked',
    onView: 'viewed',
  }}
/>
```

### Hooks

#### useExperiment

Повна інформація про експеримент та методи відстеження.

```tsx
const { variant, isInExperiment, trackConversion } = useExperiment('exp-id');
```

#### useVariant

Отримати варіант для експерименту.

```tsx
const { variant, variantId, config } = useVariant('exp-id');
```

#### useVariantConfig

Типізована конфігурація варіанту.

```tsx
const config = useVariantConfig<{ color: string }>('exp-id');
```

#### useFeatureFlag

Простий feature flag.

```tsx
const isEnabled = useFeatureFlag('new-feature', 'enabled');
```

## API Endpoints

### GET /api/ab/experiments
Отримати всі експерименти

### POST /api/ab/experiments
Створити новий експеримент

```json
{
  "name": "Тест кнопки",
  "description": "Порівняння текстів",
  "variants": [
    { "id": "control", "name": "Контроль", "weight": 50, "isControl": true, "config": {} },
    { "id": "variant_a", "name": "Варіант A", "weight": 50, "isControl": false, "config": {} }
  ],
  "allocation": 100,
  "status": "draft"
}
```

### GET /api/ab/experiments/:id
Отримати один експеримент

### PUT /api/ab/experiments/:id
Оновити експеримент

### DELETE /api/ab/experiments/:id
Видалити експеримент

### POST /api/ab/track
Відстежити подію

```json
{
  "experimentId": "exp-1",
  "variantId": "variant_a",
  "eventName": "conversion",
  "eventValue": 100,
  "sessionId": "session-123",
  "metadata": {}
}
```

### GET /api/ab/results/:id
Отримати результати з статистикою

## Адмін панель

Доступна за адресою: `/admin/ab-testing`

Функції:
- Перегляд всіх експериментів
- Створення нових експериментів
- Перегляд результатів у реальному часі
- Індикатор статистичної значущості
- Оголошення переможця
- Призупинення/відновлення експериментів

## Статистичний аналіз

Система автоматично розраховує:

- **Conversion Rate** - коефіцієнт конверсії для кожного варіанту
- **Statistical Significance** - статистична значущість (z-test)
- **Uplift** - відносне покращення порівняно з контролем
- **Confidence Level** - рівень довіри (95%, 99%)
- **Recommended Variant** - рекомендований варіант

### Умови для оголошення переможця:

1. Статистична значущість ≥ 95%
2. Мінімальна кількість учасників (100+)
3. Позитивний uplift > 0%

## Приклади використання

### 1. Простий A/B тест

```tsx
<ABTest
  experiment="button-color"
  variants={{
    control: <button className="bg-blue-600">Купити</button>,
    variant_a: <button className="bg-green-600">Купити</button>,
  }}
/>
```

### 2. З відстеженням конверсій

```tsx
const { trackConversion } = useExperiment('checkout-flow');

const handleCheckout = async () => {
  await trackConversion('checkout_completed', orderTotal);
  router.push('/success');
};
```

### 3. Feature flag

```tsx
<FeatureFlag flag="dark-mode">
  <DarkModeToggle />
</FeatureFlag>
```

### 4. Multivariate test

```tsx
<ABTest
  experiment="product-card"
  variants={{
    control: <ProductCardStandard />,
    variant_a: <ProductCardBold />,
    variant_b: <ProductCardMinimal />,
    variant_c: <ProductCardExpanded />,
  }}
/>
```

## Тестування

Запустити тести:

```bash
npm test -- ab-testing
npm test -- ab-service
```

## Документація

Детальні приклади використання в [EXAMPLES.md](./EXAMPLES.md)

## Технічні деталі

### Consistent Hashing

Використовується для стабільного призначення варіантів:
- Той самий користувач завжди отримує той самий варіант
- Базується на userId або sessionId
- Не змінюється між сесіями

### Статистичний аналіз

Використовується z-test для обчислення статистичної значущості:

```
z = (p2 - p1) / SE
SE = sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2))
```

### Зберігання даних

- **Client**: localStorage для призначених варіантів
- **Server**: In-memory map (замініть на БД у production)
- **Sync**: Автоматична синхронізація при треку подій

## Обмеження поточної версії

- ⚠️ Зберігання у пам'яті (потрібна БД для production)
- ⚠️ Немає персистентності між перезапусками сервера
- ⚠️ Обмежена кількість одночасних експериментів

## Подальші покращення

- [ ] PostgreSQL/Redis для зберігання
- [ ] Байєсівський статистичний аналіз
- [ ] Real-time dashboard з WebSocket
- [ ] A/A тестування для валідації
- [ ] Експорт результатів (CSV, PDF)
- [ ] Інтеграція з аналітикою (Google Analytics, Mixpanel)
- [ ] Scheduled experiments (автостарт/стоп)
- [ ] Multi-armed bandit алгоритм

## Ліцензія

Частина storefront проекту
