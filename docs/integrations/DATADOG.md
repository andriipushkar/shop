# Datadog Integration

Інтеграція з Datadog для моніторингу, трейсингу та аналітики.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATADOG INTEGRATION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Application Layer                              │   │
│  │                                                                        │   │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐              │   │
│  │  │ Metrics │   │ Traces  │   │ Logs    │   │ APM     │              │   │
│  │  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘              │   │
│  └───────┼─────────────┼─────────────┼─────────────┼────────────────────┘   │
│          │             │             │             │                        │
│          ▼             ▼             ▼             ▼                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Datadog Agent                                  │   │
│  │                    (DaemonSet in K8s)                                 │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       Datadog Platform                                │   │
│  │                                                                        │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │   │Dashboards│  │ Alerts   │  │ APM      │  │ Log Mgmt │            │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Datadog Agent
DD_API_KEY=your_api_key
DD_SITE=datadoghq.eu
DD_ENV=production
DD_SERVICE=shop
DD_VERSION=1.0.0

# APM
DD_APM_ENABLED=true
DD_TRACE_SAMPLE_RATE=0.1

# Logs
DD_LOGS_ENABLED=true
DD_LOGS_INJECTION=true

# Profiling
DD_PROFILING_ENABLED=true
```

### Kubernetes DaemonSet

```yaml
# k8s/datadog-agent.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: datadog-agent
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: datadog-agent
  template:
    metadata:
      labels:
        app: datadog-agent
    spec:
      containers:
        - name: datadog-agent
          image: gcr.io/datadoghq/agent:latest
          env:
            - name: DD_API_KEY
              valueFrom:
                secretKeyRef:
                  name: datadog-secret
                  key: api-key
            - name: DD_SITE
              value: "datadoghq.eu"
            - name: DD_KUBERNETES_KUBELET_HOST
              valueFrom:
                fieldRef:
                  fieldPath: status.hostIP
            - name: DD_APM_ENABLED
              value: "true"
            - name: DD_LOGS_ENABLED
              value: "true"
            - name: DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL
              value: "true"
            - name: DD_PROCESS_AGENT_ENABLED
              value: "true"
          ports:
            - containerPort: 8125
              name: dogstatsd
              protocol: UDP
            - containerPort: 8126
              name: apm
              protocol: TCP
          volumeMounts:
            - name: dockersocket
              mountPath: /var/run/docker.sock
            - name: procdir
              mountPath: /host/proc
              readOnly: true
            - name: cgroups
              mountPath: /host/sys/fs/cgroup
              readOnly: true
      volumes:
        - name: dockersocket
          hostPath:
            path: /var/run/docker.sock
        - name: procdir
          hostPath:
            path: /proc
        - name: cgroups
          hostPath:
            path: /sys/fs/cgroup
```

## APM (Application Performance Monitoring)

### Go Integration

```go
// pkg/datadog/tracer.go
package datadog

import (
    "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
    "gopkg.in/DataDog/dd-trace-go.v1/profiler"
)

type Config struct {
    Env         string  `env:"DD_ENV" envDefault:"development"`
    Service     string  `env:"DD_SERVICE" envDefault:"shop"`
    Version     string  `env:"DD_VERSION" envDefault:"1.0.0"`
    AgentHost   string  `env:"DD_AGENT_HOST" envDefault:"localhost"`
    SampleRate  float64 `env:"DD_TRACE_SAMPLE_RATE" envDefault:"1.0"`
    Profiling   bool    `env:"DD_PROFILING_ENABLED" envDefault:"false"`
}

func Init(cfg *Config) error {
    // Start tracer
    tracer.Start(
        tracer.WithEnv(cfg.Env),
        tracer.WithService(cfg.Service),
        tracer.WithServiceVersion(cfg.Version),
        tracer.WithAgentAddr(cfg.AgentHost + ":8126"),
        tracer.WithSampler(tracer.NewRateSampler(cfg.SampleRate)),
        tracer.WithRuntimeMetrics(),
        tracer.WithLogStartup(false),
    )

    // Start profiler
    if cfg.Profiling {
        err := profiler.Start(
            profiler.WithEnv(cfg.Env),
            profiler.WithService(cfg.Service),
            profiler.WithVersion(cfg.Version),
            profiler.WithProfileTypes(
                profiler.CPUProfile,
                profiler.HeapProfile,
                profiler.GoroutineProfile,
            ),
        )
        if err != nil {
            return err
        }
    }

    return nil
}

func Stop() {
    tracer.Stop()
    profiler.Stop()
}
```

### HTTP Middleware

```go
// pkg/datadog/middleware.go
package datadog

import (
    "net/http"

    httptrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/net/http"
)

// WrapHandler wraps an HTTP handler with Datadog tracing
func WrapHandler(h http.Handler, service, resource string) http.Handler {
    return httptrace.WrapHandler(h, service, resource)
}

// NewServeMux returns a traced ServeMux
func NewServeMux() *httptrace.ServeMux {
    return httptrace.NewServeMux()
}

// Custom middleware with additional context
func TracingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        span, ctx := tracer.StartSpanFromContext(r.Context(), "http.request",
            tracer.ResourceName(r.Method+" "+r.URL.Path),
            tracer.Tag("http.method", r.Method),
            tracer.Tag("http.url", r.URL.String()),
        )
        defer span.Finish()

        // Add tenant context
        if tenantID := r.Header.Get("X-Tenant-ID"); tenantID != "" {
            span.SetTag("tenant_id", tenantID)
        }

        // Add user context
        if userID := r.Context().Value("user_id"); userID != nil {
            span.SetTag("user_id", userID)
        }

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### Database Tracing

```go
// pkg/datadog/database.go
package datadog

import (
    "database/sql"

    sqltrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/database/sql"
    "github.com/lib/pq"
)

// OpenDB opens a traced database connection
func OpenDB(dsn string) (*sql.DB, error) {
    sqltrace.Register("postgres", &pq.Driver{})
    return sqltrace.Open("postgres", dsn)
}

// With GORM
import (
    gormtrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/gorm.io/gorm.v1"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

func OpenGORM(dsn string) (*gorm.DB, error) {
    return gormtrace.Open(postgres.Open(dsn), &gorm.Config{})
}
```

### Redis Tracing

```go
// pkg/datadog/redis.go
package datadog

import (
    redistrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/go-redis/redis.v8"
    "github.com/go-redis/redis/v8"
)

// NewRedisClient creates a traced Redis client
func NewRedisClient(opts *redis.Options) *redis.Client {
    client := redis.NewClient(opts)
    redistrace.WrapClient(client)
    return client
}
```

### Custom Spans

```go
// services/core/internal/orders/service.go
package orders

import (
    "context"

    "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

func (s *OrderService) CreateOrder(ctx context.Context, order *Order) error {
    span, ctx := tracer.StartSpanFromContext(ctx, "order.create",
        tracer.ResourceName("CreateOrder"),
        tracer.Tag("order.source", order.Source),
    )
    defer span.Finish()

    // Validate order
    validateSpan, validateCtx := tracer.StartSpanFromContext(ctx, "order.validate")
    if err := s.validate(validateCtx, order); err != nil {
        validateSpan.SetTag("error", true)
        validateSpan.SetTag("error.message", err.Error())
        validateSpan.Finish()
        return err
    }
    validateSpan.Finish()

    // Reserve inventory
    inventorySpan, inventoryCtx := tracer.StartSpanFromContext(ctx, "inventory.reserve")
    if err := s.inventoryService.Reserve(inventoryCtx, order.Items); err != nil {
        inventorySpan.SetTag("error", true)
        inventorySpan.Finish()
        return err
    }
    inventorySpan.Finish()

    // Save to database
    dbSpan, dbCtx := tracer.StartSpanFromContext(ctx, "db.insert")
    if err := s.repo.Create(dbCtx, order); err != nil {
        dbSpan.SetTag("error", true)
        dbSpan.Finish()
        return err
    }
    dbSpan.Finish()

    // Set order ID tag
    span.SetTag("order.id", order.ID)
    span.SetTag("order.total", order.Total)

    return nil
}
```

## Metrics

### Custom Metrics

```go
// pkg/datadog/metrics.go
package datadog

import (
    "github.com/DataDog/datadog-go/v5/statsd"
)

var client *statsd.Client

func InitMetrics(agentAddr string) error {
    var err error
    client, err = statsd.New(agentAddr,
        statsd.WithNamespace("shop."),
        statsd.WithTags([]string{
            "env:" + os.Getenv("DD_ENV"),
            "service:" + os.Getenv("DD_SERVICE"),
        }),
    )
    return err
}

// Counter increments a counter
func Counter(name string, value int64, tags []string) {
    client.Count(name, value, tags, 1)
}

// Gauge sets a gauge value
func Gauge(name string, value float64, tags []string) {
    client.Gauge(name, value, tags, 1)
}

// Histogram records a histogram value
func Histogram(name string, value float64, tags []string) {
    client.Histogram(name, value, tags, 1)
}

// Timing records a timing
func Timing(name string, duration time.Duration, tags []string) {
    client.Timing(name, duration, tags, 1)
}
```

### Business Metrics

```go
// services/core/internal/metrics/business.go
package metrics

import (
    "shop/pkg/datadog"
)

// RecordOrder records order metrics
func RecordOrder(order *Order) {
    tags := []string{
        "source:" + order.Source,
        "payment_method:" + order.PaymentMethod,
        "tenant:" + order.TenantID,
    }

    datadog.Counter("orders.created", 1, tags)
    datadog.Histogram("orders.total", order.Total, tags)
    datadog.Histogram("orders.items_count", float64(len(order.Items)), tags)
}

// RecordPayment records payment metrics
func RecordPayment(payment *Payment) {
    tags := []string{
        "method:" + payment.Method,
        "status:" + payment.Status,
    }

    datadog.Counter("payments.processed", 1, tags)
    datadog.Histogram("payments.amount", payment.Amount, tags)
}

// RecordInventoryLevel records inventory levels
func RecordInventoryLevel(productID string, quantity int) {
    tags := []string{"product:" + productID}
    datadog.Gauge("inventory.quantity", float64(quantity), tags)
}
```

## Logs

### Structured Logging

```go
// pkg/logger/datadog.go
package logger

import (
    "os"

    "github.com/rs/zerolog"
    "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

func NewLogger() zerolog.Logger {
    return zerolog.New(os.Stdout).
        With().
        Timestamp().
        Str("dd.env", os.Getenv("DD_ENV")).
        Str("dd.service", os.Getenv("DD_SERVICE")).
        Str("dd.version", os.Getenv("DD_VERSION")).
        Logger()
}

// WithTraceContext adds trace context to log entry
func WithTraceContext(ctx context.Context, logger zerolog.Logger) zerolog.Logger {
    span, ok := tracer.SpanFromContext(ctx)
    if !ok {
        return logger
    }

    return logger.With().
        Uint64("dd.trace_id", span.Context().TraceID()).
        Uint64("dd.span_id", span.Context().SpanID()).
        Logger()
}

// Example usage
func (s *OrderService) CreateOrder(ctx context.Context, order *Order) error {
    log := WithTraceContext(ctx, s.logger)

    log.Info().
        Str("order_id", order.ID).
        Float64("total", order.Total).
        Msg("Creating order")

    // ... order creation logic

    log.Info().
        Str("order_id", order.ID).
        Msg("Order created successfully")

    return nil
}
```

### Log Pipeline

```yaml
# Datadog Log Pipeline Configuration

# Parser for JSON logs
parser:
  type: grok-parser
  samples:
    - '{"level":"info","time":"2024-01-15T10:00:00Z","message":"Order created"}'
  source: message
  grok:
    supportRules: |
      _json_parser %{data::json}

# Add status based on level
processor:
  - type: status-remapper
    sources:
      - level

  - type: trace-id-remapper
    sources:
      - dd.trace_id

# Enrichment
enrichment:
  - type: geo-ip
    sources:
      - client_ip
```

## Frontend Integration (Next.js)

### RUM (Real User Monitoring)

```typescript
// lib/datadog.ts
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

export function initDatadog() {
  datadogRum.init({
    applicationId: process.env.NEXT_PUBLIC_DD_APPLICATION_ID!,
    clientToken: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN!,
    site: 'datadoghq.eu',
    service: 'shop-storefront',
    env: process.env.NODE_ENV,
    version: process.env.NEXT_PUBLIC_VERSION,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  });

  datadogLogs.init({
    clientToken: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN!,
    site: 'datadoghq.eu',
    service: 'shop-storefront',
    env: process.env.NODE_ENV,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  });

  datadogRum.startSessionReplayRecording();
}

// Track user
export function setUser(user: { id: string; email: string; name: string }) {
  datadogRum.setUser({
    id: user.id,
    email: user.email,
    name: user.name,
  });
}

// Track custom action
export function trackAction(name: string, context?: object) {
  datadogRum.addAction(name, context);
}

// Track error
export function trackError(error: Error, context?: object) {
  datadogRum.addError(error, context);
}
```

### Usage in Components

```tsx
// pages/_app.tsx
import { useEffect } from 'react';
import { initDatadog, setUser } from '@/lib/datadog';
import { useAuth } from '@/hooks/useAuth';

function MyApp({ Component, pageProps }) {
  const { user } = useAuth();

  useEffect(() => {
    initDatadog();
  }, []);

  useEffect(() => {
    if (user) {
      setUser({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    }
  }, [user]);

  return <Component {...pageProps} />;
}

// Track checkout
import { trackAction } from '@/lib/datadog';

function CheckoutButton({ cart }) {
  const handleCheckout = async () => {
    trackAction('checkout.started', {
      items_count: cart.items.length,
      total: cart.total,
    });

    try {
      await processCheckout(cart);
      trackAction('checkout.completed', { order_id: result.id });
    } catch (error) {
      trackAction('checkout.failed', { error: error.message });
      throw error;
    }
  };

  return <button onClick={handleCheckout}>Оформити замовлення</button>;
}
```

## Dashboards

### Service Dashboard JSON

```json
{
  "title": "Shop Service Dashboard",
  "widgets": [
    {
      "definition": {
        "title": "Request Rate",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:trace.http.request.hits{service:shop-core}.as_rate()",
            "display_type": "bars"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Error Rate",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:trace.http.request.errors{service:shop-core}.as_rate() / sum:trace.http.request.hits{service:shop-core}.as_rate() * 100",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "P95 Latency",
        "type": "timeseries",
        "requests": [
          {
            "q": "p95:trace.http.request.duration{service:shop-core}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Orders Created",
        "type": "query_value",
        "requests": [
          {
            "q": "sum:shop.orders.created{*}.as_count()"
          }
        ]
      }
    }
  ]
}
```

## Alerts (Monitors)

### Monitor Configuration

```yaml
# Terraform Datadog monitors

resource "datadog_monitor" "high_error_rate" {
  name    = "Shop - High Error Rate"
  type    = "metric alert"
  message = <<-EOT
    Error rate is above threshold on {{service.name}}.

    @slack-alerts-critical
    @pagerduty-oncall
  EOT

  query = <<-EOQ
    sum(last_5m):sum:trace.http.request.errors{service:shop-core}.as_rate()
    / sum:trace.http.request.hits{service:shop-core}.as_rate() * 100 > 5
  EOQ

  thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data = false
  tags           = ["service:shop", "env:production"]
}

resource "datadog_monitor" "high_latency" {
  name    = "Shop - High Latency"
  type    = "metric alert"
  message = "P95 latency is above 2 seconds. @slack-alerts-warning"

  query = "avg(last_5m):p95:trace.http.request.duration{service:shop-core} > 2"

  thresholds {
    critical = 2
    warning  = 1
  }
}

resource "datadog_monitor" "low_order_rate" {
  name    = "Shop - Low Order Rate"
  type    = "metric alert"
  message = "No orders in the last 30 minutes during business hours. @slack-alerts-business"

  query = "sum(last_30m):sum:shop.orders.created{*}.as_count() < 1"

  thresholds {
    critical = 1
  }

  # Only during business hours
  scheduling_options {
    evaluation_window {
      day_starts   = "08:00"
      month_starts = 1
    }
  }
}
```

## Service Catalog

### Service Definition

```yaml
# datadog/service.yaml
schema-version: v2.1
dd-service: shop-core
team: backend
contacts:
  - type: slack
    contact: https://shop.slack.com/channels/backend
  - type: email
    contact: backend@shop.ua
links:
  - name: Runbook
    type: runbook
    url: https://docs.shop.ua/runbooks/core-service
  - name: Source Code
    type: repo
    provider: github
    url: https://github.com/shop/core-service
  - name: Documentation
    type: doc
    url: https://docs.shop.ua/services/core
integrations:
  pagerduty:
    service-url: https://pagerduty.com/services/shop-core
tags:
  - tier:1
  - lang:go
```

## See Also

- [Sentry Integration](./SENTRY.md)
- [Monitoring Setup](../operations/MONITORING_SETUP.md)
- [Tracing Module](../modules/TRACING.md)
- [Metrics Module](../modules/METRICS.md)
