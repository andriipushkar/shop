package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.RequestsPerSecond != 100 {
		t.Errorf("expected RequestsPerSecond 100, got %f", cfg.RequestsPerSecond)
	}
	if cfg.Burst != 200 {
		t.Errorf("expected Burst 200, got %d", cfg.Burst)
	}
	if cfg.CleanupInterval != time.Minute {
		t.Errorf("expected CleanupInterval 1m, got %v", cfg.CleanupInterval)
	}
	if cfg.TTL != 5*time.Minute {
		t.Errorf("expected TTL 5m, got %v", cfg.TTL)
	}
}

func TestNewIPRateLimiter(t *testing.T) {
	cfg := DefaultConfig()
	rl := NewIPRateLimiter(cfg)
	defer rl.Stop()

	if rl == nil {
		t.Fatal("expected non-nil rate limiter")
	}
	if rl.visitors == nil {
		t.Error("expected visitors map to be initialized")
	}
}

func TestIPRateLimiter_Allow(t *testing.T) {
	cfg := Config{
		RequestsPerSecond: 10,
		Burst:             10,
		CleanupInterval:   time.Hour,
		TTL:               time.Hour,
	}
	rl := NewIPRateLimiter(cfg)
	defer rl.Stop()

	ip := "192.168.1.1"

	// First 10 requests should be allowed (burst)
	for i := 0; i < 10; i++ {
		if !rl.Allow(ip) {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	// 11th request should be denied (burst exhausted)
	if rl.Allow(ip) {
		t.Error("request 11 should be denied")
	}
}

func TestIPRateLimiter_AllowDifferentIPs(t *testing.T) {
	cfg := Config{
		RequestsPerSecond: 1,
		Burst:             1,
		CleanupInterval:   time.Hour,
		TTL:               time.Hour,
	}
	rl := NewIPRateLimiter(cfg)
	defer rl.Stop()

	// Each IP gets its own rate limiter
	if !rl.Allow("192.168.1.1") {
		t.Error("first IP first request should be allowed")
	}
	if !rl.Allow("192.168.1.2") {
		t.Error("second IP first request should be allowed")
	}
	if !rl.Allow("192.168.1.3") {
		t.Error("third IP first request should be allowed")
	}

	// Second request from same IP should be denied
	if rl.Allow("192.168.1.1") {
		t.Error("first IP second request should be denied")
	}
}

func TestIPRateLimiter_Concurrent(t *testing.T) {
	cfg := Config{
		RequestsPerSecond: 1000,
		Burst:             1000,
		CleanupInterval:   time.Hour,
		TTL:               time.Hour,
	}
	rl := NewIPRateLimiter(cfg)
	defer rl.Stop()

	var wg sync.WaitGroup
	allowed := make(chan bool, 100)

	// 100 concurrent requests from different IPs
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			ip := "192.168.1." + string(rune(id%256))
			allowed <- rl.Allow(ip)
		}(i)
	}

	wg.Wait()
	close(allowed)

	count := 0
	for a := range allowed {
		if a {
			count++
		}
	}

	// Most requests should be allowed
	if count < 50 {
		t.Errorf("expected most requests to be allowed, got %d/100", count)
	}
}

func TestIPRateLimiter_Stats(t *testing.T) {
	cfg := Config{
		RequestsPerSecond: 100,
		Burst:             200,
		CleanupInterval:   time.Hour,
		TTL:               time.Hour,
	}
	rl := NewIPRateLimiter(cfg)
	defer rl.Stop()

	// Make some requests
	rl.Allow("192.168.1.1")
	rl.Allow("192.168.1.2")
	rl.Allow("192.168.1.3")

	stats := rl.Stats()

	if stats["active_visitors"].(int) != 3 {
		t.Errorf("expected 3 active visitors, got %v", stats["active_visitors"])
	}
	if stats["requests_per_second"].(float64) != 100 {
		t.Errorf("expected requests_per_second 100, got %v", stats["requests_per_second"])
	}
	if stats["burst"].(int) != 200 {
		t.Errorf("expected burst 200, got %v", stats["burst"])
	}
}

func TestIPRateLimiter_Middleware(t *testing.T) {
	cfg := Config{
		RequestsPerSecond: 100,
		Burst:             100,
		CleanupInterval:   time.Hour,
		TTL:               time.Hour,
	}
	rl := NewIPRateLimiter(cfg)
	defer rl.Stop()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	wrappedHandler := rl.Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

func TestIPRateLimiter_Middleware_TooManyRequests(t *testing.T) {
	cfg := Config{
		RequestsPerSecond: 1,
		Burst:             1,
		CleanupInterval:   time.Hour,
		TTL:               time.Hour,
	}
	rl := NewIPRateLimiter(cfg)
	defer rl.Stop()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrappedHandler := rl.Middleware(handler)

	// First request should succeed
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()
	wrappedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("first request: expected status 200, got %d", rec.Code)
	}

	// Second request should be rate limited
	rec2 := httptest.NewRecorder()
	wrappedHandler.ServeHTTP(rec2, req)

	if rec2.Code != http.StatusTooManyRequests {
		t.Errorf("second request: expected status 429, got %d", rec2.Code)
	}
}

func TestGetIP_XForwardedFor(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.1, 10.0.0.2")
	req.RemoteAddr = "192.168.1.1:12345"

	ip := getIP(req)
	if ip != "10.0.0.1" {
		t.Errorf("expected IP '10.0.0.1', got '%s'", ip)
	}
}

func TestGetIP_XForwardedFor_Single(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.1")
	req.RemoteAddr = "192.168.1.1:12345"

	ip := getIP(req)
	if ip != "10.0.0.1" {
		t.Errorf("expected IP '10.0.0.1', got '%s'", ip)
	}
}

func TestGetIP_XRealIP(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Real-IP", "10.0.0.5")
	req.RemoteAddr = "192.168.1.1:12345"

	ip := getIP(req)
	if ip != "10.0.0.5" {
		t.Errorf("expected IP '10.0.0.5', got '%s'", ip)
	}
}

func TestGetIP_RemoteAddr(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"

	ip := getIP(req)
	if ip != "192.168.1.1:12345" {
		t.Errorf("expected IP '192.168.1.1:12345', got '%s'", ip)
	}
}

func TestIPRateLimiter_Stop(t *testing.T) {
	cfg := Config{
		RequestsPerSecond: 100,
		Burst:             100,
		CleanupInterval:   100 * time.Millisecond,
		TTL:               time.Hour,
	}
	rl := NewIPRateLimiter(cfg)

	// Should not panic when stopping
	rl.Stop()

	// Should still allow requests after stop (limiter still works, just cleanup stopped)
	if !rl.Allow("192.168.1.1") {
		t.Error("should still allow requests after stop")
	}
}
