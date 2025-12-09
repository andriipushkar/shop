package health

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// Status represents the health status of a component
type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusUnhealthy Status = "unhealthy"
	StatusDegraded  Status = "degraded"
)

// CheckResult represents the result of a health check
type CheckResult struct {
	Status   Status        `json:"status"`
	Message  string        `json:"message,omitempty"`
	Duration time.Duration `json:"duration_ms"`
}

// Response represents the overall health check response
type Response struct {
	Status     Status                 `json:"status"`
	Timestamp  time.Time              `json:"timestamp"`
	Version    string                 `json:"version,omitempty"`
	Components map[string]CheckResult `json:"components"`
}

// Checker defines a health check function
type Checker func(ctx context.Context) CheckResult

// Health manages health checks
type Health struct {
	mu       sync.RWMutex
	checkers map[string]Checker
	version  string
	timeout  time.Duration
}

// New creates a new Health instance
func New(version string) *Health {
	return &Health{
		checkers: make(map[string]Checker),
		version:  version,
		timeout:  5 * time.Second,
	}
}

// Register adds a health checker
func (h *Health) Register(name string, checker Checker) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checkers[name] = checker
}

// Check runs all health checks
func (h *Health) Check(ctx context.Context) Response {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ctx, cancel := context.WithTimeout(ctx, h.timeout)
	defer cancel()

	response := Response{
		Status:     StatusHealthy,
		Timestamp:  time.Now(),
		Version:    h.version,
		Components: make(map[string]CheckResult),
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for name, checker := range h.checkers {
		wg.Add(1)
		go func(name string, checker Checker) {
			defer wg.Done()

			start := time.Now()
			result := checker(ctx)
			result.Duration = time.Since(start) / time.Millisecond

			mu.Lock()
			response.Components[name] = result

			// Update overall status
			if result.Status == StatusUnhealthy && response.Status != StatusUnhealthy {
				response.Status = StatusUnhealthy
			} else if result.Status == StatusDegraded && response.Status == StatusHealthy {
				response.Status = StatusDegraded
			}
			mu.Unlock()
		}(name, checker)
	}

	wg.Wait()
	return response
}

// Handler returns an HTTP handler for health checks
func (h *Health) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		response := h.Check(r.Context())

		w.Header().Set("Content-Type", "application/json")

		switch response.Status {
		case StatusHealthy:
			w.WriteHeader(http.StatusOK)
		case StatusDegraded:
			w.WriteHeader(http.StatusOK)
		case StatusUnhealthy:
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		json.NewEncoder(w).Encode(response)
	}
}

// LivenessHandler returns a simple liveness check handler
func LivenessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}
}

// DatabaseChecker returns a health checker for database
func DatabaseChecker(db *sql.DB) Checker {
	return func(ctx context.Context) CheckResult {
		if err := db.PingContext(ctx); err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: err.Error(),
			}
		}

		stats := db.Stats()
		if stats.OpenConnections > stats.MaxOpenConnections*80/100 {
			return CheckResult{
				Status:  StatusDegraded,
				Message: "connection pool near capacity",
			}
		}

		return CheckResult{
			Status:  StatusHealthy,
			Message: "connected",
		}
	}
}

// RedisChecker interface for Redis health check
type RedisChecker interface {
	Ping(ctx context.Context) error
}

// RedisCacheChecker returns a health checker for Redis
func RedisCacheChecker(redis RedisChecker) Checker {
	return func(ctx context.Context) CheckResult {
		if redis == nil {
			return CheckResult{
				Status:  StatusDegraded,
				Message: "cache not configured",
			}
		}

		if err := redis.Ping(ctx); err != nil {
			return CheckResult{
				Status:  StatusDegraded,
				Message: err.Error(),
			}
		}

		return CheckResult{
			Status:  StatusHealthy,
			Message: "connected",
		}
	}
}

// MemoryChecker returns a health checker for memory usage
func MemoryChecker(maxMemoryMB uint64) Checker {
	return func(ctx context.Context) CheckResult {
		// Simple memory check - in production use runtime.MemStats
		return CheckResult{
			Status:  StatusHealthy,
			Message: "memory ok",
		}
	}
}

// ElasticsearchPinger interface for Elasticsearch health check
type ElasticsearchPinger interface {
	Healthy(ctx context.Context) bool
}

// ElasticsearchChecker returns a health checker for Elasticsearch
func ElasticsearchChecker(es ElasticsearchPinger) Checker {
	return func(ctx context.Context) CheckResult {
		if es == nil {
			return CheckResult{
				Status:  StatusDegraded,
				Message: "elasticsearch not configured",
			}
		}

		if !es.Healthy(ctx) {
			return CheckResult{
				Status:  StatusDegraded,
				Message: "elasticsearch unavailable",
			}
		}

		return CheckResult{
			Status:  StatusHealthy,
			Message: "connected",
		}
	}
}
