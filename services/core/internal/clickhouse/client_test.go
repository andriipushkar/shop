package clickhouse

import (
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Host != "localhost" {
		t.Errorf("Expected Host 'localhost', got %s", cfg.Host)
	}
	if cfg.Port != 9000 {
		t.Errorf("Expected Port 9000, got %d", cfg.Port)
	}
	if cfg.Database != "shop_analytics" {
		t.Errorf("Expected Database 'shop_analytics', got %s", cfg.Database)
	}
	if cfg.Username != "default" {
		t.Errorf("Expected Username 'default', got %s", cfg.Username)
	}
	if cfg.Debug != false {
		t.Error("Expected Debug to be false")
	}
}

func TestEventStruct(t *testing.T) {
	event := &Event{
		EventID:    "evt-123",
		EventType:  "page_view",
		EventTime:  time.Now(),
		TenantID:   "tenant-1",
		UserID:     "user-456",
		SessionID:  "sess-789",
		DeviceType: "desktop",
		Browser:    "Chrome",
		OS:         "Linux",
		Country:    "UA",
		City:       "Kyiv",
		PageURL:    "/products/123",
		Referrer:   "https://google.com",
		Properties: `{"category": "electronics"}`,
	}

	if event.EventID != "evt-123" {
		t.Errorf("Expected EventID 'evt-123', got %s", event.EventID)
	}
	if event.EventType != "page_view" {
		t.Errorf("Expected EventType 'page_view', got %s", event.EventType)
	}
}

func TestOrderAnalyticsStruct(t *testing.T) {
	now := time.Now()
	order := &OrderAnalytics{
		OrderID:        "ord-123",
		OrderNumber:    "ORD-2024-001",
		TenantID:       "tenant-1",
		CustomerID:     "cust-456",
		Status:         "completed",
		PaymentMethod:  "card",
		ShippingMethod: "nova_poshta",
		Subtotal:       1000.00,
		Discount:       100.00,
		ShippingCost:   50.00,
		Tax:            180.00,
		Total:          1130.00,
		Currency:       "UAH",
		ItemsCount:     3,
		PromoCode:      "SAVE10",
		UTMSource:      "google",
		UTMMedium:      "cpc",
		UTMCampaign:    "summer_sale",
		CreatedAt:      now,
		PaidAt:         &now,
	}

	if order.OrderID != "ord-123" {
		t.Errorf("Expected OrderID 'ord-123', got %s", order.OrderID)
	}
	if order.Total != 1130.00 {
		t.Errorf("Expected Total 1130.00, got %f", order.Total)
	}
	if order.Currency != "UAH" {
		t.Errorf("Expected Currency 'UAH', got %s", order.Currency)
	}
}

func TestSalesMetricsStruct(t *testing.T) {
	metrics := &SalesMetrics{
		Period:             "2024-01",
		OrdersCount:        100,
		ItemsCount:         350,
		Revenue:            50000.00,
		AvgOrderValue:      500.00,
		UniqueCustomers:    75,
		NewCustomers:       30,
		ReturningCustomers: 45,
	}

	if metrics.OrdersCount != 100 {
		t.Errorf("Expected OrdersCount 100, got %d", metrics.OrdersCount)
	}
	if metrics.AvgOrderValue != 500.00 {
		t.Errorf("Expected AvgOrderValue 500.00, got %f", metrics.AvgOrderValue)
	}
}

func TestDailySalesStruct(t *testing.T) {
	ds := &DailySales{
		Date:          time.Now(),
		OrdersCount:   25,
		Revenue:       12500.00,
		AvgOrderValue: 500.00,
	}

	if ds.OrdersCount != 25 {
		t.Errorf("Expected OrdersCount 25, got %d", ds.OrdersCount)
	}
}

func TestTopProductStruct(t *testing.T) {
	product := &TopProduct{
		ProductID:    "prod-123",
		ProductName:  "iPhone 15",
		QuantitySold: 50,
		Revenue:      1500000.00,
		OrdersCount:  45,
	}

	if product.ProductID != "prod-123" {
		t.Errorf("Expected ProductID 'prod-123', got %s", product.ProductID)
	}
	if product.QuantitySold != 50 {
		t.Errorf("Expected QuantitySold 50, got %d", product.QuantitySold)
	}
}

func TestTopCategoryStruct(t *testing.T) {
	category := &TopCategory{
		CategoryID:   "cat-1",
		CategoryName: "Electronics",
		QuantitySold: 500,
		Revenue:      5000000.00,
		ProductCount: 50,
	}

	if category.CategoryName != "Electronics" {
		t.Errorf("Expected CategoryName 'Electronics', got %s", category.CategoryName)
	}
}

func TestCohortDataStruct(t *testing.T) {
	cohort := &CohortData{
		CohortMonth:      time.Now(),
		CustomersCount:   100,
		Month0Retention:  100.0,
		Month1Retention:  60.0,
		Month2Retention:  45.0,
		Month3Retention:  35.0,
		Month6Retention:  25.0,
		Month12Retention: 15.0,
	}

	if cohort.Month0Retention != 100.0 {
		t.Errorf("Expected Month0Retention 100.0, got %f", cohort.Month0Retention)
	}
	if cohort.Month1Retention != 60.0 {
		t.Errorf("Expected Month1Retention 60.0, got %f", cohort.Month1Retention)
	}
}

func TestFunnelStepStruct(t *testing.T) {
	step := &FunnelStep{
		Step:       "add_to_cart",
		Count:      1000,
		Conversion: 25.5,
	}

	if step.Step != "add_to_cart" {
		t.Errorf("Expected Step 'add_to_cart', got %s", step.Step)
	}
	if step.Conversion != 25.5 {
		t.Errorf("Expected Conversion 25.5, got %f", step.Conversion)
	}
}

func TestRealTimeMetricsStruct(t *testing.T) {
	metrics := &RealTimeMetrics{
		ActiveVisitors:    150,
		OrdersLast5Min:    5,
		OrdersLastHour:    50,
		RevenueLast5Min:   2500.00,
		RevenueLastHour:   25000.00,
		CartAbandonsLast5: 10,
	}

	if metrics.ActiveVisitors != 150 {
		t.Errorf("Expected ActiveVisitors 150, got %d", metrics.ActiveVisitors)
	}
}

func TestHourlySalesStruct(t *testing.T) {
	sales := &HourlySales{
		Hour:        time.Now(),
		OrdersCount: 10,
		Revenue:     5000.00,
	}

	if sales.OrdersCount != 10 {
		t.Errorf("Expected OrdersCount 10, got %d", sales.OrdersCount)
	}
}

// Benchmark tests

func BenchmarkEventCreation(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = &Event{
			EventID:    "evt-123",
			EventType:  "page_view",
			EventTime:  time.Now(),
			TenantID:   "tenant-1",
			UserID:     "user-456",
			SessionID:  "sess-789",
			DeviceType: "desktop",
			Browser:    "Chrome",
			OS:         "Linux",
		}
	}
}

func BenchmarkOrderAnalyticsCreation(b *testing.B) {
	now := time.Now()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = &OrderAnalytics{
			OrderID:     "ord-123",
			OrderNumber: "ORD-2024-001",
			TenantID:    "tenant-1",
			CustomerID:  "cust-456",
			Status:      "completed",
			Total:       1130.00,
			Currency:    "UAH",
			CreatedAt:   now,
		}
	}
}
