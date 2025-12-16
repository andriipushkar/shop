# Rate Limits

Обмеження кількості API запитів.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RATE LIMITING                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request ──▶ Rate Limiter ──▶ API Handler                                   │
│                  │                                                           │
│                  │ Check limits by:                                         │
│                  ├── IP Address                                             │
│                  ├── API Key                                                │
│                  ├── User ID                                                │
│                  └── Tenant ID                                              │
│                  │                                                           │
│                  ▼                                                           │
│              ┌───────────┐                                                  │
│              │ Redis     │                                                  │
│              │ (counters)│                                                  │
│              └───────────┘                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Rate Limit Tiers

### Public API (No Authentication)

| Endpoint | Limit | Window |
|----------|-------|--------|
| All endpoints | 60 | 1 minute |
| Search | 30 | 1 minute |
| Auth endpoints | 10 | 1 minute |

### Authenticated Users

| Endpoint | Limit | Window |
|----------|-------|--------|
| All endpoints | 300 | 1 minute |
| Search | 100 | 1 minute |
| Checkout | 10 | 1 minute |
| File upload | 20 | 1 hour |

### API Keys (Integration)

| Tier | Limit | Window | Price |
|------|-------|--------|-------|
| Free | 1,000 | 1 hour | $0 |
| Basic | 10,000 | 1 hour | $49/mo |
| Professional | 100,000 | 1 hour | $199/mo |
| Enterprise | Custom | - | Custom |

### Admin Panel

| Endpoint | Limit | Window |
|----------|-------|--------|
| All endpoints | 600 | 1 minute |
| Bulk operations | 10 | 1 minute |
| Export | 5 | 1 hour |

## Response Headers

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1699999999
X-RateLimit-Used: 13
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests in window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |
| `X-RateLimit-Used` | Requests used in current window |

## Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
Content-Type: application/json

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 45 seconds.",
    "details": {
      "limit": 300,
      "window": "1 minute",
      "retry_after": 45
    },
    "request_id": "req_abc123"
  }
}
```

## Implementation

### Go Middleware

```go
// internal/middleware/ratelimit.go
package middleware

import (
    "context"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "github.com/go-redis/redis/v8"
)

type RateLimiter struct {
    redis   *redis.Client
    limit   int
    window  time.Duration
}

func NewRateLimiter(redis *redis.Client, limit int, window time.Duration) *RateLimiter {
    return &RateLimiter{
        redis:  redis,
        limit:  limit,
        window: window,
    }
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()
        key := rl.getKey(r)

        // Increment counter
        count, err := rl.redis.Incr(ctx, key).Result()
        if err != nil {
            http.Error(w, "Internal error", http.StatusInternalServerError)
            return
        }

        // Set expiry on first request
        if count == 1 {
            rl.redis.Expire(ctx, key, rl.window)
        }

        // Get TTL for reset header
        ttl, _ := rl.redis.TTL(ctx, key).Result()
        resetTime := time.Now().Add(ttl).Unix()

        // Set headers
        w.Header().Set("X-RateLimit-Limit", strconv.Itoa(rl.limit))
        w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(max(0, rl.limit-int(count))))
        w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime, 10))
        w.Header().Set("X-RateLimit-Used", strconv.FormatInt(count, 10))

        // Check if limit exceeded
        if int(count) > rl.limit {
            w.Header().Set("Retry-After", strconv.FormatInt(int64(ttl.Seconds()), 10))
            w.WriteHeader(http.StatusTooManyRequests)
            json.NewEncoder(w).Encode(map[string]interface{}{
                "error": map[string]interface{}{
                    "code":    "RATE_LIMIT_EXCEEDED",
                    "message": fmt.Sprintf("Rate limit exceeded. Try again in %d seconds.", int(ttl.Seconds())),
                    "details": map[string]interface{}{
                        "limit":       rl.limit,
                        "window":      rl.window.String(),
                        "retry_after": int(ttl.Seconds()),
                    },
                },
            })
            return
        }

        next.ServeHTTP(w, r)
    })
}

func (rl *RateLimiter) getKey(r *http.Request) string {
    // Priority: API Key > User ID > IP
    if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
        return fmt.Sprintf("ratelimit:apikey:%s", apiKey)
    }

    if userID := getUserID(r.Context()); userID != "" {
        return fmt.Sprintf("ratelimit:user:%s", userID)
    }

    ip := getClientIP(r)
    return fmt.Sprintf("ratelimit:ip:%s", ip)
}
```

### Endpoint-Specific Limits

```go
// Different limits for different endpoints
func SetupRoutes(r chi.Router, redis *redis.Client) {
    // Public routes - lower limits
    r.Group(func(r chi.Router) {
        r.Use(NewRateLimiter(redis, 60, time.Minute).Middleware)
        r.Get("/products", listProducts)
        r.Get("/categories", listCategories)
    })

    // Auth routes - very strict limits
    r.Group(func(r chi.Router) {
        r.Use(NewRateLimiter(redis, 10, time.Minute).Middleware)
        r.Post("/auth/login", login)
        r.Post("/auth/register", register)
        r.Post("/auth/forgot-password", forgotPassword)
    })

    // Authenticated routes - higher limits
    r.Group(func(r chi.Router) {
        r.Use(authMiddleware)
        r.Use(NewRateLimiter(redis, 300, time.Minute).Middleware)
        r.Get("/orders", listOrders)
        r.Post("/orders", createOrder)
    })

    // Checkout - special handling
    r.Group(func(r chi.Router) {
        r.Use(authMiddleware)
        r.Use(NewRateLimiter(redis, 10, time.Minute).Middleware)
        r.Post("/checkout", checkout)
    })
}
```

## Client Handling

### TypeScript Client

```typescript
// lib/api-client.ts
class APIClient {
  private retryQueue: Map<string, Promise<Response>> = new Map();

  async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');

      // Check if we already have a retry queued for this endpoint
      const existingRetry = this.retryQueue.get(url);
      if (existingRetry) {
        return existingRetry.then(() => this.request<T>(url, options));
      }

      // Queue retry
      const retryPromise = new Promise<Response>((resolve) => {
        setTimeout(async () => {
          this.retryQueue.delete(url);
          resolve(await fetch(url, options));
        }, retryAfter * 1000);
      });

      this.retryQueue.set(url, retryPromise);

      const retryResponse = await retryPromise;
      return retryResponse.json();
    }

    if (!response.ok) {
      throw new APIError(await response.json());
    }

    return response.json();
  }
}

// With exponential backoff
async function requestWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof APIError && error.code === 'RATE_LIMIT_EXCEEDED') {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Monitoring

### Prometheus Metrics

```go
var (
    rateLimitHits = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "rate_limit_hits_total",
            Help: "Total number of rate limit hits",
        },
        []string{"endpoint", "tier"},
    )

    rateLimitRemaining = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "rate_limit_remaining",
            Help: "Remaining requests in current window",
        },
        []string{"key"},
    )
)
```

### Alerts

```yaml
# prometheus/alerts.yml
groups:
  - name: rate_limiting
    rules:
      - alert: HighRateLimitHits
        expr: |
          sum(rate(rate_limit_hits_total[5m])) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of rate limit hits"
          description: "Many clients are hitting rate limits"

      - alert: RateLimitAbuse
        expr: |
          sum by (key) (rate(rate_limit_hits_total[1m])) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Potential rate limit abuse"
          description: "Single client hitting limits repeatedly"
```

## Best Practices

### For API Consumers

1. **Cache responses** when possible
2. **Implement backoff** for 429 responses
3. **Monitor rate limit headers** proactively
4. **Use webhooks** instead of polling
5. **Batch requests** when available

### For API Providers

1. **Set appropriate limits** per tier
2. **Use sliding windows** for fairness
3. **Provide clear documentation**
4. **Include all headers** in responses
5. **Monitor and alert** on abuse

## See Also

- [Error Codes](./ERROR_CODES.md)
- [API Authentication](../modules/AUTH.md)
- [API Keys](../modules/API_KEYS.md)
