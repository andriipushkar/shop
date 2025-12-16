# Installation Guide

Повний посібник з встановлення та налаштування Shop Platform.

## Системні вимоги

### Мінімальні вимоги

| Компонент | Development | Production |
|-----------|-------------|------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 16+ GB |
| Disk | 20 GB SSD | 100+ GB SSD |
| OS | Linux/macOS/Windows | Linux (Ubuntu 22.04+) |

### Необхідне ПЗ

```bash
# Go 1.24+
go version
# go version go1.24.0 linux/amd64

# Node.js 20+
node --version
# v20.10.0

# Docker 24+
docker --version
# Docker version 24.0.7

# Docker Compose 2.20+
docker compose version
# Docker Compose version v2.23.0

# PostgreSQL 15+ (або через Docker)
psql --version
# psql (PostgreSQL) 15.4

# Redis 7+ (або через Docker)
redis-server --version
# Redis server v=7.2.3
```

## Quick Start (Development)

### 1. Клонування репозиторію

```bash
git clone https://github.com/your-org/shop-platform.git
cd shop-platform
```

### 2. Налаштування середовища

```bash
# Копіювання конфігурації
cp .env.example .env

# Редагування .env
nano .env
```

Мінімальна конфігурація `.env`:

```env
# Database
DATABASE_URL=postgres://shop:shop123@localhost:5432/shop?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=8080
ENV=development

# Auth
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Storage (local for dev)
STORAGE_DRIVER=local
STORAGE_PATH=./uploads
```

### 3. Запуск інфраструктури

```bash
# Запуск PostgreSQL та Redis через Docker
docker compose up -d postgres redis

# Перевірка статусу
docker compose ps
```

`docker-compose.yml` для розробки:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: shop123
      POSTGRES_DB: shop
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: shop
      RABBITMQ_DEFAULT_PASS: shop123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
  rabbitmq_data:
```

### 4. Міграції бази даних

```bash
# Встановлення migrate tool
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Запуск міграцій
make migrate-up

# Або вручну
migrate -path ./migrations -database "$DATABASE_URL" up
```

### 5. Запуск backend

```bash
# Встановлення залежностей
go mod download

# Запуск сервера
go run cmd/server/main.go

# Або через Make
make run

# Або з hot reload (Air)
go install github.com/cosmtrek/air@latest
air
```

### 6. Запуск frontend

```bash
cd frontend

# Встановлення залежностей
npm install

# Запуск dev server
npm run dev
```

### 7. Перевірка

```bash
# Backend health check
curl http://localhost:8080/health
# {"status":"healthy","version":"1.0.0"}

# Frontend
open http://localhost:3000
```

## Production Installation

### 1. Підготовка сервера

```bash
# Оновлення системи
sudo apt update && sudo apt upgrade -y

# Встановлення Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Встановлення Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Налаштування SSL

```bash
# Встановлення Certbot
sudo apt install certbot

# Отримання сертифікату
sudo certbot certonly --standalone -d shop.example.com

# Сертифікати будуть у:
# /etc/letsencrypt/live/shop.example.com/fullchain.pem
# /etc/letsencrypt/live/shop.example.com/privkey.pem
```

### 3. Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_letsencrypt:/letsencrypt
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.example.com`)"
      - "traefik.http.routers.dashboard.service=api@internal"

  api:
    image: shop-platform/api:latest
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ENV=production
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.shop.example.com`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  frontend:
    image: shop-platform/frontend:latest
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=https://api.shop.example.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`shop.example.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ES_PASSWORD}
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    deploy:
      resources:
        limits:
          memory: 4G

volumes:
  traefik_letsencrypt:
  postgres_data:
  redis_data:
  elasticsearch_data:
```

### 4. Запуск production

```bash
# Створення .env.prod
cp .env.example .env.prod
nano .env.prod

# Запуск
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Перевірка логів
docker compose -f docker-compose.prod.yml logs -f api
```

## Kubernetes Installation

### 1. Helm Charts

```bash
# Додавання репозиторію
helm repo add shop-platform https://charts.shop-platform.com
helm repo update

# Встановлення
helm install shop shop-platform/shop-platform \
  --namespace shop \
  --create-namespace \
  --values values.yaml
```

### 2. values.yaml

```yaml
# values.yaml
global:
  environment: production
  domain: shop.example.com

api:
  replicaCount: 3
  image:
    repository: shop-platform/api
    tag: "1.0.0"
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilization: 70

frontend:
  replicaCount: 2
  image:
    repository: shop-platform/frontend
    tag: "1.0.0"

postgresql:
  enabled: true
  auth:
    username: shop
    password: ${DB_PASSWORD}
    database: shop
  primary:
    persistence:
      size: 100Gi
  readReplicas:
    replicaCount: 2

redis:
  enabled: true
  auth:
    password: ${REDIS_PASSWORD}
  master:
    persistence:
      size: 10Gi

elasticsearch:
  enabled: true
  replicas: 3
  volumeClaimTemplate:
    resources:
      requests:
        storage: 50Gi

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: shop.example.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
    - host: api.shop.example.com
      paths:
        - path: /
          pathType: Prefix
          service: api
  tls:
    - secretName: shop-tls
      hosts:
        - shop.example.com
        - api.shop.example.com
```

## Конфігурація сервісів

### PostgreSQL оптимізація

```sql
-- postgresql.conf recommendations for production
-- /etc/postgresql/15/main/postgresql.conf

max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 20MB
min_wal_size = 2GB
max_wal_size = 8GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
```

### Redis конфігурація

```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

### Elasticsearch оптимізація

```yaml
# elasticsearch.yml
cluster.name: shop-platform
node.name: es-node-1
network.host: 0.0.0.0
discovery.type: single-node
xpack.security.enabled: true

# JVM options
-Xms4g
-Xmx4g
```

## Troubleshooting

### Помилки підключення до БД

```bash
# Перевірка з'єднання
psql $DATABASE_URL -c "SELECT 1"

# Перевірка міграцій
migrate -path ./migrations -database "$DATABASE_URL" version

# Відкат останньої міграції
migrate -path ./migrations -database "$DATABASE_URL" down 1
```

### Redis проблеми

```bash
# Перевірка підключення
redis-cli -u $REDIS_URL ping

# Очистка кешу
redis-cli -u $REDIS_URL FLUSHDB
```

### Docker проблеми

```bash
# Очистка системи
docker system prune -a

# Перезапуск контейнерів
docker compose down && docker compose up -d

# Перегляд логів
docker compose logs -f --tail=100 api
```

### Логи та моніторинг

```bash
# Перегляд логів API
tail -f /var/log/shop-platform/api.log

# Перевірка health endpoints
curl -s http://localhost:8080/health | jq
curl -s http://localhost:8080/ready | jq

# Metrics endpoint
curl -s http://localhost:8080/metrics
```

## Наступні кроки

Після встановлення:

1. [Налаштування tenant](./TENANT_SETUP.md)
2. [Конфігурація платежів](./PAYMENT_SETUP.md)
3. [Налаштування email](./EMAIL_SETUP.md)
4. [Імпорт товарів](./IMPORT_GUIDE.md)

## Див. також

- [Architecture](../architecture/OVERVIEW.md)
- [Environment Variables](../infrastructure/ENV_VARS.md)
- [Deployment](../operations/DEPLOYMENT.md)
- [Monitoring](../operations/MONITORING.md)
