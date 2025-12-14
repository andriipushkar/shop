# LiqPay Integration

Інтеграція з платіжною системою LiqPay.

## Огляд

| Параметр | Значення |
|----------|----------|
| Провайдер | ПриватБанк |
| API Version | 3 |
| Sandbox | Так |
| Документація | https://www.liqpay.ua/documentation |

### Підтримувані методи оплати

- Картки Visa/Mastercard
- Apple Pay / Google Pay
- Privat24
- LiqPay гаманець
- Рахунок-фактура
- Оплата частинами

---

## Конфігурація

### Environment Variables

```env
# .env
LIQPAY_PUBLIC_KEY=sandbox_i00000000000
LIQPAY_PRIVATE_KEY=sandbox_000000000000000000000000000000000000
LIQPAY_SANDBOX=true
LIQPAY_CALLBACK_URL=https://api.yourstore.com/webhooks/liqpay
LIQPAY_RESULT_URL=https://yourstore.com/order/result
```

### Config Structure

```go
// internal/config/liqpay.go
type LiqPayConfig struct {
    PublicKey   string `env:"LIQPAY_PUBLIC_KEY,required"`
    PrivateKey  string `env:"LIQPAY_PRIVATE_KEY,required"`
    Sandbox     bool   `env:"LIQPAY_SANDBOX" envDefault:"true"`
    CallbackURL string `env:"LIQPAY_CALLBACK_URL,required"`
    ResultURL   string `env:"LIQPAY_RESULT_URL,required"`
}
```

---

## Імплементація

### LiqPay Client

```go
// pkg/liqpay/client.go
package liqpay

import (
    "crypto/sha1"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "strings"
)

const (
    APIEndpoint     = "https://www.liqpay.ua/api/request"
    CheckoutURL     = "https://www.liqpay.ua/api/3/checkout"
    APIVersion      = 3
)

type Client struct {
    publicKey  string
    privateKey string
    sandbox    bool
    httpClient *http.Client
}

func NewClient(publicKey, privateKey string, sandbox bool) *Client {
    return &Client{
        publicKey:  publicKey,
        privateKey: privateKey,
        sandbox:    sandbox,
        httpClient: &http.Client{Timeout: 30 * time.Second},
    }
}

// Signature генерує підпис для запиту
func (c *Client) Signature(data string) string {
    signString := c.privateKey + data + c.privateKey
    hash := sha1.Sum([]byte(signString))
    return base64.StdEncoding.EncodeToString(hash[:])
}

// EncodeData кодує параметри в base64
func (c *Client) EncodeData(params map[string]interface{}) string {
    params["version"] = APIVersion
    params["public_key"] = c.publicKey

    jsonData, _ := json.Marshal(params)
    return base64.StdEncoding.EncodeToString(jsonData)
}
```

### Payment Request

```go
// pkg/liqpay/payment.go
package liqpay

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/url"
    "strings"
)

type PaymentRequest struct {
    Action      string  `json:"action"`
    Amount      float64 `json:"amount"`
    Currency    string  `json:"currency"`
    Description string  `json:"description"`
    OrderID     string  `json:"order_id"`
    ResultURL   string  `json:"result_url,omitempty"`
    ServerURL   string  `json:"server_url,omitempty"`
    Language    string  `json:"language,omitempty"`
    Sandbox     int     `json:"sandbox,omitempty"`
}

type PaymentResponse struct {
    PaymentID    string  `json:"payment_id"`
    Status       string  `json:"status"`
    ErrCode      string  `json:"err_code,omitempty"`
    ErrDescription string `json:"err_description,omitempty"`
    Amount       float64 `json:"amount"`
    Currency     string  `json:"currency"`
    OrderID      string  `json:"order_id"`
    LiqpayOrderID string `json:"liqpay_order_id"`
    TransactionID string `json:"transaction_id"`
    SenderCardMask string `json:"sender_card_mask2"`
    SenderCardBank string `json:"sender_card_bank"`
    SenderCardType string `json:"sender_card_type"`
    SenderCardCountry string `json:"sender_card_country"`
    CommissionCredit float64 `json:"commission_credit"`
    CommissionDebit  float64 `json:"commission_debit"`
    CreateDate   string  `json:"create_date"`
    EndDate      string  `json:"end_date"`
}

// CreatePayment створює платіж і повертає URL для оплати
func (c *Client) CreatePayment(ctx context.Context, req *PaymentRequest) (*CheckoutData, error) {
    params := map[string]interface{}{
        "action":      req.Action,
        "amount":      req.Amount,
        "currency":    req.Currency,
        "description": req.Description,
        "order_id":    req.OrderID,
    }

    if req.ResultURL != "" {
        params["result_url"] = req.ResultURL
    }
    if req.ServerURL != "" {
        params["server_url"] = req.ServerURL
    }
    if req.Language != "" {
        params["language"] = req.Language
    }
    if c.sandbox {
        params["sandbox"] = 1
    }

    data := c.EncodeData(params)
    signature := c.Signature(data)

    return &CheckoutData{
        Data:      data,
        Signature: signature,
        URL:       CheckoutURL,
    }, nil
}

type CheckoutData struct {
    Data      string `json:"data"`
    Signature string `json:"signature"`
    URL       string `json:"url"`
}

// GetPaymentStatus отримує статус платежу
func (c *Client) GetPaymentStatus(ctx context.Context, orderID string) (*PaymentResponse, error) {
    params := map[string]interface{}{
        "action":   "status",
        "order_id": orderID,
    }

    data := c.EncodeData(params)
    signature := c.Signature(data)

    form := url.Values{}
    form.Set("data", data)
    form.Set("signature", signature)

    req, err := http.NewRequestWithContext(ctx, "POST", APIEndpoint, strings.NewReader(form.Encode()))
    if err != nil {
        return nil, err
    }
    req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result PaymentResponse
    if err := json.Unmarshal(body, &result); err != nil {
        return nil, err
    }

    return &result, nil
}
```

### Refund

```go
// pkg/liqpay/refund.go
package liqpay

import (
    "context"
    "encoding/json"
    "net/url"
    "strings"
)

type RefundRequest struct {
    OrderID string  `json:"order_id"`
    Amount  float64 `json:"amount"`
}

type RefundResponse struct {
    Status       string  `json:"status"`
    PaymentID    string  `json:"payment_id"`
    RefundAmount float64 `json:"refund_amount"`
    ErrCode      string  `json:"err_code,omitempty"`
    ErrDescription string `json:"err_description,omitempty"`
}

// Refund виконує повернення коштів
func (c *Client) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
    params := map[string]interface{}{
        "action":   "refund",
        "order_id": req.OrderID,
        "amount":   req.Amount,
    }

    data := c.EncodeData(params)
    signature := c.Signature(data)

    form := url.Values{}
    form.Set("data", data)
    form.Set("signature", signature)

    httpReq, err := http.NewRequestWithContext(ctx, "POST", APIEndpoint, strings.NewReader(form.Encode()))
    if err != nil {
        return nil, err
    }
    httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result RefundResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return &result, nil
}
```

### Webhook Handler

```go
// internal/handlers/webhooks/liqpay.go
package webhooks

import (
    "crypto/sha1"
    "encoding/base64"
    "encoding/json"
    "net/http"

    "github.com/gin-gonic/gin"
    "shop/pkg/liqpay"
)

type LiqPayWebhookHandler struct {
    privateKey     string
    paymentService PaymentService
    orderService   OrderService
}

func NewLiqPayWebhookHandler(privateKey string, ps PaymentService, os OrderService) *LiqPayWebhookHandler {
    return &LiqPayWebhookHandler{
        privateKey:     privateKey,
        paymentService: ps,
        orderService:   os,
    }
}

// Handle обробляє callback від LiqPay
func (h *LiqPayWebhookHandler) Handle(c *gin.Context) {
    data := c.PostForm("data")
    signature := c.PostForm("signature")

    // Верифікація підпису
    if !h.verifySignature(data, signature) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
        return
    }

    // Декодування даних
    decoded, err := base64.StdEncoding.DecodeString(data)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data"})
        return
    }

    var callback liqpay.PaymentResponse
    if err := json.Unmarshal(decoded, &callback); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
        return
    }

    // Обробка статусу
    ctx := c.Request.Context()

    switch callback.Status {
    case "success", "sandbox":
        // Успішна оплата
        err = h.handleSuccess(ctx, &callback)
    case "failure":
        // Невдала оплата
        err = h.handleFailure(ctx, &callback)
    case "reversed":
        // Повернення
        err = h.handleReversed(ctx, &callback)
    case "wait_accept":
        // Очікує підтвердження
        err = h.handlePending(ctx, &callback)
    default:
        // Інші статуси - логуємо
        log.Printf("LiqPay callback: order=%s status=%s", callback.OrderID, callback.Status)
    }

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *LiqPayWebhookHandler) verifySignature(data, signature string) bool {
    signString := h.privateKey + data + h.privateKey
    hash := sha1.Sum([]byte(signString))
    expected := base64.StdEncoding.EncodeToString(hash[:])
    return signature == expected
}

func (h *LiqPayWebhookHandler) handleSuccess(ctx context.Context, callback *liqpay.PaymentResponse) error {
    // Оновлюємо статус платежу
    payment, err := h.paymentService.UpdateByExternalID(ctx, callback.OrderID, &UpdatePaymentInput{
        Status:        PaymentStatusSuccess,
        ExternalID:    callback.PaymentID,
        TransactionID: callback.TransactionID,
        PaidAt:        time.Now(),
        Metadata: map[string]interface{}{
            "card_mask":    callback.SenderCardMask,
            "card_bank":    callback.SenderCardBank,
            "card_type":    callback.SenderCardType,
            "commission":   callback.CommissionCredit,
        },
    })
    if err != nil {
        return err
    }

    // Оновлюємо статус замовлення
    return h.orderService.UpdateStatus(ctx, payment.OrderID, OrderStatusPaid)
}

func (h *LiqPayWebhookHandler) handleFailure(ctx context.Context, callback *liqpay.PaymentResponse) error {
    return h.paymentService.UpdateByExternalID(ctx, callback.OrderID, &UpdatePaymentInput{
        Status:     PaymentStatusFailed,
        FailReason: callback.ErrDescription,
    })
}

func (h *LiqPayWebhookHandler) handleReversed(ctx context.Context, callback *liqpay.PaymentResponse) error {
    return h.paymentService.UpdateByExternalID(ctx, callback.OrderID, &UpdatePaymentInput{
        Status:     PaymentStatusRefunded,
        RefundedAt: time.Now(),
    })
}

func (h *LiqPayWebhookHandler) handlePending(ctx context.Context, callback *liqpay.PaymentResponse) error {
    return h.paymentService.UpdateByExternalID(ctx, callback.OrderID, &UpdatePaymentInput{
        Status: PaymentStatusPending,
    })
}
```

---

## Payment Service

```go
// internal/services/payment/liqpay.go
package payment

import (
    "context"
    "fmt"

    "shop/pkg/liqpay"
)

type LiqPayPaymentService struct {
    client      *liqpay.Client
    repo        PaymentRepository
    callbackURL string
    resultURL   string
}

func NewLiqPayPaymentService(cfg *config.LiqPayConfig, repo PaymentRepository) *LiqPayPaymentService {
    return &LiqPayPaymentService{
        client:      liqpay.NewClient(cfg.PublicKey, cfg.PrivateKey, cfg.Sandbox),
        repo:        repo,
        callbackURL: cfg.CallbackURL,
        resultURL:   cfg.ResultURL,
    }
}

// CreatePayment створює платіж для замовлення
func (s *LiqPayPaymentService) CreatePayment(ctx context.Context, order *Order) (*PaymentResult, error) {
    // Створюємо запис про платіж
    payment := &Payment{
        ID:         generateID("pay"),
        OrderID:    order.ID,
        Amount:     order.Total,
        Currency:   order.Currency,
        Status:     PaymentStatusCreated,
        Provider:   "liqpay",
        CreatedAt:  time.Now(),
    }

    if err := s.repo.Create(ctx, payment); err != nil {
        return nil, err
    }

    // Створюємо запит до LiqPay
    req := &liqpay.PaymentRequest{
        Action:      "pay",
        Amount:      float64(order.Total) / 100, // копійки -> гривні
        Currency:    string(order.Currency),
        Description: fmt.Sprintf("Замовлення #%s", order.Number),
        OrderID:     payment.ID,
        ResultURL:   fmt.Sprintf("%s?order_id=%s", s.resultURL, order.ID),
        ServerURL:   s.callbackURL,
        Language:    "uk",
    }

    checkout, err := s.client.CreatePayment(ctx, req)
    if err != nil {
        return nil, err
    }

    return &PaymentResult{
        PaymentID: payment.ID,
        Checkout:  checkout,
    }, nil
}

// GetPaymentForm повертає HTML форму для оплати
func (s *LiqPayPaymentService) GetPaymentForm(checkout *liqpay.CheckoutData) string {
    return fmt.Sprintf(`
        <form method="POST" action="%s" accept-charset="utf-8">
            <input type="hidden" name="data" value="%s" />
            <input type="hidden" name="signature" value="%s" />
            <button type="submit">Оплатити</button>
        </form>
    `, checkout.URL, checkout.Data, checkout.Signature)
}

// RefundPayment повертає кошти
func (s *LiqPayPaymentService) RefundPayment(ctx context.Context, paymentID string, amount int64) error {
    payment, err := s.repo.FindByID(ctx, paymentID)
    if err != nil {
        return err
    }

    if payment.Status != PaymentStatusSuccess {
        return ErrInvalidPaymentStatus
    }

    req := &liqpay.RefundRequest{
        OrderID: payment.ID,
        Amount:  float64(amount) / 100,
    }

    resp, err := s.client.Refund(ctx, req)
    if err != nil {
        return err
    }

    if resp.Status != "reversed" && resp.Status != "success" {
        return fmt.Errorf("refund failed: %s", resp.ErrDescription)
    }

    return s.repo.Update(ctx, paymentID, &UpdatePaymentInput{
        Status:       PaymentStatusRefunded,
        RefundAmount: amount,
        RefundedAt:   time.Now(),
    })
}
```

---

## Frontend Integration

### React Component

```tsx
// components/payment/LiqPayButton.tsx
import { useState } from 'react';

interface LiqPayButtonProps {
  orderId: string;
  amount: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function LiqPayButton({ orderId, amount, onSuccess, onError }: LiqPayButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Редірект на сторінку оплати LiqPay
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.checkout.url;
      form.acceptCharset = 'utf-8';

      const dataInput = document.createElement('input');
      dataInput.type = 'hidden';
      dataInput.name = 'data';
      dataInput.value = data.checkout.data;
      form.appendChild(dataInput);

      const signatureInput = document.createElement('input');
      signatureInput.type = 'hidden';
      signatureInput.name = 'signature';
      signatureInput.value = data.checkout.signature;
      form.appendChild(signatureInput);

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      onError?.(error.message);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? 'Завантаження...' : `Оплатити ${(amount / 100).toFixed(2)} грн`}
    </button>
  );
}
```

### LiqPay Widget

```tsx
// components/payment/LiqPayWidget.tsx
import { useEffect, useRef } from 'react';

interface LiqPayWidgetProps {
  data: string;
  signature: string;
  onSuccess?: (data: any) => void;
  onClose?: () => void;
}

export function LiqPayWidget({ data, signature, onSuccess, onClose }: LiqPayWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Завантаження LiqPay SDK
    const script = document.createElement('script');
    script.src = '//static.liqpay.ua/libjs/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.LiqPayCheckout && containerRef.current) {
        window.LiqPayCheckout.init({
          data,
          signature,
          embedTo: containerRef.current,
          language: 'uk',
          mode: 'embed', // або 'popup'
        })
          .on('liqpay.callback', (response: any) => {
            if (response.status === 'success' || response.status === 'sandbox') {
              onSuccess?.(response);
            }
          })
          .on('liqpay.ready', () => {
            console.log('LiqPay widget ready');
          })
          .on('liqpay.close', () => {
            onClose?.();
          });
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [data, signature, onSuccess, onClose]);

  return <div ref={containerRef} className="liqpay-container" />;
}

// Типи для window
declare global {
  interface Window {
    LiqPayCheckout: {
      init: (config: any) => {
        on: (event: string, callback: (data?: any) => void) => any;
      };
    };
  }
}
```

---

## Статуси платежів

| Статус LiqPay | Опис | Дія |
|---------------|------|-----|
| `success` | Успішний платіж | Оновити замовлення |
| `sandbox` | Тестовий платіж | Оновити замовлення |
| `failure` | Невдалий платіж | Логувати помилку |
| `reversed` | Повернення | Скасувати замовлення |
| `wait_accept` | Очікує підтвердження | Чекати |
| `wait_card` | Очікує введення картки | - |
| `processing` | В обробці | Чекати |
| `error` | Помилка | Логувати |

---

## Тестування

### Тестові картки

| Номер картки | Результат |
|--------------|-----------|
| 4242424242424242 | Успішна оплата |
| 4000000000000002 | Відхилено |
| 4000000000009995 | Недостатньо коштів |

### Unit Tests

```go
// pkg/liqpay/client_test.go
package liqpay

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestSignature(t *testing.T) {
    client := NewClient("public_key", "private_key", true)

    data := "eyJ2ZXJzaW9uIjozLCJwdWJsaWNfa2V5IjoicHVibGljX2tleSIsImFjdGlvbiI6InBheSJ9"
    signature := client.Signature(data)

    assert.NotEmpty(t, signature)
    assert.Equal(t, 28, len(signature)) // Base64 SHA1
}

func TestEncodeData(t *testing.T) {
    client := NewClient("public_key", "private_key", true)

    params := map[string]interface{}{
        "action":   "pay",
        "amount":   100.50,
        "currency": "UAH",
    }

    encoded := client.EncodeData(params)

    assert.NotEmpty(t, encoded)
    // Перевіряємо що можна декодувати
    decoded, err := base64.StdEncoding.DecodeString(encoded)
    assert.NoError(t, err)
    assert.Contains(t, string(decoded), "public_key")
}
```

### Integration Tests

```go
// pkg/liqpay/integration_test.go
//go:build integration

package liqpay

import (
    "context"
    "os"
    "testing"
    "github.com/stretchr/testify/require"
)

func TestCreatePayment_Integration(t *testing.T) {
    client := NewClient(
        os.Getenv("LIQPAY_PUBLIC_KEY"),
        os.Getenv("LIQPAY_PRIVATE_KEY"),
        true, // sandbox
    )

    req := &PaymentRequest{
        Action:      "pay",
        Amount:      1.00,
        Currency:    "UAH",
        Description: "Test payment",
        OrderID:     "test_" + time.Now().Format("20060102150405"),
    }

    checkout, err := client.CreatePayment(context.Background(), req)
    require.NoError(t, err)
    require.NotEmpty(t, checkout.Data)
    require.NotEmpty(t, checkout.Signature)
}
```

---

## Помилки та їх вирішення

| Код помилки | Опис | Вирішення |
|-------------|------|-----------|
| `err_order_id` | Невірний order_id | Перевірити формат |
| `err_amount` | Невірна сума | Сума > 0 |
| `err_signature` | Невірний підпис | Перевірити private_key |
| `err_payment` | Помилка платежу | Перевірити картку |
| `err_limit` | Перевищено ліміт | Зменшити суму |

---

## Безпека

### Checklist

- [ ] Зберігати private_key тільки на сервері
- [ ] Верифікувати підпис callback
- [ ] Перевіряти суму платежу
- [ ] Логувати всі транзакції
- [ ] Використовувати HTTPS
- [ ] Не логувати sensitive дані

### Приклад верифікації

```go
func (h *Handler) verifyPayment(callback *liqpay.PaymentResponse, order *Order) error {
    // Перевірка суми
    expectedAmount := float64(order.Total) / 100
    if callback.Amount != expectedAmount {
        return fmt.Errorf("amount mismatch: expected %.2f, got %.2f", expectedAmount, callback.Amount)
    }

    // Перевірка валюти
    if callback.Currency != string(order.Currency) {
        return fmt.Errorf("currency mismatch: expected %s, got %s", order.Currency, callback.Currency)
    }

    // Перевірка статусу
    if callback.Status != "success" && callback.Status != "sandbox" {
        return fmt.Errorf("invalid status: %s", callback.Status)
    }

    return nil
}
```

---

## Моніторинг

### Метрики

```go
var (
    paymentTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "liqpay_payments_total",
            Help: "Total LiqPay payments",
        },
        []string{"status"},
    )

    paymentAmount = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "liqpay_payment_amount",
            Help:    "Payment amounts",
            Buckets: []float64{100, 500, 1000, 5000, 10000, 50000},
        },
        []string{"currency"},
    )

    paymentDuration = prometheus.NewHistogram(
        prometheus.HistogramOpts{
            Name:    "liqpay_payment_duration_seconds",
            Help:    "Payment processing duration",
            Buckets: prometheus.DefBuckets,
        },
    )
)
```

### Alerts

```yaml
groups:
  - name: liqpay
    rules:
      - alert: LiqPayHighFailureRate
        expr: |
          sum(rate(liqpay_payments_total{status="failure"}[5m])) /
          sum(rate(liqpay_payments_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High LiqPay payment failure rate"

      - alert: LiqPayWebhookErrors
        expr: |
          sum(rate(http_requests_total{handler="liqpay_webhook",status=~"5.."}[5m])) > 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "LiqPay webhook errors"
```
