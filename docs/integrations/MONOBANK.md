# Monobank Integration

Інтеграція з Monobank Acquiring API.

## Огляд

| Параметр | Значення |
|----------|----------|
| API Version | v2 |
| Base URL | https://api.monobank.ua |
| Документація | https://api.monobank.ua/docs/acquiring.html |

### Можливості

- Прийом платежів карткою
- Apple Pay / Google Pay
- Оплата частинами
- Tokenization
- Split payments
- QR-код оплата

---

## Конфігурація

### Environment Variables

```env
# .env
MONOBANK_TOKEN=your_merchant_token
MONOBANK_WEBHOOK_URL=https://api.yourstore.com/webhooks/monobank
MONOBANK_REDIRECT_URL=https://yourstore.com/order/result
```

### Config Structure

```go
// internal/config/monobank.go
type MonobankConfig struct {
    Token       string `env:"MONOBANK_TOKEN,required"`
    WebhookURL  string `env:"MONOBANK_WEBHOOK_URL,required"`
    RedirectURL string `env:"MONOBANK_REDIRECT_URL,required"`
}
```

---

## Імплементація

### Monobank Client

```go
// pkg/monobank/client.go
package monobank

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

const (
    BaseURL = "https://api.monobank.ua"
)

type Client struct {
    token      string
    httpClient *http.Client
}

func NewClient(token string) *Client {
    return &Client{
        token: token,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
    var reqBody io.Reader
    if body != nil {
        jsonBody, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewReader(jsonBody)
    }

    req, err := http.NewRequestWithContext(ctx, method, BaseURL+path, reqBody)
    if err != nil {
        return nil, err
    }

    req.Header.Set("X-Token", c.token)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    respBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode >= 400 {
        var errResp ErrorResponse
        json.Unmarshal(respBody, &errResp)
        return nil, fmt.Errorf("monobank error: %s (code: %s)", errResp.ErrText, errResp.ErrCode)
    }

    return respBody, nil
}

type ErrorResponse struct {
    ErrCode string `json:"errCode"`
    ErrText string `json:"errText"`
}
```

### Invoice (Payment) API

```go
// pkg/monobank/invoice.go
package monobank

import (
    "context"
    "encoding/json"
)

type CreateInvoiceRequest struct {
    Amount          int64              `json:"amount"`           // Сума в копійках
    Ccy             int                `json:"ccy,omitempty"`    // Код валюти (980 = UAH)
    MerchantPaymInfo *MerchantPaymInfo `json:"merchantPaymInfo,omitempty"`
    RedirectURL     string             `json:"redirectUrl,omitempty"`
    WebHookURL      string             `json:"webHookUrl,omitempty"`
    Validity        int64              `json:"validity,omitempty"` // Час життя інвойсу в секундах
    PaymentType     string             `json:"paymentType,omitempty"` // debit, hold
    QrId            string             `json:"qrId,omitempty"`
    Code            string             `json:"code,omitempty"` // Для оплати частинами
    SaveCardData    *SaveCardData      `json:"saveCardData,omitempty"`
}

type MerchantPaymInfo struct {
    Reference   string       `json:"reference"`   // ID замовлення
    Destination string       `json:"destination"` // Призначення платежу
    Comment     string       `json:"comment,omitempty"`
    CustomerEmails []string  `json:"customerEmails,omitempty"`
    BasketOrder []BasketItem `json:"basketOrder,omitempty"`
}

type BasketItem struct {
    Name   string  `json:"name"`
    Qty    float64 `json:"qty"`
    Sum    int64   `json:"sum"`    // Сума в копійках
    Icon   string  `json:"icon,omitempty"`
    Unit   string  `json:"unit,omitempty"`
    Code   string  `json:"code,omitempty"`
    Barcode string `json:"barcode,omitempty"`
    Header string  `json:"header,omitempty"`
    Footer string  `json:"footer,omitempty"`
    Tax    []int   `json:"tax,omitempty"`
    Uktzed string  `json:"uktzed,omitempty"`
}

type SaveCardData struct {
    SaveCard bool   `json:"saveCard"`
    WalletId string `json:"walletId,omitempty"`
}

type CreateInvoiceResponse struct {
    InvoiceId string `json:"invoiceId"`
    PageUrl   string `json:"pageUrl"`
}

// CreateInvoice створює інвойс для оплати
func (c *Client) CreateInvoice(ctx context.Context, req *CreateInvoiceRequest) (*CreateInvoiceResponse, error) {
    body, err := c.doRequest(ctx, "POST", "/api/merchant/invoice/create", req)
    if err != nil {
        return nil, err
    }

    var resp CreateInvoiceResponse
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp, nil
}

type InvoiceStatus struct {
    InvoiceId       string  `json:"invoiceId"`
    Status          string  `json:"status"`
    FailureReason   string  `json:"failureReason,omitempty"`
    Amount          int64   `json:"amount"`
    Ccy             int     `json:"ccy"`
    FinalAmount     int64   `json:"finalAmount,omitempty"`
    CreatedDate     string  `json:"createdDate"`
    ModifiedDate    string  `json:"modifiedDate"`
    Reference       string  `json:"reference"`
    Destination     string  `json:"destination,omitempty"`
    CancelList      []CancelItem `json:"cancelList,omitempty"`
    PaymentInfo     *PaymentInfo `json:"paymentInfo,omitempty"`
    WalletData      *WalletData  `json:"walletData,omitempty"`
}

type CancelItem struct {
    Status         string `json:"status"`
    Amount         int64  `json:"amount"`
    Ccy            int    `json:"ccy"`
    CreatedDate    string `json:"createdDate"`
    ModifiedDate   string `json:"modifiedDate"`
    ApprovalCode   string `json:"approvalCode,omitempty"`
    Rrn            string `json:"rrn,omitempty"`
    ExtRef         string `json:"extRef,omitempty"`
}

type PaymentInfo struct {
    Rrn          string `json:"rrn"`
    ApprovalCode string `json:"approvalCode"`
    TranId       string `json:"tranId"`
    Terminal     string `json:"terminal"`
    Bank         string `json:"bank,omitempty"`
    PaymentSystem string `json:"paymentSystem,omitempty"`
    PaymentMethod string `json:"paymentMethod,omitempty"`
    Fee          int64  `json:"fee,omitempty"`
    Country      string `json:"country,omitempty"`
    MaskedPan    string `json:"maskedPan,omitempty"`
}

type WalletData struct {
    CardToken string `json:"cardToken"`
    WalletId  string `json:"walletId"`
    Status    string `json:"status"`
}

// GetInvoiceStatus отримує статус інвойсу
func (c *Client) GetInvoiceStatus(ctx context.Context, invoiceId string) (*InvoiceStatus, error) {
    body, err := c.doRequest(ctx, "GET", "/api/merchant/invoice/status?invoiceId="+invoiceId, nil)
    if err != nil {
        return nil, err
    }

    var status InvoiceStatus
    if err := json.Unmarshal(body, &status); err != nil {
        return nil, err
    }

    return &status, nil
}

// CancelInvoice скасовує інвойс
func (c *Client) CancelInvoice(ctx context.Context, invoiceId string) error {
    req := map[string]string{"invoiceId": invoiceId}
    _, err := c.doRequest(ctx, "POST", "/api/merchant/invoice/cancel", req)
    return err
}

type RefundRequest struct {
    InvoiceId string `json:"invoiceId"`
    ExtRef    string `json:"extRef,omitempty"` // Унікальний ID повернення
    Amount    int64  `json:"amount,omitempty"` // Часткове повернення
}

type RefundResponse struct {
    Status       string `json:"status"`
    CreatedDate  string `json:"createdDate"`
    ModifiedDate string `json:"modifiedDate"`
}

// RefundInvoice виконує повернення
func (c *Client) RefundInvoice(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
    body, err := c.doRequest(ctx, "POST", "/api/merchant/invoice/cancel", req)
    if err != nil {
        return nil, err
    }

    var resp RefundResponse
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp, nil
}
```

### Hold/Capture (Two-Step Payment)

```go
// pkg/monobank/hold.go
package monobank

import (
    "context"
    "encoding/json"
)

type FinalizeInvoiceRequest struct {
    InvoiceId string `json:"invoiceId"`
    Amount    int64  `json:"amount,omitempty"` // Фінальна сума (може бути менше)
}

// FinalizeInvoice підтверджує холд
func (c *Client) FinalizeInvoice(ctx context.Context, req *FinalizeInvoiceRequest) error {
    _, err := c.doRequest(ctx, "POST", "/api/merchant/invoice/finalize", req)
    return err
}
```

### Tokenization

```go
// pkg/monobank/wallet.go
package monobank

import (
    "context"
    "encoding/json"
)

type WalletCard struct {
    CardToken  string `json:"cardToken"`
    MaskedPan  string `json:"maskedPan"`
    Country    string `json:"country"`
    WalletId   string `json:"walletId"`
}

// GetWalletCards отримує збережені картки
func (c *Client) GetWalletCards(ctx context.Context, walletId string) ([]WalletCard, error) {
    body, err := c.doRequest(ctx, "GET", "/api/merchant/wallet?walletId="+walletId, nil)
    if err != nil {
        return nil, err
    }

    var response struct {
        Wallet []WalletCard `json:"wallet"`
    }
    if err := json.Unmarshal(body, &response); err != nil {
        return nil, err
    }

    return response.Wallet, nil
}

// PayWithToken оплата збереженою карткою
func (c *Client) PayWithToken(ctx context.Context, invoiceId, cardToken string) error {
    req := map[string]string{
        "invoiceId": invoiceId,
        "cardToken": cardToken,
    }
    _, err := c.doRequest(ctx, "POST", "/api/merchant/invoice/payment-direct", req)
    return err
}

// DeleteCard видаляє збережену картку
func (c *Client) DeleteCard(ctx context.Context, cardToken string) error {
    req := map[string]string{"cardToken": cardToken}
    _, err := c.doRequest(ctx, "DELETE", "/api/merchant/wallet/card", req)
    return err
}
```

### QR Code Payment

```go
// pkg/monobank/qr.go
package monobank

import (
    "context"
    "encoding/json"
)

type QRDetails struct {
    ShortQrId   string `json:"shortQrId"`
    QrId        string `json:"qrId"`
    InvoiceId   string `json:"invoiceId,omitempty"`
    Amount      int64  `json:"amount,omitempty"`
    Ccy         int    `json:"ccy,omitempty"`
}

// CreateStaticQR створює статичний QR-код
func (c *Client) CreateStaticQR(ctx context.Context) (*QRDetails, error) {
    body, err := c.doRequest(ctx, "POST", "/api/merchant/qr/list", map[string]int{"ccy": 980})
    if err != nil {
        return nil, err
    }

    var qrs []QRDetails
    if err := json.Unmarshal(body, &qrs); err != nil {
        return nil, err
    }

    if len(qrs) == 0 {
        return nil, fmt.Errorf("no QR created")
    }

    return &qrs[0], nil
}

// GetQRList отримує список QR-кодів
func (c *Client) GetQRList(ctx context.Context) ([]QRDetails, error) {
    body, err := c.doRequest(ctx, "GET", "/api/merchant/qr/list", nil)
    if err != nil {
        return nil, err
    }

    var response struct {
        List []QRDetails `json:"list"`
    }
    if err := json.Unmarshal(body, &response); err != nil {
        return nil, err
    }

    return response.List, nil
}

// ResetQRAmount скидає суму QR-коду
func (c *Client) ResetQRAmount(ctx context.Context, qrId string) error {
    req := map[string]string{"qrId": qrId}
    _, err := c.doRequest(ctx, "POST", "/api/merchant/qr/reset-amount", req)
    return err
}
```

---

## Webhook Handler

```go
// internal/handlers/webhooks/monobank.go
package webhooks

import (
    "crypto/ecdsa"
    "crypto/sha256"
    "crypto/x509"
    "encoding/base64"
    "encoding/json"
    "encoding/pem"
    "net/http"

    "github.com/gin-gonic/gin"
)

// Публічний ключ Monobank для верифікації webhook
const monobankPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr5PqKqAQTjbSfQV7Z0r2
...
-----END PUBLIC KEY-----`

type MonobankWebhookHandler struct {
    publicKey      *ecdsa.PublicKey
    paymentService PaymentService
    orderService   OrderService
}

type WebhookPayload struct {
    InvoiceId     string       `json:"invoiceId"`
    Status        string       `json:"status"`
    FailureReason string       `json:"failureReason,omitempty"`
    Amount        int64        `json:"amount"`
    Ccy           int          `json:"ccy"`
    FinalAmount   int64        `json:"finalAmount,omitempty"`
    CreatedDate   string       `json:"createdDate"`
    ModifiedDate  string       `json:"modifiedDate"`
    Reference     string       `json:"reference"`
    CancelList    []CancelItem `json:"cancelList,omitempty"`
    PaymentInfo   *PaymentInfo `json:"paymentInfo,omitempty"`
}

func NewMonobankWebhookHandler(ps PaymentService, os OrderService) *MonobankWebhookHandler {
    block, _ := pem.Decode([]byte(monobankPublicKey))
    pubKey, _ := x509.ParsePKIXPublicKey(block.Bytes)

    return &MonobankWebhookHandler{
        publicKey:      pubKey.(*ecdsa.PublicKey),
        paymentService: ps,
        orderService:   os,
    }
}

// Handle обробляє webhook від Monobank
func (h *MonobankWebhookHandler) Handle(c *gin.Context) {
    // Читаємо body
    body, err := c.GetRawData()
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
        return
    }

    // Верифікуємо підпис
    signature := c.GetHeader("X-Sign")
    if !h.verifySignature(body, signature) {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
        return
    }

    // Парсимо payload
    var payload WebhookPayload
    if err := json.Unmarshal(body, &payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
        return
    }

    ctx := c.Request.Context()

    // Обробка статусу
    switch payload.Status {
    case "success":
        err = h.handleSuccess(ctx, &payload)
    case "failure":
        err = h.handleFailure(ctx, &payload)
    case "reversed":
        err = h.handleReversed(ctx, &payload)
    case "processing":
        // Платіж в обробці, чекаємо
        return
    case "hold":
        err = h.handleHold(ctx, &payload)
    }

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *MonobankWebhookHandler) verifySignature(body []byte, signature string) bool {
    if signature == "" {
        return false
    }

    sigBytes, err := base64.StdEncoding.DecodeString(signature)
    if err != nil {
        return false
    }

    hash := sha256.Sum256(body)
    return ecdsa.VerifyASN1(h.publicKey, hash[:], sigBytes)
}

func (h *MonobankWebhookHandler) handleSuccess(ctx context.Context, payload *WebhookPayload) error {
    // Оновлюємо статус платежу
    payment, err := h.paymentService.UpdateByExternalID(ctx, payload.InvoiceId, &UpdatePaymentInput{
        Status:        PaymentStatusSuccess,
        TransactionID: payload.PaymentInfo.TranId,
        PaidAt:        time.Now(),
        Metadata: map[string]interface{}{
            "rrn":           payload.PaymentInfo.Rrn,
            "approval_code": payload.PaymentInfo.ApprovalCode,
            "masked_pan":    payload.PaymentInfo.MaskedPan,
            "bank":          payload.PaymentInfo.Bank,
            "fee":           payload.PaymentInfo.Fee,
        },
    })
    if err != nil {
        return err
    }

    // Оновлюємо статус замовлення
    return h.orderService.UpdateStatus(ctx, payment.OrderID, OrderStatusPaid)
}

func (h *MonobankWebhookHandler) handleFailure(ctx context.Context, payload *WebhookPayload) error {
    return h.paymentService.UpdateByExternalID(ctx, payload.InvoiceId, &UpdatePaymentInput{
        Status:     PaymentStatusFailed,
        FailReason: payload.FailureReason,
    })
}

func (h *MonobankWebhookHandler) handleReversed(ctx context.Context, payload *WebhookPayload) error {
    return h.paymentService.UpdateByExternalID(ctx, payload.InvoiceId, &UpdatePaymentInput{
        Status:     PaymentStatusRefunded,
        RefundedAt: time.Now(),
    })
}

func (h *MonobankWebhookHandler) handleHold(ctx context.Context, payload *WebhookPayload) error {
    return h.paymentService.UpdateByExternalID(ctx, payload.InvoiceId, &UpdatePaymentInput{
        Status: PaymentStatusHold,
    })
}
```

---

## Payment Service

```go
// internal/services/payment/monobank.go
package payment

import (
    "context"
    "fmt"

    "shop/pkg/monobank"
)

type MonobankPaymentService struct {
    client      *monobank.Client
    webhookURL  string
    redirectURL string
    repo        PaymentRepository
}

func NewMonobankPaymentService(cfg *config.MonobankConfig, repo PaymentRepository) *MonobankPaymentService {
    return &MonobankPaymentService{
        client:      monobank.NewClient(cfg.Token),
        webhookURL:  cfg.WebhookURL,
        redirectURL: cfg.RedirectURL,
        repo:        repo,
    }
}

// CreatePayment створює платіж
func (s *MonobankPaymentService) CreatePayment(ctx context.Context, order *Order) (*PaymentResult, error) {
    // Формуємо кошик
    basketItems := make([]monobank.BasketItem, len(order.Items))
    for i, item := range order.Items {
        basketItems[i] = monobank.BasketItem{
            Name: item.Name,
            Qty:  float64(item.Quantity),
            Sum:  item.Total,
            Code: item.SKU,
        }
    }

    // Створюємо інвойс
    req := &monobank.CreateInvoiceRequest{
        Amount: order.Total,
        Ccy:    980, // UAH
        MerchantPaymInfo: &monobank.MerchantPaymInfo{
            Reference:   order.ID,
            Destination: fmt.Sprintf("Оплата замовлення #%s", order.Number),
            BasketOrder: basketItems,
        },
        RedirectURL: fmt.Sprintf("%s?order_id=%s", s.redirectURL, order.ID),
        WebHookURL:  s.webhookURL,
        Validity:    3600, // 1 година
    }

    resp, err := s.client.CreateInvoice(ctx, req)
    if err != nil {
        return nil, err
    }

    // Зберігаємо платіж
    payment := &Payment{
        ID:         generateID("pay"),
        OrderID:    order.ID,
        Amount:     order.Total,
        Currency:   order.Currency,
        Status:     PaymentStatusCreated,
        Provider:   "monobank",
        ExternalID: resp.InvoiceId,
        CreatedAt:  time.Now(),
    }

    if err := s.repo.Create(ctx, payment); err != nil {
        return nil, err
    }

    return &PaymentResult{
        PaymentID:   payment.ID,
        RedirectURL: resp.PageUrl,
    }, nil
}

// CreateHoldPayment створює платіж з холдом
func (s *MonobankPaymentService) CreateHoldPayment(ctx context.Context, order *Order) (*PaymentResult, error) {
    req := &monobank.CreateInvoiceRequest{
        Amount:      order.Total,
        Ccy:         980,
        PaymentType: "hold",
        MerchantPaymInfo: &monobank.MerchantPaymInfo{
            Reference:   order.ID,
            Destination: fmt.Sprintf("Оплата замовлення #%s", order.Number),
        },
        RedirectURL: fmt.Sprintf("%s?order_id=%s", s.redirectURL, order.ID),
        WebHookURL:  s.webhookURL,
    }

    resp, err := s.client.CreateInvoice(ctx, req)
    if err != nil {
        return nil, err
    }

    // Зберігаємо платіж
    payment := &Payment{
        ID:         generateID("pay"),
        OrderID:    order.ID,
        Amount:     order.Total,
        Currency:   order.Currency,
        Status:     PaymentStatusCreated,
        Provider:   "monobank",
        ExternalID: resp.InvoiceId,
        PaymentType: "hold",
        CreatedAt:  time.Now(),
    }

    if err := s.repo.Create(ctx, payment); err != nil {
        return nil, err
    }

    return &PaymentResult{
        PaymentID:   payment.ID,
        RedirectURL: resp.PageUrl,
    }, nil
}

// CapturePayment підтверджує холд
func (s *MonobankPaymentService) CapturePayment(ctx context.Context, paymentID string, amount int64) error {
    payment, err := s.repo.FindByID(ctx, paymentID)
    if err != nil {
        return err
    }

    if payment.Status != PaymentStatusHold {
        return ErrInvalidPaymentStatus
    }

    req := &monobank.FinalizeInvoiceRequest{
        InvoiceId: payment.ExternalID,
        Amount:    amount,
    }

    if err := s.client.FinalizeInvoice(ctx, req); err != nil {
        return err
    }

    return s.repo.Update(ctx, paymentID, &UpdatePaymentInput{
        Status:      PaymentStatusSuccess,
        FinalAmount: amount,
        PaidAt:      time.Now(),
    })
}

// RefundPayment повертає кошти
func (s *MonobankPaymentService) RefundPayment(ctx context.Context, paymentID string, amount int64) error {
    payment, err := s.repo.FindByID(ctx, paymentID)
    if err != nil {
        return err
    }

    if payment.Status != PaymentStatusSuccess {
        return ErrInvalidPaymentStatus
    }

    req := &monobank.RefundRequest{
        InvoiceId: payment.ExternalID,
        Amount:    amount,
        ExtRef:    fmt.Sprintf("refund_%s_%d", paymentID, time.Now().Unix()),
    }

    resp, err := s.client.RefundInvoice(ctx, req)
    if err != nil {
        return err
    }

    if resp.Status != "success" && resp.Status != "processing" {
        return fmt.Errorf("refund failed: %s", resp.Status)
    }

    return s.repo.Update(ctx, paymentID, &UpdatePaymentInput{
        Status:       PaymentStatusRefunded,
        RefundAmount: amount,
        RefundedAt:   time.Now(),
    })
}

// GetPaymentStatus отримує статус
func (s *MonobankPaymentService) GetPaymentStatus(ctx context.Context, paymentID string) (*PaymentStatusInfo, error) {
    payment, err := s.repo.FindByID(ctx, paymentID)
    if err != nil {
        return nil, err
    }

    // Запитуємо актуальний статус у Monobank
    status, err := s.client.GetInvoiceStatus(ctx, payment.ExternalID)
    if err != nil {
        return nil, err
    }

    return &PaymentStatusInfo{
        PaymentID: paymentID,
        Status:    mapMonobankStatus(status.Status),
        Amount:    status.Amount,
        PaidAt:    parseDate(status.ModifiedDate),
    }, nil
}

func mapMonobankStatus(status string) PaymentStatus {
    switch status {
    case "success":
        return PaymentStatusSuccess
    case "failure", "expired":
        return PaymentStatusFailed
    case "reversed":
        return PaymentStatusRefunded
    case "hold":
        return PaymentStatusHold
    case "processing":
        return PaymentStatusProcessing
    default:
        return PaymentStatusCreated
    }
}
```

---

## Saved Cards (Tokenization)

```go
// internal/services/payment/wallet.go
package payment

import (
    "context"
    "shop/pkg/monobank"
)

type WalletService struct {
    client *monobank.Client
    repo   WalletRepository
}

// GetSavedCards отримує збережені картки користувача
func (s *WalletService) GetSavedCards(ctx context.Context, customerID string) ([]SavedCard, error) {
    wallet, err := s.repo.GetWallet(ctx, customerID)
    if err != nil {
        return nil, err
    }

    if wallet == nil || wallet.MonobankWalletID == "" {
        return nil, nil
    }

    cards, err := s.client.GetWalletCards(ctx, wallet.MonobankWalletID)
    if err != nil {
        return nil, err
    }

    result := make([]SavedCard, len(cards))
    for i, c := range cards {
        result[i] = SavedCard{
            Token:     c.CardToken,
            MaskedPan: c.MaskedPan,
            Country:   c.Country,
        }
    }

    return result, nil
}

// PayWithSavedCard оплата збереженою карткою
func (s *WalletService) PayWithSavedCard(ctx context.Context, order *Order, cardToken string) (*PaymentResult, error) {
    // Створюємо інвойс
    req := &monobank.CreateInvoiceRequest{
        Amount: order.Total,
        Ccy:    980,
        MerchantPaymInfo: &monobank.MerchantPaymInfo{
            Reference:   order.ID,
            Destination: fmt.Sprintf("Оплата замовлення #%s", order.Number),
        },
    }

    resp, err := s.client.CreateInvoice(ctx, req)
    if err != nil {
        return nil, err
    }

    // Виконуємо пряму оплату токеном
    if err := s.client.PayWithToken(ctx, resp.InvoiceId, cardToken); err != nil {
        return nil, err
    }

    // Зберігаємо платіж
    payment := &Payment{
        ID:         generateID("pay"),
        OrderID:    order.ID,
        Amount:     order.Total,
        Currency:   order.Currency,
        Status:     PaymentStatusProcessing,
        Provider:   "monobank",
        ExternalID: resp.InvoiceId,
        CreatedAt:  time.Now(),
    }

    if err := s.repo.Create(ctx, payment); err != nil {
        return nil, err
    }

    return &PaymentResult{
        PaymentID: payment.ID,
    }, nil
}

// DeleteSavedCard видаляє картку
func (s *WalletService) DeleteSavedCard(ctx context.Context, customerID, cardToken string) error {
    // Перевіряємо що картка належить цьому користувачу
    cards, err := s.GetSavedCards(ctx, customerID)
    if err != nil {
        return err
    }

    found := false
    for _, c := range cards {
        if c.Token == cardToken {
            found = true
            break
        }
    }

    if !found {
        return ErrCardNotFound
    }

    return s.client.DeleteCard(ctx, cardToken)
}
```

---

## Frontend Integration

### Payment Button

```tsx
// components/payment/MonobankButton.tsx
import { useState } from 'react';

interface MonobankButtonProps {
  orderId: string;
  amount: number;
}

export function MonobankButton({ orderId, amount }: MonobankButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'monobank' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Редірект на сторінку оплати Monobank
      window.location.href = data.redirectUrl;
    } catch (error) {
      console.error('Payment error:', error);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="btn btn-primary gap-2"
    >
      <MonobankLogo className="w-5 h-5" />
      {loading ? 'Завантаження...' : `Оплатити ${(amount / 100).toFixed(2)} грн`}
    </button>
  );
}
```

### Saved Cards

```tsx
// components/payment/SavedCards.tsx
import { useQuery, useMutation } from '@tanstack/react-query';

interface SavedCardsProps {
  onSelect: (cardToken: string) => void;
}

export function SavedCards({ onSelect }: SavedCardsProps) {
  const { data: cards, isLoading, refetch } = useQuery({
    queryKey: ['saved-cards'],
    queryFn: () => fetch('/api/wallet/cards').then(res => res.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (token: string) =>
      fetch(`/api/wallet/cards/${token}`, { method: 'DELETE' }),
    onSuccess: () => refetch(),
  });

  if (isLoading) return <div className="skeleton h-20 w-full" />;
  if (!cards || cards.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium">Збережені картки</h3>
      {cards.map((card: any) => (
        <div
          key={card.token}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-base-200 cursor-pointer"
          onClick={() => onSelect(card.token)}
        >
          <div className="flex items-center gap-3">
            <CardIcon type={card.type} />
            <span>{card.maskedPan}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(card.token);
            }}
            className="btn btn-ghost btn-sm"
          >
            Видалити
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Статуси платежів

| Статус | Опис |
|--------|------|
| `created` | Інвойс створено |
| `processing` | Платіж обробляється |
| `hold` | Кошти захолджено |
| `success` | Успішна оплата |
| `failure` | Невдалий платіж |
| `reversed` | Повернення |
| `expired` | Час інвойсу вийшов |

---

## Split Payments (Розщеплення)

```go
// Для маркетплейсів - розділення платежу між продавцями
type SplitRule struct {
    DestinationToken string `json:"destinationToken"` // Токен отримувача
    Amount          int64  `json:"amount"`            // Сума в копійках
}

func (c *Client) CreateSplitInvoice(ctx context.Context, req *CreateInvoiceRequest, splits []SplitRule) (*CreateInvoiceResponse, error) {
    // Додаємо split rules до запиту
    // ...
}
```

---

## Тестування

### Тестові дані

В режимі тестування Monobank приймає будь-які дані картки:
- Номер: будь-який валідний номер картки
- Термін дії: будь-який майбутній
- CVV: будь-який 3-значний

### Unit Tests

```go
func TestCreateInvoice(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        assert.Equal(t, "POST", r.Method)
        assert.Equal(t, "/api/merchant/invoice/create", r.URL.Path)

        json.NewEncoder(w).Encode(monobank.CreateInvoiceResponse{
            InvoiceId: "inv_test123",
            PageUrl:   "https://pay.mbnk.biz/inv_test123",
        })
    }))
    defer server.Close()

    client := monobank.NewClientWithURL("test_token", server.URL)

    resp, err := client.CreateInvoice(context.Background(), &monobank.CreateInvoiceRequest{
        Amount: 10000,
        Ccy:    980,
    })

    require.NoError(t, err)
    assert.Equal(t, "inv_test123", resp.InvoiceId)
}
```

---

## Моніторинг

```go
var (
    invoicesTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "monobank_invoices_total",
            Help: "Total Monobank invoices",
        },
        []string{"status"},
    )

    invoiceAmount = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "monobank_invoice_amount",
            Help:    "Invoice amounts",
            Buckets: []float64{1000, 5000, 10000, 50000, 100000, 500000},
        },
        []string{"currency"},
    )

    apiLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "monobank_api_latency_seconds",
            Help:    "API request latency",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method"},
    )
)
```

---

## Помилки

| Код | Опис | Вирішення |
|-----|------|-----------|
| `INVALID_TOKEN` | Невірний токен | Перевірити токен |
| `INVALID_AMOUNT` | Невірна сума | Сума > 0 |
| `INVALID_CURRENCY` | Невірна валюта | Використовувати 980 (UAH) |
| `MERCHANT_NOT_FOUND` | Мерчант не знайдено | Перевірити реєстрацію |
| `INVOICE_NOT_FOUND` | Інвойс не знайдено | Перевірити ID |
| `INVOICE_EXPIRED` | Інвойс протермінований | Створити новий |
