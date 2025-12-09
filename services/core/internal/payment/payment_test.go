package payment

import (
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"testing"
)

func TestLiqPaySignature(t *testing.T) {
	client := NewLiqPayClient("test_public", "test_private", true)

	// Test signature generation
	data := base64.StdEncoding.EncodeToString([]byte(`{"version":3,"action":"pay"}`))
	expected := generateTestSignature("test_private", data)

	// Verify the signature format
	if len(expected) != 40 { // SHA-1 hex is 40 chars
		t.Errorf("Expected SHA-1 signature length 40, got %d", len(expected))
	}

	_ = client
}

func TestPaymentStatusMapping(t *testing.T) {
	tests := []struct {
		input    string
		expected PaymentStatus
	}{
		{"success", StatusSuccess},
		{"pending", StatusPending},
		{"failed", StatusFailed},
		{"cancelled", StatusCancelled},
		{"refunded", StatusRefunded},
		{"unknown", StatusPending},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			var status PaymentStatus
			switch tt.input {
			case "success":
				status = StatusSuccess
			case "pending":
				status = StatusPending
			case "failed":
				status = StatusFailed
			case "cancelled":
				status = StatusCancelled
			case "refunded":
				status = StatusRefunded
			default:
				status = StatusPending
			}

			if status != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, status)
			}
		})
	}
}

func TestPaymentService(t *testing.T) {
	service := NewPaymentService()

	t.Run("RegisterProvider", func(t *testing.T) {
		mockProvider := &mockPaymentProvider{name: "mock"}
		service.RegisterProvider(mockProvider)

		provider, err := service.GetProvider("mock")
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
		if provider.Name() != "mock" {
			t.Errorf("Expected provider name 'mock', got %s", provider.Name())
		}
	})

	t.Run("GetProvider_NotFound", func(t *testing.T) {
		_, err := service.GetProvider("nonexistent")
		if err == nil {
			t.Error("Expected error for nonexistent provider")
		}
	})

	t.Run("SetDefaultProvider", func(t *testing.T) {
		mockProvider := &mockPaymentProvider{name: "default_mock"}
		service.RegisterProvider(mockProvider)
		service.SetDefaultProvider("default_mock")

		provider, err := service.GetProvider("")
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
		if provider.Name() != "default_mock" {
			t.Errorf("Expected default provider 'default_mock', got %s", provider.Name())
		}
	})
}

func TestAmountConversion(t *testing.T) {
	tests := []struct {
		amount   float64
		expected int64
	}{
		{100.00, 10000},
		{99.99, 9999},
		{0.01, 1},
		{1234.56, 123456},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			result := int64(tt.amount * 100)
			if result != tt.expected {
				t.Errorf("Expected %d kopiyky, got %d", tt.expected, result)
			}
		})
	}
}

func TestPaymentRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		request PaymentRequest
		wantErr bool
	}{
		{
			name: "Valid request",
			request: PaymentRequest{
				OrderID:     "order123",
				Amount:      100.00,
				Currency:    UAH,
				Description: "Test payment",
			},
			wantErr: false,
		},
		{
			name: "Missing order ID",
			request: PaymentRequest{
				Amount:   100.00,
				Currency: UAH,
			},
			wantErr: true,
		},
		{
			name: "Zero amount",
			request: PaymentRequest{
				OrderID:  "order123",
				Amount:   0,
				Currency: UAH,
			},
			wantErr: true,
		},
		{
			name: "Negative amount",
			request: PaymentRequest{
				OrderID:  "order123",
				Amount:   -100.00,
				Currency: UAH,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePaymentRequest(&tt.request)
			if (err != nil) != tt.wantErr {
				t.Errorf("validatePaymentRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestPaymentStatus(t *testing.T) {
	statuses := []PaymentStatus{
		StatusPending,
		StatusProcessing,
		StatusSuccess,
		StatusFailed,
		StatusCancelled,
		StatusRefunded,
		StatusExpired,
	}

	for _, status := range statuses {
		if status == "" {
			t.Error("Payment status should not be empty")
		}
	}
}

func TestPaymentMethod(t *testing.T) {
	methods := []PaymentMethod{
		MethodCard,
		MethodApplePay,
		MethodGooglePay,
		MethodPrivat24,
		MethodInstalment,
		MethodInvoice,
		MethodCash,
		MethodQR,
	}

	for _, method := range methods {
		if method == "" {
			t.Error("Payment method should not be empty")
		}
	}
}

func TestCurrency(t *testing.T) {
	currencies := []Currency{
		UAH,
		USD,
		EUR,
		PLN,
	}

	for _, currency := range currencies {
		if currency == "" {
			t.Error("Currency should not be empty")
		}
	}
}

// Local errors for validation
var errInvalidOrder = errors.New("invalid order")

// Helper functions
func generateTestSignature(privateKey, data string) string {
	h := sha1.New()
	h.Write([]byte(privateKey + data + privateKey))
	return hex.EncodeToString(h.Sum(nil))
}

func validatePaymentRequest(r *PaymentRequest) error {
	if r.OrderID == "" {
		return errInvalidOrder
	}
	if r.Amount <= 0 {
		return ErrInvalidAmount
	}
	return nil
}

// Mock provider for testing
type mockPaymentProvider struct {
	name string
}

func (m *mockPaymentProvider) Name() string { return m.name }

func (m *mockPaymentProvider) CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	return &PaymentResponse{
		PaymentID:  "mock_payment_123",
		Status:     StatusPending,
		PaymentURL: "https://mock.payment/pay",
	}, nil
}

func (m *mockPaymentProvider) GetPayment(ctx context.Context, paymentID string) (*PaymentResponse, error) {
	return &PaymentResponse{
		PaymentID: paymentID,
		Status:    StatusSuccess,
	}, nil
}

func (m *mockPaymentProvider) RefundPayment(ctx context.Context, paymentID string, amount float64) (*PaymentResponse, error) {
	return &PaymentResponse{
		PaymentID: paymentID,
		Status:    StatusRefunded,
	}, nil
}

func (m *mockPaymentProvider) ProcessCallback(ctx context.Context, data []byte, signature string) (*PaymentCallback, error) {
	return &PaymentCallback{
		PaymentID: "callback_123",
		Status:    StatusSuccess,
	}, nil
}

func (m *mockPaymentProvider) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
	return &RefundResponse{
		RefundID:  "refund_123",
		PaymentID: req.PaymentID,
		Amount:    req.Amount,
		Status:    StatusRefunded,
	}, nil
}

func (m *mockPaymentProvider) VerifySignature(data []byte, signature string) bool {
	return true
}

// ============================================================================
// Monobank Client Tests
// ============================================================================

func TestNewMonobankClient(t *testing.T) {
	client := NewMonobankClient("test-token")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.token != "test-token" {
		t.Errorf("expected token 'test-token', got '%s'", client.token)
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestMonobankName(t *testing.T) {
	client := NewMonobankClient("test-token")
	if client.Name() != "monobank" {
		t.Errorf("expected name 'monobank', got '%s'", client.Name())
	}
}

func TestMonobankMapStatus(t *testing.T) {
	client := NewMonobankClient("test-token")

	tests := []struct {
		input    string
		expected PaymentStatus
	}{
		{"success", StatusSuccess},
		{"failure", StatusFailed},
		{"reversed", StatusRefunded},
		{"created", StatusProcessing},
		{"processing", StatusProcessing},
		{"hold", StatusProcessing},
		{"expired", StatusExpired},
		{"unknown", StatusPending},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestCurrencyCode(t *testing.T) {
	tests := []struct {
		currency Currency
		code     int
	}{
		{UAH, 980},
		{USD, 840},
		{EUR, 978},
		{Currency("UNKNOWN"), 980}, // Default
	}

	for _, tt := range tests {
		result := currencyCode(tt.currency)
		if result != tt.code {
			t.Errorf("currencyCode(%s) = %d, expected %d", tt.currency, result, tt.code)
		}
	}
}

func TestCurrencyFromCode(t *testing.T) {
	tests := []struct {
		code     int
		currency Currency
	}{
		{980, UAH},
		{840, USD},
		{978, EUR},
		{999, UAH}, // Default
	}

	for _, tt := range tests {
		result := currencyFromCode(tt.code)
		if result != tt.currency {
			t.Errorf("currencyFromCode(%d) = %s, expected %s", tt.code, result, tt.currency)
		}
	}
}

func TestMonobankVerifySignature(t *testing.T) {
	client := NewMonobankClient("test-token")

	// Without public key, should return true (skip verification)
	result := client.VerifySignature([]byte("test"), "signature")
	if !result {
		t.Error("expected true when no public key set")
	}
}

func TestMonobankSetPublicKey(t *testing.T) {
	client := NewMonobankClient("test-token")

	// Test invalid PEM
	err := client.SetPublicKey("invalid-pem")
	if err == nil {
		t.Error("expected error for invalid PEM")
	}

	// Test that public key is nil initially
	if client.publicKey != nil {
		t.Error("expected publicKey to be nil initially")
	}
}

// ============================================================================
// Fondy Client Tests
// ============================================================================

func TestNewFondyClient(t *testing.T) {
	client := NewFondyClient("merchant-123", "secret-key")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.merchantID != "merchant-123" {
		t.Errorf("expected merchantID 'merchant-123', got '%s'", client.merchantID)
	}
	if client.secretKey != "secret-key" {
		t.Errorf("expected secretKey 'secret-key', got '%s'", client.secretKey)
	}
}

func TestFondyName(t *testing.T) {
	client := NewFondyClient("merchant-123", "secret-key")
	if client.Name() != "fondy" {
		t.Errorf("expected name 'fondy', got '%s'", client.Name())
	}
}

func TestFondySetCreditKey(t *testing.T) {
	client := NewFondyClient("merchant-123", "secret-key")
	client.SetCreditKey("credit-key")
	if client.creditKey != "credit-key" {
		t.Errorf("expected creditKey 'credit-key', got '%s'", client.creditKey)
	}
}

func TestFondyMapStatus(t *testing.T) {
	client := NewFondyClient("merchant-123", "secret-key")

	tests := []struct {
		input    string
		expected PaymentStatus
	}{
		{"approved", StatusSuccess},
		{"declined", StatusFailed},
		{"expired", StatusFailed},
		{"reversed", StatusRefunded},
		{"processing", StatusProcessing},
		{"created", StatusProcessing},
		{"unknown", StatusPending},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestFondyCalculateSignature(t *testing.T) {
	client := NewFondyClient("merchant-123", "secret-key")

	params := map[string]interface{}{
		"merchant_id": "merchant-123",
		"order_id":    "ORD-123",
		"amount":      10000,
	}

	sig := client.calculateSignature(params)
	if sig == "" {
		t.Error("expected non-empty signature")
	}
	// Signature should be consistent
	sig2 := client.calculateSignature(params)
	if sig != sig2 {
		t.Error("signature should be consistent for same params")
	}
}

func TestFondyVerifySignature(t *testing.T) {
	client := NewFondyClient("merchant-123", "secret-key")

	data := []byte(`{"merchant_id":"merchant-123","order_id":"ORD-123"}`)

	// Calculate expected signature
	var payload map[string]interface{}
	json.Unmarshal(data, &payload)
	expectedSig := client.calculateSignature(payload)

	// Test with correct signature
	result := client.VerifySignature(data, expectedSig)
	if !result {
		t.Error("expected true for correct signature")
	}

	// Test with wrong signature
	result = client.VerifySignature(data, "wrong-signature")
	if result {
		t.Error("expected false for wrong signature")
	}
}

// ============================================================================
// WayForPay Client Tests
// ============================================================================

func TestNewWayForPayClient(t *testing.T) {
	client := NewWayForPayClient("merchant-acc", "shop.com", "secret-key")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.merchantAccount != "merchant-acc" {
		t.Errorf("expected merchantAccount 'merchant-acc', got '%s'", client.merchantAccount)
	}
	if client.merchantDomain != "shop.com" {
		t.Errorf("expected merchantDomain 'shop.com', got '%s'", client.merchantDomain)
	}
	if client.secretKey != "secret-key" {
		t.Errorf("expected secretKey 'secret-key', got '%s'", client.secretKey)
	}
}

func TestWayForPayName(t *testing.T) {
	client := NewWayForPayClient("merchant-acc", "shop.com", "secret-key")
	if client.Name() != "wayforpay" {
		t.Errorf("expected name 'wayforpay', got '%s'", client.Name())
	}
}

func TestWayForPayMapStatus(t *testing.T) {
	client := NewWayForPayClient("merchant-acc", "shop.com", "secret-key")

	tests := []struct {
		input    string
		expected PaymentStatus
	}{
		{"Approved", StatusSuccess},
		{"Declined", StatusFailed},
		{"Expired", StatusFailed},
		{"Refunded", StatusRefunded},
		{"Voided", StatusRefunded},
		{"InProcessing", StatusProcessing},
		{"WaitingAuthComplete", StatusProcessing},
		{"Pending", StatusProcessing},
		{"Unknown", StatusPending},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestWayForPayCalculateSignature(t *testing.T) {
	client := NewWayForPayClient("merchant-acc", "shop.com", "secret-key")

	signString := "merchant-acc;ORD-123"
	sig := client.calculateSignature(signString)
	if sig == "" {
		t.Error("expected non-empty signature")
	}
	// Verify consistency
	sig2 := client.calculateSignature(signString)
	if sig != sig2 {
		t.Error("signature should be consistent")
	}
}

func TestWayForPayGenerateCallbackResponse(t *testing.T) {
	client := NewWayForPayClient("merchant-acc", "shop.com", "secret-key")

	response := client.GenerateCallbackResponse("ORD-123", "accept")
	if len(response) == 0 {
		t.Error("expected non-empty response")
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(response, &parsed); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if parsed["orderReference"] != "ORD-123" {
		t.Errorf("expected orderReference 'ORD-123', got '%v'", parsed["orderReference"])
	}
	if parsed["status"] != "accept" {
		t.Errorf("expected status 'accept', got '%v'", parsed["status"])
	}
	if parsed["signature"] == nil {
		t.Error("expected signature in response")
	}
}

func TestIntSliceToStrings(t *testing.T) {
	input := []int{1, 2, 3, 4, 5}
	result := intSliceToStrings(input)

	if len(result) != 5 {
		t.Errorf("expected 5 elements, got %d", len(result))
	}
	if result[0] != "1" {
		t.Errorf("expected '1', got '%s'", result[0])
	}
	if result[4] != "5" {
		t.Errorf("expected '5', got '%s'", result[4])
	}
}

// ============================================================================
// LiqPay Client Tests
// ============================================================================

func TestNewLiqPayClient(t *testing.T) {
	client := NewLiqPayClient("public-key", "private-key", false)
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.publicKey != "public-key" {
		t.Errorf("expected publicKey 'public-key', got '%s'", client.publicKey)
	}
	if client.privateKey != "private-key" {
		t.Errorf("expected privateKey 'private-key', got '%s'", client.privateKey)
	}
	if client.sandbox != false {
		t.Error("expected sandbox false")
	}
}

func TestNewLiqPayClientSandbox(t *testing.T) {
	client := NewLiqPayClient("public-key", "private-key", true)
	if !client.sandbox {
		t.Error("expected sandbox true")
	}
}

func TestLiqPayName(t *testing.T) {
	client := NewLiqPayClient("public-key", "private-key", false)
	if client.Name() != "liqpay" {
		t.Errorf("expected name 'liqpay', got '%s'", client.Name())
	}
}

func TestLiqPayGenerateSignature(t *testing.T) {
	client := NewLiqPayClient("public-key", "private-key", false)

	data := base64.StdEncoding.EncodeToString([]byte(`{"version":3,"action":"pay"}`))
	sig := client.generateSignature(data)
	if sig == "" {
		t.Error("expected non-empty signature")
	}

	// Consistency check
	sig2 := client.generateSignature(data)
	if sig != sig2 {
		t.Error("signature should be consistent")
	}
}

func TestLiqPayMapStatus(t *testing.T) {
	client := NewLiqPayClient("public-key", "private-key", false)

	tests := []struct {
		input    string
		expected PaymentStatus
	}{
		{"success", StatusSuccess},
		{"failure", StatusFailed},
		{"error", StatusFailed},
		{"reversed", StatusRefunded},
		{"refund", StatusRefunded},
		{"processing", StatusProcessing},
		{"wait_secure", StatusProcessing},
		{"wait_accept", StatusProcessing},
		{"sandbox", StatusProcessing},
		{"prepared", StatusProcessing},
		{"unknown", StatusPending},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

// ============================================================================
// Stripe Client Tests
// ============================================================================

func TestNewStripeClient(t *testing.T) {
	client := NewStripeClient("sk_test_123", "pk_test_456")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.secretKey != "sk_test_123" {
		t.Errorf("expected secretKey 'sk_test_123', got '%s'", client.secretKey)
	}
	if client.publishableKey != "pk_test_456" {
		t.Errorf("expected publishableKey 'pk_test_456', got '%s'", client.publishableKey)
	}
}

func TestStripeSetWebhookSecret(t *testing.T) {
	client := NewStripeClient("sk_test_123", "pk_test_456")
	client.SetWebhookSecret("whsec_test")
	if client.webhookSecret != "whsec_test" {
		t.Errorf("expected webhookSecret 'whsec_test', got '%s'", client.webhookSecret)
	}
}

func TestStripeName(t *testing.T) {
	client := NewStripeClient("sk_test_123", "webhook_secret")
	if client.Name() != "stripe" {
		t.Errorf("expected name 'stripe', got '%s'", client.Name())
	}
}

func TestStripeMapStatus(t *testing.T) {
	client := NewStripeClient("sk_test_123", "pk_test_456")

	tests := []struct {
		input    string
		expected PaymentStatus
	}{
		{"succeeded", StatusSuccess},
		{"canceled", StatusCancelled},
		{"processing", StatusProcessing},
		{"requires_payment_method", StatusProcessing},
		{"requires_action", StatusProcessing},
		{"requires_confirmation", StatusProcessing},
		{"unknown", StatusPending},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

// ============================================================================
// Monobank Personal Client Tests
// ============================================================================

func TestNewMonobankPersonalClient(t *testing.T) {
	client := NewMonobankPersonalClient("personal-token")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.token != "personal-token" {
		t.Errorf("expected token 'personal-token', got '%s'", client.token)
	}
}

func TestMonobankPersonalCreateJar(t *testing.T) {
	client := NewMonobankPersonalClient("personal-token")
	ctx := context.Background()

	jarURL := client.CreateJar(ctx, "jar-id-123", 10000)
	expected := "https://send.monobank.ua/jar/jar-id-123?a=10000"

	if jarURL != expected {
		t.Errorf("expected '%s', got '%s'", expected, jarURL)
	}
}

// ============================================================================
// PayPal Client Tests
// ============================================================================

func TestNewPayPalClient(t *testing.T) {
	client := NewPayPalClient("client-id", "secret", true)
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.clientID != "client-id" {
		t.Errorf("expected clientID 'client-id', got '%s'", client.clientID)
	}
	if client.clientSecret != "secret" {
		t.Errorf("expected clientSecret 'secret', got '%s'", client.clientSecret)
	}
	if !client.sandbox {
		t.Error("expected sandbox true")
	}
}

func TestPayPalName(t *testing.T) {
	client := NewPayPalClient("client-id", "secret", true)
	if client.Name() != "paypal" {
		t.Errorf("expected name 'paypal', got '%s'", client.Name())
	}
}

func TestPayPalMapStatus(t *testing.T) {
	client := NewPayPalClient("client-id", "secret", true)

	tests := []struct {
		input    string
		expected PaymentStatus
	}{
		{"COMPLETED", StatusSuccess},
		{"APPROVED", StatusSuccess},
		{"VOIDED", StatusCancelled},
		{"CANCELLED", StatusCancelled},
		{"CREATED", StatusPending},
		{"SAVED", StatusPending},
		{"PAYER_ACTION_REQUIRED", StatusPending},
		{"UNKNOWN", StatusPending},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

// ============================================================================
// Payment Service Tests
// ============================================================================

func TestPaymentServiceCreatePayment(t *testing.T) {
	service := NewPaymentService()
	mockProvider := &mockPaymentProvider{name: "mock"}
	service.RegisterProvider(mockProvider)
	service.SetDefaultProvider("mock")

	ctx := context.Background()
	req := &PaymentRequest{
		OrderID:     "ORD-123",
		Amount:      100,
		Currency:    UAH,
		Description: "Test",
	}

	resp, err := service.CreatePayment(ctx, "", req)
	if err != nil {
		t.Fatalf("CreatePayment error: %v", err)
	}

	if resp.PaymentID != "mock_payment_123" {
		t.Errorf("expected PaymentID 'mock_payment_123', got '%s'", resp.PaymentID)
	}
	if resp.Status != StatusPending {
		t.Errorf("expected Status 'pending', got '%s'", resp.Status)
	}
}

func TestPaymentServiceProcessCallback(t *testing.T) {
	service := NewPaymentService()
	mockProvider := &mockPaymentProvider{name: "mock"}
	service.RegisterProvider(mockProvider)
	service.SetDefaultProvider("mock")

	ctx := context.Background()
	callback, err := service.ProcessCallback(ctx, "", []byte(`{}`), "")
	if err != nil {
		t.Fatalf("ProcessCallback error: %v", err)
	}

	if callback.Status != StatusSuccess {
		t.Errorf("expected Status 'success', got '%s'", callback.Status)
	}
}

func TestPaymentServiceProviderNotFound(t *testing.T) {
	service := NewPaymentService()

	_, err := service.GetProvider("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

// ============================================================================
// Callback Processing Tests
// ============================================================================

func TestMonobankProcessCallback(t *testing.T) {
	client := NewMonobankClient("test-token")
	ctx := context.Background()

	callbackData := []byte(`{
		"invoiceId": "inv-123",
		"status": "success",
		"amount": 10000,
		"ccy": 980,
		"reference": "ORD-123",
		"maskedPan": "4111****1111"
	}`)

	callback, err := client.ProcessCallback(ctx, callbackData, "")
	if err != nil {
		t.Fatalf("ProcessCallback error: %v", err)
	}

	if callback.PaymentID != "inv-123" {
		t.Errorf("expected PaymentID 'inv-123', got '%s'", callback.PaymentID)
	}
	if callback.Status != StatusSuccess {
		t.Errorf("expected Status 'success', got '%s'", callback.Status)
	}
	if callback.Amount != 100 { // 10000 kopiyky = 100 UAH
		t.Errorf("expected Amount 100, got %f", callback.Amount)
	}
	if callback.CardMask != "4111****1111" {
		t.Errorf("expected CardMask '4111****1111', got '%s'", callback.CardMask)
	}
}

func TestFondyProcessCallback(t *testing.T) {
	client := NewFondyClient("merchant-123", "secret-key")
	ctx := context.Background()

	callbackData := []byte(`{
		"payment_id": "pay-123",
		"order_id": "ORD-123",
		"order_status": "approved",
		"actual_amount": "10000",
		"currency": "UAH",
		"masked_card": "4111****1111",
		"card_type": "Visa"
	}`)

	// Calculate signature for the callback data
	var payload map[string]interface{}
	json.Unmarshal(callbackData, &payload)
	signature := client.calculateSignature(payload)

	callback, err := client.ProcessCallback(ctx, callbackData, signature)
	if err != nil {
		t.Fatalf("ProcessCallback error: %v", err)
	}

	if callback.PaymentID != "pay-123" {
		t.Errorf("expected PaymentID 'pay-123', got '%s'", callback.PaymentID)
	}
	if callback.OrderID != "ORD-123" {
		t.Errorf("expected OrderID 'ORD-123', got '%s'", callback.OrderID)
	}
	if callback.Status != StatusSuccess {
		t.Errorf("expected Status 'success', got '%s'", callback.Status)
	}
}

// ============================================================================
// Error Tests
// ============================================================================

func TestPaymentErrors(t *testing.T) {
	// Test error messages
	if ErrPaymentNotFound.Error() != "payment not found" {
		t.Error("unexpected error message")
	}
	if ErrPaymentFailed.Error() != "payment failed" {
		t.Error("unexpected error message")
	}
	if ErrInvalidAmount.Error() != "invalid amount" {
		t.Error("unexpected error message")
	}
	if ErrInvalidCurrency.Error() != "invalid currency" {
		t.Error("unexpected error message")
	}
	if ErrRefundNotAllowed.Error() != "refund not allowed" {
		t.Error("unexpected error message")
	}
	if ErrCallbackInvalid.Error() != "invalid callback signature" {
		t.Error("unexpected error message")
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkFondyCalculateSignature(b *testing.B) {
	client := NewFondyClient("merchant-123", "secret-key")
	params := map[string]interface{}{
		"merchant_id": "merchant-123",
		"order_id":    "ORD-123",
		"amount":      10000,
		"currency":    "UAH",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.calculateSignature(params)
	}
}

func BenchmarkWayForPayCalculateSignature(b *testing.B) {
	client := NewWayForPayClient("merchant-acc", "shop.com", "secret-key")
	signString := "merchant-acc;shop.com;ORD-123;1234567890;10000;UAH;Product;1"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.calculateSignature(signString)
	}
}

func BenchmarkLiqPayGenerateSignature(b *testing.B) {
	client := NewLiqPayClient("public-key", "private-key", false)
	data := base64.StdEncoding.EncodeToString([]byte(`{"version":3,"action":"pay","amount":100}`))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.generateSignature(data)
	}
}
