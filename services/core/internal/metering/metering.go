package metering

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Errors
var (
	ErrQuotaExceeded    = errors.New("quota exceeded")
	ErrRateLimitExceeded = errors.New("rate limit exceeded")
	ErrInvalidMetric    = errors.New("invalid metric type")
)

// MetricType represents different usage metrics
type MetricType string

const (
	MetricAPIRequests      MetricType = "api_requests"
	MetricStorageBytes     MetricType = "storage_bytes"
	MetricBandwidthBytes   MetricType = "bandwidth_bytes"
	MetricProductCount     MetricType = "products"
	MetricOrderCount       MetricType = "orders"
	MetricCustomerCount    MetricType = "customers"
	MetricEmailsSent       MetricType = "emails_sent"
	MetricSMSSent          MetricType = "sms_sent"
	MetricWebhookDeliveries MetricType = "webhook_deliveries"
	MetricImageTransforms  MetricType = "image_transforms"
)

// Period represents billing/metering period
type Period string

const (
	PeriodHourly  Period = "hourly"
	PeriodDaily   Period = "daily"
	PeriodMonthly Period = "monthly"
)

// UsageRecord represents a single usage record
type UsageRecord struct {
	ID         string     `json:"id"`
	TenantID   string     `json:"tenant_id"`
	Metric     MetricType `json:"metric"`
	Value      int64      `json:"value"`
	Period     Period     `json:"period"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// UsageSummary provides aggregated usage
type UsageSummary struct {
	TenantID      string            `json:"tenant_id"`
	Period        Period            `json:"period"`
	PeriodStart   time.Time         `json:"period_start"`
	PeriodEnd     time.Time         `json:"period_end"`
	Metrics       map[MetricType]int64 `json:"metrics"`
	Limits        map[MetricType]int64 `json:"limits"`
	Overages      map[MetricType]int64 `json:"overages"`
}

// TenantQuota defines quotas for a tenant
type TenantQuota struct {
	TenantID       string                `json:"tenant_id"`
	Plan           string                `json:"plan"`
	Limits         map[MetricType]int64  `json:"limits"`
	RateLimits     map[MetricType]RateLimit `json:"rate_limits"`
	OverageRates   map[MetricType]float64 `json:"overage_rates"` // Price per unit over limit
	BillingCycle   Period                `json:"billing_cycle"`
	ResetDay       int                   `json:"reset_day"` // Day of month for monthly reset
}

// RateLimit defines rate limiting config
type RateLimit struct {
	RequestsPerSecond int `json:"requests_per_second"`
	BurstSize         int `json:"burst_size"`
}

// OverageCharge represents an overage billing item
type OverageCharge struct {
	TenantID    string     `json:"tenant_id"`
	Metric      MetricType `json:"metric"`
	Quantity    int64      `json:"quantity"`
	UnitPrice   float64    `json:"unit_price"`
	TotalAmount float64    `json:"total_amount"`
	Period      Period     `json:"period"`
	PeriodStart time.Time  `json:"period_start"`
	PeriodEnd   time.Time  `json:"period_end"`
	BilledAt    *time.Time `json:"billed_at,omitempty"`
}

// Repository interface for usage storage
type Repository interface {
	// Usage tracking
	RecordUsage(ctx context.Context, record *UsageRecord) error
	IncrementUsage(ctx context.Context, tenantID string, metric MetricType, delta int64) error
	GetUsage(ctx context.Context, tenantID string, metric MetricType, period Period, periodStart time.Time) (*UsageRecord, error)
	GetUsageSummary(ctx context.Context, tenantID string, period Period, periodStart time.Time) (*UsageSummary, error)
	ListUsageHistory(ctx context.Context, tenantID string, metric MetricType, startDate, endDate time.Time) ([]*UsageRecord, error)

	// Quotas
	GetQuota(ctx context.Context, tenantID string) (*TenantQuota, error)
	SetQuota(ctx context.Context, quota *TenantQuota) error

	// Overages
	RecordOverage(ctx context.Context, charge *OverageCharge) error
	GetPendingOverages(ctx context.Context, tenantID string) ([]*OverageCharge, error)
	MarkOveragesBilled(ctx context.Context, tenantID string, period Period, periodEnd time.Time) error
}

// RateLimiter interface for rate limiting
type RateLimiter interface {
	Allow(ctx context.Context, tenantID string, metric MetricType) (bool, error)
	GetRemaining(ctx context.Context, tenantID string, metric MetricType) (int, error)
	Reset(ctx context.Context, tenantID string, metric MetricType) error
}

// Service handles usage metering
type Service struct {
	repo        Repository
	rateLimiter RateLimiter
	cache       sync.Map // Local cache for quotas
}

// NewService creates a new metering service
func NewService(repo Repository, rateLimiter RateLimiter) *Service {
	return &Service{
		repo:        repo,
		rateLimiter: rateLimiter,
	}
}

// RecordUsage records usage for a metric
func (s *Service) RecordUsage(ctx context.Context, tenantID string, metric MetricType, value int64) error {
	return s.repo.IncrementUsage(ctx, tenantID, metric, value)
}

// CheckAndRecord checks quota, rate limit, and records usage
func (s *Service) CheckAndRecord(ctx context.Context, tenantID string, metric MetricType, value int64) error {
	// Check rate limit first (fast path)
	if s.rateLimiter != nil {
		allowed, err := s.rateLimiter.Allow(ctx, tenantID, metric)
		if err != nil {
			return err
		}
		if !allowed {
			return ErrRateLimitExceeded
		}
	}

	// Get quota
	quota, err := s.GetQuota(ctx, tenantID)
	if err != nil {
		return err
	}

	// Check quota limit
	if limit, ok := quota.Limits[metric]; ok && limit > 0 {
		current, err := s.GetCurrentUsage(ctx, tenantID, metric)
		if err != nil {
			return err
		}

		if current+value > limit {
			// Check if overages are allowed
			if _, hasOverage := quota.OverageRates[metric]; !hasOverage {
				return ErrQuotaExceeded
			}
			// Record overage
			overage := current + value - limit
			s.recordOverage(ctx, tenantID, metric, overage, quota)
		}
	}

	// Record the usage
	return s.repo.IncrementUsage(ctx, tenantID, metric, value)
}

// GetCurrentUsage gets current usage for the billing period
func (s *Service) GetCurrentUsage(ctx context.Context, tenantID string, metric MetricType) (int64, error) {
	quota, err := s.GetQuota(ctx, tenantID)
	if err != nil {
		return 0, err
	}

	periodStart := s.getPeriodStart(quota.BillingCycle, quota.ResetDay)
	record, err := s.repo.GetUsage(ctx, tenantID, metric, quota.BillingCycle, periodStart)
	if err != nil || record == nil {
		return 0, nil // No usage yet
	}

	return record.Value, nil
}

// GetQuota retrieves tenant quota with caching
func (s *Service) GetQuota(ctx context.Context, tenantID string) (*TenantQuota, error) {
	// Check cache
	if cached, ok := s.cache.Load(tenantID); ok {
		return cached.(*TenantQuota), nil
	}

	quota, err := s.repo.GetQuota(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Cache for 5 minutes
	s.cache.Store(tenantID, quota)
	go func() {
		time.Sleep(5 * time.Minute)
		s.cache.Delete(tenantID)
	}()

	return quota, nil
}

// GetUsageSummary returns usage summary for a period
func (s *Service) GetUsageSummary(ctx context.Context, tenantID string) (*UsageSummary, error) {
	quota, err := s.GetQuota(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	periodStart := s.getPeriodStart(quota.BillingCycle, quota.ResetDay)
	return s.repo.GetUsageSummary(ctx, tenantID, quota.BillingCycle, periodStart)
}

// IsWithinQuota checks if tenant is within quota for a metric
func (s *Service) IsWithinQuota(ctx context.Context, tenantID string, metric MetricType) (bool, error) {
	quota, err := s.GetQuota(ctx, tenantID)
	if err != nil {
		return false, err
	}

	limit, ok := quota.Limits[metric]
	if !ok || limit < 0 { // -1 means unlimited
		return true, nil
	}

	current, err := s.GetCurrentUsage(ctx, tenantID, metric)
	if err != nil {
		return false, err
	}

	return current < limit, nil
}

// GetRemainingQuota returns remaining quota for a metric
func (s *Service) GetRemainingQuota(ctx context.Context, tenantID string, metric MetricType) (int64, error) {
	quota, err := s.GetQuota(ctx, tenantID)
	if err != nil {
		return 0, err
	}

	limit, ok := quota.Limits[metric]
	if !ok || limit < 0 {
		return -1, nil // Unlimited
	}

	current, err := s.GetCurrentUsage(ctx, tenantID, metric)
	if err != nil {
		return limit, nil
	}

	remaining := limit - current
	if remaining < 0 {
		remaining = 0
	}

	return remaining, nil
}

// SetQuota sets quota for a tenant
func (s *Service) SetQuota(ctx context.Context, quota *TenantQuota) error {
	err := s.repo.SetQuota(ctx, quota)
	if err != nil {
		return err
	}

	// Invalidate cache
	s.cache.Delete(quota.TenantID)
	return nil
}

// GetPendingOverages returns unbilled overages
func (s *Service) GetPendingOverages(ctx context.Context, tenantID string) ([]*OverageCharge, error) {
	return s.repo.GetPendingOverages(ctx, tenantID)
}

// CalculateOverageCharges calculates total overage charges
func (s *Service) CalculateOverageCharges(ctx context.Context, tenantID string) (float64, []*OverageCharge, error) {
	overages, err := s.repo.GetPendingOverages(ctx, tenantID)
	if err != nil {
		return 0, nil, err
	}

	var total float64
	for _, o := range overages {
		total += o.TotalAmount
	}

	return total, overages, nil
}

// recordOverage records an overage charge
func (s *Service) recordOverage(ctx context.Context, tenantID string, metric MetricType, quantity int64, quota *TenantQuota) {
	rate := quota.OverageRates[metric]
	if rate == 0 {
		return
	}

	periodStart := s.getPeriodStart(quota.BillingCycle, quota.ResetDay)
	periodEnd := s.getPeriodEnd(quota.BillingCycle, quota.ResetDay)

	charge := &OverageCharge{
		TenantID:    tenantID,
		Metric:      metric,
		Quantity:    quantity,
		UnitPrice:   rate,
		TotalAmount: float64(quantity) * rate,
		Period:      quota.BillingCycle,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
	}

	s.repo.RecordOverage(ctx, charge)
}

// getPeriodStart calculates the start of the current billing period
func (s *Service) getPeriodStart(period Period, resetDay int) time.Time {
	now := time.Now().UTC()

	switch period {
	case PeriodHourly:
		return time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), 0, 0, 0, time.UTC)
	case PeriodDaily:
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	case PeriodMonthly:
		if now.Day() < resetDay {
			// Previous month
			prev := now.AddDate(0, -1, 0)
			return time.Date(prev.Year(), prev.Month(), resetDay, 0, 0, 0, 0, time.UTC)
		}
		return time.Date(now.Year(), now.Month(), resetDay, 0, 0, 0, 0, time.UTC)
	default:
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	}
}

// getPeriodEnd calculates the end of the current billing period
func (s *Service) getPeriodEnd(period Period, resetDay int) time.Time {
	start := s.getPeriodStart(period, resetDay)

	switch period {
	case PeriodHourly:
		return start.Add(time.Hour)
	case PeriodDaily:
		return start.AddDate(0, 0, 1)
	case PeriodMonthly:
		return start.AddDate(0, 1, 0)
	default:
		return start.AddDate(0, 1, 0)
	}
}

// ============================================================
// Default Plan Quotas
// ============================================================

// DefaultPlanQuotas returns default quotas for each plan
func DefaultPlanQuotas() map[string]*TenantQuota {
	return map[string]*TenantQuota{
		"starter": {
			Plan: "starter",
			Limits: map[MetricType]int64{
				MetricAPIRequests:    100000,   // 100K/month
				MetricStorageBytes:   1073741824, // 1 GB
				MetricProductCount:   100,
				MetricOrderCount:     500,
				MetricEmailsSent:     1000,
				MetricSMSSent:        100,
				MetricWebhookDeliveries: 10000,
			},
			RateLimits: map[MetricType]RateLimit{
				MetricAPIRequests: {RequestsPerSecond: 10, BurstSize: 20},
			},
			OverageRates: map[MetricType]float64{
				MetricAPIRequests:  0.0001,  // $0.0001 per request
				MetricStorageBytes: 0.00000001, // ~$0.01/GB
				MetricEmailsSent:   0.001,   // $0.001 per email
			},
			BillingCycle: PeriodMonthly,
			ResetDay:     1,
		},
		"pro": {
			Plan: "pro",
			Limits: map[MetricType]int64{
				MetricAPIRequests:    1000000,  // 1M/month
				MetricStorageBytes:   10737418240, // 10 GB
				MetricProductCount:   10000,
				MetricOrderCount:     10000,
				MetricEmailsSent:     10000,
				MetricSMSSent:        1000,
				MetricWebhookDeliveries: 100000,
			},
			RateLimits: map[MetricType]RateLimit{
				MetricAPIRequests: {RequestsPerSecond: 100, BurstSize: 200},
			},
			OverageRates: map[MetricType]float64{
				MetricAPIRequests:  0.00005,
				MetricStorageBytes: 0.000000005,
				MetricEmailsSent:   0.0005,
			},
			BillingCycle: PeriodMonthly,
			ResetDay:     1,
		},
		"enterprise": {
			Plan: "enterprise",
			Limits: map[MetricType]int64{
				MetricAPIRequests:    -1, // Unlimited
				MetricStorageBytes:   107374182400, // 100 GB
				MetricProductCount:   -1, // Unlimited
				MetricOrderCount:     -1, // Unlimited
				MetricEmailsSent:     -1, // Unlimited
				MetricSMSSent:        -1, // Unlimited
				MetricWebhookDeliveries: -1, // Unlimited
			},
			RateLimits: map[MetricType]RateLimit{
				MetricAPIRequests: {RequestsPerSecond: 1000, BurstSize: 2000},
			},
			OverageRates: map[MetricType]float64{},
			BillingCycle: PeriodMonthly,
			ResetDay:     1,
		},
	}
}
