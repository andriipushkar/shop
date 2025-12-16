# Multi-tenancy Architecture

Архітектура мультитенантності для ізоляції даних та ресурсів між різними клієнтами (магазинами) платформи.

## Огляд

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-tenant Platform                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │
│   │ Tenant A│   │ Tenant B│   │ Tenant C│   │ Tenant D│        │
│   │ (Shop)  │   │ (Shop)  │   │ (Shop)  │   │ (Shop)  │        │
│   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘        │
│        │             │             │             │              │
│        └─────────────┴─────────────┴─────────────┘              │
│                          │                                       │
│                          ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  Tenant Resolution                       │   │
│   │  (Domain → Tenant ID | Header → Tenant ID)              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  Data Isolation Layer                    │   │
│   │                                                          │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│   │  │  Row-Level  │  │   Schema    │  │  Database   │     │   │
│   │  │  Isolation  │  │  Isolation  │  │  Isolation  │     │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Стратегії ізоляції

### 1. Row-Level Isolation (Використовується)

Всі дані зберігаються в одній базі даних з `tenant_id` колонкою.

```go
// internal/tenant/models.go
package tenant

import (
    "time"
)

type Tenant struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    Name        string    `json:"name"`
    Slug        string    `json:"slug" gorm:"uniqueIndex"`
    Domain      string    `json:"domain" gorm:"uniqueIndex"`
    CustomDomain string   `json:"custom_domain" gorm:"uniqueIndex"`

    // Settings
    Settings    TenantSettings `json:"settings" gorm:"serializer:json"`

    // Plan & Billing
    PlanID      string    `json:"plan_id"`
    Plan        *Plan     `json:"plan" gorm:"foreignKey:PlanID"`

    // Status
    Status      TenantStatus `json:"status"`
    SuspendedAt *time.Time   `json:"suspended_at"`
    SuspendedReason string   `json:"suspended_reason"`

    // Owner
    OwnerID     string    `json:"owner_id"`

    // Timestamps
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
    DeletedAt   *time.Time `json:"deleted_at" gorm:"index"`
}

type TenantStatus string

const (
    TenantStatusActive    TenantStatus = "active"
    TenantStatusTrial     TenantStatus = "trial"
    TenantStatusSuspended TenantStatus = "suspended"
    TenantStatusDeleted   TenantStatus = "deleted"
)

type TenantSettings struct {
    // Branding
    Logo        string `json:"logo"`
    Favicon     string `json:"favicon"`
    PrimaryColor string `json:"primary_color"`
    SecondaryColor string `json:"secondary_color"`

    // Localization
    DefaultLanguage string   `json:"default_language"`
    Languages      []string `json:"languages"`
    DefaultCurrency string   `json:"default_currency"`
    Currencies     []string `json:"currencies"`
    Timezone       string   `json:"timezone"`

    // Features
    Features       map[string]bool `json:"features"`

    // Integrations
    Integrations   map[string]map[string]string `json:"integrations"`

    // Limits (from plan)
    MaxProducts    int   `json:"max_products"`
    MaxOrders      int   `json:"max_orders_per_month"`
    MaxUsers       int   `json:"max_users"`
    MaxStorage     int64 `json:"max_storage_bytes"`
}
```

### 2. Tenant Context

```go
// internal/tenant/context.go
package tenant

import (
    "context"
    "errors"
)

type contextKey string

const tenantContextKey contextKey = "tenant"

var (
    ErrTenantNotFound = errors.New("tenant not found in context")
    ErrTenantInactive = errors.New("tenant is not active")
)

// WithTenant adds tenant to context
func WithTenant(ctx context.Context, tenant *Tenant) context.Context {
    return context.WithValue(ctx, tenantContextKey, tenant)
}

// FromContext retrieves tenant from context
func FromContext(ctx context.Context) (*Tenant, error) {
    tenant, ok := ctx.Value(tenantContextKey).(*Tenant)
    if !ok || tenant == nil {
        return nil, ErrTenantNotFound
    }
    return tenant, nil
}

// MustFromContext retrieves tenant or panics
func MustFromContext(ctx context.Context) *Tenant {
    tenant, err := FromContext(ctx)
    if err != nil {
        panic(err)
    }
    return tenant
}

// GetTenantID retrieves tenant ID from context
func GetTenantID(ctx context.Context) (string, error) {
    tenant, err := FromContext(ctx)
    if err != nil {
        return "", err
    }
    return tenant.ID, nil
}
```

### 3. Tenant Resolution Middleware

```go
// internal/tenant/middleware.go
package tenant

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
)

type TenantMiddleware struct {
    repo   TenantRepository
    cache  TenantCache
}

func NewTenantMiddleware(repo TenantRepository, cache TenantCache) *TenantMiddleware {
    return &TenantMiddleware{
        repo:  repo,
        cache: cache,
    }
}

// Resolve resolves tenant from request
func (m *TenantMiddleware) Resolve() gin.HandlerFunc {
    return func(c *gin.Context) {
        var tenant *Tenant
        var err error

        // 1. Try X-Tenant-ID header (for API clients)
        if tenantID := c.GetHeader("X-Tenant-ID"); tenantID != "" {
            tenant, err = m.getTenant(c.Request.Context(), tenantID)
        }

        // 2. Try subdomain
        if tenant == nil {
            host := c.Request.Host
            subdomain := m.extractSubdomain(host)
            if subdomain != "" && subdomain != "www" && subdomain != "api" {
                tenant, err = m.getTenantBySlug(c.Request.Context(), subdomain)
            }
        }

        // 3. Try custom domain
        if tenant == nil {
            tenant, err = m.getTenantByDomain(c.Request.Context(), c.Request.Host)
        }

        if err != nil || tenant == nil {
            c.JSON(http.StatusNotFound, gin.H{
                "error": "Tenant not found",
            })
            c.Abort()
            return
        }

        // Check tenant status
        if tenant.Status != TenantStatusActive && tenant.Status != TenantStatusTrial {
            c.JSON(http.StatusForbidden, gin.H{
                "error":  "Tenant is not active",
                "status": tenant.Status,
            })
            c.Abort()
            return
        }

        // Set tenant in context
        ctx := WithTenant(c.Request.Context(), tenant)
        c.Request = c.Request.WithContext(ctx)
        c.Set("tenant_id", tenant.ID)
        c.Set("tenant", tenant)

        c.Next()
    }
}

func (m *TenantMiddleware) getTenant(ctx context.Context, id string) (*Tenant, error) {
    // Try cache first
    if tenant, err := m.cache.Get(ctx, id); err == nil && tenant != nil {
        return tenant, nil
    }

    // Get from database
    tenant, err := m.repo.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Cache for future requests
    m.cache.Set(ctx, tenant)

    return tenant, nil
}

func (m *TenantMiddleware) getTenantBySlug(ctx context.Context, slug string) (*Tenant, error) {
    // Try cache first
    if tenant, err := m.cache.GetBySlug(ctx, slug); err == nil && tenant != nil {
        return tenant, nil
    }

    // Get from database
    tenant, err := m.repo.GetBySlug(ctx, slug)
    if err != nil {
        return nil, err
    }

    // Cache for future requests
    m.cache.Set(ctx, tenant)

    return tenant, nil
}

func (m *TenantMiddleware) getTenantByDomain(ctx context.Context, domain string) (*Tenant, error) {
    // Try cache first
    if tenant, err := m.cache.GetByDomain(ctx, domain); err == nil && tenant != nil {
        return tenant, nil
    }

    // Get from database
    tenant, err := m.repo.GetByDomain(ctx, domain)
    if err != nil {
        return nil, err
    }

    if tenant != nil {
        // Cache for future requests
        m.cache.Set(ctx, tenant)
    }

    return tenant, nil
}

func (m *TenantMiddleware) extractSubdomain(host string) string {
    // Remove port
    host = strings.Split(host, ":")[0]

    parts := strings.Split(host, ".")
    if len(parts) >= 3 {
        return parts[0]
    }
    return ""
}
```

## Database Scoping

### GORM Scopes

```go
// internal/tenant/scopes.go
package tenant

import (
    "context"
    "fmt"

    "gorm.io/gorm"
)

// TenantScope returns a GORM scope that filters by tenant_id
func TenantScope(ctx context.Context) func(db *gorm.DB) *gorm.DB {
    return func(db *gorm.DB) *gorm.DB {
        tenantID, err := GetTenantID(ctx)
        if err != nil {
            // Return an impossible condition to prevent data leakage
            return db.Where("1 = 0")
        }
        return db.Where("tenant_id = ?", tenantID)
    }
}

// TenantDB wraps GORM DB with automatic tenant scoping
type TenantDB struct {
    db *gorm.DB
}

func NewTenantDB(db *gorm.DB) *TenantDB {
    return &TenantDB{db: db}
}

// WithContext returns a DB with tenant scope applied
func (t *TenantDB) WithContext(ctx context.Context) *gorm.DB {
    return t.db.WithContext(ctx).Scopes(TenantScope(ctx))
}

// Global returns the unscoped DB for cross-tenant operations
func (t *TenantDB) Global() *gorm.DB {
    return t.db
}

// Callbacks for automatic tenant_id assignment
func RegisterTenantCallbacks(db *gorm.DB) {
    // Before create - set tenant_id
    db.Callback().Create().Before("gorm:create").Register("tenant:set_tenant_id", func(tx *gorm.DB) {
        ctx := tx.Statement.Context
        tenantID, err := GetTenantID(ctx)
        if err != nil {
            return
        }

        // Set tenant_id field if exists
        if field := tx.Statement.Schema.LookUpField("TenantID"); field != nil {
            tx.Statement.SetColumn("tenant_id", tenantID)
        }
    })

    // Before query - add tenant scope
    db.Callback().Query().Before("gorm:query").Register("tenant:scope", func(tx *gorm.DB) {
        // Skip if already has tenant scope or is unscoped
        if tx.Statement.Unscoped {
            return
        }

        ctx := tx.Statement.Context
        tenantID, err := GetTenantID(ctx)
        if err != nil {
            return
        }

        // Add tenant scope if model has tenant_id field
        if field := tx.Statement.Schema.LookUpField("TenantID"); field != nil {
            tx.Statement.AddClause(clause.Where{
                Exprs: []clause.Expression{
                    clause.Eq{Column: "tenant_id", Value: tenantID},
                },
            })
        }
    })

    // Before update/delete - add tenant scope
    db.Callback().Update().Before("gorm:update").Register("tenant:scope", tenantScopeCallback)
    db.Callback().Delete().Before("gorm:delete").Register("tenant:scope", tenantScopeCallback)
}

func tenantScopeCallback(tx *gorm.DB) {
    if tx.Statement.Unscoped {
        return
    }

    ctx := tx.Statement.Context
    tenantID, err := GetTenantID(ctx)
    if err != nil {
        return
    }

    if field := tx.Statement.Schema.LookUpField("TenantID"); field != nil {
        tx.Statement.AddClause(clause.Where{
            Exprs: []clause.Expression{
                clause.Eq{Column: "tenant_id", Value: tenantID},
            },
        })
    }
}
```

### Repository Pattern

```go
// internal/product/repository.go
package product

import (
    "context"

    "github.com/your-org/shop/internal/tenant"
    "gorm.io/gorm"
)

type ProductRepository struct {
    db *tenant.TenantDB
}

func NewProductRepository(db *tenant.TenantDB) *ProductRepository {
    return &ProductRepository{db: db}
}

// Create creates a product (tenant_id set automatically)
func (r *ProductRepository) Create(ctx context.Context, product *Product) error {
    return r.db.WithContext(ctx).Create(product).Error
}

// GetByID gets a product by ID (scoped to tenant)
func (r *ProductRepository) GetByID(ctx context.Context, id string) (*Product, error) {
    var product Product
    err := r.db.WithContext(ctx).First(&product, "id = ?", id).Error
    if err != nil {
        return nil, err
    }
    return &product, nil
}

// List lists products (scoped to tenant)
func (r *ProductRepository) List(ctx context.Context, filters ProductFilters) ([]Product, error) {
    var products []Product
    query := r.db.WithContext(ctx)

    if filters.CategoryID != "" {
        query = query.Where("category_id = ?", filters.CategoryID)
    }
    if filters.Status != "" {
        query = query.Where("status = ?", filters.Status)
    }

    err := query.Limit(filters.Limit).Offset(filters.Offset).Find(&products).Error
    return products, err
}

// Update updates a product (scoped to tenant)
func (r *ProductRepository) Update(ctx context.Context, product *Product) error {
    return r.db.WithContext(ctx).Save(product).Error
}

// Delete deletes a product (scoped to tenant)
func (r *ProductRepository) Delete(ctx context.Context, id string) error {
    return r.db.WithContext(ctx).Delete(&Product{}, "id = ?", id).Error
}
```

## Tenant-Aware Caching

```go
// internal/tenant/cache.go
package tenant

import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type TenantCache interface {
    Get(ctx context.Context, id string) (*Tenant, error)
    GetBySlug(ctx context.Context, slug string) (*Tenant, error)
    GetByDomain(ctx context.Context, domain string) (*Tenant, error)
    Set(ctx context.Context, tenant *Tenant) error
    Invalidate(ctx context.Context, id string) error
}

type RedisCache struct {
    client *redis.Client
    ttl    time.Duration
}

func NewRedisCache(client *redis.Client, ttl time.Duration) *RedisCache {
    return &RedisCache{
        client: client,
        ttl:    ttl,
    }
}

func (c *RedisCache) Get(ctx context.Context, id string) (*Tenant, error) {
    return c.get(ctx, fmt.Sprintf("tenant:id:%s", id))
}

func (c *RedisCache) GetBySlug(ctx context.Context, slug string) (*Tenant, error) {
    return c.get(ctx, fmt.Sprintf("tenant:slug:%s", slug))
}

func (c *RedisCache) GetByDomain(ctx context.Context, domain string) (*Tenant, error) {
    return c.get(ctx, fmt.Sprintf("tenant:domain:%s", domain))
}

func (c *RedisCache) get(ctx context.Context, key string) (*Tenant, error) {
    data, err := c.client.Get(ctx, key).Bytes()
    if err != nil {
        return nil, err
    }

    var tenant Tenant
    if err := json.Unmarshal(data, &tenant); err != nil {
        return nil, err
    }

    return &tenant, nil
}

func (c *RedisCache) Set(ctx context.Context, tenant *Tenant) error {
    data, err := json.Marshal(tenant)
    if err != nil {
        return err
    }

    pipe := c.client.Pipeline()

    // Cache by ID
    pipe.Set(ctx, fmt.Sprintf("tenant:id:%s", tenant.ID), data, c.ttl)

    // Cache by slug
    pipe.Set(ctx, fmt.Sprintf("tenant:slug:%s", tenant.Slug), data, c.ttl)

    // Cache by domain
    if tenant.Domain != "" {
        pipe.Set(ctx, fmt.Sprintf("tenant:domain:%s", tenant.Domain), data, c.ttl)
    }
    if tenant.CustomDomain != "" {
        pipe.Set(ctx, fmt.Sprintf("tenant:domain:%s", tenant.CustomDomain), data, c.ttl)
    }

    _, err = pipe.Exec(ctx)
    return err
}

func (c *RedisCache) Invalidate(ctx context.Context, id string) error {
    // Get tenant to know all keys to delete
    tenant, err := c.Get(ctx, id)
    if err != nil {
        return nil // Not in cache
    }

    keys := []string{
        fmt.Sprintf("tenant:id:%s", tenant.ID),
        fmt.Sprintf("tenant:slug:%s", tenant.Slug),
    }

    if tenant.Domain != "" {
        keys = append(keys, fmt.Sprintf("tenant:domain:%s", tenant.Domain))
    }
    if tenant.CustomDomain != "" {
        keys = append(keys, fmt.Sprintf("tenant:domain:%s", tenant.CustomDomain))
    }

    return c.client.Del(ctx, keys...).Err()
}

// TenantAwareCache wraps any cache with tenant isolation
type TenantAwareCache struct {
    client *redis.Client
}

func NewTenantAwareCache(client *redis.Client) *TenantAwareCache {
    return &TenantAwareCache{client: client}
}

func (c *TenantAwareCache) Key(ctx context.Context, key string) string {
    tenantID, err := GetTenantID(ctx)
    if err != nil {
        return key
    }
    return fmt.Sprintf("t:%s:%s", tenantID, key)
}

func (c *TenantAwareCache) Get(ctx context.Context, key string) ([]byte, error) {
    return c.client.Get(ctx, c.Key(ctx, key)).Bytes()
}

func (c *TenantAwareCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
    return c.client.Set(ctx, c.Key(ctx, key), value, ttl).Err()
}

func (c *TenantAwareCache) Delete(ctx context.Context, key string) error {
    return c.client.Del(ctx, c.Key(ctx, key)).Err()
}

func (c *TenantAwareCache) FlushTenant(ctx context.Context) error {
    tenantID, err := GetTenantID(ctx)
    if err != nil {
        return err
    }

    pattern := fmt.Sprintf("t:%s:*", tenantID)
    keys, err := c.client.Keys(ctx, pattern).Result()
    if err != nil {
        return err
    }

    if len(keys) > 0 {
        return c.client.Del(ctx, keys...).Err()
    }
    return nil
}
```

## File Storage Isolation

```go
// internal/storage/tenant_storage.go
package storage

import (
    "context"
    "fmt"
    "io"
    "path"

    "github.com/your-org/shop/internal/tenant"
)

type TenantStorage struct {
    storage Storage
}

func NewTenantStorage(storage Storage) *TenantStorage {
    return &TenantStorage{storage: storage}
}

// Upload uploads a file with tenant isolation
func (s *TenantStorage) Upload(ctx context.Context, filename string, content io.Reader) (string, error) {
    tenantID, err := tenant.GetTenantID(ctx)
    if err != nil {
        return "", err
    }

    // Add tenant prefix to path
    tenantPath := path.Join(tenantID, filename)

    return s.storage.Upload(ctx, tenantPath, content)
}

// Download downloads a file with tenant isolation
func (s *TenantStorage) Download(ctx context.Context, filename string) (io.ReadCloser, error) {
    tenantID, err := tenant.GetTenantID(ctx)
    if err != nil {
        return nil, err
    }

    tenantPath := path.Join(tenantID, filename)

    return s.storage.Download(ctx, tenantPath)
}

// Delete deletes a file with tenant isolation
func (s *TenantStorage) Delete(ctx context.Context, filename string) error {
    tenantID, err := tenant.GetTenantID(ctx)
    if err != nil {
        return err
    }

    tenantPath := path.Join(tenantID, filename)

    return s.storage.Delete(ctx, tenantPath)
}

// GetURL returns a URL for a file with tenant isolation
func (s *TenantStorage) GetURL(ctx context.Context, filename string) (string, error) {
    tenantID, err := tenant.GetTenantID(ctx)
    if err != nil {
        return "", err
    }

    tenantPath := path.Join(tenantID, filename)

    return s.storage.GetURL(ctx, tenantPath)
}

// ListFiles lists files for current tenant
func (s *TenantStorage) ListFiles(ctx context.Context, prefix string) ([]string, error) {
    tenantID, err := tenant.GetTenantID(ctx)
    if err != nil {
        return nil, err
    }

    tenantPrefix := path.Join(tenantID, prefix)

    files, err := s.storage.List(ctx, tenantPrefix)
    if err != nil {
        return nil, err
    }

    // Remove tenant prefix from results
    result := make([]string, len(files))
    for i, f := range files {
        result[i] = strings.TrimPrefix(f, tenantID+"/")
    }

    return result, nil
}

// GetUsage returns storage usage for current tenant
func (s *TenantStorage) GetUsage(ctx context.Context) (int64, error) {
    tenantID, err := tenant.GetTenantID(ctx)
    if err != nil {
        return 0, err
    }

    return s.storage.GetDirectorySize(ctx, tenantID)
}
```

## Queue Isolation

```go
// internal/queue/tenant_queue.go
package queue

import (
    "context"
    "encoding/json"
    "fmt"

    "github.com/rabbitmq/amqp091-go"
    "github.com/your-org/shop/internal/tenant"
)

type TenantMessage struct {
    TenantID string         `json:"tenant_id"`
    Type     string         `json:"type"`
    Payload  map[string]any `json:"payload"`
}

type TenantQueue struct {
    conn    *amqp091.Connection
    channel *amqp091.Channel
}

func NewTenantQueue(conn *amqp091.Connection) (*TenantQueue, error) {
    channel, err := conn.Channel()
    if err != nil {
        return nil, err
    }

    return &TenantQueue{
        conn:    conn,
        channel: channel,
    }, nil
}

// Publish publishes a message with tenant context
func (q *TenantQueue) Publish(ctx context.Context, queueName string, msgType string, payload map[string]any) error {
    tenantID, err := tenant.GetTenantID(ctx)
    if err != nil {
        return err
    }

    msg := TenantMessage{
        TenantID: tenantID,
        Type:     msgType,
        Payload:  payload,
    }

    body, err := json.Marshal(msg)
    if err != nil {
        return err
    }

    return q.channel.PublishWithContext(
        ctx,
        "",        // exchange
        queueName, // routing key
        false,     // mandatory
        false,     // immediate
        amqp091.Publishing{
            ContentType: "application/json",
            Body:        body,
            Headers: amqp091.Table{
                "tenant_id": tenantID,
            },
        },
    )
}

// Consume consumes messages and injects tenant context
func (q *TenantQueue) Consume(queueName string, handler func(ctx context.Context, msg TenantMessage) error) error {
    msgs, err := q.channel.Consume(
        queueName,
        "",    // consumer
        false, // auto-ack
        false, // exclusive
        false, // no-local
        false, // no-wait
        nil,   // args
    )
    if err != nil {
        return err
    }

    go func() {
        for d := range msgs {
            var msg TenantMessage
            if err := json.Unmarshal(d.Body, &msg); err != nil {
                d.Nack(false, false)
                continue
            }

            // Create context with tenant
            t := &tenant.Tenant{ID: msg.TenantID}
            ctx := tenant.WithTenant(context.Background(), t)

            if err := handler(ctx, msg); err != nil {
                d.Nack(false, true) // Requeue on error
            } else {
                d.Ack(false)
            }
        }
    }()

    return nil
}

// PublishToTenant publishes a message to a specific tenant (for admin operations)
func (q *TenantQueue) PublishToTenant(ctx context.Context, tenantID string, queueName string, msgType string, payload map[string]any) error {
    msg := TenantMessage{
        TenantID: tenantID,
        Type:     msgType,
        Payload:  payload,
    }

    body, err := json.Marshal(msg)
    if err != nil {
        return err
    }

    return q.channel.PublishWithContext(
        ctx,
        "",
        queueName,
        false,
        false,
        amqp091.Publishing{
            ContentType: "application/json",
            Body:        body,
            Headers: amqp091.Table{
                "tenant_id": tenantID,
            },
        },
    )
}
```

## Tenant Management Service

```go
// internal/tenant/service.go
package tenant

import (
    "context"
    "fmt"
    "time"
)

type TenantService struct {
    repo    TenantRepository
    cache   TenantCache
    storage Storage
    billing BillingService
    events  EventPublisher
}

func NewTenantService(
    repo TenantRepository,
    cache TenantCache,
    storage Storage,
    billing BillingService,
    events EventPublisher,
) *TenantService {
    return &TenantService{
        repo:    repo,
        cache:   cache,
        storage: storage,
        billing: billing,
        events:  events,
    }
}

type CreateTenantRequest struct {
    Name    string
    Slug    string
    Domain  string
    OwnerID string
    PlanID  string
}

// Create creates a new tenant
func (s *TenantService) Create(ctx context.Context, req *CreateTenantRequest) (*Tenant, error) {
    // Validate slug uniqueness
    existing, _ := s.repo.GetBySlug(ctx, req.Slug)
    if existing != nil {
        return nil, fmt.Errorf("slug already in use")
    }

    // Generate domain
    domain := req.Domain
    if domain == "" {
        domain = fmt.Sprintf("%s.shop.example.com", req.Slug)
    }

    tenant := &Tenant{
        ID:        generateID("tenant"),
        Name:      req.Name,
        Slug:      req.Slug,
        Domain:    domain,
        OwnerID:   req.OwnerID,
        PlanID:    req.PlanID,
        Status:    TenantStatusTrial,
        Settings:  s.getDefaultSettings(),
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }

    if err := s.repo.Create(ctx, tenant); err != nil {
        return nil, err
    }

    // Create storage directory
    if err := s.storage.CreateDirectory(ctx, tenant.ID); err != nil {
        // Log error but don't fail
    }

    // Create billing subscription
    if req.PlanID != "" {
        s.billing.CreateSubscription(ctx, tenant.ID, req.PlanID)
    }

    // Publish event
    s.events.Publish(ctx, "tenant.created", map[string]any{
        "tenant_id": tenant.ID,
        "name":      tenant.Name,
        "slug":      tenant.Slug,
    })

    return tenant, nil
}

// Update updates a tenant
func (s *TenantService) Update(ctx context.Context, id string, updates map[string]any) (*Tenant, error) {
    tenant, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Apply updates
    if name, ok := updates["name"].(string); ok {
        tenant.Name = name
    }
    if slug, ok := updates["slug"].(string); ok {
        // Check uniqueness
        existing, _ := s.repo.GetBySlug(ctx, slug)
        if existing != nil && existing.ID != id {
            return nil, fmt.Errorf("slug already in use")
        }
        tenant.Slug = slug
        tenant.Domain = fmt.Sprintf("%s.shop.example.com", slug)
    }
    if customDomain, ok := updates["custom_domain"].(string); ok {
        tenant.CustomDomain = customDomain
    }
    if settings, ok := updates["settings"].(TenantSettings); ok {
        tenant.Settings = settings
    }

    tenant.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, tenant); err != nil {
        return nil, err
    }

    // Invalidate cache
    s.cache.Invalidate(ctx, id)

    return tenant, nil
}

// Suspend suspends a tenant
func (s *TenantService) Suspend(ctx context.Context, id string, reason string) error {
    tenant, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return err
    }

    now := time.Now()
    tenant.Status = TenantStatusSuspended
    tenant.SuspendedAt = &now
    tenant.SuspendedReason = reason
    tenant.UpdatedAt = now

    if err := s.repo.Update(ctx, tenant); err != nil {
        return err
    }

    // Invalidate cache
    s.cache.Invalidate(ctx, id)

    // Publish event
    s.events.Publish(ctx, "tenant.suspended", map[string]any{
        "tenant_id": id,
        "reason":    reason,
    })

    return nil
}

// Activate activates a suspended tenant
func (s *TenantService) Activate(ctx context.Context, id string) error {
    tenant, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return err
    }

    tenant.Status = TenantStatusActive
    tenant.SuspendedAt = nil
    tenant.SuspendedReason = ""
    tenant.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, tenant); err != nil {
        return err
    }

    s.cache.Invalidate(ctx, id)

    s.events.Publish(ctx, "tenant.activated", map[string]any{
        "tenant_id": id,
    })

    return nil
}

// Delete soft-deletes a tenant
func (s *TenantService) Delete(ctx context.Context, id string) error {
    tenant, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return err
    }

    now := time.Now()
    tenant.Status = TenantStatusDeleted
    tenant.DeletedAt = &now
    tenant.UpdatedAt = now

    if err := s.repo.Update(ctx, tenant); err != nil {
        return err
    }

    s.cache.Invalidate(ctx, id)

    // Cancel billing subscription
    s.billing.CancelSubscription(ctx, id)

    s.events.Publish(ctx, "tenant.deleted", map[string]any{
        "tenant_id": id,
    })

    return nil
}

// SetCustomDomain sets a custom domain for a tenant
func (s *TenantService) SetCustomDomain(ctx context.Context, id string, domain string) error {
    // Verify domain ownership via DNS TXT record
    verified, err := s.verifyDomainOwnership(domain, id)
    if err != nil || !verified {
        return fmt.Errorf("domain verification failed")
    }

    tenant, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return err
    }

    tenant.CustomDomain = domain
    tenant.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, tenant); err != nil {
        return err
    }

    s.cache.Invalidate(ctx, id)

    // Request SSL certificate
    go s.requestSSLCertificate(domain)

    return nil
}

func (s *TenantService) verifyDomainOwnership(domain string, tenantID string) (bool, error) {
    // Check for TXT record: _shop-verify.domain.com -> tenant_id
    // Implementation using DNS lookup
    return true, nil
}

func (s *TenantService) requestSSLCertificate(domain string) {
    // Implementation using Let's Encrypt or similar
}

func (s *TenantService) getDefaultSettings() TenantSettings {
    return TenantSettings{
        DefaultLanguage: "uk",
        Languages:       []string{"uk", "en"},
        DefaultCurrency: "UAH",
        Currencies:      []string{"UAH", "USD", "EUR"},
        Timezone:        "Europe/Kyiv",
        PrimaryColor:    "#4F46E5",
        SecondaryColor:  "#10B981",
        Features: map[string]bool{
            "multi_language": true,
            "multi_currency": true,
            "reviews":        true,
            "wishlist":       true,
        },
    }
}
```

## API Handlers

```go
// internal/tenant/handlers.go
package tenant

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

type TenantHandler struct {
    service *TenantService
}

func NewTenantHandler(service *TenantService) *TenantHandler {
    return &TenantHandler{service: service}
}

func (h *TenantHandler) RegisterRoutes(r *gin.RouterGroup) {
    // Public routes
    r.POST("/tenants", h.Create)

    // Tenant-scoped routes
    tenant := r.Group("/tenant")
    tenant.Use(TenantMiddleware())
    {
        tenant.GET("", h.GetCurrent)
        tenant.PUT("", h.Update)
        tenant.PUT("/settings", h.UpdateSettings)
        tenant.POST("/custom-domain", h.SetCustomDomain)
        tenant.GET("/usage", h.GetUsage)
    }

    // Admin routes
    admin := r.Group("/admin/tenants")
    admin.Use(AdminMiddleware())
    {
        admin.GET("", h.List)
        admin.GET("/:id", h.GetByID)
        admin.PUT("/:id", h.AdminUpdate)
        admin.POST("/:id/suspend", h.Suspend)
        admin.POST("/:id/activate", h.Activate)
        admin.DELETE("/:id", h.Delete)
    }
}

// Create creates a new tenant
func (h *TenantHandler) Create(c *gin.Context) {
    var req CreateTenantRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    tenant, err := h.service.Create(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusCreated, tenant)
}

// GetCurrent returns current tenant
func (h *TenantHandler) GetCurrent(c *gin.Context) {
    tenant, err := FromContext(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Tenant not found"})
        return
    }

    c.JSON(http.StatusOK, tenant)
}

// Update updates current tenant
func (h *TenantHandler) Update(c *gin.Context) {
    tenant, _ := FromContext(c.Request.Context())

    var updates map[string]any
    if err := c.ShouldBindJSON(&updates); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    updated, err := h.service.Update(c.Request.Context(), tenant.ID, updates)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, updated)
}

// UpdateSettings updates tenant settings
func (h *TenantHandler) UpdateSettings(c *gin.Context) {
    tenant, _ := FromContext(c.Request.Context())

    var settings TenantSettings
    if err := c.ShouldBindJSON(&settings); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    updated, err := h.service.Update(c.Request.Context(), tenant.ID, map[string]any{
        "settings": settings,
    })
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, updated)
}

// GetUsage returns tenant resource usage
func (h *TenantHandler) GetUsage(c *gin.Context) {
    tenant, _ := FromContext(c.Request.Context())

    usage, err := h.service.GetUsage(c.Request.Context(), tenant.ID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, usage)
}

// Suspend suspends a tenant (admin)
func (h *TenantHandler) Suspend(c *gin.Context) {
    id := c.Param("id")

    var req struct {
        Reason string `json:"reason"`
    }
    c.ShouldBindJSON(&req)

    if err := h.service.Suspend(c.Request.Context(), id, req.Reason); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"success": true})
}
```

## Database Migrations

```sql
-- migrations/001_create_tenants.sql

-- Tenants table
CREATE TABLE tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    custom_domain VARCHAR(255) UNIQUE,
    settings JSONB DEFAULT '{}',
    plan_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'trial',
    suspended_at TIMESTAMP,
    suspended_reason TEXT,
    owner_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    INDEX idx_tenants_slug (slug),
    INDEX idx_tenants_domain (domain),
    INDEX idx_tenants_custom_domain (custom_domain),
    INDEX idx_tenants_status (status),
    INDEX idx_tenants_owner (owner_id),
    INDEX idx_tenants_deleted_at (deleted_at)
);

-- Add tenant_id to all tables
ALTER TABLE products ADD COLUMN tenant_id VARCHAR(36) NOT NULL;
ALTER TABLE products ADD INDEX idx_products_tenant (tenant_id);

ALTER TABLE orders ADD COLUMN tenant_id VARCHAR(36) NOT NULL;
ALTER TABLE orders ADD INDEX idx_orders_tenant (tenant_id);

ALTER TABLE customers ADD COLUMN tenant_id VARCHAR(36) NOT NULL;
ALTER TABLE customers ADD INDEX idx_customers_tenant (tenant_id);

ALTER TABLE categories ADD COLUMN tenant_id VARCHAR(36) NOT NULL;
ALTER TABLE categories ADD INDEX idx_categories_tenant (tenant_id);

-- ... repeat for all tenant-scoped tables

-- Row-level security policies (PostgreSQL)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON products
    USING (tenant_id = current_setting('app.current_tenant_id'));

-- Function to set current tenant
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id VARCHAR)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id, false);
END;
$$ LANGUAGE plpgsql;
```

## Тестування

```go
// internal/tenant/middleware_test.go
package tenant

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

func TestTenantMiddleware_ResolveByHeader(t *testing.T) {
    repo := new(MockTenantRepository)
    cache := new(MockTenantCache)

    tenant := &Tenant{
        ID:     "tenant_1",
        Name:   "Test Shop",
        Status: TenantStatusActive,
    }

    cache.On("Get", mock.Anything, "tenant_1").Return(nil, nil)
    repo.On("GetByID", mock.Anything, "tenant_1").Return(tenant, nil)
    cache.On("Set", mock.Anything, tenant).Return(nil)

    middleware := NewTenantMiddleware(repo, cache)

    gin.SetMode(gin.TestMode)
    router := gin.New()
    router.Use(middleware.Resolve())
    router.GET("/test", func(c *gin.Context) {
        t, _ := FromContext(c.Request.Context())
        c.JSON(200, t)
    })

    req := httptest.NewRequest("GET", "/test", nil)
    req.Header.Set("X-Tenant-ID", "tenant_1")
    w := httptest.NewRecorder()

    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}

func TestTenantMiddleware_ResolveBySubdomain(t *testing.T) {
    repo := new(MockTenantRepository)
    cache := new(MockTenantCache)

    tenant := &Tenant{
        ID:     "tenant_1",
        Name:   "Test Shop",
        Slug:   "testshop",
        Status: TenantStatusActive,
    }

    cache.On("GetBySlug", mock.Anything, "testshop").Return(nil, nil)
    repo.On("GetBySlug", mock.Anything, "testshop").Return(tenant, nil)
    cache.On("Set", mock.Anything, tenant).Return(nil)

    middleware := NewTenantMiddleware(repo, cache)

    gin.SetMode(gin.TestMode)
    router := gin.New()
    router.Use(middleware.Resolve())
    router.GET("/test", func(c *gin.Context) {
        c.JSON(200, gin.H{"ok": true})
    })

    req := httptest.NewRequest("GET", "/test", nil)
    req.Host = "testshop.shop.example.com"
    w := httptest.NewRecorder()

    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}

func TestTenantScope(t *testing.T) {
    ctx := WithTenant(context.Background(), &Tenant{ID: "tenant_1"})

    // Verify scope is applied correctly
    tenantID, err := GetTenantID(ctx)
    assert.NoError(t, err)
    assert.Equal(t, "tenant_1", tenantID)
}
```

## Див. також

- [Database Schema](../infrastructure/DATABASE_SCHEMA.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [Billing](../modules/BILLING.md)
