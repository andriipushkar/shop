# Capacity Planning

Планування потужностей та масштабування інфраструктури.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAPACITY PLANNING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Metrics Collection ──▶ Analysis ──▶ Forecasting ──▶ Scaling Decision      │
│                                                                              │
│  Key Factors:                                                               │
│  ├── Current usage patterns                                                │
│  ├── Growth projections                                                    │
│  ├── Peak load handling                                                    │
│  ├── Resource utilization                                                  │
│  └── Cost optimization                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Resource Requirements

### Per 1000 Daily Active Users

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Core API | 1 vCPU, 2GB RAM | 2 vCPU, 4GB RAM |
| Storefront | 1 vCPU, 1GB RAM | 2 vCPU, 2GB RAM |
| PostgreSQL | 2 vCPU, 4GB RAM | 4 vCPU, 8GB RAM |
| Redis | 1 vCPU, 1GB RAM | 2 vCPU, 2GB RAM |
| Elasticsearch | 2 vCPU, 4GB RAM | 4 vCPU, 8GB RAM |

### Scaling Tiers

| Tier | DAU | Orders/day | Infrastructure |
|------|-----|------------|----------------|
| Starter | < 1,000 | < 100 | Single server |
| Growth | 1,000 - 10,000 | 100 - 1,000 | 3-node cluster |
| Scale | 10,000 - 100,000 | 1,000 - 10,000 | 5+ node cluster |
| Enterprise | 100,000+ | 10,000+ | Multi-region |

## Component Sizing

### API Service

```yaml
# Kubernetes HPA for Core API
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: core-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: core-api
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### Resource Allocation by Load

| Requests/sec | Pods | CPU/pod | Memory/pod |
|--------------|------|---------|------------|
| < 100 | 2 | 500m | 512Mi |
| 100 - 500 | 4 | 1000m | 1Gi |
| 500 - 1000 | 8 | 1000m | 2Gi |
| 1000 - 5000 | 16 | 2000m | 4Gi |
| 5000+ | 32+ | 2000m | 4Gi |

### PostgreSQL

```yaml
# Database sizing guidelines
sizing:
  starter:
    instance: db.t3.medium
    storage: 100GB
    iops: 3000
    connections: 100

  growth:
    instance: db.r6g.large
    storage: 500GB
    iops: 10000
    connections: 500
    read_replicas: 1

  scale:
    instance: db.r6g.xlarge
    storage: 2TB
    iops: 20000
    connections: 2000
    read_replicas: 2

  enterprise:
    instance: db.r6g.4xlarge
    storage: 10TB
    iops: 64000
    connections: 5000
    read_replicas: 4
    multi_az: true
```

### Connection Pool Sizing

```go
// Database connection pool formula
// Max connections = (core_count * 2) + effective_spindle_count
// For SSD, effective_spindle_count ≈ 200

func calculatePoolSize(cpuCores int, podCount int) int {
    basePoolSize := (cpuCores * 2) + 200
    perPodConnections := basePoolSize / podCount

    // Reserve 20% for maintenance
    return int(float64(perPodConnections) * 0.8)
}

// Example for 8 cores, 4 pods:
// (8 * 2) + 200 = 216 total connections
// 216 / 4 = 54 per pod
// 54 * 0.8 = 43 connections per pod
```

### Redis

```yaml
# Redis sizing
sizing:
  starter:
    instance: cache.t3.micro
    memory: 0.5GB

  growth:
    instance: cache.r6g.large
    memory: 13GB
    cluster_mode: false

  scale:
    instance: cache.r6g.xlarge
    memory: 26GB
    cluster_mode: true
    shards: 3
    replicas: 1

  enterprise:
    instance: cache.r6g.2xlarge
    memory: 52GB
    cluster_mode: true
    shards: 10
    replicas: 2
```

## Traffic Patterns

### Daily Pattern (Ukrainian E-commerce)

```
Traffic Distribution (typical day):

00:00 - 06:00  ████                        10%
06:00 - 09:00  ████████                    20%
09:00 - 12:00  ████████████████            40%
12:00 - 14:00  ████████████                30%
14:00 - 18:00  ████████████████████        50%
18:00 - 21:00  ████████████████████████    60%
21:00 - 00:00  ████████████                30%

Peak hours: 18:00 - 21:00 (60% of peak capacity)
Off-peak: 00:00 - 06:00 (10% of peak capacity)
```

### Seasonal Scaling

| Event | Traffic Multiplier | Advance Notice |
|-------|-------------------|----------------|
| Black Friday | 5-10x | 2 weeks |
| New Year | 3-5x | 2 weeks |
| Back to School | 2-3x | 1 week |
| Summer Sale | 2x | 1 week |

## Forecasting

### Growth Projection Formula

```python
# Capacity forecasting model
def forecast_capacity(current_usage, growth_rate, months, safety_margin=1.2):
    """
    current_usage: Current resource usage (e.g., CPU %)
    growth_rate: Monthly growth rate (e.g., 0.1 for 10%)
    months: Forecast period
    safety_margin: Buffer for unexpected growth
    """
    projected = current_usage * ((1 + growth_rate) ** months)
    with_margin = projected * safety_margin
    return with_margin

# Example:
# Current: 40% CPU, 10% monthly growth, 6 month forecast
# forecast_capacity(40, 0.1, 6, 1.2) = 84.9%
# Action: Plan scaling before 6 months
```

### Capacity Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU | 60% | 80% | Scale up |
| Memory | 70% | 85% | Scale up |
| Disk | 70% | 85% | Expand storage |
| Connections | 70% | 90% | Add replicas |

## Scaling Strategies

### Horizontal Scaling

```yaml
# Scale based on custom metrics
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: core-api-hpa
spec:
  metrics:
    # Scale on requests per second
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
    # Scale on queue depth
    - type: External
      external:
        metric:
          name: rabbitmq_queue_messages
          selector:
            matchLabels:
              queue: orders
        target:
          type: Value
          value: "1000"
```

### Vertical Scaling

```yaml
# Vertical Pod Autoscaler
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: core-api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: core-api
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: "*"
        minAllowed:
          cpu: 100m
          memory: 256Mi
        maxAllowed:
          cpu: 4
          memory: 8Gi
```

### Database Scaling

```sql
-- Check current load
SELECT
  datname,
  numbackends,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit,
  ROUND(blks_hit::numeric / (blks_read + blks_hit) * 100, 2) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = 'shop';

-- Connection distribution
SELECT
  state,
  count(*)
FROM pg_stat_activity
GROUP BY state;
```

## Monitoring Dashboard

### Key Metrics

```yaml
# Grafana dashboard metrics
panels:
  - title: "Capacity Overview"
    metrics:
      - expr: "sum(rate(http_requests_total[5m]))"
        legend: "Requests/sec"
      - expr: "avg(container_cpu_usage_seconds_total)"
        legend: "CPU Usage"
      - expr: "sum(container_memory_usage_bytes) / sum(container_memory_max_usage_bytes)"
        legend: "Memory Usage"

  - title: "Database Capacity"
    metrics:
      - expr: "pg_stat_database_numbackends"
        legend: "Active Connections"
      - expr: "pg_database_size_bytes"
        legend: "Database Size"
      - expr: "rate(pg_stat_database_xact_commit[5m])"
        legend: "Transactions/sec"

  - title: "Queue Depth"
    metrics:
      - expr: "rabbitmq_queue_messages"
        legend: "Queue Messages"
      - expr: "rate(rabbitmq_queue_messages_published_total[5m])"
        legend: "Publish Rate"
```

## Capacity Planning Checklist

### Monthly Review

- [ ] Review resource utilization trends
- [ ] Check growth rate against projections
- [ ] Validate cost efficiency
- [ ] Update scaling policies
- [ ] Review incident history

### Before Major Events

- [ ] Review traffic projections
- [ ] Pre-scale infrastructure
- [ ] Test failover procedures
- [ ] Verify monitoring alerts
- [ ] Prepare rollback plan

## See Also

- [Cost Optimization](./COST_OPTIMIZATION.md)
- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
- [Kubernetes Deployment](../deployment/KUBERNETES.md)
