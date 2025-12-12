package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockExpiryRepository implements ExpiryRepository for testing
type mockExpiryRepository struct {
	batches map[string]*BatchStock
	alerts  map[string]*ExpiryAlert
}

func newMockExpiryRepository() *mockExpiryRepository {
	return &mockExpiryRepository{
		batches: make(map[string]*BatchStock),
		alerts:  make(map[string]*ExpiryAlert),
	}
}

func (m *mockExpiryRepository) CreateBatchStock(ctx context.Context, batch *BatchStock) error {
	m.batches[batch.ID] = batch
	return nil
}

func (m *mockExpiryRepository) UpdateBatchStock(ctx context.Context, batch *BatchStock) error {
	m.batches[batch.ID] = batch
	return nil
}

func (m *mockExpiryRepository) GetBatchStock(ctx context.Context, id string) (*BatchStock, error) {
	if b, ok := m.batches[id]; ok {
		return b, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockExpiryRepository) GetBatchStockByProduct(ctx context.Context, warehouseID, productID string) ([]*BatchStock, error) {
	result := make([]*BatchStock, 0)
	for _, b := range m.batches {
		if b.WarehouseID == warehouseID && b.ProductID == productID {
			result = append(result, b)
		}
	}
	return result, nil
}

func (m *mockExpiryRepository) GetBatchStockByBatch(ctx context.Context, batchNumber string) ([]*BatchStock, error) {
	result := make([]*BatchStock, 0)
	for _, b := range m.batches {
		if b.BatchNumber == batchNumber {
			result = append(result, b)
		}
	}
	return result, nil
}

func (m *mockExpiryRepository) ListExpiringStock(ctx context.Context, warehouseID string, beforeDate time.Time) ([]*BatchStock, error) {
	result := make([]*BatchStock, 0)
	for _, b := range m.batches {
		if b.WarehouseID == warehouseID && b.ExpiryDate != nil && b.ExpiryDate.Before(beforeDate) {
			result = append(result, b)
		}
	}
	return result, nil
}

func (m *mockExpiryRepository) ListExpiredStock(ctx context.Context, warehouseID string) ([]*BatchStock, error) {
	result := make([]*BatchStock, 0)
	now := time.Now()
	for _, b := range m.batches {
		if b.WarehouseID == warehouseID && b.ExpiryDate != nil && b.ExpiryDate.Before(now) {
			result = append(result, b)
		}
	}
	return result, nil
}

func (m *mockExpiryRepository) CreateExpiryAlert(ctx context.Context, alert *ExpiryAlert) error {
	m.alerts[alert.ID] = alert
	return nil
}

func (m *mockExpiryRepository) UpdateExpiryAlert(ctx context.Context, alert *ExpiryAlert) error {
	m.alerts[alert.ID] = alert
	return nil
}

func (m *mockExpiryRepository) GetExpiryAlert(ctx context.Context, id string) (*ExpiryAlert, error) {
	if a, ok := m.alerts[id]; ok {
		return a, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockExpiryRepository) ListExpiryAlerts(ctx context.Context, warehouseID, status string, limit int) ([]*ExpiryAlert, error) {
	result := make([]*ExpiryAlert, 0)
	for _, a := range m.alerts {
		if (warehouseID == "" || a.WarehouseID == warehouseID) && (status == "" || a.Status == status) {
			result = append(result, a)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockExpiryRepository) GetPendingAlertsCount(ctx context.Context, warehouseID string) (int, error) {
	count := 0
	for _, a := range m.alerts {
		if a.WarehouseID == warehouseID && a.Status == "pending" {
			count++
		}
	}
	return count, nil
}

// Tests

func TestExpiryService_NewExpiryService(t *testing.T) {
	repo := newMockExpiryRepository()

	// Test with default config
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)

	if service.config.CriticalDays != 7 {
		t.Errorf("Expected default CriticalDays 7, got %d", service.config.CriticalDays)
	}
	if service.config.WarningDays != 30 {
		t.Errorf("Expected default WarningDays 30, got %d", service.config.WarningDays)
	}
	if service.config.InfoDays != 90 {
		t.Errorf("Expected default InfoDays 90, got %d", service.config.InfoDays)
	}

	// Test with custom config
	config = ExpiryConfig{CriticalDays: 5, WarningDays: 14, InfoDays: 60}
	service = NewExpiryService(repo, config)

	if service.config.CriticalDays != 5 {
		t.Errorf("Expected CriticalDays 5, got %d", service.config.CriticalDays)
	}
}

func TestExpiryService_ReceiveBatchStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	futureDate := time.Now().AddDate(0, 6, 0) // 6 months from now

	batch, err := service.ReceiveBatchStock(ctx, "wh1", "prod1", "SKU001", "BATCH001", "LOT001", 100, &futureDate, 10.00, "A1-01")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if batch.Quantity != 100 {
		t.Errorf("Expected quantity 100, got %d", batch.Quantity)
	}
	if batch.Available != 100 {
		t.Errorf("Expected available 100, got %d", batch.Available)
	}
	if batch.BatchNumber != "BATCH001" {
		t.Errorf("Expected batch number 'BATCH001', got %s", batch.BatchNumber)
	}
	if batch.Location != "A1-01" {
		t.Errorf("Expected location 'A1-01', got %s", batch.Location)
	}
}

func TestExpiryService_ReceiveBatchStock_InvalidQuantity(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	_, err := service.ReceiveBatchStock(ctx, "wh1", "prod1", "SKU001", "BATCH001", "", 0, nil, 0, "")
	if err != ErrInvalidQuantity {
		t.Errorf("Expected ErrInvalidQuantity, got %v", err)
	}

	_, err = service.ReceiveBatchStock(ctx, "wh1", "prod1", "SKU001", "BATCH001", "", -5, nil, 0, "")
	if err != ErrInvalidQuantity {
		t.Errorf("Expected ErrInvalidQuantity, got %v", err)
	}
}

func TestExpiryService_ReceiveBatchStock_ExpiryDateInPast(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	pastDate := time.Now().AddDate(0, -1, 0) // 1 month ago

	_, err := service.ReceiveBatchStock(ctx, "wh1", "prod1", "SKU001", "BATCH001", "", 100, &pastDate, 0, "")
	if err != ErrExpiryDateInPast {
		t.Errorf("Expected ErrExpiryDateInPast, got %v", err)
	}
}

func TestExpiryService_GetFEFOStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true, BlockExpired: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create batches with different expiry dates
	expiry1 := time.Now().AddDate(0, 1, 0) // 1 month
	expiry2 := time.Now().AddDate(0, 2, 0) // 2 months
	expiry3 := time.Now().AddDate(0, 3, 0) // 3 months

	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH001", ExpiryDate: &expiry2, Quantity: 50, Available: 50}
	repo.batches["b2"] = &BatchStock{ID: "b2", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH002", ExpiryDate: &expiry1, Quantity: 30, Available: 30}
	repo.batches["b3"] = &BatchStock{ID: "b3", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH003", ExpiryDate: &expiry3, Quantity: 100, Available: 100}

	// Get FEFO stock for 50 units
	batches, err := service.GetFEFOStock(ctx, "wh1", "prod1", 50)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should return batch with earliest expiry first
	if len(batches) == 0 {
		t.Fatal("Expected at least one batch")
	}
	if batches[0].BatchNumber != "BATCH002" {
		t.Errorf("Expected first batch to be 'BATCH002', got %s", batches[0].BatchNumber)
	}
}

func TestExpiryService_GetFEFOStock_InsufficientStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	expiry := time.Now().AddDate(0, 1, 0)
	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", ExpiryDate: &expiry, Quantity: 50, Available: 50}

	_, err := service.GetFEFOStock(ctx, "wh1", "prod1", 100)
	if err != ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}
}

func TestExpiryService_GetFEFOStock_NoValidStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// No batches
	_, err := service.GetFEFOStock(ctx, "wh1", "prod1", 10)
	if err != ErrNoValidStock {
		t.Errorf("Expected ErrNoValidStock, got %v", err)
	}
}

func TestExpiryService_GetFEFOStock_BlockExpired(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true, BlockExpired: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create expired batch
	expired := time.Now().AddDate(0, 0, -1) // Yesterday
	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", ExpiryDate: &expired, Quantity: 100, Available: 100}

	_, err := service.GetFEFOStock(ctx, "wh1", "prod1", 10)
	if err != ErrNoValidStock {
		t.Errorf("Expected ErrNoValidStock (expired stock blocked), got %v", err)
	}
}

func TestExpiryService_AllocateFEFO(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	expiry1 := time.Now().AddDate(0, 1, 0)
	expiry2 := time.Now().AddDate(0, 2, 0)

	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH001", ExpiryDate: &expiry1, Quantity: 30, Available: 30, Location: "A1"}
	repo.batches["b2"] = &BatchStock{ID: "b2", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH002", ExpiryDate: &expiry2, Quantity: 50, Available: 50, Location: "A2"}

	allocations, err := service.AllocateFEFO(ctx, "wh1", "prod1", 50)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(allocations) != 2 {
		t.Fatalf("Expected 2 allocations, got %d", len(allocations))
	}

	// First allocation should be from batch with earliest expiry
	if allocations[0].BatchNumber != "BATCH001" {
		t.Errorf("Expected first allocation from BATCH001, got %s", allocations[0].BatchNumber)
	}
	if allocations[0].Quantity != 30 {
		t.Errorf("Expected first allocation quantity 30, got %d", allocations[0].Quantity)
	}
	if allocations[1].Quantity != 20 {
		t.Errorf("Expected second allocation quantity 20, got %d", allocations[1].Quantity)
	}
}

func TestExpiryService_GetExpiringStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	expiry := time.Now().AddDate(0, 0, 15) // 15 days from now
	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", ExpiryDate: &expiry, Quantity: 100, Available: 100}

	batches, err := service.GetExpiringStock(ctx, "wh1", 30)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(batches) != 1 {
		t.Errorf("Expected 1 expiring batch, got %d", len(batches))
	}
}

func TestExpiryService_GetExpiredStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	expired := time.Now().AddDate(0, 0, -5) // 5 days ago
	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", ExpiryDate: &expired, Quantity: 100, Available: 100}

	batches, err := service.GetExpiredStock(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(batches) != 1 {
		t.Errorf("Expected 1 expired batch, got %d", len(batches))
	}
}

func TestExpiryService_CheckExpiryAlerts(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create batch expiring in 5 days (critical)
	expiry := time.Now().AddDate(0, 0, 5)
	repo.batches["b1"] = &BatchStock{
		ID:          "b1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		BatchNumber: "BATCH001",
		ExpiryDate:  &expiry,
		Quantity:    100,
		Available:   50,
	}

	alerts, err := service.CheckExpiryAlerts(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(alerts) == 0 {
		t.Fatal("Expected at least one alert")
	}

	if alerts[0].AlertType != "critical" {
		t.Errorf("Expected alert type 'critical', got %s", alerts[0].AlertType)
	}
}

func TestExpiryService_AcknowledgeAlert(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	repo.alerts["alert1"] = &ExpiryAlert{
		ID:     "alert1",
		Status: "pending",
	}

	err := service.AcknowledgeAlert(ctx, "alert1", "user1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	alert, _ := repo.GetExpiryAlert(ctx, "alert1")
	if alert.Status != "acknowledged" {
		t.Errorf("Expected status 'acknowledged', got %s", alert.Status)
	}
	if alert.AcknowledgedBy != "user1" {
		t.Errorf("Expected acknowledged by 'user1', got %s", alert.AcknowledgedBy)
	}
}

func TestExpiryService_ResolveAlert(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	repo.alerts["alert1"] = &ExpiryAlert{
		ID:     "alert1",
		Status: "acknowledged",
	}

	err := service.ResolveAlert(ctx, "alert1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	alert, _ := repo.GetExpiryAlert(ctx, "alert1")
	if alert.Status != "resolved" {
		t.Errorf("Expected status 'resolved', got %s", alert.Status)
	}
}

func TestExpiryService_GetExpiryDashboard(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create batches with different expiry dates
	expired := time.Now().AddDate(0, 0, -1)
	critical := time.Now().AddDate(0, 0, 5)
	warning := time.Now().AddDate(0, 0, 20)

	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ExpiryDate: &expired, Quantity: 10, Available: 10, CostPrice: 5.0}
	repo.batches["b2"] = &BatchStock{ID: "b2", WarehouseID: "wh1", ExpiryDate: &critical, Quantity: 20, Available: 20, CostPrice: 10.0}
	repo.batches["b3"] = &BatchStock{ID: "b3", WarehouseID: "wh1", ExpiryDate: &warning, Quantity: 30, Available: 30, CostPrice: 15.0}

	repo.alerts["a1"] = &ExpiryAlert{ID: "a1", WarehouseID: "wh1", Status: "pending"}

	dashboard, err := service.GetExpiryDashboard(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if dashboard.ExpiredCount != 1 {
		t.Errorf("Expected 1 expired, got %d", dashboard.ExpiredCount)
	}
	if dashboard.PendingAlerts != 1 {
		t.Errorf("Expected 1 pending alert, got %d", dashboard.PendingAlerts)
	}
}

func TestExpiryService_AutoWriteOffExpired(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{AutoWriteOff: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	expired := time.Now().AddDate(0, 0, -5)
	repo.batches["b1"] = &BatchStock{
		ID:          "b1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		ExpiryDate:  &expired,
		Quantity:    100,
		Reserved:    20,
		Available:   80,
	}

	writtenOff, err := service.AutoWriteOffExpired(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(writtenOff) != 1 {
		t.Fatalf("Expected 1 written off batch, got %d", len(writtenOff))
	}

	batch, _ := repo.GetBatchStock(ctx, "b1")
	if batch.Available != 0 {
		t.Errorf("Expected available 0 after write-off, got %d", batch.Available)
	}
	if batch.Quantity != 20 { // Should keep reserved quantity
		t.Errorf("Expected quantity 20 (reserved), got %d", batch.Quantity)
	}
}

func TestExpiryService_AutoWriteOffExpired_Disabled(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{AutoWriteOff: false}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	writtenOff, err := service.AutoWriteOffExpired(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if writtenOff != nil {
		t.Errorf("Expected nil when auto write-off disabled, got %v", writtenOff)
	}
}

func TestExpiryService_GetFEFOStock_NilExpiryDate(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Batch without expiry date - should be sorted last
	expiry := time.Now().AddDate(0, 1, 0)
	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH001", ExpiryDate: nil, Quantity: 100, Available: 100}
	repo.batches["b2"] = &BatchStock{ID: "b2", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH002", ExpiryDate: &expiry, Quantity: 50, Available: 50}

	batches, err := service.GetFEFOStock(ctx, "wh1", "prod1", 80)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Batch with expiry date should come first
	if batches[0].BatchNumber != "BATCH002" {
		t.Errorf("Expected batch with expiry date first, got %s", batches[0].BatchNumber)
	}
}

// Additional edge case tests for 100% coverage

func TestExpiryService_CheckExpiryAlerts_ExpiredBatch(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create already expired batch
	expired := time.Now().AddDate(0, 0, -2) // 2 days ago
	repo.batches["b1"] = &BatchStock{
		ID:          "b1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		BatchNumber: "BATCH001",
		ExpiryDate:  &expired,
		Quantity:    100,
		Available:   50,
	}

	alerts, err := service.CheckExpiryAlerts(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(alerts) == 0 {
		t.Fatal("Expected at least one alert")
	}

	if alerts[0].AlertType != "expired" {
		t.Errorf("Expected alert type 'expired', got %s", alerts[0].AlertType)
	}
}

func TestExpiryService_CheckExpiryAlerts_CriticalBatch(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create batch expiring in 3 days (critical)
	expiry := time.Now().AddDate(0, 0, 3)
	repo.batches["b1"] = &BatchStock{
		ID:          "b1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		BatchNumber: "BATCH001",
		ExpiryDate:  &expiry,
		Quantity:    100,
		Available:   50,
	}

	alerts, err := service.CheckExpiryAlerts(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(alerts) == 0 {
		t.Fatal("Expected at least one alert")
	}

	if alerts[0].AlertType != "critical" {
		t.Errorf("Expected alert type 'critical', got %s", alerts[0].AlertType)
	}
}

func TestExpiryService_CheckExpiryAlerts_NilExpiryDate(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Batch without expiry date - should be skipped
	repo.batches["b1"] = &BatchStock{
		ID:          "b1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		BatchNumber: "BATCH001",
		ExpiryDate:  nil,
		Quantity:    100,
		Available:   50,
	}

	alerts, err := service.CheckExpiryAlerts(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(alerts) != 0 {
		t.Error("Expected no alerts for batch without expiry date")
	}
}

func TestExpiryService_ReceiveBatchStock_WithExpirySoon(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30, InfoDays: 90}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create batch expiring in 5 days (critical)
	criticalDate := time.Now().AddDate(0, 0, 5)

	batch, err := service.ReceiveBatchStock(ctx, "wh1", "prod1", "SKU001", "BATCH001", "LOT001", 100, &criticalDate, 10.00, "A1-01")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Alert should have been created
	if len(repo.alerts) == 0 {
		t.Error("Expected alert to be created for critical expiry")
	}

	if batch.ID == "" {
		t.Error("Expected batch ID to be set")
	}
}

func TestExpiryService_ReceiveBatchStock_WithWarningExpiry(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30, InfoDays: 90}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create batch expiring in 20 days (warning)
	warningDate := time.Now().AddDate(0, 0, 20)

	batch, err := service.ReceiveBatchStock(ctx, "wh1", "prod1", "SKU001", "BATCH001", "LOT001", 100, &warningDate, 10.00, "A1-01")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Alert should have been created
	if len(repo.alerts) == 0 {
		t.Error("Expected alert to be created for warning expiry")
	}

	if batch.BatchNumber != "BATCH001" {
		t.Errorf("Expected batch number BATCH001, got %s", batch.BatchNumber)
	}
}

func TestExpiryService_ReceiveBatchStock_FarFutureExpiry(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30, InfoDays: 90}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Create batch expiring in 1 year (no alert)
	farFuture := time.Now().AddDate(1, 0, 0)

	_, err := service.ReceiveBatchStock(ctx, "wh1", "prod1", "SKU001", "BATCH001", "LOT001", 100, &farFuture, 10.00, "A1-01")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// No alert should be created for far future expiry
	if len(repo.alerts) != 0 {
		t.Error("Expected no alert for far future expiry")
	}
}

func TestExpiryService_AcknowledgeAlert_NotFound(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	err := service.AcknowledgeAlert(ctx, "nonexistent", "user1")
	if err == nil {
		t.Error("Expected error for nonexistent alert")
	}
}

func TestExpiryService_ResolveAlert_NotFound(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	err := service.ResolveAlert(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent alert")
	}
}

func TestExpiryService_GetExpiryDashboard_NoStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{CriticalDays: 7, WarningDays: 30}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	dashboard, err := service.GetExpiryDashboard(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if dashboard.ExpiredCount != 0 {
		t.Errorf("Expected 0 expired, got %d", dashboard.ExpiredCount)
	}
	if dashboard.CriticalCount != 0 {
		t.Errorf("Expected 0 critical, got %d", dashboard.CriticalCount)
	}
}

func TestExpiryService_AllocateFEFO_InsufficientStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	expiry := time.Now().AddDate(0, 1, 0)
	repo.batches["b1"] = &BatchStock{ID: "b1", WarehouseID: "wh1", ProductID: "prod1", BatchNumber: "BATCH001", ExpiryDate: &expiry, Quantity: 30, Available: 30}

	_, err := service.AllocateFEFO(ctx, "wh1", "prod1", 100)
	if err != ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}
}

func TestExpiryService_AllocateFEFO_NoStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{FEFOEnabled: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	_, err := service.AllocateFEFO(ctx, "wh1", "prod1", 10)
	if err != ErrNoValidStock {
		t.Errorf("Expected ErrNoValidStock, got %v", err)
	}
}

func TestExpiryService_AutoWriteOffExpired_NoExpiredStock(t *testing.T) {
	repo := newMockExpiryRepository()
	config := ExpiryConfig{AutoWriteOff: true}
	service := NewExpiryService(repo, config)
	ctx := context.Background()

	// Add valid non-expired stock
	future := time.Now().AddDate(0, 1, 0)
	repo.batches["b1"] = &BatchStock{
		ID:          "b1",
		WarehouseID: "wh1",
		ExpiryDate:  &future,
		Quantity:    100,
		Available:   100,
	}

	writtenOff, err := service.AutoWriteOffExpired(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(writtenOff) != 0 {
		t.Errorf("Expected 0 written off, got %d", len(writtenOff))
	}
}
