# Alerting Rules

Правила алертингу для Prometheus та Alertmanager.

## Alert Severity Levels

| Severity | Description | Response Time | Notification |
|----------|-------------|---------------|--------------|
| `critical` | Сервіс недоступний | Негайно | Slack + Email + PagerDuty |
| `warning` | Деградація сервісу | 15 хв | Slack + Email |
| `info` | Інформаційні | 1 год | Slack |

## Application Alerts

```yaml
# monitoring/prometheus/alerts/application.yml
groups:
  - name: application
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service)
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
          runbook: "https://docs.shop.ua/runbooks/high-error-rate"

      # High Latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))
          > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency on {{ $labels.service }}"
          description: "P99 latency is {{ $value | humanizeDuration }} (threshold: 2s)"

      # Service Down
      - alert: ServiceDown
        expr: up{job=~"core-service|oms-service|storefront"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.instance }} has been down for more than 1 minute"

      # Too Many Requests In Flight
      - alert: TooManyRequestsInFlight
        expr: http_requests_in_flight > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Too many requests in flight"
          description: "{{ $value }} requests currently processing"

      # Low Cache Hit Rate
      - alert: LowCacheHitRate
        expr: |
          sum(rate(cache_hits_total[5m]))
          /
          (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
          < 0.7
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }} (threshold: 70%)"
```

## Database Alerts

```yaml
# monitoring/prometheus/alerts/database.yml
groups:
  - name: database
    rules:
      # PostgreSQL Down
      - alert: PostgreSQLDown
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is down"
          description: "PostgreSQL instance {{ $labels.instance }} is not responding"

      # High Connection Usage
      - alert: PostgreSQLHighConnections
        expr: |
          pg_stat_activity_count
          /
          pg_settings_max_connections
          > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL connection pool near capacity"
          description: "{{ $value | humanizePercentage }} of connections in use"

      # Slow Queries
      - alert: PostgreSQLSlowQueries
        expr: |
          rate(pg_stat_activity_max_tx_duration{state="active"}[5m])
          > 60
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL slow queries detected"
          description: "Queries running longer than 60 seconds"

      # Replication Lag
      - alert: PostgreSQLReplicationLag
        expr: pg_replication_lag > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL replication lag"
          description: "Replication lag is {{ $value }} seconds"
```

## Redis Alerts

```yaml
# monitoring/prometheus/alerts/redis.yml
groups:
  - name: redis
    rules:
      # Redis Down
      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis is down"
          description: "Redis instance {{ $labels.instance }} is not responding"

      # High Memory Usage
      - alert: RedisHighMemory
        expr: |
          redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis high memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # Too Many Connections
      - alert: RedisTooManyConnections
        expr: redis_connected_clients > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis too many connections"
          description: "{{ $value }} clients connected"
```

## Infrastructure Alerts

```yaml
# monitoring/prometheus/alerts/infrastructure.yml
groups:
  - name: infrastructure
    rules:
      # High CPU Usage
      - alert: HighCPUUsage
        expr: |
          100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
          > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is {{ $value | humanize }}%"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: |
          (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
          > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is {{ $value | humanize }}%"

      # Disk Space Low
      - alert: DiskSpaceLow
        expr: |
          (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100
          > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"
          description: "Disk usage is {{ $value | humanize }}%"

      # Disk Space Critical
      - alert: DiskSpaceCritical
        expr: |
          (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100
          > 95
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space critical on {{ $labels.instance }}"
          description: "Disk usage is {{ $value | humanize }}%"

      # Node Down
      - alert: NodeDown
        expr: up{job="node"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Node {{ $labels.instance }} is down"
          description: "Node has been unreachable for more than 2 minutes"
```

## Business Alerts

```yaml
# monitoring/prometheus/alerts/business.yml
groups:
  - name: business
    rules:
      # No Orders
      - alert: NoOrdersReceived
        expr: |
          sum(increase(orders_created_total[1h])) == 0
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "No orders received"
          description: "No new orders in the last 30 minutes during business hours"

      # High Cart Abandonment
      - alert: HighCartAbandonment
        expr: |
          (sum(rate(cart_abandoned_total[1h])) / sum(rate(cart_created_total[1h]))) > 0.8
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "High cart abandonment rate"
          description: "Cart abandonment rate is {{ $value | humanizePercentage }}"

      # Payment Failures
      - alert: HighPaymentFailureRate
        expr: |
          sum(rate(payment_failed_total[15m])) / sum(rate(payment_total[15m])) > 0.1
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "High payment failure rate"
          description: "{{ $value | humanizePercentage }} of payments failing"

      # Low Inventory
      - alert: CriticalInventoryLow
        expr: products_out_of_stock > 50
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Many products out of stock"
          description: "{{ $value }} products are out of stock"
```

## Elasticsearch Alerts

```yaml
# monitoring/prometheus/alerts/elasticsearch.yml
groups:
  - name: elasticsearch
    rules:
      # Cluster Health Red
      - alert: ElasticsearchClusterRed
        expr: elasticsearch_cluster_health_status{color="red"} == 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Elasticsearch cluster is RED"
          description: "Cluster health is red - data loss possible"

      # Cluster Health Yellow
      - alert: ElasticsearchClusterYellow
        expr: elasticsearch_cluster_health_status{color="yellow"} == 1
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Elasticsearch cluster is YELLOW"
          description: "Cluster has unassigned shards"

      # Disk Watermark
      - alert: ElasticsearchDiskWatermark
        expr: |
          elasticsearch_filesystem_data_available_bytes
          /
          elasticsearch_filesystem_data_size_bytes
          < 0.15
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Elasticsearch disk watermark"
          description: "Less than 15% disk space available"
```

## RabbitMQ Alerts

```yaml
# monitoring/prometheus/alerts/rabbitmq.yml
groups:
  - name: rabbitmq
    rules:
      # Queue Backlog
      - alert: RabbitMQQueueBacklog
        expr: rabbitmq_queue_messages > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "RabbitMQ queue backlog"
          description: "Queue {{ $labels.queue }} has {{ $value }} messages"

      # High Memory Usage
      - alert: RabbitMQHighMemory
        expr: |
          rabbitmq_process_resident_memory_bytes
          /
          rabbitmq_resident_memory_limit_bytes
          > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "RabbitMQ high memory"
          description: "Memory usage is {{ $value | humanizePercentage }}"
```

## Alert Routing

```yaml
# alertmanager.yml routes
route:
  routes:
    # Critical alerts - immediate notification
    - match:
        severity: critical
      receiver: 'critical-receiver'
      group_wait: 10s
      repeat_interval: 1h

    # Database alerts
    - match:
        alertname: ~"PostgreSQL.*|Redis.*"
      receiver: 'database-team'

    # Business alerts
    - match_re:
        alertname: "NoOrders.*|HighCart.*|Payment.*"
      receiver: 'business-team'
      group_wait: 5m
```

## Testing Alerts

```bash
# Test alert rule syntax
promtool check rules alerts/*.yml

# Test alertmanager config
amtool check-config alertmanager.yml

# Send test alert
amtool alert add alertname=TestAlert severity=warning instance=test
```

## See Also

- [Monitoring Setup](./MONITORING_SETUP.md)
- [Incident Response](./INCIDENT_RESPONSE.md)
- [Runbooks](../guides/RUNBOOKS.md)
