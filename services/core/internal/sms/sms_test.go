package sms

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestMessage_Validation(t *testing.T) {
	tests := []struct {
		name    string
		message Message
		wantErr bool
	}{
		{
			name: "Valid message",
			message: Message{
				Phone: "+380501234567",
				Text:  "Test message",
			},
			wantErr: false,
		},
		{
			name: "Empty phone",
			message: Message{
				Phone: "",
				Text:  "Test message",
			},
			wantErr: true,
		},
		{
			name: "Empty text",
			message: Message{
				Phone: "+380501234567",
				Text:  "",
			},
			wantErr: true,
		},
		{
			name: "Invalid phone format",
			message: Message{
				Phone: "invalid",
				Text:  "Test",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateMessage(&tt.message)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestPhoneNumberNormalization(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"+380501234567", "+380501234567"},
		{"380501234567", "+380501234567"},
		{"0501234567", "+380501234567"},
		{"+38 (050) 123-45-67", "+380501234567"},
		{"050 123 45 67", "+380501234567"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := normalizePhone(tt.input)
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestSMSService_RegisterProvider(t *testing.T) {
	service := NewSMSService()

	mockProvider := &mockSMSProvider{name: "mock"}
	service.RegisterProvider(mockProvider)

	provider, err := service.GetProvider("mock")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if provider.Name() != "mock" {
		t.Errorf("Expected provider name 'mock', got %s", provider.Name())
	}
}

func TestSMSService_SetDefaultProvider(t *testing.T) {
	service := NewSMSService()

	mock1 := &mockSMSProvider{name: "provider1"}
	mock2 := &mockSMSProvider{name: "provider2"}

	service.RegisterProvider(mock1)
	service.RegisterProvider(mock2)
	service.SetDefaultProvider("provider2")

	provider, err := service.GetProvider("")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if provider.Name() != "provider2" {
		t.Errorf("Expected default provider 'provider2', got %s", provider.Name())
	}
}

func TestSMSService_Send(t *testing.T) {
	service := NewSMSService()

	mock := &mockSMSProvider{name: "mock"}
	service.RegisterProvider(mock)
	service.SetDefaultProvider("mock")

	ctx := context.Background()
	message := &Message{
		Phone: "+380501234567",
		Text:  "Test message",
	}

	// Use empty string to use default provider
	result, err := service.Send(ctx, "", message)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if result.MessageID == "" {
		t.Error("Expected message ID to be set")
	}
	if result.Status != StatusSent {
		t.Errorf("Expected status 'sent', got %s", result.Status)
	}
}

func TestSMSBalance(t *testing.T) {
	service := NewSMSService()

	mock := &mockSMSProvider{name: "mock", balance: 150.50}
	service.RegisterProvider(mock)

	ctx := context.Background()
	balance, err := mock.GetBalance(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if balance.Amount != 150.50 {
		t.Errorf("Expected balance 150.50, got %.2f", balance.Amount)
	}
}

func TestMessageStatus(t *testing.T) {
	statuses := []MessageStatus{
		StatusQueued,
		StatusSent,
		StatusDelivered,
		StatusFailed,
		StatusExpired,
		StatusRejected,
	}

	for _, status := range statuses {
		if status == "" {
			t.Error("Message status should not be empty")
		}
	}
}

func TestMessageLength(t *testing.T) {
	tests := []struct {
		text          string
		expectedParts int
	}{
		{"Short message", 1},
		{strings.Repeat("a", 160), 1},   // Exactly 160 chars
		{strings.Repeat("a", 161), 2},   // Just over
		{strings.Repeat("a", 320), 3},   // 2+ parts
		{strings.Repeat("a", 500), 4},   // Multiple parts
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			parts := calculateMessageParts(tt.text)
			if parts != tt.expectedParts {
				t.Errorf("Text length %d: expected %d parts, got %d",
					len(tt.text), tt.expectedParts, parts)
			}
		})
	}
}

func TestAlphanumericSender(t *testing.T) {
	tests := []struct {
		sender string
		valid  bool
	}{
		{"MyShop", true},
		{"Shop123", true},
		{"SHOP", true},
		{"My Shop", false},            // Space not allowed
		{"Shop@123", false},           // Special char
		{"VeryLongSenderName", false}, // Too long (>11 chars)
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.sender, func(t *testing.T) {
			valid := isValidSender(tt.sender)
			if valid != tt.valid {
				t.Errorf("Sender %q: expected valid=%v, got %v", tt.sender, tt.valid, valid)
			}
		})
	}
}

func TestSendResult(t *testing.T) {
	now := time.Now()
	result := &SendResult{
		MessageID: "msg_123",
		Status:    StatusSent,
		Phone:     "+380501234567",
		Cost:      0.50,
	}

	if result.MessageID != "msg_123" {
		t.Error("Expected message ID 'msg_123'")
	}
	if result.Status != StatusSent {
		t.Error("Expected status 'sent'")
	}
	_ = now
}

func TestDeliveryReport(t *testing.T) {
	now := time.Now()
	report := &DeliveryReport{
		MessageID:   "msg_123",
		Phone:       "+380501234567",
		Status:      StatusDelivered,
		DeliveredAt: &now,
	}

	if report.Status != StatusDelivered {
		t.Error("Expected status 'delivered'")
	}
	if report.DeliveredAt == nil {
		t.Error("Expected delivered timestamp")
	}
}

func TestBalance(t *testing.T) {
	balance := &Balance{
		Amount:   100.50,
		Currency: "UAH",
	}

	if balance.Amount != 100.50 {
		t.Errorf("Expected amount 100.50, got %.2f", balance.Amount)
	}
	if balance.Currency != "UAH" {
		t.Errorf("Expected currency 'UAH', got %s", balance.Currency)
	}
}

// Helper functions
func validateMessage(m *Message) error {
	if m.Phone == "" {
		return ErrInvalidPhone
	}
	if m.Text == "" {
		return ErrInvalidMessage
	}
	if !isValidPhone(m.Phone) {
		return ErrInvalidPhone
	}
	return nil
}

func isValidPhone(phone string) bool {
	normalized := normalizePhone(phone)
	return len(normalized) >= 10 && normalized[0] == '+'
}

func normalizePhone(phone string) string {
	// Remove all non-digit characters except +
	var result []byte
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			result = append(result, byte(c))
		}
	}

	s := string(result)
	if len(s) == 10 && s[0] == '0' {
		s = "38" + s
	}

	return "+" + s
}

func calculateMessageParts(text string) int {
	length := len(text)
	if length <= 160 {
		return 1
	}
	// For multipart, each part is ~153 chars
	return (length + 152) / 153
}

func isValidSender(sender string) bool {
	if sender == "" || len(sender) > 11 {
		return false
	}
	for _, c := range sender {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	return true
}

// Mock provider
type mockSMSProvider struct {
	name    string
	balance float64
}

func (m *mockSMSProvider) Name() string { return m.name }

func (m *mockSMSProvider) Send(ctx context.Context, msg *Message) (*SendResult, error) {
	return &SendResult{
		MessageID: "mock_msg_123",
		Status:    StatusSent,
		Phone:     msg.Phone,
	}, nil
}

func (m *mockSMSProvider) SendBulk(ctx context.Context, msg *BulkMessage) ([]SendResult, error) {
	results := make([]SendResult, len(msg.Phones))
	for i, phone := range msg.Phones {
		results[i] = SendResult{
			MessageID: "mock_bulk_" + string(rune('0'+i)),
			Status:    StatusSent,
			Phone:     phone,
		}
	}
	return results, nil
}

func (m *mockSMSProvider) GetStatus(ctx context.Context, messageID string) (*DeliveryReport, error) {
	return &DeliveryReport{
		MessageID: messageID,
		Status:    StatusDelivered,
	}, nil
}

func (m *mockSMSProvider) GetBalance(ctx context.Context) (*Balance, error) {
	return &Balance{
		Amount:   m.balance,
		Currency: "UAH",
	}, nil
}

// ============================================================================
// TurboSMS Client Tests
// ============================================================================

func TestNewTurboSMSClient(t *testing.T) {
	client := NewTurboSMSClient("test-api-key", "TestShop")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.apiKey != "test-api-key" {
		t.Errorf("expected apiKey 'test-api-key', got '%s'", client.apiKey)
	}
	if client.sender != "TestShop" {
		t.Errorf("expected sender 'TestShop', got '%s'", client.sender)
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestTurboSMSName(t *testing.T) {
	client := NewTurboSMSClient("test-api-key", "TestShop")
	if client.Name() != "turbosms" {
		t.Errorf("expected name 'turbosms', got '%s'", client.Name())
	}
}

func TestTurboSMSNormalizePhone(t *testing.T) {
	client := NewTurboSMSClient("test-api-key", "TestShop")

	tests := []struct {
		input    string
		expected string
	}{
		{"+380501234567", "380501234567"},
		{"380501234567", "380501234567"},
		{"0501234567", "380501234567"},
		{"+38 (050) 123-45-67", "380501234567"},
		{"501234567", "380501234567"}, // 9 digits
	}

	for _, tt := range tests {
		result := client.normalizePhone(tt.input)
		if result != tt.expected {
			t.Errorf("normalizePhone(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestTurboSMSMapStatus(t *testing.T) {
	client := NewTurboSMSClient("test-api-key", "TestShop")

	tests := []struct {
		input    string
		expected MessageStatus
	}{
		{"DELIVERED", StatusDelivered},
		{"DELIVRD", StatusDelivered},
		{"SENT", StatusSent},
		{"ACCEPTD", StatusSent},
		{"EXPIRED", StatusExpired},
		{"UNDELIV", StatusExpired},
		{"REJECTD", StatusRejected},
		{"FAILED", StatusFailed},
		{"UNKNOWN", StatusQueued},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestViberButtonStruct(t *testing.T) {
	button := ViberButton{
		Text: "Перейти",
		URL:  "https://shop.com/order",
	}

	if button.Text != "Перейти" {
		t.Errorf("expected Text 'Перейти', got '%s'", button.Text)
	}
	if button.URL != "https://shop.com/order" {
		t.Errorf("expected URL 'https://shop.com/order', got '%s'", button.URL)
	}
}

// ============================================================================
// AlphaSMS Client Tests
// ============================================================================

func TestNewAlphaSMSClient(t *testing.T) {
	client := NewAlphaSMSClient("test-login", "test-api-key", "TestShop")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.login != "test-login" {
		t.Errorf("expected login 'test-login', got '%s'", client.login)
	}
	if client.apiKey != "test-api-key" {
		t.Errorf("expected apiKey 'test-api-key', got '%s'", client.apiKey)
	}
	if client.sender != "TestShop" {
		t.Errorf("expected sender 'TestShop', got '%s'", client.sender)
	}
}

func TestAlphaSMSName(t *testing.T) {
	client := NewAlphaSMSClient("test-login", "test-api-key", "TestShop")
	if client.Name() != "alphasms" {
		t.Errorf("expected name 'alphasms', got '%s'", client.Name())
	}
}

func TestAlphaSMSNormalizePhone(t *testing.T) {
	client := NewAlphaSMSClient("test-login", "test-api-key", "TestShop")

	tests := []struct {
		input    string
		expected string
	}{
		{"+380501234567", "380501234567"},
		{"380501234567", "380501234567"},
		{"0501234567", "380501234567"},
	}

	for _, tt := range tests {
		result := client.normalizePhone(tt.input)
		if result != tt.expected {
			t.Errorf("normalizePhone(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestAlphaSMSMapStatus(t *testing.T) {
	client := NewAlphaSMSClient("test-login", "test-api-key", "TestShop")

	tests := []struct {
		input    string
		expected MessageStatus
	}{
		{"delivered", StatusDelivered},
		{"DELIVRD", StatusDelivered},
		{"send", StatusSent},
		{"sent", StatusSent},
		{"ACCEPTD", StatusSent},
		{"expired", StatusExpired},
		{"EXPIRED", StatusExpired},
		{"rejected", StatusRejected},
		{"REJECTD", StatusRejected},
		{"failed", StatusFailed},
		{"UNDELIV", StatusFailed},
		{"unknown", StatusQueued},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

// ============================================================================
// SMS.ua Client Tests
// ============================================================================

func TestNewSMSUAClient(t *testing.T) {
	client := NewSMSUAClient("test-api-key", "TestShop")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.apiKey != "test-api-key" {
		t.Errorf("expected apiKey 'test-api-key', got '%s'", client.apiKey)
	}
	if client.sender != "TestShop" {
		t.Errorf("expected sender 'TestShop', got '%s'", client.sender)
	}
}

func TestSMSUAName(t *testing.T) {
	client := NewSMSUAClient("test-api-key", "TestShop")
	if client.Name() != "smsua" {
		t.Errorf("expected name 'smsua', got '%s'", client.Name())
	}
}

func TestSMSUANormalizePhone(t *testing.T) {
	client := NewSMSUAClient("test-api-key", "TestShop")

	tests := []struct {
		input    string
		expected string
	}{
		{"+380501234567", "380501234567"},
		{"380501234567", "380501234567"},
		{"0501234567", "380501234567"},
	}

	for _, tt := range tests {
		result := client.normalizePhone(tt.input)
		if result != tt.expected {
			t.Errorf("normalizePhone(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestSMSUAMapStatus(t *testing.T) {
	client := NewSMSUAClient("test-api-key", "TestShop")

	tests := []struct {
		input    string
		expected MessageStatus
	}{
		{"delivered", StatusDelivered},
		{"sent", StatusSent},
		{"expired", StatusExpired},
		{"rejected", StatusRejected},
		{"failed", StatusFailed},
		{"unknown", StatusQueued},
	}

	for _, tt := range tests {
		result := client.mapStatus(tt.input)
		if result != tt.expected {
			t.Errorf("mapStatus(%s) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

// ============================================================================
// Error Tests
// ============================================================================

func TestSMSErrors(t *testing.T) {
	if ErrInvalidPhone.Error() != "invalid phone number" {
		t.Error("unexpected error message for ErrInvalidPhone")
	}
	if ErrInvalidMessage.Error() != "invalid message" {
		t.Error("unexpected error message for ErrInvalidMessage")
	}
	if ErrProviderError.Error() != "provider error" {
		t.Error("unexpected error message for ErrProviderError")
	}
	if ErrSendFailed.Error() != "SMS send failed" {
		t.Error("unexpected error message for ErrSendFailed")
	}
}

// ============================================================================
// SMS Service Additional Tests
// ============================================================================

func TestSMSServiceSendBulk(t *testing.T) {
	service := NewSMSService()

	mock := &mockSMSProvider{name: "mock"}
	service.RegisterProvider(mock)
	service.SetDefaultProvider("mock")

	ctx := context.Background()
	bulkMsg := &BulkMessage{
		Phones: []string{"+380501234567", "+380507654321"},
		Text:   "Bulk test message",
		Sender: "TestShop",
	}

	results, err := service.SendBulk(ctx, "", bulkMsg)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if len(results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(results))
	}
}

func TestSMSServiceGetStatus(t *testing.T) {
	service := NewSMSService()

	mock := &mockSMSProvider{name: "mock"}
	service.RegisterProvider(mock)
	service.SetDefaultProvider("mock")

	ctx := context.Background()
	report, err := service.GetStatus(ctx, "", "msg-123")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if report.Status != StatusDelivered {
		t.Errorf("Expected status 'delivered', got %s", report.Status)
	}
}

func TestSMSServiceGetBalance(t *testing.T) {
	service := NewSMSService()

	mock := &mockSMSProvider{name: "mock", balance: 250.75}
	service.RegisterProvider(mock)
	service.SetDefaultProvider("mock")

	ctx := context.Background()
	balance, err := service.GetBalance(ctx, "")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if balance.Amount != 250.75 {
		t.Errorf("Expected balance 250.75, got %.2f", balance.Amount)
	}
}

func TestSMSServiceProviderNotFound(t *testing.T) {
	service := NewSMSService()

	_, err := service.GetProvider("nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent provider")
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkNormalizePhone(b *testing.B) {
	phones := []string{
		"+380501234567",
		"380501234567",
		"0501234567",
		"+38 (050) 123-45-67",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, phone := range phones {
			_ = normalizePhone(phone)
		}
	}
}

func BenchmarkCalculateMessageParts(b *testing.B) {
	texts := []string{
		"Short message",
		strings.Repeat("a", 160),
		strings.Repeat("a", 320),
		strings.Repeat("a", 500),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, text := range texts {
			_ = calculateMessageParts(text)
		}
	}
}

func BenchmarkIsValidSender(b *testing.B) {
	senders := []string{
		"MyShop",
		"Shop123",
		"SHOP",
		"My Shop",
		"VeryLongSenderName",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, sender := range senders {
			_ = isValidSender(sender)
		}
	}
}
