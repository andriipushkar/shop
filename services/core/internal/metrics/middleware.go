package metrics

import (
	"net/http"
	"strconv"
	"strings"
	"time"
)

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Middleware returns an HTTP middleware for metrics collection
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		HTTPRequestsInFlight.Inc()
		defer HTTPRequestsInFlight.Dec()

		// Wrap response writer
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Call next handler
		next.ServeHTTP(wrapped, r)

		// Record metrics
		duration := time.Since(start).Seconds()
		path := normalizePath(r.URL.Path)
		status := strconv.Itoa(wrapped.statusCode)

		RecordHTTPRequest(r.Method, path, status, duration)
	})
}

// normalizePath normalizes URL paths to avoid high cardinality
// e.g., /products/123 -> /products/{id}
func normalizePath(path string) string {
	parts := strings.Split(path, "/")
	normalized := make([]string, len(parts))

	for i, part := range parts {
		if part == "" {
			normalized[i] = part
			continue
		}

		// Check if part looks like an ID (numeric or UUID-like)
		if isID(part) {
			normalized[i] = "{id}"
		} else {
			normalized[i] = part
		}
	}

	return strings.Join(normalized, "/")
}

// isID checks if a string looks like an ID
func isID(s string) bool {
	// Check if it's a number
	if _, err := strconv.ParseInt(s, 10, 64); err == nil {
		return true
	}

	// Check if it looks like a UUID (36 chars with dashes)
	if len(s) == 36 && strings.Count(s, "-") == 4 {
		return true
	}

	return false
}
