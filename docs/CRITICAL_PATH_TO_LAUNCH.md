# Critical Path to Launch - Documentation

Цей документ описує критичні компоненти, які необхідні для production-ready запуску SaaS e-commerce платформи.

## Зміст

1. [Super-Admin Dashboard](#1-super-admin-dashboard)
2. [Billing & Self-Service](#2-billing--self-service)
3. [Zero Downtime Migrations](#3-zero-downtime-migrations)
4. [API Keys & Webhooks](#4-api-keys--webhooks)
5. [K8s Observability](#5-k8s-observability)

---

## 1. Super-Admin Dashboard

### Призначення
Централізована панель управління для адміністраторів платформи з можливістю zero-touch provisioning нових тенантів.

### Розташування
- **Frontend**: `services/superadmin/`
- **Backend API**: `services/core/internal/superadmin/`

### Функціональність

#### 1.1 Tenant Management

```go
// Створення тенанта з автоматичним provisioning
type CreateTenantInput struct {
    Name       string           // Назва магазину
    Domain     string           // Піддомен (mystore → mystore.shop.com)
    Plan       SubscriptionPlan // starter | pro | enterprise
    OwnerEmail string           // Email власника
    OwnerName  string           // Ім'я власника
}

// Результат provisioning
type ProvisioningResult struct {
    TenantID       string // ten_abc123
    Domain         string // mystore
    DatabaseSchema string // tenant_mystore
    APIKey         string // shop_live_xxx
    SecretKey      string // shop_secret_xxx
    AdminURL       string // https://admin.mystore.shop.com
    StorefrontURL  string // https://mystore.shop.com
}
```

#### 1.2 Zero-Touch Provisioning

Автоматичний процес при створенні тенанта:

1. **Database Schema** - Створення ізольованої схеми PostgreSQL
2. **DNS Record** - Автоматичне створення A/CNAME записів
3. **SSL Certificate** - Provisioning Let's Encrypt сертифіката
4. **API Keys** - Генерація API ключів для інтеграцій
5. **Initial Data** - Seed базових категорій та налаштувань

#### 1.3 Plan Limits

| Plan | Products | Orders | Users | Storage | API Rate |
|------|----------|--------|-------|---------|----------|
| Starter | 100 | 500 | 2 | 1GB | 100/s |
| Pro | 10,000 | 10,000 | 10 | 10GB | 1,000/s |
| Enterprise | ∞ | ∞ | ∞ | 100GB | 10,000/s |

#### 1.4 Features per Plan

```go
var PlanLimits = map[SubscriptionPlan]PlanLimit{
    PlanStarter: {
        Features: []string{"basic_analytics", "email_support"},
    },
    PlanPro: {
        Features: []string{
            "advanced_analytics",
            "visual_search",
            "priority_support",
            "custom_domain",
        },
    },
    PlanEnterprise: {
        Features: []string{
            "unlimited",
            "fraud_detection",
            "cdp",
            "dedicated_support",
            "sla_99_9",
        },
    },
}
```

### API Endpoints

```
POST   /api/superadmin/tenants          - Створити тенанта
GET    /api/superadmin/tenants          - Список тенантів
GET    /api/superadmin/tenants/:id      - Деталі тенанта
PATCH  /api/superadmin/tenants/:id      - Оновити тенанта
POST   /api/superadmin/tenants/:id/suspend    - Заблокувати
POST   /api/superadmin/tenants/:id/reactivate - Розблокувати
DELETE /api/superadmin/tenants/:id      - Видалити (soft)
GET    /api/superadmin/stats            - Статистика платформи
```

### Тести
```bash
go test ./internal/superadmin/... -v
```

---

## 2. Billing & Self-Service

### Призначення
Самообслуговування підписок з інтеграцією платіжних шлюзів (LiqPay, Stripe, Fondy).

### Розташування
- **Frontend**: `services/admin/src/app/settings/billing/`
- **Components**: `services/admin/src/components/billing/`

### Функціональність

#### 2.1 Subscription Management

- Перегляд поточного плану та використання
- Upgrade/Downgrade підписки
- Історія платежів
- Управління платіжними методами

#### 2.2 Payment Gateways

**LiqPay Integration:**
```typescript
const liqpayConfig = {
  public_key: process.env.LIQPAY_PUBLIC_KEY,
  private_key: process.env.LIQPAY_PRIVATE_KEY,
  sandbox: process.env.NODE_ENV !== 'production'
};
```

**Stripe Integration:**
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Створення Checkout Session
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{
    price: planPriceId,
    quantity: 1,
  }],
  mode: 'subscription',
  success_url: `${baseUrl}/settings/billing?success=true`,
  cancel_url: `${baseUrl}/settings/billing?canceled=true`,
});
```

**Fondy Integration:**
```typescript
const fondyConfig = {
  merchant_id: process.env.FONDY_MERCHANT_ID,
  password: process.env.FONDY_PASSWORD,
};
```

#### 2.3 Usage Tracking

```typescript
interface TenantUsage {
  productCount: number;
  orderCount: number;
  userCount: number;
  storageUsed: number;
  apiCallsToday: number;
  apiCallsMonth: number;
}

interface UsageDisplay {
  used: number;
  limit: number;
  percentage: number;
}
```

#### 2.4 Past Due Handling

При простроченому платежі:
1. Warning banner в admin панелі
2. Email нагадування (1, 3, 7 днів)
3. Grace period 14 днів
4. Автоматична призупинення тенанта

---

## 3. Zero Downtime Migrations

### Призначення
Безпечна міграція бази даних для 1000+ тенантів без простою.

### Розташування
- **Service**: `services/core/internal/migrations/`

### Стратегія

#### 3.1 Safe Column Addition Pattern

```go
// 1. Додати nullable колонку (instant, no lock)
ALTER TABLE products ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(20);

// 2. Backfill даних батчами
UPDATE products SET loyalty_tier = 'bronze'
WHERE loyalty_tier IS NULL AND id > $lastID
LIMIT 1000;

// 3. Додати NOT NULL constraint
ALTER TABLE products ALTER COLUMN loyalty_tier SET NOT NULL;

// 4. Встановити default для нових записів
ALTER TABLE products ALTER COLUMN loyalty_tier SET DEFAULT 'bronze';
```

#### 3.2 Safe Index Creation

```go
// CREATE INDEX CONCURRENTLY не блокує таблицю
// ВАЖЛИВО: не може виконуватись в транзакції!
type MigrationStep struct {
    Name  string
    NoTx  bool // true для CREATE INDEX CONCURRENTLY
    Up    func(ctx context.Context, tx *sql.Tx) error
    Down  func(ctx context.Context, tx *sql.Tx) error
}
```

#### 3.3 ZeroDowntimeMigrator

```go
type ZeroDowntimeMigrator struct {
    db        *sql.DB
    batchSize int           // Default: 1000
    timeout   time.Duration // Default: 30 minutes
}

// Безпечне додавання колонки з default
func (m *ZeroDowntimeMigrator) SafeAddColumnWithDefault(
    ctx context.Context,
    addition SafeColumnAddition,
) error {
    // Step 1: Add nullable column
    // Step 2: Backfill in batches
    // Step 3: Add NOT NULL constraint
    // Step 4: Set default for future inserts
    // Step 5: Create index (optional)
}
```

#### 3.4 Migration Steps Order

1. `add_nullable_column` - Додати колонку (instant)
2. `backfill_data` - Заповнити існуючі записи (batched)
3. `add_not_null_constraint` - Додати constraint
4. `set_default_value` - Default для нових записів
5. `create_index` - Створити індекс (concurrent)

### Тести
```bash
go test ./internal/migrations/... -v
```

---

## 4. API Keys & Webhooks

### Призначення
Developer Experience для інтеграцій: API ключі та webhooks.

### Розташування
- **API Keys**: `services/core/internal/apikeys/`
- **Webhooks**: `services/core/internal/webhooks/`
- **Frontend**: `services/admin/src/app/settings/api/`

### 4.1 API Keys

#### Key Format
```
API Key:    shop_live_abc123...  (public, safe to log)
Secret Key: shop_secret_xyz789... (secret, never log)
```

#### Key Structure
```go
type APIKey struct {
    ID          string     // key_abc123
    TenantID    string     // ten_xyz789
    Name        string     // "Production Key"
    KeyPrefix   string     // shop_live_abc (for display)
    KeyHash     string     // SHA256(apiKey + ":" + secretKey)
    Permissions []string   // ["read:products", "write:orders"]
    LastUsedAt  *time.Time
    ExpiresAt   *time.Time
    RevokedAt   *time.Time
}
```

#### Permissions System
```go
var AvailablePermissions = []string{
    "read:products",
    "write:products",
    "read:orders",
    "write:orders",
    "read:customers",
    "write:customers",
    "read:analytics",
    "read:inventory",
    "write:inventory",
    "admin",  // Full access
}

// Wildcard permissions
// "read:*" matches "read:products", "read:orders", etc.
// "admin" matches everything
```

#### Validation Flow
```go
func (s *Service) Validate(ctx context.Context, apiKey, secretKey string) (*APIKey, error) {
    // 1. Check for empty keys
    // 2. Hash and lookup
    // 3. Check if revoked
    // 4. Check expiration
    // 5. Update last used (async)
    // 6. Return key info
}
```

### 4.2 Webhooks

#### Event Types
```go
const (
    // Order events
    EventOrderCreated    = "order.created"
    EventOrderUpdated    = "order.updated"
    EventOrderPaid       = "order.paid"
    EventOrderShipped    = "order.shipped"
    EventOrderDelivered  = "order.delivered"
    EventOrderCancelled  = "order.cancelled"

    // Product events
    EventProductCreated  = "product.created"
    EventProductUpdated  = "product.updated"
    EventProductDeleted  = "product.deleted"
    EventProductOutOfStock = "product.out_of_stock"

    // Customer events
    EventCustomerCreated = "customer.created"
    EventCustomerUpdated = "customer.updated"

    // Payment events
    EventPaymentReceived = "payment.received"
    EventPaymentFailed   = "payment.failed"
)
```

#### Webhook Payload
```json
{
  "id": "evt_abc123",
  "type": "order.created",
  "created_at": "2024-01-15T10:30:00Z",
  "data": {
    "order_id": "order_xyz",
    "order_number": "ORD-001",
    "total": 1500.00,
    "customer_email": "customer@example.com"
  }
}
```

#### Signature Verification
```go
// HMAC-SHA256 signature
func SignPayload(payload []byte, secret string) string {
    h := hmac.New(sha256.New, []byte(secret))
    h.Write(payload)
    return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

// Headers sent with webhook
// X-Webhook-Signature: sha256=abc123...
// X-Webhook-ID: whk_xxx
// X-Webhook-Event: order.created
// X-Webhook-Timestamp: 2024-01-15T10:30:00Z
```

#### Retry Policy
```go
type RetryPolicy struct {
    MaxRetries:    5,
    InitialDelay:  1 * time.Second,
    MaxDelay:      1 * time.Hour,
    BackoffFactor: 2.0,  // Exponential backoff
}
```

### Тести
```bash
go test ./internal/apikeys/... -v
go test ./internal/webhooks/... -v
```

---

## 5. K8s Observability

### Призначення
Централізований моніторинг та логування для production Kubernetes кластера.

### Розташування
- **Helm Charts**: `deploy/helm/shop-platform/templates/observability/`
- **Values**: `deploy/helm/shop-platform/values.yaml`

### 5.1 Stack Components

| Component | Purpose | Port |
|-----------|---------|------|
| Loki | Log aggregation | 3100 |
| Promtail | Log collection | - |
| Prometheus | Metrics | 9090 |
| Grafana | Visualization | 3000 |

### 5.2 Loki Configuration

```yaml
loki:
  enabled: true
  storage: 50Gi
  retention: 168h  # 7 days
  ingestion:
    rateMB: 10
    burstMB: 15
```

#### Log Query Examples
```logql
# Errors by tenant
{app="shop-core"} |= "error" | json | line_format "{{.tenant_id}}: {{.msg}}"

# Slow requests (>1s)
{app="shop-core"} | json | duration > 1s

# Failed payments
{app="shop-core"} | json | event="payment.failed"
```

### 5.3 Promtail Configuration

```yaml
promtail:
  enabled: true
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 256Mi
```

Автоматично збирає логи з:
- Всіх pods у namespace
- System logs
- Container stderr/stdout

### 5.4 Grafana Dashboards

#### Multi-Tenant Overview
- Active tenants count
- Requests by tenant (Top 10)
- Error rate by tenant
- Latency p99 by tenant
- Recent error logs

#### API Performance
- Request rate by endpoint
- Response time distribution (heatmap)
- Error rate percentage
- Slowest endpoints table

#### Billing & Usage
- MRR by plan (pie chart)
- Product usage vs limit
- Tenants approaching limits
- Past due subscriptions count

### 5.5 Alerting Rules

```yaml
alerts:
  - name: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m]))
      / sum(rate(http_requests_total[5m])) > 0.05
    for: 5m
    severity: critical

  - name: TenantApproachingProductLimit
    expr: tenant_product_count / tenant_product_limit > 0.9
    for: 1h
    severity: warning

  - name: SubscriptionPastDue
    expr: tenant_subscription_status == 2
    for: 24h
    severity: warning
```

### 5.6 Deployment

```bash
# Deploy with observability enabled
helm upgrade --install shop-platform ./deploy/helm/shop-platform \
  --set observability.enabled=true \
  --set observability.grafana.enabled=true \
  --set observability.loki.enabled=true

# Access Grafana
kubectl port-forward svc/grafana 3000:3000
# Open http://localhost:3000
```

---

## Quick Start Checklist

### Pre-Launch
- [ ] Configure payment gateway credentials
- [ ] Set up DNS wildcard (*.shop.com)
- [ ] Configure SSL certificate issuer (cert-manager)
- [ ] Set up external secrets (Vault/AWS Secrets Manager)
- [ ] Deploy observability stack

### First Tenant
1. Access Super-Admin Dashboard
2. Create tenant with desired plan
3. Wait for provisioning (DNS, SSL, DB)
4. Share admin URL with tenant owner
5. Monitor in Grafana

### Monitoring
- [ ] Configure alerting channels (Slack, PagerDuty)
- [ ] Review dashboards for anomalies
- [ ] Set up on-call rotation

---

## Testing

Run all Critical Path tests:

```bash
# All backend tests
cd services/core
go test ./internal/... -v

# Specific components
go test ./internal/superadmin/... -v  # Super-Admin
go test ./internal/apikeys/... -v     # API Keys
go test ./internal/webhooks/... -v    # Webhooks
go test ./internal/migrations/... -v  # Migrations

# Frontend tests (якщо налаштовано)
cd services/admin && npm test
cd services/superadmin && npm test
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Super-Admin Dashboard                     │
│              (Tenant Management, Platform Stats)             │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Core API Service                        │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐  │
│  │  Super-Admin │   API Keys   │   Webhooks   │ Migrations│  │
│  │    Service   │   Service    │   Service    │  Service  │  │
│  └──────────────┴──────────────┴──────────────┴──────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    PostgreSQL (Multi-tenant)                 │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ tenant_a │ tenant_b │ tenant_c │   ...    │ tenant_n │   │
│  │  schema  │  schema  │  schema  │          │  schema  │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    K8s Observability                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   Loki   │  │ Promtail │  │Prometheus│  │ Grafana  │    │
│  │  (Logs)  │  │(Collect) │  │(Metrics) │  │  (UI)    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Версії

| Component | Version |
|-----------|---------|
| Go | 1.21+ |
| PostgreSQL | 15+ |
| Grafana | 10.2.0 |
| Loki | 2.9.0 |

---

*Документація оновлена: 2024*
