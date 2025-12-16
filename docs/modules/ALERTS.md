# Alerts System

Система сповіщень для моніторингу інвентарю, цін та критичних подій.

## Overview

Модуль alerts забезпечує:
- Сповіщення про низький запас
- Сповіщення про відсутність товару
- Сповіщення про поповнення запасу
- Сповіщення про значні зміни цін
- Публікація алертів через різні канали

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ALERT SYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Inventory   │  │    Price     │  │    Order             │  │
│  │  Monitor     │  │   Monitor    │  │   Monitor            │  │
│  │              │  │              │  │                      │  │
│  │  - Stock     │  │  - Changes   │  │  - Failed orders     │  │
│  │  - Low stock │  │  - Drops     │  │  - Returns           │  │
│  │  - Restock   │  │  - Increases │  │  - Fraud             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘              │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │ Alert Publisher │                           │
│                  └────────┬────────┘                           │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         │                 │                 │                  │
│         ▼                 ▼                 ▼                  │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐             │
│  │   Email    │   │   Slack    │   │  RabbitMQ  │             │
│  └────────────┘   └────────────┘   └────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Alert Types

| Type | Trigger | Priority |
|------|---------|----------|
| `low_stock` | Stock <= threshold | Warning |
| `out_of_stock` | Stock = 0 | Critical |
| `restocked` | Stock > 0 (was 0) | Info |
| `price_change` | Price change > 20% | Warning |

## Alert Structure

```go
type InventoryAlert struct {
    ID        string      `json:"id"`
    Type      AlertType   `json:"type"`
    ProductID string      `json:"product_id"`
    Product   string      `json:"product_name"`
    OldValue  interface{} `json:"old_value,omitempty"`
    NewValue  interface{} `json:"new_value,omitempty"`
    Threshold int         `json:"threshold,omitempty"`
    Message   string      `json:"message"`
    CreatedAt time.Time   `json:"created_at"`
}
```

## Configuration

```go
type Config struct {
    LowStockThreshold int  // Default: 10
    Enabled           bool // Default: true
}
```

### Environment Variables

```bash
# Alert settings
ALERTS_ENABLED=true
ALERTS_LOW_STOCK_THRESHOLD=10
ALERTS_PRICE_CHANGE_THRESHOLD=20  # Percentage

# Notification channels
ALERTS_EMAIL_ENABLED=true
ALERTS_EMAIL_RECIPIENTS=admin@shop.ua,manager@shop.ua
ALERTS_SLACK_ENABLED=true
ALERTS_SLACK_WEBHOOK=https://hooks.slack.com/services/xxx
```

## Usage

### Initialize Monitor

```go
import "shop/services/core/internal/alerts"

func main() {
    cfg := alerts.Config{
        LowStockThreshold: 10,
        Enabled:           true,
    }

    publisher := NewSlackPublisher(webhookURL)
    monitor := alerts.NewInventoryMonitor(cfg, publisher)
}
```

### Check Stock Levels

```go
// Called when stock changes
err := monitor.CheckStock(ctx,
    productID,    // "prod-123"
    productName,  // "iPhone 15 Pro"
    oldStock,     // 15
    newStock,     // 5
)
// Generates low_stock alert if newStock <= threshold
```

### Check Price Changes

```go
// Called when price changes
err := monitor.CheckPriceChange(ctx,
    productID,    // "prod-123"
    productName,  // "iPhone 15 Pro"
    oldPrice,     // 45000.00
    newPrice,     // 35000.00  (>20% change)
)
// Generates price_change alert if change > 20%
```

## Alert Examples

### Out of Stock
```json
{
  "id": "20240115103000-1234",
  "type": "out_of_stock",
  "product_id": "prod-123",
  "product_name": "iPhone 15 Pro",
  "old_value": 5,
  "new_value": 0,
  "message": "iPhone 15 Pro is now out of stock",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Low Stock
```json
{
  "id": "20240115103100-5678",
  "type": "low_stock",
  "product_id": "prod-456",
  "product_name": "Samsung Galaxy S24",
  "new_value": 8,
  "threshold": 10,
  "message": "Samsung Galaxy S24 is running low on stock (8 units remaining)",
  "created_at": "2024-01-15T10:31:00Z"
}
```

### Restocked
```json
{
  "id": "20240115103200-9012",
  "type": "restocked",
  "product_id": "prod-789",
  "product_name": "MacBook Pro 14",
  "old_value": 0,
  "new_value": 50,
  "message": "MacBook Pro 14 has been restocked (50 units)",
  "created_at": "2024-01-15T10:32:00Z"
}
```

### Price Change
```json
{
  "id": "20240115103300-3456",
  "type": "price_change",
  "product_id": "prod-123",
  "product_name": "iPhone 15 Pro",
  "old_value": 45000.00,
  "new_value": 35000.00,
  "message": "iPhone 15 Pro price changed significantly",
  "created_at": "2024-01-15T10:33:00Z"
}
```

## Publishers

### Log Publisher (Development)
```go
publisher := alerts.NewLogPublisher()
// Stores alerts in memory for testing
alerts := publisher.GetAlerts()
publisher.Clear()
```

### Email Publisher
```go
type EmailPublisher struct {
    smtp      *smtp.Client
    from      string
    recipients []string
}

func (p *EmailPublisher) Publish(ctx context.Context, alert *alerts.InventoryAlert) error {
    subject := fmt.Sprintf("[%s] %s", alert.Type, alert.Product)
    body := alert.Message
    return p.smtp.Send(p.from, p.recipients, subject, body)
}
```

### Slack Publisher
```go
type SlackPublisher struct {
    webhookURL string
}

func (p *SlackPublisher) Publish(ctx context.Context, alert *alerts.InventoryAlert) error {
    color := map[alerts.AlertType]string{
        alerts.AlertTypeOutOfStock:  "#FF0000",
        alerts.AlertTypeLowStock:    "#FFA500",
        alerts.AlertTypeRestocked:   "#00FF00",
        alerts.AlertTypePriceChange: "#0000FF",
    }

    payload := map[string]interface{}{
        "attachments": []map[string]interface{}{
            {
                "color": color[alert.Type],
                "title": string(alert.Type),
                "text":  alert.Message,
                "fields": []map[string]string{
                    {"title": "Product", "value": alert.Product, "short": true},
                    {"title": "Time", "value": alert.CreatedAt.Format(time.RFC3339), "short": true},
                },
            },
        },
    }

    return postJSON(p.webhookURL, payload)
}
```

### RabbitMQ Publisher
```go
type RabbitMQPublisher struct {
    channel *amqp.Channel
    exchange string
}

func (p *RabbitMQPublisher) Publish(ctx context.Context, alert *alerts.InventoryAlert) error {
    body, _ := json.Marshal(alert)
    return p.channel.Publish(
        p.exchange,
        "alerts." + string(alert.Type),
        false,
        false,
        amqp.Publishing{
            ContentType: "application/json",
            Body:        body,
        },
    )
}
```

## API Endpoints

```
GET  /api/v1/alerts              # List all alerts
GET  /api/v1/alerts/:id          # Get alert by ID
GET  /api/v1/alerts/product/:id  # Alerts for product
POST /api/v1/alerts/:id/ack      # Acknowledge alert
GET  /api/v1/alerts/settings     # Get alert settings
PUT  /api/v1/alerts/settings     # Update settings
```

## Events

| Event | Description |
|-------|-------------|
| `alert.created` | New alert generated |
| `alert.acknowledged` | Alert marked as read |
| `alert.resolved` | Issue resolved (auto or manual) |

## Admin UI

Alerts dashboard at `/admin/alerts`:
- List of active alerts
- Filter by type, product, date
- Acknowledge alerts
- Configure thresholds
- Notification preferences

## Best Practices

1. **Threshold tuning** - Set thresholds based on lead times
2. **Deduplication** - Don't spam repeated alerts
3. **Escalation** - Increase severity for prolonged issues
4. **Acknowledgement** - Track who addressed alerts
5. **Auto-resolve** - Clear alerts when issue fixed
6. **Rate limiting** - Limit notification frequency

## See Also

- [Inventory](./INVENTORY.md)
- [Email Notifications](./EMAIL.md)
- [Monitoring Setup](../operations/MONITORING_SETUP.md)
- [Alerting Rules](../operations/ALERTING_RULES.md)
