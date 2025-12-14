# Deployment Guide

Complete guide for deploying the Shop Platform to production environments.

## Deployment Options

| Option | Complexity | Scalability | Cost |
|--------|------------|-------------|------|
| Docker Compose | Low | Limited | $ |
| Kubernetes (self-managed) | High | High | $$ |
| AWS EKS | Medium | High | $$$ |
| DigitalOcean K8s | Medium | Medium | $$ |

## Prerequisites

### Minimum Requirements

| Component | Development | Production |
|-----------|-------------|------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Required Services

- PostgreSQL 15+
- Redis 7+
- Elasticsearch 8.x
- RabbitMQ 3.12+
- MinIO or S3
- (Optional) Jaeger, Prometheus, Grafana

## Docker Compose Deployment

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/shop.git
cd shop

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps
```

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: shop
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 2G

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    volumes:
      - es_data:/usr/share/elasticsearch/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  core:
    image: shop-core:latest
    environment:
      - DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/shop
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
    depends_on:
      - postgres
      - redis
      - elasticsearch
      - rabbitmq
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M

  oms:
    image: shop-oms:latest
    environment:
      - DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/shop
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
    depends_on:
      - postgres
      - redis
      - rabbitmq
    deploy:
      replicas: 2

  storefront:
    image: shop-storefront:latest
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourstore.com
    deploy:
      replicas: 2

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - core
      - oms
      - storefront

volumes:
  postgres_data:
  redis_data:
  es_data:
  rabbitmq_data:
```

### Nginx Configuration

```nginx
# nginx.conf
upstream storefront {
    server storefront:3000;
}

upstream api {
    server core:8080;
    server oms:8081;
}

server {
    listen 80;
    server_name yourstore.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourstore.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://storefront;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Kubernetes Deployment

### Helm Chart

```bash
# Add repository
helm repo add shop-platform https://charts.yourstore.com

# Install
helm install shop shop-platform/shop \
  --namespace shop \
  --create-namespace \
  --values values.yaml
```

### Custom Values

```yaml
# values.yaml
global:
  domain: yourstore.com
  environment: production

core:
  replicas: 3
  resources:
    requests:
      memory: 256Mi
      cpu: 100m
    limits:
      memory: 512Mi
      cpu: 500m
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPU: 70

oms:
  replicas: 2

storefront:
  replicas: 3

postgresql:
  enabled: true
  auth:
    postgresPassword: <generate-strong-password>
    database: shop
  primary:
    persistence:
      size: 100Gi

redis:
  enabled: true
  auth:
    password: <generate-strong-password>

elasticsearch:
  enabled: true
  replicas: 3

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: yourstore.com
      paths:
        - path: /
          service: storefront
        - path: /api
          service: core
  tls:
    - secretName: yourstore-tls
      hosts:
        - yourstore.com
```

### Kubernetes Manifests

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: core
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: core
  template:
    metadata:
      labels:
        app: core
    spec:
      containers:
      - name: core
        image: shop-core:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: shop-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

## AWS Deployment

### Infrastructure (Terraform)

```hcl
# main.tf
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"

  name = "shop-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["eu-central-1a", "eu-central-1b", "eu-central-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"

  cluster_name    = "shop-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    main = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 2
      instance_types   = ["t3.large"]
    }
  }
}

module "rds" {
  source  = "terraform-aws-modules/rds/aws"

  identifier = "shop-db"

  engine               = "postgres"
  engine_version       = "15"
  instance_class       = "db.t3.medium"
  allocated_storage    = 100

  db_name  = "shop"
  username = "shop_admin"
  port     = "5432"

  vpc_security_group_ids = [aws_security_group.rds.id]
  subnet_ids             = module.vpc.private_subnets

  multi_az               = true
  backup_retention_period = 7
}
```

### Deploy to EKS

```bash
# Configure kubectl
aws eks update-kubeconfig --region eu-central-1 --name shop-cluster

# Deploy with Helm
helm upgrade --install shop ./helm/shop-platform \
  --namespace shop \
  --create-namespace \
  -f values-production.yaml
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - run: make test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker images
        run: |
          docker build -t shop-core:${{ github.sha }} ./services/core
          docker push ${{ secrets.DOCKER_REGISTRY }}/shop-core:${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          helm upgrade --install shop ./helm/shop-platform \
            --namespace staging \
            --set image.tag=${{ github.sha }}

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          helm upgrade --install shop ./helm/shop-platform \
            --namespace production \
            --set image.tag=${{ github.sha }}
```

## Database Migrations

### Run Migrations

```bash
# Local
go run cmd/migrate/main.go up

# Docker
docker-compose exec core go run cmd/migrate/main.go up

# Kubernetes
kubectl exec -it deploy/core -- go run cmd/migrate/main.go up
```

### Migration Best Practices

1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Use transactions for safety**
4. **Have rollback scripts ready**

## SSL/TLS Configuration

### Let's Encrypt (Certbot)

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d yourstore.com -d www.yourstore.com

# Auto-renewal (cron)
0 0 * * * certbot renew --quiet
```

### cert-manager (Kubernetes)

```yaml
# cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourstore.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## Monitoring Setup

### Prometheus + Grafana

```yaml
# prometheus values
prometheus:
  enabled: true
  serviceMonitor:
    enabled: true

grafana:
  enabled: true
  adminPassword: <generate-password>
  dashboards:
    default:
      shop-overview:
        gnetId: 12345
```

### Alerting

```yaml
# alertmanager config
alertmanager:
  config:
    route:
      receiver: 'slack'
      group_wait: 30s
    receivers:
    - name: 'slack'
      slack_configs:
      - api_url: 'https://hooks.slack.com/xxx'
        channel: '#alerts'
```

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -h $DB_HOST -U $DB_USER shop | gzip > backup_$DATE.sql.gz
aws s3 cp backup_$DATE.sql.gz s3://shop-backups/db/
```

### Retention Policy

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full backup | Daily | 30 days |
| Incremental | Hourly | 7 days |
| Weekly snapshot | Sunday | 12 weeks |
| Monthly archive | 1st | 1 year |

## Security Checklist

- [ ] SSL/TLS enabled
- [ ] Firewall configured
- [ ] Database access restricted
- [ ] Secrets in secret manager
- [ ] Regular security updates
- [ ] WAF configured (CloudFlare/AWS WAF)
- [ ] DDoS protection enabled
- [ ] Audit logging enabled
- [ ] Backup encryption enabled
- [ ] Regular penetration testing

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 502 Bad Gateway | Service down | Check service logs |
| Database connection | Network/credentials | Verify connection string |
| High memory | Memory leak | Restart pods, investigate |
| Slow queries | Missing indexes | Add database indexes |

### Useful Commands

```bash
# Check pod logs
kubectl logs -f deploy/core

# Check pod status
kubectl get pods -n shop

# Describe pod (for errors)
kubectl describe pod <pod-name>

# Connect to database
kubectl exec -it deploy/core -- psql $DATABASE_URL

# Check service endpoints
kubectl get endpoints -n shop
```
