package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockKittingRepository implements KittingRepository for testing
type mockKittingRepository struct {
	kits              map[string]*Kit
	kitStocks         map[string]*KitStock // key: kitID:warehouseID
	assemblyOrders    map[string]*AssemblyOrder
	disassemblyOrders map[string]*DisassemblyOrder
}

func newMockKittingRepository() *mockKittingRepository {
	return &mockKittingRepository{
		kits:              make(map[string]*Kit),
		kitStocks:         make(map[string]*KitStock),
		assemblyOrders:    make(map[string]*AssemblyOrder),
		disassemblyOrders: make(map[string]*DisassemblyOrder),
	}
}

func (m *mockKittingRepository) CreateKit(ctx context.Context, kit *Kit) error {
	m.kits[kit.ID] = kit
	return nil
}

func (m *mockKittingRepository) UpdateKit(ctx context.Context, kit *Kit) error {
	m.kits[kit.ID] = kit
	return nil
}

func (m *mockKittingRepository) GetKit(ctx context.Context, id string) (*Kit, error) {
	if k, ok := m.kits[id]; ok {
		return k, nil
	}
	return nil, ErrKitNotFound
}

func (m *mockKittingRepository) GetKitBySKU(ctx context.Context, sku string) (*Kit, error) {
	for _, k := range m.kits {
		if k.SKU == sku {
			return k, nil
		}
	}
	return nil, ErrKitNotFound
}

func (m *mockKittingRepository) ListKits(ctx context.Context, activeOnly bool, limit, offset int) ([]*Kit, error) {
	result := make([]*Kit, 0)
	for _, k := range m.kits {
		if !activeOnly || k.IsActive {
			result = append(result, k)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockKittingRepository) DeleteKit(ctx context.Context, id string) error {
	delete(m.kits, id)
	return nil
}

func kitStockKey(kitID, warehouseID string) string {
	return kitID + ":" + warehouseID
}

func (m *mockKittingRepository) GetKitStock(ctx context.Context, kitID, warehouseID string) (*KitStock, error) {
	key := kitStockKey(kitID, warehouseID)
	if ks, ok := m.kitStocks[key]; ok {
		return ks, nil
	}
	return nil, ErrKitNotFound
}

func (m *mockKittingRepository) UpdateKitStock(ctx context.Context, stock *KitStock) error {
	key := kitStockKey(stock.KitID, stock.WarehouseID)
	m.kitStocks[key] = stock
	return nil
}

func (m *mockKittingRepository) CreateAssemblyOrder(ctx context.Context, order *AssemblyOrder) error {
	m.assemblyOrders[order.ID] = order
	return nil
}

func (m *mockKittingRepository) UpdateAssemblyOrder(ctx context.Context, order *AssemblyOrder) error {
	m.assemblyOrders[order.ID] = order
	return nil
}

func (m *mockKittingRepository) GetAssemblyOrder(ctx context.Context, id string) (*AssemblyOrder, error) {
	if o, ok := m.assemblyOrders[id]; ok {
		return o, nil
	}
	return nil, ErrKitNotFound
}

func (m *mockKittingRepository) ListAssemblyOrders(ctx context.Context, status string, warehouseID string, limit int) ([]*AssemblyOrder, error) {
	result := make([]*AssemblyOrder, 0)
	for _, o := range m.assemblyOrders {
		if (status == "" || o.Status == status) && (warehouseID == "" || o.WarehouseID == warehouseID) {
			result = append(result, o)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockKittingRepository) CreateDisassemblyOrder(ctx context.Context, order *DisassemblyOrder) error {
	m.disassemblyOrders[order.ID] = order
	return nil
}

func (m *mockKittingRepository) UpdateDisassemblyOrder(ctx context.Context, order *DisassemblyOrder) error {
	m.disassemblyOrders[order.ID] = order
	return nil
}

func (m *mockKittingRepository) GetDisassemblyOrder(ctx context.Context, id string) (*DisassemblyOrder, error) {
	if o, ok := m.disassemblyOrders[id]; ok {
		return o, nil
	}
	return nil, ErrKitNotFound
}

func (m *mockKittingRepository) ListDisassemblyOrders(ctx context.Context, status string, limit int) ([]*DisassemblyOrder, error) {
	result := make([]*DisassemblyOrder, 0)
	for _, o := range m.disassemblyOrders {
		if status == "" || o.Status == status {
			result = append(result, o)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// Tests

func TestKittingService_CreateKit(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kit := &Kit{
		SKU:  "KIT001",
		Name: "Gift Set",
		Type: KitTypeBundle,
		Components: []KitComponent{
			{ProductID: "prod1", SKU: "SKU001", Name: "Product 1", Quantity: 2, UnitCost: 10.00, IsRequired: true},
			{ProductID: "prod2", SKU: "SKU002", Name: "Product 2", Quantity: 1, UnitCost: 20.00, IsRequired: true},
		},
		Price:    50.00,
		IsActive: true,
	}

	err := service.CreateKit(ctx, kit)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if kit.ID == "" {
		t.Error("Expected kit ID to be set")
	}
	// Component cost: (2 * 10.00) + (1 * 20.00) = 40.00
	if kit.ComponentCost != 40.00 {
		t.Errorf("Expected component cost 40.00, got %.2f", kit.ComponentCost)
	}
}

func TestKittingService_UpdateKit(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{
		ID:   "kit1",
		Name: "Original Kit",
		Components: []KitComponent{
			{ProductID: "prod1", Quantity: 1, UnitCost: 10.00},
		},
	}

	kit := &Kit{
		ID:   "kit1",
		Name: "Updated Kit",
		Components: []KitComponent{
			{ProductID: "prod1", Quantity: 2, UnitCost: 15.00},
		},
	}

	err := service.UpdateKit(ctx, kit)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if kit.ComponentCost != 30.00 {
		t.Errorf("Expected component cost 30.00, got %.2f", kit.ComponentCost)
	}
}

func TestKittingService_GetKit(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{ID: "kit1", Name: "Test Kit"}

	kit, err := service.GetKit(ctx, "kit1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if kit.Name != "Test Kit" {
		t.Errorf("Expected name 'Test Kit', got %s", kit.Name)
	}
}

func TestKittingService_ListKits(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{ID: "kit1", IsActive: true}
	kittingRepo.kits["kit2"] = &Kit{ID: "kit2", IsActive: false}

	active, err := service.ListKits(ctx, true, 10, 0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(active) != 1 {
		t.Errorf("Expected 1 active kit, got %d", len(active))
	}
}

func TestKittingService_GetKitAvailability(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{
		ID:   "kit1",
		Name: "Test Kit",
		Components: []KitComponent{
			{ProductID: "prod1", SKU: "SKU001", Name: "Component 1", Quantity: 2, IsRequired: true},
			{ProductID: "prod2", SKU: "SKU002", Name: "Component 2", Quantity: 1, IsRequired: true},
		},
	}

	// Pre-assembled kits
	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    5,
		Reserved:    0,
		Available:   5,
	}

	// Component stock
	warehouseRepo.stocks["wh1:prod1"] = &Stock{WarehouseID: "wh1", ProductID: "prod1", Quantity: 20, Available: 20}
	warehouseRepo.stocks["wh1:prod2"] = &Stock{WarehouseID: "wh1", ProductID: "prod2", Quantity: 8, Available: 8}

	availability, err := service.GetKitAvailability(ctx, "kit1", "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if availability.PreAssembled != 5 {
		t.Errorf("Expected 5 pre-assembled, got %d", availability.PreAssembled)
	}

	// Can assemble: min(20/2, 8/1) = min(10, 8) = 8
	if availability.CanAssemble != 8 {
		t.Errorf("Expected can assemble 8, got %d", availability.CanAssemble)
	}

	if availability.TotalAvailable != 13 {
		t.Errorf("Expected total available 13, got %d", availability.TotalAvailable)
	}

	if availability.Bottleneck == nil {
		t.Error("Expected bottleneck to be identified")
	}
}

func TestKittingService_CreateAssemblyOrder(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{
		ID:   "kit1",
		Name: "Test Kit",
		Components: []KitComponent{
			{ProductID: "prod1", Quantity: 1, IsRequired: true},
		},
	}

	warehouseRepo.stocks["wh1:prod1"] = &Stock{WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Available: 100}

	order, err := service.CreateAssemblyOrder(ctx, "kit1", "wh1", "user1", 10, 1)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if order.KitID != "kit1" {
		t.Errorf("Expected kit ID 'kit1', got %s", order.KitID)
	}
	if order.Quantity != 10 {
		t.Errorf("Expected quantity 10, got %d", order.Quantity)
	}
	if order.Status != "pending" {
		t.Errorf("Expected status 'pending', got %s", order.Status)
	}
}

func TestKittingService_CreateAssemblyOrder_InsufficientComponents(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{
		ID: "kit1",
		Components: []KitComponent{
			{ProductID: "prod1", Quantity: 10, IsRequired: true},
		},
	}

	warehouseRepo.stocks["wh1:prod1"] = &Stock{WarehouseID: "wh1", ProductID: "prod1", Quantity: 5, Available: 5}

	_, err := service.CreateAssemblyOrder(ctx, "kit1", "wh1", "user1", 1, 1)
	if err != ErrInsufficientComponents {
		t.Errorf("Expected ErrInsufficientComponents, got %v", err)
	}
}

func TestKittingService_StartAssembly(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.assemblyOrders["ao1"] = &AssemblyOrder{
		ID:     "ao1",
		Status: "pending",
	}

	err := service.StartAssembly(ctx, "ao1", "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	order, _ := kittingRepo.GetAssemblyOrder(ctx, "ao1")
	if order.Status != "in_progress" {
		t.Errorf("Expected status 'in_progress', got %s", order.Status)
	}
	if order.AssignedTo != "worker1" {
		t.Errorf("Expected assigned to 'worker1', got %s", order.AssignedTo)
	}
}

func TestKittingService_CompleteAssembly(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{
		ID: "kit1",
		Components: []KitComponent{
			{ProductID: "prod1", SKU: "SKU001", Quantity: 2},
		},
	}

	kittingRepo.assemblyOrders["ao1"] = &AssemblyOrder{
		ID:          "ao1",
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    5,
		Status:      "in_progress",
	}

	// Component stock
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    50,
		Available:   50,
	}

	componentsUsed := []ComponentUsage{
		{ProductID: "prod1", SKU: "SKU001", Required: 10, Used: 10},
	}

	err := service.CompleteAssembly(ctx, "ao1", componentsUsed)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	order, _ := kittingRepo.GetAssemblyOrder(ctx, "ao1")
	if order.Status != "completed" {
		t.Errorf("Expected status 'completed', got %s", order.Status)
	}

	// Verify component stock decreased
	stock, _ := warehouseRepo.GetStock(ctx, "wh1", "prod1")
	if stock.Quantity != 40 { // 50 - (5 kits * 2 per kit) = 40
		t.Errorf("Expected component quantity 40, got %d", stock.Quantity)
	}

	// Verify kit stock increased
	kitStock, _ := kittingRepo.GetKitStock(ctx, "kit1", "wh1")
	if kitStock.Quantity != 5 {
		t.Errorf("Expected kit quantity 5, got %d", kitStock.Quantity)
	}
}

func TestKittingService_CancelAssembly(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.assemblyOrders["ao1"] = &AssemblyOrder{
		ID:     "ao1",
		Status: "pending",
	}

	err := service.CancelAssembly(ctx, "ao1", "Out of components")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	order, _ := kittingRepo.GetAssemblyOrder(ctx, "ao1")
	if order.Status != "cancelled" {
		t.Errorf("Expected status 'cancelled', got %s", order.Status)
	}
}

func TestKittingService_CancelAssembly_Completed(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.assemblyOrders["ao1"] = &AssemblyOrder{
		ID:     "ao1",
		Status: "completed",
	}

	err := service.CancelAssembly(ctx, "ao1", "Test")
	if err == nil {
		t.Error("Expected error when cancelling completed order")
	}
}

func TestKittingService_CreateDisassemblyOrder(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{ID: "kit1", Name: "Test Kit"}
	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    10,
		Available:   10,
	}

	order, err := service.CreateDisassemblyOrder(ctx, "kit1", "wh1", "user1", "Excess inventory", 5)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if order.Quantity != 5 {
		t.Errorf("Expected quantity 5, got %d", order.Quantity)
	}
	if order.Reason != "Excess inventory" {
		t.Errorf("Expected reason 'Excess inventory', got %s", order.Reason)
	}
}

func TestKittingService_CreateDisassemblyOrder_InsufficientStock(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{ID: "kit1"}
	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    3,
		Available:   3,
	}

	_, err := service.CreateDisassemblyOrder(ctx, "kit1", "wh1", "user1", "Test", 10)
	if err != ErrCannotDisassemble {
		t.Errorf("Expected ErrCannotDisassemble, got %v", err)
	}
}

func TestKittingService_CompleteDisassembly(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kits["kit1"] = &Kit{
		ID: "kit1",
		Components: []KitComponent{
			{ProductID: "prod1", SKU: "SKU001", Quantity: 2},
			{ProductID: "prod2", SKU: "SKU002", Quantity: 1},
		},
	}

	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    10,
		Available:   10,
	}

	kittingRepo.disassemblyOrders["do1"] = &DisassemblyOrder{
		ID:          "do1",
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    3,
		Status:      "pending",
	}

	componentsRecovered := []ComponentUsage{
		{ProductID: "prod1", Used: 6},
		{ProductID: "prod2", Used: 3},
	}

	err := service.CompleteDisassembly(ctx, "do1", componentsRecovered)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify kit stock decreased
	kitStock, _ := kittingRepo.GetKitStock(ctx, "kit1", "wh1")
	if kitStock.Quantity != 7 {
		t.Errorf("Expected kit quantity 7, got %d", kitStock.Quantity)
	}

	// Verify component stocks increased
	stock1, _ := warehouseRepo.GetStock(ctx, "wh1", "prod1")
	if stock1.Quantity != 6 {
		t.Errorf("Expected prod1 quantity 6, got %d", stock1.Quantity)
	}
}

func TestKittingService_ReserveKit(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    20,
		Reserved:    0,
		Available:   20,
	}

	err := service.ReserveKit(ctx, "kit1", "wh1", "ORD001", 5)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	kitStock, _ := kittingRepo.GetKitStock(ctx, "kit1", "wh1")
	if kitStock.Reserved != 5 {
		t.Errorf("Expected reserved 5, got %d", kitStock.Reserved)
	}
	if kitStock.Available != 15 {
		t.Errorf("Expected available 15, got %d", kitStock.Available)
	}
}

func TestKittingService_ReserveKit_InsufficientStock(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    5,
		Reserved:    0,
		Available:   5,
	}

	err := service.ReserveKit(ctx, "kit1", "wh1", "ORD001", 10)
	if err != ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}
}

func TestKittingService_ShipKit(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    20,
		Reserved:    5,
		Available:   15,
	}

	err := service.ShipKit(ctx, "kit1", "wh1", 5)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	kitStock, _ := kittingRepo.GetKitStock(ctx, "kit1", "wh1")
	if kitStock.Quantity != 15 {
		t.Errorf("Expected quantity 15, got %d", kitStock.Quantity)
	}
	if kitStock.Reserved != 0 {
		t.Errorf("Expected reserved 0, got %d", kitStock.Reserved)
	}
}

func TestKittingService_ShipKit_NotEnoughReserved(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.kitStocks["kit1:wh1"] = &KitStock{
		KitID:       "kit1",
		WarehouseID: "wh1",
		Quantity:    20,
		Reserved:    2,
		Available:   18,
	}

	err := service.ShipKit(ctx, "kit1", "wh1", 5)
	if err == nil {
		t.Error("Expected error for shipping more than reserved")
	}
}

func TestKittingService_ListAssemblyOrders(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	now := time.Now()
	kittingRepo.assemblyOrders["ao1"] = &AssemblyOrder{ID: "ao1", WarehouseID: "wh1", Status: "pending", CreatedAt: now}
	kittingRepo.assemblyOrders["ao2"] = &AssemblyOrder{ID: "ao2", WarehouseID: "wh1", Status: "completed", CreatedAt: now}
	kittingRepo.assemblyOrders["ao3"] = &AssemblyOrder{ID: "ao3", WarehouseID: "wh2", Status: "pending", CreatedAt: now}

	orders, err := service.ListAssemblyOrders(ctx, "pending", "wh1", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(orders) != 1 {
		t.Errorf("Expected 1 order, got %d", len(orders))
	}
}

func TestKittingService_ListDisassemblyOrders(t *testing.T) {
	kittingRepo := newMockKittingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewKittingService(kittingRepo, warehouseRepo)
	ctx := context.Background()

	kittingRepo.disassemblyOrders["do1"] = &DisassemblyOrder{ID: "do1", Status: "pending"}
	kittingRepo.disassemblyOrders["do2"] = &DisassemblyOrder{ID: "do2", Status: "completed"}

	orders, err := service.ListDisassemblyOrders(ctx, "pending", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(orders) != 1 {
		t.Errorf("Expected 1 order, got %d", len(orders))
	}
}
