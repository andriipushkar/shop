# Docker Configuration

Детальна конфігурація Docker для локальної розробки та production.

## Огляд

| Компонент | Image | Порт |
|-----------|-------|------|
| Core Service | `shop/core:latest` | 8080 |
| OMS Service | `shop/oms:latest` | 8081 |
| CRM Service | `shop/crm:latest` | 8082 |
| Notification | `shop/notification:latest` | 8083 |
| Admin | `shop/admin:latest` | 3000 |
| Storefront | `shop/storefront:latest` | 3001 |
| PostgreSQL | `postgres:15-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| RabbitMQ | `rabbitmq:3.12-management` | 5672, 15672 |
| Elasticsearch | `elasticsearch:8.11.0` | 9200 |
| MinIO | `minio/minio:latest` | 9000, 9001 |

## Структура файлів

```
docker/
├── docker-compose.yml           # Основний compose файл
├── docker-compose.dev.yml       # Override для development
├── docker-compose.prod.yml      # Override для production
├── docker-compose.test.yml      # Для тестування
├── .env.example                 # Приклад змінних
├── services/
│   ├── core/
│   │   └── Dockerfile
│   ├── oms/
│   │   └── Dockerfile
│   ├── admin/
│   │   └── Dockerfile
│   └── storefront/
│       └── Dockerfile
├── nginx/
│   ├── nginx.conf
│   └── ssl/
└── scripts/
    ├── init-db.sh
    ├── wait-for-it.sh
    └── healthcheck.sh
```

## Docker Compose

### Основний файл (docker-compose.yml)

```yaml
version: '3.8'

services:
  # ============================================
  # DATABASES
  # ============================================
  postgres:
    image: postgres:15-alpine
    container_name: shop-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-shop}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-shop_secret}
      POSTGRES_DB: ${POSTGRES_DB:-shopdb}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/scripts/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-shop} -d ${POSTGRES_DB:-shopdb}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - shop-network

  redis:
    image: redis:7-alpine
    container_name: shop-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - shop-network

  # ============================================
  # MESSAGE BROKER
  # ============================================
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: shop-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-shop}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-shop_secret}
      RABBITMQ_DEFAULT_VHOST: ${RABBITMQ_VHOST:-shop}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - shop-network

  # ============================================
  # SEARCH
  # ============================================
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: shop-elasticsearch
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - cluster.name=shop-cluster
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - shop-network

  # ============================================
  # STORAGE
  # ============================================
  minio:
    image: minio/minio:latest
    container_name: shop-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - shop-network

  # ============================================
  # BACKEND SERVICES
  # ============================================
  core:
    build:
      context: ./services/core
      dockerfile: Dockerfile
    image: shop/core:${VERSION:-latest}
    container_name: shop-core
    restart: unless-stopped
    environment:
      - ENV=development
      - DATABASE_URL=postgres://${POSTGRES_USER:-shop}:${POSTGRES_PASSWORD:-shop_secret}@postgres:5432/${POSTGRES_DB:-shopdb}?sslmode=disable
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://${RABBITMQ_USER:-shop}:${RABBITMQ_PASSWORD:-shop_secret}@rabbitmq:5672/${RABBITMQ_VHOST:-shop}
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD:-minioadmin}
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - shop-network

  oms:
    build:
      context: ./services/oms
      dockerfile: Dockerfile
    image: shop/oms:${VERSION:-latest}
    container_name: shop-oms
    restart: unless-stopped
    environment:
      - ENV=development
      - DATABASE_URL=postgres://${POSTGRES_USER:-shop}:${POSTGRES_PASSWORD:-shop_secret}@postgres:5432/${POSTGRES_DB:-shopdb}?sslmode=disable
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://${RABBITMQ_USER:-shop}:${RABBITMQ_PASSWORD:-shop_secret}@rabbitmq:5672/${RABBITMQ_VHOST:-shop}
      - CORE_SERVICE_URL=http://core:8080
    ports:
      - "8081:8081"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      core:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - shop-network

  crm:
    build:
      context: ./services/crm
      dockerfile: Dockerfile
    image: shop/crm:${VERSION:-latest}
    container_name: shop-crm
    restart: unless-stopped
    environment:
      - ENV=development
      - DATABASE_URL=postgres://${POSTGRES_USER:-shop}:${POSTGRES_PASSWORD:-shop_secret}@postgres:5432/${POSTGRES_DB:-shopdb}?sslmode=disable
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://${RABBITMQ_USER:-shop}:${RABBITMQ_PASSWORD:-shop_secret}@rabbitmq:5672/${RABBITMQ_VHOST:-shop}
    ports:
      - "8082:8082"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8082/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - shop-network

  notification:
    build:
      context: ./services/notification
      dockerfile: Dockerfile
    image: shop/notification:${VERSION:-latest}
    container_name: shop-notification
    restart: unless-stopped
    environment:
      - ENV=development
      - RABBITMQ_URL=amqp://${RABBITMQ_USER:-shop}:${RABBITMQ_PASSWORD:-shop_secret}@rabbitmq:5672/${RABBITMQ_VHOST:-shop}
      - SMTP_HOST=${SMTP_HOST:-mailhog}
      - SMTP_PORT=${SMTP_PORT:-1025}
    ports:
      - "8083:8083"
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - shop-network

  # ============================================
  # FRONTEND
  # ============================================
  admin:
    build:
      context: ./apps/admin
      dockerfile: Dockerfile
    image: shop/admin:${VERSION:-latest}
    container_name: shop-admin
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
      - NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
    ports:
      - "3000:3000"
    depends_on:
      - core
    networks:
      - shop-network

  storefront:
    build:
      context: ./apps/storefront
      dockerfile: Dockerfile
    image: shop/storefront:${VERSION:-latest}
    container_name: shop-storefront
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
    ports:
      - "3001:3000"
    depends_on:
      - core
    networks:
      - shop-network

  # ============================================
  # DEV TOOLS
  # ============================================
  mailhog:
    image: mailhog/mailhog:latest
    container_name: shop-mailhog
    ports:
      - "1025:1025"
      - "8025:8025"
    networks:
      - shop-network

networks:
  shop-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  elasticsearch_data:
  minio_data:
```

### Development Override (docker-compose.dev.yml)

```yaml
version: '3.8'

services:
  core:
    build:
      context: ./services/core
      dockerfile: Dockerfile.dev
    volumes:
      - ./services/core:/app
      - /app/vendor
    environment:
      - ENV=development
      - DEBUG=true
      - LOG_LEVEL=debug
    command: air -c .air.toml

  oms:
    build:
      context: ./services/oms
      dockerfile: Dockerfile.dev
    volumes:
      - ./services/oms:/app
      - /app/vendor
    environment:
      - ENV=development
      - DEBUG=true
    command: air -c .air.toml

  admin:
    build:
      context: ./apps/admin
      dockerfile: Dockerfile.dev
    volumes:
      - ./apps/admin:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
    command: npm run dev

  storefront:
    build:
      context: ./apps/storefront
      dockerfile: Dockerfile.dev
    volumes:
      - ./apps/storefront:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
    command: npm run dev
```

### Production Override (docker-compose.prod.yml)

```yaml
version: '3.8'

services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  redis:
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  elasticsearch:
    environment:
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  core:
    environment:
      - ENV=production
      - DEBUG=false
      - LOG_LEVEL=info
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 512M
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        max_attempts: 3

  oms:
    environment:
      - ENV=production
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M

  nginx:
    image: nginx:alpine
    container_name: shop-nginx
    restart: unless-stopped
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - core
      - oms
      - admin
      - storefront
    networks:
      - shop-network
```

## Dockerfiles

### Go Service Dockerfile

```dockerfile
# services/core/Dockerfile
# Build stage
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.Version=${VERSION:-dev}" \
    -o /app/server ./cmd/server

# Final stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata curl

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/templates ./templates

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["./server"]
```

### Go Service Dockerfile (Development)

```dockerfile
# services/core/Dockerfile.dev
FROM golang:1.24-alpine

RUN apk add --no-cache git

# Install air for hot reload
RUN go install github.com/cosmtrek/air@latest

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8080

CMD ["air", "-c", ".air.toml"]
```

### Next.js Dockerfile

```dockerfile
# apps/admin/Dockerfile
# Dependencies stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Builder stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### Next.js Dockerfile (Development)

```dockerfile
# apps/admin/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

## Nginx Configuration

### nginx.conf

```nginx
# docker/nginx/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/rss+xml application/atom+xml image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

    # Upstreams
    upstream api_servers {
        least_conn;
        server core:8080 weight=5;
        server core:8080 backup;
        keepalive 32;
    }

    upstream oms_servers {
        server oms:8081;
        keepalive 16;
    }

    upstream admin_servers {
        server admin:3000;
    }

    upstream storefront_servers {
        server storefront:3000;
    }

    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # Main HTTPS server
    server {
        listen 443 ssl http2;
        server_name api.yourstore.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API
        location /api/ {
            limit_req zone=api burst=50 nodelay;

            proxy_pass http://api_servers;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";

            proxy_connect_timeout 30s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
        }

        # Auth endpoints (stricter rate limit)
        location /api/v1/auth/ {
            limit_req zone=auth burst=5 nodelay;

            proxy_pass http://api_servers;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /ws {
            proxy_pass http://api_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400;
        }

        # Health check
        location /health {
            proxy_pass http://api_servers;
            access_log off;
        }
    }

    # Admin panel
    server {
        listen 443 ssl http2;
        server_name admin.yourstore.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://admin_servers;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /_next/static {
            proxy_pass http://admin_servers;
            proxy_cache_valid 60m;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
    }

    # Storefront
    server {
        listen 443 ssl http2;
        server_name yourstore.com www.yourstore.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://storefront_servers;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /_next/static {
            proxy_pass http://storefront_servers;
            proxy_cache_valid 60m;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
    }
}
```

## Скрипти

### init-db.sh

```bash
#!/bin/bash
# docker/scripts/init-db.sh
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- Create additional databases for testing
    CREATE DATABASE shopdb_test;
    GRANT ALL PRIVILEGES ON DATABASE shopdb_test TO $POSTGRES_USER;
EOSQL

echo "Database initialization completed"
```

### wait-for-it.sh

```bash
#!/bin/bash
# docker/scripts/wait-for-it.sh
# Wait for a service to be ready

host="$1"
port="$2"
shift 2
cmd="$@"

until nc -z "$host" "$port"; do
  echo "Waiting for $host:$port..."
  sleep 1
done

echo "$host:$port is available"
exec $cmd
```

## Команди

### Запуск

```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# З build
docker compose up -d --build

# Конкретний сервіс
docker compose up -d core
```

### Логи

```bash
# Всі сервіси
docker compose logs -f

# Конкретний сервіс
docker compose logs -f core

# Останні 100 рядків
docker compose logs --tail=100 core
```

### Зупинка

```bash
# Зупинити
docker compose stop

# Зупинити та видалити
docker compose down

# Видалити з volumes
docker compose down -v
```

### Очищення

```bash
# Видалити невикористані images
docker image prune -a

# Видалити все
docker system prune -a --volumes
```

## Multi-stage builds

### Оптимізація розміру image

| Image | Before | After | Savings |
|-------|--------|-------|---------|
| core | 1.2 GB | 25 MB | 98% |
| admin | 800 MB | 150 MB | 81% |

## Troubleshooting

### Container не запускається

```bash
# Перевірка логів
docker compose logs core

# Перевірка статусу
docker compose ps

# Вхід в контейнер
docker compose exec core sh
```

### Проблеми з мережею

```bash
# Перевірка мережі
docker network ls
docker network inspect shop-network

# DNS всередині контейнера
docker compose exec core nslookup postgres
```

### Проблеми з volumes

```bash
# Список volumes
docker volume ls

# Інспекція
docker volume inspect shop-platform_postgres_data

# Видалення
docker volume rm shop-platform_postgres_data
```
