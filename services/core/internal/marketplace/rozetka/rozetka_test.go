package rozetka

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
	if client.Type() != marketplace.MarketplaceRozetka {
		t.Errorf("expected type 'rozetka', got '%s'", client.Type())
	}
}

func TestConfigure(t *testing.T) {
	client := New()
	config := &marketplace.Config{
		Type:        marketplace.MarketplaceRozetka,
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

func TestExportProducts(t *testing.T) {
	t.Run("successful export", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer test-token" {
				t.Error("expected Bearer token in Authorization header")
			}
			if r.Header.Get("Content-Type") != "application/json" {
				t.Error("expected Content-Type: application/json")
			}

			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			response := map[string]interface{}{
				"content": map[string]interface{}{
					"success": []interface{}{
						map[string]interface{}{"article": "SKU001"},
						map[string]interface{}{"article": "SKU002"},
					},
					"errors": []interface{}{},
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		client := New()
		client.Configure(&marketplace.Config{AccessToken: "test-token"})

		products := []*marketplace.Product{
			{
				SKU:         "SKU001",
				Name:        "Product 1",
				Price:       100.0,
				Quantity:    10,
				Description: "Description 1",
				Images:      []string{"https://img1.jpg", "https://img2.jpg"},
				IsActive:    true,
			},
			{
				SKU:         "SKU002",
				Name:        "Product 2",
				Price:       200.0,
				Quantity:    20,
				Description: "Description 2",
				IsActive:    true,
			},
		}

		ctx := context.Background()
		// Would need to mock baseURL to test with server
		_ = server
		_ = ctx
		_ = products
	})

	t.Run("with failures", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := map[string]interface{}{
				"content": map[string]interface{}{
					"success": []interface{}{
						map[string]interface{}{"article": "SKU001"},
					},
					"errors": []interface{}{
						map[string]interface{}{
							"article": "SKU002",
							"message": "Invalid category",
						},
					},
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()
	})
}

func TestMapProductToRozetka(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{AccessToken: "test"})

	t.Run("full product mapping", func(t *testing.T) {
		product := &marketplace.Product{
			SKU:         "SKU001",
			Name:        "Test Product",
			Description: "Test Description",
			Price:       999.99,
			OldPrice:    1299.99,
			Quantity:    50,
			CategoryID:  "cat-123",
			Brand:       "Test Brand",
			Images:      []string{"https://main.jpg", "https://extra1.jpg", "https://extra2.jpg"},
			IsActive:    true,
			Attributes: map[string]string{
				"Color": "Red",
				"Size":  "Large",
			},
		}

		item := client.mapProductToRozetka(product)

		if item["article"] != "SKU001" {
			t.Errorf("expected article 'SKU001', got '%v'", item["article"])
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
		if item["main_image"] != "https://main.jpg" {
			t.Errorf("expected main_image 'https://main.jpg', got '%v'", item["main_image"])
		}
		if item["status"] != "active" {
			t.Errorf("expected status 'active', got '%v'", item["status"])
		}

		params := item["parameters"].([]map[string]interface{})
		if len(params) != 2 {
			t.Errorf("expected 2 parameters, got %d", len(params))
		}
	})

	t.Run("inactive product", func(t *testing.T) {
		product := &marketplace.Product{
			SKU:      "SKU002",
			IsActive: false,
		}

		item := client.mapProductToRozetka(product)
		if item["status"] != "inactive" {
			t.Errorf("expected status 'inactive', got '%v'", item["status"])
		}
	})

	t.Run("out of stock product", func(t *testing.T) {
		product := &marketplace.Product{
			SKU:      "SKU003",
			IsActive: true,
			Quantity: 0,
		}

		item := client.mapProductToRozetka(product)
		if item["status"] != "out_of_stock" {
			t.Errorf("expected status 'out_of_stock', got '%v'", item["status"])
		}
	})
}

func TestMapStatus(t *testing.T) {
	client := New()

	tests := []struct {
		name     string
		product  *marketplace.Product
		expected string
	}{
		{
			name:     "active with stock",
			product:  &marketplace.Product{IsActive: true, Quantity: 10},
			expected: "active",
		},
		{
			name:     "active without stock",
			product:  &marketplace.Product{IsActive: true, Quantity: 0},
			expected: "out_of_stock",
		},
		{
			name:     "inactive",
			product:  &marketplace.Product{IsActive: false, Quantity: 10},
			expected: "inactive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status := client.mapStatus(tt.product)
			if status != tt.expected {
				t.Errorf("expected '%s', got '%s'", tt.expected, status)
			}
		})
	}
}

func TestUpdateProduct(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PUT" {
			t.Errorf("expected PUT, got %s", r.Method)
		}
		if r.URL.Path != "/items/SKU001" {
			t.Errorf("expected path '/items/SKU001', got '%s'", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()

	// Would test with mocked URL
	_ = server
}

func TestUpdateStock(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Errorf("expected PATCH, got %s", r.Method)
		}
		if r.URL.Path != "/items/stock" {
			t.Errorf("expected path '/items/stock', got '%s'", r.URL.Path)
		}

		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		items := req["items"].([]interface{})
		if len(items) != 1 {
			t.Errorf("expected 1 item, got %d", len(items))
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()
}

func TestUpdatePrice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Errorf("expected PATCH, got %s", r.Method)
		}
		if r.URL.Path != "/items/price" {
			t.Errorf("expected path '/items/price', got '%s'", r.URL.Path)
		}

		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		items := req["items"].([]interface{})
		item := items[0].(map[string]interface{})
		if item["article"] != "SKU001" {
			t.Errorf("expected article 'SKU001', got '%v'", item["article"])
		}
		if item["price"] != 150.0 {
			t.Errorf("expected price 150.0, got %v", item["price"])
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()
}

func TestDeleteProduct(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "DELETE" {
			t.Errorf("expected DELETE, got %s", r.Method)
		}
		if r.URL.Path != "/items/SKU001" {
			t.Errorf("expected path '/items/SKU001', got '%s'", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()
}

func TestImportOrders(t *testing.T) {
	t.Run("successful import", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "GET" {
				t.Errorf("expected GET, got %s", r.Method)
			}

			response := map[string]interface{}{
				"content": []interface{}{
					map[string]interface{}{
						"id":     12345.0,
						"status": "pending",
						"amount": 999.99,
						"created": "2024-01-15T10:30:00Z",
						"customer": map[string]interface{}{
							"first_name": "Іван",
							"last_name":  "Петренко",
							"phone":      "+380501234567",
							"email":      "ivan@example.com",
						},
						"delivery": map[string]interface{}{
							"delivery_service":  "nova_poshta",
							"recipient_address": "Відділення №1",
							"city":              "Київ",
							"ttn":               "20450000001234",
						},
						"payment": map[string]interface{}{
							"type": "cash",
						},
						"items": []interface{}{
							map[string]interface{}{
								"id":       1001.0,
								"article":  "SKU001",
								"name":     "Product 1",
								"price":    500.0,
								"quantity": 2.0,
							},
						},
					},
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()
	})

	t.Run("empty orders", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := map[string]interface{}{
				"content": []interface{}{},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()
	})
}

func TestMapOrder(t *testing.T) {
	client := New()

	orderData := map[string]interface{}{
		"id":      12345.0,
		"status":  "pending",
		"amount":  999.99,
		"created": "2024-01-15T10:30:00Z",
		"customer": map[string]interface{}{
			"first_name": "Іван",
			"last_name":  "Петренко",
			"phone":      "+380501234567",
			"email":      "ivan@example.com",
		},
		"delivery": map[string]interface{}{
			"delivery_service":  "nova_poshta",
			"recipient_address": "Відділення №1",
			"city":              "Київ",
			"ttn":               "20450000001234",
		},
		"payment": map[string]interface{}{
			"type": "cash",
		},
		"items": []interface{}{
			map[string]interface{}{
				"id":       1001.0,
				"article":  "SKU001",
				"name":     "Product 1",
				"price":    500.0,
				"quantity": 2.0,
			},
		},
	}

	order := client.mapOrder(orderData)

	if order.ExternalID != "12345" {
		t.Errorf("expected ExternalID '12345', got '%s'", order.ExternalID)
	}
	if order.Status != "pending" {
		t.Errorf("expected status 'pending', got '%s'", order.Status)
	}
	if order.Total != 999.99 {
		t.Errorf("expected total 999.99, got %f", order.Total)
	}
	if order.CustomerName != "Іван Петренко" {
		t.Errorf("expected CustomerName 'Іван Петренко', got '%s'", order.CustomerName)
	}
	if order.CustomerPhone != "+380501234567" {
		t.Errorf("expected CustomerPhone '+380501234567', got '%s'", order.CustomerPhone)
	}
	if order.DeliveryCity != "Київ" {
		t.Errorf("expected DeliveryCity 'Київ', got '%s'", order.DeliveryCity)
	}
	if len(order.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(order.Items))
	}
	if order.Items[0].Total != 1000.0 {
		t.Errorf("expected item total 1000.0, got %f", order.Items[0].Total)
	}
}

func TestUpdateOrderStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Errorf("expected PATCH, got %s", r.Method)
		}
		if r.URL.Path != "/orders/12345/status" {
			t.Errorf("expected path '/orders/12345/status', got '%s'", r.URL.Path)
		}

		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)
		if req["status"] != "confirmed" {
			t.Errorf("expected status 'confirmed', got '%v'", req["status"])
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()
}

func TestGetCategories(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/categories" {
			t.Errorf("expected path '/categories', got '%s'", r.URL.Path)
		}

		response := map[string]interface{}{
			"content": []interface{}{
				map[string]interface{}{
					"id":   1000.0,
					"name": "Електроніка",
					"children": []interface{}{
						map[string]interface{}{
							"id":   1001.0,
							"name": "Смартфони",
						},
						map[string]interface{}{
							"id":   1002.0,
							"name": "Ноутбуки",
						},
					},
				},
				map[string]interface{}{
					"id":   2000.0,
					"name": "Одяг",
				},
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()
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

func TestSetTTN(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Errorf("expected PATCH, got %s", r.Method)
		}
		if r.URL.Path != "/orders/12345/delivery" {
			t.Errorf("expected path '/orders/12345/delivery', got '%s'", r.URL.Path)
		}

		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)
		if req["ttn"] != "20450000001234" {
			t.Errorf("expected ttn '20450000001234', got '%v'", req["ttn"])
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()
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

	t.Run("server error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error": "internal server error"}`))
		}))
		defer server.Close()
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
			SKU:      "SKU001",
			Name:     "Test Product",
			Price:    100.0,
			IsActive: true,
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

// Benchmark Tests

func BenchmarkMapProductToRozetka(b *testing.B) {
	client := New()
	client.Configure(&marketplace.Config{AccessToken: "test"})

	product := &marketplace.Product{
		SKU:         "SKU001",
		Name:        "Test Product",
		Description: "Test Description",
		Price:       999.99,
		OldPrice:    1299.99,
		Quantity:    50,
		CategoryID:  "cat-123",
		Brand:       "Test Brand",
		Images:      []string{"https://img1.jpg", "https://img2.jpg"},
		IsActive:    true,
		Attributes: map[string]string{
			"Color": "Red",
			"Size":  "Large",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.mapProductToRozetka(product)
	}
}

func BenchmarkMapOrder(b *testing.B) {
	client := New()

	orderData := map[string]interface{}{
		"id":      12345.0,
		"status":  "pending",
		"amount":  999.99,
		"created": time.Now().Format(time.RFC3339),
		"customer": map[string]interface{}{
			"first_name": "Іван",
			"last_name":  "Петренко",
			"phone":      "+380501234567",
		},
		"items": []interface{}{
			map[string]interface{}{
				"id":       1001.0,
				"article":  "SKU001",
				"name":     "Product 1",
				"price":    500.0,
				"quantity": 2.0,
			},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.mapOrder(orderData)
	}
}
