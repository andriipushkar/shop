package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Config holds rate limiter configuration
type Config struct {
	RequestsPerSecond float64       // Requests per second limit
	Burst             int           // Maximum burst size
	CleanupInterval   time.Duration // How often to clean up stale limiters
	TTL               time.Duration // Time to keep unused limiters
}

// DefaultConfig returns default rate limiter configuration
func DefaultConfig() Config {
	return Config{
		RequestsPerSecond: 100,
		Burst:             200,
		CleanupInterval:   time.Minute,
		TTL:               5 * time.Minute,
	}
}

// visitor holds rate limiter and last seen time for each visitor
type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// IPRateLimiter implements IP-based rate limiting
type IPRateLimiter struct {
	mu       sync.RWMutex
	visitors map[string]*visitor
	config   Config
	stop     chan struct{}
}

// NewIPRateLimiter creates a new IP-based rate limiter
func NewIPRateLimiter(cfg Config) *IPRateLimiter {
	rl := &IPRateLimiter{
		visitors: make(map[string]*visitor),
		config:   cfg,
		stop:     make(chan struct{}),
	}

	// Start cleanup goroutine
	go rl.cleanup()

	return rl
}

// getLimiter returns the rate limiter for the given IP
func (rl *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		limiter := rate.NewLimiter(rate.Limit(rl.config.RequestsPerSecond), rl.config.Burst)
		rl.visitors[ip] = &visitor{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

// Allow checks if a request from the given IP is allowed
func (rl *IPRateLimiter) Allow(ip string) bool {
	return rl.getLimiter(ip).Allow()
}

// cleanup removes stale visitors periodically
func (rl *IPRateLimiter) cleanup() {
	ticker := time.NewTicker(rl.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			for ip, v := range rl.visitors {
				if time.Since(v.lastSeen) > rl.config.TTL {
					delete(rl.visitors, ip)
				}
			}
			rl.mu.Unlock()
		case <-rl.stop:
			return
		}
	}
}

// Stop stops the cleanup goroutine
func (rl *IPRateLimiter) Stop() {
	close(rl.stop)
}

// Middleware returns an HTTP middleware for rate limiting
func (rl *IPRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getIP(r)

		if !rl.Allow(ip) {
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// getIP extracts the client IP from the request
func getIP(r *http.Request) string {
	// Check X-Forwarded-For header (for proxies)
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP if there are multiple
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// Stats returns current rate limiter statistics
func (rl *IPRateLimiter) Stats() map[string]interface{} {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	return map[string]interface{}{
		"active_visitors":     len(rl.visitors),
		"requests_per_second": rl.config.RequestsPerSecond,
		"burst":               rl.config.Burst,
	}
}
