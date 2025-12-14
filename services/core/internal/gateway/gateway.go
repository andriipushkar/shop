package gateway

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Errors
var (
	ErrRateLimitExceeded = errors.New("rate limit exceeded")
	ErrAPIKeyNotFound    = errors.New("API key not found")
	ErrAPIKeyInvalid     = errors.New("API key is invalid or expired")
	ErrQuotaExceeded     = errors.New("API quota exceeded")
	ErrUnauthorized      = errors.New("unauthorized")
)

// RateLimitConfig defines rate limiting configuration
type RateLimitConfig struct {
	RequestsPerSecond int           `json:"requests_per_second"`
	RequestsPerMinute int           `json:"requests_per_minute"`
	RequestsPerHour   int           `json:"requests_per_hour"`
	RequestsPerDay    int           `json:"requests_per_day"`
	BurstSize         int           `json:"burst_size"`
	Window            time.Duration `json:"window"`
}

// TierLimits defines limits for different tiers
var TierLimits = map[string]RateLimitConfig{
	"free": {
		RequestsPerSecond: 1,
		RequestsPerMinute: 60,
		RequestsPerHour:   1000,
		RequestsPerDay:    10000,
		BurstSize:         5,
	},
	"starter": {
		RequestsPerSecond: 10,
		RequestsPerMinute: 600,
		RequestsPerHour:   10000,
		RequestsPerDay:    100000,
		BurstSize:         20,
	},
	"professional": {
		RequestsPerSecond: 50,
		RequestsPerMinute: 3000,
		RequestsPerHour:   50000,
		RequestsPerDay:    500000,
		BurstSize:         100,
	},
	"enterprise": {
		RequestsPerSecond: 200,
		RequestsPerMinute: 12000,
		RequestsPerHour:   200000,
		RequestsPerDay:    -1, // unlimited
		BurstSize:         500,
	},
}

// EndpointLimits defines per-endpoint limits
var EndpointLimits = map[string]RateLimitConfig{
	"/api/v1/products": {
		RequestsPerMinute: 120,
		BurstSize:         30,
	},
	"/api/v1/orders": {
		RequestsPerMinute: 60,
		BurstSize:         10,
	},
	"/api/v1/search": {
		RequestsPerMinute: 30,
		BurstSize:         5,
	},
	"/api/v1/webhooks": {
		RequestsPerMinute: 10,
		BurstSize:         3,
	},
	"/api/v1/export": {
		RequestsPerMinute: 5,
		BurstSize:         2,
	},
}

// APIKey represents an API key
type APIKey struct {
	ID          string            `json:"id"`
	Key         string            `json:"key"`
	TenantID    string            `json:"tenant_id"`
	Name        string            `json:"name"`
	Tier        string            `json:"tier"`
	Scopes      []string          `json:"scopes"`
	IsActive    bool              `json:"is_active"`
	RateLimit   *RateLimitConfig  `json:"rate_limit,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	ExpiresAt   *time.Time        `json:"expires_at,omitempty"`
	LastUsedAt  *time.Time        `json:"last_used_at,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
}

// UsageMetrics tracks API usage
type UsageMetrics struct {
	TenantID       string    `json:"tenant_id"`
	APIKeyID       string    `json:"api_key_id"`
	Endpoint       string    `json:"endpoint"`
	Method         string    `json:"method"`
	StatusCode     int       `json:"status_code"`
	RequestSize    int64     `json:"request_size"`
	ResponseSize   int64     `json:"response_size"`
	Latency        int64     `json:"latency_ms"`
	Timestamp      time.Time `json:"timestamp"`
	ClientIP       string    `json:"client_ip,omitempty"`
	UserAgent      string    `json:"user_agent,omitempty"`
}

// RateLimitInfo contains rate limit status
type RateLimitInfo struct {
	Limit      int   `json:"limit"`
	Remaining  int   `json:"remaining"`
	Reset      int64 `json:"reset"`
	RetryAfter int   `json:"retry_after,omitempty"`
}

// Repository interface for gateway data
type Repository interface {
	// API Keys
	GetAPIKey(ctx context.Context, key string) (*APIKey, error)
	GetAPIKeyByID(ctx context.Context, id string) (*APIKey, error)
	ListAPIKeys(ctx context.Context, tenantID string) ([]*APIKey, error)
	CreateAPIKey(ctx context.Context, key *APIKey) error
	UpdateAPIKey(ctx context.Context, key *APIKey) error
	DeleteAPIKey(ctx context.Context, id string) error
	UpdateLastUsed(ctx context.Context, keyID string) error

	// Usage metrics
	RecordUsage(ctx context.Context, metrics *UsageMetrics) error
	GetUsageStats(ctx context.Context, tenantID string, start, end time.Time) (*UsageStats, error)
}

// UsageStats aggregated usage statistics
type UsageStats struct {
	TenantID        string         `json:"tenant_id"`
	Period          string         `json:"period"`
	TotalRequests   int64          `json:"total_requests"`
	SuccessRequests int64          `json:"success_requests"`
	ErrorRequests   int64          `json:"error_requests"`
	TotalLatencyMs  int64          `json:"total_latency_ms"`
	AvgLatencyMs    float64        `json:"avg_latency_ms"`
	TotalBandwidth  int64          `json:"total_bandwidth"`
	ByEndpoint      map[string]int64 `json:"by_endpoint"`
	ByStatusCode    map[int]int64    `json:"by_status_code"`
}

// Gateway handles API gateway functionality
type Gateway struct {
	repo        Repository
	redis       *redis.Client
	cache       sync.Map
	metricsQueue chan *UsageMetrics
	done        chan struct{}
}

// NewGateway creates new API gateway
func NewGateway(repo Repository, redis *redis.Client) *Gateway {
	gw := &Gateway{
		repo:         repo,
		redis:        redis,
		metricsQueue: make(chan *UsageMetrics, 10000),
		done:         make(chan struct{}),
	}

	// Start metrics worker
	go gw.metricsWorker()

	return gw
}

// Stop stops the gateway
func (g *Gateway) Stop() {
	close(g.done)
}

// ValidateAPIKey validates an API key
func (g *Gateway) ValidateAPIKey(ctx context.Context, key string) (*APIKey, error) {
	// Check cache first
	if cached, ok := g.cache.Load(key); ok {
		apiKey := cached.(*APIKey)
		if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
			g.cache.Delete(key)
			return nil, ErrAPIKeyInvalid
		}
		return apiKey, nil
	}

	// Get from repository
	apiKey, err := g.repo.GetAPIKey(ctx, key)
	if err != nil {
		return nil, ErrAPIKeyNotFound
	}

	if !apiKey.IsActive {
		return nil, ErrAPIKeyInvalid
	}

	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
		return nil, ErrAPIKeyInvalid
	}

	// Cache for 5 minutes
	g.cache.Store(key, apiKey)
	go func() {
		time.Sleep(5 * time.Minute)
		g.cache.Delete(key)
	}()

	// Update last used (async)
	go g.repo.UpdateLastUsed(context.Background(), apiKey.ID)

	return apiKey, nil
}

// CheckRateLimit checks rate limit for a request
func (g *Gateway) CheckRateLimit(ctx context.Context, tenantID, endpoint string, tier string) (*RateLimitInfo, error) {
	config := TierLimits[tier]
	if config.RequestsPerMinute == 0 {
		config = TierLimits["free"]
	}

	// Check endpoint-specific limits
	if epConfig, ok := EndpointLimits[endpoint]; ok {
		if epConfig.RequestsPerMinute < config.RequestsPerMinute {
			config.RequestsPerMinute = epConfig.RequestsPerMinute
			config.BurstSize = epConfig.BurstSize
		}
	}

	// Use sliding window rate limiting
	key := fmt.Sprintf("ratelimit:%s:%s:minute", tenantID, endpoint)
	now := time.Now()
	windowStart := now.Truncate(time.Minute)
	windowEnd := windowStart.Add(time.Minute)

	pipe := g.redis.Pipeline()

	// Add current request timestamp
	pipe.ZAdd(ctx, key, redis.Z{
		Score:  float64(now.UnixNano()),
		Member: now.UnixNano(),
	})

	// Remove old entries
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(windowStart.UnixNano(), 10))

	// Count requests in current window
	countCmd := pipe.ZCard(ctx, key)

	// Set expiry
	pipe.Expire(ctx, key, time.Minute*2)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, err
	}

	count := int(countCmd.Val())
	remaining := config.RequestsPerMinute - count
	if remaining < 0 {
		remaining = 0
	}

	info := &RateLimitInfo{
		Limit:     config.RequestsPerMinute,
		Remaining: remaining,
		Reset:     windowEnd.Unix(),
	}

	if count > config.RequestsPerMinute {
		info.RetryAfter = int(windowEnd.Sub(now).Seconds())
		return info, ErrRateLimitExceeded
	}

	return info, nil
}

// RecordMetrics records API usage metrics
func (g *Gateway) RecordMetrics(metrics *UsageMetrics) {
	select {
	case g.metricsQueue <- metrics:
	default:
		// Queue full, drop metrics
	}
}

// metricsWorker processes metrics queue
func (g *Gateway) metricsWorker() {
	batch := make([]*UsageMetrics, 0, 100)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-g.done:
			// Flush remaining
			g.flushMetrics(batch)
			return
		case m := <-g.metricsQueue:
			batch = append(batch, m)
			if len(batch) >= 100 {
				g.flushMetrics(batch)
				batch = make([]*UsageMetrics, 0, 100)
			}
		case <-ticker.C:
			if len(batch) > 0 {
				g.flushMetrics(batch)
				batch = make([]*UsageMetrics, 0, 100)
			}
		}
	}
}

func (g *Gateway) flushMetrics(batch []*UsageMetrics) {
	ctx := context.Background()
	for _, m := range batch {
		g.repo.RecordUsage(ctx, m)

		// Update real-time counters in Redis
		key := fmt.Sprintf("usage:%s:%s", m.TenantID, time.Now().Format("2006-01-02"))
		g.redis.HIncrBy(ctx, key, "requests", 1)
		g.redis.HIncrBy(ctx, key, "bandwidth", m.RequestSize+m.ResponseSize)
		g.redis.HIncrBy(ctx, key, "latency_sum", m.Latency)
		g.redis.Expire(ctx, key, 48*time.Hour)
	}
}

// GetUsageStats returns usage statistics
func (g *Gateway) GetUsageStats(ctx context.Context, tenantID string, start, end time.Time) (*UsageStats, error) {
	return g.repo.GetUsageStats(ctx, tenantID, start, end)
}

// Middleware returns HTTP middleware for API gateway
func (g *Gateway) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		start := time.Now()

		// Extract API key
		apiKey := r.Header.Get("X-API-Key")
		if apiKey == "" {
			apiKey = r.Header.Get("Authorization")
			if strings.HasPrefix(apiKey, "Bearer ") {
				apiKey = strings.TrimPrefix(apiKey, "Bearer ")
			}
		}

		if apiKey == "" {
			http.Error(w, `{"error":"API key required"}`, http.StatusUnauthorized)
			return
		}

		// Validate API key
		key, err := g.ValidateAPIKey(ctx, apiKey)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnauthorized)
			return
		}

		// Check rate limit
		endpoint := normalizeEndpoint(r.URL.Path)
		info, err := g.CheckRateLimit(ctx, key.TenantID, endpoint, key.Tier)

		// Add rate limit headers
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(info.Limit))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(info.Remaining))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(info.Reset, 10))

		if err != nil {
			w.Header().Set("Retry-After", strconv.Itoa(info.RetryAfter))
			http.Error(w, `{"error":"Rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}

		// Add context values
		ctx = context.WithValue(ctx, "tenant_id", key.TenantID)
		ctx = context.WithValue(ctx, "api_key_id", key.ID)
		ctx = context.WithValue(ctx, "tier", key.Tier)

		// Wrap response writer to capture status code and size
		wrapped := &responseWriter{ResponseWriter: w, status: 200}

		// Call next handler
		next.ServeHTTP(wrapped, r.WithContext(ctx))

		// Record metrics
		g.RecordMetrics(&UsageMetrics{
			TenantID:     key.TenantID,
			APIKeyID:     key.ID,
			Endpoint:     endpoint,
			Method:       r.Method,
			StatusCode:   wrapped.status,
			RequestSize:  r.ContentLength,
			ResponseSize: int64(wrapped.size),
			Latency:      time.Since(start).Milliseconds(),
			Timestamp:    start,
			ClientIP:     getClientIP(r),
			UserAgent:    r.UserAgent(),
		})
	})
}

// responseWriter wraps http.ResponseWriter to capture response details
type responseWriter struct {
	http.ResponseWriter
	status int
	size   int
}

func (w *responseWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.size += n
	return n, err
}

func normalizeEndpoint(path string) string {
	// Remove IDs from path for grouping
	parts := strings.Split(path, "/")
	for i, part := range parts {
		// Check if part looks like an ID (UUID, numeric, etc.)
		if len(part) > 20 || isNumeric(part) {
			parts[i] = "{id}"
		}
	}
	return strings.Join(parts, "/")
}

func isNumeric(s string) bool {
	_, err := strconv.Atoi(s)
	return err == nil
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	return strings.Split(r.RemoteAddr, ":")[0]
}

// CreateAPIKeyRequest represents API key creation request
type CreateAPIKeyRequest struct {
	Name      string            `json:"name"`
	Scopes    []string          `json:"scopes"`
	ExpiresIn *time.Duration    `json:"expires_in,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// CreateAPIKey creates a new API key
func (g *Gateway) CreateAPIKey(ctx context.Context, tenantID string, tier string, req CreateAPIKeyRequest) (*APIKey, error) {
	key := &APIKey{
		ID:        generateID("key"),
		Key:       generateSecureKey(),
		TenantID:  tenantID,
		Name:      req.Name,
		Tier:      tier,
		Scopes:    req.Scopes,
		IsActive:  true,
		Metadata:  req.Metadata,
		CreatedAt: time.Now(),
	}

	if req.ExpiresIn != nil {
		expiresAt := time.Now().Add(*req.ExpiresIn)
		key.ExpiresAt = &expiresAt
	}

	if err := g.repo.CreateAPIKey(ctx, key); err != nil {
		return nil, err
	}

	return key, nil
}

// RevokeAPIKey revokes an API key
func (g *Gateway) RevokeAPIKey(ctx context.Context, keyID string) error {
	key, err := g.repo.GetAPIKeyByID(ctx, keyID)
	if err != nil {
		return err
	}

	key.IsActive = false
	g.cache.Delete(key.Key)

	return g.repo.UpdateAPIKey(ctx, key)
}

// ListAPIKeys lists API keys for a tenant
func (g *Gateway) ListAPIKeys(ctx context.Context, tenantID string) ([]*APIKey, error) {
	return g.repo.ListAPIKeys(ctx, tenantID)
}

// Helper functions
func generateID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func generateSecureKey() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return fmt.Sprintf("sk_%s", hex.EncodeToString(b))
}

// ==================== HTTP Handlers ====================

// Handler returns HTTP handlers for gateway management
type Handler struct {
	gateway *Gateway
}

// NewHandler creates gateway HTTP handler
func NewHandler(gw *Gateway) *Handler {
	return &Handler{gateway: gw}
}

// HandleListKeys handles GET /api/v1/api-keys
func (h *Handler) HandleListKeys(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenant_id").(string)

	keys, err := h.gateway.ListAPIKeys(r.Context(), tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Mask keys for security
	for _, key := range keys {
		key.Key = maskKey(key.Key)
	}

	json.NewEncoder(w).Encode(keys)
}

// HandleCreateKey handles POST /api/v1/api-keys
func (h *Handler) HandleCreateKey(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenant_id").(string)
	tier := r.Context().Value("tier").(string)

	var req CreateAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	key, err := h.gateway.CreateAPIKey(r.Context(), tenantID, tier, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(key)
}

// HandleRevokeKey handles DELETE /api/v1/api-keys/{id}
func (h *Handler) HandleRevokeKey(w http.ResponseWriter, r *http.Request) {
	keyID := r.PathValue("id")
	if keyID == "" {
		http.Error(w, "key ID required", http.StatusBadRequest)
		return
	}

	if err := h.gateway.RevokeAPIKey(r.Context(), keyID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleGetUsage handles GET /api/v1/usage
func (h *Handler) HandleGetUsage(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenant_id").(string)

	// Parse date range
	start, _ := time.Parse(time.RFC3339, r.URL.Query().Get("start"))
	end, _ := time.Parse(time.RFC3339, r.URL.Query().Get("end"))

	if start.IsZero() {
		start = time.Now().AddDate(0, 0, -30) // Last 30 days
	}
	if end.IsZero() {
		end = time.Now()
	}

	stats, err := h.gateway.GetUsageStats(r.Context(), tenantID, start, end)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}

func maskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
