package logger

import (
	"os"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Level != "info" {
		t.Errorf("expected level 'info', got '%s'", cfg.Level)
	}
	if cfg.Pretty {
		t.Error("expected Pretty to be false")
	}
	if cfg.TimeFormat != time.RFC3339 {
		t.Errorf("expected TimeFormat RFC3339, got '%s'", cfg.TimeFormat)
	}
}

func TestInit(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Level = "debug"

	// Should not panic
	Init(cfg)

	logger := Get()
	if logger.GetLevel().String() != "debug" {
		t.Errorf("expected debug level, got %s", logger.GetLevel().String())
	}
}

func TestInit_Pretty(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Pretty = true

	// Should not panic with console writer
	Init(cfg)
}

func TestParseLevel(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"debug", "debug"},
		{"info", "info"},
		{"warn", "warn"},
		{"error", "error"},
		{"invalid", "info"}, // Default to info
		{"", "info"},        // Default to info
	}

	for _, tt := range tests {
		level := parseLevel(tt.input)
		if level.String() != tt.expected {
			t.Errorf("parseLevel(%q) = %s, want %s", tt.input, level.String(), tt.expected)
		}
	}
}

func TestInitFromEnv(t *testing.T) {
	// Save original values
	origLevel := os.Getenv("LOG_LEVEL")
	origPretty := os.Getenv("LOG_PRETTY")
	defer func() {
		os.Setenv("LOG_LEVEL", origLevel)
		os.Setenv("LOG_PRETTY", origPretty)
	}()

	// Set env vars
	os.Setenv("LOG_LEVEL", "warn")
	os.Setenv("LOG_PRETTY", "true")

	// Should not panic
	InitFromEnv()
}

func TestGet(t *testing.T) {
	Init(DefaultConfig())

	logger := Get()
	// Logger should not be zero value
	if logger.GetLevel().String() == "" {
		t.Error("expected initialized logger")
	}
}

func TestWithService(t *testing.T) {
	Init(DefaultConfig())

	serviceLogger := WithService("core-service")
	// Should return a valid logger
	if serviceLogger.GetLevel().String() == "" {
		t.Error("expected valid logger with service context")
	}
}

func TestWithRequestID(t *testing.T) {
	Init(DefaultConfig())

	reqLogger := WithRequestID("req-12345")
	// Should return a valid logger
	if reqLogger.GetLevel().String() == "" {
		t.Error("expected valid logger with request ID context")
	}
}

func TestWithUserID(t *testing.T) {
	Init(DefaultConfig())

	userLogger := WithUserID(12345)
	// Should return a valid logger
	if userLogger.GetLevel().String() == "" {
		t.Error("expected valid logger with user ID context")
	}
}

func TestLogFunctions(t *testing.T) {
	Init(DefaultConfig())

	// These should not panic
	Debug()
	Info()
	Warn()
	Error()
	// Don't test Fatal() as it would exit
}

func TestHTTPRequest(t *testing.T) {
	Init(DefaultConfig())

	// Should not panic
	HTTPRequest("GET", "/products", 200, 100*time.Millisecond)
	HTTPRequest("POST", "/orders", 201, 50*time.Millisecond)
	HTTPRequest("DELETE", "/products/1", 404, 10*time.Millisecond)
}

func TestDBQuery(t *testing.T) {
	Init(DefaultConfig())

	// Should not panic - successful query
	DBQuery("SELECT * FROM products", 5*time.Millisecond, nil)

	// Should not panic - failed query
	DBQuery("SELECT * FROM products WHERE id = ?", 10*time.Millisecond, os.ErrNotExist)
}

func TestCacheHit(t *testing.T) {
	Init(DefaultConfig())

	// Should not panic
	CacheHit("products:all")
	CacheHit("product:123")
}

func TestCacheMiss(t *testing.T) {
	Init(DefaultConfig())

	// Should not panic
	CacheMiss("products:all")
	CacheMiss("product:456")
}

func TestCacheInvalidate(t *testing.T) {
	Init(DefaultConfig())

	// Should not panic
	CacheInvalidate("products:all")
	CacheInvalidate("product:1", "product:2", "product:3")
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		input    string
		max      int
		expected string
	}{
		{"short", 10, "short"},
		{"exactly10!", 10, "exactly10!"},
		{"this is a long string", 10, "this is a ..."},
		{"", 10, ""},
		{"abc", 0, "..."},
	}

	for _, tt := range tests {
		result := truncate(tt.input, tt.max)
		if result != tt.expected {
			t.Errorf("truncate(%q, %d) = %q, want %q", tt.input, tt.max, result, tt.expected)
		}
	}
}
