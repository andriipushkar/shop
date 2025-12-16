# Notification Service Architecture

Архітектура сервісу сповіщень.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NOTIFICATION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Event Sources                   Notification Service                       │
│  ┌──────────┐                   ┌─────────────────┐                        │
│  │ Orders   │──┐                │                 │     ┌─────────┐        │
│  └──────────┘  │                │  ┌───────────┐  │────▶│ Email   │        │
│  ┌──────────┐  │  ┌──────────┐  │  │ Template  │  │     │ (SMTP)  │        │
│  │ Payments │──┼─▶│ RabbitMQ │─▶│  │ Engine    │  │     └─────────┘        │
│  └──────────┘  │  └──────────┘  │  └───────────┘  │     ┌─────────┐        │
│  ┌──────────┐  │                │  ┌───────────┐  │────▶│ SMS     │        │
│  │ Shipping │──┤                │  │ Delivery  │  │     │ (Twilio)│        │
│  └──────────┘  │                │  │ Manager   │  │     └─────────┘        │
│  ┌──────────┐  │                │  └───────────┘  │     ┌─────────┐        │
│  │ Alerts   │──┘                │                 │────▶│ Push    │        │
│  └──────────┘                   └─────────────────┘     │ (FCM)   │        │
│                                        │                └─────────┘        │
│                                        ▼                ┌─────────┐        │
│                                 ┌─────────────┐        │ Telegram│        │
│                                 │ PostgreSQL  │        └─────────┘        │
│                                 │ (logs)      │                            │
│                                 └─────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Notification Types

### Transactional Notifications

| Event | Channels | Priority |
|-------|----------|----------|
| Order confirmation | Email, SMS | High |
| Order shipped | Email, SMS, Push | High |
| Order delivered | Email, Push | Normal |
| Payment received | Email | High |
| Payment failed | Email, SMS | High |
| Password reset | Email | Critical |
| Email verification | Email | Critical |

### Marketing Notifications

| Type | Channels | Priority |
|------|----------|----------|
| Abandoned cart | Email, Push | Normal |
| Price drop | Email, Push | Normal |
| Back in stock | Email, Push | Normal |
| Newsletter | Email | Low |
| Promotions | Email, Push, SMS | Normal |

## Domain Model

### Notification Entity

```go
// internal/domain/notification.go
package domain

type Notification struct {
    ID          string                 `json:"id"`
    Type        NotificationType       `json:"type"`
    Channel     Channel                `json:"channel"`
    Recipient   Recipient              `json:"recipient"`
    Template    string                 `json:"template"`
    Data        map[string]interface{} `json:"data"`
    Status      NotificationStatus     `json:"status"`
    Priority    Priority               `json:"priority"`
    ScheduledAt *time.Time             `json:"scheduled_at,omitempty"`
    SentAt      *time.Time             `json:"sent_at,omitempty"`
    DeliveredAt *time.Time             `json:"delivered_at,omitempty"`
    Error       string                 `json:"error,omitempty"`
    Metadata    map[string]string      `json:"metadata"`
    CreatedAt   time.Time              `json:"created_at"`
}

type Channel string

const (
    ChannelEmail    Channel = "email"
    ChannelSMS      Channel = "sms"
    ChannelPush     Channel = "push"
    ChannelTelegram Channel = "telegram"
    ChannelWebhook  Channel = "webhook"
)

type NotificationStatus string

const (
    StatusPending   NotificationStatus = "pending"
    StatusQueued    NotificationStatus = "queued"
    StatusSending   NotificationStatus = "sending"
    StatusSent      NotificationStatus = "sent"
    StatusDelivered NotificationStatus = "delivered"
    StatusFailed    NotificationStatus = "failed"
    StatusBounced   NotificationStatus = "bounced"
)

type Priority int

const (
    PriorityLow      Priority = 0
    PriorityNormal   Priority = 1
    PriorityHigh     Priority = 2
    PriorityCritical Priority = 3
)

type Recipient struct {
    UserID   string `json:"user_id,omitempty"`
    Email    string `json:"email,omitempty"`
    Phone    string `json:"phone,omitempty"`
    DeviceID string `json:"device_id,omitempty"`
    ChatID   string `json:"chat_id,omitempty"`
}
```

## Service Layer

### Notification Service

```go
// internal/service/notification_service.go
package service

type NotificationService struct {
    repo           NotificationRepository
    templateEngine TemplateEngine
    deliveryManager DeliveryManager
    queue          Queue
    logger         *zerolog.Logger
}

func (s *NotificationService) Send(ctx context.Context, req *SendRequest) (*Notification, error) {
    // Validate recipient
    if err := s.validateRecipient(req.Channel, req.Recipient); err != nil {
        return nil, err
    }

    // Check user preferences
    if !s.canSend(ctx, req.Recipient, req.Channel, req.Type) {
        return nil, ErrNotificationOptedOut
    }

    // Render template
    content, err := s.templateEngine.Render(req.Template, req.Data)
    if err != nil {
        return nil, fmt.Errorf("template render failed: %w", err)
    }

    // Create notification record
    notification := &Notification{
        ID:        uuid.New().String(),
        Type:      req.Type,
        Channel:   req.Channel,
        Recipient: req.Recipient,
        Template:  req.Template,
        Data:      req.Data,
        Status:    StatusPending,
        Priority:  req.Priority,
        Content:   content,
        CreatedAt: time.Now(),
    }

    // Save to database
    if err := s.repo.Create(ctx, notification); err != nil {
        return nil, err
    }

    // Queue for delivery
    if req.ScheduledAt != nil && req.ScheduledAt.After(time.Now()) {
        notification.ScheduledAt = req.ScheduledAt
        notification.Status = StatusQueued
        s.repo.Update(ctx, notification)
    } else {
        s.queue.Publish(ctx, notification)
    }

    return notification, nil
}

func (s *NotificationService) SendBulk(ctx context.Context, req *BulkSendRequest) (*BulkResult, error) {
    result := &BulkResult{
        TotalCount:   len(req.Recipients),
        SuccessCount: 0,
        FailedCount:  0,
        Errors:       make(map[string]string),
    }

    // Process in batches
    batchSize := 100
    for i := 0; i < len(req.Recipients); i += batchSize {
        end := min(i+batchSize, len(req.Recipients))
        batch := req.Recipients[i:end]

        for _, recipient := range batch {
            _, err := s.Send(ctx, &SendRequest{
                Channel:   req.Channel,
                Type:      req.Type,
                Template:  req.Template,
                Recipient: recipient,
                Data:      req.Data,
                Priority:  PriorityLow,
            })

            if err != nil {
                result.FailedCount++
                result.Errors[recipient.Email] = err.Error()
            } else {
                result.SuccessCount++
            }
        }
    }

    return result, nil
}
```

### Template Engine

```go
// internal/service/template_engine.go
package service

type TemplateEngine struct {
    templates map[string]*template.Template
    i18n      I18nService
}

func (e *TemplateEngine) Render(templateName string, data map[string]interface{}) (*RenderedContent, error) {
    tmpl, ok := e.templates[templateName]
    if !ok {
        return nil, fmt.Errorf("template not found: %s", templateName)
    }

    // Get language from data or default
    lang := "uk"
    if l, ok := data["language"].(string); ok {
        lang = l
    }

    // Add i18n function
    data["t"] = func(key string) string {
        return e.i18n.Translate(lang, key)
    }

    // Add formatting functions
    data["formatPrice"] = formatPrice
    data["formatDate"] = formatDate

    // Render subject
    var subjectBuf bytes.Buffer
    if err := tmpl.ExecuteTemplate(&subjectBuf, "subject", data); err != nil {
        return nil, err
    }

    // Render body
    var bodyBuf bytes.Buffer
    if err := tmpl.ExecuteTemplate(&bodyBuf, "body", data); err != nil {
        return nil, err
    }

    return &RenderedContent{
        Subject: subjectBuf.String(),
        Body:    bodyBuf.String(),
    }, nil
}
```

## Channel Providers

### Email Provider (SMTP)

```go
// internal/provider/email_provider.go
package provider

type EmailProvider struct {
    config SMTPConfig
    client *smtp.Client
}

func (p *EmailProvider) Send(ctx context.Context, notification *Notification) error {
    msg := &email.Message{
        From:    p.config.FromAddress,
        To:      []string{notification.Recipient.Email},
        Subject: notification.Content.Subject,
        HTML:    notification.Content.Body,
    }

    // Add attachments if any
    if attachments, ok := notification.Data["attachments"].([]Attachment); ok {
        for _, att := range attachments {
            msg.Attachments = append(msg.Attachments, &email.Attachment{
                Filename: att.Filename,
                Content:  att.Content,
            })
        }
    }

    return p.client.Send(msg)
}
```

### SMS Provider (Twilio)

```go
// internal/provider/sms_provider.go
package provider

type SMSProvider struct {
    client *twilio.RestClient
    from   string
}

func (p *SMSProvider) Send(ctx context.Context, notification *Notification) error {
    params := &twilioApi.CreateMessageParams{}
    params.SetFrom(p.from)
    params.SetTo(notification.Recipient.Phone)
    params.SetBody(notification.Content.Body)

    _, err := p.client.Api.CreateMessage(params)
    return err
}
```

### Push Provider (FCM)

```go
// internal/provider/push_provider.go
package provider

type PushProvider struct {
    client *messaging.Client
}

func (p *PushProvider) Send(ctx context.Context, notification *Notification) error {
    message := &messaging.Message{
        Token: notification.Recipient.DeviceID,
        Notification: &messaging.Notification{
            Title: notification.Content.Subject,
            Body:  notification.Content.Body,
        },
        Data: map[string]string{
            "type":            string(notification.Type),
            "notification_id": notification.ID,
        },
        Android: &messaging.AndroidConfig{
            Priority: "high",
        },
        APNS: &messaging.APNSConfig{
            Payload: &messaging.APNSPayload{
                Aps: &messaging.Aps{
                    Sound: "default",
                    Badge: aws.Int(1),
                },
            },
        },
    }

    _, err := p.client.Send(ctx, message)
    return err
}
```

## Event Handlers

### Order Event Handler

```go
// internal/handler/order_handler.go
package handler

func (h *OrderEventHandler) HandleOrderCreated(ctx context.Context, event *OrderCreatedEvent) error {
    // Send order confirmation email
    _, err := h.notificationService.Send(ctx, &SendRequest{
        Channel:  ChannelEmail,
        Type:     NotificationTypeOrderConfirmation,
        Template: "order_confirmation",
        Recipient: Recipient{
            UserID: event.CustomerID,
            Email:  event.CustomerEmail,
        },
        Data: map[string]interface{}{
            "order_number": event.OrderNumber,
            "order_total":  event.Total,
            "items":        event.Items,
            "shipping":     event.Shipping,
        },
        Priority: PriorityHigh,
    })

    if err != nil {
        return err
    }

    // Send SMS if phone provided and opted in
    if event.CustomerPhone != "" {
        h.notificationService.Send(ctx, &SendRequest{
            Channel:  ChannelSMS,
            Type:     NotificationTypeOrderConfirmation,
            Template: "order_confirmation_sms",
            Recipient: Recipient{
                Phone: event.CustomerPhone,
            },
            Data: map[string]interface{}{
                "order_number": event.OrderNumber,
            },
            Priority: PriorityHigh,
        })
    }

    return nil
}

func (h *OrderEventHandler) HandleOrderShipped(ctx context.Context, event *OrderShippedEvent) error {
    return h.notificationService.Send(ctx, &SendRequest{
        Channel:  ChannelEmail,
        Type:     NotificationTypeOrderShipped,
        Template: "order_shipped",
        Recipient: Recipient{
            UserID: event.CustomerID,
            Email:  event.CustomerEmail,
        },
        Data: map[string]interface{}{
            "order_number":  event.OrderNumber,
            "tracking_code": event.TrackingCode,
            "carrier":       event.Carrier,
            "tracking_url":  event.TrackingURL,
        },
        Priority: PriorityHigh,
    })
}
```

## Email Templates

### Order Confirmation Template

```html
<!-- templates/email/order_confirmation.html -->
{{define "subject"}}Замовлення #{{.order_number}} підтверджено{{end}}

{{define "body"}}
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .order-item { border-bottom: 1px solid #eee; padding: 10px 0; }
    .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
    .button { background: #4361ee; color: white; padding: 12px 24px; text-decoration: none; display: inline-block; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Дякуємо за замовлення!</h1>
    </div>
    <div class="content">
      <p>Шановний(а) {{.customer_name}},</p>
      <p>Ваше замовлення <strong>#{{.order_number}}</strong> успішно оформлено.</p>

      <h3>Деталі замовлення:</h3>
      {{range .items}}
      <div class="order-item">
        <strong>{{.name}}</strong><br>
        Кількість: {{.quantity}} × {{formatPrice .price}}
      </div>
      {{end}}

      <div class="total">
        Всього: {{formatPrice .order_total}}
      </div>

      <h3>Доставка:</h3>
      <p>
        {{.shipping.method}}<br>
        {{.shipping.address}}
      </p>

      <p style="margin-top: 30px;">
        <a href="{{.track_url}}" class="button">Відстежити замовлення</a>
      </p>
    </div>
  </div>
</body>
</html>
{{end}}
```

## Delivery Queue

### Worker

```go
// internal/worker/notification_worker.go
package worker

type NotificationWorker struct {
    queue           Queue
    deliveryManager DeliveryManager
    repo            NotificationRepository
    logger          *zerolog.Logger
}

func (w *NotificationWorker) Start(ctx context.Context) error {
    return w.queue.Consume(ctx, "notifications", func(msg *Message) error {
        var notification Notification
        if err := json.Unmarshal(msg.Body, &notification); err != nil {
            return err
        }

        return w.process(ctx, &notification)
    })
}

func (w *NotificationWorker) process(ctx context.Context, notification *Notification) error {
    // Update status to sending
    notification.Status = StatusSending
    w.repo.Update(ctx, notification)

    // Attempt delivery
    err := w.deliveryManager.Deliver(ctx, notification)

    if err != nil {
        notification.Status = StatusFailed
        notification.Error = err.Error()

        // Retry logic
        if shouldRetry(err, notification.RetryCount) {
            notification.RetryCount++
            delay := calculateBackoff(notification.RetryCount)
            w.queue.PublishDelayed(ctx, notification, delay)
        }
    } else {
        notification.Status = StatusSent
        notification.SentAt = aws.Time(time.Now())
    }

    return w.repo.Update(ctx, notification)
}

func calculateBackoff(retryCount int) time.Duration {
    // Exponential backoff: 1m, 5m, 15m, 1h, 4h
    delays := []time.Duration{
        1 * time.Minute,
        5 * time.Minute,
        15 * time.Minute,
        1 * time.Hour,
        4 * time.Hour,
    }

    if retryCount >= len(delays) {
        return delays[len(delays)-1]
    }
    return delays[retryCount]
}
```

## See Also

- [CRM Architecture](./CRM_ARCHITECTURE.md)
- [Email Templates Guide](../guides/EMAIL_TEMPLATES.md)
- [Event-Driven Architecture](./EVENT_DRIVEN.md)
