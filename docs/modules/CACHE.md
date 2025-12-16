# Cache (Redis)

Система кешування на базі Redis для підвищення продуктивності та зменшення навантаження на БД.

## Overview

Модуль cache забезпечує:
- Кешування продуктів та категорій
- Configurable TTL для різних типів даних
- Pattern-based invalidation
- JSON serialization/deserialization
- Connection health checks

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CACHING LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                    ┌───────────────────────┐  │
│  │   Client     │                    │      Redis            │  │
│  │   Request    │                    │                       │  │
│  └──────┬───────┘                    │  products:all         │  │
│         │                            │  product:123          │  │
│         ▼                            │  categories:all       │  │
│  ┌──────────────┐    Cache Hit      │  category:456         │  │
│  │  Cache Layer │◄──────────────────│  session:abc          │  │
│  │              │                    │                       │  │
│  └──────┬───────┘                    └───────────────────────┘  │
│         │                                                       │
│         │ Cache Miss                                            │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │   Database   │                                              │
│  │  PostgreSQL  │                                              │
│  └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Cache Keys

| Key Pattern | Description | TTL |
|------------|-------------|-----|
| `products:all` | All products list | 2 min |
| `product:{id}` | Single product | 10 min |
| `categories:all` | All categories | 2 min |
| `category:{id}` | Single category | 10 min |
| `search:{hash}` | Search results | 5 min |
| `session:{id}` | User session | 24 hours |

## TTL Configuration

```go
const (
    DefaultTTL    = 5 * time.Minute   // Default for unspecified keys
    ProductTTL    = 10 * time.Minute  // Individual products
    ListTTL       = 2 * time.Minute   // List endpoints
    SessionTTL    = 24 * time.Hour    // User sessions
    SearchTTL     = 5 * time.Minute   // Search results
)
```

## Usage

### Initialize Cache

```go
import "shop/services/core/internal/cache"

func main() {
    redis, err := cache.NewRedisCache("localhost:6379")
    if err != nil {
        log.Fatal(err)
    }
    defer redis.Close()
}
```

### Basic Operations

```go
// Set value with TTL
err := redis.Set(ctx, "product:123", product, cache.ProductTTL)

// Get value
var product Product
err := redis.Get(ctx, "product:123", &product)
if err == redis.Nil {
    // Cache miss - fetch from DB
}

// Delete single key
err := redis.Delete(ctx, "product:123")

// Delete multiple keys
err := redis.Delete(ctx, "product:123", "product:456")

// Check if key exists
exists := redis.Exists(ctx, "product:123")
```

### Pattern-based Deletion

```go
// Delete all products
err := redis.DeletePattern(ctx, "product:*")

// Delete all categories
err := redis.DeletePattern(ctx, "category:*")

// Delete all search results
err := redis.DeletePattern(ctx, "search:*")
```

### Invalidation Helpers

```go
// Invalidate all product caches
err := redis.InvalidateProducts(ctx)
// Deletes: products:all, product:*

// Invalidate all category caches
err := redis.InvalidateCategories(ctx)
// Deletes: categories:all, category:*

// Invalidate specific product
err := redis.InvalidateProduct(ctx, "123")
// Deletes: products:all, product:123

// Invalidate specific category
err := redis.InvalidateCategory(ctx, "456")
// Deletes: categories:all, category:456
```

## Cache-Aside Pattern

```go
func (r *CachedRepository) GetProduct(ctx context.Context, id string) (*Product, error) {
    cacheKey := cache.ProductKeyPrefix + id

    // Try cache first
    var product Product
    err := r.cache.Get(ctx, cacheKey, &product)
    if err == nil {
        metrics.RecordCacheHit("products")
        return &product, nil
    }

    metrics.RecordCacheMiss("products")

    // Fetch from database
    product, err = r.db.GetProduct(ctx, id)
    if err != nil {
        return nil, err
    }

    // Store in cache
    r.cache.Set(ctx, cacheKey, product, cache.ProductTTL)

    return &product, nil
}
```

## Write-Through Pattern

```go
func (r *CachedRepository) UpdateProduct(ctx context.Context, product *Product) error {
    // Update database
    if err := r.db.UpdateProduct(ctx, product); err != nil {
        return err
    }

    // Invalidate cache
    r.cache.InvalidateProduct(ctx, product.ID)

    return nil
}
```

## Configuration

```bash
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Connection pool
REDIS_POOL_SIZE=10
REDIS_MIN_IDLE_CONNS=5
REDIS_MAX_RETRIES=3

# Timeouts
REDIS_DIAL_TIMEOUT=5s
REDIS_READ_TIMEOUT=3s
REDIS_WRITE_TIMEOUT=3s

# Cache TTL (can be overridden per key type)
CACHE_DEFAULT_TTL=5m
CACHE_PRODUCT_TTL=10m
CACHE_LIST_TTL=2m
```

## Health Check

```go
// Ping Redis
err := redis.Ping(ctx)
if err != nil {
    // Redis unavailable
}
```

## Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `cache_hits_total` | Counter | Cache hit count |
| `cache_misses_total` | Counter | Cache miss count |
| `cache_operation_duration_seconds` | Histogram | Operation latency |

### Hit Rate Calculation

```promql
sum(rate(cache_hits_total[5m])) /
(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

## Best Practices

1. **Appropriate TTL** - Balance freshness vs performance
2. **Key naming** - Use consistent prefixes for pattern deletion
3. **Invalidation** - Prefer invalidation over update
4. **Error handling** - Gracefully handle cache unavailability
5. **Monitoring** - Track hit rates and latencies
6. **Size limits** - Be aware of object sizes
7. **Serialization** - Use efficient serialization (JSON, msgpack)

## Troubleshooting

### High Cache Miss Rate
- Check TTL settings
- Verify invalidation logic
- Monitor memory usage

### Slow Cache Operations
- Check network latency to Redis
- Monitor Redis memory usage
- Check for blocking operations

### Memory Issues
- Set `maxmemory` policy
- Monitor key count
- Use appropriate TTLs

## Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

## See Also

- [Architecture - Caching Strategy](../architecture/CACHING_STRATEGY.md)
- [Performance Guide](../guides/PERFORMANCE.md)
- [Metrics](./METRICS.md)
