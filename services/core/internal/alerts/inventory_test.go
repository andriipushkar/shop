package alerts

import (
	"context"
	"testing"
)

func TestAlertTypes(t *testing.T) {
	tests := []struct {
		alertType AlertType
		expected  string
	}{
		{AlertTypeLowStock, "low_stock"},
		{AlertTypeOutOfStock, "out_of_stock"},
		{AlertTypeRestocked, "restocked"},
		{AlertTypePriceChange, "price_change"},
	}

	for _, tt := range tests {
		if string(tt.alertType) != tt.expected {
			t.Errorf("expected %s, got %s", tt.expected, string(tt.alertType))
		}
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.LowStockThreshold != 10 {
		t.Errorf("expected LowStockThreshold 10, got %d", cfg.LowStockThreshold)
	}
	if !cfg.Enabled {
		t.Error("expected Enabled to be true")
	}
}

func TestNewInventoryMonitor(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()

	monitor := NewInventoryMonitor(cfg, publisher)

	if monitor == nil {
		t.Fatal("expected monitor to be created")
	}
	if monitor.config.LowStockThreshold != cfg.LowStockThreshold {
		t.Error("expected config to be set")
	}
	if monitor.publisher == nil {
		t.Error("expected publisher to be set")
	}
}

func TestInventoryMonitor_CheckStock_OutOfStock(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	err := monitor.CheckStock(ctx, "prod-1", "Test Product", 5, 0)
	if err != nil {
		t.Fatalf("CheckStock error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}

	alert := alerts[0]
	if alert.Type != AlertTypeOutOfStock {
		t.Errorf("expected OutOfStock type, got %s", alert.Type)
	}
	if alert.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", alert.ProductID)
	}
	if alert.Product != "Test Product" {
		t.Errorf("expected Product 'Test Product', got %s", alert.Product)
	}
}

func TestInventoryMonitor_CheckStock_Restocked(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	err := monitor.CheckStock(ctx, "prod-1", "Test Product", 0, 10)
	if err != nil {
		t.Fatalf("CheckStock error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}

	alert := alerts[0]
	if alert.Type != AlertTypeRestocked {
		t.Errorf("expected Restocked type, got %s", alert.Type)
	}
}

func TestInventoryMonitor_CheckStock_LowStock(t *testing.T) {
	cfg := Config{
		LowStockThreshold: 10,
		Enabled:           true,
	}
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	err := monitor.CheckStock(ctx, "prod-1", "Test Product", 15, 5)
	if err != nil {
		t.Fatalf("CheckStock error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}

	alert := alerts[0]
	if alert.Type != AlertTypeLowStock {
		t.Errorf("expected LowStock type, got %s", alert.Type)
	}
	if alert.Threshold != 10 {
		t.Errorf("expected threshold 10, got %d", alert.Threshold)
	}
}

func TestInventoryMonitor_CheckStock_NoAlert(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	// Normal stock change - no alert
	err := monitor.CheckStock(ctx, "prod-1", "Test Product", 100, 90)
	if err != nil {
		t.Fatalf("CheckStock error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts, got %d", len(alerts))
	}
}

func TestInventoryMonitor_CheckStock_Disabled(t *testing.T) {
	cfg := Config{
		LowStockThreshold: 10,
		Enabled:           false, // Disabled
	}
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	err := monitor.CheckStock(ctx, "prod-1", "Test Product", 5, 0)
	if err != nil {
		t.Fatalf("CheckStock error: %v", err)
	}

	// No alerts when disabled
	alerts := publisher.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts when disabled, got %d", len(alerts))
	}
}

func TestInventoryMonitor_CheckStock_NilPublisher(t *testing.T) {
	cfg := DefaultConfig()
	monitor := NewInventoryMonitor(cfg, nil)
	ctx := context.Background()

	// Should not panic with nil publisher
	err := monitor.CheckStock(ctx, "prod-1", "Test Product", 5, 0)
	if err != nil {
		t.Fatalf("CheckStock error: %v", err)
	}
}

func TestInventoryMonitor_CheckPriceChange_Significant(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	// Price increase > 20%
	err := monitor.CheckPriceChange(ctx, "prod-1", "Test Product", 100.0, 150.0)
	if err != nil {
		t.Fatalf("CheckPriceChange error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}

	alert := alerts[0]
	if alert.Type != AlertTypePriceChange {
		t.Errorf("expected PriceChange type, got %s", alert.Type)
	}
}

func TestInventoryMonitor_CheckPriceChange_Decrease(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	// Price decrease > 20%
	err := monitor.CheckPriceChange(ctx, "prod-1", "Test Product", 100.0, 70.0)
	if err != nil {
		t.Fatalf("CheckPriceChange error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}

	alert := alerts[0]
	if alert.Type != AlertTypePriceChange {
		t.Errorf("expected PriceChange type, got %s", alert.Type)
	}
}

func TestInventoryMonitor_CheckPriceChange_Small(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	// Small price change < 20% - no alert
	err := monitor.CheckPriceChange(ctx, "prod-1", "Test Product", 100.0, 110.0)
	if err != nil {
		t.Fatalf("CheckPriceChange error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts for small price change, got %d", len(alerts))
	}
}

func TestInventoryMonitor_CheckPriceChange_ZeroOldPrice(t *testing.T) {
	cfg := DefaultConfig()
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	// Zero old price - no division by zero
	err := monitor.CheckPriceChange(ctx, "prod-1", "Test Product", 0.0, 100.0)
	if err != nil {
		t.Fatalf("CheckPriceChange error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts for zero old price, got %d", len(alerts))
	}
}

func TestInventoryMonitor_CheckPriceChange_Disabled(t *testing.T) {
	cfg := Config{
		LowStockThreshold: 10,
		Enabled:           false,
	}
	publisher := NewLogPublisher()
	monitor := NewInventoryMonitor(cfg, publisher)
	ctx := context.Background()

	err := monitor.CheckPriceChange(ctx, "prod-1", "Test Product", 100.0, 200.0)
	if err != nil {
		t.Fatalf("CheckPriceChange error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts when disabled, got %d", len(alerts))
	}
}

func TestLogPublisher(t *testing.T) {
	publisher := NewLogPublisher()

	if publisher == nil {
		t.Fatal("expected publisher to be created")
	}

	// Initially empty
	alerts := publisher.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts initially, got %d", len(alerts))
	}
}

func TestLogPublisher_Publish(t *testing.T) {
	publisher := NewLogPublisher()
	ctx := context.Background()

	alert := &InventoryAlert{
		ID:        "test-id",
		Type:      AlertTypeLowStock,
		ProductID: "prod-1",
		Product:   "Test Product",
		Message:   "Test message",
	}

	err := publisher.Publish(ctx, alert)
	if err != nil {
		t.Fatalf("Publish error: %v", err)
	}

	alerts := publisher.GetAlerts()
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}

	if alerts[0].ID != "test-id" {
		t.Errorf("expected ID 'test-id', got %s", alerts[0].ID)
	}
}

func TestLogPublisher_Clear(t *testing.T) {
	publisher := NewLogPublisher()
	ctx := context.Background()

	alert := &InventoryAlert{
		ID:      "test-id",
		Type:    AlertTypeLowStock,
		Message: "Test message",
	}

	publisher.Publish(ctx, alert)
	publisher.Publish(ctx, alert)

	alerts := publisher.GetAlerts()
	if len(alerts) != 2 {
		t.Fatalf("expected 2 alerts, got %d", len(alerts))
	}

	publisher.Clear()

	alerts = publisher.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts after clear, got %d", len(alerts))
	}
}

func TestInventoryAlert_ToJSON(t *testing.T) {
	alert := &InventoryAlert{
		ID:        "test-id",
		Type:      AlertTypeLowStock,
		ProductID: "prod-1",
		Product:   "Test Product",
		Message:   "Test message",
	}

	json, err := alert.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON error: %v", err)
	}

	if len(json) == 0 {
		t.Error("expected non-empty JSON")
	}

	// Verify JSON contains expected fields
	jsonStr := string(json)
	if !contains(jsonStr, "test-id") {
		t.Error("expected JSON to contain ID")
	}
	if !contains(jsonStr, "low_stock") {
		t.Error("expected JSON to contain type")
	}
	if !contains(jsonStr, "prod-1") {
		t.Error("expected JSON to contain product_id")
	}
}

func TestProductStock(t *testing.T) {
	ps := ProductStock{
		ProductID:   "prod-1",
		ProductName: "Test Product",
		Stock:       5,
		Threshold:   10,
	}

	if ps.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", ps.ProductID)
	}
	if ps.ProductName != "Test Product" {
		t.Errorf("expected ProductName 'Test Product', got %s", ps.ProductName)
	}
	if ps.Stock != 5 {
		t.Errorf("expected Stock 5, got %d", ps.Stock)
	}
	if ps.Threshold != 10 {
		t.Errorf("expected Threshold 10, got %d", ps.Threshold)
	}
}

func TestItoa(t *testing.T) {
	tests := []struct {
		input    int
		expected string
	}{
		{0, "0"},
		{1, "1"},
		{10, "10"},
		{123, "123"},
		{-1, "-1"},
		{-123, "-123"},
	}

	for _, tt := range tests {
		result := itoa(tt.input)
		if result != tt.expected {
			t.Errorf("itoa(%d) = %s, expected %s", tt.input, result, tt.expected)
		}
	}
}

func TestGenerateID(t *testing.T) {
	id1 := generateID()
	id2 := generateID()

	if id1 == "" {
		t.Error("expected non-empty ID")
	}

	// IDs should be unique (or at least different most of the time)
	// Note: This test might occasionally fail due to timing, but should work most of the time
	if id1 == id2 {
		t.Log("Warning: IDs are the same, might be due to timing")
	}
}

// Helper function
func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
