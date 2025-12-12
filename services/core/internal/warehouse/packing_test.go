package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockPackingRepository implements PackingRepository for testing
type mockPackingRepository struct {
	packages       map[string]*Package
	packingResults map[string]*PackingResult
	packingSlips   map[string]*PackingSlip
	stations       map[string]*PackingStation
	tasks          map[string]*PackingTask
}

func newMockPackingRepository() *mockPackingRepository {
	return &mockPackingRepository{
		packages:       make(map[string]*Package),
		packingResults: make(map[string]*PackingResult),
		packingSlips:   make(map[string]*PackingSlip),
		stations:       make(map[string]*PackingStation),
		tasks:          make(map[string]*PackingTask),
	}
}

func (m *mockPackingRepository) CreatePackage(ctx context.Context, pkg *Package) error {
	m.packages[pkg.ID] = pkg
	return nil
}

func (m *mockPackingRepository) UpdatePackage(ctx context.Context, pkg *Package) error {
	m.packages[pkg.ID] = pkg
	return nil
}

func (m *mockPackingRepository) GetPackage(ctx context.Context, id string) (*Package, error) {
	if p, ok := m.packages[id]; ok {
		return p, nil
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) ListPackages(ctx context.Context, activeOnly bool) ([]*Package, error) {
	result := make([]*Package, 0)
	for _, p := range m.packages {
		if !activeOnly || p.IsActive {
			result = append(result, p)
		}
	}
	return result, nil
}

func (m *mockPackingRepository) GetPackagesByType(ctx context.Context, pkgType PackageType) ([]*Package, error) {
	result := make([]*Package, 0)
	for _, p := range m.packages {
		if p.Type == pkgType {
			result = append(result, p)
		}
	}
	return result, nil
}

func (m *mockPackingRepository) CreatePackingResult(ctx context.Context, result *PackingResult) error {
	m.packingResults[result.ID] = result
	return nil
}

func (m *mockPackingRepository) GetPackingResult(ctx context.Context, id string) (*PackingResult, error) {
	if r, ok := m.packingResults[id]; ok {
		return r, nil
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) GetPackingResultByOrder(ctx context.Context, orderID string) (*PackingResult, error) {
	for _, r := range m.packingResults {
		if r.OrderID == orderID {
			return r, nil
		}
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) CreatePackingSlip(ctx context.Context, slip *PackingSlip) error {
	m.packingSlips[slip.ID] = slip
	return nil
}

func (m *mockPackingRepository) GetPackingSlip(ctx context.Context, id string) (*PackingSlip, error) {
	if s, ok := m.packingSlips[id]; ok {
		return s, nil
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) GetPackingSlipsByOrder(ctx context.Context, orderID string) ([]*PackingSlip, error) {
	result := make([]*PackingSlip, 0)
	for _, s := range m.packingSlips {
		if s.OrderID == orderID {
			result = append(result, s)
		}
	}
	return result, nil
}

func (m *mockPackingRepository) CreateStation(ctx context.Context, station *PackingStation) error {
	m.stations[station.ID] = station
	return nil
}

func (m *mockPackingRepository) UpdateStation(ctx context.Context, station *PackingStation) error {
	m.stations[station.ID] = station
	return nil
}

func (m *mockPackingRepository) GetStation(ctx context.Context, id string) (*PackingStation, error) {
	if s, ok := m.stations[id]; ok {
		return s, nil
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) ListStations(ctx context.Context) ([]*PackingStation, error) {
	result := make([]*PackingStation, 0, len(m.stations))
	for _, s := range m.stations {
		result = append(result, s)
	}
	return result, nil
}

func (m *mockPackingRepository) GetAvailableStation(ctx context.Context) (*PackingStation, error) {
	for _, s := range m.stations {
		if s.Status == "available" {
			return s, nil
		}
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) CreatePackingTask(ctx context.Context, task *PackingTask) error {
	m.tasks[task.ID] = task
	return nil
}

func (m *mockPackingRepository) UpdatePackingTask(ctx context.Context, task *PackingTask) error {
	m.tasks[task.ID] = task
	return nil
}

func (m *mockPackingRepository) GetPackingTask(ctx context.Context, id string) (*PackingTask, error) {
	if t, ok := m.tasks[id]; ok {
		return t, nil
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) GetPackingTaskByOrder(ctx context.Context, orderID string) (*PackingTask, error) {
	for _, t := range m.tasks {
		if t.OrderID == orderID {
			return t, nil
		}
	}
	return nil, ErrPackageNotFound
}

func (m *mockPackingRepository) ListPackingTasks(ctx context.Context, status string, limit int) ([]*PackingTask, error) {
	result := make([]*PackingTask, 0)
	for _, t := range m.tasks {
		if status == "" || t.Status == status {
			result = append(result, t)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockPackingRepository) GetNextPackingTask(ctx context.Context, stationID string) (*PackingTask, error) {
	for _, t := range m.tasks {
		if t.Status == "pending" {
			return t, nil
		}
	}
	return nil, ErrPackageNotFound
}

// Tests

func TestPackingService_CalculatePacking(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	// Create packages
	repo.packages["pkg1"] = &Package{
		ID:        "pkg1",
		Name:      "Small Box",
		Type:      PackageBox,
		Length:    30,
		Width:     20,
		Height:    15,
		MaxWeight: 5,
		TareWeight: 0.2,
		IsActive:  true,
		InStock:   100,
	}
	repo.packages["pkg2"] = &Package{
		ID:        "pkg2",
		Name:      "Medium Box",
		Type:      PackageBox,
		Length:    50,
		Width:     40,
		Height:    30,
		MaxWeight: 20,
		TareWeight: 0.5,
		IsActive:  true,
		InStock:   50,
	}

	items := []PackingItem{
		{ProductID: "prod1", SKU: "SKU001", Name: "Product 1", Quantity: 2, Length: 10, Width: 10, Height: 5, Weight: 0.5},
		{ProductID: "prod2", SKU: "SKU002", Name: "Product 2", Quantity: 1, Length: 15, Width: 10, Height: 10, Weight: 1.0},
	}

	result, err := service.CalculatePacking(ctx, "ORD001", items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result.OrderID != "ORD001" {
		t.Errorf("Expected order ID 'ORD001', got %s", result.OrderID)
	}
	if len(result.Packages) == 0 {
		t.Error("Expected at least one package")
	}
}

func TestPackingService_CalculatePacking_NoItems(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	_, err := service.CalculatePacking(ctx, "ORD001", []PackingItem{})
	if err == nil {
		t.Error("Expected error for empty items")
	}
}

func TestPackingService_CalculatePacking_NoSuitablePackage(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	// No packages available
	items := []PackingItem{
		{ProductID: "prod1", Quantity: 1, Length: 10, Width: 10, Height: 5, Weight: 0.5},
	}

	_, err := service.CalculatePacking(ctx, "ORD001", items)
	if err != ErrNoSuitablePackage {
		t.Errorf("Expected ErrNoSuitablePackage, got %v", err)
	}
}

func TestPackingService_CreatePackingTask(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	items := []PackingItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 2},
	}

	task, err := service.CreatePackingTask(ctx, "ORD001", items, 1)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.OrderID != "ORD001" {
		t.Errorf("Expected order ID 'ORD001', got %s", task.OrderID)
	}
	if task.Status != "pending" {
		t.Errorf("Expected status 'pending', got %s", task.Status)
	}
	if task.Priority != 1 {
		t.Errorf("Expected priority 1, got %d", task.Priority)
	}
}

func TestPackingService_StartPackingTask(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &PackingTask{
		ID:      "task1",
		OrderID: "ORD001",
		Status:  "pending",
	}
	repo.stations["station1"] = &PackingStation{
		ID:     "station1",
		Name:   "Station 1",
		Status: "available",
	}

	err := service.StartPackingTask(ctx, "task1", "station1", "user1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	task, _ := repo.GetPackingTask(ctx, "task1")
	if task.Status != "in_progress" {
		t.Errorf("Expected status 'in_progress', got %s", task.Status)
	}
	if task.AssignedTo != "user1" {
		t.Errorf("Expected assigned to 'user1', got %s", task.AssignedTo)
	}
	if task.StartedAt == nil {
		t.Error("Expected started at to be set")
	}

	station, _ := repo.GetStation(ctx, "station1")
	if station.Status != "busy" {
		t.Errorf("Expected station status 'busy', got %s", station.Status)
	}
}

func TestPackingService_StartPackingTask_NotPending(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &PackingTask{
		ID:     "task1",
		Status: "completed",
	}

	err := service.StartPackingTask(ctx, "task1", "station1", "user1")
	if err == nil {
		t.Error("Expected error for non-pending task")
	}
}

func TestPackingService_CompletePackingTask(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	startedAt := time.Now().Add(-10 * time.Minute)
	repo.tasks["task1"] = &PackingTask{
		ID:        "task1",
		OrderID:   "ORD001",
		Status:    "in_progress",
		StationID: "station1",
		StartedAt: &startedAt,
	}
	repo.stations["station1"] = &PackingStation{
		ID:           "station1",
		Status:       "busy",
		AssignedUser: "user1",
	}

	packingResult := &PackingResult{
		ID:      "result1",
		OrderID: "ORD001",
	}

	err := service.CompletePackingTask(ctx, "task1", packingResult)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	task, _ := repo.GetPackingTask(ctx, "task1")
	if task.Status != "completed" {
		t.Errorf("Expected status 'completed', got %s", task.Status)
	}
	if task.CompletedAt == nil {
		t.Error("Expected completed at to be set")
	}

	station, _ := repo.GetStation(ctx, "station1")
	if station.Status != "available" {
		t.Errorf("Expected station status 'available', got %s", station.Status)
	}
}

func TestPackingService_GeneratePackingSlip(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	items := []PackingSlipItem{
		{SKU: "SKU001", Name: "Product 1", Quantity: 2},
		{SKU: "SKU002", Name: "Product 2", Quantity: 1},
	}

	shipFrom := AddressInfo{
		Name:       "Warehouse",
		Address1:   "123 Storage St",
		City:       "Kyiv",
		PostalCode: "01001",
		Country:    "Ukraine",
	}

	shipTo := AddressInfo{
		Name:       "John Doe",
		Address1:   "456 Customer Ave",
		City:       "Lviv",
		PostalCode: "79000",
		Country:    "Ukraine",
	}

	slip, err := service.GeneratePackingSlip(ctx, "ORD001", 1, 2, items, shipFrom, shipTo, 2.5, "30x20x15", "Fragile")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if slip.OrderID != "ORD001" {
		t.Errorf("Expected order ID 'ORD001', got %s", slip.OrderID)
	}
	if slip.PackageNum != 1 {
		t.Errorf("Expected package num 1, got %d", slip.PackageNum)
	}
	if slip.TotalPkgs != 2 {
		t.Errorf("Expected total packages 2, got %d", slip.TotalPkgs)
	}
	if len(slip.Items) != 2 {
		t.Errorf("Expected 2 items, got %d", len(slip.Items))
	}
}

func TestPackingService_GetPackingSlipsByOrder(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.packingSlips["slip1"] = &PackingSlip{ID: "slip1", OrderID: "ORD001", PackageNum: 1}
	repo.packingSlips["slip2"] = &PackingSlip{ID: "slip2", OrderID: "ORD001", PackageNum: 2}
	repo.packingSlips["slip3"] = &PackingSlip{ID: "slip3", OrderID: "ORD002", PackageNum: 1}

	slips, err := service.GetPackingSlipsByOrder(ctx, "ORD001")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(slips) != 2 {
		t.Errorf("Expected 2 slips, got %d", len(slips))
	}
}

func TestPackingService_CreatePackage(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	pkg := &Package{
		Name:      "Test Box",
		Type:      PackageBox,
		Material:  MaterialCardboard,
		Length:    40,
		Width:     30,
		Height:    20,
		MaxWeight: 10,
		TareWeight: 0.3,
		Cost:      5.0,
		IsActive:  true,
	}

	err := service.CreatePackage(ctx, pkg)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if pkg.ID == "" {
		t.Error("Expected package ID to be set")
	}
}

func TestPackingService_UpdatePackage(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.packages["pkg1"] = &Package{
		ID:   "pkg1",
		Name: "Original Name",
	}

	pkg := &Package{
		ID:   "pkg1",
		Name: "Updated Name",
	}

	err := service.UpdatePackage(ctx, pkg)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updated, _ := repo.GetPackage(ctx, "pkg1")
	if updated.Name != "Updated Name" {
		t.Errorf("Expected name 'Updated Name', got %s", updated.Name)
	}
}

func TestPackingService_GetPackages(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.packages["pkg1"] = &Package{ID: "pkg1", Name: "Active", IsActive: true}
	repo.packages["pkg2"] = &Package{ID: "pkg2", Name: "Inactive", IsActive: false}

	all, err := service.GetPackages(ctx, false)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(all) != 2 {
		t.Errorf("Expected 2 packages, got %d", len(all))
	}

	active, err := service.GetPackages(ctx, true)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(active) != 1 {
		t.Errorf("Expected 1 active package, got %d", len(active))
	}
}

func TestPackingService_CreatePackingStation(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	station := &PackingStation{
		Name:      "Station 1",
		Location:  "Zone A",
		Equipment: []string{"scale", "printer"},
	}

	err := service.CreatePackingStation(ctx, station)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if station.ID == "" {
		t.Error("Expected station ID to be set")
	}
	if station.Status != "available" {
		t.Errorf("Expected status 'available', got %s", station.Status)
	}
}

func TestPackingService_GetPackingStations(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.stations["s1"] = &PackingStation{ID: "s1", Name: "Station 1"}
	repo.stations["s2"] = &PackingStation{ID: "s2", Name: "Station 2"}

	stations, err := service.GetPackingStations(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(stations) != 2 {
		t.Errorf("Expected 2 stations, got %d", len(stations))
	}
}

func TestPackingService_SuggestPackage(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.packages["pkg1"] = &Package{
		ID:        "pkg1",
		Name:      "Small Box",
		Length:    20,
		Width:     15,
		Height:    10,
		MaxWeight: 3,
		TareWeight: 0.2,
		IsActive:  true,
		InStock:   100,
	}
	repo.packages["pkg2"] = &Package{
		ID:        "pkg2",
		Name:      "Large Box",
		Length:    50,
		Width:     40,
		Height:    30,
		MaxWeight: 20,
		TareWeight: 0.5,
		IsActive:  true,
		InStock:   50,
	}

	items := []PackingItem{
		{ProductID: "prod1", Quantity: 1, Length: 15, Width: 10, Height: 5, Weight: 1.0},
	}

	pkg, err := service.SuggestPackage(ctx, items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should suggest smallest suitable package
	if pkg.Name != "Small Box" {
		t.Errorf("Expected 'Small Box', got %s", pkg.Name)
	}
}

func TestPackingService_SuggestPackage_NoSuitable(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.packages["pkg1"] = &Package{
		ID:        "pkg1",
		Name:      "Small Box",
		Length:    10,
		Width:     10,
		Height:    10,
		MaxWeight: 1,
		IsActive:  true,
		InStock:   100,
	}

	// Item too large for available packages
	items := []PackingItem{
		{ProductID: "prod1", Quantity: 1, Length: 50, Width: 50, Height: 50, Weight: 10.0},
	}

	_, err := service.SuggestPackage(ctx, items)
	if err != ErrNoSuitablePackage {
		t.Errorf("Expected ErrNoSuitablePackage, got %v", err)
	}
}

func TestPackingService_ListPackingTasks(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &PackingTask{ID: "task1", Status: "pending"}
	repo.tasks["task2"] = &PackingTask{ID: "task2", Status: "in_progress"}
	repo.tasks["task3"] = &PackingTask{ID: "task3", Status: "pending"}

	pending, err := service.ListPackingTasks(ctx, "pending", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(pending) != 2 {
		t.Errorf("Expected 2 pending tasks, got %d", len(pending))
	}
}

func TestPackingService_GetNextPackingTask(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &PackingTask{ID: "task1", Status: "pending"}

	task, err := service.GetNextPackingTask(ctx, "station1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.ID != "task1" {
		t.Errorf("Expected task1, got %s", task.ID)
	}
}

func TestPackage_Volume(t *testing.T) {
	pkg := &Package{
		Length: 30,
		Width:  20,
		Height: 15,
	}

	volume := pkg.Volume()
	expected := 30.0 * 20.0 * 15.0

	if volume != expected {
		t.Errorf("Expected volume %.2f, got %.2f", expected, volume)
	}
}

func TestPackingItem_TotalVolume(t *testing.T) {
	item := &PackingItem{
		Length:   10,
		Width:    5,
		Height:   3,
		Quantity: 4,
	}

	volume := item.TotalVolume()
	expected := 10.0 * 5.0 * 3.0 * 4.0

	if volume != expected {
		t.Errorf("Expected volume %.2f, got %.2f", expected, volume)
	}
}

func TestPackingItem_TotalWeight(t *testing.T) {
	item := &PackingItem{
		Weight:   0.5,
		Quantity: 4,
	}

	weight := item.TotalWeight()
	expected := 0.5 * 4.0

	if weight != expected {
		t.Errorf("Expected weight %.2f, got %.2f", expected, weight)
	}
}

func TestPackingService_WeighPackage(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.packingResults["result1"] = &PackingResult{
		ID:      "result1",
		OrderID: "ORD001",
		Packages: []PackedPackage{
			{PackageID: "pkg1", TotalWeight: 1.0},
			{PackageID: "pkg2", TotalWeight: 2.0},
		},
	}

	err := service.WeighPackage(ctx, "ORD001", 0, 1.5)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestPackingService_WeighPackage_InvalidIndex(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.packingResults["result1"] = &PackingResult{
		ID:       "result1",
		OrderID:  "ORD001",
		Packages: []PackedPackage{{PackageID: "pkg1"}},
	}

	err := service.WeighPackage(ctx, "ORD001", 5, 1.5)
	if err == nil {
		t.Error("Expected error for invalid index")
	}
}

func TestPackingService_GetPackingTask(t *testing.T) {
	repo := newMockPackingRepository()
	service := NewPackingService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &PackingTask{
		ID:       "task1",
		OrderID:  "ORD001",
		Status:   "pending",
		Priority: 1,
	}

	task, err := service.GetPackingTask(ctx, "task1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if task.OrderID != "ORD001" {
		t.Errorf("Expected OrderID 'ORD001', got %s", task.OrderID)
	}
}
