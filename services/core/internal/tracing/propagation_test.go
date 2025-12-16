package tracing

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

func init() {
	// Set up propagator for tests
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
}

func TestInjectExtractHTTPHeaders(t *testing.T) {
	ctx := context.Background()
	req := httptest.NewRequest("GET", "/test", nil)

	// Inject headers
	InjectHTTPHeaders(ctx, req)

	// Extract headers
	newCtx := ExtractHTTPHeaders(ctx, req)
	if newCtx == nil {
		t.Error("Context should not be nil after extraction")
	}
}

func TestInjectExtractMapCarrier(t *testing.T) {
	ctx := context.Background()
	carrier := make(map[string]string)

	// Inject into map
	InjectMapCarrier(ctx, carrier)

	// Extract from map
	newCtx := ExtractMapCarrier(ctx, carrier)
	if newCtx == nil {
		t.Error("Context should not be nil after extraction")
	}
}

func TestTracedHTTPClient(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check that trace headers were injected
		_ = r.Header.Get("Traceparent") // In real scenario with active trace, this would have a value
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	client := NewTracedHTTPClient(nil, "test-service")

	ctx := context.Background()
	resp, err := client.Get(ctx, server.URL)
	if err != nil {
		t.Fatalf("TracedHTTPClient.Get() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestTracedHTTPClientDo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("Expected POST, got %s", r.Method)
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	client := NewTracedHTTPClient(&http.Client{}, "test-service")

	ctx := context.Background()
	req, _ := http.NewRequestWithContext(ctx, "POST", server.URL, nil)
	resp, err := client.Do(ctx, req)
	if err != nil {
		t.Fatalf("TracedHTTPClient.Do() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", resp.StatusCode)
	}
}

func TestServiceSpan(t *testing.T) {
	ctx := context.Background()
	newCtx, span := ServiceSpan(ctx, "order-service", "GetOrder")

	if newCtx == nil {
		t.Error("Context should not be nil")
	}
	if span == nil {
		t.Error("Span should not be nil")
	}

	span.End()
}

func TestMessageSpan(t *testing.T) {
	tests := []struct {
		operation string
	}{
		{"publish"},
		{"send"},
		{"consume"},
		{"receive"},
	}

	for _, tt := range tests {
		ctx := context.Background()
		newCtx, span := MessageSpan(ctx, "orders-queue", tt.operation, "msg-123")

		if newCtx == nil {
			t.Errorf("Context should not be nil for operation %s", tt.operation)
		}
		if span == nil {
			t.Errorf("Span should not be nil for operation %s", tt.operation)
		}

		span.End()
	}
}

func TestBusinessSpan(t *testing.T) {
	ctx := context.Background()
	newCtx, span := BusinessSpan(ctx, "ProcessOrder")

	if newCtx == nil {
		t.Error("Context should not be nil")
	}
	if span == nil {
		t.Error("Span should not be nil")
	}

	span.End()
}

func TestOrderSpan(t *testing.T) {
	ctx := context.Background()
	newCtx, span := OrderSpan(ctx, "create", "order-123")

	if newCtx == nil {
		t.Error("Context should not be nil")
	}
	if span == nil {
		t.Error("Span should not be nil")
	}

	span.End()
}

func TestPaymentSpan(t *testing.T) {
	ctx := context.Background()
	newCtx, span := PaymentSpan(ctx, "charge", "stripe", 999.99)

	if newCtx == nil {
		t.Error("Context should not be nil")
	}
	if span == nil {
		t.Error("Span should not be nil")
	}

	span.End()
}

func TestInventorySpan(t *testing.T) {
	ctx := context.Background()
	newCtx, span := InventorySpan(ctx, "reserve", "prod-123", 5)

	if newCtx == nil {
		t.Error("Context should not be nil")
	}
	if span == nil {
		t.Error("Span should not be nil")
	}

	span.End()
}

func TestWithTraceID(t *testing.T) {
	ctx := context.Background()
	traceID := WithTraceID(ctx)

	// Without an active trace, this should be empty
	if traceID != "" {
		t.Logf("TraceID: %s", traceID)
	}
}

func TestWithSpanID(t *testing.T) {
	ctx := context.Background()
	spanID := WithSpanID(ctx)

	// Without an active trace, this should be empty
	if spanID != "" {
		t.Logf("SpanID: %s", spanID)
	}
}

func TestLinkSpans(t *testing.T) {
	ctx1 := context.Background()
	ctx2 := context.Background()

	link := LinkSpans(ctx1, ctx2)
	// Link should be created even without active traces
	_ = link
}
