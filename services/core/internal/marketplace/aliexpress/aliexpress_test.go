package aliexpress

import (
	"testing"

	"core/internal/marketplace"
)

func TestNew(t *testing.T) {
	client := New()

	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestClient_Type(t *testing.T) {
	client := New()
	marketType := client.Type()

	if marketType != "aliexpress" {
		t.Errorf("expected type 'aliexpress', got %s", marketType)
	}
}

func TestClient_Configure(t *testing.T) {
	client := New()

	config := &marketplace.Config{
		APIKey:    "test-key",
		APISecret: "test-secret",
	}

	err := client.Configure(config)
	if err != nil {
		t.Fatalf("Configure error: %v", err)
	}

	if client.config == nil {
		t.Error("expected config to be set")
	}
	if client.config.APIKey != "test-key" {
		t.Errorf("expected APIKey 'test-key', got %s", client.config.APIKey)
	}
}

func TestClient_IsConfigured(t *testing.T) {
	client := New()

	// Not configured
	if client.IsConfigured() {
		t.Error("expected IsConfigured() to return false before configuration")
	}

	// With empty config
	client.Configure(&marketplace.Config{})
	if client.IsConfigured() {
		t.Error("expected IsConfigured() to return false with empty config")
	}

	// With only API key
	client.Configure(&marketplace.Config{
		APIKey: "test-key",
	})
	if client.IsConfigured() {
		t.Error("expected IsConfigured() to return false without API secret")
	}

	// Fully configured
	client.Configure(&marketplace.Config{
		APIKey:    "test-key",
		APISecret: "test-secret",
	})
	if !client.IsConfigured() {
		t.Error("expected IsConfigured() to return true")
	}
}

func TestClient_ExportProducts_Configured(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{
		APIKey:    "test-key",
		APISecret: "test-secret",
	})

	// Empty products should work without API calls
	products := []*marketplace.Product{}

	result, err := client.ExportProducts(nil, products)
	if err != nil {
		t.Fatalf("ExportProducts error: %v", err)
	}

	if result.TotalItems != 0 {
		t.Errorf("expected TotalItems 0, got %d", result.TotalItems)
	}
	if result.Marketplace != "aliexpress" {
		t.Errorf("expected marketplace 'aliexpress', got %s", result.Marketplace)
	}
	if result.Direction != marketplace.SyncExport {
		t.Errorf("expected Direction SyncExport, got %s", result.Direction)
	}
}

func TestClient_ExportProducts_Empty(t *testing.T) {
	client := New()
	client.Configure(&marketplace.Config{
		APIKey:    "test-key",
		APISecret: "test-secret",
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
}
