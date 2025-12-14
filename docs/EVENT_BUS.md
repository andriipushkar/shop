# Event Bus (RabbitMQ)

Documentation for the event-driven messaging system.

## Overview

The platform uses RabbitMQ for asynchronous communication between services. Events are published when state changes occur and consumed by interested services.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         RabbitMQ                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Exchanges                             │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │  orders  │  │ products │  │customers │  │  events │ │   │
│  │  │ (topic)  │  │ (topic)  │  │ (topic)  │  │ (fanout)│ │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │   │
│  └───────┼─────────────┼─────────────┼─────────────┼───────┘   │
│          │             │             │             │            │
│          ▼             ▼             ▼             ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Queues                              │   │
│  │                                                          │   │
│  │  order.created     product.updated    customer.created  │   │
│  │  order.paid        product.stock      customer.updated  │   │
│  │  order.shipped     inventory.low      segment.changed   │   │
│  │  order.delivered   search.reindex     loyalty.earned    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Exchanges

| Exchange | Type | Purpose |
|----------|------|---------|
| `orders` | topic | Order lifecycle events |
| `products` | topic | Product/inventory events |
| `customers` | topic | Customer events |
| `payments` | topic | Payment events |
| `notifications` | topic | Notification triggers |
| `analytics` | fanout | Analytics events (all consumers) |
| `deadletter` | direct | Failed message handling |

## Event Types

### Order Events

| Event | Routing Key | Payload |
|-------|-------------|---------|
| Order Created | `order.created` | Full order object |
| Order Confirmed | `order.confirmed` | Order ID, status |
| Order Paid | `order.paid` | Order ID, payment details |
| Order Processing | `order.processing` | Order ID |
| Order Shipped | `order.shipped` | Order ID, tracking |
| Order Delivered | `order.delivered` | Order ID |
| Order Cancelled | `order.cancelled` | Order ID, reason |
| Order Refunded | `order.refunded` | Order ID, amount |

### Product Events

| Event | Routing Key | Payload |
|-------|-------------|---------|
| Product Created | `product.created` | Full product object |
| Product Updated | `product.updated` | Product ID, changes |
| Product Deleted | `product.deleted` | Product ID |
| Stock Updated | `product.stock.updated` | SKU, new quantity |
| Low Stock | `product.stock.low` | SKU, quantity |
| Out of Stock | `product.stock.out` | SKU |
| Price Changed | `product.price.changed` | SKU, old/new price |

### Customer Events

| Event | Routing Key | Payload |
|-------|-------------|---------|
| Customer Created | `customer.created` | Customer data |
| Customer Updated | `customer.updated` | Customer ID, changes |
| Segment Changed | `customer.segment.changed` | Customer ID, old/new segment |
| Tier Changed | `customer.tier.changed` | Customer ID, old/new tier |
| Points Earned | `customer.points.earned` | Customer ID, points, source |
| Points Redeemed | `customer.points.redeemed` | Customer ID, points |

### Payment Events

| Event | Routing Key | Payload |
|-------|-------------|---------|
| Payment Initiated | `payment.initiated` | Payment ID, amount |
| Payment Completed | `payment.completed` | Payment ID, order ID |
| Payment Failed | `payment.failed` | Payment ID, error |
| Refund Completed | `payment.refund.completed` | Payment ID, amount |

### Notification Events

| Event | Routing Key | Payload |
|-------|-------------|---------|
| Send Email | `notification.email` | Template, recipient, data |
| Send SMS | `notification.sms` | Phone, message |
| Send Push | `notification.push` | User ID, message |
| Send Telegram | `notification.telegram` | Chat ID, message |

## Event Schema

### Standard Envelope

```json
{
  "id": "evt_123456789",
  "type": "order.created",
  "source": "oms-service",
  "timestamp": "2024-01-15T10:30:00Z",
  "tenant_id": "tenant_abc",
  "correlation_id": "req_xyz",
  "data": {
    // Event-specific payload
  },
  "metadata": {
    "version": "1.0",
    "user_id": "user_123"
  }
}
```

### Order Created Event

```json
{
  "id": "evt_123456789",
  "type": "order.created",
  "source": "oms-service",
  "timestamp": "2024-01-15T10:30:00Z",
  "tenant_id": "tenant_abc",
  "data": {
    "order_id": "order_xyz",
    "order_number": "ORD-2024-001",
    "customer_id": "cust_123",
    "items": [
      {
        "product_id": "prod_456",
        "sku": "SKU001",
        "quantity": 2,
        "price": 500.00
      }
    ],
    "total": 1000.00,
    "currency": "UAH",
    "status": "pending"
  }
}
```

## Publishing Events

### Go Implementation

```go
package eventbus

import (
    "encoding/json"
    "time"
    "github.com/google/uuid"
    amqp "github.com/rabbitmq/amqp091-go"
)

type Event struct {
    ID            string         `json:"id"`
    Type          string         `json:"type"`
    Source        string         `json:"source"`
    Timestamp     time.Time      `json:"timestamp"`
    TenantID      string         `json:"tenant_id"`
    CorrelationID string         `json:"correlation_id,omitempty"`
    Data          interface{}    `json:"data"`
    Metadata      map[string]any `json:"metadata,omitempty"`
}

type Publisher struct {
    channel *amqp.Channel
    source  string
}

func (p *Publisher) Publish(exchange, routingKey string, data interface{}, tenantID string) error {
    event := Event{
        ID:        "evt_" + uuid.New().String(),
        Type:      routingKey,
        Source:    p.source,
        Timestamp: time.Now().UTC(),
        TenantID:  tenantID,
        Data:      data,
    }

    body, err := json.Marshal(event)
    if err != nil {
        return err
    }

    return p.channel.Publish(
        exchange,
        routingKey,
        false, // mandatory
        false, // immediate
        amqp.Publishing{
            ContentType:  "application/json",
            DeliveryMode: amqp.Persistent,
            Body:         body,
        },
    )
}

// Usage
publisher.Publish("orders", "order.created", orderData, tenantID)
```

## Consuming Events

### Go Implementation

```go
type Consumer struct {
    channel *amqp.Channel
}

type Handler func(event Event) error

func (c *Consumer) Subscribe(queue string, handler Handler) error {
    msgs, err := c.channel.Consume(
        queue,
        "",    // consumer tag
        false, // auto-ack
        false, // exclusive
        false, // no-local
        false, // no-wait
        nil,
    )
    if err != nil {
        return err
    }

    go func() {
        for msg := range msgs {
            var event Event
            if err := json.Unmarshal(msg.Body, &event); err != nil {
                msg.Nack(false, false) // Don't requeue malformed messages
                continue
            }

            if err := handler(event); err != nil {
                msg.Nack(false, true) // Requeue on failure
                continue
            }

            msg.Ack(false)
        }
    }()

    return nil
}

// Usage
consumer.Subscribe("notification.order.created", func(event Event) error {
    var order OrderData
    // Process event...
    return sendOrderConfirmationEmail(order)
})
```

## Queue Configuration

### Bindings

```go
// orders exchange -> notification queue
channel.QueueBind(
    "notification.orders",  // queue
    "order.*",              // routing key (wildcard)
    "orders",               // exchange
    false,
    nil,
)

// products exchange -> search queue
channel.QueueBind(
    "search.products",
    "product.#",            // routing key (all product events)
    "products",
    false,
    nil,
)
```

### Queue Options

```go
queue, err := channel.QueueDeclare(
    "order.processing",
    true,  // durable
    false, // auto-delete
    false, // exclusive
    false, // no-wait
    amqp.Table{
        "x-dead-letter-exchange": "deadletter",
        "x-dead-letter-routing-key": "order.processing.failed",
        "x-message-ttl": 86400000, // 24 hours
    },
)
```

## Dead Letter Handling

Failed messages are routed to dead letter queues:

```go
// Dead letter exchange
channel.ExchangeDeclare(
    "deadletter",
    "direct",
    true,  // durable
    false,
    false,
    false,
    nil,
)

// Dead letter queue
channel.QueueDeclare(
    "deadletter.orders",
    true, false, false, false, nil,
)

channel.QueueBind(
    "deadletter.orders",
    "order.*.failed",
    "deadletter",
    false, nil,
)
```

### Retry Logic

```go
func (c *Consumer) SubscribeWithRetry(queue string, handler Handler, maxRetries int) {
    c.Subscribe(queue, func(event Event) error {
        retryCount := getRetryCount(event)

        err := handler(event)
        if err != nil {
            if retryCount < maxRetries {
                // Republish with incremented retry count
                return c.republishWithDelay(event, retryCount+1)
            }
            // Max retries exceeded, send to dead letter
            return c.sendToDeadLetter(event, err)
        }
        return nil
    })
}
```

## Service Subscriptions

| Service | Consumes |
|---------|----------|
| Notification | `order.*`, `customer.created`, `payment.*` |
| CRM | `order.completed`, `customer.*` |
| Search | `product.*` |
| Analytics | `*` (all events via fanout) |
| Warehouse | `order.confirmed`, `inventory.*` |
| Telegram Bot | `notification.telegram` |

## Monitoring

### RabbitMQ Management UI

Access at: `http://localhost:15672`
Default credentials: `guest/guest`

### Key Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| Queue depth | > 10,000 messages |
| Consumer count | = 0 (no consumers) |
| Message rate | Depends on baseline |
| Unacked messages | > 1,000 |

### Prometheus Metrics

```yaml
# rabbitmq_exporter config
queues:
  - order.processing
  - notification.orders
  - search.products
```

## Best Practices

1. **Idempotency**: Handle duplicate events gracefully
2. **Ordering**: Don't rely on event order across partitions
3. **Versioning**: Include version in event schema
4. **Correlation**: Use correlation_id for request tracing
5. **Error Handling**: Use dead letter queues
6. **Monitoring**: Alert on queue depth and consumer lag
7. **Backpressure**: Implement rate limiting if needed

## Configuration

```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_PREFETCH=10
RABBITMQ_RETRY_COUNT=3
RABBITMQ_RETRY_DELAY=5s
RABBITMQ_DLQ_TTL=86400000  # 24 hours
```
