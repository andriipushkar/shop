package warehouse

import (
	"context"
	"testing"
	"time"
)

func TestWarehouseService_ReceiveStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Test receiving new stock
	err := service.ReceiveStock(ctx, "wh1", "prod1", "SKU001", 100, "purchase", "PO001", "Initial stock")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify stock was created
	stock, err := repo.GetStock(ctx, "wh1", "prod1")
	if err != nil {
		t.Errorf("Expected stock to exist, got error: %v", err)
	}
	if stock.Quantity != 100 {
		t.Errorf("Expected quantity 100, got %d", stock.Quantity)
	}
	if stock.Available != 100 {
		t.Errorf("Expected available 100, got %d", stock.Available)
	}

	// Test receiving additional stock
	err = service.ReceiveStock(ctx, "wh1", "prod1", "SKU001", 50, "purchase", "PO002", "Additional stock")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	stock, _ = repo.GetStock(ctx, "wh1", "prod1")
	if stock.Quantity != 150 {
		t.Errorf("Expected quantity 150, got %d", stock.Quantity)
	}
}

func TestWarehouseService_ShipStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Setup initial stock
	repo.stocks["wh1:prod1"] = &Stock{
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    100,
		Reserved:    0,
		Available:   100,
	}

	// Test shipping stock
	err := service.ShipStock(ctx, "wh1", "prod1", "SKU001", 30, "order", "ORD001")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	stock, _ := repo.GetStock(ctx, "wh1", "prod1")
	if stock.Quantity != 70 {
		t.Errorf("Expected quantity 70, got %d", stock.Quantity)
	}

	// Test insufficient stock
	err = service.ShipStock(ctx, "wh1", "prod1", "SKU001", 100, "order", "ORD002")
	if err != ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}
}

func TestWarehouseService_ReserveStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Setup initial stock
	repo.stocks["wh1:prod1"] = &Stock{
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    100,
		Reserved:    0,
		Available:   100,
	}

	// Test reserving stock
	expiresAt := time.Now().Add(24 * time.Hour)
	reservation, err := service.ReserveStock(ctx, "ORD001", "wh1", "prod1", 30, expiresAt)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if reservation == nil {
		t.Fatal("Expected reservation to be created")
	}
	if reservation.Quantity != 30 {
		t.Errorf("Expected reservation quantity 30, got %d", reservation.Quantity)
	}

	stock, _ := repo.GetStock(ctx, "wh1", "prod1")
	if stock.Reserved != 30 {
		t.Errorf("Expected reserved 30, got %d", stock.Reserved)
	}
	if stock.Available != 70 {
		t.Errorf("Expected available 70, got %d", stock.Available)
	}

	// Test reserving more than available
	_, err = service.ReserveStock(ctx, "ORD002", "wh1", "prod1", 100, expiresAt)
	if err != ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}
}

func TestWarehouseService_ReleaseReservation(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Setup initial stock with reservation
	repo.stocks["wh1:prod1"] = &Stock{
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    100,
		Reserved:    30,
		Available:   70,
	}
	repo.reservations["res1"] = &StockReservation{
		ID:          "res1",
		OrderID:     "ORD001",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    30,
		Status:      "active",
	}

	// Test releasing reservation
	err := service.ReleaseReservation(ctx, "res1")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	stock, _ := repo.GetStock(ctx, "wh1", "prod1")
	if stock.Reserved != 0 {
		t.Errorf("Expected reserved 0, got %d", stock.Reserved)
	}
	if stock.Available != 100 {
		t.Errorf("Expected available 100, got %d", stock.Available)
	}

	reservation, _ := repo.GetReservation(ctx, "res1")
	if reservation.Status != "cancelled" {
		t.Errorf("Expected status 'cancelled', got %s", reservation.Status)
	}
}

func TestWarehouseService_TransferStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Setup source warehouse stock
	repo.stocks["wh1:prod1"] = &Stock{
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    100,
		Reserved:    0,
		Available:   100,
	}

	// Test transfer
	err := service.TransferStock(ctx, "wh1", "wh2", "prod1", "SKU001", 40, "")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify source
	fromStock, _ := repo.GetStock(ctx, "wh1", "prod1")
	if fromStock.Quantity != 60 {
		t.Errorf("Expected source quantity 60, got %d", fromStock.Quantity)
	}

	// Verify destination
	toStock, _ := repo.GetStock(ctx, "wh2", "prod1")
	if toStock.Quantity != 40 {
		t.Errorf("Expected destination quantity 40, got %d", toStock.Quantity)
	}

	// Test transfer to same warehouse
	err = service.TransferStock(ctx, "wh1", "wh1", "prod1", "SKU001", 10, "")
	if err != ErrInvalidTransfer {
		t.Errorf("Expected ErrInvalidTransfer, got %v", err)
	}
}

func TestWarehouseService_AdjustStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Setup initial stock
	repo.stocks["wh1:prod1"] = &Stock{
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    100,
		Reserved:    0,
		Available:   100,
	}

	// Test positive adjustment
	err := service.AdjustStock(ctx, "wh1", "prod1", "SKU001", 120, "inventory count", "Found additional items")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	stock, _ := repo.GetStock(ctx, "wh1", "prod1")
	if stock.Quantity != 120 {
		t.Errorf("Expected quantity 120, got %d", stock.Quantity)
	}

	// Test negative adjustment
	err = service.AdjustStock(ctx, "wh1", "prod1", "SKU001", 90, "inventory count", "Discrepancy found")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	stock, _ = repo.GetStock(ctx, "wh1", "prod1")
	if stock.Quantity != 90 {
		t.Errorf("Expected quantity 90, got %d", stock.Quantity)
	}
}

func TestWarehouseService_AllocateStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Setup warehouses with priority
	repo.warehouses["wh1"] = &Warehouse{ID: "wh1", Priority: 1, AcceptsOrders: true, IsActive: true}
	repo.warehouses["wh2"] = &Warehouse{ID: "wh2", Priority: 2, AcceptsOrders: true, IsActive: true}

	// Setup stock
	repo.productStocks["prod1"] = []*Stock{
		{WarehouseID: "wh1", ProductID: "prod1", Quantity: 50, Available: 50},
		{WarehouseID: "wh2", ProductID: "prod1", Quantity: 100, Available: 100},
	}

	// Test allocation - should prefer wh1 (lower priority number)
	result, err := service.AllocateStock(ctx, "prod1", 30)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if !result.Available {
		t.Error("Expected stock to be available")
	}
	if result.WarehouseID != "wh1" {
		t.Errorf("Expected warehouse 'wh1', got %s", result.WarehouseID)
	}

	// Test allocation with larger quantity
	result, err = service.AllocateStock(ctx, "prod1", 80)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if result.WarehouseID != "wh2" {
		t.Errorf("Expected warehouse 'wh2' for larger quantity, got %s", result.WarehouseID)
	}

	// Test allocation with unavailable quantity
	result, err = service.AllocateStock(ctx, "prod1", 200)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if result.Available {
		t.Error("Expected stock to be unavailable")
	}
}

func TestInvalidQuantity(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)

	ctx := context.Background()

	// Test zero quantity
	err := service.ReceiveStock(ctx, "wh1", "prod1", "SKU001", 0, "", "", "")
	if err != ErrInvalidQuantity {
		t.Errorf("Expected ErrInvalidQuantity for zero, got %v", err)
	}

	// Test negative quantity
	err = service.ReceiveStock(ctx, "wh1", "prod1", "SKU001", -10, "", "", "")
	if err != ErrInvalidQuantity {
		t.Errorf("Expected ErrInvalidQuantity for negative, got %v", err)
	}
}

func TestWarehouseService_CreateWarehouse(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	wh := &Warehouse{
		ID:       "wh1",
		Name:     "Test Warehouse",
		Code:     "WH001",
		IsActive: true,
	}

	err := service.CreateWarehouse(ctx, wh)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if wh.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

func TestWarehouseService_UpdateWarehouse(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	wh := &Warehouse{ID: "wh1", Name: "Updated Warehouse", Code: "WH001"}
	repo.warehouses["wh1"] = wh

	wh.Name = "Updated Name"
	err := service.UpdateWarehouse(ctx, wh)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestWarehouseService_DeleteWarehouse(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.warehouses["wh1"] = &Warehouse{ID: "wh1", Name: "Test"}

	err := service.DeleteWarehouse(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestWarehouseService_GetWarehouse(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.warehouses["wh1"] = &Warehouse{ID: "wh1", Name: "Test Warehouse"}

	wh, err := service.GetWarehouse(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if wh.Name != "Test Warehouse" {
		t.Errorf("Expected 'Test Warehouse', got %s", wh.Name)
	}
}

func TestWarehouseService_ListWarehouses(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.warehouses["wh1"] = &Warehouse{ID: "wh1", Name: "WH1", IsActive: true}
	repo.warehouses["wh2"] = &Warehouse{ID: "wh2", Name: "WH2", IsActive: false}

	list, err := service.ListWarehouses(ctx, true)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 active warehouse, got %d", len(list))
	}
}

func TestWarehouseService_GetStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100}

	stock, err := service.GetStock(ctx, "wh1", "prod1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if stock.Quantity != 100 {
		t.Errorf("Expected quantity 100, got %d", stock.Quantity)
	}
}

func TestWarehouseService_GetProductStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100}
	repo.stocks["wh2:prod1"] = &Stock{ID: "s2", WarehouseID: "wh2", ProductID: "prod1", Quantity: 50}

	stocks, err := service.GetProductStock(ctx, "prod1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(stocks) != 2 {
		t.Errorf("Expected 2 stocks, got %d", len(stocks))
	}
}

func TestWarehouseService_GetTotalAvailable(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Available: 100}
	repo.stocks["wh2:prod1"] = &Stock{ID: "s2", WarehouseID: "wh2", ProductID: "prod1", Available: 50}

	total, err := service.GetTotalAvailable(ctx, "prod1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if total != 150 {
		t.Errorf("Expected 150, got %d", total)
	}
}

func TestWarehouseService_FulfillReservation(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", SKU: "SKU001", Quantity: 100, Available: 90, Reserved: 10}
	repo.reservations["res1"] = &StockReservation{
		ID:          "res1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    10,
		Status:      "active",
	}

	err := service.FulfillReservation(ctx, "res1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestWarehouseService_FulfillReservation_NotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	err := service.FulfillReservation(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent reservation")
	}
}

func TestWarehouseService_GetLowStockProducts(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	products, err := service.GetLowStockProducts(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	_ = products // Result depends on mock implementation
}

func TestWarehouseService_GetMovementHistory(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	from := time.Now().Add(-24 * time.Hour)
	to := time.Now()

	movements, err := service.GetMovementHistory(ctx, "wh1", from, to, 100)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	_ = movements
}

// Edge case tests for increased coverage

func TestWarehouseService_ShipStock_ProductNotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	err := service.ShipStock(ctx, "wh1", "nonexistent", "SKU001", 10, "order", "ORD001")
	if err != ErrProductNotFound {
		t.Errorf("Expected ErrProductNotFound, got %v", err)
	}
}

func TestWarehouseService_ShipStock_InvalidQuantity(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	err := service.ShipStock(ctx, "wh1", "prod1", "SKU001", -10, "order", "ORD001")
	if err != ErrInvalidQuantity {
		t.Errorf("Expected ErrInvalidQuantity, got %v", err)
	}
}

func TestWarehouseService_ReserveStock_ProductNotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	expiresAt := time.Now().Add(24 * time.Hour)
	_, err := service.ReserveStock(ctx, "ORD001", "wh1", "nonexistent", 10, expiresAt)
	if err != ErrProductNotFound {
		t.Errorf("Expected ErrProductNotFound, got %v", err)
	}
}

func TestWarehouseService_ReserveStock_InvalidQuantity(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	expiresAt := time.Now().Add(24 * time.Hour)
	_, err := service.ReserveStock(ctx, "ORD001", "wh1", "prod1", 0, expiresAt)
	if err != ErrInvalidQuantity {
		t.Errorf("Expected ErrInvalidQuantity, got %v", err)
	}
}

func TestWarehouseService_ReleaseReservation_NotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	err := service.ReleaseReservation(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent reservation")
	}
}

func TestWarehouseService_ReleaseReservation_AlreadyReleased(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Reserved: 0, Available: 100,
	}
	repo.reservations["res1"] = &StockReservation{
		ID:          "res1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    10,
		Status:      "fulfilled", // Not active
	}

	err := service.ReleaseReservation(ctx, "res1")
	if err != nil {
		t.Fatalf("Expected no error for already released reservation, got %v", err)
	}
}

func TestWarehouseService_ReleaseReservation_NegativeReserved(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Reserved: 5, Available: 95,
	}
	repo.reservations["res1"] = &StockReservation{
		ID:          "res1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    10, // More than reserved
		Status:      "active",
	}

	err := service.ReleaseReservation(ctx, "res1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	stock := repo.stocks["wh1:prod1"]
	if stock.Reserved != 0 {
		t.Errorf("Expected reserved to be clamped to 0, got %d", stock.Reserved)
	}
}

func TestWarehouseService_FulfillReservation_NotActive(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.reservations["res1"] = &StockReservation{
		ID:     "res1",
		Status: "cancelled",
	}

	err := service.FulfillReservation(ctx, "res1")
	if err == nil {
		t.Error("Expected error for non-active reservation")
	}
}

func TestWarehouseService_FulfillReservation_StockNotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.reservations["res1"] = &StockReservation{
		ID:          "res1",
		WarehouseID: "wh1",
		ProductID:   "nonexistent",
		Quantity:    10,
		Status:      "active",
	}

	err := service.FulfillReservation(ctx, "res1")
	if err == nil {
		t.Error("Expected error when stock not found")
	}
}

func TestWarehouseService_FulfillReservation_NegativeReserved(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Reserved: 5, Available: 95,
	}
	repo.reservations["res1"] = &StockReservation{
		ID:          "res1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    10, // More than reserved
		Status:      "active",
	}

	err := service.FulfillReservation(ctx, "res1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	stock := repo.stocks["wh1:prod1"]
	if stock.Reserved != 0 {
		t.Errorf("Expected reserved to be clamped to 0, got %d", stock.Reserved)
	}
}

func TestWarehouseService_TransferStock_InvalidQuantity(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	err := service.TransferStock(ctx, "wh1", "wh2", "prod1", "SKU001", 0, "")
	if err != ErrInvalidQuantity {
		t.Errorf("Expected ErrInvalidQuantity, got %v", err)
	}
}

func TestWarehouseService_TransferStock_ProductNotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	err := service.TransferStock(ctx, "wh1", "wh2", "nonexistent", "SKU001", 10, "")
	if err != ErrProductNotFound {
		t.Errorf("Expected ErrProductNotFound, got %v", err)
	}
}

func TestWarehouseService_TransferStock_InsufficientStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 10, Available: 10,
	}

	err := service.TransferStock(ctx, "wh1", "wh2", "prod1", "SKU001", 20, "")
	if err != ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}
}

func TestWarehouseService_AdjustStock_NoChange(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Reserved: 0, Available: 100,
	}

	err := service.AdjustStock(ctx, "wh1", "prod1", "SKU001", 100, "count", "")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestWarehouseService_AdjustStock_ReservedExceedsQuantity(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Reserved: 50, Available: 50,
	}

	// Adjust to 30, but reserved is 50
	err := service.AdjustStock(ctx, "wh1", "prod1", "SKU001", 30, "count", "shortage")
	if err != ErrStockReserved {
		t.Errorf("Expected ErrStockReserved, got %v", err)
	}
}

func TestWarehouseService_AllocateStock_NoStock(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.productStocks["prod1"] = []*Stock{}

	result, err := service.AllocateStock(ctx, "prod1", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result.Available {
		t.Error("Expected stock to be unavailable")
	}
}

func TestWarehouseService_AllocateStock_NoActiveWarehouses(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.productStocks["prod1"] = []*Stock{
		{WarehouseID: "wh1", ProductID: "prod1", Available: 100},
	}
	// No warehouses in the repo

	result, err := service.AllocateStock(ctx, "prod1", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result.Available {
		t.Error("Expected stock to be unavailable when no warehouses accept orders")
	}
}

func TestWarehouseService_AllocateStock_WarehouseDoesNotAcceptOrders(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	repo.warehouses["wh1"] = &Warehouse{ID: "wh1", AcceptsOrders: false, IsActive: true}
	repo.productStocks["prod1"] = []*Stock{
		{WarehouseID: "wh1", ProductID: "prod1", Available: 100},
	}

	result, err := service.AllocateStock(ctx, "prod1", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result.Available {
		t.Error("Expected stock to be unavailable when warehouse doesn't accept orders")
	}
}

func TestWarehouseService_GetWarehouse_NotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	_, err := service.GetWarehouse(ctx, "nonexistent")
	if err != ErrWarehouseNotFound {
		t.Errorf("Expected ErrWarehouseNotFound, got %v", err)
	}
}

func TestWarehouseService_GetStock_NotFound(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	_, err := service.GetStock(ctx, "wh1", "nonexistent")
	if err != ErrProductNotFound {
		t.Errorf("Expected ErrProductNotFound, got %v", err)
	}
}

func TestWarehouseService_GetProductStock_NoStocks(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	stocks, err := service.GetProductStock(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(stocks) != 0 {
		t.Errorf("Expected 0 stocks, got %d", len(stocks))
	}
}

func TestWarehouseService_GetTotalAvailable_NoStocks(t *testing.T) {
	repo := newMockWarehouseRepository()
	service := NewWarehouseService(repo)
	ctx := context.Background()

	total, err := service.GetTotalAvailable(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if total != 0 {
		t.Errorf("Expected 0 total, got %d", total)
	}
}

// Mock repository for testing
type mockWarehouseRepository struct {
	warehouses    map[string]*Warehouse
	stocks        map[string]*Stock
	productStocks map[string][]*Stock
	movements     []*StockMovement
	reservations  map[string]*StockReservation
}

func newMockWarehouseRepository() *mockWarehouseRepository {
	return &mockWarehouseRepository{
		warehouses:    make(map[string]*Warehouse),
		stocks:        make(map[string]*Stock),
		productStocks: make(map[string][]*Stock),
		movements:     make([]*StockMovement, 0),
		reservations:  make(map[string]*StockReservation),
	}
}

func (r *mockWarehouseRepository) CreateWarehouse(ctx context.Context, w *Warehouse) error {
	r.warehouses[w.ID] = w
	return nil
}

func (r *mockWarehouseRepository) UpdateWarehouse(ctx context.Context, w *Warehouse) error {
	r.warehouses[w.ID] = w
	return nil
}

func (r *mockWarehouseRepository) DeleteWarehouse(ctx context.Context, id string) error {
	delete(r.warehouses, id)
	return nil
}

func (r *mockWarehouseRepository) GetWarehouse(ctx context.Context, id string) (*Warehouse, error) {
	if w, ok := r.warehouses[id]; ok {
		return w, nil
	}
	return nil, ErrWarehouseNotFound
}

func (r *mockWarehouseRepository) GetWarehouseByCode(ctx context.Context, code string) (*Warehouse, error) {
	for _, w := range r.warehouses {
		if w.Code == code {
			return w, nil
		}
	}
	return nil, ErrWarehouseNotFound
}

func (r *mockWarehouseRepository) ListWarehouses(ctx context.Context, activeOnly bool) ([]*Warehouse, error) {
	result := make([]*Warehouse, 0)
	for _, w := range r.warehouses {
		if !activeOnly || w.IsActive {
			result = append(result, w)
		}
	}
	return result, nil
}

func (r *mockWarehouseRepository) GetDefaultWarehouse(ctx context.Context) (*Warehouse, error) {
	for _, w := range r.warehouses {
		if w.IsDefault {
			return w, nil
		}
	}
	return nil, ErrWarehouseNotFound
}

func (r *mockWarehouseRepository) GetStock(ctx context.Context, warehouseID, productID string) (*Stock, error) {
	key := warehouseID + ":" + productID
	if s, ok := r.stocks[key]; ok {
		return s, nil
	}
	return nil, ErrProductNotFound
}

func (r *mockWarehouseRepository) GetStockByProduct(ctx context.Context, productID string) ([]*Stock, error) {
	if stocks, ok := r.productStocks[productID]; ok {
		return stocks, nil
	}

	result := make([]*Stock, 0)
	for key, stock := range r.stocks {
		if stock.ProductID == productID {
			result = append(result, stock)
		}
		_ = key
	}
	return result, nil
}

func (r *mockWarehouseRepository) GetStockByWarehouse(ctx context.Context, warehouseID string, limit, offset int) ([]*Stock, error) {
	result := make([]*Stock, 0)
	for _, stock := range r.stocks {
		if stock.WarehouseID == warehouseID {
			result = append(result, stock)
		}
	}
	return result, nil
}

func (r *mockWarehouseRepository) UpdateStock(ctx context.Context, stock *Stock) error {
	key := stock.WarehouseID + ":" + stock.ProductID
	r.stocks[key] = stock
	return nil
}

func (r *mockWarehouseRepository) GetLowStock(ctx context.Context, warehouseID string) ([]*Stock, error) {
	return nil, nil
}

func (r *mockWarehouseRepository) GetTotalStock(ctx context.Context, productID string) (int, error) {
	total := 0
	for _, stock := range r.stocks {
		if stock.ProductID == productID {
			total += stock.Quantity
		}
	}
	return total, nil
}

func (r *mockWarehouseRepository) CreateMovement(ctx context.Context, m *StockMovement) error {
	r.movements = append(r.movements, m)
	return nil
}

func (r *mockWarehouseRepository) ListMovements(ctx context.Context, warehouseID string, from, to time.Time, limit int) ([]*StockMovement, error) {
	return r.movements, nil
}

func (r *mockWarehouseRepository) CreateReservation(ctx context.Context, res *StockReservation) error {
	r.reservations[res.ID] = res
	return nil
}

func (r *mockWarehouseRepository) GetReservation(ctx context.Context, id string) (*StockReservation, error) {
	if res, ok := r.reservations[id]; ok {
		return res, nil
	}
	return nil, ErrProductNotFound
}

func (r *mockWarehouseRepository) GetReservationsByOrder(ctx context.Context, orderID string) ([]*StockReservation, error) {
	result := make([]*StockReservation, 0)
	for _, res := range r.reservations {
		if res.OrderID == orderID {
			result = append(result, res)
		}
	}
	return result, nil
}

func (r *mockWarehouseRepository) UpdateReservation(ctx context.Context, res *StockReservation) error {
	r.reservations[res.ID] = res
	return nil
}

func (r *mockWarehouseRepository) DeleteExpiredReservations(ctx context.Context) error {
	return nil
}

func (r *mockWarehouseRepository) CreateTransfer(ctx context.Context, t *TransferRequest) error {
	return nil
}

func (r *mockWarehouseRepository) UpdateTransfer(ctx context.Context, t *TransferRequest) error {
	return nil
}

func (r *mockWarehouseRepository) GetTransfer(ctx context.Context, id string) (*TransferRequest, error) {
	return nil, nil
}

func (r *mockWarehouseRepository) ListTransfers(ctx context.Context, status string, limit int) ([]*TransferRequest, error) {
	return nil, nil
}
