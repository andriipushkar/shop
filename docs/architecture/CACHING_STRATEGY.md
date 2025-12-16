# Caching Strategy

Стратегія кешування для оптимізації продуктивності.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-LEVEL CACHING                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request Flow:                                                               │
│                                                                              │
│  Client ──▶ CDN ──▶ In-Memory ──▶ Redis ──▶ Database                       │
│           (L1)      (L2)         (L3)       (Origin)                        │
│                                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐                     │
│  │ CDN     │   │ Local   │   │ Redis   │   │ Postgres│                     │
│  │ ~10ms   │   │ ~1ms    │   │ ~5ms    │   │ ~50ms   │                     │
│  │ Edge    │   │ Process │   │ Shared  │   │ Source  │                     │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘                     │
│                                                                              │
│  Cache Hit Rate Goal: > 90%                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cache Layers

### L1: CDN (Cloudflare)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CDN LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Cached:                    Not Cached:                                     │
│  ├── Static assets          ├── Authenticated requests                      │
│  │   ├── Images             ├── Cart/Checkout                              │
│  │   ├── CSS/JS             ├── User-specific data                         │
│  │   └── Fonts              └── POST/PUT/DELETE                            │
│  ├── Product images                                                         │
│  └── Public API responses                                                   │
│                                                                              │
│  TTL: 1 hour - 1 year                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Configuration

```javascript
// Cloudflare Page Rules
{
  "rules": [
    {
      "url": "shop.ua/static/*",
      "settings": {
        "cache_level": "cache_everything",
        "edge_cache_ttl": 2592000, // 30 days
        "browser_cache_ttl": 31536000 // 1 year
      }
    },
    {
      "url": "shop.ua/api/v1/products*",
      "settings": {
        "cache_level": "cache_everything",
        "edge_cache_ttl": 300, // 5 minutes
        "cache_key_fields": {
          "query_string": {
            "include": ["category", "sort", "page", "limit"]
          }
        }
      }
    }
  ]
}
```

#### Cache Headers

```go
// Set cache headers
func setCacheHeaders(w http.ResponseWriter, ttl time.Duration, isPublic bool) {
    if isPublic {
        w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(ttl.Seconds())))
        w.Header().Set("CDN-Cache-Control", fmt.Sprintf("max-age=%d", int(ttl.Seconds()*2)))
    } else {
        w.Header().Set("Cache-Control", "private, no-cache")
    }
}

// Product endpoint
func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
    setCacheHeaders(w, 5*time.Minute, true)
    // ...
}
```

### L2: In-Memory (Application)

```go
// services/core/internal/cache/memory.go

type MemoryCache struct {
    cache *ristretto.Cache
}

func NewMemoryCache() *MemoryCache {
    cache, _ := ristretto.NewCache(&ristretto.Config{
        NumCounters: 1e7,     // 10M counters
        MaxCost:     1 << 30, // 1GB max
        BufferItems: 64,      // keys per Get buffer
    })
    return &MemoryCache{cache: cache}
}

func (c *MemoryCache) Get(key string) (interface{}, bool) {
    return c.cache.Get(key)
}

func (c *MemoryCache) Set(key string, value interface{}, ttl time.Duration) {
    c.cache.SetWithTTL(key, value, 1, ttl)
}

func (c *MemoryCache) Delete(key string) {
    c.cache.Del(key)
}
```

### L3: Redis (Distributed)

```go
// services/core/internal/cache/redis.go

type RedisCache struct {
    client *redis.Client
}

func (c *RedisCache) Get(ctx context.Context, key string) ([]byte, error) {
    return c.client.Get(ctx, key).Bytes()
}

func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
    data, err := json.Marshal(value)
    if err != nil {
        return err
    }
    return c.client.Set(ctx, key, data, ttl).Err()
}

func (c *RedisCache) Delete(ctx context.Context, keys ...string) error {
    return c.client.Del(ctx, keys...).Err()
}

// Pattern-based invalidation
func (c *RedisCache) DeleteByPattern(ctx context.Context, pattern string) error {
    var cursor uint64
    for {
        keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
        if err != nil {
            return err
        }
        if len(keys) > 0 {
            c.client.Del(ctx, keys...)
        }
        cursor = nextCursor
        if cursor == 0 {
            break
        }
    }
    return nil
}
```

## Cache Patterns

### Cache-Aside (Lazy Loading)

```go
func (s *ProductService) GetProduct(ctx context.Context, id string) (*Product, error) {
    cacheKey := fmt.Sprintf("product:%s", id)

    // L2: Check memory cache
    if cached, ok := s.memCache.Get(cacheKey); ok {
        return cached.(*Product), nil
    }

    // L3: Check Redis
    if data, err := s.redisCache.Get(ctx, cacheKey); err == nil {
        var product Product
        json.Unmarshal(data, &product)
        // Populate L2
        s.memCache.Set(cacheKey, &product, 1*time.Minute)
        return &product, nil
    }

    // Origin: Database
    product, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Populate caches
    s.redisCache.Set(ctx, cacheKey, product, 5*time.Minute)
    s.memCache.Set(cacheKey, product, 1*time.Minute)

    return product, nil
}
```

### Write-Through

```go
func (s *ProductService) UpdateProduct(ctx context.Context, id string, update ProductUpdate) error {
    // Update database
    product, err := s.repo.Update(ctx, id, update)
    if err != nil {
        return err
    }

    // Update cache synchronously
    cacheKey := fmt.Sprintf("product:%s", id)
    s.redisCache.Set(ctx, cacheKey, product, 5*time.Minute)
    s.memCache.Set(cacheKey, product, 1*time.Minute)

    return nil
}
```

### Cache Invalidation

```go
func (s *ProductService) InvalidateProduct(ctx context.Context, id string) error {
    cacheKey := fmt.Sprintf("product:%s", id)

    // Delete from all cache layers
    s.memCache.Delete(cacheKey)
    s.redisCache.Delete(ctx, cacheKey)

    // Invalidate related caches
    s.redisCache.DeleteByPattern(ctx, fmt.Sprintf("products:category:*"))
    s.redisCache.DeleteByPattern(ctx, fmt.Sprintf("search:*"))

    // Purge CDN
    s.cdn.PurgeByTag(ctx, fmt.Sprintf("product-%s", id))

    return nil
}
```

### Event-Driven Invalidation

```go
// Consumer for product update events
func (c *CacheInvalidator) HandleProductUpdated(ctx context.Context, event ProductUpdated) error {
    // Invalidate all related caches
    keys := []string{
        fmt.Sprintf("product:%s", event.ProductID),
        fmt.Sprintf("product:slug:%s", event.Slug),
        fmt.Sprintf("products:category:%s", event.CategoryID),
    }

    return c.cache.Delete(ctx, keys...)
}
```

## Cache Key Design

### Key Naming Convention

```
{entity}:{tenant}:{identifier}:{variant}

Examples:
- product:tenant123:prod_abc
- products:tenant123:category:cat_xyz:page:1
- cart:session:sess_123
- user:tenant123:user_456:permissions
- search:tenant123:q:samsung:page:1
```

### Key Patterns

```go
const (
    KeyProduct         = "product:%s:%s"           // tenant:id
    KeyProductSlug     = "product:%s:slug:%s"      // tenant:slug
    KeyProductsList    = "products:%s:cat:%s:p:%d" // tenant:category:page
    KeyCart            = "cart:%s"                 // session_id
    KeyUserSession     = "session:%s"              // token
    KeyUserPermissions = "user:%s:%s:perms"        // tenant:user_id
    KeySearchResults   = "search:%s:%s"            // tenant:hash(query)
)
```

## TTL Configuration

### By Entity Type

| Entity | Memory TTL | Redis TTL | CDN TTL |
|--------|------------|-----------|---------|
| Product | 1 min | 5 min | 5 min |
| Category | 5 min | 30 min | 1 hour |
| Product List | 30 sec | 2 min | 2 min |
| Search Results | 30 sec | 2 min | - |
| Cart | - | 24 hours | - |
| Session | - | 7 days | - |
| Static Assets | - | - | 1 year |

### Dynamic TTL

```go
func calculateTTL(entity interface{}, popularity int) time.Duration {
    baseTTL := 5 * time.Minute

    // Popular items cached longer
    if popularity > 1000 {
        baseTTL = 30 * time.Minute
    }

    // Add jitter to prevent thundering herd
    jitter := time.Duration(rand.Int63n(int64(baseTTL / 10)))

    return baseTTL + jitter
}
```

## Cache Warming

### Startup Warming

```go
func (s *CacheWarmer) WarmOnStartup(ctx context.Context) error {
    // Warm popular products
    products, _ := s.repo.GetPopularProducts(ctx, 1000)
    for _, p := range products {
        s.cache.Set(ctx, fmt.Sprintf("product:%s", p.ID), p, 30*time.Minute)
    }

    // Warm categories
    categories, _ := s.repo.GetAllCategories(ctx)
    for _, c := range categories {
        s.cache.Set(ctx, fmt.Sprintf("category:%s", c.ID), c, 1*time.Hour)
    }

    return nil
}
```

### Proactive Refresh

```go
// Background job to refresh expiring cache
func (s *CacheWarmer) RefreshExpiringKeys(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Minute)
    for range ticker.C {
        keys := s.cache.GetExpiringKeys(ctx, 2*time.Minute)
        for _, key := range keys {
            // Refresh key before expiration
            s.refreshKey(ctx, key)
        }
    }
}
```

## Storefront Caching

### Next.js ISR

```typescript
// pages/products/[slug].tsx
export async function getStaticProps({ params }: GetStaticPropsContext) {
  const product = await fetchProduct(params.slug);

  return {
    props: { product },
    revalidate: 60, // Revalidate every 60 seconds
  };
}

export async function getStaticPaths() {
  const products = await fetchPopularProducts(100);

  return {
    paths: products.map(p => ({ params: { slug: p.slug } })),
    fallback: 'blocking',
  };
}
```

### SWR for Client-Side

```typescript
// hooks/useProduct.ts
import useSWR from 'swr';

export function useProduct(id: string) {
  return useSWR(
    `/api/products/${id}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
    }
  );
}
```

### React Query

```typescript
// queries/products.ts
export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
}
```

## Monitoring

### Cache Metrics

```promql
# Hit rate
sum(rate(cache_hits_total[5m])) /
(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))

# Latency by layer
histogram_quantile(0.95, rate(cache_operation_duration_seconds_bucket[5m]))

# Memory usage
cache_memory_bytes / cache_memory_max_bytes

# Eviction rate
rate(cache_evictions_total[5m])
```

### Alerts

```yaml
groups:
  - name: cache
    rules:
      - alert: LowCacheHitRate
        expr: |
          sum(rate(cache_hits_total[5m])) /
          (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
          < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 80%"

      - alert: HighCacheEvictionRate
        expr: rate(cache_evictions_total[5m]) > 100
        for: 5m
        labels:
          severity: warning
```

## Best Practices

### Do's

1. **Use appropriate TTLs** - Balance freshness vs performance
2. **Add jitter to TTLs** - Prevent thundering herd
3. **Warm cache on startup** - For popular items
4. **Monitor hit rates** - Should be > 80%
5. **Use tags for invalidation** - Group related keys
6. **Handle cache failures gracefully** - Fallback to origin

### Don'ts

1. **Don't cache user-specific data in CDN**
2. **Don't use very long TTLs for dynamic data**
3. **Don't skip cache invalidation on updates**
4. **Don't cache errors**
5. **Don't cache without monitoring**

## See Also

- [Cache Module](../modules/CACHE.md)
- [Performance Tuning](../operations/PERFORMANCE_TUNING.md)
- [Redis Configuration](../infrastructure/REDIS.md)
