# PrivatBank Integration

Інтеграція з PrivatBank для отримання курсів валют та корпоративних платежів.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRIVATBANK INTEGRATION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Use Cases                                      │   │
│  ├──────────────┬──────────────┬──────────────┬──────────────────────┐  │   │
│  │ Exchange     │ Account      │ P2P          │ Corporate            │  │   │
│  │ Rates        │ Statements   │ Transfers    │ Payments             │  │   │
│  └──────────────┴──────────────┴──────────────┴──────────────────────┘  │   │
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Shop         │────▶│ PrivatBank   │────▶│ PrivatBank   │                │
│  │ Services     │     │ Client       │     │ API          │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# PrivatBank API
PRIVATBANK_API_URL=https://api.privatbank.ua
PRIVATBANK_MERCHANT_ID=your_merchant_id
PRIVATBANK_MERCHANT_PASSWORD=your_password

# Corporate API (Privat24 for Business)
PRIVATBANK_CLIENT_ID=your_client_id
PRIVATBANK_CLIENT_SECRET=your_client_secret
PRIVATBANK_IBAN=UA123456789012345678901234567
```

### Go Configuration

```go
// config/privatbank.go
type PrivatBankConfig struct {
    APIURL           string `env:"PRIVATBANK_API_URL" envDefault:"https://api.privatbank.ua"`
    MerchantID       string `env:"PRIVATBANK_MERCHANT_ID"`
    MerchantPassword string `env:"PRIVATBANK_MERCHANT_PASSWORD"`
    ClientID         string `env:"PRIVATBANK_CLIENT_ID"`
    ClientSecret     string `env:"PRIVATBANK_CLIENT_SECRET"`
    IBAN             string `env:"PRIVATBANK_IBAN"`
    Timeout          time.Duration `env:"PRIVATBANK_TIMEOUT" envDefault:"30s"`
}
```

## Exchange Rates

### Public API (No Auth Required)

```go
// pkg/privatbank/rates.go
package privatbank

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type RatesClient struct {
    httpClient *http.Client
    baseURL    string
}

func NewRatesClient() *RatesClient {
    return &RatesClient{
        httpClient: &http.Client{Timeout: 10 * time.Second},
        baseURL:    "https://api.privatbank.ua/p24api",
    }
}

// ExchangeRate represents a currency rate
type ExchangeRate struct {
    Currency string  `json:"ccy"`
    BaseCcy  string  `json:"base_ccy"`
    Buy      float64 `json:"buy,string"`
    Sale     float64 `json:"sale,string"`
}

// GetCashRates returns cash exchange rates
func (c *RatesClient) GetCashRates(ctx context.Context) ([]ExchangeRate, error) {
    url := c.baseURL + "/pubinfo?json&exchange&coursid=5"

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("fetch rates: %w", err)
    }
    defer resp.Body.Close()

    var rates []ExchangeRate
    if err := json.NewDecoder(resp.Body).Decode(&rates); err != nil {
        return nil, fmt.Errorf("decode rates: %w", err)
    }

    return rates, nil
}

// GetCardRates returns card (non-cash) exchange rates
func (c *RatesClient) GetCardRates(ctx context.Context) ([]ExchangeRate, error) {
    url := c.baseURL + "/pubinfo?json&exchange&coursid=11"

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var rates []ExchangeRate
    json.NewDecoder(resp.Body).Decode(&rates)
    return rates, nil
}

// GetArchiveRates returns rates for a specific date
func (c *RatesClient) GetArchiveRates(ctx context.Context, date time.Time) ([]ExchangeRate, error) {
    dateStr := date.Format("02.01.2006")
    url := fmt.Sprintf("%s/exchange_rates?json&date=%s", c.baseURL, dateStr)

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        ExchangeRates []ExchangeRate `json:"exchangeRate"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.ExchangeRates, nil
}
```

### Rates Service

```go
// services/core/internal/currency/rates.go
type RatesService struct {
    client *privatbank.RatesClient
    cache  *redis.Client
}

func NewRatesService(cache *redis.Client) *RatesService {
    return &RatesService{
        client: privatbank.NewRatesClient(),
        cache:  cache,
    }
}

// GetUSDRate returns current USD rate
func (s *RatesService) GetUSDRate(ctx context.Context) (float64, error) {
    // Check cache first
    cached, err := s.cache.Get(ctx, "rates:usd").Float64()
    if err == nil {
        return cached, nil
    }

    // Fetch fresh rates
    rates, err := s.client.GetCardRates(ctx)
    if err != nil {
        return 0, err
    }

    for _, rate := range rates {
        if rate.Currency == "USD" {
            // Cache for 1 hour
            s.cache.Set(ctx, "rates:usd", rate.Sale, time.Hour)
            return rate.Sale, nil
        }
    }

    return 0, errors.New("USD rate not found")
}

// ConvertToUAH converts amount from currency to UAH
func (s *RatesService) ConvertToUAH(ctx context.Context, amount float64, currency string) (float64, error) {
    if currency == "UAH" {
        return amount, nil
    }

    rates, err := s.client.GetCardRates(ctx)
    if err != nil {
        return 0, err
    }

    for _, rate := range rates {
        if rate.Currency == currency {
            return amount * rate.Sale, nil
        }
    }

    return 0, fmt.Errorf("rate for %s not found", currency)
}
```

### Rates Scheduler

```go
// Background job to update rates
func (s *RatesService) StartRatesUpdater(ctx context.Context) {
    ticker := time.NewTicker(15 * time.Minute)

    go func() {
        for {
            select {
            case <-ctx.Done():
                ticker.Stop()
                return
            case <-ticker.C:
                s.updateRates(ctx)
            }
        }
    }()
}

func (s *RatesService) updateRates(ctx context.Context) {
    rates, err := s.client.GetCardRates(ctx)
    if err != nil {
        log.Error().Err(err).Msg("failed to update rates")
        return
    }

    // Store all rates
    for _, rate := range rates {
        key := fmt.Sprintf("rates:%s", strings.ToLower(rate.Currency))
        s.cache.Set(ctx, key+":buy", rate.Buy, 2*time.Hour)
        s.cache.Set(ctx, key+":sale", rate.Sale, 2*time.Hour)
    }

    // Publish event
    s.publisher.Publish(ctx, events.RatesUpdated{
        Rates:     rates,
        UpdatedAt: time.Now(),
    })
}
```

## Merchant API (Acquiring)

### Payment Widget Integration

```go
// pkg/privatbank/merchant.go
type MerchantClient struct {
    merchantID string
    password   string
    baseURL    string
}

func NewMerchantClient(cfg *PrivatBankConfig) *MerchantClient {
    return &MerchantClient{
        merchantID: cfg.MerchantID,
        password:   cfg.MerchantPassword,
        baseURL:    cfg.APIURL,
    }
}

// PaymentRequest for creating payment
type PaymentRequest struct {
    OrderID     string  `xml:"order_id"`
    Amount      float64 `xml:"amt"`
    Currency    string  `xml:"currency"`
    Description string  `xml:"descr"`
    ReturnURL   string  `xml:"return_url"`
    ServerURL   string  `xml:"server_url"` // Webhook URL
}

// CreatePayment initiates a payment
func (c *MerchantClient) CreatePayment(ctx context.Context, req *PaymentRequest) (string, error) {
    // Build XML request
    xmlData := c.buildXMLRequest(req)

    // Sign request
    signature := c.signRequest(xmlData)

    // Create form data for redirect
    paymentURL := fmt.Sprintf(
        "https://www.privat24.ua/pay/?merchid=%s&data=%s&signature=%s",
        c.merchantID,
        base64.StdEncoding.EncodeToString([]byte(xmlData)),
        signature,
    )

    return paymentURL, nil
}

func (c *MerchantClient) buildXMLRequest(req *PaymentRequest) string {
    return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<request version="1.0">
    <merchant>
        <id>%s</id>
        <signature></signature>
    </merchant>
    <data>
        <oper>pay</oper>
        <order_id>%s</order_id>
        <amt>%.2f</amt>
        <currency>%s</currency>
        <descr>%s</descr>
        <return_url>%s</return_url>
        <server_url>%s</server_url>
    </data>
</request>`,
        c.merchantID,
        req.OrderID,
        req.Amount,
        req.Currency,
        req.Description,
        req.ReturnURL,
        req.ServerURL,
    )
}

func (c *MerchantClient) signRequest(data string) string {
    h := md5.New()
    h.Write([]byte(data + c.password))
    hash := hex.EncodeToString(h.Sum(nil))

    h2 := sha1.New()
    h2.Write([]byte(hash + c.password))
    return base64.StdEncoding.EncodeToString(h2.Sum(nil))
}
```

### Payment Callback Handler

```go
// handlers/privatbank_callback.go
func (h *Handler) HandlePrivatBankCallback(w http.ResponseWriter, r *http.Request) {
    data := r.FormValue("data")
    signature := r.FormValue("signature")

    // Verify signature
    if !h.verifySignature(data, signature) {
        w.WriteHeader(http.StatusUnauthorized)
        return
    }

    // Decode response
    decoded, _ := base64.StdEncoding.DecodeString(data)

    var payment PaymentResponse
    if err := xml.Unmarshal(decoded, &payment); err != nil {
        w.WriteHeader(http.StatusBadRequest)
        return
    }

    // Process payment
    if payment.Status == "success" {
        h.orderService.MarkPaid(r.Context(), payment.OrderID, &PaymentInfo{
            Provider:      "privatbank",
            TransactionID: payment.TransactionID,
            Amount:        payment.Amount,
        })
    } else {
        h.orderService.MarkPaymentFailed(r.Context(), payment.OrderID, payment.ErrorMessage)
    }

    w.WriteHeader(http.StatusOK)
}
```

## Corporate API (Privat24 for Business)

### OAuth Authentication

```go
// pkg/privatbank/corporate.go
type CorporateClient struct {
    clientID     string
    clientSecret string
    accessToken  string
    tokenExpiry  time.Time
    baseURL      string
    httpClient   *http.Client
}

func NewCorporateClient(cfg *PrivatBankConfig) *CorporateClient {
    return &CorporateClient{
        clientID:     cfg.ClientID,
        clientSecret: cfg.ClientSecret,
        baseURL:      "https://acp.privatbank.ua/api",
        httpClient:   &http.Client{Timeout: 30 * time.Second},
    }
}

// Authenticate gets access token
func (c *CorporateClient) Authenticate(ctx context.Context) error {
    req, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/oauth/token", nil)
    req.SetBasicAuth(c.clientID, c.clientSecret)
    req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    var result struct {
        AccessToken string `json:"access_token"`
        ExpiresIn   int    `json:"expires_in"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    c.accessToken = result.AccessToken
    c.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn) * time.Second)

    return nil
}
```

### Account Statements

```go
// GetStatements retrieves account statements
func (c *CorporateClient) GetStatements(ctx context.Context, iban string, from, to time.Time) ([]Statement, error) {
    if err := c.ensureAuth(ctx); err != nil {
        return nil, err
    }

    url := fmt.Sprintf("%s/statements/%s?startDate=%s&endDate=%s",
        c.baseURL,
        iban,
        from.Format("2006-01-02"),
        to.Format("2006-01-02"),
    )

    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    req.Header.Set("Authorization", "Bearer "+c.accessToken)

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Statements []Statement `json:"statements"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Statements, nil
}

type Statement struct {
    ID              string    `json:"id"`
    Date            time.Time `json:"date"`
    Amount          float64   `json:"amount"`
    Currency        string    `json:"currency"`
    Description     string    `json:"description"`
    CounterpartyIBAN string   `json:"counterparty_iban"`
    CounterpartyName string   `json:"counterparty_name"`
    Reference       string    `json:"reference"`
}
```

### Balance Check

```go
// GetBalance returns account balance
func (c *CorporateClient) GetBalance(ctx context.Context, iban string) (*Balance, error) {
    if err := c.ensureAuth(ctx); err != nil {
        return nil, err
    }

    url := fmt.Sprintf("%s/accounts/%s/balance", c.baseURL, iban)

    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    req.Header.Set("Authorization", "Bearer "+c.accessToken)

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var balance Balance
    json.NewDecoder(resp.Body).Decode(&balance)
    return &balance, nil
}

type Balance struct {
    Available float64 `json:"available"`
    Current   float64 `json:"current"`
    Currency  string  `json:"currency"`
}
```

## Payment Reconciliation

### Statement Matcher

```go
// services/core/internal/reconciliation/matcher.go
type StatementMatcher struct {
    privatbank *privatbank.CorporateClient
    orderRepo  OrderRepository
    iban       string
}

// ReconcilePayments matches statements with orders
func (m *StatementMatcher) ReconcilePayments(ctx context.Context, date time.Time) error {
    // Get statements for the day
    statements, err := m.privatbank.GetStatements(ctx, m.iban, date, date)
    if err != nil {
        return err
    }

    for _, stmt := range statements {
        // Skip outgoing transactions
        if stmt.Amount < 0 {
            continue
        }

        // Try to match with order
        orderNumber := m.extractOrderNumber(stmt.Description)
        if orderNumber == "" {
            continue
        }

        // Find order
        order, err := m.orderRepo.FindByNumber(ctx, orderNumber)
        if err != nil {
            log.Warn().Str("order", orderNumber).Msg("order not found for statement")
            continue
        }

        // Verify amount
        if stmt.Amount != order.Total {
            log.Warn().
                Str("order", orderNumber).
                Float64("expected", order.Total).
                Float64("received", stmt.Amount).
                Msg("amount mismatch")
            continue
        }

        // Mark as paid
        m.orderRepo.MarkPaid(ctx, order.ID, &PaymentInfo{
            Provider:      "privatbank_statement",
            TransactionID: stmt.ID,
            Amount:        stmt.Amount,
            ReceivedAt:    stmt.Date,
        })
    }

    return nil
}

func (m *StatementMatcher) extractOrderNumber(description string) string {
    // Pattern: "Оплата замовлення UA-2024-001234"
    re := regexp.MustCompile(`UA-\d{4}-\d{6}`)
    match := re.FindString(description)
    return match
}
```

### Daily Reconciliation Job

```go
// Scheduled job for daily reconciliation
func (s *ReconciliationService) RunDailyReconciliation(ctx context.Context) error {
    yesterday := time.Now().AddDate(0, 0, -1)

    if err := s.matcher.ReconcilePayments(ctx, yesterday); err != nil {
        return fmt.Errorf("reconcile payments: %w", err)
    }

    // Generate report
    report := s.generateReport(ctx, yesterday)
    s.notifyAdmin(ctx, report)

    return nil
}
```

## Monitoring

### Metrics

```go
var (
    ratesFetched = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "privatbank_rates_fetched_total",
            Help: "Exchange rates fetch count",
        },
        []string{"status"},
    )

    paymentProcessed = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "privatbank_payments_total",
            Help: "Payments processed",
        },
        []string{"status"},
    )

    apiLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "privatbank_api_duration_seconds",
            Help:    "API call latency",
            Buckets: []float64{0.1, 0.5, 1, 2, 5},
        },
        []string{"endpoint"},
    )
)
```

### Alerts

```yaml
groups:
  - name: privatbank
    rules:
      - alert: RatesUpdateFailed
        expr: rate(privatbank_rates_fetched_total{status="error"}[1h]) > 0
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "PrivatBank rates update failing"

      - alert: PaymentReconciliationFailed
        expr: privatbank_reconciliation_errors_total > 0
        for: 1h
        labels:
          severity: warning
```

## See Also

- [Monobank Integration](./MONOBANK.md)
- [LiqPay Integration](./LIQPAY.md)
- [Currency Module](../modules/CURRENCY.md)
