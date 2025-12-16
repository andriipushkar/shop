# Tenant Module

Multi-tenancy реалізація та ізоляція даних.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANCY ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request Flow:                                                              │
│                                                                              │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ Request  │──▶│ Domain       │──▶│ Tenant       │──▶│ Service      │    │
│  │          │   │ Resolution   │   │ Context      │   │ Layer        │    │
│  └──────────┘   └──────────────┘   └──────────────┘   └──────────────┘    │
│                        │                 │                    │            │
│                        ▼                 ▼                    ▼            │
│               ┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│               │ DNS/Domain   │   │ Middleware   │   │ Row-Level    │      │
│               │ Lookup       │   │ Injection    │   │ Security     │      │
│               └──────────────┘   └──────────────┘   └──────────────┘      │
│                                                                              │
│  Isolation Strategies:                                                      │
│  ├── Shared Database, Shared Schema (tenant_id column)                     │
│  ├── Row-Level Security (PostgreSQL RLS)                                   │
│  └── Application-level filtering                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Domain Resolution

### Tenant Identification

```go
// pkg/tenant/resolver.go
package tenant

import (
    "context"
    "net/http"
    "strings"
)

type Resolver struct {
    repo   TenantRepository
    cache  Cache
}

func NewResolver(repo TenantRepository, cache Cache) *Resolver {
    return &Resolver{repo: repo, cache: cache}
}

// ResolveFromRequest extracts tenant from HTTP request
func (r *Resolver) ResolveFromRequest(req *http.Request) (*Tenant, error) {
    // 1. Check header (API clients)
    if tenantID := req.Header.Get("X-Tenant-ID"); tenantID != "" {
        return r.GetByID(req.Context(), tenantID)
    }

    // 2. Check subdomain (shop.platform.ua)
    host := req.Host
    if strings.HasSuffix(host, ".platform.ua") {
        subdomain := strings.TrimSuffix(host, ".platform.ua")
        return r.GetBySubdomain(req.Context(), subdomain)
    }

    // 3. Check custom domain (shop.ua)
    return r.GetByDomain(req.Context(), host)
}

// GetByID retrieves tenant by ID
func (r *Resolver) GetByID(ctx context.Context, id string) (*Tenant, error) {
    // Check cache
    cacheKey := "tenant:id:" + id
    if cached, err := r.cache.Get(ctx, cacheKey); err == nil {
        return cached.(*Tenant), nil
    }

    // Get from database
    tenant, err := r.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Cache for 5 minutes
    r.cache.Set(ctx, cacheKey, tenant, 5*time.Minute)

    return tenant, nil
}

// GetByDomain retrieves tenant by custom domain
func (r *Resolver) GetByDomain(ctx context.Context, domain string) (*Tenant, error) {
    cacheKey := "tenant:domain:" + domain
    if cached, err := r.cache.Get(ctx, cacheKey); err == nil {
        return cached.(*Tenant), nil
    }

    tenant, err := r.repo.FindByDomain(ctx, domain)
    if err != nil {
        return nil, ErrTenantNotFound
    }

    r.cache.Set(ctx, cacheKey, tenant, 5*time.Minute)
    return tenant, nil
}

// GetBySubdomain retrieves tenant by subdomain
func (r *Resolver) GetBySubdomain(ctx context.Context, subdomain string) (*Tenant, error) {
    cacheKey := "tenant:subdomain:" + subdomain
    if cached, err := r.cache.Get(ctx, cacheKey); err == nil {
        return cached.(*Tenant), nil
    }

    tenant, err := r.repo.FindBySubdomain(ctx, subdomain)
    if err != nil {
        return nil, ErrTenantNotFound
    }

    r.cache.Set(ctx, cacheKey, tenant, 5*time.Minute)
    return tenant, nil
}
```

## Tenant Context

```go
// pkg/tenant/context.go
package tenant

import (
    "context"
)

type contextKey struct{}

// WithTenant adds tenant to context
func WithTenant(ctx context.Context, tenant *Tenant) context.Context {
    return context.WithValue(ctx, contextKey{}, tenant)
}

// FromContext retrieves tenant from context
func FromContext(ctx context.Context) (*Tenant, bool) {
    tenant, ok := ctx.Value(contextKey{}).(*Tenant)
    return tenant, ok
}

// MustFromContext retrieves tenant or panics
func MustFromContext(ctx context.Context) *Tenant {
    tenant, ok := FromContext(ctx)
    if !ok {
        panic("tenant not found in context")
    }
    return tenant
}

// IDFromContext retrieves tenant ID from context
func IDFromContext(ctx context.Context) string {
    if tenant, ok := FromContext(ctx); ok {
        return tenant.ID
    }
    return ""
}
```

## Middleware

```go
// pkg/tenant/middleware.go
package tenant

import (
    "net/http"
)

func Middleware(resolver *Resolver) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tenant, err := resolver.ResolveFromRequest(r)
            if err != nil {
                http.Error(w, "Tenant not found", http.StatusNotFound)
                return
            }

            // Check tenant status
            if tenant.Status != TenantStatusActive {
                http.Error(w, "Tenant suspended", http.StatusForbidden)
                return
            }

            // Add tenant to context
            ctx := WithTenant(r.Context(), tenant)

            // Set PostgreSQL tenant context for RLS
            if db := DatabaseFromContext(ctx); db != nil {
                db.Exec("SET app.tenant_id = $1", tenant.ID)
            }

            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

## Row-Level Security

### PostgreSQL RLS Setup

```sql
-- Enable RLS on tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY tenant_isolation_products ON products
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation_orders ON orders
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation_customers ON customers
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Policy for insert (ensure tenant_id is set correctly)
CREATE POLICY tenant_insert_products ON products
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

-- Bypass policy for superadmin
CREATE ROLE superadmin;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
GRANT BYPASSRLS ON products TO superadmin;
```

### Application-Level Enforcement

```go
// pkg/tenant/repository.go
package tenant

import (
    "context"
    "database/sql"
)

// TenantAwareRepository wraps repository with tenant filtering
type TenantAwareRepository struct {
    db *sql.DB
}

func (r *TenantAwareRepository) Find(ctx context.Context, id string) (*Product, error) {
    tenantID := IDFromContext(ctx)
    if tenantID == "" {
        return nil, ErrNoTenantContext
    }

    query := `
        SELECT id, name, price
        FROM products
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `

    row := r.db.QueryRowContext(ctx, query, id, tenantID)
    // ...
}

func (r *TenantAwareRepository) Create(ctx context.Context, product *Product) error {
    tenantID := IDFromContext(ctx)
    if tenantID == "" {
        return ErrNoTenantContext
    }

    // Ensure tenant_id is set
    product.TenantID = tenantID

    query := `
        INSERT INTO products (id, tenant_id, name, price)
        VALUES ($1, $2, $3, $4)
    `

    _, err := r.db.ExecContext(ctx, query, product.ID, product.TenantID, product.Name, product.Price)
    return err
}
```

## Tenant Model

```go
// pkg/tenant/model.go
package tenant

import (
    "time"
)

type Tenant struct {
    ID          string         `json:"id"`
    Name        string         `json:"name"`
    Subdomain   string         `json:"subdomain"`
    Domain      string         `json:"domain,omitempty"`
    Plan        string         `json:"plan"`
    Status      TenantStatus   `json:"status"`
    Settings    TenantSettings `json:"settings"`

    // Limits based on plan
    MaxProducts   int `json:"max_products"`
    MaxOrders     int `json:"max_orders_per_month"`
    MaxStorage    int `json:"max_storage_mb"`
    MaxUsers      int `json:"max_users"`

    // Dates
    TrialEndsAt   *time.Time `json:"trial_ends_at,omitempty"`
    CreatedAt     time.Time  `json:"created_at"`
    UpdatedAt     time.Time  `json:"updated_at"`
}

type TenantStatus string

const (
    TenantStatusPending   TenantStatus = "pending"
    TenantStatusActive    TenantStatus = "active"
    TenantStatusSuspended TenantStatus = "suspended"
    TenantStatusCancelled TenantStatus = "cancelled"
)

type TenantSettings struct {
    Currency        string            `json:"currency"`
    Country         string            `json:"country"`
    Timezone        string            `json:"timezone"`
    Language        string            `json:"language"`
    Logo            string            `json:"logo"`
    Favicon         string            `json:"favicon"`
    PrimaryColor    string            `json:"primary_color"`
    SocialLinks     map[string]string `json:"social_links"`
    EmailSettings   EmailSettings     `json:"email_settings"`
    PaymentSettings PaymentSettings   `json:"payment_settings"`
}
```

## Tenant Service

```go
// services/core/internal/tenant/service.go
package tenant

type Service struct {
    repo      TenantRepository
    cache     Cache
    events    EventPublisher
    billing   BillingService
}

// Create creates a new tenant
func (s *Service) Create(ctx context.Context, req *CreateTenantRequest) (*Tenant, error) {
    // Validate subdomain uniqueness
    if exists, _ := s.repo.ExistsBySubdomain(ctx, req.Subdomain); exists {
        return nil, ErrSubdomainTaken
    }

    // Create tenant
    tenant := &Tenant{
        ID:        uuid.New().String(),
        Name:      req.Name,
        Subdomain: req.Subdomain,
        Plan:      req.Plan,
        Status:    TenantStatusActive,
        Settings: TenantSettings{
            Currency: "UAH",
            Country:  "UA",
            Timezone: "Europe/Kiev",
            Language: "uk",
        },
    }

    // Set plan limits
    s.applyPlanLimits(tenant)

    // Set trial if applicable
    if req.Plan == "trial" {
        trialEnd := time.Now().AddDate(0, 0, 14)
        tenant.TrialEndsAt = &trialEnd
    }

    if err := s.repo.Create(ctx, tenant); err != nil {
        return nil, err
    }

    // Initialize tenant resources
    s.initializeTenant(ctx, tenant)

    // Publish event
    s.events.Publish(ctx, &events.TenantCreated{
        TenantID: tenant.ID,
        Plan:     tenant.Plan,
    })

    return tenant, nil
}

// SetupCustomDomain configures custom domain for tenant
func (s *Service) SetupCustomDomain(ctx context.Context, tenantID, domain string) error {
    tenant, err := s.repo.FindByID(ctx, tenantID)
    if err != nil {
        return err
    }

    // Validate domain ownership (DNS verification)
    if err := s.verifyDomainOwnership(ctx, domain); err != nil {
        return fmt.Errorf("domain verification failed: %w", err)
    }

    // Check domain not already used
    if existing, _ := s.repo.FindByDomain(ctx, domain); existing != nil {
        return ErrDomainAlreadyUsed
    }

    tenant.Domain = domain
    if err := s.repo.Update(ctx, tenant); err != nil {
        return err
    }

    // Setup SSL certificate
    s.setupSSL(ctx, domain)

    // Invalidate cache
    s.cache.Delete(ctx, "tenant:id:"+tenant.ID)

    return nil
}

// CheckLimits checks if tenant has exceeded any limits
func (s *Service) CheckLimits(ctx context.Context, tenantID string, limitType string) error {
    tenant, err := s.repo.FindByID(ctx, tenantID)
    if err != nil {
        return err
    }

    switch limitType {
    case "products":
        count, _ := s.productRepo.CountByTenant(ctx, tenantID)
        if count >= tenant.MaxProducts {
            return ErrProductLimitReached
        }
    case "orders":
        count, _ := s.orderRepo.CountThisMonth(ctx, tenantID)
        if count >= tenant.MaxOrders {
            return ErrOrderLimitReached
        }
    case "storage":
        used, _ := s.storageRepo.GetUsed(ctx, tenantID)
        if used >= int64(tenant.MaxStorage)*1024*1024 {
            return ErrStorageLimitReached
        }
    }

    return nil
}
```

## Database Schema

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',

    -- Settings (JSONB for flexibility)
    settings JSONB DEFAULT '{}',

    -- Limits
    max_products INTEGER DEFAULT 100,
    max_orders INTEGER DEFAULT 500,
    max_storage_mb INTEGER DEFAULT 1024,
    max_users INTEGER DEFAULT 3,

    -- Trial
    trial_ends_at TIMESTAMP,

    -- Billing
    stripe_customer_id VARCHAR(255),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_tenants_status ON tenants(status);
```

## Plan Configuration

```go
var Plans = map[string]PlanConfig{
    "starter": {
        MaxProducts: 100,
        MaxOrders:   500,
        MaxStorage:  1024, // 1GB
        MaxUsers:    3,
        Features: []string{
            "basic_analytics",
            "email_support",
        },
    },
    "business": {
        MaxProducts: 1000,
        MaxOrders:   5000,
        MaxStorage:  10240, // 10GB
        MaxUsers:    10,
        Features: []string{
            "advanced_analytics",
            "api_access",
            "custom_domain",
            "priority_support",
        },
    },
    "enterprise": {
        MaxProducts: -1, // unlimited
        MaxOrders:   -1,
        MaxStorage:  102400, // 100GB
        MaxUsers:    -1,
        Features: []string{
            "all_features",
            "dedicated_support",
            "sla",
            "custom_integrations",
        },
    },
}
```

## See Also

- [Multi-Tenancy Architecture](../architecture/MULTI_TENANCY.md)
- [Onboarding Module](./ONBOARDING.md)
- [Authentication](./AUTH.md)
- [Billing](./BILLING.md)
