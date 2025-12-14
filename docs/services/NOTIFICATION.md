# Notification Service

Централізований сервіс для відправки сповіщень через різні канали.

## Огляд

| Властивість | Значення |
|-------------|----------|
| Технологія | Go 1.24 |
| Черга | RabbitMQ |
| Канали | Email, SMS, Push, Telegram |

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SERVICE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  RabbitMQ ──▶ Event Consumer ──▶ Template Engine ──▶ Dispatcher │
│                                                                  │
│                    ┌─────────────────────────────┐              │
│                    │        Dispatcher           │              │
│                    │                             │              │
│                    │  ┌─────┐ ┌─────┐ ┌──────┐  │              │
│                    │  │Email│ │ SMS │ │ Push │  │              │
│                    │  └──┬──┘ └──┬──┘ └──┬───┘  │              │
│                    │     │      │       │       │              │
│                    └─────┼──────┼───────┼───────┘              │
│                          │      │       │                       │
│                          ▼      ▼       ▼                       │
│                       ┌─────────────────────┐                   │
│                       │  External Services  │                   │
│                       │  SMTP, Twilio, FCM  │                   │
│                       └─────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Канали сповіщень

### Email

**Провайдери:**
- SMTP (Gmail, Mailgun, SendGrid)
- Amazon SES
- Mailjet

**Конфігурація:**
```bash
# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourstore.com
SMTP_PASSWORD=your_password
SMTP_FROM=Your Store <noreply@yourstore.com>

# Amazon SES
AWS_SES_REGION=eu-central-1
AWS_SES_ACCESS_KEY=xxx
AWS_SES_SECRET_KEY=xxx
```

**Відправка:**
```go
type EmailMessage struct {
    To          []string          `json:"to"`
    Cc          []string          `json:"cc,omitempty"`
    Bcc         []string          `json:"bcc,omitempty"`
    Subject     string            `json:"subject"`
    Template    string            `json:"template"`
    Data        map[string]any    `json:"data"`
    Attachments []Attachment      `json:"attachments,omitempty"`
}

// Publish email event
eventBus.Publish("notifications", "notification.email", EmailMessage{
    To:       []string{"customer@example.com"},
    Subject:  "Ваше замовлення підтверджено",
    Template: "order_confirmation",
    Data: map[string]any{
        "order_number": "ORD-2024-001",
        "customer_name": "Іван",
        "items": orderItems,
        "total": 1500.00,
    },
})
```

### SMS

**Провайдери:**
- TurboSMS (Україна)
- SMS.ua
- Twilio (міжнародний)

**Конфігурація:**
```bash
# TurboSMS
TURBOSMS_LOGIN=your_login
TURBOSMS_PASSWORD=your_password
TURBOSMS_SENDER=YourStore

# Twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
```

**Відправка:**
```go
type SMSMessage struct {
    Phone    string `json:"phone"`
    Message  string `json:"message"`
    Template string `json:"template,omitempty"`
    Data     map[string]any `json:"data,omitempty"`
}

eventBus.Publish("notifications", "notification.sms", SMSMessage{
    Phone:   "+380991234567",
    Message: "Ваше замовлення ORD-2024-001 відправлено. ТТН: 20450000000000",
})
```

### Push Notifications

**Провайдери:**
- Firebase Cloud Messaging (FCM)
- Apple Push Notification Service (APNs)
- Web Push (VAPID)

**Конфігурація:**
```bash
# Firebase
FCM_SERVER_KEY=your_server_key
FCM_PROJECT_ID=your_project_id

# Apple
APNS_KEY_ID=xxx
APNS_TEAM_ID=xxx
APNS_KEY_PATH=/path/to/AuthKey.p8
APNS_BUNDLE_ID=com.yourstore.app
```

**Відправка:**
```go
type PushMessage struct {
    UserID   string         `json:"user_id"`
    DeviceID string         `json:"device_id,omitempty"`
    Title    string         `json:"title"`
    Body     string         `json:"body"`
    Image    string         `json:"image,omitempty"`
    Data     map[string]any `json:"data,omitempty"`
    Action   string         `json:"action,omitempty"`
}

eventBus.Publish("notifications", "notification.push", PushMessage{
    UserID: "user_123",
    Title:  "Знижка 20%!",
    Body:   "Тільки сьогодні на всі товари категорії Електроніка",
    Action: "open_category:electronics",
})
```

### Telegram

**Конфігурація:**
```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_NOTIFICATION_CHAT_IDS=12345678,87654321
```

**Відправка:**
```go
type TelegramMessage struct {
    ChatID    int64          `json:"chat_id"`
    Text      string         `json:"text"`
    ParseMode string         `json:"parse_mode,omitempty"` // HTML, Markdown
    Buttons   [][]Button     `json:"buttons,omitempty"`
}

eventBus.Publish("notifications", "notification.telegram", TelegramMessage{
    ChatID:    12345678,
    Text:      "✅ *Замовлення підтверджено*\n\nНомер: ORD-2024-001\nСума: 1500 ₴",
    ParseMode: "Markdown",
})
```

## Шаблони

### Структура шаблонів

```
templates/
├── email/
│   ├── order_confirmation.html
│   ├── order_shipped.html
│   ├── order_delivered.html
│   ├── password_reset.html
│   ├── welcome.html
│   └── promo_campaign.html
├── sms/
│   ├── order_confirmation.txt
│   ├── order_shipped.txt
│   └── otp_code.txt
└── push/
    ├── order_update.json
    └── promo.json
```

### Email шаблон (HTML)

```html
<!-- templates/email/order_confirmation.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Замовлення підтверджено</title>
</head>
<body style="font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto;">
        <h1>Дякуємо за замовлення, {{.CustomerName}}!</h1>

        <p>Ваше замовлення <strong>#{{.OrderNumber}}</strong> успішно оформлено.</p>

        <h2>Деталі замовлення:</h2>
        <table style="width: 100%; border-collapse: collapse;">
            {{range .Items}}
            <tr>
                <td>{{.Name}} x {{.Quantity}}</td>
                <td style="text-align: right;">{{.Total}} ₴</td>
            </tr>
            {{end}}
            <tr style="border-top: 2px solid #333;">
                <td><strong>Всього:</strong></td>
                <td style="text-align: right;"><strong>{{.Total}} ₴</strong></td>
            </tr>
        </table>

        <p>Доставка: {{.DeliveryMethod}}</p>
        <p>Адреса: {{.DeliveryAddress}}</p>

        <a href="{{.TrackingURL}}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none;">
            Відстежити замовлення
        </a>
    </div>
</body>
</html>
```

### SMS шаблон

```
<!-- templates/sms/order_shipped.txt -->
Замовлення {{.OrderNumber}} відправлено!
ТТН: {{.TrackingNumber}}
Очікувана доставка: {{.EstimatedDelivery}}
Відстежити: {{.TrackingURL}}
```

## Події та тригери

### Автоматичні сповіщення

| Подія | Email | SMS | Push | Telegram |
|-------|-------|-----|------|----------|
| Реєстрація | ✅ | - | - | - |
| Замовлення створено | ✅ | ✅ | ✅ | ✅ |
| Оплата отримана | ✅ | ✅ | ✅ | - |
| Замовлення відправлено | ✅ | ✅ | ✅ | ✅ |
| Замовлення доставлено | ✅ | - | ✅ | - |
| Скидання пароля | ✅ | ✅ | - | - |
| Товар знову в наявності | ✅ | - | ✅ | - |
| Зниження ціни | ✅ | - | ✅ | - |
| День народження | ✅ | ✅ | ✅ | - |
| Покинутий кошик | ✅ | - | ✅ | - |

### Обробка подій

```go
// Підписка на події замовлень
consumer.Subscribe("notification.orders", func(event Event) error {
    switch event.Type {
    case "order.created":
        return handleOrderCreated(event)
    case "order.shipped":
        return handleOrderShipped(event)
    case "order.delivered":
        return handleOrderDelivered(event)
    }
    return nil
})

func handleOrderCreated(event Event) error {
    var order OrderData
    json.Unmarshal(event.Data, &order)

    customer, _ := getCustomer(order.CustomerID)

    // Send email
    if customer.EmailOptIn {
        sendEmail(EmailMessage{
            To:       []string{customer.Email},
            Template: "order_confirmation",
            Data:     map[string]any{"order": order, "customer": customer},
        })
    }

    // Send SMS
    if customer.SMSOptIn {
        sendSMS(SMSMessage{
            Phone:    customer.Phone,
            Template: "order_confirmation",
            Data:     map[string]any{"order_number": order.OrderNumber},
        })
    }

    return nil
}
```

## Черга та повторні спроби

### Retry Policy

```go
type RetryConfig struct {
    MaxAttempts     int           `json:"max_attempts"`
    InitialDelay    time.Duration `json:"initial_delay"`
    MaxDelay        time.Duration `json:"max_delay"`
    BackoffFactor   float64       `json:"backoff_factor"`
}

var DefaultRetry = RetryConfig{
    MaxAttempts:   5,
    InitialDelay:  1 * time.Second,
    MaxDelay:      5 * time.Minute,
    BackoffFactor: 2.0,
}

// Спроби: 1s, 2s, 4s, 8s, 16s (max 5 min)
```

### Dead Letter Queue

Невдалі повідомлення після всіх спроб:
```go
// Зберігаємо для аналізу та ручної обробки
type FailedNotification struct {
    ID        string    `json:"id"`
    Channel   string    `json:"channel"`
    Recipient string    `json:"recipient"`
    Template  string    `json:"template"`
    Error     string    `json:"error"`
    Attempts  int       `json:"attempts"`
    CreatedAt time.Time `json:"created_at"`
    FailedAt  time.Time `json:"failed_at"`
}
```

## API Endpoints

### Send Notification (Internal)

```
POST /api/v1/notifications/send
Content-Type: application/json

{
  "channel": "email",
  "recipient": "customer@example.com",
  "template": "order_confirmation",
  "data": {
    "order_number": "ORD-2024-001",
    "customer_name": "Іван"
  }
}
```

### Get Notification History

```
GET /api/v1/notifications?user_id=xxx&limit=50
```

### Get Delivery Status

```
GET /api/v1/notifications/{id}/status
```

Response:
```json
{
  "id": "notif_123",
  "channel": "email",
  "status": "delivered",
  "sent_at": "2024-01-15T10:30:00Z",
  "delivered_at": "2024-01-15T10:30:05Z",
  "opened_at": "2024-01-15T11:00:00Z"
}
```

## Preference Management

### User Preferences

```go
type NotificationPreferences struct {
    UserID        string `json:"user_id"`
    EmailEnabled  bool   `json:"email_enabled"`
    SMSEnabled    bool   `json:"sms_enabled"`
    PushEnabled   bool   `json:"push_enabled"`

    // Granular settings
    OrderUpdates    bool `json:"order_updates"`
    Promotions      bool `json:"promotions"`
    PriceDrops      bool `json:"price_drops"`
    BackInStock     bool `json:"back_in_stock"`
    Newsletter      bool `json:"newsletter"`

    // Quiet hours
    QuietHoursStart string `json:"quiet_hours_start"` // "22:00"
    QuietHoursEnd   string `json:"quiet_hours_end"`   // "08:00"
}
```

### API

```
GET  /api/v1/users/{id}/notification-preferences
PUT  /api/v1/users/{id}/notification-preferences
POST /api/v1/notifications/unsubscribe?token=xxx
```

## Метрики

| Метрика | Опис |
|---------|------|
| `notifications_sent_total` | Відправлені по каналах |
| `notifications_delivered_total` | Доставлені |
| `notifications_failed_total` | Невдалі |
| `notifications_opened_total` | Відкриті (email) |
| `notifications_clicked_total` | Кліки (email) |
| `notification_latency_seconds` | Час відправки |

## Конфігурація

```bash
# Channels
EMAIL_ENABLED=true
SMS_ENABLED=true
PUSH_ENABLED=true
TELEGRAM_ENABLED=true

# Rate limits
EMAIL_RATE_LIMIT=100/minute
SMS_RATE_LIMIT=50/minute

# Templates
TEMPLATES_PATH=/app/templates
TEMPLATES_CACHE=true

# Tracking
TRACK_OPENS=true
TRACK_CLICKS=true
TRACKING_PIXEL_URL=https://api.yourstore.com/track
```
