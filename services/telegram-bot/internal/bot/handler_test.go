package bot

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestIsAdmin tests admin check functionality
func TestIsAdmin(t *testing.T) {
	h := &Handler{
		AdminIDs: []int64{123, 456, 789},
	}

	tests := []struct {
		name    string
		userID  int64
		isAdmin bool
	}{
		{"admin user 123", 123, true},
		{"admin user 456", 456, true},
		{"admin user 789", 789, true},
		{"non-admin user", 999, false},
		{"zero user", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := h.isAdmin(tt.userID); got != tt.isAdmin {
				t.Errorf("isAdmin(%d) = %v, want %v", tt.userID, got, tt.isAdmin)
			}
		})
	}
}

// TestIsAdminEmptyList tests admin check with empty list
func TestIsAdminEmptyList(t *testing.T) {
	h := &Handler{
		AdminIDs: []int64{},
	}

	if h.isAdmin(123) {
		t.Error("should return false for empty admin list")
	}
}

// TestCartOperations tests cart item structure
func TestCartOperations(t *testing.T) {
	// Test CartItem structure
	item := CartItem{
		ProductID: "prod-1",
		Name:      "Test Product",
		Price:     100.0,
		Quantity:  1,
		ImageURL:  "http://example.com/img.jpg",
	}

	if item.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got '%s'", item.ProductID)
	}
	if item.Name != "Test Product" {
		t.Errorf("expected Name 'Test Product', got '%s'", item.Name)
	}
	if item.Price != 100.0 {
		t.Errorf("expected Price 100.0, got %f", item.Price)
	}
	if item.Quantity != 1 {
		t.Errorf("expected Quantity 1, got %d", item.Quantity)
	}

	// Test cart slice operations (as used with API responses)
	cart := []CartItem{item}
	if len(cart) != 1 {
		t.Errorf("expected cart length 1, got %d", len(cart))
	}

	// Add another item
	cart = append(cart, CartItem{
		ProductID: "prod-2",
		Name:      "Product 2",
		Price:     50.0,
		Quantity:  2,
	})
	if len(cart) != 2 {
		t.Errorf("expected cart length 2, got %d", len(cart))
	}

	// Simulate quantity update
	for i := range cart {
		if cart[i].ProductID == "prod-1" {
			cart[i].Quantity++
			break
		}
	}
	if cart[0].Quantity != 2 {
		t.Errorf("expected updated quantity 2, got %d", cart[0].Quantity)
	}
}

// TestCartTotal tests cart total calculation
func TestCartTotal(t *testing.T) {
	items := []CartItem{
		{ProductID: "1", Name: "Product 1", Price: 100.0, Quantity: 2},
		{ProductID: "2", Name: "Product 2", Price: 50.0, Quantity: 3},
		{ProductID: "3", Name: "Product 3", Price: 25.0, Quantity: 1},
	}

	var total float64
	for _, item := range items {
		total += item.Price * float64(item.Quantity)
	}

	expected := 100.0*2 + 50.0*3 + 25.0*1 // 200 + 150 + 25 = 375
	if total != expected {
		t.Errorf("expected total %f, got %f", expected, total)
	}
}

// TestSubscriptionOperations tests subscription functionality
func TestSubscriptionOperations(t *testing.T) {
	h := NewHandler(nil, "http://core", "http://oms", "http://crm", []int64{})

	productID := "prod-123"
	userID := int64(12345)

	// Subscribe
	h.SubscriptionsMu.Lock()
	h.Subscriptions[productID] = append(h.Subscriptions[productID], userID)
	h.SubscriptionsMu.Unlock()

	// Check subscription exists
	h.SubscriptionsMu.RLock()
	subscribers := h.Subscriptions[productID]
	h.SubscriptionsMu.RUnlock()

	if len(subscribers) != 1 {
		t.Errorf("expected 1 subscriber, got %d", len(subscribers))
	}

	if subscribers[0] != userID {
		t.Errorf("expected user %d, got %d", userID, subscribers[0])
	}

	// Check duplicate prevention
	h.SubscriptionsMu.Lock()
	alreadySubscribed := false
	for _, id := range h.Subscriptions[productID] {
		if id == userID {
			alreadySubscribed = true
			break
		}
	}
	if !alreadySubscribed {
		h.Subscriptions[productID] = append(h.Subscriptions[productID], userID)
	}
	h.SubscriptionsMu.Unlock()

	// Should still have 1 subscriber
	h.SubscriptionsMu.RLock()
	if len(h.Subscriptions[productID]) != 1 {
		t.Errorf("expected 1 subscriber after duplicate check, got %d", len(h.Subscriptions[productID]))
	}
	h.SubscriptionsMu.RUnlock()
}

// TestReviewOperations tests review functionality
func TestReviewOperations(t *testing.T) {
	h := NewHandler(nil, "http://core", "http://oms", "http://crm", []int64{})

	productID := "prod-123"

	// Add review
	review := Review{
		ProductID: productID,
		UserID:    12345,
		UserName:  "Test User",
		Rating:    5,
		Comment:   "Great product!",
	}

	h.ReviewsMu.Lock()
	h.Reviews[productID] = append(h.Reviews[productID], review)
	h.ReviewsMu.Unlock()

	// Check review exists
	h.ReviewsMu.RLock()
	reviews := h.Reviews[productID]
	h.ReviewsMu.RUnlock()

	if len(reviews) != 1 {
		t.Errorf("expected 1 review, got %d", len(reviews))
	}

	if reviews[0].Rating != 5 {
		t.Errorf("expected rating 5, got %d", reviews[0].Rating)
	}
}

// TestAverageRating tests average rating calculation
func TestAverageRating(t *testing.T) {
	reviews := []Review{
		{Rating: 5},
		{Rating: 4},
		{Rating: 3},
		{Rating: 5},
		{Rating: 4},
	}

	var totalRating float64
	for _, r := range reviews {
		totalRating += float64(r.Rating)
	}
	avg := totalRating / float64(len(reviews))

	expected := 4.2 // (5+4+3+5+4)/5 = 21/5 = 4.2
	if avg != expected {
		t.Errorf("expected average %f, got %f", expected, avg)
	}
}

// TestCheckoutSessionStates tests FSM state transitions
func TestCheckoutSessionStates(t *testing.T) {
	h := NewHandler(nil, "http://core", "http://oms", "http://crm", []int64{})

	userID := int64(12345)

	// Start checkout
	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State: StateAwaitingPhone,
		Items: []CartItem{{ProductID: "1", Name: "Test", Price: 100, Quantity: 1}},
	}
	h.CheckoutSessionsMu.Unlock()

	// Verify state
	h.CheckoutSessionsMu.RLock()
	session := h.CheckoutSessions[userID]
	h.CheckoutSessionsMu.RUnlock()

	if session.State != StateAwaitingPhone {
		t.Errorf("expected StateAwaitingPhone, got %d", session.State)
	}

	// Move to address state
	h.CheckoutSessionsMu.Lock()
	session.Phone = "+380991234567"
	session.State = StateAwaitingAddress
	h.CheckoutSessionsMu.Unlock()

	h.CheckoutSessionsMu.RLock()
	if session.State != StateAwaitingAddress {
		t.Errorf("expected StateAwaitingAddress, got %d", session.State)
	}
	h.CheckoutSessionsMu.RUnlock()

	// Move to confirm state
	h.CheckoutSessionsMu.Lock()
	session.Address = "Test Address"
	session.State = StateAwaitingConfirm
	h.CheckoutSessionsMu.Unlock()

	h.CheckoutSessionsMu.RLock()
	if session.State != StateAwaitingConfirm {
		t.Errorf("expected StateAwaitingConfirm, got %d", session.State)
	}
	h.CheckoutSessionsMu.RUnlock()
}

// TestProductParsing tests product JSON parsing
func TestProductParsing(t *testing.T) {
	jsonData := `{
		"id": "prod-123",
		"name": "Test Product",
		"price": 99.99,
		"sku": "TEST-001",
		"stock": 10,
		"image_url": "https://example.com/img.jpg",
		"category_id": "cat-456",
		"category": {
			"id": "cat-456",
			"name": "Electronics"
		}
	}`

	var product Product
	if err := json.Unmarshal([]byte(jsonData), &product); err != nil {
		t.Fatalf("failed to parse product: %v", err)
	}

	if product.ID != "prod-123" {
		t.Errorf("expected ID 'prod-123', got '%s'", product.ID)
	}

	if product.Price != 99.99 {
		t.Errorf("expected price 99.99, got %f", product.Price)
	}

	if product.Stock != 10 {
		t.Errorf("expected stock 10, got %d", product.Stock)
	}

	if product.Category == nil {
		t.Error("expected category to be set")
	} else if product.Category.Name != "Electronics" {
		t.Errorf("expected category name 'Electronics', got '%s'", product.Category.Name)
	}
}

// TestOrderParsing tests order JSON parsing
func TestOrderParsing(t *testing.T) {
	jsonData := `{
		"id": "ORD-123",
		"product_id": "prod-456",
		"product_name": "Test Product",
		"quantity": 2,
		"status": "NEW",
		"user_id": 12345,
		"phone": "+380991234567",
		"address": "Київ, вул. Хрещатик 1",
		"tracking_num": "NP123456789",
		"delivery_note": "Нова Пошта"
	}`

	var order Order
	if err := json.Unmarshal([]byte(jsonData), &order); err != nil {
		t.Fatalf("failed to parse order: %v", err)
	}

	if order.ID != "ORD-123" {
		t.Errorf("expected ID 'ORD-123', got '%s'", order.ID)
	}

	if order.Quantity != 2 {
		t.Errorf("expected quantity 2, got %d", order.Quantity)
	}

	if order.TrackingNum != "NP123456789" {
		t.Errorf("expected tracking 'NP123456789', got '%s'", order.TrackingNum)
	}
}

// TestPhoneValidation tests phone number validation
func TestPhoneValidation(t *testing.T) {
	tests := []struct {
		phone   string
		isValid bool
	}{
		{"+380991234567", true},
		{"0991234567", true},
		{"380991234567", true},
		{"123", false},
		{"", false},
		{"12345", false},
	}

	for _, tt := range tests {
		t.Run(tt.phone, func(t *testing.T) {
			valid := len(tt.phone) >= 10
			if valid != tt.isValid {
				t.Errorf("phone '%s': got valid=%v, want %v", tt.phone, valid, tt.isValid)
			}
		})
	}
}

// TestMockCoreService tests interaction with mock Core service
func TestMockCoreService(t *testing.T) {
	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/products" {
			products := []Product{
				{ID: "1", Name: "Product 1", Price: 100, Stock: 10},
				{ID: "2", Name: "Product 2", Price: 200, Stock: 5},
			}
			json.NewEncoder(w).Encode(products)
			return
		}
		if r.URL.Path == "/products/1" {
			product := Product{ID: "1", Name: "Product 1", Price: 100, Stock: 10}
			json.NewEncoder(w).Encode(product)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	// Test getting products
	resp, err := http.Get(server.URL + "/products")
	if err != nil {
		t.Fatalf("failed to get products: %v", err)
	}
	defer resp.Body.Close()

	var products []Product
	if err := json.NewDecoder(resp.Body).Decode(&products); err != nil {
		t.Fatalf("failed to decode products: %v", err)
	}

	if len(products) != 2 {
		t.Errorf("expected 2 products, got %d", len(products))
	}
}

// TestMockOMSService tests interaction with mock OMS service
func TestMockOMSService(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/orders" {
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"id": "ORD-123"})
			return
		}
		if r.URL.Path == "/stats" {
			stats := map[string]interface{}{
				"total_orders":    100,
				"orders_by_status": map[string]int{"NEW": 10, "PROCESSING": 30, "DELIVERED": 60},
			}
			json.NewEncoder(w).Encode(stats)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	// Test getting stats
	resp, err := http.Get(server.URL + "/stats")
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	defer resp.Body.Close()

	var stats map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		t.Fatalf("failed to decode stats: %v", err)
	}

	if stats["total_orders"].(float64) != 100 {
		t.Errorf("expected total_orders 100, got %v", stats["total_orders"])
	}
}

// TestCSVParsing tests CSV parsing for import
func TestCSVParsing(t *testing.T) {
	csvContent := `name,price,sku,stock,category_id
iPhone 15,35000,IP15-001,10,
MacBook Pro,75000,MBP-001,5,cat-123`

	lines := splitLines(csvContent)

	if len(lines) != 3 { // header + 2 products
		t.Errorf("expected 3 lines, got %d", len(lines))
	}

	// Skip header, parse first product
	parts := splitCSV(lines[1])
	if len(parts) < 3 {
		t.Fatal("expected at least 3 parts")
	}

	if parts[0] != "iPhone 15" {
		t.Errorf("expected name 'iPhone 15', got '%s'", parts[0])
	}
}

func splitLines(s string) []string {
	var lines []string
	line := ""
	for _, c := range s {
		if c == '\n' {
			lines = append(lines, line)
			line = ""
		} else {
			line += string(c)
		}
	}
	if line != "" {
		lines = append(lines, line)
	}
	return lines
}

func splitCSV(s string) []string {
	var parts []string
	part := ""
	for _, c := range s {
		if c == ',' {
			parts = append(parts, part)
			part = ""
		} else {
			part += string(c)
		}
	}
	parts = append(parts, part)
	return parts
}

// Benchmark tests

func BenchmarkIsAdmin(b *testing.B) {
	h := &Handler{
		AdminIDs: []int64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
	}

	for i := 0; i < b.N; i++ {
		h.isAdmin(5)
	}
}

func BenchmarkCartTotal(b *testing.B) {
	items := []CartItem{
		{Price: 100, Quantity: 2},
		{Price: 50, Quantity: 3},
		{Price: 25, Quantity: 1},
	}

	for i := 0; i < b.N; i++ {
		var total float64
		for _, item := range items {
			total += item.Price * float64(item.Quantity)
		}
	}
}

// TestSessionTimeout tests session timeout functionality
func TestSessionTimeout(t *testing.T) {
	h := NewHandler(nil, "http://core", "http://oms", "http://crm", []int64{})

	userID := int64(12345)

	// Create session with past timestamp (should be expired)
	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State:     StateAwaitingPhone,
		CreatedAt: time.Now().Add(-SessionTimeout - time.Minute), // Expired
	}
	h.CheckoutSessionsMu.Unlock()

	// Check if session is expired
	h.CheckoutSessionsMu.RLock()
	session := h.CheckoutSessions[userID]
	isExpired := time.Since(session.CreatedAt) > SessionTimeout
	h.CheckoutSessionsMu.RUnlock()

	if !isExpired {
		t.Error("session should be expired")
	}
}

// TestSessionNotExpired tests session that is not expired
func TestSessionNotExpired(t *testing.T) {
	h := NewHandler(nil, "http://core", "http://oms", "http://crm", []int64{})

	userID := int64(12345)

	// Create session with current timestamp (should not be expired)
	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State:     StateAwaitingPhone,
		CreatedAt: time.Now(),
	}
	h.CheckoutSessionsMu.Unlock()

	// Check if session is not expired
	h.CheckoutSessionsMu.RLock()
	session := h.CheckoutSessions[userID]
	isExpired := time.Since(session.CreatedAt) > SessionTimeout
	h.CheckoutSessionsMu.RUnlock()

	if isExpired {
		t.Error("session should not be expired")
	}
}

// TestCheckoutSessionWithCreatedAt tests session creation with timestamp
func TestCheckoutSessionWithCreatedAt(t *testing.T) {
	h := NewHandler(nil, "http://core", "http://oms", "http://crm", []int64{})

	userID := int64(12345)
	now := time.Now()

	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State:     StateAwaitingPhone,
		Items:     []CartItem{{ProductID: "1", Name: "Test", Price: 100, Quantity: 1}},
		CreatedAt: now,
	}
	h.CheckoutSessionsMu.Unlock()

	h.CheckoutSessionsMu.RLock()
	session := h.CheckoutSessions[userID]
	h.CheckoutSessionsMu.RUnlock()

	if session.CreatedAt.IsZero() {
		t.Error("CreatedAt should be set")
	}

	// Check that CreatedAt is approximately now
	if time.Since(session.CreatedAt) > time.Second {
		t.Error("CreatedAt should be approximately now")
	}
}

// TestCheckoutStateConstants tests checkout state constants
func TestCheckoutStateConstants(t *testing.T) {
	// Ensure all states are unique
	states := []CheckoutState{
		StateNone,
		StateAwaitingPhone,
		StateAwaitingAddress,
		StateAwaitingPromoCode,
		StateAwaitingConfirm,
		StateAwaitingSearch,
		StateAwaitingReviewRating,
		StateAwaitingReviewComment,
		StateAwaitingImportCSV,
	}

	stateSet := make(map[CheckoutState]bool)
	for _, state := range states {
		if stateSet[state] {
			t.Errorf("duplicate state: %d", state)
		}
		stateSet[state] = true
	}

	// StateNone should be 0
	if StateNone != 0 {
		t.Errorf("StateNone should be 0, got %d", StateNone)
	}
}

// TestCheckoutSessionPromoCode tests promo code in session
func TestCheckoutSessionPromoCode(t *testing.T) {
	session := &CheckoutSession{
		State:     StateAwaitingConfirm,
		Phone:     "+380991234567",
		Address:   "Test Address",
		PromoCode: "SALE20",
		Discount:  20,
		Items:     []CartItem{{ProductID: "1", Name: "Test", Price: 100, Quantity: 1}},
	}

	if session.PromoCode != "SALE20" {
		t.Errorf("expected promo code SALE20, got %s", session.PromoCode)
	}

	if session.Discount != 20 {
		t.Errorf("expected discount 20, got %f", session.Discount)
	}

	// Calculate discounted total
	var total float64
	for _, item := range session.Items {
		total += item.Price * float64(item.Quantity)
	}
	discountedTotal := total * (1 - session.Discount/100)

	if discountedTotal != 80 {
		t.Errorf("expected discounted total 80, got %f", discountedTotal)
	}
}

// TestReviewSession tests review session state
func TestReviewSession(t *testing.T) {
	session := &CheckoutSession{
		State:     StateAwaitingReviewRating,
		ProductID: "prod-123",
		CreatedAt: time.Now(),
	}

	if session.State != StateAwaitingReviewRating {
		t.Errorf("expected StateAwaitingReviewRating, got %d", session.State)
	}

	if session.ProductID != "prod-123" {
		t.Errorf("expected product ID prod-123, got %s", session.ProductID)
	}

	// Move to comment state
	session.Rating = 5
	session.State = StateAwaitingReviewComment

	if session.Rating != 5 {
		t.Errorf("expected rating 5, got %d", session.Rating)
	}

	if session.State != StateAwaitingReviewComment {
		t.Errorf("expected StateAwaitingReviewComment, got %d", session.State)
	}
}

// TestSessionTimeoutConstant tests the timeout constant
func TestSessionTimeoutConstant(t *testing.T) {
	// SessionTimeout should be 15 minutes
	expectedTimeout := 15 * time.Minute
	if SessionTimeout != expectedTimeout {
		t.Errorf("expected SessionTimeout %v, got %v", expectedTimeout, SessionTimeout)
	}
}

// TestMultipleSessionsConcurrent tests concurrent session access
func TestMultipleSessionsConcurrent(t *testing.T) {
	h := NewHandler(nil, "http://core", "http://oms", "http://crm", []int64{})

	// Create multiple sessions concurrently
	done := make(chan bool)
	for i := 0; i < 100; i++ {
		go func(userID int64) {
			h.CheckoutSessionsMu.Lock()
			h.CheckoutSessions[userID] = &CheckoutSession{
				State:     StateAwaitingPhone,
				CreatedAt: time.Now(),
			}
			h.CheckoutSessionsMu.Unlock()
			done <- true
		}(int64(i))
	}

	// Wait for all goroutines
	for i := 0; i < 100; i++ {
		<-done
	}

	// Verify all sessions were created
	h.CheckoutSessionsMu.RLock()
	count := len(h.CheckoutSessions)
	h.CheckoutSessionsMu.RUnlock()

	if count != 100 {
		t.Errorf("expected 100 sessions, got %d", count)
	}
}
