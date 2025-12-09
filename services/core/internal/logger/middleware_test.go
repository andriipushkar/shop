package logger

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
	Init(DefaultConfig())

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

	// Check that request ID was added
	requestID := rec.Header().Get("X-Request-ID")
	if requestID == "" {
		t.Error("expected X-Request-ID header to be set")
	}
}

func TestMiddleware_WithRequestID(t *testing.T) {
	Init(DefaultConfig())

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrappedHandler := Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", "custom-request-id-123")
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	requestID := rec.Header().Get("X-Request-ID")
	if requestID != "custom-request-id-123" {
		t.Errorf("expected request ID 'custom-request-id-123', got '%s'", requestID)
	}
}

func TestMiddleware_Error(t *testing.T) {
	Init(DefaultConfig())

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

func TestMiddleware_WithQuery(t *testing.T) {
	Init(DefaultConfig())

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrappedHandler := Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/products?search=iphone&limit=10", nil)
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

func TestMiddlewareFunc(t *testing.T) {
	Init(DefaultConfig())

	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}

	wrappedHandler := MiddlewareFunc(handler)

	req := httptest.NewRequest(http.MethodPost, "/products", nil)
	rec := httptest.NewRecorder()

	wrappedHandler(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d", rec.Code)
	}
}

func TestMiddleware_DefaultStatusCode(t *testing.T) {
	Init(DefaultConfig())

	// Handler that doesn't explicitly set status code
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})

	wrappedHandler := Middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	wrappedHandler.ServeHTTP(rec, req)

	// Default status should be 200
	if rec.Code != http.StatusOK {
		t.Errorf("expected default status 200, got %d", rec.Code)
	}
}

func TestMiddleware_AllHTTPMethods(t *testing.T) {
	Init(DefaultConfig())

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
		http.MethodHead,
		http.MethodOptions,
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

func TestResponseWriter_Write(t *testing.T) {
	rec := httptest.NewRecorder()
	rw := &responseWriter{ResponseWriter: rec, statusCode: http.StatusOK}

	n, err := rw.Write([]byte("Hello"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 5 {
		t.Errorf("expected 5 bytes written, got %d", n)
	}
}
