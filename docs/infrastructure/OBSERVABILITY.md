# Observability

Моніторинг, логування, трейсинг та аналітика рівня Unicorn.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK (Unicorn Level)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────────────┐ │
│  │ Applications│───▶│ OTEL Collector   │───▶│  Backends                       │ │
│  │             │    │                  │    │  ├── Jaeger (Traces)            │ │
│  │ - core      │    │ - Receivers      │    │  ├── Prometheus (Metrics)       │ │
│  │ - oms       │    │ - Processors     │    │  ├── Loki (Logs)                │ │
│  │ - crm       │    │ - Exporters      │    │  └── ClickHouse (Analytics)     │ │
│  │ - storefront│    │                  │    │                                 │ │
│  └─────────────┘    └──────────────────┘    └─────────────────────────────────┘ │
│                                                                                  │
│  Four Pillars (Extended):                                                       │
│  ├── Metrics   - What is happening (Prometheus + OTEL Metrics)                 │
│  ├── Logs      - Why it happened (Loki)                                        │
│  ├── Traces    - How it happened (Jaeger + OTEL)                               │
│  └── Analytics - Business insights (ClickHouse OLAP)                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## OpenTelemetry Collector

Центральний хаб для всієї телеметрії.

### Configuration

**Location:** `infrastructure/otel/collector-config.yaml`

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

  # Tail sampling - зберігаємо важливі traces
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: {status_codes: [ERROR]}
      - name: slow-traces
        type: latency
        latency: {threshold_ms: 1000}
      - name: sample-rest
        type: probabilistic
        probabilistic: {sampling_percentage: 10}

exporters:
  jaeger:
    endpoint: jaeger-collector:14250
  prometheus:
    endpoint: 0.0.0.0:8889
  clickhouse:
    endpoint: tcp://clickhouse:9000
    database: shop_traces
```

### Trace Propagation

**Location:** `services/core/internal/tracing/propagation.go`

```go
// Traced HTTP Client з автоматичною propagation
client := tracing.NewTracedHTTPClient(baseClient, "payment-service")
resp, err := client.Get(ctx, "https://api.liqpay.ua/charge")

// Service Span для внутрішніх викликів
ctx, span := tracer.ServiceSpan(ctx, "inventory-service", "ReserveStock")
defer span.End()

// Message Span для RabbitMQ
ctx, span := tracer.MessageSpan(ctx, "order_events", "publish")
defer span.End()

// Business Span для бізнес-операцій
ctx, span := tracer.BusinessSpan(ctx, "checkout", "ProcessPayment")
span.SetBusinessAttributes("checkout", map[string]interface{}{
    "order_id": orderID,
    "amount":   1500.00,
})
defer span.End()
```

## Metrics (Prometheus)

### Installation

```yaml
# Prometheus Operator via Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --create-namespace \
  -f prometheus-values.yaml
```

### Application Metrics

```go
// internal/metrics/metrics.go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    // HTTP metrics
    HttpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests",
        },
        []string{"method", "path", "status"},
    )

    HttpRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request duration",
            Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
        },
        []string{"method", "path"},
    )

    // Business metrics
    OrdersCreated = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "orders_created_total",
            Help: "Total orders created",
        },
        []string{"payment_method", "shipping_method"},
    )

    OrderValue = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "order_value_uah",
            Help:    "Order value in UAH",
            Buckets: []float64{100, 500, 1000, 2500, 5000, 10000, 25000, 50000},
        },
        []string{"category"},
    )

    // Infrastructure metrics
    DatabaseConnections = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "database_connections",
            Help: "Current database connections",
        },
        []string{"state"},
    )

    CacheHitRatio = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "cache_hit_ratio",
            Help: "Cache hit ratio",
        },
        []string{"cache_name"},
    )
)

// Middleware to record HTTP metrics
func MetricsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        wrapped := wrapResponseWriter(w)

        next.ServeHTTP(wrapped, r)

        duration := time.Since(start).Seconds()
        path := getPathPattern(r)  // Normalize path to avoid high cardinality

        HttpRequestsTotal.WithLabelValues(r.Method, path, strconv.Itoa(wrapped.status)).Inc()
        HttpRequestDuration.WithLabelValues(r.Method, path).Observe(duration)
    })
}
```

### ServiceMonitor

```yaml
# k8s/monitoring/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: core-api
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: core-api
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
  namespaceSelector:
    matchNames:
      - production
```

### Key Dashboards

```json
// Grafana dashboard panels
{
  "panels": [
    {
      "title": "Request Rate",
      "type": "graph",
      "targets": [
        {
          "expr": "sum(rate(http_requests_total[5m])) by (method)"
        }
      ]
    },
    {
      "title": "Error Rate",
      "type": "singlestat",
      "targets": [
        {
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100"
        }
      ]
    },
    {
      "title": "P95 Latency",
      "type": "graph",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))"
        }
      ]
    },
    {
      "title": "Orders per Hour",
      "type": "graph",
      "targets": [
        {
          "expr": "sum(increase(orders_created_total[1h]))"
        }
      ]
    }
  ]
}
```

## Logging (Loki)

### Installation

```yaml
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \
  -n monitoring \
  --set promtail.enabled=true \
  --set grafana.enabled=false  # Use existing Grafana
```

### Structured Logging

```go
// internal/logger/logger.go
package logger

import (
    "os"
    "github.com/rs/zerolog"
)

var Log zerolog.Logger

func Init() {
    zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

    Log = zerolog.New(os.Stdout).With().
        Timestamp().
        Str("service", "core-api").
        Str("version", version.Version).
        Logger()
}

// Usage
func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    requestID := getRequestID(ctx)

    log := logger.Log.With().
        Str("request_id", requestID).
        Str("handler", "OrderHandler.Create").
        Logger()

    log.Info().Msg("creating order")

    order, err := h.service.CreateOrder(ctx, req)
    if err != nil {
        log.Error().
            Err(err).
            Str("customer_id", req.CustomerID).
            Msg("failed to create order")
        return
    }

    log.Info().
        Str("order_id", order.ID).
        Float64("total", order.Total).
        Msg("order created successfully")
}
```

### Log Format

```json
{
  "level": "info",
  "time": 1705320000,
  "service": "core-api",
  "version": "1.2.0",
  "request_id": "req_abc123",
  "handler": "OrderHandler.Create",
  "order_id": "ord_456",
  "total": 1500.00,
  "message": "order created successfully"
}
```

### Loki Queries

```logql
# Find errors for specific service
{app="core-api"} |= "error" | json | level="error"

# Find slow requests
{app="core-api"} | json | duration > 1000

# Count errors by type
sum by (error_code) (count_over_time({app="core-api"} |= "error" | json [1h]))

# Find failed orders
{app="core-api"} |= "failed to create order" | json
```

## Tracing (Jaeger)

### Installation

```yaml
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm install jaeger jaegertracing/jaeger \
  -n monitoring \
  --set provisionDataStore.cassandra=false \
  --set storage.type=elasticsearch \
  --set storage.elasticsearch.host=elasticsearch
```

### OpenTelemetry Setup

```go
// internal/tracing/tracing.go
package tracing

import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/jaeger"
    "go.opentelemetry.io/otel/sdk/resource"
    "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

func InitTracer(serviceName, jaegerEndpoint string) (*trace.TracerProvider, error) {
    exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(jaegerEndpoint)))
    if err != nil {
        return nil, err
    }

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exp),
        trace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
            semconv.ServiceVersionKey.String(version.Version),
        )),
        trace.WithSampler(trace.TraceIDRatioBased(0.1)), // 10% sampling
    )

    otel.SetTracerProvider(tp)
    return tp, nil
}

// Usage
func (s *OrderService) CreateOrder(ctx context.Context, req *CreateOrderRequest) (*Order, error) {
    ctx, span := otel.Tracer("orders").Start(ctx, "CreateOrder")
    defer span.End()

    span.SetAttributes(
        attribute.String("customer_id", req.CustomerID),
        attribute.Int("items_count", len(req.Items)),
    )

    // Validate
    ctx, validateSpan := otel.Tracer("orders").Start(ctx, "ValidateOrder")
    if err := s.validate(ctx, req); err != nil {
        validateSpan.RecordError(err)
        validateSpan.End()
        return nil, err
    }
    validateSpan.End()

    // Create in DB
    ctx, dbSpan := otel.Tracer("orders").Start(ctx, "InsertOrder")
    order, err := s.repo.Create(ctx, req)
    if err != nil {
        dbSpan.RecordError(err)
        dbSpan.End()
        return nil, err
    }
    dbSpan.SetAttributes(attribute.String("order_id", order.ID))
    dbSpan.End()

    // Send notification
    go func() {
        ctx, notifySpan := otel.Tracer("orders").Start(context.Background(), "SendNotification",
            trace.WithLinks(trace.LinkFromContext(ctx)))
        defer notifySpan.End()
        s.notificationService.SendOrderConfirmation(ctx, order)
    }()

    span.SetAttributes(attribute.String("order_id", order.ID))
    return order, nil
}
```

### HTTP Middleware

```go
// Propagate trace context
import (
    "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func SetupRouter() *chi.Mux {
    r := chi.NewRouter()

    // Add tracing middleware
    r.Use(func(next http.Handler) http.Handler {
        return otelhttp.NewHandler(next, "http-server")
    })

    return r
}

// HTTP client with tracing
func NewHTTPClient() *http.Client {
    return &http.Client{
        Transport: otelhttp.NewTransport(http.DefaultTransport),
    }
}
```

## Alerting

### Alert Rules

```yaml
# prometheus/alerts.yaml
groups:
  - name: shop-platform
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
          > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value }}s"

      # Pod not ready
      - alert: PodNotReady
        expr: |
          kube_pod_status_ready{condition="true", namespace="production"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod not ready"
          description: "{{ $labels.pod }} is not ready"

      # Low order rate
      - alert: LowOrderRate
        expr: |
          sum(increase(orders_created_total[1h])) < 10
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Low order rate"
          description: "Only {{ $value }} orders in the last hour"

      # Database connection pool exhausted
      - alert: DatabaseConnectionsHigh
        expr: |
          database_connections{state="active"} / database_connections{state="max"} > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connections near limit"
```

### Alertmanager Configuration

```yaml
# alertmanager.yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/xxx'

route:
  receiver: 'default'
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'critical'
    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'

  - name: 'critical'
    slack_configs:
      - channel: '#alerts-critical'
    pagerduty_configs:
      - service_key: 'xxx'

  - name: 'warning'
    slack_configs:
      - channel: '#alerts'
```

## SLIs/SLOs

### Service Level Indicators

```yaml
# SLI definitions
slis:
  availability:
    description: "Percentage of successful requests"
    query: |
      sum(rate(http_requests_total{status!~"5.."}[5m]))
      / sum(rate(http_requests_total[5m]))

  latency:
    description: "Percentage of requests under 500ms"
    query: |
      sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
      / sum(rate(http_request_duration_seconds_count[5m]))

  checkout_success:
    description: "Percentage of successful checkouts"
    query: |
      sum(rate(checkout_completed_total[5m]))
      / sum(rate(checkout_started_total[5m]))
```

### Service Level Objectives

| SLI | SLO | Error Budget (30d) |
|-----|-----|-------------------|
| Availability | 99.9% | 43.2 minutes |
| Latency (p95) | 99% under 500ms | 7.2 hours |
| Checkout Success | 99.5% | 3.6 hours |

## OpenTelemetry Metrics

**Location:** `services/core/internal/tracing/otel_metrics.go`

### Metric Types

```go
// HTTP Metrics
metrics.RecordHTTPRequest(ctx, "POST", "/api/orders", 201, 0.150)

// Business Metrics
metrics.RecordBusinessEvent(ctx, "order_created", map[string]string{
    "payment_method": "liqpay",
    "shipping_method": "nova_poshta",
})
metrics.RecordOrderValue(ctx, 1500.00, "electronics")

// Database Metrics
metrics.RecordDBQuery(ctx, "orders", "INSERT", 0.025)

// Cache Metrics
metrics.RecordCacheOperation(ctx, "redis", "product_123", true, 0.002) // hit
metrics.RecordCacheOperation(ctx, "redis", "product_456", false, 0.050) // miss

// External Service Metrics
metrics.RecordExternalCall(ctx, "liqpay", "charge", true, 0.500)
```

### Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_server_requests_total` | Counter | method, path, status | Total HTTP requests |
| `http_server_duration_seconds` | Histogram | method, path | Request latency |
| `business_events_total` | Counter | event_type | Business events |
| `orders_value_uah` | Histogram | category | Order values |
| `db_queries_total` | Counter | table, operation | Database queries |
| `db_query_duration_seconds` | Histogram | table, operation | Query latency |
| `cache_operations_total` | Counter | cache, hit | Cache operations |
| `external_calls_total` | Counter | service, operation, success | External calls |

## ClickHouse Analytics (OLAP)

**Location:** `services/core/internal/clickhouse/`, `services/analytics-etl/`

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │────▶│   Analytics     │────▶│   ClickHouse    │
│   (OLTP)        │     │   ETL Service   │     │   (OLAP)        │
│                 │     │                 │     │                 │
│ - Orders        │     │ - Incremental   │     │ - orders_analytics
│ - Products      │     │ - Every 5 min   │     │ - product_views │
│ - Customers     │     │ - Batch 1000    │     │ - sales_daily   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Tables Schema

```sql
-- Денормалізовані замовлення для швидкої аналітики
CREATE TABLE orders_analytics (
    order_id UUID,
    tenant_id String,
    customer_id UUID,
    customer_email String,
    created_at DateTime,
    status String,
    total Decimal(10, 2),
    currency String,
    payment_method String,
    shipping_method String,
    -- Aggregation keys
    date Date MATERIALIZED toDate(created_at),
    hour UInt8 MATERIALIZED toHour(created_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (tenant_id, created_at, order_id);

-- Агрегації по днях (Materialized View)
CREATE MATERIALIZED VIEW sales_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date)
AS SELECT
    tenant_id,
    toDate(created_at) as date,
    count() as orders_count,
    sum(total) as revenue,
    uniq(customer_id) as unique_customers
FROM orders_analytics
GROUP BY tenant_id, date;
```

### Query Examples

```go
// Метрики продажів за період
metrics, err := clickhouse.GetSalesMetrics(ctx, tenantID, startDate, endDate)
// Returns: TotalOrders, TotalRevenue, AvgOrderValue, UniqueCustomers

// Топ продуктів
products, err := clickhouse.GetTopProducts(ctx, tenantID, 30, 10) // last 30 days, top 10

// Когортний аналіз
cohorts, err := clickhouse.GetCohortAnalysis(ctx, tenantID, startDate, endDate)

// Conversion Funnel
funnel, err := clickhouse.GetConversionFunnel(ctx, tenantID, 7) // last 7 days
// Returns: ViewedProduct -> AddedToCart -> StartedCheckout -> CompletedOrder

// Real-time метрики (останні 5 хвилин)
realtime, err := clickhouse.GetRealTimeMetrics(ctx, tenantID)
```

### ETL Service

**Location:** `services/analytics-etl/`

```bash
# Environment variables
POSTGRES_URL=postgres://user:pass@localhost:5432/shop
CLICKHOUSE_ADDR=localhost:9000
SYNC_INTERVAL=5m
BATCH_SIZE=1000

# Run ETL
docker-compose up analytics-etl
```

## Grafana Dashboards

### Business Dashboard

```promql
# Revenue per hour (from ClickHouse via Grafana plugin)
SELECT
    toStartOfHour(created_at) as time,
    sum(total) as revenue
FROM orders_analytics
WHERE created_at >= now() - INTERVAL 24 HOUR
GROUP BY time
ORDER BY time

# Conversion rate
(checkout_completed_total / checkout_started_total) * 100
```

### SRE Dashboard

```promql
# Availability SLI
sum(rate(http_requests_total{status!~"5.."}[5m]))
/ sum(rate(http_requests_total[5m]))

# Latency SLI (% under 500ms)
sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
/ sum(rate(http_request_duration_seconds_count[5m]))

# Error budget burn rate
1 - (sli_availability / 0.999)
```

## See Also

- [Unicorn Roadmap](./UNICORN_ROADMAP.md)
- [Monitoring Dashboards](./DASHBOARDS.md)
- [Alerting Runbooks](../operations/RUNBOOKS.md)
- [Incident Response](../operations/INCIDENT_RESPONSE.md)
