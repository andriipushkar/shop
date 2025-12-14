# Performance Tuning Guide

Оптимізація продуктивності платформи.

## Огляд

| Компонент | Target | Метрика |
|-----------|--------|---------|
| API Response | < 200ms | P95 latency |
| Database Query | < 50ms | P95 latency |
| Page Load | < 3s | LCP |
| Throughput | > 1000 RPS | Requests/sec |

## Database (PostgreSQL)

### Connection Pooling

```go
// Налаштування connection pool
db, err := sql.Open("postgres", dsn)
db.SetMaxOpenConns(100)        // Максимум відкритих з'єднань
db.SetMaxIdleConns(25)         // Максимум idle з'єднань
db.SetConnMaxLifetime(5 * time.Minute)
db.SetConnMaxIdleTime(1 * time.Minute)
```

### PgBouncer

```ini
# pgbouncer.ini
[databases]
shopdb = host=postgres port=5432 dbname=shopdb

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

# Timeouts
query_timeout = 30
query_wait_timeout = 60
client_idle_timeout = 300

# Logging
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60
```

### Query Optimization

#### Аналіз повільних запитів

```sql
-- Увімкнення логування повільних запитів
ALTER SYSTEM SET log_min_duration_statement = '100ms';
SELECT pg_reload_conf();

-- Топ повільних запитів
SELECT
    calls,
    round(total_exec_time::numeric, 2) as total_time_ms,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) as percent,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

#### Індекси

```sql
-- Невикористані індекси
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS size,
    idx_scan as scans
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE NOT indisunique
  AND idx_scan < 50
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- Відсутні індекси (запити з seq scan)
SELECT
    schemaname || '.' || relname AS table,
    seq_scan,
    seq_tup_read,
    idx_scan,
    n_live_tup
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND n_live_tup > 10000
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Створення оптимальних індексів
CREATE INDEX CONCURRENTLY idx_orders_customer_created
ON orders(customer_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_products_category_price
ON products(category_id, price)
WHERE is_active = true;

-- Partial index
CREATE INDEX CONCURRENTLY idx_orders_pending
ON orders(created_at)
WHERE status = 'pending';

-- Covering index
CREATE INDEX CONCURRENTLY idx_products_listing
ON products(category_id, created_at DESC)
INCLUDE (name, price, image_url);
```

#### EXPLAIN ANALYZE

```sql
-- Аналіз плану запиту
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.*, c.name as category_name
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.category_id = 'cat_123'
  AND p.price BETWEEN 100 AND 1000
  AND p.is_active = true
ORDER BY p.created_at DESC
LIMIT 20;

-- Очікуваний результат з хорошими індексами:
-- Index Scan using idx_products_category_price on products
-- Index Cond: (category_id = 'cat_123' AND price >= 100 AND price <= 1000)
-- Filter: is_active
-- Rows Removed by Filter: 0
-- Execution Time: 0.5ms
```

### PostgreSQL Configuration

```ini
# postgresql.conf

# Memory
shared_buffers = 4GB              # 25% of RAM
effective_cache_size = 12GB       # 75% of RAM
work_mem = 64MB                   # Per operation
maintenance_work_mem = 1GB        # For VACUUM, CREATE INDEX

# Write Ahead Log
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 4GB

# Query Planner
random_page_cost = 1.1           # For SSD
effective_io_concurrency = 200    # For SSD
default_statistics_target = 100

# Parallelism
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4
```

## Redis Caching

### Caching Strategy

```go
// pkg/cache/cache.go
type CacheConfig struct {
    DefaultTTL      time.Duration
    ProductTTL      time.Duration
    CategoryTTL     time.Duration
    SessionTTL      time.Duration
    RateLimitTTL    time.Duration
}

var DefaultConfig = CacheConfig{
    DefaultTTL:   5 * time.Minute,
    ProductTTL:   15 * time.Minute,
    CategoryTTL:  1 * time.Hour,
    SessionTTL:   24 * time.Hour,
    RateLimitTTL: 1 * time.Minute,
}

// Cache-Aside Pattern
func (s *ProductService) GetByID(ctx context.Context, id string) (*Product, error) {
    // 1. Try cache
    cacheKey := fmt.Sprintf("product:%s", id)
    if cached, err := s.cache.Get(ctx, cacheKey); err == nil {
        var product Product
        json.Unmarshal(cached, &product)
        metrics.CacheHits.WithLabelValues("product").Inc()
        return &product, nil
    }
    metrics.CacheMisses.WithLabelValues("product").Inc()

    // 2. Get from DB
    product, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // 3. Store in cache
    data, _ := json.Marshal(product)
    s.cache.Set(ctx, cacheKey, data, DefaultConfig.ProductTTL)

    return product, nil
}

// Write-Through Pattern
func (s *ProductService) Update(ctx context.Context, id string, input UpdateInput) (*Product, error) {
    // 1. Update DB
    product, err := s.repo.Update(ctx, id, input)
    if err != nil {
        return nil, err
    }

    // 2. Update cache
    cacheKey := fmt.Sprintf("product:%s", id)
    data, _ := json.Marshal(product)
    s.cache.Set(ctx, cacheKey, data, DefaultConfig.ProductTTL)

    // 3. Invalidate related caches
    s.cache.Del(ctx, fmt.Sprintf("category_products:%s", product.CategoryID))

    return product, nil
}
```

### Redis Configuration

```conf
# redis.conf

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence (disable for pure cache)
save ""
appendonly no

# Performance
tcp-keepalive 300
timeout 0

# Threads (Redis 6+)
io-threads 4
io-threads-do-reads yes
```

### Cache Warming

```go
// Прогрів кешу при старті
func (s *CacheWarmer) WarmUp(ctx context.Context) error {
    // Popular products
    products, _ := s.productRepo.FindPopular(ctx, 100)
    for _, p := range products {
        key := fmt.Sprintf("product:%s", p.ID)
        data, _ := json.Marshal(p)
        s.cache.Set(ctx, key, data, 1*time.Hour)
    }

    // Categories
    categories, _ := s.categoryRepo.FindAll(ctx)
    for _, c := range categories {
        key := fmt.Sprintf("category:%s", c.ID)
        data, _ := json.Marshal(c)
        s.cache.Set(ctx, key, data, 24*time.Hour)
    }

    return nil
}
```

## Elasticsearch

### Index Settings

```json
{
  "settings": {
    "index": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "refresh_interval": "5s",
      "max_result_window": 10000
    },
    "analysis": {
      "analyzer": {
        "ukrainian": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "ukrainian_stop", "ukrainian_stemmer"]
        }
      }
    }
  }
}
```

### Query Optimization

```json
// Замість:
{
  "query": {
    "wildcard": {
      "name": "*phone*"
    }
  }
}

// Використовуйте:
{
  "query": {
    "match": {
      "name": {
        "query": "phone",
        "fuzziness": "AUTO"
      }
    }
  }
}

// Використовуйте filter замість query для exact match:
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "category_id": "cat_123" } },
        { "range": { "price": { "gte": 100, "lte": 1000 } } }
      ],
      "must": [
        { "match": { "name": "phone" } }
      ]
    }
  }
}
```

### Scroll API для великих результатів

```go
// Замість offset pagination для великих dataset
func (s *SearchService) ExportAll(ctx context.Context) (<-chan Product, error) {
    ch := make(chan Product, 100)

    go func() {
        defer close(ch)

        scrollID := ""
        for {
            var res *esapi.Response
            if scrollID == "" {
                res, _ = s.client.Search(
                    s.client.Search.WithIndex("products"),
                    s.client.Search.WithScroll(time.Minute),
                    s.client.Search.WithSize(1000),
                )
            } else {
                res, _ = s.client.Scroll(
                    s.client.Scroll.WithScrollID(scrollID),
                    s.client.Scroll.WithScroll(time.Minute),
                )
            }

            // Parse and send to channel
            // Break if no more results
        }
    }()

    return ch, nil
}
```

## API Performance

### Response Compression

```go
// Gzip middleware
func GzipMiddleware() gin.HandlerFunc {
    return gzip.Gzip(gzip.DefaultCompression)
}

// Content-Type specific
func CompressionMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        if strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
            if c.Writer.Header().Get("Content-Type") == "application/json" {
                c.Header("Content-Encoding", "gzip")
            }
        }
        c.Next()
    }
}
```

### Pagination

```go
// Cursor-based pagination (efficient for large datasets)
type CursorPagination struct {
    Cursor string `json:"cursor"`
    Limit  int    `json:"limit"`
}

func (r *ProductRepository) FindWithCursor(ctx context.Context, cursor string, limit int) ([]Product, string, error) {
    query := r.db.Model(&Product{}).Order("id ASC").Limit(limit + 1)

    if cursor != "" {
        query = query.Where("id > ?", cursor)
    }

    var products []Product
    query.Find(&products)

    var nextCursor string
    if len(products) > limit {
        nextCursor = products[limit-1].ID
        products = products[:limit]
    }

    return products, nextCursor, nil
}
```

### Field Selection

```go
// Повертайте тільки потрібні поля
func (h *ProductHandler) List(c *gin.Context) {
    fields := c.QueryArray("fields")

    if len(fields) > 0 {
        query = query.Select(fields)
    }

    // SELECT id, name, price FROM products
    // замість
    // SELECT * FROM products
}
```

### N+1 Query Prevention

```go
// Поганий приклад (N+1)
products, _ := repo.FindAll(ctx)
for _, p := range products {
    category, _ := categoryRepo.FindByID(ctx, p.CategoryID) // N queries
    p.Category = category
}

// Хороший приклад (Preload)
var products []Product
db.Preload("Category").Find(&products) // 2 queries

// Або JOIN
db.Joins("Category").Find(&products) // 1 query
```

## Frontend Performance

### Next.js Optimization

```typescript
// next.config.js
module.exports = {
  // Image optimization
  images: {
    domains: ['cdn.yourstore.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },

  // Bundle analysis
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer ? '../analyze/server.html' : './analyze/client.html',
        })
      );
    }
    return config;
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
  },
};
```

### Code Splitting

```typescript
// Dynamic imports
const ProductModal = dynamic(() => import('@/components/ProductModal'), {
  loading: () => <Skeleton />,
  ssr: false,
});

// Route-based splitting (automatic in Next.js app router)
// app/products/[id]/page.tsx -> separate chunk
```

### Image Optimization

```tsx
// components/ProductImage.tsx
import Image from 'next/image';

export function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={400}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
}
```

### API Response Caching

```typescript
// SWR з оптимальними налаштуваннями
const { data } = useSWR('/api/products', fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // 1 minute
  focusThrottleInterval: 5000,
});

// React Query
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 30 * 60 * 1000, // 30 minutes
});
```

## Load Testing

### k6 Script

```javascript
// load-tests/api.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay
    { duration: '2m', target: 200 },  // Peak
    { duration: '5m', target: 200 },  // Stay at peak
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  // Product listing
  let res = http.get('http://localhost:8080/api/v1/products?limit=20');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  latency.add(res.timings.duration);
  errorRate.add(res.status !== 200);

  sleep(1);

  // Product detail
  res = http.get('http://localhost:8080/api/v1/products/prod_123');
  check(res, { 'status is 200': (r) => r.status === 200 });

  sleep(1);
}
```

### Запуск

```bash
# Локально
k6 run load-tests/api.js

# З cloud результатами
k6 cloud load-tests/api.js

# З InfluxDB + Grafana
k6 run --out influxdb=http://localhost:8086/k6 load-tests/api.js
```

## Performance Checklist

### Database
- [ ] Connection pooling налаштований
- [ ] Індекси для частих запитів
- [ ] EXPLAIN ANALYZE для повільних запитів
- [ ] pg_stat_statements увімкнений
- [ ] Vacuum scheduled

### Caching
- [ ] Redis для сесій та кешу
- [ ] Cache-Aside pattern
- [ ] TTL налаштований
- [ ] Cache invalidation працює

### API
- [ ] Gzip compression
- [ ] Pagination для списків
- [ ] Field selection
- [ ] N+1 queries виправлені

### Frontend
- [ ] Code splitting
- [ ] Image optimization
- [ ] Lazy loading
- [ ] CDN для статики
- [ ] Service Worker для offline
