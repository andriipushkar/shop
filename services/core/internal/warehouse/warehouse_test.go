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
