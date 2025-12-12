package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockMapRepository implements MapRepository for testing
type mockMapRepository struct {
	zones            map[string]*Zone
	aisles           map[string]*Aisle
	racks            map[string]*Rack
	locations        map[string]*Location
	locationContents map[string][]*LocationContent
	layouts          map[string]*WarehouseLayout
}

func newMockMapRepository() *mockMapRepository {
	return &mockMapRepository{
		zones:            make(map[string]*Zone),
		aisles:           make(map[string]*Aisle),
		racks:            make(map[string]*Rack),
		locations:        make(map[string]*Location),
		locationContents: make(map[string][]*LocationContent),
		layouts:          make(map[string]*WarehouseLayout),
	}
}

func (m *mockMapRepository) CreateZone(ctx context.Context, zone *Zone) error {
	m.zones[zone.ID] = zone
	return nil
}

func (m *mockMapRepository) UpdateZone(ctx context.Context, zone *Zone) error {
	m.zones[zone.ID] = zone
	return nil
}

func (m *mockMapRepository) GetZone(ctx context.Context, id string) (*Zone, error) {
	if zone, ok := m.zones[id]; ok {
		return zone, nil
	}
	return nil, ErrZoneNotFound
}

func (m *mockMapRepository) GetZoneByCode(ctx context.Context, warehouseID, code string) (*Zone, error) {
	for _, zone := range m.zones {
		if zone.WarehouseID == warehouseID && zone.Code == code {
			return zone, nil
		}
	}
	return nil, ErrZoneNotFound
}

func (m *mockMapRepository) ListZones(ctx context.Context, warehouseID string) ([]*Zone, error) {
	result := make([]*Zone, 0)
	for _, zone := range m.zones {
		if warehouseID == "" || zone.WarehouseID == warehouseID {
			result = append(result, zone)
		}
	}
	return result, nil
}

func (m *mockMapRepository) CreateAisle(ctx context.Context, aisle *Aisle) error {
	m.aisles[aisle.ID] = aisle
	return nil
}

func (m *mockMapRepository) GetAisle(ctx context.Context, id string) (*Aisle, error) {
	if aisle, ok := m.aisles[id]; ok {
		return aisle, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockMapRepository) ListAisles(ctx context.Context, zoneID string) ([]*Aisle, error) {
	result := make([]*Aisle, 0)
	for _, aisle := range m.aisles {
		if zoneID == "" || aisle.ZoneID == zoneID {
			result = append(result, aisle)
		}
	}
	return result, nil
}

func (m *mockMapRepository) CreateRack(ctx context.Context, rack *Rack) error {
	m.racks[rack.ID] = rack
	return nil
}

func (m *mockMapRepository) GetRack(ctx context.Context, id string) (*Rack, error) {
	if rack, ok := m.racks[id]; ok {
		return rack, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockMapRepository) ListRacks(ctx context.Context, aisleID string) ([]*Rack, error) {
	result := make([]*Rack, 0)
	for _, rack := range m.racks {
		if aisleID == "" || rack.AisleID == aisleID {
			result = append(result, rack)
		}
	}
	return result, nil
}

func (m *mockMapRepository) CreateLocation(ctx context.Context, loc *Location) error {
	m.locations[loc.ID] = loc
	return nil
}

func (m *mockMapRepository) UpdateLocation(ctx context.Context, loc *Location) error {
	m.locations[loc.ID] = loc
	return nil
}

func (m *mockMapRepository) GetLocation(ctx context.Context, id string) (*Location, error) {
	if loc, ok := m.locations[id]; ok {
		return loc, nil
	}
	return nil, ErrLocationNotFound
}

func (m *mockMapRepository) GetLocationByCode(ctx context.Context, warehouseID, code string) (*Location, error) {
	for _, loc := range m.locations {
		if loc.WarehouseID == warehouseID && loc.Code == code {
			return loc, nil
		}
	}
	return nil, ErrLocationNotFound
}

func (m *mockMapRepository) GetLocationByBarcode(ctx context.Context, barcode string) (*Location, error) {
	for _, loc := range m.locations {
		if loc.Barcode == barcode {
			return loc, nil
		}
	}
	return nil, ErrLocationNotFound
}

func (m *mockMapRepository) ListLocations(ctx context.Context, zoneID string, status string, limit, offset int) ([]*Location, error) {
	result := make([]*Location, 0)
	count := 0
	for _, loc := range m.locations {
		if (zoneID == "" || loc.ZoneID == zoneID) && (status == "" || loc.Status == status) {
			if count >= offset {
				result = append(result, loc)
				if len(result) >= limit {
					break
				}
			}
			count++
		}
	}
	return result, nil
}

func (m *mockMapRepository) GetEmptyLocations(ctx context.Context, warehouseID string, zoneType ZoneType, limit int) ([]*Location, error) {
	result := make([]*Location, 0)
	for _, loc := range m.locations {
		if loc.Status == "empty" && loc.WarehouseID == warehouseID && loc.IsPutawayable {
			result = append(result, loc)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockMapRepository) GetLocationContent(ctx context.Context, locationID string) ([]*LocationContent, error) {
	if content, ok := m.locationContents[locationID]; ok {
		return content, nil
	}
	return []*LocationContent{}, nil
}

func (m *mockMapRepository) UpdateLocationContent(ctx context.Context, content *LocationContent) error {
	m.locationContents[content.LocationID] = []*LocationContent{content}
	return nil
}

func (m *mockMapRepository) ClearLocationContent(ctx context.Context, locationID string) error {
	delete(m.locationContents, locationID)
	return nil
}

func (m *mockMapRepository) GetLayout(ctx context.Context, warehouseID string) (*WarehouseLayout, error) {
	if layout, ok := m.layouts[warehouseID]; ok {
		return layout, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockMapRepository) UpdateLayout(ctx context.Context, layout *WarehouseLayout) error {
	m.layouts[layout.WarehouseID] = layout
	return nil
}

func (m *mockMapRepository) GenerateHeatmap(ctx context.Context, warehouseID, heatmapType, period string) (*Heatmap, error) {
	return &Heatmap{
		WarehouseID: warehouseID,
		Type:        heatmapType,
		Period:      period,
		Data:        []HeatmapCell{},
		GeneratedAt: time.Now(),
	}, nil
}

// Tests

func TestMapService_NewService(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
}

func TestMapService_CreateZone(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	zone := &Zone{
		WarehouseID: "wh1",
		Code:        "A",
		Name:        "Zone A",
		Type:        ZoneTypeHot,
		Temperature: TempAmbient,
		IsActive:    true,
	}

	err := service.CreateZone(ctx, zone)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if zone.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if zone.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

func TestMapService_UpdateZone(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	zone := &Zone{ID: "zone1", Name: "Zone A"}
	repo.zones["zone1"] = zone

	zone.Name = "Zone A Updated"
	err := service.UpdateZone(ctx, zone)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if repo.zones["zone1"].Name != "Zone A Updated" {
		t.Error("Expected zone name to be updated")
	}
}

func TestMapService_GetZone(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.zones["zone1"] = &Zone{ID: "zone1", Name: "Zone A"}

	zone, err := service.GetZone(ctx, "zone1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if zone.Name != "Zone A" {
		t.Errorf("Expected name 'Zone A', got %s", zone.Name)
	}
}

func TestMapService_ListZones(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.zones["zone1"] = &Zone{ID: "zone1", WarehouseID: "wh1"}
	repo.zones["zone2"] = &Zone{ID: "zone2", WarehouseID: "wh1"}

	zones, err := service.ListZones(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(zones) != 2 {
		t.Errorf("Expected 2 zones, got %d", len(zones))
	}
}

func TestMapService_CreateLocation(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	loc := &Location{
		WarehouseID: "wh1",
		ZoneID:      "zone1",
		Code:        "A-01-01-A-01",
		Type:        "shelf",
	}

	err := service.CreateLocation(ctx, loc)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if loc.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if loc.Status != "empty" {
		t.Errorf("Expected status 'empty', got %s", loc.Status)
	}
	if loc.Barcode == "" {
		t.Error("Expected barcode to be generated")
	}
}

func TestMapService_CreateLocation_WithBarcode(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	loc := &Location{
		WarehouseID: "wh1",
		Code:        "A-01-01",
		Barcode:     "CUSTOM-BARCODE",
	}

	err := service.CreateLocation(ctx, loc)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if loc.Barcode != "CUSTOM-BARCODE" {
		t.Errorf("Expected barcode 'CUSTOM-BARCODE', got %s", loc.Barcode)
	}
}

func TestMapService_GetLocation(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{ID: "loc1", Code: "A-01"}

	loc, err := service.GetLocation(ctx, "loc1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if loc.Code != "A-01" {
		t.Errorf("Expected code 'A-01', got %s", loc.Code)
	}
}

func TestMapService_GetLocationByCode(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{ID: "loc1", WarehouseID: "wh1", Code: "A-01"}

	loc, err := service.GetLocationByCode(ctx, "wh1", "A-01")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if loc.ID != "loc1" {
		t.Errorf("Expected ID 'loc1', got %s", loc.ID)
	}
}

func TestMapService_GetLocationByBarcode(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{ID: "loc1", Barcode: "LOC123"}

	loc, err := service.GetLocationByBarcode(ctx, "LOC123")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if loc.ID != "loc1" {
		t.Errorf("Expected ID 'loc1', got %s", loc.ID)
	}
}

func TestMapService_AssignItemToLocation(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		Status:        "empty",
		IsPutawayable: true,
	}

	err := service.AssignItemToLocation(ctx, "loc1", "prod1", "SKU001", 50, "BATCH001", nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	loc := repo.locations["loc1"]
	if loc.CurrentSKU != "SKU001" {
		t.Errorf("Expected SKU 'SKU001', got %s", loc.CurrentSKU)
	}
	if loc.CurrentQty != 50 {
		t.Errorf("Expected qty 50, got %d", loc.CurrentQty)
	}
	if loc.Status != "partial" {
		t.Errorf("Expected status 'partial', got %s", loc.Status)
	}
}

func TestMapService_AssignItemToLocation_NotPutawayable(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		Status:        "empty",
		IsPutawayable: false,
	}

	err := service.AssignItemToLocation(ctx, "loc1", "prod1", "SKU001", 50, "", nil)
	if err != ErrInvalidLocation {
		t.Errorf("Expected ErrInvalidLocation, got %v", err)
	}
}

func TestMapService_AssignItemToLocation_Full(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		Status:        "full",
		IsPutawayable: true,
	}

	err := service.AssignItemToLocation(ctx, "loc1", "prod1", "SKU001", 50, "", nil)
	if err != ErrLocationOccupied {
		t.Errorf("Expected ErrLocationOccupied, got %v", err)
	}
}

func TestMapService_AssignItemToLocation_DifferentSKU(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		Status:        "partial",
		IsPutawayable: true,
		AssignedSKU:   "SKU002", // Dedicated to different SKU
	}

	err := service.AssignItemToLocation(ctx, "loc1", "prod1", "SKU001", 50, "", nil)
	if err == nil {
		t.Error("Expected error for different SKU")
	}
}

func TestMapService_RemoveItemFromLocation(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:         "loc1",
		Status:     "partial",
		CurrentSKU: "SKU001",
		CurrentQty: 100,
	}

	err := service.RemoveItemFromLocation(ctx, "loc1", 30)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	loc := repo.locations["loc1"]
	if loc.CurrentQty != 70 {
		t.Errorf("Expected qty 70, got %d", loc.CurrentQty)
	}
}

func TestMapService_RemoveItemFromLocation_Complete(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:         "loc1",
		Status:     "partial",
		CurrentSKU: "SKU001",
		CurrentQty: 50,
	}

	err := service.RemoveItemFromLocation(ctx, "loc1", 50)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	loc := repo.locations["loc1"]
	if loc.CurrentQty != 0 {
		t.Errorf("Expected qty 0, got %d", loc.CurrentQty)
	}
	if loc.Status != "empty" {
		t.Errorf("Expected status 'empty', got %s", loc.Status)
	}
	if loc.CurrentSKU != "" {
		t.Errorf("Expected empty SKU, got %s", loc.CurrentSKU)
	}
}

func TestMapService_RemoveItemFromLocation_InsufficientQty(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:         "loc1",
		CurrentQty: 20,
	}

	err := service.RemoveItemFromLocation(ctx, "loc1", 50)
	if err == nil {
		t.Error("Expected error for insufficient quantity")
	}
}

func TestMapService_SuggestPutawayLocation_ConsolidateSameSKU(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	// Setup location with same SKU
	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		Status:        "partial",
		CurrentSKU:    "SKU001",
		IsPutawayable: true,
	}

	loc, err := service.SuggestPutawayLocation(ctx, "wh1", "SKU001", 50, ZoneTypeHot)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if loc.ID != "loc1" {
		t.Errorf("Expected to consolidate to loc1, got %s", loc.ID)
	}
}

func TestMapService_SuggestPutawayLocation_EmptyLocation(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		WarehouseID:   "wh1",
		Status:        "empty",
		IsPutawayable: true,
	}

	loc, err := service.SuggestPutawayLocation(ctx, "wh1", "SKU002", 50, ZoneTypeHot)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if loc.ID != "loc1" {
		t.Errorf("Expected loc1, got %s", loc.ID)
	}
}

func TestMapService_GetWarehouseLayout(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.layouts["wh1"] = &WarehouseLayout{
		WarehouseID: "wh1",
		Name:        "Main Warehouse",
		Width:       100,
		Depth:       200,
	}

	layout, err := service.GetWarehouseLayout(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if layout.Name != "Main Warehouse" {
		t.Errorf("Expected name 'Main Warehouse', got %s", layout.Name)
	}
}

func TestMapService_GenerateHeatmap(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	heatmap, err := service.GenerateHeatmap(ctx, "wh1", "picks", "week")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if heatmap.Type != "picks" {
		t.Errorf("Expected type 'picks', got %s", heatmap.Type)
	}
	if heatmap.Period != "week" {
		t.Errorf("Expected period 'week', got %s", heatmap.Period)
	}
}

func TestMapService_CalculateOptimalPath(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	// Setup locations with positions
	repo.locations["loc1"] = &Location{ID: "loc1", PositionX: 0, PositionY: 0, PositionZ: 0}
	repo.locations["loc2"] = &Location{ID: "loc2", PositionX: 10, PositionY: 0, PositionZ: 0}
	repo.locations["loc3"] = &Location{ID: "loc3", PositionX: 5, PositionY: 0, PositionZ: 0}

	path, distance, err := service.CalculateOptimalPath(ctx, "wh1", []string{"loc1", "loc2", "loc3"})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(path) != 3 {
		t.Errorf("Expected 3 locations in path, got %d", len(path))
	}
	if distance == 0 {
		t.Error("Expected non-zero distance")
	}
}

func TestMapService_CalculateOptimalPath_SingleLocation(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{ID: "loc1"}

	path, distance, err := service.CalculateOptimalPath(ctx, "wh1", []string{"loc1"})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(path) != 1 {
		t.Errorf("Expected 1 location in path, got %d", len(path))
	}
	if distance != 0 {
		t.Errorf("Expected 0 distance for single location, got %f", distance)
	}
}

func TestMapService_GenerateLocationCodes(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)

	codes := service.GenerateLocationCodes("A", "01", "R1", 2, 3)
	if len(codes) != 6 { // 2 levels * 3 bays
		t.Errorf("Expected 6 codes, got %d", len(codes))
	}

	// Check format
	expected := "A-01-R1-A-01"
	if codes[0] != expected {
		t.Errorf("Expected first code '%s', got '%s'", expected, codes[0])
	}
}

func TestMapService_GetZoneUtilization(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.zones["zone1"] = &Zone{
		ID:             "zone1",
		WarehouseID:    "wh1",
		Code:           "A",
		Name:           "Zone A",
		Type:           ZoneTypeHot,
		TotalLocations: 100,
		UsedLocations:  75,
	}
	repo.zones["zone2"] = &Zone{
		ID:             "zone2",
		WarehouseID:    "wh1",
		Code:           "B",
		Name:           "Zone B",
		Type:           ZoneTypeCold,
		TotalLocations: 50,
		UsedLocations:  10,
	}

	utilization, err := service.GetZoneUtilization(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(utilization) != 2 {
		t.Fatalf("Expected 2 zones, got %d", len(utilization))
	}

	// Check utilization calculation
	for _, u := range utilization {
		if u.ZoneCode == "A" {
			if u.Utilization != 75.0 {
				t.Errorf("Expected 75%% utilization for zone A, got %.2f%%", u.Utilization)
			}
		}
		if u.ZoneCode == "B" {
			if u.Utilization != 20.0 {
				t.Errorf("Expected 20%% utilization for zone B, got %.2f%%", u.Utilization)
			}
		}
	}
}

func TestCalculateDistance(t *testing.T) {
	a := &Location{PositionX: 0, PositionY: 0, PositionZ: 0}
	b := &Location{PositionX: 3, PositionY: 4, PositionZ: 0}

	dist := calculateDistance(a, b)
	// 3^2 + 4^2 = 9 + 16 = 25 (squared distance)
	if dist != 25 {
		t.Errorf("Expected distance 25, got %f", dist)
	}
}

func TestMapService_UpdateLocation(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	loc := &Location{ID: "loc1", Code: "A-01-01-01", ZoneID: "zone1"}
	repo.locations["loc1"] = loc

	loc.Code = "A-01-01-02"
	err := service.UpdateLocation(ctx, loc)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestMapService_ListLocations(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{ID: "loc1", ZoneID: "zone1", Status: "partial"}
	repo.locations["loc2"] = &Location{ID: "loc2", ZoneID: "zone1", Status: "empty"}

	list, err := service.ListLocations(ctx, "zone1", "partial", 100, 0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 partial location, got %d", len(list))
	}
}

// Edge case tests for increased coverage

func TestMapService_AssignItemToLocation_LocationNotFound(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	err := service.AssignItemToLocation(ctx, "nonexistent", "prod1", "SKU001", 50, "", nil)
	if err != ErrLocationNotFound {
		t.Errorf("Expected ErrLocationNotFound, got %v", err)
	}
}

func TestMapService_AssignItemToLocation_Blocked(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		Status:        "blocked",
		IsPutawayable: true,
	}

	err := service.AssignItemToLocation(ctx, "loc1", "prod1", "SKU001", 50, "", nil)
	if err != ErrLocationOccupied {
		t.Errorf("Expected ErrLocationOccupied, got %v", err)
	}
}

func TestMapService_AssignItemToLocation_EmptyQuantity(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		Status:        "partial",
		IsPutawayable: true,
		CurrentQty:    50,
	}

	err := service.AssignItemToLocation(ctx, "loc1", "prod1", "SKU001", 0, "", nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	loc := repo.locations["loc1"]
	if loc.Status != "empty" {
		t.Errorf("Expected status 'empty' for zero quantity, got %s", loc.Status)
	}
}

func TestMapService_SuggestPutawayLocation_NoEmptyLocations(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	// All locations are full or blocked
	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		WarehouseID:   "wh1",
		Status:        "full",
		IsPutawayable: true,
	}

	_, err := service.SuggestPutawayLocation(ctx, "wh1", "SKU001", 50, ZoneTypeHot)
	if err == nil {
		t.Error("Expected error when no available locations")
	}
}

func TestMapService_SuggestPutawayLocation_PartialWithDifferentSKU(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	// Partial location with different SKU
	repo.locations["loc1"] = &Location{
		ID:            "loc1",
		WarehouseID:   "wh1",
		Status:        "partial",
		CurrentSKU:    "SKU002",
		IsPutawayable: true,
	}
	// Empty location available
	repo.locations["loc2"] = &Location{
		ID:            "loc2",
		WarehouseID:   "wh1",
		Status:        "empty",
		IsPutawayable: true,
	}

	loc, err := service.SuggestPutawayLocation(ctx, "wh1", "SKU001", 50, ZoneTypeHot)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should get empty location since partial has different SKU
	if loc.ID != "loc2" {
		t.Errorf("Expected empty location loc2, got %s", loc.ID)
	}
}

func TestMapService_RemoveItemFromLocation_LocationNotFound(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	err := service.RemoveItemFromLocation(ctx, "nonexistent", 10)
	if err != ErrLocationNotFound {
		t.Errorf("Expected ErrLocationNotFound, got %v", err)
	}
}

func TestMapService_GetLocationByCode_NotFound(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	_, err := service.GetLocationByCode(ctx, "wh1", "nonexistent")
	if err != ErrLocationNotFound {
		t.Errorf("Expected ErrLocationNotFound, got %v", err)
	}
}

func TestMapService_GetLocationByBarcode_NotFound(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	_, err := service.GetLocationByBarcode(ctx, "nonexistent")
	if err != ErrLocationNotFound {
		t.Errorf("Expected ErrLocationNotFound, got %v", err)
	}
}

func TestMapService_GetZone_NotFound(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	_, err := service.GetZone(ctx, "nonexistent")
	if err != ErrZoneNotFound {
		t.Errorf("Expected ErrZoneNotFound, got %v", err)
	}
}

func TestMapService_GetWarehouseLayout_NotFound(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	_, err := service.GetWarehouseLayout(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent warehouse layout")
	}
}

func TestMapService_GetLocation_NotFound(t *testing.T) {
	repo := newMockMapRepository()
	service := NewMapService(repo)
	ctx := context.Background()

	_, err := service.GetLocation(ctx, "nonexistent")
	if err != ErrLocationNotFound {
		t.Errorf("Expected ErrLocationNotFound, got %v", err)
	}
}
