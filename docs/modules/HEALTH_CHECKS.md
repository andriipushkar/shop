# Health Checks

Система перевірки стану сервісів та їх залежностей для Kubernetes та моніторингу.

## Overview

Модуль health забезпечує:
- Liveness probe - чи сервіс живий
- Readiness probe - чи сервіс готовий приймати трафік
- Перевірка всіх залежностей (DB, Redis, Elasticsearch)
- Паралельне виконання перевірок
- Configurable timeouts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HEALTH CHECK SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Kubernetes                    Service                         │
│  ┌──────────┐              ┌──────────────────────────────────┐ │
│  │ kubelet  │─────────────▶│  /health/live  │  Liveness      │ │
│  │          │              │  - Always OK if process runs     │ │
│  └──────────┘              └──────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┐              ┌──────────────────────────────────┐ │
│  │ kubelet  │─────────────▶│  /health/ready │  Readiness     │ │
│  │          │              │  - Checks all dependencies       │ │
│  └──────────┘              └──────────────────────────────────┘ │
│                                                                  │
│                            ┌──────────────────────────────────┐ │
│  ┌──────────┐              │  /health       │  Full Health   │ │
│  │Monitoring│─────────────▶│  - Database    │                │ │
│  │          │              │  - Redis       │                │ │
│  └──────────┘              │  - Elasticsearch                │ │
│                            │  - Memory      │                │ │
│                            └──────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Health Status

```go
type Status string

const (
    StatusHealthy   Status = "healthy"   // All checks passed
    StatusUnhealthy Status = "unhealthy" // Critical check failed
    StatusDegraded  Status = "degraded"  // Non-critical check failed
)
```

## Response Format

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "components": {
    "database": {
      "status": "healthy",
      "message": "connected",
      "duration_ms": 5
    },
    "redis": {
      "status": "healthy",
      "message": "connected",
      "duration_ms": 2
    },
    "elasticsearch": {
      "status": "degraded",
      "message": "elasticsearch unavailable",
      "duration_ms": 1000
    }
  }
}
```

## Usage

### Initialize Health Checker

```go
import "shop/services/core/internal/health"

func main() {
    h := health.New("1.0.0")

    // Register checkers
    h.Register("database", health.DatabaseChecker(db))
    h.Register("redis", health.RedisCacheChecker(redis))
    h.Register("elasticsearch", health.ElasticsearchChecker(es))
    h.Register("memory", health.MemoryChecker(maxMemoryMB))

    // Setup routes
    mux.HandleFunc("/health", h.Handler())
    mux.HandleFunc("/health/live", health.LivenessHandler())
    mux.HandleFunc("/health/ready", h.Handler())
}
```

### Built-in Checkers

#### Database Checker
```go
health.DatabaseChecker(db *sql.DB)
```
- Pings database
- Checks connection pool usage
- Returns `degraded` if pool > 80% capacity

#### Redis Checker
```go
health.RedisCacheChecker(redis RedisChecker)
```
- Pings Redis
- Returns `degraded` if not configured
- Returns `degraded` on connection error

#### Elasticsearch Checker
```go
health.ElasticsearchChecker(es ElasticsearchPinger)
```
- Checks cluster health
- Returns `degraded` if unavailable

#### Memory Checker
```go
health.MemoryChecker(maxMemoryMB uint64)
```
- Monitors memory usage
- Returns `degraded` if over threshold

### Custom Checker

```go
h.Register("custom", func(ctx context.Context) health.CheckResult {
    // Perform check
    if err := checkSomething(); err != nil {
        return health.CheckResult{
            Status:  health.StatusUnhealthy,
            Message: err.Error(),
        }
    }
    return health.CheckResult{
        Status:  health.StatusHealthy,
        Message: "OK",
    }
})
```

## API Endpoints

### GET /health/live
Liveness probe - returns 200 if process is running.

```bash
curl http://localhost:8080/health/live
# Response: OK
```

### GET /health/ready
Readiness probe - checks all dependencies.

```bash
curl http://localhost:8080/health/ready
```

Response codes:
- `200` - Healthy or Degraded (can accept traffic)
- `503` - Unhealthy (should not receive traffic)

### GET /health
Full health check with details.

```bash
curl http://localhost:8080/health | jq
```

## Kubernetes Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: core-service
spec:
  template:
    spec:
      containers:
        - name: core
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 3

          startupProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 30
```

## Configuration

```bash
# Health check settings
HEALTH_CHECK_TIMEOUT=5s
HEALTH_CHECK_INTERVAL=10s

# Component-specific
DB_POOL_WARNING_THRESHOLD=0.8
MEMORY_WARNING_THRESHOLD_MB=1024
```

## Status Logic

```
Overall Status = worst status of all components

healthy + healthy = healthy
healthy + degraded = degraded
healthy + unhealthy = unhealthy
degraded + degraded = degraded
degraded + unhealthy = unhealthy
```

## Graceful Degradation

Services should continue operating in degraded mode:

| Component | If Unavailable | Impact |
|-----------|---------------|--------|
| Database | Unhealthy | Cannot process requests |
| Redis | Degraded | Slower, no caching |
| Elasticsearch | Degraded | Search fallback to DB |
| External API | Degraded | Feature disabled |

## Monitoring Integration

### Prometheus Metrics

```go
var (
    healthCheckDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "health_check_duration_seconds",
            Help: "Health check duration",
        },
        []string{"component"},
    )

    healthCheckStatus = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "health_check_status",
            Help: "Health check status (1=healthy, 0.5=degraded, 0=unhealthy)",
        },
        []string{"component"},
    )
)
```

### Alert Rules

```yaml
groups:
  - name: health
    rules:
      - alert: ServiceUnhealthy
        expr: health_check_status{component="database"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service unhealthy - database down"

      - alert: ServiceDegraded
        expr: health_check_status < 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Service degraded"
```

## Best Practices

1. **Fast checks** - Health checks should complete < 5s
2. **Parallel execution** - Run independent checks concurrently
3. **Timeout handling** - Don't let checks hang indefinitely
4. **Meaningful status** - Distinguish between critical and non-critical
5. **Version info** - Include service version in response
6. **Avoid side effects** - Checks should be read-only
7. **Cache results** - Don't overload dependencies with health checks

## See Also

- [Metrics](./METRICS.md)
- [Tracing](./TRACING.md)
- [Monitoring Setup](../operations/MONITORING_SETUP.md)
- [Kubernetes Deployment](../deployment/KUBERNETES.md)
