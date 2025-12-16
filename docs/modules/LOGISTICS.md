# Logistics

Система логістики та доставки з інтеграцією українських перевізників.

## Overview

Модуль logistics забезпечує:
- Інтеграція з перевізниками (Нова Пошта, Укрпошта, Meest, Justin)
- Створення ТТН (накладних)
- Відстеження відправлень
- Розрахунок вартості доставки
- Пошук відділень та адресна доставка

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGISTICS SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Logistics  │                                               │
│  │   Service    │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         │  Carrier Abstraction                                  │
│         │                                                       │
│  ┌──────┴────────────────────────────────────────────────┐     │
│  │                                                        │     │
│  ▼                ▼                ▼                ▼     │     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│     │
│  │Нова Пошта │ │ Укрпошта   │ │   Meest    │ │ Justin ││     │
│  │           │ │            │ │            │ │        ││     │
│  │ - API 2.0 │ │ - Ecom API │ │ - API      │ │ - API  ││     │
│  │ - ТТН     │ │ - ТТН      │ │ - ТТН      │ │ - ТТН  ││     │
│  │ - Track   │ │ - Track    │ │ - Track    │ │ - Track││     │
│  └────────────┘ └────────────┘ └────────────┘ └────────┘│     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Carriers

| Carrier | Code | Features |
|---------|------|----------|
| Нова Пошта | `novaposhta` | Відділення, поштомати, адресна, експрес |
| Укрпошта | `ukrposhta` | Відділення, адресна |
| Meest | `meest` | Відділення, адресна |
| Justin | `justin` | Відділення, поштомати |

## Configuration

```bash
# Нова Пошта
NOVAPOSHTA_API_KEY=your_api_key
NOVAPOSHTA_SENDER_CONTACT_REF=ref
NOVAPOSHTA_SENDER_ADDRESS_REF=ref

# Укрпошта
UKRPOSHTA_API_KEY=your_api_key
UKRPOSHTA_SENDER_ID=sender_id

# Meest
MEEST_API_KEY=your_api_key
MEEST_USERNAME=username
MEEST_PASSWORD=password

# Justin
JUSTIN_API_KEY=your_api_key

# Default settings
DEFAULT_CARRIER=novaposhta
DEFAULT_PAYER=recipient
```

## Data Models

### Shipment

```typescript
interface Shipment {
  id: string;
  orderId: string;
  carrier: 'novaposhta' | 'ukrposhta' | 'meest' | 'justin';
  trackingNumber: string;       // ТТН
  status: ShipmentStatus;

  sender: {
    name: string;
    phone: string;
    city: string;
    warehouse?: string;
    address?: string;
  };

  recipient: {
    name: string;
    phone: string;
    city: string;
    warehouse?: string;
    address?: string;
  };

  packages: Package[];

  delivery: {
    type: 'warehouse' | 'address' | 'postomat';
    cost: number;
    estimatedDate: Date;
    payer: 'sender' | 'recipient';
  };

  payment: {
    type: 'prepaid' | 'cod';      // COD = Cash on Delivery
    codAmount?: number;
  };

  createdAt: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

interface Package {
  weight: number;               // kg
  length: number;               // cm
  width: number;
  height: number;
  description: string;
  declaredValue: number;
}
```

### Shipment Status

```typescript
type ShipmentStatus =
  | 'created'           // Створено
  | 'pending'           // Очікує відправки
  | 'in_transit'        // В дорозі
  | 'arrived'           // Прибув на відділення
  | 'delivering'        // Доставляється
  | 'delivered'         // Доставлено
  | 'returned'          // Повернено
  | 'cancelled';        // Скасовано
```

## Usage

### Create Shipment (Nova Poshta)

```typescript
import { logisticsService } from '@/lib/logistics';

const shipment = await logisticsService.createShipment({
  carrier: 'novaposhta',
  orderId: 'order-123',

  sender: {
    name: 'ТОВ "Мій Магазин"',
    phone: '+380991234567',
    cityRef: 'city-ref-kyiv',
    warehouseRef: 'warehouse-ref-1',
  },

  recipient: {
    name: 'Іван Петренко',
    phone: '+380997654321',
    cityRef: 'city-ref-lviv',
    warehouseRef: 'warehouse-ref-25',
  },

  packages: [{
    weight: 0.5,
    length: 20,
    width: 15,
    height: 10,
    description: 'Смартфон',
    declaredValue: 25000,
  }],

  delivery: {
    type: 'warehouse',
    payer: 'recipient',
  },

  payment: {
    type: 'cod',
    codAmount: 25000,
  },
});

console.log('ТТН:', shipment.trackingNumber);
// Output: 20450123456789
```

### Track Shipment

```typescript
// Get current status
const tracking = await logisticsService.track('novaposhta', '20450123456789');

console.log('Status:', tracking.status);
console.log('Location:', tracking.currentLocation);
console.log('History:', tracking.history);

// tracking.history example:
// [
//   { date: '2024-01-15 10:00', status: 'Відправлення створено' },
//   { date: '2024-01-15 14:00', status: 'Прийнято на склад' },
//   { date: '2024-01-16 08:00', status: 'Відправлено з Києва' },
//   { date: '2024-01-16 18:00', status: 'Прибуло на склад Львів' },
// ]
```

### Calculate Shipping Cost

```typescript
const cost = await logisticsService.calculateCost({
  carrier: 'novaposhta',

  from: {
    cityRef: 'city-ref-kyiv',
  },

  to: {
    cityRef: 'city-ref-lviv',
  },

  packages: [{
    weight: 0.5,
    length: 20,
    width: 15,
    height: 10,
    declaredValue: 25000,
  }],

  deliveryType: 'warehouse',
});

console.log('Cost:', cost.deliveryCost);        // 70 грн
console.log('Estimated:', cost.estimatedDays);  // 1-2 дні
```

### Search Warehouses

```typescript
// Search Nova Poshta warehouses
const warehouses = await logisticsService.searchWarehouses({
  carrier: 'novaposhta',
  cityRef: 'city-ref-lviv',
  search: 'вул. Городоцька',
});

// warehouses = [
//   { ref: 'wh-1', name: 'Відділення №1: вул. Городоцька, 25' },
//   { ref: 'wh-15', name: 'Відділення №15: вул. Городоцька, 107' },
// ]
```

### Search Cities

```typescript
const cities = await logisticsService.searchCities({
  carrier: 'novaposhta',
  search: 'Льв',
});

// cities = [
//   { ref: 'city-1', name: 'Львів', area: 'Львівська обл.' },
//   { ref: 'city-2', name: 'Львівка', area: 'Дніпропетровська обл.' },
// ]
```

## API Endpoints

```
POST /api/v1/logistics/shipments              # Create shipment
GET  /api/v1/logistics/shipments/:id          # Get shipment
GET  /api/v1/logistics/track/:carrier/:ttn    # Track shipment
POST /api/v1/logistics/calculate              # Calculate cost
GET  /api/v1/logistics/cities                 # Search cities
GET  /api/v1/logistics/warehouses             # Search warehouses
POST /api/v1/logistics/shipments/:id/cancel   # Cancel shipment
POST /api/v1/logistics/shipments/:id/print    # Print label
```

### Create Shipment Request

```json
POST /api/v1/logistics/shipments
{
  "carrier": "novaposhta",
  "orderId": "order-123",
  "sender": {
    "name": "ТОВ Мій Магазин",
    "phone": "+380991234567",
    "cityRef": "8d5a980d-391c-11dd-90d9-001a92567626",
    "warehouseRef": "1ec09d88-e1c2-11e3-8c4a-0050568002cf"
  },
  "recipient": {
    "name": "Іван Петренко",
    "phone": "+380997654321",
    "cityRef": "db5c88e0-391a-11dd-90d9-001a92567626",
    "warehouseRef": "1ec09d88-e1c2-11e3-8c4a-0050568002cf"
  },
  "packages": [{
    "weight": 0.5,
    "length": 20,
    "width": 15,
    "height": 10,
    "description": "Смартфон",
    "declaredValue": 25000
  }],
  "paymentType": "cod",
  "codAmount": 25000
}
```

### Response

```json
{
  "id": "ship-123",
  "trackingNumber": "20450123456789",
  "carrier": "novaposhta",
  "status": "created",
  "estimatedDelivery": "2024-01-17",
  "deliveryCost": 70,
  "labelUrl": "https://api.shop.ua/labels/ship-123.pdf"
}
```

## Print Label

```typescript
// Get PDF label
const label = await logisticsService.getLabel(shipmentId);

// Print using hardware service
await hardwareService.printDocument(label, {
  printer: 'label-printer',
  size: 'A6',
});
```

## Tracking Webhook

```typescript
// Register webhook for tracking updates
await logisticsService.registerWebhook({
  carrier: 'novaposhta',
  url: 'https://api.shop.ua/webhooks/tracking',
  events: ['status_changed', 'delivered', 'returned'],
});

// Handle webhook
app.post('/webhooks/tracking', async (req, res) => {
  const { carrier, trackingNumber, status, data } = req.body;

  // Update order status
  await updateOrderDeliveryStatus(trackingNumber, status);

  // Send notification to customer
  if (status === 'arrived') {
    await sendSMS(data.recipientPhone, `Ваше замовлення прибуло на ${data.warehouse}`);
  }

  res.sendStatus(200);
});
```

## Multi-Carrier Shipping

```typescript
// Get best rates from all carriers
const rates = await logisticsService.getRates({
  from: { city: 'Київ' },
  to: { city: 'Львів' },
  packages: [{ weight: 1, dimensions: '30x20x10' }],
});

// rates = [
//   { carrier: 'novaposhta', cost: 70, days: '1-2' },
//   { carrier: 'ukrposhta', cost: 45, days: '3-5' },
//   { carrier: 'meest', cost: 65, days: '2-3' },
//   { carrier: 'justin', cost: 55, days: '2-3' },
// ]
```

## Best Practices

1. **Validate addresses** - Use carrier API to validate
2. **Cache cities/warehouses** - Update daily
3. **Handle errors** - Retry failed API calls
4. **Track all shipments** - Poll for status updates
5. **Store tracking history** - For customer service
6. **Notify customers** - Send SMS/email on status change

## See Also

- [Orders](./ORDERS.md)
- [Delivery](./DELIVERY.md)
- [Nova Poshta Integration](../integrations/NOVA_POSHTA.md)
- [SMS Notifications](./SMS.md)
