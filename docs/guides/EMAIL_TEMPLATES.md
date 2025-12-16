# Email Templates Guide

Документація по email шаблонах Shop Platform.

## Огляд

Shop Platform використовує систему email шаблонів на базі:
- **React Email** для створення шаблонів
- **Resend** або **SendGrid** для відправки
- **MJML** як альтернатива для legacy шаблонів
- **Handlebars** для динамічних даних

## Структура проекту

```
services/core/
├── internal/
│   └── email/
│       ├── service.go
│       ├── templates/
│       │   ├── order_confirmation.html
│       │   ├── shipping_notification.html
│       │   ├── password_reset.html
│       │   └── ...
│       └── sender/
│           ├── resend.go
│           └── sendgrid.go
└── emails/                    # React Email (optional)
    ├── package.json
    └── src/
        ├── templates/
        │   ├── OrderConfirmation.tsx
        │   └── ...
        └── components/
            ├── Layout.tsx
            └── ...
```

## Email Service (Go)

```go
// internal/email/service.go
package email

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"path/filepath"

	"github.com/aymerick/raymond"
)

type EmailService struct {
	sender    EmailSender
	templates map[string]*raymond.Template
	baseURL   string
	fromEmail string
	fromName  string
}

type EmailSender interface {
	Send(ctx context.Context, email *Email) error
}

type Email struct {
	To          string
	ToName      string
	Subject     string
	HTMLBody    string
	TextBody    string
	ReplyTo     string
	Attachments []Attachment
}

type Attachment struct {
	Filename    string
	Content     []byte
	ContentType string
}

func NewEmailService(sender EmailSender, templatesDir, baseURL, fromEmail, fromName string) (*EmailService, error) {
	service := &EmailService{
		sender:    sender,
		templates: make(map[string]*raymond.Template),
		baseURL:   baseURL,
		fromEmail: fromEmail,
		fromName:  fromName,
	}

	// Load all templates
	templateFiles := []string{
		"order_confirmation",
		"shipping_notification",
		"delivery_confirmation",
		"password_reset",
		"welcome",
		"invoice",
		"abandoned_cart",
		"review_request",
		"newsletter",
	}

	for _, name := range templateFiles {
		path := filepath.Join(templatesDir, name+".html")
		tpl, err := raymond.ParseFile(path)
		if err != nil {
			return nil, fmt.Errorf("failed to parse template %s: %w", name, err)
		}
		service.templates[name] = tpl
	}

	return service, nil
}

func (s *EmailService) Send(ctx context.Context, templateName string, to, toName, subject string, data map[string]interface{}) error {
	tpl, ok := s.templates[templateName]
	if !ok {
		return fmt.Errorf("template not found: %s", templateName)
	}

	// Add common data
	data["baseURL"] = s.baseURL
	data["year"] = time.Now().Year()
	data["companyName"] = s.fromName

	html, err := tpl.Exec(data)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	email := &Email{
		To:       to,
		ToName:   toName,
		Subject:  subject,
		HTMLBody: html,
	}

	return s.sender.Send(ctx, email)
}

// Typed methods for each email type
func (s *EmailService) SendOrderConfirmation(ctx context.Context, order *Order, customer *Customer) error {
	data := map[string]interface{}{
		"order":        order,
		"customer":     customer,
		"orderURL":     fmt.Sprintf("%s/orders/%s", s.baseURL, order.ID),
		"trackingURL":  fmt.Sprintf("%s/orders/%s/track", s.baseURL, order.ID),
	}

	subject := fmt.Sprintf("Order Confirmed #%s", order.Number)
	return s.Send(ctx, "order_confirmation", customer.Email, customer.Name, subject, data)
}

func (s *EmailService) SendShippingNotification(ctx context.Context, order *Order, shipment *Shipment, customer *Customer) error {
	data := map[string]interface{}{
		"order":       order,
		"shipment":    shipment,
		"customer":    customer,
		"trackingURL": shipment.TrackingURL,
	}

	subject := fmt.Sprintf("Your order #%s has been shipped!", order.Number)
	return s.Send(ctx, "shipping_notification", customer.Email, customer.Name, subject, data)
}

func (s *EmailService) SendPasswordReset(ctx context.Context, user *User, resetToken string) error {
	data := map[string]interface{}{
		"user":     user,
		"resetURL": fmt.Sprintf("%s/reset-password?token=%s", s.baseURL, resetToken),
		"expiry":   "1 hour",
	}

	return s.Send(ctx, "password_reset", user.Email, user.Name, "Reset Your Password", data)
}

func (s *EmailService) SendWelcome(ctx context.Context, user *User) error {
	data := map[string]interface{}{
		"user":      user,
		"loginURL":  fmt.Sprintf("%s/login", s.baseURL),
		"shopURL":   s.baseURL,
	}

	return s.Send(ctx, "welcome", user.Email, user.Name, "Welcome to Our Store!", data)
}

func (s *EmailService) SendAbandonedCartReminder(ctx context.Context, cart *Cart, customer *Customer) error {
	data := map[string]interface{}{
		"cart":       cart,
		"customer":   customer,
		"cartURL":    fmt.Sprintf("%s/cart", s.baseURL),
		"itemCount":  len(cart.Items),
	}

	return s.Send(ctx, "abandoned_cart", customer.Email, customer.Name, "You left something behind!", data)
}

func (s *EmailService) SendReviewRequest(ctx context.Context, order *Order, customer *Customer) error {
	data := map[string]interface{}{
		"order":     order,
		"customer":  customer,
		"reviewURL": fmt.Sprintf("%s/orders/%s/review", s.baseURL, order.ID),
	}

	subject := fmt.Sprintf("How was your order #%s?", order.Number)
	return s.Send(ctx, "review_request", customer.Email, customer.Name, subject, data)
}
```

## Email Senders

### Resend

```go
// internal/email/sender/resend.go
package sender

import (
	"context"
	"fmt"

	"github.com/resendlabs/resend-go"
)

type ResendSender struct {
	client    *resend.Client
	fromEmail string
	fromName  string
}

func NewResendSender(apiKey, fromEmail, fromName string) *ResendSender {
	return &ResendSender{
		client:    resend.NewClient(apiKey),
		fromEmail: fromEmail,
		fromName:  fromName,
	}
}

func (s *ResendSender) Send(ctx context.Context, email *Email) error {
	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail),
		To:      []string{email.To},
		Subject: email.Subject,
		Html:    email.HTMLBody,
	}

	if email.ReplyTo != "" {
		params.ReplyTo = email.ReplyTo
	}

	_, err := s.client.Emails.Send(params)
	return err
}
```

### SendGrid

```go
// internal/email/sender/sendgrid.go
package sender

import (
	"context"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

type SendGridSender struct {
	client    *sendgrid.Client
	fromEmail string
	fromName  string
}

func NewSendGridSender(apiKey, fromEmail, fromName string) *SendGridSender {
	return &SendGridSender{
		client:    sendgrid.NewSendClient(apiKey),
		fromEmail: fromEmail,
		fromName:  fromName,
	}
}

func (s *SendGridSender) Send(ctx context.Context, email *Email) error {
	from := mail.NewEmail(s.fromName, s.fromEmail)
	to := mail.NewEmail(email.ToName, email.To)

	message := mail.NewSingleEmail(from, email.Subject, to, email.TextBody, email.HTMLBody)

	if email.ReplyTo != "" {
		message.SetReplyTo(mail.NewEmail("", email.ReplyTo))
	}

	for _, att := range email.Attachments {
		message.AddAttachment(&mail.Attachment{
			Content:     base64.StdEncoding.EncodeToString(att.Content),
			Filename:    att.Filename,
			Type:        att.ContentType,
			Disposition: "attachment",
		})
	}

	_, err := s.client.Send(message)
	return err
}
```

## HTML Templates (Handlebars)

### Base Layout

```html
<!-- templates/layouts/base.html -->
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }

    /* Base styles */
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      background-color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f4f4f5;
      padding: 40px 0;
    }

    .main {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .header {
      background-color: {{primaryColor}};
      padding: 24px;
      text-align: center;
    }

    .header img {
      max-height: 40px;
    }

    .content {
      padding: 32px 24px;
    }

    .footer {
      background-color: #f9fafb;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }

    h1 {
      margin: 0 0 16px;
      font-size: 24px;
      font-weight: 600;
      color: #111827;
    }

    p {
      margin: 0 0 16px;
      font-size: 16px;
      line-height: 1.5;
      color: #374151;
    }

    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: {{primaryColor}};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 16px;
    }

    .button:hover {
      background-color: {{primaryColorDark}};
    }

    .divider {
      border: 0;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" width="100%" cellpadding="0" cellspacing="0">
      <!-- Header -->
      <tr>
        <td class="header">
          <a href="{{baseURL}}">
            <img src="{{baseURL}}/logo.png" alt="{{companyName}}">
          </a>
        </td>
      </tr>

      <!-- Content -->
      <tr>
        <td class="content">
          {{{body}}}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td class="footer">
          <p style="margin-bottom: 8px;">
            © {{year}} {{companyName}}. Всі права захищені.
          </p>
          <p style="margin-bottom: 8px;">
            <a href="{{baseURL}}/privacy" style="color: #6b7280;">Політика конфіденційності</a> |
            <a href="{{baseURL}}/terms" style="color: #6b7280;">Умови використання</a>
          </p>
          <p style="margin: 0;">
            {{companyAddress}}
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
```

### Order Confirmation

```html
<!-- templates/order_confirmation.html -->
<h1>Дякуємо за замовлення! 🎉</h1>

<p>Привіт, {{customer.firstName}}!</p>

<p>Ваше замовлення <strong>#{{order.number}}</strong> успішно оформлено та буде оброблено найближчим часом.</p>

<!-- Order Summary -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
      <h2 style="margin: 0 0 16px; font-size: 18px;">Деталі замовлення</h2>

      {{#each order.items}}
      <table width="100%" style="margin-bottom: 12px;">
        <tr>
          <td width="60" style="vertical-align: top;">
            <img src="{{this.imageURL}}" alt="{{this.name}}" width="60" height="60" style="border-radius: 4px; object-fit: cover;">
          </td>
          <td style="padding-left: 12px; vertical-align: top;">
            <p style="margin: 0 0 4px; font-weight: 500;">{{this.name}}</p>
            {{#if this.variantName}}
            <p style="margin: 0 0 4px; font-size: 14px; color: #6b7280;">{{this.variantName}}</p>
            {{/if}}
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Кількість: {{this.quantity}}</p>
          </td>
          <td style="text-align: right; vertical-align: top; white-space: nowrap;">
            <p style="margin: 0; font-weight: 500;">{{formatPrice this.total}}</p>
          </td>
        </tr>
      </table>
      {{/each}}

      <hr class="divider">

      <table width="100%">
        <tr>
          <td>Підсумок:</td>
          <td style="text-align: right;">{{formatPrice order.subtotal}}</td>
        </tr>
        {{#if order.discountAmount}}
        <tr style="color: #059669;">
          <td>Знижка:</td>
          <td style="text-align: right;">-{{formatPrice order.discountAmount}}</td>
        </tr>
        {{/if}}
        <tr>
          <td>Доставка:</td>
          <td style="text-align: right;">{{formatPrice order.shippingAmount}}</td>
        </tr>
        <tr style="font-weight: 600; font-size: 18px;">
          <td>Всього:</td>
          <td style="text-align: right;">{{formatPrice order.total}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- Shipping Address -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td width="50%" style="vertical-align: top; padding-right: 12px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; color: #6b7280; text-transform: uppercase;">Адреса доставки</h3>
      <p style="margin: 0;">
        {{order.shippingAddress.firstName}} {{order.shippingAddress.lastName}}<br>
        {{order.shippingAddress.address1}}<br>
        {{#if order.shippingAddress.address2}}{{order.shippingAddress.address2}}<br>{{/if}}
        {{order.shippingAddress.city}}, {{order.shippingAddress.postalCode}}<br>
        {{order.shippingAddress.phone}}
      </p>
    </td>
    <td width="50%" style="vertical-align: top; padding-left: 12px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; color: #6b7280; text-transform: uppercase;">Спосіб доставки</h3>
      <p style="margin: 0;">
        {{order.shippingMethod}}<br>
        <span style="color: #6b7280;">Очікувана дата: {{formatDate order.estimatedDelivery}}</span>
      </p>
    </td>
  </tr>
</table>

<!-- CTA Button -->
<p style="text-align: center; margin: 32px 0;">
  <a href="{{orderURL}}" class="button">Переглянути замовлення</a>
</p>

<p>Якщо у вас є питання, просто відповідте на цей лист або зверніться до нашої <a href="{{baseURL}}/support">служби підтримки</a>.</p>

<p>З найкращими побажаннями,<br>Команда {{companyName}}</p>
```

### Shipping Notification

```html
<!-- templates/shipping_notification.html -->
<h1>Ваше замовлення в дорозі! 📦</h1>

<p>Привіт, {{customer.firstName}}!</p>

<p>Чудові новини! Ваше замовлення <strong>#{{order.number}}</strong> відправлено і прямує до вас.</p>

<!-- Tracking Info -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: #ecfdf5; padding: 16px; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #059669;">Номер відстеження</p>
      <p style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #047857; font-family: monospace;">
        {{shipment.trackingNumber}}
      </p>
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
        Перевізник: {{shipment.carrier}}
      </p>
      <a href="{{trackingURL}}" class="button" style="background-color: #059669;">
        Відстежити посилку
      </a>
    </td>
  </tr>
</table>

<!-- Delivery Estimate -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
      <h3 style="margin: 0 0 12px; font-size: 16px;">Очікувана доставка</h3>
      <p style="margin: 0; font-size: 20px; font-weight: 600;">
        {{formatDate shipment.estimatedDelivery "dddd, D MMMM"}}
      </p>
    </td>
  </tr>
</table>

<!-- Items Shipped -->
<h3 style="margin: 24px 0 12px;">Що в посилці:</h3>

{{#each shipment.items}}
<table width="100%" style="margin-bottom: 8px;">
  <tr>
    <td width="40" style="vertical-align: middle;">
      <img src="{{this.imageURL}}" alt="{{this.name}}" width="40" height="40" style="border-radius: 4px;">
    </td>
    <td style="padding-left: 12px; vertical-align: middle;">
      <p style="margin: 0;">{{this.name}} × {{this.quantity}}</p>
    </td>
  </tr>
</table>
{{/each}}

<hr class="divider">

<p>
  Адреса доставки:<br>
  <strong>
    {{order.shippingAddress.address1}}, {{order.shippingAddress.city}}, {{order.shippingAddress.postalCode}}
  </strong>
</p>

<p style="color: #6b7280; font-size: 14px;">
  Якщо вас не буде вдома, перевізник залишить повідомлення з інструкціями щодо отримання.
</p>
```

### Password Reset

```html
<!-- templates/password_reset.html -->
<h1>Скидання пароля</h1>

<p>Привіт, {{user.firstName}}!</p>

<p>Ми отримали запит на скидання пароля для вашого облікового запису. Натисніть кнопку нижче, щоб створити новий пароль:</p>

<p style="text-align: center; margin: 32px 0;">
  <a href="{{resetURL}}" class="button">Скинути пароль</a>
</p>

<p style="color: #6b7280; font-size: 14px;">
  Це посилання дійсне протягом {{expiry}}. Якщо ви не запитували скидання пароля, просто проігноруйте цей лист.
</p>

<hr class="divider">

<p style="color: #6b7280; font-size: 14px;">
  Якщо кнопка не працює, скопіюйте та вставте це посилання у браузер:<br>
  <a href="{{resetURL}}" style="color: #6b7280; word-break: break-all;">{{resetURL}}</a>
</p>

<p style="color: #6b7280; font-size: 14px;">
  З міркувань безпеки, це посилання можна використати лише один раз.
</p>
```

### Abandoned Cart

```html
<!-- templates/abandoned_cart.html -->
<h1>Забули щось? 🛒</h1>

<p>Привіт, {{customer.firstName}}!</p>

<p>Помітили, що ви залишили товари у кошику. Вони все ще чекають на вас!</p>

<!-- Cart Items -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
      {{#each cart.items}}
      <table width="100%" style="margin-bottom: 12px;">
        <tr>
          <td width="80" style="vertical-align: top;">
            <img src="{{this.imageURL}}" alt="{{this.name}}" width="80" height="80" style="border-radius: 4px; object-fit: cover;">
          </td>
          <td style="padding-left: 12px; vertical-align: top;">
            <p style="margin: 0 0 4px; font-weight: 500;">{{this.name}}</p>
            {{#if this.variantName}}
            <p style="margin: 0 0 4px; font-size: 14px; color: #6b7280;">{{this.variantName}}</p>
            {{/if}}
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Кількість: {{this.quantity}}</p>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <p style="margin: 0; font-weight: 500;">{{formatPrice this.price}}</p>
          </td>
        </tr>
      </table>
      {{/each}}

      <hr class="divider">

      <table width="100%">
        <tr style="font-weight: 600;">
          <td>Всього:</td>
          <td style="text-align: right;">{{formatPrice cart.total}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="text-align: center; margin: 32px 0;">
  <a href="{{cartURL}}" class="button">Повернутися до кошика</a>
</p>

{{#if discountCode}}
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #92400e;">Спеціально для вас!</p>
      <p style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #78350f;">
        {{discountPercent}}% знижки
      </p>
      <p style="margin: 0; font-family: monospace; font-size: 18px; background: white; padding: 8px; border-radius: 4px; display: inline-block;">
        {{discountCode}}
      </p>
    </td>
  </tr>
</table>
{{/if}}

<p style="color: #6b7280; font-size: 14px;">
  Кошик зберігається протягом 7 днів. Не пропустіть свої улюблені товари!
</p>
```

## React Email (Alternative)

```tsx
// emails/src/templates/OrderConfirmation.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import { formatPrice } from '../utils/format';
import type { Order, Customer } from '../types';

interface OrderConfirmationProps {
  order: Order;
  customer: Customer;
  orderURL: string;
  baseURL: string;
}

export default function OrderConfirmation({
  order,
  customer,
  orderURL,
  baseURL,
}: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Дякуємо за замовлення #{order.number}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={`${baseURL}/logo.png`}
              width="120"
              height="40"
              alt="Shop Platform"
            />
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Дякуємо за замовлення! 🎉</Heading>

            <Text style={text}>
              Привіт, {customer.firstName}!
            </Text>

            <Text style={text}>
              Ваше замовлення <strong>#{order.number}</strong> успішно оформлено.
            </Text>

            {/* Order Items */}
            <Section style={orderBox}>
              <Heading as="h2" style={h2}>Деталі замовлення</Heading>

              {order.items.map((item) => (
                <Row key={item.id} style={itemRow}>
                  <Column style={{ width: '60px' }}>
                    <Img
                      src={item.imageURL}
                      width="60"
                      height="60"
                      alt={item.name}
                      style={itemImage}
                    />
                  </Column>
                  <Column style={itemDetails}>
                    <Text style={itemName}>{item.name}</Text>
                    {item.variantName && (
                      <Text style={itemVariant}>{item.variantName}</Text>
                    )}
                    <Text style={itemQuantity}>Кількість: {item.quantity}</Text>
                  </Column>
                  <Column style={itemPrice}>
                    <Text style={priceText}>{formatPrice(item.total)}</Text>
                  </Column>
                </Row>
              ))}

              <Hr style={divider} />

              <Row>
                <Column>
                  <Text style={summaryLabel}>Підсумок:</Text>
                </Column>
                <Column style={{ textAlign: 'right' as const }}>
                  <Text style={summaryValue}>{formatPrice(order.subtotal)}</Text>
                </Column>
              </Row>

              {order.discountAmount > 0 && (
                <Row>
                  <Column>
                    <Text style={{ ...summaryLabel, color: '#059669' }}>Знижка:</Text>
                  </Column>
                  <Column style={{ textAlign: 'right' as const }}>
                    <Text style={{ ...summaryValue, color: '#059669' }}>
                      -{formatPrice(order.discountAmount)}
                    </Text>
                  </Column>
                </Row>
              )}

              <Row>
                <Column>
                  <Text style={summaryLabel}>Доставка:</Text>
                </Column>
                <Column style={{ textAlign: 'right' as const }}>
                  <Text style={summaryValue}>{formatPrice(order.shippingAmount)}</Text>
                </Column>
              </Row>

              <Row>
                <Column>
                  <Text style={totalLabel}>Всього:</Text>
                </Column>
                <Column style={{ textAlign: 'right' as const }}>
                  <Text style={totalValue}>{formatPrice(order.total)}</Text>
                </Column>
              </Row>
            </Section>

            <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
              <Button href={orderURL} style={button}>
                Переглянути замовлення
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Shop Platform. Всі права захищені.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseURL}/privacy`} style={footerLink}>Політика конфіденційності</Link>
              {' | '}
              <Link href={`${baseURL}/terms`} style={footerLink}>Умови використання</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
};

const header = {
  backgroundColor: '#2563eb',
  padding: '24px',
  textAlign: 'center' as const,
};

const content = {
  padding: '32px 24px',
};

const footer = {
  backgroundColor: '#f9fafb',
  padding: '24px',
  textAlign: 'center' as const,
};

const h1 = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px',
};

const h2 = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px',
};

const text = {
  fontSize: '16px',
  lineHeight: '1.5',
  color: '#374151',
  margin: '0 0 16px',
};

const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '16px',
  fontWeight: '500',
  textDecoration: 'none',
};

const orderBox = {
  backgroundColor: '#f9fafb',
  padding: '16px',
  borderRadius: '8px',
  margin: '24px 0',
};

const itemRow = {
  marginBottom: '12px',
};

const itemImage = {
  borderRadius: '4px',
  objectFit: 'cover' as const,
};

const itemDetails = {
  paddingLeft: '12px',
  verticalAlign: 'top' as const,
};

const itemName = {
  margin: '0 0 4px',
  fontWeight: '500',
};

const itemVariant = {
  margin: '0 0 4px',
  fontSize: '14px',
  color: '#6b7280',
};

const itemQuantity = {
  margin: '0',
  fontSize: '14px',
  color: '#6b7280',
};

const itemPrice = {
  textAlign: 'right' as const,
  verticalAlign: 'top' as const,
};

const priceText = {
  margin: '0',
  fontWeight: '500',
};

const divider = {
  borderTop: '1px solid #e5e7eb',
  margin: '16px 0',
};

const summaryLabel = {
  margin: '0',
  color: '#374151',
};

const summaryValue = {
  margin: '0',
};

const totalLabel = {
  margin: '0',
  fontSize: '18px',
  fontWeight: '600',
};

const totalValue = {
  margin: '0',
  fontSize: '18px',
  fontWeight: '600',
};

const footerText = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: '#6b7280',
};

const footerLinks = {
  margin: '0',
  fontSize: '12px',
};

const footerLink = {
  color: '#6b7280',
};
```

## Testing Emails

```go
// internal/email/service_test.go
package email

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockSender struct {
	mock.Mock
}

func (m *MockSender) Send(ctx context.Context, email *Email) error {
	args := m.Called(ctx, email)
	return args.Error(0)
}

func TestSendOrderConfirmation(t *testing.T) {
	mockSender := new(MockSender)
	mockSender.On("Send", mock.Anything, mock.MatchedBy(func(e *Email) bool {
		return e.To == "test@example.com" &&
			strings.Contains(e.Subject, "#ORD-001")
	})).Return(nil)

	service, _ := NewEmailService(mockSender, "./templates", "https://shop.com", "noreply@shop.com", "Shop")

	order := &Order{
		ID:     "order-1",
		Number: "ORD-001",
		Items: []OrderItem{
			{Name: "Test Product", Quantity: 1, Price: 100},
		},
		Total: 100,
	}
	customer := &Customer{
		Email:     "test@example.com",
		FirstName: "John",
	}

	err := service.SendOrderConfirmation(context.Background(), order, customer)

	assert.NoError(t, err)
	mockSender.AssertExpectations(t)
}
```

## Див. також

- [Notifications](../modules/NOTIFICATIONS.md)
- [Resend Documentation](https://resend.com/docs)
- [React Email](https://react.email)
- [MJML](https://mjml.io)
