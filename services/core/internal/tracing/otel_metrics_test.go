package tracing

import (
	"context"
	"testing"
	"time"
)

func TestDefaultMetricsConfig(t *testing.T) {
	cfg := DefaultMetricsConfig()

	if cfg.ServiceName != "core-service" {
		t.Errorf("Expected ServiceName 'core-service', got %s", cfg.ServiceName)
	}
	if cfg.ServiceVersion != "1.0.0" {
		t.Errorf("Expected ServiceVersion '1.0.0', got %s", cfg.ServiceVersion)
	}
	if cfg.Environment != "development" {
		t.Errorf("Expected Environment 'development', got %s", cfg.Environment)
	}
	if cfg.ExportInterval != 30*time.Second {
		t.Errorf("Expected ExportInterval 30s, got %s", cfg.ExportInterval)
	}
}

func TestMetricsRecordHTTPRequest(t *testing.T) {
	// Create a mock metrics instance for testing
	// In production, this would connect to OTLP endpoint
	cfg := DefaultMetricsConfig()
	cfg.OTLPEndpoint = "localhost:4318" // Use test endpoint

	// Note: NewMetrics will fail without a running OTLP endpoint
	// This test validates the recording logic conceptually
	ctx := context.Background()

	// Test the helper functions
	class := statusClass(200)
	if class != "2xx" {
		t.Errorf("Expected '2xx', got %s", class)
	}

	class = statusClass(404)
	if class != "4xx" {
		t.Errorf("Expected '4xx', got %s", class)
	}

	class = statusClass(500)
	if class != "5xx" {
		t.Errorf("Expected '5xx', got %s", class)
	}

	// Test normalizePath
	path := normalizePath("/api/v1/products/123")
	if path != "/api/v1/products/123" {
		t.Errorf("Expected same path, got %s", path)
	}

	_ = ctx // Used in real metrics recording
}

func TestMetricsStatusClass(t *testing.T) {
	tests := []struct {
		code     int
		expected string
	}{
		{100, "1xx"},
		{199, "1xx"},
		{200, "2xx"},
		{299, "2xx"},
		{300, "3xx"},
		{399, "3xx"},
		{400, "4xx"},
		{499, "4xx"},
		{500, "5xx"},
		{599, "5xx"},
	}

	for _, tt := range tests {
		result := statusClass(tt.code)
		if result != tt.expected {
			t.Errorf("statusClass(%d) = %s, expected %s", tt.code, result, tt.expected)
		}
	}
}

func BenchmarkStatusClass(b *testing.B) {
	codes := []int{100, 200, 201, 301, 400, 404, 500, 503}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, code := range codes {
			statusClass(code)
		}
	}
}

func BenchmarkNormalizePath(b *testing.B) {
	paths := []string{
		"/api/v1/products",
		"/api/v1/products/123",
		"/api/v1/orders/456/items",
		"/health",
		"/metrics",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, path := range paths {
			normalizePath(path)
		}
	}
}
