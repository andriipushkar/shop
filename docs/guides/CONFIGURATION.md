# Configuration Guide

Complete reference for all environment variables and configuration options.

## Environment Files

```bash
# Development
.env                    # Local development settings
.env.local              # Local overrides (gitignored)

# Deployment
.env.staging            # Staging environment
.env.production         # Production environment
```

## Core Configuration

### Application Settings

```bash
# Environment
ENVIRONMENT=development  # development, staging, production
LOG_LEVEL=info           # debug, info, warn, error
PORT=8080                # HTTP server port

# API
API_PREFIX=/api/v1
API_RATE_LIMIT=100       # Requests per minute
API_TIMEOUT=30s          # Request timeout
```

### Database (PostgreSQL)

```bash
# Connection
DATABASE_URL=postgres://user:password@localhost:5432/shop
# OR individual settings:
DB_HOST=localhost
DB_PORT=5432
DB_USER=shop_user
DB_PASSWORD=your_password
DB_NAME=shop
DB_SSL_MODE=disable      # disable, require, verify-ca, verify-full

# Connection pool
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5
DB_CONN_MAX_LIFETIME=5m
```

### Redis

```bash
REDIS_URL=redis://localhost:6379
# OR individual settings:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_TLS_ENABLED=false

# Pool settings
REDIS_POOL_SIZE=10
REDIS_MIN_IDLE_CONNS=5
```

### Elasticsearch

```bash
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password
ELASTICSEARCH_INDEX_PREFIX=shop
ELASTICSEARCH_SHARDS=3
ELASTICSEARCH_REPLICAS=1
```

### RabbitMQ

```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672
# OR individual settings:
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/

# Queue settings
RABBITMQ_PREFETCH=10
RABBITMQ_RETRY_COUNT=3
RABBITMQ_RETRY_DELAY=5s
```

### MinIO / S3 Storage

```bash
# MinIO (local)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=shop-assets

# AWS S3 (production)
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=shop-assets-prod
S3_CDN_URL=https://cdn.yourstore.com
```

## Authentication

### JWT

```bash
JWT_SECRET=your-super-secret-key-at-least-32-chars
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=168h    # 7 days
JWT_ISSUER=shop-platform
```

### OAuth2 Providers

```bash
# Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=https://yourstore.com/auth/google/callback

# Facebook
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_secret
FACEBOOK_REDIRECT_URI=https://yourstore.com/auth/facebook/callback
```

## Payment Providers

### LiqPay

```bash
LIQPAY_PUBLIC_KEY=your_public_key
LIQPAY_PRIVATE_KEY=your_private_key
LIQPAY_SANDBOX=false
LIQPAY_CALLBACK_URL=https://api.yourstore.com/webhooks/liqpay
```

### Monobank

```bash
MONO_TOKEN=your_merchant_token
MONO_WEBHOOK_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
MONO_CALLBACK_URL=https://api.yourstore.com/webhooks/mono
```

### PrivatBank

```bash
PRIVATBANK_MERCHANT_ID=your_merchant_id
PRIVATBANK_PASSWORD=your_password
PRIVATBANK_STORE_ID=your_store_id
```

### Stripe

```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLIC_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Delivery Providers

### Nova Poshta

```bash
NOVAPOSHTA_API_KEY=your_api_key
NOVAPOSHTA_SENDER_REF=your_counterparty_ref
NOVAPOSHTA_SENDER_CITY_REF=city_ref
NOVAPOSHTA_SENDER_ADDRESS_REF=address_ref
NOVAPOSHTA_SENDER_CONTACT_REF=contact_ref
```

### Meest Express

```bash
MEEST_API_KEY=your_api_key
MEEST_SENDER_ID=your_sender_id
```

### Ukrposhta

```bash
UKRPOSHTA_TOKEN=your_bearer_token
UKRPOSHTA_SENDER_ADDRESS_ID=sender_address_id
```

## Marketplace Integrations

### Rozetka

```bash
ROZETKA_API_KEY=your_api_key
ROZETKA_SELLER_ID=your_seller_id
ROZETKA_SYNC_INTERVAL=15m
```

### Prom.ua

```bash
PROM_API_KEY=your_api_key
PROM_FEED_URL=https://yourstore.com/feeds/prom.xml
```

### Google Shopping

```bash
GOOGLE_MERCHANT_ID=your_merchant_id
GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/service-account.json
```

### Facebook Catalog

```bash
FACEBOOK_CATALOG_ID=your_catalog_id
FACEBOOK_ACCESS_TOKEN=your_access_token
FACEBOOK_PIXEL_ID=your_pixel_id
```

## Notifications

### Email (SMTP)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourstore.com
SMTP_PASSWORD=your_password
SMTP_FROM=Your Store <noreply@yourstore.com>
SMTP_TLS=true
```

### SMS

```bash
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Ukrainian providers
TURBOSMS_LOGIN=your_login
TURBOSMS_PASSWORD=your_password
TURBOSMS_SENDER=YourStore
```

### Telegram Bot

```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_ADMIN_IDS=12345678,87654321
TELEGRAM_WEBHOOK_URL=https://api.yourstore.com/telegram/webhook
```

### Push Notifications

```bash
# Firebase Cloud Messaging
FCM_SERVER_KEY=your_server_key
FCM_SENDER_ID=your_sender_id

# Apple Push Notification
APNS_KEY_ID=your_key_id
APNS_TEAM_ID=your_team_id
APNS_KEY_PATH=/path/to/AuthKey.p8
```

## Monitoring

### Prometheus

```bash
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
METRICS_PATH=/metrics
```

### Jaeger (Tracing)

```bash
JAEGER_ENABLED=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces
JAEGER_SAMPLER_TYPE=probabilistic
JAEGER_SAMPLER_PARAM=0.1
```

### Sentry (Error Tracking)

```bash
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Feature Flags

```bash
FEATURE_NEW_CHECKOUT=true
FEATURE_LOYALTY_PROGRAM=true
FEATURE_MARKETPLACE_SYNC=true
FEATURE_AI_RECOMMENDATIONS=false
```

## Frontend (Next.js)

### Public Variables

```bash
# Available in browser (prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_API_URL=https://api.yourstore.com
NEXT_PUBLIC_SITE_URL=https://yourstore.com
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=1234567890
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_xxx
```

### Server Variables

```bash
# Server-side only
DATABASE_URL=postgres://...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_live_xxx
```

## Security

### CORS

```bash
CORS_ALLOWED_ORIGINS=https://yourstore.com,https://admin.yourstore.com
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_MAX_AGE=86400
```

### Rate Limiting

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60s
RATE_LIMIT_BY=ip  # ip, user, api_key
```

### Security Headers

```bash
SECURITY_HEADERS_ENABLED=true
HSTS_MAX_AGE=31536000
CSP_DIRECTIVES="default-src 'self'; img-src 'self' https://cdn.yourstore.com"
```

## Example .env Files

### Development (.env)

```bash
ENVIRONMENT=development
LOG_LEVEL=debug
PORT=8080

DATABASE_URL=postgres://shop:shop@localhost:5433/shop
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
RABBITMQ_URL=amqp://guest:guest@localhost:5672

JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRY=24h

MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

LIQPAY_SANDBOX=true
LIQPAY_PUBLIC_KEY=sandbox_xxx
LIQPAY_PRIVATE_KEY=sandbox_yyy
```

### Production (.env.production)

```bash
ENVIRONMENT=production
LOG_LEVEL=info
PORT=8080

DATABASE_URL=postgres://shop:${DB_PASSWORD}@db.yourstore.com:5432/shop?sslmode=require
REDIS_URL=redis://:${REDIS_PASSWORD}@redis.yourstore.com:6379
ELASTICSEARCH_URL=https://elastic:${ES_PASSWORD}@es.yourstore.com:9200
RABBITMQ_URL=amqps://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@mq.yourstore.com:5671

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=1h

AWS_REGION=eu-central-1
S3_BUCKET=shop-assets-prod

LIQPAY_SANDBOX=false
LIQPAY_PUBLIC_KEY=${LIQPAY_PUBLIC_KEY}
LIQPAY_PRIVATE_KEY=${LIQPAY_PRIVATE_KEY}

SENTRY_DSN=${SENTRY_DSN}
```

## Loading Configuration

### Go Services

```go
import "github.com/kelseyhightower/envconfig"

type Config struct {
    Environment string `envconfig:"ENVIRONMENT" default:"development"`
    Port        int    `envconfig:"PORT" default:"8080"`
    DatabaseURL string `envconfig:"DATABASE_URL" required:"true"`
    RedisURL    string `envconfig:"REDIS_URL" required:"true"`
}

func LoadConfig() (*Config, error) {
    var cfg Config
    if err := envconfig.Process("", &cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}
```

### Next.js

```typescript
// lib/config.ts
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL!,
  stripeKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!,
};

// Validate required vars
const requiredEnvVars = [
  'NEXT_PUBLIC_API_URL',
  'DATABASE_URL',
  'JWT_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required env var: ${envVar}`);
  }
}
```

## Secrets Management

### Production

Use a secrets manager:
- **AWS**: AWS Secrets Manager
- **GCP**: Secret Manager
- **Azure**: Key Vault
- **Kubernetes**: External Secrets Operator

```yaml
# Kubernetes Secret
apiVersion: v1
kind: Secret
metadata:
  name: shop-secrets
type: Opaque
stringData:
  DATABASE_URL: postgres://...
  JWT_SECRET: your-secret
```

### Never Commit Secrets

Add to `.gitignore`:
```
.env
.env.local
.env.*.local
*.pem
*.key
service-account.json
```
