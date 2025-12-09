package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// Product represents a product in the shop
type Product struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	SKU        string  `json:"sku"`
	Stock      int     `json:"stock"`
	CategoryID string  `json:"category_id,omitempty"`
	ImageURL   string  `json:"image_url,omitempty"`
}

// Order represents an order in the shop
type Order struct {
	ID          string `json:"id"`
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name,omitempty"`
	Quantity    int    `json:"quantity"`
	Status      string `json:"status"`
	UserID      int64  `json:"user_id"`
	Phone       string `json:"phone,omitempty"`
	Address     string `json:"address,omitempty"`
}

// Category represents a product category
type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CartItem represents an item in the cart
type CartItem struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
}

// PromoCode represents a promotional code
type PromoCode struct {
	Code      string  `json:"code"`
	Discount  float64 `json:"discount"`
	MaxUses   int     `json:"max_uses"`
	UsedCount int     `json:"used_count"`
	Active    bool    `json:"active"`
}

// MockCoreServer creates a mock Core service for testing
func MockCoreServer() *httptest.Server {
	products := make(map[string]*Product)
	categories := make(map[string]*Category)
	carts := make(map[int64][]CartItem)

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/health":
			json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})

		case r.Method == http.MethodGet && r.URL.Path == "/products":
			productList := make([]*Product, 0, len(products))
			for _, p := range products {
				productList = append(productList, p)
			}
			json.NewEncoder(w).Encode(productList)

		case r.Method == http.MethodPost && r.URL.Path == "/products":
			var product Product
			json.NewDecoder(r.Body).Decode(&product)
			product.ID = fmt.Sprintf("prod-%d", time.Now().UnixNano())
			products[product.ID] = &product
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(product)

		case r.Method == http.MethodGet && r.URL.Path == "/categories":
			categoryList := make([]*Category, 0, len(categories))
			for _, c := range categories {
				categoryList = append(categoryList, c)
			}
			json.NewEncoder(w).Encode(categoryList)

		case r.Method == http.MethodPost && r.URL.Path == "/categories":
			var category Category
			json.NewDecoder(r.Body).Decode(&category)
			category.ID = fmt.Sprintf("cat-%d", time.Now().UnixNano())
			categories[category.ID] = &category
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(category)

		default:
			// Handle cart endpoints
			if len(r.URL.Path) > 6 && r.URL.Path[:5] == "/cart" {
				var userID int64
				fmt.Sscanf(r.URL.Path[6:], "%d", &userID)

				if r.Method == http.MethodGet {
					json.NewEncoder(w).Encode(carts[userID])
				} else if r.Method == http.MethodPost {
					var item CartItem
					json.NewDecoder(r.Body).Decode(&item)
					carts[userID] = append(carts[userID], item)
					w.WriteHeader(http.StatusCreated)
				} else if r.Method == http.MethodDelete {
					delete(carts, userID)
				}
				return
			}

			http.NotFound(w, r)
		}
	}))
}

// MockOMSServer creates a mock OMS service for testing
func MockOMSServer() *httptest.Server {
	orders := make(map[string]*Order)
	promos := make(map[string]*PromoCode)

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/health":
			json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})

		case r.Method == http.MethodGet && r.URL.Path == "/orders":
			orderList := make([]*Order, 0, len(orders))
			for _, o := range orders {
				orderList = append(orderList, o)
			}
			json.NewEncoder(w).Encode(orderList)

		case r.Method == http.MethodPost && r.URL.Path == "/orders":
			var order Order
			json.NewDecoder(r.Body).Decode(&order)
			order.ID = fmt.Sprintf("ORD-%d", time.Now().UnixNano())
			order.Status = "NEW"
			orders[order.ID] = &order
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"id": order.ID})

		case r.Method == http.MethodGet && r.URL.Path == "/stats":
			stats := map[string]interface{}{
				"total_orders":      len(orders),
				"orders_by_status":  map[string]int{"NEW": len(orders)},
				"orders_today":      1,
				"orders_this_week":  5,
				"orders_this_month": 20,
			}
			json.NewEncoder(w).Encode(stats)

		case r.Method == http.MethodGet && r.URL.Path == "/promo":
			promoList := make([]*PromoCode, 0, len(promos))
			for _, p := range promos {
				promoList = append(promoList, p)
			}
			json.NewEncoder(w).Encode(promoList)

		case r.Method == http.MethodPost && r.URL.Path == "/promo":
			var promo PromoCode
			json.NewDecoder(r.Body).Decode(&promo)
			promo.Active = true
			promos[promo.Code] = &promo
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(promo)

		case r.Method == http.MethodPost && r.URL.Path == "/promo/validate":
			var req struct {
				Code string `json:"code"`
			}
			json.NewDecoder(r.Body).Decode(&req)
			if promo, ok := promos[req.Code]; ok && promo.Active {
				json.NewEncoder(w).Encode(map[string]interface{}{
					"valid":    true,
					"discount": promo.Discount,
				})
			} else {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]interface{}{"valid": false})
			}

		default:
			http.NotFound(w, r)
		}
	}))
}

// TestE2E_HealthCheck tests health endpoints
func TestE2E_HealthCheck(t *testing.T) {
	coreServer := MockCoreServer()
	defer coreServer.Close()

	omsServer := MockOMSServer()
	defer omsServer.Close()

	// Test Core health
	resp, err := http.Get(coreServer.URL + "/health")
	if err != nil {
		t.Fatalf("failed to get core health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var health map[string]string
	json.NewDecoder(resp.Body).Decode(&health)
	if health["status"] != "healthy" {
		t.Errorf("expected status 'healthy', got '%s'", health["status"])
	}

	// Test OMS health
	resp, err = http.Get(omsServer.URL + "/health")
	if err != nil {
		t.Fatalf("failed to get oms health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

// TestE2E_ProductCRUD tests product CRUD operations
func TestE2E_ProductCRUD(t *testing.T) {
	server := MockCoreServer()
	defer server.Close()

	// Create product
	product := Product{
		Name:  "iPhone 15 Pro",
		Price: 35000.00,
		SKU:   "IPHONE-15-PRO",
		Stock: 50,
	}

	body, _ := json.Marshal(product)
	resp, err := http.Post(server.URL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create product: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	var created Product
	json.NewDecoder(resp.Body).Decode(&created)
	if created.ID == "" {
		t.Error("expected product ID to be set")
	}
	if created.Name != "iPhone 15 Pro" {
		t.Errorf("expected name 'iPhone 15 Pro', got '%s'", created.Name)
	}

	// List products
	resp, err = http.Get(server.URL + "/products")
	if err != nil {
		t.Fatalf("failed to list products: %v", err)
	}
	defer resp.Body.Close()

	var products []Product
	json.NewDecoder(resp.Body).Decode(&products)
	if len(products) != 1 {
		t.Errorf("expected 1 product, got %d", len(products))
	}
}

// TestE2E_CategoryCRUD tests category CRUD operations
func TestE2E_CategoryCRUD(t *testing.T) {
	server := MockCoreServer()
	defer server.Close()

	// Create category
	category := Category{
		Name: "Electronics",
	}

	body, _ := json.Marshal(category)
	resp, err := http.Post(server.URL+"/categories", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create category: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	var created Category
	json.NewDecoder(resp.Body).Decode(&created)
	if created.ID == "" {
		t.Error("expected category ID to be set")
	}
	if created.Name != "Electronics" {
		t.Errorf("expected name 'Electronics', got '%s'", created.Name)
	}

	// List categories
	resp, err = http.Get(server.URL + "/categories")
	if err != nil {
		t.Fatalf("failed to list categories: %v", err)
	}
	defer resp.Body.Close()

	var categories []Category
	json.NewDecoder(resp.Body).Decode(&categories)
	if len(categories) != 1 {
		t.Errorf("expected 1 category, got %d", len(categories))
	}
}

// TestE2E_OrderFlow tests the complete order flow
func TestE2E_OrderFlow(t *testing.T) {
	coreServer := MockCoreServer()
	defer coreServer.Close()

	omsServer := MockOMSServer()
	defer omsServer.Close()

	// Step 1: Create a product
	product := Product{
		Name:  "MacBook Pro",
		Price: 75000.00,
		SKU:   "MBP-2024",
		Stock: 10,
	}
	body, _ := json.Marshal(product)
	resp, err := http.Post(coreServer.URL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create product: %v", err)
	}
	var createdProduct Product
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	resp.Body.Close()

	// Step 2: Add to cart
	cartItem := map[string]interface{}{
		"product_id": createdProduct.ID,
		"quantity":   1,
	}
	body, _ = json.Marshal(cartItem)
	resp, err = http.Post(coreServer.URL+"/cart/12345", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to add to cart: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201 for cart add, got %d", resp.StatusCode)
	}

	// Step 3: Create order
	order := map[string]interface{}{
		"product_id": createdProduct.ID,
		"quantity":   1,
		"user_id":    12345,
		"phone":      "+380991234567",
		"address":    "Київ, вул. Хрещатик 1",
	}
	body, _ = json.Marshal(order)
	resp, err = http.Post(omsServer.URL+"/orders", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create order: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201 for order, got %d", resp.StatusCode)
	}

	var orderResp map[string]string
	json.NewDecoder(resp.Body).Decode(&orderResp)
	if orderResp["id"] == "" {
		t.Error("expected order ID to be set")
	}

	// Step 4: Check orders list
	resp, err = http.Get(omsServer.URL + "/orders")
	if err != nil {
		t.Fatalf("failed to list orders: %v", err)
	}
	defer resp.Body.Close()

	var orders []Order
	json.NewDecoder(resp.Body).Decode(&orders)
	if len(orders) != 1 {
		t.Errorf("expected 1 order, got %d", len(orders))
	}
}

// TestE2E_PromoCodeFlow tests promo code creation and validation
func TestE2E_PromoCodeFlow(t *testing.T) {
	server := MockOMSServer()
	defer server.Close()

	// Create promo code
	promo := PromoCode{
		Code:     "SALE20",
		Discount: 20,
		MaxUses:  100,
	}
	body, _ := json.Marshal(promo)
	resp, err := http.Post(server.URL+"/promo", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create promo: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	// Validate promo code
	validateReq := map[string]string{"code": "SALE20"}
	body, _ = json.Marshal(validateReq)
	resp, err = http.Post(server.URL+"/promo/validate", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to validate promo: %v", err)
	}
	defer resp.Body.Close()

	var validateResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&validateResp)
	if validateResp["valid"] != true {
		t.Error("expected promo to be valid")
	}
	if validateResp["discount"].(float64) != 20 {
		t.Errorf("expected discount 20, got %v", validateResp["discount"])
	}

	// Validate invalid promo code
	validateReq = map[string]string{"code": "INVALID"}
	body, _ = json.Marshal(validateReq)
	resp, err = http.Post(server.URL+"/promo/validate", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to validate promo: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid promo, got %d", resp.StatusCode)
	}
}

// TestE2E_CartFlow tests cart operations
func TestE2E_CartFlow(t *testing.T) {
	server := MockCoreServer()
	defer server.Close()

	userID := int64(12345)

	// Add item to cart
	item := map[string]interface{}{
		"product_id": "prod-1",
		"name":       "Test Product",
		"price":      100.00,
		"quantity":   2,
	}
	body, _ := json.Marshal(item)
	resp, err := http.Post(fmt.Sprintf("%s/cart/%d", server.URL, userID), "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to add to cart: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	// Get cart
	resp, err = http.Get(fmt.Sprintf("%s/cart/%d", server.URL, userID))
	if err != nil {
		t.Fatalf("failed to get cart: %v", err)
	}
	defer resp.Body.Close()

	var cart []CartItem
	json.NewDecoder(resp.Body).Decode(&cart)
	if len(cart) != 1 {
		t.Errorf("expected 1 item in cart, got %d", len(cart))
	}

	// Clear cart
	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/cart/%d", server.URL, userID), nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed to clear cart: %v", err)
	}
	resp.Body.Close()

	// Verify cart is empty
	resp, err = http.Get(fmt.Sprintf("%s/cart/%d", server.URL, userID))
	if err != nil {
		t.Fatalf("failed to get cart: %v", err)
	}
	defer resp.Body.Close()

	json.NewDecoder(resp.Body).Decode(&cart)
	if len(cart) != 0 {
		t.Errorf("expected empty cart, got %d items", len(cart))
	}
}

// TestE2E_Stats tests statistics endpoint
func TestE2E_Stats(t *testing.T) {
	server := MockOMSServer()
	defer server.Close()

	// Create some orders first
	for i := 0; i < 3; i++ {
		order := map[string]interface{}{
			"product_id": fmt.Sprintf("prod-%d", i),
			"quantity":   i + 1,
			"user_id":    12345,
		}
		body, _ := json.Marshal(order)
		resp, _ := http.Post(server.URL+"/orders", "application/json", bytes.NewBuffer(body))
		resp.Body.Close()
	}

	// Get stats
	resp, err := http.Get(server.URL + "/stats")
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	defer resp.Body.Close()

	var stats map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&stats)

	if stats["total_orders"].(float64) != 3 {
		t.Errorf("expected total_orders 3, got %v", stats["total_orders"])
	}
}

// TestE2E_MultipleProducts tests handling multiple products
func TestE2E_MultipleProducts(t *testing.T) {
	server := MockCoreServer()
	defer server.Close()

	// Create multiple products
	products := []Product{
		{Name: "iPhone", Price: 35000, SKU: "IPHONE", Stock: 10},
		{Name: "MacBook", Price: 75000, SKU: "MACBOOK", Stock: 5},
		{Name: "iPad", Price: 25000, SKU: "IPAD", Stock: 20},
		{Name: "Apple Watch", Price: 15000, SKU: "WATCH", Stock: 30},
		{Name: "AirPods", Price: 8000, SKU: "AIRPODS", Stock: 50},
	}

	for _, p := range products {
		body, _ := json.Marshal(p)
		resp, err := http.Post(server.URL+"/products", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("failed to create product: %v", err)
		}
		resp.Body.Close()
	}

	// List all products
	resp, err := http.Get(server.URL + "/products")
	if err != nil {
		t.Fatalf("failed to list products: %v", err)
	}
	defer resp.Body.Close()

	var listedProducts []Product
	json.NewDecoder(resp.Body).Decode(&listedProducts)
	if len(listedProducts) != 5 {
		t.Errorf("expected 5 products, got %d", len(listedProducts))
	}
}

// BenchmarkE2E_CreateProduct benchmarks product creation
func BenchmarkE2E_CreateProduct(b *testing.B) {
	server := MockCoreServer()
	defer server.Close()

	product := Product{
		Name:  "Benchmark Product",
		Price: 100.00,
		SKU:   "BENCH",
		Stock: 100,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		body, _ := json.Marshal(product)
		resp, _ := http.Post(server.URL+"/products", "application/json", bytes.NewBuffer(body))
		resp.Body.Close()
	}
}

// BenchmarkE2E_ListProducts benchmarks product listing
func BenchmarkE2E_ListProducts(b *testing.B) {
	server := MockCoreServer()
	defer server.Close()

	// Pre-create some products
	for i := 0; i < 50; i++ {
		product := Product{
			Name:  fmt.Sprintf("Product %d", i),
			Price: float64(i) * 100,
			SKU:   fmt.Sprintf("SKU-%d", i),
			Stock: i * 10,
		}
		body, _ := json.Marshal(product)
		resp, _ := http.Post(server.URL+"/products", "application/json", bytes.NewBuffer(body))
		resp.Body.Close()
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, _ := http.Get(server.URL + "/products")
		resp.Body.Close()
	}
}
