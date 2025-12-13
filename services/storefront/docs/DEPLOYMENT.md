# Deployment Guide

Інструкції з розгортання системи в production середовищі.

## Зміст

- [Prerequisites](#prerequisites)
- [Підготовка до deployment](#підготовка-до-deployment)
- [Database Setup](#database-setup)
- [Environment Setup](#environment-setup)
- [Deployment Methods](#deployment-methods)
  - [Docker](#docker)
  - [Kubernetes](#kubernetes)
  - [Traditional Server](#traditional-server)
  - [Vercel/Netlify](#vercel--netlify)
- [Post-deployment](#post-deployment)
- [Health Checks](#health-checks)
- [Rollback Strategy](#rollback-strategy)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Software Requirements

**Node.js:**
- Version: 18.x or 20.x LTS
- npm: 9.x or higher

**Go (для warehouse backend):**
- Version: 1.21 or higher

**Database:**
- PostgreSQL: 15.x or higher
- Redis: 7.x or higher

**Optional:**
- Docker: 24.x
- Docker Compose: 2.x
- Kubernetes: 1.28+

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 20 GB SSD
- Network: 100 Mbps

**Recommended (Production):**
- CPU: 4+ cores
- RAM: 16 GB
- Disk: 100 GB NVMe SSD
- Network: 1 Gbps

---

## Підготовка до deployment

### 1. Clone Repository

```bash
git clone https://github.com/your-org/shop.git
cd shop/services/storefront
```

### 2. Install Dependencies

```bash
# Frontend
npm install --production

# Go Backend
cd ../core
go mod download
```

### 3. Build Application

```bash
# Frontend
npm run build

# Go Backend
go build -o bin/warehouse ./cmd/warehouse

# Verify builds
ls -la .next
ls -la ../core/bin
```

### 4. Run Tests

```bash
# Frontend tests
npm test -- --ci

# Go tests
cd ../core
go test ./...

# E2E tests (optional)
npm run test:e2e
```

---

## Database Setup

### 1. Create Database

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE shop;

-- Create user
CREATE USER shop_user WITH ENCRYPTED PASSWORD 'secure-password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE shop TO shop_user;

-- Connect to shop database
\c shop

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### 2. Run Migrations

**Prisma (для Next.js):**
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma db pull
```

**SQL migrations (для Go):**
```bash
# Using migrate tool
migrate -path migrations -database "postgresql://shop_user:password@localhost:5432/shop?sslmode=disable" up

# Or manually
psql -U shop_user -d shop -f migrations/001_initial_schema.sql
```

### 3. Seed Data (Optional)

```bash
# Seed initial data
npm run db:seed

# Or
npx prisma db seed
```

### 4. Database Backup Setup

```bash
# Create backup script
cat > /usr/local/bin/backup-db.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/postgresql
mkdir -p $BACKUP_DIR

pg_dump -U shop_user shop | gzip > $BACKUP_DIR/shop_$TIMESTAMP.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "shop_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-db.sh" | crontab -
```

---

## Environment Setup

### 1. Create Production .env

```bash
# Copy example
cp .env.example .env.production

# Edit with production values
nano .env.production
```

**Critical variables:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://shop_user:password@db-host:5432/shop?sslmode=require
REDIS_URL=redis://:password@redis-host:6379
NEXTAUTH_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

# External services
CHECKBOX_LICENSE_KEY=prod-key
LIQPAY_PUBLIC_KEY=prod-key
LIQPAY_PRIVATE_KEY=prod-key
```

### 2. Validate Configuration

```bash
# Run validation script
npm run validate-env

# Check all required vars
node scripts/check-env.js
```

---

## Deployment Methods

## Docker

### 1. Build Images

**Frontend:**
```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

**Build:**
```bash
docker build -t shop-frontend:latest .
```

**Go Backend:**
```dockerfile
# Dockerfile.go
FROM golang:1.21-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o warehouse ./cmd/warehouse

FROM alpine:latest
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /build/warehouse .

EXPOSE 8080

CMD ["./warehouse"]
```

**Build:**
```bash
cd ../core
docker build -f Dockerfile.go -t shop-warehouse:latest .
```

### 2. Docker Compose

```yaml
# docker-compose.yml
version: '3.9'

services:
  # Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: shop
      POSTGRES_USER: shop_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Frontend
  frontend:
    image: shop-frontend:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Warehouse Backend
  warehouse:
    image: shop-warehouse:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    ports:
      - "8080:8080"
    restart: unless-stopped

  # Nginx
  nginx:
    image: nginx:alpine
    depends_on:
      - frontend
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Deploy with Docker Compose

```bash
# Create .env.production file
nano .env.production

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

---

## Kubernetes

### 1. Create Namespace

```bash
kubectl create namespace shop
kubectl config set-context --current --namespace=shop
```

### 2. Create Secrets

```bash
# Database credentials
kubectl create secret generic db-credentials \
  --from-literal=username=shop_user \
  --from-literal=password=secure-password \
  --from-literal=database=shop

# App secrets
kubectl create secret generic app-secrets \
  --from-literal=nextauth-secret=$(openssl rand -base64 32) \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --from-file=.env.production
```

### 3. Deploy Database

```yaml
# postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: database
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### 4. Deploy Frontend

```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: shop-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: database-url
        envFrom:
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 5. Deploy

```bash
# Apply configurations
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f warehouse-deployment.yaml

# Check status
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/frontend
```

### 6. Ingress (Optional)

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - techshop.ua
    - www.techshop.ua
    secretName: techshop-tls
  rules:
  - host: techshop.ua
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

---

## Traditional Server

### 1. Install PM2

```bash
npm install -g pm2
```

### 2. PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'shop-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/shop',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '.env.production',
      error_file: '/var/log/pm2/shop-error.log',
      out_file: '/var/log/pm2/shop-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_memory_restart: '1G',
    },
    {
      name: 'shop-warehouse',
      script: './bin/warehouse',
      cwd: '/var/www/shop/core',
      instances: 2,
      exec_mode: 'cluster',
      env_file: '.env.production',
    }
  ],
};
```

### 3. Deploy Script

```bash
# deploy.sh
#!/bin/bash
set -e

echo "Starting deployment..."

# Variables
APP_DIR=/var/www/shop
REPO_URL=https://github.com/your-org/shop.git
BRANCH=main

# Pull latest code
cd $APP_DIR
git fetch origin
git reset --hard origin/$BRANCH

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Run migrations
npx prisma migrate deploy

# Restart PM2
pm2 reload ecosystem.config.js

# Check status
pm2 status

echo "Deployment completed successfully!"
```

### 4. Setup Nginx

```nginx
# /etc/nginx/sites-available/shop
upstream frontend {
    least_conn;
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    listen [::]:80;
    server_name techshop.ua www.techshop.ua;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name techshop.ua www.techshop.ua;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/techshop.ua/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/techshop.ua/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;

    # Static files
    location /_next/static/ {
        alias /var/www/shop/.next/static/;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    location /static/ {
        alias /var/www/shop/public/;
        expires 7d;
        access_log off;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Default
    location / {
        limit_req zone=general burst=100 nodelay;
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Error pages
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

### 5. SSL Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d techshop.ua -d www.techshop.ua

# Auto-renewal
sudo certbot renew --dry-run

# Add to crontab
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### 6. Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh

# Check status
pm2 status
pm2 logs
sudo nginx -t
sudo systemctl reload nginx
```

---

## Vercel / Netlify

### Vercel

**1. Install Vercel CLI:**
```bash
npm install -g vercel
```

**2. Configure vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "REDIS_URL": "@redis-url",
    "NEXTAUTH_SECRET": "@nextauth-secret"
  }
}
```

**3. Deploy:**
```bash
# Login
vercel login

# Link project
vercel link

# Add secrets
vercel secrets add database-url "postgresql://..."
vercel secrets add nextauth-secret "..."

# Deploy
vercel --prod
```

### Netlify

**netlify.toml:**
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

---

## Post-deployment

### 1. Verify Deployment

```bash
# Check health endpoint
curl https://techshop.ua/api/health

# Expected response
{
  "status": "ok",
  "timestamp": "2025-12-14T10:00:00Z",
  "version": "1.0.0"
}
```

### 2. Run Smoke Tests

```bash
# Test critical paths
curl -X POST https://techshop.ua/api/auth/signin
curl https://techshop.ua/api/products?limit=10
curl https://techshop.ua/api/categories

# Test payments (sandbox)
curl -X POST https://techshop.ua/api/payments/liqpay/create
```

### 3. Monitor Logs

```bash
# PM2
pm2 logs --lines 100

# Docker
docker-compose logs -f --tail=100

# Kubernetes
kubectl logs -f deployment/frontend --tail=100
```

### 4. Setup Monitoring

**Uptime monitoring:**
```bash
# Add to uptimerobot.com or similar
https://techshop.ua/api/health
https://techshop.ua
```

**Application monitoring:**
- Sentry for errors
- Datadog for APM
- Prometheus for metrics

---

## Health Checks

### Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: await checkStorage(),
    },
  };

  const allChecksOk = Object.values(health.checks).every((c) => c === 'ok');

  return NextResponse.json(health, {
    status: allChecksOk ? 200 : 503,
  });
}

async function checkDatabase() {
  try {
    // Simple query
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkRedis() {
  try {
    await redis.ping();
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkStorage() {
  try {
    // Check S3 connection
    return 'ok';
  } catch {
    return 'error';
  }
}
```

---

## Rollback Strategy

### Docker

```bash
# List images
docker images shop-frontend

# Rollback to previous version
docker-compose down
docker tag shop-frontend:latest shop-frontend:backup
docker tag shop-frontend:v1.0.0 shop-frontend:latest
docker-compose up -d
```

### Kubernetes

```bash
# View rollout history
kubectl rollout history deployment/frontend

# Rollback to previous version
kubectl rollout undo deployment/frontend

# Rollback to specific revision
kubectl rollout undo deployment/frontend --to-revision=2

# Check status
kubectl rollout status deployment/frontend
```

### PM2

```bash
# Keep previous build
mv .next .next.backup
git checkout previous-tag
npm run build
pm2 reload ecosystem.config.js

# If issues, rollback
rm -rf .next
mv .next.backup .next
pm2 reload ecosystem.config.js
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql -h db-host -U shop_user -d shop

# Check firewall
telnet db-host 5432

# Check SSL
openssl s_client -connect db-host:5432 -starttls postgres
```

### Redis Connection Issues

```bash
# Test connection
redis-cli -h redis-host -p 6379 -a password ping

# Check cluster status
redis-cli cluster info
```

### Application Not Starting

```bash
# Check logs
pm2 logs shop-frontend --lines 100

# Check environment
pm2 env 0

# Restart
pm2 restart shop-frontend
```

### High Memory Usage

```bash
# Check memory
pm2 monit

# Adjust limits in ecosystem.config.js
max_memory_restart: '1G'

# Restart
pm2 reload ecosystem.config.js
```

### SSL Certificate Issues

```bash
# Check certificate
openssl x509 -in /etc/letsencrypt/live/techshop.ua/fullchain.pem -text -noout

# Renew
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

---

## Maintenance Mode

### Enable Maintenance

```nginx
# /etc/nginx/sites-available/shop
server {
    # ... SSL config ...

    location / {
        return 503;
    }

    error_page 503 @maintenance;
    location @maintenance {
        root /var/www/maintenance;
        rewrite ^(.*)$ /maintenance.html break;
    }
}
```

### Maintenance Page

```html
<!-- /var/www/maintenance/maintenance.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Технічне обслуговування</title>
    <meta charset="utf-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
        }
    </style>
</head>
<body>
    <h1>🔧 Технічне обслуговування</h1>
    <p>Ми проводимо планове оновлення системи.</p>
    <p>Сайт буде доступний через кілька хвилин.</p>
    <p>Дякуємо за розуміння!</p>
</body>
</html>
```

---

Створено: 2025-12-14
Версія: 1.0
