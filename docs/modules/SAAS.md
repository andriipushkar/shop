# SaaS Platform Architecture

Multi-tenant SaaS платформа для комерціалізації Shop як сервісу.

## Архітектура

```
services/core/internal/
├── tenant/              # Multi-tenant управління
│   └── service.go
├── billing/             # Stripe інтеграція
│   └── stripe.go
└── onboarding/          # Onboarding flow
    └── service.go
```

## Multi-Tenant Architecture

### Tenant Model

```go
type Tenant struct {
    ID           string            // UUID
    Slug         string            // URL-safe identifier (mystore)
    Name         string            // Display name
    Domain       string            // Custom domain (optional)
    Plan         PlanType          // free/starter/pro/enterprise
    Status       TenantStatus      // active/trial/suspended/cancelled
    Settings     TenantSettings    // Configuration
    Limits       TenantLimits      // Resource limits
    StripeID     string            // Stripe customer ID
}
```

### Subscription Plans

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Products | 100 | 1,000 | 10,000 | Unlimited |
| Orders/month | 50 | 500 | 5,000 | Unlimited |
| Team members | 2 | 5 | 25 | Unlimited |
| Storage | 1 GB | 10 GB | 100 GB | Unlimited |
| API requests/day | 1,000 | 10,000 | 100,000 | Unlimited |
| AI requests/month | 100 | 1,000 | 10,000 | Unlimited |
| Custom domains | 0 | 1 | 5 | Unlimited |
| Price | Free | $29/mo | $99/mo | Custom |

### Data Isolation

```go
// Tenant context middleware
func TenantMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        tenantID := extractTenantID(r) // from subdomain/header/token

        tenant, err := tenantService.GetTenant(r.Context(), tenantID)
        if err != nil || tenant.Status == TenantStatusSuspended {
            http.Error(w, "Tenant not found", 404)
            return
        }

        ctx := context.WithValue(r.Context(), "tenant", tenant)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// All queries are tenant-scoped
func (r *ProductRepository) List(ctx context.Context) ([]Product, error) {
    tenant := ctx.Value("tenant").(*Tenant)
    return r.db.Query("SELECT * FROM products WHERE tenant_id = $1", tenant.ID)
}
```

## Billing Integration (Stripe)

### Customer Lifecycle

```
Signup → Create Stripe Customer → Trial (14 days) → Subscribe → Active
                                                  ↓
                                           Payment Failed → Grace Period → Suspended
```

### Subscription Management

```go
// Create subscription
subscriptionID, err := billing.CreateSubscription(ctx, customerID, PlanPro)

// Upgrade/Downgrade with proration
err := billing.UpdateSubscription(ctx, subscriptionID, PlanEnterprise)

// Cancel at period end
err := billing.CancelSubscription(ctx, subscriptionID)
```

### Checkout Flow

```go
// Create Checkout Session
checkoutURL, err := billing.CreateCheckoutSession(ctx, customerID, PlanPro)
// Redirect user to checkoutURL

// Handle webhook
POST /webhooks/stripe
{
  "type": "checkout.session.completed",
  "data": { "customer": "cus_xxx", "subscription": "sub_xxx" }
}
```

### Billing Portal

```go
// Customer self-service portal
portalURL, err := billing.CreateBillingPortalSession(ctx, customerID, returnURL)
// User can update payment method, view invoices, cancel subscription
```

### Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription |
| `customer.subscription.updated` | Update plan limits |
| `customer.subscription.deleted` | Downgrade to free |
| `invoice.paid` | Record payment |
| `invoice.payment_failed` | Send warning, start grace period |

## Onboarding Flow

### Steps

1. **Welcome** - Platform introduction
2. **Store Setup** - Name, description, contacts
3. **Branding** - Logo, colors (optional)
4. **First Product** - Create sample product
5. **Products Import** - CSV/API import (optional)
6. **Payment Setup** - Connect payment provider
7. **Shipping Setup** - Configure delivery options
8. **Domain Setup** - Custom domain (optional)
9. **Invite Team** - Add team members (optional)
10. **Go Live** - Launch the store

### Progress Tracking

```go
type OnboardingFlow struct {
    TenantID    string
    Status      OnboardingStatus  // pending/in_progress/completed
    CurrentStep StepType
    Steps       []OnboardingStep
    Progress    int               // 0-100%
}

// Complete a step
err := onboarding.CompleteStep(ctx, tenantID, StepFirstProduct, map[string]any{
    "product_id": "prod_123",
})

// Skip optional step
err := onboarding.SkipStep(ctx, tenantID, StepBrandingSetup)
```

### Step Guides

```go
guide := onboarding.GetStepGuide(StepPaymentSetup)
// Returns: title, content, video_url, help_article, tips
```

## API Endpoints

### Tenant Management

```
POST   /api/v1/tenants              # Create tenant
GET    /api/v1/tenants/:id          # Get tenant
PATCH  /api/v1/tenants/:id          # Update tenant
DELETE /api/v1/tenants/:id          # Delete tenant

GET    /api/v1/tenants/:id/usage    # Get usage stats
POST   /api/v1/tenants/:id/suspend  # Suspend tenant
POST   /api/v1/tenants/:id/activate # Reactivate tenant
```

### Billing

```
GET    /api/v1/billing/subscription     # Get subscription
POST   /api/v1/billing/checkout         # Create checkout session
POST   /api/v1/billing/portal           # Create billing portal session
GET    /api/v1/billing/invoices         # List invoices
GET    /api/v1/billing/payment-methods  # List payment methods

POST   /webhooks/stripe                 # Stripe webhooks
```

### Onboarding

```
GET    /api/v1/onboarding               # Get onboarding flow
GET    /api/v1/onboarding/current       # Get current step
POST   /api/v1/onboarding/:step/complete # Complete step
POST   /api/v1/onboarding/:step/skip    # Skip step
POST   /api/v1/onboarding/reset         # Reset flow
```

## Database Schema

```sql
-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    status VARCHAR(50) NOT NULL DEFAULT 'trial',
    billing_email VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255),
    settings JSONB DEFAULT '{}',
    limits JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_tenants_stripe_id ON tenants(stripe_customer_id);

-- Onboarding flows
CREATE TABLE onboarding_flows (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_step VARCHAR(50) NOT NULL,
    steps JSONB NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    UNIQUE(tenant_id)
);

-- Subscriptions (cached from Stripe)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    stripe_subscription_id VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    trial_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(tenant_id)
);

-- Usage tracking
CREATE TABLE usage_records (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    period VARCHAR(7) NOT NULL, -- YYYY-MM
    products_count INTEGER DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,
    api_requests INTEGER DEFAULT 0,
    ai_requests INTEGER DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL,
    UNIQUE(tenant_id, period)
);
```

## Limits Enforcement

```go
// Middleware to check limits
func LimitsMiddleware(limitType string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tenant := r.Context().Value("tenant").(*Tenant)

            currentUsage := getCurrentUsage(tenant.ID, limitType)
            exceeded, _ := tenantService.CheckLimit(r.Context(), tenant.ID, limitType, currentUsage)

            if exceeded {
                http.Error(w, "Limit exceeded. Please upgrade your plan.", 429)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

// Usage in routes
router.POST("/products",
    TenantMiddleware,
    LimitsMiddleware("products"),
    createProductHandler,
)
```

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Plans (Stripe Price IDs)
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx

# URLs
BILLING_SUCCESS_URL=https://app.shop.com/billing/success
BILLING_CANCEL_URL=https://app.shop.com/billing/cancel
BILLING_PORTAL_RETURN_URL=https://app.shop.com/settings/billing

# Trial
TRIAL_DAYS=14
```

## Monitoring

### Key Metrics

- MRR (Monthly Recurring Revenue)
- Churn rate
- Conversion rate (trial → paid)
- ARPU (Average Revenue Per User)
- Onboarding completion rate
- Limit utilization per tenant

### Alerts

```yaml
# High churn
- alert: HighChurnRate
  expr: churn_rate_monthly > 0.05
  for: 1d
  labels:
    severity: warning

# Failed payments
- alert: HighPaymentFailureRate
  expr: payment_failure_rate > 0.1
  for: 1h
  labels:
    severity: critical
```

## Security

- Tenant data isolation at database level
- API keys with tenant scope
- Rate limiting per tenant
- Audit logging for billing events
- PCI compliance via Stripe
- GDPR data export/deletion
