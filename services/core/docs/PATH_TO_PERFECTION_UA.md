# Шлях до досконалості - Advanced Features

Документація для продвинутих функцій платформи: Infrastructure as Code, API Gateway, App Store, Global Search та Domain Management.

## Зміст

1. [Terraform Infrastructure as Code](#terraform-infrastructure-as-code)
2. [API Gateway & Usage Metering](#api-gateway--usage-metering)
3. [App Store Ecosystem](#app-store-ecosystem)
4. [Global Search (Cross-Tenant)](#global-search-cross-tenant)
5. [Domain Management](#domain-management)

---

## Terraform Infrastructure as Code

### Огляд

Terraform конфігурації для розгортання інфраструктури на AWS та DigitalOcean з підтримкою disaster recovery.

### Структура

```
infrastructure/terraform/
├── aws/
│   ├── main.tf              # Головна конфігурація AWS
│   ├── variables.tf         # Змінні
│   ├── outputs.tf           # Вихідні значення
│   └── environments/
│       ├── production.tfvars   # Production налаштування
│       └── staging.tfvars      # Staging налаштування
└── digitalocean/
    ├── main.tf              # Конфігурація DO
    └── variables.tf         # Змінні DO
```

### AWS Компоненти

| Компонент | Ресурс | Опис |
|-----------|--------|------|
| **VPC** | `aws_vpc` | Ізольована мережа з public/private subnets |
| **EKS** | `aws_eks_cluster` | Kubernetes кластер для мікросервісів |
| **RDS** | `aws_db_instance` | PostgreSQL база даних |
| **ElastiCache** | `aws_elasticache_cluster` | Redis кластер |
| **S3** | `aws_s3_bucket` | Object storage для медіа |
| **CloudFront** | `aws_cloudfront_distribution` | CDN для статики |
| **Route53** | `aws_route53_zone` | DNS управління |
| **ALB** | `aws_lb` | Load Balancer |

### Розгортання AWS

```bash
cd infrastructure/terraform/aws

# Ініціалізація
terraform init

# Планування (staging)
terraform plan -var-file="environments/staging.tfvars"

# Застосування
terraform apply -var-file="environments/staging.tfvars"

# Production
terraform apply -var-file="environments/production.tfvars"
```

### DigitalOcean (Alternative)

```bash
cd infrastructure/terraform/digitalocean

# Встановити токен
export DO_TOKEN="your-token"

terraform init
terraform apply
```

### Disaster Recovery

- Multi-region deployment через модульну архітектуру
- S3 cross-region replication
- RDS read replicas
- Automated backups

---

## API Gateway & Usage Metering

### Огляд

Система обмеження швидкості (rate limiting) та обліку використання ресурсів по тенантах.

### Файли

- `internal/metering/metering.go` - Сервіс метрик
- `internal/metering/metering_test.go` - Тести

### Типи метрик

```go
const (
    MetricAPIRequests    MetricType = "api_requests"
    MetricStorageBytes   MetricType = "storage_bytes"
    MetricProductCount   MetricType = "products"
    MetricOrderCount     MetricType = "orders"
    MetricEmailsSent     MetricType = "emails_sent"
    MetricSMSSent        MetricType = "sms_sent"
    MetricBandwidthBytes MetricType = "bandwidth_bytes"
    MetricActiveUsers    MetricType = "active_users"
)
```

### Тарифні плани

| План | API Requests | Products | Storage | Overage |
|------|-------------|----------|---------|---------|
| **Starter** | 100K/mo | 1,000 | 5GB | Blocked |
| **Professional** | 1M/mo | 10,000 | 50GB | $0.01/1K req |
| **Enterprise** | 10M/mo | Unlimited | 500GB | $0.005/1K req |

### Використання

```go
// Ініціалізація
service := metering.NewService(repo, rateLimiter)

// Запис використання
err := service.RecordUsage(ctx, tenantID, metering.MetricAPIRequests, 1)

// Перевірка квоти перед записом
err := service.CheckAndRecord(ctx, tenantID, metering.MetricAPIRequests, 1)
if err == metering.ErrQuotaExceeded {
    // Квота вичерпана
}
if err == metering.ErrRateLimitExceeded {
    // Rate limit перевищено
}

// Отримати поточне використання
usage, err := service.GetCurrentUsage(ctx, tenantID, metering.MetricAPIRequests)

// Перевірка чи в межах квоти
allowed, err := service.IsWithinQuota(ctx, tenantID, metering.MetricProductCount, 100)
```

### Rate Limiting

```go
type RateLimiter interface {
    Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error)
}
```

- Token bucket algorithm
- Per-tenant limits
- Configurable windows (second, minute, hour)

---

## App Store Ecosystem

### Огляд

OAuth2 екосистема для сторонніх розробників з підтримкою webhooks та marketplace додатків.

### Файли

- `internal/appstore/apps.go` - Сервіс додатків
- `internal/appstore/apps_test.go` - Тести

### OAuth2 Scopes

```go
const (
    ScopeReadProducts   OAuthScope = "read:products"
    ScopeWriteProducts  OAuthScope = "write:products"
    ScopeReadOrders     OAuthScope = "read:orders"
    ScopeWriteOrders    OAuthScope = "write:orders"
    ScopeReadCustomers  OAuthScope = "read:customers"
    ScopeWriteCustomers OAuthScope = "write:customers"
    ScopeReadAnalytics  OAuthScope = "read:analytics"
    ScopeWebhooks       OAuthScope = "webhooks"
    ScopeAdmin          OAuthScope = "admin"
)
```

### Реєстрація додатку

```go
app, secret, err := service.RegisterApp(ctx, developerID, appstore.RegisterAppInput{
    Name:         "My Integration",
    Description:  "Sync products with external system",
    Website:      "https://myapp.com",
    RedirectURIs: []string{"https://myapp.com/oauth/callback"},
    Scopes:       []appstore.OAuthScope{
        appstore.ScopeReadProducts,
        appstore.ScopeWriteProducts,
    },
    Category:     appstore.CategoryIntegrations,
})
```

### OAuth2 Authorization Flow

```go
// 1. Генерація authorization URL
authURL := fmt.Sprintf(
    "https://shop.com/oauth/authorize?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
    clientID, redirectURI, "read:products write:products", state,
)

// 2. Авторизація користувачем
code, err := service.Authorize(ctx, appstore.AuthorizeInput{
    ClientID:    clientID,
    TenantID:    tenantID,
    Scopes:      scopes,
    State:       state,
    RedirectURI: redirectURI,
})

// 3. Обмін коду на токен
tokens, err := service.ExchangeCode(ctx, appstore.ExchangeCodeInput{
    Code:         code,
    ClientID:     clientID,
    ClientSecret: secret,
    RedirectURI:  redirectURI,
})
// tokens.AccessToken, tokens.RefreshToken
```

### PKCE Support

```go
// Authorization з PKCE
code, err := service.Authorize(ctx, appstore.AuthorizeInput{
    ClientID:            clientID,
    TenantID:            tenantID,
    Scopes:              scopes,
    CodeChallenge:       challenge,
    CodeChallengeMethod: "S256",
})

// Exchange з verifier
tokens, err := service.ExchangeCode(ctx, appstore.ExchangeCodeInput{
    Code:         code,
    ClientID:     clientID,
    CodeVerifier: verifier,
})
```

### Webhooks

```go
// Реєстрація webhook
webhook, err := service.RegisterWebhook(ctx, tenantID, appID, appstore.WebhookInput{
    URL:    "https://myapp.com/webhooks",
    Events: []string{"order.created", "product.updated"},
    Secret: "webhook-secret",
})
```

### Категорії додатків

- `CategoryAnalytics` - Аналітика
- `CategoryMarketing` - Маркетинг
- `CategoryIntegrations` - Інтеграції
- `CategoryShipping` - Доставка
- `CategoryPayment` - Платежі
- `CategoryInventory` - Склад
- `CategorySupport` - Підтримка
- `CategorySEO` - SEO

---

## Global Search (Cross-Tenant)

### Огляд

Крос-тенантний пошук для агрегації товарів з усіх магазинів у єдиний marketplace.

### Файли

- `internal/globalsearch/globalsearch.go` - Сервіс глобального пошуку
- `internal/globalsearch/globalsearch_test.go` - Тести

### Структура GlobalProduct

```go
type GlobalProduct struct {
    ID            string            `json:"id"`
    TenantID      string            `json:"tenant_id"`
    TenantName    string            `json:"tenant_name"`
    TenantDomain  string            `json:"tenant_domain"`
    SKU           string            `json:"sku"`
    Name          string            `json:"name"`
    Description   string            `json:"description"`
    Category      string            `json:"category"`
    Brand         string            `json:"brand,omitempty"`
    Price         float64           `json:"price"`
    SalePrice     *float64          `json:"sale_price,omitempty"`
    Currency      string            `json:"currency"`
    ImageURL      string            `json:"image_url"`
    InStock       bool              `json:"in_stock"`
    Rating        float64           `json:"rating,omitempty"`
    ReviewCount   int               `json:"review_count,omitempty"`
    Visibility    ProductVisibility `json:"visibility"`
}
```

### Видимість товарів

```go
const (
    VisibilityPrivate  ProductVisibility = "private"  // Тільки в магазині тенанта
    VisibilityPublic   ProductVisibility = "public"   // Глобальний marketplace
    VisibilityPartners ProductVisibility = "partners" // Тільки партнерська мережа
)
```

### Пошук

```go
result, err := service.Search(ctx, globalsearch.SearchQuery{
    Query:      "iPhone 15",
    Categories: []string{"electronics", "phones"},
    PriceMin:   ptr(500.0),
    PriceMax:   ptr(1500.0),
    InStock:    ptr(true),
    SortBy:     "price_asc",
    Page:       1,
    PageSize:   20,
})

// result.Products - знайдені товари
// result.Total - загальна кількість
// result.Facets - фільтри (категорії, бренди, діапазони цін)
```

### Порівняння цін

```go
comparison, err := service.ComparePrices(ctx, "SKU-IPHONE-15-256")

// comparison.Offers - пропозиції від різних магазинів
// comparison.LowestPrice - мінімальна ціна
// comparison.HighestPrice - максимальна ціна
// comparison.OfferCount - кількість пропозицій
```

### Налаштування тенанта

```go
err := service.EnableTenant(ctx, &globalsearch.TenantIndexConfig{
    TenantID:     "tenant-1",
    TenantName:   "My Store",
    TenantDomain: "mystore.shop.com",
    IsEnabled:    true,
    Visibility:   globalsearch.VisibilityPublic,
    CategoryMapping: map[string]string{
        "телефони": "phones",  // Локальна → Глобальна категорія
    },
    ExcludeCategories: []string{"adult"},
    PriceMarkup:       5.0,  // +5% для marketplace
    CommissionRate:    2.5,  // 2.5% комісія платформи
})
```

### Синхронізація

```go
// Повна синхронізація всіх товарів тенанта
err := service.SyncTenant(ctx, tenantID)

// Індексація одного товару
err := service.IndexProduct(ctx, tenantID, productID)

// Оновлення товару
err := service.UpdateProduct(ctx, product)

// Видалення товару
err := service.RemoveProduct(ctx, tenantID, productID)
```

---

## Domain Management

### Огляд

Автоматичне управління доменами з SSL сертифікатами (Let's Encrypt) та DNS (Cloudflare).

### Файли

- `internal/domains/domains.go` - Сервіс доменів
- `internal/domains/domains_test.go` - Тести

### Типи доменів

```go
const (
    TypeSubdomain DomainType = "subdomain" // tenant.shop.com
    TypeCustom    DomainType = "custom"    // mystore.com
)
```

### Статуси

```go
const (
    StatusPendingVerification DomainStatus = "pending_verification"
    StatusVerifying           DomainStatus = "verifying"
    StatusVerified            DomainStatus = "verified"
    StatusProvisioningSSL     DomainStatus = "provisioning_ssl"
    StatusActive              DomainStatus = "active"
    StatusFailed              DomainStatus = "failed"
    StatusExpired             DomainStatus = "expired"
)
```

### Додавання субдомену

```go
domain, err := service.AddSubdomain(ctx, tenantID, "mystore")
// Результат: mystore.shop.com
// DNS A-запис створюється автоматично
// SSL provisioning запускається автоматично
```

### Додавання custom домену

```go
// 1. Додати домен
domain, err := service.AddCustomDomain(ctx, tenantID, "mystore.com")

// 2. Отримати інструкції для DNS
instructions, err := service.GetVerificationInstructions(ctx, domain.ID)
// instructions.Records - DNS записи для додавання:
//   - TXT: _shop-verification.mystore.com → verification-token
//   - CNAME: mystore.com → proxy.shop.com

// 3. Після налаштування DNS - верифікувати
result, err := service.VerifyDomain(ctx, domain.ID)
if result.Verified {
    // SSL provisioning запускається автоматично
}
```

### SSL Сертифікати

```go
// Статуси SSL
const (
    SSLNone        SSLStatus = "none"
    SSLPending     SSLStatus = "pending"
    SSLProvisioning SSLStatus = "provisioning"
    SSLActive      SSLStatus = "active"
    SSLExpiring    SSLStatus = "expiring"
    SSLExpired     SSLStatus = "expired"
    SSLFailed      SSLStatus = "failed"
)

// Ручне оновлення SSL
err := service.RenewSSL(ctx, domainID)

// Автоматичне оновлення сертифікатів, що закінчуються
err := service.CheckExpiringCertificates(ctx)
```

### Управління доменами

```go
// Список доменів тенанта
domains, err := service.ListDomains(ctx, tenantID)

// Встановити основний домен
err := service.SetPrimary(ctx, domainID)

// Видалити домен
err := service.DeleteDomain(ctx, domainID)
```

### Cloudflare Integration

```go
type DNSProvider interface {
    CreateRecord(ctx context.Context, zoneID string, record DNSRecord) (string, error)
    UpdateRecord(ctx context.Context, zoneID, recordID string, record DNSRecord) error
    DeleteRecord(ctx context.Context, zoneID, recordID string) error
    GetZoneID(ctx context.Context, domain string) (string, error)
}
```

### Let's Encrypt Integration

```go
type SSLProvider interface {
    ProvisionCertificate(ctx context.Context, domain string) (*SSLCertificate, error)
    RenewCertificate(ctx context.Context, certID string) (*SSLCertificate, error)
    RevokeCertificate(ctx context.Context, certID string) error
}
```

---

## Тестування

Всі компоненти мають повне покриття тестами:

```bash
# Запуск всіх тестів
go test ./internal/metering/... ./internal/appstore/... ./internal/globalsearch/... ./internal/domains/... -v

# З покриттям
go test ./internal/metering/... ./internal/appstore/... ./internal/globalsearch/... ./internal/domains/... -cover
```

### Результати тестів

| Пакет | Статус |
|-------|--------|
| `internal/metering` | PASS |
| `internal/appstore` | PASS |
| `internal/globalsearch` | PASS |
| `internal/domains` | PASS |

---

## Діаграма архітектури

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Load Balancer (ALB)                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                         API Gateway                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ Rate Limiter │ │ Auth/OAuth2  │ │   Metering   │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐     ┌───────▼───────┐     ┌───────▼───────┐
│  App Service  │     │ Global Search │     │Domain Manager │
│  (App Store)  │     │(Elasticsearch)│     │  (SSL/DNS)    │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
┌───────▼───────────────────────────────────────────▼───────┐
│                      Tenant Services                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Store 1 │ │ Store 2 │ │ Store 3 │ │ Store N │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
└─────────────────────────┬─────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                      Data Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │  PostgreSQL │ │    Redis    │ │     S3      │         │
│  │   (RDS)     │ │(ElastiCache)│ │  (Storage)  │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└───────────────────────────────────────────────────────────┘
```

---

## Наступні кроки

1. **Monitoring** - Prometheus + Grafana dashboards
2. **Alerting** - PagerDuty/Opsgenie integration
3. **Logging** - ELK Stack або Loki
4. **Tracing** - Jaeger/Zipkin для distributed tracing
5. **CI/CD** - GitHub Actions / GitLab CI pipelines
