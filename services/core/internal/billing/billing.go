package billing

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// Errors
var (
	ErrSubscriptionNotFound = errors.New("subscription not found")
	ErrInvoiceNotFound      = errors.New("invoice not found")
	ErrPaymentFailed        = errors.New("payment failed")
	ErrQuotaExceeded        = errors.New("quota exceeded")
	ErrSubscriptionExpired  = errors.New("subscription expired")
	ErrAlreadySubscribed    = errors.New("already subscribed to this plan")
)

// ==================== PLANS ====================

type PlanID string

const (
	PlanFree         PlanID = "free"
	PlanStarter      PlanID = "starter"
	PlanProfessional PlanID = "professional"
	PlanEnterprise   PlanID = "enterprise"
)

type BillingPeriod string

const (
	PeriodMonthly BillingPeriod = "monthly"
	PeriodYearly  BillingPeriod = "yearly"
)

type Plan struct {
	ID          PlanID  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`

	// Pricing (in cents/kopecks)
	MonthlyPrice int64 `json:"monthly_price"`
	YearlyPrice  int64 `json:"yearly_price"` // Usually with discount
	Currency     string `json:"currency"`

	// Limits
	Limits PlanLimits `json:"limits"`

	// Features
	Features []string `json:"features"`

	// Trial
	TrialDays int `json:"trial_days"`

	IsActive bool `json:"is_active"`
}

type PlanLimits struct {
	Products        int   `json:"products"`         // -1 for unlimited
	Orders          int   `json:"orders"`           // per month
	Storage         int64 `json:"storage"`          // in bytes, -1 for unlimited
	APIRequests     int   `json:"api_requests"`     // per month
	TeamMembers     int   `json:"team_members"`
	CustomDomains   int   `json:"custom_domains"`
	Integrations    int   `json:"integrations"`
	SupportLevel    string `json:"support_level"`   // email, priority, dedicated
	DataRetention   int   `json:"data_retention"`   // days
}

// Default plans
var DefaultPlans = map[PlanID]Plan{
	PlanFree: {
		ID:           PlanFree,
		Name:         "Free",
		Description:  "Perfect for getting started",
		MonthlyPrice: 0,
		YearlyPrice:  0,
		Currency:     "UAH",
		TrialDays:    0,
		Limits: PlanLimits{
			Products:      50,
			Orders:        100,
			Storage:       100 * 1024 * 1024, // 100MB
			APIRequests:   10000,
			TeamMembers:   1,
			CustomDomains: 0,
			Integrations:  2,
			SupportLevel:  "email",
			DataRetention: 30,
		},
		Features: []string{
			"Basic store",
			"Up to 50 products",
			"100 orders/month",
			"Email support",
		},
		IsActive: true,
	},
	PlanStarter: {
		ID:           PlanStarter,
		Name:         "Starter",
		Description:  "For growing businesses",
		MonthlyPrice: 49900, // 499 UAH
		YearlyPrice:  479000, // 4790 UAH (20% discount)
		Currency:     "UAH",
		TrialDays:    14,
		Limits: PlanLimits{
			Products:      500,
			Orders:        1000,
			Storage:       1024 * 1024 * 1024, // 1GB
			APIRequests:   100000,
			TeamMembers:   3,
			CustomDomains: 1,
			Integrations:  5,
			SupportLevel:  "email",
			DataRetention: 90,
		},
		Features: []string{
			"Everything in Free",
			"Up to 500 products",
			"1000 orders/month",
			"1 custom domain",
			"API access",
			"3 team members",
		},
		IsActive: true,
	},
	PlanProfessional: {
		ID:           PlanProfessional,
		Name:         "Professional",
		Description:  "For established stores",
		MonthlyPrice: 149900, // 1499 UAH
		YearlyPrice:  1439000, // 14390 UAH (20% discount)
		Currency:     "UAH",
		TrialDays:    14,
		Limits: PlanLimits{
			Products:      5000,
			Orders:        10000,
			Storage:       10 * 1024 * 1024 * 1024, // 10GB
			APIRequests:   500000,
			TeamMembers:   10,
			CustomDomains: 5,
			Integrations:  -1, // unlimited
			SupportLevel:  "priority",
			DataRetention: 365,
		},
		Features: []string{
			"Everything in Starter",
			"Up to 5000 products",
			"10000 orders/month",
			"5 custom domains",
			"Priority support",
			"Advanced analytics",
			"Fraud detection",
			"Visual search",
		},
		IsActive: true,
	},
	PlanEnterprise: {
		ID:           PlanEnterprise,
		Name:         "Enterprise",
		Description:  "For large-scale operations",
		MonthlyPrice: 499900, // 4999 UAH
		YearlyPrice:  4799000, // 47990 UAH (20% discount)
		Currency:     "UAH",
		TrialDays:    30,
		Limits: PlanLimits{
			Products:      -1, // unlimited
			Orders:        -1,
			Storage:       -1,
			APIRequests:   -1,
			TeamMembers:   -1,
			CustomDomains: -1,
			Integrations:  -1,
			SupportLevel:  "dedicated",
			DataRetention: -1, // forever
		},
		Features: []string{
			"Everything in Professional",
			"Unlimited everything",
			"Dedicated support manager",
			"SLA guarantee",
			"Custom integrations",
			"White-label option",
			"On-premise deployment",
		},
		IsActive: true,
	},
}

// ==================== SUBSCRIPTION ====================

type SubscriptionStatus string

const (
	StatusTrialing SubscriptionStatus = "trialing"
	StatusActive   SubscriptionStatus = "active"
	StatusPastDue  SubscriptionStatus = "past_due"
	StatusCanceled SubscriptionStatus = "canceled"
	StatusExpired  SubscriptionStatus = "expired"
	StatusSuspended SubscriptionStatus = "suspended"
)

type Subscription struct {
	ID        string             `json:"id"`
	TenantID  string             `json:"tenant_id"`
	PlanID    PlanID             `json:"plan_id"`
	Status    SubscriptionStatus `json:"status"`

	// Billing
	BillingPeriod BillingPeriod `json:"billing_period"`
	Amount        int64         `json:"amount"` // in cents
	Currency      string        `json:"currency"`

	// Payment
	PaymentMethod   string `json:"payment_method"` // card, bank_transfer, liqpay
	PaymentMethodID string `json:"payment_method_id"`

	// Dates
	TrialEndsAt       *time.Time `json:"trial_ends_at,omitempty"`
	CurrentPeriodStart time.Time  `json:"current_period_start"`
	CurrentPeriodEnd   time.Time  `json:"current_period_end"`
	CanceledAt        *time.Time `json:"canceled_at,omitempty"`
	EndedAt           *time.Time `json:"ended_at,omitempty"`

	// Usage in current period
	Usage SubscriptionUsage `json:"usage"`

	// Metadata
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SubscriptionUsage struct {
	Products    int   `json:"products"`
	Orders      int   `json:"orders"`
	Storage     int64 `json:"storage"`
	APIRequests int   `json:"api_requests"`
	TeamMembers int   `json:"team_members"`
}

// ==================== INVOICE ====================

type InvoiceStatus string

const (
	InvoiceDraft     InvoiceStatus = "draft"
	InvoiceOpen      InvoiceStatus = "open"
	InvoicePaid      InvoiceStatus = "paid"
	InvoiceVoid      InvoiceStatus = "void"
	InvoiceUncollectible InvoiceStatus = "uncollectible"
)

type Invoice struct {
	ID           string        `json:"id"`
	TenantID     string        `json:"tenant_id"`
	SubscriptionID string      `json:"subscription_id"`
	Number       string        `json:"number"` // INV-2024-0001
	Status       InvoiceStatus `json:"status"`

	// Amounts
	Subtotal    int64  `json:"subtotal"`
	Tax         int64  `json:"tax"`
	Discount    int64  `json:"discount"`
	Total       int64  `json:"total"`
	AmountPaid  int64  `json:"amount_paid"`
	AmountDue   int64  `json:"amount_due"`
	Currency    string `json:"currency"`

	// Line items
	Items []InvoiceItem `json:"items"`

	// Dates
	PeriodStart time.Time  `json:"period_start"`
	PeriodEnd   time.Time  `json:"period_end"`
	DueDate     time.Time  `json:"due_date"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`

	// Payment
	PaymentIntentID string `json:"payment_intent_id,omitempty"`

	// PDF
	InvoiceURL string `json:"invoice_url,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

type InvoiceItem struct {
	Description string `json:"description"`
	Quantity    int    `json:"quantity"`
	UnitPrice   int64  `json:"unit_price"`
	Amount      int64  `json:"amount"`
}

// ==================== PAYMENT ====================

type PaymentProvider interface {
	CreateCustomer(ctx context.Context, tenantID, email, name string) (string, error)
	CreatePaymentMethod(ctx context.Context, customerID string, cardToken string) (string, error)
	Charge(ctx context.Context, customerID string, amount int64, currency, description string) (*PaymentResult, error)
	Refund(ctx context.Context, paymentID string, amount int64) error
	CreateSubscription(ctx context.Context, customerID, planID string, period BillingPeriod) (string, error)
	CancelSubscription(ctx context.Context, subscriptionID string) error
}

type PaymentResult struct {
	PaymentID string
	Status    string
	Amount    int64
	Currency  string
	PaidAt    time.Time
}

// ==================== REPOSITORY ====================

type BillingRepository interface {
	// Subscriptions
	CreateSubscription(ctx context.Context, sub *Subscription) error
	GetSubscription(ctx context.Context, tenantID string) (*Subscription, error)
	UpdateSubscription(ctx context.Context, sub *Subscription) error
	ListSubscriptions(ctx context.Context, filter SubscriptionFilter) ([]*Subscription, error)

	// Invoices
	CreateInvoice(ctx context.Context, inv *Invoice) error
	GetInvoice(ctx context.Context, id string) (*Invoice, error)
	UpdateInvoice(ctx context.Context, inv *Invoice) error
	ListInvoices(ctx context.Context, tenantID string, limit, offset int) ([]*Invoice, int, error)
	GetUnpaidInvoices(ctx context.Context, olderThan time.Duration) ([]*Invoice, error)

	// Usage
	UpdateUsage(ctx context.Context, tenantID string, usage SubscriptionUsage) error
	IncrementUsage(ctx context.Context, tenantID, metric string, delta int) error
	ResetUsage(ctx context.Context, tenantID string) error
}

type SubscriptionFilter struct {
	Status     SubscriptionStatus
	PlanID     PlanID
	ExpiringIn time.Duration
}

// ==================== SERVICE ====================

type BillingService struct {
	repo     BillingRepository
	payment  PaymentProvider
	notifier NotificationService
}

type NotificationService interface {
	SendSubscriptionCreated(ctx context.Context, tenantID string, sub *Subscription) error
	SendPaymentSuccessful(ctx context.Context, tenantID string, inv *Invoice) error
	SendPaymentFailed(ctx context.Context, tenantID string, inv *Invoice) error
	SendSubscriptionExpiring(ctx context.Context, tenantID string, sub *Subscription) error
	SendSubscriptionSuspended(ctx context.Context, tenantID string, reason string) error
	SendQuotaWarning(ctx context.Context, tenantID, metric string, usage, limit int) error
}

func NewBillingService(repo BillingRepository, payment PaymentProvider, notifier NotificationService) *BillingService {
	return &BillingService{
		repo:     repo,
		payment:  payment,
		notifier: notifier,
	}
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

type CreateSubscriptionInput struct {
	TenantID      string
	PlanID        PlanID
	BillingPeriod BillingPeriod
	PaymentMethod string
	CardToken     string
}

func (s *BillingService) CreateSubscription(ctx context.Context, input CreateSubscriptionInput) (*Subscription, error) {
	plan, ok := DefaultPlans[input.PlanID]
	if !ok {
		return nil, fmt.Errorf("unknown plan: %s", input.PlanID)
	}

	// Check if already subscribed
	existing, err := s.repo.GetSubscription(ctx, input.TenantID)
	if err == nil && existing.Status == StatusActive {
		return nil, ErrAlreadySubscribed
	}

	// Calculate amount based on period
	var amount int64
	if input.BillingPeriod == PeriodYearly {
		amount = plan.YearlyPrice
	} else {
		amount = plan.MonthlyPrice
	}

	now := time.Now()

	// Calculate period end
	var periodEnd time.Time
	if input.BillingPeriod == PeriodYearly {
		periodEnd = now.AddDate(1, 0, 0)
	} else {
		periodEnd = now.AddDate(0, 1, 0)
	}

	sub := &Subscription{
		ID:                 generateID("sub"),
		TenantID:           input.TenantID,
		PlanID:             input.PlanID,
		Status:             StatusActive,
		BillingPeriod:      input.BillingPeriod,
		Amount:             amount,
		Currency:           plan.Currency,
		PaymentMethod:      input.PaymentMethod,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   periodEnd,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	// Set trial if applicable
	if plan.TrialDays > 0 && input.PlanID != PlanFree {
		trialEnd := now.AddDate(0, 0, plan.TrialDays)
		sub.TrialEndsAt = &trialEnd
		sub.Status = StatusTrialing
	}

	// Create subscription in payment provider (for non-free plans)
	if input.PlanID != PlanFree && amount > 0 {
		paymentSubID, err := s.payment.CreateSubscription(ctx, input.TenantID, string(input.PlanID), input.BillingPeriod)
		if err != nil {
			return nil, fmt.Errorf("failed to create payment subscription: %w", err)
		}
		sub.PaymentMethodID = paymentSubID
	}

	if err := s.repo.CreateSubscription(ctx, sub); err != nil {
		return nil, err
	}

	// Send notification
	s.notifier.SendSubscriptionCreated(ctx, input.TenantID, sub)

	return sub, nil
}

func (s *BillingService) GetSubscription(ctx context.Context, tenantID string) (*Subscription, error) {
	return s.repo.GetSubscription(ctx, tenantID)
}

func (s *BillingService) ChangePlan(ctx context.Context, tenantID string, newPlanID PlanID) (*Subscription, error) {
	sub, err := s.repo.GetSubscription(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	if sub.PlanID == newPlanID {
		return nil, ErrAlreadySubscribed
	}

	// Get new plan
	newPlan, ok := DefaultPlans[newPlanID]
	if !ok {
		return nil, fmt.Errorf("unknown plan: %s", newPlanID)
	}

	// Calculate prorated amount (simplified)
	var newAmount int64
	if sub.BillingPeriod == PeriodYearly {
		newAmount = newPlan.YearlyPrice
	} else {
		newAmount = newPlan.MonthlyPrice
	}

	sub.PlanID = newPlanID
	sub.Amount = newAmount
	sub.UpdatedAt = time.Now()

	if err := s.repo.UpdateSubscription(ctx, sub); err != nil {
		return nil, err
	}

	return sub, nil
}

func (s *BillingService) CancelSubscription(ctx context.Context, tenantID string) error {
	sub, err := s.repo.GetSubscription(ctx, tenantID)
	if err != nil {
		return err
	}

	now := time.Now()
	sub.Status = StatusCanceled
	sub.CanceledAt = &now
	sub.UpdatedAt = now

	// Cancel in payment provider
	if sub.PaymentMethodID != "" {
		if err := s.payment.CancelSubscription(ctx, sub.PaymentMethodID); err != nil {
			return fmt.Errorf("failed to cancel payment subscription: %w", err)
		}
	}

	return s.repo.UpdateSubscription(ctx, sub)
}

// ==================== QUOTA MANAGEMENT ====================

func (s *BillingService) CheckQuota(ctx context.Context, tenantID, metric string, amount int) (bool, error) {
	sub, err := s.repo.GetSubscription(ctx, tenantID)
	if err != nil {
		// No subscription = use free limits
		sub = &Subscription{PlanID: PlanFree}
	}

	// Check if subscription is valid
	if sub.Status == StatusExpired || sub.Status == StatusSuspended {
		return false, ErrSubscriptionExpired
	}

	plan := DefaultPlans[sub.PlanID]
	limits := plan.Limits

	var current, limit int
	switch metric {
	case "products":
		current = sub.Usage.Products
		limit = limits.Products
	case "orders":
		current = sub.Usage.Orders
		limit = limits.Orders
	case "team_members":
		current = sub.Usage.TeamMembers
		limit = limits.TeamMembers
	case "api_requests":
		current = sub.Usage.APIRequests
		limit = limits.APIRequests
	default:
		return true, nil
	}

	// -1 means unlimited
	if limit == -1 {
		return true, nil
	}

	allowed := current + amount <= limit

	// Send warning at 80% usage
	if allowed && float64(current+amount) >= float64(limit)*0.8 {
		s.notifier.SendQuotaWarning(ctx, tenantID, metric, current+amount, limit)
	}

	return allowed, nil
}

func (s *BillingService) IncrementUsage(ctx context.Context, tenantID, metric string, delta int) error {
	return s.repo.IncrementUsage(ctx, tenantID, metric, delta)
}

// ==================== INVOICE MANAGEMENT ====================

func (s *BillingService) GenerateInvoice(ctx context.Context, sub *Subscription) (*Invoice, error) {
	plan := DefaultPlans[sub.PlanID]

	inv := &Invoice{
		ID:             generateID("inv"),
		TenantID:       sub.TenantID,
		SubscriptionID: sub.ID,
		Number:         generateInvoiceNumber(),
		Status:         InvoiceOpen,
		Subtotal:       sub.Amount,
		Tax:            0, // Add tax calculation if needed
		Discount:       0,
		Total:          sub.Amount,
		AmountDue:      sub.Amount,
		Currency:       sub.Currency,
		Items: []InvoiceItem{
			{
				Description: fmt.Sprintf("%s Plan - %s", plan.Name, sub.BillingPeriod),
				Quantity:    1,
				UnitPrice:   sub.Amount,
				Amount:      sub.Amount,
			},
		},
		PeriodStart: sub.CurrentPeriodStart,
		PeriodEnd:   sub.CurrentPeriodEnd,
		DueDate:     time.Now().AddDate(0, 0, 7), // 7 days to pay
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateInvoice(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *BillingService) ProcessPayment(ctx context.Context, invoiceID string) error {
	inv, err := s.repo.GetInvoice(ctx, invoiceID)
	if err != nil {
		return err
	}

	if inv.Status != InvoiceOpen {
		return fmt.Errorf("invoice is not open")
	}

	sub, err := s.repo.GetSubscription(ctx, inv.TenantID)
	if err != nil {
		return err
	}

	// Charge customer
	result, err := s.payment.Charge(ctx, inv.TenantID, inv.AmountDue, inv.Currency, inv.Number)
	if err != nil {
		inv.Status = InvoiceUncollectible
		s.repo.UpdateInvoice(ctx, inv)

		// Mark subscription as past due
		sub.Status = StatusPastDue
		s.repo.UpdateSubscription(ctx, sub)

		s.notifier.SendPaymentFailed(ctx, inv.TenantID, inv)
		return ErrPaymentFailed
	}

	// Update invoice
	now := result.PaidAt
	inv.Status = InvoicePaid
	inv.AmountPaid = result.Amount
	inv.AmountDue = 0
	inv.PaidAt = &now
	inv.PaymentIntentID = result.PaymentID

	if err := s.repo.UpdateInvoice(ctx, inv); err != nil {
		return err
	}

	// Update subscription
	sub.Status = StatusActive
	if err := s.repo.UpdateSubscription(ctx, sub); err != nil {
		return err
	}

	// Reset usage for new period
	if err := s.repo.ResetUsage(ctx, inv.TenantID); err != nil {
		return err
	}

	s.notifier.SendPaymentSuccessful(ctx, inv.TenantID, inv)

	return nil
}

// ==================== BACKGROUND JOBS ====================

// ProcessExpiringSubscriptions - Run daily to handle renewals
func (s *BillingService) ProcessExpiringSubscriptions(ctx context.Context) error {
	// Find subscriptions expiring in next 3 days
	subs, err := s.repo.ListSubscriptions(ctx, SubscriptionFilter{
		Status:     StatusActive,
		ExpiringIn: 3 * 24 * time.Hour,
	})
	if err != nil {
		return err
	}

	for _, sub := range subs {
		// Generate invoice and attempt payment
		inv, err := s.GenerateInvoice(ctx, sub)
		if err != nil {
			continue
		}

		if err := s.ProcessPayment(ctx, inv.ID); err != nil {
			// Send expiring notification
			s.notifier.SendSubscriptionExpiring(ctx, sub.TenantID, sub)
		}
	}

	return nil
}

// SuspendOverdueSubscriptions - Run daily to suspend unpaid subscriptions
func (s *BillingService) SuspendOverdueSubscriptions(ctx context.Context) error {
	// Find invoices unpaid for more than 7 days
	invoices, err := s.repo.GetUnpaidInvoices(ctx, 7*24*time.Hour)
	if err != nil {
		return err
	}

	for _, inv := range invoices {
		sub, err := s.repo.GetSubscription(ctx, inv.TenantID)
		if err != nil {
			continue
		}

		// Suspend subscription
		sub.Status = StatusSuspended
		sub.UpdatedAt = time.Now()

		if err := s.repo.UpdateSubscription(ctx, sub); err != nil {
			continue
		}

		s.notifier.SendSubscriptionSuspended(ctx, inv.TenantID, "Payment overdue for 7+ days")
	}

	return nil
}

// ==================== HELPERS ====================

func generateID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func generateInvoiceNumber() string {
	year := time.Now().Year()
	return fmt.Sprintf("INV-%d-%d", year, time.Now().UnixNano()%100000)
}
