# Cost Optimization

Оптимізація витрат на інфраструктуру.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COST OPTIMIZATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Monitor ──▶ Analyze ──▶ Optimize ──▶ Validate                             │
│                                                                              │
│  Cost Drivers:                                                              │
│  ├── Compute (40-50%)  - VMs, Kubernetes nodes                             │
│  ├── Database (20-30%) - RDS, storage, backups                             │
│  ├── Network (10-15%)  - Data transfer, CDN                                │
│  ├── Storage (5-10%)   - S3, block storage                                 │
│  └── Other (5-10%)     - Monitoring, logging, DNS                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

### Monthly Costs by Component (Scale Tier)

| Component | Monthly Cost | % of Total |
|-----------|-------------|------------|
| Kubernetes nodes (5x) | $800 | 40% |
| PostgreSQL (RDS) | $400 | 20% |
| Redis (ElastiCache) | $150 | 7.5% |
| Elasticsearch | $200 | 10% |
| S3 Storage | $100 | 5% |
| Data Transfer | $150 | 7.5% |
| CDN (CloudFront) | $100 | 5% |
| Monitoring | $50 | 2.5% |
| Other | $50 | 2.5% |
| **Total** | **$2,000** | **100%** |

## Compute Optimization

### Right-sizing

```yaml
# Before: Over-provisioned
resources:
  requests:
    cpu: "2"
    memory: "4Gi"
  limits:
    cpu: "4"
    memory: "8Gi"
# Actual usage: CPU 20%, Memory 40%

# After: Right-sized
resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
  limits:
    cpu: "1"
    memory: "2Gi"
# Savings: 75% on compute costs
```

### Spot/Preemptible Instances

```yaml
# Use spot instances for non-critical workloads
apiVersion: v1
kind: Pod
spec:
  nodeSelector:
    node.kubernetes.io/instance-type: spot
  tolerations:
    - key: "kubernetes.io/spot"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
```

Cost comparison:
| Instance Type | On-Demand | Spot | Savings |
|--------------|-----------|------|---------|
| c6g.large | $0.068/hr | $0.020/hr | 70% |
| c6g.xlarge | $0.136/hr | $0.041/hr | 70% |
| r6g.large | $0.101/hr | $0.030/hr | 70% |

### Auto-scaling Optimization

```yaml
# Scale down aggressively during off-hours
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: core-api-hpa
spec:
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 120  # Faster scale down
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
```

### Scheduled Scaling

```yaml
# CronJob to scale down at night (00:00-06:00 Kyiv time)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-down-night
spec:
  schedule: "0 22 * * *"  # 00:00 Kyiv (UTC+2)
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: kubectl
              image: bitnami/kubectl
              command:
                - /bin/sh
                - -c
                - |
                  kubectl scale deployment core-api --replicas=2
                  kubectl scale deployment storefront --replicas=2
          restartPolicy: OnFailure

---
# Scale up in morning
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-up-morning
spec:
  schedule: "0 4 * * *"  # 06:00 Kyiv
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: kubectl
              image: bitnami/kubectl
              command:
                - /bin/sh
                - -c
                - |
                  kubectl scale deployment core-api --replicas=4
                  kubectl scale deployment storefront --replicas=4
          restartPolicy: OnFailure
```

## Database Optimization

### Reserved Instances

| Term | Discount | Best For |
|------|----------|----------|
| 1 year | 30-40% | Stable workloads |
| 3 year | 50-60% | Long-term projects |

```bash
# Calculate savings
# On-demand: $400/month = $4,800/year
# 1-year reserved: $2,880/year = $240/month
# Savings: $1,920/year (40%)
```

### Read Replicas Strategy

```yaml
# Route read queries to replicas
database:
  primary:
    host: db-primary.cluster.local
    port: 5432
  replicas:
    - host: db-replica-1.cluster.local
      port: 5432
    - host: db-replica-2.cluster.local
      port: 5432

  # 70% reads go to replicas
  read_ratio: 0.7
```

### Query Optimization

```sql
-- Find expensive queries
SELECT
  query,
  calls,
  total_time / 1000 as total_seconds,
  mean_time / 1000 as mean_seconds,
  rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_orders_customer_id
ON orders(customer_id)
WHERE status != 'cancelled';

-- Expected improvement: 80% reduction in query time
```

## Storage Optimization

### S3 Lifecycle Policies

```json
{
  "Rules": [
    {
      "ID": "MoveToInfrequentAccess",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "uploads/"
      },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ]
    },
    {
      "ID": "DeleteOldLogs",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "logs/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

Storage class costs:
| Class | $/GB/month | Use Case |
|-------|------------|----------|
| Standard | $0.023 | Frequently accessed |
| Standard-IA | $0.0125 | Infrequent access |
| Glacier | $0.004 | Archive |

### Image Optimization

```typescript
// Optimize images on upload
import sharp from 'sharp';

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

// Storage savings: 60-80% reduction in image size
```

## Network Optimization

### CDN Caching

```nginx
# Aggressive caching for static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header CDN-Cache-Control "max-age=31536000";
}

# Cache API responses where appropriate
location /api/products {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$request_uri";
    add_header X-Cache-Status $upstream_cache_status;
}
```

### Data Transfer Reduction

```yaml
# Enable compression
server:
  compression:
    enabled: true
    min_size: 1024
    types:
      - application/json
      - text/html
      - text/css
      - application/javascript

# Typical savings: 70-90% bandwidth reduction
```

## Monitoring Costs

### Log Retention Optimization

```yaml
# Reduce log retention
logging:
  retention:
    default: 7d      # Was 30d
    errors: 30d      # Keep errors longer
    audit: 90d       # Compliance requirement

# Sampling for high-volume logs
sampling:
  healthchecks: 0.01  # 1% sampling
  debug: 0.1          # 10% sampling
```

### Metric Cardinality

```yaml
# Reduce metric cardinality
prometheus:
  # Before: High cardinality
  # http_requests_total{method, path, status, user_id}

  # After: Controlled cardinality
  # http_requests_total{method, path_pattern, status_class}

  relabel_configs:
    - source_labels: [__name__, path]
      regex: 'http_requests_total;/api/products/[0-9]+'
      target_label: path_pattern
      replacement: '/api/products/:id'
```

## Cost Monitoring

### AWS Cost Explorer Tags

```yaml
# Tag all resources for cost tracking
tags:
  environment: production
  service: core-api
  team: backend
  cost-center: engineering
```

### Budget Alerts

```yaml
# AWS Budget alert
budget:
  name: shop-platform-monthly
  amount: 2500
  alerts:
    - threshold: 80
      notification:
        - email: ops@shop.ua
        - slack: #alerts
    - threshold: 100
      notification:
        - email: ops@shop.ua
        - slack: #alerts
        - pagerduty: true
```

### Cost Dashboard

```sql
-- Query for cost attribution
SELECT
  date_trunc('day', timestamp) as day,
  service,
  sum(cost) as daily_cost
FROM aws_cost_explorer
WHERE timestamp > now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1, 3 DESC;
```

## Quick Wins

| Optimization | Effort | Savings |
|--------------|--------|---------|
| Right-size pods | Low | 20-40% |
| Spot instances for dev | Low | 60-70% |
| S3 lifecycle policies | Low | 30-50% |
| Reserved instances | Medium | 30-60% |
| Query optimization | Medium | 20-40% |
| CDN caching | Medium | 40-60% |

## Cost Optimization Checklist

### Weekly

- [ ] Review resource utilization
- [ ] Check for idle resources
- [ ] Monitor storage growth

### Monthly

- [ ] Analyze cost trends
- [ ] Review reserved capacity
- [ ] Optimize expensive queries
- [ ] Clean up unused resources

### Quarterly

- [ ] Renegotiate reserved instances
- [ ] Evaluate architecture changes
- [ ] Review vendor pricing
- [ ] Update cost projections

## See Also

- [Capacity Planning](./CAPACITY_PLANNING.md)
- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
- [Kubernetes Deployment](../deployment/KUBERNETES.md)
