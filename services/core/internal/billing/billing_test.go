package billing

import (
	"context"
	"testing"
	"time"
)

// MockBillingRepository for testing
type MockBillingRepository struct {
	subscriptions map[string]*Subscription
	invoices      map[string]*Invoice
	usage         map[string]SubscriptionUsage
}

func NewMockBillingRepository() *MockBillingRepository {
	return &MockBillingRepository{
		subscriptions: make(map[string]*Subscription),
		invoices:      make(map[string]*Invoice),
		usage:         make(map[string]SubscriptionUsage),
	}
}

func (m *MockBillingRepository) CreateSubscription(ctx context.Context, sub *Subscription) error {
	m.subscriptions[sub.TenantID] = sub
	return nil
}

func (m *MockBillingRepository) GetSubscription(ctx context.Context, tenantID string) (*Subscription, error) {
	if sub, ok := m.subscriptions[tenantID]; ok {
		return sub, nil
	}
	return nil, ErrSubscriptionNotFound
}

func (m *MockBillingRepository) UpdateSubscription(ctx context.Context, sub *Subscription) error {
	m.subscriptions[sub.TenantID] = sub
	return nil
}

func (m *MockBillingRepository) ListSubscriptions(ctx context.Context, filter SubscriptionFilter) ([]*Subscription, error) {
	var result []*Subscription
	for _, sub := range m.subscriptions {
		if filter.Status != "" && sub.Status != filter.Status {
			continue
		}
		if filter.PlanID != "" && sub.PlanID != filter.PlanID {
			continue
		}
		result = append(result, sub)
	}
	return result, nil
}

func (m *MockBillingRepository) CreateInvoice(ctx context.Context, inv *Invoice) error {
	m.invoices[inv.ID] = inv
	return nil
}

func (m *MockBillingRepository) GetInvoice(ctx context.Context, id string) (*Invoice, error) {
	if inv, ok := m.invoices[id]; ok {
		return inv, nil
	}
	return nil, ErrInvoiceNotFound
}

func (m *MockBillingRepository) UpdateInvoice(ctx context.Context, inv *Invoice) error {
	m.invoices[inv.ID] = inv
	return nil
}

func (m *MockBillingRepository) ListInvoices(ctx context.Context, tenantID string, limit, offset int) ([]*Invoice, int, error) {
	var result []*Invoice
	for _, inv := range m.invoices {
		if inv.TenantID == tenantID {
			result = append(result, inv)
		}
	}
	return result, len(result), nil
}

func (m *MockBillingRepository) GetUnpaidInvoices(ctx context.Context, olderThan time.Duration) ([]*Invoice, error) {
	var result []*Invoice
	cutoff := time.Now().Add(-olderThan)
	for _, inv := range m.invoices {
		if inv.Status == InvoiceOpen && inv.CreatedAt.Before(cutoff) {
			result = append(result, inv)
		}
	}
	return result, nil
}

func (m *MockBillingRepository) UpdateUsage(ctx context.Context, tenantID string, usage SubscriptionUsage) error {
	m.usage[tenantID] = usage
	return nil
}

func (m *MockBillingRepository) IncrementUsage(ctx context.Context, tenantID, metric string, delta int) error {
	u := m.usage[tenantID]
	switch metric {
	case "products":
		u.Products += delta
	case "orders":
		u.Orders += delta
	case "api_requests":
		u.APIRequests += delta
	}
	m.usage[tenantID] = u

	// Update subscription usage
	if sub, ok := m.subscriptions[tenantID]; ok {
		sub.Usage = u
	}
	return nil
}

func (m *MockBillingRepository) ResetUsage(ctx context.Context, tenantID string) error {
	m.usage[tenantID] = SubscriptionUsage{}
	if sub, ok := m.subscriptions[tenantID]; ok {
		sub.Usage = SubscriptionUsage{}
	}
	return nil
}

// MockPaymentProvider for testing
type MockPaymentProvider struct {
	customers     map[string]string
	subscriptions map[string]string
	charges       map[string]*PaymentResult
}

func NewMockPaymentProvider() *MockPaymentProvider {
	return &MockPaymentProvider{
		customers:     make(map[string]string),
		subscriptions: make(map[string]string),
		charges:       make(map[string]*PaymentResult),
	}
}

func (m *MockPaymentProvider) CreateCustomer(ctx context.Context, tenantID, email, name string) (string, error) {
	customerID := "cus_" + tenantID
	m.customers[tenantID] = customerID
	return customerID, nil
}

func (m *MockPaymentProvider) CreatePaymentMethod(ctx context.Context, customerID string, cardToken string) (string, error) {
	return "pm_" + customerID, nil
}

func (m *MockPaymentProvider) Charge(ctx context.Context, customerID string, amount int64, currency, description string) (*PaymentResult, error) {
	result := &PaymentResult{
		PaymentID: "pi_" + customerID,
		Status:    "succeeded",
		Amount:    amount,
		Currency:  currency,
		PaidAt:    time.Now(),
	}
	m.charges[result.PaymentID] = result
	return result, nil
}

func (m *MockPaymentProvider) Refund(ctx context.Context, paymentID string, amount int64) error {
	return nil
}

func (m *MockPaymentProvider) CreateSubscription(ctx context.Context, customerID, planID string, period BillingPeriod) (string, error) {
	subID := "sub_" + customerID
	m.subscriptions[customerID] = subID
	return subID, nil
}

func (m *MockPaymentProvider) CancelSubscription(ctx context.Context, subscriptionID string) error {
	return nil
}

// MockNotificationService for testing
type MockNotificationService struct {
	notifications []string
}

func NewMockNotificationService() *MockNotificationService {
	return &MockNotificationService{
		notifications: make([]string, 0),
	}
}

func (m *MockNotificationService) SendSubscriptionCreated(ctx context.Context, tenantID string, sub *Subscription) error {
	m.notifications = append(m.notifications, "subscription_created:"+tenantID)
	return nil
}

func (m *MockNotificationService) SendPaymentSuccessful(ctx context.Context, tenantID string, inv *Invoice) error {
	m.notifications = append(m.notifications, "payment_successful:"+tenantID)
	return nil
}

func (m *MockNotificationService) SendPaymentFailed(ctx context.Context, tenantID string, inv *Invoice) error {
	m.notifications = append(m.notifications, "payment_failed:"+tenantID)
	return nil
}

func (m *MockNotificationService) SendSubscriptionExpiring(ctx context.Context, tenantID string, sub *Subscription) error {
	m.notifications = append(m.notifications, "subscription_expiring:"+tenantID)
	return nil
}

func (m *MockNotificationService) SendSubscriptionSuspended(ctx context.Context, tenantID string, reason string) error {
	m.notifications = append(m.notifications, "subscription_suspended:"+tenantID)
	return nil
}

func (m *MockNotificationService) SendQuotaWarning(ctx context.Context, tenantID, metric string, usage, limit int) error {
	m.notifications = append(m.notifications, "quota_warning:"+tenantID+":"+metric)
	return nil
}

// ==================== TESTS ====================

func TestBillingService_CreateSubscription(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	input := CreateSubscriptionInput{
		TenantID:      "tenant-1",
		PlanID:        PlanStarter,
		BillingPeriod: PeriodMonthly,
		PaymentMethod: "card",
	}

	sub, err := service.CreateSubscription(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if sub.PlanID != PlanStarter {
		t.Errorf("expected plan %s, got %s", PlanStarter, sub.PlanID)
	}

	// Starter plan has trial
	if sub.Status != StatusTrialing {
		t.Errorf("expected status %s, got %s", StatusTrialing, sub.Status)
	}

	if sub.TrialEndsAt == nil {
		t.Error("expected trial_ends_at to be set")
	}

	// Check notification was sent
	if len(notifier.notifications) != 1 {
		t.Error("expected subscription created notification")
	}
}

func TestBillingService_CreateFreeSubscription(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	input := CreateSubscriptionInput{
		TenantID:      "tenant-1",
		PlanID:        PlanFree,
		BillingPeriod: PeriodMonthly,
	}

	sub, err := service.CreateSubscription(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Free plan should be active immediately (no trial)
	if sub.Status != StatusActive {
		t.Errorf("expected status %s, got %s", StatusActive, sub.Status)
	}

	if sub.Amount != 0 {
		t.Errorf("expected amount 0, got %d", sub.Amount)
	}
}

func TestBillingService_ChangePlan(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	// Create initial subscription
	sub := &Subscription{
		ID:            "sub-1",
		TenantID:      "tenant-1",
		PlanID:        PlanStarter,
		Status:        StatusActive,
		BillingPeriod: PeriodMonthly,
		Amount:        49900,
	}
	repo.subscriptions["tenant-1"] = sub

	// Upgrade to Professional
	updated, err := service.ChangePlan(context.Background(), "tenant-1", PlanProfessional)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if updated.PlanID != PlanProfessional {
		t.Errorf("expected plan %s, got %s", PlanProfessional, updated.PlanID)
	}

	if updated.Amount != 149900 {
		t.Errorf("expected amount 149900, got %d", updated.Amount)
	}
}

func TestBillingService_CancelSubscription(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	sub := &Subscription{
		ID:       "sub-1",
		TenantID: "tenant-1",
		PlanID:   PlanStarter,
		Status:   StatusActive,
	}
	repo.subscriptions["tenant-1"] = sub

	err := service.CancelSubscription(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.subscriptions["tenant-1"]
	if updated.Status != StatusCanceled {
		t.Errorf("expected status %s, got %s", StatusCanceled, updated.Status)
	}

	if updated.CanceledAt == nil {
		t.Error("expected canceled_at to be set")
	}
}

func TestBillingService_CheckQuota(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	sub := &Subscription{
		ID:       "sub-1",
		TenantID: "tenant-1",
		PlanID:   PlanFree, // Free plan: 50 products limit
		Status:   StatusActive,
		Usage: SubscriptionUsage{
			Products: 45,
		},
	}
	repo.subscriptions["tenant-1"] = sub

	// Should be allowed (45 + 5 = 50, equals limit)
	allowed, err := service.CheckQuota(context.Background(), "tenant-1", "products", 5)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !allowed {
		t.Error("expected quota check to pass")
	}

	// Should exceed (45 + 10 = 55, exceeds 50)
	allowed, err = service.CheckQuota(context.Background(), "tenant-1", "products", 10)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if allowed {
		t.Error("expected quota check to fail")
	}
}

func TestBillingService_QuotaWarning(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	sub := &Subscription{
		ID:       "sub-1",
		TenantID: "tenant-1",
		PlanID:   PlanFree, // 50 products limit
		Status:   StatusActive,
		Usage: SubscriptionUsage{
			Products: 38, // 76% used
		},
	}
	repo.subscriptions["tenant-1"] = sub

	// Adding 3 more = 82% usage, should trigger warning
	allowed, _ := service.CheckQuota(context.Background(), "tenant-1", "products", 3)
	if !allowed {
		t.Error("should be allowed")
	}

	// Check warning was sent
	hasWarning := false
	for _, n := range notifier.notifications {
		if n == "quota_warning:tenant-1:products" {
			hasWarning = true
			break
		}
	}
	if !hasWarning {
		t.Error("expected quota warning notification")
	}
}

func TestBillingService_ExpiredSubscription(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	sub := &Subscription{
		ID:       "sub-1",
		TenantID: "tenant-1",
		PlanID:   PlanStarter,
		Status:   StatusExpired, // Expired!
	}
	repo.subscriptions["tenant-1"] = sub

	_, err := service.CheckQuota(context.Background(), "tenant-1", "products", 1)
	if err != ErrSubscriptionExpired {
		t.Errorf("expected ErrSubscriptionExpired, got %v", err)
	}
}

func TestBillingService_GenerateInvoice(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	sub := &Subscription{
		ID:                 "sub-1",
		TenantID:           "tenant-1",
		PlanID:             PlanStarter,
		Status:             StatusActive,
		BillingPeriod:      PeriodMonthly,
		Amount:             49900,
		Currency:           "UAH",
		CurrentPeriodStart: time.Now(),
		CurrentPeriodEnd:   time.Now().AddDate(0, 1, 0),
	}

	inv, err := service.GenerateInvoice(context.Background(), sub)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if inv.Total != 49900 {
		t.Errorf("expected total 49900, got %d", inv.Total)
	}

	if inv.Status != InvoiceOpen {
		t.Errorf("expected status %s, got %s", InvoiceOpen, inv.Status)
	}

	if len(inv.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(inv.Items))
	}
}

func TestBillingService_ProcessPayment(t *testing.T) {
	repo := NewMockBillingRepository()
	payment := NewMockPaymentProvider()
	notifier := NewMockNotificationService()

	service := NewBillingService(repo, payment, notifier)

	sub := &Subscription{
		ID:       "sub-1",
		TenantID: "tenant-1",
		PlanID:   PlanStarter,
		Status:   StatusActive,
	}
	repo.subscriptions["tenant-1"] = sub

	inv := &Invoice{
		ID:        "inv-1",
		TenantID:  "tenant-1",
		Status:    InvoiceOpen,
		Total:     49900,
		AmountDue: 49900,
		Currency:  "UAH",
	}
	repo.invoices["inv-1"] = inv

	err := service.ProcessPayment(context.Background(), "inv-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.invoices["inv-1"]
	if updated.Status != InvoicePaid {
		t.Errorf("expected status %s, got %s", InvoicePaid, updated.Status)
	}

	if updated.AmountPaid != 49900 {
		t.Errorf("expected amount_paid 49900, got %d", updated.AmountPaid)
	}

	// Check notification
	hasNotification := false
	for _, n := range notifier.notifications {
		if n == "payment_successful:tenant-1" {
			hasNotification = true
			break
		}
	}
	if !hasNotification {
		t.Error("expected payment successful notification")
	}
}

func TestPlanLimits(t *testing.T) {
	tests := []struct {
		plan          PlanID
		productLimit  int
		monthlyPrice  int64
	}{
		{PlanFree, 50, 0},
		{PlanStarter, 500, 49900},
		{PlanProfessional, 5000, 149900},
		{PlanEnterprise, -1, 499900}, // -1 = unlimited
	}

	for _, tt := range tests {
		t.Run(string(tt.plan), func(t *testing.T) {
			plan := DefaultPlans[tt.plan]
			if plan.Limits.Products != tt.productLimit {
				t.Errorf("expected product limit %d, got %d", tt.productLimit, plan.Limits.Products)
			}
			if plan.MonthlyPrice != tt.monthlyPrice {
				t.Errorf("expected monthly price %d, got %d", tt.monthlyPrice, plan.MonthlyPrice)
			}
		})
	}
}

func TestBillingPeriodPricing(t *testing.T) {
	plan := DefaultPlans[PlanStarter]

	// Yearly should have ~20% discount
	expectedYearly := plan.MonthlyPrice * 12 * 80 / 100 // 80% of annual
	actualYearly := plan.YearlyPrice

	// Allow some variance
	if actualYearly > expectedYearly*105/100 {
		t.Errorf("yearly price should be discounted, got %d", actualYearly)
	}
}
