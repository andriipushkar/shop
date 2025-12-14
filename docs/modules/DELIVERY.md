# Delivery & Logistics

Integration with Ukrainian and international shipping carriers for order fulfillment and tracking.

## Supported Carriers

| Carrier | Region | Features |
|---------|--------|----------|
| Nova Poshta | Ukraine | Full API, Real-time tracking, COD |
| Meest Express | Ukraine/EU | International shipping |
| Justin | Ukraine | Same-day delivery |
| Ukrposhta | Ukraine/Global | Budget option, international |
| DHL Express | Global | Express international |
| UPS | Global | International shipping |

## Nova Poshta Integration

### Configuration

```bash
NOVAPOSHTA_API_KEY=your_api_key
NOVAPOSHTA_API_URL=https://api.novaposhta.ua/v2.0/json/
```

### Features

- Create shipments (TTN - ТТН)
- Calculate delivery cost
- Track parcels in real-time
- Address search & validation
- Warehouse/Branch search
- COD (Cash on Delivery)
- Return shipments

### API Client

```typescript
import { NovaPoshta } from '@/lib/delivery/novaposhta';

const np = new NovaPoshta(apiKey);
```

### Create Shipment

```typescript
const shipment = await np.createDocument({
  // Sender (your company)
  sender: {
    ref: senderRef,            // Your counterparty ref
    cityRef: senderCityRef,
    addressRef: senderAddressRef,
    contactRef: senderContactRef,
    phone: '+380991234567',
  },

  // Recipient
  recipient: {
    firstName: 'Іван',
    lastName: 'Петренко',
    phone: '+380997654321',
    cityRef: recipientCityRef,
    addressRef: recipientAddressRef, // or warehouseRef
  },

  // Cargo details
  cargo: {
    type: 'Cargo',               // Cargo, Documents, TiresWheels, Pallet
    weight: 2.5,                 // kg
    volumetricLength: 30,        // cm
    volumetricWidth: 20,
    volumetricHeight: 15,
    description: 'Товари',
    cost: 1500,                  // Declared value (UAH)
  },

  // Payment
  payerType: 'Recipient',        // Sender, Recipient, ThirdPerson
  paymentMethod: 'NonCash',      // Cash, NonCash

  // Additional
  serviceType: 'WarehouseWarehouse', // or WarehouseDoors, DoorsWarehouse, DoorsDoors
  backwardDeliveryData: order.paymentMethod === 'cod' ? {
    type: 'Money',
    redeliveryAmount: order.total,
  } : undefined,
});

// shipment.IntDocNumber = "20450000000000" (TTN)
// shipment.Ref = "uuid"
// shipment.EstimatedDeliveryDate = "2024-01-20"
```

### Track Shipment

```typescript
const tracking = await np.trackDocument(ttn);

// Returns:
// {
//   Number: "20450000000000",
//   Status: "Відправлення отримано",
//   StatusCode: 9,
//   WarehouseRecipient: "Відділення №5",
//   DateReceived: "2024-01-20 14:30:00",
//   ActualDeliveryDate: "2024-01-20",
// }
```

### Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 1 | Створено | Document created |
| 2 | Видалено | Deleted |
| 3 | Не знайдено | Not found |
| 4 | На складі відправника | At sender warehouse |
| 5 | Відправлено | In transit |
| 6 | Знаходиться в місті | In destination city |
| 7 | На складі | At recipient warehouse |
| 8 | Виконується доставка | Out for delivery |
| 9 | Отримано | Delivered |
| 10 | Відмова отримувача | Recipient refused |
| 11 | Повернення | Returning |
| 102 | Отримано гроші | COD collected |

### Calculate Delivery Cost

```typescript
const cost = await np.calculateCost({
  citySender: senderCityRef,
  cityRecipient: recipientCityRef,
  weight: 2.5,
  cost: 1500,
  serviceType: 'WarehouseWarehouse',
  cargoType: 'Cargo',
});

// Returns:
// {
//   Cost: 65,
//   AssessedCost: 1500,
//   DeliveryDate: "2024-01-20"
// }
```

### Search Warehouses

```typescript
const warehouses = await np.getWarehouses({
  cityRef: cityRef,
  // or
  cityName: 'Київ',
  // filters
  typeOfWarehouseRef: postomatRef,  // Only postamats
  warehouseId: 5,                    // Specific number
});
```

### Search Cities

```typescript
const cities = await np.searchCity('Київ');

// Returns array with:
// {
//   Ref: "8d5a980d-391c-11dd-90d9-001a92567626",
//   Description: "Київ",
//   Area: "Київська",
// }
```

### Search Addresses (Streets)

```typescript
const streets = await np.searchStreet(cityRef, 'Хрещатик');
```

## Meest Express Integration

### Configuration

```bash
MEEST_API_KEY=your_api_key
MEEST_API_URL=https://api.meest.com/v3/
```

### Create Shipment

```typescript
import { MeestExpress } from '@/lib/delivery/meest';

const meest = new MeestExpress(apiKey);

const shipment = await meest.createShipment({
  sender: {
    name: 'Sender Company',
    phone: '+380991234567',
    address: {
      country: 'UA',
      city: 'Київ',
      street: 'Хрещатик',
      building: '1',
    },
  },
  recipient: {
    name: 'John Doe',
    phone: '+380997654321',
    address: {
      country: 'UA',
      city: 'Львів',
      branchId: 'MEEST_12345',
    },
  },
  parcels: [{
    weight: 2.5,
    length: 30,
    width: 20,
    height: 15,
  }],
  declaredValue: 1500,
  paymentType: 'sender',
});
```

### Track Parcel

```typescript
const tracking = await meest.track(trackingNumber);
```

## Justin Integration

### Configuration

```bash
JUSTIN_API_KEY=your_api_key
JUSTIN_API_URL=https://api.justin.ua/
```

### Create Shipment

```typescript
import { Justin } from '@/lib/delivery/justin';

const justin = new Justin(apiKey);

const shipment = await justin.createOrder({
  senderBranchId: '220000001',
  receiverBranchId: '220000025',
  orderWeight: 2.5,
  orderAmount: 1500,
  orderDescription: 'Products',
  receiverCompany: 'Іван Петренко',
  receiverPhone: '+380997654321',
});
```

## Ukrposhta Integration

### Configuration

```bash
UKRPOSHTA_TOKEN=your_bearer_token
UKRPOSHTA_API_URL=https://www.ukrposhta.ua/ecom/0.0.1/
```

### Create Shipment

```typescript
import { Ukrposhta } from '@/lib/delivery/ukrposhta';

const ukrposhta = new Ukrposhta(token);

const shipment = await ukrposhta.createShipment({
  sender: {
    name: 'Sender Name',
    phone: '+380991234567',
    addressId: senderAddressId,
  },
  recipient: {
    name: 'Recipient Name',
    phone: '+380997654321',
    postcode: '01001',
    address: 'вул. Хрещатик, 1',
  },
  parcels: [{
    weight: 2500, // grams
    length: 30,   // cm
    width: 20,
    height: 15,
  }],
  declaredPrice: 150000, // kopecks
  deliveryType: 'W2W',   // W2W, W2D, D2W, D2D
});
```

## Delivery Options UI

### Checkout Flow

```typescript
// 1. Get available delivery methods
const deliveryOptions = await delivery.getOptions({
  cityRef: selectedCity.ref,
  weight: cart.totalWeight,
  total: cart.total,
});

// Returns:
[
  {
    carrier: 'novaposhta',
    type: 'warehouse',
    name: 'Нова Пошта - До відділення',
    price: 55,
    estimatedDays: '1-2',
    branches: [...],
  },
  {
    carrier: 'novaposhta',
    type: 'courier',
    name: 'Нова Пошта - Кур\'єр',
    price: 85,
    estimatedDays: '1-2',
    addressRequired: true,
  },
  {
    carrier: 'ukrposhta',
    type: 'warehouse',
    name: 'Укрпошта',
    price: 35,
    estimatedDays: '3-5',
  },
]

// 2. User selects delivery method
// 3. User selects/enters address
// 4. Calculate final cost
const finalCost = await delivery.calculateCost({
  carrier: 'novaposhta',
  type: 'warehouse',
  cityRef: city.ref,
  warehouseRef: warehouse.ref,
  weight: cart.totalWeight,
  declaredValue: cart.total,
});
```

### Address Selection Component

```tsx
<DeliverySelector
  city={selectedCity}
  onCityChange={handleCityChange}
  carrier={selectedCarrier}
  onCarrierChange={handleCarrierChange}
  deliveryType={deliveryType} // warehouse | courier
  onDeliveryTypeChange={handleDeliveryTypeChange}
  warehouse={selectedWarehouse}
  onWarehouseChange={handleWarehouseChange}
  address={courierAddress}
  onAddressChange={handleAddressChange}
/>
```

## Tracking Page

### Tracking Component

```tsx
<OrderTracking orderId={orderId} />
```

### Tracking Timeline

```
┌─────────────────────────────────────────┐
│  📦 Замовлення #12345                   │
│  TTN: 20450000000000                    │
├─────────────────────────────────────────┤
│                                         │
│  ● Створено замовлення                  │
│    15 січня 2024, 10:30                 │
│                                         │
│  ● Передано в доставку                  │
│    15 січня 2024, 14:00                 │
│                                         │
│  ● В дорозі                             │
│    16 січня 2024, 08:00                 │
│                                         │
│  ◐ Прибуло у відділення                 │
│    16 січня 2024, 14:30                 │
│    Відділення №5, вул. Хрещатик, 1      │
│                                         │
│  ○ Очікується отримання                 │
│                                         │
└─────────────────────────────────────────┘
```

## Automatic Status Updates

### Webhook Processing

```typescript
// Nova Poshta status webhook
app.post('/webhooks/novaposhta', async (req, res) => {
  const { Number, StatusCode, DateScan } = req.body;

  const order = await findOrderByTTN(Number);
  if (!order) return res.status(404).send('Order not found');

  // Map NP status to order status
  const statusMap = {
    5: 'shipped',
    7: 'ready_for_pickup',
    9: 'delivered',
    10: 'failed_delivery',
  };

  const newStatus = statusMap[StatusCode];
  if (newStatus) {
    await updateOrderStatus(order.id, newStatus);
    await notifyCustomer(order, newStatus);
  }

  res.send('OK');
});
```

### Polling Fallback

For carriers without webhooks:

```typescript
// Cron job: every 2 hours
async function pollTrackingUpdates() {
  const activeShipments = await getActiveShipments();

  for (const shipment of activeShipments) {
    const status = await getCarrierTracking(shipment.carrier, shipment.trackingNumber);

    if (status.changed) {
      await updateShipmentStatus(shipment.id, status);
      await notifyCustomer(shipment.orderId, status);
    }
  }
}
```

## Delivery Analytics

### Metrics

| Metric | Description |
|--------|-------------|
| Delivery Rate | % orders delivered successfully |
| Average Delivery Time | Days from ship to deliver |
| Return Rate | % orders returned |
| Cost per Order | Average shipping cost |
| On-Time Rate | % delivered within estimate |

### Reports

```typescript
const deliveryReport = await analytics.getDeliveryReport({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  groupBy: 'carrier',
});

// Returns:
// {
//   summary: {
//     totalShipments: 1500,
//     deliveredOnTime: 1350,
//     averageDeliveryDays: 1.8,
//     totalCost: 82500,
//   },
//   byCarrier: {
//     novaposhta: { count: 1200, avgDays: 1.5, cost: 66000 },
//     meest: { count: 200, avgDays: 2.5, cost: 12000 },
//     ukrposhta: { count: 100, avgDays: 4.0, cost: 4500 },
//   }
// }
```

## Configuration Summary

```bash
# Nova Poshta
NOVAPOSHTA_API_KEY=
NOVAPOSHTA_SENDER_REF=           # Your counterparty ref
NOVAPOSHTA_SENDER_CITY_REF=
NOVAPOSHTA_SENDER_ADDRESS_REF=
NOVAPOSHTA_SENDER_CONTACT_REF=

# Meest
MEEST_API_KEY=
MEEST_SENDER_ID=

# Justin
JUSTIN_API_KEY=
JUSTIN_SENDER_BRANCH_ID=

# Ukrposhta
UKRPOSHTA_TOKEN=
UKRPOSHTA_SENDER_ADDRESS_ID=

# General
DELIVERY_DEFAULT_CARRIER=novaposhta
DELIVERY_FREE_SHIPPING_THRESHOLD=1500  # UAH
DELIVERY_WEBHOOK_URL=https://api.yourstore.com/webhooks/delivery
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `CITY_NOT_FOUND` | Invalid city | Search cities API first |
| `WAREHOUSE_NOT_FOUND` | Invalid branch | Get fresh warehouse list |
| `INVALID_PHONE` | Wrong format | Use +380XXXXXXXXX format |
| `WEIGHT_EXCEEDED` | Over limit | Split into multiple parcels |
| `INVALID_DIMENSIONS` | Wrong size | Check carrier limits |
