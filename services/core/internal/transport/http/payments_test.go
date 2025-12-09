package http

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestNewPaymentsHandler(t *testing.T) {
	handler := NewPaymentsHandler()
	if handler == nil {
		t.Fatal("expected handler to be created")
	}
}

func TestInitiatePayment(t *testing.T) {
	handler := NewPaymentsHandler()

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
			name:   "missing order_id",
			method: http.MethodPost,
			body: PaymentRequest{
				Amount: 100,
				Method: "liqpay",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "invalid amount",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-123",
				Amount:  0,
				Method:  "liqpay",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing method",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-123",
				Amount:  100,
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "unsupported method",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-123",
				Amount:  100,
				Method:  "unknown_method",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "valid liqpay payment",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID:     "ORD-123",
				Amount:      100,
				Currency:    "UAH",
				Method:      "liqpay",
				Description: "Test payment",
				ReturnURL:   "https://shop.ua/return",
				CallbackURL: "https://shop.ua/callback",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid monobank payment",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-124",
				Amount:  200,
				Method:  "monobank",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid fondy payment",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-125",
				Amount:  300,
				Method:  "fondy",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid wayforpay payment",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-126",
				Amount:  400,
				Method:  "wayforpay",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid paypal payment",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-127",
				Amount:  500,
				Method:  "paypal",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid cash on delivery",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-128",
				Amount:  600,
				Method:  "cash_on_delivery",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "default currency",
			method: http.MethodPost,
			body: PaymentRequest{
				OrderID: "ORD-129",
				Amount:  100,
				Method:  "liqpay",
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

			req := httptest.NewRequest(tt.method, "/payments", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.InitiatePayment(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusCreated {
				var resp PaymentResponse
				if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if resp.PaymentID == "" {
					t.Error("expected payment_id in response")
				}
			}
		})
	}
}

func TestGetPayment(t *testing.T) {
	handler := NewPaymentsHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			path:           "/payments/PAY-123",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing payment ID",
			method:         http.MethodGet,
			path:           "/payments/",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			path:           "/payments/PAY-123",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.GetPayment(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var payment Payment
				if err := json.NewDecoder(w.Body).Decode(&payment); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if payment.ID != "PAY-123" {
					t.Error("expected payment ID in response")
				}
			}
		})
	}
}

func TestGetOrderPayments(t *testing.T) {
	handler := NewPaymentsHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			path:           "/orders/ORD-123/payments",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing order ID",
			method:         http.MethodGet,
			path:           "/orders//payments",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			path:           "/orders/ORD-123/payments",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.GetOrderPayments(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestRefundPayment(t *testing.T) {
	handler := NewPaymentsHandler()

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
			path:           "/payments/PAY-123/refund",
			body:           nil,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "invalid body",
			method:         http.MethodPost,
			path:           "/payments/PAY-123/refund",
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "missing reason",
			method:         http.MethodPost,
			path:           "/payments/PAY-123/refund",
			body:           RefundRequest{Amount: 100},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid full refund",
			method:         http.MethodPost,
			path:           "/payments/PAY-123/refund",
			body:           RefundRequest{Reason: "Customer request"},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "valid partial refund",
			method:         http.MethodPost,
			path:           "/payments/PAY-123/refund",
			body:           RefundRequest{Amount: 50, Reason: "Partial refund"},
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

			req := httptest.NewRequest(tt.method, tt.path, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.RefundPayment(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestGetPaymentMethods(t *testing.T) {
	handler := NewPaymentsHandler()

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
			req := httptest.NewRequest(tt.method, "/payments/methods", nil)
			w := httptest.NewRecorder()

			handler.GetPaymentMethods(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var methods []map[string]interface{}
				if err := json.NewDecoder(w.Body).Decode(&methods); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if len(methods) == 0 {
					t.Error("expected payment methods in response")
				}
				// Check for expected methods
				methodIDs := make(map[string]bool)
				for _, m := range methods {
					methodIDs[m["id"].(string)] = true
				}
				expectedMethods := []string{"liqpay", "monobank", "fondy", "wayforpay", "paypal", "cash_on_delivery"}
				for _, em := range expectedMethods {
					if !methodIDs[em] {
						t.Errorf("expected method %s in response", em)
					}
				}
			}
		})
	}
}

func TestProcessWebhook(t *testing.T) {
	handler := NewPaymentsHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodGet,
			path:           "/webhooks/payments/liqpay",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing provider",
			method:         http.MethodPost,
			path:           "/webhooks/payments/",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "unknown provider",
			method:         http.MethodPost,
			path:           "/webhooks/payments/unknown",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.ProcessWebhook(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestHandleLiqPayWebhook(t *testing.T) {
	handler := NewPaymentsHandler()

	// Create valid LiqPay callback data
	callbackData := map[string]interface{}{
		"status":   "success",
		"order_id": "ORD-123",
		"amount":   100,
	}
	dataJSON, _ := json.Marshal(callbackData)
	dataEncoded := base64.StdEncoding.EncodeToString(dataJSON)

	tests := []struct {
		name           string
		data           string
		signature      string
		expectedStatus int
	}{
		{
			name:           "invalid signature",
			data:           dataEncoded,
			signature:      "invalid_signature",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid data encoding",
			data:           "not_base64!!!",
			signature:      "test",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			form := url.Values{}
			form.Set("data", tt.data)
			form.Set("signature", tt.signature)

			req := httptest.NewRequest(http.MethodPost, "/webhooks/payments/liqpay", strings.NewReader(form.Encode()))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			w := httptest.NewRecorder()

			handler.handleLiqPayWebhook(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestHandleMonobankWebhook(t *testing.T) {
	handler := NewPaymentsHandler()

	tests := []struct {
		name           string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "invalid body",
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid callback",
			body:           map[string]interface{}{"invoiceId": "123", "status": "success"},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if s, ok := tt.body.(string); ok {
				body = []byte(s)
			} else {
				body, _ = json.Marshal(tt.body)
			}

			req := httptest.NewRequest(http.MethodPost, "/webhooks/payments/monobank", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handleMonobankWebhook(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestHandleFondyWebhook(t *testing.T) {
	handler := NewPaymentsHandler()

	tests := []struct {
		name           string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "invalid body",
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid callback",
			body:           map[string]interface{}{"order_id": "123", "order_status": "approved"},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if s, ok := tt.body.(string); ok {
				body = []byte(s)
			} else {
				body, _ = json.Marshal(tt.body)
			}

			req := httptest.NewRequest(http.MethodPost, "/webhooks/payments/fondy", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handleFondyWebhook(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestHandleWayForPayWebhook(t *testing.T) {
	handler := NewPaymentsHandler()

	tests := []struct {
		name           string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "invalid body",
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid callback",
			body:           map[string]interface{}{"orderReference": "123", "transactionStatus": "Approved"},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if s, ok := tt.body.(string); ok {
				body = []byte(s)
			} else {
				body, _ = json.Marshal(tt.body)
			}

			req := httptest.NewRequest(http.MethodPost, "/webhooks/payments/wayforpay", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handleWayForPayWebhook(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestHandlePayPalWebhook(t *testing.T) {
	handler := NewPaymentsHandler()

	tests := []struct {
		name           string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "invalid body",
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid callback",
			body:           map[string]interface{}{"event_type": "PAYMENT.CAPTURE.COMPLETED", "id": "123"},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if s, ok := tt.body.(string); ok {
				body = []byte(s)
			} else {
				body, _ = json.Marshal(tt.body)
			}

			req := httptest.NewRequest(http.MethodPost, "/webhooks/payments/paypal", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handlePayPalWebhook(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestPaymentTypes(t *testing.T) {
	// Test Payment struct
	payment := &Payment{
		ID:       "PAY-123",
		OrderID:  "ORD-123",
		Amount:   100.00,
		Currency: "UAH",
		Method:   "liqpay",
		Status:   "completed",
	}
	if payment.ID != "PAY-123" {
		t.Error("expected payment ID to be set")
	}

	// Test PaymentRequest struct
	req := &PaymentRequest{
		OrderID:     "ORD-123",
		Amount:      100,
		Currency:    "UAH",
		Method:      "liqpay",
		Description: "Test",
	}
	if req.OrderID != "ORD-123" {
		t.Error("expected order ID to be set")
	}

	// Test PaymentResponse struct
	resp := &PaymentResponse{
		PaymentID:   "PAY-123",
		Status:      "pending",
		RedirectURL: "https://example.com",
	}
	if resp.PaymentID != "PAY-123" {
		t.Error("expected payment ID in response")
	}

	// Test RefundRequest struct
	refund := &RefundRequest{
		PaymentID: "PAY-123",
		Amount:    50,
		Reason:    "Customer request",
	}
	if refund.PaymentID != "PAY-123" {
		t.Error("expected payment ID in refund request")
	}
}

func TestInitiateProviderPayments(t *testing.T) {
	handler := NewPaymentsHandler()
	payment := &Payment{
		ID:       "PAY-123",
		OrderID:  "ORD-123",
		Amount:   100,
		Currency: "UAH",
	}
	req := PaymentRequest{
		OrderID:     "ORD-123",
		Amount:      100,
		Currency:    "UAH",
		Description: "Test",
		ReturnURL:   "https://shop.ua/return",
		CallbackURL: "https://shop.ua/callback",
	}

	// Test LiqPay
	liqpayResp := handler.initiateLiqPayPayment(payment, req)
	if liqpayResp.PaymentID != payment.ID {
		t.Error("expected payment ID in LiqPay response")
	}
	if liqpayResp.RedirectURL == "" {
		t.Error("expected redirect URL in LiqPay response")
	}

	// Test Monobank
	monoResp := handler.initiateMonobankPayment(payment, req)
	if monoResp.PaymentID != payment.ID {
		t.Error("expected payment ID in Monobank response")
	}

	// Test Fondy
	fondyResp := handler.initiateFondyPayment(payment, req)
	if fondyResp.PaymentID != payment.ID {
		t.Error("expected payment ID in Fondy response")
	}

	// Test WayForPay
	wfpResp := handler.initiateWayForPayPayment(payment, req)
	if wfpResp.PaymentID != payment.ID {
		t.Error("expected payment ID in WayForPay response")
	}

	// Test PayPal
	ppResp := handler.initiatePayPalPayment(payment, req)
	if ppResp.PaymentID != payment.ID {
		t.Error("expected payment ID in PayPal response")
	}
}
