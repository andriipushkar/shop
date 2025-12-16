# Shop Platform - Unicorn Infrastructure Roadmap

Цей документ описує інфраструктуру рівня Unicorn (Uber, Netflix, Rozetka, Amazon).

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SHOP PLATFORM - UNICORN ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                    │
│  │   Cloudflare  │───▶│  Istio Ingress│───▶│   Services    │                    │
│  │   WAF + CDN   │    │   Gateway     │    │   (Mesh)      │                    │
│  └───────────────┘    └───────────────┘    └───────────────┘                    │
│         │                    │                    │                              │
│         ▼                    ▼                    ▼                              │
│  ┌───────────────────────────────────────────────────────────────────┐          │
│  │                      OBSERVABILITY STACK                          │          │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │          │
│  │  │ Jaeger  │  │Prometheus│  │ Grafana │  │ClickHouse│             │          │
│  │  │ Tracing │  │ Metrics │  │Dashboards│  │Analytics │             │          │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘              │          │
│  └───────────────────────────────────────────────────────────────────┘          │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────┐          │
│  │                      MULTI-REGION DEPLOYMENT                      │          │
│  │  ┌─────────────┐                    ┌─────────────┐              │          │
│  │  │   Primary   │◀───── SYNC ───────▶│  Secondary  │              │          │
│  │  │ europe-west1│                    │europe-west4 │              │          │
│  │  │   (Kyiv)    │                    │ (Amsterdam) │              │          │
│  │  └─────────────┘                    └─────────────┘              │          │
│  └───────────────────────────────────────────────────────────────────┘          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Implemented Components

### 1. OpenTelemetry - Distributed Tracing

**Location:** `services/core/internal/tracing/`

```go
// Приклад використання
ctx, span := tracer.Start(ctx, "CreateOrder")
defer span.End()

// Database span
ctx, dbSpan := tracer.DBSpan(ctx, "INSERT", "orders")
defer dbSpan.End()

// External service span
ctx, extSpan := tracer.ExternalSpan(ctx, "liqpay", "charge")
defer extSpan.End()
```

**Features:**
- Automatic trace propagation (W3C Trace Context)
- HTTP middleware for request tracing
- Database query tracing
- Cache operation tracing
- External service call tracing
- OpenTelemetry metrics export

### 2. ClickHouse - OLAP Analytics

**Location:** `services/core/internal/clickhouse/`, `services/analytics-etl/`

**Tables:**
- `orders_analytics` - Denormalized orders
- `order_items_analytics` - Order line items
- `events` - User events (page views, clicks)
- `product_views` - Product view analytics
- `sales_daily` - Daily aggregations
- `product_performance` - Product metrics
- `customer_cohorts` - Cohort analysis

**ETL Process:**
- PostgreSQL → ClickHouse sync every 5 minutes
- Batch processing with configurable size
- Incremental updates based on `updated_at`

### 3. Service Mesh - Istio

**Location:** `infrastructure/kubernetes/istio/`

**Features:**
- mTLS between all services
- Traffic management (canary, A/B)
- Rate limiting (per-IP, per-user)
- Circuit breakers
- Authorization policies (Zero Trust)
- JWT validation
- Retry policies with exponential backoff

**Key Files:**
- `istio-values.yaml` - Istio installation
- `virtual-services.yaml` - Traffic routing
- `destination-rules.yaml` - Load balancing
- `authorization-policies.yaml` - Access control
- `rate-limiting.yaml` - Rate limits
- `circuit-breaker.yaml` - Resilience

### 4. Chaos Engineering - Chaos Mesh

**Location:** `infrastructure/kubernetes/chaos-mesh/`

**Experiments:**
- Pod Chaos (kill, failure)
- Network Chaos (delay, loss, partition)
- Stress Chaos (CPU, memory)
- IO Chaos (latency, errors)
- HTTP Chaos (delay, abort, replace)

**Workflows:**
- Weekly resilience tests
- Scheduled pod kills every 4 hours
- Comprehensive multi-phase tests

### 5. Multi-Region Deployment

**Location:** `infrastructure/terraform/`

**Regions:**
- Primary: `europe-west1` (Belgium, closest to Ukraine)
- Secondary: `europe-west4` (Netherlands)

**Components:**
- GKE clusters in both regions
- Cloud SQL with cross-region replica
- Memorystore Redis with HA
- Global Load Balancer
- Automated failover

### 6. DevSecOps

**Location:** `infrastructure/security/`, `.github/workflows/`

**Security Scanning:**
- SAST: Semgrep, CodeQL, Gosec
- Secrets: Gitleaks, TruffleHog
- Dependencies: govulncheck, npm audit, Trivy
- Containers: Trivy, Grype
- IaC: tfsec, Checkov
- Kubernetes: Kubesec, Polaris, Kube-linter

**Secrets Management:**
- HashiCorp Vault with Kubernetes auth
- Dynamic database credentials
- Auto-rotation of secrets
- Transit encryption

**WAF:**
- Cloudflare rules for OWASP top 10
- Rate limiting for auth endpoints
- Geographic restrictions
- Bot protection

### 7. Backstage - Internal Developer Platform

**Location:** `infrastructure/backstage/`

**Features:**
- Service catalog
- API documentation
- TechDocs
- Kubernetes integration
- Cost insights
- Service dependencies visualization

**Catalog:**
- Domains: e-commerce, fulfillment, customer-engagement
- Systems: shop-platform, order-management, customer-management
- Components: All services with metadata
- APIs: OpenAPI specs
- Resources: Databases, caches, message brokers

### 8. Ephemeral Environments

**Location:** `.github/workflows/preview-environments.yaml`

**Features:**
- Preview per PR
- Isolated namespace
- Auto-provisioning of databases
- Auto-cleanup on PR close
- PR comments with preview URLs
- Smoke tests

## Usage Examples

### Deploy Preview Environment

```bash
# Створюється автоматично при відкритті PR
# URL: pr-123.preview.shop.example.com
```

### Run Chaos Experiment

```bash
kubectl apply -f infrastructure/kubernetes/chaos-mesh/experiments/network-chaos.yaml
```

### Query Analytics

```sql
-- Top products by revenue (last 30 days)
SELECT
    product_id,
    product_name,
    sum(revenue) as total_revenue,
    sum(quantity_sold) as units_sold
FROM order_items_analytics
WHERE tenant_id = 'default'
  AND created_at >= now() - INTERVAL 30 DAY
GROUP BY product_id, product_name
ORDER BY total_revenue DESC
LIMIT 10;
```

### Check Service Health

```bash
# Via Istio
istioctl proxy-status

# Via Backstage
# https://backstage.shop.example.com/catalog/default/component/core-service
```

## Monitoring Dashboards

| Dashboard | URL | Description |
|-----------|-----|-------------|
| Grafana | grafana.shop.example.com | Metrics & alerting |
| Jaeger | jaeger.shop.example.com | Distributed traces |
| Kiali | kiali.shop.example.com | Service mesh |
| Backstage | backstage.shop.example.com | Developer portal |

## Alerting

Alerts configured in Prometheus/Alertmanager:

- `CriticalVulnerabilityDetected` - Security
- `HighErrorRate` - >5% 5xx errors
- `HighLatency` - p99 > 500ms
- `PodCrashLooping` - Container restarts
- `DatabaseConnectionExhausted` - Connection pool
- `CertificateExpiry` - <7 days to expiry

## Cost Optimization

- Spot/Preemptible instances for non-critical workloads
- Autoscaling based on CPU/memory
- ClickHouse TTL for old data
- Preview environment auto-cleanup
- Resource quotas per namespace

## Next Steps (Future Roadmap)

1. **Event Sourcing** - For orders and inventory
2. **Data Lake** - BigQuery/S3 integration
3. **Native Mobile App** - React Native
4. **Headless CMS** - For content management
5. **Vector Search** - Product recommendations
6. **Edge Computing** - Cloudflare Workers
