# Billing & Metering

Система біллінгу та тарифікації для SaaS платформи з підтримкою subscription-based та usage-based моделей.

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      Billing System                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Metering   │  │ Subscription │  │   Invoice    │          │
│  │   Service    │  │   Manager    │  │   Generator  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                    Billing Core                              │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  │  Plans  │  │ Pricing │  │ Discounts│  │  Taxes  │        │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│  └─────────────────────────────────────────────────────────────┤
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Payment    │  │   Webhook    │  │   Dunning    │          │
│  │   Gateway    │  │   Handler    │  │   Manager    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Моделі даних

### Plan (Тарифний план)

```go
// internal/billing/models.go
package billing

import (
    "time"
    "github.com/shopspring/decimal"
)

type BillingInterval string

const (
    IntervalMonthly  BillingInterval = "monthly"
    IntervalYearly   BillingInterval = "yearly"
    IntervalOneTime  BillingInterval = "one_time"
)

type Plan struct {
    ID              string           `json:"id" gorm:"primaryKey"`
    TenantID        string           `json:"tenant_id" gorm:"index"`
    Name            string           `json:"name"`
    Description     string           `json:"description"`
    Interval        BillingInterval  `json:"interval"`
    IntervalCount   int              `json:"interval_count"` // e.g., 1 for monthly, 12 for yearly

    // Pricing
    BasePrice       decimal.Decimal  `json:"base_price"`
    Currency        string           `json:"currency"`

    // Limits
    Limits          PlanLimits       `json:"limits" gorm:"serializer:json"`

    // Features
    Features        []string         `json:"features" gorm:"serializer:json"`

    // Metadata
    IsActive        bool             `json:"is_active"`
    IsPublic        bool             `json:"is_public"`
    TrialDays       int              `json:"trial_days"`

    CreatedAt       time.Time        `json:"created_at"`
    UpdatedAt       time.Time        `json:"updated_at"`
}

type PlanLimits struct {
    MaxProducts     int   `json:"max_products"`
    MaxOrders       int   `json:"max_orders_per_month"`
    MaxUsers        int   `json:"max_users"`
    MaxStorage      int64 `json:"max_storage_bytes"`
    MaxAPIRequests  int   `json:"max_api_requests_per_day"`
    MaxIntegrations int   `json:"max_integrations"`
}

// Predefined plans
var (
    PlanStarter = Plan{
        ID:          "starter",
        Name:        "Starter",
        Interval:    IntervalMonthly,
        BasePrice:   decimal.NewFromInt(29),
        Currency:    "USD",
        TrialDays:   14,
        Limits: PlanLimits{
            MaxProducts:     100,
            MaxOrders:       500,
            MaxUsers:        2,
            MaxStorage:      1 * 1024 * 1024 * 1024, // 1GB
            MaxAPIRequests:  10000,
            MaxIntegrations: 2,
        },
        Features: []string{"basic_analytics", "email_support"},
    }

    PlanBusiness = Plan{
        ID:          "business",
        Name:        "Business",
        Interval:    IntervalMonthly,
        BasePrice:   decimal.NewFromInt(99),
        Currency:    "USD",
        TrialDays:   14,
        Limits: PlanLimits{
            MaxProducts:     5000,
            MaxOrders:       5000,
            MaxUsers:        10,
            MaxStorage:      10 * 1024 * 1024 * 1024, // 10GB
            MaxAPIRequests:  100000,
            MaxIntegrations: 10,
        },
        Features: []string{"advanced_analytics", "priority_support", "api_access", "custom_domain"},
    }

    PlanEnterprise = Plan{
        ID:          "enterprise",
        Name:        "Enterprise",
        Interval:    IntervalMonthly,
        BasePrice:   decimal.NewFromInt(299),
        Currency:    "USD",
        TrialDays:   30,
        Limits: PlanLimits{
            MaxProducts:     -1, // Unlimited
            MaxOrders:       -1,
            MaxUsers:        -1,
            MaxStorage:      100 * 1024 * 1024 * 1024, // 100GB
            MaxAPIRequests:  -1,
            MaxIntegrations: -1,
        },
        Features: []string{"advanced_analytics", "dedicated_support", "api_access", "custom_domain", "sso", "sla"},
    }
)
```

### Subscription (Підписка)

```go
type SubscriptionStatus string

const (
    SubscriptionActive    SubscriptionStatus = "active"
    SubscriptionTrialing  SubscriptionStatus = "trialing"
    SubscriptionPastDue   SubscriptionStatus = "past_due"
    SubscriptionCanceled  SubscriptionStatus = "canceled"
    SubscriptionUnpaid    SubscriptionStatus = "unpaid"
    SubscriptionPaused    SubscriptionStatus = "paused"
)

type Subscription struct {
    ID                   string             `json:"id" gorm:"primaryKey"`
    TenantID             string             `json:"tenant_id" gorm:"uniqueIndex"`
    PlanID               string             `json:"plan_id"`
    Plan                 *Plan              `json:"plan" gorm:"foreignKey:PlanID"`

    Status               SubscriptionStatus `json:"status"`

    // Billing cycle
    CurrentPeriodStart   time.Time          `json:"current_period_start"`
    CurrentPeriodEnd     time.Time          `json:"current_period_end"`

    // Trial
    TrialStart           *time.Time         `json:"trial_start"`
    TrialEnd             *time.Time         `json:"trial_end"`

    // Cancellation
    CancelAtPeriodEnd    bool               `json:"cancel_at_period_end"`
    CanceledAt           *time.Time         `json:"canceled_at"`
    CancellationReason   string             `json:"cancellation_reason"`

    // Payment
    PaymentMethodID      string             `json:"payment_method_id"`

    // Discounts
    DiscountID           *string            `json:"discount_id"`
    Discount             *Discount          `json:"discount" gorm:"foreignKey:DiscountID"`

    // Metadata
    Metadata             map[string]string  `json:"metadata" gorm:"serializer:json"`

    CreatedAt            time.Time          `json:"created_at"`
    UpdatedAt            time.Time          `json:"updated_at"`
}

type SubscriptionItem struct {
    ID             string          `json:"id" gorm:"primaryKey"`
    SubscriptionID string          `json:"subscription_id" gorm:"index"`
    PriceID        string          `json:"price_id"`
    Quantity       int             `json:"quantity"`

    // Usage-based
    UsageType      string          `json:"usage_type"` // licensed, metered

    CreatedAt      time.Time       `json:"created_at"`
    UpdatedAt      time.Time       `json:"updated_at"`
}
```

### Invoice (Рахунок)

```go
type InvoiceStatus string

const (
    InvoiceDraft     InvoiceStatus = "draft"
    InvoiceOpen      InvoiceStatus = "open"
    InvoicePaid      InvoiceStatus = "paid"
    InvoiceVoid      InvoiceStatus = "void"
    InvoiceUncollectible InvoiceStatus = "uncollectible"
)

type Invoice struct {
    ID                string          `json:"id" gorm:"primaryKey"`
    Number            string          `json:"number" gorm:"uniqueIndex"`
    TenantID          string          `json:"tenant_id" gorm:"index"`
    SubscriptionID    *string         `json:"subscription_id"`

    Status            InvoiceStatus   `json:"status"`

    // Amounts
    Currency          string          `json:"currency"`
    Subtotal          decimal.Decimal `json:"subtotal"`
    Tax               decimal.Decimal `json:"tax"`
    TaxRate           decimal.Decimal `json:"tax_rate"`
    Discount          decimal.Decimal `json:"discount"`
    Total             decimal.Decimal `json:"total"`
    AmountPaid        decimal.Decimal `json:"amount_paid"`
    AmountDue         decimal.Decimal `json:"amount_due"`

    // Dates
    InvoiceDate       time.Time       `json:"invoice_date"`
    DueDate           time.Time       `json:"due_date"`
    PaidAt            *time.Time      `json:"paid_at"`

    // Period
    PeriodStart       time.Time       `json:"period_start"`
    PeriodEnd         time.Time       `json:"period_end"`

    // Line items
    LineItems         []InvoiceLineItem `json:"line_items" gorm:"foreignKey:InvoiceID"`

    // Payment
    PaymentIntentID   string          `json:"payment_intent_id"`

    // PDF
    PDFURL            string          `json:"pdf_url"`

    // Billing info
    BillingAddress    Address         `json:"billing_address" gorm:"serializer:json"`

    CreatedAt         time.Time       `json:"created_at"`
    UpdatedAt         time.Time       `json:"updated_at"`
}

type InvoiceLineItem struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    InvoiceID   string          `json:"invoice_id" gorm:"index"`
    Description string          `json:"description"`
    Quantity    int             `json:"quantity"`
    UnitPrice   decimal.Decimal `json:"unit_price"`
    Amount      decimal.Decimal `json:"amount"`

    // Period (for prorated items)
    PeriodStart *time.Time      `json:"period_start"`
    PeriodEnd   *time.Time      `json:"period_end"`

    // Type
    Type        string          `json:"type"` // subscription, usage, one_time, tax, discount

    // Metadata
    Metadata    map[string]string `json:"metadata" gorm:"serializer:json"`
}
```

## Metering Service

### Usage Tracking

```go
// internal/billing/metering.go
package billing

import (
    "context"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
    "github.com/shopspring/decimal"
)

type MeterType string

const (
    MeterCount     MeterType = "count"      // Total count
    MeterSum       MeterType = "sum"        // Sum of values
    MeterMax       MeterType = "max"        // Maximum value
    MeterUniqueSet MeterType = "unique_set" // Count unique values
)

type Meter struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    Name        string    `json:"name"`
    EventName   string    `json:"event_name"`
    Type        MeterType `json:"type"`
    Property    string    `json:"property"` // Property to aggregate (for sum/max)

    // Reset
    ResetInterval string  `json:"reset_interval"` // monthly, daily, never

    CreatedAt   time.Time `json:"created_at"`
}

type UsageEvent struct {
    ID          string            `json:"id"`
    TenantID    string            `json:"tenant_id"`
    EventName   string            `json:"event_name"`
    Timestamp   time.Time         `json:"timestamp"`
    Properties  map[string]any    `json:"properties"`
}

type MeteringService struct {
    redis  *redis.Client
    meters map[string]*Meter
}

func NewMeteringService(redis *redis.Client) *MeteringService {
    return &MeteringService{
        redis:  redis,
        meters: make(map[string]*Meter),
    }
}

// RecordUsage records a usage event
func (s *MeteringService) RecordUsage(ctx context.Context, event *UsageEvent) error {
    meter, ok := s.meters[event.EventName]
    if !ok {
        return nil // No meter configured for this event
    }

    key := s.getMeterKey(event.TenantID, meter, event.Timestamp)

    switch meter.Type {
    case MeterCount:
        return s.redis.Incr(ctx, key).Err()

    case MeterSum:
        value, ok := event.Properties[meter.Property].(float64)
        if !ok {
            return fmt.Errorf("property %s not found or not a number", meter.Property)
        }
        return s.redis.IncrByFloat(ctx, key, value).Err()

    case MeterMax:
        value, ok := event.Properties[meter.Property].(float64)
        if !ok {
            return fmt.Errorf("property %s not found or not a number", meter.Property)
        }
        script := `
            local current = redis.call('GET', KEYS[1])
            if not current or tonumber(ARGV[1]) > tonumber(current) then
                redis.call('SET', KEYS[1], ARGV[1])
            end
            return redis.call('GET', KEYS[1])
        `
        return s.redis.Eval(ctx, script, []string{key}, value).Err()

    case MeterUniqueSet:
        value, ok := event.Properties[meter.Property].(string)
        if !ok {
            return fmt.Errorf("property %s not found or not a string", meter.Property)
        }
        return s.redis.SAdd(ctx, key, value).Err()
    }

    return nil
}

// GetUsage retrieves current usage for a meter
func (s *MeteringService) GetUsage(ctx context.Context, tenantID string, meterID string, periodStart time.Time) (decimal.Decimal, error) {
    meter, ok := s.meters[meterID]
    if !ok {
        return decimal.Zero, fmt.Errorf("meter not found: %s", meterID)
    }

    key := s.getMeterKey(tenantID, meter, periodStart)

    switch meter.Type {
    case MeterCount, MeterSum, MeterMax:
        val, err := s.redis.Get(ctx, key).Float64()
        if err == redis.Nil {
            return decimal.Zero, nil
        }
        if err != nil {
            return decimal.Zero, err
        }
        return decimal.NewFromFloat(val), nil

    case MeterUniqueSet:
        count, err := s.redis.SCard(ctx, key).Result()
        if err != nil {
            return decimal.Zero, err
        }
        return decimal.NewFromInt(count), nil
    }

    return decimal.Zero, nil
}

// GetUsageHistory retrieves usage history for a meter
func (s *MeteringService) GetUsageHistory(ctx context.Context, tenantID string, meterID string, periods int) ([]UsageRecord, error) {
    meter, ok := s.meters[meterID]
    if !ok {
        return nil, fmt.Errorf("meter not found: %s", meterID)
    }

    records := make([]UsageRecord, 0, periods)
    now := time.Now()

    for i := 0; i < periods; i++ {
        periodStart := s.getPeriodStart(now, meter.ResetInterval, i)
        usage, err := s.GetUsage(ctx, tenantID, meterID, periodStart)
        if err != nil {
            continue
        }

        records = append(records, UsageRecord{
            PeriodStart: periodStart,
            PeriodEnd:   s.getPeriodEnd(periodStart, meter.ResetInterval),
            Usage:       usage,
        })
    }

    return records, nil
}

func (s *MeteringService) getMeterKey(tenantID string, meter *Meter, timestamp time.Time) string {
    period := s.getPeriodKey(timestamp, meter.ResetInterval)
    return fmt.Sprintf("meter:%s:%s:%s", tenantID, meter.ID, period)
}

func (s *MeteringService) getPeriodKey(t time.Time, interval string) string {
    switch interval {
    case "daily":
        return t.Format("2006-01-02")
    case "monthly":
        return t.Format("2006-01")
    default:
        return "all"
    }
}

func (s *MeteringService) getPeriodStart(t time.Time, interval string, offset int) time.Time {
    switch interval {
    case "daily":
        return time.Date(t.Year(), t.Month(), t.Day()-offset, 0, 0, 0, 0, t.Location())
    case "monthly":
        return time.Date(t.Year(), t.Month()-time.Month(offset), 1, 0, 0, 0, 0, t.Location())
    default:
        return time.Time{}
    }
}

func (s *MeteringService) getPeriodEnd(start time.Time, interval string) time.Time {
    switch interval {
    case "daily":
        return start.AddDate(0, 0, 1).Add(-time.Second)
    case "monthly":
        return start.AddDate(0, 1, 0).Add(-time.Second)
    default:
        return time.Time{}
    }
}

type UsageRecord struct {
    PeriodStart time.Time       `json:"period_start"`
    PeriodEnd   time.Time       `json:"period_end"`
    Usage       decimal.Decimal `json:"usage"`
}
```

### Limit Enforcement

```go
// internal/billing/limits.go
package billing

import (
    "context"
    "fmt"
)

type LimitChecker struct {
    metering *MeteringService
    repo     SubscriptionRepository
}

func NewLimitChecker(metering *MeteringService, repo SubscriptionRepository) *LimitChecker {
    return &LimitChecker{
        metering: metering,
        repo:     repo,
    }
}

type LimitType string

const (
    LimitProducts     LimitType = "products"
    LimitOrders       LimitType = "orders"
    LimitUsers        LimitType = "users"
    LimitStorage      LimitType = "storage"
    LimitAPIRequests  LimitType = "api_requests"
    LimitIntegrations LimitType = "integrations"
)

type LimitCheckResult struct {
    Allowed      bool   `json:"allowed"`
    CurrentUsage int64  `json:"current_usage"`
    Limit        int64  `json:"limit"`
    Message      string `json:"message,omitempty"`
}

// CheckLimit checks if tenant is within their plan limits
func (c *LimitChecker) CheckLimit(ctx context.Context, tenantID string, limitType LimitType, requestedUsage int64) (*LimitCheckResult, error) {
    subscription, err := c.repo.GetByTenantID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    if subscription == nil || subscription.Status != SubscriptionActive {
        return &LimitCheckResult{
            Allowed: false,
            Message: "No active subscription",
        }, nil
    }

    limit := c.getPlanLimit(subscription.Plan, limitType)
    if limit == -1 {
        // Unlimited
        return &LimitCheckResult{
            Allowed: true,
            Limit:   -1,
        }, nil
    }

    currentUsage, err := c.getCurrentUsage(ctx, tenantID, limitType)
    if err != nil {
        return nil, err
    }

    allowed := currentUsage+requestedUsage <= int64(limit)

    result := &LimitCheckResult{
        Allowed:      allowed,
        CurrentUsage: currentUsage,
        Limit:        int64(limit),
    }

    if !allowed {
        result.Message = fmt.Sprintf(
            "Limit exceeded: %s (%d/%d). Please upgrade your plan.",
            limitType, currentUsage+requestedUsage, limit,
        )
    }

    return result, nil
}

func (c *LimitChecker) getPlanLimit(plan *Plan, limitType LimitType) int {
    switch limitType {
    case LimitProducts:
        return plan.Limits.MaxProducts
    case LimitOrders:
        return plan.Limits.MaxOrders
    case LimitUsers:
        return plan.Limits.MaxUsers
    case LimitStorage:
        return int(plan.Limits.MaxStorage)
    case LimitAPIRequests:
        return plan.Limits.MaxAPIRequests
    case LimitIntegrations:
        return plan.Limits.MaxIntegrations
    default:
        return 0
    }
}

func (c *LimitChecker) getCurrentUsage(ctx context.Context, tenantID string, limitType LimitType) (int64, error) {
    meterID := fmt.Sprintf("meter_%s", limitType)
    usage, err := c.metering.GetUsage(ctx, tenantID, meterID, time.Now())
    if err != nil {
        return 0, err
    }
    return usage.IntPart(), nil
}
```

## Subscription Service

```go
// internal/billing/subscription.go
package billing

import (
    "context"
    "fmt"
    "time"
)

type SubscriptionService struct {
    repo     SubscriptionRepository
    planRepo PlanRepository
    invoices *InvoiceService
    events   EventPublisher
}

func NewSubscriptionService(
    repo SubscriptionRepository,
    planRepo PlanRepository,
    invoices *InvoiceService,
    events EventPublisher,
) *SubscriptionService {
    return &SubscriptionService{
        repo:     repo,
        planRepo: planRepo,
        invoices: invoices,
        events:   events,
    }
}

type CreateSubscriptionRequest struct {
    TenantID        string
    PlanID          string
    PaymentMethodID string
    DiscountCode    string
    Metadata        map[string]string
}

// Create creates a new subscription
func (s *SubscriptionService) Create(ctx context.Context, req *CreateSubscriptionRequest) (*Subscription, error) {
    // Check if tenant already has a subscription
    existing, _ := s.repo.GetByTenantID(ctx, req.TenantID)
    if existing != nil && existing.Status == SubscriptionActive {
        return nil, fmt.Errorf("tenant already has an active subscription")
    }

    // Get plan
    plan, err := s.planRepo.GetByID(ctx, req.PlanID)
    if err != nil {
        return nil, fmt.Errorf("plan not found: %w", err)
    }

    now := time.Now()

    subscription := &Subscription{
        ID:                 generateID("sub"),
        TenantID:           req.TenantID,
        PlanID:             req.PlanID,
        Plan:               plan,
        PaymentMethodID:    req.PaymentMethodID,
        Metadata:           req.Metadata,
        CreatedAt:          now,
        UpdatedAt:          now,
    }

    // Set up trial if applicable
    if plan.TrialDays > 0 {
        subscription.Status = SubscriptionTrialing
        subscription.TrialStart = &now
        trialEnd := now.AddDate(0, 0, plan.TrialDays)
        subscription.TrialEnd = &trialEnd
        subscription.CurrentPeriodStart = now
        subscription.CurrentPeriodEnd = trialEnd
    } else {
        subscription.Status = SubscriptionActive
        subscription.CurrentPeriodStart = now
        subscription.CurrentPeriodEnd = s.calculatePeriodEnd(now, plan.Interval, plan.IntervalCount)

        // Create first invoice
        _, err = s.invoices.CreateForSubscription(ctx, subscription)
        if err != nil {
            return nil, fmt.Errorf("failed to create invoice: %w", err)
        }
    }

    // Apply discount if provided
    if req.DiscountCode != "" {
        discount, err := s.applyDiscount(ctx, subscription, req.DiscountCode)
        if err != nil {
            return nil, fmt.Errorf("failed to apply discount: %w", err)
        }
        subscription.DiscountID = &discount.ID
    }

    if err := s.repo.Create(ctx, subscription); err != nil {
        return nil, err
    }

    // Publish event
    s.events.Publish(ctx, "subscription.created", map[string]any{
        "subscription_id": subscription.ID,
        "tenant_id":       subscription.TenantID,
        "plan_id":         subscription.PlanID,
        "status":          subscription.Status,
    })

    return subscription, nil
}

// ChangePlan changes the subscription plan (upgrade/downgrade)
func (s *SubscriptionService) ChangePlan(ctx context.Context, tenantID string, newPlanID string, immediate bool) (*Subscription, error) {
    subscription, err := s.repo.GetByTenantID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    if subscription.Status != SubscriptionActive && subscription.Status != SubscriptionTrialing {
        return nil, fmt.Errorf("cannot change plan for subscription with status: %s", subscription.Status)
    }

    newPlan, err := s.planRepo.GetByID(ctx, newPlanID)
    if err != nil {
        return nil, fmt.Errorf("plan not found: %w", err)
    }

    oldPlan := subscription.Plan

    if immediate {
        // Prorate and apply immediately
        proration, err := s.calculateProration(subscription, newPlan)
        if err != nil {
            return nil, err
        }

        // Create prorated invoice
        if !proration.Amount.IsZero() {
            _, err = s.invoices.CreateProration(ctx, subscription, proration)
            if err != nil {
                return nil, fmt.Errorf("failed to create proration invoice: %w", err)
            }
        }

        subscription.PlanID = newPlanID
        subscription.Plan = newPlan
    } else {
        // Schedule change at period end
        subscription.Metadata["scheduled_plan_change"] = newPlanID
    }

    subscription.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, subscription); err != nil {
        return nil, err
    }

    // Publish event
    eventType := "subscription.upgraded"
    if newPlan.BasePrice.LessThan(oldPlan.BasePrice) {
        eventType = "subscription.downgraded"
    }

    s.events.Publish(ctx, eventType, map[string]any{
        "subscription_id": subscription.ID,
        "tenant_id":       subscription.TenantID,
        "old_plan_id":     oldPlan.ID,
        "new_plan_id":     newPlanID,
        "immediate":       immediate,
    })

    return subscription, nil
}

// Cancel cancels a subscription
func (s *SubscriptionService) Cancel(ctx context.Context, tenantID string, immediate bool, reason string) (*Subscription, error) {
    subscription, err := s.repo.GetByTenantID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    now := time.Now()
    subscription.CancellationReason = reason
    subscription.CanceledAt = &now
    subscription.UpdatedAt = now

    if immediate {
        subscription.Status = SubscriptionCanceled
    } else {
        subscription.CancelAtPeriodEnd = true
    }

    if err := s.repo.Update(ctx, subscription); err != nil {
        return nil, err
    }

    // Publish event
    s.events.Publish(ctx, "subscription.canceled", map[string]any{
        "subscription_id": subscription.ID,
        "tenant_id":       subscription.TenantID,
        "immediate":       immediate,
        "reason":          reason,
    })

    return subscription, nil
}

// Pause pauses a subscription
func (s *SubscriptionService) Pause(ctx context.Context, tenantID string, resumeAt *time.Time) (*Subscription, error) {
    subscription, err := s.repo.GetByTenantID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    if subscription.Status != SubscriptionActive {
        return nil, fmt.Errorf("can only pause active subscriptions")
    }

    subscription.Status = SubscriptionPaused
    subscription.Metadata["paused_at"] = time.Now().Format(time.RFC3339)
    if resumeAt != nil {
        subscription.Metadata["resume_at"] = resumeAt.Format(time.RFC3339)
    }
    subscription.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, subscription); err != nil {
        return nil, err
    }

    return subscription, nil
}

// Resume resumes a paused subscription
func (s *SubscriptionService) Resume(ctx context.Context, tenantID string) (*Subscription, error) {
    subscription, err := s.repo.GetByTenantID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    if subscription.Status != SubscriptionPaused {
        return nil, fmt.Errorf("can only resume paused subscriptions")
    }

    subscription.Status = SubscriptionActive
    delete(subscription.Metadata, "paused_at")
    delete(subscription.Metadata, "resume_at")
    subscription.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, subscription); err != nil {
        return nil, err
    }

    return subscription, nil
}

// RenewSubscription handles subscription renewal at period end
func (s *SubscriptionService) RenewSubscription(ctx context.Context, subscription *Subscription) error {
    if subscription.CancelAtPeriodEnd {
        subscription.Status = SubscriptionCanceled
        subscription.UpdatedAt = time.Now()
        return s.repo.Update(ctx, subscription)
    }

    // Check for scheduled plan change
    if newPlanID, ok := subscription.Metadata["scheduled_plan_change"]; ok {
        newPlan, err := s.planRepo.GetByID(ctx, newPlanID)
        if err == nil {
            subscription.PlanID = newPlanID
            subscription.Plan = newPlan
        }
        delete(subscription.Metadata, "scheduled_plan_change")
    }

    // Update period
    subscription.CurrentPeriodStart = subscription.CurrentPeriodEnd
    subscription.CurrentPeriodEnd = s.calculatePeriodEnd(
        subscription.CurrentPeriodStart,
        subscription.Plan.Interval,
        subscription.Plan.IntervalCount,
    )
    subscription.UpdatedAt = time.Now()

    // Create invoice for new period
    invoice, err := s.invoices.CreateForSubscription(ctx, subscription)
    if err != nil {
        return fmt.Errorf("failed to create invoice: %w", err)
    }

    // Attempt payment
    if err := s.invoices.ProcessPayment(ctx, invoice); err != nil {
        subscription.Status = SubscriptionPastDue
    }

    return s.repo.Update(ctx, subscription)
}

func (s *SubscriptionService) calculatePeriodEnd(start time.Time, interval BillingInterval, count int) time.Time {
    switch interval {
    case IntervalMonthly:
        return start.AddDate(0, count, 0)
    case IntervalYearly:
        return start.AddDate(count, 0, 0)
    default:
        return start
    }
}

type Proration struct {
    CreditAmount decimal.Decimal
    ChargeAmount decimal.Decimal
    Amount       decimal.Decimal // Net amount (charge - credit)
    Description  string
}

func (s *SubscriptionService) calculateProration(subscription *Subscription, newPlan *Plan) (*Proration, error) {
    now := time.Now()
    periodStart := subscription.CurrentPeriodStart
    periodEnd := subscription.CurrentPeriodEnd

    totalDays := periodEnd.Sub(periodStart).Hours() / 24
    remainingDays := periodEnd.Sub(now).Hours() / 24

    if remainingDays <= 0 {
        return &Proration{}, nil
    }

    // Credit for unused time on old plan
    dailyRateOld := subscription.Plan.BasePrice.Div(decimal.NewFromFloat(totalDays))
    creditAmount := dailyRateOld.Mul(decimal.NewFromFloat(remainingDays))

    // Charge for remaining time on new plan
    dailyRateNew := newPlan.BasePrice.Div(decimal.NewFromFloat(totalDays))
    chargeAmount := dailyRateNew.Mul(decimal.NewFromFloat(remainingDays))

    return &Proration{
        CreditAmount: creditAmount,
        ChargeAmount: chargeAmount,
        Amount:       chargeAmount.Sub(creditAmount),
        Description:  fmt.Sprintf("Proration from %s to %s", subscription.Plan.Name, newPlan.Name),
    }, nil
}

func (s *SubscriptionService) applyDiscount(ctx context.Context, subscription *Subscription, code string) (*Discount, error) {
    // Implementation would look up and validate discount code
    return nil, nil
}
```

## Invoice Service

```go
// internal/billing/invoice.go
package billing

import (
    "bytes"
    "context"
    "fmt"
    "text/template"
    "time"
)

type InvoiceService struct {
    repo       InvoiceRepository
    payment    PaymentGateway
    storage    StorageService
    pdf        PDFGenerator
    events     EventPublisher
}

func NewInvoiceService(
    repo InvoiceRepository,
    payment PaymentGateway,
    storage StorageService,
    pdf PDFGenerator,
    events EventPublisher,
) *InvoiceService {
    return &InvoiceService{
        repo:    repo,
        payment: payment,
        storage: storage,
        pdf:     pdf,
        events:  events,
    }
}

// CreateForSubscription creates an invoice for a subscription period
func (s *InvoiceService) CreateForSubscription(ctx context.Context, subscription *Subscription) (*Invoice, error) {
    now := time.Now()

    invoice := &Invoice{
        ID:             generateID("inv"),
        Number:         s.generateInvoiceNumber(now),
        TenantID:       subscription.TenantID,
        SubscriptionID: &subscription.ID,
        Status:         InvoiceOpen,
        Currency:       subscription.Plan.Currency,
        InvoiceDate:    now,
        DueDate:        now.AddDate(0, 0, 14), // 14 days to pay
        PeriodStart:    subscription.CurrentPeriodStart,
        PeriodEnd:      subscription.CurrentPeriodEnd,
        CreatedAt:      now,
        UpdatedAt:      now,
    }

    // Add line items
    invoice.LineItems = []InvoiceLineItem{
        {
            ID:          generateID("ili"),
            InvoiceID:   invoice.ID,
            Description: fmt.Sprintf("%s Plan - %s to %s",
                subscription.Plan.Name,
                subscription.CurrentPeriodStart.Format("Jan 2, 2006"),
                subscription.CurrentPeriodEnd.Format("Jan 2, 2006"),
            ),
            Quantity:    1,
            UnitPrice:   subscription.Plan.BasePrice,
            Amount:      subscription.Plan.BasePrice,
            PeriodStart: &subscription.CurrentPeriodStart,
            PeriodEnd:   &subscription.CurrentPeriodEnd,
            Type:        "subscription",
        },
    }

    // Calculate totals
    invoice.Subtotal = subscription.Plan.BasePrice

    // Apply discount if applicable
    if subscription.Discount != nil {
        discountAmount := s.calculateDiscount(invoice.Subtotal, subscription.Discount)
        invoice.Discount = discountAmount
        invoice.LineItems = append(invoice.LineItems, InvoiceLineItem{
            ID:          generateID("ili"),
            InvoiceID:   invoice.ID,
            Description: fmt.Sprintf("Discount: %s", subscription.Discount.Name),
            Quantity:    1,
            UnitPrice:   discountAmount.Neg(),
            Amount:      discountAmount.Neg(),
            Type:        "discount",
        })
    }

    // Calculate tax (simplified)
    invoice.TaxRate = decimal.NewFromFloat(0.20) // 20% VAT
    taxableAmount := invoice.Subtotal.Sub(invoice.Discount)
    invoice.Tax = taxableAmount.Mul(invoice.TaxRate)

    invoice.LineItems = append(invoice.LineItems, InvoiceLineItem{
        ID:          generateID("ili"),
        InvoiceID:   invoice.ID,
        Description: fmt.Sprintf("VAT (%s%%)", invoice.TaxRate.Mul(decimal.NewFromInt(100)).String()),
        Quantity:    1,
        UnitPrice:   invoice.Tax,
        Amount:      invoice.Tax,
        Type:        "tax",
    })

    // Calculate total
    invoice.Total = invoice.Subtotal.Sub(invoice.Discount).Add(invoice.Tax)
    invoice.AmountDue = invoice.Total

    if err := s.repo.Create(ctx, invoice); err != nil {
        return nil, err
    }

    // Generate PDF
    go s.generateAndStorePDF(context.Background(), invoice)

    // Publish event
    s.events.Publish(ctx, "invoice.created", map[string]any{
        "invoice_id": invoice.ID,
        "tenant_id":  invoice.TenantID,
        "total":      invoice.Total.String(),
    })

    return invoice, nil
}

// ProcessPayment attempts to process payment for an invoice
func (s *InvoiceService) ProcessPayment(ctx context.Context, invoice *Invoice) error {
    if invoice.Status != InvoiceOpen {
        return fmt.Errorf("cannot process payment for invoice with status: %s", invoice.Status)
    }

    // Get payment method from subscription
    subscription, err := s.getSubscription(ctx, invoice)
    if err != nil {
        return err
    }

    // Charge payment method
    paymentIntent, err := s.payment.Charge(ctx, &ChargeRequest{
        Amount:          invoice.AmountDue,
        Currency:        invoice.Currency,
        PaymentMethodID: subscription.PaymentMethodID,
        Description:     fmt.Sprintf("Invoice %s", invoice.Number),
        Metadata: map[string]string{
            "invoice_id": invoice.ID,
            "tenant_id":  invoice.TenantID,
        },
    })

    if err != nil {
        // Payment failed
        s.events.Publish(ctx, "invoice.payment_failed", map[string]any{
            "invoice_id": invoice.ID,
            "tenant_id":  invoice.TenantID,
            "error":      err.Error(),
        })
        return err
    }

    // Update invoice
    now := time.Now()
    invoice.Status = InvoicePaid
    invoice.PaidAt = &now
    invoice.AmountPaid = invoice.AmountDue
    invoice.AmountDue = decimal.Zero
    invoice.PaymentIntentID = paymentIntent.ID
    invoice.UpdatedAt = now

    if err := s.repo.Update(ctx, invoice); err != nil {
        return err
    }

    // Publish event
    s.events.Publish(ctx, "invoice.paid", map[string]any{
        "invoice_id":        invoice.ID,
        "tenant_id":         invoice.TenantID,
        "total":             invoice.Total.String(),
        "payment_intent_id": paymentIntent.ID,
    })

    return nil
}

// Void voids an invoice
func (s *InvoiceService) Void(ctx context.Context, invoiceID string, reason string) (*Invoice, error) {
    invoice, err := s.repo.GetByID(ctx, invoiceID)
    if err != nil {
        return nil, err
    }

    if invoice.Status != InvoiceOpen && invoice.Status != InvoiceDraft {
        return nil, fmt.Errorf("cannot void invoice with status: %s", invoice.Status)
    }

    invoice.Status = InvoiceVoid
    invoice.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, invoice); err != nil {
        return nil, err
    }

    return invoice, nil
}

// AddUsageCharges adds usage-based charges to an invoice
func (s *InvoiceService) AddUsageCharges(ctx context.Context, invoice *Invoice, charges []UsageCharge) error {
    for _, charge := range charges {
        lineItem := InvoiceLineItem{
            ID:          generateID("ili"),
            InvoiceID:   invoice.ID,
            Description: charge.Description,
            Quantity:    int(charge.Quantity),
            UnitPrice:   charge.UnitPrice,
            Amount:      charge.UnitPrice.Mul(decimal.NewFromInt(int64(charge.Quantity))),
            Type:        "usage",
            Metadata: map[string]string{
                "meter_id": charge.MeterID,
            },
        }

        invoice.LineItems = append(invoice.LineItems, lineItem)
        invoice.Subtotal = invoice.Subtotal.Add(lineItem.Amount)
    }

    // Recalculate totals
    s.recalculateTotals(invoice)

    return s.repo.Update(ctx, invoice)
}

func (s *InvoiceService) generateInvoiceNumber(t time.Time) string {
    return fmt.Sprintf("INV-%s-%04d", t.Format("200601"), generateSequence())
}

func (s *InvoiceService) calculateDiscount(amount decimal.Decimal, discount *Discount) decimal.Decimal {
    if discount.Type == DiscountPercentage {
        return amount.Mul(discount.Value.Div(decimal.NewFromInt(100)))
    }
    return discount.Value
}

func (s *InvoiceService) recalculateTotals(invoice *Invoice) {
    taxableAmount := invoice.Subtotal.Sub(invoice.Discount)
    invoice.Tax = taxableAmount.Mul(invoice.TaxRate)
    invoice.Total = taxableAmount.Add(invoice.Tax)
    invoice.AmountDue = invoice.Total.Sub(invoice.AmountPaid)
}

func (s *InvoiceService) generateAndStorePDF(ctx context.Context, invoice *Invoice) {
    pdf, err := s.pdf.Generate(invoice)
    if err != nil {
        return
    }

    url, err := s.storage.Upload(ctx, fmt.Sprintf("invoices/%s.pdf", invoice.ID), pdf)
    if err != nil {
        return
    }

    invoice.PDFURL = url
    s.repo.Update(ctx, invoice)
}

func (s *InvoiceService) getSubscription(ctx context.Context, invoice *Invoice) (*Subscription, error) {
    // Implementation to get subscription
    return nil, nil
}

type UsageCharge struct {
    MeterID     string
    Description string
    Quantity    int64
    UnitPrice   decimal.Decimal
}
```

## Discount System

```go
// internal/billing/discount.go
package billing

import (
    "context"
    "time"
)

type DiscountType string

const (
    DiscountPercentage DiscountType = "percentage"
    DiscountFixed      DiscountType = "fixed"
)

type Discount struct {
    ID              string          `json:"id" gorm:"primaryKey"`
    Code            string          `json:"code" gorm:"uniqueIndex"`
    Name            string          `json:"name"`
    Type            DiscountType    `json:"type"`
    Value           decimal.Decimal `json:"value"` // Percentage (0-100) or fixed amount
    Currency        string          `json:"currency"` // For fixed discounts

    // Limits
    MaxRedemptions  int             `json:"max_redemptions"`
    TimesRedeemed   int             `json:"times_redeemed"`
    MaxRedemptionsPerTenant int     `json:"max_redemptions_per_tenant"`

    // Duration
    Duration        string          `json:"duration"` // once, repeating, forever
    DurationMonths  int             `json:"duration_months"` // For repeating

    // Restrictions
    ApplicablePlans []string        `json:"applicable_plans" gorm:"serializer:json"`
    MinAmount       decimal.Decimal `json:"min_amount"`

    // Validity
    ValidFrom       *time.Time      `json:"valid_from"`
    ValidUntil      *time.Time      `json:"valid_until"`
    IsActive        bool            `json:"is_active"`

    CreatedAt       time.Time       `json:"created_at"`
    UpdatedAt       time.Time       `json:"updated_at"`
}

type DiscountService struct {
    repo DiscountRepository
}

func NewDiscountService(repo DiscountRepository) *DiscountService {
    return &DiscountService{repo: repo}
}

// ValidateCode validates a discount code
func (s *DiscountService) ValidateCode(ctx context.Context, code string, tenantID string, planID string, amount decimal.Decimal) (*Discount, error) {
    discount, err := s.repo.GetByCode(ctx, code)
    if err != nil {
        return nil, fmt.Errorf("discount code not found")
    }

    // Check if active
    if !discount.IsActive {
        return nil, fmt.Errorf("discount code is not active")
    }

    // Check validity period
    now := time.Now()
    if discount.ValidFrom != nil && now.Before(*discount.ValidFrom) {
        return nil, fmt.Errorf("discount code is not yet valid")
    }
    if discount.ValidUntil != nil && now.After(*discount.ValidUntil) {
        return nil, fmt.Errorf("discount code has expired")
    }

    // Check redemption limits
    if discount.MaxRedemptions > 0 && discount.TimesRedeemed >= discount.MaxRedemptions {
        return nil, fmt.Errorf("discount code has reached maximum redemptions")
    }

    // Check per-tenant limit
    if discount.MaxRedemptionsPerTenant > 0 {
        tenantRedemptions, _ := s.repo.CountTenantRedemptions(ctx, discount.ID, tenantID)
        if tenantRedemptions >= discount.MaxRedemptionsPerTenant {
            return nil, fmt.Errorf("you have already used this discount code")
        }
    }

    // Check applicable plans
    if len(discount.ApplicablePlans) > 0 {
        applicable := false
        for _, p := range discount.ApplicablePlans {
            if p == planID {
                applicable = true
                break
            }
        }
        if !applicable {
            return nil, fmt.Errorf("discount code is not applicable to this plan")
        }
    }

    // Check minimum amount
    if discount.MinAmount.GreaterThan(decimal.Zero) && amount.LessThan(discount.MinAmount) {
        return nil, fmt.Errorf("minimum amount of %s required for this discount", discount.MinAmount.String())
    }

    return discount, nil
}

// RedeemCode marks a discount code as redeemed
func (s *DiscountService) RedeemCode(ctx context.Context, discountID string, tenantID string) error {
    return s.repo.IncrementRedemption(ctx, discountID, tenantID)
}
```

## Dunning Management

```go
// internal/billing/dunning.go
package billing

import (
    "context"
    "time"
)

type DunningConfig struct {
    RetryIntervals []int  // Days between retry attempts
    MaxRetries     int
    GracePeriod    int   // Days before subscription is canceled
}

var DefaultDunningConfig = DunningConfig{
    RetryIntervals: []int{3, 5, 7}, // Retry after 3, 5, 7 days
    MaxRetries:     3,
    GracePeriod:    14,
}

type DunningService struct {
    invoices      *InvoiceService
    subscriptions *SubscriptionService
    notifications NotificationService
    config        DunningConfig
}

func NewDunningService(
    invoices *InvoiceService,
    subscriptions *SubscriptionService,
    notifications NotificationService,
    config DunningConfig,
) *DunningService {
    return &DunningService{
        invoices:      invoices,
        subscriptions: subscriptions,
        notifications: notifications,
        config:        config,
    }
}

type FailedPayment struct {
    ID             string    `json:"id" gorm:"primaryKey"`
    InvoiceID      string    `json:"invoice_id" gorm:"index"`
    TenantID       string    `json:"tenant_id" gorm:"index"`
    AttemptNumber  int       `json:"attempt_number"`
    NextRetryAt    time.Time `json:"next_retry_at"`
    LastError      string    `json:"last_error"`
    IsResolved     bool      `json:"is_resolved"`
    ResolvedAt     *time.Time `json:"resolved_at"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
}

// HandleFailedPayment processes a failed payment
func (s *DunningService) HandleFailedPayment(ctx context.Context, invoiceID string, err error) error {
    invoice, ierr := s.invoices.repo.GetByID(ctx, invoiceID)
    if ierr != nil {
        return ierr
    }

    // Create or update failed payment record
    failedPayment, _ := s.getFailedPayment(ctx, invoiceID)
    if failedPayment == nil {
        failedPayment = &FailedPayment{
            ID:            generateID("fp"),
            InvoiceID:     invoiceID,
            TenantID:      invoice.TenantID,
            AttemptNumber: 1,
            CreatedAt:     time.Now(),
        }
    } else {
        failedPayment.AttemptNumber++
    }

    failedPayment.LastError = err.Error()
    failedPayment.UpdatedAt = time.Now()

    // Calculate next retry
    if failedPayment.AttemptNumber <= s.config.MaxRetries {
        retryDays := s.config.RetryIntervals[failedPayment.AttemptNumber-1]
        failedPayment.NextRetryAt = time.Now().AddDate(0, 0, retryDays)

        // Send payment failed notification
        s.notifications.Send(ctx, &Notification{
            Type:     "payment_failed",
            TenantID: invoice.TenantID,
            Data: map[string]any{
                "invoice_number": invoice.Number,
                "amount":         invoice.AmountDue.String(),
                "next_retry":     failedPayment.NextRetryAt.Format("January 2, 2006"),
                "attempt":        failedPayment.AttemptNumber,
                "max_attempts":   s.config.MaxRetries,
            },
        })
    } else {
        // Max retries reached - send final warning
        s.notifications.Send(ctx, &Notification{
            Type:     "payment_final_warning",
            TenantID: invoice.TenantID,
            Data: map[string]any{
                "invoice_number": invoice.Number,
                "amount":         invoice.AmountDue.String(),
                "grace_period":   s.config.GracePeriod,
                "cancel_date":    time.Now().AddDate(0, 0, s.config.GracePeriod).Format("January 2, 2006"),
            },
        })
    }

    return s.saveFailedPayment(ctx, failedPayment)
}

// ProcessPendingRetries processes all pending payment retries
func (s *DunningService) ProcessPendingRetries(ctx context.Context) error {
    failedPayments, err := s.getPaymentsDueForRetry(ctx)
    if err != nil {
        return err
    }

    for _, fp := range failedPayments {
        invoice, err := s.invoices.repo.GetByID(ctx, fp.InvoiceID)
        if err != nil {
            continue
        }

        // Attempt payment
        if err := s.invoices.ProcessPayment(ctx, invoice); err != nil {
            // Payment failed again
            s.HandleFailedPayment(ctx, fp.InvoiceID, err)
        } else {
            // Payment succeeded
            fp.IsResolved = true
            now := time.Now()
            fp.ResolvedAt = &now
            s.saveFailedPayment(ctx, fp)

            // Send payment success notification
            s.notifications.Send(ctx, &Notification{
                Type:     "payment_recovered",
                TenantID: invoice.TenantID,
                Data: map[string]any{
                    "invoice_number": invoice.Number,
                    "amount":         invoice.Total.String(),
                },
            })
        }
    }

    return nil
}

// CancelDelinquentSubscriptions cancels subscriptions past grace period
func (s *DunningService) CancelDelinquentSubscriptions(ctx context.Context) error {
    cutoff := time.Now().AddDate(0, 0, -s.config.GracePeriod)

    delinquent, err := s.getDelinquentSubscriptions(ctx, cutoff)
    if err != nil {
        return err
    }

    for _, sub := range delinquent {
        s.subscriptions.Cancel(ctx, sub.TenantID, true, "payment_failure")

        s.notifications.Send(ctx, &Notification{
            Type:     "subscription_canceled_payment",
            TenantID: sub.TenantID,
            Data: map[string]any{
                "plan_name": sub.Plan.Name,
            },
        })
    }

    return nil
}

func (s *DunningService) getFailedPayment(ctx context.Context, invoiceID string) (*FailedPayment, error) {
    // Implementation
    return nil, nil
}

func (s *DunningService) saveFailedPayment(ctx context.Context, fp *FailedPayment) error {
    // Implementation
    return nil
}

func (s *DunningService) getPaymentsDueForRetry(ctx context.Context) ([]*FailedPayment, error) {
    // Implementation
    return nil, nil
}

func (s *DunningService) getDelinquentSubscriptions(ctx context.Context, cutoff time.Time) ([]*Subscription, error) {
    // Implementation
    return nil, nil
}
```

## Payment Gateway Interface

```go
// internal/billing/payment.go
package billing

import (
    "context"
)

type PaymentGateway interface {
    // Charge charges a payment method
    Charge(ctx context.Context, req *ChargeRequest) (*PaymentIntent, error)

    // Refund refunds a payment
    Refund(ctx context.Context, paymentIntentID string, amount decimal.Decimal) (*Refund, error)

    // CreatePaymentMethod creates a payment method
    CreatePaymentMethod(ctx context.Context, req *CreatePaymentMethodRequest) (*PaymentMethod, error)

    // GetPaymentMethod retrieves a payment method
    GetPaymentMethod(ctx context.Context, id string) (*PaymentMethod, error)

    // DeletePaymentMethod deletes a payment method
    DeletePaymentMethod(ctx context.Context, id string) error

    // CreateCustomer creates a customer in the payment gateway
    CreateCustomer(ctx context.Context, req *CreateCustomerRequest) (*Customer, error)
}

type ChargeRequest struct {
    Amount          decimal.Decimal
    Currency        string
    PaymentMethodID string
    CustomerID      string
    Description     string
    Metadata        map[string]string
}

type PaymentIntent struct {
    ID              string
    Amount          decimal.Decimal
    Currency        string
    Status          string
    PaymentMethodID string
    CustomerID      string
}

type PaymentMethod struct {
    ID        string
    Type      string // card, bank_account
    Card      *CardDetails
    IsDefault bool
}

type CardDetails struct {
    Brand    string
    Last4    string
    ExpMonth int
    ExpYear  int
}

type Refund struct {
    ID              string
    PaymentIntentID string
    Amount          decimal.Decimal
    Status          string
}

type CreatePaymentMethodRequest struct {
    Type       string
    CustomerID string
    Token      string // From frontend SDK
}

type CreateCustomerRequest struct {
    TenantID string
    Email    string
    Name     string
}

type Customer struct {
    ID       string
    TenantID string
    Email    string
    Name     string
}
```

### LiqPay Implementation

```go
// internal/billing/gateways/liqpay.go
package gateways

import (
    "context"
    "crypto/sha1"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"

    "github.com/shopspring/decimal"
)

type LiqPayGateway struct {
    publicKey  string
    privateKey string
    client     *http.Client
    baseURL    string
}

func NewLiqPayGateway(publicKey, privateKey string) *LiqPayGateway {
    return &LiqPayGateway{
        publicKey:  publicKey,
        privateKey: privateKey,
        client:     &http.Client{},
        baseURL:    "https://www.liqpay.ua/api",
    }
}

func (g *LiqPayGateway) Charge(ctx context.Context, req *ChargeRequest) (*PaymentIntent, error) {
    params := map[string]any{
        "action":      "pay",
        "version":     "3",
        "public_key":  g.publicKey,
        "amount":      req.Amount.String(),
        "currency":    req.Currency,
        "description": req.Description,
        "order_id":    req.Metadata["invoice_id"],
        "card_token":  req.PaymentMethodID,
    }

    result, err := g.request(ctx, params)
    if err != nil {
        return nil, err
    }

    return &PaymentIntent{
        ID:       result["payment_id"].(string),
        Amount:   req.Amount,
        Currency: req.Currency,
        Status:   result["status"].(string),
    }, nil
}

func (g *LiqPayGateway) Refund(ctx context.Context, paymentIntentID string, amount decimal.Decimal) (*Refund, error) {
    params := map[string]any{
        "action":     "refund",
        "version":    "3",
        "public_key": g.publicKey,
        "payment_id": paymentIntentID,
        "amount":     amount.String(),
    }

    result, err := g.request(ctx, params)
    if err != nil {
        return nil, err
    }

    return &Refund{
        ID:              result["refund_payment_id"].(string),
        PaymentIntentID: paymentIntentID,
        Amount:          amount,
        Status:          result["status"].(string),
    }, nil
}

func (g *LiqPayGateway) request(ctx context.Context, params map[string]any) (map[string]any, error) {
    // Encode data
    jsonData, _ := json.Marshal(params)
    data := base64.StdEncoding.EncodeToString(jsonData)

    // Create signature
    signStr := g.privateKey + data + g.privateKey
    hash := sha1.Sum([]byte(signStr))
    signature := base64.StdEncoding.EncodeToString(hash[:])

    // Make request
    resp, err := g.client.PostForm(g.baseURL+"/request", url.Values{
        "data":      {data},
        "signature": {signature},
    })
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result map[string]any
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    if result["status"] == "error" {
        return nil, fmt.Errorf("LiqPay error: %s", result["err_description"])
    }

    return result, nil
}
```

## API Endpoints

```go
// internal/billing/handlers.go
package billing

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

type BillingHandler struct {
    subscriptions *SubscriptionService
    invoices      *InvoiceService
    plans         PlanRepository
    limits        *LimitChecker
    discounts     *DiscountService
}

func NewBillingHandler(
    subscriptions *SubscriptionService,
    invoices *InvoiceService,
    plans PlanRepository,
    limits *LimitChecker,
    discounts *DiscountService,
) *BillingHandler {
    return &BillingHandler{
        subscriptions: subscriptions,
        invoices:      invoices,
        plans:         plans,
        limits:        limits,
        discounts:     discounts,
    }
}

func (h *BillingHandler) RegisterRoutes(r *gin.RouterGroup) {
    // Plans
    r.GET("/plans", h.ListPlans)
    r.GET("/plans/:id", h.GetPlan)

    // Subscription
    r.GET("/subscription", h.GetSubscription)
    r.POST("/subscription", h.CreateSubscription)
    r.PATCH("/subscription/plan", h.ChangePlan)
    r.POST("/subscription/cancel", h.CancelSubscription)
    r.POST("/subscription/pause", h.PauseSubscription)
    r.POST("/subscription/resume", h.ResumeSubscription)

    // Invoices
    r.GET("/invoices", h.ListInvoices)
    r.GET("/invoices/:id", h.GetInvoice)
    r.GET("/invoices/:id/pdf", h.DownloadInvoice)

    // Payment methods
    r.GET("/payment-methods", h.ListPaymentMethods)
    r.POST("/payment-methods", h.AddPaymentMethod)
    r.DELETE("/payment-methods/:id", h.DeletePaymentMethod)
    r.POST("/payment-methods/:id/default", h.SetDefaultPaymentMethod)

    // Usage
    r.GET("/usage", h.GetUsage)
    r.GET("/usage/limits", h.GetLimits)

    // Discounts
    r.POST("/discounts/validate", h.ValidateDiscount)

    // Webhooks
    r.POST("/webhooks/liqpay", h.HandleLiqPayWebhook)
}

// ListPlans returns all available plans
func (h *BillingHandler) ListPlans(c *gin.Context) {
    plans, err := h.plans.ListActive(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, plans)
}

// GetSubscription returns tenant's current subscription
func (h *BillingHandler) GetSubscription(c *gin.Context) {
    tenantID := c.GetString("tenant_id")

    subscription, err := h.subscriptions.repo.GetByTenantID(c.Request.Context(), tenantID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
        return
    }

    c.JSON(http.StatusOK, subscription)
}

// CreateSubscription creates a new subscription
func (h *BillingHandler) CreateSubscription(c *gin.Context) {
    var req CreateSubscriptionRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    req.TenantID = c.GetString("tenant_id")

    subscription, err := h.subscriptions.Create(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusCreated, subscription)
}

// ChangePlan changes subscription plan
func (h *BillingHandler) ChangePlan(c *gin.Context) {
    tenantID := c.GetString("tenant_id")

    var req struct {
        PlanID    string `json:"plan_id" binding:"required"`
        Immediate bool   `json:"immediate"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    subscription, err := h.subscriptions.ChangePlan(c.Request.Context(), tenantID, req.PlanID, req.Immediate)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, subscription)
}

// GetUsage returns current usage statistics
func (h *BillingHandler) GetUsage(c *gin.Context) {
    tenantID := c.GetString("tenant_id")

    subscription, err := h.subscriptions.repo.GetByTenantID(c.Request.Context(), tenantID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
        return
    }

    // Get usage for each limit type
    usage := make(map[string]LimitCheckResult)
    for _, limitType := range []LimitType{LimitProducts, LimitOrders, LimitUsers, LimitStorage, LimitAPIRequests} {
        result, _ := h.limits.CheckLimit(c.Request.Context(), tenantID, limitType, 0)
        if result != nil {
            usage[string(limitType)] = *result
        }
    }

    c.JSON(http.StatusOK, gin.H{
        "subscription":   subscription,
        "current_period": gin.H{
            "start": subscription.CurrentPeriodStart,
            "end":   subscription.CurrentPeriodEnd,
        },
        "usage": usage,
    })
}

// GetLimits returns plan limits and current usage
func (h *BillingHandler) GetLimits(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    limitType := LimitType(c.Query("type"))
    requested := int64(1)

    if reqStr := c.Query("requested"); reqStr != "" {
        if _, err := fmt.Sscanf(reqStr, "%d", &requested); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid requested value"})
            return
        }
    }

    result, err := h.limits.CheckLimit(c.Request.Context(), tenantID, limitType, requested)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, result)
}

// ValidateDiscount validates a discount code
func (h *BillingHandler) ValidateDiscount(c *gin.Context) {
    tenantID := c.GetString("tenant_id")

    var req struct {
        Code   string          `json:"code" binding:"required"`
        PlanID string          `json:"plan_id" binding:"required"`
        Amount decimal.Decimal `json:"amount"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    discount, err := h.discounts.ValidateCode(c.Request.Context(), req.Code, tenantID, req.PlanID, req.Amount)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, discount)
}

// HandleLiqPayWebhook handles LiqPay payment webhooks
func (h *BillingHandler) HandleLiqPayWebhook(c *gin.Context) {
    data := c.PostForm("data")
    signature := c.PostForm("signature")

    // Verify signature
    if !h.verifyLiqPaySignature(data, signature) {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
        return
    }

    // Decode data
    var payload map[string]any
    decoded, _ := base64.StdEncoding.DecodeString(data)
    json.Unmarshal(decoded, &payload)

    // Process webhook
    status := payload["status"].(string)
    orderID := payload["order_id"].(string) // Invoice ID

    switch status {
    case "success", "sandbox":
        // Payment successful
        invoice, _ := h.invoices.repo.GetByID(c.Request.Context(), orderID)
        if invoice != nil && invoice.Status == InvoiceOpen {
            h.invoices.MarkAsPaid(c.Request.Context(), invoice, payload["payment_id"].(string))
        }

    case "failure", "error":
        // Payment failed
        h.handlePaymentFailure(c.Request.Context(), orderID, payload)
    }

    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *BillingHandler) verifyLiqPaySignature(data, signature string) bool {
    // Implementation
    return true
}

func (h *BillingHandler) handlePaymentFailure(ctx context.Context, invoiceID string, payload map[string]any) {
    // Implementation
}
```

## Frontend Components

### Pricing Page

```tsx
// components/billing/PricingPlans.tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  limits: {
    products: number;
    orders: number;
    users: number;
    storage: string;
  };
  highlighted?: boolean;
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses',
    price: { monthly: 29, yearly: 290 },
    features: [
      'Basic analytics',
      'Email support',
      '2 team members',
    ],
    limits: {
      products: 100,
      orders: 500,
      users: 2,
      storage: '1 GB',
    },
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For growing businesses',
    price: { monthly: 99, yearly: 990 },
    features: [
      'Advanced analytics',
      'Priority support',
      'API access',
      'Custom domain',
      '10 team members',
    ],
    limits: {
      products: 5000,
      orders: 5000,
      users: 10,
      storage: '10 GB',
    },
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: { monthly: 299, yearly: 2990 },
    features: [
      'Advanced analytics',
      'Dedicated support',
      'API access',
      'Custom domain',
      'SSO',
      'SLA guarantee',
      'Unlimited team members',
    ],
    limits: {
      products: -1,
      orders: -1,
      users: -1,
      storage: '100 GB',
    },
  },
];

export function PricingPlans() {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="py-12">
      {/* Interval toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            className={`px-4 py-2 rounded-md ${
              interval === 'monthly' ? 'bg-white shadow' : ''
            }`}
            onClick={() => setInterval('monthly')}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 rounded-md ${
              interval === 'yearly' ? 'bg-white shadow' : ''
            }`}
            onClick={() => setInterval('yearly')}
          >
            Yearly
            <span className="ml-1 text-green-600 text-sm">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl p-8 ${
              plan.highlighted
                ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2'
                : 'bg-white border'
            }`}
          >
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <p className={`mt-2 ${plan.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
              {plan.description}
            </p>

            <div className="mt-6">
              <span className="text-4xl font-bold">
                ${interval === 'monthly' ? plan.price.monthly : plan.price.yearly}
              </span>
              <span className={plan.highlighted ? 'text-blue-100' : 'text-gray-600'}>
                /{interval === 'monthly' ? 'mo' : 'yr'}
              </span>
            </div>

            <button
              className={`mt-6 w-full py-3 rounded-lg font-medium ${
                plan.highlighted
                  ? 'bg-white text-blue-600 hover:bg-blue-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Get started
            </button>

            <ul className="mt-8 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <Check className={`w-5 h-5 ${plan.highlighted ? 'text-blue-200' : 'text-blue-600'}`} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className={`mt-8 pt-8 border-t ${plan.highlighted ? 'border-blue-500' : ''}`}>
              <h4 className="font-medium mb-4">Limits</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt>Products</dt>
                  <dd>{plan.limits.products === -1 ? 'Unlimited' : plan.limits.products.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Orders/month</dt>
                  <dd>{plan.limits.orders === -1 ? 'Unlimited' : plan.limits.orders.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Team members</dt>
                  <dd>{plan.limits.users === -1 ? 'Unlimited' : plan.limits.users}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Storage</dt>
                  <dd>{plan.limits.storage}</dd>
                </div>
              </dl>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Usage Dashboard

```tsx
// components/billing/UsageDashboard.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

interface UsageData {
  subscription: {
    plan: {
      name: string;
    };
    status: string;
    current_period_end: string;
  };
  usage: {
    [key: string]: {
      current_usage: number;
      limit: number;
      allowed: boolean;
    };
  };
}

export function UsageDashboard() {
  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ['usage'],
    queryFn: () => fetch('/api/billing/usage').then(r => r.json()),
  });

  if (isLoading) return <div>Loading...</div>;
  if (!data) return null;

  const usageItems = [
    { key: 'products', label: 'Products', icon: '📦' },
    { key: 'orders', label: 'Orders this month', icon: '🛒' },
    { key: 'users', label: 'Team members', icon: '👥' },
    { key: 'storage', label: 'Storage', icon: '💾', format: formatBytes },
    { key: 'api_requests', label: 'API requests today', icon: '🔌' },
  ];

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="bg-white rounded-lg p-6 border">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">Current Plan</h2>
            <p className="text-3xl font-bold mt-2">{data.subscription.plan.name}</p>
            <p className="text-gray-600 mt-1">
              Renews on {new Date(data.subscription.current_period_end).toLocaleDateString()}
            </p>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Usage meters */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usageItems.map(({ key, label, icon, format }) => {
          const usage = data.usage[key];
          if (!usage) return null;

          const percentage = usage.limit === -1
            ? 0
            : (usage.current_usage / usage.limit) * 100;
          const isWarning = percentage > 80;
          const isCritical = percentage > 95;

          return (
            <div key={key} className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-3">
                <span>{icon}</span>
                <span className="font-medium">{label}</span>
                {isCritical && (
                  <AlertTriangle className="w-4 h-4 text-red-500 ml-auto" />
                )}
              </div>

              <div className="text-2xl font-bold">
                {format ? format(usage.current_usage) : usage.current_usage.toLocaleString()}
                <span className="text-gray-400 text-lg font-normal">
                  {' / '}
                  {usage.limit === -1
                    ? '∞'
                    : (format ? format(usage.limit) : usage.limit.toLocaleString())}
                </span>
              </div>

              {usage.limit !== -1 && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCritical
                          ? 'bg-red-500'
                          : isWarning
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {percentage.toFixed(1)}% used
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

### Invoice List

```tsx
// components/billing/InvoiceList.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink } from 'lucide-react';

interface Invoice {
  id: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  total: string;
  currency: string;
  invoice_date: string;
  due_date: string;
  pdf_url: string;
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  open: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-gray-100 text-gray-800',
  uncollectible: 'bg-red-100 text-red-800',
};

export function InvoiceList() {
  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => fetch('/api/billing/invoices').then(r => r.json()),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Invoices</h2>
      </div>

      <div className="divide-y">
        {invoices?.map((invoice) => (
          <div key={invoice.id} className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-medium">{invoice.number}</div>
              <div className="text-sm text-gray-600">
                {new Date(invoice.invoice_date).toLocaleDateString()}
              </div>
            </div>

            <div className="text-right">
              <div className="font-medium">
                {invoice.currency} {invoice.total}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[invoice.status]}`}>
                {invoice.status}
              </span>
            </div>

            <div className="flex gap-2">
              {invoice.pdf_url && (
                <a
                  href={invoice.pdf_url}
                  className="p-2 hover:bg-gray-100 rounded"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
              <a
                href={`/billing/invoices/${invoice.id}`}
                className="p-2 hover:bg-gray-100 rounded"
                title="View details"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Background Jobs

```go
// internal/billing/jobs.go
package billing

import (
    "context"
    "log"
    "time"
)

type BillingJobRunner struct {
    subscriptions *SubscriptionService
    dunning       *DunningService
    metering      *MeteringService
}

func NewBillingJobRunner(
    subscriptions *SubscriptionService,
    dunning *DunningService,
    metering *MeteringService,
) *BillingJobRunner {
    return &BillingJobRunner{
        subscriptions: subscriptions,
        dunning:       dunning,
        metering:      metering,
    }
}

// RunDaily runs daily billing jobs
func (r *BillingJobRunner) RunDaily(ctx context.Context) {
    log.Println("Running daily billing jobs...")

    // Process subscription renewals
    r.processRenewals(ctx)

    // Process trial expirations
    r.processTrialExpirations(ctx)

    // Process payment retries
    r.dunning.ProcessPendingRetries(ctx)

    // Cancel delinquent subscriptions
    r.dunning.CancelDelinquentSubscriptions(ctx)

    // Archive old metering data
    r.metering.ArchiveOldData(ctx, 90) // Keep 90 days

    log.Println("Daily billing jobs completed")
}

func (r *BillingJobRunner) processRenewals(ctx context.Context) {
    subscriptions, err := r.subscriptions.repo.GetDueForRenewal(ctx, time.Now())
    if err != nil {
        log.Printf("Error getting subscriptions for renewal: %v", err)
        return
    }

    for _, sub := range subscriptions {
        if err := r.subscriptions.RenewSubscription(ctx, sub); err != nil {
            log.Printf("Error renewing subscription %s: %v", sub.ID, err)
        }
    }
}

func (r *BillingJobRunner) processTrialExpirations(ctx context.Context) {
    subscriptions, err := r.subscriptions.repo.GetTrialExpiring(ctx, time.Now())
    if err != nil {
        log.Printf("Error getting expiring trials: %v", err)
        return
    }

    for _, sub := range subscriptions {
        // Attempt to charge for first invoice
        invoice, err := r.subscriptions.invoices.CreateForSubscription(ctx, sub)
        if err != nil {
            log.Printf("Error creating invoice for subscription %s: %v", sub.ID, err)
            continue
        }

        if err := r.subscriptions.invoices.ProcessPayment(ctx, invoice); err != nil {
            // Payment failed - handle with dunning
            r.dunning.HandleFailedPayment(ctx, invoice.ID, err)
        } else {
            // Payment successful - activate subscription
            sub.Status = SubscriptionActive
            r.subscriptions.repo.Update(ctx, sub)
        }
    }
}
```

## Конфігурація

```yaml
# config/billing.yaml
billing:
  # Payment gateway
  gateway: liqpay
  liqpay:
    public_key: ${LIQPAY_PUBLIC_KEY}
    private_key: ${LIQPAY_PRIVATE_KEY}
    sandbox: ${LIQPAY_SANDBOX:true}

  # Dunning configuration
  dunning:
    retry_intervals: [3, 5, 7]  # days
    max_retries: 3
    grace_period: 14  # days

  # Metering
  metering:
    flush_interval: 60s
    retention_days: 90

  # Invoicing
  invoicing:
    due_days: 14
    tax_rate: 0.20  # 20% VAT
    company:
      name: "Shop Platform Inc."
      address: "123 Main St, City"
      tax_id: "UA123456789"

  # Notifications
  notifications:
    payment_failed: true
    payment_recovered: true
    trial_ending: true
    subscription_canceled: true
```

## Тестування

```go
// internal/billing/subscription_test.go
package billing

import (
    "context"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

func TestSubscriptionService_Create(t *testing.T) {
    repo := new(MockSubscriptionRepository)
    planRepo := new(MockPlanRepository)
    invoices := new(MockInvoiceService)
    events := new(MockEventPublisher)

    service := NewSubscriptionService(repo, planRepo, invoices, events)

    plan := &Plan{
        ID:        "business",
        Name:      "Business",
        TrialDays: 14,
        Interval:  IntervalMonthly,
    }

    planRepo.On("GetByID", mock.Anything, "business").Return(plan, nil)
    repo.On("GetByTenantID", mock.Anything, "tenant_1").Return(nil, nil)
    repo.On("Create", mock.Anything, mock.AnythingOfType("*billing.Subscription")).Return(nil)
    events.On("Publish", mock.Anything, "subscription.created", mock.Anything).Return()

    req := &CreateSubscriptionRequest{
        TenantID: "tenant_1",
        PlanID:   "business",
    }

    subscription, err := service.Create(context.Background(), req)

    assert.NoError(t, err)
    assert.NotNil(t, subscription)
    assert.Equal(t, SubscriptionTrialing, subscription.Status)
    assert.NotNil(t, subscription.TrialEnd)
}

func TestLimitChecker_CheckLimit(t *testing.T) {
    metering := new(MockMeteringService)
    repo := new(MockSubscriptionRepository)

    checker := NewLimitChecker(metering, repo)

    subscription := &Subscription{
        Status: SubscriptionActive,
        Plan: &Plan{
            Limits: PlanLimits{
                MaxProducts: 100,
            },
        },
    }

    repo.On("GetByTenantID", mock.Anything, "tenant_1").Return(subscription, nil)
    metering.On("GetUsage", mock.Anything, "tenant_1", "meter_products", mock.Anything).
        Return(decimal.NewFromInt(50), nil)

    result, err := checker.CheckLimit(context.Background(), "tenant_1", LimitProducts, 10)

    assert.NoError(t, err)
    assert.True(t, result.Allowed)
    assert.Equal(t, int64(50), result.CurrentUsage)
    assert.Equal(t, int64(100), result.Limit)
}
```

## Див. також

- [LiqPay Integration](../integrations/LIQPAY.md)
- [Multi-tenancy](./MULTI_TENANCY.md)
- [API Reference](../api/OPENAPI.md)
