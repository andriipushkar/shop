package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockCrossDockRepository implements CrossDockRepository for testing
type mockCrossDockRepository struct {
	orders       map[string]*CrossDockOrder
	docks        map[string]*Dock
	stagingAreas map[string]*StagingArea
}

func newMockCrossDockRepository() *mockCrossDockRepository {
	return &mockCrossDockRepository{
		orders:       make(map[string]*CrossDockOrder),
		docks:        make(map[string]*Dock),
		stagingAreas: make(map[string]*StagingArea),
	}
}

func (m *mockCrossDockRepository) CreateCrossDockOrder(ctx context.Context, order *CrossDockOrder) error {
	m.orders[order.ID] = order
	return nil
}

func (m *mockCrossDockRepository) UpdateCrossDockOrder(ctx context.Context, order *CrossDockOrder) error {
	m.orders[order.ID] = order
	return nil
}

func (m *mockCrossDockRepository) GetCrossDockOrder(ctx context.Context, id string) (*CrossDockOrder, error) {
	if order, ok := m.orders[id]; ok {
		return order, nil
	}
	return nil, ErrCrossDockNotFound
}

func (m *mockCrossDockRepository) ListCrossDockOrders(ctx context.Context, status CrossDockStatus, warehouseID string, from, to time.Time, limit int) ([]*CrossDockOrder, error) {
	result := make([]*CrossDockOrder, 0)
	for _, order := range m.orders {
		if (status == "" || order.Status == status) && (warehouseID == "" || order.WarehouseID == warehouseID) {
			result = append(result, order)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockCrossDockRepository) CreateDock(ctx context.Context, dock *Dock) error {
	m.docks[dock.ID] = dock
	return nil
}

func (m *mockCrossDockRepository) UpdateDock(ctx context.Context, dock *Dock) error {
	m.docks[dock.ID] = dock
	return nil
}

func (m *mockCrossDockRepository) GetDock(ctx context.Context, id string) (*Dock, error) {
	if dock, ok := m.docks[id]; ok {
		return dock, nil
	}
	return nil, ErrDockNotAvailable
}

func (m *mockCrossDockRepository) ListDocks(ctx context.Context, warehouseID string) ([]*Dock, error) {
	result := make([]*Dock, 0)
	for _, dock := range m.docks {
		if warehouseID == "" || dock.WarehouseID == warehouseID {
			result = append(result, dock)
		}
	}
	return result, nil
}

func (m *mockCrossDockRepository) GetAvailableDock(ctx context.Context, warehouseID, dockType string, startTime, endTime time.Time) (*Dock, error) {
	for _, dock := range m.docks {
		if dock.Status == "available" && (warehouseID == "" || dock.WarehouseID == warehouseID) {
			return dock, nil
		}
	}
	return nil, ErrDockNotAvailable
}

func (m *mockCrossDockRepository) CreateStagingArea(ctx context.Context, area *StagingArea) error {
	m.stagingAreas[area.ID] = area
	return nil
}

func (m *mockCrossDockRepository) UpdateStagingArea(ctx context.Context, area *StagingArea) error {
	m.stagingAreas[area.ID] = area
	return nil
}

func (m *mockCrossDockRepository) GetStagingArea(ctx context.Context, id string) (*StagingArea, error) {
	if area, ok := m.stagingAreas[id]; ok {
		return area, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockCrossDockRepository) ListStagingAreas(ctx context.Context, warehouseID string) ([]*StagingArea, error) {
	result := make([]*StagingArea, 0)
	for _, area := range m.stagingAreas {
		if warehouseID == "" || area.WarehouseID == warehouseID {
			result = append(result, area)
		}
	}
	return result, nil
}

func (m *mockCrossDockRepository) GetAvailableStagingArea(ctx context.Context, warehouseID, areaType string, requiredCapacity int) (*StagingArea, error) {
	for _, area := range m.stagingAreas {
		if area.WarehouseID == warehouseID && area.Type == areaType && (area.Capacity-area.Used) >= requiredCapacity {
			return area, nil
		}
	}
	return nil, ErrProductNotFound
}

func (m *mockCrossDockRepository) GetDailySchedule(ctx context.Context, warehouseID string, date time.Time) (*CrossDockSchedule, error) {
	orders := make([]*CrossDockOrder, 0)
	for _, order := range m.orders {
		if order.WarehouseID == warehouseID {
			orders = append(orders, order)
		}
	}
	return &CrossDockSchedule{
		Date:        date,
		WarehouseID: warehouseID,
		Orders:      orders,
	}, nil
}

// Tests

func TestCrossDockService_NewService(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
}

func TestCrossDockService_CreateCrossDockOrder(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	// Setup available dock
	repo.docks["dock1"] = &Dock{ID: "dock1", WarehouseID: "wh1", Status: "available"}

	inbound := []InboundShipment{
		{
			SupplierID: "sup1",
			Items:      []CrossDockItem{{ProductID: "prod1", Quantity: 100}},
		},
	}
	outbound := []OutboundShipment{
		{
			DestinationType: "store",
			DestinationID:   "store1",
			Items:           []CrossDockItem{{ProductID: "prod1", Quantity: 100}},
		},
	}

	start := time.Now().Add(1 * time.Hour)
	end := time.Now().Add(4 * time.Hour)

	order, err := service.CreateCrossDockOrder(ctx, "wh1", "user1", CrossDockTypeTransit, inbound, outbound, start, end, 1, "Test order")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if order.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if order.Status != CrossDockStatusScheduled {
		t.Errorf("Expected status 'scheduled', got %s", order.Status)
	}
	if len(order.InboundShipments) != 1 {
		t.Errorf("Expected 1 inbound shipment, got %d", len(order.InboundShipments))
	}
	if order.InboundShipments[0].Status != "pending" {
		t.Errorf("Expected inbound status 'pending', got %s", order.InboundShipments[0].Status)
	}
}

func TestCrossDockService_CreateCrossDockOrder_NoInbound(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	outbound := []OutboundShipment{{DestinationType: "store", DestinationID: "store1"}}

	_, err := service.CreateCrossDockOrder(ctx, "wh1", "user1", CrossDockTypeTransit, []InboundShipment{}, outbound, time.Now(), time.Now().Add(1*time.Hour), 1, "")
	if err == nil {
		t.Error("Expected error for no inbound shipments")
	}
}

func TestCrossDockService_CreateCrossDockOrder_NoOutbound(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	inbound := []InboundShipment{{SupplierID: "sup1"}}

	_, err := service.CreateCrossDockOrder(ctx, "wh1", "user1", CrossDockTypeTransit, inbound, []OutboundShipment{}, time.Now(), time.Now().Add(1*time.Hour), 1, "")
	if err == nil {
		t.Error("Expected error for no outbound shipments")
	}
}

func TestCrossDockService_StartReceiving(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	// Setup order and dock
	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusScheduled,
		DockID: "dock1",
	}
	repo.orders["order1"] = order
	repo.docks["dock1"] = &Dock{ID: "dock1", Status: "available"}

	err := service.StartReceiving(ctx, "order1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.Status != CrossDockStatusReceiving {
		t.Errorf("Expected status 'receiving', got %s", updatedOrder.Status)
	}
	if updatedOrder.ActualStart == nil {
		t.Error("Expected ActualStart to be set")
	}

	// Check dock is occupied
	updatedDock := repo.docks["dock1"]
	if updatedDock.Status != "occupied" {
		t.Errorf("Expected dock status 'occupied', got %s", updatedDock.Status)
	}
}

func TestCrossDockService_StartReceiving_InvalidState(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusReceiving, // Already receiving
	}
	repo.orders["order1"] = order

	err := service.StartReceiving(ctx, "order1")
	if err != ErrInvalidDockState {
		t.Errorf("Expected ErrInvalidDockState, got %v", err)
	}
}

func TestCrossDockService_ReceiveInboundShipment(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusReceiving,
		InboundShipments: []InboundShipment{
			{
				ID:     "ship1",
				Status: "pending",
				Items:  []CrossDockItem{{ProductID: "prod1", Quantity: 100}},
			},
		},
	}
	repo.orders["order1"] = order

	received := map[string]int{"prod1": 100}
	err := service.ReceiveInboundShipment(ctx, "order1", "ship1", "door-1", received)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.InboundShipments[0].Status != "arrived" {
		t.Errorf("Expected status 'arrived', got %s", updatedOrder.InboundShipments[0].Status)
	}
	if updatedOrder.InboundShipments[0].DockDoor != "door-1" {
		t.Errorf("Expected dock door 'door-1', got %s", updatedOrder.InboundShipments[0].DockDoor)
	}
}

func TestCrossDockService_ReceiveInboundShipment_InvalidState(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusScheduled, // Not receiving yet
	}
	repo.orders["order1"] = order

	err := service.ReceiveInboundShipment(ctx, "order1", "ship1", "door-1", nil)
	if err != ErrInvalidDockState {
		t.Errorf("Expected ErrInvalidDockState, got %v", err)
	}
}

func TestCrossDockService_UnloadInboundShipment(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusReceiving,
		InboundShipments: []InboundShipment{
			{
				ID:     "ship1",
				Status: "arrived",
				Items:  []CrossDockItem{{ProductID: "prod1", Quantity: 100}},
			},
		},
	}
	repo.orders["order1"] = order

	err := service.UnloadInboundShipment(ctx, "order1", "ship1", "staging-a")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.InboundShipments[0].Status != "unloaded" {
		t.Errorf("Expected status 'unloaded', got %s", updatedOrder.InboundShipments[0].Status)
	}
	if updatedOrder.InboundShipments[0].Items[0].Location != "staging-a" {
		t.Errorf("Expected location 'staging-a', got %s", updatedOrder.InboundShipments[0].Items[0].Location)
	}
}

func TestCrossDockService_StartSorting(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusReceiving,
		InboundShipments: []InboundShipment{
			{ID: "ship1", Status: "unloaded"},
		},
	}
	repo.orders["order1"] = order

	err := service.StartSorting(ctx, "order1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.Status != CrossDockStatusSorting {
		t.Errorf("Expected status 'sorting', got %s", updatedOrder.Status)
	}
}

func TestCrossDockService_StartSorting_NotAllUnloaded(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusReceiving,
		InboundShipments: []InboundShipment{
			{ID: "ship1", Status: "arrived"}, // Not unloaded yet
		},
	}
	repo.orders["order1"] = order

	err := service.StartSorting(ctx, "order1")
	if err == nil {
		t.Error("Expected error when not all shipments are unloaded")
	}
}

func TestCrossDockService_SortToOutbound(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusSorting,
		InboundShipments: []InboundShipment{
			{ID: "ship1", Status: "unloaded"},
		},
		OutboundShipments: []OutboundShipment{
			{
				ID:    "out1",
				Items: []CrossDockItem{{ProductID: "prod1", Quantity: 50}},
			},
		},
	}
	repo.orders["order1"] = order

	assignments := map[string]map[string]int{
		"out1": {"prod1": 50},
	}

	err := service.SortToOutbound(ctx, "order1", assignments)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.OutboundShipments[0].Items[0].LoadedQty != 50 {
		t.Errorf("Expected loaded qty 50, got %d", updatedOrder.OutboundShipments[0].Items[0].LoadedQty)
	}
	if updatedOrder.InboundShipments[0].Status != "sorted" {
		t.Errorf("Expected inbound status 'sorted', got %s", updatedOrder.InboundShipments[0].Status)
	}
}

func TestCrossDockService_StartLoading(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusSorting,
	}
	repo.orders["order1"] = order

	err := service.StartLoading(ctx, "order1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.Status != CrossDockStatusLoading {
		t.Errorf("Expected status 'loading', got %s", updatedOrder.Status)
	}
}

func TestCrossDockService_LoadOutboundShipment(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusLoading,
		OutboundShipments: []OutboundShipment{
			{ID: "out1", Status: "pending"},
		},
	}
	repo.orders["order1"] = order

	err := service.LoadOutboundShipment(ctx, "order1", "out1", "door-2")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.OutboundShipments[0].Status != "loaded" {
		t.Errorf("Expected status 'loaded', got %s", updatedOrder.OutboundShipments[0].Status)
	}
}

func TestCrossDockService_DepartOutboundShipment(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		DockID: "dock1",
		Status: CrossDockStatusLoading,
		OutboundShipments: []OutboundShipment{
			{ID: "out1", Status: "loaded"},
		},
	}
	repo.orders["order1"] = order
	repo.docks["dock1"] = &Dock{ID: "dock1", Status: "occupied", CurrentOrderID: "order1"}

	err := service.DepartOutboundShipment(ctx, "order1", "out1", "TRACK123")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.OutboundShipments[0].Status != "departed" {
		t.Errorf("Expected status 'departed', got %s", updatedOrder.OutboundShipments[0].Status)
	}
	if updatedOrder.OutboundShipments[0].TrackingNumber != "TRACK123" {
		t.Errorf("Expected tracking 'TRACK123', got %s", updatedOrder.OutboundShipments[0].TrackingNumber)
	}
	if updatedOrder.Status != CrossDockStatusCompleted {
		t.Errorf("Expected order status 'completed', got %s", updatedOrder.Status)
	}

	// Check dock released
	updatedDock := repo.docks["dock1"]
	if updatedDock.Status != "available" {
		t.Errorf("Expected dock status 'available', got %s", updatedDock.Status)
	}
}

func TestCrossDockService_DepartOutboundShipment_NotAllDeparted(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusLoading,
		OutboundShipments: []OutboundShipment{
			{ID: "out1", Status: "loaded"},
			{ID: "out2", Status: "pending"}, // Second shipment not ready
		},
	}
	repo.orders["order1"] = order

	err := service.DepartOutboundShipment(ctx, "order1", "out1", "")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	// Order should not be completed yet
	if updatedOrder.Status == CrossDockStatusCompleted {
		t.Error("Expected order not to be completed when not all shipments departed")
	}
}

func TestCrossDockService_CancelCrossDockOrder(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		DockID: "dock1",
		Status: CrossDockStatusScheduled,
	}
	repo.orders["order1"] = order
	repo.docks["dock1"] = &Dock{ID: "dock1", Status: "occupied", CurrentOrderID: "order1"}

	err := service.CancelCrossDockOrder(ctx, "order1", "Customer cancelled")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedOrder := repo.orders["order1"]
	if updatedOrder.Status != CrossDockStatusCancelled {
		t.Errorf("Expected status 'cancelled', got %s", updatedOrder.Status)
	}
	if updatedOrder.Notes != "Customer cancelled" {
		t.Errorf("Expected notes 'Customer cancelled', got %s", updatedOrder.Notes)
	}

	// Check dock released
	updatedDock := repo.docks["dock1"]
	if updatedDock.Status != "available" {
		t.Errorf("Expected dock status 'available', got %s", updatedDock.Status)
	}
}

func TestCrossDockService_CancelCrossDockOrder_AlreadyCompleted(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{
		ID:     "order1",
		Status: CrossDockStatusCompleted,
	}
	repo.orders["order1"] = order

	err := service.CancelCrossDockOrder(ctx, "order1", "Try to cancel")
	if err != ErrInvalidDockState {
		t.Errorf("Expected ErrInvalidDockState, got %v", err)
	}
}

func TestCrossDockService_GetCrossDockOrder(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	order := &CrossDockOrder{ID: "order1", WarehouseID: "wh1"}
	repo.orders["order1"] = order

	result, err := service.GetCrossDockOrder(ctx, "order1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result.ID != "order1" {
		t.Errorf("Expected order ID 'order1', got %s", result.ID)
	}
}

func TestCrossDockService_ListCrossDockOrders(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	repo.orders["order1"] = &CrossDockOrder{ID: "order1", WarehouseID: "wh1", Status: CrossDockStatusScheduled}
	repo.orders["order2"] = &CrossDockOrder{ID: "order2", WarehouseID: "wh1", Status: CrossDockStatusCompleted}

	results, err := service.ListCrossDockOrders(ctx, CrossDockStatusScheduled, "wh1", time.Now(), time.Now().Add(24*time.Hour), 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(results) != 1 {
		t.Errorf("Expected 1 order, got %d", len(results))
	}
}

func TestCrossDockService_GetDailySchedule(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	repo.orders["order1"] = &CrossDockOrder{ID: "order1", WarehouseID: "wh1"}

	schedule, err := service.GetDailySchedule(ctx, "wh1", time.Now())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if schedule.WarehouseID != "wh1" {
		t.Errorf("Expected warehouse ID 'wh1', got %s", schedule.WarehouseID)
	}
}

func TestCrossDockService_CreateDock(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	dock := &Dock{
		Name:        "Dock 1",
		WarehouseID: "wh1",
		Type:        "both",
	}

	err := service.CreateDock(ctx, dock)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if dock.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if dock.Status != "available" {
		t.Errorf("Expected status 'available', got %s", dock.Status)
	}
}

func TestCrossDockService_ListDocks(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	repo.docks["dock1"] = &Dock{ID: "dock1", WarehouseID: "wh1"}
	repo.docks["dock2"] = &Dock{ID: "dock2", WarehouseID: "wh1"}

	results, err := service.ListDocks(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(results) != 2 {
		t.Errorf("Expected 2 docks, got %d", len(results))
	}
}

func TestCrossDockService_CreateStagingArea(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	area := &StagingArea{
		Name:        "Staging A",
		WarehouseID: "wh1",
		Capacity:    100,
		Type:        "inbound",
	}

	err := service.CreateStagingArea(ctx, area)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if area.ID == "" {
		t.Error("Expected ID to be generated")
	}
}

func TestCrossDockService_ListStagingAreas(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)
	ctx := context.Background()

	repo.stagingAreas["area1"] = &StagingArea{ID: "area1", WarehouseID: "wh1"}

	results, err := service.ListStagingAreas(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(results) != 1 {
		t.Errorf("Expected 1 area, got %d", len(results))
	}
}

func TestCrossDockService_ValidateCrossDockPlan(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)

	inbound := []InboundShipment{
		{Items: []CrossDockItem{{ProductID: "prod1", Quantity: 100}}},
	}
	outbound := []OutboundShipment{
		{Items: []CrossDockItem{{ProductID: "prod1", Quantity: 50}}},
		{Items: []CrossDockItem{{ProductID: "prod1", Quantity: 50}}},
	}

	err := service.ValidateCrossDockPlan(inbound, outbound)
	if err != nil {
		t.Fatalf("Expected no error for balanced plan, got %v", err)
	}
}

func TestCrossDockService_ValidateCrossDockPlan_OutboundExceeds(t *testing.T) {
	repo := newMockCrossDockRepository()
	service := NewCrossDockService(repo)

	inbound := []InboundShipment{
		{Items: []CrossDockItem{{ProductID: "prod1", Quantity: 50}}},
	}
	outbound := []OutboundShipment{
		{Items: []CrossDockItem{{ProductID: "prod1", Quantity: 100}}}, // More than inbound
	}

	err := service.ValidateCrossDockPlan(inbound, outbound)
	if err == nil {
		t.Error("Expected error when outbound exceeds inbound")
	}
}
