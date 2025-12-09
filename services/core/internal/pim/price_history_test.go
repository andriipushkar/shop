package pim

import (
	"context"
	"errors"
	"testing"
	"time"
)

// MockPriceHistoryRepository is a mock implementation for testing
type MockPriceHistoryRepository struct {
	records map[string][]*PriceHistory
}

func NewMockPriceHistoryRepository() *MockPriceHistoryRepository {
	return &MockPriceHistoryRepository{
		records: make(map[string][]*PriceHistory),
	}
}

func (m *MockPriceHistoryRepository) RecordPriceChange(ctx context.Context, record *PriceHistory) error {
	if m.records[record.ProductID] == nil {
		m.records[record.ProductID] = []*PriceHistory{}
	}
	m.records[record.ProductID] = append([]*PriceHistory{record}, m.records[record.ProductID]...)
	return nil
}

func (m *MockPriceHistoryRepository) GetPriceHistory(ctx context.Context, productID string) ([]*PriceHistory, error) {
	if records, ok := m.records[productID]; ok {
		return records, nil
	}
	return []*PriceHistory{}, nil
}

func (m *MockPriceHistoryRepository) GetLatestPrice(ctx context.Context, productID string) (*PriceHistory, error) {
	if records, ok := m.records[productID]; ok && len(records) > 0 {
		return records[0], nil
	}
	return nil, errors.New("no price history found")
}

func TestPriceHistory_Fields(t *testing.T) {
	now := time.Now()
	record := PriceHistory{
		ID:        "ph-001",
		ProductID: "prod-001",
		OldPrice:  99.99,
		NewPrice:  89.99,
		ChangedAt: now,
	}

	if record.ID != "ph-001" {
		t.Errorf("Expected ID 'ph-001', got '%s'", record.ID)
	}
	if record.ProductID != "prod-001" {
		t.Errorf("Expected ProductID 'prod-001', got '%s'", record.ProductID)
	}
	if record.OldPrice != 99.99 {
		t.Errorf("Expected OldPrice 99.99, got %f", record.OldPrice)
	}
	if record.NewPrice != 89.99 {
		t.Errorf("Expected NewPrice 89.99, got %f", record.NewPrice)
	}
}

func TestMockPriceHistoryRepository_RecordPriceChange(t *testing.T) {
	repo := NewMockPriceHistoryRepository()
	ctx := context.Background()

	record := &PriceHistory{
		ID:        "ph-001",
		ProductID: "prod-001",
		OldPrice:  100.00,
		NewPrice:  90.00,
		ChangedAt: time.Now(),
	}

	err := repo.RecordPriceChange(ctx, record)
	if err != nil {
		t.Fatalf("RecordPriceChange failed: %v", err)
	}

	// Verify record exists
	history, err := repo.GetPriceHistory(ctx, "prod-001")
	if err != nil {
		t.Fatalf("GetPriceHistory failed: %v", err)
	}
	if len(history) != 1 {
		t.Errorf("Expected 1 record, got %d", len(history))
	}
}

func TestMockPriceHistoryRepository_GetPriceHistory(t *testing.T) {
	repo := NewMockPriceHistoryRepository()
	ctx := context.Background()

	// Add multiple price changes
	records := []*PriceHistory{
		{ID: "ph-001", ProductID: "prod-001", OldPrice: 100.00, NewPrice: 90.00, ChangedAt: time.Now().Add(-2 * time.Hour)},
		{ID: "ph-002", ProductID: "prod-001", OldPrice: 90.00, NewPrice: 85.00, ChangedAt: time.Now().Add(-1 * time.Hour)},
		{ID: "ph-003", ProductID: "prod-001", OldPrice: 85.00, NewPrice: 80.00, ChangedAt: time.Now()},
	}

	for _, r := range records {
		repo.RecordPriceChange(ctx, r)
	}

	// Get history
	history, err := repo.GetPriceHistory(ctx, "prod-001")
	if err != nil {
		t.Fatalf("GetPriceHistory failed: %v", err)
	}

	if len(history) != 3 {
		t.Errorf("Expected 3 records, got %d", len(history))
	}
}

func TestMockPriceHistoryRepository_GetLatestPrice(t *testing.T) {
	repo := NewMockPriceHistoryRepository()
	ctx := context.Background()

	// Add multiple price changes
	records := []*PriceHistory{
		{ID: "ph-001", ProductID: "prod-001", OldPrice: 100.00, NewPrice: 90.00, ChangedAt: time.Now().Add(-2 * time.Hour)},
		{ID: "ph-002", ProductID: "prod-001", OldPrice: 90.00, NewPrice: 85.00, ChangedAt: time.Now().Add(-1 * time.Hour)},
		{ID: "ph-003", ProductID: "prod-001", OldPrice: 85.00, NewPrice: 80.00, ChangedAt: time.Now()},
	}

	for _, r := range records {
		repo.RecordPriceChange(ctx, r)
	}

	// Get latest
	latest, err := repo.GetLatestPrice(ctx, "prod-001")
	if err != nil {
		t.Fatalf("GetLatestPrice failed: %v", err)
	}

	if latest.NewPrice != 80.00 {
		t.Errorf("Expected NewPrice 80.00, got %f", latest.NewPrice)
	}
}

func TestMockPriceHistoryRepository_GetLatestPrice_NotFound(t *testing.T) {
	repo := NewMockPriceHistoryRepository()
	ctx := context.Background()

	_, err := repo.GetLatestPrice(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent product")
	}
}

func TestMockPriceHistoryRepository_MultipleProducts(t *testing.T) {
	repo := NewMockPriceHistoryRepository()
	ctx := context.Background()

	// Add price changes for different products
	records := []*PriceHistory{
		{ID: "ph-001", ProductID: "prod-001", OldPrice: 100.00, NewPrice: 90.00, ChangedAt: time.Now()},
		{ID: "ph-002", ProductID: "prod-002", OldPrice: 200.00, NewPrice: 180.00, ChangedAt: time.Now()},
		{ID: "ph-003", ProductID: "prod-001", OldPrice: 90.00, NewPrice: 85.00, ChangedAt: time.Now()},
	}

	for _, r := range records {
		repo.RecordPriceChange(ctx, r)
	}

	// Product 1 should have 2 records
	history1, _ := repo.GetPriceHistory(ctx, "prod-001")
	if len(history1) != 2 {
		t.Errorf("Expected prod-001 to have 2 records, got %d", len(history1))
	}

	// Product 2 should have 1 record
	history2, _ := repo.GetPriceHistory(ctx, "prod-002")
	if len(history2) != 1 {
		t.Errorf("Expected prod-002 to have 1 record, got %d", len(history2))
	}
}

func TestPriceHistoryService_GetPriceHistory_NoRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	_, err := service.GetPriceHistory(ctx, "prod-001")
	if err == nil {
		t.Error("Expected error when price history repository is not configured")
	}
}

func TestPriceHistoryService_GetLatestPriceChange_NoRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	_, err := service.GetLatestPriceChange(ctx, "prod-001")
	if err == nil {
		t.Error("Expected error when price history repository is not configured")
	}
}

func TestPriceChange_Calculation(t *testing.T) {
	oldPrice := 100.00
	newPrice := 75.00

	// Calculate percentage change
	percentageChange := ((newPrice - oldPrice) / oldPrice) * 100

	if percentageChange != -25.0 {
		t.Errorf("Expected -25%% change, got %f%%", percentageChange)
	}

	// Price increase
	newPrice = 125.00
	percentageChange = ((newPrice - oldPrice) / oldPrice) * 100

	if percentageChange != 25.0 {
		t.Errorf("Expected 25%% change, got %f%%", percentageChange)
	}
}

func TestPriceHistory_EmptyHistory(t *testing.T) {
	repo := NewMockPriceHistoryRepository()
	ctx := context.Background()

	// Get history for product with no changes
	history, err := repo.GetPriceHistory(ctx, "new-product")
	if err != nil {
		t.Fatalf("GetPriceHistory failed: %v", err)
	}

	if len(history) != 0 {
		t.Errorf("Expected empty history, got %d records", len(history))
	}
}
