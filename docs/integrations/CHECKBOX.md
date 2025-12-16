# Checkbox Integration

Інтеграція з Checkbox.ua для фіскалізації чеків (ПРРО).

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHECKBOX INTEGRATION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Payment      │────▶│ Fiscal       │────▶│ Checkbox     │                │
│  │ Completed    │     │ Service      │     │ API          │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                              │                    │                         │
│                              │                    ▼                         │
│                              │              ┌──────────────┐                │
│                              │              │ ДПС          │                │
│                              │              │ (Державна    │                │
│                              │              │ Податкова)   │                │
│                              ▼              └──────────────┘                │
│                       ┌──────────────┐                                      │
│                       │ Receipt      │                                      │
│                       │ Storage      │                                      │
│                       └──────────────┘                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Checkbox API
CHECKBOX_API_URL=https://api.checkbox.ua/api/v1
CHECKBOX_LICENSE_KEY=your_license_key
CHECKBOX_CASHIER_LOGIN=cashier@shop.ua
CHECKBOX_CASHIER_PASSWORD=secure_password
CHECKBOX_CASHBOX_ID=cashbox_uuid

# Webhook
CHECKBOX_WEBHOOK_SECRET=webhook_secret
```

### Go Configuration

```go
// config/checkbox.go
type CheckboxConfig struct {
    APIURL          string `env:"CHECKBOX_API_URL" envDefault:"https://api.checkbox.ua/api/v1"`
    LicenseKey      string `env:"CHECKBOX_LICENSE_KEY,required"`
    CashierLogin    string `env:"CHECKBOX_CASHIER_LOGIN,required"`
    CashierPassword string `env:"CHECKBOX_CASHIER_PASSWORD,required"`
    CashboxID       string `env:"CHECKBOX_CASHBOX_ID,required"`
    WebhookSecret   string `env:"CHECKBOX_WEBHOOK_SECRET"`
    Timeout         time.Duration `env:"CHECKBOX_TIMEOUT" envDefault:"30s"`
}
```

## API Client

### Client Implementation

```go
// pkg/fiscal/checkbox/client.go
package checkbox

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type Client struct {
    httpClient *http.Client
    baseURL    string
    licenseKey string
    token      string
    tokenExp   time.Time
}

func NewClient(cfg *CheckboxConfig) *Client {
    return &Client{
        httpClient: &http.Client{
            Timeout: cfg.Timeout,
        },
        baseURL:    cfg.APIURL,
        licenseKey: cfg.LicenseKey,
    }
}

// Authenticate with cashier credentials
func (c *Client) Authenticate(ctx context.Context, login, password string) error {
    req := &SignInRequest{
        Login:    login,
        Password: password,
    }

    resp, err := c.post(ctx, "/cashier/signin", req, false)
    if err != nil {
        return fmt.Errorf("checkbox auth: %w", err)
    }

    var result SignInResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return fmt.Errorf("decode response: %w", err)
    }

    c.token = result.AccessToken
    c.tokenExp = time.Now().Add(23 * time.Hour) // Token valid 24h

    return nil
}

// EnsureAuthenticated checks and refreshes token if needed
func (c *Client) EnsureAuthenticated(ctx context.Context, login, password string) error {
    if c.token == "" || time.Now().After(c.tokenExp) {
        return c.Authenticate(ctx, login, password)
    }
    return nil
}
```

### HTTP Methods

```go
func (c *Client) post(ctx context.Context, path string, body interface{}, auth bool) (*http.Response, error) {
    jsonBody, err := json.Marshal(body)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bytes.NewReader(jsonBody))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-License-Key", c.licenseKey)
    if auth && c.token != "" {
        req.Header.Set("Authorization", "Bearer "+c.token)
    }

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode >= 400 {
        var errResp ErrorResponse
        json.NewDecoder(resp.Body).Decode(&errResp)
        return nil, &CheckboxError{
            Code:    resp.StatusCode,
            Message: errResp.Message,
        }
    }

    return resp, nil
}

func (c *Client) get(ctx context.Context, path string) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
    if err != nil {
        return nil, err
    }

    req.Header.Set("X-License-Key", c.licenseKey)
    if c.token != "" {
        req.Header.Set("Authorization", "Bearer "+c.token)
    }

    return c.httpClient.Do(req)
}
```

## Receipt Operations

### Create Sale Receipt

```go
// CreateReceipt creates a fiscal sale receipt
func (c *Client) CreateReceipt(ctx context.Context, receipt *Receipt) (*ReceiptResponse, error) {
    // Build goods array
    goods := make([]Good, len(receipt.Items))
    for i, item := range receipt.Items {
        goods[i] = Good{
            Code:     item.SKU,
            Name:     item.Name,
            Quantity: int(item.Quantity.Mul(decimal.NewFromInt(1000)).IntPart()), // тисячні
            Price:    int(item.Price.Mul(decimal.NewFromInt(100)).IntPart()),     // копійки
        }

        // Tax code
        if item.TaxRate > 0 {
            goods[i].Taxes = []int{getTaxCode(item.TaxRate)}
        }
    }

    // Build payments
    payments := make([]Payment, len(receipt.Payments))
    for i, p := range receipt.Payments {
        payments[i] = Payment{
            Type:  mapPaymentType(p.Method),
            Value: int(p.Amount.Mul(decimal.NewFromInt(100)).IntPart()),
        }
    }

    req := &CreateReceiptRequest{
        Goods:    goods,
        Payments: payments,
    }

    // Add customer info if email provided
    if receipt.Customer != nil && receipt.Customer.Email != "" {
        req.DeliveryEmails = []string{receipt.Customer.Email}
    }

    resp, err := c.post(ctx, "/receipts/sell", req, true)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result ReceiptResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return &result, nil
}

// Tax codes mapping
func getTaxCode(rate float64) int {
    switch rate {
    case 20:
        return 1 // ПДВ 20%
    case 7:
        return 2 // ПДВ 7%
    case 0:
        return 3 // Без ПДВ
    default:
        return 3
    }
}

// Payment type mapping
func mapPaymentType(method string) string {
    switch method {
    case "cash":
        return "CASH"
    case "card", "liqpay", "monobank":
        return "CASHLESS"
    default:
        return "CASHLESS"
    }
}
```

### Create Refund Receipt

```go
// CreateRefund creates a refund receipt
func (c *Client) CreateRefund(ctx context.Context, refund *Refund) (*ReceiptResponse, error) {
    goods := make([]Good, len(refund.Items))
    for i, item := range refund.Items {
        goods[i] = Good{
            Code:     item.SKU,
            Name:     item.Name,
            Quantity: int(item.Quantity.Mul(decimal.NewFromInt(1000)).IntPart()),
            Price:    int(item.Price.Mul(decimal.NewFromInt(100)).IntPart()),
        }
    }

    req := &CreateReceiptRequest{
        Goods: goods,
        Payments: []Payment{
            {
                Type:  mapPaymentType(refund.Method),
                Value: int(refund.Amount.Mul(decimal.NewFromInt(100)).IntPart()),
            },
        },
    }

    resp, err := c.post(ctx, "/receipts/return", req, true)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result ReceiptResponse
    json.NewDecoder(resp.Body).Decode(&result)
    return &result, nil
}
```

### Get Receipt

```go
// GetReceipt retrieves receipt by ID
func (c *Client) GetReceipt(ctx context.Context, receiptID string) (*ReceiptResponse, error) {
    resp, err := c.get(ctx, fmt.Sprintf("/receipts/%s", receiptID))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result ReceiptResponse
    json.NewDecoder(resp.Body).Decode(&result)
    return &result, nil
}
```

## Shift Management

### Open Shift

```go
// OpenShift opens a new fiscal shift
func (c *Client) OpenShift(ctx context.Context) (*ShiftResponse, error) {
    resp, err := c.post(ctx, "/shifts", nil, true)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result ShiftResponse
    json.NewDecoder(resp.Body).Decode(&result)
    return &result, nil
}
```

### Close Shift

```go
// CloseShift closes current shift and generates Z-report
func (c *Client) CloseShift(ctx context.Context) (*ZReportResponse, error) {
    // Get current shift
    shift, err := c.GetCurrentShift(ctx)
    if err != nil {
        return nil, err
    }

    if shift == nil || shift.Status == "CLOSED" {
        return nil, ErrNoOpenShift
    }

    // Close shift
    resp, err := c.post(ctx, fmt.Sprintf("/shifts/%s/close", shift.ID), nil, true)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result ZReportResponse
    json.NewDecoder(resp.Body).Decode(&result)
    return &result, nil
}

// GetCurrentShift returns current open shift
func (c *Client) GetCurrentShift(ctx context.Context) (*ShiftResponse, error) {
    resp, err := c.get(ctx, "/cashier/shift")
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode == 404 {
        return nil, nil // No open shift
    }

    var result ShiftResponse
    json.NewDecoder(resp.Body).Decode(&result)
    return &result, nil
}
```

## Data Types

### Request/Response Types

```go
// SignInRequest for authentication
type SignInRequest struct {
    Login    string `json:"login"`
    Password string `json:"password"`
}

type SignInResponse struct {
    AccessToken string `json:"access_token"`
    TokenType   string `json:"token_type"`
}

// Good represents a receipt item
type Good struct {
    Code     string `json:"code"`
    Name     string `json:"name"`
    Quantity int    `json:"quantity"` // в тисячних (1000 = 1 шт)
    Price    int    `json:"price"`    // в копійках
    Taxes    []int  `json:"taxes,omitempty"`
}

// Payment represents a payment method
type Payment struct {
    Type  string `json:"type"` // CASH, CASHLESS
    Value int    `json:"value"` // в копійках
}

// CreateReceiptRequest for creating receipts
type CreateReceiptRequest struct {
    Goods          []Good   `json:"goods"`
    Payments       []Payment `json:"payments"`
    DeliveryEmails []string `json:"delivery_emails,omitempty"`
}

// ReceiptResponse from Checkbox API
type ReceiptResponse struct {
    ID              string    `json:"id"`
    Type            string    `json:"type"`
    FiscalCode      string    `json:"fiscal_code"`
    FiscalDate      time.Time `json:"fiscal_date"`
    Status          string    `json:"status"`
    Total           int       `json:"total_sum"`
    TaxesSum        int       `json:"taxes_sum"`
    CheckHTMLURL    string    `json:"check_html_url"`
    CheckPDFURL     string    `json:"check_pdf_url"`
    CheckQRCodeURL  string    `json:"qr_code_url"`
}

// ShiftResponse for shift operations
type ShiftResponse struct {
    ID            string    `json:"id"`
    Status        string    `json:"status"`
    OpenedAt      time.Time `json:"opened_at"`
    ClosedAt      *time.Time `json:"closed_at"`
    InitialTrans  int       `json:"initial_transaction"`
    ClosingTrans  *int      `json:"closing_transaction"`
}

// ZReportResponse for Z-report
type ZReportResponse struct {
    ID         string    `json:"id"`
    ShiftID    string    `json:"shift_id"`
    CreatedAt  time.Time `json:"created_at"`
    TotalSum   int       `json:"total_sum"`
    PaymentsSum int      `json:"payments_sum"`
}
```

## Webhooks

### Webhook Handler

```go
// handlers/checkbox_webhook.go
func (h *Handler) HandleCheckboxWebhook(w http.ResponseWriter, r *http.Request) {
    // Verify signature
    signature := r.Header.Get("X-Checkbox-Signature")
    body, _ := io.ReadAll(r.Body)

    if !h.verifySignature(body, signature) {
        w.WriteHeader(http.StatusUnauthorized)
        return
    }

    var event CheckboxEvent
    if err := json.Unmarshal(body, &event); err != nil {
        w.WriteHeader(http.StatusBadRequest)
        return
    }

    switch event.Type {
    case "receipt.created":
        h.handleReceiptCreated(r.Context(), &event)
    case "shift.opened":
        h.handleShiftOpened(r.Context(), &event)
    case "shift.closed":
        h.handleShiftClosed(r.Context(), &event)
    }

    w.WriteHeader(http.StatusOK)
}

func (h *Handler) verifySignature(body []byte, signature string) bool {
    mac := hmac.New(sha256.New, []byte(h.webhookSecret))
    mac.Write(body)
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

### Webhook Events

```go
type CheckboxEvent struct {
    Type      string          `json:"type"`
    Timestamp time.Time       `json:"timestamp"`
    Data      json.RawMessage `json:"data"`
}

// Event handlers
func (h *Handler) handleReceiptCreated(ctx context.Context, event *CheckboxEvent) {
    var data ReceiptCreatedData
    json.Unmarshal(event.Data, &data)

    // Update order with receipt info
    h.orderService.UpdateFiscalInfo(ctx, data.OrderID, &FiscalInfo{
        ReceiptID:    data.ReceiptID,
        FiscalNumber: data.FiscalCode,
        CheckURL:     data.CheckURL,
    })
}
```

## Service Integration

### Fiscal Service

```go
// services/core/internal/fiscal/service.go
type FiscalService struct {
    checkbox *checkbox.Client
    repo     FiscalRepository
    queue    *rabbitmq.Publisher
    config   *CheckboxConfig
}

func (s *FiscalService) CreateReceiptForOrder(ctx context.Context, order *Order) error {
    // Ensure authenticated
    if err := s.checkbox.EnsureAuthenticated(ctx, s.config.CashierLogin, s.config.CashierPassword); err != nil {
        return fmt.Errorf("auth: %w", err)
    }

    // Build receipt
    receipt := s.buildReceipt(order)

    // Create receipt
    result, err := s.checkbox.CreateReceipt(ctx, receipt)
    if err != nil {
        // Queue for retry
        return s.queueForRetry(ctx, order, err)
    }

    // Save receipt info
    return s.repo.SaveReceipt(ctx, &FiscalReceipt{
        OrderID:      order.ID,
        TenantID:     order.TenantID,
        ReceiptID:    result.ID,
        FiscalNumber: result.FiscalCode,
        FiscalDate:   result.FiscalDate,
        CheckURL:     result.CheckHTMLURL,
        Total:        order.Total,
        Status:       "completed",
    })
}

func (s *FiscalService) buildReceipt(order *Order) *Receipt {
    items := make([]ReceiptItem, len(order.Items))
    for i, item := range order.Items {
        items[i] = ReceiptItem{
            SKU:      item.SKU,
            Name:     item.Name,
            Quantity: decimal.NewFromInt(int64(item.Quantity)),
            Price:    item.Price,
            TaxRate:  20, // ПДВ 20%
        }
    }

    return &Receipt{
        OrderID: order.ID,
        Items:   items,
        Payments: []ReceiptPayment{
            {
                Method: order.PaymentMethod,
                Amount: order.Total,
            },
        },
        Customer: &ReceiptCustomer{
            Email: order.Customer.Email,
        },
    }
}
```

## Automated Shift Management

### Shift Scheduler

```go
// CronJob to manage shifts
func (s *FiscalService) ScheduleShiftManagement() {
    // Open shift at 8:00 AM
    cron.Schedule("0 8 * * *", func() {
        ctx := context.Background()
        if err := s.OpenShift(ctx); err != nil {
            log.Error().Err(err).Msg("failed to open shift")
        }
    })

    // Close shift at 11:00 PM
    cron.Schedule("0 23 * * *", func() {
        ctx := context.Background()
        if err := s.CloseShift(ctx); err != nil {
            log.Error().Err(err).Msg("failed to close shift")
        }
    })
}

func (s *FiscalService) OpenShift(ctx context.Context) error {
    s.checkbox.EnsureAuthenticated(ctx, s.config.CashierLogin, s.config.CashierPassword)

    // Check if shift already open
    shift, _ := s.checkbox.GetCurrentShift(ctx)
    if shift != nil && shift.Status == "OPENED" {
        return nil // Already open
    }

    _, err := s.checkbox.OpenShift(ctx)
    return err
}

func (s *FiscalService) CloseShift(ctx context.Context) error {
    s.checkbox.EnsureAuthenticated(ctx, s.config.CashierLogin, s.config.CashierPassword)

    report, err := s.checkbox.CloseShift(ctx)
    if err != nil {
        return err
    }

    // Save Z-report
    return s.repo.SaveZReport(ctx, &ZReport{
        ShiftID:   report.ShiftID,
        ReportID:  report.ID,
        TotalSum:  report.TotalSum,
        CreatedAt: report.CreatedAt,
    })
}
```

## Error Handling

```go
// Checkbox-specific errors
var (
    ErrNoOpenShift      = errors.New("no open shift")
    ErrShiftAlreadyOpen = errors.New("shift already open")
    ErrInvalidReceipt   = errors.New("invalid receipt data")
    ErrUnauthorized     = errors.New("unauthorized")
)

type CheckboxError struct {
    Code    int
    Message string
}

func (e *CheckboxError) Error() string {
    return fmt.Sprintf("checkbox error %d: %s", e.Code, e.Message)
}

// IsRetryable checks if error can be retried
func IsRetryable(err error) bool {
    var cbErr *CheckboxError
    if errors.As(err, &cbErr) {
        // 5xx errors are retryable
        if cbErr.Code >= 500 {
            return true
        }
        // Some 4xx errors are retryable
        if cbErr.Code == 429 { // Rate limited
            return true
        }
    }
    return false
}
```

## Monitoring

### Metrics

```go
var (
    receiptCreated = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "checkbox_receipts_created_total",
            Help: "Total receipts created",
        },
        []string{"type", "status"},
    )

    receiptLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "checkbox_receipt_duration_seconds",
            Help:    "Receipt creation latency",
            Buckets: []float64{0.1, 0.5, 1, 2, 5},
        },
        []string{"type"},
    )
)
```

### Alerts

```yaml
groups:
  - name: checkbox
    rules:
      - alert: CheckboxReceiptFailures
        expr: rate(checkbox_receipts_created_total{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High Checkbox receipt failure rate"

      - alert: CheckboxShiftNotOpened
        expr: checkbox_shift_status != 1
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Checkbox shift not opened during business hours"
```

## See Also

- [Fiscal Module](../modules/FISCAL.md)
- [ADR-009 Fiscal Integration](../adr/ADR-009-fiscal-integration.md)
- [LiqPay Integration](./LIQPAY.md)
