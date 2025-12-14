# Advanced Features Documentation

## Overview

This document describes the advanced features implemented in the shop platform:

1. Multi-tenancy Architecture
2. RMA (Return Merchandise Authorization) System
3. CDP (Customer Data Platform)
4. Unified Inbox
5. Visual Search (CLIP + Qdrant)
6. Fraud Detection System
7. UX/UI Improvements
8. **Production Roadmap Features (NEW)**
   - Complete Row Level Security (RLS)
   - Billing System with Subscriptions
   - 1-Click Tenant Onboarding
   - Helm Charts for Kubernetes
   - API Gateway with Rate Limiting

---

## 1. Multi-tenancy Architecture

### Location
`services/core/internal/tenant/tenant.go`

### Overview
Multi-tenancy enables running the platform as SaaS where multiple stores (tenants) share the same infrastructure while maintaining data isolation.

### Key Components

#### Tenant Model
```go
type Tenant struct {
    ID           string
    Slug         string          // subdomain identifier
    Name         string
    Domain       string          // main domain
    CustomDomain string          // custom domain support
    Status       TenantStatus    // active, inactive, suspended, trial
    Plan         TenantPlan      // free, starter, professional, enterprise
    OwnerID      string

    // Quotas
    ProductLimit int
    OrderLimit   int
    StorageLimit int64

    // Usage tracking
    ProductCount int
    OrderCount   int
    StorageUsed  int64

    Settings     map[string]interface{}
}
```

#### Plan Limits

| Plan         | Products | Orders/Month | Storage |
|--------------|----------|--------------|---------|
| Free         | 50       | 100          | 100MB   |
| Starter      | 500      | 1,000        | 1GB     |
| Professional | 5,000    | 10,000       | 10GB    |
| Enterprise   | Unlimited| Unlimited    | Unlimited|

### Usage

#### Tenant Resolution Middleware
```go
// Resolves tenant from subdomain or X-Tenant-ID header
handler := TenantMiddleware(tenantService, "shop.com")(yourHandler)
```

#### Getting Tenant in Handlers
```go
func handler(w http.ResponseWriter, r *http.Request) {
    tenant := tenant.FromContext(r.Context())
    // Use tenant for data isolation
}
```

#### Quota Checking
```go
allowed, err := service.CheckQuota(ctx, tenantID, "products", 1)
if !allowed {
    return ErrQuotaExceeded
}
```

### Database
All tenant-scoped tables have `tenant_id` column with Row Level Security (RLS) enabled.

---

## 2. RMA (Return Merchandise Authorization) System

### Location
`services/core/internal/returns/rma.go`

### Overview
Complete return management system handling customer return requests, shipping, inspection, and refunds.

### Return Flow

```
Customer Request → Manager Review → Approval/Rejection
                         ↓
                    Approved
                         ↓
              Create Return Shipment (Nova Poshta)
                         ↓
                    In Transit
                         ↓
                Warehouse Receives
                         ↓
              Inspection (restock/writeoff)
                         ↓
              Approve for Refund
                         ↓
                 Process Refund
                         ↓
                    Completed
```

### Return Statuses

- `pending` - Customer submitted request
- `approved` - Manager approved, awaiting shipment
- `shipment_created` - TTN generated
- `in_transit` - Package in transit
- `received` - Warehouse received
- `inspecting` - Under inspection
- `approved_for_refund` - Inspection passed
- `refunded` - Money returned
- `completed` - Process complete
- `rejected` - Return denied

### Return Reasons

- `defective` - Product is defective
- `wrong_item` - Wrong item received
- `not_as_described` - Not as described
- `changed_mind` - Customer changed mind
- `damaged` - Damaged during shipping
- `wrong_size` - Size doesn't fit
- `other` - Other reason

### Usage

#### Create Return Request
```go
input := CreateReturnInput{
    TenantID:      "tenant-1",
    OrderID:       "order-123",
    CustomerEmail: "customer@example.com",
    Reason:        ReasonDefective,
    Items: []ReturnItemInput{
        {ProductID: "prod-1", Quantity: 1, Price: 1500},
    },
}
req, err := rmaService.CreateRequest(ctx, input)
```

#### Approve and Create Shipment
```go
err := rmaService.ApproveRequest(ctx, returnID, adminID, notes)
shipment, err := rmaService.CreateShipment(ctx, returnID)
// shipment contains Nova Poshta TTN and label URL
```

#### Inspect Items
```go
inspections := []ItemInspection{
    {ItemID: "item-1", Decision: DecisionRestock, Condition: "good"},
}
err := rmaService.InspectItems(ctx, returnID, warehouseUserID, inspections)
```

---

## 3. CDP (Customer Data Platform)

### Location
`services/core/internal/cdp/cdp.go`

### Overview
Tracks customer behavior, calculates RFM scores, manages segments, and runs automated campaigns.

### Event Tracking

#### Event Types
- `page_view` - Page visited
- `product_view` - Product viewed
- `add_to_cart` - Added to cart
- `remove_from_cart` - Removed from cart
- `cart_abandoned` - Cart abandoned
- `purchase` - Order placed
- `search` - Search performed
- `wishlist_add` - Added to wishlist
- `review` - Review submitted
- `login` / `signup` - Authentication events

#### Tracking Events
```go
event := &Event{
    TenantID:   "tenant-1",
    CustomerID: "customer-123",
    SessionID:  "session-abc",
    Type:       EventProductView,
    Properties: map[string]interface{}{
        "product_id": "prod-1",
        "category":   "electronics",
    },
    Timestamp: time.Now(),
}
cdpService.TrackEvent(ctx, event)
```

### RFM Scoring

Customers are scored on:
- **Recency** (1-5): Days since last order
- **Frequency** (1-5): Number of orders
- **Monetary** (1-5): Total spend

#### RFM Segments
| Segment | Description |
|---------|-------------|
| champions | High R, F, M (4-5 all) |
| loyal_customers | Good across all (3-4 all) |
| potential_loyalist | Recent buyer, moderate activity |
| new_customers | Recent, low frequency |
| at_risk | Used to be good, declining recency |
| cant_lose | High value but haven't purchased recently |
| hibernating | Low activity overall |
| lost | Very low across all dimensions |

### Segments

#### Creating Segments
```go
input := CreateSegmentInput{
    TenantID: "tenant-1",
    Name:     "VIP Customers",
    Type:     SegmentTypeDynamic,
    Criteria: SegmentCriteria{
        Conditions: []SegmentCondition{
            {Field: "total_spent", Operator: "gte", Value: 50000},
            {Field: "total_orders", Operator: "gte", Value: 10},
        },
        Logic: "and",
    },
}
segment, err := cdpService.CreateSegment(ctx, input)
```

### Automations

#### Creating Automation (Abandoned Cart)
```go
input := CreateAutomationInput{
    TenantID:    "tenant-1",
    Name:        "Abandoned Cart Recovery",
    TriggerType: TriggerCartAbandoned,
    TriggerConfig: map[string]interface{}{
        "delay_minutes": 15,
    },
    Actions: []AutomationAction{
        {
            Type: ActionSendEmail,
            Config: map[string]interface{}{
                "template": "abandoned_cart",
                "subject":  "You left something behind!",
            },
        },
    },
}
```

---

## 4. Unified Inbox

### Location
`services/core/internal/inbox/inbox.go`

### Overview
Single interface for managing all customer communications across multiple channels.

### Supported Channels

- `telegram` - Telegram Bot
- `viber` - Viber
- `instagram` - Instagram Direct
- `facebook` - Facebook Messenger
- `whatsapp` - WhatsApp Business
- `email` - Email
- `web_chat` - Website widget
- `sms` - SMS

### Conversation Management

#### Creating/Getting Conversation
```go
input := CreateConversationInput{
    TenantID:     "tenant-1",
    Channel:      ChannelTelegram,
    ChannelID:    "tg-chat-123",
    CustomerName: "John Doe",
}
conv, err := inboxService.GetOrCreateConversation(ctx, input)
```

#### Adding Messages
```go
msg, err := inboxService.AddMessage(ctx, AddMessageInput{
    ConversationID: conv.ID,
    Direction:      DirectionIncoming,
    SenderID:       "customer-123",
    Content:        "Hello, I have a question about my order",
})
```

#### Agent Reply
```go
reply, err := inboxService.SendReply(ctx, SendReplyInput{
    ConversationID: conv.ID,
    AgentID:        "agent-1",
    AgentName:      "Support Agent",
    Content:        "Hello! How can I help you?",
})
```

### Conversation Statuses

- `open` - Active, needs attention
- `pending` - Waiting for customer
- `snoozed` - Temporarily hidden
- `resolved` - Issue resolved
- `closed` - Conversation ended

### Customer Context

When handling a conversation, agents see:
- Customer orders history
- Total LTV
- Current pending orders
- Loyalty tier
- Recent support tickets

---

## 5. Visual Search

### Location
`services/core/internal/visualsearch/visual_search.go`

### Overview
Image-based product search using CLIP embeddings and pgvector for similarity matching.

### Architecture

1. **CLIP Provider** - Generates 512-dimensional embeddings from images
2. **pgvector** - PostgreSQL extension for vector similarity search
3. **IVFFlat Index** - Fast approximate nearest neighbor search

### Usage

#### Index a Product
```go
err := visualSearchService.IndexProduct(ctx, tenantID, productID)
```

#### Search by Image
```go
results, err := visualSearchService.SearchByImage(ctx, tenantID, imageURL, 10)
// Returns similar products with similarity scores
```

#### Search by Text (CLIP text encoder)
```go
results, err := visualSearchService.SearchByText(ctx, tenantID, "red dress", 10)
```

#### Batch Indexing
```go
results, err := visualSearchService.BatchIndex(ctx, tenantID, productIDs)
// results.Successful, results.Failed
```

### Database Schema
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE image_embeddings (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255) NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    embedding vector(512)
);

CREATE INDEX idx_image_emb_vector ON image_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

---

## 6. Fraud Detection

### Location
`services/core/internal/fraud/fraud.go`

### Overview
Real-time risk assessment for orders before shipping to prevent fraud.

### Risk Factors

| Factor | Description | Score Impact |
|--------|-------------|--------------|
| Blacklist | Email/Phone/IP on blacklist | +50-100 |
| Velocity | Too many orders in short time | +20-40 |
| Geo Mismatch | IP country ≠ Shipping country | +25 |
| Email Pattern | Suspicious email format | +15 |
| Amount Anomaly | Unusually high order value | +20 |
| Custom Rules | Merchant-defined rules | Variable |

### Risk Levels

| Level | Score Range | Default Action |
|-------|-------------|----------------|
| Low | 0-39 | Auto-approve |
| Medium | 40-69 | Flag for review |
| High | 70-89 | Hold for manual review |
| Critical | 90-100 | Auto-reject |

### Usage

#### Assess Order
```go
assessment, err := fraudService.AssessOrder(ctx, orderID)
// assessment.RiskLevel, assessment.RiskScore, assessment.Factors
```

#### Add to Blacklist
```go
entry, err := fraudService.AddToBlacklist(ctx, BlacklistInput{
    TenantID:  "tenant-1",
    Type:      BlacklistEmail,
    Value:     "fraud@example.com",
    Reason:    "Previous fraud attempt",
    CreatedBy: "admin-1",
})
```

#### Create Custom Rule
```go
rule, err := fraudService.CreateRule(ctx, CreateRuleInput{
    TenantID: "tenant-1",
    Name:     "Block high-risk countries",
    Conditions: []RuleCondition{
        {Field: "shipping_country", Operator: "in", Value: []string{"NG", "GH"}},
    },
    Action:    ActionFlag,
    RiskScore: 40,
})
```

#### Review Assessment
```go
err := fraudService.ReviewAssessment(ctx, orderID, ReviewInput{
    ReviewerID: "admin-1",
    Decision:   DecisionApprove,
    Notes:      "Verified customer via phone",
})
```

---

## 7. UX/UI Improvements

### Location
`services/storefront/components/ui/`

### Components

#### Onboarding Tour
`onboarding-tour.tsx`

Step-by-step guided tour for new users.

```tsx
import { OnboardingProvider, adminOnboardingTour } from '@/components/ui/onboarding-tour'

<OnboardingProvider tourConfig={adminOnboardingTour} autoStart>
  <AdminLayout>{children}</AdminLayout>
</OnboardingProvider>
```

Pre-defined tours:
- `adminOnboardingTour` - Admin panel introduction
- `warehouseOnboardingTour` - Warehouse app introduction

#### Theme Provider
`theme-provider.tsx`

Dark/light theme support with system preference detection.

```tsx
import { ThemeProvider, ThemeToggle, useTheme } from '@/components/ui/theme-provider'

<ThemeProvider defaultTheme="system">
  <App />
  <ThemeToggle /> {/* Toggle button */}
</ThemeProvider>
```

#### Keyboard Shortcuts
`keyboard-shortcuts.tsx`

Global keyboard shortcuts with command palette (Ctrl+K).

```tsx
import { ShortcutsProvider, useShortcut, CommandPalette } from '@/components/ui/keyboard-shortcuts'

function MyComponent() {
  useShortcut({ key: 'n', ctrl: true }, () => createNew(), 'Create new item')
  return <div>...</div>
}

<ShortcutsProvider>
  <CommandPalette commands={commands} />
  <MyComponent />
</ShortcutsProvider>
```

Default shortcuts:
- `Ctrl+K` / `Cmd+K` - Open command palette
- `?` - Show shortcuts help
- `Escape` - Close modals/palettes

---

## Database Migration

### Location
`services/core/migrations/005_advanced_features.sql`

### Tables Created

1. **tenants** - Multi-tenancy
2. **return_requests, return_items, return_history, return_policies** - RMA
3. **cdp_events, cdp_customer_profiles, cdp_segments, cdp_segment_members, cdp_automations** - CDP
4. **inbox_conversations, inbox_messages, inbox_quick_replies** - Inbox
5. **image_embeddings** - Visual Search
6. **fraud_assessments, fraud_blacklist, fraud_rules** - Fraud Detection

### Row Level Security

RLS is enabled on all tenant-scoped tables. Set tenant context before queries:

```sql
SET app.tenant_id = 'tenant-123';
SELECT * FROM return_requests; -- Only returns tenant-123 data
```

---

## Testing

### Go Tests
```bash
cd services/core
go test ./internal/tenant/...
go test ./internal/returns/...
go test ./internal/cdp/...
go test ./internal/inbox/...
go test ./internal/visualsearch/...
go test ./internal/fraud/...
```

### React Component Tests
```bash
cd services/storefront
npm test -- --testPathPattern="components/ui"
```

---

## Integration Notes

### Wiring Services in main.go

```go
// Initialize repositories
tenantRepo := tenant.NewPostgresRepository(db)
tenantCache := tenant.NewRedisCache(redis)
tenantService := tenant.NewTenantService(tenantRepo, tenantCache)

// Add middleware to router
router.Use(tenant.TenantMiddleware(tenantService, "shop.com"))

// Initialize other services with tenant awareness
rmaService := returns.NewRMAService(...)
cdpService := cdp.NewCDPService(...)
// etc.
```

### Environment Variables

```env
# Database
DATABASE_URL=postgres://user:pass@localhost/shop

# Redis
REDIS_URL=redis://localhost:6379

# CLIP Service (for Visual Search)
CLIP_SERVICE_URL=http://clip:8080

# GeoIP Service (for Fraud Detection)
GEOIP_SERVICE_URL=http://geoip:8080
```

---

## 8. Production Roadmap Features

### 8.1 Complete Row Level Security (RLS)

#### Location
`services/core/migrations/006_complete_rls.sql`

#### Overview
"Залізний захист" - Iron protection against data leaks between tenants. RLS is enforced at database level.

#### Key Components

```sql
-- Helper function to get current tenant
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS VARCHAR(255) AS $
BEGIN
    RETURN NULLIF(current_setting('app.tenant_id', true), '');
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is superadmin (can see all data)
CREATE OR REPLACE FUNCTION is_superadmin() RETURNS BOOLEAN AS $
BEGIN
    RETURN COALESCE(current_setting('app.is_superadmin', true), 'false') = 'true';
END;
$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Tables with RLS Enabled
- products, product_variants, product_categories
- orders, order_items, order_status_history
- customers, customer_addresses
- return_requests, return_items
- cdp_events, cdp_customer_profiles
- inbox_conversations, inbox_messages
- fraud_assessments, fraud_blacklist
- And all other tenant-scoped tables

#### Usage in Application

```go
// Set tenant context before any query
func setTenantContext(ctx context.Context, db *sql.DB, tenantID string) error {
    _, err := db.ExecContext(ctx, "SET app.tenant_id = $1", tenantID)
    return err
}

// Middleware automatically sets context
func TenantMiddleware(tenantService TenantService) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tenantID := extractTenantID(r)
            setTenantContext(r.Context(), db, tenantID)
            next.ServeHTTP(w, r)
        })
    }
}
```

---

### 8.2 Billing System

#### Location
`services/core/internal/billing/billing.go`

#### Overview
Complete subscription billing with Ukrainian payment gateways support.

#### Plans

| Plan | Price (UAH) | Products | Orders/Month | Storage | API Calls |
|------|-------------|----------|--------------|---------|-----------|
| Free | 0 | 50 | 100 | 100 MB | 1,000 |
| Starter | 499/month | 500 | 1,000 | 1 GB | 10,000 |
| Professional | 1,499/month | 5,000 | 10,000 | 10 GB | 100,000 |
| Enterprise | 4,999/month | Unlimited | Unlimited | 100 GB | Unlimited |

#### Payment Gateways

1. **LiqPay** (Primary for Ukraine)
```go
gateway := billing.NewLiqPayGateway(publicKey, privateKey)
```

2. **Stripe** (International)
```go
gateway := billing.NewStripeGateway(secretKey)
```

3. **Fondy** (Ukraine)
```go
gateway := billing.NewFondyGateway(merchantID, secretKey)
```

#### API Endpoints

```
GET  /api/v1/billing/plans          - List available plans
GET  /api/v1/billing/subscription   - Get current subscription
POST /api/v1/billing/subscription   - Create subscription
PUT  /api/v1/billing/subscription   - Change plan
DELETE /api/v1/billing/subscription - Cancel subscription
GET  /api/v1/billing/invoices       - List invoices
POST /api/v1/billing/invoices/{id}/pay - Pay invoice
GET  /api/v1/billing/usage          - Get current usage
```

#### Automatic Suspension

Tenants are automatically suspended after:
- 7 days grace period for overdue invoices
- Exceeding plan limits by >50%

```go
// Check quota before operations
allowed, err := billingService.CheckQuota(ctx, tenantID, "products", 1)
if !allowed {
    return billing.ErrQuotaExceeded
}
```

---

### 8.3 1-Click Tenant Onboarding

#### Location
`services/core/internal/onboarding/onboarding.go`

#### Overview
Automated store creation with DNS provisioning, SSL certificates, and API keys.

#### Onboarding Flow

```
1. Validate Request
   ↓
2. Check Slug Availability
   ↓
3. Create Owner User
   ↓
4. Create Tenant
   ↓
5. Assign Admin Role
   ↓
6. Generate API Keys
   ↓
7. Create Subscription
   ↓
8. Provision DNS (subdomain.shop.com)
   ↓
9. Request SSL Certificate
   ↓
10. Send Welcome Email
   ↓
11. Track Analytics
```

#### API Endpoints

```
POST /api/v1/onboarding           - Create new store
GET  /api/v1/onboarding/check-slug?slug=mystore - Check availability
POST /api/v1/onboarding/custom-domain - Add custom domain
GET  /api/v1/onboarding/verify-domain?domain=mystore.com - Verify DNS
```

#### Request Example

```json
{
  "owner_email": "owner@example.com",
  "owner_name": "John Doe",
  "owner_phone": "+380991234567",
  "owner_password": "securepassword123",
  "store_name": "My Awesome Store",
  "store_slug": "my-awesome-store",
  "store_category": "electronics",
  "plan_id": "starter",
  "billing_period": "monthly",
  "promo_code": "LAUNCH50"
}
```

#### Response

```json
{
  "tenant_id": "tenant-abc123",
  "slug": "my-awesome-store",
  "domain": "my-awesome-store.shop.com",
  "admin_url": "https://admin.shop.com/my-awesome-store",
  "storefront_url": "https://my-awesome-store.shop.com",
  "api_key": "shop_live_xxxx",
  "secret_key": "shop_secret_xxxx"
}
```

#### DNS Providers

1. **Cloudflare** (Recommended)
```env
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ZONE_ID=xxx
```

2. **AWS Route53**
```env
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_HOSTED_ZONE_ID=xxx
```

---

### 8.4 Visual Search with Qdrant

#### Location
`services/core/internal/visualsearch/qdrant_provider.go`

#### Overview
For production with >1M products, Qdrant provides millisecond search.

#### Configuration

```env
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=optional-api-key
QDRANT_COLLECTION=product_images
```

#### Why Qdrant over pgvector?

| Feature | pgvector | Qdrant |
|---------|----------|--------|
| Best for | <100K vectors | >1M vectors |
| Search latency | 50-200ms | 5-20ms |
| Horizontal scaling | No | Yes |
| Tenant filtering | SQL WHERE | Payload filters |

#### API Endpoints

```
POST /api/v1/visual-search/search       - Search by image upload
POST /api/v1/visual-search/similar/{id} - Find similar products
POST /api/v1/visual-search/index        - Index product image
DELETE /api/v1/visual-search/index/{id} - Remove from index
```

#### Usage

```go
// Initialize with Qdrant
provider := visualsearch.NewQdrantProvider(visualsearch.QdrantConfig{
    URL:        "http://qdrant:6333",
    Collection: "product_images",
})

// Search
results, err := provider.Search(ctx, tenantID, vector, 10, 0.7)

// Batch index
err := provider.UpsertBatch(ctx, embeddings)
```

---

### 8.5 Kubernetes Deployment (Helm)

#### Location
`deploy/helm/shop-platform/`

#### Overview
Production-ready Helm charts with auto-scaling.

#### Structure

```
deploy/helm/shop-platform/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── hpa.yaml
    ├── pdb.yaml
    └── traefik-middleware.yaml
```

#### Quick Deploy

```bash
# Add dependencies
helm dependency update

# Install
helm install shop-platform ./deploy/helm/shop-platform \
  --namespace shop \
  --create-namespace \
  --values values.yaml \
  --values values-production.yaml
```

#### Auto-scaling Configuration

```yaml
# values.yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

#### Traefik Rate Limiting

```yaml
# Per-tenant rate limiting (100 req/s)
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit-per-tenant
spec:
  rateLimit:
    average: 100
    burst: 200
    sourceCriterion:
      requestHeaderName: X-Tenant-ID

# Per-IP rate limiting (10 req/s)
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit-per-ip
spec:
  rateLimit:
    average: 10
    burst: 20
    sourceCriterion:
      ipStrategy:
        depth: 1
```

---

## Environment Variables (Complete)

```env
# Database
DATABASE_URL=postgres://user:pass@localhost/shop

# Redis
REDIS_URL=redis://localhost:6379

# Qdrant (Visual Search)
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=optional

# CLIP Embeddings
CLIP_SERVICE_URL=http://clip:8080
# OR
OPENAI_API_KEY=sk-xxx
# OR
REPLICATE_API_TOKEN=xxx

# Payment Gateways
LIQPAY_PUBLIC_KEY=xxx
LIQPAY_PRIVATE_KEY=xxx
# OR
STRIPE_SECRET_KEY=sk_xxx
# OR
FONDY_MERCHANT_ID=xxx
FONDY_SECRET_KEY=xxx

# DNS Provider
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ZONE_ID=xxx
# OR
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_HOSTED_ZONE_ID=xxx

# SSL Certificates
CERT_MANAGER_ENABLED=true

# Platform
BASE_DOMAIN=shop.com
ADMIN_DOMAIN=admin.shop.com
LOAD_BALANCER_IP=1.2.3.4

# Fraud Detection
FRAUD_ML_ENABLED=true
GEOIP_SERVICE_URL=http://geoip:8080
```

---

## API Routes Summary

### Advanced Feature Routes

| Method | Path | Description |
|--------|------|-------------|
| **Tenants** |||
| GET | /api/v1/tenants | List tenants |
| POST | /api/v1/tenants | Create tenant |
| GET | /api/v1/tenants/{id} | Get tenant |
| PUT | /api/v1/tenants/{id} | Update tenant |
| DELETE | /api/v1/tenants/{id} | Delete tenant |
| GET | /api/v1/tenants/{id}/usage | Get usage stats |
| **Billing** |||
| GET | /api/v1/billing/plans | List plans |
| GET | /api/v1/billing/subscription | Get subscription |
| POST | /api/v1/billing/subscription | Create subscription |
| PUT | /api/v1/billing/subscription | Update plan |
| DELETE | /api/v1/billing/subscription | Cancel |
| GET | /api/v1/billing/invoices | List invoices |
| POST | /api/v1/billing/invoices/{id}/pay | Pay invoice |
| **Onboarding** |||
| POST | /api/v1/onboarding | Create store |
| GET | /api/v1/onboarding/check-slug | Check availability |
| POST | /api/v1/onboarding/custom-domain | Add domain |
| GET | /api/v1/onboarding/verify-domain | Verify DNS |
| **RMA** |||
| GET | /api/v1/returns | List returns |
| POST | /api/v1/returns | Create return |
| POST | /api/v1/returns/{id}/approve | Approve |
| POST | /api/v1/returns/{id}/reject | Reject |
| POST | /api/v1/returns/{id}/refund | Process refund |
| **CDP** |||
| GET | /api/v1/cdp/profiles | List profiles |
| POST | /api/v1/cdp/events | Track event |
| GET | /api/v1/cdp/segments | List segments |
| POST | /api/v1/cdp/segments | Create segment |
| **Inbox** |||
| GET | /api/v1/inbox/conversations | List conversations |
| POST | /api/v1/inbox/conversations/{id}/messages | Send message |
| PUT | /api/v1/inbox/conversations/{id}/assign | Assign agent |
| **Visual Search** |||
| POST | /api/v1/visual-search/search | Search by image |
| POST | /api/v1/visual-search/similar/{id} | Find similar |
| POST | /api/v1/visual-search/index | Index image |
| **Fraud** |||
| POST | /api/v1/fraud/check | Check order |
| GET | /api/v1/fraud/rules | List rules |
| POST | /api/v1/fraud/rules | Create rule |

---

## Testing

### Run All Tests

```bash
cd services/core
go test ./... -v

# Specific packages
go test ./internal/billing/... -v
go test ./internal/onboarding/... -v
go test ./internal/visualsearch/... -v
```

### Test Coverage

```bash
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

---

## Files Created/Modified

### Production Roadmap Implementation

| File | Description |
|------|-------------|
| `migrations/006_complete_rls.sql` | Complete RLS for all tables |
| `internal/billing/billing.go` | Billing service |
| `internal/billing/billing_test.go` | Billing tests |
| `internal/onboarding/onboarding.go` | Onboarding service |
| `internal/onboarding/onboarding_test.go` | Onboarding tests |
| `internal/visualsearch/qdrant_provider.go` | Qdrant integration |
| `internal/visualsearch/qdrant_provider_test.go` | Qdrant tests |
| `cmd/advanced_init.go` | Service initialization |
| `internal/transport/http/advanced_handlers.go` | HTTP handlers |
| `deploy/helm/shop-platform/` | Helm charts |
