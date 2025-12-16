# Environment Variables

Документація змінних середовища для Shop Platform.

## Core Service

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DATABASE_HOST` | No | localhost | Database host |
| `DATABASE_PORT` | No | 5432 | Database port |
| `DATABASE_NAME` | Yes | - | Database name |
| `DATABASE_USER` | Yes | - | Database user |
| `DATABASE_PASSWORD` | Yes | - | Database password |
| `DATABASE_SSL_MODE` | No | disable | SSL mode (disable, require, verify-ca, verify-full) |
| `DATABASE_MAX_CONNECTIONS` | No | 100 | Maximum connection pool size |
| `DATABASE_MIN_CONNECTIONS` | No | 10 | Minimum connection pool size |
| `DATABASE_MAX_IDLE_TIME` | No | 30m | Maximum idle connection time |

```bash
# Example
DATABASE_URL=postgres://shop_admin:password@localhost:5432/shop_production?sslmode=require
```

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | - | Redis connection URL (takes precedence) |
| `REDIS_HOST` | No | localhost | Redis host |
| `REDIS_PORT` | No | 6379 | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password |
| `REDIS_DB` | No | 0 | Redis database number |
| `REDIS_TLS_ENABLED` | No | false | Enable TLS connection |
| `REDIS_POOL_SIZE` | No | 10 | Connection pool size |
| `REDIS_READ_HOST` | No | - | Redis replica host for reads |

```bash
# Example
REDIS_URL=rediss://:password@redis-cluster.example.com:6379/0
```

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8080 | HTTP server port |
| `GRPC_PORT` | No | 9090 | gRPC server port |
| `HOST` | No | 0.0.0.0 | Server bind address |
| `ENV` | No | development | Environment (development, staging, production) |
| `DEBUG` | No | false | Enable debug mode |
| `LOG_LEVEL` | No | info | Log level (debug, info, warn, error) |
| `LOG_FORMAT` | No | json | Log format (json, text) |
| `REQUEST_TIMEOUT` | No | 30s | Request timeout duration |
| `SHUTDOWN_TIMEOUT` | No | 30s | Graceful shutdown timeout |

```bash
# Example
PORT=8080
ENV=production
LOG_LEVEL=info
```

### Authentication & Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `JWT_EXPIRY` | No | 24h | JWT token expiry duration |
| `JWT_REFRESH_EXPIRY` | No | 168h | Refresh token expiry (7 days) |
| `BCRYPT_COST` | No | 12 | Bcrypt hashing cost |
| `API_KEY_SALT` | Yes | - | Salt for API key hashing |
| `ENCRYPTION_KEY` | Yes | - | AES-256 encryption key (32 bytes) |
| `CORS_ORIGINS` | No | * | Allowed CORS origins (comma-separated) |
| `CORS_METHODS` | No | GET,POST,PUT,DELETE,OPTIONS | Allowed HTTP methods |
| `RATE_LIMIT_ENABLED` | No | true | Enable rate limiting |
| `RATE_LIMIT_REQUESTS` | No | 100 | Requests per window |
| `RATE_LIMIT_WINDOW` | No | 1m | Rate limit window duration |

```bash
# Example
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRY=24h
CORS_ORIGINS=https://shop.example.com,https://admin.shop.example.com
```

### Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORAGE_PROVIDER` | No | local | Storage provider (local, s3, spaces) |
| `STORAGE_PATH` | No | ./uploads | Local storage path |
| `AWS_ACCESS_KEY_ID` | No | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | No | - | AWS secret key |
| `AWS_REGION` | No | eu-central-1 | AWS region |
| `AWS_S3_BUCKET` | No | - | S3 bucket name |
| `AWS_S3_ENDPOINT` | No | - | S3-compatible endpoint URL |
| `CDN_URL` | No | - | CDN base URL for assets |
| `MAX_UPLOAD_SIZE` | No | 10MB | Maximum upload file size |
| `ALLOWED_FILE_TYPES` | No | jpg,jpeg,png,gif,webp,pdf | Allowed file extensions |

```bash
# AWS S3
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=eu-central-1
AWS_S3_BUCKET=shop-production-storage
CDN_URL=https://cdn.shop.example.com

# DigitalOcean Spaces
STORAGE_PROVIDER=s3
AWS_S3_ENDPOINT=https://fra1.digitaloceanspaces.com
AWS_ACCESS_KEY_ID=your-spaces-access-key
AWS_SECRET_ACCESS_KEY=your-spaces-secret-key
AWS_S3_BUCKET=shop-storage
```

### Elasticsearch

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ELASTICSEARCH_URL` | No | http://localhost:9200 | Elasticsearch URL |
| `ELASTICSEARCH_USERNAME` | No | - | Elasticsearch username |
| `ELASTICSEARCH_PASSWORD` | No | - | Elasticsearch password |
| `ELASTICSEARCH_INDEX_PREFIX` | No | shop | Index name prefix |
| `ELASTICSEARCH_SHARDS` | No | 1 | Number of shards |
| `ELASTICSEARCH_REPLICAS` | No | 0 | Number of replicas |

```bash
# Example
ELASTICSEARCH_URL=https://elasticsearch.example.com:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=secure-password
```

### RabbitMQ

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RABBITMQ_URL` | No | - | RabbitMQ connection URL |
| `RABBITMQ_HOST` | No | localhost | RabbitMQ host |
| `RABBITMQ_PORT` | No | 5672 | RabbitMQ port |
| `RABBITMQ_USER` | No | guest | RabbitMQ username |
| `RABBITMQ_PASSWORD` | No | guest | RabbitMQ password |
| `RABBITMQ_VHOST` | No | / | Virtual host |
| `RABBITMQ_PREFETCH` | No | 10 | Prefetch count |

```bash
# Example
RABBITMQ_URL=amqps://user:password@rabbitmq.example.com:5671/shop
```

### Qdrant (Vector Search)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | No | http://localhost:6333 | Qdrant URL |
| `QDRANT_API_KEY` | No | - | Qdrant API key |
| `QDRANT_COLLECTION` | No | products | Collection name |

```bash
# Example
QDRANT_URL=https://qdrant.example.com:6333
QDRANT_API_KEY=your-qdrant-api-key
```

### External Services

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LIQPAY_PUBLIC_KEY` | No | - | LiqPay public key |
| `LIQPAY_PRIVATE_KEY` | No | - | LiqPay private key |
| `LIQPAY_SANDBOX` | No | false | Use LiqPay sandbox |
| `NOVA_POSHTA_API_KEY` | No | - | Nova Poshta API key |
| `UKRPOSHTA_API_KEY` | No | - | Ukrposhta API key |
| `SMS_PROVIDER` | No | - | SMS provider (turbosms, smsclub) |
| `SMS_API_KEY` | No | - | SMS API key |
| `SMTP_HOST` | No | - | SMTP server host |
| `SMTP_PORT` | No | 587 | SMTP server port |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASSWORD` | No | - | SMTP password |
| `SMTP_FROM` | No | - | Default from email |
| `SMTP_TLS` | No | true | Use TLS |

```bash
# Payment
LIQPAY_PUBLIC_KEY=sandbox_public_key
LIQPAY_PRIVATE_KEY=sandbox_private_key
LIQPAY_SANDBOX=true

# Shipping
NOVA_POSHTA_API_KEY=your-nova-poshta-key

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxx
SMTP_FROM=noreply@shop.example.com
```

### Monitoring & Tracing

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_ENABLED` | No | false | Enable OpenTelemetry |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | - | OTLP exporter endpoint |
| `OTEL_SERVICE_NAME` | No | shop-core | Service name |
| `SENTRY_DSN` | No | - | Sentry DSN for error tracking |
| `SENTRY_ENVIRONMENT` | No | development | Sentry environment |
| `PROMETHEUS_ENABLED` | No | true | Enable Prometheus metrics |
| `PROMETHEUS_PORT` | No | 9091 | Prometheus metrics port |

```bash
# Example
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
SENTRY_DSN=https://xxx@sentry.io/123
```

### Feature Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FEATURE_VISUAL_SEARCH` | No | false | Enable visual search |
| `FEATURE_AI_RECOMMENDATIONS` | No | false | Enable AI recommendations |
| `FEATURE_B2B` | No | false | Enable B2B features |
| `FEATURE_MULTI_CURRENCY` | No | false | Enable multi-currency |
| `FEATURE_MULTI_LANGUAGE` | No | false | Enable multi-language |

```bash
# Example
FEATURE_VISUAL_SEARCH=true
FEATURE_AI_RECOMMENDATIONS=true
```

## Web Service (Next.js)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Public API URL |
| `NEXT_PUBLIC_WS_URL` | No | - | WebSocket URL |
| `NEXT_PUBLIC_CDN_URL` | No | - | CDN URL for assets |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | No | - | Google Analytics ID |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | No | - | Facebook Pixel ID |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | No | - | Stripe publishable key |
| `API_SECRET_KEY` | Yes | - | Internal API secret |
| `NEXTAUTH_URL` | Yes | - | NextAuth.js URL |
| `NEXTAUTH_SECRET` | Yes | - | NextAuth.js secret |
| `REVALIDATE_SECRET` | No | - | ISR revalidation secret |

```bash
# Example
NEXT_PUBLIC_API_URL=https://api.shop.example.com
NEXT_PUBLIC_WS_URL=wss://api.shop.example.com/ws
NEXT_PUBLIC_CDN_URL=https://cdn.shop.example.com
NEXTAUTH_URL=https://shop.example.com
NEXTAUTH_SECRET=your-nextauth-secret
```

## Admin Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Admin API URL |
| `NEXT_PUBLIC_CORE_API_URL` | Yes | - | Core service API URL |
| `ADMIN_API_KEY` | Yes | - | Admin API key |
| `SESSION_SECRET` | Yes | - | Session encryption secret |
| `ALLOWED_ADMIN_EMAILS` | No | - | Allowed admin emails (comma-separated) |

```bash
# Example
NEXT_PUBLIC_API_URL=https://admin-api.shop.example.com
NEXT_PUBLIC_CORE_API_URL=https://api.shop.example.com
ADMIN_API_KEY=admin-secret-key
```

## Docker Compose Example

```yaml
# docker-compose.yml
version: '3.8'

services:
  core:
    image: shop-platform/core:latest
    environment:
      - DATABASE_URL=postgres://shop:password@postgres:5432/shop?sslmode=disable
      - REDIS_URL=redis://redis:6379/0
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - ENV=production
      - LOG_LEVEL=info
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
      - elasticsearch
      - rabbitmq

  web:
    image: shop-platform/web:latest
    environment:
      - NEXT_PUBLIC_API_URL=http://core:8080
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - API_SECRET_KEY=${API_SECRET_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - core

  admin:
    image: shop-platform/admin:latest
    environment:
      - NEXT_PUBLIC_API_URL=http://core:8080
      - ADMIN_API_KEY=${ADMIN_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    ports:
      - "3001:3000"
    depends_on:
      - core

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=shop
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=shop
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    ports:
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
  rabbitmq_data:
```

## Kubernetes ConfigMap & Secrets

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: shop-core-config
data:
  ENV: "production"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  PORT: "8080"
  GRPC_PORT: "9090"
  DATABASE_MAX_CONNECTIONS: "100"
  REDIS_POOL_SIZE: "10"
  ELASTICSEARCH_INDEX_PREFIX: "shop"
  RATE_LIMIT_ENABLED: "true"
  RATE_LIMIT_REQUESTS: "100"
  RATE_LIMIT_WINDOW: "1m"
  PROMETHEUS_ENABLED: "true"
  PROMETHEUS_PORT: "9091"
  OTEL_ENABLED: "true"
  OTEL_SERVICE_NAME: "shop-core"

---
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: shop-core-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgres://user:pass@host:5432/db"
  REDIS_URL: "redis://:pass@host:6379/0"
  JWT_SECRET: "your-jwt-secret"
  ENCRYPTION_KEY: "your-32-byte-encryption-key"
  API_KEY_SALT: "your-api-key-salt"
  LIQPAY_PUBLIC_KEY: "your-liqpay-public"
  LIQPAY_PRIVATE_KEY: "your-liqpay-private"
  SENTRY_DSN: "https://xxx@sentry.io/123"

---
# external-secrets.yaml (using External Secrets Operator)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: shop-core-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: shop-core-secrets
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: shop/production/database
        property: url
    - secretKey: JWT_SECRET
      remoteRef:
        key: shop/production/auth
        property: jwt_secret
```

## Validation

```go
// internal/config/config.go
package config

import (
	"fmt"
	"time"

	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	// Server
	Port            int           `envconfig:"PORT" default:"8080"`
	GRPCPort        int           `envconfig:"GRPC_PORT" default:"9090"`
	Env             string        `envconfig:"ENV" default:"development"`
	Debug           bool          `envconfig:"DEBUG" default:"false"`
	RequestTimeout  time.Duration `envconfig:"REQUEST_TIMEOUT" default:"30s"`
	ShutdownTimeout time.Duration `envconfig:"SHUTDOWN_TIMEOUT" default:"30s"`

	// Database
	DatabaseURL            string        `envconfig:"DATABASE_URL" required:"true"`
	DatabaseMaxConnections int           `envconfig:"DATABASE_MAX_CONNECTIONS" default:"100"`
	DatabaseMinConnections int           `envconfig:"DATABASE_MIN_CONNECTIONS" default:"10"`
	DatabaseMaxIdleTime    time.Duration `envconfig:"DATABASE_MAX_IDLE_TIME" default:"30m"`

	// Redis
	RedisURL      string `envconfig:"REDIS_URL"`
	RedisHost     string `envconfig:"REDIS_HOST" default:"localhost"`
	RedisPort     int    `envconfig:"REDIS_PORT" default:"6379"`
	RedisPassword string `envconfig:"REDIS_PASSWORD"`
	RedisDB       int    `envconfig:"REDIS_DB" default:"0"`
	RedisPoolSize int    `envconfig:"REDIS_POOL_SIZE" default:"10"`

	// Auth
	JWTSecret        string        `envconfig:"JWT_SECRET" required:"true"`
	JWTExpiry        time.Duration `envconfig:"JWT_EXPIRY" default:"24h"`
	JWTRefreshExpiry time.Duration `envconfig:"JWT_REFRESH_EXPIRY" default:"168h"`
	EncryptionKey    string        `envconfig:"ENCRYPTION_KEY" required:"true"`

	// Storage
	StorageProvider string `envconfig:"STORAGE_PROVIDER" default:"local"`
	StoragePath     string `envconfig:"STORAGE_PATH" default:"./uploads"`
	AWSS3Bucket     string `envconfig:"AWS_S3_BUCKET"`
	AWSRegion       string `envconfig:"AWS_REGION" default:"eu-central-1"`
	CDNURL          string `envconfig:"CDN_URL"`

	// External Services
	LiqPayPublicKey  string `envconfig:"LIQPAY_PUBLIC_KEY"`
	LiqPayPrivateKey string `envconfig:"LIQPAY_PRIVATE_KEY"`
	LiqPaySandbox    bool   `envconfig:"LIQPAY_SANDBOX" default:"false"`

	// Monitoring
	SentryDSN      string `envconfig:"SENTRY_DSN"`
	OTELEnabled    bool   `envconfig:"OTEL_ENABLED" default:"false"`
	OTELEndpoint   string `envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT"`

	// Feature Flags
	FeatureVisualSearch      bool `envconfig:"FEATURE_VISUAL_SEARCH" default:"false"`
	FeatureAIRecommendations bool `envconfig:"FEATURE_AI_RECOMMENDATIONS" default:"false"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &cfg, nil
}

func (c *Config) Validate() error {
	if len(c.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	if len(c.EncryptionKey) != 32 {
		return fmt.Errorf("ENCRYPTION_KEY must be exactly 32 bytes")
	}

	if c.StorageProvider == "s3" && c.AWSS3Bucket == "" {
		return fmt.Errorf("AWS_S3_BUCKET is required when using S3 storage")
	}

	return nil
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func (c *Config) IsProduction() bool {
	return c.Env == "production"
}
```

## Див. також

- [Terraform](./TERRAFORM.md)
- [Kubernetes Deployment](./KUBERNETES.md)
- [Database Schema](./DATABASE_SCHEMA.md)
