# ADR-006: Event-driven архітектура

## Status

Accepted

## Date

2024-02-01

## Context

При мікросервісній архітектурі потрібен надійний спосіб комунікації між сервісами.

**Вимоги:**
- Loose coupling між сервісами
- Надійна доставка повідомлень
- Можливість асинхронної обробки
- Audit trail подій
- Scalability

**Альтернативи:**

1. **REST API** - синхронний, простий
2. **gRPC** - швидкий, типізований
3. **Message Queue (RabbitMQ)** - асинхронний, reliable
4. **Event Streaming (Kafka)** - log-based, replay
5. **Hybrid** - комбінація підходів

## Decision

Обрано **Hybrid підхід**:

- **REST API** для синхронних запитів (query)
- **RabbitMQ** для асинхронних команд та подій

### Обґрунтування

**REST для Queries:**
- Простота використання
- Request/Response семантика
- Широка підтримка

**RabbitMQ для Events:**
- Reliable message delivery
- Dead letter queues
- Flexible routing
- Простіший ніж Kafka для нашого масштабу

### Event Types

| Тип | Опис | Приклад |
|-----|------|---------|
| Domain Event | Факт що стався | OrderCreated |
| Integration Event | Для зовнішніх систем | PaymentCompleted |
| Command | Запит на дію | ProcessPayment |

### Event Structure

```go
type Event struct {
    ID          string                 `json:"id"`
    Type        string                 `json:"type"`
    Source      string                 `json:"source"`
    Subject     string                 `json:"subject"`
    Time        time.Time              `json:"time"`
    Data        map[string]interface{} `json:"data"`
    Metadata    map[string]string      `json:"metadata"`
}

// Приклад OrderCreated event
{
    "id": "evt_abc123",
    "type": "order.created",
    "source": "oms",
    "subject": "ord_xyz789",
    "time": "2024-01-15T10:30:00Z",
    "data": {
        "order_id": "ord_xyz789",
        "customer_id": "cus_123",
        "total": 150000,
        "items": [...]
    },
    "metadata": {
        "correlation_id": "req_abc",
        "user_id": "usr_123"
    }
}
```

### Exchanges & Queues

```
Exchanges:
├── shop.events (topic)      # Domain events
├── shop.commands (direct)   # Commands
└── shop.dlx (fanout)        # Dead Letter Exchange

Queues:
├── notification.order-events    # order.* → Notification
├── inventory.order-events       # order.created → Inventory
├── search.product-events        # product.* → Search indexer
├── crm.customer-events          # customer.* → CRM
└── *.dlq                        # Dead letter queues
```

### Event Flow Example

```
┌──────────┐                 ┌──────────────┐
│   OMS    │──order.created──│   RabbitMQ   │
└──────────┘                 └──────┬───────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
    ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
    │ Notification │       │  Inventory   │       │     CRM      │
    │   Service    │       │   Service    │       │   Service    │
    └──────────────┘       └──────────────┘       └──────────────┘
            │                       │                       │
            ▼                       ▼                       ▼
     Send Email            Reserve Stock           Update Stats
```

## Consequences

### Позитивні

- ✅ **Loose Coupling**: сервіси незалежні
- ✅ **Reliability**: гарантована доставка повідомлень
- ✅ **Scalability**: легко масштабувати consumers
- ✅ **Resilience**: сервіс може бути тимчасово недоступний
- ✅ **Audit**: історія всіх подій

### Негативні

- ❌ **Complexity**: складніша архітектура
- ❌ **Eventual Consistency**: не миттєва консистентність
- ❌ **Debugging**: складніше відстежувати flow
- ❌ **Message ordering**: не гарантується порядок
- ❌ **Duplicate handling**: потрібна idempotency

### Best Practices

```go
// Idempotent consumer
func (h *Handler) HandleOrderCreated(ctx context.Context, event Event) error {
    // Check if already processed
    processed, err := h.repo.IsEventProcessed(ctx, event.ID)
    if err != nil {
        return err
    }
    if processed {
        return nil // Skip duplicate
    }

    // Process event
    if err := h.processOrder(ctx, event); err != nil {
        return err
    }

    // Mark as processed
    return h.repo.MarkEventProcessed(ctx, event.ID)
}

// Publisher with outbox pattern
func (s *OrderService) Create(ctx context.Context, order *Order) error {
    return s.db.Transaction(func(tx *gorm.DB) error {
        // Save order
        if err := tx.Create(order).Error; err != nil {
            return err
        }

        // Save event to outbox (same transaction)
        event := &OutboxEvent{
            Type:    "order.created",
            Payload: order,
        }
        return tx.Create(event).Error
    })
    // Background worker publishes from outbox
}
```

## Related Decisions

- [ADR-001: Мікросервісна архітектура](./ADR-001-microservices.md)
