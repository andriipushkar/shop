# SMS Notifications

Система SMS сповіщень для замовлень, доставки та верифікації.

## Overview

Модуль SMS забезпечує:
- Відправка одиночних та масових SMS
- Підтримка українських провайдерів (TurboSMS, SMS.ua, AlphaSMS)
- Статуси доставки
- Шаблони повідомлень для замовлень
- Перевірка балансу

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SMS SERVICE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │  SMS Service │                                               │
│  │              │                                               │
│  │  - Send      │                                               │
│  │  - SendBulk  │                                               │
│  │  - Status    │                                               │
│  │  - Balance   │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         │  Provider Selection                                   │
│         │                                                       │
│  ┌──────┴────────────────────────────────────┐                 │
│  │                                            │                 │
│  ▼                    ▼                       ▼                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  TurboSMS  │  │   SMS.ua   │  │  AlphaSMS  │               │
│  │            │  │            │  │            │               │
│  │  API v2    │  │  REST API  │  │  REST API  │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Message Structure

```go
type Message struct {
    ID          string            // Message ID from provider
    Phone       string            // Recipient phone (+380...)
    Text        string            // Message text
    Sender      string            // Sender name (alphanumeric)
    Status      MessageStatus     // Delivery status
    ErrorCode   string            // Error code if failed
    ErrorText   string            // Error description
    SentAt      *time.Time        // When sent
    DeliveredAt *time.Time        // When delivered
    Metadata    map[string]string // Custom data
}
```

## Message Status

| Status | Description |
|--------|-------------|
| `queued` | Message queued for sending |
| `sent` | Message sent to carrier |
| `delivered` | Message delivered to phone |
| `failed` | Delivery failed |
| `expired` | Message expired |
| `rejected` | Message rejected by carrier |

## Configuration

```bash
# SMS Provider
SMS_PROVIDER=turbosms
SMS_DEFAULT_SENDER=MyShop

# TurboSMS
TURBOSMS_API_KEY=your_api_key
TURBOSMS_SENDER=MyShop

# SMS.ua
SMSUA_API_KEY=your_api_key
SMSUA_SENDER=MyShop

# AlphaSMS
ALPHASMS_API_KEY=your_api_key
ALPHASMS_SENDER=MyShop
```

## Usage

### Initialize Service

```go
import "shop/services/core/internal/sms"

func main() {
    service := sms.NewSMSService()

    // Register providers
    service.RegisterProvider(sms.NewTurboSMS(apiKey, sender))
    service.RegisterProvider(sms.NewSMSUA(apiKey, sender))
    service.RegisterProvider(sms.NewAlphaSMS(apiKey, sender))

    // Set defaults
    service.SetDefaultProvider("turbosms")
    service.SetDefaultSender("MyShop")
}
```

### Send Single SMS

```go
result, err := service.Send(ctx, "", &sms.Message{
    Phone: "+380991234567",
    Text:  "Ваше замовлення #12345 підтверджено!",
})

if err != nil {
    log.Error("SMS send failed", "error", err)
}

fmt.Printf("Message ID: %s, Status: %s\n", result.MessageID, result.Status)
```

### Send Bulk SMS

```go
results, err := service.SendBulk(ctx, "", &sms.BulkMessage{
    Phones: []string{"+380991234567", "+380997654321"},
    Text:   "Знижка 20% на всі товари! Використайте код SALE20",
})

for _, result := range results {
    fmt.Printf("%s: %s\n", result.Phone, result.Status)
}
```

### Check Message Status

```go
report, err := service.GetStatus(ctx, "turbosms", messageID)
if err != nil {
    log.Error("Status check failed", "error", err)
}

fmt.Printf("Status: %s, Delivered: %v\n", report.Status, report.DeliveredAt)
```

### Check Balance

```go
balance, err := service.GetBalance(ctx, "turbosms")
if err != nil {
    log.Error("Balance check failed", "error", err)
}

fmt.Printf("Balance: %.2f %s\n", balance.Amount, balance.Currency)
```

## Notification Templates

### Order Notifications

```go
// Order confirmed
service.SendOrderNotification(ctx, phone, "12345", "confirmed")
// "Замовлення #12345 підтверджено. Очікуйте відправку."

// Order shipped
service.SendOrderNotification(ctx, phone, "12345", "shipped")
// "Замовлення #12345 відправлено! Очікуйте доставку."

// Order delivered
service.SendOrderNotification(ctx, phone, "12345", "delivered")
// "Замовлення #12345 доставлено. Дякуємо за покупку!"
```

### Delivery Notifications

```go
// Package arrived
service.SendDeliveryNotification(ctx, phone, "20450123456789")
// "Ваше відправлення прибуло! ТТН: 20450123456789. Заберіть на пошті."
```

### Verification Code

```go
service.SendVerificationCode(ctx, phone, "123456")
// "Ваш код підтвердження: 123456. Не повідомляйте нікому."
```

## Provider Implementations

### TurboSMS
```go
// services/core/internal/sms/turbosms.go
type TurboSMS struct {
    apiKey string
    sender string
    client *http.Client
}

func (t *TurboSMS) Name() string { return "turbosms" }

func (t *TurboSMS) Send(ctx context.Context, msg *sms.Message) (*sms.SendResult, error) {
    // POST https://api.turbosms.ua/message/send.json
}
```

### SMS.ua
```go
// services/core/internal/sms/smsua.go
type SMSUA struct {
    apiKey string
    sender string
}

func (s *SMSUA) Name() string { return "smsua" }
```

### AlphaSMS
```go
// services/core/internal/sms/alphasms.go
type AlphaSMS struct {
    apiKey string
    sender string
}

func (a *AlphaSMS) Name() string { return "alphasms" }
```

## API Endpoints

```
POST /api/v1/sms/send           # Send single SMS
POST /api/v1/sms/bulk           # Send bulk SMS
GET  /api/v1/sms/:id/status     # Get message status
GET  /api/v1/sms/balance        # Get account balance
GET  /api/v1/sms/history        # Message history
```

### Send SMS Request

```json
POST /api/v1/sms/send
{
  "phone": "+380991234567",
  "text": "Your message here",
  "sender": "MyShop"
}
```

### Response

```json
{
  "message_id": "abc123",
  "status": "queued",
  "phone": "+380991234567",
  "cost": 0.45
}
```

## Webhook for Delivery Reports

```
POST /api/v1/webhooks/sms/delivery
{
  "message_id": "abc123",
  "phone": "+380991234567",
  "status": "delivered",
  "delivered_at": "2024-01-15T10:30:00Z"
}
```

## Error Handling

| Error | Description | Action |
|-------|-------------|--------|
| `ErrInvalidPhone` | Invalid phone format | Validate format |
| `ErrInvalidMessage` | Empty or too long | Check length |
| `ErrSendFailed` | Send operation failed | Retry |
| `ErrInsufficientBalance` | Low balance | Top up |
| `ErrProviderError` | Provider API error | Check provider status |

## Best Practices

1. **Phone validation** - Always validate Ukrainian format (+380...)
2. **Message length** - Keep under 160 chars for single SMS
3. **Rate limiting** - Don't spam users
4. **Opt-out** - Provide unsubscribe option
5. **Balance monitoring** - Alert on low balance
6. **Retry logic** - Retry failed messages with exponential backoff
7. **Logging** - Log all SMS for audit

## Monitoring

### Metrics

| Metric | Description |
|--------|-------------|
| `sms_sent_total` | Total SMS sent |
| `sms_delivered_total` | Delivered count |
| `sms_failed_total` | Failed count |
| `sms_cost_total` | Total cost |
| `sms_balance` | Current balance |

### Alerts

```yaml
- alert: LowSMSBalance
  expr: sms_balance < 100
  labels:
    severity: warning
  annotations:
    summary: "SMS balance below 100 UAH"

- alert: HighSMSFailureRate
  expr: rate(sms_failed_total[1h]) / rate(sms_sent_total[1h]) > 0.1
  labels:
    severity: critical
  annotations:
    summary: "SMS failure rate above 10%"
```

## See Also

- [Email Notifications](./EMAIL.md)
- [Notification Service](../services/NOTIFICATION.md)
- [Orders](./ORDERS.md)
