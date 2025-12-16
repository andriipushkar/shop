# Price Alerts

Система сповіщень про зміну цін для користувачів.

## Overview

Модуль price alerts забезпечує:
- Підписка на зниження ціни
- Сповіщення email/push/SMS
- Цільова ціна
- Історія цін
- Масові сповіщення

## Data Model

```typescript
interface PriceAlert {
  id: string;
  userId?: string;
  email: string;
  productId: string;
  targetPrice?: number;        // Alert when price <= target
  alertType: 'any_drop' | 'target_price' | 'percent_drop';
  percentDrop?: number;        // Alert when drops by X%
  currentPrice: number;        // Price when subscribed
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

interface PriceHistory {
  productId: string;
  price: number;
  oldPrice?: number;
  timestamp: Date;
  source: 'manual' | 'import' | 'api' | 'repricing';
}
```

## Usage

### Create Price Alert

```typescript
import { priceAlertsService } from '@/lib/price-alerts';

// Subscribe to any price drop
const alert = await priceAlertsService.subscribe({
  email: 'user@example.com',
  productId: 'prod-123',
  alertType: 'any_drop',
  currentPrice: 45000,
});

// Subscribe to target price
const alertTarget = await priceAlertsService.subscribe({
  email: 'user@example.com',
  productId: 'prod-123',
  alertType: 'target_price',
  targetPrice: 40000,
  currentPrice: 45000,
});

// Subscribe to percentage drop
const alertPercent = await priceAlertsService.subscribe({
  email: 'user@example.com',
  productId: 'prod-123',
  alertType: 'percent_drop',
  percentDrop: 10,  // 10% drop
  currentPrice: 45000,
});
```

### Check Alerts on Price Change

```typescript
// Called when product price changes
await priceAlertsService.checkAlerts({
  productId: 'prod-123',
  oldPrice: 45000,
  newPrice: 42000,
});

// This will:
// 1. Find all active alerts for this product
// 2. Check if conditions are met
// 3. Send notifications
// 4. Mark alerts as triggered
```

### Get User Alerts

```typescript
const alerts = await priceAlertsService.getUserAlerts({
  userId: user.id,
  isActive: true,
});
```

### Get Price History

```typescript
const history = await priceAlertsService.getPriceHistory({
  productId: 'prod-123',
  period: '90d',
});

// history = [
//   { price: 45000, timestamp: '2024-01-01' },
//   { price: 42000, timestamp: '2024-01-15' },
//   { price: 40000, timestamp: '2024-02-01' },
// ]
```

### Cancel Alert

```typescript
await priceAlertsService.cancel(alertId);

// Or unsubscribe via email link
await priceAlertsService.unsubscribe(alertId, token);
```

## API Endpoints

```
POST   /api/v1/price-alerts                 # Create alert
GET    /api/v1/price-alerts                 # User's alerts
GET    /api/v1/price-alerts/:id             # Get alert
DELETE /api/v1/price-alerts/:id             # Cancel alert
GET    /api/v1/price-alerts/unsubscribe     # Unsubscribe (email link)

GET    /api/v1/products/:id/price-history   # Price history
POST   /api/v1/products/:id/notify-me       # Simple "notify me" form
```

### Create Alert Request

```json
POST /api/v1/price-alerts
{
  "email": "user@example.com",
  "productId": "prod-123",
  "alertType": "target_price",
  "targetPrice": 40000
}
```

### Response

```json
{
  "id": "alert-123",
  "productId": "prod-123",
  "email": "user@example.com",
  "alertType": "target_price",
  "targetPrice": 40000,
  "currentPrice": 45000,
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

## Email Notification

```html
Subject: Ціна на iPhone 15 Pro знизилась!

Вітаємо!

Товар, який ви відстежуєте, подешевшав:

iPhone 15 Pro
Була ціна: 45 000 грн
Нова ціна: 40 000 грн
Ви економите: 5 000 грн (11%)

[Купити зараз]

Ця ціна може змінитись. Не пропустіть вигідну пропозицію!

---
Ви отримали цей лист, тому що підписались на сповіщення про ціну.
[Відписатись]
```

## Price Chart Widget

```tsx
function PriceChart({ productId }: { productId: string }) {
  const { data: history } = useQuery(['priceHistory', productId],
    () => priceAlertsService.getPriceHistory({ productId, period: '90d' })
  );

  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="font-medium mb-4">Історія ціни</h3>
      <LineChart data={history} xKey="timestamp" yKey="price" />
      <div className="flex justify-between text-sm text-gray-500 mt-2">
        <span>Мін: {Math.min(...history.map(h => h.price))} грн</span>
        <span>Макс: {Math.max(...history.map(h => h.price))} грн</span>
      </div>
    </div>
  );
}
```

## Subscribe Widget

```tsx
function PriceAlertWidget({ product }: { product: Product }) {
  const [email, setEmail] = useState('');
  const [targetPrice, setTargetPrice] = useState('');

  const handleSubmit = async () => {
    await priceAlertsService.subscribe({
      email,
      productId: product.id,
      alertType: targetPrice ? 'target_price' : 'any_drop',
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      currentPrice: product.price,
    });
    toast.success('Ви отримаєте сповіщення, коли ціна знизиться!');
  };

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium flex items-center gap-2">
        <BellIcon className="w-5 h-5" />
        Слідкувати за ціною
      </h4>
      <input
        type="email"
        placeholder="Ваш email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full mt-2 border rounded px-3 py-2"
      />
      <input
        type="number"
        placeholder={`Бажана ціна (зараз ${product.price} грн)`}
        value={targetPrice}
        onChange={e => setTargetPrice(e.target.value)}
        className="w-full mt-2 border rounded px-3 py-2"
      />
      <button
        onClick={handleSubmit}
        className="w-full mt-2 bg-teal-600 text-white rounded py-2"
      >
        Сповістити мене
      </button>
    </div>
  );
}
```

## Configuration

```bash
# Price alerts settings
PRICE_ALERTS_ENABLED=true
PRICE_ALERTS_MAX_PER_USER=50
PRICE_ALERTS_EXPIRY_DAYS=180
PRICE_ALERTS_BATCH_SIZE=100

# Notifications
PRICE_ALERTS_EMAIL_ENABLED=true
PRICE_ALERTS_PUSH_ENABLED=true
PRICE_ALERTS_SMS_ENABLED=false
```

## Cron Jobs

```typescript
// Check for expired alerts (daily)
cron.schedule('0 3 * * *', async () => {
  await priceAlertsService.cleanupExpired();
});

// Send digest of all price drops (optional)
cron.schedule('0 10 * * *', async () => {
  await priceAlertsService.sendDailyDigest();
});
```

## See Also

- [AI Repricing](./AI_REPRICING.md)
- [Pricing](./PRICING.md)
- [Email Notifications](./EMAIL.md)
- [Push Notifications](./PWA.md)
