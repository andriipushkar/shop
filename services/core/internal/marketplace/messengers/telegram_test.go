package messengers

import (
	"testing"

	"core/internal/marketplace"
)

func TestNewTelegramShopClient(t *testing.T) {
	client := NewTelegramShopClient()

	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestTelegramShopClient_Type(t *testing.T) {
	client := NewTelegramShopClient()
	marketType := client.Type()

	if marketType != "telegram" {
		t.Errorf("expected type 'telegram', got %s", marketType)
	}
}

func TestTelegramShopClient_Configure(t *testing.T) {
	client := NewTelegramShopClient()

	config := &marketplace.Config{
		AccessToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
		ShopID:      "@test_channel",
	}

	err := client.Configure(config)
	if err != nil {
		t.Fatalf("Configure error: %v", err)
	}

	if client.config == nil {
		t.Error("expected config to be set")
	}
	if client.botToken != config.AccessToken {
		t.Errorf("expected botToken '%s', got %s", config.AccessToken, client.botToken)
	}
}

func TestTelegramShopClient_IsConfigured(t *testing.T) {
	client := NewTelegramShopClient()

	// Not configured
	if client.IsConfigured() {
		t.Error("expected IsConfigured() to return false before configuration")
	}

	// With empty config
	client.Configure(&marketplace.Config{})
	if client.IsConfigured() {
		t.Error("expected IsConfigured() to return false with empty config")
	}

	// Fully configured
	client.Configure(&marketplace.Config{
		AccessToken: "123456:ABC-DEF1234",
	})
	if !client.IsConfigured() {
		t.Error("expected IsConfigured() to return true")
	}
}

func TestTelegramShopClient_ExportProducts_Empty(t *testing.T) {
	client := NewTelegramShopClient()
	client.Configure(&marketplace.Config{
		AccessToken: "test-token",
		ShopID:      "@test_channel",
	})

	products := []*marketplace.Product{}

	result, err := client.ExportProducts(nil, products)
	if err != nil {
		t.Fatalf("ExportProducts error: %v", err)
	}

	if result.TotalItems != 0 {
		t.Errorf("expected TotalItems 0, got %d", result.TotalItems)
	}
	if result.Direction != marketplace.SyncExport {
		t.Errorf("expected Direction SyncExport, got %s", result.Direction)
	}
	if result.Marketplace != "telegram" {
		t.Errorf("expected Marketplace 'telegram', got %s", result.Marketplace)
	}
}

func TestEscapeMarkdown(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "Hello World"},
		{"Price: $10", "Price: $10"},
		{"Test_underscore", "Test\\_underscore"},
		{"*bold*", "\\*bold\\*"},
		{"[link](url)", "\\[link\\]\\(url\\)"},
		{"~strike~", "\\~strike\\~"},
		{"`code`", "\\`code\\`"},
	}

	for _, tt := range tests {
		result := escapeMarkdown(tt.input)
		if result != tt.expected {
			t.Errorf("escapeMarkdown(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
	}{
		{"Hello", 10},
		{"Hello World", 5},
		{"Short", 100},
		{"", 10},
		{"Test", 4},
		{"Testing", 4},
	}

	for _, tt := range tests {
		result := truncate(tt.input, tt.maxLen)
		// Just verify it doesn't panic and respects limits
		if len(result) > tt.maxLen+3 && tt.maxLen < len(tt.input) {
			t.Errorf("truncate(%q, %d) = %q, exceeds max length", tt.input, tt.maxLen, result)
		}
	}
}
