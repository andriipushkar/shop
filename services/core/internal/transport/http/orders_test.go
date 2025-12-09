package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"core/internal/pim"
)

func setupOrdersHandler() (*OrdersHandler, *MockRepository, *MockCategoryRepository, *MockCartRepository) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	cartRepo := NewMockCartRepository()
	service := pim.NewService(repo, catRepo)
	service.SetCartRepository(cartRepo)
	handler := NewOrdersHandler(service)
	return handler, repo, catRepo, cartRepo
}

func TestNewOrdersHandler(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()
	if handler == nil {
		t.Fatal("expected handler to be created")
	}
	if handler.pimService == nil {
		t.Error("expected pimService to be set")
	}
}

func TestCreateOrder(t *testing.T) {
	handler, repo, _, cartRepo := setupOrdersHandler()

	// Add a product to cart first
	ctx := httptest.NewRequest(http.MethodGet, "/", nil).Context()
	product := &pim.Product{
		ID:    "prod-1",
		Name:  "Test Product",
		Price: 100.00,
		SKU:   "SKU001",
		Stock: 10,
	}
	repo.Save(ctx, product)
	cartRepo.AddToCart(ctx, &pim.CartItem{UserID: 1, ProductID: "prod-1", Quantity: 2})

	tests := []struct {
		name           string
		method         string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodGet,
			body:           nil,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "invalid body",
			method:         http.MethodPost,
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing user_id",
			method: http.MethodPost,
			body: CreateOrderRequest{
				ShippingAddress: &Address{FirstName: "John"},
				PaymentMethod:   "liqpay",
				ShippingMethod:  "nova_poshta",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing shipping address",
			method: http.MethodPost,
			body: CreateOrderRequest{
				UserID:         1,
				PaymentMethod:  "liqpay",
				ShippingMethod: "nova_poshta",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing payment method",
			method: http.MethodPost,
			body: CreateOrderRequest{
				UserID:          1,
				ShippingAddress: &Address{FirstName: "John"},
				ShippingMethod:  "nova_poshta",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing shipping method",
			method: http.MethodPost,
			body: CreateOrderRequest{
				UserID:          1,
				ShippingAddress: &Address{FirstName: "John"},
				PaymentMethod:   "liqpay",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "valid order",
			method: http.MethodPost,
			body: CreateOrderRequest{
				UserID: 1,
				ShippingAddress: &Address{
					FirstName: "John",
					LastName:  "Doe",
					Phone:     "+380671234567",
					City:      "Kyiv",
					Address:   "Test Street 1",
				},
				PaymentMethod:  "liqpay",
				ShippingMethod: "nova_poshta",
			},
			expectedStatus: http.StatusCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if tt.body != nil {
				if s, ok := tt.body.(string); ok {
					body = []byte(s)
				} else {
					body, _ = json.Marshal(tt.body)
				}
			}

			req := httptest.NewRequest(tt.method, "/orders", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.CreateOrder(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestCreateOrderEmptyCart(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()

	body, _ := json.Marshal(CreateOrderRequest{
		UserID: 999, // User with empty cart
		ShippingAddress: &Address{
			FirstName: "John",
			LastName:  "Doe",
			Phone:     "+380671234567",
			City:      "Kyiv",
			Address:   "Test Street 1",
		},
		PaymentMethod:  "liqpay",
		ShippingMethod: "nova_poshta",
	})

	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateOrder(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d for empty cart, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestGetOrder(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			path:           "/orders/123",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing order ID",
			method:         http.MethodGet,
			path:           "/orders/",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			path:           "/orders/ORD-123",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.GetOrder(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestListOrders(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()

	tests := []struct {
		name           string
		method         string
		query          string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			query:          "",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "list all",
			method:         http.MethodGet,
			query:          "",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with pagination",
			method:         http.MethodGet,
			query:          "?page=1&page_size=10",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with status filter",
			method:         http.MethodGet,
			query:          "?status=pending",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with user filter",
			method:         http.MethodGet,
			query:          "?user_id=1",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/orders"+tt.query, nil)
			w := httptest.NewRecorder()

			handler.ListOrders(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestUpdateOrderStatus(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodGet,
			path:           "/orders/123/status",
			body:           nil,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "invalid body",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid status",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "invalid_status"},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid update - pending",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "pending"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid update - confirmed",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "confirmed"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid update - processing",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "processing"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid update - shipped",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "shipped", TrackingNumber: "20450123456"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid update - delivered",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "delivered"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid update - cancelled",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "cancelled"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid update - refunded",
			method:         http.MethodPatch,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "refunded"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "PUT method also works",
			method:         http.MethodPut,
			path:           "/orders/123/status",
			body:           UpdateOrderStatusRequest{Status: "confirmed"},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if tt.body != nil {
				if s, ok := tt.body.(string); ok {
					body = []byte(s)
				} else {
					body, _ = json.Marshal(tt.body)
				}
			}

			req := httptest.NewRequest(tt.method, tt.path, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.UpdateOrderStatus(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestCancelOrder(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodGet,
			path:           "/orders/123/cancel",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing order ID",
			method:         http.MethodPost,
			path:           "/orders//cancel",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid cancel",
			method:         http.MethodPost,
			path:           "/orders/ORD-123/cancel",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.CancelOrder(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestGetUserOrders(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			path:           "/users/1/orders",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "invalid user ID",
			method:         http.MethodGet,
			path:           "/users/invalid/orders",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			path:           "/users/1/orders",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with pagination",
			method:         http.MethodGet,
			path:           "/users/1/orders?page=1&page_size=10",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.GetUserOrders(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestGetOrderStats(t *testing.T) {
	handler, _, _, _ := setupOrdersHandler()

	tests := []struct {
		name           string
		method         string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/orders/stats", nil)
			w := httptest.NewRecorder()

			handler.GetOrderStats(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var stats map[string]interface{}
				if err := json.NewDecoder(w.Body).Decode(&stats); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if stats["total_orders"] == nil {
					t.Error("expected total_orders in response")
				}
			}
		})
	}
}

func TestGenerateOrderID(t *testing.T) {
	id1 := generateOrderID()
	id2 := generateOrderID()

	if id1 == "" {
		t.Error("expected non-empty order ID")
	}
	if id1 == id2 {
		t.Error("expected unique order IDs")
	}
	if len(id1) < 10 {
		t.Error("expected order ID to be at least 10 characters")
	}
}

func TestCalculateShippingCost(t *testing.T) {
	tests := []struct {
		method   string
		subtotal float64
		expected float64
	}{
		{"nova_poshta", 500, 70.00},
		{"nova_poshta", 1000, 0}, // Free shipping over 1000
		{"nova_poshta", 1500, 0},
		{"nova_poshta_courier", 500, 100.00},
		{"ukrposhta", 500, 50.00},
		{"meest", 500, 65.00},
		{"justin", 500, 55.00},
		{"pickup", 500, 0},
		{"unknown", 500, 70.00},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			cost := calculateShippingCost(tt.method, tt.subtotal)
			if cost != tt.expected {
				t.Errorf("expected cost %.2f for %s with subtotal %.2f, got %.2f", tt.expected, tt.method, tt.subtotal, cost)
			}
		})
	}
}

func TestOrderTypes(t *testing.T) {
	// Test Order struct
	order := &Order{
		ID:     "ORD-123",
		UserID: 1,
		Status: "pending",
		Total:  100.00,
	}
	if order.ID != "ORD-123" {
		t.Error("expected order ID to be set")
	}

	// Test OrderItem struct
	item := &OrderItem{
		ProductID:   "prod-1",
		ProductName: "Test",
		Quantity:    2,
		Price:       50.00,
		Total:       100.00,
	}
	if item.Total != 100.00 {
		t.Error("expected item total to be 100")
	}

	// Test Address struct
	addr := &Address{
		FirstName:  "John",
		LastName:   "Doe",
		Phone:      "+380671234567",
		City:       "Kyiv",
		Address:    "Test Street",
		PostalCode: "01001",
	}
	if addr.FirstName != "John" {
		t.Error("expected first name to be John")
	}

	// Test OrderListResponse struct
	resp := &OrderListResponse{
		Items:      []*Order{order},
		Total:      1,
		Page:       1,
		PageSize:   20,
		TotalPages: 1,
	}
	if len(resp.Items) != 1 {
		t.Error("expected 1 item in response")
	}
}
