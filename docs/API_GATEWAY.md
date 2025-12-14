# API Gateway Documentation

## Overview

The API Gateway provides rate limiting, API key management, and usage metering for the Shop Platform SaaS.

## Features

- **Rate Limiting**: Tier-based request throttling
- **API Key Management**: Generate, rotate, and revoke API keys
- **Usage Metering**: Track API calls per tenant
- **Middleware**: HTTP middleware for authentication and limiting

## Rate Limits by Tier

| Tier | Requests/Second | Requests/Minute | Burst Size |
|------|-----------------|-----------------|------------|
| Free | 1 | 60 | 5 |
| Starter | 10 | 600 | 20 |
| Professional | 50 | 3,000 | 100 |
| Enterprise | 200 | 12,000 | 500 |

## Endpoint-Specific Limits

Certain endpoints have additional rate limits:

| Endpoint | Requests/Minute | Notes |
|----------|-----------------|-------|
| `/api/v1/search` | 30 | Search operations |
| `/api/v1/export` | 5 | Bulk exports |
| `/api/v1/products` | 120 | Product operations |
| `/api/v1/orders` | 60 | Order operations |

## API Key Format

API keys follow the format: `sk_{random_hex_string}`

Example: `sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## Usage

### Initialize Gateway

```go
import (
    "core/internal/gateway"
    "github.com/redis/go-redis/v9"
)

rdb := redis.NewClient(&redis.Options{
    Addr: "localhost:6379",
})

gw := gateway.NewGateway(repo, rdb)
```

### HTTP Middleware

```go
router := chi.NewRouter()
router.Use(gw.Middleware)
```

### Create API Key

```go
key, err := gw.CreateAPIKey(ctx, "tenant_123", &gateway.CreateAPIKeyRequest{
    Name:   "Production Key",
    Scopes: []string{"read:products", "write:orders"},
})
```

### Check Rate Limit

```go
info, err := gw.CheckRateLimit(ctx, tenantID, endpoint, tier)
if err == gateway.ErrRateLimitExceeded {
    // Return 429 Too Many Requests
}
```

## HTTP Endpoints

### List API Keys

```
GET /api/v1/api-keys
Authorization: Bearer {jwt_token}
```

Response:
```json
{
  "keys": [
    {
      "id": "key_123",
      "name": "Production Key",
      "key": "sk_a1****p6",
      "scopes": ["read:products", "write:orders"],
      "is_active": true,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Create API Key

```
POST /api/v1/api-keys
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "Mobile App Key",
  "scopes": ["read:products"],
  "expires_at": "2025-01-15T10:00:00Z"
}
```

### Delete API Key

```
DELETE /api/v1/api-keys/{key_id}
Authorization: Bearer {jwt_token}
```

### Get Usage Statistics

```
GET /api/v1/usage?start=2024-01-01&end=2024-01-31
Authorization: Bearer {jwt_token}
```

Response:
```json
{
  "total_requests": 150000,
  "by_endpoint": {
    "/api/v1/products": 80000,
    "/api/v1/orders": 50000,
    "/api/v1/search": 20000
  },
  "by_status": {
    "200": 140000,
    "400": 5000,
    "429": 3000,
    "500": 2000
  }
}
```

## Rate Limit Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 55
X-RateLimit-Reset: 1705312800
```

When rate limited:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705312800
```

## Error Responses

| Code | Error | Description |
|------|-------|-------------|
| 401 | `unauthorized` | Missing or invalid API key |
| 403 | `forbidden` | API key lacks required scope |
| 429 | `rate_limit_exceeded` | Too many requests |
| 402 | `quota_exceeded` | Monthly quota exceeded |

## Scopes

| Scope | Description |
|-------|-------------|
| `read:products` | Read product data |
| `write:products` | Create/update products |
| `read:orders` | Read order data |
| `write:orders` | Create/update orders |
| `read:customers` | Read customer data |
| `write:customers` | Create/update customers |
| `read:analytics` | Access analytics data |
| `admin` | Full administrative access |

## Redis Keys

The gateway uses Redis for rate limiting:

```
ratelimit:{tenant_id}:{endpoint}:sec   # Per-second counter
ratelimit:{tenant_id}:{endpoint}:min   # Per-minute counter
apikey:{key_hash}                       # API key cache
```

## Monitoring

Prometheus metrics available at `/metrics`:

- `gateway_requests_total` - Total requests by tenant, endpoint, status
- `gateway_rate_limited_total` - Rate limited requests
- `gateway_latency_seconds` - Request latency histogram
