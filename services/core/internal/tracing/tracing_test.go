package tracing

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.ServiceName != "core-service" {
		t.Errorf("DefaultConfig().ServiceName = %q, want %q", cfg.ServiceName, "core-service")
	}
	if cfg.ServiceVersion != "1.0.0" {
		t.Errorf("DefaultConfig().ServiceVersion = %q, want %q", cfg.ServiceVersion, "1.0.0")
	}
	if cfg.Environment != "development" {
		t.Errorf("DefaultConfig().Environment = %q, want %q", cfg.Environment, "development")
	}
	if cfg.SampleRate != 1.0 {
		t.Errorf("DefaultConfig().SampleRate = %f, want %f", cfg.SampleRate, 1.0)
	}
	if !cfg.Enabled {
		t.Error("DefaultConfig().Enabled = false, want true")
	}
}

func TestTracer_Disabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Enabled = false

	tracer, err := New(cfg)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	// Tracer should be created but with nil provider
	if tracer.provider != nil {
		t.Error("disabled tracer should have nil provider")
	}
	if tracer.tracer != nil {
		t.Error("disabled tracer should have nil tracer")
	}

	// Shutdown should not error
	err = tracer.Shutdown(context.Background())
	if err != nil {
		t.Errorf("Shutdown() error = %v, want nil", err)
	}
}

func TestTracer_Start_Disabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Enabled = false

	tracer, _ := New(cfg)

	ctx, span := tracer.Start(context.Background(), "test-span")
	if ctx == nil {
		t.Error("Start() returned nil context")
	}
	if span == nil {
		t.Error("Start() returned nil span")
	}
}

func TestTracer_Middleware_Disabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Enabled = false

	tracer, _ := New(cfg)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrappedHandler := tracer.Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Middleware handler returned status %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestResponseWriter(t *testing.T) {
	rec := httptest.NewRecorder()
	rw := &responseWriter{ResponseWriter: rec, statusCode: http.StatusOK}

	// Test WriteHeader
	rw.WriteHeader(http.StatusNotFound)
	if rw.statusCode != http.StatusNotFound {
		t.Errorf("responseWriter.statusCode = %d, want %d", rw.statusCode, http.StatusNotFound)
	}

	// Test that it also calls the underlying ResponseWriter
	if rec.Code != http.StatusNotFound {
		t.Errorf("underlying ResponseWriter.Code = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestSpanFromContext(t *testing.T) {
	// Test with empty context - should return noop span
	span := SpanFromContext(context.Background())
	if span == nil {
		t.Error("SpanFromContext() returned nil for empty context")
	}
}

func TestAddEvent(t *testing.T) {
	// Should not panic with empty context
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("AddEvent() panicked: %v", r)
		}
	}()

	AddEvent(context.Background(), "test-event")
}

func TestSetAttributes(t *testing.T) {
	// Should not panic with empty context
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("SetAttributes() panicked: %v", r)
		}
	}()

	SetAttributes(context.Background())
}

func TestRecordError(t *testing.T) {
	// Should not panic with empty context
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("RecordError() panicked: %v", r)
		}
	}()

	RecordError(context.Background(), nil)
}

func TestTracer_DBSpan_Disabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Enabled = false

	tracer, _ := New(cfg)

	ctx, span := tracer.DBSpan(context.Background(), "SELECT", "SELECT * FROM products")
	if ctx == nil {
		t.Error("DBSpan() returned nil context")
	}
	if span == nil {
		t.Error("DBSpan() returned nil span")
	}
}

func TestTracer_CacheSpan_Disabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Enabled = false

	tracer, _ := New(cfg)

	ctx, span := tracer.CacheSpan(context.Background(), "GET", "product:123")
	if ctx == nil {
		t.Error("CacheSpan() returned nil context")
	}
	if span == nil {
		t.Error("CacheSpan() returned nil span")
	}
}

func TestTracer_ExternalSpan_Disabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Enabled = false

	tracer, _ := New(cfg)

	ctx, span := tracer.ExternalSpan(context.Background(), "payment-service", "process")
	if ctx == nil {
		t.Error("ExternalSpan() returned nil context")
	}
	if span == nil {
		t.Error("ExternalSpan() returned nil span")
	}
}

func TestTracer_SearchSpan_Disabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Enabled = false

	tracer, _ := New(cfg)

	ctx, span := tracer.SearchSpan(context.Background(), "search", "test query")
	if ctx == nil {
		t.Error("SearchSpan() returned nil context")
	}
	if span == nil {
		t.Error("SearchSpan() returned nil span")
	}
}
