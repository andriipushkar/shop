# ADR-009: Fiscal Integration Strategy

## Status

Accepted

## Date

2024-01-15

## Context

В Україні з 2021 року діє закон про обов'язкову фіскалізацію (ПРРО - Програмний Реєстратор Розрахункових Операцій) для інтернет-магазинів. Нам потрібно вибрати стратегію інтеграції з фіскальними сервісами для видачі чеків покупцям.

### Вимоги

1. **Законодавчі**:
   - Видача фіскального чека для кожної оплаченої транзакції
   - Синхронізація з ДПС в реальному часі
   - Зберігання чеків мінімум 3 роки
   - Підтримка повернень та корекцій

2. **Бізнес**:
   - Підтримка різних методів оплати
   - Мінімальна затримка при оформленні замовлення
   - Можливість роботи при тимчасовій недоступності сервісу
   - Підтримка multi-tenant архітектури

3. **Технічні**:
   - Висока доступність (99.9%+)
   - Масштабованість до 1000+ чеків/хв
   - Детальне логування для аудиту
   - Повторні спроби при помилках

### Опції

#### 1. Checkbox.ua

**Плюси:**
- Найпопулярніший ПРРО в Україні
- Добре документований REST API
- Webhook'и для статусів
- SDK для різних мов
- Підтримка 24/7

**Мінуси:**
- Платний сервіс (абонплата + за чек)
- Залежність від зовнішнього сервісу
- Rate limits на API

#### 2. vchasno.ua

**Плюси:**
- Конкурентні ціни
- Хороша документація

**Мінуси:**
- Менш розвинений API
- Менша екосистема

#### 3. Власний ПРРО

**Плюси:**
- Повний контроль
- Немає зовнішніх залежностей
- Без абонплати

**Мінуси:**
- Складна сертифікація (6+ місяців)
- Потребує КЕП (кваліфікований електронний підпис)
- Відповідальність за compliance
- Значні витрати на розробку

## Decision

Використовуємо **Checkbox.ua** як основний фіскальний провайдер з можливістю додавання інших провайдерів через абстракцію.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FISCAL INTEGRATION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Order        │────▶│ Fiscal       │────▶│ Checkbox     │                │
│  │ Service      │     │ Service      │     │ API          │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                              │                                               │
│                              ▼                                               │
│                       ┌──────────────┐                                      │
│                       │ Queue        │                                      │
│                       │ (RabbitMQ)   │                                      │
│                       └──────────────┘                                      │
│                              │                                               │
│                              ▼                                               │
│                       ┌──────────────┐     ┌──────────────┐                │
│                       │ Fiscal       │────▶│ PostgreSQL   │                │
│                       │ Worker       │     │ (Receipts)   │                │
│                       └──────────────┘     └──────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Provider Interface

```go
// pkg/fiscal/provider.go

type Provider interface {
    // CreateReceipt creates a fiscal receipt
    CreateReceipt(ctx context.Context, receipt *Receipt) (*ReceiptResult, error)

    // CreateRefund creates a refund receipt
    CreateRefund(ctx context.Context, refund *Refund) (*ReceiptResult, error)

    // GetReceipt retrieves receipt by ID
    GetReceipt(ctx context.Context, receiptID string) (*Receipt, error)

    // GetShiftStatus returns current shift status
    GetShiftStatus(ctx context.Context) (*ShiftStatus, error)

    // OpenShift opens a new fiscal shift
    OpenShift(ctx context.Context) error

    // CloseShift closes current shift with Z-report
    CloseShift(ctx context.Context) (*ZReport, error)
}

type Receipt struct {
    OrderID     string
    TenantID    string
    Items       []ReceiptItem
    Payments    []Payment
    Customer    *Customer
    Total       decimal.Decimal
}

type ReceiptItem struct {
    Name     string
    Quantity decimal.Decimal
    Price    decimal.Decimal
    Total    decimal.Decimal
    TaxCode  string // 20% ПДВ, 7%, без ПДВ
}

type ReceiptResult struct {
    ReceiptID    string
    FiscalNumber string
    FiscalDate   time.Time
    CheckURL     string
    QRCode       string
}
```

### Checkbox Implementation

```go
// pkg/fiscal/checkbox/provider.go

type CheckboxProvider struct {
    client    *http.Client
    baseURL   string
    licenseKey string
    cashierID string
}

func (p *CheckboxProvider) CreateReceipt(ctx context.Context, receipt *Receipt) (*ReceiptResult, error) {
    // Build Checkbox API request
    req := &checkboxReceipt{
        Goods: make([]checkboxGood, len(receipt.Items)),
        Payments: make([]checkboxPayment, len(receipt.Payments)),
    }

    for i, item := range receipt.Items {
        req.Goods[i] = checkboxGood{
            Code:     item.SKU,
            Name:     item.Name,
            Quantity: item.Quantity.InexactFloat64() * 1000, // в тисячних
            Price:    item.Price.Mul(decimal.NewFromInt(100)).IntPart(), // в копійках
        }
    }

    // Send to Checkbox
    resp, err := p.sendRequest(ctx, "POST", "/receipts/sell", req)
    if err != nil {
        return nil, fmt.Errorf("checkbox: %w", err)
    }

    return &ReceiptResult{
        ReceiptID:    resp.ID,
        FiscalNumber: resp.FiscalCode,
        FiscalDate:   resp.FiscalDate,
        CheckURL:     fmt.Sprintf("https://check.checkbox.ua/%s", resp.ID),
    }, nil
}
```

### Async Processing

```go
// services/core/internal/fiscal/worker.go

type FiscalWorker struct {
    provider fiscal.Provider
    repo     FiscalRepository
    queue    *rabbitmq.Consumer
}

func (w *FiscalWorker) ProcessReceipt(ctx context.Context, msg *FiscalMessage) error {
    span, ctx := tracing.StartSpan(ctx, "FiscalWorker.ProcessReceipt")
    defer span.End()

    // Build receipt
    receipt := w.buildReceipt(msg)

    // Try to create with retries
    var result *fiscal.ReceiptResult
    var err error

    for attempt := 1; attempt <= 3; attempt++ {
        result, err = w.provider.CreateReceipt(ctx, receipt)
        if err == nil {
            break
        }

        // Log and wait before retry
        log.Warn().Err(err).Int("attempt", attempt).Msg("fiscal receipt failed")
        time.Sleep(time.Duration(attempt) * 5 * time.Second)
    }

    if err != nil {
        // Save for manual retry
        return w.repo.SaveFailed(ctx, msg, err)
    }

    // Save successful receipt
    return w.repo.SaveReceipt(ctx, &FiscalReceipt{
        OrderID:      msg.OrderID,
        TenantID:     msg.TenantID,
        ReceiptID:    result.ReceiptID,
        FiscalNumber: result.FiscalNumber,
        CheckURL:     result.CheckURL,
        CreatedAt:    time.Now(),
    })
}
```

### Multi-tenant Configuration

```go
// Each tenant has their own Checkbox credentials
type TenantFiscalConfig struct {
    TenantID    string
    Provider    string // "checkbox", "vchasno", etc.
    LicenseKey  string
    CashierPin  string
    CashboxID   string
    IsEnabled   bool
}

func (s *FiscalService) GetProviderForTenant(ctx context.Context, tenantID string) (fiscal.Provider, error) {
    config, err := s.repo.GetTenantConfig(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    if !config.IsEnabled {
        return nil, ErrFiscalDisabled
    }

    switch config.Provider {
    case "checkbox":
        return checkbox.New(config.LicenseKey, config.CashierPin)
    case "vchasno":
        return vchasno.New(config.APIKey)
    default:
        return nil, fmt.Errorf("unknown provider: %s", config.Provider)
    }
}
```

### Database Schema

```sql
-- Fiscal receipts
CREATE TABLE fiscal_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(50) NOT NULL,
    receipt_type VARCHAR(20) NOT NULL, -- 'sale', 'refund', 'correction'

    -- Fiscal data
    receipt_id VARCHAR(255) NOT NULL,
    fiscal_number VARCHAR(100),
    fiscal_date TIMESTAMP,
    check_url VARCHAR(500),
    qr_code TEXT,

    -- Amount
    total DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2),

    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, order_id, receipt_type)
);

CREATE INDEX idx_fiscal_receipts_order ON fiscal_receipts(order_id);
CREATE INDEX idx_fiscal_receipts_status ON fiscal_receipts(status) WHERE status = 'failed';
```

### Error Handling

```go
// Fiscal-specific errors
var (
    ErrFiscalDisabled     = errors.New("fiscal receipts disabled for tenant")
    ErrShiftClosed        = errors.New("fiscal shift is closed")
    ErrProviderUnavailable = errors.New("fiscal provider unavailable")
    ErrInvalidReceipt     = errors.New("invalid receipt data")
)

// Retry policy
func (w *FiscalWorker) shouldRetry(err error) bool {
    // Don't retry validation errors
    if errors.Is(err, ErrInvalidReceipt) {
        return false
    }

    // Retry provider errors
    if errors.Is(err, ErrProviderUnavailable) {
        return true
    }

    // Retry HTTP 5xx errors
    var httpErr *HTTPError
    if errors.As(err, &httpErr) && httpErr.StatusCode >= 500 {
        return true
    }

    return false
}
```

## Consequences

### Positive

1. **Швидка інтеграція** - Checkbox має готовий SDK та документацію
2. **Compliance** - Checkbox бере на себе сертифікацію та оновлення
3. **Надійність** - Перевірене рішення з тисячами клієнтів
4. **Масштабованість** - Async обробка через чергу
5. **Гнучкість** - Можливість додати інших провайдерів

### Negative

1. **Зовнішня залежність** - Потрібен fallback при недоступності
2. **Вартість** - Абонплата + ціна за чек
3. **Rate limits** - Можуть бути обмеження при пікових навантаженнях

### Mitigations

1. **Queue-based processing** - Згладжує піки та дозволяє retry
2. **Local queue** - При недоступності провайдера чеки накопичуються
3. **Monitoring** - Алерти при помилках фіскалізації
4. **Admin panel** - Ручний retry для невдалих чеків

## Implementation Plan

1. **Phase 1**: Базова інтеграція з Checkbox
   - Provider interface
   - Checkbox implementation
   - Database schema
   - Manual receipt creation

2. **Phase 2**: Async processing
   - RabbitMQ integration
   - Worker implementation
   - Retry logic
   - Error handling

3. **Phase 3**: Multi-tenant
   - Per-tenant configuration
   - Admin UI for settings
   - Shift management

4. **Phase 4**: Monitoring & Compliance
   - Metrics & dashboards
   - Alerts
   - Audit logs
   - Z-report automation

## References

- [Checkbox API Documentation](https://docs.checkbox.ua/)
- [ПРРО вимоги ДПС](https://tax.gov.ua/prro/)
- [ADR-001: Microservices Architecture](./ADR-001-microservices.md)

## See Also

- [Fiscal Module](../modules/FISCAL.md)
- [Payment Integration](../integrations/LIQPAY.md)
- [Checkbox Integration](../integrations/CHECKBOX.md)
