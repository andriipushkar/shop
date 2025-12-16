# Email System

Система email комунікацій для транзакційних листів та маркетингових кампаній.

## Overview

Модуль email забезпечує:
- Транзакційні листи (замовлення, підтвердження)
- Маркетингові кампанії
- Шаблони листів
- Підтримка провайдерів (SendPulse, eSputnik, Mailchimp)
- Tracking (відкриття, кліки)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      EMAIL SYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Events     │                                               │
│  │              │                                               │
│  │  - Order     │                                               │
│  │  - User      │                                               │
│  │  - Stock     │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │   Email      │────▶│   Template   │                         │
│  │   Service    │     │   Engine     │                         │
│  └──────┬───────┘     └──────────────┘                         │
│         │                                                       │
│         │  Provider Selection                                   │
│         │                                                       │
│  ┌──────┴────────────────────────────────────┐                 │
│  │                                            │                 │
│  ▼                    ▼                       ▼                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ SendPulse  │  │  eSputnik  │  │ Mailchimp  │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Email Types

### Transactional

| Type | Trigger | Description |
|------|---------|-------------|
| `order_confirmation` | Order created | Підтвердження замовлення |
| `order_shipped` | Order shipped | Замовлення відправлено |
| `order_delivered` | Order delivered | Замовлення доставлено |
| `password_reset` | Reset requested | Скидання пароля |
| `email_verification` | Registration | Підтвердження email |
| `welcome` | User registered | Вітальний лист |
| `invoice` | Payment received | Рахунок-фактура |
| `stock_alert` | Back in stock | Товар знову в наявності |

### Marketing

| Type | Description |
|------|-------------|
| `newsletter` | Регулярна розсилка |
| `promotion` | Акції та знижки |
| `abandoned_cart` | Покинутий кошик |
| `reactivation` | Повернення клієнта |
| `review_request` | Запит відгуку |

## Configuration

```bash
# Email Provider
EMAIL_PROVIDER=sendpulse

# SendPulse
SENDPULSE_API_USER_ID=your_user_id
SENDPULSE_API_SECRET=your_secret
SENDPULSE_FROM_EMAIL=shop@example.com
SENDPULSE_FROM_NAME=My Shop

# eSputnik
ESPUTNIK_API_KEY=your_api_key
ESPUTNIK_FROM_EMAIL=shop@example.com

# Mailchimp
MAILCHIMP_API_KEY=your_api_key
MAILCHIMP_FROM_EMAIL=shop@example.com

# SMTP (fallback)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASSWORD=password
```

## Usage

### Initialize Service

```go
import "shop/services/core/internal/email"

func main() {
    service := email.NewService()

    // Register providers
    service.RegisterProvider(email.NewSendPulse(config))
    service.RegisterProvider(email.NewESputnik(config))
    service.RegisterProvider(email.NewMailchimp(config))

    service.SetDefaultProvider("sendpulse")
}
```

### Send Transactional Email

```go
err := service.Send(ctx, &email.Message{
    To:       []string{"customer@example.com"},
    Template: "order_confirmation",
    Data: map[string]interface{}{
        "order_id":    "12345",
        "customer":    "Іван Петренко",
        "items":       orderItems,
        "total":       "2500.00 грн",
        "delivery":    "Нова Пошта, відділення №25",
    },
})
```

### Send with Attachments

```go
err := service.Send(ctx, &email.Message{
    To:       []string{"customer@example.com"},
    Template: "invoice",
    Data: map[string]interface{}{
        "invoice_number": "INV-2024-001",
    },
    Attachments: []email.Attachment{
        {
            Filename: "invoice.pdf",
            Content:  pdfBytes,
            MimeType: "application/pdf",
        },
    },
})
```

### Send Bulk Campaign

```go
campaign, err := service.CreateCampaign(ctx, &email.Campaign{
    Name:      "Новорічний розпродаж",
    Subject:   "Знижки до 50% на всі товари!",
    Template:  "promotion",
    ListID:    "subscribers",
    Data: map[string]interface{}{
        "promo_code": "NY2024",
        "discount":   "50%",
    },
    ScheduledAt: time.Date(2024, 12, 20, 10, 0, 0, 0, time.UTC),
})
```

## Email Templates

### Template Structure

```
templates/
├── order_confirmation/
│   ├── subject.txt
│   ├── body.html
│   └── body.txt
├── order_shipped/
│   ├── subject.txt
│   ├── body.html
│   └── body.txt
└── ...
```

### HTML Template Example

```html
<!-- templates/order_confirmation/body.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: #0d9488; color: white; padding: 20px; }
        .content { padding: 20px; }
        .order-item { border-bottom: 1px solid #eee; padding: 10px 0; }
        .total { font-size: 18px; font-weight: bold; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Дякуємо за замовлення!</h1>
        </div>
        <div class="content">
            <p>Шановний(а) {{.customer}},</p>
            <p>Ваше замовлення #{{.order_id}} прийнято та обробляється.</p>

            <h3>Товари:</h3>
            {{range .items}}
            <div class="order-item">
                <strong>{{.name}}</strong><br>
                {{.quantity}} x {{.price}} грн
            </div>
            {{end}}

            <p class="total">Всього: {{.total}}</p>

            <h3>Доставка:</h3>
            <p>{{.delivery}}</p>
        </div>
        <div class="footer">
            <p>З повагою, команда My Shop</p>
            <p><a href="{{.unsubscribe_url}}">Відписатись</a></p>
        </div>
    </div>
</body>
</html>
```

### Text Template Example

```text
Дякуємо за замовлення!

Шановний(а) {{.customer}},

Ваше замовлення #{{.order_id}} прийнято та обробляється.

Товари:
{{range .items}}
- {{.name}}: {{.quantity}} x {{.price}} грн
{{end}}

Всього: {{.total}}

Доставка: {{.delivery}}

З повагою,
Команда My Shop
```

## Provider Implementations

### SendPulse

```go
// services/core/internal/email/sendpulse.go
type SendPulse struct {
    userID string
    secret string
    client *http.Client
}

func (s *SendPulse) Name() string { return "sendpulse" }

func (s *SendPulse) Send(ctx context.Context, msg *email.Message) error {
    // OAuth2 authentication
    token, _ := s.getAccessToken()

    // POST https://api.sendpulse.com/smtp/emails
}
```

### eSputnik

```go
// services/core/internal/email/esputnik.go
type ESputnik struct {
    apiKey string
}

func (e *ESputnik) Name() string { return "esputnik" }

func (e *ESputnik) Send(ctx context.Context, msg *email.Message) error {
    // POST https://esputnik.com/api/v1/message/email
}
```

## Tracking

### Open Tracking

```html
<!-- Pixel tracking -->
<img src="https://shop.ua/api/v1/email/track/open/{{.tracking_id}}" width="1" height="1">
```

### Click Tracking

```html
<!-- Wrapped links -->
<a href="https://shop.ua/api/v1/email/track/click/{{.tracking_id}}?url={{.original_url}}">
    Click here
</a>
```

### Tracking Data

```go
type EmailStats struct {
    MessageID   string    `json:"message_id"`
    Sent        bool      `json:"sent"`
    Delivered   bool      `json:"delivered"`
    Opened      bool      `json:"opened"`
    Clicked     bool      `json:"clicked"`
    Bounced     bool      `json:"bounced"`
    Unsubscribed bool     `json:"unsubscribed"`
    OpenedAt    *time.Time `json:"opened_at"`
    ClickedAt   *time.Time `json:"clicked_at"`
    ClickedLinks []string  `json:"clicked_links"`
}
```

## API Endpoints

```
POST /api/v1/email/send              # Send transactional email
POST /api/v1/email/campaigns         # Create campaign
GET  /api/v1/email/campaigns         # List campaigns
GET  /api/v1/email/campaigns/:id     # Get campaign
POST /api/v1/email/campaigns/:id/send # Send campaign
GET  /api/v1/email/stats/:id         # Email statistics
GET  /api/v1/email/templates         # List templates
POST /api/v1/email/templates         # Create template
PUT  /api/v1/email/templates/:id     # Update template
```

## Webhooks

```
POST /api/v1/webhooks/email/delivery
{
  "message_id": "abc123",
  "event": "delivered",
  "email": "customer@example.com",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Best Practices

1. **SPF/DKIM/DMARC** - Configure for deliverability
2. **Unsubscribe** - Always include unsubscribe link
3. **Mobile-first** - Design for mobile devices
4. **Plain text** - Always include text version
5. **Testing** - Test across email clients
6. **Personalization** - Use customer data wisely
7. **Timing** - Send at optimal times

## See Also

- [SMS Notifications](./SMS.md)
- [Notification Service](../services/NOTIFICATION.md)
- [Email Templates Guide](../guides/EMAIL_TEMPLATES.md)
