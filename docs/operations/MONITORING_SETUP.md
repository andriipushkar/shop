# Monitoring Setup

Налаштування системи моніторингу на базі Prometheus, Grafana та Alertmanager.

## Overview

Система моніторингу включає:
- Prometheus - збір та зберігання метрик
- Grafana - візуалізація та дашборди
- Alertmanager - алерти та сповіщення
- Node Exporter - метрики хоста
- cAdvisor - метрики контейнерів

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING STACK                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Services   │  │   Node       │  │   cAdvisor           │  │
│  │   /metrics   │  │   Exporter   │  │   (Containers)       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘              │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │   Prometheus    │                           │
│                  │   :9090         │                           │
│                  └────────┬────────┘                           │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         │                 │                 │                  │
│         ▼                 ▼                 ▼                  │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐             │
│  │  Grafana   │   │Alertmanager│   │   Other    │             │
│  │  :3000     │   │  :9093     │   │  Consumers │             │
│  └────────────┘   └─────┬──────┘   └────────────┘             │
│                         │                                       │
│         ┌───────────────┼───────────────┐                      │
│         │               │               │                      │
│         ▼               ▼               ▼                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │   Slack    │ │   Email    │ │ PagerDuty  │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Docker Compose

```yaml
# monitoring/docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.48.0
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alerts/:/etc/prometheus/alerts/
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - monitoring
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.2.2
    volumes:
      - ./grafana/provisioning/:/etc/grafana/provisioning/
      - ./grafana/dashboards/:/var/lib/grafana/dashboards/
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=https://grafana.shop.ua
    ports:
      - "3000:3000"
    networks:
      - monitoring
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:v0.26.0
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    networks:
      - monitoring
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:v1.7.0
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - monitoring
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.2
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"
    networks:
      - monitoring
    restart: unless-stopped

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
```

## Prometheus Configuration

```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    env: 'prod'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - /etc/prometheus/alerts/*.yml

scrape_configs:
  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Node Exporter
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # cAdvisor
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  # Core Service
  - job_name: 'core-service'
    static_configs:
      - targets: ['core:8080']
    metrics_path: /metrics

  # OMS Service
  - job_name: 'oms-service'
    static_configs:
      - targets: ['oms:8081']
    metrics_path: /metrics

  # Storefront
  - job_name: 'storefront'
    static_configs:
      - targets: ['storefront:3000']
    metrics_path: /api/metrics

  # PostgreSQL
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Elasticsearch
  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['elasticsearch-exporter:9114']

  # RabbitMQ
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
```

## Alertmanager Configuration

```yaml
# monitoring/alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@shop.ua'
  smtp_auth_username: 'alerts@shop.ua'
  smtp_auth_password: '${SMTP_PASSWORD}'

  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'

  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true

    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: '{{ template "slack.title" . }}'
        text: '{{ template "slack.text" . }}'

  - name: 'critical'
    slack_configs:
      - channel: '#alerts-critical'
        send_resolved: true
    email_configs:
      - to: 'oncall@shop.ua'
        send_resolved: true

  - name: 'warning'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true

templates:
  - '/etc/alertmanager/templates/*.tmpl'
```

## Grafana Provisioning

### Datasources

```yaml
# monitoring/grafana/provisioning/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Alertmanager
    type: alertmanager
    access: proxy
    url: http://alertmanager:9093
    editable: false
```

### Dashboard Provisioning

```yaml
# monitoring/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

## Key Dashboards

### Service Overview Dashboard

```json
{
  "title": "Service Overview",
  "panels": [
    {
      "title": "Request Rate",
      "targets": [{
        "expr": "sum(rate(http_requests_total[5m])) by (service)"
      }]
    },
    {
      "title": "Error Rate",
      "targets": [{
        "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
      }]
    },
    {
      "title": "P99 Latency",
      "targets": [{
        "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))"
      }]
    },
    {
      "title": "Active Connections",
      "targets": [{
        "expr": "db_connections_in_use"
      }]
    }
  ]
}
```

### Infrastructure Dashboard

```json
{
  "title": "Infrastructure",
  "panels": [
    {
      "title": "CPU Usage",
      "targets": [{
        "expr": "100 - (avg by(instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
      }]
    },
    {
      "title": "Memory Usage",
      "targets": [{
        "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100"
      }]
    },
    {
      "title": "Disk Usage",
      "targets": [{
        "expr": "(1 - (node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"})) * 100"
      }]
    },
    {
      "title": "Network I/O",
      "targets": [
        { "expr": "rate(node_network_receive_bytes_total[5m])" },
        { "expr": "rate(node_network_transmit_bytes_total[5m])" }
      ]
    }
  ]
}
```

## Service Instrumentation

### Go Service

```go
import (
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
    // Expose metrics endpoint
    http.Handle("/metrics", promhttp.Handler())
    http.ListenAndServe(":8080", nil)
}
```

### Next.js Service

```typescript
// pages/api/metrics.ts
import { collectDefaultMetrics, Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export default async function handler(req, res) {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
}
```

## Useful PromQL Queries

```promql
# Request rate by service
sum(rate(http_requests_total[5m])) by (service)

# Error rate percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Memory usage percentage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk space remaining
node_filesystem_avail_bytes{mountpoint="/"} / 1024 / 1024 / 1024

# Container CPU usage
sum(rate(container_cpu_usage_seconds_total[5m])) by (container_name) * 100

# PostgreSQL connections
pg_stat_activity_count

# Redis memory usage
redis_memory_used_bytes / redis_memory_max_bytes * 100
```

## See Also

- [Alerting Rules](./ALERTING_RULES.md)
- [Metrics](../modules/METRICS.md)
- [Tracing](../modules/TRACING.md)
- [Runbooks](../guides/RUNBOOKS.md)
