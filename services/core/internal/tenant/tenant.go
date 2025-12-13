package tenant

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	ErrTenantNotFound     = errors.New("tenant not found")
	ErrTenantInactive     = errors.New("tenant is inactive")
	ErrTenantSuspended    = errors.New("tenant is suspended")
	ErrMissingTenantID    = errors.New("missing tenant ID")
	ErrInvalidTenantID    = errors.New("invalid tenant ID")
	ErrTenantQuotaExceeded = errors.New("tenant quota exceeded")
)

// TenantStatus represents tenant status
type TenantStatus string

const (
	StatusActive    TenantStatus = "active"
	StatusInactive  TenantStatus = "inactive"
	StatusSuspended TenantStatus = "suspended"
	StatusTrial     TenantStatus = "trial"
)

// TenantPlan represents subscription plan
type TenantPlan string

const (
	PlanFree       TenantPlan = "free"
	PlanStarter    TenantPlan = "starter"
	PlanProfessional TenantPlan = "professional"
	PlanEnterprise TenantPlan = "enterprise"
)

// Tenant represents a store/shop tenant
type Tenant struct {
	ID            string       `json:"id"`
	Slug          string       `json:"slug"`
	Name          string       `json:"name"`
	Domain        string       `json:"domain,omitempty"`
	CustomDomain  string       `json:"custom_domain,omitempty"`
	Status        TenantStatus `json:"status"`
	Plan          TenantPlan   `json:"plan"`
	OwnerID       string       `json:"owner_id"`

	// Settings
	Settings      TenantSettings `json:"settings"`

	// Quotas
	ProductLimit  int          `json:"product_limit"`
	OrderLimit    int          `json:"order_limit"`
	StorageLimit  int64        `json:"storage_limit"` // in bytes

	// Usage
	ProductCount  int          `json:"product_count"`
	OrderCount    int          `json:"order_count"`
	StorageUsed   int64        `json:"storage_used"`

	// Dates
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
	TrialEndsAt   *time.Time   `json:"trial_ends_at,omitempty"`
	SuspendedAt   *time.Time   `json:"suspended_at,omitempty"`
}

// TenantSettings holds tenant-specific configuration
type TenantSettings struct {
	Currency        string            `json:"currency"`
	Language        string            `json:"language"`
	Timezone        string            `json:"timezone"`
	Theme           string            `json:"theme"`
	Logo            string            `json:"logo,omitempty"`
	Favicon         string            `json:"favicon,omitempty"`
	PrimaryColor    string            `json:"primary_color"`
	Features        map[string]bool   `json:"features"`
	Integrations    map[string]string `json:"integrations"`
	PaymentMethods  []string          `json:"payment_methods"`
	ShippingMethods []string          `json:"shipping_methods"`
}

// DefaultTenantSettings returns default settings
func DefaultTenantSettings() TenantSettings {
	return TenantSettings{
		Currency:     "UAH",
		Language:     "uk",
		Timezone:     "Europe/Kyiv",
		Theme:        "default",
		PrimaryColor: "#3B82F6",
		Features: map[string]bool{
			"reviews":     true,
			"wishlist":    true,
			"comparison":  true,
			"loyalty":     false,
			"b2b":         false,
			"multiwarehouse": false,
		},
		PaymentMethods:  []string{"cod"},
		ShippingMethods: []string{"novaposhta"},
	}
}

// PlanLimits returns limits for each plan
func PlanLimits(plan TenantPlan) (products, orders int, storage int64) {
	switch plan {
	case PlanFree:
		return 50, 100, 100 * 1024 * 1024 // 100MB
	case PlanStarter:
		return 500, 1000, 1 * 1024 * 1024 * 1024 // 1GB
	case PlanProfessional:
		return 5000, 10000, 10 * 1024 * 1024 * 1024 // 10GB
	case PlanEnterprise:
		return 0, 0, 0 // unlimited
	default:
		return 50, 100, 100 * 1024 * 1024
	}
}

// Context key for tenant
type contextKey string

const TenantContextKey contextKey = "tenant"
const TenantIDContextKey contextKey = "tenant_id"

// GetTenantFromContext retrieves tenant from context
func GetTenantFromContext(ctx context.Context) (*Tenant, bool) {
	tenant, ok := ctx.Value(TenantContextKey).(*Tenant)
	return tenant, ok
}

// GetTenantIDFromContext retrieves tenant ID from context
func GetTenantIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(TenantIDContextKey).(string)
	return id, ok
}

// SetTenantToContext sets tenant to context
func SetTenantToContext(ctx context.Context, tenant *Tenant) context.Context {
	ctx = context.WithValue(ctx, TenantContextKey, tenant)
	ctx = context.WithValue(ctx, TenantIDContextKey, tenant.ID)
	return ctx
}

// Repository interface for tenant storage
type Repository interface {
	GetByID(ctx context.Context, id string) (*Tenant, error)
	GetBySlug(ctx context.Context, slug string) (*Tenant, error)
	GetByDomain(ctx context.Context, domain string) (*Tenant, error)
	Create(ctx context.Context, tenant *Tenant) error
	Update(ctx context.Context, tenant *Tenant) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, offset, limit int) ([]*Tenant, int, error)
	IncrementUsage(ctx context.Context, tenantID string, products, orders int, storage int64) error
}

// Service handles tenant operations
type Service struct {
	repo  Repository
	cache *TenantCache
}

// NewService creates a new tenant service
func NewService(repo Repository) *Service {
	return &Service{
		repo:  repo,
		cache: NewTenantCache(5 * time.Minute),
	}
}

// GetTenant retrieves tenant by ID with caching
func (s *Service) GetTenant(ctx context.Context, id string) (*Tenant, error) {
	// Try cache first
	if tenant := s.cache.Get(id); tenant != nil {
		return tenant, nil
	}

	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	s.cache.Set(tenant)
	return tenant, nil
}

// ResolveTenant resolves tenant from request
func (s *Service) ResolveTenant(ctx context.Context, host string) (*Tenant, error) {
	// Try to resolve by subdomain first (store1.myshop.com)
	parts := strings.Split(host, ".")
	if len(parts) >= 3 {
		slug := parts[0]
		if tenant := s.cache.GetBySlug(slug); tenant != nil {
			return tenant, nil
		}

		tenant, err := s.repo.GetBySlug(ctx, slug)
		if err == nil {
			s.cache.Set(tenant)
			return tenant, nil
		}
	}

	// Try custom domain
	if tenant := s.cache.GetByDomain(host); tenant != nil {
		return tenant, nil
	}

	tenant, err := s.repo.GetByDomain(ctx, host)
	if err != nil {
		return nil, ErrTenantNotFound
	}

	s.cache.Set(tenant)
	return tenant, nil
}

// ValidateTenant validates tenant status
func (s *Service) ValidateTenant(tenant *Tenant) error {
	switch tenant.Status {
	case StatusInactive:
		return ErrTenantInactive
	case StatusSuspended:
		return ErrTenantSuspended
	case StatusTrial:
		if tenant.TrialEndsAt != nil && time.Now().After(*tenant.TrialEndsAt) {
			return ErrTenantSuspended
		}
	}
	return nil
}

// CheckQuota checks if tenant has quota available
func (s *Service) CheckQuota(tenant *Tenant, resourceType string) error {
	if tenant.Plan == PlanEnterprise {
		return nil // Unlimited
	}

	switch resourceType {
	case "product":
		if tenant.ProductLimit > 0 && tenant.ProductCount >= tenant.ProductLimit {
			return ErrTenantQuotaExceeded
		}
	case "order":
		if tenant.OrderLimit > 0 && tenant.OrderCount >= tenant.OrderLimit {
			return ErrTenantQuotaExceeded
		}
	case "storage":
		if tenant.StorageLimit > 0 && tenant.StorageUsed >= tenant.StorageLimit {
			return ErrTenantQuotaExceeded
		}
	}

	return nil
}

// TenantCache provides in-memory caching for tenants
type TenantCache struct {
	byID     map[string]*cachedTenant
	bySlug   map[string]*cachedTenant
	byDomain map[string]*cachedTenant
	ttl      time.Duration
	mu       sync.RWMutex
}

type cachedTenant struct {
	tenant    *Tenant
	expiresAt time.Time
}

// NewTenantCache creates a new tenant cache
func NewTenantCache(ttl time.Duration) *TenantCache {
	return &TenantCache{
		byID:     make(map[string]*cachedTenant),
		bySlug:   make(map[string]*cachedTenant),
		byDomain: make(map[string]*cachedTenant),
		ttl:      ttl,
	}
}

// Get retrieves tenant by ID from cache
func (c *TenantCache) Get(id string) *Tenant {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if cached, ok := c.byID[id]; ok && time.Now().Before(cached.expiresAt) {
		return cached.tenant
	}
	return nil
}

// GetBySlug retrieves tenant by slug from cache
func (c *TenantCache) GetBySlug(slug string) *Tenant {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if cached, ok := c.bySlug[slug]; ok && time.Now().Before(cached.expiresAt) {
		return cached.tenant
	}
	return nil
}

// GetByDomain retrieves tenant by domain from cache
func (c *TenantCache) GetByDomain(domain string) *Tenant {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if cached, ok := c.byDomain[domain]; ok && time.Now().Before(cached.expiresAt) {
		return cached.tenant
	}
	return nil
}

// Set stores tenant in cache
func (c *TenantCache) Set(tenant *Tenant) {
	c.mu.Lock()
	defer c.mu.Unlock()

	cached := &cachedTenant{
		tenant:    tenant,
		expiresAt: time.Now().Add(c.ttl),
	}

	c.byID[tenant.ID] = cached
	c.bySlug[tenant.Slug] = cached
	if tenant.CustomDomain != "" {
		c.byDomain[tenant.CustomDomain] = cached
	}
}

// Invalidate removes tenant from cache
func (c *TenantCache) Invalidate(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if cached, ok := c.byID[id]; ok {
		delete(c.bySlug, cached.tenant.Slug)
		if cached.tenant.CustomDomain != "" {
			delete(c.byDomain, cached.tenant.CustomDomain)
		}
		delete(c.byID, id)
	}
}

// Middleware creates tenant resolution middleware
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to get tenant from header first (for API calls)
		tenantID := r.Header.Get("X-Tenant-ID")

		var tenant *Tenant
		var err error

		if tenantID != "" {
			tenant, err = s.GetTenant(r.Context(), tenantID)
		} else {
			// Resolve from host
			tenant, err = s.ResolveTenant(r.Context(), r.Host)
		}

		if err != nil {
			http.Error(w, `{"error": "tenant not found"}`, http.StatusNotFound)
			return
		}

		if err := s.ValidateTenant(tenant); err != nil {
			status := http.StatusForbidden
			msg := "tenant inactive"
			if err == ErrTenantSuspended {
				msg = "tenant suspended"
			}
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, msg), status)
			return
		}

		ctx := SetTenantToContext(r.Context(), tenant)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// PostgresRepository implements Repository using PostgreSQL
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a new PostgreSQL repository
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// GetByID retrieves tenant by ID
func (r *PostgresRepository) GetByID(ctx context.Context, id string) (*Tenant, error) {
	query := `
		SELECT id, slug, name, domain, custom_domain, status, plan, owner_id,
			   product_limit, order_limit, storage_limit,
			   product_count, order_count, storage_used,
			   settings, created_at, updated_at, trial_ends_at, suspended_at
		FROM tenants WHERE id = $1
	`

	var tenant Tenant
	var settings []byte
	var domain, customDomain sql.NullString
	var trialEndsAt, suspendedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&tenant.ID, &tenant.Slug, &tenant.Name, &domain, &customDomain,
		&tenant.Status, &tenant.Plan, &tenant.OwnerID,
		&tenant.ProductLimit, &tenant.OrderLimit, &tenant.StorageLimit,
		&tenant.ProductCount, &tenant.OrderCount, &tenant.StorageUsed,
		&settings, &tenant.CreatedAt, &tenant.UpdatedAt, &trialEndsAt, &suspendedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrTenantNotFound
	}
	if err != nil {
		return nil, err
	}

	if domain.Valid {
		tenant.Domain = domain.String
	}
	if customDomain.Valid {
		tenant.CustomDomain = customDomain.String
	}
	if trialEndsAt.Valid {
		tenant.TrialEndsAt = &trialEndsAt.Time
	}
	if suspendedAt.Valid {
		tenant.SuspendedAt = &suspendedAt.Time
	}

	return &tenant, nil
}

// GetBySlug retrieves tenant by slug
func (r *PostgresRepository) GetBySlug(ctx context.Context, slug string) (*Tenant, error) {
	query := `
		SELECT id FROM tenants WHERE slug = $1
	`
	var id string
	err := r.db.QueryRowContext(ctx, query, slug).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, ErrTenantNotFound
	}
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

// GetByDomain retrieves tenant by domain
func (r *PostgresRepository) GetByDomain(ctx context.Context, domain string) (*Tenant, error) {
	query := `
		SELECT id FROM tenants WHERE custom_domain = $1 OR domain = $1
	`
	var id string
	err := r.db.QueryRowContext(ctx, query, domain).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, ErrTenantNotFound
	}
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

// Create creates a new tenant
func (r *PostgresRepository) Create(ctx context.Context, tenant *Tenant) error {
	query := `
		INSERT INTO tenants (id, slug, name, domain, custom_domain, status, plan, owner_id,
							 product_limit, order_limit, storage_limit, settings,
							 created_at, updated_at, trial_ends_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := r.db.ExecContext(ctx, query,
		tenant.ID, tenant.Slug, tenant.Name, tenant.Domain, tenant.CustomDomain,
		tenant.Status, tenant.Plan, tenant.OwnerID,
		tenant.ProductLimit, tenant.OrderLimit, tenant.StorageLimit,
		"{}", tenant.CreatedAt, tenant.UpdatedAt, tenant.TrialEndsAt,
	)
	return err
}

// Update updates an existing tenant
func (r *PostgresRepository) Update(ctx context.Context, tenant *Tenant) error {
	query := `
		UPDATE tenants SET
			name = $2, domain = $3, custom_domain = $4, status = $5, plan = $6,
			product_limit = $7, order_limit = $8, storage_limit = $9,
			updated_at = $10, trial_ends_at = $11, suspended_at = $12
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		tenant.ID, tenant.Name, tenant.Domain, tenant.CustomDomain,
		tenant.Status, tenant.Plan,
		tenant.ProductLimit, tenant.OrderLimit, tenant.StorageLimit,
		time.Now(), tenant.TrialEndsAt, tenant.SuspendedAt,
	)
	return err
}

// Delete deletes a tenant
func (r *PostgresRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tenants WHERE id = $1", id)
	return err
}

// List lists all tenants with pagination
func (r *PostgresRepository) List(ctx context.Context, offset, limit int) ([]*Tenant, int, error) {
	var total int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tenants").Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, slug, name, status, plan, owner_id, created_at
		FROM tenants
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var tenants []*Tenant
	for rows.Next() {
		var tenant Tenant
		if err := rows.Scan(&tenant.ID, &tenant.Slug, &tenant.Name,
			&tenant.Status, &tenant.Plan, &tenant.OwnerID, &tenant.CreatedAt); err != nil {
			return nil, 0, err
		}
		tenants = append(tenants, &tenant)
	}

	return tenants, total, nil
}

// IncrementUsage increments usage counters
func (r *PostgresRepository) IncrementUsage(ctx context.Context, tenantID string, products, orders int, storage int64) error {
	query := `
		UPDATE tenants SET
			product_count = product_count + $2,
			order_count = order_count + $3,
			storage_used = storage_used + $4
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query, tenantID, products, orders, storage)
	return err
}
