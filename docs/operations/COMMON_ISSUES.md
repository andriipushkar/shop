# Common Issues

Типові проблеми та їх вирішення.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TROUBLESHOOTING GUIDE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Problem ──▶ Diagnose ──▶ Root Cause ──▶ Fix ──▶ Verify ──▶ Document       │
│                                                                              │
│  Categories:                                                                │
│  ├── Application errors                                                    │
│  ├── Database issues                                                       │
│  ├── Performance problems                                                  │
│  ├── Integration failures                                                  │
│  └── Infrastructure issues                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Application Issues

### API Returns 500 Error

**Symptoms:**
- API calls return HTTP 500
- Error logs show panics or unhandled exceptions

**Diagnosis:**
```bash
# Check pod logs
kubectl logs -f deployment/core-api -n production --tail=100

# Check for recent changes
kubectl rollout history deployment/core-api -n production

# Check resource usage
kubectl top pods -n production
```

**Common Causes:**
1. Database connection exhausted
2. Nil pointer dereference
3. External service timeout
4. Out of memory

**Solutions:**
```bash
# 1. Database connections - increase pool size
kubectl set env deployment/core-api DB_MAX_CONNECTIONS=100

# 2. Rollback recent deployment
kubectl rollout undo deployment/core-api -n production

# 3. Restart pods
kubectl rollout restart deployment/core-api -n production
```

### High Memory Usage

**Symptoms:**
- OOMKilled pods
- Slow response times
- Memory alerts

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n production

# Check for memory leaks
kubectl exec -it core-api-xxx -- go tool pprof http://localhost:6060/debug/pprof/heap

# Check recent memory trend
# Prometheus query: container_memory_usage_bytes{pod=~"core-api.*"}
```

**Solutions:**
```yaml
# Increase memory limits
resources:
  limits:
    memory: "4Gi"  # Was 2Gi
  requests:
    memory: "2Gi"  # Was 1Gi
```

```go
// Fix common memory leaks
// 1. Close HTTP response bodies
resp, err := http.Get(url)
if err != nil {
    return err
}
defer resp.Body.Close()  // Don't forget this!

// 2. Cancel contexts
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()  // Always defer cancel
```

### Slow API Responses

**Symptoms:**
- Response times > 1s
- Timeouts in clients
- User complaints

**Diagnosis:**
```sql
-- Check slow queries
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

```bash
# Check for N+1 queries
kubectl logs deployment/core-api | grep "executing query" | head -100
```

**Solutions:**
```sql
-- Add missing index
CREATE INDEX CONCURRENTLY idx_orders_user_created
ON orders(user_id, created_at DESC);

-- Optimize query
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

```go
// Use eager loading instead of N+1
// Before (N+1):
orders, _ := db.Find(&orders)
for _, order := range orders {
    db.Find(&order.Items)  // N additional queries
}

// After (eager load):
db.Preload("Items").Find(&orders)  // 2 queries total
```

## Database Issues

### Connection Pool Exhausted

**Symptoms:**
- "too many connections" errors
- Slow query execution
- Connection timeouts

**Diagnosis:**
```sql
-- Check current connections
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;

-- Find long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '30 seconds';
```

**Solutions:**
```bash
# Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND query_start < now() - interval '1 hour';

# Increase max connections (requires restart)
ALTER SYSTEM SET max_connections = 500;
```

```go
// Configure connection pool properly
db, err := sql.Open("postgres", connStr)
db.SetMaxOpenConns(50)        // Max open connections
db.SetMaxIdleConns(25)        // Max idle connections
db.SetConnMaxLifetime(5*time.Minute)  // Connection lifetime
```

### Database Replication Lag

**Symptoms:**
- Stale data on read replicas
- Inconsistent reads
- "not found" errors after recent writes

**Diagnosis:**
```sql
-- Check replication lag on replica
SELECT
  now() - pg_last_xact_replay_timestamp() AS replication_lag;

-- Check WAL position
SELECT pg_current_wal_lsn() - confirmed_flush_lsn as lag_bytes
FROM pg_replication_slots;
```

**Solutions:**
```go
// Route recent writes to primary
func GetOrder(ctx context.Context, id string) (*Order, error) {
    // If order was just created, read from primary
    if wasRecentlyWritten(ctx, id) {
        return primaryDB.GetOrder(ctx, id)
    }
    return replicaDB.GetOrder(ctx, id)
}

// Or use read-your-writes consistency
func (s *Service) CreateOrder(ctx context.Context, order *Order) error {
    err := s.primaryDB.Create(order)
    if err != nil {
        return err
    }
    // Store write timestamp in session
    setWriteTimestamp(ctx, time.Now())
    return nil
}
```

### Deadlocks

**Symptoms:**
- Transactions timing out
- "deadlock detected" errors

**Diagnosis:**
```sql
-- Find blocked queries
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid));
```

**Solutions:**
```go
// Always lock in consistent order
func TransferStock(from, to int64, quantity int) error {
    // Sort IDs to ensure consistent lock order
    ids := []int64{from, to}
    sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

    tx, _ := db.Begin()
    for _, id := range ids {
        tx.Exec("SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE", id)
    }
    // ... transfer logic ...
    return tx.Commit()
}
```

## Redis Issues

### Cache Miss Storm

**Symptoms:**
- High database load after cache expiry
- Sudden latency spikes
- "Thundering herd" pattern

**Solutions:**
```go
// Implement cache stampede prevention
func GetProduct(ctx context.Context, id string) (*Product, error) {
    // Try cache first
    cached, err := redis.Get(ctx, "product:"+id).Result()
    if err == nil {
        return unmarshal(cached)
    }

    // Use singleflight to prevent stampede
    result, err, _ := group.Do("product:"+id, func() (interface{}, error) {
        product, err := db.GetProduct(ctx, id)
        if err != nil {
            return nil, err
        }
        // Cache with jitter to prevent synchronized expiry
        ttl := 1*time.Hour + time.Duration(rand.Intn(600))*time.Second
        redis.Set(ctx, "product:"+id, marshal(product), ttl)
        return product, nil
    })

    return result.(*Product), err
}
```

### Redis Memory Full

**Symptoms:**
- OOM errors
- Eviction happening
- Slow operations

**Diagnosis:**
```bash
redis-cli INFO memory
redis-cli DEBUG OBJECT key_name
redis-cli --bigkeys
```

**Solutions:**
```bash
# Set memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Find and remove large keys
redis-cli --bigkeys
redis-cli DEL large_key_name

# Set TTL on keys without expiry
redis-cli SCAN 0 COUNT 1000 | xargs -I {} redis-cli TTL {}
```

## Integration Issues

### Nova Poshta API Failures

**Symptoms:**
- Shipping calculations failing
- Warehouse search not working

**Diagnosis:**
```bash
# Test API directly
curl -X POST https://api.novaposhta.ua/v2.0/json/ \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"YOUR_KEY","modelName":"Address","calledMethod":"getCities"}'
```

**Solutions:**
```go
// Implement circuit breaker
cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
    Name:        "nova-poshta",
    MaxRequests: 3,
    Interval:    10 * time.Second,
    Timeout:     30 * time.Second,
    OnStateChange: func(name string, from, to gobreaker.State) {
        log.Printf("Circuit breaker %s: %s -> %s", name, from, to)
    },
})

func GetCities(ctx context.Context) ([]City, error) {
    result, err := cb.Execute(func() (interface{}, error) {
        return novaPoshtaClient.GetCities(ctx)
    })
    if err != nil {
        // Return cached cities on failure
        return getCachedCities()
    }
    return result.([]City), nil
}
```

### Payment Provider Timeout

**Symptoms:**
- Checkout hanging
- Double charges possible

**Solutions:**
```go
// Implement idempotency
func ProcessPayment(ctx context.Context, order *Order) error {
    // Generate idempotency key
    key := fmt.Sprintf("payment:%s:%d", order.ID, order.Amount)

    // Check if already processed
    if existing, _ := redis.Get(ctx, key).Result(); existing != "" {
        return nil // Already processed
    }

    // Set pending flag
    redis.Set(ctx, key, "pending", 1*time.Hour)

    // Process with timeout
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()

    result, err := paymentProvider.Charge(ctx, order)
    if err != nil {
        redis.Del(ctx, key)
        return err
    }

    // Mark as complete
    redis.Set(ctx, key, result.TransactionID, 24*time.Hour)
    return nil
}
```

## Infrastructure Issues

### Pod CrashLoopBackOff

**Symptoms:**
- Pod repeatedly restarting
- Never reaches Ready state

**Diagnosis:**
```bash
# Check pod events
kubectl describe pod core-api-xxx -n production

# Check logs from previous crash
kubectl logs core-api-xxx -n production --previous

# Check resource limits
kubectl get pod core-api-xxx -o yaml | grep -A10 resources
```

**Common Causes & Solutions:**

```yaml
# 1. Liveness probe failing
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30  # Increase if app takes time to start
  periodSeconds: 10
  failureThreshold: 5      # Increase tolerance

# 2. OOMKilled
resources:
  limits:
    memory: "2Gi"  # Increase if needed
```

### Certificate Expiry

**Symptoms:**
- SSL errors in browsers
- HTTPS requests failing

**Diagnosis:**
```bash
# Check certificate expiry
kubectl get certificate -n production
openssl s_client -connect shop.ua:443 2>/dev/null | openssl x509 -noout -dates
```

**Solutions:**
```bash
# Force certificate renewal
kubectl delete certificate shop-tls -n production
# cert-manager will recreate it

# Or manually trigger renewal
cmctl renew shop-tls -n production
```

## Quick Reference

### Emergency Commands

```bash
# Restart all pods
kubectl rollout restart deployment -n production

# Scale to zero and back
kubectl scale deployment core-api --replicas=0 -n production
kubectl scale deployment core-api --replicas=4 -n production

# Force delete stuck pod
kubectl delete pod core-api-xxx --force --grace-period=0 -n production

# Clear Redis cache
kubectl exec -it redis-0 -- redis-cli FLUSHALL

# Kill database connections
kubectl exec -it postgres-0 -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle'"
```

## See Also

- [Monitoring](../infrastructure/OBSERVABILITY.md)
- [Runbooks](./RUNBOOKS.md)
- [Incident Response](./INCIDENT_RESPONSE.md)
