# Monitoring & Observability

Моніторинг, логування та трейсинг платформи.

## Огляд

| Компонент | Технологія | Призначення |
|-----------|------------|-------------|
| Metrics | Prometheus | Збір метрик |
| Dashboards | Grafana | Візуалізація |
| Logs | Loki / ELK | Логування |
| Tracing | Jaeger | Distributed tracing |
| Alerting | Alertmanager | Сповіщення |

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │  Services   │────▶│  Prometheus │────▶│    Grafana      │   │
│  │  /metrics   │     │             │     │   Dashboards    │   │
│  └─────────────┘     └──────┬──────┘     └─────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│                      ┌─────────────┐                            │
│                      │ Alertmanager│──▶ Slack/PagerDuty/Email  │
│                      └─────────────┘                            │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │  Services   │────▶│    Loki     │────▶│    Grafana      │   │
│  │   Logs      │     │             │     │   Log Explorer  │   │
│  └─────────────┘     └─────────────┘     └─────────────────┘   │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │  Services   │────▶│   Jaeger    │────▶│   Jaeger UI     │   │
│  │   Traces    │     │  Collector  │     │                 │   │
│  └─────────────┘     └─────────────┘     └─────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Prometheus

### Конфігурація

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Kubernetes service discovery
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: replace
        target_label: app

  # Shop Platform Services
  - job_name: 'shop-core'
    static_configs:
      - targets: ['core:8080']
    metrics_path: /metrics

  - job_name: 'shop-oms'
    static_configs:
      - targets: ['oms:8081']

  - job_name: 'shop-crm'
    static_configs:
      - targets: ['crm:8082']

  # Infrastructure
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']

  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['elasticsearch-exporter:9114']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### Метрики додатків (Go)

```go
// pkg/metrics/metrics.go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    // HTTP metrics
    HTTPRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "path", "status"},
    )

    HTTPRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request duration in seconds",
            Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
        },
        []string{"method", "path"},
    )

    // Business metrics
    OrdersCreatedTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "orders_created_total",
            Help: "Total number of orders created",
        },
        []string{"tenant_id", "payment_method"},
    )

    OrdersTotal = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "orders_total_amount",
            Help: "Total amount of orders",
        },
        []string{"tenant_id", "currency"},
    )

    PaymentsProcessed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "payments_processed_total",
            Help: "Total payments processed",
        },
        []string{"provider", "status"},
    )

    // Database metrics
    DBConnectionsActive = promauto.NewGauge(
        prometheus.GaugeOpts{
            Name: "db_connections_active",
            Help: "Number of active database connections",
        },
    )

    DBQueryDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "db_query_duration_seconds",
            Help:    "Database query duration",
            Buckets: prometheus.DefBuckets,
        },
        []string{"query_type"},
    )

    // Cache metrics
    CacheHits = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "cache_hits_total",
            Help: "Cache hits",
        },
        []string{"cache_name"},
    )

    CacheMisses = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "cache_misses_total",
            Help: "Cache misses",
        },
        []string{"cache_name"},
    )

    // Queue metrics
    QueueMessagesPublished = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "queue_messages_published_total",
            Help: "Messages published to queue",
        },
        []string{"exchange", "routing_key"},
    )

    QueueMessagesConsumed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "queue_messages_consumed_total",
            Help: "Messages consumed from queue",
        },
        []string{"queue", "status"},
    )
)

// Middleware for HTTP metrics
func MetricsMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()

        c.Next()

        duration := time.Since(start).Seconds()
        status := strconv.Itoa(c.Writer.Status())

        HTTPRequestsTotal.WithLabelValues(c.Request.Method, c.FullPath(), status).Inc()
        HTTPRequestDuration.WithLabelValues(c.Request.Method, c.FullPath()).Observe(duration)
    }
}
```

## Alert Rules

### alerts.yml

```yaml
# prometheus/rules/alerts.yml
groups:
  - name: shop-platform
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (app)
          /
          sum(rate(http_requests_total[5m])) by (app)
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.app }}"
          description: "Error rate is {{ $value | humanizePercentage }} (>5%)"

      # High Latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, app))
          > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency on {{ $labels.app }}"
          description: "P95 latency is {{ $value | humanizeDuration }}"

      # Service Down
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "Service has been down for more than 1 minute"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: |
          container_memory_usage_bytes / container_spec_memory_limit_bytes
          > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.pod }}"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # High CPU Usage
      - alert: HighCPUUsage
        expr: |
          rate(container_cpu_usage_seconds_total[5m])
          /
          container_spec_cpu_quota * container_spec_cpu_period
          > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.pod }}"

      # Database Connection Pool Exhausted
      - alert: DBConnectionPoolExhausted
        expr: db_connections_active > 90
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"

      # Queue Backlog
      - alert: QueueBacklog
        expr: rabbitmq_queue_messages > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue {{ $labels.queue }} has backlog"
          description: "{{ $value }} messages in queue"

      # Disk Space Low
      - alert: DiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"

  - name: business-metrics
    rules:
      # No Orders
      - alert: NoOrders
        expr: |
          sum(increase(orders_created_total[1h])) == 0
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "No orders in the last hour"

      # Payment Failures
      - alert: HighPaymentFailureRate
        expr: |
          sum(rate(payments_processed_total{status="failed"}[15m]))
          /
          sum(rate(payments_processed_total[15m]))
          > 0.1
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "High payment failure rate"
          description: "{{ $value | humanizePercentage }} of payments failing"
```

## Alertmanager

### alertmanager.yml

```yaml
# alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true

    - match:
        severity: critical
      receiver: 'slack-critical'

    - match:
        severity: warning
      receiver: 'slack-warning'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: '{{ .Status | toUpper }}: {{ .CommonLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-critical'
    slack_configs:
      - channel: '#alerts-critical'
        send_resolved: true
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
        title: '🚨 {{ .CommonLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-warning'
    slack_configs:
      - channel: '#alerts-warning'
        send_resolved: true
        color: 'warning'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        severity: critical

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

## Grafana Dashboards

### Shop Platform Overview

```json
{
  "dashboard": {
    "title": "Shop Platform Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (app)",
            "legendFormat": "{{ app }}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (app) / sum(rate(http_requests_total[5m])) by (app) * 100",
            "legendFormat": "{{ app }}"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, app))",
            "legendFormat": "{{ app }}"
          }
        ]
      },
      {
        "title": "Orders per Hour",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(increase(orders_created_total[1h]))"
          }
        ]
      },
      {
        "title": "Revenue Today",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(orders_total_amount)"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "gauge",
        "targets": [
          {
            "expr": "sum(active_sessions)"
          }
        ]
      }
    ]
  }
}
```

## Loki (Logging)

### loki-config.yaml

```yaml
# loki/loki-config.yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

### Promtail (Log collector)

```yaml
# promtail/promtail-config.yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    pipeline_stages:
      - json:
          expressions:
            level: level
            msg: msg
            trace_id: trace_id
      - labels:
          level:
          trace_id:
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
```

## Jaeger (Tracing)

### Інструментація (Go)

```go
// pkg/tracing/tracing.go
package tracing

import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/jaeger"
    "go.opentelemetry.io/otel/sdk/resource"
    "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

func InitTracer(serviceName string) (*trace.TracerProvider, error) {
    exporter, err := jaeger.New(jaeger.WithCollectorEndpoint(
        jaeger.WithEndpoint(os.Getenv("JAEGER_ENDPOINT")),
    ))
    if err != nil {
        return nil, err
    }

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
            semconv.DeploymentEnvironmentKey.String(os.Getenv("ENV")),
        )),
        trace.WithSampler(trace.TraceIDRatioBased(0.1)), // 10% sampling
    )

    otel.SetTracerProvider(tp)
    return tp, nil
}

// Middleware
func TracingMiddleware() gin.HandlerFunc {
    return otelgin.Middleware("shop-platform")
}
```

### Jaeger Deployment

```yaml
# kubernetes/jaeger/jaeger.yaml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: shop-jaeger
  namespace: shop
spec:
  strategy: production

  collector:
    replicas: 2
    resources:
      limits:
        cpu: 500m
        memory: 512Mi

  storage:
    type: elasticsearch
    options:
      es:
        server-urls: http://elasticsearch:9200
        index-prefix: jaeger

  query:
    replicas: 2

  ingress:
    enabled: true
    hosts:
      - jaeger.yourstore.com
```

## Docker Compose (Dev)

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - shop-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3002:3000"
    depends_on:
      - prometheus
    networks:
      - shop-network

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    volumes:
      - ./alertmanager:/etc/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
    ports:
      - "9093:9093"
    networks:
      - shop-network

  loki:
    image: grafana/loki:latest
    container_name: loki
    volumes:
      - ./loki:/etc/loki
      - loki_data:/loki
    command: -config.file=/etc/loki/loki-config.yaml
    ports:
      - "3100:3100"
    networks:
      - shop-network

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - ./promtail:/etc/promtail
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/promtail-config.yaml
    networks:
      - shop-network

  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "6832:6832/udp"
      - "5778:5778"
      - "16686:16686"
      - "14250:14250"
      - "14268:14268"
      - "14269:14269"
      - "9411:9411"
    networks:
      - shop-network

volumes:
  prometheus_data:
  grafana_data:
  loki_data:

networks:
  shop-network:
    external: true
```

## SLOs & SLIs

### Service Level Indicators

| SLI | Target | Measurement |
|-----|--------|-------------|
| Availability | 99.9% | `up` metric |
| Latency P95 | < 500ms | `http_request_duration_seconds` |
| Error Rate | < 0.1% | `http_requests_total{status=~"5.."}` |
| Throughput | > 1000 RPS | `rate(http_requests_total[5m])` |

### SLO Dashboard Queries

```promql
# Availability (30 days)
avg_over_time(up{app="core"}[30d]) * 100

# Error Budget Remaining
1 - (
  sum(increase(http_requests_total{status=~"5.."}[30d]))
  /
  sum(increase(http_requests_total[30d]))
) / 0.001 * 100

# Latency SLO Compliance
sum(rate(http_request_duration_seconds_bucket{le="0.5"}[30d]))
/
sum(rate(http_request_duration_seconds_count[30d]))
* 100
```

## Корисні команди

```bash
# Prometheus queries
curl 'http://localhost:9090/api/v1/query?query=up'

# Grafana API
curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
  http://localhost:3000/api/dashboards/home

# Loki queries
curl -G 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={app="core"}'

# Jaeger traces
curl 'http://localhost:16686/api/traces?service=core&limit=20'
```
