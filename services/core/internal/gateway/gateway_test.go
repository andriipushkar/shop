package gateway

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockRepository implements Repository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) GetAPIKey(ctx context.Context, key string) (*APIKey, error) {
	args := m.Called(ctx, key)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*APIKey), args.Error(1)
}

func (m *MockRepository) GetAPIKeyByID(ctx context.Context, id string) (*APIKey, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*APIKey), args.Error(1)
}

func (m *MockRepository) ListAPIKeys(ctx context.Context, tenantID string) ([]*APIKey, error) {
	args := m.Called(ctx, tenantID)
	return args.Get(0).([]*APIKey), args.Error(1)
}

func (m *MockRepository) CreateAPIKey(ctx context.Context, key *APIKey) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockRepository) UpdateAPIKey(ctx context.Context, key *APIKey) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockRepository) DeleteAPIKey(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) UpdateLastUsed(ctx context.Context, keyID string) error {
	args := m.Called(ctx, keyID)
	return args.Error(0)
}

func (m *MockRepository) RecordUsage(ctx context.Context, metrics *UsageMetrics) error {
	args := m.Called(ctx, metrics)
	return args.Error(0)
}

func (m *MockRepository) GetUsageStats(ctx context.Context, tenantID string, start, end time.Time) (*UsageStats, error) {
	args := m.Called(ctx, tenantID, start, end)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*UsageStats), args.Error(1)
}

func TestTierLimits(t *testing.T) {
	tests := []struct {
		tier     string
		expected RateLimitConfig
	}{
		{
			tier: "free",
			expected: RateLimitConfig{
				RequestsPerSecond: 1,
				RequestsPerMinute: 60,
				BurstSize:         5,
			},
		},
		{
			tier: "starter",
			expected: RateLimitConfig{
				RequestsPerSecond: 10,
				RequestsPerMinute: 600,
				BurstSize:         20,
			},
		},
		{
			tier: "professional",
			expected: RateLimitConfig{
				RequestsPerSecond: 50,
				RequestsPerMinute: 3000,
				BurstSize:         100,
			},
		},
		{
			tier: "enterprise",
			expected: RateLimitConfig{
				RequestsPerSecond: 200,
				RequestsPerMinute: 12000,
				BurstSize:         500,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.tier, func(t *testing.T) {
			config := TierLimits[tt.tier]
			assert.Equal(t, tt.expected.RequestsPerSecond, config.RequestsPerSecond)
			assert.Equal(t, tt.expected.RequestsPerMinute, config.RequestsPerMinute)
			assert.Equal(t, tt.expected.BurstSize, config.BurstSize)
		})
	}
}

func TestEndpointLimits(t *testing.T) {
	// Test that critical endpoints have lower limits
	searchLimit := EndpointLimits["/api/v1/search"]
	assert.Equal(t, 30, searchLimit.RequestsPerMinute)

	exportLimit := EndpointLimits["/api/v1/export"]
	assert.Equal(t, 5, exportLimit.RequestsPerMinute)

	productsLimit := EndpointLimits["/api/v1/products"]
	assert.Equal(t, 120, productsLimit.RequestsPerMinute)
}

func TestValidateAPIKey(t *testing.T) {
	mockRepo := new(MockRepository)

	// Skip Redis for unit tests - test logic only
	t.Run("valid_key", func(t *testing.T) {
		validKey := &APIKey{
			ID:       "key_123",
			Key:      "sk_test_valid",
			TenantID: "tenant_1",
			Tier:     "starter",
			IsActive: true,
		}

		mockRepo.On("GetAPIKey", mock.Anything, "sk_test_valid").Return(validKey, nil)
		mockRepo.On("UpdateLastUsed", mock.Anything, "key_123").Return(nil)

		// Create gateway without Redis for unit test
		gw := &Gateway{
			repo: mockRepo,
		}

		key, err := gw.ValidateAPIKey(context.Background(), "sk_test_valid")

		assert.NoError(t, err)
		assert.NotNil(t, key)
		assert.Equal(t, "tenant_1", key.TenantID)
	})

	t.Run("expired_key", func(t *testing.T) {
		expiredTime := time.Now().Add(-time.Hour)
		expiredKey := &APIKey{
			ID:        "key_456",
			Key:       "sk_test_expired",
			TenantID:  "tenant_2",
			IsActive:  true,
			ExpiresAt: &expiredTime,
		}

		mockRepo.On("GetAPIKey", mock.Anything, "sk_test_expired").Return(expiredKey, nil)

		gw := &Gateway{
			repo: mockRepo,
		}

		_, err := gw.ValidateAPIKey(context.Background(), "sk_test_expired")

		assert.Error(t, err)
		assert.Equal(t, ErrAPIKeyInvalid, err)
	})

	t.Run("inactive_key", func(t *testing.T) {
		inactiveKey := &APIKey{
			ID:       "key_789",
			Key:      "sk_test_inactive",
			TenantID: "tenant_3",
			IsActive: false,
		}

		mockRepo.On("GetAPIKey", mock.Anything, "sk_test_inactive").Return(inactiveKey, nil)

		gw := &Gateway{
			repo: mockRepo,
		}

		_, err := gw.ValidateAPIKey(context.Background(), "sk_test_inactive")

		assert.Error(t, err)
		assert.Equal(t, ErrAPIKeyInvalid, err)
	})
}

func TestNormalizeEndpoint(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/api/v1/products", "/api/v1/products"},
		{"/api/v1/products/12345", "/api/v1/products/{id}"},
		{"/api/v1/products/550e8400-e29b-41d4-a716-446655440000", "/api/v1/products/{id}"},
		{"/api/v1/orders/123/items", "/api/v1/orders/{id}/items"},
		{"/api/v1/users", "/api/v1/users"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := normalizeEndpoint(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsNumeric(t *testing.T) {
	assert.True(t, isNumeric("12345"))
	assert.True(t, isNumeric("0"))
	assert.False(t, isNumeric("abc"))
	assert.False(t, isNumeric("12abc"))
	assert.False(t, isNumeric(""))
}

func TestGetClientIP(t *testing.T) {
	tests := []struct {
		name     string
		headers  map[string]string
		remoteAddr string
		expected string
	}{
		{
			name:     "X-Forwarded-For single IP",
			headers:  map[string]string{"X-Forwarded-For": "203.0.113.195"},
			remoteAddr: "10.0.0.1:12345",
			expected: "203.0.113.195",
		},
		{
			name:     "X-Forwarded-For multiple IPs",
			headers:  map[string]string{"X-Forwarded-For": "203.0.113.195, 70.41.3.18, 150.172.238.178"},
			remoteAddr: "10.0.0.1:12345",
			expected: "203.0.113.195",
		},
		{
			name:     "X-Real-IP",
			headers:  map[string]string{"X-Real-IP": "203.0.113.195"},
			remoteAddr: "10.0.0.1:12345",
			expected: "203.0.113.195",
		},
		{
			name:     "RemoteAddr fallback",
			headers:  map[string]string{},
			remoteAddr: "10.0.0.1:12345",
			expected: "10.0.0.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.RemoteAddr = tt.remoteAddr
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}

			result := getClientIP(req)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMaskKey(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"sk_1234567890abcdef", "sk_1****cdef"},
		{"short", "****"},
		{"12345678", "****"},
		{"sk_test_very_long_api_key_here", "sk_t****here"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := maskKey(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestResponseWriter(t *testing.T) {
	w := httptest.NewRecorder()
	wrapped := &responseWriter{ResponseWriter: w, status: 200}

	// Test WriteHeader
	wrapped.WriteHeader(http.StatusCreated)
	assert.Equal(t, http.StatusCreated, wrapped.status)

	// Test Write
	n, err := wrapped.Write([]byte("hello world"))
	assert.NoError(t, err)
	assert.Equal(t, 11, n)
	assert.Equal(t, 11, wrapped.size)
}

func TestCreateAPIKeyRequest(t *testing.T) {
	req := CreateAPIKeyRequest{
		Name:   "Test API Key",
		Scopes: []string{"read:products", "write:orders"},
	}

	assert.Equal(t, "Test API Key", req.Name)
	assert.Len(t, req.Scopes, 2)
}

func TestGenerateSecureKey(t *testing.T) {
	key1 := generateSecureKey()
	key2 := generateSecureKey()

	// Keys should be unique
	assert.NotEqual(t, key1, key2)

	// Keys should have correct prefix
	assert.Contains(t, key1, "sk_")
	assert.Contains(t, key2, "sk_")

	// Keys should have minimum length
	assert.Greater(t, len(key1), 50)
}

func TestUsageMetrics(t *testing.T) {
	metrics := &UsageMetrics{
		TenantID:     "tenant_1",
		APIKeyID:     "key_1",
		Endpoint:     "/api/v1/products",
		Method:       "GET",
		StatusCode:   200,
		RequestSize:  100,
		ResponseSize: 500,
		Latency:      50,
		Timestamp:    time.Now(),
		ClientIP:     "192.168.1.1",
		UserAgent:    "TestClient/1.0",
	}

	assert.Equal(t, "tenant_1", metrics.TenantID)
	assert.Equal(t, int64(50), metrics.Latency)
	assert.Equal(t, 200, metrics.StatusCode)
}

func TestRateLimitInfo(t *testing.T) {
	info := &RateLimitInfo{
		Limit:      100,
		Remaining:  95,
		Reset:      time.Now().Add(time.Minute).Unix(),
		RetryAfter: 0,
	}

	assert.Equal(t, 100, info.Limit)
	assert.Equal(t, 95, info.Remaining)
	assert.Greater(t, info.Reset, time.Now().Unix())
}

// Integration test with real Redis (skip in CI)
func TestGatewayWithRedis(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	// Connect to test Redis
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use test DB
	})

	// Check connection
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available")
	}

	defer rdb.FlushDB(ctx)

	mockRepo := new(MockRepository)
	gw := NewGateway(mockRepo, rdb)
	defer gw.Stop()

	// Test rate limiting
	tenantID := "test_tenant"
	endpoint := "/api/v1/products"

	// Make requests within limit
	for i := 0; i < 5; i++ {
		info, err := gw.CheckRateLimit(ctx, tenantID, endpoint, "free")
		assert.NoError(t, err)
		assert.Greater(t, info.Remaining, 0)
	}
}

func BenchmarkNormalizeEndpoint(b *testing.B) {
	endpoints := []string{
		"/api/v1/products",
		"/api/v1/products/12345",
		"/api/v1/orders/67890/items/111",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		normalizeEndpoint(endpoints[i%len(endpoints)])
	}
}

func BenchmarkGetClientIP(b *testing.B) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18")
	req.RemoteAddr = "10.0.0.1:12345"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		getClientIP(req)
	}
}

func BenchmarkMaskKey(b *testing.B) {
	key := "sk_test_very_long_api_key_here_12345"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		maskKey(key)
	}
}
