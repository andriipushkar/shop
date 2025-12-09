package versioning

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseVersion(t *testing.T) {
	tests := []struct {
		input    string
		expected Version
		hasError bool
	}{
		{"v1", Version{Major: 1, Minor: 0}, false},
		{"v2", Version{Major: 2, Minor: 0}, false},
		{"v1.0", Version{Major: 1, Minor: 0}, false},
		{"v1.1", Version{Major: 1, Minor: 1}, false},
		{"v2.5", Version{Major: 2, Minor: 5}, false},
		{"V1", Version{Major: 1, Minor: 0}, false},
		{"V1.1", Version{Major: 1, Minor: 1}, false},
		{"invalid", Version{}, true},
		{"1.0", Version{}, true},
		{"", Version{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result, err := ParseVersion(tt.input)
			if tt.hasError {
				if err == nil {
					t.Errorf("Expected error for input %q", tt.input)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if result != tt.expected {
					t.Errorf("Expected %v, got %v", tt.expected, result)
				}
			}
		})
	}
}

func TestVersion_Compare(t *testing.T) {
	tests := []struct {
		v1       Version
		v2       Version
		expected int
	}{
		{Version{1, 0}, Version{1, 0}, 0},
		{Version{1, 0}, Version{2, 0}, -1},
		{Version{2, 0}, Version{1, 0}, 1},
		{Version{1, 1}, Version{1, 0}, 1},
		{Version{1, 0}, Version{1, 1}, -1},
		{Version{1, 5}, Version{2, 0}, -1},
	}

	for _, tt := range tests {
		t.Run(tt.v1.String()+"_vs_"+tt.v2.String(), func(t *testing.T) {
			result := tt.v1.Compare(tt.v2)
			if result != tt.expected {
				t.Errorf("Expected %d, got %d", tt.expected, result)
			}
		})
	}
}

func TestVersion_IsCompatible(t *testing.T) {
	tests := []struct {
		v1       Version
		v2       Version
		expected bool
	}{
		{Version{1, 0}, Version{1, 0}, true},
		{Version{1, 1}, Version{1, 0}, true},
		{Version{1, 0}, Version{1, 1}, false},
		{Version{2, 0}, Version{1, 0}, false},
		{Version{1, 5}, Version{1, 3}, true},
	}

	for _, tt := range tests {
		t.Run(tt.v1.String()+"_compatible_with_"+tt.v2.String(), func(t *testing.T) {
			result := tt.v1.IsCompatible(tt.v2)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestVersion_String(t *testing.T) {
	v := Version{Major: 1, Minor: 5}
	if v.String() != "v1.5" {
		t.Errorf("Expected 'v1.5', got %q", v.String())
	}
	if v.ShortString() != "v1" {
		t.Errorf("Expected 'v1', got %q", v.ShortString())
	}
}

func TestVersionFromRequest(t *testing.T) {
	tests := []struct {
		name     string
		setup    func(*http.Request)
		expected Version
	}{
		{
			name: "From URL path",
			setup: func(r *http.Request) {
				r.URL.Path = "/api/v2/products"
			},
			expected: Version{2, 0},
		},
		{
			name: "From Accept header",
			setup: func(r *http.Request) {
				r.Header.Set("Accept", "application/vnd.shop.v1.1+json")
			},
			expected: Version{1, 1},
		},
		{
			name: "From X-API-Version header",
			setup: func(r *http.Request) {
				r.Header.Set("X-API-Version", "v2")
			},
			expected: Version{2, 0},
		},
		{
			name: "From query parameter",
			setup: func(r *http.Request) {
				q := r.URL.Query()
				q.Set("version", "v1.1")
				r.URL.RawQuery = q.Encode()
			},
			expected: Version{1, 1},
		},
		{
			name:     "Default when no hints",
			setup:    func(r *http.Request) {},
			expected: CurrentVersion,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			tt.setup(req)

			result := VersionFromRequest(req)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestMiddleware(t *testing.T) {
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("Adds version header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/test", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		version := rec.Header().Get("X-API-Version")
		if version == "" {
			t.Error("Expected X-API-Version header to be set")
		}
	})

	t.Run("Rejects unsupported version", func(t *testing.T) {
		// Set min supported to v2 so v1 is rejected
		oldMin := MinSupportedVersion
		MinSupportedVersion = Version{2, 0}
		defer func() { MinSupportedVersion = oldMin }()

		req := httptest.NewRequest("GET", "/api/v1/test", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusGone {
			t.Errorf("Expected status 410, got %d", rec.Code)
		}
	})
}

func TestVersionedRouter(t *testing.T) {
	router := NewRouter()

	v1Handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("v1"))
	})
	v2Handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("v2"))
	})

	router.Handle(V1, v1Handler)
	router.Handle(V2, v2Handler)

	t.Run("Routes to v1", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/test", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Body.String() != "v1" {
			t.Errorf("Expected 'v1', got %q", rec.Body.String())
		}
	})

	t.Run("Routes to v2", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v2/test", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Body.String() != "v2" {
			t.Errorf("Expected 'v2', got %q", rec.Body.String())
		}
	})
}

func TestVersionedEndpoint(t *testing.T) {
	endpoint := NewVersionedEndpoint().
		Register(V1, func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("v1 response"))
		}).
		Register(V2, func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("v2 response"))
		})

	handler := endpoint.Handler()

	t.Run("V1 request", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/test", nil)
		rec := httptest.NewRecorder()

		handler(rec, req)

		if rec.Body.String() != "v1 response" {
			t.Errorf("Expected 'v1 response', got %q", rec.Body.String())
		}
	})

	t.Run("V2 request", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v2/test", nil)
		rec := httptest.NewRecorder()

		handler(rec, req)

		if rec.Body.String() != "v2 response" {
			t.Errorf("Expected 'v2 response', got %q", rec.Body.String())
		}
	})
}
