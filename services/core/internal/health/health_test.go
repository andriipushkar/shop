package health

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNew(t *testing.T) {
	h := New("1.0.0")

	if h.version != "1.0.0" {
		t.Errorf("New().version = %q, want %q", h.version, "1.0.0")
	}
	if h.timeout != 5*time.Second {
		t.Errorf("New().timeout = %v, want %v", h.timeout, 5*time.Second)
	}
	if h.checkers == nil {
		t.Error("New().checkers is nil")
	}
}

func TestHealth_Register(t *testing.T) {
	h := New("1.0.0")

	checker := func(ctx context.Context) CheckResult {
		return CheckResult{Status: StatusHealthy}
	}

	h.Register("test", checker)

	if len(h.checkers) != 1 {
		t.Errorf("Register() checkers count = %d, want 1", len(h.checkers))
	}
	if _, ok := h.checkers["test"]; !ok {
		t.Error("Register() 'test' checker not found")
	}
}

func TestHealth_Check(t *testing.T) {
	h := New("1.0.0")

	// Register healthy checker
	h.Register("healthy", func(ctx context.Context) CheckResult {
		return CheckResult{Status: StatusHealthy, Message: "ok"}
	})

	response := h.Check(context.Background())

	if response.Status != StatusHealthy {
		t.Errorf("Check().Status = %q, want %q", response.Status, StatusHealthy)
	}
	if response.Version != "1.0.0" {
		t.Errorf("Check().Version = %q, want %q", response.Version, "1.0.0")
	}
	if len(response.Components) != 1 {
		t.Errorf("Check().Components count = %d, want 1", len(response.Components))
	}
}

func TestHealth_Check_Degraded(t *testing.T) {
	h := New("1.0.0")

	h.Register("healthy", func(ctx context.Context) CheckResult {
		return CheckResult{Status: StatusHealthy}
	})
	h.Register("degraded", func(ctx context.Context) CheckResult {
		return CheckResult{Status: StatusDegraded}
	})

	response := h.Check(context.Background())

	if response.Status != StatusDegraded {
		t.Errorf("Check().Status = %q, want %q", response.Status, StatusDegraded)
	}
}

func TestHealth_Check_Unhealthy(t *testing.T) {
	h := New("1.0.0")

	h.Register("unhealthy", func(ctx context.Context) CheckResult {
		return CheckResult{Status: StatusUnhealthy}
	})

	response := h.Check(context.Background())

	if response.Status != StatusUnhealthy {
		t.Errorf("Check().Status = %q, want %q", response.Status, StatusUnhealthy)
	}
}

func TestHealth_Handler(t *testing.T) {
	h := New("1.0.0")
	h.Register("test", func(ctx context.Context) CheckResult {
		return CheckResult{Status: StatusHealthy}
	})

	handler := h.Handler()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Handler() status = %d, want %d", rec.Code, http.StatusOK)
	}

	var response Response
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("Handler() response decode error: %v", err)
	}

	if response.Status != StatusHealthy {
		t.Errorf("Handler() response.Status = %q, want %q", response.Status, StatusHealthy)
	}
}

func TestHealth_Handler_Unhealthy(t *testing.T) {
	h := New("1.0.0")
	h.Register("test", func(ctx context.Context) CheckResult {
		return CheckResult{Status: StatusUnhealthy}
	})

	handler := h.Handler()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("Handler() status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestLivenessHandler(t *testing.T) {
	handler := LivenessHandler()

	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("LivenessHandler() status = %d, want %d", rec.Code, http.StatusOK)
	}
	if rec.Body.String() != "OK" {
		t.Errorf("LivenessHandler() body = %q, want %q", rec.Body.String(), "OK")
	}
}

func TestRedisCacheChecker_Nil(t *testing.T) {
	checker := RedisCacheChecker(nil)
	result := checker(context.Background())

	if result.Status != StatusDegraded {
		t.Errorf("RedisCacheChecker(nil).Status = %q, want %q", result.Status, StatusDegraded)
	}
	if result.Message != "cache not configured" {
		t.Errorf("RedisCacheChecker(nil).Message = %q, want %q", result.Message, "cache not configured")
	}
}

type mockRedis struct {
	shouldError bool
}

func (m *mockRedis) Ping(ctx context.Context) error {
	if m.shouldError {
		return context.DeadlineExceeded
	}
	return nil
}

func TestRedisCacheChecker_Healthy(t *testing.T) {
	checker := RedisCacheChecker(&mockRedis{shouldError: false})
	result := checker(context.Background())

	if result.Status != StatusHealthy {
		t.Errorf("RedisCacheChecker.Status = %q, want %q", result.Status, StatusHealthy)
	}
}

func TestRedisCacheChecker_Error(t *testing.T) {
	checker := RedisCacheChecker(&mockRedis{shouldError: true})
	result := checker(context.Background())

	if result.Status != StatusDegraded {
		t.Errorf("RedisCacheChecker.Status = %q, want %q", result.Status, StatusDegraded)
	}
}

func TestElasticsearchChecker_Nil(t *testing.T) {
	checker := ElasticsearchChecker(nil)
	result := checker(context.Background())

	if result.Status != StatusDegraded {
		t.Errorf("ElasticsearchChecker(nil).Status = %q, want %q", result.Status, StatusDegraded)
	}
	if result.Message != "elasticsearch not configured" {
		t.Errorf("ElasticsearchChecker(nil).Message = %q, want %q", result.Message, "elasticsearch not configured")
	}
}

type mockElasticsearch struct {
	isHealthy bool
}

func (m *mockElasticsearch) Healthy(ctx context.Context) bool {
	return m.isHealthy
}

func TestElasticsearchChecker_Healthy(t *testing.T) {
	checker := ElasticsearchChecker(&mockElasticsearch{isHealthy: true})
	result := checker(context.Background())

	if result.Status != StatusHealthy {
		t.Errorf("ElasticsearchChecker.Status = %q, want %q", result.Status, StatusHealthy)
	}
	if result.Message != "connected" {
		t.Errorf("ElasticsearchChecker.Message = %q, want %q", result.Message, "connected")
	}
}

func TestElasticsearchChecker_Unhealthy(t *testing.T) {
	checker := ElasticsearchChecker(&mockElasticsearch{isHealthy: false})
	result := checker(context.Background())

	if result.Status != StatusDegraded {
		t.Errorf("ElasticsearchChecker.Status = %q, want %q", result.Status, StatusDegraded)
	}
	if result.Message != "elasticsearch unavailable" {
		t.Errorf("ElasticsearchChecker.Message = %q, want %q", result.Message, "elasticsearch unavailable")
	}
}

func TestMemoryChecker(t *testing.T) {
	checker := MemoryChecker(1024)
	result := checker(context.Background())

	if result.Status != StatusHealthy {
		t.Errorf("MemoryChecker.Status = %q, want %q", result.Status, StatusHealthy)
	}
}
