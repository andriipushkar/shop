package payment

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestNewMonoClient(t *testing.T) {
	client := NewMonoClient("test-token", "https://example.com/webhook")

	if client == nil {
		t.Fatal("expected non-nil client")
	}
	if client.token != "test-token" {
		t.Errorf("expected token 'test-token', got '%s'", client.token)
	}
	if client.webhookURL != "https://example.com/webhook" {
		t.Errorf("expected webhookURL 'https://example.com/webhook', got '%s'", client.webhookURL)
	}
	if client.httpClient == nil {
		t.Error("expected non-nil httpClient")
	}
	if client.httpClient.Timeout != 30*time.Second {
		t.Errorf("expected timeout 30s, got %v", client.httpClient.Timeout)
	}
}

func TestStatusConstants(t *testing.T) {
	if StatusCreated != "created" {
		t.Errorf("expected StatusCreated 'created', got '%s'", StatusCreated)
	}
	if StatusProcessing != "processing" {
		t.Errorf("expected StatusProcessing 'processing', got '%s'", StatusProcessing)
	}
	if StatusHold != "hold" {
		t.Errorf("expected StatusHold 'hold', got '%s'", StatusHold)
	}
	if StatusSuccess != "success" {
		t.Errorf("expected StatusSuccess 'success', got '%s'", StatusSuccess)
	}
	if StatusFailure != "failure" {
		t.Errorf("expected StatusFailure 'failure', got '%s'", StatusFailure)
	}
	if StatusReversed != "reversed" {
		t.Errorf("expected StatusReversed 'reversed', got '%s'", StatusReversed)
	}
	if StatusExpired != "expired" {
		t.Errorf("expected StatusExpired 'expired', got '%s'", StatusExpired)
	}
}

func TestInvoiceRequest_Fields(t *testing.T) {
	req := InvoiceRequest{
		Amount:      10000,
		Ccy:         980,
		RedirectURL: "https://shop.com/success",
		WebHookURL:  "https://shop.com/webhook",
		Validity:    3600,
		PaymentType: "debit",
		Reference:   "ORD-123",
		Comment:     "Test order",
		Destination: "Test Product",
	}

	if req.Amount != 10000 {
		t.Errorf("expected Amount 10000, got %d", req.Amount)
	}
	if req.Ccy != 980 {
		t.Errorf("expected Ccy 980, got %d", req.Ccy)
	}
	if req.Reference != "ORD-123" {
		t.Errorf("expected Reference 'ORD-123', got '%s'", req.Reference)
	}
}

func TestInvoiceRequest_WithMerchantInfo(t *testing.T) {
	req := InvoiceRequest{
		Amount: 50000,
		MerchantPaymInfo: &MerchantPaymInfo{
			Reference:   "ORD-456",
			Destination: "Electronics",
			Comment:     "Order comment",
			BasketOrder: []BasketItem{
				{
					Name: "iPhone",
					Qty:  1,
					Sum:  50000,
					Code: "IPHONE-15",
				},
			},
		},
	}

	if req.MerchantPaymInfo == nil {
		t.Fatal("expected non-nil MerchantPaymInfo")
	}
	if req.MerchantPaymInfo.Reference != "ORD-456" {
		t.Errorf("expected Reference 'ORD-456', got '%s'", req.MerchantPaymInfo.Reference)
	}
	if len(req.MerchantPaymInfo.BasketOrder) != 1 {
		t.Errorf("expected 1 basket item, got %d", len(req.MerchantPaymInfo.BasketOrder))
	}
}

func TestBasketItem_Fields(t *testing.T) {
	item := BasketItem{
		Name: "Test Product",
		Qty:  2.5,
		Sum:  25000,
		Icon: "https://example.com/icon.png",
		Unit: "шт",
		Code: "PROD-001",
	}

	if item.Name != "Test Product" {
		t.Errorf("expected Name 'Test Product', got '%s'", item.Name)
	}
	if item.Qty != 2.5 {
		t.Errorf("expected Qty 2.5, got %f", item.Qty)
	}
	if item.Sum != 25000 {
		t.Errorf("expected Sum 25000, got %d", item.Sum)
	}
}

func TestInvoiceResponse_Fields(t *testing.T) {
	resp := InvoiceResponse{
		InvoiceID: "invoice-123",
		PageURL:   "https://pay.mbnk.biz/invoice-123",
		Status:    "created",
	}

	if resp.InvoiceID != "invoice-123" {
		t.Errorf("expected InvoiceID 'invoice-123', got '%s'", resp.InvoiceID)
	}
	if resp.PageURL != "https://pay.mbnk.biz/invoice-123" {
		t.Errorf("expected PageURL 'https://pay.mbnk.biz/invoice-123', got '%s'", resp.PageURL)
	}
}

func TestInvoiceResponse_WithError(t *testing.T) {
	resp := InvoiceResponse{
		ErrCode: "invalid_token",
		ErrText: "Invalid API token",
	}

	if resp.ErrCode != "invalid_token" {
		t.Errorf("expected ErrCode 'invalid_token', got '%s'", resp.ErrCode)
	}
	if resp.ErrText != "Invalid API token" {
		t.Errorf("expected ErrText 'Invalid API token', got '%s'", resp.ErrText)
	}
}

func TestWebhookPayload_Fields(t *testing.T) {
	payload := WebhookPayload{
		InvoiceID:     "invoice-123",
		Status:        "success",
		FailureReason: "",
		Amount:        10000,
		Ccy:           980,
		Reference:     "ORD-123",
		CreatedDate:   "2024-01-15 10:00:00",
		ModifiedDate:  "2024-01-15 10:05:00",
	}

	if payload.InvoiceID != "invoice-123" {
		t.Errorf("expected InvoiceID 'invoice-123', got '%s'", payload.InvoiceID)
	}
	if payload.Status != "success" {
		t.Errorf("expected Status 'success', got '%s'", payload.Status)
	}
	if payload.Amount != 10000 {
		t.Errorf("expected Amount 10000, got %d", payload.Amount)
	}
}

func TestPayment_Fields(t *testing.T) {
	now := time.Now()
	payment := Payment{
		ID:            "PAY-123",
		OrderID:       "ORD-456",
		InvoiceID:     "invoice-789",
		Amount:        50000,
		Status:        StatusCreated,
		PaymentURL:    "https://pay.mbnk.biz/invoice-789",
		FailureReason: "",
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if payment.ID != "PAY-123" {
		t.Errorf("expected ID 'PAY-123', got '%s'", payment.ID)
	}
	if payment.OrderID != "ORD-456" {
		t.Errorf("expected OrderID 'ORD-456', got '%s'", payment.OrderID)
	}
	if payment.Amount != 50000 {
		t.Errorf("expected Amount 50000, got %d", payment.Amount)
	}
}

func TestIsPaymentSuccessful(t *testing.T) {
	tests := []struct {
		status   string
		expected bool
	}{
		{StatusSuccess, true},
		{StatusCreated, false},
		{StatusProcessing, false},
		{StatusHold, false},
		{StatusFailure, false},
		{StatusReversed, false},
		{StatusExpired, false},
		{"unknown", false},
	}

	for _, tt := range tests {
		result := IsPaymentSuccessful(tt.status)
		if result != tt.expected {
			t.Errorf("IsPaymentSuccessful(%q) = %v, want %v", tt.status, result, tt.expected)
		}
	}
}

func TestIsPaymentFinal(t *testing.T) {
	tests := []struct {
		status   string
		expected bool
	}{
		{StatusSuccess, true},
		{StatusFailure, true},
		{StatusReversed, true},
		{StatusExpired, true},
		{StatusCreated, false},
		{StatusProcessing, false},
		{StatusHold, false},
		{"unknown", false},
	}

	for _, tt := range tests {
		result := IsPaymentFinal(tt.status)
		if result != tt.expected {
			t.Errorf("IsPaymentFinal(%q) = %v, want %v", tt.status, result, tt.expected)
		}
	}
}

func TestMonoClient_VerifyWebhookSignature(t *testing.T) {
	client := NewMonoClient("secret-token", "")

	body := []byte(`{"invoiceId":"123","status":"success"}`)
	hash := sha256.Sum256(append(body, []byte("secret-token")...))
	validSignature := base64.StdEncoding.EncodeToString(hash[:])

	if !client.VerifyWebhookSignature(body, validSignature) {
		t.Error("expected valid signature to pass verification")
	}

	if client.VerifyWebhookSignature(body, "invalid-signature") {
		t.Error("expected invalid signature to fail verification")
	}
}

func TestMonoClient_VerifyWebhookSignature_EmptyBody(t *testing.T) {
	client := NewMonoClient("token", "")

	body := []byte{}
	hash := sha256.Sum256(append(body, []byte("token")...))
	validSignature := base64.StdEncoding.EncodeToString(hash[:])

	if !client.VerifyWebhookSignature(body, validSignature) {
		t.Error("expected valid signature to pass verification with empty body")
	}
}

func TestMonoAPIURL_Constant(t *testing.T) {
	expected := "https://api.monobank.ua/api/merchant/invoice/create"
	if MonoAPIURL != expected {
		t.Errorf("expected MonoAPIURL '%s', got '%s'", expected, MonoAPIURL)
	}
}

// MockPaymentRepository implements PaymentRepository for testing
type MockPaymentRepository struct {
	payments       map[string]*Payment
	SaveFunc       func(ctx context.Context, p *Payment) error
	GetByOrderFunc func(ctx context.Context, orderID string) (*Payment, error)
}

func NewMockPaymentRepository() *MockPaymentRepository {
	return &MockPaymentRepository{
		payments: make(map[string]*Payment),
	}
}

func (m *MockPaymentRepository) Save(ctx context.Context, p *Payment) error {
	if m.SaveFunc != nil {
		return m.SaveFunc(ctx, p)
	}
	m.payments[p.ID] = p
	return nil
}

func (m *MockPaymentRepository) GetByOrderID(ctx context.Context, orderID string) (*Payment, error) {
	if m.GetByOrderFunc != nil {
		return m.GetByOrderFunc(ctx, orderID)
	}
	for _, p := range m.payments {
		if p.OrderID == orderID {
			return p, nil
		}
	}
	return nil, errors.New("payment not found")
}

func (m *MockPaymentRepository) GetByInvoiceID(ctx context.Context, invoiceID string) (*Payment, error) {
	for _, p := range m.payments {
		if p.InvoiceID == invoiceID {
			return p, nil
		}
	}
	return nil, errors.New("payment not found")
}

func (m *MockPaymentRepository) UpdateStatus(ctx context.Context, invoiceID, status, failureReason string) error {
	for _, p := range m.payments {
		if p.InvoiceID == invoiceID {
			p.Status = status
			p.FailureReason = failureReason
			p.UpdatedAt = time.Now()
			return nil
		}
	}
	return errors.New("payment not found")
}

func TestNewPaymentService(t *testing.T) {
	client := NewMonoClient("token", "webhook")
	repo := NewMockPaymentRepository()

	service := NewPaymentService(client, repo)

	if service == nil {
		t.Fatal("expected non-nil service")
	}
	if service.mono != client {
		t.Error("expected mono client to be set")
	}
	if service.repo != repo {
		t.Error("expected repo to be set")
	}
}

func TestPaymentService_GetPaymentByOrder(t *testing.T) {
	client := NewMonoClient("token", "webhook")
	repo := NewMockPaymentRepository()

	payment := &Payment{
		ID:        "PAY-123",
		OrderID:   "ORD-456",
		InvoiceID: "invoice-789",
		Amount:    10000,
		Status:    StatusCreated,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	repo.payments["PAY-123"] = payment

	service := NewPaymentService(client, repo)

	result, err := service.GetPaymentByOrder(context.Background(), "ORD-456")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID != "PAY-123" {
		t.Errorf("expected ID 'PAY-123', got '%s'", result.ID)
	}
}

func TestPaymentService_GetPaymentByOrder_NotFound(t *testing.T) {
	client := NewMonoClient("token", "webhook")
	repo := NewMockPaymentRepository()
	service := NewPaymentService(client, repo)

	_, err := service.GetPaymentByOrder(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent order")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' error, got '%s'", err.Error())
	}
}

func TestPaymentService_HandleWebhook(t *testing.T) {
	client := NewMonoClient("token", "webhook")
	repo := NewMockPaymentRepository()

	payment := &Payment{
		ID:        "PAY-123",
		OrderID:   "ORD-456",
		InvoiceID: "invoice-789",
		Amount:    10000,
		Status:    StatusCreated,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	repo.payments["PAY-123"] = payment

	service := NewPaymentService(client, repo)

	payload := &WebhookPayload{
		InvoiceID:     "invoice-789",
		Status:        StatusSuccess,
		FailureReason: "",
	}

	err := service.HandleWebhook(context.Background(), payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if repo.payments["PAY-123"].Status != StatusSuccess {
		t.Errorf("expected status '%s', got '%s'", StatusSuccess, repo.payments["PAY-123"].Status)
	}
}

func TestInvoiceRequest_JSON(t *testing.T) {
	req := InvoiceRequest{
		Amount:      10000,
		Ccy:         980,
		Reference:   "ORD-123",
		Comment:     "Test order",
		RedirectURL: "https://shop.com/success",
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var decoded InvoiceRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if decoded.Amount != req.Amount {
		t.Errorf("expected Amount %d, got %d", req.Amount, decoded.Amount)
	}
	if decoded.Reference != req.Reference {
		t.Errorf("expected Reference '%s', got '%s'", req.Reference, decoded.Reference)
	}
}

func TestWebhookPayload_JSON(t *testing.T) {
	jsonData := `{
		"invoiceId": "invoice-123",
		"status": "success",
		"amount": 10000,
		"ccy": 980,
		"reference": "ORD-456",
		"createdDate": "2024-01-15 10:00:00",
		"modifiedDate": "2024-01-15 10:05:00"
	}`

	var payload WebhookPayload
	if err := json.Unmarshal([]byte(jsonData), &payload); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if payload.InvoiceID != "invoice-123" {
		t.Errorf("expected InvoiceID 'invoice-123', got '%s'", payload.InvoiceID)
	}
	if payload.Status != "success" {
		t.Errorf("expected Status 'success', got '%s'", payload.Status)
	}
	if payload.Amount != 10000 {
		t.Errorf("expected Amount 10000, got %d", payload.Amount)
	}
}

func TestPayment_JSON(t *testing.T) {
	now := time.Now()
	payment := Payment{
		ID:         "PAY-123",
		OrderID:    "ORD-456",
		InvoiceID:  "invoice-789",
		Amount:     50000,
		Status:     StatusSuccess,
		PaymentURL: "https://pay.mbnk.biz/invoice-789",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	data, err := json.Marshal(payment)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var decoded Payment
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if decoded.ID != payment.ID {
		t.Errorf("expected ID '%s', got '%s'", payment.ID, decoded.ID)
	}
	if decoded.Status != payment.Status {
		t.Errorf("expected Status '%s', got '%s'", payment.Status, decoded.Status)
	}
}
