# Distributed Tracing (OpenTelemetry + Jaeger)

Система розподіленого трасування для відстеження запитів через всі сервіси.

## Overview

Модуль tracing забезпечує:
- End-to-end трасування запитів
- Інтеграція з Jaeger через OTLP
- Автоматичне трасування HTTP, DB, Cache операцій
- Context propagation між сервісами
- Sampling стратегії

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED TRACING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Client   │───▶│ Gateway  │───▶│  Core    │───▶│   OMS    │  │
│  │          │    │ Service  │    │ Service  │    │ Service  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       │         ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐  │
│       │         │   Span    │   │   Span    │   │   Span    │  │
│       │         │  Context  │   │  Context  │   │  Context  │  │
│       │         └─────┬─────┘   └─────┬─────┘   └─────┬─────┘  │
│       │               │               │               │         │
│       │               └───────────────┴───────────────┘         │
│       │                               │                         │
│       │                    ┌──────────▼──────────┐              │
│       │                    │  OTLP Collector     │              │
│       │                    │  (Jaeger)           │              │
│       │                    └──────────┬──────────┘              │
│       │                               │                         │
│       │                    ┌──────────▼──────────┐              │
│       │                    │   Jaeger UI         │              │
│       │                    │   :16686            │              │
│       │                    └────────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

```go
type Config struct {
    ServiceName    string  // Service identifier
    ServiceVersion string  // Service version
    Environment    string  // dev, staging, prod
    OTLPEndpoint   string  // Jaeger collector endpoint
    SampleRate     float64 // 0.0 to 1.0
    Enabled        bool    // Enable/disable tracing
}
```

### Environment Variables

```bash
# Tracing configuration
TRACING_ENABLED=true
TRACING_SERVICE_NAME=core-service
TRACING_SERVICE_VERSION=1.0.0
TRACING_ENVIRONMENT=production

# Jaeger
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://jaeger:4318/v1/traces

# Sampling
TRACING_SAMPLE_RATE=1.0  # 1.0 = 100%, 0.1 = 10%
```

## Usage

### Initialize Tracer

```go
import "shop/services/core/internal/tracing"

func main() {
    cfg := &tracing.Config{
        ServiceName:    "core-service",
        ServiceVersion: "1.0.0",
        Environment:    "production",
        OTLPEndpoint:   "localhost:4318",
        SampleRate:     1.0,
        Enabled:        true,
    }

    tracer, err := tracing.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer tracer.Shutdown(context.Background())

    // Use tracer...
}
```

### HTTP Middleware

```go
// Automatic HTTP tracing
mux := http.NewServeMux()
mux.HandleFunc("/api/products", handleProducts)

handler := tracer.Middleware(mux)
http.ListenAndServe(":8080", handler)
```

Middleware automatically:
- Extracts trace context from incoming headers
- Creates span for each request
- Records HTTP method, path, status code
- Propagates context to downstream calls

### Manual Spans

```go
func processOrder(ctx context.Context, orderID string) error {
    // Start span
    ctx, span := tracer.Start(ctx, "processOrder")
    defer span.End()

    // Add attributes
    tracing.SetAttributes(ctx,
        attribute.String("order.id", orderID),
        attribute.Int("order.items", len(items)),
    )

    // Add event
    tracing.AddEvent(ctx, "order.validated")

    // Process...
    if err != nil {
        tracing.RecordError(ctx, err)
        return err
    }

    tracing.AddEvent(ctx, "order.completed")
    return nil
}
```

### Database Spans

```go
func (r *Repository) GetProduct(ctx context.Context, id string) (*Product, error) {
    query := "SELECT * FROM products WHERE id = $1"

    // Create DB span
    ctx, span := tracer.DBSpan(ctx, "select", query)
    defer span.End()

    var product Product
    err := r.db.QueryRowContext(ctx, query, id).Scan(&product)
    if err != nil {
        tracing.RecordError(ctx, err)
        return nil, err
    }

    return &product, nil
}
```

### Cache Spans

```go
func (c *CachedRepository) GetProduct(ctx context.Context, id string) (*Product, error) {
    cacheKey := "product:" + id

    // Create cache span
    ctx, span := tracer.CacheSpan(ctx, "get", cacheKey)
    defer span.End()

    var product Product
    err := c.cache.Get(ctx, cacheKey, &product)
    if err == nil {
        tracing.SetAttributes(ctx, attribute.Bool("cache.hit", true))
        return &product, nil
    }

    tracing.SetAttributes(ctx, attribute.Bool("cache.hit", false))
    // Fetch from DB...
}
```

### External Service Spans

```go
func (s *PaymentService) ProcessPayment(ctx context.Context, payment *Payment) error {
    // Create external service span
    ctx, span := tracer.ExternalSpan(ctx, "liqpay", "create_payment")
    defer span.End()

    tracing.SetAttributes(ctx,
        attribute.Float64("payment.amount", payment.Amount),
        attribute.String("payment.currency", payment.Currency),
    )

    // Call external API...
}
```

### Search Spans

```go
func (s *SearchService) Search(ctx context.Context, query string) ([]Product, error) {
    ctx, span := tracer.SearchSpan(ctx, "search", query)
    defer span.End()

    // Search in Elasticsearch...
}
```

## Span Attributes

### HTTP Span
- `http.method` - HTTP method (GET, POST, etc.)
- `http.target` - Request path
- `http.status_code` - Response status
- `http.response_time_ms` - Response time in ms
- `http.user_agent` - User agent string

### Database Span
- `db.system` - Database type (postgresql)
- `db.operation` - Operation type (select, insert, update, delete)
- `db.statement` - SQL query

### Cache Span
- `db.system` - Cache type (redis)
- `db.operation` - Operation (get, set, delete)
- `cache.key` - Cache key

### External Service Span
- `external.service` - Service name
- `external.operation` - Operation name

## Sampling Strategies

### Always Sample (Development)
```go
SampleRate: 1.0 // Sample 100% of traces
```

### Ratio-Based (Production)
```go
SampleRate: 0.1 // Sample 10% of traces
```

### Never Sample (Disabled)
```go
SampleRate: 0.0 // Disable sampling
Enabled: false  // Or disable entirely
```

## Context Propagation

Trace context is propagated via HTTP headers:
- `traceparent` - W3C Trace Context
- `tracestate` - W3C Trace State
- `baggage` - W3C Baggage

```go
// Outgoing HTTP call
req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))

// Incoming HTTP request (in middleware)
ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
```

## Jaeger UI

Access Jaeger UI at `http://localhost:16686`

### Features
- Search traces by service, operation, tags
- View trace timeline
- Analyze span details
- Compare traces
- View service dependencies

### Useful Queries

```
# Find slow requests
service=core-service operation="GET /api/products" minDuration=1s

# Find errors
service=core-service error=true

# Find by order ID
service=core-service tags={"order.id":"12345"}
```

## Docker Compose

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:1.51
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

## Best Practices

1. **Meaningful span names** - Use descriptive names (`processOrder`, not `func1`)
2. **Add context** - Include relevant attributes (IDs, counts)
3. **Record errors** - Always record errors with stack traces
4. **Use events** - Mark important milestones within spans
5. **Sample appropriately** - 100% in dev, 1-10% in prod
6. **Propagate context** - Pass context through all function calls
7. **Don't over-trace** - Focus on meaningful operations

## See Also

- [Metrics](./METRICS.md)
- [Health Checks](./HEALTH_CHECKS.md)
- [Monitoring Setup](../operations/MONITORING_SETUP.md)
