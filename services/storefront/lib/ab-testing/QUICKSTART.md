# A/B Testing - Quick Start Guide

Швидке впровадження A/B тестування за 5 хвилин.

## Крок 1: Додати провайдер (1 хв)

Відкрийте `app/layout.tsx` та обгорніть додаток у `ABTestProvider`:

```tsx
import { ABTestProvider } from '@/lib/ab-testing';

export default function RootLayout({ children }) {
  // Отримайте userId з сесії (або null для анонімних)
  const userId = null; // Або з auth context

  return (
    <html lang="uk">
      <body>
        <ABTestProvider userId={userId}>
          {children}
        </ABTestProvider>
      </body>
    </html>
  );
}
```

## Крок 2: Створити експеримент через API (2 хв)

Використайте curl або Postman для створення експерименту:

```bash
curl -X POST http://localhost:3000/api/ab/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тест кнопки checkout",
    "description": "Порівняння різних текстів",
    "status": "running",
    "type": "ab_test",
    "variants": [
      {
        "id": "control",
        "name": "Контроль",
        "weight": 50,
        "isControl": true,
        "config": { "text": "Купити", "color": "blue" }
      },
      {
        "id": "variant_a",
        "name": "Варіант A",
        "weight": 50,
        "isControl": false,
        "config": { "text": "Замовити зараз", "color": "green" }
      }
    ],
    "allocation": 100,
    "metrics": [
      { "id": "conversion", "name": "Conversion", "type": "conversion", "isPrimary": true }
    ],
    "targeting": {},
    "createdBy": "admin"
  }'
```

Або використайте адмін панель: `http://localhost:3000/admin/ab-testing`

## Крок 3: Додати A/B тест на сторінку (1 хв)

У вашому компоненті (наприклад, `app/checkout/page.tsx`):

```tsx
import { ABTest } from '@/components/ABTest';

export default function CheckoutPage() {
  return (
    <div>
      <h1>Оформлення замовлення</h1>

      <ABTest
        experiment="checkout-button-test"
        variants={{
          control: (
            <button className="bg-blue-600 text-white px-6 py-3 rounded">
              Купити
            </button>
          ),
          variant_a: (
            <button className="bg-green-600 text-white px-6 py-3 rounded">
              Замовити зараз
            </button>
          ),
        }}
      />
    </div>
  );
}
```

## Крок 4: Відстежити конверсії (1 хв)

Додайте відстеження конверсій:

```tsx
import { ABTest } from '@/components/ABTest';
import { useExperiment } from '@/lib/ab-testing';

export default function CheckoutPage() {
  const { trackConversion } = useExperiment('checkout-button-test');

  const handleCheckout = async () => {
    // Ваша логіка checkout
    await processCheckout();

    // Відстежити конверсію
    await trackConversion('purchase_completed', totalAmount);
  };

  return (
    <div>
      <ABTest
        experiment="checkout-button-test"
        variants={{
          control: (
            <button onClick={handleCheckout} className="bg-blue-600">
              Купити
            </button>
          ),
          variant_a: (
            <button onClick={handleCheckout} className="bg-green-600">
              Замовити зараз
            </button>
          ),
        }}
      />
    </div>
  );
}
```

## Крок 5: Перегляд результатів

Відкрийте адмін панель: `http://localhost:3000/admin/ab-testing`

Там ви побачите:
- Кількість учасників для кожного варіанту
- Коефіцієнт конверсії
- Статистичну значущість
- Рекомендацію переможця

## Альтернативні способи

### Спосіб 1: Використання хуку

```tsx
import { useVariant } from '@/lib/ab-testing';

function CheckoutButton() {
  const { variant, config } = useVariant('checkout-button-test');

  if (!variant) {
    return <button>Купити</button>;
  }

  return (
    <button
      className={`bg-${config.color}-600 text-white px-6 py-3 rounded`}
    >
      {config.text}
    </button>
  );
}
```

### Спосіб 2: Feature Flag

```tsx
import { FeatureFlag } from '@/components/ABTest';

function Navigation() {
  return (
    <nav>
      <FeatureFlag flag="new-menu">
        <NewNavigationMenu />
      </FeatureFlag>
    </nav>
  );
}
```

### Спосіб 3: Conditional Rendering

```tsx
import { ABConditional } from '@/components/ABTest';

function ProductPage() {
  return (
    <div>
      <ABConditional
        experiment="product-layout"
        variant="variant_a"
        fallback={<OldLayout />}
      >
        <NewLayout />
      </ABConditional>
    </div>
  );
}
```

## Перевірка роботи

1. Відкрийте сторінку у браузері
2. Оновіть кілька разів - ви завжди бачитимете один і той же варіант
3. Відкрийте в інкогніто - побачите можливо інший варіант
4. Перевірте localStorage: `techshop_ab_experiments`
5. Відкрийте Network tab - побачите запити до `/api/ab/track`

## Troubleshooting

### Не показується варіант
- Перевірте статус експерименту: має бути `running`
- Перевірте allocation: має бути > 0
- Відкрийте console - подивіться на помилки

### Не відстежуються події
- Перевірте Network tab - чи йдуть запити на `/api/ab/track`
- Перевірте experimentId - чи співпадає з створеним
- Перевірте чи користувач у експерименті: `isInExperiment`

### Результати не оновлюються
- Подивіться `/api/ab/results/:id` - чи є дані
- Перевірте чи були конверсії
- Оновіть сторінку адмін панелі

## Наступні кроки

1. Прочитайте [EXAMPLES.md](./EXAMPLES.md) для більш складних випадків
2. Налаштуйте базу даних замість in-memory storage
3. Додайте більше метрик (revenue, time on page, etc.)
4. Інтегруйте з вашою аналітикою
5. Налаштуйте автоматичне визначення переможця

## Підтримка

Перегляньте:
- [README.md](./README.md) - Повна документація
- [EXAMPLES.md](./EXAMPLES.md) - Детальні приклади
- Source code в `/lib/ab-testing/`

Успіхів з A/B тестуванням! 🚀
