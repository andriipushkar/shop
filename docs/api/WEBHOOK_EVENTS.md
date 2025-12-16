# Webhook Events

Документація webhook подій та інтеграцій.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEBHOOK SYSTEM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Event Source ──▶ Event Queue ──▶ Webhook Dispatcher ──▶ Your Endpoint     │
│                                         │                                   │
│                                         ├── Retry logic                     │
│                                         ├── Signature verification          │
│                                         └── Delivery tracking               │
│                                                                              │
│  Events:                                                                    │
│  ├── order.*     (created, updated, paid, shipped, delivered, cancelled)   │
│  ├── product.*   (created, updated, deleted, stock_changed)                │
│  ├── customer.*  (created, updated, deleted)                               │
│  ├── payment.*   (completed, failed, refunded)                             │
│  └── inventory.* (low_stock, out_of_stock)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Setup

### Creating a Webhook

```bash
curl -X POST https://api.shop.ua/webhooks \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/shop",
    "events": ["order.created", "order.paid", "order.shipped"],
    "secret": "whsec_your_secret_key"
  }'
```

Response:
```json
{
  "id": "wh_abc123",
  "url": "https://your-app.com/webhooks/shop",
  "events": ["order.created", "order.paid", "order.shipped"],
  "status": "active",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Managing Webhooks

```bash
# List webhooks
curl https://api.shop.ua/webhooks \
  -H "Authorization: Bearer $API_KEY"

# Update webhook
curl -X PATCH https://api.shop.ua/webhooks/wh_abc123 \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"events": ["order.*"]}'

# Delete webhook
curl -X DELETE https://api.shop.ua/webhooks/wh_abc123 \
  -H "Authorization: Bearer $API_KEY"

# Test webhook
curl -X POST https://api.shop.ua/webhooks/wh_abc123/test \
  -H "Authorization: Bearer $API_KEY"
```

## Event Types

### Order Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `order.created` | New order placed | Checkout completion |
| `order.updated` | Order details changed | Admin update |
| `order.paid` | Payment confirmed | Payment success |
| `order.shipped` | Order shipped | Tracking added |
| `order.delivered` | Order delivered | Delivery confirmed |
| `order.cancelled` | Order cancelled | Cancellation |
| `order.refunded` | Order refunded | Refund processed |

```json
// order.created payload
{
  "id": "evt_123",
  "type": "order.created",
  "created_at": "2024-01-15T10:30:00Z",
  "data": {
    "id": "ord_456",
    "number": "SH-2024-0001",
    "status": "pending",
    "total": 1500.00,
    "currency": "UAH",
    "customer": {
      "id": "cus_789",
      "email": "customer@example.com",
      "phone": "+380501234567"
    },
    "items": [
      {
        "product_id": "prod_111",
        "sku": "PHONE-001",
        "name": "iPhone 15",
        "quantity": 1,
        "price": 1500.00
      }
    ],
    "shipping": {
      "method": "nova_poshta",
      "city": "Київ",
      "warehouse": "Відділення №1"
    },
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Product Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `product.created` | New product added | Product creation |
| `product.updated` | Product details changed | Product edit |
| `product.deleted` | Product removed | Product deletion |
| `product.stock_changed` | Stock level changed | Inventory update |

```json
// product.stock_changed payload
{
  "id": "evt_234",
  "type": "product.stock_changed",
  "created_at": "2024-01-15T11:00:00Z",
  "data": {
    "product_id": "prod_111",
    "sku": "PHONE-001",
    "name": "iPhone 15",
    "previous_stock": 50,
    "current_stock": 45,
    "change": -5,
    "reason": "order_placed",
    "order_id": "ord_456"
  }
}
```

### Customer Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `customer.created` | New customer registered | Registration |
| `customer.updated` | Customer profile changed | Profile update |
| `customer.deleted` | Customer deleted | Account deletion |

### Payment Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `payment.completed` | Payment successful | Payment confirmation |
| `payment.failed` | Payment failed | Payment error |
| `payment.refunded` | Refund processed | Refund completion |

```json
// payment.completed payload
{
  "id": "evt_345",
  "type": "payment.completed",
  "created_at": "2024-01-15T10:35:00Z",
  "data": {
    "payment_id": "pay_789",
    "order_id": "ord_456",
    "amount": 1500.00,
    "currency": "UAH",
    "method": "liqpay",
    "transaction_id": "TRX123456",
    "paid_at": "2024-01-15T10:35:00Z"
  }
}
```

### Inventory Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `inventory.low_stock` | Stock below threshold | Stock update |
| `inventory.out_of_stock` | Stock depleted | Stock reaches 0 |

```json
// inventory.low_stock payload
{
  "id": "evt_456",
  "type": "inventory.low_stock",
  "created_at": "2024-01-15T12:00:00Z",
  "data": {
    "product_id": "prod_111",
    "sku": "PHONE-001",
    "name": "iPhone 15",
    "current_stock": 5,
    "threshold": 10,
    "warehouse_id": "wh_001"
  }
}
```

## Webhook Delivery

### Request Format

```http
POST /webhooks/shop HTTP/1.1
Host: your-app.com
Content-Type: application/json
X-Webhook-ID: wh_abc123
X-Webhook-Event: order.created
X-Webhook-Signature: sha256=abc123...
X-Webhook-Timestamp: 1705314600

{
  "id": "evt_123",
  "type": "order.created",
  "created_at": "2024-01-15T10:30:00Z",
  "data": {...}
}
```

### Signature Verification

```typescript
// Node.js verification
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expectedSignature)
  );
}

// Usage in Express
app.post('/webhooks/shop', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;

  // Verify timestamp is recent (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return res.status(400).send('Timestamp too old');
  }

  // Verify signature
  if (!verifyWebhookSignature(req.body.toString(), signature, timestamp, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());

  // Process event
  switch (event.type) {
    case 'order.created':
      handleOrderCreated(event.data);
      break;
    case 'order.paid':
      handleOrderPaid(event.data);
      break;
    // ...
  }

  res.status(200).send('OK');
});
```

```go
// Go verification
package webhook

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "strconv"
    "time"
)

func VerifySignature(payload, signature, timestamp, secret string) error {
    // Check timestamp
    ts, err := strconv.ParseInt(timestamp, 10, 64)
    if err != nil {
        return fmt.Errorf("invalid timestamp")
    }

    if time.Now().Unix()-ts > 300 {
        return fmt.Errorf("timestamp too old")
    }

    // Compute signature
    signedPayload := fmt.Sprintf("%s.%s", timestamp, payload)
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedPayload))
    expected := hex.EncodeToString(mac.Sum(nil))

    // Compare signatures
    if !hmac.Equal([]byte(expected), []byte(strings.TrimPrefix(signature, "sha256="))) {
        return fmt.Errorf("invalid signature")
    }

    return nil
}
```

## Retry Policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 5 minutes |
| 3 | 30 minutes |
| 4 | 2 hours |
| 5 | 24 hours |

After 5 failed attempts, the webhook is marked as failed and requires manual retry.

### Expected Response

- **2xx** - Success, delivery confirmed
- **4xx** - Client error, no retry (except 429)
- **5xx** - Server error, will retry
- **Timeout (30s)** - Will retry

## Webhook Logs

```bash
# Get delivery logs
curl https://api.shop.ua/webhooks/wh_abc123/deliveries \
  -H "Authorization: Bearer $API_KEY"
```

```json
{
  "data": [
    {
      "id": "del_123",
      "event_id": "evt_123",
      "event_type": "order.created",
      "status": "delivered",
      "attempts": 1,
      "response_code": 200,
      "response_time_ms": 145,
      "delivered_at": "2024-01-15T10:30:01Z"
    },
    {
      "id": "del_124",
      "event_id": "evt_124",
      "event_type": "order.paid",
      "status": "failed",
      "attempts": 5,
      "last_error": "Connection timeout",
      "failed_at": "2024-01-16T10:30:00Z"
    }
  ]
}
```

## Best Practices

### Receiving Webhooks

1. **Respond quickly** - Return 200 immediately, process async
2. **Verify signatures** - Always validate webhook authenticity
3. **Handle duplicates** - Webhooks may be delivered multiple times
4. **Log everything** - Keep logs for debugging

### Idempotency

```typescript
// Use event ID for idempotency
async function handleWebhook(event: WebhookEvent) {
  // Check if already processed
  const existing = await db.processedEvents.findUnique({
    where: { eventId: event.id }
  });

  if (existing) {
    console.log(`Event ${event.id} already processed`);
    return;
  }

  // Process event in transaction
  await db.$transaction([
    processEvent(event),
    db.processedEvents.create({
      data: { eventId: event.id, processedAt: new Date() }
    })
  ]);
}
```

## See Also

- [API Reference](./README.md)
- [Error Codes](./ERROR_CODES.md)
- [Authentication](../modules/AUTH.md)
