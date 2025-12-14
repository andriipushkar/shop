package metering

import (
	"context"
	"sync"
	"testing"
	"time"
)

// MockRepository for testing
type MockRepository struct {
	mu       sync.RWMutex
	usage    map[string]map[MetricType]*UsageRecord
	quotas   map[string]*TenantQuota
	overages []*OverageCharge
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		usage:    make(map[string]map[MetricType]*UsageRecord),
		quotas:   make(map[string]*TenantQuota),
		overages: make([]*OverageCharge, 0),
	}
}

func (m *MockRepository) RecordUsage(ctx context.Context, record *UsageRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.usage[record.TenantID] == nil {
		m.usage[record.TenantID] = make(map[MetricType]*UsageRecord)
	}
	m.usage[record.TenantID][record.Metric] = record
	return nil
}

func (m *MockRepository) IncrementUsage(ctx context.Context, tenantID string, metric MetricType, delta int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.usage[tenantID] == nil {
		m.usage[tenantID] = make(map[MetricType]*UsageRecord)
	}

	if record, ok := m.usage[tenantID][metric]; ok {
		record.Value += delta
		record.UpdatedAt = time.Now()
	} else {
		m.usage[tenantID][metric] = &UsageRecord{
			TenantID:  tenantID,
			Metric:    metric,
			Value:     delta,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
	}
	return nil
}

func (m *MockRepository) GetUsage(ctx context.Context, tenantID string, metric MetricType, period Period, periodStart time.Time) (*UsageRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if records, ok := m.usage[tenantID]; ok {
		if record, ok := records[metric]; ok {
			return record, nil
		}
	}
	return nil, nil
}

func (m *MockRepository) GetUsageSummary(ctx context.Context, tenantID string, period Period, periodStart time.Time) (*UsageSummary, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	summary := &UsageSummary{
		TenantID:    tenantID,
		Period:      period,
		PeriodStart: periodStart,
		Metrics:     make(map[MetricType]int64),
		Limits:      make(map[MetricType]int64),
		Overages:    make(map[MetricType]int64),
	}

	if records, ok := m.usage[tenantID]; ok {
		for metric, record := range records {
			summary.Metrics[metric] = record.Value
		}
	}

	return summary, nil
}

func (m *MockRepository) ListUsageHistory(ctx context.Context, tenantID string, metric MetricType, startDate, endDate time.Time) ([]*UsageRecord, error) {
	return nil, nil
}

func (m *MockRepository) GetQuota(ctx context.Context, tenantID string) (*TenantQuota, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if quota, ok := m.quotas[tenantID]; ok {
		return quota, nil
	}
	// Return default starter quota
	return DefaultPlanQuotas()["starter"], nil
}

func (m *MockRepository) SetQuota(ctx context.Context, quota *TenantQuota) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.quotas[quota.TenantID] = quota
	return nil
}

func (m *MockRepository) RecordOverage(ctx context.Context, charge *OverageCharge) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.overages = append(m.overages, charge)
	return nil
}

func (m *MockRepository) GetPendingOverages(ctx context.Context, tenantID string) ([]*OverageCharge, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*OverageCharge
	for _, o := range m.overages {
		if o.TenantID == tenantID && o.BilledAt == nil {
			result = append(result, o)
		}
	}
	return result, nil
}

func (m *MockRepository) MarkOveragesBilled(ctx context.Context, tenantID string, period Period, periodEnd time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for _, o := range m.overages {
		if o.TenantID == tenantID && o.BilledAt == nil {
			o.BilledAt = &now
		}
	}
	return nil
}

// MockRateLimiter for testing
type MockRateLimiter struct {
	allowed   bool
	remaining int
}

func NewMockRateLimiter(allowed bool, remaining int) *MockRateLimiter {
	return &MockRateLimiter{allowed: allowed, remaining: remaining}
}

func (m *MockRateLimiter) Allow(ctx context.Context, tenantID string, metric MetricType) (bool, error) {
	return m.allowed, nil
}

func (m *MockRateLimiter) GetRemaining(ctx context.Context, tenantID string, metric MetricType) (int, error) {
	return m.remaining, nil
}

func (m *MockRateLimiter) Reset(ctx context.Context, tenantID string, metric MetricType) error {
	return nil
}

// Tests

func TestService_RecordUsage(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	err := service.RecordUsage(context.Background(), "tenant-1", MetricAPIRequests, 100)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify usage recorded
	usage, _ := service.GetCurrentUsage(context.Background(), "tenant-1", MetricAPIRequests)
	if usage != 100 {
		t.Errorf("expected usage 100, got %d", usage)
	}
}

func TestService_RecordUsage_Increment(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	// Record multiple times
	service.RecordUsage(context.Background(), "tenant-1", MetricAPIRequests, 50)
	service.RecordUsage(context.Background(), "tenant-1", MetricAPIRequests, 30)
	service.RecordUsage(context.Background(), "tenant-1", MetricAPIRequests, 20)

	usage, _ := service.GetCurrentUsage(context.Background(), "tenant-1", MetricAPIRequests)
	if usage != 100 {
		t.Errorf("expected total usage 100, got %d", usage)
	}
}

func TestService_CheckAndRecord_RateLimited(t *testing.T) {
	repo := NewMockRepository()
	rateLimiter := NewMockRateLimiter(false, 0) // Rate limited
	service := NewService(repo, rateLimiter)

	err := service.CheckAndRecord(context.Background(), "tenant-1", MetricAPIRequests, 1)
	if err != ErrRateLimitExceeded {
		t.Errorf("expected ErrRateLimitExceeded, got %v", err)
	}
}

func TestService_CheckAndRecord_WithinQuota(t *testing.T) {
	repo := NewMockRepository()
	rateLimiter := NewMockRateLimiter(true, 100)
	service := NewService(repo, rateLimiter)

	// Record within quota
	err := service.CheckAndRecord(context.Background(), "tenant-1", MetricAPIRequests, 1000)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestService_CheckAndRecord_ExceedsQuota_NoOverage(t *testing.T) {
	repo := NewMockRepository()
	rateLimiter := NewMockRateLimiter(true, 100)
	service := NewService(repo, rateLimiter)

	// Set quota without overage
	quota := &TenantQuota{
		TenantID: "tenant-1",
		Limits: map[MetricType]int64{
			MetricProductCount: 10,
		},
		OverageRates: map[MetricType]float64{}, // No overage allowed
		BillingCycle: PeriodMonthly,
		ResetDay:     1,
	}
	repo.SetQuota(context.Background(), quota)

	// First record 5 products
	service.RecordUsage(context.Background(), "tenant-1", MetricProductCount, 5)

	// Try to add 10 more (would exceed limit of 10)
	err := service.CheckAndRecord(context.Background(), "tenant-1", MetricProductCount, 10)
	if err != ErrQuotaExceeded {
		t.Errorf("expected ErrQuotaExceeded, got %v", err)
	}
}

func TestService_IsWithinQuota(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	// Set quota
	quota := &TenantQuota{
		TenantID: "tenant-1",
		Limits: map[MetricType]int64{
			MetricProductCount: 100,
		},
		BillingCycle: PeriodMonthly,
		ResetDay:     1,
	}
	repo.SetQuota(context.Background(), quota)

	// Check when under limit
	within, err := service.IsWithinQuota(context.Background(), "tenant-1", MetricProductCount)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !within {
		t.Error("expected to be within quota")
	}

	// Add usage near limit
	service.RecordUsage(context.Background(), "tenant-1", MetricProductCount, 99)

	// Still within
	within, _ = service.IsWithinQuota(context.Background(), "tenant-1", MetricProductCount)
	if !within {
		t.Error("expected to still be within quota at 99/100")
	}

	// Add one more
	service.RecordUsage(context.Background(), "tenant-1", MetricProductCount, 1)

	// Now at limit
	within, _ = service.IsWithinQuota(context.Background(), "tenant-1", MetricProductCount)
	if within {
		t.Error("expected to be at quota limit at 100/100")
	}
}

func TestService_GetRemainingQuota(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	quota := &TenantQuota{
		TenantID: "tenant-1",
		Limits: map[MetricType]int64{
			MetricProductCount: 100,
		},
		BillingCycle: PeriodMonthly,
		ResetDay:     1,
	}
	repo.SetQuota(context.Background(), quota)

	// Initial remaining
	remaining, _ := service.GetRemainingQuota(context.Background(), "tenant-1", MetricProductCount)
	if remaining != 100 {
		t.Errorf("expected 100 remaining, got %d", remaining)
	}

	// Use 30
	service.RecordUsage(context.Background(), "tenant-1", MetricProductCount, 30)

	remaining, _ = service.GetRemainingQuota(context.Background(), "tenant-1", MetricProductCount)
	if remaining != 70 {
		t.Errorf("expected 70 remaining, got %d", remaining)
	}
}

func TestService_GetRemainingQuota_Unlimited(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	quota := &TenantQuota{
		TenantID: "tenant-1",
		Limits: map[MetricType]int64{
			MetricProductCount: -1, // Unlimited
		},
		BillingCycle: PeriodMonthly,
		ResetDay:     1,
	}
	repo.SetQuota(context.Background(), quota)

	remaining, _ := service.GetRemainingQuota(context.Background(), "tenant-1", MetricProductCount)
	if remaining != -1 {
		t.Errorf("expected -1 (unlimited), got %d", remaining)
	}
}

func TestService_GetUsageSummary(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	// Record various metrics
	service.RecordUsage(context.Background(), "tenant-1", MetricAPIRequests, 1000)
	service.RecordUsage(context.Background(), "tenant-1", MetricProductCount, 50)
	service.RecordUsage(context.Background(), "tenant-1", MetricOrderCount, 25)

	summary, err := service.GetUsageSummary(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if summary.Metrics[MetricAPIRequests] != 1000 {
		t.Errorf("expected 1000 API requests, got %d", summary.Metrics[MetricAPIRequests])
	}
	if summary.Metrics[MetricProductCount] != 50 {
		t.Errorf("expected 50 products, got %d", summary.Metrics[MetricProductCount])
	}
	if summary.Metrics[MetricOrderCount] != 25 {
		t.Errorf("expected 25 orders, got %d", summary.Metrics[MetricOrderCount])
	}
}

func TestService_CalculateOverageCharges(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	// Record overages manually
	repo.RecordOverage(context.Background(), &OverageCharge{
		TenantID:    "tenant-1",
		Metric:      MetricAPIRequests,
		Quantity:    1000,
		UnitPrice:   0.0001,
		TotalAmount: 0.10,
	})
	repo.RecordOverage(context.Background(), &OverageCharge{
		TenantID:    "tenant-1",
		Metric:      MetricEmailsSent,
		Quantity:    500,
		UnitPrice:   0.001,
		TotalAmount: 0.50,
	})

	total, overages, err := service.CalculateOverageCharges(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if total != 0.60 {
		t.Errorf("expected total $0.60, got $%.2f", total)
	}

	if len(overages) != 2 {
		t.Errorf("expected 2 overage records, got %d", len(overages))
	}
}

func TestDefaultPlanQuotas(t *testing.T) {
	quotas := DefaultPlanQuotas()

	// Test starter plan
	starter := quotas["starter"]
	if starter.Limits[MetricAPIRequests] != 100000 {
		t.Errorf("starter should have 100K API request limit, got %d", starter.Limits[MetricAPIRequests])
	}
	if starter.RateLimits[MetricAPIRequests].RequestsPerSecond != 10 {
		t.Errorf("starter should have 10 rps limit")
	}

	// Test pro plan
	pro := quotas["pro"]
	if pro.Limits[MetricAPIRequests] != 1000000 {
		t.Errorf("pro should have 1M API request limit")
	}

	// Test enterprise plan
	enterprise := quotas["enterprise"]
	if enterprise.Limits[MetricAPIRequests] != -1 {
		t.Errorf("enterprise should have unlimited API requests")
	}
}

func TestMetricTypes(t *testing.T) {
	metrics := []MetricType{
		MetricAPIRequests,
		MetricStorageBytes,
		MetricBandwidthBytes,
		MetricProductCount,
		MetricOrderCount,
		MetricCustomerCount,
		MetricEmailsSent,
		MetricSMSSent,
		MetricWebhookDeliveries,
		MetricImageTransforms,
	}

	for _, m := range metrics {
		if m == "" {
			t.Error("metric type should not be empty")
		}
	}
}

func TestPeriodTypes(t *testing.T) {
	periods := []Period{
		PeriodHourly,
		PeriodDaily,
		PeriodMonthly,
	}

	for _, p := range periods {
		if p == "" {
			t.Error("period should not be empty")
		}
	}
}

func TestService_getPeriodStart(t *testing.T) {
	service := &Service{}

	// Test monthly period
	start := service.getPeriodStart(PeriodMonthly, 1)
	if start.Day() != 1 {
		t.Errorf("monthly period should start on day 1")
	}

	// Test daily period
	start = service.getPeriodStart(PeriodDaily, 1)
	if start.Hour() != 0 || start.Minute() != 0 {
		t.Error("daily period should start at midnight")
	}

	// Test hourly period
	start = service.getPeriodStart(PeriodHourly, 1)
	if start.Minute() != 0 || start.Second() != 0 {
		t.Error("hourly period should start at :00")
	}
}

func TestUsageRecord_Struct(t *testing.T) {
	record := &UsageRecord{
		ID:          "rec_123",
		TenantID:    "tenant-1",
		Metric:      MetricAPIRequests,
		Value:       1000,
		Period:      PeriodMonthly,
		PeriodStart: time.Now(),
		PeriodEnd:   time.Now().AddDate(0, 1, 0),
		CreatedAt:   time.Now(),
	}

	if record.Value != 1000 {
		t.Errorf("expected value 1000, got %d", record.Value)
	}
}

func TestOverageCharge_Struct(t *testing.T) {
	charge := &OverageCharge{
		TenantID:    "tenant-1",
		Metric:      MetricAPIRequests,
		Quantity:    10000,
		UnitPrice:   0.0001,
		TotalAmount: 1.00,
		Period:      PeriodMonthly,
	}

	if charge.TotalAmount != 1.00 {
		t.Errorf("expected total $1.00, got $%.2f", charge.TotalAmount)
	}
}

func BenchmarkRecordUsage(b *testing.B) {
	repo := NewMockRepository()
	service := NewService(repo, nil)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.RecordUsage(ctx, "tenant-1", MetricAPIRequests, 1)
	}
}

func BenchmarkCheckAndRecord(b *testing.B) {
	repo := NewMockRepository()
	rateLimiter := NewMockRateLimiter(true, 1000)
	service := NewService(repo, rateLimiter)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.CheckAndRecord(ctx, "tenant-1", MetricAPIRequests, 1)
	}
}
