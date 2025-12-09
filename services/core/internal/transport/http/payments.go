package http

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Payment represents a payment record
type Payment struct {
	ID            string    `json:"id"`
	OrderID       string    `json:"order_id"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Method        string    `json:"method"`
	Status        string    `json:"status"`
	TransactionID string    `json:"transaction_id,omitempty"`
	ErrorMessage  string    `json:"error_message,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// PaymentRequest represents a payment initiation request
type PaymentRequest struct {
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Method      string  `json:"method"`
	Description string  `json:"description,omitempty"`
	ReturnURL   string  `json:"return_url,omitempty"`
	CallbackURL string  `json:"callback_url,omitempty"`
}

// PaymentResponse represents a payment initiation response
type PaymentResponse struct {
	PaymentID   string `json:"payment_id"`
	Status      string `json:"status"`
	RedirectURL string `json:"redirect_url,omitempty"`
	QRCode      string `json:"qr_code,omitempty"`
}

// RefundRequest represents a refund request
type RefundRequest struct {
	PaymentID string  `json:"payment_id"`
	Amount    float64 `json:"amount,omitempty"` // Optional for partial refund
	Reason    string  `json:"reason"`
}

// PaymentsHandler handles payment-related HTTP requests
type PaymentsHandler struct {
	// In real implementation, inject payment services
	liqpayPublicKey  string
	liqpayPrivateKey string
	fondyMerchantID  string
	fondySecretKey   string
	wayforpayMerchantAccount string
	wayforpayMerchantSecretKey string
}

// NewPaymentsHandler creates a new payments handler
func NewPaymentsHandler() *PaymentsHandler {
	return &PaymentsHandler{
		// In real implementation, load from config
		liqpayPublicKey:  "sandbox_i123456789",
		liqpayPrivateKey: "sandbox_test_key",
	}
}

// InitiatePayment initiates a new payment
func (h *PaymentsHandler) InitiatePayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req PaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.OrderID == "" {
		http.Error(w, "Order ID is required", http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, "Invalid amount", http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		req.Currency = "UAH"
	}
	if req.Method == "" {
		http.Error(w, "Payment method is required", http.StatusBadRequest)
		return
	}

	// Create payment record
	payment := &Payment{
		ID:        fmt.Sprintf("PAY-%d", time.Now().UnixNano()),
		OrderID:   req.OrderID,
		Amount:    req.Amount,
		Currency:  req.Currency,
		Method:    req.Method,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	var response *PaymentResponse

	switch req.Method {
	case "liqpay":
		response = h.initiateLiqPayPayment(payment, req)
	case "monobank":
		response = h.initiateMonobankPayment(payment, req)
	case "fondy":
		response = h.initiateFondyPayment(payment, req)
	case "wayforpay":
		response = h.initiateWayForPayPayment(payment, req)
	case "paypal":
		response = h.initiatePayPalPayment(payment, req)
	case "cash_on_delivery":
		response = &PaymentResponse{
			PaymentID: payment.ID,
			Status:    "pending",
		}
	default:
		http.Error(w, "Unsupported payment method", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// GetPayment retrieves a payment by ID
func (h *PaymentsHandler) GetPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract payment ID from path: /payments/{id}
	paymentID := r.URL.Path[len("/payments/"):]
	if paymentID == "" {
		http.Error(w, "Payment ID is required", http.StatusBadRequest)
		return
	}

	// In real implementation, fetch from database
	payment := &Payment{
		ID:        paymentID,
		OrderID:   "ORD-123",
		Amount:    1500.00,
		Currency:  "UAH",
		Method:    "liqpay",
		Status:    "completed",
		TransactionID: "TXN-ABC123",
		CreatedAt: time.Now().Add(-1 * time.Hour),
		UpdatedAt: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payment)
}

// GetOrderPayments retrieves payments for a specific order
func (h *PaymentsHandler) GetOrderPayments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract order ID from path: /orders/{id}/payments
	path := r.URL.Path[len("/orders/"):]
	orderID := path[:len(path)-len("/payments")]
	if orderID == "" {
		http.Error(w, "Order ID is required", http.StatusBadRequest)
		return
	}

	// In real implementation, fetch from database
	payments := []*Payment{}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payments)
}

// ProcessWebhook processes payment provider webhooks
func (h *PaymentsHandler) ProcessWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract provider from path: /webhooks/payments/{provider}
	provider := r.URL.Path[len("/webhooks/payments/"):]
	if provider == "" {
		http.Error(w, "Provider is required", http.StatusBadRequest)
		return
	}

	switch provider {
	case "liqpay":
		h.handleLiqPayWebhook(w, r)
	case "monobank":
		h.handleMonobankWebhook(w, r)
	case "fondy":
		h.handleFondyWebhook(w, r)
	case "wayforpay":
		h.handleWayForPayWebhook(w, r)
	case "paypal":
		h.handlePayPalWebhook(w, r)
	default:
		http.Error(w, "Unknown provider", http.StatusBadRequest)
	}
}

// RefundPayment initiates a refund
func (h *PaymentsHandler) RefundPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract payment ID from path: /payments/{id}/refund
	path := r.URL.Path[len("/payments/"):]
	paymentID := path[:len(path)-len("/refund")]
	if paymentID == "" {
		http.Error(w, "Payment ID is required", http.StatusBadRequest)
		return
	}

	var req RefundRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Reason == "" {
		http.Error(w, "Refund reason is required", http.StatusBadRequest)
		return
	}

	// In real implementation, process refund with payment provider
	refund := map[string]interface{}{
		"id":         fmt.Sprintf("REF-%d", time.Now().UnixNano()),
		"payment_id": paymentID,
		"amount":     req.Amount,
		"reason":     req.Reason,
		"status":     "processing",
		"created_at": time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(refund)
}

// GetPaymentMethods returns available payment methods
func (h *PaymentsHandler) GetPaymentMethods(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	methods := []map[string]interface{}{
		{
			"id":          "liqpay",
			"name":        "LiqPay",
			"description": "Оплата карткою через LiqPay",
			"icon":        "/icons/liqpay.svg",
			"enabled":     true,
			"fee":         0,
		},
		{
			"id":          "monobank",
			"name":        "Monobank",
			"description": "Оплата через Monobank",
			"icon":        "/icons/monobank.svg",
			"enabled":     true,
			"fee":         0,
		},
		{
			"id":          "fondy",
			"name":        "Fondy",
			"description": "Оплата карткою через Fondy",
			"icon":        "/icons/fondy.svg",
			"enabled":     true,
			"fee":         0,
		},
		{
			"id":          "wayforpay",
			"name":        "WayForPay",
			"description": "Оплата через WayForPay",
			"icon":        "/icons/wayforpay.svg",
			"enabled":     true,
			"fee":         0,
		},
		{
			"id":          "paypal",
			"name":        "PayPal",
			"description": "Оплата через PayPal",
			"icon":        "/icons/paypal.svg",
			"enabled":     true,
			"fee":         0,
		},
		{
			"id":          "cash_on_delivery",
			"name":        "Накладений платіж",
			"description": "Оплата при отриманні",
			"icon":        "/icons/cash.svg",
			"enabled":     true,
			"fee":         20.00,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(methods)
}

// Payment provider implementations

func (h *PaymentsHandler) initiateLiqPayPayment(payment *Payment, req PaymentRequest) *PaymentResponse {
	// Build LiqPay data
	data := map[string]interface{}{
		"version":     3,
		"public_key":  h.liqpayPublicKey,
		"action":      "pay",
		"amount":      req.Amount,
		"currency":    req.Currency,
		"description": req.Description,
		"order_id":    req.OrderID,
		"result_url":  req.ReturnURL,
		"server_url":  req.CallbackURL,
	}

	dataJSON, _ := json.Marshal(data)
	dataEncoded := base64.StdEncoding.EncodeToString(dataJSON)

	// Generate signature
	signString := h.liqpayPrivateKey + dataEncoded + h.liqpayPrivateKey
	hash := sha256.Sum256([]byte(signString))
	signature := base64.StdEncoding.EncodeToString(hash[:])

	redirectURL := fmt.Sprintf("https://www.liqpay.ua/api/3/checkout?data=%s&signature=%s", dataEncoded, signature)

	return &PaymentResponse{
		PaymentID:   payment.ID,
		Status:      "pending",
		RedirectURL: redirectURL,
	}
}

func (h *PaymentsHandler) initiateMonobankPayment(payment *Payment, req PaymentRequest) *PaymentResponse {
	// In real implementation, call Monobank API
	return &PaymentResponse{
		PaymentID:   payment.ID,
		Status:      "pending",
		RedirectURL: "https://pay.monobank.ua/...",
		QRCode:      "data:image/png;base64,...",
	}
}

func (h *PaymentsHandler) initiateFondyPayment(payment *Payment, req PaymentRequest) *PaymentResponse {
	// In real implementation, call Fondy API
	return &PaymentResponse{
		PaymentID:   payment.ID,
		Status:      "pending",
		RedirectURL: "https://pay.fondy.eu/...",
	}
}

func (h *PaymentsHandler) initiateWayForPayPayment(payment *Payment, req PaymentRequest) *PaymentResponse {
	// In real implementation, call WayForPay API
	return &PaymentResponse{
		PaymentID:   payment.ID,
		Status:      "pending",
		RedirectURL: "https://secure.wayforpay.com/...",
	}
}

func (h *PaymentsHandler) initiatePayPalPayment(payment *Payment, req PaymentRequest) *PaymentResponse {
	// In real implementation, call PayPal API
	return &PaymentResponse{
		PaymentID:   payment.ID,
		Status:      "pending",
		RedirectURL: "https://www.paypal.com/...",
	}
}

// Webhook handlers

func (h *PaymentsHandler) handleLiqPayWebhook(w http.ResponseWriter, r *http.Request) {
	data := r.FormValue("data")
	signature := r.FormValue("signature")

	// Verify signature
	signString := h.liqpayPrivateKey + data + h.liqpayPrivateKey
	hash := sha256.Sum256([]byte(signString))
	expectedSignature := base64.StdEncoding.EncodeToString(hash[:])

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		http.Error(w, "Invalid signature", http.StatusBadRequest)
		return
	}

	// Decode data
	dataDecoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		http.Error(w, "Invalid data", http.StatusBadRequest)
		return
	}

	var callbackData map[string]interface{}
	if err := json.Unmarshal(dataDecoded, &callbackData); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Process payment status update
	status := callbackData["status"].(string)
	orderID := callbackData["order_id"].(string)

	// Update payment and order status based on callback
	fmt.Printf("LiqPay callback: order=%s, status=%s\n", orderID, status)

	w.WriteHeader(http.StatusOK)
}

func (h *PaymentsHandler) handleMonobankWebhook(w http.ResponseWriter, r *http.Request) {
	var callback map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&callback); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Process Monobank callback
	fmt.Printf("Monobank callback: %v\n", callback)

	w.WriteHeader(http.StatusOK)
}

func (h *PaymentsHandler) handleFondyWebhook(w http.ResponseWriter, r *http.Request) {
	var callback map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&callback); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Process Fondy callback
	fmt.Printf("Fondy callback: %v\n", callback)

	w.WriteHeader(http.StatusOK)
}

func (h *PaymentsHandler) handleWayForPayWebhook(w http.ResponseWriter, r *http.Request) {
	var callback map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&callback); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Process WayForPay callback
	fmt.Printf("WayForPay callback: %v\n", callback)

	w.WriteHeader(http.StatusOK)
}

func (h *PaymentsHandler) handlePayPalWebhook(w http.ResponseWriter, r *http.Request) {
	var callback map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&callback); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Process PayPal callback
	fmt.Printf("PayPal callback: %v\n", callback)

	w.WriteHeader(http.StatusOK)
}
