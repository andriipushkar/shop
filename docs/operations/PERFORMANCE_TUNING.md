# Performance Tuning

Оптимізація продуктивності сервісів та інфраструктури.

## Performance Goals

| Metric | Target | Critical |
|--------|--------|----------|
| Page Load Time | < 2s | > 5s |
| API Response (P95) | < 200ms | > 1s |
| Time to First Byte | < 500ms | > 2s |
| Core Web Vitals LCP | < 2.5s | > 4s |
| Error Rate | < 0.1% | > 1% |

## Application Level

### Database Query Optimization

```sql
-- Use EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM products WHERE category_id = '123';

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_products_category
ON products (category_id) WHERE deleted_at IS NULL;

-- Avoid N+1 queries - use JOINs or batch loading
SELECT p.*, c.name as category_name
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.id IN (...)

-- Use pagination with cursor
SELECT * FROM products
WHERE id > 'last_seen_id'
ORDER BY id
LIMIT 20;
```

### Connection Pool Tuning

```go
// PostgreSQL
db.SetMaxOpenConns(50)
db.SetMaxIdleConns(10)
db.SetConnMaxLifetime(30 * time.Minute)
db.SetConnMaxIdleTime(5 * time.Minute)
```

```typescript
// Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool
  connection_limit: 50,
  pool_timeout: 10,
});
```

### Caching Strategy

```typescript
// Multi-level caching
async function getProduct(id: string) {
  // L1: In-memory (fastest)
  let product = memoryCache.get(id);
  if (product) return product;

  // L2: Redis
  product = await redis.get(`product:${id}`);
  if (product) {
    memoryCache.set(id, product, '1m');
    return product;
  }

  // L3: Database
  product = await db.product.findUnique({ where: { id } });
  if (product) {
    await redis.set(`product:${id}`, product, 'EX', 300);
    memoryCache.set(id, product, '1m');
  }

  return product;
}
```

### Async Processing

```typescript
// Move heavy operations to background jobs
await queue.add('send-order-confirmation', {
  orderId: order.id,
  email: customer.email,
});

await queue.add('update-inventory', {
  items: order.items,
});

await queue.add('sync-analytics', {
  event: 'order_created',
  data: order,
});
```

## Frontend Optimization

### Next.js Configuration

```javascript
// next.config.js
module.exports = {
  // Enable compression
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Enable SWC minifier
  swcMinify: true,

  // Experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@heroicons/react', 'lodash'],
  },
};
```

### Code Splitting

```typescript
// Lazy load heavy components
const ProductGallery = dynamic(() => import('./ProductGallery'), {
  loading: () => <Skeleton />,
  ssr: false,
});

const Chart = dynamic(() => import('recharts').then(mod => mod.LineChart), {
  ssr: false,
});
```

### Image Optimization

```tsx
import Image from 'next/image';

// Use blur placeholder
<Image
  src={product.image}
  alt={product.name}
  width={400}
  height={400}
  placeholder="blur"
  blurDataURL={product.blurHash}
  loading="lazy"
  sizes="(max-width: 768px) 100vw, 400px"
/>
```

## Database Tuning

### PostgreSQL Configuration

```ini
# postgresql.conf

# Memory
shared_buffers = 4GB              # 25% of RAM
effective_cache_size = 12GB       # 75% of RAM
work_mem = 256MB
maintenance_work_mem = 1GB

# Connections
max_connections = 200

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9

# Query Planner
random_page_cost = 1.1            # SSD
effective_io_concurrency = 200    # SSD

# Parallelism
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

### Redis Configuration

```ini
# redis.conf

# Memory
maxmemory 4gb
maxmemory-policy allkeys-lru

# Persistence (if needed)
save 900 1
save 300 10
appendonly yes
appendfsync everysec

# Performance
tcp-keepalive 300
timeout 0
```

### Elasticsearch Configuration

```yaml
# elasticsearch.yml

# Memory
bootstrap.memory_lock: true
indices.memory.index_buffer_size: 30%

# Thread pools
thread_pool:
  search:
    size: 20
    queue_size: 1000
  write:
    size: 10
    queue_size: 200

# Indexing
index:
  refresh_interval: 30s
  number_of_replicas: 1
```

## Infrastructure Tuning

### Kubernetes Resources

```yaml
# Optimal resource allocation
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi

# Liveness/Readiness tuning
livenessProbe:
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  successThreshold: 1
```

### Nginx Configuration

```nginx
# nginx.conf

# Worker processes
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # Keep-alive
    keepalive_timeout 65;
    keepalive_requests 100;

    # Buffers
    client_body_buffer_size 16k;
    client_max_body_size 50m;

    # Caching
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=cache:100m inactive=60m;
    proxy_cache_valid 200 60m;
    proxy_cache_valid 404 1m;
}
```

## Monitoring Performance

### Key Queries

```promql
# Request latency percentiles
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Slow database queries
rate(db_query_duration_seconds_sum[5m]) / rate(db_query_duration_seconds_count[5m])

# Cache efficiency
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))

# Connection pool usage
db_connections_in_use / db_connections_max
```

### Performance Testing

```bash
# Load test with k6
k6 run --vus 100 --duration 5m \
  -e BASE_URL=https://api.shop.ua \
  performance-test.js

# Benchmark endpoints
hey -n 10000 -c 100 https://api.shop.ua/api/v1/products

# Database benchmark
pgbench -c 50 -j 4 -T 60 shop
```

## Performance Checklist

```
□ Database
  - Slow query log enabled
  - Indexes optimized
  - Connection pool sized correctly
  - Query caching enabled

□ Caching
  - Redis properly configured
  - Cache hit rate > 80%
  - TTLs appropriate
  - Cache warming implemented

□ Frontend
  - Images optimized (WebP, lazy load)
  - JS/CSS minified and bundled
  - Critical CSS inlined
  - Service worker caching

□ Infrastructure
  - CDN configured
  - Gzip/Brotli enabled
  - HTTP/2 enabled
  - Connection keep-alive

□ Monitoring
  - APM tool configured
  - Key metrics dashboarded
  - Alerts on degradation
  - Regular performance audits
```

## See Also

- [Scaling](./SCALING.md)
- [Monitoring Setup](./MONITORING_SETUP.md)
- [Load Testing](../infrastructure/LOAD_TESTING.md)
- [Performance Guide](../guides/PERFORMANCE.md)
