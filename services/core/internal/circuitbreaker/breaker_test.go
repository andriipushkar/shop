package circuitbreaker

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sony/gobreaker"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig("test-breaker")

	if cfg.Name != "test-breaker" {
		t.Errorf("expected name 'test-breaker', got '%s'", cfg.Name)
	}
	if cfg.MaxRequests != 3 {
		t.Errorf("expected MaxRequests 3, got %d", cfg.MaxRequests)
	}
	if cfg.Interval != 10*time.Second {
		t.Errorf("expected Interval 10s, got %v", cfg.Interval)
	}
	if cfg.Timeout != 30*time.Second {
		t.Errorf("expected Timeout 30s, got %v", cfg.Timeout)
	}
	if cfg.FailureRatio != 0.6 {
		t.Errorf("expected FailureRatio 0.6, got %f", cfg.FailureRatio)
	}
	if cfg.MinRequests != 5 {
		t.Errorf("expected MinRequests 5, got %d", cfg.MinRequests)
	}
}

func TestNew(t *testing.T) {
	cfg := DefaultConfig("test")
	breaker := New(cfg)

	if breaker == nil {
		t.Fatal("expected non-nil breaker")
	}
	if breaker.cb == nil {
		t.Error("expected non-nil internal circuit breaker")
	}
}

func TestBreaker_Execute_Success(t *testing.T) {
	cfg := DefaultConfig("test")
	breaker := New(cfg)

	result, err := breaker.Execute(func() (interface{}, error) {
		return "success", nil
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "success" {
		t.Errorf("expected result 'success', got '%v'", result)
	}
}

func TestBreaker_Execute_Error(t *testing.T) {
	cfg := DefaultConfig("test")
	breaker := New(cfg)

	expectedErr := errors.New("test error")
	result, err := breaker.Execute(func() (interface{}, error) {
		return nil, expectedErr
	})

	if err != expectedErr {
		t.Errorf("expected error '%v', got '%v'", expectedErr, err)
	}
	if result != nil {
		t.Errorf("expected nil result, got '%v'", result)
	}
}

func TestBreaker_State(t *testing.T) {
	cfg := DefaultConfig("test")
	breaker := New(cfg)

	state := breaker.State()
	if state != gobreaker.StateClosed {
		t.Errorf("expected state Closed, got %v", state)
	}
}

func TestBreaker_Counts(t *testing.T) {
	cfg := DefaultConfig("test")
	breaker := New(cfg)

	// Execute some successful requests
	breaker.Execute(func() (interface{}, error) { return nil, nil })
	breaker.Execute(func() (interface{}, error) { return nil, nil })

	counts := breaker.Counts()
	if counts.Requests < 2 {
		t.Errorf("expected at least 2 requests, got %d", counts.Requests)
	}
}

func TestBreaker_Trip(t *testing.T) {
	cfg := Config{
		Name:         "test",
		MaxRequests:  1,
		Interval:     time.Second,
		Timeout:      100 * time.Millisecond,
		FailureRatio: 0.5,
		MinRequests:  2,
	}
	breaker := New(cfg)

	testErr := errors.New("failure")

	// Generate failures to trip the breaker
	for i := 0; i < 5; i++ {
		breaker.Execute(func() (interface{}, error) {
			return nil, testErr
		})
	}

	// Check if breaker is open
	state := breaker.State()
	if state != gobreaker.StateOpen {
		t.Errorf("expected state Open after failures, got %v", state)
	}
}

func TestNewHTTPClient(t *testing.T) {
	cfg := DefaultConfig("http-client")
	client := NewHTTPClient(cfg, 10*time.Second)

	if client == nil {
		t.Fatal("expected non-nil HTTP client")
	}
	if client.client == nil {
		t.Error("expected non-nil internal HTTP client")
	}
	if client.breaker == nil {
		t.Error("expected non-nil breaker")
	}
}

func TestHTTPClient_Get_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	cfg := DefaultConfig("http-test")
	client := NewHTTPClient(cfg, 10*time.Second)

	resp, err := client.Get(server.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestHTTPClient_Get_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := DefaultConfig("http-test")
	client := NewHTTPClient(cfg, 10*time.Second)

	resp, err := client.Get(server.URL)
	if err == nil {
		t.Error("expected error for 5xx response")
	}
	if resp != nil {
		resp.Body.Close()
	}
}

func TestHTTPClient_State(t *testing.T) {
	cfg := DefaultConfig("http-test")
	client := NewHTTPClient(cfg, 10*time.Second)

	state := client.State()
	if state != "closed" {
		t.Errorf("expected state 'closed', got '%s'", state)
	}
}

func TestNewManager(t *testing.T) {
	manager := NewManager()

	if manager == nil {
		t.Fatal("expected non-nil manager")
	}
	if manager.breakers == nil {
		t.Error("expected breakers map to be initialized")
	}
}

func TestManager_Get(t *testing.T) {
	manager := NewManager()

	breaker1 := manager.Get("service-a")
	breaker2 := manager.Get("service-b")

	if breaker1 == nil || breaker2 == nil {
		t.Fatal("expected non-nil breakers")
	}

	// Same name should return same breaker
	breaker1Again := manager.Get("service-a")
	if breaker1 != breaker1Again {
		t.Error("expected same breaker instance for same name")
	}
}

func TestManager_GetWithConfig(t *testing.T) {
	manager := NewManager()

	cfg := Config{
		Name:         "custom-breaker",
		MaxRequests:  10,
		Interval:     time.Minute,
		Timeout:      time.Minute,
		FailureRatio: 0.8,
		MinRequests:  10,
	}

	breaker := manager.GetWithConfig(cfg)
	if breaker == nil {
		t.Fatal("expected non-nil breaker")
	}

	// Same name should return same breaker
	breakerAgain := manager.GetWithConfig(cfg)
	if breaker != breakerAgain {
		t.Error("expected same breaker instance for same config name")
	}
}

func TestManager_States(t *testing.T) {
	manager := NewManager()

	manager.Get("service-a")
	manager.Get("service-b")

	states := manager.States()

	if len(states) != 2 {
		t.Errorf("expected 2 states, got %d", len(states))
	}
	if states["service-a"] != "closed" {
		t.Errorf("expected service-a state 'closed', got '%s'", states["service-a"])
	}
	if states["service-b"] != "closed" {
		t.Errorf("expected service-b state 'closed', got '%s'", states["service-b"])
	}
}

func TestErrCircuitOpen(t *testing.T) {
	if ErrCircuitOpen.Error() != "circuit breaker is open" {
		t.Errorf("unexpected error message: %s", ErrCircuitOpen.Error())
	}
}
