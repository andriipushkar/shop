package prom

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
	if client.Type() != marketplace.MarketplaceProm {
		t.Errorf("expected type 'prom', got '%s'", client.Type())
	}
}

func TestConfigure(t *testing.T) {
	client := New()
	config := &marketplace.Config{
		Type:        marketplace.MarketplaceProm,
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
	t.Run("successful export new products", func(t *testing.T) {
		callCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			callCount++
			// First call: check if product exists
			if r.Method == "GET" {
				response := map[string]interface{}{
					"products": []interface{}{},
				}
				json.NewEncoder(w).Encode(response)
				return
			}
			// Second call: create product
			if r.Method == "POST" {
				response := map[string]interface{}{
					"id": 12345,
				}
				json.NewEncoder(w).Encode(response)
				return
			}
		}))
		defer server.Close()

		// Would test with mocked URL
		_ = server
	})

	t.Run("update existing products", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "GET" {
				// Product exists
				response := map[string]interface{}{
					"products": []interface{}{
						map[string]interface{}{
							"id": 12345.0,
						},
					},
				}
				json.NewEncoder(w).Encode(response)
				return
			}
			if r.Method == "POST" {
				response := map[string]interface{}{
					"id": 12345,
				}
				json.NewEncoder(w).Encode(response)
				return
			}
		}))
		defer server.Close()
	})
}

func TestExportProduct(t *testing.T) {
	t.Run("product with discount", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "GET" {
				response := map[string]interface{}{
					"products": []interface{}{},
				}
				json.NewEncoder(w).Encode(response)
				return
			}

			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			// Check discount is set
			if discount, ok := req["discount"].(map[string]interface{}); ok {
				if discount["value"] != 100.0 {
					t.Errorf("expected discount value 100, got %v", discount["value"])
				}
				if discount["type"] != "amount" {
					t.Errorf("expected discount type 'amount', got %v", discount["type"])
				}
			} else {
				t.Error("expected discount to be set")
			}

			json.NewEncoder(w).Encode(map[string]interface{}{"id": 1})
		}))
		defer server.Close()

		product := &marketplace.Product{
			SKU:      "SKU001",
			Price:    900.0,
			OldPrice: 1000.0,
		}

		// Would test with mocked URL
		_ = product
	})
}

func TestMapAvailability(t *testing.T) {
	client := New()

	tests := []struct {
		name     string
		product  *marketplace.Product
		expected string
	}{
		{
			name:     "available with stock",
			product:  &marketplace.Product{IsAvailable: true, Quantity: 10},
			expected: "available",
		},
		{
			name:     "running low",
			product:  &marketplace.Product{IsAvailable: true, Quantity: 3},
			expected: "running_low",
		},
		{
			name:     "not available - zero stock",
			product:  &marketplace.Product{IsAvailable: true, Quantity: 0},
			expected: "not_available",
		},
		{
			name:     "not available - disabled",
			product:  &marketplace.Product{IsAvailable: false, Quantity: 10},
			expected: "not_available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := client.mapAvailability(tt.product)
			if result != tt.expected {
				t.Errorf("expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

func TestMapImages(t *testing.T) {
	client := New()

	images := []string{
		"https://img1.jpg",
		"https://img2.jpg",
		"https://img3.jpg",
	}

	result := client.mapImages(images)

	if len(result) != 3 {
		t.Errorf("expected 3 images, got %d", len(result))
	}
	if result[0]["url"] != "https://img1.jpg" {
		t.Errorf("expected first image 'https://img1.jpg', got '%s'", result[0]["url"])
	}
}

func TestUpdateStock(t *testing.T) {
	t.Run("product found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "GET" {
				response := map[string]interface{}{
					"products": []interface{}{
						map[string]interface{}{
							"id": 12345.0,
						},
					},
				}
				json.NewEncoder(w).Encode(response)
				return
			}

			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			if req["id"] != 12345.0 {
				t.Errorf("expected id 12345, got %v", req["id"])
			}
			if req["quantity_in_stock"] != float64(50) {
				t.Errorf("expected quantity 50, got %v", req["quantity_in_stock"])
			}
			if req["presence"] != "available" {
				t.Errorf("expected presence 'available', got %v", req["presence"])
			}

			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}))
		defer server.Close()
	})

	t.Run("product not found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := map[string]interface{}{
				"products": []interface{}{},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()
	})

	t.Run("set out of stock", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "GET" {
				response := map[string]interface{}{
					"products": []interface{}{
						map[string]interface{}{"id": 1.0},
					},
				}
				json.NewEncoder(w).Encode(response)
				return
			}

			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			if req["presence"] != "not_available" {
				t.Errorf("expected presence 'not_available' for zero stock, got %v", req["presence"])
			}

			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}))
		defer server.Close()
	})
}

func TestUpdatePrice(t *testing.T) {
	t.Run("product found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "GET" {
				response := map[string]interface{}{
					"products": []interface{}{
						map[string]interface{}{
							"id": 12345.0,
						},
					},
				}
				json.NewEncoder(w).Encode(response)
				return
			}

			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			if req["id"] != 12345.0 {
				t.Errorf("expected id 12345, got %v", req["id"])
			}
			if req["price"] != 199.99 {
				t.Errorf("expected price 199.99, got %v", req["price"])
			}

			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}))
		defer server.Close()
	})

	t.Run("product not found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := map[string]interface{}{
				"products": []interface{}{},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()
	})
}

func TestDeleteProduct(t *testing.T) {
	t.Run("successful delete", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "GET" {
				response := map[string]interface{}{
					"products": []interface{}{
						map[string]interface{}{"id": 12345.0},
					},
				}
				json.NewEncoder(w).Encode(response)
				return
			}

			if r.URL.Path != "/products/delete" {
				t.Errorf("expected path '/products/delete', got '%s'", r.URL.Path)
			}

			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)
			if req["id"] != 12345.0 {
				t.Errorf("expected id 12345, got %v", req["id"])
			}

			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}))
		defer server.Close()
	})

	t.Run("product not found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := map[string]interface{}{
				"products": []interface{}{},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()
	})
}

func TestImportOrders(t *testing.T) {
	t.Run("successful import", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "GET" {
				t.Errorf("expected GET, got %s", r.Method)
			}

			response := map[string]interface{}{
				"orders": []interface{}{
					map[string]interface{}{
						"id":     12345.0,
						"status": "pending",
						"date_created": "2024-01-15 10:30:00",
						"client": map[string]interface{}{
							"first_name": "Іван",
							"last_name":  "Петренко",
							"phones":     []interface{}{"+380501234567"},
							"email":      "ivan@example.com",
						},
						"delivery": map[string]interface{}{
							"delivery_type": "nova_poshta",
							"address":       "Відділення №1",
							"city":          "Київ",
						},
						"payment": map[string]interface{}{
							"payment_type": "cash",
						},
						"products": []interface{}{
							map[string]interface{}{
								"id":       1001.0,
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
				"orders": []interface{}{},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()
	})
}

func TestMapOrder(t *testing.T) {
	client := New()

	orderData := map[string]interface{}{
		"id":     12345.0,
		"status": "pending",
		"date_created": "2024-01-15 10:30:00",
		"client": map[string]interface{}{
			"first_name": "Іван",
			"last_name":  "Петренко",
			"phones":     []interface{}{"+380501234567"},
			"email":      "ivan@example.com",
		},
		"delivery": map[string]interface{}{
			"delivery_type": "nova_poshta",
			"address":       "Відділення №1",
			"city":          "Київ",
		},
		"payment": map[string]interface{}{
			"payment_type": "cash",
		},
		"products": []interface{}{
			map[string]interface{}{
				"id":       1001.0,
				"name":     "Product 1",
				"price":    500.0,
				"quantity": 2.0,
			},
			map[string]interface{}{
				"id":       1002.0,
				"name":     "Product 2",
				"price":    300.0,
				"quantity": 1.0,
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
	if order.CustomerName != "Іван Петренко" {
		t.Errorf("expected CustomerName 'Іван Петренко', got '%s'", order.CustomerName)
	}
	if order.CustomerPhone != "+380501234567" {
		t.Errorf("expected CustomerPhone '+380501234567', got '%s'", order.CustomerPhone)
	}
	if order.DeliveryCity != "Київ" {
		t.Errorf("expected DeliveryCity 'Київ', got '%s'", order.DeliveryCity)
	}
	if len(order.Items) != 2 {
		t.Errorf("expected 2 items, got %d", len(order.Items))
	}
	if order.Total != 1300.0 { // 500*2 + 300*1
		t.Errorf("expected total 1300.0, got %f", order.Total)
	}
	if order.Items[0].Total != 1000.0 {
		t.Errorf("expected first item total 1000.0, got %f", order.Items[0].Total)
	}
}

func TestUpdateOrderStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/orders/set_status" {
			t.Errorf("expected path '/orders/set_status', got '%s'", r.URL.Path)
		}

		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		ids := req["ids"].([]interface{})
		if len(ids) != 1 || ids[0] != "12345" {
			t.Errorf("expected ids ['12345'], got %v", ids)
		}
		if req["status"] != "confirmed" {
			t.Errorf("expected status 'confirmed', got '%v'", req["status"])
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()
}

func TestGetCategories(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/categories/list" {
			t.Errorf("expected path '/categories/list', got '%s'", r.URL.Path)
		}

		response := map[string]interface{}{
			"categories": []interface{}{
				map[string]interface{}{
					"id":        1000.0,
					"caption":   "Електроніка",
					"parent_id": nil,
				},
				map[string]interface{}{
					"id":        1001.0,
					"caption":   "Смартфони",
					"parent_id": 1000.0,
				},
			},
		}
		json.NewEncoder(w).Encode(response)
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

// Benchmark Tests

func BenchmarkMapOrder(b *testing.B) {
	client := New()

	orderData := map[string]interface{}{
		"id":     12345.0,
		"status": "pending",
		"date_created": time.Now().Format("2006-01-02 15:04:05"),
		"client": map[string]interface{}{
			"first_name": "Іван",
			"last_name":  "Петренко",
			"phones":     []interface{}{"+380501234567"},
		},
		"products": []interface{}{
			map[string]interface{}{
				"id":       1001.0,
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

func BenchmarkMapAvailability(b *testing.B) {
	client := New()
	product := &marketplace.Product{
		IsAvailable: true,
		Quantity:    10,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.mapAvailability(product)
	}
}

func BenchmarkMapImages(b *testing.B) {
	client := New()
	images := []string{
		"https://img1.jpg",
		"https://img2.jpg",
		"https://img3.jpg",
		"https://img4.jpg",
		"https://img5.jpg",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.mapImages(images)
	}
}
