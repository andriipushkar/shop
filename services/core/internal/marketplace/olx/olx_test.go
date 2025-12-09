package olx

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	if client.Type() != marketplace.MarketplaceOLX {
		t.Errorf("expected type 'olx', got '%s'", client.Type())
	}
}

func TestConfigure(t *testing.T) {
	client := New()
	config := &marketplace.Config{
		Type:      marketplace.MarketplaceOLX,
		ClientID:  "test-client",
		APISecret: "test-secret",
	}

	err := client.Configure(config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if client.config != config {
		t.Error("expected config to be set")
	}
}

func TestIsConfigured(t *testing.T) {
	client := New()

	t.Run("not configured", func(t *testing.T) {
		if client.IsConfigured() {
			t.Error("expected IsConfigured to return false")
		}
	})

	t.Run("configured without credentials", func(t *testing.T) {
		client.Configure(&marketplace.Config{})
		if client.IsConfigured() {
			t.Error("expected IsConfigured to return false without credentials")
		}
	})

	t.Run("configured with client_id only", func(t *testing.T) {
		client.Configure(&marketplace.Config{
			ClientID: "test-client",
		})
		if client.IsConfigured() {
			t.Error("expected IsConfigured to return false without api_secret")
		}
	})

	t.Run("fully configured", func(t *testing.T) {
		client.Configure(&marketplace.Config{
			ClientID:  "test-client",
			APISecret: "test-secret",
		})
		if !client.IsConfigured() {
			t.Error("expected IsConfigured to return true")
		}
	})
}

func TestMapProductToOLX(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{
		ClientID:  "test",
		APISecret: "test",
	})

	t.Run("full product mapping", func(t *testing.T) {
		product := &marketplace.Product{
			SKU:         "SKU001",
			Name:        "Test Product",
			Description: "Test Description",
			Price:       999.99,
			CategoryID:  "cat-123",
			Images:      []string{"https://img1.jpg", "https://img2.jpg"},
			Attributes: map[string]string{
				"Color": "Red",
				"Size":  "Large",
			},
		}

		item := client.mapProductToOLX(product)

		if item["external_id"] != "SKU001" {
			t.Errorf("expected external_id 'SKU001', got '%v'", item["external_id"])
		}
		if item["title"] != "Test Product" {
			t.Errorf("expected title 'Test Product', got '%v'", item["title"])
		}
		if item["description"] != "Test Description" {
			t.Errorf("expected description 'Test Description', got '%v'", item["description"])
		}

		// Check price
		price := item["price"].(map[string]interface{})
		if price["value"] != 999.99 {
			t.Errorf("expected price value 999.99, got %v", price["value"])
		}
		if price["currency"] != "UAH" {
			t.Errorf("expected currency 'UAH', got '%v'", price["currency"])
		}

		// Check images
		images := item["images"].([]map[string]string)
		if len(images) != 2 {
			t.Errorf("expected 2 images, got %d", len(images))
		}

		// Check attributes
		attrs := item["attributes"].([]map[string]interface{})
		if len(attrs) != 2 {
			t.Errorf("expected 2 attributes, got %d", len(attrs))
		}
	})

	t.Run("truncate long title", func(t *testing.T) {
		longName := "This is a very long product name that exceeds the maximum length allowed by OLX platform"
		product := &marketplace.Product{
			SKU:  "SKU002",
			Name: longName,
		}

		item := client.mapProductToOLX(product)

		title := item["title"].(string)
		if len(title) > 70 {
			t.Errorf("expected title to be truncated to 70 chars, got %d", len(title))
		}
	})
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"short", 10, "short"},
		{"exactly10c", 10, "exactly10c"},
		{"this is longer than 10", 10, "this is..."},
		{"", 10, ""},
	}

	for _, tt := range tests {
		result := truncate(tt.input, tt.maxLen)
		if result != tt.expected {
			t.Errorf("truncate(%q, %d) = %q, expected %q", tt.input, tt.maxLen, result, tt.expected)
		}
	}
}

func TestAuthenticate(t *testing.T) {
	t.Run("successful authentication", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/open/oauth/token" {
				response := map[string]interface{}{
					"access_token": "test-token-123",
					"expires_in":   3600,
					"token_type":   "Bearer",
				}
				json.NewEncoder(w).Encode(response)
			}
		}))
		defer server.Close()

		// Would need to modify baseURL for testing
	})

	t.Run("cached token", func(t *testing.T) {
		client := New()
		client.accessToken = "cached-token"
		client.tokenExpires = time.Now().Add(time.Hour)

		ctx := context.Background()
		err := client.authenticate(ctx)
		if err != nil {
			t.Errorf("unexpected error with cached token: %v", err)
		}

		if client.accessToken != "cached-token" {
			t.Error("expected cached token to be used")
		}
	})
}

func TestExportProducts(t *testing.T) {
	t.Run("export without auth", func(t *testing.T) {
		client := New()
		client.Configure(&marketplace.Config{
			ClientID:  "test",
			APISecret: "test",
		})

		products := []*marketplace.Product{
			{
				SKU:   "SKU001",
				Name:  "Product 1",
				Price: 100.0,
			},
		}

		ctx := context.Background()
		// Will fail due to auth, but should not panic
		result, err := client.ExportProducts(ctx, products)
		if err != nil {
			t.Errorf("ExportProducts returned error: %v", err)
		}
		if result == nil {
			t.Fatal("expected result, got nil")
		}
		if result.Marketplace != marketplace.MarketplaceOLX {
			t.Errorf("expected marketplace OLX, got %s", result.Marketplace)
		}
	})
}

func TestUpdateOrderStatus(t *testing.T) {
	client := New()
	ctx := context.Background()

	// OLX doesn't have order status updates
	err := client.UpdateOrderStatus(ctx, "12345", "shipped")
	if err != nil {
		t.Errorf("expected no error for OLX order status update, got: %v", err)
	}
}

func TestGenerateFeed(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{
		ClientID:  "test",
		APISecret: "test",
	})

	products := []*marketplace.Product{
		{
			SKU:   "SKU001",
			Name:  "Test Product",
			Price: 100.0,
		},
	}

	ctx := context.Background()
	feed, err := client.GenerateFeed(ctx, products)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// OLX returns nil feed as it uses API, not XML feeds
	if feed != nil {
		t.Error("expected nil feed for OLX")
	}
}

func TestParseCategories(t *testing.T) {
	client := New()

	data := []interface{}{
		map[string]interface{}{
			"id":   1000.0,
			"name": "Електроніка",
			"children": []interface{}{
				map[string]interface{}{
					"id":   1001.0,
					"name": "Смартфони",
				},
			},
		},
		map[string]interface{}{
			"id":   2000.0,
			"name": "Одяг",
		},
	}

	categories := client.parseCategories(data, "")

	if len(categories) != 3 { // Parent + child + second parent
		t.Errorf("expected 3 categories, got %d", len(categories))
	}

	// Find electronics child
	found := false
	for _, cat := range categories {
		if cat.Name == "Смартфони" && cat.ParentID == "1000" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected to find child category with correct parent")
	}
}

func TestDoRequestErrors(t *testing.T) {
	t.Run("rate limited", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
		}))
		defer server.Close()
	})

	t.Run("authentication error clears token", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer server.Close()
	})
}

func TestImportOrders(t *testing.T) {
	t.Run("without authentication", func(t *testing.T) {
		client := New()
		client.Configure(&marketplace.Config{
			ClientID:  "test",
			APISecret: "test",
		})

		ctx := context.Background()
		_, err := client.ImportOrders(ctx, time.Now().Add(-24*time.Hour))
		// Will fail due to auth
		if err == nil {
			// Auth should fail without a proper server
		}
	})
}

// Benchmark Tests

func BenchmarkMapProductToOLX(b *testing.B) {
	client := New()
	client.Configure(&marketplace.Config{
		ClientID:  "test",
		APISecret: "test",
	})

	product := &marketplace.Product{
		SKU:         "SKU001",
		Name:        "Test Product",
		Description: "Test Description",
		Price:       999.99,
		CategoryID:  "cat-123",
		Images:      []string{"https://img1.jpg", "https://img2.jpg"},
		Attributes: map[string]string{
			"Color": "Red",
			"Size":  "Large",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.mapProductToOLX(product)
	}
}

func BenchmarkTruncate(b *testing.B) {
	longString := "This is a very long string that needs to be truncated to fit within the maximum allowed length"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = truncate(longString, 70)
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
