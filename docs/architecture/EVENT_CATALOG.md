# Event Catalog

Каталог подій системи для event-driven архітектури.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT-DRIVEN ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────────────┐  │
│  │ Producer │───▶│   RabbitMQ   │───▶│           Consumers              │  │
│  │ Services │    │   Exchange   │    │                                  │  │
│  └──────────┘    └──────────────┘    │  Core │ OMS │ CRM │ Notification │  │
│                                      └──────────────────────────────────┘  │
│                                                                              │
│  Event Types:                                                                │
│  ├── Domain Events (business logic)                                         │
│  ├── Integration Events (cross-service)                                     │
│  └── System Events (infrastructure)                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Event Structure

### Base Event Format

```json
{
  "id": "evt_123456789",
  "type": "order.created",
  "version": "1.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "tenant_id": "tenant_abc123",
  "correlation_id": "req_xyz789",
  "source": "core-service",
  "data": {
    // Event-specific payload
  },
  "metadata": {
    "user_id": "user_123",
    "ip": "192.168.1.1",
    "user_agent": "Mozilla/5.0..."
  }
}
```

### TypeScript Interface

```typescript
interface BaseEvent<T = unknown> {
  id: string;
  type: string;
  version: string;
  timestamp: string;
  tenant_id: string;
  correlation_id?: string;
  source: string;
  data: T;
  metadata?: Record<string, unknown>;
}
```

## Order Events

### order.created

Замовлення створено.

```json
{
  "type": "order.created",
  "version": "1.0",
  "data": {
    "order_id": "ord_123456",
    "number": "UA-2024-001234",
    "customer_id": "cust_789",
    "items": [
      {
        "product_id": "prod_abc",
        "variant_id": "var_xyz",
        "name": "Product Name",
        "sku": "SKU-001",
        "quantity": 2,
        "price": 1500.00,
        "total": 3000.00
      }
    ],
    "subtotal": 3000.00,
    "shipping_cost": 70.00,
    "discount_amount": 0,
    "total": 3070.00,
    "shipping_address": {
      "city": "Київ",
      "address": "вул. Хрещатик, 1"
    },
    "shipping_method": "nova_poshta",
    "payment_method": "liqpay",
    "source": "web"
  }
}
```

**Consumers:**
- `inventory-service`: Reserve stock
- `notification-service`: Send confirmation email
- `crm-service`: Update customer stats
- `analytics-service`: Track conversion

### order.confirmed

Замовлення підтверджено.

```json
{
  "type": "order.confirmed",
  "version": "1.0",
  "data": {
    "order_id": "ord_123456",
    "number": "UA-2024-001234",
    "confirmed_at": "2024-01-15T11:00:00Z",
    "confirmed_by": "user_admin"
  }
}
```

### order.paid

Оплата отримана.

```json
{
  "type": "order.paid",
  "version": "1.0",
  "data": {
    "order_id": "ord_123456",
    "payment_id": "pay_xyz",
    "amount": 3070.00,
    "method": "liqpay",
    "transaction_id": "LQ_123456789"
  }
}
```

**Consumers:**
- `oms-service`: Proceed to fulfillment
- `notification-service`: Send payment confirmation
- `fiscal-service`: Generate fiscal receipt

### order.shipped

Замовлення відправлено.

```json
{
  "type": "order.shipped",
  "version": "1.0",
  "data": {
    "order_id": "ord_123456",
    "tracking_number": "20450000000001",
    "carrier": "nova_poshta",
    "shipped_at": "2024-01-16T14:00:00Z",
    "estimated_delivery": "2024-01-17"
  }
}
```

### order.delivered

Замовлення доставлено.

```json
{
  "type": "order.delivered",
  "version": "1.0",
  "data": {
    "order_id": "ord_123456",
    "delivered_at": "2024-01-17T12:30:00Z",
    "signed_by": "Петренко І."
  }
}
```

### order.cancelled

Замовлення скасовано.

```json
{
  "type": "order.cancelled",
  "version": "1.0",
  "data": {
    "order_id": "ord_123456",
    "reason": "customer_request",
    "cancelled_at": "2024-01-15T15:00:00Z",
    "cancelled_by": "user_123",
    "refund_required": true
  }
}
```

**Consumers:**
- `inventory-service`: Release reserved stock
- `payment-service`: Process refund
- `notification-service`: Send cancellation email

## Product Events

### product.created

```json
{
  "type": "product.created",
  "version": "1.0",
  "data": {
    "product_id": "prod_abc123",
    "name": "Смартфон Samsung Galaxy S24",
    "sku": "SAM-S24-128-BLK",
    "category_id": "cat_phones",
    "price": 35999.00,
    "status": "draft"
  }
}
```

### product.published

```json
{
  "type": "product.published",
  "version": "1.0",
  "data": {
    "product_id": "prod_abc123",
    "published_at": "2024-01-15T10:00:00Z"
  }
}
```

**Consumers:**
- `search-service`: Index in Elasticsearch
- `feed-service`: Add to product feeds
- `recommendation-service`: Update ML models

### product.updated

```json
{
  "type": "product.updated",
  "version": "1.0",
  "data": {
    "product_id": "prod_abc123",
    "changes": {
      "price": { "old": 35999.00, "new": 32999.00 },
      "quantity": { "old": 100, "new": 85 }
    }
  }
}
```

### product.deleted

```json
{
  "type": "product.deleted",
  "version": "1.0",
  "data": {
    "product_id": "prod_abc123",
    "deleted_at": "2024-01-15T18:00:00Z"
  }
}
```

## Inventory Events

### inventory.reserved

```json
{
  "type": "inventory.reserved",
  "version": "1.0",
  "data": {
    "reservation_id": "res_xyz",
    "order_id": "ord_123456",
    "items": [
      {
        "product_id": "prod_abc",
        "variant_id": "var_xyz",
        "warehouse_id": "wh_001",
        "quantity": 2
      }
    ],
    "expires_at": "2024-01-15T11:30:00Z"
  }
}
```

### inventory.committed

```json
{
  "type": "inventory.committed",
  "version": "1.0",
  "data": {
    "reservation_id": "res_xyz",
    "order_id": "ord_123456",
    "committed_at": "2024-01-15T11:00:00Z"
  }
}
```

### inventory.released

```json
{
  "type": "inventory.released",
  "version": "1.0",
  "data": {
    "reservation_id": "res_xyz",
    "reason": "order_cancelled"
  }
}
```

### inventory.low_stock

```json
{
  "type": "inventory.low_stock",
  "version": "1.0",
  "data": {
    "product_id": "prod_abc",
    "warehouse_id": "wh_001",
    "current_quantity": 5,
    "threshold": 10
  }
}
```

**Consumers:**
- `notification-service`: Alert admin
- `purchasing-service`: Create purchase order

### inventory.out_of_stock

```json
{
  "type": "inventory.out_of_stock",
  "version": "1.0",
  "data": {
    "product_id": "prod_abc",
    "warehouse_id": "wh_001"
  }
}
```

## Customer Events

### customer.created

```json
{
  "type": "customer.created",
  "version": "1.0",
  "data": {
    "customer_id": "cust_789",
    "email": "customer@example.com",
    "phone": "+380501234567",
    "first_name": "Іван",
    "last_name": "Петренко",
    "source": "web_registration"
  }
}
```

### customer.updated

```json
{
  "type": "customer.updated",
  "version": "1.0",
  "data": {
    "customer_id": "cust_789",
    "changes": {
      "phone": { "old": "+380501234567", "new": "+380671234567" }
    }
  }
}
```

### customer.segment_changed

```json
{
  "type": "customer.segment_changed",
  "version": "1.0",
  "data": {
    "customer_id": "cust_789",
    "old_segment": "regular",
    "new_segment": "vip",
    "reason": "total_spent_threshold"
  }
}
```

## Payment Events

### payment.initiated

```json
{
  "type": "payment.initiated",
  "version": "1.0",
  "data": {
    "payment_id": "pay_xyz",
    "order_id": "ord_123456",
    "amount": 3070.00,
    "currency": "UAH",
    "method": "liqpay",
    "redirect_url": "https://www.liqpay.ua/..."
  }
}
```

### payment.completed

```json
{
  "type": "payment.completed",
  "version": "1.0",
  "data": {
    "payment_id": "pay_xyz",
    "order_id": "ord_123456",
    "transaction_id": "LQ_123456789",
    "amount": 3070.00,
    "completed_at": "2024-01-15T10:35:00Z"
  }
}
```

### payment.failed

```json
{
  "type": "payment.failed",
  "version": "1.0",
  "data": {
    "payment_id": "pay_xyz",
    "order_id": "ord_123456",
    "error_code": "insufficient_funds",
    "error_message": "Недостатньо коштів на картці"
  }
}
```

### payment.refunded

```json
{
  "type": "payment.refunded",
  "version": "1.0",
  "data": {
    "payment_id": "pay_xyz",
    "refund_id": "ref_abc",
    "amount": 3070.00,
    "reason": "order_cancelled"
  }
}
```

## System Events

### system.health_check_failed

```json
{
  "type": "system.health_check_failed",
  "version": "1.0",
  "data": {
    "service": "core-service",
    "check": "database",
    "error": "Connection timeout",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### system.rate_limit_exceeded

```json
{
  "type": "system.rate_limit_exceeded",
  "version": "1.0",
  "data": {
    "tenant_id": "tenant_abc",
    "endpoint": "/api/v1/products",
    "limit": 1000,
    "window": "1h"
  }
}
```

## RabbitMQ Configuration

### Exchanges

```yaml
exchanges:
  # Domain events
  - name: events
    type: topic
    durable: true

  # Dead letter exchange
  - name: events.dlx
    type: direct
    durable: true

  # Delayed messages
  - name: events.delayed
    type: x-delayed-message
    arguments:
      x-delayed-type: topic
```

### Queues

```yaml
queues:
  # Order processing
  - name: orders.created
    bindings:
      - exchange: events
        routing_key: order.created
    arguments:
      x-dead-letter-exchange: events.dlx
      x-message-ttl: 86400000

  # Inventory updates
  - name: inventory.updates
    bindings:
      - exchange: events
        routing_key: "inventory.*"

  # Notifications
  - name: notifications.email
    bindings:
      - exchange: events
        routing_key: "order.*"
        routing_key: "payment.*"

  # Search indexing
  - name: search.index
    bindings:
      - exchange: events
        routing_key: "product.*"
```

### Routing Keys

| Pattern | Description |
|---------|-------------|
| `order.*` | All order events |
| `order.created` | Order created |
| `product.#` | All product events |
| `inventory.low_stock` | Low stock alerts |
| `*.failed` | All failure events |

## Event Versioning

### Version Strategy

```typescript
// v1.0 - Original event
interface OrderCreatedV1 {
  order_id: string;
  total: number;
}

// v2.0 - Added currency
interface OrderCreatedV2 {
  order_id: string;
  total: number;
  currency: string;
}

// Handler with version support
function handleOrderCreated(event: BaseEvent) {
  switch (event.version) {
    case '1.0':
      return handleV1(event.data as OrderCreatedV1);
    case '2.0':
      return handleV2(event.data as OrderCreatedV2);
    default:
      throw new Error(`Unknown version: ${event.version}`);
  }
}
```

### Migration Strategy

```typescript
// Event upgrader
function upgradeEvent(event: BaseEvent): BaseEvent {
  if (event.type === 'order.created' && event.version === '1.0') {
    return {
      ...event,
      version: '2.0',
      data: {
        ...event.data,
        currency: 'UAH' // Default value
      }
    };
  }
  return event;
}
```

## Event Handlers

### Go Handler

```go
func (h *OrderHandler) HandleOrderCreated(ctx context.Context, event events.OrderCreated) error {
    span, ctx := opentracing.StartSpanFromContext(ctx, "HandleOrderCreated")
    defer span.Finish()

    // Process event
    if err := h.inventoryService.Reserve(ctx, event.Items); err != nil {
        return fmt.Errorf("reserve inventory: %w", err)
    }

    // Publish follow-up event
    return h.publisher.Publish(ctx, events.InventoryReserved{
        OrderID: event.OrderID,
        Items:   event.Items,
    })
}
```

### Consumer Configuration

```go
consumer := rabbitmq.NewConsumer(conn, rabbitmq.Config{
    Queue:       "orders.created",
    Exchange:    "events",
    RoutingKey:  "order.created",
    Prefetch:    10,
    AutoAck:     false,
    Retry: rabbitmq.RetryConfig{
        MaxRetries: 3,
        Delay:      time.Second * 5,
        Multiplier: 2,
    },
})
```

## Event Sourcing

### Aggregate Events

```go
type OrderAggregate struct {
    ID      string
    Status  string
    Events  []Event
    Version int
}

func (o *OrderAggregate) Apply(event Event) {
    switch e := event.(type) {
    case OrderCreated:
        o.ID = e.OrderID
        o.Status = "pending"
    case OrderConfirmed:
        o.Status = "confirmed"
    case OrderShipped:
        o.Status = "shipped"
    }
    o.Events = append(o.Events, event)
    o.Version++
}
```

## Monitoring Events

### Metrics

```promql
# Events published per second
rate(events_published_total[5m])

# Events consumed per second
rate(events_consumed_total[5m])

# Failed events
rate(events_failed_total[5m])

# Event processing latency
histogram_quantile(0.95, rate(event_processing_duration_seconds_bucket[5m]))
```

### Alerts

```yaml
- alert: EventProcessingBacklog
  expr: rabbitmq_queue_messages > 10000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Event queue backlog"

- alert: EventProcessingFailures
  expr: rate(events_failed_total[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
```

## See Also

- [RabbitMQ Setup](../infrastructure/RABBITMQ.md)
- [API Map](./API_MAP.md)
- [Tracing](../modules/TRACING.md)
