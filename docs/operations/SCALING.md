# Scaling Guide

Керівництво з масштабування сервісів та інфраструктури.

## Scaling Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| Vertical | Збільшення ресурсів | Quick fix, single node |
| Horizontal | Більше інстансів | Stateless services |
| Auto-scaling | Автоматичне масштабування | Variable load |

## Service Scaling

### Kubernetes HPA

```yaml
# k8s/hpa-core-service.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: core-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: core-service
  minReplicas: 3
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
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 100
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment/core-service --replicas=10

# Scale with resource update
kubectl set resources deployment/core-service \
  --limits=cpu=2000m,memory=4Gi \
  --requests=cpu=500m,memory=1Gi
```

## Database Scaling

### PostgreSQL Read Replicas

```yaml
# Primary
postgresql:
  replication:
    enabled: true
    numSynchronousReplicas: 1
    applicationName: shop

# Read replicas
postgresql-read:
  replicaCount: 3
```

### Connection Pooling (PgBouncer)

```ini
# pgbouncer.ini
[databases]
shop = host=postgres port=5432 dbname=shop

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 10
```

### Database Partitioning

```sql
-- Partition orders by month
CREATE TABLE orders (
    id UUID,
    created_at TIMESTAMP,
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Redis Scaling

### Redis Cluster

```yaml
# Redis cluster with 6 nodes (3 masters, 3 replicas)
redis-cluster:
  cluster:
    enabled: true
    slotsMigrated: 5000
    replicas: 1
    nodes: 6
```

### Scaling Commands

```bash
# Add node to cluster
redis-cli --cluster add-node new-node:6379 existing-node:6379

# Reshard slots
redis-cli --cluster reshard existing-node:6379
```

## Elasticsearch Scaling

### Add Data Nodes

```yaml
# elasticsearch/values.yaml
master:
  replicas: 3
data:
  replicas: 5  # Increase from 3
  resources:
    limits:
      memory: 8Gi
    requests:
      memory: 4Gi
```

### Index Sharding

```bash
# Increase shards for new indices
PUT /products_v2
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 2
  }
}

# Reindex
POST /_reindex
{
  "source": { "index": "products" },
  "dest": { "index": "products_v2" }
}
```

## CDN & Caching

### Cloudflare Page Rules

```
# Cache static assets aggressively
shop.ua/static/*
  Cache Level: Cache Everything
  Edge Cache TTL: 1 month
  Browser Cache TTL: 1 year

# Cache API responses
shop.ua/api/v1/products*
  Cache Level: Cache Everything
  Edge Cache TTL: 5 minutes
```

### Application Cache

```typescript
// Increase Redis cache TTL during high load
const dynamicTTL = isHighLoad ? 30 * 60 : 5 * 60; // 30 min vs 5 min
await cache.set(key, data, dynamicTTL);
```

## Load Testing Before Scaling

```bash
# k6 load test
k6 run --vus 100 --duration 5m load-test.js

# Expected results before scaling
# Requests/sec: 500
# P95 latency: 200ms

# After scaling
# Requests/sec: 2000
# P95 latency: 150ms
```

## Scaling Checklist

### Before Peak Traffic

```
□ Review current metrics
  - Request rate
  - Error rate
  - Resource utilization

□ Pre-scale services
  - API: 5 → 10 replicas
  - Workers: 3 → 6 replicas

□ Warm up caches
  - Pre-populate Redis
  - Warm Elasticsearch caches

□ Database preparation
  - Increase connection pool
  - Add read replicas if needed

□ CDN configuration
  - Increase cache TTL
  - Enable additional edge locations

□ Monitoring
  - Create dedicated dashboard
  - Lower alert thresholds
  - Ensure on-call coverage
```

### During High Load

```
□ Monitor key metrics
  - CPU/Memory
  - Request latency
  - Error rate
  - Queue depths

□ Be ready to scale further
  - Have runbooks ready
  - Know max scaling limits

□ Communication
  - Status page updates
  - Team coordination
```

### After Peak

```
□ Scale down gradually
  - Don't scale down too fast
  - Watch for delayed effects

□ Review performance
  - What was the peak?
  - Any issues?
  - Lessons learned?

□ Cost analysis
  - Cloud costs during peak
  - Optimization opportunities
```

## Capacity Planning

### Metrics to Track

| Metric | Current | Growth Rate | Projected (6mo) |
|--------|---------|-------------|-----------------|
| Daily Orders | 1,000 | +20%/mo | 3,000 |
| Products | 10,000 | +10%/mo | 17,000 |
| API Requests/day | 1M | +15%/mo | 2.3M |
| Data Size (GB) | 100 | +5%/mo | 134 |

### Headroom Guidelines

| Resource | Normal Load | Peak Reserve |
|----------|-------------|--------------|
| CPU | 50% | 30% |
| Memory | 60% | 25% |
| Disk | 70% | 20% |
| Connections | 50% | 40% |

## See Also

- [Performance Tuning](./PERFORMANCE_TUNING.md)
- [Kubernetes Deployment](../deployment/KUBERNETES.md)
- [Load Testing](../infrastructure/LOAD_TESTING.md)
