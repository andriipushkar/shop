package hotline

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"core/internal/marketplace"
)

func TestNew(t *testing.T) {
	client := New()
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestType(t *testing.T) {
	client := New()
	if client.Type() != marketplace.MarketplaceHotline {
		t.Errorf("expected type 'hotline', got '%s'", client.Type())
	}
}

func TestConfigure(t *testing.T) {
	client := New()
	config := &marketplace.Config{
		Type:        marketplace.MarketplaceHotline,
		AccessToken: "test-token",
		BaseURL:     "https://shop.example.com",
	}

	err := client.Configure(config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if client.config != config {
		t.Error("expected config to be set")
	}
	if client.feedGen == nil {
		t.Error("expected feed generator to be created")
	}
}

func TestIsConfigured(t *testing.T) {
	client := New()

	t.Run("not configured", func(t *testing.T) {
		if client.IsConfigured() {
			t.Error("expected IsConfigured to return false")
		}
	})

	t.Run("configured without token", func(t *testing.T) {
		client.Configure(&marketplace.Config{})
		if client.IsConfigured() {
			t.Error("expected IsConfigured to return false without token")
		}
	})

	t.Run("fully configured", func(t *testing.T) {
		client.Configure(&marketplace.Config{
			AccessToken: "test-token",
		})
		if !client.IsConfigured() {
			t.Error("expected IsConfigured to return true")
		}
	})
}

func TestMapProductToHotline(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{
		AccessToken: "test",
		BaseURL:     "https://shop.example.com",
	})

	t.Run("full product mapping", func(t *testing.T) {
		product := &marketplace.Product{
			SKU:         "SKU001",
			Name:        "Test Product",
			Description: "Test Description",
			URL:         "https://shop.example.com/product/SKU001",
			Price:       999.99,
			OldPrice:    1299.99,
			Quantity:    50,
			CategoryID:  "cat-123",
			Brand:       "Test Brand",
			Images:      []string{"https://main.jpg", "https://extra1.jpg"},
			IsAvailable: true,
			Warranty:    24,
			Attributes: map[string]string{
				"Color": "Red",
			},
		}

		item := client.mapProductToHotline(product)

		if item["id"] != "SKU001" {
			t.Errorf("expected id 'SKU001', got '%v'", item["id"])
		}
		if item["name"] != "Test Product" {
			t.Errorf("expected name 'Test Product', got '%v'", item["name"])
		}
		if item["price"] != 999.99 {
			t.Errorf("expected price 999.99, got %v", item["price"])
		}
		if item["old_price"] != 1299.99 {
			t.Errorf("expected old_price 1299.99, got %v", item["old_price"])
		}
		if item["currency"] != "UAH" {
			t.Errorf("expected currency 'UAH', got '%v'", item["currency"])
		}
		if item["vendor"] != "Test Brand" {
			t.Errorf("expected vendor 'Test Brand', got '%v'", item["vendor"])
		}
		if item["image"] != "https://main.jpg" {
			t.Errorf("expected image 'https://main.jpg', got '%v'", item["image"])
		}
		if item["warranty"] != 24 {
			t.Errorf("expected warranty 24, got %v", item["warranty"])
		}

		// Check params
		params := item["params"].([]map[string]string)
		if len(params) != 1 {
			t.Errorf("expected 1 param, got %d", len(params))
		}
	})

	t.Run("product without old_price", func(t *testing.T) {
		product := &marketplace.Product{
			SKU:   "SKU002",
			Name:  "Product 2",
			Price: 500.0,
		}

		item := client.mapProductToHotline(product)

		if _, ok := item["old_price"]; ok {
			t.Error("expected old_price to not be set when not discounted")
		}
	})

	t.Run("out of stock product", func(t *testing.T) {
		product := &marketplace.Product{
			SKU:         "SKU003",
			Name:        "Product 3",
			Price:       300.0,
			Quantity:    0,
			IsAvailable: true,
		}

		item := client.mapProductToHotline(product)

		if item["available"] != false {
			t.Error("expected available to be false for out of stock")
		}
	})
}

func TestGenerateFeed(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{
		AccessToken: "test",
		BaseURL:     "https://shop.example.com",
	})

	products := []*marketplace.Product{
		{
			SKU:         "SKU001",
			Name:        "Test Product",
			Price:       100.0,
			IsActive:    true,
			IsAvailable: true,
		},
	}

	ctx := context.Background()
	feed, err := client.GenerateFeed(ctx, products)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(feed) == 0 {
		t.Error("expected non-empty feed")
	}
}

func TestGenerateHotlineFeed(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{
		AccessToken: "test",
		BaseURL:     "https://shop.example.com",
		ShopID:      "shop123",
	})

	products := []*marketplace.Product{
		{
			SKU:          "SKU001",
			Name:         "Test Product",
			Description:  "Test Description",
			URL:          "https://shop.example.com/product/1",
			Price:        999.99,
			Brand:        "TestBrand",
			CategoryPath: "Electronics > Phones",
			Images:       []string{"https://img.jpg"},
			IsActive:     true,
			IsAvailable:  true,
			Quantity:     10,
			Warranty:     12,
			Attributes: map[string]string{
				"Color": "Black",
			},
		},
		{
			SKU:      "SKU002",
			Name:     "Inactive Product",
			IsActive: false, // Should be skipped
		},
	}

	feed, err := client.GenerateHotlineFeed(products)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	feedStr := string(feed)

	// Check XML structure
	if !strings.Contains(feedStr, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>") {
		t.Error("expected XML declaration")
	}
	if !strings.Contains(feedStr, "<price>") {
		t.Error("expected price root element")
	}
	if !strings.Contains(feedStr, "<firmId>shop123</firmId>") {
		t.Error("expected firmId element")
	}
	if !strings.Contains(feedStr, "<id>SKU001</id>") {
		t.Error("expected product id")
	}
	if !strings.Contains(feedStr, "<name>Test Product</name>") {
		t.Error("expected product name")
	}
	if !strings.Contains(feedStr, "<price>999.99</price>") {
		t.Error("expected product price")
	}
	if !strings.Contains(feedStr, "<stock>В наявності</stock>") {
		t.Error("expected in-stock status")
	}
	if !strings.Contains(feedStr, "<guarantee>12</guarantee>") {
		t.Error("expected warranty/guarantee")
	}
	if !strings.Contains(feedStr, `<param name="Color">Black</param>`) {
		t.Error("expected product attribute")
	}

	// Should not contain inactive product
	if strings.Contains(feedStr, "SKU002") {
		t.Error("inactive product should not be in feed")
	}
}

func TestEscapeXML(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"simple text", "simple text"},
		{"<tag>", "&lt;tag&gt;"},
		{"A & B", "A &amp; B"},
		{`say "hello"`, `say &quot;hello&quot;`},
		{"it's", "it&apos;s"},
		{"<script>alert('xss')&</script>", "&lt;script&gt;alert(&apos;xss&apos;)&amp;&lt;/script&gt;"},
	}

	for _, tt := range tests {
		result := escapeXML(tt.input)
		if result != tt.expected {
			t.Errorf("escapeXML(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

func TestParseCategories(t *testing.T) {
	client := New()

	data := []interface{}{
		map[string]interface{}{
			"id":   1000.0,
			"name": "Електроніка",
			"path": "electronics",
			"children": []interface{}{
				map[string]interface{}{
					"id":   1001.0,
					"name": "Смартфони",
					"path": "electronics/smartphones",
				},
			},
		},
		map[string]interface{}{
			"id":   2000.0,
			"name": "Одяг",
		},
	}

	categories := client.parseCategories(data, "")

	if len(categories) != 3 {
		t.Errorf("expected 3 categories, got %d", len(categories))
	}

	// Find category with path
	found := false
	for _, cat := range categories {
		if cat.Name == "Смартфони" && cat.Path == "electronics/smartphones" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected to find child category with path")
	}
}

func TestImportOrders(t *testing.T) {
	client := New()
	ctx := context.Background()

	// Hotline is a price comparison site - no orders
	orders, err := client.ImportOrders(ctx, time.Time{})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if orders != nil {
		t.Error("expected nil orders for Hotline")
	}
}

func TestUpdateOrderStatus(t *testing.T) {
	client := New()
	ctx := context.Background()

	// Hotline doesn't have orders
	err := client.UpdateOrderStatus(ctx, "12345", "shipped")
	if err != nil {
		t.Errorf("expected no error for Hotline order status update, got: %v", err)
	}
}

func TestExportProducts(t *testing.T) {
	t.Run("batch processing", func(t *testing.T) {
		callCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			callCount++
			if r.Header.Get("Authorization") != "Bearer test-token" {
				t.Error("expected Bearer token in Authorization header")
			}

			response := map[string]interface{}{
				"results": []interface{}{
					map[string]interface{}{"success": true},
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		// Would need to mock baseURL for actual testing
	})
}

func TestDoRequestErrors(t *testing.T) {
	t.Run("rate limited", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
		}))
		defer server.Close()
	})

	t.Run("authentication error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer server.Close()
	})
}

// Benchmark Tests

func BenchmarkMapProductToHotline(b *testing.B) {
	client := New()
	client.Configure(&marketplace.Config{
		AccessToken: "test",
		BaseURL:     "https://shop.example.com",
	})

	product := &marketplace.Product{
		SKU:         "SKU001",
		Name:        "Test Product",
		Description: "Test Description",
		Price:       999.99,
		OldPrice:    1299.99,
		CategoryID:  "cat-123",
		Brand:       "Test Brand",
		Images:      []string{"https://img1.jpg", "https://img2.jpg"},
		IsAvailable: true,
		Quantity:    50,
		Attributes: map[string]string{
			"Color": "Red",
			"Size":  "Large",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.mapProductToHotline(product)
	}
}

func BenchmarkGenerateHotlineFeed(b *testing.B) {
	client := New()
	client.Configure(&marketplace.Config{
		AccessToken: "test",
		BaseURL:     "https://shop.example.com",
		ShopID:      "shop123",
	})

	products := make([]*marketplace.Product, 100)
	for i := 0; i < 100; i++ {
		products[i] = &marketplace.Product{
			SKU:         "SKU" + string(rune('0'+i)),
			Name:        "Product",
			Price:       100.0,
			IsActive:    true,
			IsAvailable: true,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = client.GenerateHotlineFeed(products)
	}
}

func BenchmarkEscapeXML(b *testing.B) {
	input := "Test string with <special> & 'characters' \"here\""

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = escapeXML(input)
	}
}

func BenchmarkParseCategories(b *testing.B) {
	client := New()

	data := []interface{}{
		map[string]interface{}{
			"id":   1000.0,
			"name": "Electronics",
			"children": []interface{}{
				map[string]interface{}{
					"id":   1001.0,
					"name": "Phones",
				},
				map[string]interface{}{
					"id":   1002.0,
					"name": "Laptops",
				},
			},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.parseCategories(data, "")
	}
}
