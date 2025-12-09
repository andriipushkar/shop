//go:build integration

package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"
)

var (
	coreURL = getEnv("CORE_URL", "http://localhost:8080")
	omsURL  = getEnv("OMS_URL", "http://localhost:8081")
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// TestCoreServiceHealth tests Core service health endpoint
func TestCoreServiceHealth(t *testing.T) {
	resp, err := http.Get(coreURL + "/health")
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

// TestOMSServiceHealth tests OMS service health endpoint
func TestOMSServiceHealth(t *testing.T) {
	resp, err := http.Get(omsURL + "/health")
	if err != nil {
		t.Skipf("OMS service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

// TestProductCRUD tests full product CRUD cycle
func TestProductCRUD(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create product
	product := map[string]interface{}{
		"name":  "Integration Test Product",
		"price": 999.99,
		"sku":   fmt.Sprintf("INT-TEST-%d", time.Now().Unix()),
		"stock": 100,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", resp.StatusCode)
	}

	var created map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&created)

	productID, ok := created["id"].(string)
	if !ok || productID == "" {
		t.Fatal("expected product ID in response")
	}

	t.Logf("Created product: %s", productID)

	// Get product
	resp, err = client.Get(coreURL + "/products/" + productID)
	if err != nil {
		t.Fatalf("failed to get product: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var fetched map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&fetched)

	if fetched["name"] != "Integration Test Product" {
		t.Errorf("expected name 'Integration Test Product', got '%v'", fetched["name"])
	}

	// Update stock
	stockUpdate := map[string]int{"stock": 50}
	body, _ = json.Marshal(stockUpdate)
	req, _ := http.NewRequest(http.MethodPatch, coreURL+"/products/"+productID+"/stock", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to update stock: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	// Verify stock updated
	resp, _ = client.Get(coreURL + "/products/" + productID)
	defer resp.Body.Close()
	json.NewDecoder(resp.Body).Decode(&fetched)

	if fetched["stock"].(float64) != 50 {
		t.Errorf("expected stock 50, got %v", fetched["stock"])
	}

	// Delete product
	req, _ = http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to delete product: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected status 200 or 204, got %d", resp.StatusCode)
	}

	// Verify deleted
	resp, _ = client.Get(coreURL + "/products/" + productID)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound && resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected product to be deleted")
	}
}

// TestCategoryCRUD tests full category CRUD cycle
func TestCategoryCRUD(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create category
	category := map[string]string{
		"name": fmt.Sprintf("Test Category %d", time.Now().Unix()),
	}

	body, _ := json.Marshal(category)
	resp, err := client.Post(coreURL+"/categories", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", resp.StatusCode)
	}

	var created map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&created)

	categoryID, ok := created["id"].(string)
	if !ok || categoryID == "" {
		t.Fatal("expected category ID in response")
	}

	t.Logf("Created category: %s", categoryID)

	// Get category
	resp, err = client.Get(coreURL + "/categories/" + categoryID)
	if err != nil {
		t.Fatalf("failed to get category: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	// List categories
	resp, _ = client.Get(coreURL + "/categories")
	defer resp.Body.Close()

	var categories []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&categories)

	if len(categories) == 0 {
		t.Error("expected at least one category")
	}

	// Delete category
	req, _ := http.NewRequest(http.MethodDelete, coreURL+"/categories/"+categoryID, nil)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to delete category: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected status 200 or 204, got %d", resp.StatusCode)
	}
}

// TestOrderFlow tests complete order flow
func TestOrderFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// First create a product
	product := map[string]interface{}{
		"name":  "Order Test Product",
		"price": 100.0,
		"sku":   fmt.Sprintf("ORD-TEST-%d", time.Now().Unix()),
		"stock": 10,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product, skipping order test")
	}

	var createdProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	// Create order
	order := map[string]interface{}{
		"product_id": productID,
		"quantity":   2,
		"user_id":    12345,
		"phone":      "+380991234567",
		"address":    "Test Address",
	}

	body, _ = json.Marshal(order)
	resp, err = client.Post(omsURL+"/orders", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("OMS service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", resp.StatusCode)
	}

	var createdOrder map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdOrder)

	orderID, ok := createdOrder["id"].(string)
	if !ok || orderID == "" {
		t.Fatal("expected order ID in response")
	}

	t.Logf("Created order: %s", orderID)

	// Get user orders
	resp, _ = client.Get(fmt.Sprintf("%s/orders/user/12345", omsURL))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var orders []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&orders)

	if len(orders) == 0 {
		t.Error("expected at least one order")
	}

	// Update order status
	statusUpdate := map[string]string{"status": "PROCESSING"}
	body, _ = json.Marshal(statusUpdate)
	req, _ := http.NewRequest(http.MethodPatch, omsURL+"/orders/"+orderID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to update order status: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	// Add tracking
	tracking := map[string]string{
		"tracking_num":  "TEST123456789",
		"delivery_note": "Test delivery",
	}
	body, _ = json.Marshal(tracking)
	req, _ = http.NewRequest(http.MethodPatch, omsURL+"/orders/"+orderID+"/tracking", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to add tracking: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	// Clean up - delete product
	req, _ = http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)
}

// TestPromoCodeFlow tests promo code creation and validation
func TestPromoCodeFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create promo code
	promo := map[string]interface{}{
		"code":     fmt.Sprintf("TEST%d", time.Now().Unix()),
		"discount": 15.0,
		"max_uses": 10,
	}

	body, _ := json.Marshal(promo)
	resp, err := client.Post(omsURL+"/promo", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("OMS service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", resp.StatusCode)
	}

	// List promo codes
	resp, _ = client.Get(omsURL + "/promo")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var promos []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&promos)

	if len(promos) == 0 {
		t.Error("expected at least one promo code")
	}

	// Validate promo code
	validate := map[string]string{"code": promo["code"].(string)}
	body, _ = json.Marshal(validate)
	resp, err = client.Post(omsURL+"/promo/validate", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to validate promo: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

// TestStatsEndpoint tests statistics endpoint
func TestStatsEndpoint(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Get(omsURL + "/stats")
	if err != nil {
		t.Skipf("OMS service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var stats map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&stats)

	if _, ok := stats["total_orders"]; !ok {
		t.Error("expected total_orders in stats")
	}

	if _, ok := stats["orders_by_status"]; !ok {
		t.Error("expected orders_by_status in stats")
	}
}

// TestProductSearch tests product search functionality
func TestProductSearch(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create a product with unique name
	uniqueName := fmt.Sprintf("SearchTest%d", time.Now().Unix())
	product := map[string]interface{}{
		"name":  uniqueName,
		"price": 100.0,
		"sku":   fmt.Sprintf("SEARCH-%d", time.Now().Unix()),
		"stock": 10,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product")
	}

	var created map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&created)
	productID := created["id"].(string)

	// Search for product
	resp, _ = client.Get(coreURL + "/products?search=" + uniqueName[:10])
	defer resp.Body.Close()

	var products []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&products)

	found := false
	for _, p := range products {
		if p["id"] == productID {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected to find product in search results")
	}

	// Clean up
	req, _ := http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)
}

// TestOrderWithIdempotencyKey tests idempotent order creation
func TestOrderWithIdempotencyKey(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create a product first
	product := map[string]interface{}{
		"name":  "Idempotency Test Product",
		"price": 100.0,
		"sku":   fmt.Sprintf("IDEMP-TEST-%d", time.Now().Unix()),
		"stock": 10,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product, skipping idempotency test")
	}

	var createdProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	// Generate unique idempotency key
	idempotencyKey := fmt.Sprintf("test-idemp-%d", time.Now().UnixNano())

	// Create first order with idempotency key
	order := map[string]interface{}{
		"product_id":      productID,
		"quantity":        1,
		"user_id":         12345,
		"phone":           "+380991234567",
		"address":         "Test Address",
		"idempotency_key": idempotencyKey,
	}

	body, _ = json.Marshal(order)
	resp, err = client.Post(omsURL+"/orders", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("OMS service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", resp.StatusCode)
	}

	var firstOrder map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&firstOrder)
	firstOrderID := firstOrder["id"].(string)

	t.Logf("First order ID: %s", firstOrderID)

	// Send same request again (should return existing order)
	body, _ = json.Marshal(order)
	resp, err = client.Post(omsURL+"/orders", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create second order: %v", err)
	}
	defer resp.Body.Close()

	// Should return 200 (idempotent response) or 201
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 200 or 201, got %d", resp.StatusCode)
	}

	var secondOrder map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&secondOrder)
	secondOrderID := secondOrder["id"].(string)

	// Both should have same order ID
	if firstOrderID != secondOrderID {
		t.Errorf("idempotency failed: first ID %s != second ID %s", firstOrderID, secondOrderID)
	}

	t.Logf("Idempotency test passed: both requests returned order ID %s", firstOrderID)

	// Clean up
	req, _ := http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)
}

// TestOrderWithPromoCode tests order creation with promo code
func TestOrderWithPromoCode(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create a promo code first
	promoCode := fmt.Sprintf("PROMO%d", time.Now().Unix())
	promo := map[string]interface{}{
		"code":     promoCode,
		"discount": 20.0,
		"max_uses": 10,
	}

	body, _ := json.Marshal(promo)
	resp, err := client.Post(omsURL+"/promo", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("OMS service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create promo code")
	}

	// Create a product
	product := map[string]interface{}{
		"name":  "Promo Test Product",
		"price": 100.0,
		"sku":   fmt.Sprintf("PROMO-TEST-%d", time.Now().Unix()),
		"stock": 10,
	}

	body, _ = json.Marshal(product)
	resp, err = client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product")
	}

	var createdProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	// Create order with promo code
	order := map[string]interface{}{
		"product_id": productID,
		"quantity":   1,
		"user_id":    12345,
		"phone":      "+380991234567",
		"address":    "Test Address",
		"promo_code": promoCode,
		"discount":   20.0,
	}

	body, _ = json.Marshal(order)
	resp, err = client.Post(omsURL+"/orders", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create order: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", resp.StatusCode)
	}

	var createdOrder map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdOrder)

	// Verify promo code is saved with order
	if createdOrder["promo_code"] != promoCode {
		t.Errorf("expected promo_code %s, got %v", promoCode, createdOrder["promo_code"])
	}

	if createdOrder["discount"].(float64) != 20.0 {
		t.Errorf("expected discount 20.0, got %v", createdOrder["discount"])
	}

	t.Logf("Order created with promo code: %s, discount: %v%%", promoCode, createdOrder["discount"])

	// Clean up
	req, _ := http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)
}

// TestCheckoutFlowComplete tests complete checkout flow
func TestCheckoutFlowComplete(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Create a product
	product := map[string]interface{}{
		"name":  "Checkout Flow Test Product",
		"price": 250.0,
		"sku":   fmt.Sprintf("CHECKOUT-%d", time.Now().Unix()),
		"stock": 5,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product")
	}

	var createdProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)
	initialStock := int(createdProduct["stock"].(float64))

	t.Logf("Step 1: Created product %s with stock %d", productID, initialStock)

	// 2. Create a promo code
	promoCode := fmt.Sprintf("FLOW%d", time.Now().Unix())
	promo := map[string]interface{}{
		"code":     promoCode,
		"discount": 10.0,
		"max_uses": 5,
	}

	body, _ = json.Marshal(promo)
	resp, _ = client.Post(omsURL+"/promo", "application/json", bytes.NewBuffer(body))
	defer resp.Body.Close()

	t.Logf("Step 2: Created promo code %s", promoCode)

	// 3. Validate promo code
	validate := map[string]string{"code": promoCode}
	body, _ = json.Marshal(validate)
	resp, _ = client.Post(omsURL+"/promo/validate", "application/json", bytes.NewBuffer(body))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Step 3: Promo validation failed, expected 200, got %d", resp.StatusCode)
	}

	t.Logf("Step 3: Promo code validated")

	// 4. Create order with promo
	order := map[string]interface{}{
		"product_id":      productID,
		"quantity":        2,
		"user_id":         99999,
		"phone":           "+380501234567",
		"address":         "Kyiv, Khreshchatyk 1",
		"promo_code":      promoCode,
		"discount":        10.0,
		"idempotency_key": fmt.Sprintf("checkout-flow-%d", time.Now().UnixNano()),
	}

	body, _ = json.Marshal(order)
	resp, _ = client.Post(omsURL+"/orders", "application/json", bytes.NewBuffer(body))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Step 4: Order creation failed, expected 201, got %d", resp.StatusCode)
	}

	var createdOrder map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdOrder)
	orderID := createdOrder["id"].(string)

	t.Logf("Step 4: Created order %s", orderID)

	// 5. Verify stock was decremented
	resp, _ = client.Get(coreURL + "/products/" + productID)
	defer resp.Body.Close()

	var updatedProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&updatedProduct)
	newStock := int(updatedProduct["stock"].(float64))

	expectedStock := initialStock - 2
	if newStock != expectedStock {
		t.Errorf("Step 5: Stock mismatch - expected %d, got %d", expectedStock, newStock)
	}

	t.Logf("Step 5: Stock decremented from %d to %d", initialStock, newStock)

	// 6. Mark promo as used
	usePromo := map[string]string{"code": promoCode}
	body, _ = json.Marshal(usePromo)
	resp, _ = client.Post(omsURL+"/promo/use", "application/json", bytes.NewBuffer(body))
	defer resp.Body.Close()

	t.Logf("Step 6: Marked promo as used")

	// 7. Update order status to PROCESSING
	statusUpdate := map[string]string{"status": "PROCESSING"}
	body, _ = json.Marshal(statusUpdate)
	req, _ := http.NewRequest(http.MethodPatch, omsURL+"/orders/"+orderID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = client.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Step 7: Status update failed, expected 200, got %d", resp.StatusCode)
	}

	t.Logf("Step 7: Order status updated to PROCESSING")

	// 8. Update order status to DELIVERED
	statusUpdate = map[string]string{"status": "DELIVERED"}
	body, _ = json.Marshal(statusUpdate)
	req, _ = http.NewRequest(http.MethodPatch, omsURL+"/orders/"+orderID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = client.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Step 8: Status update failed, expected 200, got %d", resp.StatusCode)
	}

	t.Logf("Step 8: Order status updated to DELIVERED")

	// 9. Verify order in user's order list
	resp, _ = client.Get(fmt.Sprintf("%s/orders/user/99999", omsURL))
	defer resp.Body.Close()

	var userOrders []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&userOrders)

	orderFound := false
	for _, o := range userOrders {
		if o["id"] == orderID {
			orderFound = true
			if o["status"] != "DELIVERED" {
				t.Errorf("Step 9: Expected status DELIVERED, got %s", o["status"])
			}
			break
		}
	}

	if !orderFound {
		t.Errorf("Step 9: Order %s not found in user's orders", orderID)
	}

	t.Logf("Step 9: Order found in user's order list with status DELIVERED")
	t.Log("Checkout flow test completed successfully!")

	// Clean up
	req, _ = http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)
}

// TestWishlistFlow tests wishlist functionality
func TestWishlistFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}
	userID := int64(12345)

	// Create a product
	product := map[string]interface{}{
		"name":  "Wishlist Test Product",
		"price": 500.0,
		"sku":   fmt.Sprintf("WISH-%d", time.Now().Unix()),
		"stock": 10,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product")
	}

	var createdProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	t.Logf("Created product: %s", productID)

	// Add to wishlist
	wishlistItem := map[string]string{"product_id": productID}
	body, _ = json.Marshal(wishlistItem)
	resp, err = client.Post(fmt.Sprintf("%s/wishlist/%d", coreURL, userID), "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to add to wishlist: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	t.Log("Added product to wishlist")

	// Get wishlist
	resp, _ = client.Get(fmt.Sprintf("%s/wishlist/%d", coreURL, userID))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var wishlist []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&wishlist)

	if len(wishlist) == 0 {
		t.Error("expected at least one item in wishlist")
	}

	t.Logf("Wishlist contains %d items", len(wishlist))

	// Check if in wishlist
	resp, _ = client.Get(fmt.Sprintf("%s/wishlist/%d/item/%s", coreURL, userID, productID))
	defer resp.Body.Close()

	var inWishlist map[string]bool
	json.NewDecoder(resp.Body).Decode(&inWishlist)

	if !inWishlist["in_wishlist"] {
		t.Error("expected product to be in wishlist")
	}

	t.Log("Verified product is in wishlist")

	// Move to cart
	resp, err = client.Post(fmt.Sprintf("%s/wishlist/%d/item/%s/to-cart", coreURL, userID, productID), "application/json", nil)
	if err != nil {
		t.Fatalf("failed to move to cart: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	t.Log("Moved product from wishlist to cart")

	// Verify removed from wishlist
	resp, _ = client.Get(fmt.Sprintf("%s/wishlist/%d/item/%s", coreURL, userID, productID))
	defer resp.Body.Close()
	json.NewDecoder(resp.Body).Decode(&inWishlist)

	if inWishlist["in_wishlist"] {
		t.Error("expected product to be removed from wishlist after move to cart")
	}

	// Verify in cart
	resp, _ = client.Get(fmt.Sprintf("%s/cart/%d", coreURL, userID))
	defer resp.Body.Close()

	var cart []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&cart)

	cartFound := false
	for _, item := range cart {
		if item["product_id"] == productID {
			cartFound = true
			break
		}
	}

	if !cartFound {
		t.Error("expected product to be in cart after move from wishlist")
	}

	t.Log("Verified product is in cart")

	// Clean up
	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/cart/%d", coreURL, userID), nil)
	client.Do(req)
	req, _ = http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)

	t.Log("Wishlist flow test completed!")
}

// TestPriceHistoryFlow tests price history tracking
func TestPriceHistoryFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create a product
	product := map[string]interface{}{
		"name":  "Price History Test Product",
		"price": 1000.0,
		"sku":   fmt.Sprintf("PRICE-%d", time.Now().Unix()),
		"stock": 10,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product")
	}

	var createdProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	t.Logf("Created product: %s with price 1000.0", productID)

	// Update price to 900
	updatedProduct := map[string]interface{}{
		"name":  "Price History Test Product",
		"price": 900.0,
		"sku":   createdProduct["sku"],
		"stock": 10,
	}

	body, _ = json.Marshal(updatedProduct)
	req, _ := http.NewRequest(http.MethodPut, coreURL+"/products/"+productID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to update product: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	t.Log("Updated price to 900.0")

	// Update price to 850
	updatedProduct["price"] = 850.0
	body, _ = json.Marshal(updatedProduct)
	req, _ = http.NewRequest(http.MethodPut, coreURL+"/products/"+productID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = client.Do(req)
	defer resp.Body.Close()

	t.Log("Updated price to 850.0")

	// Get price history
	resp, _ = client.Get(coreURL + "/products/" + productID + "/price-history")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var history []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&history)

	if len(history) < 2 {
		t.Errorf("expected at least 2 price changes, got %d", len(history))
	}

	t.Logf("Price history contains %d records", len(history))

	// Get latest price change
	resp, _ = client.Get(coreURL + "/products/" + productID + "/latest-price-change")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var latest map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&latest)

	if latest["new_price"].(float64) != 850.0 {
		t.Errorf("expected new_price 850.0, got %v", latest["new_price"])
	}

	t.Logf("Latest price change: %v -> %v", latest["old_price"], latest["new_price"])

	// Clean up
	req, _ = http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)

	t.Log("Price history flow test completed!")
}

// TestCartFlow tests complete cart functionality
func TestCartFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}
	userID := int64(54321)

	// Create a product
	product := map[string]interface{}{
		"name":  "Cart Test Product",
		"price": 299.0,
		"sku":   fmt.Sprintf("CART-%d", time.Now().Unix()),
		"stock": 20,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Skipf("Failed to create product")
	}

	var createdProduct map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdProduct)
	productID := createdProduct["id"].(string)

	t.Logf("Created product: %s", productID)

	// Add to cart
	cartItem := map[string]interface{}{
		"product_id": productID,
		"quantity":   2,
	}
	body, _ = json.Marshal(cartItem)
	resp, err = client.Post(fmt.Sprintf("%s/cart/%d", coreURL, userID), "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to add to cart: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	t.Log("Added product to cart with quantity 2")

	// Get cart
	resp, _ = client.Get(fmt.Sprintf("%s/cart/%d", coreURL, userID))
	defer resp.Body.Close()

	var cart []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&cart)

	if len(cart) == 0 {
		t.Fatal("expected at least one item in cart")
	}

	quantity := int(cart[0]["quantity"].(float64))
	if quantity != 2 {
		t.Errorf("expected quantity 2, got %d", quantity)
	}

	t.Logf("Cart contains %d items with quantity %d", len(cart), quantity)

	// Update quantity
	updateQty := map[string]int{"quantity": 5}
	body, _ = json.Marshal(updateQty)
	req, _ := http.NewRequest(http.MethodPatch, fmt.Sprintf("%s/cart/%d/item/%s", coreURL, userID, productID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to update cart: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	t.Log("Updated quantity to 5")

	// Verify quantity updated
	resp, _ = client.Get(fmt.Sprintf("%s/cart/%d", coreURL, userID))
	defer resp.Body.Close()
	json.NewDecoder(resp.Body).Decode(&cart)

	quantity = int(cart[0]["quantity"].(float64))
	if quantity != 5 {
		t.Errorf("expected quantity 5, got %d", quantity)
	}

	t.Log("Verified quantity is 5")

	// Remove from cart
	req, _ = http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/cart/%d/item/%s", coreURL, userID, productID), nil)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed to remove from cart: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", resp.StatusCode)
	}

	t.Log("Removed product from cart")

	// Verify cart is empty
	resp, _ = client.Get(fmt.Sprintf("%s/cart/%d", coreURL, userID))
	defer resp.Body.Close()
	json.NewDecoder(resp.Body).Decode(&cart)

	if len(cart) != 0 {
		t.Errorf("expected empty cart, got %d items", len(cart))
	}

	t.Log("Verified cart is empty")

	// Clean up
	req, _ = http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
	client.Do(req)

	t.Log("Cart flow test completed!")
}

// TestReviewsFlow tests the complete reviews flow
func TestReviewsFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create a product first
	product := map[string]interface{}{
		"name":  fmt.Sprintf("Review Test Product %d", time.Now().Unix()),
		"price": 199.99,
		"sku":   fmt.Sprintf("REV-%d", time.Now().Unix()),
		"stock": 10,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	var created map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&created)
	productID := created["id"].(string)
	defer func() {
		req, _ := http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
		client.Do(req)
	}()

	t.Logf("Created product for reviews: %s", productID)

	// Create a review
	userID := time.Now().UnixNano() % 1000000
	review := map[string]interface{}{
		"product_id": productID,
		"user_id":    userID,
		"rating":     5,
		"comment":    "Great product! Highly recommend.",
	}

	body, _ = json.Marshal(review)
	resp, err = client.Post(coreURL+"/reviews", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create review: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	var createdReview map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdReview)
	reviewID := createdReview["id"].(string)

	t.Logf("Created review: %s", reviewID)

	// Get product reviews
	resp, _ = client.Get(fmt.Sprintf("%s/products/%s/reviews", coreURL, productID))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var reviews []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&reviews)

	if len(reviews) == 0 {
		t.Error("expected at least 1 review")
	}

	// Get product rating
	resp, _ = client.Get(fmt.Sprintf("%s/products/%s/rating", coreURL, productID))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var rating map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rating)

	if rating["average_rating"] == nil {
		t.Error("expected average_rating in response")
	}
	if rating["review_count"] == nil {
		t.Error("expected review_count in response")
	}

	t.Logf("Product rating: %.1f (%v reviews)", rating["average_rating"], rating["review_count"])

	// Get user reviews
	resp, _ = client.Get(fmt.Sprintf("%s/users/%d/reviews", coreURL, userID))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	// Delete review
	req, _ := http.NewRequest(http.MethodDelete, coreURL+"/reviews/"+reviewID, nil)
	resp, _ = client.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", resp.StatusCode)
	}

	t.Log("Reviews flow test completed!")
}

// TestRecommendationsFlow tests product recommendations
func TestRecommendationsFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create a category
	category := map[string]interface{}{
		"name": fmt.Sprintf("Electronics %d", time.Now().Unix()),
	}

	body, _ := json.Marshal(category)
	resp, err := client.Post(coreURL+"/categories", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	var createdCat map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdCat)
	categoryID := createdCat["id"].(string)
	defer func() {
		req, _ := http.NewRequest(http.MethodDelete, coreURL+"/categories/"+categoryID, nil)
		client.Do(req)
	}()

	// Create products in the same category
	productIDs := []string{}
	for i := 1; i <= 3; i++ {
		product := map[string]interface{}{
			"name":        fmt.Sprintf("Phone Model %d - %d", i, time.Now().Unix()),
			"price":       float64(i) * 299.99,
			"sku":         fmt.Sprintf("REC-PHONE-%d-%d", i, time.Now().Unix()),
			"stock":       50,
			"category_id": categoryID,
		}

		body, _ = json.Marshal(product)
		resp, _ = client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
		defer resp.Body.Close()

		var created map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&created)
		productIDs = append(productIDs, created["id"].(string))
	}
	defer func() {
		for _, id := range productIDs {
			req, _ := http.NewRequest(http.MethodDelete, coreURL+"/products/"+id, nil)
			client.Do(req)
		}
	}()

	t.Logf("Created %d products in category", len(productIDs))

	// Get similar products
	resp, _ = client.Get(fmt.Sprintf("%s/products/%s/similar?limit=5", coreURL, productIDs[0]))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var similar []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&similar)

	t.Logf("Found %d similar products", len(similar))

	// Get popular products
	resp, _ = client.Get(coreURL + "/recommendations/popular?limit=10")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var popular []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&popular)

	t.Logf("Found %d popular products", len(popular))

	t.Log("Recommendations flow test completed!")
}

// TestInventoryAlertsFlow tests inventory management endpoints
func TestInventoryAlertsFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create products with different stock levels
	products := []map[string]interface{}{
		{"name": "Out of Stock Product", "price": 100.0, "stock": 0, "sku": fmt.Sprintf("INV-OOS-%d", time.Now().Unix())},
		{"name": "Low Stock Product", "price": 200.0, "stock": 3, "sku": fmt.Sprintf("INV-LOW-%d", time.Now().Unix())},
		{"name": "Normal Stock Product", "price": 300.0, "stock": 100, "sku": fmt.Sprintf("INV-NRM-%d", time.Now().Unix())},
	}

	productIDs := []string{}
	for _, prod := range products {
		body, _ := json.Marshal(prod)
		resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Skipf("Core service not available: %v", err)
		}
		defer resp.Body.Close()

		var created map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&created)
		productIDs = append(productIDs, created["id"].(string))
	}
	defer func() {
		for _, id := range productIDs {
			req, _ := http.NewRequest(http.MethodDelete, coreURL+"/products/"+id, nil)
			client.Do(req)
		}
	}()

	t.Logf("Created %d products for inventory testing", len(productIDs))

	// Get low stock products
	resp, _ := client.Get(coreURL + "/inventory/low-stock?threshold=10")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var lowStock []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&lowStock)

	t.Logf("Found %d low stock products", len(lowStock))

	// Get out of stock products
	resp, _ = client.Get(coreURL + "/inventory/out-of-stock")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var outOfStock []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&outOfStock)

	t.Logf("Found %d out of stock products", len(outOfStock))

	// Get inventory stats
	resp, _ = client.Get(coreURL + "/inventory/stats")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var stats map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&stats)

	if stats["total_products"] == nil {
		t.Error("expected total_products in stats")
	}
	if stats["out_of_stock"] == nil {
		t.Error("expected out_of_stock in stats")
	}
	if stats["low_stock"] == nil {
		t.Error("expected low_stock in stats")
	}

	t.Logf("Inventory stats: total=%v, out_of_stock=%v, low_stock=%v",
		stats["total_products"], stats["out_of_stock"], stats["low_stock"])

	t.Log("Inventory alerts flow test completed!")
}

// TestAnalyticsFlow tests analytics endpoints
func TestAnalyticsFlow(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Get analytics dashboard
	resp, err := client.Get(coreURL + "/analytics/dashboard")
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var dashboard map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&dashboard)

	if dashboard["total_products"] == nil {
		t.Error("expected total_products in dashboard")
	}
	if dashboard["total_categories"] == nil {
		t.Error("expected total_categories in dashboard")
	}

	t.Logf("Dashboard: products=%v, categories=%v",
		dashboard["total_products"], dashboard["total_categories"])

	// Get top selling products
	resp, _ = client.Get(coreURL + "/analytics/top-products?limit=10")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var topProducts []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&topProducts)

	t.Logf("Found %d top selling products", len(topProducts))

	// Get daily sales report
	resp, _ = client.Get(coreURL + "/analytics/daily-sales?days=7")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var dailySales []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&dailySales)

	t.Logf("Daily sales report: %d days", len(dailySales))

	// Get sales by category
	resp, _ = client.Get(coreURL + "/analytics/by-category")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var byCategory []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&byCategory)

	t.Logf("Sales by category: %d categories", len(byCategory))

	t.Log("Analytics flow test completed!")
}

// TestElasticsearchSearch tests Elasticsearch search functionality
func TestElasticsearchSearch(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Create a product with unique name for search testing
	uniqueName := fmt.Sprintf("ElasticSearchTestProduct%d", time.Now().UnixNano())
	product := map[string]interface{}{
		"name":  uniqueName,
		"price": 499.99,
		"sku":   fmt.Sprintf("ES-%d", time.Now().UnixNano()),
		"stock": 25,
	}

	body, _ := json.Marshal(product)
	resp, err := client.Post(coreURL+"/products", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Skipf("Core service not available: %v", err)
	}
	defer resp.Body.Close()

	var created map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&created)
	productID := created["id"].(string)
	defer func() {
		req, _ := http.NewRequest(http.MethodDelete, coreURL+"/products/"+productID, nil)
		client.Do(req)
	}()

	t.Logf("Created product for ES search: %s", productID)

	// Give Elasticsearch time to index (if available)
	time.Sleep(500 * time.Millisecond)

	// Search for product using /search endpoint
	searchQuery := uniqueName[:15]
	resp, _ = client.Get(coreURL + "/search?q=" + searchQuery)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var searchResult map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&searchResult)

	t.Logf("Search result: %+v", searchResult)

	// Test search with filters
	resp, _ = client.Get(fmt.Sprintf("%s/search?q=%s&min_price=100&max_price=1000", coreURL, searchQuery))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 for filtered search, got %d", resp.StatusCode)
	}

	// Test autocomplete/suggest
	resp, _ = client.Get(coreURL + "/search/suggest?q=" + searchQuery[:5])
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 for suggest, got %d", resp.StatusCode)
	}

	var suggestions []string
	json.NewDecoder(resp.Body).Decode(&suggestions)

	t.Logf("Suggestions: %v", suggestions)

	t.Log("Elasticsearch search test completed!")
}
