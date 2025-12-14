# OMS Service (Order Management System)

The OMS Service handles all order-related operations including order creation, payment processing, shipment tracking, and returns management.

## Overview

| Property | Value |
|----------|-------|
| Port | 8081 |
| Technology | Go 1.24 |
| Database | PostgreSQL 15 |
| Queue | RabbitMQ |

## Responsibilities

- Order lifecycle management
- Payment processing integration
- Promo code validation
- Shipment creation and tracking
- Invoice generation
- Refund processing
- Order analytics

## Order Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                        ORDER LIFECYCLE                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌────────────┐ │
│  │ PENDING │───▶│ CONFIRMED│───▶│ PROCESSING│───▶│  SHIPPED   │ │
│  └─────────┘    └──────────┘    └───────────┘    └────────────┘ │
│       │              │               │                  │        │
│       │              │               │                  ▼        │
│       │              │               │           ┌────────────┐  │
│       │              │               │           │ DELIVERED  │  │
│       │              │               │           └────────────┘  │
│       │              │               │                  │        │
│       ▼              ▼               ▼                  ▼        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      CANCELLED / REFUNDED                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Order Statuses

| Status | Description |
|--------|-------------|
| `pending` | Order created, awaiting payment |
| `confirmed` | Payment received |
| `processing` | Being prepared |
| `shipped` | Handed to carrier |
| `delivered` | Customer received |
| `cancelled` | Order cancelled |
| `refunded` | Money returned |

## API Endpoints

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/orders` | List orders (paginated) |
| GET | `/api/v1/orders/:id` | Get order details |
| POST | `/api/v1/orders` | Create order |
| PUT | `/api/v1/orders/:id/status` | Update status |
| POST | `/api/v1/orders/:id/cancel` | Cancel order |
| GET | `/api/v1/orders/:id/invoice` | Get invoice PDF |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payments/create` | Initiate payment |
| POST | `/api/v1/payments/callback` | Payment webhook |
| GET | `/api/v1/payments/:id/status` | Check payment status |
| POST | `/api/v1/payments/:id/refund` | Process refund |

### Shipments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/shipments` | Create shipment |
| GET | `/api/v1/shipments/:id/track` | Track shipment |
| GET | `/api/v1/shipments/carriers` | List carriers |

### Promo Codes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/promo/validate` | Validate promo code |
| POST | `/api/v1/promo/apply` | Apply to order |
| GET | `/api/v1/promo` | List promo codes (admin) |
| POST | `/api/v1/promo` | Create promo code |

## Data Models

### Order

```go
type Order struct {
    ID            string          `json:"id"`
    TenantID      string          `json:"tenant_id"`
    CustomerID    string          `json:"customer_id"`
    Status        OrderStatus     `json:"status"`
    Items         []OrderItem     `json:"items"`
    Subtotal      decimal.Decimal `json:"subtotal"`
    Discount      decimal.Decimal `json:"discount"`
    ShippingCost  decimal.Decimal `json:"shipping_cost"`
    Tax           decimal.Decimal `json:"tax"`
    Total         decimal.Decimal `json:"total"`
    Currency      string          `json:"currency"`
    PromoCode     *string         `json:"promo_code,omitempty"`
    ShippingAddress Address       `json:"shipping_address"`
    BillingAddress  Address       `json:"billing_address"`
    PaymentMethod   string        `json:"payment_method"`
    PaymentID       *string       `json:"payment_id,omitempty"`
    Notes           string        `json:"notes,omitempty"`
    CreatedAt       time.Time     `json:"created_at"`
    UpdatedAt       time.Time     `json:"updated_at"`
}

type OrderItem struct {
    ID        string          `json:"id"`
    ProductID string          `json:"product_id"`
    SKU       string          `json:"sku"`
    Name      string          `json:"name"`
    Quantity  int             `json:"quantity"`
    Price     decimal.Decimal `json:"price"`
    Total     decimal.Decimal `json:"total"`
}
```

### Payment

```go
type Payment struct {
    ID            string          `json:"id"`
    OrderID       string          `json:"order_id"`
    Provider      PaymentProvider `json:"provider"`
    Amount        decimal.Decimal `json:"amount"`
    Currency      string          `json:"currency"`
    Status        PaymentStatus   `json:"status"`
    TransactionID string          `json:"transaction_id,omitempty"`
    ErrorMessage  string          `json:"error_message,omitempty"`
    PaidAt        *time.Time      `json:"paid_at,omitempty"`
    CreatedAt     time.Time       `json:"created_at"`
}
```

## Payment Integrations

### Supported Providers

| Provider | Type | Region |
|----------|------|--------|
| LiqPay | Card, Apple Pay, Google Pay | Ukraine |
| Monobank | Card, Apple Pay | Ukraine |
| PrivatBank | Card, Installments | Ukraine |
| Stripe | Card, Apple Pay, Google Pay | Global |
| Fondy | Card | Ukraine |

### Payment Flow

```
1. Customer selects payment method
          │
          ▼
2. OMS creates payment record
          │
          ▼
3. Redirect to provider / Show widget
          │
          ▼
4. Customer completes payment
          │
          ▼
5. Provider sends webhook callback
          │
          ▼
6. OMS verifies signature
          │
          ▼
7. Update payment & order status
          │
          ▼
8. Publish "payment.completed" event
```

### LiqPay Integration

```go
// Create payment
paymentURL, err := liqpay.CreatePayment(liqpay.PaymentRequest{
    OrderID:     order.ID,
    Amount:      order.Total,
    Currency:    "UAH",
    Description: fmt.Sprintf("Order #%s", order.ID),
    ResultURL:   "https://store.com/order-complete",
    ServerURL:   "https://api.store.com/payments/liqpay/callback",
})

// Verify callback
verified, data := liqpay.VerifyCallback(signature, body)
```

### Monobank Integration

```go
// Create invoice
invoice, err := mono.CreateInvoice(mono.InvoiceRequest{
    Amount:    int64(order.Total * 100), // kopecks
    Ccy:       980, // UAH
    Reference: order.ID,
    RedirectURL: "https://store.com/order-complete",
    WebhookURL:  "https://api.store.com/payments/mono/callback",
})

// Customer redirects to invoice.PageURL
```

## Shipping Integrations

### Supported Carriers

| Carrier | API | Tracking |
|---------|-----|----------|
| Nova Poshta | REST API | Yes |
| Meest Express | REST API | Yes |
| Justin | REST API | Yes |
| Ukrposhta | REST API | Yes |

### Nova Poshta Integration

```go
// Create shipment
ttn, err := novaposhta.CreateShipment(novaposhta.ShipmentRequest{
    SenderRef:    warehouseRef,
    RecipientRef: recipientRef,
    CargoType:    "Parcel",
    Weight:       order.TotalWeight,
    Description:  "Order items",
    Cost:         order.Total,
    PaymentMethod: "NonCash",
})

// Track shipment
status, err := novaposhta.TrackDocument(ttn)
```

## Promo Codes

### Types

| Type | Description | Example |
|------|-------------|---------|
| `percentage` | Discount % | 10% off |
| `fixed` | Fixed amount | 100 UAH off |
| `free_shipping` | Free delivery | - |
| `buy_x_get_y` | Bundle deal | Buy 2 get 1 free |

### Validation Rules

```go
type PromoCode struct {
    Code          string          `json:"code"`
    Type          PromoType       `json:"type"`
    Value         decimal.Decimal `json:"value"`
    MinOrderValue *decimal.Decimal `json:"min_order_value,omitempty"`
    MaxDiscount   *decimal.Decimal `json:"max_discount,omitempty"`
    MaxUses       *int            `json:"max_uses,omitempty"`
    CurrentUses   int             `json:"current_uses"`
    ValidFrom     time.Time       `json:"valid_from"`
    ValidUntil    time.Time       `json:"valid_until"`
    Categories    []string        `json:"categories,omitempty"`
    Products      []string        `json:"products,omitempty"`
    CustomerIDs   []string        `json:"customer_ids,omitempty"`
    IsFirstOrder  bool            `json:"is_first_order"`
}
```

## Events

### Published Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `order.created` | New order | Notification, Analytics, CRM |
| `order.confirmed` | Payment received | Warehouse, Notification |
| `order.shipped` | Shipment created | Notification, CRM |
| `order.delivered` | Delivery confirmed | CRM, Analytics |
| `order.cancelled` | Order cancelled | Inventory, Notification |
| `payment.completed` | Payment success | Order, Notification |
| `payment.failed` | Payment failed | Notification |
| `shipment.updated` | Tracking update | Notification |

### Consumed Events

| Event | Source | Action |
|-------|--------|--------|
| `stock.reserved` | Core | Confirm reservation |
| `stock.released` | Core | Handle cancellation |

## Configuration

```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/shop_oms

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Payment Providers
LIQPAY_PUBLIC_KEY=your-public-key
LIQPAY_PRIVATE_KEY=your-private-key
MONO_TOKEN=your-mono-token
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Shipping
NOVAPOSHTA_API_KEY=your-api-key
MEEST_API_KEY=your-api-key

# Service URLs
CORE_SERVICE_URL=http://core:8080
CRM_SERVICE_URL=http://crm:8084
```

## Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `oms_orders_total` | Counter | Total orders by status |
| `oms_order_value` | Histogram | Order value distribution |
| `oms_payment_success_rate` | Gauge | Payment success % |
| `oms_shipments_created` | Counter | Shipments by carrier |
| `oms_processing_time` | Histogram | Order processing duration |

## Running Locally

```bash
cd services/oms

# Run server
go run cmd/server/main.go

# Run tests
go test ./...
```

## API Examples

### Create Order

```bash
curl -X POST http://localhost:8081/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"product_id": "prod_123", "quantity": 2}
    ],
    "shipping_address": {
      "city": "Kyiv",
      "address": "Khreshchatyk 1",
      "phone": "+380991234567"
    },
    "payment_method": "liqpay"
  }'
```

### Apply Promo Code

```bash
curl -X POST http://localhost:8081/api/v1/promo/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUMMER20",
    "order_total": 1500.00
  }'
```
