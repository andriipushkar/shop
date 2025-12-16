# Metrics (Prometheus)

Система збору та експорту метрик для моніторингу продуктивності та бізнес-показників.

## Overview

Модуль metrics забезпечує:
- Збір HTTP метрик (requests, latency, errors)
- Бізнес метрики (products, carts, wishlists)
- Database метрики (queries, connections)
- Cache метрики (hits, misses)
- Експорт у форматі Prometheus

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      METRICS COLLECTION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  HTTP Layer  │  │  Business    │  │   Infrastructure     │  │
│  │              │  │  Metrics     │  │   Metrics            │  │
│  │  - Requests  │  │              │  │                      │  │
│  │  - Duration  │  │  - Products  │  │  - DB queries        │  │
│  │  - Status    │  │  - Carts     │  │  - DB connections    │  │
│  │  - In-flight │  │  - Wishlists │  │  - Cache hits/miss   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │   /metrics      │                           │
│                  │   Prometheus    │                           │
│                  │   Exporter      │                           │
│                  └─────────────────┘                           │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │    Grafana      │                           │
│                  │   Dashboards    │                           │
│                  └─────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Available Metrics

### HTTP Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | method, path, status | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | method, path | Request latency |
| `http_requests_in_flight` | Gauge | - | Current active requests |

### Business Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `products_total` | Gauge | - | Total products in catalog |
| `products_out_of_stock` | Gauge | - | Products with zero stock |
| `cart_items_total` | Gauge | user_id | Items in user carts |
| `wishlist_items_total` | Gauge | user_id | Items in wishlists |
| `price_changes_total` | Counter | - | Price change events |

### Database Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `db_queries_total` | Counter | query_type | Total DB queries |
| `db_query_duration_seconds` | Histogram | query_type | Query latency |
| `db_connections_open` | Gauge | - | Open DB connections |
| `db_connections_in_use` | Gauge | - | Active DB connections |

### Cache Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `cache_hits_total` | Counter | cache_type | Cache hit count |
| `cache_misses_total` | Counter | cache_type | Cache miss count |
| `cache_operation_duration_seconds` | Histogram | operation, cache_type | Cache operation latency |

## Usage

### Recording HTTP Requests

```go
import "shop/services/core/internal/metrics"

// In HTTP middleware
func metricsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()

        // Increment in-flight counter
        metrics.HTTPRequestsInFlight.Inc()
        defer metrics.HTTPRequestsInFlight.Dec()

        // Process request
        rw := &responseWriter{ResponseWriter: w}
        next.ServeHTTP(rw, r)

        // Record metrics
        duration := time.Since(start).Seconds()
        metrics.RecordHTTPRequest(
            r.Method,
            r.URL.Path,
            strconv.Itoa(rw.statusCode),
            duration,
        )
    })
}
```

### Recording Cache Operations

```go
// On cache hit
metrics.RecordCacheHit("products")

// On cache miss
metrics.RecordCacheMiss("products")
```

### Recording Database Operations

```go
start := time.Now()
// Execute query
err := db.Query(...)
duration := time.Since(start).Seconds()

metrics.RecordDBQuery("select", duration)
```

### Updating Business Metrics

```go
// Update product counts
metrics.UpdateProductMetrics(totalProducts, outOfStockProducts)

// Record price change
metrics.RecordPriceChange()
```

## Histogram Buckets

### HTTP Request Duration
```go
Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}
// 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s
```

### Database Query Duration
```go
Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5}
// 1ms, 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s
```

### Cache Operation Duration
```go
Buckets: []float64{.0001, .0005, .001, .005, .01, .025, .05, .1}
// 0.1ms, 0.5ms, 1ms, 5ms, 10ms, 25ms, 50ms, 100ms
```

## Configuration

```bash
# Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
METRICS_PATH=/metrics

# Grafana
GRAFANA_URL=http://localhost:3000
```

## Prometheus Queries (PromQL)

### Request Rate
```promql
rate(http_requests_total[5m])
```

### Error Rate
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

### P99 Latency
```promql
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

### Cache Hit Rate
```promql
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

### DB Connection Utilization
```promql
db_connections_in_use / db_connections_open
```

## Grafana Dashboard

### Recommended Panels

1. **Request Rate** - Requests per second by endpoint
2. **Error Rate** - 4xx and 5xx errors percentage
3. **Latency Distribution** - P50, P90, P99 latencies
4. **Active Requests** - Current in-flight requests
5. **Cache Performance** - Hit rate over time
6. **DB Performance** - Query duration and connection pool
7. **Business Metrics** - Products, carts, wishlists

### Alert Rules

```yaml
groups:
  - name: shop-alerts
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency above 2 seconds"

      - alert: LowCacheHitRate
        expr: sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 80%"
```

## API Endpoint

```
GET /metrics
```

Returns Prometheus-formatted metrics:

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/products",status="200"} 15234
http_requests_total{method="POST",path="/api/orders",status="201"} 423

# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",path="/api/products",le="0.1"} 14500
http_request_duration_seconds_bucket{method="GET",path="/api/products",le="0.5"} 15100
...
```

## Best Practices

1. **Use meaningful labels** - Don't use high cardinality labels (user IDs in counters)
2. **Bucket selection** - Choose buckets based on expected latency distribution
3. **Metric naming** - Follow Prometheus naming conventions
4. **Rate over raw** - Use `rate()` for counters in dashboards
5. **Alert on symptoms** - Alert on user-facing issues, not internal metrics

## See Also

- [Health Checks](./HEALTH_CHECKS.md)
- [Tracing](./TRACING.md)
- [Monitoring Setup](../operations/MONITORING_SETUP.md)
- [Alerting Rules](../operations/ALERTING_RULES.md)
