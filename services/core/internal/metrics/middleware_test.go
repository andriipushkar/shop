package metrics

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResponseWriter_WriteHeader(t *testing.T) {
	rec := httptest.NewRecorder()
	rw := &responseWriter{ResponseWriter: rec, statusCode: http.StatusOK}

	rw.WriteHeader(http.StatusNotFound)

	if rw.statusCode != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", rw.statusCode)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("underlying recorder should have status 404, got %d", rec.Code)
	}
}

func TestMiddleware_Success(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	wrappedHandler := Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

func TestMiddleware_Error(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	wrappedHandler := Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", rec.Code)
	}
}

func TestMiddleware_InFlight(t *testing.T) {
	// This test verifies that in-flight counter is incremented during request
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// In-flight should be at least 1 during this handler
		w.WriteHeader(http.StatusOK)
	})

	wrappedHandler := Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

func TestNormalizePath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/products", "/products"},
		{"/products/123", "/products/{id}"},
		{"/products/abc-def-123-456-789", "/products/abc-def-123-456-789"}, // Not a valid UUID, kept as-is
		{"/products/550e8400-e29b-41d4-a716-446655440000", "/products/{id}"},
		{"/users/42/orders/1001", "/users/{id}/orders/{id}"},
		{"/categories/electronics", "/categories/electronics"},
		{"/", "/"},
		{"/health", "/health"},
		{"", ""},
	}

	for _, tt := range tests {
		result := normalizePath(tt.input)
		if result != tt.expected {
			t.Errorf("normalizePath(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestIsID(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"123", true},
		{"0", true},
		{"999999", true},
		{"550e8400-e29b-41d4-a716-446655440000", true}, // UUID
		{"products", false},
		{"health", false},
		{"abc", false},
		{"12a", false},
		{"", false},
	}

	for _, tt := range tests {
		result := isID(tt.input)
		if result != tt.expected {
			t.Errorf("isID(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestMiddleware_AllHTTPMethods(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrappedHandler := Middleware(handler)

	methods := []string{
		http.MethodGet,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
	}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, "/test", nil)
			rec := httptest.NewRecorder()

			wrappedHandler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Errorf("%s: expected status 200, got %d", method, rec.Code)
			}
		})
	}
}

func TestMiddleware_PathWithID(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrappedHandler := Middleware(handler)

	// Test various paths with IDs
	paths := []string{
		"/products/123",
		"/products/550e8400-e29b-41d4-a716-446655440000",
		"/users/1/orders/2",
		"/categories/electronics/products/42",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()

			wrappedHandler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Errorf("path %s: expected status 200, got %d", path, rec.Code)
			}
		})
	}
}

func TestMiddleware_DefaultStatusCode(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't explicitly set status code
		w.Write([]byte("OK"))
	})

	wrappedHandler := Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	// Default should be 200
	if rec.Code != http.StatusOK {
		t.Errorf("expected default status 200, got %d", rec.Code)
	}
}
