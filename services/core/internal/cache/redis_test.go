package cache

import (
	"context"
	"testing"
	"time"
)

// MockRedisCache is a mock implementation for testing without Redis
type MockRedisCache struct {
	data map[string][]byte
}

func NewMockCache() *MockRedisCache {
	return &MockRedisCache{
		data: make(map[string][]byte),
	}
}

func (m *MockRedisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	// Simplified: just store as string
	m.data[key] = []byte("cached")
	return nil
}

func (m *MockRedisCache) Get(ctx context.Context, key string, dest interface{}) error {
	if _, ok := m.data[key]; ok {
		return nil
	}
	return ErrCacheMiss
}

func (m *MockRedisCache) Delete(ctx context.Context, keys ...string) error {
	for _, key := range keys {
		delete(m.data, key)
	}
	return nil
}

func (m *MockRedisCache) InvalidateProducts(ctx context.Context) error {
	for key := range m.data {
		if len(key) > 8 && key[:8] == "product:" {
			delete(m.data, key)
		}
	}
	delete(m.data, ProductsListKey)
	return nil
}

func (m *MockRedisCache) InvalidateProduct(ctx context.Context, productID string) error {
	delete(m.data, ProductKeyPrefix+productID)
	delete(m.data, ProductsListKey)
	return nil
}

func (m *MockRedisCache) InvalidateCategories(ctx context.Context) error {
	for key := range m.data {
		if len(key) > 9 && key[:9] == "category:" {
			delete(m.data, key)
		}
	}
	delete(m.data, CategoriesListKey)
	return nil
}

func (m *MockRedisCache) InvalidateCategory(ctx context.Context, categoryID string) error {
	delete(m.data, CategoryKeyPrefix+categoryID)
	delete(m.data, CategoriesListKey)
	return nil
}

// ErrCacheMiss indicates a cache miss
var ErrCacheMiss = context.DeadlineExceeded

func TestMockCache_SetAndGet(t *testing.T) {
	cache := NewMockCache()
	ctx := context.Background()

	// Set a value
	err := cache.Set(ctx, "test-key", "test-value", time.Minute)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Get the value
	var result string
	err = cache.Get(ctx, "test-key", &result)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
}

func TestMockCache_GetMiss(t *testing.T) {
	cache := NewMockCache()
	ctx := context.Background()

	var result string
	err := cache.Get(ctx, "non-existent", &result)
	if err == nil {
		t.Fatal("Expected error for cache miss")
	}
}

func TestMockCache_Delete(t *testing.T) {
	cache := NewMockCache()
	ctx := context.Background()

	// Set values
	cache.Set(ctx, "key1", "value1", time.Minute)
	cache.Set(ctx, "key2", "value2", time.Minute)

	// Delete one
	err := cache.Delete(ctx, "key1")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// key1 should be gone
	var result string
	if cache.Get(ctx, "key1", &result) == nil {
		t.Fatal("key1 should be deleted")
	}

	// key2 should still exist
	if cache.Get(ctx, "key2", &result) != nil {
		t.Fatal("key2 should still exist")
	}
}

func TestMockCache_InvalidateProducts(t *testing.T) {
	cache := NewMockCache()
	ctx := context.Background()

	// Set product data
	cache.Set(ctx, ProductsListKey, []string{"p1", "p2"}, time.Minute)
	cache.Set(ctx, ProductKeyPrefix+"p1", "product1", time.Minute)
	cache.Set(ctx, ProductKeyPrefix+"p2", "product2", time.Minute)
	cache.Set(ctx, CategoriesListKey, []string{"c1"}, time.Minute)

	// Invalidate products
	err := cache.InvalidateProducts(ctx)
	if err != nil {
		t.Fatalf("InvalidateProducts failed: %v", err)
	}

	// Products should be gone
	var result interface{}
	if cache.Get(ctx, ProductsListKey, &result) == nil {
		t.Fatal("ProductsListKey should be invalidated")
	}
	if cache.Get(ctx, ProductKeyPrefix+"p1", &result) == nil {
		t.Fatal("product:p1 should be invalidated")
	}

	// Categories should still exist
	if cache.Get(ctx, CategoriesListKey, &result) != nil {
		t.Fatal("CategoriesListKey should still exist")
	}
}

func TestMockCache_InvalidateProduct(t *testing.T) {
	cache := NewMockCache()
	ctx := context.Background()

	// Set product data
	cache.Set(ctx, ProductsListKey, []string{"p1", "p2"}, time.Minute)
	cache.Set(ctx, ProductKeyPrefix+"p1", "product1", time.Minute)
	cache.Set(ctx, ProductKeyPrefix+"p2", "product2", time.Minute)

	// Invalidate single product
	err := cache.InvalidateProduct(ctx, "p1")
	if err != nil {
		t.Fatalf("InvalidateProduct failed: %v", err)
	}

	// p1 and list should be gone
	var result interface{}
	if cache.Get(ctx, ProductKeyPrefix+"p1", &result) == nil {
		t.Fatal("product:p1 should be invalidated")
	}
	if cache.Get(ctx, ProductsListKey, &result) == nil {
		t.Fatal("ProductsListKey should be invalidated")
	}

	// p2 should still exist
	if cache.Get(ctx, ProductKeyPrefix+"p2", &result) != nil {
		t.Fatal("product:p2 should still exist")
	}
}

func TestMockCache_InvalidateCategories(t *testing.T) {
	cache := NewMockCache()
	ctx := context.Background()

	// Set category data
	cache.Set(ctx, CategoriesListKey, []string{"c1"}, time.Minute)
	cache.Set(ctx, CategoryKeyPrefix+"c1", "category1", time.Minute)
	cache.Set(ctx, ProductsListKey, []string{"p1"}, time.Minute)

	// Invalidate categories
	err := cache.InvalidateCategories(ctx)
	if err != nil {
		t.Fatalf("InvalidateCategories failed: %v", err)
	}

	// Categories should be gone
	var result interface{}
	if cache.Get(ctx, CategoriesListKey, &result) == nil {
		t.Fatal("CategoriesListKey should be invalidated")
	}
	if cache.Get(ctx, CategoryKeyPrefix+"c1", &result) == nil {
		t.Fatal("category:c1 should be invalidated")
	}

	// Products should still exist
	if cache.Get(ctx, ProductsListKey, &result) != nil {
		t.Fatal("ProductsListKey should still exist")
	}
}

func TestMockCache_InvalidateCategory(t *testing.T) {
	cache := NewMockCache()
	ctx := context.Background()

	// Set category data
	cache.Set(ctx, CategoriesListKey, []string{"c1", "c2"}, time.Minute)
	cache.Set(ctx, CategoryKeyPrefix+"c1", "category1", time.Minute)
	cache.Set(ctx, CategoryKeyPrefix+"c2", "category2", time.Minute)

	// Invalidate single category
	err := cache.InvalidateCategory(ctx, "c1")
	if err != nil {
		t.Fatalf("InvalidateCategory failed: %v", err)
	}

	// c1 and list should be gone
	var result interface{}
	if cache.Get(ctx, CategoryKeyPrefix+"c1", &result) == nil {
		t.Fatal("category:c1 should be invalidated")
	}
	if cache.Get(ctx, CategoriesListKey, &result) == nil {
		t.Fatal("CategoriesListKey should be invalidated")
	}

	// c2 should still exist
	if cache.Get(ctx, CategoryKeyPrefix+"c2", &result) != nil {
		t.Fatal("category:c2 should still exist")
	}
}

func TestCacheKeys(t *testing.T) {
	// Test that cache key constants are properly defined
	if ProductsListKey != "products:all" {
		t.Errorf("ProductsListKey = %s, want products:all", ProductsListKey)
	}
	if CategoriesListKey != "categories:all" {
		t.Errorf("CategoriesListKey = %s, want categories:all", CategoriesListKey)
	}
	if ProductKeyPrefix != "product:" {
		t.Errorf("ProductKeyPrefix = %s, want product:", ProductKeyPrefix)
	}
	if CategoryKeyPrefix != "category:" {
		t.Errorf("CategoryKeyPrefix = %s, want category:", CategoryKeyPrefix)
	}
}

func TestTTLValues(t *testing.T) {
	// Test that TTL values are reasonable
	if DefaultTTL < time.Minute {
		t.Errorf("DefaultTTL = %v, should be at least 1 minute", DefaultTTL)
	}
	if ProductTTL < DefaultTTL {
		t.Errorf("ProductTTL = %v, should be >= DefaultTTL (%v)", ProductTTL, DefaultTTL)
	}
	if ListTTL > DefaultTTL {
		t.Errorf("ListTTL = %v, should be <= DefaultTTL (%v) for freshness", ListTTL, DefaultTTL)
	}
}
