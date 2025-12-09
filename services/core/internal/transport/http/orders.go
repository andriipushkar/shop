package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"core/internal/pim"
)

// Order represents an order in the system
type Order struct {
	ID              string       `json:"id"`
	UserID          int64        `json:"user_id"`
	Items           []*OrderItem `json:"items"`
	Status          string       `json:"status"`
	ShippingAddress *Address     `json:"shipping_address"`
	BillingAddress  *Address     `json:"billing_address"`
	PaymentMethod   string       `json:"payment_method"`
	PaymentStatus   string       `json:"payment_status"`
	ShippingMethod  string       `json:"shipping_method"`
	ShippingCost    float64      `json:"shipping_cost"`
	Subtotal        float64      `json:"subtotal"`
	Tax             float64      `json:"tax"`
	Discount        float64      `json:"discount"`
	Total           float64      `json:"total"`
	Notes           string       `json:"notes,omitempty"`
	TrackingNumber  string       `json:"tracking_number,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
}

type OrderItem struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	SKU         string  `json:"sku"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
	Total       float64 `json:"total"`
	ImageURL    string  `json:"image_url,omitempty"`
}

type Address struct {
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Phone      string `json:"phone"`
	Email      string `json:"email,omitempty"`
	Country    string `json:"country"`
	Region     string `json:"region"`
	City       string `json:"city"`
	Address    string `json:"address"`
	PostalCode string `json:"postal_code"`
}

type CreateOrderRequest struct {
	UserID          int64    `json:"user_id"`
	ShippingAddress *Address `json:"shipping_address"`
	BillingAddress  *Address `json:"billing_address,omitempty"`
	PaymentMethod   string   `json:"payment_method"`
	ShippingMethod  string   `json:"shipping_method"`
	Notes           string   `json:"notes,omitempty"`
	PromoCode       string   `json:"promo_code,omitempty"`
}

type UpdateOrderStatusRequest struct {
	Status         string `json:"status"`
	TrackingNumber string `json:"tracking_number,omitempty"`
	Notes          string `json:"notes,omitempty"`
}

type OrderListResponse struct {
	Items      []*Order `json:"items"`
	Total      int      `json:"total"`
	Page       int      `json:"page"`
	PageSize   int      `json:"page_size"`
	TotalPages int      `json:"total_pages"`
}

// OrdersHandler handles order-related HTTP requests
type OrdersHandler struct {
	pimService *pim.Service
}

// NewOrdersHandler creates a new orders handler
func NewOrdersHandler(pimService *pim.Service) *OrdersHandler {
	return &OrdersHandler{pimService: pimService}
}

// CreateOrder creates a new order from the user's cart
func (h *OrdersHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.UserID == 0 {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}
	if req.ShippingAddress == nil {
		http.Error(w, "Shipping address is required", http.StatusBadRequest)
		return
	}
	if req.PaymentMethod == "" {
		http.Error(w, "Payment method is required", http.StatusBadRequest)
		return
	}
	if req.ShippingMethod == "" {
		http.Error(w, "Shipping method is required", http.StatusBadRequest)
		return
	}

	// Get cart items
	cartItems, err := h.pimService.GetCart(r.Context(), req.UserID)
	if err != nil {
		http.Error(w, "Failed to get cart", http.StatusInternalServerError)
		return
	}
	if len(cartItems) == 0 {
		http.Error(w, "Cart is empty", http.StatusBadRequest)
		return
	}

	// Build order items and calculate totals
	var orderItems []*OrderItem
	var subtotal float64
	for _, item := range cartItems {
		product, err := h.pimService.GetProduct(r.Context(), item.ProductID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Product %s not found", item.ProductID), http.StatusBadRequest)
			return
		}

		orderItem := &OrderItem{
			ProductID:   product.ID,
			ProductName: product.Name,
			SKU:         product.SKU,
			Quantity:    item.Quantity,
			Price:       product.Price,
			Total:       product.Price * float64(item.Quantity),
			ImageURL:    product.ImageURL,
		}
		orderItems = append(orderItems, orderItem)
		subtotal += orderItem.Total
	}

	// Calculate shipping cost based on method
	shippingCost := calculateShippingCost(req.ShippingMethod, subtotal)

	// Calculate tax (example: 20% VAT)
	tax := subtotal * 0.20

	// Calculate total
	total := subtotal + tax + shippingCost

	// Apply billing address
	billingAddress := req.BillingAddress
	if billingAddress == nil {
		billingAddress = req.ShippingAddress
	}

	// Create order
	order := &Order{
		ID:              generateOrderID(),
		UserID:          req.UserID,
		Items:           orderItems,
		Status:          "pending",
		ShippingAddress: req.ShippingAddress,
		BillingAddress:  billingAddress,
		PaymentMethod:   req.PaymentMethod,
		PaymentStatus:   "pending",
		ShippingMethod:  req.ShippingMethod,
		ShippingCost:    shippingCost,
		Subtotal:        subtotal,
		Tax:             tax,
		Discount:        0,
		Total:           total,
		Notes:           req.Notes,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Clear user's cart after order creation
	if err := h.pimService.ClearCart(r.Context(), req.UserID); err != nil {
		// Log error but don't fail the order
		fmt.Printf("Failed to clear cart: %v\n", err)
	}

	// Decrement stock for each item
	for _, item := range orderItems {
		if err := h.pimService.DecrementStock(r.Context(), item.ProductID, item.Quantity); err != nil {
			// Log error but don't fail the order
			fmt.Printf("Failed to decrement stock for %s: %v\n", item.ProductID, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
}

// GetOrder retrieves an order by ID
func (h *OrdersHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract order ID from path: /orders/{id}
	orderID := r.URL.Path[len("/orders/"):]
	if orderID == "" {
		http.Error(w, "Order ID is required", http.StatusBadRequest)
		return
	}

	// In real implementation, fetch from database
	// For now, return a mock order
	order := &Order{
		ID:            orderID,
		UserID:        1,
		Status:        "processing",
		PaymentStatus: "paid",
		ShippingMethod: "nova_poshta",
		Total:         1500.00,
		CreatedAt:     time.Now().Add(-24 * time.Hour),
		UpdatedAt:     time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

// ListOrders lists orders with pagination and filtering
func (h *OrdersHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse query parameters
	query := r.URL.Query()

	page := 1
	if p := query.Get("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}

	pageSize := 20
	if ps := query.Get("page_size"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
	}

	// Filter by status
	_ = query.Get("status")

	// Filter by user
	var userID int64
	if uid := query.Get("user_id"); uid != "" {
		fmt.Sscanf(uid, "%d", &userID)
	}

	// In real implementation, fetch from database
	response := &OrderListResponse{
		Items:      []*Order{},
		Total:      0,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: 0,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateOrderStatus updates the status of an order
func (h *OrdersHandler) UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract order ID from path: /orders/{id}/status
	path := r.URL.Path[len("/orders/"):]
	orderID := path[:len(path)-len("/status")]
	if orderID == "" {
		http.Error(w, "Order ID is required", http.StatusBadRequest)
		return
	}

	var req UpdateOrderStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate status
	validStatuses := map[string]bool{
		"pending":    true,
		"confirmed":  true,
		"processing": true,
		"shipped":    true,
		"delivered":  true,
		"cancelled":  true,
		"refunded":   true,
	}
	if !validStatuses[req.Status] {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	// In real implementation, update in database
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "ok",
		"order_id": orderID,
		"new_status": req.Status,
	})
}

// CancelOrder cancels an order
func (h *OrdersHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract order ID from path: /orders/{id}/cancel
	path := r.URL.Path[len("/orders/"):]
	orderID := path[:len(path)-len("/cancel")]
	if orderID == "" {
		http.Error(w, "Order ID is required", http.StatusBadRequest)
		return
	}

	// In real implementation, check if order can be cancelled and update database
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "ok",
		"order_id":   orderID,
		"new_status": "cancelled",
	})
}

// GetUserOrders retrieves orders for a specific user
func (h *OrdersHandler) GetUserOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /users/{id}/orders
	path := r.URL.Path[len("/users/"):]
	userIDStr := path[:len(path)-len("/orders")]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Parse pagination parameters
	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}

	pageSize := 20
	if ps := r.URL.Query().Get("page_size"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
	}

	// In real implementation, fetch from database
	response := &OrderListResponse{
		Items:      []*Order{},
		Total:      0,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: 0,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetOrderStats retrieves order statistics
func (h *OrdersHandler) GetOrderStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// In real implementation, aggregate from database
	stats := map[string]interface{}{
		"total_orders":    1250,
		"pending_orders":  45,
		"shipped_orders":  120,
		"delivered_orders": 1000,
		"cancelled_orders": 85,
		"total_revenue":   2500000.00,
		"average_order_value": 2000.00,
		"orders_today":    15,
		"revenue_today":   30000.00,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Helper functions

func generateOrderID() string {
	return fmt.Sprintf("ORD-%d", time.Now().UnixNano())
}

func calculateShippingCost(method string, subtotal float64) float64 {
	// Free shipping over 1000 UAH
	if subtotal >= 1000 {
		return 0
	}

	switch method {
	case "nova_poshta":
		return 70.00
	case "nova_poshta_courier":
		return 100.00
	case "ukrposhta":
		return 50.00
	case "meest":
		return 65.00
	case "justin":
		return 55.00
	case "pickup":
		return 0
	default:
		return 70.00
	}
}
