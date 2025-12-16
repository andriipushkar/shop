# Metering & Usage Tracking

Система обліку використання ресурсів для SaaS білінгу та квот.

## Overview

Модуль metering забезпечує:
- Облік використання по тенантах
- Квоти та ліміти
- Агрегація для білінгу
- Real-time usage tracking
- Overage handling

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    METERING SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   API        │  │   Storage    │  │   Background         │  │
│  │   Calls      │  │   Usage      │  │   Jobs               │  │
│  │              │  │              │  │                      │  │
│  │  - Requests  │  │  - Files     │  │  - Email sends       │  │
│  │  - Products  │  │  - Images    │  │  - SMS               │  │
│  │  - Orders    │  │  - Bandwidth │  │  - Webhooks          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘              │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │  Metering       │                           │
│                  │  Service        │                           │
│                  │                 │                           │
│                  │  - Track        │                           │
│                  │  - Aggregate    │                           │
│                  │  - Check quota  │                           │
│                  └────────┬────────┘                           │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │  Billing        │                           │
│                  │  Service        │                           │
│                  └─────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Metered Resources

| Resource | Unit | Description |
|----------|------|-------------|
| `products` | count | Active products |
| `orders` | count | Monthly orders |
| `api_calls` | count | API requests |
| `storage` | bytes | File storage |
| `bandwidth` | bytes | CDN bandwidth |
| `emails` | count | Email sends |
| `sms` | count | SMS sends |
| `users` | count | Admin users |
| `integrations` | count | Active integrations |

## Data Models

### Usage Record

```go
type UsageRecord struct {
    ID         string    `json:"id"`
    TenantID   string    `json:"tenant_id"`
    Resource   string    `json:"resource"`      // e.g., "orders"
    Quantity   int64     `json:"quantity"`
    Unit       string    `json:"unit"`          // e.g., "count", "bytes"
    Timestamp  time.Time `json:"timestamp"`
    Metadata   map[string]string `json:"metadata"`
}
```

### Quota

```go
type Quota struct {
    TenantID    string `json:"tenant_id"`
    Resource    string `json:"resource"`
    Limit       int64  `json:"limit"`         // -1 for unlimited
    Used        int64  `json:"used"`
    ResetPeriod string `json:"reset_period"`  // "monthly", "daily"
    ResetAt     time.Time `json:"reset_at"`
}
```

### Plan Limits

```go
type PlanLimits struct {
    Products     int64 `json:"products"`      // Max products
    Orders       int64 `json:"orders"`        // Orders per month
    Storage      int64 `json:"storage"`       // Bytes
    APICalls     int64 `json:"api_calls"`     // Per month
    Users        int64 `json:"users"`         // Admin users
    Integrations int64 `json:"integrations"`  // Active integrations
}

// Plan configurations
var Plans = map[string]PlanLimits{
    "starter": {
        Products:     100,
        Orders:       500,
        Storage:      1 * GB,
        APICalls:     10000,
        Users:        2,
        Integrations: 3,
    },
    "professional": {
        Products:     1000,
        Orders:       5000,
        Storage:      10 * GB,
        APICalls:     100000,
        Users:        10,
        Integrations: 10,
    },
    "enterprise": {
        Products:     -1, // Unlimited
        Orders:       -1,
        Storage:      100 * GB,
        APICalls:     -1,
        Users:        -1,
        Integrations: -1,
    },
}
```

## Usage

### Track Usage

```go
import "shop/services/core/internal/metering"

// Track single event
err := metering.Track(ctx, &metering.UsageRecord{
    TenantID: tenant.ID,
    Resource: "orders",
    Quantity: 1,
})

// Track with metadata
err := metering.Track(ctx, &metering.UsageRecord{
    TenantID: tenant.ID,
    Resource: "api_calls",
    Quantity: 1,
    Metadata: map[string]string{
        "endpoint": "/api/v1/products",
        "method":   "GET",
    },
})

// Track storage
err := metering.Track(ctx, &metering.UsageRecord{
    TenantID: tenant.ID,
    Resource: "storage",
    Quantity: fileSize, // bytes
    Unit:     "bytes",
})
```

### Check Quota

```go
// Check if action is allowed
allowed, err := metering.CheckQuota(ctx, tenant.ID, "products")
if !allowed {
    return errors.New("product limit reached, please upgrade your plan")
}

// Check with specific quantity
allowed, err := metering.CheckQuotaFor(ctx, tenant.ID, "storage", fileSize)
```

### Get Usage Summary

```go
// Current period usage
summary, err := metering.GetUsageSummary(ctx, tenant.ID)

fmt.Printf("Products: %d/%d\n", summary.Products.Used, summary.Products.Limit)
fmt.Printf("Orders: %d/%d\n", summary.Orders.Used, summary.Orders.Limit)
fmt.Printf("Storage: %s/%s\n",
    humanize.Bytes(summary.Storage.Used),
    humanize.Bytes(summary.Storage.Limit),
)
```

### Get Historical Usage

```go
// Usage for date range
history, err := metering.GetUsageHistory(ctx, tenant.ID, &metering.HistoryParams{
    Resource:  "orders",
    StartDate: startOfMonth,
    EndDate:   endOfMonth,
    Interval:  "day",
})

for _, point := range history {
    fmt.Printf("%s: %d orders\n", point.Date, point.Value)
}
```

## Middleware

### API Call Metering

```go
func MeteringMiddleware(metering *metering.Service) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tenant := getTenantFromContext(r.Context())

            // Check API quota
            allowed, _ := metering.CheckQuota(r.Context(), tenant.ID, "api_calls")
            if !allowed {
                http.Error(w, "API quota exceeded", http.StatusTooManyRequests)
                return
            }

            // Track API call
            metering.Track(r.Context(), &metering.UsageRecord{
                TenantID: tenant.ID,
                Resource: "api_calls",
                Quantity: 1,
                Metadata: map[string]string{
                    "endpoint": r.URL.Path,
                    "method":   r.Method,
                },
            })

            next.ServeHTTP(w, r)
        })
    }
}
```

## API Endpoints

```
GET  /api/v1/usage                   # Current usage summary
GET  /api/v1/usage/:resource         # Usage for specific resource
GET  /api/v1/usage/history           # Historical usage
GET  /api/v1/quotas                  # Current quotas
POST /api/v1/quotas/:resource/reset  # Reset quota (admin)
```

### Usage Summary Response

```json
{
  "tenant_id": "tenant_123",
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "resources": {
    "products": {
      "used": 45,
      "limit": 100,
      "percentage": 45
    },
    "orders": {
      "used": 234,
      "limit": 500,
      "percentage": 46.8
    },
    "storage": {
      "used": 524288000,
      "limit": 1073741824,
      "percentage": 48.8,
      "used_human": "500 MB",
      "limit_human": "1 GB"
    },
    "api_calls": {
      "used": 5432,
      "limit": 10000,
      "percentage": 54.3
    }
  }
}
```

## Quota Reset

```go
// Automatic monthly reset
func (m *MeteringService) ResetMonthlyQuotas(ctx context.Context) error {
    tenants, _ := m.tenantService.ListAll(ctx)

    for _, tenant := range tenants {
        for _, resource := range monthlyResources {
            m.quotaStore.Reset(ctx, tenant.ID, resource)
        }
    }

    return nil
}

// Resources that reset monthly
var monthlyResources = []string{"orders", "api_calls", "emails", "sms"}
```

## Overage Handling

```go
type OveragePolicy string

const (
    OverageBlock    OveragePolicy = "block"    // Block when limit reached
    OverageAllow    OveragePolicy = "allow"    // Allow with extra charges
    OverageWarn     OveragePolicy = "warn"     // Allow but warn
)

// Check with overage handling
result, err := metering.CheckQuotaWithOverage(ctx, tenant.ID, "orders")
if result.Exceeded {
    switch result.Policy {
    case metering.OverageBlock:
        return errors.New("order limit reached")
    case metering.OverageAllow:
        // Track overage for billing
        metering.TrackOverage(ctx, tenant.ID, "orders", 1)
    case metering.OverageWarn:
        // Send warning notification
        notifications.Send(tenant.ID, "quota_warning", result)
    }
}
```

## Alerts

```go
// Quota threshold alerts
type QuotaAlert struct {
    TenantID   string
    Resource   string
    Percentage int    // 80%, 90%, 100%
    Message    string
}

// Check and send alerts
func (m *MeteringService) CheckQuotaAlerts(ctx context.Context, tenantID string) {
    summary, _ := m.GetUsageSummary(ctx, tenantID)

    for resource, usage := range summary.Resources {
        pct := float64(usage.Used) / float64(usage.Limit) * 100

        if pct >= 100 {
            m.sendAlert(ctx, tenantID, resource, 100, "Quota exceeded")
        } else if pct >= 90 {
            m.sendAlert(ctx, tenantID, resource, 90, "Quota almost exhausted")
        } else if pct >= 80 {
            m.sendAlert(ctx, tenantID, resource, 80, "Quota nearing limit")
        }
    }
}
```

## Configuration

```bash
# Metering settings
METERING_ENABLED=true
METERING_STORAGE=redis  # redis, postgres
METERING_AGGREGATION_INTERVAL=1m

# Quota alerts
QUOTA_ALERT_THRESHOLDS=80,90,100
QUOTA_ALERT_EMAIL=true

# Overage
OVERAGE_POLICY=warn  # block, allow, warn
OVERAGE_BILLING_ENABLED=false
```

## See Also

- [Billing](./BILLING.md)
- [Multi-Tenancy](../architecture/MULTI_TENANCY.md)
- [API Keys](./API_KEYS.md)
- [Superadmin](../services/SUPERADMIN.md)
