package warehouse

import (
	"context"
	"errors"
	"testing"
)

// MockSplitShipmentRepository implements SplitShipmentRepository for testing
type mockSplitShipmentRepository struct {
	plans     map[string]*ShipmentPlan
	rates     []*ShippingRate
	distances []*WarehouseDistance
}

func newMockSplitShipmentRepository() *mockSplitShipmentRepository {
	return &mockSplitShipmentRepository{
		plans:     make(map[string]*ShipmentPlan),
		rates:     []*ShippingRate{},
		distances: []*WarehouseDistance{},
	}
}

func (m *mockSplitShipmentRepository) CreateShipmentPlan(ctx context.Context, plan *ShipmentPlan) error {
	m.plans[plan.ID] = plan
	return nil
}

func (m *mockSplitShipmentRepository) UpdateShipmentPlan(ctx context.Context, plan *ShipmentPlan) error {
	m.plans[plan.ID] = plan
	return nil
}

func (m *mockSplitShipmentRepository) GetShipmentPlan(ctx context.Context, id string) (*ShipmentPlan, error) {
	if plan, ok := m.plans[id]; ok {
		return plan, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockSplitShipmentRepository) GetShipmentPlanByOrder(ctx context.Context, orderID string) (*ShipmentPlan, error) {
	for _, plan := range m.plans {
		if plan.OrderID == orderID {
			return plan, nil
		}
	}
	return nil, ErrProductNotFound
}

func (m *mockSplitShipmentRepository) ListShipmentPlans(ctx context.Context, status string, limit int) ([]*ShipmentPlan, error) {
	result := make([]*ShipmentPlan, 0)
	for _, plan := range m.plans {
		result = append(result, plan)
		if len(result) >= limit {
			break
		}
	}
	return result, nil
}

func (m *mockSplitShipmentRepository) GetShippingRates(ctx context.Context, warehouseID, destinationZip string, weight float64) ([]*ShippingRate, error) {
	return m.rates, nil
}

func (m *mockSplitShipmentRepository) GetWarehouseDistances(ctx context.Context, destinationLat, destinationLng float64) ([]*WarehouseDistance, error) {
	if m.distances == nil {
		return nil, errors.New("no warehouse distances available")
	}
	return m.distances, nil
}

// Tests

func TestSplitShipmentService_NewService(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{
		AllowSplit:   true,
		MaxShipments: 3,
	}

	service := NewSplitShipmentService(repo, warehouseRepo, config)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
}

func TestSplitShipmentService_NewService_DefaultConfig(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{} // Empty config

	service := NewSplitShipmentService(repo, warehouseRepo, config)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
	if service.config.MaxShipments != 3 {
		t.Errorf("Expected default MaxShipments 3, got %d", service.config.MaxShipments)
	}
	if service.config.MinItemsPerShipment != 1 {
		t.Errorf("Expected default MinItemsPerShipment 1, got %d", service.config.MinItemsPerShipment)
	}
}

func TestSplitShipmentService_PlanShipment_NoItems(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	_, err := service.PlanShipment(ctx, "order1", []OrderItem{}, 50.0, 30.0, StrategyBalanced)
	if err == nil {
		t.Error("Expected error for empty items")
	}
}

func TestSplitShipmentService_PlanShipment_SingleWarehouse(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup stock in warehouse
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    100,
		Available:   100,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1-prod1"]}

	// Setup distances
	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 10, ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Name: "Product 1", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	plan, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if plan.IsSplit {
		t.Error("Expected single warehouse shipment, not split")
	}
	if len(plan.Shipments) != 1 {
		t.Errorf("Expected 1 shipment, got %d", len(plan.Shipments))
	}
	if plan.Shipments[0].WarehouseID != "wh1" {
		t.Errorf("Expected warehouse 'wh1', got %s", plan.Shipments[0].WarehouseID)
	}
}

func TestSplitShipmentService_PlanShipment_SplitNotAllowed(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: false}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup partial stock - no single warehouse can fulfill
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    5,
		Available:   5,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1-prod1"]}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 10, ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", Quantity: 10}, // Need 10, only 5 available
	}

	_, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err != ErrSplitNotAllowed {
		t.Errorf("Expected ErrSplitNotAllowed, got %v", err)
	}
}

func TestSplitShipmentService_ApproveShipmentPlan(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Create a plan
	plan := &ShipmentPlan{
		ID:      "plan1",
		OrderID: "order1",
		Shipments: []PlannedShipment{
			{ID: "ship1", Status: "planned"},
		},
	}
	repo.plans["plan1"] = plan

	err := service.ApproveShipmentPlan(ctx, "plan1", "approver1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPlan := repo.plans["plan1"]
	if updatedPlan.ApprovedBy != "approver1" {
		t.Errorf("Expected approver 'approver1', got %s", updatedPlan.ApprovedBy)
	}
	if updatedPlan.ApprovedAt == nil {
		t.Error("Expected ApprovedAt to be set")
	}
	if updatedPlan.Shipments[0].Status != "picking" {
		t.Errorf("Expected status 'picking', got %s", updatedPlan.Shipments[0].Status)
	}
}

func TestSplitShipmentService_UpdateShipmentStatus(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	plan := &ShipmentPlan{
		ID:      "plan1",
		OrderID: "order1",
		Shipments: []PlannedShipment{
			{ID: "ship1", Status: "picking"},
		},
	}
	repo.plans["plan1"] = plan

	err := service.UpdateShipmentStatus(ctx, "plan1", "ship1", "shipped", "TRACK123")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPlan := repo.plans["plan1"]
	if updatedPlan.Shipments[0].Status != "shipped" {
		t.Errorf("Expected status 'shipped', got %s", updatedPlan.Shipments[0].Status)
	}
	if updatedPlan.Shipments[0].TrackingNumber != "TRACK123" {
		t.Errorf("Expected tracking 'TRACK123', got %s", updatedPlan.Shipments[0].TrackingNumber)
	}
	if updatedPlan.Shipments[0].ShippedAt == nil {
		t.Error("Expected ShippedAt to be set")
	}
}

func TestSplitShipmentService_UpdateShipmentStatus_Delivered(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	plan := &ShipmentPlan{
		ID:      "plan1",
		OrderID: "order1",
		Shipments: []PlannedShipment{
			{ID: "ship1", Status: "shipped"},
		},
	}
	repo.plans["plan1"] = plan

	err := service.UpdateShipmentStatus(ctx, "plan1", "ship1", "delivered", "")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPlan := repo.plans["plan1"]
	if updatedPlan.Shipments[0].DeliveredAt == nil {
		t.Error("Expected DeliveredAt to be set")
	}
}

func TestSplitShipmentService_GetShipmentPlan(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	plan := &ShipmentPlan{ID: "plan1", OrderID: "order1"}
	repo.plans["plan1"] = plan

	result, err := service.GetShipmentPlan(ctx, "plan1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result.ID != "plan1" {
		t.Errorf("Expected plan ID 'plan1', got %s", result.ID)
	}
}

func TestSplitShipmentService_GetShipmentPlanByOrder(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	plan := &ShipmentPlan{ID: "plan1", OrderID: "order1"}
	repo.plans["plan1"] = plan

	result, err := service.GetShipmentPlanByOrder(ctx, "order1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result.OrderID != "order1" {
		t.Errorf("Expected order ID 'order1', got %s", result.OrderID)
	}
}

func TestSplitShipmentService_CanShipFromSingleWarehouse(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup sufficient stock
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    100,
		Available:   100,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1-prod1"]}
	warehouseRepo.warehouses["wh1"] = &Warehouse{ID: "wh1", Name: "Main Warehouse"}

	items := []OrderItem{
		{ProductID: "prod1", Quantity: 10},
	}

	canShip, warehouseName, err := service.CanShipFromSingleWarehouse(ctx, items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !canShip {
		t.Error("Expected can ship from single warehouse")
	}
	if warehouseName != "Main Warehouse" {
		t.Errorf("Expected 'Main Warehouse', got %s", warehouseName)
	}
}

func TestSplitShipmentService_CanShipFromSingleWarehouse_InsufficientStock(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup insufficient stock
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    5,
		Available:   5,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1-prod1"]}

	items := []OrderItem{
		{ProductID: "prod1", Quantity: 10},
	}

	canShip, _, err := service.CanShipFromSingleWarehouse(ctx, items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if canShip {
		t.Error("Expected cannot ship from single warehouse")
	}
}

func TestSplitShipmentService_ConsolidateShipments(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Test with single shipment (nothing to consolidate)
	plan := &ShipmentPlan{
		ID:      "plan1",
		OrderID: "order1",
		Shipments: []PlannedShipment{
			{ID: "ship1"},
		},
	}
	repo.plans["plan1"] = plan

	err := service.ConsolidateShipments(ctx, "plan1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestSplitShipmentService_CalculatePartialShipment(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup partial stock
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    5,
		Available:   5,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1-prod1"]}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 10, ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	plan, backordered, err := service.CalculatePartialShipment(ctx, "order1", items, 50.0, 30.0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if plan == nil {
		t.Fatal("Expected plan to be created")
	}

	// Should have backorder for 5 items
	if len(backordered) != 1 {
		t.Fatalf("Expected 1 backordered item, got %d", len(backordered))
	}
	if backordered[0].Quantity != 5 {
		t.Errorf("Expected 5 backordered, got %d", backordered[0].Quantity)
	}
}

func TestSplitShipmentService_CalculatePartialShipment_AllBackordered(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// No stock available
	warehouseRepo.productStocks["prod1"] = []*Stock{}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 10, ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10},
	}

	plan, backordered, err := service.CalculatePartialShipment(ctx, "order1", items, 50.0, 30.0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if plan != nil {
		t.Error("Expected nil plan when all items backordered")
	}
	if len(backordered) != 1 {
		t.Errorf("Expected 1 backordered item, got %d", len(backordered))
	}
}

func TestSplitShipmentService_GetShipmentOptions(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup stock
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    100,
		Available:   100,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1-prod1"]}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 10, ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	options, err := service.GetShipmentOptions(ctx, "order1", items, 50.0, 30.0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(options) == 0 {
		t.Error("Expected at least one shipping option")
	}
}

func TestSplitShipmentService_PlanShipment_FastestStrategy(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup stock in multiple warehouses
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID: "stock1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Available: 100,
	}
	warehouseRepo.stocks["wh2-prod1"] = &Stock{
		ID: "stock2", WarehouseID: "wh2", ProductID: "prod1", Quantity: 100, Available: 100,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{
		warehouseRepo.stocks["wh1-prod1"],
		warehouseRepo.stocks["wh2-prod1"],
	}

	// wh2 is faster but more expensive
	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 100, ShippingCost: 30, EstimatedDays: 5},
		{WarehouseID: "wh2", WarehouseName: "Warehouse 2", Distance: 10, ShippingCost: 100, EstimatedDays: 1},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	plan, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyFastest)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should choose wh2 (faster)
	if plan.Shipments[0].WarehouseID != "wh2" {
		t.Errorf("Expected warehouse 'wh2' for fastest strategy, got %s", plan.Shipments[0].WarehouseID)
	}
}

func TestSplitShipmentService_PlanShipment_CheapestStrategy(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	config := SplitConfig{AllowSplit: true}
	service := NewSplitShipmentService(repo, warehouseRepo, config)
	ctx := context.Background()

	// Setup stock in multiple warehouses
	warehouseRepo.stocks["wh1-prod1"] = &Stock{
		ID: "stock1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Available: 100,
	}
	warehouseRepo.stocks["wh2-prod1"] = &Stock{
		ID: "stock2", WarehouseID: "wh2", ProductID: "prod1", Quantity: 100, Available: 100,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{
		warehouseRepo.stocks["wh1-prod1"],
		warehouseRepo.stocks["wh2-prod1"],
	}

	// wh1 is cheaper but slower
	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 100, ShippingCost: 30, EstimatedDays: 5},
		{WarehouseID: "wh2", WarehouseName: "Warehouse 2", Distance: 10, ShippingCost: 100, EstimatedDays: 1},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	plan, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyCheapest)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should choose wh1 (cheaper)
	if plan.Shipments[0].WarehouseID != "wh1" {
		t.Errorf("Expected warehouse 'wh1' for cheapest strategy, got %s", plan.Shipments[0].WarehouseID)
	}
}

func TestSplitShipmentService_CalculateSplitPlan(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{
		AllowSplit:     true,
		MaxShipments:   5,
		MinItemsPerShipment: 1,
	})
	ctx := context.Background()

	// Setup warehouses and stock - each warehouse has partial stock
	warehouseRepo.warehouses["wh1"] = &Warehouse{ID: "wh1", Name: "Warehouse 1", IsActive: true}
	warehouseRepo.warehouses["wh2"] = &Warehouse{ID: "wh2", Name: "Warehouse 2", IsActive: true}

	// wh1 has prod1 but not prod2
	warehouseRepo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Available: 20}
	// wh2 has prod2 but not prod1
	warehouseRepo.stocks["wh2:prod2"] = &Stock{ID: "s2", WarehouseID: "wh2", ProductID: "prod2", Available: 15}

	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1:prod1"]}
	warehouseRepo.productStocks["prod2"] = []*Stock{warehouseRepo.stocks["wh2:prod2"]}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", Distance: 50, ShippingCost: 20, EstimatedDays: 2},
		{WarehouseID: "wh2", WarehouseName: "Warehouse 2", Distance: 100, ShippingCost: 30, EstimatedDays: 3},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 5, UnitPrice: 100, Weight: 1.0},
		{ProductID: "prod2", SKU: "SKU002", Quantity: 10, UnitPrice: 50, Weight: 0.5},
	}

	plan, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should split into 2 shipments
	if !plan.IsSplit {
		t.Error("Expected plan to be split")
	}
	if len(plan.Shipments) != 2 {
		t.Errorf("Expected 2 shipments, got %d", len(plan.Shipments))
	}
}

// Edge case tests for increased coverage

func TestSplitShipmentService_PlanShipment_GetWarehouseDistancesError(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: true})
	ctx := context.Background()

	// Setup to return error from GetWarehouseDistances
	repo.distances = nil

	items := []OrderItem{
		{ProductID: "prod1", Quantity: 10},
	}

	_, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err == nil {
		t.Error("Expected error when GetWarehouseDistances fails")
	}
}

func TestSplitShipmentService_CalculateSplitPlan_WithCombinedShippingDiscount(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{
		AllowSplit:               true,
		MaxShipments:             5,
		MinItemsPerShipment:      1,
		CombinedShippingDiscount: 10.0, // 10% discount
	})
	ctx := context.Background()

	// Setup multiple warehouses with partial stock
	warehouseRepo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Available: 5}
	warehouseRepo.stocks["wh2:prod1"] = &Stock{ID: "s2", WarehouseID: "wh2", ProductID: "prod1", Available: 5}
	warehouseRepo.productStocks["prod1"] = []*Stock{
		warehouseRepo.stocks["wh1:prod1"],
		warehouseRepo.stocks["wh2:prod1"],
	}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "WH1", ShippingCost: 100, EstimatedDays: 2},
		{WarehouseID: "wh2", WarehouseName: "WH2", ShippingCost: 100, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	plan, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Total cost should be 200 - 10% = 180
	expectedCost := 180.0
	if plan.TotalCost != expectedCost {
		t.Errorf("Expected total cost %.2f with discount, got %.2f", expectedCost, plan.TotalCost)
	}
}

func TestSplitShipmentService_CalculateSplitPlan_CannotFulfillProduct(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{
		AllowSplit:          true,
		MaxShipments:        5,
		MinItemsPerShipment: 1,
	})
	ctx := context.Background()

	// Setup insufficient stock
	warehouseRepo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Available: 5}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1:prod1"]}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "WH1", ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0}, // Need 10, only have 5
	}

	_, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err == nil {
		t.Error("Expected error when product cannot be fulfilled")
	}
}

func TestSplitShipmentService_CalculateSplitPlan_NoDistanceInfo(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{
		AllowSplit:          true,
		MinItemsPerShipment: 1,
	})
	ctx := context.Background()

	// Setup stock but make sure GetWarehouseDistances returns error (nil)
	warehouseRepo.stocks["wh1:prod1"] = &Stock{ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Available: 10}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1:prod1"]}

	// Set distances to nil to trigger error in GetWarehouseDistances
	repo.distances = nil

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	_, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err == nil {
		t.Error("Expected error when no distance info available")
	}
}

func TestSplitShipmentService_GetShipmentOptions_NoAvailableStock(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: true})
	ctx := context.Background()

	// No stock available
	warehouseRepo.productStocks["prod1"] = []*Stock{}
	repo.distances = []*WarehouseDistance{}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10},
	}

	_, err := service.GetShipmentOptions(ctx, "order1", items, 50.0, 30.0)
	if err != ErrNoAvailableStock {
		t.Errorf("Expected ErrNoAvailableStock, got %v", err)
	}
}

func TestSplitShipmentService_ConsolidateShipments_MultipleShipments(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: true})
	ctx := context.Background()

	// Test with multiple shipments
	plan := &ShipmentPlan{
		ID:      "plan1",
		OrderID: "order1",
		Shipments: []PlannedShipment{
			{ID: "ship1", WarehouseID: "wh1"},
			{ID: "ship2", WarehouseID: "wh2"},
		},
	}
	repo.plans["plan1"] = plan

	err := service.ConsolidateShipments(ctx, "plan1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestSplitShipmentService_ApproveShipmentPlan_NotFound(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: true})
	ctx := context.Background()

	err := service.ApproveShipmentPlan(ctx, "nonexistent", "approver1")
	if err == nil {
		t.Error("Expected error for nonexistent plan")
	}
}

func TestSplitShipmentService_UpdateShipmentStatus_NotFound(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: true})
	ctx := context.Background()

	err := service.UpdateShipmentStatus(ctx, "nonexistent", "ship1", "shipped", "TRACK123")
	if err == nil {
		t.Error("Expected error for nonexistent plan")
	}
}

func TestSplitShipmentService_PlanShipment_SingleWarehouseStrategy(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: true})
	ctx := context.Background()

	// Setup stock in single warehouse
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Quantity: 100, Available: 100,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1:prod1"]}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "Warehouse 1", ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10, UnitPrice: 100, Weight: 1.0},
	}

	plan, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategySingleWarehouse)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if plan.IsSplit {
		t.Error("Expected single warehouse shipment")
	}
}

func TestSplitShipmentService_TrySingleWarehouse_NoCandidates(t *testing.T) {
	repo := newMockSplitShipmentRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: true})
	ctx := context.Background()

	// Setup insufficient stock in all warehouses
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		ID: "s1", WarehouseID: "wh1", ProductID: "prod1", Available: 5,
	}
	warehouseRepo.productStocks["prod1"] = []*Stock{warehouseRepo.stocks["wh1:prod1"]}

	repo.distances = []*WarehouseDistance{
		{WarehouseID: "wh1", WarehouseName: "WH1", ShippingCost: 50, EstimatedDays: 2},
	}

	items := []OrderItem{
		{ProductID: "prod1", Quantity: 10}, // Need 10, only have 5
	}

	// This should return split not allowed error since single warehouse cannot fulfill
	_, err := service.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
	if err != ErrSplitNotAllowed {
		// If split is allowed in config, it should try to split
		service2 := NewSplitShipmentService(repo, warehouseRepo, SplitConfig{AllowSplit: false})
		_, err2 := service2.PlanShipment(ctx, "order1", items, 50.0, 30.0, StrategyBalanced)
		if err2 != ErrSplitNotAllowed {
			t.Errorf("Expected ErrSplitNotAllowed when split not allowed, got %v", err2)
		}
	}
}
