// Package tenant provides multi-tenant management for SaaS platform
package tenant

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Tenant represents a tenant (customer organization) in the system
type Tenant struct {
	ID           string            `json:"id" db:"id"`
	Slug         string            `json:"slug" db:"slug"`
	Name         string            `json:"name" db:"name"`
	Domain       string            `json:"domain,omitempty" db:"domain"`
	Plan         PlanType          `json:"plan" db:"plan"`
	Status       TenantStatus      `json:"status" db:"status"`
	Settings     TenantSettings    `json:"settings" db:"settings"`
	Limits       TenantLimits      `json:"limits" db:"limits"`
	BillingEmail string            `json:"billing_email" db:"billing_email"`
	StripeID     string            `json:"stripe_id,omitempty" db:"stripe_customer_id"`
	Metadata     map[string]string `json:"metadata,omitempty" db:"metadata"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
}

// TenantStatus represents the status of a tenant
type TenantStatus string

const (
	TenantStatusActive    TenantStatus = "active"
	TenantStatusTrial     TenantStatus = "trial"
	TenantStatusSuspended TenantStatus = "suspended"
	TenantStatusCancelled TenantStatus = "cancelled"
)

// PlanType represents subscription plan types
type PlanType string

const (
	PlanFree       PlanType = "free"
	PlanStarter    PlanType = "starter"
	PlanPro        PlanType = "pro"
	PlanEnterprise PlanType = "enterprise"
)

// TenantSettings holds tenant-specific configuration
type TenantSettings struct {
	Currency        string   `json:"currency"`
	Timezone        string   `json:"timezone"`
	Language        string   `json:"language"`
	LogoURL         string   `json:"logo_url,omitempty"`
	PrimaryColor    string   `json:"primary_color,omitempty"`
	AllowedDomains  []string `json:"allowed_domains,omitempty"`
	EnabledFeatures []string `json:"enabled_features,omitempty"`
	CustomDomain    string   `json:"custom_domain,omitempty"`
	WebhookURL      string   `json:"webhook_url,omitempty"`
}

// TenantLimits holds resource limits based on plan
type TenantLimits struct {
	MaxProducts      int   `json:"max_products"`
	MaxOrders        int   `json:"max_orders_per_month"`
	MaxUsers         int   `json:"max_users"`
	MaxStorage       int64 `json:"max_storage_bytes"`
	MaxAPIRequests   int   `json:"max_api_requests_per_day"`
	MaxCustomDomains int   `json:"max_custom_domains"`
	AIRequestsLimit  int   `json:"ai_requests_per_month"`
}

// PlanLimits defines limits for each plan
var PlanLimits = map[PlanType]TenantLimits{
	PlanFree: {
		MaxProducts:      100,
		MaxOrders:        50,
		MaxUsers:         2,
		MaxStorage:       1 * 1024 * 1024 * 1024, // 1 GB
		MaxAPIRequests:   1000,
		MaxCustomDomains: 0,
		AIRequestsLimit:  100,
	},
	PlanStarter: {
		MaxProducts:      1000,
		MaxOrders:        500,
		MaxUsers:         5,
		MaxStorage:       10 * 1024 * 1024 * 1024, // 10 GB
		MaxAPIRequests:   10000,
		MaxCustomDomains: 1,
		AIRequestsLimit:  1000,
	},
	PlanPro: {
		MaxProducts:      10000,
		MaxOrders:        5000,
		MaxUsers:         25,
		MaxStorage:       100 * 1024 * 1024 * 1024, // 100 GB
		MaxAPIRequests:   100000,
		MaxCustomDomains: 5,
		AIRequestsLimit:  10000,
	},
	PlanEnterprise: {
		MaxProducts:      -1, // Unlimited
		MaxOrders:        -1,
		MaxUsers:         -1,
		MaxStorage:       -1,
		MaxAPIRequests:   -1,
		MaxCustomDomains: -1,
		AIRequestsLimit:  -1,
	},
}

// Service handles tenant management
type Service struct {
	db       *sql.DB
	cache    TenantCache
	billing  BillingProvider
	logger   *zap.Logger
	mu       sync.RWMutex
	tenants  map[string]*Tenant
}

// TenantCache interface for caching tenant data
type TenantCache interface {
	Get(ctx context.Context, key string) (*Tenant, error)
	Set(ctx context.Context, key string, tenant *Tenant, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// BillingProvider interface for billing operations
type BillingProvider interface {
	CreateCustomer(ctx context.Context, tenant *Tenant) (string, error)
	CreateSubscription(ctx context.Context, customerID string, plan PlanType) (string, error)
	UpdateSubscription(ctx context.Context, subscriptionID string, plan PlanType) error
	CancelSubscription(ctx context.Context, subscriptionID string) error
	GetUsage(ctx context.Context, customerID string) (*UsageRecord, error)
}

// UsageRecord represents billing usage
type UsageRecord struct {
	TenantID     string    `json:"tenant_id"`
	Period       string    `json:"period"`
	Products     int       `json:"products_count"`
	Orders       int       `json:"orders_count"`
	Storage      int64     `json:"storage_bytes"`
	APIRequests  int       `json:"api_requests"`
	AIRequests   int       `json:"ai_requests"`
	RecordedAt   time.Time `json:"recorded_at"`
}

// Config holds service configuration
type Config struct {
	DefaultPlan    PlanType      `json:"default_plan"`
	TrialDays      int           `json:"trial_days"`
	CacheTTL       time.Duration `json:"cache_ttl"`
	EnableWebhooks bool          `json:"enable_webhooks"`
}

// NewService creates a new tenant service
func NewService(db *sql.DB, cache TenantCache, billing BillingProvider, logger *zap.Logger) *Service {
	return &Service{
		db:      db,
		cache:   cache,
		billing: billing,
		logger:  logger,
		tenants: make(map[string]*Tenant),
	}
}

// CreateTenant creates a new tenant
func (s *Service) CreateTenant(ctx context.Context, req CreateTenantRequest) (*Tenant, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	// Generate slug if not provided
	slug := req.Slug
	if slug == "" {
		slug = s.generateSlug(req.Name)
	}

	// Check slug uniqueness
	exists, err := s.slugExists(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("failed to check slug: %w", err)
	}
	if exists {
		return nil, errors.New("slug already exists")
	}

	// Determine plan and limits
	plan := req.Plan
	if plan == "" {
		plan = PlanFree
	}
	limits := PlanLimits[plan]

	// Generate API key
	apiKey, err := s.generateAPIKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate API key: %w", err)
	}

	tenant := &Tenant{
		ID:           uuid.New().String(),
		Slug:         slug,
		Name:         req.Name,
		Domain:       req.Domain,
		Plan:         plan,
		Status:       TenantStatusTrial,
		BillingEmail: req.BillingEmail,
		Settings: TenantSettings{
			Currency: "UAH",
			Timezone: "Europe/Kyiv",
			Language: "uk",
		},
		Limits:    limits,
		Metadata:  map[string]string{"api_key": apiKey},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Create Stripe customer if billing provider available
	if s.billing != nil {
		stripeID, err := s.billing.CreateCustomer(ctx, tenant)
		if err != nil {
			s.logger.Error("Failed to create Stripe customer", zap.Error(err))
		} else {
			tenant.StripeID = stripeID
		}
	}

	// Save to database
	if err := s.saveTenant(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to save tenant: %w", err)
	}

	// Cache tenant
	if s.cache != nil {
		_ = s.cache.Set(ctx, tenant.ID, tenant, 1*time.Hour)
		_ = s.cache.Set(ctx, "slug:"+tenant.Slug, tenant, 1*time.Hour)
	}

	s.logger.Info("Tenant created",
		zap.String("tenant_id", tenant.ID),
		zap.String("slug", tenant.Slug),
		zap.String("plan", string(tenant.Plan)),
	)

	return tenant, nil
}

// CreateTenantRequest holds data for creating a tenant
type CreateTenantRequest struct {
	Name         string   `json:"name"`
	Slug         string   `json:"slug,omitempty"`
	Domain       string   `json:"domain,omitempty"`
	Plan         PlanType `json:"plan,omitempty"`
	BillingEmail string   `json:"billing_email"`
}

// Validate validates the create tenant request
func (r *CreateTenantRequest) Validate() error {
	if r.Name == "" {
		return errors.New("name is required")
	}
	if r.BillingEmail == "" {
		return errors.New("billing email is required")
	}
	if len(r.Name) > 100 {
		return errors.New("name too long")
	}
	return nil
}

// GetTenant retrieves a tenant by ID
func (s *Service) GetTenant(ctx context.Context, tenantID string) (*Tenant, error) {
	// Try cache first
	if s.cache != nil {
		if tenant, err := s.cache.Get(ctx, tenantID); err == nil && tenant != nil {
			return tenant, nil
		}
	}

	// Query database
	tenant, err := s.getTenantFromDB(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Update cache
	if s.cache != nil && tenant != nil {
		_ = s.cache.Set(ctx, tenantID, tenant, 1*time.Hour)
	}

	return tenant, nil
}

// GetTenantBySlug retrieves a tenant by slug
func (s *Service) GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error) {
	// Try cache first
	if s.cache != nil {
		if tenant, err := s.cache.Get(ctx, "slug:"+slug); err == nil && tenant != nil {
			return tenant, nil
		}
	}

	// Query database
	tenant, err := s.getTenantBySlugFromDB(ctx, slug)
	if err != nil {
		return nil, err
	}

	// Update cache
	if s.cache != nil && tenant != nil {
		_ = s.cache.Set(ctx, tenant.ID, tenant, 1*time.Hour)
		_ = s.cache.Set(ctx, "slug:"+slug, tenant, 1*time.Hour)
	}

	return tenant, nil
}

// UpdateTenant updates tenant information
func (s *Service) UpdateTenant(ctx context.Context, tenantID string, req UpdateTenantRequest) (*Tenant, error) {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		tenant.Name = req.Name
	}
	if req.Domain != "" {
		tenant.Domain = req.Domain
	}
	if req.Settings != nil {
		tenant.Settings = *req.Settings
	}
	if req.Metadata != nil {
		for k, v := range req.Metadata {
			tenant.Metadata[k] = v
		}
	}

	tenant.UpdatedAt = time.Now()

	if err := s.updateTenantInDB(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to update tenant: %w", err)
	}

	// Invalidate cache
	if s.cache != nil {
		_ = s.cache.Delete(ctx, tenantID)
		_ = s.cache.Delete(ctx, "slug:"+tenant.Slug)
	}

	return tenant, nil
}

// UpdateTenantRequest holds data for updating a tenant
type UpdateTenantRequest struct {
	Name     string             `json:"name,omitempty"`
	Domain   string             `json:"domain,omitempty"`
	Settings *TenantSettings    `json:"settings,omitempty"`
	Metadata map[string]string  `json:"metadata,omitempty"`
}

// ChangePlan changes tenant's subscription plan
func (s *Service) ChangePlan(ctx context.Context, tenantID string, newPlan PlanType) error {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	if tenant.Plan == newPlan {
		return nil // No change needed
	}

	oldPlan := tenant.Plan
	tenant.Plan = newPlan
	tenant.Limits = PlanLimits[newPlan]
	tenant.UpdatedAt = time.Now()

	// Update subscription in billing provider
	if s.billing != nil && tenant.StripeID != "" {
		subID := tenant.Metadata["subscription_id"]
		if subID != "" {
			if err := s.billing.UpdateSubscription(ctx, subID, newPlan); err != nil {
				return fmt.Errorf("failed to update subscription: %w", err)
			}
		}
	}

	if err := s.updateTenantInDB(ctx, tenant); err != nil {
		return fmt.Errorf("failed to update tenant: %w", err)
	}

	// Invalidate cache
	if s.cache != nil {
		_ = s.cache.Delete(ctx, tenantID)
	}

	s.logger.Info("Tenant plan changed",
		zap.String("tenant_id", tenantID),
		zap.String("old_plan", string(oldPlan)),
		zap.String("new_plan", string(newPlan)),
	)

	return nil
}

// SuspendTenant suspends a tenant
func (s *Service) SuspendTenant(ctx context.Context, tenantID, reason string) error {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	tenant.Status = TenantStatusSuspended
	tenant.Metadata["suspension_reason"] = reason
	tenant.Metadata["suspended_at"] = time.Now().Format(time.RFC3339)
	tenant.UpdatedAt = time.Now()

	if err := s.updateTenantInDB(ctx, tenant); err != nil {
		return fmt.Errorf("failed to suspend tenant: %w", err)
	}

	// Invalidate cache
	if s.cache != nil {
		_ = s.cache.Delete(ctx, tenantID)
	}

	s.logger.Warn("Tenant suspended",
		zap.String("tenant_id", tenantID),
		zap.String("reason", reason),
	)

	return nil
}

// ReactivateTenant reactivates a suspended tenant
func (s *Service) ReactivateTenant(ctx context.Context, tenantID string) error {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	if tenant.Status != TenantStatusSuspended {
		return errors.New("tenant is not suspended")
	}

	tenant.Status = TenantStatusActive
	delete(tenant.Metadata, "suspension_reason")
	delete(tenant.Metadata, "suspended_at")
	tenant.UpdatedAt = time.Now()

	if err := s.updateTenantInDB(ctx, tenant); err != nil {
		return fmt.Errorf("failed to reactivate tenant: %w", err)
	}

	// Invalidate cache
	if s.cache != nil {
		_ = s.cache.Delete(ctx, tenantID)
	}

	s.logger.Info("Tenant reactivated", zap.String("tenant_id", tenantID))

	return nil
}

// CheckLimit checks if tenant has exceeded a limit
func (s *Service) CheckLimit(ctx context.Context, tenantID string, limitType string, currentValue int) (bool, error) {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return false, err
	}

	var limit int
	switch limitType {
	case "products":
		limit = tenant.Limits.MaxProducts
	case "orders":
		limit = tenant.Limits.MaxOrders
	case "users":
		limit = tenant.Limits.MaxUsers
	case "api_requests":
		limit = tenant.Limits.MaxAPIRequests
	case "ai_requests":
		limit = tenant.Limits.AIRequestsLimit
	default:
		return false, fmt.Errorf("unknown limit type: %s", limitType)
	}

	// -1 means unlimited
	if limit == -1 {
		return false, nil
	}

	return currentValue >= limit, nil
}

// GetUsage retrieves current usage for a tenant
func (s *Service) GetUsage(ctx context.Context, tenantID string) (*UsageRecord, error) {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	if s.billing != nil && tenant.StripeID != "" {
		return s.billing.GetUsage(ctx, tenant.StripeID)
	}

	// Return empty usage if no billing provider
	return &UsageRecord{
		TenantID:   tenantID,
		Period:     time.Now().Format("2006-01"),
		RecordedAt: time.Now(),
	}, nil
}

// Helper functions

func (s *Service) generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return -1
	}, slug)
	return slug
}

func (s *Service) generateAPIKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "sk_" + hex.EncodeToString(bytes), nil
}

func (s *Service) slugExists(ctx context.Context, slug string) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM tenants WHERE slug = $1", slug,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Service) saveTenant(ctx context.Context, tenant *Tenant) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO tenants (
			id, slug, name, domain, plan, status, billing_email,
			stripe_customer_id, settings, limits, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		tenant.ID, tenant.Slug, tenant.Name, tenant.Domain,
		tenant.Plan, tenant.Status, tenant.BillingEmail,
		tenant.StripeID, tenant.Settings, tenant.Limits,
		tenant.Metadata, tenant.CreatedAt, tenant.UpdatedAt,
	)
	return err
}

func (s *Service) getTenantFromDB(ctx context.Context, tenantID string) (*Tenant, error) {
	tenant := &Tenant{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, slug, name, domain, plan, status, billing_email,
			   stripe_customer_id, settings, limits, metadata, created_at, updated_at
		FROM tenants WHERE id = $1
	`, tenantID).Scan(
		&tenant.ID, &tenant.Slug, &tenant.Name, &tenant.Domain,
		&tenant.Plan, &tenant.Status, &tenant.BillingEmail,
		&tenant.StripeID, &tenant.Settings, &tenant.Limits,
		&tenant.Metadata, &tenant.CreatedAt, &tenant.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("tenant not found")
	}
	return tenant, err
}

func (s *Service) getTenantBySlugFromDB(ctx context.Context, slug string) (*Tenant, error) {
	tenant := &Tenant{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, slug, name, domain, plan, status, billing_email,
			   stripe_customer_id, settings, limits, metadata, created_at, updated_at
		FROM tenants WHERE slug = $1
	`, slug).Scan(
		&tenant.ID, &tenant.Slug, &tenant.Name, &tenant.Domain,
		&tenant.Plan, &tenant.Status, &tenant.BillingEmail,
		&tenant.StripeID, &tenant.Settings, &tenant.Limits,
		&tenant.Metadata, &tenant.CreatedAt, &tenant.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("tenant not found")
	}
	return tenant, err
}

func (s *Service) updateTenantInDB(ctx context.Context, tenant *Tenant) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE tenants SET
			name = $2, domain = $3, plan = $4, status = $5,
			billing_email = $6, stripe_customer_id = $7,
			settings = $8, limits = $9, metadata = $10, updated_at = $11
		WHERE id = $1
	`,
		tenant.ID, tenant.Name, tenant.Domain, tenant.Plan, tenant.Status,
		tenant.BillingEmail, tenant.StripeID, tenant.Settings, tenant.Limits,
		tenant.Metadata, tenant.UpdatedAt,
	)
	return err
}
