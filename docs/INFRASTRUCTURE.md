# Infrastructure Documentation

## Overview

This document describes the infrastructure setup for the Shop Platform SaaS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │   CloudFront    │───▶│       ALB       │───▶│        EKS          │  │
│  │   (CDN)         │    │ (Load Balancer) │    │   (Kubernetes)      │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────┘  │
│           │                                             │               │
│           ▼                                             ▼               │
│  ┌─────────────────┐                          ┌─────────────────────┐  │
│  │       S3        │                          │       RDS           │  │
│  │ (Images/Static) │                          │   (PostgreSQL)      │  │
│  └─────────────────┘                          └─────────────────────┘  │
│                                                         │               │
│                                               ┌─────────────────────┐  │
│                                               │    ElastiCache      │  │
│                                               │      (Redis)        │  │
│                                               └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Terraform Modules

### 1. VPC (`infrastructure/terraform/aws/main.tf`)

- **CIDR**: 10.0.0.0/16
- **Public Subnets**: 3 (for ALB, NAT Gateway)
- **Private Subnets**: 3 (for EKS nodes, RDS)
- **NAT Gateway**: Single for staging, High-availability for production

### 2. EKS Cluster

Node Groups:
- **System**: t3.medium (2-4 nodes) - Core Kubernetes components
- **Application**: t3.large (2-10 nodes) - Application workloads
- **Spot**: Mixed instances (0-10 nodes) - Cost-optimized workloads

Features:
- IRSA (IAM Roles for Service Accounts)
- EBS CSI Driver for persistent volumes
- VPC CNI with prefix delegation

### 3. RDS PostgreSQL

- **Engine**: PostgreSQL 15
- **Instance**: db.t3.medium (configurable)
- **Multi-AZ**: Enabled for production
- **Extensions**: pg_stat_statements, pgvector
- **Backup Retention**: 7 days (staging), 30 days (production)
- **Performance Insights**: Enabled

### 4. ElastiCache Redis

- **Engine**: Redis 7.0
- **Node Type**: cache.t3.medium
- **Replication**: 2 nodes for production
- **Encryption**: At-rest and in-transit

### 5. S3 Buckets

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| images | Product images | Standard -> IA (90d) -> Glacier (365d) |
| static | CDN static assets | - |
| backups | Database backups | Glacier (30d), Expire (365d) |
| logs | ALB access logs | Expire (90d) |

### 6. CloudFront CDN

- **Origins**: S3 static, S3 images
- **Price Class**: PriceClass_100
- **SSL**: ACM certificate (us-east-1)
- **Cache TTL**:
  - Static: 3600s default
  - Images: 86400s default

## Disaster Recovery

### Cross-Region Replication

Enabled for production environment:

1. **RDS Read Replica** (eu-west-1)
   - Automatic failover capable
   - 7-day backup retention

2. **S3 Cross-Region Replication**
   - Images bucket -> Images replica
   - Backups bucket -> Backups replica (Glacier)

### AWS Backup

Backup Plan:
- **Daily**: 3 AM UTC, retain 30 days (prod) / 7 days (staging)
- **Weekly**: 4 AM UTC Sunday, cold storage after 30 days, retain 365 days
- **Monthly**: 5 AM UTC 1st, cold storage after 90 days, retain 7 years

### Recovery Time Objectives

| Component | RTO | RPO |
|-----------|-----|-----|
| Database | 15 min | 1 hour |
| Static Assets | 5 min | 0 (replicated) |
| Application | 10 min | N/A |

## Environment Variables

### Production

```bash
AWS_REGION=eu-central-1
ENVIRONMENT=production
DOMAIN=shop.com
```

### Required Terraform Variables

```hcl
variable "environment" {
  type = string
  # Values: development, staging, production
}

variable "domain" {
  type = string
  # Root domain for the platform
}
```

## Deployment

### Initial Setup

```bash
# Initialize Terraform
cd infrastructure/terraform/aws
terraform init

# Plan deployment
terraform plan -var="environment=staging" -var="domain=shop.com"

# Apply
terraform apply -var="environment=staging" -var="domain=shop.com"
```

### Update kubeconfig

```bash
aws eks update-kubeconfig --region eu-central-1 --name shop-platform
```

### Deploy Helm Chart

```bash
cd deploy/helm/shop-platform
helm upgrade --install shop-platform . -f values.yaml
```

## Monitoring

### Prometheus Metrics

All services expose metrics on `/metrics`:
- `core:8080/metrics`
- `oms:8081/metrics`
- `crm:8082/metrics`

### Alerting Rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | >5% errors for 5min | critical |
| TenantQuotaNearLimit | >90% quota usage | warning |
| SubscriptionPastDue | Unpaid for 7 days | warning |
| HighMemoryUsage | >85% for 10min | warning |
| HighLatency | p99 > 2s | critical |

## Security

### Network Security

- All RDS/Redis in private subnets
- Security groups restrict access to EKS nodes only
- VPC endpoints for AWS services

### Secrets Management

- AWS Secrets Manager for database credentials
- IRSA for pod-level IAM roles
- No secrets in environment variables

### Encryption

- RDS: AES-256 at rest
- S3: AES-256 server-side encryption
- Redis: TLS in transit, encryption at rest
- EBS: AES-256 encryption

## Cost Optimization

### Reserved Instances

Recommended for production:
- RDS: 1-year reserved instance
- ElastiCache: 1-year reserved nodes

### Spot Instances

- Used for non-critical workloads
- Node taints prevent critical pods scheduling
- Cluster Autoscaler manages spot fleet

### S3 Lifecycle Policies

- Automatic transition to cheaper storage classes
- Version expiration after 30 days
