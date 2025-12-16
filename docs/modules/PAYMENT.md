# Payment Module

Обробка платежів та інтеграція з платіжними системами.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PAYMENT ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Checkout     │────▶│ Payment      │────▶│ Provider     │                │
│  │ Service      │     │ Service      │     │ Adapter      │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                              │                    │                         │
│                              ▼                    ▼                         │
│                       ┌──────────────┐     ┌──────────────┐                │
│                       │ Payment      │     │ LiqPay       │                │
│                       │ Repository   │     │ Monobank     │                │
│                       └──────────────┘     │ PrivatBank   │                │
│                                            │ Fondy        │                │
│                                            └──────────────┘                │
│                                                                              │
│  Payment Flow:                                                              │
│  ├── 1. Create payment intent                                               │
│  ├── 2. Redirect to provider                                                │
│  ├── 3. Process callback                                                    │
│  ├── 4. Update order status                                                 │
│  └── 5. Create fiscal receipt                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Payment providers
PAYMENT_DEFAULT_PROVIDER=liqpay

# LiqPay
LIQPAY_PUBLIC_KEY=your_public_key
LIQPAY_PRIVATE_KEY=your_private_key

# Monobank
MONOBANK_TOKEN=your_token

# Fondy
FONDY_MERCHANT_ID=your_merchant_id
FONDY_PASSWORD=your_password

# Webhook URL
PAYMENT_WEBHOOK_URL=https://api.shop.ua/webhooks/payment
```

## Provider Interface

```go
// pkg/payment/provider.go
package payment

import (
    "context"
)

type Provider interface {
    // CreatePayment initiates a payment
    CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error)

    // ProcessCallback handles provider webhook
    ProcessCallback(ctx context.Context, data []byte) (*CallbackResult, error)

    // GetStatus checks payment status
    GetStatus(ctx context.Context, paymentID string) (*PaymentStatus, error)

    // Refund processes a refund
    Refund(ctx context.Context, paymentID string, amount float64) (*RefundResult, error)

    // Name returns provider name
    Name() string
}

type PaymentRequest struct {
    OrderID     string
    Amount      float64
    Currency    string
    Description string
    CustomerEmail string
    CustomerPhone string
    ReturnURL   string
    CallbackURL string
    Metadata    map[string]string
}

type PaymentResponse struct {
    PaymentID   string
    Status      string
    RedirectURL string
    Data        map[string]interface{}
}

type CallbackResult struct {
    PaymentID     string
    OrderID       string
    Status        string
    Amount        float64
    TransactionID string
    Error         string
}

type PaymentStatus struct {
    Status        string
    Amount        float64
    TransactionID string
    PaidAt        *time.Time
}

type RefundResult struct {
    RefundID  string
    Status    string
    Amount    float64
}
```

## LiqPay Implementation

```go
// pkg/payment/liqpay/provider.go
package liqpay

import (
    "context"
    "crypto/sha1"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
)

type Provider struct {
    publicKey  string
    privateKey string
    client     *http.Client
}

func New(publicKey, privateKey string) *Provider {
    return &Provider{
        publicKey:  publicKey,
        privateKey: privateKey,
        client:     &http.Client{Timeout: 30 * time.Second},
    }
}

func (p *Provider) Name() string {
    return "liqpay"
}

func (p *Provider) CreatePayment(ctx context.Context, req *payment.PaymentRequest) (*payment.PaymentResponse, error) {
    data := map[string]interface{}{
        "version":     3,
        "public_key":  p.publicKey,
        "action":      "pay",
        "amount":      req.Amount,
        "currency":    req.Currency,
        "description": req.Description,
        "order_id":    req.OrderID,
        "result_url":  req.ReturnURL,
        "server_url":  req.CallbackURL,
    }

    if req.CustomerEmail != "" {
        data["customer"] = req.CustomerEmail
    }

    // Encode data
    jsonData, _ := json.Marshal(data)
    encodedData := base64.StdEncoding.EncodeToString(jsonData)
    signature := p.sign(encodedData)

    // Build redirect URL
    redirectURL := fmt.Sprintf(
        "https://www.liqpay.ua/api/3/checkout?data=%s&signature=%s",
        url.QueryEscape(encodedData),
        url.QueryEscape(signature),
    )

    return &payment.PaymentResponse{
        PaymentID:   req.OrderID,
        Status:      "pending",
        RedirectURL: redirectURL,
    }, nil
}

func (p *Provider) ProcessCallback(ctx context.Context, data []byte) (*payment.CallbackResult, error) {
    // Parse form data
    values, _ := url.ParseQuery(string(data))
    encodedData := values.Get("data")
    signature := values.Get("signature")

    // Verify signature
    expectedSig := p.sign(encodedData)
    if signature != expectedSig {
        return nil, fmt.Errorf("invalid signature")
    }

    // Decode data
    jsonData, _ := base64.StdEncoding.DecodeString(encodedData)
    var result struct {
        OrderID       string  `json:"order_id"`
        Status        string  `json:"status"`
        Amount        float64 `json:"amount"`
        TransactionID int64   `json:"transaction_id"`
        ErrCode       string  `json:"err_code"`
        ErrDescription string `json:"err_description"`
    }
    json.Unmarshal(jsonData, &result)

    // Map status
    status := p.mapStatus(result.Status)

    return &payment.CallbackResult{
        PaymentID:     fmt.Sprintf("liqpay_%d", result.TransactionID),
        OrderID:       result.OrderID,
        Status:        status,
        Amount:        result.Amount,
        TransactionID: fmt.Sprintf("%d", result.TransactionID),
        Error:         result.ErrDescription,
    }, nil
}

func (p *Provider) Refund(ctx context.Context, paymentID string, amount float64) (*payment.RefundResult, error) {
    data := map[string]interface{}{
        "version":    3,
        "public_key": p.publicKey,
        "action":     "refund",
        "order_id":   paymentID,
        "amount":     amount,
    }

    jsonData, _ := json.Marshal(data)
    encodedData := base64.StdEncoding.EncodeToString(jsonData)
    signature := p.sign(encodedData)

    // Call refund API
    resp, err := p.client.PostForm("https://www.liqpay.ua/api/request", url.Values{
        "data":      {encodedData},
        "signature": {signature},
    })
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Status string `json:"status"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    return &payment.RefundResult{
        RefundID: fmt.Sprintf("refund_%s", paymentID),
        Status:   result.Status,
        Amount:   amount,
    }, nil
}

func (p *Provider) sign(data string) string {
    str := p.privateKey + data + p.privateKey
    hash := sha1.Sum([]byte(str))
    return base64.StdEncoding.EncodeToString(hash[:])
}

func (p *Provider) mapStatus(status string) string {
    switch status {
    case "success":
        return "completed"
    case "failure", "error":
        return "failed"
    case "wait_accept", "processing":
        return "processing"
    default:
        return "pending"
    }
}
```

## Payment Service

```go
// services/core/internal/payment/service.go
package payment

import (
    "context"
    "fmt"
)

type Service struct {
    providers map[string]payment.Provider
    repo      PaymentRepository
    orderRepo OrderRepository
    fiscal    FiscalService
    events    EventPublisher
    config    *Config
}

func NewService(cfg *Config, repo PaymentRepository, providers ...payment.Provider) *Service {
    s := &Service{
        providers: make(map[string]payment.Provider),
        repo:      repo,
        config:    cfg,
    }

    for _, p := range providers {
        s.providers[p.Name()] = p
    }

    return s
}

// InitiatePayment creates a new payment
func (s *Service) InitiatePayment(ctx context.Context, orderID string, providerName string) (*PaymentResult, error) {
    // Get order
    order, err := s.orderRepo.FindByID(ctx, orderID)
    if err != nil {
        return nil, fmt.Errorf("order not found: %w", err)
    }

    // Get provider
    provider, ok := s.providers[providerName]
    if !ok {
        provider = s.providers[s.config.DefaultProvider]
    }

    // Create payment record
    payment := &Payment{
        ID:        uuid.New().String(),
        TenantID:  order.TenantID,
        OrderID:   order.ID,
        Provider:  provider.Name(),
        Amount:    order.Total,
        Currency:  order.Currency,
        Status:    PaymentStatusPending,
        CreatedAt: time.Now(),
    }

    if err := s.repo.Create(ctx, payment); err != nil {
        return nil, fmt.Errorf("create payment: %w", err)
    }

    // Create payment with provider
    req := &payment.PaymentRequest{
        OrderID:       order.ID,
        Amount:        order.Total,
        Currency:      order.Currency,
        Description:   fmt.Sprintf("Замовлення %s", order.Number),
        CustomerEmail: order.Customer.Email,
        CustomerPhone: order.Customer.Phone,
        ReturnURL:     fmt.Sprintf("%s/orders/%s/thank-you", s.config.StoreURL, order.ID),
        CallbackURL:   fmt.Sprintf("%s/webhooks/%s", s.config.APIURL, provider.Name()),
    }

    resp, err := provider.CreatePayment(ctx, req)
    if err != nil {
        payment.Status = PaymentStatusFailed
        payment.Error = err.Error()
        s.repo.Update(ctx, payment)
        return nil, fmt.Errorf("provider error: %w", err)
    }

    // Update payment with provider response
    payment.ProviderPaymentID = resp.PaymentID
    payment.ProviderData = resp.Data
    s.repo.Update(ctx, payment)

    // Publish event
    s.events.Publish(ctx, &events.PaymentInitiated{
        PaymentID: payment.ID,
        OrderID:   order.ID,
        Provider:  provider.Name(),
        Amount:    order.Total,
    })

    return &PaymentResult{
        PaymentID:   payment.ID,
        RedirectURL: resp.RedirectURL,
    }, nil
}

// ProcessCallback handles payment callback
func (s *Service) ProcessCallback(ctx context.Context, providerName string, data []byte) error {
    provider, ok := s.providers[providerName]
    if !ok {
        return fmt.Errorf("unknown provider: %s", providerName)
    }

    // Process callback
    result, err := provider.ProcessCallback(ctx, data)
    if err != nil {
        return fmt.Errorf("process callback: %w", err)
    }

    // Find payment
    payment, err := s.repo.FindByOrderID(ctx, result.OrderID)
    if err != nil {
        return fmt.Errorf("payment not found: %w", err)
    }

    // Update payment
    payment.Status = s.mapStatus(result.Status)
    payment.TransactionID = result.TransactionID
    payment.Error = result.Error

    if payment.Status == PaymentStatusCompleted {
        payment.PaidAt = timePtr(time.Now())
    }

    if err := s.repo.Update(ctx, payment); err != nil {
        return fmt.Errorf("update payment: %w", err)
    }

    // Update order
    if payment.Status == PaymentStatusCompleted {
        order, _ := s.orderRepo.FindByID(ctx, payment.OrderID)
        order.PaymentStatus = "paid"
        order.PaidAt = payment.PaidAt
        s.orderRepo.Update(ctx, order)

        // Create fiscal receipt
        go s.fiscal.CreateReceipt(context.Background(), order)

        // Publish event
        s.events.Publish(ctx, &events.PaymentCompleted{
            PaymentID:     payment.ID,
            OrderID:       order.ID,
            Amount:        payment.Amount,
            TransactionID: payment.TransactionID,
        })
    }

    return nil
}

// RefundPayment processes a refund
func (s *Service) RefundPayment(ctx context.Context, paymentID string, amount float64, reason string) error {
    payment, err := s.repo.FindByID(ctx, paymentID)
    if err != nil {
        return err
    }

    if payment.Status != PaymentStatusCompleted {
        return ErrPaymentNotCompleted
    }

    provider := s.providers[payment.Provider]

    result, err := provider.Refund(ctx, payment.ProviderPaymentID, amount)
    if err != nil {
        return fmt.Errorf("refund failed: %w", err)
    }

    // Create refund record
    refund := &Refund{
        ID:         uuid.New().String(),
        PaymentID:  payment.ID,
        Amount:     amount,
        Reason:     reason,
        Status:     result.Status,
        RefundID:   result.RefundID,
        CreatedAt:  time.Now(),
    }
    s.refundRepo.Create(ctx, refund)

    // Update payment
    payment.RefundedAmount += amount
    if payment.RefundedAmount >= payment.Amount {
        payment.Status = PaymentStatusRefunded
    } else {
        payment.Status = PaymentStatusPartiallyRefunded
    }
    s.repo.Update(ctx, payment)

    // Publish event
    s.events.Publish(ctx, &events.PaymentRefunded{
        PaymentID: payment.ID,
        RefundID:  refund.ID,
        Amount:    amount,
        Reason:    reason,
    })

    return nil
}
```

## Database Schema

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(50) NOT NULL,
    provider_payment_id VARCHAR(255),
    transaction_id VARCHAR(255),

    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UAH',
    refunded_amount DECIMAL(12,2) DEFAULT 0,

    status VARCHAR(50) DEFAULT 'pending',
    error TEXT,
    provider_data JSONB,

    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refunds (
    id UUID PRIMARY KEY,
    payment_id UUID REFERENCES payments(id),
    refund_id VARCHAR(255),
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
```

## Webhook Handler

```go
// handlers/payment_webhook.go
func (h *Handler) HandlePaymentWebhook(w http.ResponseWriter, r *http.Request) {
    provider := chi.URLParam(r, "provider")

    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "read body", http.StatusBadRequest)
        return
    }

    if err := h.paymentService.ProcessCallback(r.Context(), provider, body); err != nil {
        log.Error().Err(err).Str("provider", provider).Msg("payment callback failed")
        http.Error(w, "callback failed", http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
}
```

## Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Payment initiated |
| `processing` | Being processed |
| `completed` | Successfully paid |
| `failed` | Payment failed |
| `cancelled` | Cancelled by user |
| `refunded` | Fully refunded |
| `partially_refunded` | Partially refunded |

## See Also

- [LiqPay Integration](../integrations/LIQPAY.md)
- [Monobank Integration](../integrations/MONOBANK.md)
- [Fiscal Module](./FISCAL.md)
- [Orders Module](./ORDERS.md)
