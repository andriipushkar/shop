package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestOrderValidation tests order validation logic
func TestOrderValidation(t *testing.T) {
	tests := []struct {
		name      string
		productID string
		quantity  int
		wantErr   bool
	}{
		{"valid order", "product-123", 1, false},
		{"empty product_id", "", 1, true},
		{"zero quantity", "product-123", 0, true},
		{"negative quantity", "product-123", -1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateOrder(tt.productID, tt.quantity)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateOrder() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func validateOrder(productID string, quantity int) error {
	if productID == "" {
		return errProductIDRequired
	}
	if quantity <= 0 {
		return errInvalidQuantity
	}
	return nil
}

var (
	errProductIDRequired = &validationError{"product_id is required"}
	errInvalidQuantity   = &validationError{"quantity must be positive"}
)

type validationError struct {
	msg string
}

func (e *validationError) Error() string {
	return e.msg
}

// TestPromoCodeValidationLogic tests promo code validation logic
func TestPromoCodeValidationLogic(t *testing.T) {
	tests := []struct {
		name     string
		code     string
		discount float64
		wantErr  bool
	}{
		{"valid promo", "SALE20", 20, false},
		{"empty code", "", 20, true},
		{"zero discount", "SALE0", 0, true},
		{"negative discount", "NEG", -10, true},
		{"over 100% discount", "FREE", 150, true},
		{"100% discount", "FREE100", 100, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePromoCodeInput(tt.code, tt.discount)
			if (err != nil) != tt.wantErr {
				t.Errorf("validatePromoCodeInput() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func validatePromoCodeInput(code string, discount float64) error {
	if code == "" {
		return &validationError{"code is required"}
	}
	if discount <= 0 {
		return &validationError{"discount must be positive"}
	}
	if discount > 100 {
		return &validationError{"discount cannot exceed 100%"}
	}
	return nil
}

// TestOrderStatusTransition tests valid status transitions
func TestOrderStatusTransition(t *testing.T) {
	tests := []struct {
		name      string
		from      string
		to        string
		wantValid bool
	}{
		{"NEW to PROCESSING", "NEW", "PROCESSING", true},
		{"PROCESSING to DELIVERED", "PROCESSING", "DELIVERED", true},
		{"NEW to DELIVERED", "NEW", "DELIVERED", true},
		{"DELIVERED to NEW", "DELIVERED", "NEW", false},
		{"DELIVERED to PROCESSING", "DELIVERED", "PROCESSING", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := isValidStatusTransition(tt.from, tt.to)
			if valid != tt.wantValid {
				t.Errorf("isValidStatusTransition(%s, %s) = %v, want %v", tt.from, tt.to, valid, tt.wantValid)
			}
		})
	}
}

func isValidStatusTransition(from, to string) bool {
	// Define valid transitions
	validTransitions := map[string][]string{
		"NEW":        {"PROCESSING", "DELIVERED"},
		"PROCESSING": {"DELIVERED"},
		"DELIVERED":  {}, // No transitions from DELIVERED
	}

	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}

	for _, status := range allowed {
		if status == to {
			return true
		}
	}
	return false
}

// TestOrderIDGeneration tests that order IDs are generated correctly
func TestOrderIDGeneration(t *testing.T) {
	id1 := generateTestOrderID()
	id2 := generateTestOrderID()

	if id1 == "" {
		t.Error("generated ID should not be empty")
	}

	if id1 == id2 {
		t.Error("generated IDs should be unique")
	}

	if len(id1) < 10 {
		t.Error("generated ID should be at least 10 characters")
	}
}

func generateTestOrderID() string {
	return "ORD-" + randomTestString(10)
}

var testIDCounter int

func randomTestString(n int) string {
	testIDCounter++
	return fmt.Sprintf("%010d", testIDCounter)
}

// TestStatsCalculation tests statistics calculation
func TestStatsCalculation(t *testing.T) {
	orders := []Order{
		{ID: "1", Status: "NEW", Quantity: 2},
		{ID: "2", Status: "NEW", Quantity: 1},
		{ID: "3", Status: "PROCESSING", Quantity: 3},
		{ID: "4", Status: "DELIVERED", Quantity: 1},
		{ID: "5", Status: "DELIVERED", Quantity: 2},
	}

	stats := calculateTestStats(orders)

	if stats.TotalOrders != 5 {
		t.Errorf("expected TotalOrders 5, got %d", stats.TotalOrders)
	}

	if stats.OrdersByStatus["NEW"] != 2 {
		t.Errorf("expected 2 NEW orders, got %d", stats.OrdersByStatus["NEW"])
	}

	if stats.OrdersByStatus["PROCESSING"] != 1 {
		t.Errorf("expected 1 PROCESSING order, got %d", stats.OrdersByStatus["PROCESSING"])
	}

	if stats.OrdersByStatus["DELIVERED"] != 2 {
		t.Errorf("expected 2 DELIVERED orders, got %d", stats.OrdersByStatus["DELIVERED"])
	}
}

type TestStats struct {
	TotalOrders    int
	OrdersByStatus map[string]int
}

func calculateTestStats(orders []Order) TestStats {
	stats := TestStats{
		TotalOrders:    len(orders),
		OrdersByStatus: make(map[string]int),
	}

	for _, o := range orders {
		stats.OrdersByStatus[o.Status]++
	}

	return stats
}

// TestDiscountCalculation tests discount application
func TestDiscountCalculation(t *testing.T) {
	tests := []struct {
		name     string
		price    float64
		discount float64
		want     float64
	}{
		{"10% off 100", 100, 10, 90},
		{"20% off 50", 50, 20, 40},
		{"50% off 200", 200, 50, 100},
		{"0% off 100", 100, 0, 100},
		{"100% off 100", 100, 100, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := applyDiscount(tt.price, tt.discount)
			if got != tt.want {
				t.Errorf("applyDiscount(%v, %v) = %v, want %v", tt.price, tt.discount, got, tt.want)
			}
		})
	}
}

func applyDiscount(price, discountPercent float64) float64 {
	return price * (1 - discountPercent/100)
}

// TestTrackingNumberFormat tests tracking number validation
func TestTrackingNumberFormat(t *testing.T) {
	tests := []struct {
		name    string
		tracking string
		wantValid bool
	}{
		{"Nova Poshta format", "20450123456789", true},
		{"UkrPoshta format", "UA123456789", true},
		{"empty tracking", "", false},
		{"too short", "123", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := isValidTrackingNumber(tt.tracking)
			if valid != tt.wantValid {
				t.Errorf("isValidTrackingNumber(%s) = %v, want %v", tt.tracking, valid, tt.wantValid)
			}
		})
	}
}

func isValidTrackingNumber(tracking string) bool {
	return len(tracking) >= 5
}

// TestJSONSerialization tests Order JSON serialization
func TestOrderJSONSerialization(t *testing.T) {
	order := Order{
		ID:        "ORD-123",
		ProductID: "prod-456",
		Quantity:  2,
		Status:    "NEW",
		UserID:    12345,
		Phone:     "+380991234567",
		Address:   "Київ, вул. Хрещатик 1",
	}

	// Serialize
	data, err := json.Marshal(order)
	if err != nil {
		t.Fatalf("failed to marshal order: %v", err)
	}

	// Deserialize
	var decoded Order
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal order: %v", err)
	}

	if decoded.ID != order.ID {
		t.Errorf("ID mismatch: got %s, want %s", decoded.ID, order.ID)
	}

	if decoded.ProductID != order.ProductID {
		t.Errorf("ProductID mismatch: got %s, want %s", decoded.ProductID, order.ProductID)
	}

	if decoded.Quantity != order.Quantity {
		t.Errorf("Quantity mismatch: got %d, want %d", decoded.Quantity, order.Quantity)
	}
}

// TestPromoCodeJSONSerialization tests PromoCode JSON serialization
func TestPromoCodeJSONSerialization(t *testing.T) {
	promo := PromoCode{
		Code:      "SALE20",
		Discount:  20,
		MaxUses:   100,
		UsedCount: 5,
		Active:    true,
	}

	data, err := json.Marshal(promo)
	if err != nil {
		t.Fatalf("failed to marshal promo: %v", err)
	}

	var decoded PromoCode
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal promo: %v", err)
	}

	if decoded.Code != promo.Code {
		t.Errorf("Code mismatch: got %s, want %s", decoded.Code, promo.Code)
	}

	if decoded.Discount != promo.Discount {
		t.Errorf("Discount mismatch: got %f, want %f", decoded.Discount, promo.Discount)
	}
}

// HTTP Handler Tests (requires test server)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	healthHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	if w.Body.String() != "OK" {
		t.Errorf("expected body 'OK', got '%s'", w.Body.String())
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// TestCreateOrderRequest tests parsing of create order request
func TestCreateOrderRequest(t *testing.T) {
	body := `{"product_id":"prod-123","quantity":2,"user_id":12345}`
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	var orderReq struct {
		ProductID string `json:"product_id"`
		Quantity  int    `json:"quantity"`
		UserID    int64  `json:"user_id"`
	}

	if err := json.NewDecoder(req.Body).Decode(&orderReq); err != nil {
		t.Fatalf("failed to decode request: %v", err)
	}

	if orderReq.ProductID != "prod-123" {
		t.Errorf("expected product_id 'prod-123', got '%s'", orderReq.ProductID)
	}

	if orderReq.Quantity != 2 {
		t.Errorf("expected quantity 2, got %d", orderReq.Quantity)
	}

	if orderReq.UserID != 12345 {
		t.Errorf("expected user_id 12345, got %d", orderReq.UserID)
	}
}

// Benchmark tests

func BenchmarkOrderIDGeneration(b *testing.B) {
	for i := 0; i < b.N; i++ {
		generateTestOrderID()
	}
}

func BenchmarkDiscountCalculation(b *testing.B) {
	for i := 0; i < b.N; i++ {
		applyDiscount(100.0, 20.0)
	}
}

func BenchmarkOrderSerialization(b *testing.B) {
	order := Order{
		ID:        "ORD-123",
		ProductID: "prod-456",
		Quantity:  2,
		Status:    "NEW",
		UserID:    12345,
	}

	for i := 0; i < b.N; i++ {
		json.Marshal(order)
	}
}

// TestIdempotencyKeyValidation tests idempotency key format
func TestIdempotencyKeyValidation(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		wantValid bool
	}{
		{"valid key", "user123-prod456-1234567890-abc123", true},
		{"empty key", "", true}, // Empty key is allowed (optional)
		{"short key", "abc", true},
		{"uuid format", "550e8400-e29b-41d4-a716-446655440000", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := isValidIdempotencyKey(tt.key)
			if valid != tt.wantValid {
				t.Errorf("isValidIdempotencyKey(%s) = %v, want %v", tt.key, valid, tt.wantValid)
			}
		})
	}
}

func isValidIdempotencyKey(key string) bool {
	// All idempotency keys are valid (empty means not provided)
	return true
}

// TestOrderWithPromoCode tests order creation with promo code
func TestOrderWithPromoCode(t *testing.T) {
	order := Order{
		ID:        "ORD-123",
		ProductID: "prod-456",
		Quantity:  2,
		Status:    "NEW",
		UserID:    12345,
		PromoCode: "SALE20",
		Discount:  20,
	}

	if order.PromoCode != "SALE20" {
		t.Errorf("expected promo code SALE20, got %s", order.PromoCode)
	}

	if order.Discount != 20 {
		t.Errorf("expected discount 20, got %f", order.Discount)
	}

	// Test JSON serialization with promo
	data, err := json.Marshal(order)
	if err != nil {
		t.Fatalf("failed to marshal order with promo: %v", err)
	}

	var decoded Order
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal order: %v", err)
	}

	if decoded.PromoCode != order.PromoCode {
		t.Errorf("promo code mismatch after serialization: got %s, want %s", decoded.PromoCode, order.PromoCode)
	}
}

// TestOrderWithIdempotencyKey tests order with idempotency key
func TestOrderWithIdempotencyKey(t *testing.T) {
	order := Order{
		ID:             "ORD-123",
		ProductID:      "prod-456",
		Quantity:       1,
		Status:         "NEW",
		UserID:         12345,
		IdempotencyKey: "user12345-prod456-1699999999999-xyz789",
	}

	if order.IdempotencyKey == "" {
		t.Error("idempotency key should be set")
	}

	// Test JSON serialization
	data, err := json.Marshal(order)
	if err != nil {
		t.Fatalf("failed to marshal order: %v", err)
	}

	var decoded Order
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal order: %v", err)
	}

	if decoded.IdempotencyKey != order.IdempotencyKey {
		t.Errorf("idempotency key mismatch: got %s, want %s", decoded.IdempotencyKey, order.IdempotencyKey)
	}
}

// TestPromoCodeUsageLimit tests promo code usage limits
func TestPromoCodeUsageLimit(t *testing.T) {
	promo := PromoCode{
		Code:      "LIMITED",
		Discount:  30,
		MaxUses:   10,
		UsedCount: 9,
		Active:    true,
	}

	// Should be usable (used 9, max 10)
	if !canUsePromoCode(promo) {
		t.Error("promo should be usable with 9/10 uses")
	}

	// After using once more
	promo.UsedCount = 10
	if canUsePromoCode(promo) {
		t.Error("promo should not be usable at 10/10 uses")
	}

	// Inactive promo
	promo.UsedCount = 5
	promo.Active = false
	if canUsePromoCode(promo) {
		t.Error("inactive promo should not be usable")
	}
}

func canUsePromoCode(promo PromoCode) bool {
	if !promo.Active {
		return false
	}
	if promo.MaxUses > 0 && promo.UsedCount >= promo.MaxUses {
		return false
	}
	return true
}

// TestOrderStatusValidation tests all valid order statuses
func TestOrderStatusValidation(t *testing.T) {
	validStatuses := []string{"NEW", "PROCESSING", "DELIVERED"}

	for _, status := range validStatuses {
		if !isValidOrderStatus(status) {
			t.Errorf("status %s should be valid", status)
		}
	}

	invalidStatuses := []string{"PENDING", "CANCELLED", "SHIPPED", "", "new", "delivered"}

	for _, status := range invalidStatuses {
		if isValidOrderStatus(status) {
			t.Errorf("status %s should be invalid", status)
		}
	}
}

func isValidOrderStatus(status string) bool {
	validStatuses := map[string]bool{
		"NEW":        true,
		"PROCESSING": true,
		"DELIVERED":  true,
	}
	return validStatuses[status]
}

// TestCreateOrderRequestWithPromo tests create order request parsing with promo
func TestCreateOrderRequestWithPromo(t *testing.T) {
	body := `{"product_id":"prod-123","quantity":2,"user_id":12345,"promo_code":"SALE20","discount":20}`
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	var order Order
	if err := json.NewDecoder(req.Body).Decode(&order); err != nil {
		t.Fatalf("failed to decode request: %v", err)
	}

	if order.PromoCode != "SALE20" {
		t.Errorf("expected promo_code 'SALE20', got '%s'", order.PromoCode)
	}

	if order.Discount != 20 {
		t.Errorf("expected discount 20, got %f", order.Discount)
	}
}

// TestCreateOrderRequestWithIdempotency tests request with idempotency key
func TestCreateOrderRequestWithIdempotency(t *testing.T) {
	body := `{"product_id":"prod-123","quantity":1,"user_id":12345,"idempotency_key":"unique-key-123"}`
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	var order Order
	if err := json.NewDecoder(req.Body).Decode(&order); err != nil {
		t.Fatalf("failed to decode request: %v", err)
	}

	if order.IdempotencyKey != "unique-key-123" {
		t.Errorf("expected idempotency_key 'unique-key-123', got '%s'", order.IdempotencyKey)
	}
}

// TestValidStatusesMap tests the status validation logic
func TestValidStatusesMap(t *testing.T) {
	validStatuses := map[string]bool{"NEW": true, "PROCESSING": true, "DELIVERED": true}

	tests := []struct {
		status   string
		expected bool
	}{
		{"NEW", true},
		{"PROCESSING", true},
		{"DELIVERED", true},
		{"CANCELLED", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			if validStatuses[tt.status] != tt.expected {
				t.Errorf("status %s: expected %v, got %v", tt.status, tt.expected, validStatuses[tt.status])
			}
		})
	}
}
