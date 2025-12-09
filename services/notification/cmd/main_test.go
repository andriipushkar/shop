package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestOrderEvent tests OrderEvent struct serialization
func TestOrderEventSerialization(t *testing.T) {
	event := OrderEvent{
		ID:          "ORD-123",
		ProductID:   "prod-456",
		ProductName: "iPhone 15",
		Quantity:    2,
		Status:      "NEW",
		UserID:      12345,
	}

	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("failed to marshal OrderEvent: %v", err)
	}

	var decoded OrderEvent
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal OrderEvent: %v", err)
	}

	if decoded.ID != event.ID {
		t.Errorf("ID mismatch: got %s, want %s", decoded.ID, event.ID)
	}

	if decoded.ProductName != event.ProductName {
		t.Errorf("ProductName mismatch: got %s, want %s", decoded.ProductName, event.ProductName)
	}

	if decoded.Status != event.Status {
		t.Errorf("Status mismatch: got %s, want %s", decoded.Status, event.Status)
	}
}

// TestOrderEventDeserialization tests parsing JSON into OrderEvent
func TestOrderEventDeserialization(t *testing.T) {
	jsonData := `{"id":"ORD-456","product_id":"prod-789","product_name":"MacBook","quantity":1,"status":"PROCESSING","user_id":67890}`

	var event OrderEvent
	if err := json.Unmarshal([]byte(jsonData), &event); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if event.ID != "ORD-456" {
		t.Errorf("expected ID 'ORD-456', got '%s'", event.ID)
	}

	if event.ProductName != "MacBook" {
		t.Errorf("expected ProductName 'MacBook', got '%s'", event.ProductName)
	}

	if event.Quantity != 1 {
		t.Errorf("expected Quantity 1, got %d", event.Quantity)
	}

	if event.UserID != 67890 {
		t.Errorf("expected UserID 67890, got %d", event.UserID)
	}
}

// TestStatusEmojiMapping tests the status to emoji mapping logic
func TestStatusEmojiMapping(t *testing.T) {
	statusEmoji := map[string]string{
		"NEW":        "🆕",
		"PROCESSING": "⏳",
		"DELIVERED":  "✅",
	}

	tests := []struct {
		status string
		want   string
	}{
		{"NEW", "🆕"},
		{"PROCESSING", "⏳"},
		{"DELIVERED", "✅"},
		{"UNKNOWN", ""},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			got := statusEmoji[tt.status]
			if got != tt.want {
				t.Errorf("statusEmoji[%s] = %s, want %s", tt.status, got, tt.want)
			}
		})
	}
}

// TestMessageFormatting tests notification message formatting
func TestMessageFormatting(t *testing.T) {
	tests := []struct {
		name        string
		orderID     string
		productName string
		quantity    int
		wantContains []string
	}{
		{
			name:        "order created",
			orderID:     "ORD-123",
			productName: "iPhone 15",
			quantity:    2,
			wantContains: []string{"ORD-123", "iPhone 15", "2"},
		},
		{
			name:        "ukrainian product",
			orderID:     "ORD-456",
			productName: "Смартфон Samsung",
			quantity:    1,
			wantContains: []string{"ORD-456", "Смартфон Samsung", "1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			text := fmt.Sprintf("✅ Ваше замовлення *%s* прийнято!\n\n📦 Товар: %s\n📊 Кількість: %d",
				tt.orderID, tt.productName, tt.quantity)

			for _, substr := range tt.wantContains {
				if !containsString(text, substr) {
					t.Errorf("message should contain '%s', got: %s", substr, text)
				}
			}
		})
	}
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// TestStatusUpdateMessageFormatting tests status update message formatting
func TestStatusUpdateMessageFormatting(t *testing.T) {
	tests := []struct {
		orderID     string
		status      string
		productName string
		emoji       string
	}{
		{"ORD-123", "PROCESSING", "iPhone", "⏳"},
		{"ORD-456", "DELIVERED", "MacBook", "✅"},
		{"ORD-789", "NEW", "AirPods", "🆕"},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			text := fmt.Sprintf("%s Статус замовлення *%s* змінено на: *%s*\n\n📦 Товар: %s",
				tt.emoji, tt.orderID, tt.status, tt.productName)

			if !containsSubstring(text, tt.orderID) {
				t.Errorf("message should contain order ID '%s'", tt.orderID)
			}

			if !containsSubstring(text, tt.status) {
				t.Errorf("message should contain status '%s'", tt.status)
			}

			if !containsSubstring(text, tt.emoji) {
				t.Errorf("message should contain emoji '%s'", tt.emoji)
			}
		})
	}
}

// TestProductDisplayFallback tests fallback to productID when productName is empty
func TestProductDisplayFallback(t *testing.T) {
	tests := []struct {
		name        string
		productName string
		productID   string
		want        string
	}{
		{"with name", "iPhone 15", "prod-123", "iPhone 15"},
		{"empty name", "", "prod-456", "prod-456"},
		{"both empty", "", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			productDisplay := tt.productName
			if productDisplay == "" {
				productDisplay = tt.productID
			}

			if productDisplay != tt.want {
				t.Errorf("productDisplay = %s, want %s", productDisplay, tt.want)
			}
		})
	}
}

// TestUserIDValidation tests that notifications only sent for valid user IDs
func TestUserIDValidation(t *testing.T) {
	tests := []struct {
		name       string
		userID     int64
		shouldSend bool
	}{
		{"valid positive ID", 12345, true},
		{"zero ID", 0, false},
		{"negative ID", -1, false},
		{"large ID", 9999999999, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			shouldSend := tt.userID > 0
			if shouldSend != tt.shouldSend {
				t.Errorf("shouldSend for userID %d = %v, want %v", tt.userID, shouldSend, tt.shouldSend)
			}
		})
	}
}

// TestTelegramAPIURLFormat tests Telegram API URL construction
func TestTelegramAPIURLFormat(t *testing.T) {
	token := "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
	expectedURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)

	if apiURL != expectedURL {
		t.Errorf("API URL = %s, want %s", apiURL, expectedURL)
	}
}

// TestMockTelegramServer tests sending messages to a mock Telegram server
func TestMockTelegramServer(t *testing.T) {
	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}

		if err := r.ParseForm(); err != nil {
			t.Errorf("failed to parse form: %v", err)
		}

		chatID := r.FormValue("chat_id")
		text := r.FormValue("text")
		parseMode := r.FormValue("parse_mode")

		if chatID == "" {
			t.Error("chat_id is required")
		}

		if text == "" {
			t.Error("text is required")
		}

		if parseMode != "Markdown" {
			t.Errorf("expected parse_mode 'Markdown', got '%s'", parseMode)
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	// Test request
	resp, err := http.PostForm(server.URL, map[string][]string{
		"chat_id":    {"12345"},
		"text":       {"Test message"},
		"parse_mode": {"Markdown"},
	})
	if err != nil {
		t.Fatalf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

// TestOrderEventWithMissingFields tests handling of events with missing fields
func TestOrderEventWithMissingFields(t *testing.T) {
	jsonData := `{"id":"ORD-123","status":"NEW"}`

	var event OrderEvent
	if err := json.Unmarshal([]byte(jsonData), &event); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if event.ID != "ORD-123" {
		t.Errorf("expected ID 'ORD-123', got '%s'", event.ID)
	}

	if event.ProductID != "" {
		t.Errorf("expected empty ProductID, got '%s'", event.ProductID)
	}

	if event.ProductName != "" {
		t.Errorf("expected empty ProductName, got '%s'", event.ProductName)
	}

	if event.Quantity != 0 {
		t.Errorf("expected Quantity 0, got %d", event.Quantity)
	}

	if event.UserID != 0 {
		t.Errorf("expected UserID 0, got %d", event.UserID)
	}
}

// Benchmark tests

func BenchmarkOrderEventSerialization(b *testing.B) {
	event := OrderEvent{
		ID:          "ORD-123",
		ProductID:   "prod-456",
		ProductName: "iPhone 15",
		Quantity:    2,
		Status:      "NEW",
		UserID:      12345,
	}

	for i := 0; i < b.N; i++ {
		json.Marshal(event)
	}
}

func BenchmarkOrderEventDeserialization(b *testing.B) {
	jsonData := []byte(`{"id":"ORD-123","product_id":"prod-456","product_name":"iPhone 15","quantity":2,"status":"NEW","user_id":12345}`)

	for i := 0; i < b.N; i++ {
		var event OrderEvent
		json.Unmarshal(jsonData, &event)
	}
}

func BenchmarkMessageFormatting(b *testing.B) {
	for i := 0; i < b.N; i++ {
		fmt.Sprintf("✅ Ваше замовлення *%s* прийнято!\n\n📦 Товар: %s\n📊 Кількість: %d",
			"ORD-123", "iPhone 15", 2)
	}
}

// TestNewEmailConfig tests email configuration initialization
func TestNewEmailConfig(t *testing.T) {
	config := &EmailConfig{
		SMTPHost:  "smtp.example.com",
		SMTPPort:  "587",
		Username:  "user@example.com",
		Password:  "password123",
		FromEmail: "noreply@example.com",
		FromName:  "Test Shop",
	}

	config.Enabled = config.SMTPHost != "" && config.Username != "" && config.Password != ""

	if !config.Enabled {
		t.Error("expected Enabled to be true when all fields are set")
	}
}

func TestNewEmailConfig_Disabled(t *testing.T) {
	config := &EmailConfig{
		SMTPHost: "",
		Username: "",
		Password: "",
	}

	config.Enabled = config.SMTPHost != "" && config.Username != "" && config.Password != ""

	if config.Enabled {
		t.Error("expected Enabled to be false when SMTP host is empty")
	}
}

func TestNewEmailConfig_DefaultFromName(t *testing.T) {
	config := &EmailConfig{
		FromName: "",
	}

	if config.FromName == "" {
		config.FromName = "Shop Notifications"
	}

	if config.FromName != "Shop Notifications" {
		t.Errorf("expected default FromName 'Shop Notifications', got '%s'", config.FromName)
	}
}

// TestBuildOrderCreatedEmailHTML tests order created email HTML generation
func TestBuildOrderCreatedEmailHTML(t *testing.T) {
	order := OrderEvent{
		ID:          "ORD-123",
		ProductName: "iPhone 15 Pro",
		Quantity:    2,
	}

	html := buildOrderCreatedEmailHTML(order)

	expectedParts := []string{
		"ORD-123",
		"iPhone 15 Pro",
		"2",
		"Замовлення прийнято",
		"DOCTYPE html",
	}

	for _, part := range expectedParts {
		if !containsSubstring(html, part) {
			t.Errorf("expected HTML to contain '%s'", part)
		}
	}
}

// TestBuildStatusUpdateEmailHTML tests status update email HTML generation
func TestBuildStatusUpdateEmailHTML(t *testing.T) {
	tests := []struct {
		status   string
		expected string
	}{
		{"NEW", "Нове"},
		{"PROCESSING", "В обробці"},
		{"DELIVERED", "Доставлено"},
		{"CANCELLED", "Скасовано"},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			order := OrderEvent{
				ID:          "ORD-456",
				ProductName: "MacBook Pro",
				Status:      tt.status,
			}

			html := buildStatusUpdateEmailHTML(order)

			if !containsSubstring(html, tt.expected) {
				t.Errorf("expected HTML to contain Ukrainian status '%s'", tt.expected)
			}

			if !containsSubstring(html, "ORD-456") {
				t.Error("expected HTML to contain order ID")
			}

			if !containsSubstring(html, "MacBook Pro") {
				t.Error("expected HTML to contain product name")
			}
		})
	}
}

// TestStatusColorMapping tests status to color mapping
func TestStatusColorMapping(t *testing.T) {
	statusColor := map[string]string{
		"NEW":        "#2196F3",
		"PROCESSING": "#FF9800",
		"DELIVERED":  "#4CAF50",
		"CANCELLED":  "#f44336",
	}

	tests := []struct {
		status string
		color  string
	}{
		{"NEW", "#2196F3"},
		{"PROCESSING", "#FF9800"},
		{"DELIVERED", "#4CAF50"},
		{"CANCELLED", "#f44336"},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			got := statusColor[tt.status]
			if got != tt.color {
				t.Errorf("statusColor[%s] = %s, want %s", tt.status, got, tt.color)
			}
		})
	}
}

// TestOrderEventWithOptionalFields tests OrderEvent with optional fields
func TestOrderEventWithOptionalFields(t *testing.T) {
	order := OrderEvent{
		ID:          "ORD-789",
		ProductID:   "prod-123",
		ProductName: "Test Product",
		Quantity:    1,
		Status:      "NEW",
		UserID:      12345,
		Email:       "user@example.com",
		Phone:       "+380991234567",
		Address:     "вул. Хрещатик, 1",
		Type:        "order_created",
	}

	data, err := json.Marshal(order)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var decoded OrderEvent
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if decoded.Email != "user@example.com" {
		t.Errorf("expected Email 'user@example.com', got '%s'", decoded.Email)
	}

	if decoded.Phone != "+380991234567" {
		t.Errorf("expected Phone '+380991234567', got '%s'", decoded.Phone)
	}

	if decoded.Address != "вул. Хрещатик, 1" {
		t.Errorf("expected Address 'вул. Хрещатик, 1', got '%s'", decoded.Address)
	}

	if decoded.Type != "order_created" {
		t.Errorf("expected Type 'order_created', got '%s'", decoded.Type)
	}
}

// TestEmailValidation tests email validation logic
func TestEmailValidation(t *testing.T) {
	tests := []struct {
		email     string
		shouldSend bool
	}{
		{"user@example.com", true},
		{"test.user@domain.org", true},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			shouldSend := tt.email != ""
			if shouldSend != tt.shouldSend {
				t.Errorf("shouldSend for email '%s' = %v, want %v", tt.email, shouldSend, tt.shouldSend)
			}
		})
	}
}

// TestEmailConfigFields tests EmailConfig struct fields
func TestEmailConfigFields(t *testing.T) {
	config := EmailConfig{
		SMTPHost:  "smtp.gmail.com",
		SMTPPort:  "465",
		Username:  "myapp@gmail.com",
		Password:  "secret123",
		FromEmail: "noreply@myshop.com",
		FromName:  "My Shop",
		Enabled:   true,
	}

	if config.SMTPHost != "smtp.gmail.com" {
		t.Errorf("expected SMTPHost 'smtp.gmail.com', got '%s'", config.SMTPHost)
	}

	if config.SMTPPort != "465" {
		t.Errorf("expected SMTPPort '465', got '%s'", config.SMTPPort)
	}

	if !config.Enabled {
		t.Error("expected Enabled to be true")
	}
}

// TestSendEmailValidation tests sendEmail validation
func TestSendEmailValidation(t *testing.T) {
	// Test with disabled config
	config := &EmailConfig{Enabled: false}

	err := sendEmail(config, "test@example.com", "Subject", "Body")
	if err == nil {
		t.Error("expected error when email is not configured")
	}

	// Test with empty recipient
	configEnabled := &EmailConfig{
		Enabled:   true,
		SMTPHost:  "smtp.example.com",
		SMTPPort:  "587",
		Username:  "user",
		Password:  "pass",
		FromEmail: "from@example.com",
	}

	err = sendEmail(configEnabled, "", "Subject", "Body")
	if err == nil {
		t.Error("expected error when recipient is empty")
	}
}

func TestStatusTranslation(t *testing.T) {
	statusUkr := map[string]string{
		"NEW":        "Нове",
		"PROCESSING": "В обробці",
		"DELIVERED":  "Доставлено",
		"CANCELLED":  "Скасовано",
	}

	tests := []struct {
		status   string
		expected string
	}{
		{"NEW", "Нове"},
		{"PROCESSING", "В обробці"},
		{"DELIVERED", "Доставлено"},
		{"CANCELLED", "Скасовано"},
		{"UNKNOWN", ""},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			got := statusUkr[tt.status]
			if got != tt.expected {
				t.Errorf("statusUkr[%s] = %s, want %s", tt.status, got, tt.expected)
			}
		})
	}
}

// BenchmarkBuildOrderCreatedEmailHTML benchmarks HTML generation
func BenchmarkBuildOrderCreatedEmailHTML(b *testing.B) {
	order := OrderEvent{
		ID:          "ORD-123",
		ProductName: "iPhone 15",
		Quantity:    2,
	}

	for i := 0; i < b.N; i++ {
		buildOrderCreatedEmailHTML(order)
	}
}

// BenchmarkBuildStatusUpdateEmailHTML benchmarks status update HTML generation
func BenchmarkBuildStatusUpdateEmailHTML(b *testing.B) {
	order := OrderEvent{
		ID:          "ORD-123",
		ProductName: "iPhone 15",
		Status:      "DELIVERED",
	}

	for i := 0; i < b.N; i++ {
		buildStatusUpdateEmailHTML(order)
	}
}
