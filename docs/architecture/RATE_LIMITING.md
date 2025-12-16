# Rate Limiting

Система обмеження частоти запитів для захисту API та справедливого розподілу ресурсів.

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rate Limiting System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Request ──►  ┌──────────────────────────────────────────┐     │
│                │           Rate Limiter                    │     │
│                │  ┌────────────┐  ┌────────────┐          │     │
│                │  │   Token    │  │  Sliding   │          │     │
│                │  │   Bucket   │  │  Window    │          │     │
│                │  └────────────┘  └────────────┘          │     │
│                │  ┌────────────┐  ┌────────────┐          │     │
│                │  │   Fixed    │  │  Leaky     │          │     │
│                │  │   Window   │  │  Bucket    │          │     │
│                │  └────────────┘  └────────────┘          │     │
│                └──────────────────────────────────────────┘     │
│                          │                                       │
│                          ▼                                       │
│   ┌────────────────────────────────────────────────────────┐    │
│   │                    Redis Storage                        │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │    │
│   │  │tenant:1 │  │tenant:2 │  │  ip:x   │  │ user:y  │   │    │
│   │  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │    │
│   └────────────────────────────────────────────────────────┘    │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              ▼                       ▼                          │
│        ┌──────────┐           ┌──────────┐                      │
│        │  Allow   │           │  Reject  │                      │
│        │  Request │           │  (429)   │                      │
│        └──────────┘           └──────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Алгоритми

### Token Bucket

```go
// internal/ratelimit/token_bucket.go
package ratelimit

import (
    "context"
    "time"

    "github.com/redis/go-redis/v9"
)

type TokenBucket struct {
    redis    *redis.Client
    rate     float64       // tokens per second
    capacity int64         // max tokens
    prefix   string
}

func NewTokenBucket(redis *redis.Client, rate float64, capacity int64, prefix string) *TokenBucket {
    return &TokenBucket{
        redis:    redis,
        rate:     rate,
        capacity: capacity,
        prefix:   prefix,
    }
}

// Allow checks if a request is allowed and consumes a token
func (tb *TokenBucket) Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error) {
    return tb.AllowN(ctx, key, 1)
}

// AllowN checks if n tokens are available and consumes them
func (tb *TokenBucket) AllowN(ctx context.Context, key string, n int64) (bool, *RateLimitInfo, error) {
    fullKey := tb.prefix + ":" + key
    now := time.Now().UnixNano()

    // Lua script for atomic token bucket operation
    script := redis.NewScript(`
        local key = KEYS[1]
        local rate = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local requested = tonumber(ARGV[4])

        local data = redis.call('HMGET', key, 'tokens', 'last_update')
        local tokens = tonumber(data[1]) or capacity
        local last_update = tonumber(data[2]) or now

        -- Calculate new tokens based on time elapsed
        local elapsed = (now - last_update) / 1e9  -- convert to seconds
        local new_tokens = math.min(capacity, tokens + (elapsed * rate))

        local allowed = new_tokens >= requested
        local remaining = new_tokens

        if allowed then
            remaining = new_tokens - requested
            redis.call('HMSET', key, 'tokens', remaining, 'last_update', now)
            redis.call('EXPIRE', key, math.ceil(capacity / rate) + 1)
        end

        return {allowed and 1 or 0, math.floor(remaining), math.ceil((capacity - remaining) / rate)}
    `)

    result, err := script.Run(ctx, tb.redis, []string{fullKey},
        tb.rate, tb.capacity, now, n).Slice()
    if err != nil {
        return false, nil, err
    }

    allowed := result[0].(int64) == 1
    remaining := result[1].(int64)
    resetAfter := time.Duration(result[2].(int64)) * time.Second

    return allowed, &RateLimitInfo{
        Limit:      tb.capacity,
        Remaining:  remaining,
        ResetAfter: resetAfter,
        RetryAfter: resetAfter,
    }, nil
}
```

### Sliding Window

```go
// internal/ratelimit/sliding_window.go
package ratelimit

import (
    "context"
    "time"

    "github.com/redis/go-redis/v9"
)

type SlidingWindow struct {
    redis  *redis.Client
    limit  int64
    window time.Duration
    prefix string
}

func NewSlidingWindow(redis *redis.Client, limit int64, window time.Duration, prefix string) *SlidingWindow {
    return &SlidingWindow{
        redis:  redis,
        limit:  limit,
        window: window,
        prefix: prefix,
    }
}

// Allow checks if a request is allowed
func (sw *SlidingWindow) Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error) {
    fullKey := sw.prefix + ":" + key
    now := time.Now()
    windowStart := now.Add(-sw.window).UnixMilli()

    // Lua script for atomic sliding window operation
    script := redis.NewScript(`
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window_start = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local window_ms = tonumber(ARGV[4])

        -- Remove old entries
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

        -- Count current requests
        local count = redis.call('ZCARD', key)

        local allowed = count < limit
        local remaining = limit - count

        if allowed then
            -- Add current request
            redis.call('ZADD', key, now, now .. ':' .. math.random())
            remaining = remaining - 1
        end

        -- Set expiration
        redis.call('PEXPIRE', key, window_ms)

        -- Calculate reset time
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local reset_after = 0
        if #oldest > 0 then
            reset_after = tonumber(oldest[2]) + window_ms - now
        end

        return {allowed and 1 or 0, math.max(0, remaining), reset_after}
    `)

    result, err := script.Run(ctx, sw.redis, []string{fullKey},
        now.UnixMilli(), windowStart, sw.limit, sw.window.Milliseconds()).Slice()
    if err != nil {
        return false, nil, err
    }

    allowed := result[0].(int64) == 1
    remaining := result[1].(int64)
    resetAfterMs := result[2].(int64)

    return allowed, &RateLimitInfo{
        Limit:      sw.limit,
        Remaining:  remaining,
        ResetAfter: time.Duration(resetAfterMs) * time.Millisecond,
        RetryAfter: time.Duration(resetAfterMs) * time.Millisecond,
    }, nil
}
```

### Fixed Window Counter

```go
// internal/ratelimit/fixed_window.go
package ratelimit

import (
    "context"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type FixedWindow struct {
    redis  *redis.Client
    limit  int64
    window time.Duration
    prefix string
}

func NewFixedWindow(redis *redis.Client, limit int64, window time.Duration, prefix string) *FixedWindow {
    return &FixedWindow{
        redis:  redis,
        limit:  limit,
        window: window,
        prefix: prefix,
    }
}

// Allow checks if a request is allowed
func (fw *FixedWindow) Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error) {
    now := time.Now()
    windowKey := fw.getWindowKey(key, now)

    // Increment counter
    count, err := fw.redis.Incr(ctx, windowKey).Result()
    if err != nil {
        return false, nil, err
    }

    // Set expiration on first request in window
    if count == 1 {
        fw.redis.Expire(ctx, windowKey, fw.window)
    }

    allowed := count <= fw.limit
    remaining := fw.limit - count
    if remaining < 0 {
        remaining = 0
    }

    // Calculate reset time
    ttl, _ := fw.redis.TTL(ctx, windowKey).Result()
    if ttl < 0 {
        ttl = fw.window
    }

    return allowed, &RateLimitInfo{
        Limit:      fw.limit,
        Remaining:  remaining,
        ResetAfter: ttl,
        RetryAfter: ttl,
    }, nil
}

func (fw *FixedWindow) getWindowKey(key string, t time.Time) string {
    window := t.Truncate(fw.window).Unix()
    return fmt.Sprintf("%s:%s:%d", fw.prefix, key, window)
}
```

## Rate Limiter Interface

```go
// internal/ratelimit/limiter.go
package ratelimit

import (
    "context"
    "time"
)

// RateLimiter interface for all rate limiting implementations
type RateLimiter interface {
    Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error)
}

// RateLimitInfo contains rate limit status information
type RateLimitInfo struct {
    Limit      int64         `json:"limit"`
    Remaining  int64         `json:"remaining"`
    ResetAfter time.Duration `json:"reset_after"`
    RetryAfter time.Duration `json:"retry_after"`
}

// Config for rate limiter
type Config struct {
    Algorithm string        `json:"algorithm"` // token_bucket, sliding_window, fixed_window
    Limit     int64         `json:"limit"`
    Window    time.Duration `json:"window"`
    Rate      float64       `json:"rate"` // for token bucket
    Capacity  int64         `json:"capacity"` // for token bucket
}
```

## Multi-Level Rate Limiting

```go
// internal/ratelimit/multi.go
package ratelimit

import (
    "context"
)

type Level string

const (
    LevelGlobal Level = "global"
    LevelTenant Level = "tenant"
    LevelUser   Level = "user"
    LevelIP     Level = "ip"
    LevelRoute  Level = "route"
)

type MultiLevelLimiter struct {
    limiters map[Level]RateLimiter
    keyFuncs map[Level]KeyFunc
}

type KeyFunc func(ctx context.Context) string

func NewMultiLevelLimiter() *MultiLevelLimiter {
    return &MultiLevelLimiter{
        limiters: make(map[Level]RateLimiter),
        keyFuncs: make(map[Level]KeyFunc),
    }
}

// AddLevel adds a rate limiter for a specific level
func (m *MultiLevelLimiter) AddLevel(level Level, limiter RateLimiter, keyFunc KeyFunc) {
    m.limiters[level] = limiter
    m.keyFuncs[level] = keyFunc
}

// Allow checks all levels and returns the most restrictive result
func (m *MultiLevelLimiter) Allow(ctx context.Context) (bool, map[Level]*RateLimitInfo, error) {
    results := make(map[Level]*RateLimitInfo)

    for level, limiter := range m.limiters {
        keyFunc := m.keyFuncs[level]
        key := keyFunc(ctx)

        allowed, info, err := limiter.Allow(ctx, key)
        if err != nil {
            return false, nil, err
        }

        results[level] = info

        if !allowed {
            return false, results, nil
        }
    }

    return true, results, nil
}

// Example setup
func SetupMultiLevelLimiter(redis *redis.Client) *MultiLevelLimiter {
    limiter := NewMultiLevelLimiter()

    // Global: 10000 req/min
    limiter.AddLevel(
        LevelGlobal,
        NewSlidingWindow(redis, 10000, time.Minute, "rl:global"),
        func(ctx context.Context) string { return "global" },
    )

    // Per tenant: 1000 req/min
    limiter.AddLevel(
        LevelTenant,
        NewTokenBucket(redis, 16.67, 1000, "rl:tenant"), // ~1000/min
        func(ctx context.Context) string {
            return tenant.GetTenantID(ctx)
        },
    )

    // Per user: 100 req/min
    limiter.AddLevel(
        LevelUser,
        NewSlidingWindow(redis, 100, time.Minute, "rl:user"),
        func(ctx context.Context) string {
            return auth.GetUserID(ctx)
        },
    )

    // Per IP: 500 req/min
    limiter.AddLevel(
        LevelIP,
        NewFixedWindow(redis, 500, time.Minute, "rl:ip"),
        func(ctx context.Context) string {
            return GetClientIP(ctx)
        },
    )

    return limiter
}
```

## Route-Specific Limits

```go
// internal/ratelimit/route_config.go
package ratelimit

import (
    "time"
)

// RouteConfig defines rate limits for specific routes
type RouteConfig struct {
    Pattern   string        `json:"pattern"`   // /api/v1/products/*
    Method    string        `json:"method"`    // GET, POST, etc.
    Limit     int64         `json:"limit"`
    Window    time.Duration `json:"window"`
    ByTenant  bool          `json:"by_tenant"`
    ByUser    bool          `json:"by_user"`
    ByIP      bool          `json:"by_ip"`
}

var DefaultRouteConfigs = []RouteConfig{
    // Public endpoints - stricter limits
    {Pattern: "/api/v1/auth/login", Method: "POST", Limit: 5, Window: time.Minute, ByIP: true},
    {Pattern: "/api/v1/auth/register", Method: "POST", Limit: 3, Window: time.Minute, ByIP: true},
    {Pattern: "/api/v1/auth/forgot-password", Method: "POST", Limit: 3, Window: time.Hour, ByIP: true},

    // Search - moderate limits
    {Pattern: "/api/v1/products/search", Method: "GET", Limit: 60, Window: time.Minute, ByTenant: true, ByUser: true},

    // Write operations - stricter
    {Pattern: "/api/v1/orders", Method: "POST", Limit: 10, Window: time.Minute, ByTenant: true, ByUser: true},
    {Pattern: "/api/v1/products", Method: "POST", Limit: 100, Window: time.Minute, ByTenant: true},

    // Bulk operations - very strict
    {Pattern: "/api/v1/products/import", Method: "POST", Limit: 5, Window: time.Hour, ByTenant: true},
    {Pattern: "/api/v1/orders/export", Method: "GET", Limit: 10, Window: time.Hour, ByTenant: true},

    // Webhooks - higher limits
    {Pattern: "/api/v1/webhooks/*", Method: "POST", Limit: 1000, Window: time.Minute, ByTenant: true},

    // Default API
    {Pattern: "/api/v1/*", Method: "*", Limit: 300, Window: time.Minute, ByTenant: true},
}

type RouteLimiter struct {
    redis   *redis.Client
    configs []RouteConfig
    cache   map[string]*SlidingWindow
    mu      sync.RWMutex
}

func NewRouteLimiter(redis *redis.Client, configs []RouteConfig) *RouteLimiter {
    return &RouteLimiter{
        redis:   redis,
        configs: configs,
        cache:   make(map[string]*SlidingWindow),
    }
}

// GetLimiter returns a rate limiter for the given route
func (rl *RouteLimiter) GetLimiter(method, path string) (RateLimiter, *RouteConfig) {
    for _, config := range rl.configs {
        if rl.matchRoute(method, path, config) {
            return rl.getLimiterForConfig(config), &config
        }
    }
    return nil, nil
}

func (rl *RouteLimiter) matchRoute(method, path string, config RouteConfig) bool {
    // Check method
    if config.Method != "*" && config.Method != method {
        return false
    }

    // Check path pattern
    return matchGlob(config.Pattern, path)
}

func (rl *RouteLimiter) getLimiterForConfig(config RouteConfig) RateLimiter {
    key := fmt.Sprintf("%s:%s", config.Pattern, config.Method)

    rl.mu.RLock()
    limiter, ok := rl.cache[key]
    rl.mu.RUnlock()

    if ok {
        return limiter
    }

    rl.mu.Lock()
    defer rl.mu.Unlock()

    if limiter, ok = rl.cache[key]; ok {
        return limiter
    }

    prefix := fmt.Sprintf("rl:route:%s", key)
    limiter = NewSlidingWindow(rl.redis, config.Limit, config.Window, prefix)
    rl.cache[key] = limiter

    return limiter
}

func matchGlob(pattern, path string) bool {
    // Simple glob matching (* matches any segment)
    patternParts := strings.Split(pattern, "/")
    pathParts := strings.Split(path, "/")

    if len(patternParts) > len(pathParts) {
        return false
    }

    for i, part := range patternParts {
        if part == "*" {
            continue
        }
        if part == "**" {
            return true // Match rest
        }
        if i >= len(pathParts) || part != pathParts[i] {
            return false
        }
    }

    return len(patternParts) == len(pathParts)
}
```

## HTTP Middleware

```go
// internal/middleware/ratelimit.go
package middleware

import (
    "fmt"
    "net/http"
    "strconv"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/your-org/shop/internal/ratelimit"
)

type RateLimitMiddleware struct {
    limiter      *ratelimit.MultiLevelLimiter
    routeLimiter *ratelimit.RouteLimiter
}

func NewRateLimitMiddleware(
    limiter *ratelimit.MultiLevelLimiter,
    routeLimiter *ratelimit.RouteLimiter,
) *RateLimitMiddleware {
    return &RateLimitMiddleware{
        limiter:      limiter,
        routeLimiter: routeLimiter,
    }
}

// Handler returns the rate limiting middleware
func (m *RateLimitMiddleware) Handler() gin.HandlerFunc {
    return func(c *gin.Context) {
        ctx := c.Request.Context()

        // Check route-specific limits first
        if m.routeLimiter != nil {
            routeLimiter, config := m.routeLimiter.GetLimiter(c.Request.Method, c.FullPath())
            if routeLimiter != nil {
                key := m.buildRouteKey(c, config)
                allowed, info, err := routeLimiter.Allow(ctx, key)
                if err != nil {
                    c.Next()
                    return
                }

                m.setHeaders(c, info)

                if !allowed {
                    m.rejectRequest(c, info)
                    return
                }
            }
        }

        // Check multi-level limits
        if m.limiter != nil {
            allowed, results, err := m.limiter.Allow(ctx)
            if err != nil {
                c.Next()
                return
            }

            // Set headers for most restrictive level
            mostRestrictive := m.getMostRestrictive(results)
            if mostRestrictive != nil {
                m.setHeaders(c, mostRestrictive)
            }

            if !allowed {
                m.rejectRequest(c, mostRestrictive)
                return
            }
        }

        c.Next()
    }
}

func (m *RateLimitMiddleware) buildRouteKey(c *gin.Context, config *ratelimit.RouteConfig) string {
    parts := []string{}

    if config.ByTenant {
        parts = append(parts, c.GetString("tenant_id"))
    }
    if config.ByUser {
        parts = append(parts, c.GetString("user_id"))
    }
    if config.ByIP {
        parts = append(parts, c.ClientIP())
    }

    if len(parts) == 0 {
        parts = append(parts, "default")
    }

    return strings.Join(parts, ":")
}

func (m *RateLimitMiddleware) setHeaders(c *gin.Context, info *ratelimit.RateLimitInfo) {
    c.Header("X-RateLimit-Limit", strconv.FormatInt(info.Limit, 10))
    c.Header("X-RateLimit-Remaining", strconv.FormatInt(info.Remaining, 10))
    c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(info.ResetAfter).Unix(), 10))
}

func (m *RateLimitMiddleware) rejectRequest(c *gin.Context, info *ratelimit.RateLimitInfo) {
    c.Header("Retry-After", strconv.FormatInt(int64(info.RetryAfter.Seconds()), 10))

    c.JSON(http.StatusTooManyRequests, gin.H{
        "error":       "Rate limit exceeded",
        "limit":       info.Limit,
        "remaining":   info.Remaining,
        "retry_after": info.RetryAfter.Seconds(),
    })
    c.Abort()
}

func (m *RateLimitMiddleware) getMostRestrictive(results map[ratelimit.Level]*ratelimit.RateLimitInfo) *ratelimit.RateLimitInfo {
    var mostRestrictive *ratelimit.RateLimitInfo
    lowestRemaining := int64(-1)

    for _, info := range results {
        if lowestRemaining == -1 || info.Remaining < lowestRemaining {
            lowestRemaining = info.Remaining
            mostRestrictive = info
        }
    }

    return mostRestrictive
}
```

## Plan-Based Limits

```go
// internal/ratelimit/plan_limits.go
package ratelimit

import (
    "context"
    "time"
)

type PlanLimits struct {
    APIRequestsPerMinute  int64 `json:"api_requests_per_minute"`
    APIRequestsPerDay     int64 `json:"api_requests_per_day"`
    WebhooksPerMinute     int64 `json:"webhooks_per_minute"`
    BulkOperationsPerHour int64 `json:"bulk_operations_per_hour"`
    SearchRequestsPerMinute int64 `json:"search_requests_per_minute"`
}

var PlanLimitsConfig = map[string]PlanLimits{
    "starter": {
        APIRequestsPerMinute:  100,
        APIRequestsPerDay:     10000,
        WebhooksPerMinute:     100,
        BulkOperationsPerHour: 5,
        SearchRequestsPerMinute: 30,
    },
    "business": {
        APIRequestsPerMinute:  500,
        APIRequestsPerDay:     100000,
        WebhooksPerMinute:     500,
        BulkOperationsPerHour: 20,
        SearchRequestsPerMinute: 100,
    },
    "enterprise": {
        APIRequestsPerMinute:  2000,
        APIRequestsPerDay:     1000000,
        WebhooksPerMinute:     2000,
        BulkOperationsPerHour: 100,
        SearchRequestsPerMinute: 500,
    },
}

type PlanBasedLimiter struct {
    redis     *redis.Client
    planRepo  PlanRepository
    limiters  map[string]map[string]RateLimiter
    mu        sync.RWMutex
}

func NewPlanBasedLimiter(redis *redis.Client, planRepo PlanRepository) *PlanBasedLimiter {
    return &PlanBasedLimiter{
        redis:    redis,
        planRepo: planRepo,
        limiters: make(map[string]map[string]RateLimiter),
    }
}

// GetLimiter returns a rate limiter for the tenant's plan
func (p *PlanBasedLimiter) GetLimiter(ctx context.Context, tenantID string, limitType string) (RateLimiter, error) {
    // Get tenant's plan
    plan, err := p.planRepo.GetPlanByTenantID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    return p.getLimiterForPlan(plan.ID, limitType), nil
}

func (p *PlanBasedLimiter) getLimiterForPlan(planID string, limitType string) RateLimiter {
    p.mu.RLock()
    if planLimiters, ok := p.limiters[planID]; ok {
        if limiter, ok := planLimiters[limitType]; ok {
            p.mu.RUnlock()
            return limiter
        }
    }
    p.mu.RUnlock()

    p.mu.Lock()
    defer p.mu.Unlock()

    if p.limiters[planID] == nil {
        p.limiters[planID] = make(map[string]RateLimiter)
    }

    if limiter, ok := p.limiters[planID][limitType]; ok {
        return limiter
    }

    // Create limiter based on plan limits
    limits := PlanLimitsConfig[planID]
    if limits.APIRequestsPerMinute == 0 {
        limits = PlanLimitsConfig["starter"] // Default
    }

    var limiter RateLimiter
    prefix := fmt.Sprintf("rl:plan:%s:%s", planID, limitType)

    switch limitType {
    case "api_minute":
        limiter = NewSlidingWindow(p.redis, limits.APIRequestsPerMinute, time.Minute, prefix)
    case "api_day":
        limiter = NewFixedWindow(p.redis, limits.APIRequestsPerDay, 24*time.Hour, prefix)
    case "webhooks":
        limiter = NewTokenBucket(p.redis, float64(limits.WebhooksPerMinute)/60, limits.WebhooksPerMinute, prefix)
    case "bulk":
        limiter = NewFixedWindow(p.redis, limits.BulkOperationsPerHour, time.Hour, prefix)
    case "search":
        limiter = NewSlidingWindow(p.redis, limits.SearchRequestsPerMinute, time.Minute, prefix)
    default:
        limiter = NewSlidingWindow(p.redis, 100, time.Minute, prefix)
    }

    p.limiters[planID][limitType] = limiter
    return limiter
}

// Allow checks if request is allowed for tenant's plan
func (p *PlanBasedLimiter) Allow(ctx context.Context, tenantID string, limitType string) (bool, *RateLimitInfo, error) {
    limiter, err := p.GetLimiter(ctx, tenantID, limitType)
    if err != nil {
        return false, nil, err
    }

    return limiter.Allow(ctx, tenantID)
}
```

## Distributed Rate Limiting

```go
// internal/ratelimit/distributed.go
package ratelimit

import (
    "context"
    "sync"
    "time"

    "github.com/redis/go-redis/v9"
)

// DistributedLimiter uses Redis for distributed rate limiting across multiple instances
type DistributedLimiter struct {
    redis       *redis.Client
    localCache  *LocalCache
    syncPeriod  time.Duration
}

type LocalCache struct {
    mu     sync.RWMutex
    counts map[string]*localCount
}

type localCount struct {
    count      int64
    lastSync   time.Time
    pending    int64
}

func NewDistributedLimiter(redis *redis.Client, syncPeriod time.Duration) *DistributedLimiter {
    dl := &DistributedLimiter{
        redis:      redis,
        syncPeriod: syncPeriod,
        localCache: &LocalCache{
            counts: make(map[string]*localCount),
        },
    }

    // Start background sync
    go dl.syncLoop()

    return dl
}

// Allow uses local counting with periodic Redis sync
func (dl *DistributedLimiter) Allow(ctx context.Context, key string, limit int64, window time.Duration) (bool, error) {
    dl.localCache.mu.Lock()
    defer dl.localCache.mu.Unlock()

    lc, ok := dl.localCache.counts[key]
    if !ok {
        // First request - sync with Redis
        count, err := dl.getCountFromRedis(ctx, key, window)
        if err != nil {
            return false, err
        }

        lc = &localCount{
            count:    count,
            lastSync: time.Now(),
            pending:  0,
        }
        dl.localCache.counts[key] = lc
    }

    // Check if we need to sync
    if time.Since(lc.lastSync) > dl.syncPeriod {
        count, err := dl.syncWithRedis(ctx, key, window, lc.pending)
        if err == nil {
            lc.count = count
            lc.pending = 0
            lc.lastSync = time.Now()
        }
    }

    // Check limit
    totalCount := lc.count + lc.pending
    if totalCount >= limit {
        return false, nil
    }

    // Increment locally
    lc.pending++

    return true, nil
}

func (dl *DistributedLimiter) getCountFromRedis(ctx context.Context, key string, window time.Duration) (int64, error) {
    windowStart := time.Now().Add(-window).UnixMilli()
    return dl.redis.ZCount(ctx, key, fmt.Sprintf("%d", windowStart), "+inf").Result()
}

func (dl *DistributedLimiter) syncWithRedis(ctx context.Context, key string, window time.Duration, pending int64) (int64, error) {
    now := time.Now()
    windowStart := now.Add(-window).UnixMilli()

    // Lua script for atomic sync
    script := redis.NewScript(`
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window_start = tonumber(ARGV[2])
        local pending = tonumber(ARGV[3])

        -- Remove old entries
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

        -- Add pending entries
        for i = 1, pending do
            redis.call('ZADD', key, now, now .. ':' .. math.random())
        end

        -- Return current count
        return redis.call('ZCARD', key)
    `)

    count, err := script.Run(ctx, dl.redis, []string{key},
        now.UnixMilli(), windowStart, pending).Int64()
    if err != nil {
        return 0, err
    }

    return count, nil
}

func (dl *DistributedLimiter) syncLoop() {
    ticker := time.NewTicker(dl.syncPeriod)
    defer ticker.Stop()

    for range ticker.C {
        dl.syncAll()
    }
}

func (dl *DistributedLimiter) syncAll() {
    dl.localCache.mu.Lock()
    defer dl.localCache.mu.Unlock()

    ctx := context.Background()
    for key, lc := range dl.localCache.counts {
        if lc.pending > 0 {
            count, err := dl.syncWithRedis(ctx, key, time.Minute, lc.pending)
            if err == nil {
                lc.count = count
                lc.pending = 0
                lc.lastSync = time.Now()
            }
        }
    }
}
```

## API Endpoints

```go
// internal/ratelimit/handlers.go
package ratelimit

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

type RateLimitHandler struct {
    limiter      *MultiLevelLimiter
    routeLimiter *RouteLimiter
}

func (h *RateLimitHandler) RegisterRoutes(r *gin.RouterGroup) {
    r.GET("/rate-limits/status", h.GetStatus)
    r.GET("/rate-limits/config", h.GetConfig)
}

// GetStatus returns current rate limit status for the caller
func (h *RateLimitHandler) GetStatus(c *gin.Context) {
    ctx := c.Request.Context()

    _, results, _ := h.limiter.Allow(ctx)

    status := make(map[string]gin.H)
    for level, info := range results {
        status[string(level)] = gin.H{
            "limit":       info.Limit,
            "remaining":   info.Remaining,
            "reset_after": info.ResetAfter.Seconds(),
        }
    }

    c.JSON(http.StatusOK, gin.H{
        "limits": status,
    })
}

// GetConfig returns rate limit configuration
func (h *RateLimitHandler) GetConfig(c *gin.Context) {
    // Return public rate limit info based on plan
    tenantID := c.GetString("tenant_id")

    plan, _ := getPlanByTenantID(c.Request.Context(), tenantID)
    limits := PlanLimitsConfig[plan.ID]

    c.JSON(http.StatusOK, gin.H{
        "plan":   plan.Name,
        "limits": limits,
    })
}
```

## Metrics & Monitoring

```go
// internal/ratelimit/metrics.go
package ratelimit

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    requestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "rate_limit_requests_total",
            Help: "Total number of rate-limited requests",
        },
        []string{"level", "result"},
    )

    currentUsage = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "rate_limit_current_usage",
            Help: "Current rate limit usage",
        },
        []string{"level", "key"},
    )

    rejectedRequests = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "rate_limit_rejected_total",
            Help: "Total number of rejected requests",
        },
        []string{"level", "route"},
    )
)

// RecordRequest records a rate limit check
func RecordRequest(level Level, allowed bool) {
    result := "allowed"
    if !allowed {
        result = "rejected"
    }
    requestsTotal.WithLabelValues(string(level), result).Inc()
}

// RecordRejection records a rejected request
func RecordRejection(level Level, route string) {
    rejectedRequests.WithLabelValues(string(level), route).Inc()
}

// UpdateUsage updates the current usage gauge
func UpdateUsage(level Level, key string, remaining int64, limit int64) {
    usage := float64(limit-remaining) / float64(limit)
    currentUsage.WithLabelValues(string(level), key).Set(usage)
}
```

## Configuration

```yaml
# config/rate_limit.yaml
rate_limit:
  enabled: true

  # Global limits
  global:
    requests_per_minute: 10000

  # Default per-tenant limits
  default_tenant:
    requests_per_minute: 1000
    requests_per_day: 100000

  # Per-IP limits
  ip:
    requests_per_minute: 500
    requests_per_second: 50

  # Per-user limits
  user:
    requests_per_minute: 100

  # Route-specific overrides
  routes:
    - pattern: "/api/v1/auth/login"
      method: "POST"
      limit: 5
      window: "1m"
      by_ip: true

    - pattern: "/api/v1/products/search"
      method: "GET"
      limit: 60
      window: "1m"
      by_tenant: true

    - pattern: "/api/v1/webhooks/*"
      method: "POST"
      limit: 1000
      window: "1m"
      by_tenant: true

  # Plan overrides
  plans:
    starter:
      api_requests_per_minute: 100
      api_requests_per_day: 10000
    business:
      api_requests_per_minute: 500
      api_requests_per_day: 100000
    enterprise:
      api_requests_per_minute: 2000
      api_requests_per_day: 1000000

  # Headers
  headers:
    limit: "X-RateLimit-Limit"
    remaining: "X-RateLimit-Remaining"
    reset: "X-RateLimit-Reset"
    retry_after: "Retry-After"
```

## Тестування

```go
// internal/ratelimit/limiter_test.go
package ratelimit

import (
    "context"
    "testing"
    "time"

    "github.com/alicebob/miniredis/v2"
    "github.com/redis/go-redis/v9"
    "github.com/stretchr/testify/assert"
)

func setupTestRedis(t *testing.T) *redis.Client {
    mr := miniredis.RunT(t)
    return redis.NewClient(&redis.Options{
        Addr: mr.Addr(),
    })
}

func TestTokenBucket(t *testing.T) {
    client := setupTestRedis(t)
    tb := NewTokenBucket(client, 10, 100, "test")

    ctx := context.Background()

    // Should allow requests up to capacity
    for i := 0; i < 100; i++ {
        allowed, info, err := tb.Allow(ctx, "user1")
        assert.NoError(t, err)
        assert.True(t, allowed)
        assert.Equal(t, int64(100), info.Limit)
    }

    // Should reject after capacity is exhausted
    allowed, _, err := tb.Allow(ctx, "user1")
    assert.NoError(t, err)
    assert.False(t, allowed)
}

func TestSlidingWindow(t *testing.T) {
    client := setupTestRedis(t)
    sw := NewSlidingWindow(client, 10, time.Minute, "test")

    ctx := context.Background()

    // Should allow up to limit
    for i := 0; i < 10; i++ {
        allowed, info, err := sw.Allow(ctx, "user1")
        assert.NoError(t, err)
        assert.True(t, allowed)
        assert.Equal(t, int64(9-i), info.Remaining)
    }

    // Should reject after limit
    allowed, info, err := sw.Allow(ctx, "user1")
    assert.NoError(t, err)
    assert.False(t, allowed)
    assert.Equal(t, int64(0), info.Remaining)
}

func TestMultiLevelLimiter(t *testing.T) {
    client := setupTestRedis(t)

    limiter := NewMultiLevelLimiter()
    limiter.AddLevel(
        LevelGlobal,
        NewSlidingWindow(client, 100, time.Minute, "rl:global"),
        func(ctx context.Context) string { return "global" },
    )
    limiter.AddLevel(
        LevelUser,
        NewSlidingWindow(client, 10, time.Minute, "rl:user"),
        func(ctx context.Context) string { return "user1" },
    )

    ctx := context.Background()

    // Should allow up to user limit
    for i := 0; i < 10; i++ {
        allowed, _, err := limiter.Allow(ctx)
        assert.NoError(t, err)
        assert.True(t, allowed)
    }

    // Should reject due to user limit
    allowed, results, err := limiter.Allow(ctx)
    assert.NoError(t, err)
    assert.False(t, allowed)
    assert.Equal(t, int64(0), results[LevelUser].Remaining)
    assert.Greater(t, results[LevelGlobal].Remaining, int64(0))
}
```

## Див. також

- [Circuit Breaker](./CIRCUIT_BREAKER.md)
- [Multi-tenancy](./MULTI_TENANCY.md)
- [API Reference](../api/OPENAPI.md)
