// +build e2e

package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"core/internal/pim"
)

// setupTestHandler creates a handler with in-memory repository for testing
func setupTestHandler() *Handler {
	repo := pim.NewMemoryRepository()
	service := pim.NewService(repo)
	return NewHandler(service)
}

// TestE2E_ProductCRUD tests full product lifecycle
func TestE2E_ProductCRUD(t *testing.T) {
	handler := setupTestHandler()

	// Create product
	t.Run("Create Product", func(t *testing.T) {
		product := map[string]interface{}{
			"name":        "Test Product",
			"description": "Test Description",
			"price":       99.99,
			"sku":         "SKU001",
			"stock":       100,
		}
		body, _ := json.Marshal(product)

		req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.CreateProduct(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
		}

		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)

		if response["id"] == "" {
			t.Error("expected ID to be set")
		}
		if response["name"] != "Test Product" {
			t.Errorf("expected name 'Test Product', got '%v'", response["name"])
		}
	})

	// List products
	t.Run("List Products", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/products", nil)
		w := httptest.NewRecorder()

		handler.ListProducts(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var products []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&products)

		if len(products) != 1 {
			t.Errorf("expected 1 product, got %d", len(products))
		}
	})

	// Get product by ID
	t.Run("Get Product", func(t *testing.T) {
		// First list to get ID
		req := httptest.NewRequest(http.MethodGet, "/products", nil)
		w := httptest.NewRecorder()
		handler.ListProducts(w, req)

		var products []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&products)
		productID := products[0]["id"].(string)

		// Get by ID
		req = httptest.NewRequest(http.MethodGet, "/products/"+productID, nil)
		w = httptest.NewRecorder()
		handler.GetProduct(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
	})

	// Update product
	t.Run("Update Product", func(t *testing.T) {
		// Get product ID
		req := httptest.NewRequest(http.MethodGet, "/products", nil)
		w := httptest.NewRecorder()
		handler.ListProducts(w, req)

		var products []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&products)
		productID := products[0]["id"].(string)

		// Update
		update := map[string]interface{}{
			"name":        "Updated Product",
			"description": "Updated Description",
			"price":       149.99,
			"sku":         "SKU001",
			"stock":       50,
		}
		body, _ := json.Marshal(update)

		req = httptest.NewRequest(http.MethodPut, "/products/"+productID, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()
		handler.UpdateProduct(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Delete product
	t.Run("Delete Product", func(t *testing.T) {
		// Get product ID
		req := httptest.NewRequest(http.MethodGet, "/products", nil)
		w := httptest.NewRecorder()
		handler.ListProducts(w, req)

		var products []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&products)
		productID := products[0]["id"].(string)

		// Delete
		req = httptest.NewRequest(http.MethodDelete, "/products/"+productID, nil)
		w = httptest.NewRecorder()
		handler.DeleteProduct(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", w.Code)
		}

		// Verify deleted
		req = httptest.NewRequest(http.MethodGet, "/products/"+productID, nil)
		w = httptest.NewRecorder()
		handler.GetProduct(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected status 404 for deleted product, got %d", w.Code)
		}
	})
}

// TestE2E_CategoryCRUD tests category operations
func TestE2E_CategoryCRUD(t *testing.T) {
	handler := setupTestHandler()

	// Create category
	t.Run("Create Category", func(t *testing.T) {
		category := map[string]interface{}{
			"name": "Electronics",
		}
		body, _ := json.Marshal(category)

		req := httptest.NewRequest(http.MethodPost, "/categories", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.CreateCategory(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
		}
	})

	// List categories
	t.Run("List Categories", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/categories", nil)
		w := httptest.NewRecorder()

		handler.ListCategories(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var categories []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&categories)

		if len(categories) < 1 {
			t.Errorf("expected at least 1 category, got %d", len(categories))
		}
	})
}

// TestE2E_Cart tests cart operations
func TestE2E_Cart(t *testing.T) {
	handler := setupTestHandler()
	userID := int64(12345)

	// Create a product first
	product := map[string]interface{}{
		"name":  "Cart Product",
		"price": 99.99,
		"sku":   "CART001",
		"stock": 100,
	}
	body, _ := json.Marshal(product)
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	var createdProduct map[string]interface{}
	json.NewDecoder(w.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	// Add to cart
	t.Run("Add to Cart", func(t *testing.T) {
		cartItem := map[string]interface{}{
			"product_id": productID,
			"quantity":   2,
		}
		body, _ := json.Marshal(cartItem)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/cart/%d", userID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.AddToCart(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Get cart
	t.Run("Get Cart", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/cart/%d", userID), nil)
		w := httptest.NewRecorder()

		handler.GetCart(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var items []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&items)

		if len(items) != 1 {
			t.Errorf("expected 1 item in cart, got %d", len(items))
		}
		if items[0]["quantity"].(float64) != 2 {
			t.Errorf("expected quantity 2, got %v", items[0]["quantity"])
		}
	})

	// Update quantity
	t.Run("Update Cart Item Quantity", func(t *testing.T) {
		update := map[string]interface{}{
			"quantity": 5,
		}
		body, _ := json.Marshal(update)

		req := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/cart/%d/item/%s", userID, productID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.UpdateCartItemQuantity(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Remove from cart
	t.Run("Remove from Cart", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/cart/%d/item/%s", userID, productID), nil)
		w := httptest.NewRecorder()

		handler.RemoveFromCart(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", w.Code)
		}
	})

	// Clear cart
	t.Run("Clear Cart", func(t *testing.T) {
		// Add item first
		cartItem := map[string]interface{}{"product_id": productID, "quantity": 1}
		body, _ := json.Marshal(cartItem)
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/cart/%d", userID), bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.AddToCart(w, req)

		// Clear
		req = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/cart/%d", userID), nil)
		w = httptest.NewRecorder()
		handler.ClearCart(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", w.Code)
		}
	})
}

// TestE2E_Wishlist tests wishlist operations
func TestE2E_Wishlist(t *testing.T) {
	handler := setupTestHandler()
	userID := int64(12345)

	// Create a product first
	product := map[string]interface{}{
		"name":  "Wishlist Product",
		"price": 199.99,
		"sku":   "WISH001",
		"stock": 50,
	}
	body, _ := json.Marshal(product)
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	var createdProduct map[string]interface{}
	json.NewDecoder(w.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	// Add to wishlist
	t.Run("Add to Wishlist", func(t *testing.T) {
		wishlistItem := map[string]interface{}{
			"product_id": productID,
		}
		body, _ := json.Marshal(wishlistItem)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/wishlist/%d", userID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.AddToWishlist(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Get wishlist
	t.Run("Get Wishlist", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/wishlist/%d", userID), nil)
		w := httptest.NewRecorder()

		handler.GetWishlist(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var items []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&items)

		if len(items) != 1 {
			t.Errorf("expected 1 item in wishlist, got %d", len(items))
		}
	})

	// Is in wishlist
	t.Run("Is In Wishlist", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/wishlist/%d/item/%s", userID, productID), nil)
		w := httptest.NewRecorder()

		handler.IsInWishlist(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var response map[string]bool
		json.NewDecoder(w.Body).Decode(&response)

		if !response["in_wishlist"] {
			t.Error("expected in_wishlist to be true")
		}
	})

	// Move to cart
	t.Run("Move Wishlist to Cart", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/wishlist/%d/item/%s/to-cart", userID, productID), nil)
		w := httptest.NewRecorder()

		handler.MoveWishlistToCart(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Remove from wishlist
	t.Run("Remove from Wishlist", func(t *testing.T) {
		// Add again first
		wishlistItem := map[string]interface{}{"product_id": productID}
		body, _ := json.Marshal(wishlistItem)
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/wishlist/%d", userID), bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.AddToWishlist(w, req)

		// Remove
		req = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/wishlist/%d/item/%s", userID, productID), nil)
		w = httptest.NewRecorder()
		handler.RemoveFromWishlist(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", w.Code)
		}
	})
}

// TestE2E_Reviews tests review operations
func TestE2E_Reviews(t *testing.T) {
	handler := setupTestHandler()

	// Create a product first
	product := map[string]interface{}{
		"name":  "Review Product",
		"price": 299.99,
		"sku":   "REV001",
		"stock": 30,
	}
	body, _ := json.Marshal(product)
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	var createdProduct map[string]interface{}
	json.NewDecoder(w.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	// Create review
	t.Run("Create Review", func(t *testing.T) {
		review := map[string]interface{}{
			"product_id": productID,
			"user_id":    12345,
			"user_name":  "Іван Петренко",
			"rating":     5,
			"comment":    "Чудовий товар!",
		}
		body, _ := json.Marshal(review)

		req := httptest.NewRequest(http.MethodPost, "/reviews", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.CreateReview(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Get product reviews
	t.Run("Get Product Reviews", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/products/%s/reviews", productID), nil)
		w := httptest.NewRecorder()

		handler.GetProductReviews(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var reviews []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&reviews)

		if len(reviews) != 1 {
			t.Errorf("expected 1 review, got %d", len(reviews))
		}
	})

	// Get product rating
	t.Run("Get Product Rating", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/products/%s/rating", productID), nil)
		w := httptest.NewRecorder()

		handler.GetProductRating(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var rating map[string]interface{}
		json.NewDecoder(w.Body).Decode(&rating)

		if rating["average_rating"].(float64) != 5.0 {
			t.Errorf("expected average rating 5.0, got %v", rating["average_rating"])
		}
	})

	// Get user reviews
	t.Run("Get User Reviews", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/users/12345/reviews", nil)
		w := httptest.NewRecorder()

		handler.GetUserReviews(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var reviews []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&reviews)

		if len(reviews) != 1 {
			t.Errorf("expected 1 review, got %d", len(reviews))
		}
	})
}

// TestE2E_Stock tests stock management
func TestE2E_Stock(t *testing.T) {
	handler := setupTestHandler()

	// Create a product
	product := map[string]interface{}{
		"name":  "Stock Product",
		"price": 49.99,
		"sku":   "STOCK001",
		"stock": 100,
	}
	body, _ := json.Marshal(product)
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	var createdProduct map[string]interface{}
	json.NewDecoder(w.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	// Update stock
	t.Run("Update Stock", func(t *testing.T) {
		stockUpdate := map[string]interface{}{
			"stock": 200,
		}
		body, _ := json.Marshal(stockUpdate)

		req := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/products/%s/stock", productID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.UpdateStock(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Decrement stock
	t.Run("Decrement Stock", func(t *testing.T) {
		decrement := map[string]interface{}{
			"quantity": 50,
		}
		body, _ := json.Marshal(decrement)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/products/%s/decrement", productID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.DecrementStock(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Verify stock
	t.Run("Verify Stock After Operations", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/products/"+productID, nil)
		w := httptest.NewRecorder()
		handler.GetProduct(w, req)

		var p map[string]interface{}
		json.NewDecoder(w.Body).Decode(&p)

		stock := int(p["stock"].(float64))
		if stock != 150 { // 200 - 50
			t.Errorf("expected stock 150, got %d", stock)
		}
	})
}

// TestE2E_ProductFilter tests product filtering
func TestE2E_ProductFilter(t *testing.T) {
	handler := setupTestHandler()

	// Create multiple products
	products := []map[string]interface{}{
		{"name": "Cheap Product", "price": 10.0, "sku": "CHEAP001", "stock": 100},
		{"name": "Medium Product", "price": 50.0, "sku": "MED001", "stock": 50},
		{"name": "Expensive Product", "price": 100.0, "sku": "EXP001", "stock": 25},
	}

	for _, p := range products {
		body, _ := json.Marshal(p)
		req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.CreateProduct(w, req)
	}

	// Filter by price
	t.Run("Filter by Price Range", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/products?min_price=20&max_price=80", nil)
		w := httptest.NewRecorder()

		handler.ListProducts(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var filtered []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&filtered)

		// Should only return Medium Product (50.0)
		for _, p := range filtered {
			price := p["price"].(float64)
			if price < 20 || price > 80 {
				t.Errorf("product price %f outside filter range", price)
			}
		}
	})

	// Search by name
	t.Run("Search by Name", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/products?search=Expensive", nil)
		w := httptest.NewRecorder()

		handler.ListProducts(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var results []map[string]interface{}
		json.NewDecoder(w.Body).Decode(&results)

		if len(results) != 1 {
			t.Errorf("expected 1 result, got %d", len(results))
		}
		if results[0]["name"] != "Expensive Product" {
			t.Errorf("expected 'Expensive Product', got '%v'", results[0]["name"])
		}
	})
}

// TestE2E_MethodNotAllowed tests wrong HTTP methods
func TestE2E_MethodNotAllowed(t *testing.T) {
	handler := setupTestHandler()

	tests := []struct {
		name    string
		method  string
		path    string
		handler func(http.ResponseWriter, *http.Request)
	}{
		{"CreateProduct with GET", http.MethodGet, "/products", handler.CreateProduct},
		{"ListProducts with POST", http.MethodPost, "/products", handler.ListProducts},
		{"UpdateProduct with POST", http.MethodPost, "/products/123", handler.UpdateProduct},
		{"DeleteProduct with GET", http.MethodGet, "/products/123", handler.DeleteProduct},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			tt.handler(w, req)

			if w.Code != http.StatusMethodNotAllowed {
				t.Errorf("expected status 405, got %d", w.Code)
			}
		})
	}
}

// TestE2E_InvalidJSON tests invalid JSON handling
func TestE2E_InvalidJSON(t *testing.T) {
	handler := setupTestHandler()

	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateProduct(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid JSON, got %d", w.Code)
	}
}

// TestE2E_EmptyBody tests empty request body
func TestE2E_EmptyBody(t *testing.T) {
	handler := setupTestHandler()

	req := httptest.NewRequest(http.MethodPost, "/products", nil)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateProduct(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for empty body, got %d", w.Code)
	}
}

// TestE2E_Inventory tests inventory endpoints
func TestE2E_Inventory(t *testing.T) {
	handler := setupTestHandler()

	// Create products with different stock levels
	products := []map[string]interface{}{
		{"name": "In Stock", "price": 100, "sku": "INV001", "stock": 100},
		{"name": "Low Stock", "price": 100, "sku": "INV002", "stock": 5},
		{"name": "Out of Stock", "price": 100, "sku": "INV003", "stock": 0},
	}

	for _, p := range products {
		body, _ := json.Marshal(p)
		req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.CreateProduct(w, req)
	}

	// Get low stock products
	t.Run("Get Low Stock Products", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/inventory/low-stock?threshold=10", nil)
		w := httptest.NewRecorder()

		handler.GetLowStockProducts(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
	})

	// Get out of stock products
	t.Run("Get Out of Stock Products", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/inventory/out-of-stock", nil)
		w := httptest.NewRecorder()

		handler.GetOutOfStockProducts(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
	})

	// Get inventory stats
	t.Run("Get Inventory Stats", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/inventory/stats", nil)
		w := httptest.NewRecorder()

		handler.GetInventoryStats(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
	})
}

// TestE2E_Search tests search functionality
func TestE2E_Search(t *testing.T) {
	handler := setupTestHandler()

	// Create products
	products := []map[string]interface{}{
		{"name": "iPhone 15 Pro", "price": 999, "sku": "IPHONE15", "stock": 10},
		{"name": "Samsung Galaxy S24", "price": 899, "sku": "SAMSUNG24", "stock": 20},
		{"name": "Google Pixel 8", "price": 699, "sku": "PIXEL8", "stock": 15},
	}

	for _, p := range products {
		body, _ := json.Marshal(p)
		req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.CreateProduct(w, req)
	}

	// Search products
	t.Run("Search Products", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/search?q=iPhone", nil)
		w := httptest.NewRecorder()

		handler.SearchProducts(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
	})

	// Search suggestions
	t.Run("Search Suggestions", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/search/suggest?q=Sam", nil)
		w := httptest.NewRecorder()

		handler.SearchSuggest(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
	})
}

// Benchmark tests

func BenchmarkCreateProduct(b *testing.B) {
	handler := setupTestHandler()

	product := map[string]interface{}{
		"name":  "Benchmark Product",
		"price": 99.99,
		"sku":   "BENCH",
		"stock": 100,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		product["sku"] = fmt.Sprintf("BENCH%d", i)
		body, _ := json.Marshal(product)

		req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.CreateProduct(w, req)
	}
}

func BenchmarkListProducts(b *testing.B) {
	handler := setupTestHandler()

	// Create some products
	for i := 0; i < 100; i++ {
		product := map[string]interface{}{
			"name":  fmt.Sprintf("Product %d", i),
			"price": float64(i) * 10,
			"sku":   fmt.Sprintf("SKU%d", i),
			"stock": i * 10,
		}
		body, _ := json.Marshal(product)
		req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.CreateProduct(w, req)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodGet, "/products", nil)
		w := httptest.NewRecorder()
		handler.ListProducts(w, req)
	}
}

func BenchmarkAddToCart(b *testing.B) {
	handler := setupTestHandler()

	// Create a product
	product := map[string]interface{}{
		"name":  "Cart Product",
		"price": 99.99,
		"sku":   "CART001",
		"stock": 1000,
	}
	body, _ := json.Marshal(product)
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	var createdProduct map[string]interface{}
	json.NewDecoder(w.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cartItem := map[string]interface{}{
			"product_id": productID,
			"quantity":   1,
		}
		body, _ := json.Marshal(cartItem)

		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/cart/%d", i), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.AddToCart(w, req)
	}
}

// Helper to simulate time passing
func init() {
	// Seed for consistent test results
	_ = time.Now().UnixNano()
}
