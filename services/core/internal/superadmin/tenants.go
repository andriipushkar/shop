package superadmin

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Errors
var (
	ErrTenantNotFound      = errors.New("tenant not found")
	ErrTenantAlreadyExists = errors.New("tenant with this domain already exists")
	ErrInvalidDomain       = errors.New("invalid domain format")
	ErrInvalidPlan         = errors.New("invalid subscription plan")
	ErrProvisioningFailed  = errors.New("tenant provisioning failed")
	ErrTenantSuspended     = errors.New("tenant is suspended")
)

// TenantStatus represents tenant lifecycle status
type TenantStatus string

const (
	StatusPending    TenantStatus = "pending"
	StatusProvisioning TenantStatus = "provisioning"
	StatusActive     TenantStatus = "active"
	StatusSuspended  TenantStatus = "suspended"
	StatusDeleted    TenantStatus = "deleted"
)

// SubscriptionPlan represents pricing tiers
type SubscriptionPlan string

const (
	PlanStarter    SubscriptionPlan = "starter"
	PlanPro        SubscriptionPlan = "pro"
	PlanEnterprise SubscriptionPlan = "enterprise"
)

// PlanLimits defines limits for each plan
var PlanLimits = map[SubscriptionPlan]PlanLimit{
	PlanStarter: {
		MaxProducts:   100,
		MaxOrders:     500,
		MaxUsers:      2,
		MaxStorage:    1 * 1024 * 1024 * 1024, // 1GB
		APIRateLimit:  100,
		Features:      []string{"basic_analytics", "email_support"},
	},
	PlanPro: {
		MaxProducts:   10000,
		MaxOrders:     10000,
		MaxUsers:      10,
		MaxStorage:    10 * 1024 * 1024 * 1024, // 10GB
		APIRateLimit:  1000,
		Features:      []string{"advanced_analytics", "visual_search", "priority_support", "custom_domain"},
	},
	PlanEnterprise: {
		MaxProducts:   -1, // Unlimited
		MaxOrders:     -1,
		MaxUsers:      -1,
		MaxStorage:    100 * 1024 * 1024 * 1024, // 100GB
		APIRateLimit:  10000,
		Features:      []string{"unlimited", "fraud_detection", "cdp", "dedicated_support", "sla_99_9"},
	},
}

// PlanLimit defines resource limits
type PlanLimit struct {
	MaxProducts  int      `json:"max_products"`
	MaxOrders    int      `json:"max_orders"`
	MaxUsers     int      `json:"max_users"`
	MaxStorage   int64    `json:"max_storage_bytes"`
	APIRateLimit int      `json:"api_rate_limit"`
	Features     []string `json:"features"`
}

// Tenant represents a tenant in the system
type Tenant struct {
	ID              string           `json:"id"`
	Name            string           `json:"name"`
	Domain          string           `json:"domain"`
	CustomDomain    string           `json:"custom_domain,omitempty"`
	Status          TenantStatus     `json:"status"`
	Plan            SubscriptionPlan `json:"plan"`
	OwnerEmail      string           `json:"owner_email"`
	OwnerName       string           `json:"owner_name"`
	DatabaseSchema  string           `json:"database_schema"`
	SSLCertID       string           `json:"ssl_cert_id,omitempty"`
	APIKeyID        string           `json:"api_key_id,omitempty"`
	Settings        TenantSettings   `json:"settings"`
	Usage           TenantUsage      `json:"usage"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
	ProvisionedAt   *time.Time       `json:"provisioned_at,omitempty"`
	SuspendedAt     *time.Time       `json:"suspended_at,omitempty"`
	SuspendReason   string           `json:"suspend_reason,omitempty"`
}

// TenantSettings contains tenant-specific settings
type TenantSettings struct {
	Currency        string `json:"currency"`
	Timezone        string `json:"timezone"`
	Language        string `json:"language"`
	Logo            string `json:"logo,omitempty"`
	PrimaryColor    string `json:"primary_color"`
	EnabledFeatures []string `json:"enabled_features"`
}

// TenantUsage tracks resource usage
type TenantUsage struct {
	ProductCount    int   `json:"product_count"`
	OrderCount      int   `json:"order_count"`
	UserCount       int   `json:"user_count"`
	StorageUsed     int64 `json:"storage_used_bytes"`
	APICallsToday   int   `json:"api_calls_today"`
	APICallsMonth   int   `json:"api_calls_month"`
}

// CreateTenantInput for creating a new tenant
type CreateTenantInput struct {
	Name       string           `json:"name"`
	Domain     string           `json:"domain"`
	Plan       SubscriptionPlan `json:"plan"`
	OwnerEmail string           `json:"owner_email"`
	OwnerName  string           `json:"owner_name"`
	Settings   *TenantSettings  `json:"settings,omitempty"`
}

// UpdateTenantInput for updating tenant
type UpdateTenantInput struct {
	Name         *string           `json:"name,omitempty"`
	CustomDomain *string           `json:"custom_domain,omitempty"`
	Plan         *SubscriptionPlan `json:"plan,omitempty"`
	Settings     *TenantSettings   `json:"settings,omitempty"`
}

// ProvisioningResult contains provisioning results
type ProvisioningResult struct {
	TenantID       string `json:"tenant_id"`
	Domain         string `json:"domain"`
	DatabaseSchema string `json:"database_schema"`
	APIKey         string `json:"api_key"`
	SecretKey      string `json:"secret_key"`
	AdminURL       string `json:"admin_url"`
	StorefrontURL  string `json:"storefront_url"`
}

// Repository interface for tenant storage
type Repository interface {
	Create(ctx context.Context, tenant *Tenant) error
	GetByID(ctx context.Context, id string) (*Tenant, error)
	GetByDomain(ctx context.Context, domain string) (*Tenant, error)
	List(ctx context.Context, filter TenantFilter) ([]*Tenant, int, error)
	Update(ctx context.Context, tenant *Tenant) error
	Delete(ctx context.Context, id string) error
	UpdateUsage(ctx context.Context, id string, usage TenantUsage) error
}

// TenantFilter for listing tenants
type TenantFilter struct {
	Status   *TenantStatus
	Plan     *SubscriptionPlan
	Search   string
	Page     int
	PageSize int
}

// Provisioner interface for tenant provisioning
type Provisioner interface {
	CreateDatabaseSchema(ctx context.Context, schemaName string) error
	CreateDNSRecord(ctx context.Context, domain string) error
	ProvisionSSLCertificate(ctx context.Context, domain string) (string, error)
	CreateAPIKey(ctx context.Context, tenantID string) (apiKey, secretKey string, err error)
	CleanupProvisioning(ctx context.Context, tenant *Tenant) error
}

// Service handles super-admin operations
type Service struct {
	repo        Repository
	provisioner Provisioner
}

// NewService creates a new super-admin service
func NewService(repo Repository, provisioner Provisioner) *Service {
	return &Service{
		repo:        repo,
		provisioner: provisioner,
	}
}

// CreateTenant creates and provisions a new tenant
func (s *Service) CreateTenant(ctx context.Context, input CreateTenantInput) (*ProvisioningResult, error) {
	// Validate input
	if err := s.validateCreateInput(input); err != nil {
		return nil, err
	}

	// Check if domain already exists
	existing, _ := s.repo.GetByDomain(ctx, input.Domain)
	if existing != nil {
		return nil, ErrTenantAlreadyExists
	}

	// Create tenant record
	tenant := &Tenant{
		ID:             generateTenantID(),
		Name:           input.Name,
		Domain:         input.Domain,
		Status:         StatusProvisioning,
		Plan:           input.Plan,
		OwnerEmail:     input.OwnerEmail,
		OwnerName:      input.OwnerName,
		DatabaseSchema: generateSchemaName(input.Domain),
		Settings:       defaultSettings(input.Settings),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.repo.Create(ctx, tenant); err != nil {
		return nil, err
	}

	// Provision resources
	result, err := s.provisionTenant(ctx, tenant)
	if err != nil {
		tenant.Status = StatusPending
		tenant.SuspendReason = fmt.Sprintf("Provisioning failed: %v", err)
		s.repo.Update(ctx, tenant)
		return nil, ErrProvisioningFailed
	}

	// Mark as active
	now := time.Now()
	tenant.Status = StatusActive
	tenant.ProvisionedAt = &now
	tenant.APIKeyID = result.TenantID
	s.repo.Update(ctx, tenant)

	return result, nil
}

func (s *Service) provisionTenant(ctx context.Context, tenant *Tenant) (*ProvisioningResult, error) {
	result := &ProvisioningResult{
		TenantID:       tenant.ID,
		Domain:         tenant.Domain,
		DatabaseSchema: tenant.DatabaseSchema,
	}

	// Step 1: Create database schema
	if err := s.provisioner.CreateDatabaseSchema(ctx, tenant.DatabaseSchema); err != nil {
		return nil, fmt.Errorf("database schema: %w", err)
	}

	// Step 2: Create DNS record
	if err := s.provisioner.CreateDNSRecord(ctx, tenant.Domain); err != nil {
		s.provisioner.CleanupProvisioning(ctx, tenant)
		return nil, fmt.Errorf("DNS record: %w", err)
	}

	// Step 3: Provision SSL certificate
	certID, err := s.provisioner.ProvisionSSLCertificate(ctx, tenant.Domain)
	if err != nil {
		s.provisioner.CleanupProvisioning(ctx, tenant)
		return nil, fmt.Errorf("SSL certificate: %w", err)
	}
	tenant.SSLCertID = certID

	// Step 4: Create API keys
	apiKey, secretKey, err := s.provisioner.CreateAPIKey(ctx, tenant.ID)
	if err != nil {
		s.provisioner.CleanupProvisioning(ctx, tenant)
		return nil, fmt.Errorf("API key: %w", err)
	}
	result.APIKey = apiKey
	result.SecretKey = secretKey

	// Build URLs
	result.AdminURL = fmt.Sprintf("https://admin.%s.shop.com", tenant.Domain)
	result.StorefrontURL = fmt.Sprintf("https://%s.shop.com", tenant.Domain)

	return result, nil
}

// GetTenant retrieves a tenant by ID
func (s *Service) GetTenant(ctx context.Context, id string) (*Tenant, error) {
	return s.repo.GetByID(ctx, id)
}

// GetTenantByDomain retrieves a tenant by domain
func (s *Service) GetTenantByDomain(ctx context.Context, domain string) (*Tenant, error) {
	return s.repo.GetByDomain(ctx, domain)
}

// ListTenants returns filtered list of tenants
func (s *Service) ListTenants(ctx context.Context, filter TenantFilter) ([]*Tenant, int, error) {
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}
	if filter.Page == 0 {
		filter.Page = 1
	}
	return s.repo.List(ctx, filter)
}

// UpdateTenant updates tenant details
func (s *Service) UpdateTenant(ctx context.Context, id string, input UpdateTenantInput) (*Tenant, error) {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if input.Name != nil {
		tenant.Name = *input.Name
	}
	if input.CustomDomain != nil {
		tenant.CustomDomain = *input.CustomDomain
	}
	if input.Plan != nil {
		if !isValidPlan(*input.Plan) {
			return nil, ErrInvalidPlan
		}
		tenant.Plan = *input.Plan
	}
	if input.Settings != nil {
		tenant.Settings = *input.Settings
	}

	tenant.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, tenant); err != nil {
		return nil, err
	}

	return tenant, nil
}

// SuspendTenant suspends a tenant
func (s *Service) SuspendTenant(ctx context.Context, id, reason string) error {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	now := time.Now()
	tenant.Status = StatusSuspended
	tenant.SuspendedAt = &now
	tenant.SuspendReason = reason
	tenant.UpdatedAt = now

	return s.repo.Update(ctx, tenant)
}

// ReactivateTenant reactivates a suspended tenant
func (s *Service) ReactivateTenant(ctx context.Context, id string) error {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if tenant.Status != StatusSuspended {
		return errors.New("tenant is not suspended")
	}

	tenant.Status = StatusActive
	tenant.SuspendedAt = nil
	tenant.SuspendReason = ""
	tenant.UpdatedAt = time.Now()

	return s.repo.Update(ctx, tenant)
}

// DeleteTenant soft-deletes a tenant
func (s *Service) DeleteTenant(ctx context.Context, id string) error {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	tenant.Status = StatusDeleted
	tenant.UpdatedAt = time.Now()

	return s.repo.Update(ctx, tenant)
}

// GetUsage returns current usage for a tenant
func (s *Service) GetUsage(ctx context.Context, id string) (*TenantUsage, *PlanLimit, error) {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	limit, ok := PlanLimits[tenant.Plan]
	if !ok {
		return nil, nil, ErrInvalidPlan
	}

	return &tenant.Usage, &limit, nil
}

// CheckLimit checks if tenant is within limits
func (s *Service) CheckLimit(ctx context.Context, id string, resource string) (bool, error) {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return false, err
	}

	limit, ok := PlanLimits[tenant.Plan]
	if !ok {
		return false, ErrInvalidPlan
	}

	switch resource {
	case "products":
		if limit.MaxProducts == -1 {
			return true, nil
		}
		return tenant.Usage.ProductCount < limit.MaxProducts, nil
	case "orders":
		if limit.MaxOrders == -1 {
			return true, nil
		}
		return tenant.Usage.OrderCount < limit.MaxOrders, nil
	case "users":
		if limit.MaxUsers == -1 {
			return true, nil
		}
		return tenant.Usage.UserCount < limit.MaxUsers, nil
	case "storage":
		return tenant.Usage.StorageUsed < limit.MaxStorage, nil
	case "api":
		return tenant.Usage.APICallsToday < limit.APIRateLimit, nil
	default:
		return false, errors.New("unknown resource type")
	}
}

// HasFeature checks if tenant has access to a feature
func (s *Service) HasFeature(ctx context.Context, id, feature string) (bool, error) {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return false, err
	}

	limit, ok := PlanLimits[tenant.Plan]
	if !ok {
		return false, ErrInvalidPlan
	}

	// Check for unlimited feature
	for _, f := range limit.Features {
		if f == "unlimited" || f == feature {
			return true, nil
		}
	}

	// Check tenant-specific enabled features
	for _, f := range tenant.Settings.EnabledFeatures {
		if f == feature {
			return true, nil
		}
	}

	return false, nil
}

// GetStats returns platform-wide statistics
func (s *Service) GetStats(ctx context.Context) (*PlatformStats, error) {
	allTenants, total, err := s.repo.List(ctx, TenantFilter{PageSize: 10000})
	if err != nil {
		return nil, err
	}

	stats := &PlatformStats{
		TotalTenants: total,
	}

	for _, t := range allTenants {
		switch t.Status {
		case StatusActive:
			stats.ActiveTenants++
		case StatusSuspended:
			stats.SuspendedTenants++
		}

		switch t.Plan {
		case PlanStarter:
			stats.StarterPlans++
		case PlanPro:
			stats.ProPlans++
		case PlanEnterprise:
			stats.EnterprisePlans++
		}

		stats.TotalProducts += t.Usage.ProductCount
		stats.TotalOrders += t.Usage.OrderCount
	}

	return stats, nil
}

// PlatformStats contains platform-wide statistics
type PlatformStats struct {
	TotalTenants     int `json:"total_tenants"`
	ActiveTenants    int `json:"active_tenants"`
	SuspendedTenants int `json:"suspended_tenants"`
	StarterPlans     int `json:"starter_plans"`
	ProPlans         int `json:"pro_plans"`
	EnterprisePlans  int `json:"enterprise_plans"`
	TotalProducts    int `json:"total_products"`
	TotalOrders      int `json:"total_orders"`
}

// Helper functions

func (s *Service) validateCreateInput(input CreateTenantInput) error {
	if input.Name == "" {
		return errors.New("name is required")
	}
	if input.Domain == "" {
		return errors.New("domain is required")
	}
	if !isValidDomain(input.Domain) {
		return ErrInvalidDomain
	}
	if !isValidPlan(input.Plan) {
		return ErrInvalidPlan
	}
	if input.OwnerEmail == "" {
		return errors.New("owner email is required")
	}
	return nil
}

func isValidDomain(domain string) bool {
	// Simple domain validation
	re := regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$`)
	return re.MatchString(strings.ToLower(domain)) && len(domain) >= 3 && len(domain) <= 50
}

func isValidPlan(plan SubscriptionPlan) bool {
	switch plan {
	case PlanStarter, PlanPro, PlanEnterprise:
		return true
	}
	return false
}

func generateTenantID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return "ten_" + hex.EncodeToString(bytes)
}

func generateSchemaName(domain string) string {
	// Sanitize domain for schema name
	schema := strings.ReplaceAll(domain, "-", "_")
	schema = strings.ReplaceAll(schema, ".", "_")
	return "tenant_" + schema
}

func defaultSettings(input *TenantSettings) TenantSettings {
	settings := TenantSettings{
		Currency:     "UAH",
		Timezone:     "Europe/Kiev",
		Language:     "uk",
		PrimaryColor: "#3B82F6",
	}
	if input != nil {
		if input.Currency != "" {
			settings.Currency = input.Currency
		}
		if input.Timezone != "" {
			settings.Timezone = input.Timezone
		}
		if input.Language != "" {
			settings.Language = input.Language
		}
		if input.PrimaryColor != "" {
			settings.PrimaryColor = input.PrimaryColor
		}
		settings.EnabledFeatures = input.EnabledFeatures
	}
	return settings
}
