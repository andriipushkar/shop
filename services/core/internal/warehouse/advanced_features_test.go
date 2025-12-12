package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockAdvancedFeaturesRepository implements AdvancedFeaturesRepository for testing
type mockAdvancedFeaturesRepository struct {
	cycleCountPlans map[string]*CycleCountPlan
	cycleCounts     map[string]*CycleCount
	batches         map[string]*Batch
	batchMovements  []*BatchMovement
	tempZones       map[string]*TemperatureZoneConfig
	tempReadings    []*TemperatureReading
	tempAlerts      []*TemperatureAlert
	rfidTags        map[string]*RFIDTag
	rfidScans       []*RFIDScan
	amrRobots       map[string]*AMRRobot
	amrTasks        map[string]*AMRTask
	workerProfiles  map[string]*WorkerProfile
	leaderboards    map[string]*Leaderboard
	dailyChallenges []*DailyChallenge
}

func newMockAdvancedFeaturesRepository() *mockAdvancedFeaturesRepository {
	return &mockAdvancedFeaturesRepository{
		cycleCountPlans: make(map[string]*CycleCountPlan),
		cycleCounts:     make(map[string]*CycleCount),
		batches:         make(map[string]*Batch),
		batchMovements:  []*BatchMovement{},
		tempZones:       make(map[string]*TemperatureZoneConfig),
		tempReadings:    []*TemperatureReading{},
		tempAlerts:      []*TemperatureAlert{},
		rfidTags:        make(map[string]*RFIDTag),
		rfidScans:       []*RFIDScan{},
		amrRobots:       make(map[string]*AMRRobot),
		amrTasks:        make(map[string]*AMRTask),
		workerProfiles:  make(map[string]*WorkerProfile),
		leaderboards:    make(map[string]*Leaderboard),
		dailyChallenges: []*DailyChallenge{},
	}
}

// Cycle Counting
func (m *mockAdvancedFeaturesRepository) CreateCycleCountPlan(ctx context.Context, plan *CycleCountPlan) error {
	m.cycleCountPlans[plan.ID] = plan
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetCycleCountPlan(ctx context.Context, id string) (*CycleCountPlan, error) {
	if plan, ok := m.cycleCountPlans[id]; ok {
		return plan, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockAdvancedFeaturesRepository) ListCycleCountPlans(ctx context.Context, warehouseID string) ([]*CycleCountPlan, error) {
	result := make([]*CycleCountPlan, 0)
	for _, plan := range m.cycleCountPlans {
		if warehouseID == "" || plan.WarehouseID == warehouseID {
			result = append(result, plan)
		}
	}
	return result, nil
}

func (m *mockAdvancedFeaturesRepository) CreateCycleCount(ctx context.Context, count *CycleCount) error {
	m.cycleCounts[count.ID] = count
	return nil
}

func (m *mockAdvancedFeaturesRepository) UpdateCycleCount(ctx context.Context, count *CycleCount) error {
	m.cycleCounts[count.ID] = count
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetCycleCount(ctx context.Context, id string) (*CycleCount, error) {
	if count, ok := m.cycleCounts[id]; ok {
		return count, nil
	}
	return nil, ErrProductNotFound
}

// Batch Tracking
func (m *mockAdvancedFeaturesRepository) CreateBatch(ctx context.Context, batch *Batch) error {
	m.batches[batch.ID] = batch
	return nil
}

func (m *mockAdvancedFeaturesRepository) UpdateBatch(ctx context.Context, batch *Batch) error {
	m.batches[batch.ID] = batch
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetBatch(ctx context.Context, id string) (*Batch, error) {
	if batch, ok := m.batches[id]; ok {
		return batch, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockAdvancedFeaturesRepository) GetBatchByNumber(ctx context.Context, batchNumber string) (*Batch, error) {
	for _, batch := range m.batches {
		if batch.BatchNumber == batchNumber {
			return batch, nil
		}
	}
	return nil, ErrProductNotFound
}

func (m *mockAdvancedFeaturesRepository) ListBatches(ctx context.Context, productID string, status string) ([]*Batch, error) {
	result := make([]*Batch, 0)
	for _, batch := range m.batches {
		if (productID == "" || batch.ProductID == productID) && (status == "" || batch.Status == status) {
			result = append(result, batch)
		}
	}
	return result, nil
}

func (m *mockAdvancedFeaturesRepository) CreateBatchMovement(ctx context.Context, movement *BatchMovement) error {
	m.batchMovements = append(m.batchMovements, movement)
	return nil
}

// Temperature
func (m *mockAdvancedFeaturesRepository) CreateTempZone(ctx context.Context, zone *TemperatureZoneConfig) error {
	m.tempZones[zone.ID] = zone
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetTempZone(ctx context.Context, id string) (*TemperatureZoneConfig, error) {
	if zone, ok := m.tempZones[id]; ok {
		return zone, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockAdvancedFeaturesRepository) ListTempZones(ctx context.Context, warehouseID string) ([]*TemperatureZoneConfig, error) {
	result := make([]*TemperatureZoneConfig, 0)
	for _, zone := range m.tempZones {
		if warehouseID == "" || zone.WarehouseID == warehouseID {
			result = append(result, zone)
		}
	}
	return result, nil
}

func (m *mockAdvancedFeaturesRepository) RecordTemperature(ctx context.Context, reading *TemperatureReading) error {
	m.tempReadings = append(m.tempReadings, reading)
	return nil
}

func (m *mockAdvancedFeaturesRepository) CreateTempAlert(ctx context.Context, alert *TemperatureAlert) error {
	m.tempAlerts = append(m.tempAlerts, alert)
	return nil
}

func (m *mockAdvancedFeaturesRepository) ListTempAlerts(ctx context.Context, warehouseID string, status string) ([]*TemperatureAlert, error) {
	result := make([]*TemperatureAlert, 0)
	for _, alert := range m.tempAlerts {
		if (warehouseID == "" || alert.WarehouseID == warehouseID) && (status == "" || alert.Status == status) {
			result = append(result, alert)
		}
	}
	return result, nil
}

// RFID
func (m *mockAdvancedFeaturesRepository) CreateRFIDTag(ctx context.Context, tag *RFIDTag) error {
	m.rfidTags[tag.TagID] = tag
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetRFIDTag(ctx context.Context, tagID string) (*RFIDTag, error) {
	if tag, ok := m.rfidTags[tagID]; ok {
		return tag, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockAdvancedFeaturesRepository) UpdateRFIDTag(ctx context.Context, tag *RFIDTag) error {
	m.rfidTags[tag.TagID] = tag
	return nil
}

func (m *mockAdvancedFeaturesRepository) RecordRFIDScan(ctx context.Context, scan *RFIDScan) error {
	m.rfidScans = append(m.rfidScans, scan)
	return nil
}

// AMR
func (m *mockAdvancedFeaturesRepository) CreateAMRRobot(ctx context.Context, robot *AMRRobot) error {
	m.amrRobots[robot.ID] = robot
	return nil
}

func (m *mockAdvancedFeaturesRepository) UpdateAMRRobot(ctx context.Context, robot *AMRRobot) error {
	m.amrRobots[robot.ID] = robot
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetAMRRobot(ctx context.Context, id string) (*AMRRobot, error) {
	if robot, ok := m.amrRobots[id]; ok {
		return robot, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockAdvancedFeaturesRepository) ListAMRRobots(ctx context.Context, warehouseID string) ([]*AMRRobot, error) {
	result := make([]*AMRRobot, 0)
	for _, robot := range m.amrRobots {
		if warehouseID == "" || robot.WarehouseID == warehouseID {
			result = append(result, robot)
		}
	}
	return result, nil
}

func (m *mockAdvancedFeaturesRepository) CreateAMRTask(ctx context.Context, task *AMRTask) error {
	m.amrTasks[task.ID] = task
	return nil
}

func (m *mockAdvancedFeaturesRepository) UpdateAMRTask(ctx context.Context, task *AMRTask) error {
	m.amrTasks[task.ID] = task
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetNextAMRTask(ctx context.Context, warehouseID string) (*AMRTask, error) {
	for _, task := range m.amrTasks {
		if task.Status == "pending" {
			return task, nil
		}
	}
	return nil, ErrProductNotFound
}

// Gamification
func (m *mockAdvancedFeaturesRepository) GetWorkerProfile(ctx context.Context, workerID string) (*WorkerProfile, error) {
	if profile, ok := m.workerProfiles[workerID]; ok {
		return profile, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockAdvancedFeaturesRepository) UpdateWorkerProfile(ctx context.Context, profile *WorkerProfile) error {
	m.workerProfiles[profile.WorkerID] = profile
	return nil
}

func (m *mockAdvancedFeaturesRepository) GetLeaderboard(ctx context.Context, leaderboardType string, limit int) (*Leaderboard, error) {
	if lb, ok := m.leaderboards[leaderboardType]; ok {
		return lb, nil
	}
	return &Leaderboard{Type: leaderboardType, Entries: []LeaderboardEntry{}}, nil
}

func (m *mockAdvancedFeaturesRepository) GetDailyChallenges(ctx context.Context, date time.Time) ([]*DailyChallenge, error) {
	return m.dailyChallenges, nil
}

func (m *mockAdvancedFeaturesRepository) AwardBadge(ctx context.Context, workerID, badgeID string) error {
	return nil
}

func (m *mockAdvancedFeaturesRepository) AddXP(ctx context.Context, workerID string, xp int, reason string) error {
	return nil
}

// Tests

func TestAdvancedFeaturesService_NewService(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
}

func TestAdvancedFeaturesService_CreateCycleCountPlan(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	plan := &CycleCountPlan{
		Name:              "Weekly Count",
		WarehouseID:       "wh1",
		Frequency:         "weekly",
		Method:            "random",
		LocationsPerCount: 50,
		IsActive:          true,
	}

	err := service.CreateCycleCountPlan(ctx, plan)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if plan.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if plan.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

func TestAdvancedFeaturesService_GenerateCycleCount(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Create plan first
	plan := &CycleCountPlan{
		ID:                "plan1",
		Name:              "Weekly Count",
		WarehouseID:       "wh1",
		Method:            "random",
		LocationsPerCount: 10,
	}
	repo.cycleCountPlans["plan1"] = plan

	count, err := service.GenerateCycleCount(ctx, "plan1", "user1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if count.PlanID != "plan1" {
		t.Errorf("Expected plan ID 'plan1', got %s", count.PlanID)
	}
	if count.Status != "pending" {
		t.Errorf("Expected status 'pending', got %s", count.Status)
	}
	if count.CreatedBy != "user1" {
		t.Errorf("Expected created by 'user1', got %s", count.CreatedBy)
	}
}

func TestAdvancedFeaturesService_RecordCount(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup cycle count
	count := &CycleCount{
		ID: "count1",
		Locations: []CountLocation{
			{LocationID: "loc1", LocationCode: "A-01", ExpectedQty: 10, Status: "pending"},
		},
	}
	repo.cycleCounts["count1"] = count

	err := service.RecordCount(ctx, "count1", "loc1", 12, "counter1", "Found extra items")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCount := repo.cycleCounts["count1"]
	if *updatedCount.Locations[0].CountedQty != 12 {
		t.Errorf("Expected counted qty 12, got %d", *updatedCount.Locations[0].CountedQty)
	}
	if updatedCount.Locations[0].Variance != 2 {
		t.Errorf("Expected variance 2, got %d", updatedCount.Locations[0].Variance)
	}
}

func TestAdvancedFeaturesService_CreateBatch(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	batch := &Batch{
		BatchNumber: "BATCH001",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    100,
	}

	err := service.CreateBatch(ctx, batch)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if batch.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if batch.Status != "active" {
		t.Errorf("Expected status 'active', got %s", batch.Status)
	}
	if batch.RemainingQty != 100 {
		t.Errorf("Expected remaining qty 100, got %d", batch.RemainingQty)
	}
}

func TestAdvancedFeaturesService_RecordBatchMovement_Shipment(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup batch
	batch := &Batch{
		ID:           "batch1",
		BatchNumber:  "BATCH001",
		ProductID:    "prod1",
		Quantity:     100,
		RemainingQty: 100,
		Status:       "active",
	}
	repo.batches["batch1"] = batch

	err := service.RecordBatchMovement(ctx, "batch1", "shipment", "wh1", "", 30, "order1", "Shipped to customer", "user1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedBatch := repo.batches["batch1"]
	if updatedBatch.RemainingQty != 70 {
		t.Errorf("Expected remaining qty 70, got %d", updatedBatch.RemainingQty)
	}
}

func TestAdvancedFeaturesService_RecordBatchMovement_Deplete(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	batch := &Batch{
		ID:           "batch1",
		BatchNumber:  "BATCH001",
		ProductID:    "prod1",
		Quantity:     100,
		RemainingQty: 30,
		Status:       "active",
	}
	repo.batches["batch1"] = batch

	err := service.RecordBatchMovement(ctx, "batch1", "shipment", "wh1", "", 30, "order1", "", "user1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedBatch := repo.batches["batch1"]
	if updatedBatch.Status != "depleted" {
		t.Errorf("Expected status 'depleted', got %s", updatedBatch.Status)
	}
}

func TestAdvancedFeaturesService_RecordBatchMovement_Return(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	batch := &Batch{
		ID:           "batch1",
		BatchNumber:  "BATCH001",
		ProductID:    "prod1",
		Quantity:     100,
		RemainingQty: 0,
		Status:       "depleted",
	}
	repo.batches["batch1"] = batch

	err := service.RecordBatchMovement(ctx, "batch1", "return", "", "wh1", 10, "return1", "Customer return", "user1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedBatch := repo.batches["batch1"]
	if updatedBatch.RemainingQty != 10 {
		t.Errorf("Expected remaining qty 10, got %d", updatedBatch.RemainingQty)
	}
	if updatedBatch.Status != "active" {
		t.Errorf("Expected status 'active', got %s", updatedBatch.Status)
	}
}

func TestAdvancedFeaturesService_RecordTemperature_Normal(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup temperature zone
	zone := &TemperatureZoneConfig{
		ID:           "zone1",
		ZoneID:       "zone1",
		ZoneName:     "Cold Storage",
		MinTemp:      2,
		MaxTemp:      8,
		AlertEnabled: true,
	}
	repo.tempZones["zone1"] = zone

	err := service.RecordTemperature(ctx, "sensor1", "zone1", "wh1", 5.0, nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(repo.tempReadings) != 1 {
		t.Fatalf("Expected 1 reading, got %d", len(repo.tempReadings))
	}
	if repo.tempReadings[0].IsAlert {
		t.Error("Expected no alert for normal temperature")
	}
}

func TestAdvancedFeaturesService_RecordTemperature_High(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	zone := &TemperatureZoneConfig{
		ID:           "zone1",
		ZoneID:       "zone1",
		ZoneName:     "Cold Storage",
		MinTemp:      2,
		MaxTemp:      8,
		AlertEnabled: true,
	}
	repo.tempZones["zone1"] = zone

	err := service.RecordTemperature(ctx, "sensor1", "zone1", "wh1", 12.0, nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !repo.tempReadings[0].IsAlert {
		t.Error("Expected alert for high temperature")
	}
	if repo.tempReadings[0].AlertType != "high" {
		t.Errorf("Expected alert type 'high', got %s", repo.tempReadings[0].AlertType)
	}
	if len(repo.tempAlerts) != 1 {
		t.Error("Expected temperature alert to be created")
	}
}

func TestAdvancedFeaturesService_RecordTemperature_Low(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	zone := &TemperatureZoneConfig{
		ID:           "zone1",
		ZoneID:       "zone1",
		ZoneName:     "Cold Storage",
		MinTemp:      2,
		MaxTemp:      8,
		AlertEnabled: true,
	}
	repo.tempZones["zone1"] = zone

	err := service.RecordTemperature(ctx, "sensor1", "zone1", "wh1", 0.0, nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if repo.tempReadings[0].AlertType != "low" {
		t.Errorf("Expected alert type 'low', got %s", repo.tempReadings[0].AlertType)
	}
}

func TestAdvancedFeaturesService_ProcessRFIDScan(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup RFID tag
	tag := &RFIDTag{
		ID:        "tag1",
		TagID:     "TAG001",
		ProductID: "prod1",
		Status:    "active",
	}
	repo.rfidTags["TAG001"] = tag

	scan, err := service.ProcessRFIDScan(ctx, "reader1", []string{"TAG001"}, "zone-a", "inventory", "user1", "")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if scan.ReaderID != "reader1" {
		t.Errorf("Expected reader 'reader1', got %s", scan.ReaderID)
	}
	if len(scan.TagIDs) != 1 {
		t.Errorf("Expected 1 tag, got %d", len(scan.TagIDs))
	}

	// Check tag was updated
	updatedTag := repo.rfidTags["TAG001"]
	if updatedTag.LastLocation != "zone-a" {
		t.Errorf("Expected last location 'zone-a', got %s", updatedTag.LastLocation)
	}
}

func TestAdvancedFeaturesService_AssignAMRTask(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup robot and task
	robot := &AMRRobot{
		ID:     "robot1",
		Name:   "AMR-001",
		Status: "idle",
	}
	repo.amrRobots["robot1"] = robot

	task := &AMRTask{
		ID:           "task1",
		Type:         "transport",
		Status:       "pending",
		FromLocation: "A-01",
		ToLocation:   "B-02",
	}
	repo.amrTasks["task1"] = task

	err := service.AssignAMRTask(ctx, "task1", "robot1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.amrTasks["task1"]
	if updatedTask.RobotID != "robot1" {
		t.Errorf("Expected robot 'robot1', got %s", updatedTask.RobotID)
	}
	if updatedTask.Status != "assigned" {
		t.Errorf("Expected status 'assigned', got %s", updatedTask.Status)
	}

	updatedRobot := repo.amrRobots["robot1"]
	if updatedRobot.Status != "working" {
		t.Errorf("Expected robot status 'working', got %s", updatedRobot.Status)
	}
}

func TestAdvancedFeaturesService_AssignAMRTask_RobotBusy(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	robot := &AMRRobot{
		ID:     "robot1",
		Name:   "AMR-001",
		Status: "working", // Already busy
	}
	repo.amrRobots["robot1"] = robot

	task := &AMRTask{
		ID:     "task1",
		Status: "pending",
	}
	repo.amrTasks["task1"] = task

	err := service.AssignAMRTask(ctx, "task1", "robot1")
	if err == nil {
		t.Error("Expected error for busy robot")
	}
}

func TestAdvancedFeaturesService_AwardPoints_NewProfile(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	err := service.AwardPoints(ctx, "worker1", 100, "Completed task")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	profile := repo.workerProfiles["worker1"]
	if profile == nil {
		t.Fatal("Expected profile to be created")
	}
	if profile.TotalPoints != 100 {
		t.Errorf("Expected 100 points, got %d", profile.TotalPoints)
	}
}

func TestAdvancedFeaturesService_AwardPoints_ExistingProfile(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup existing profile
	profile := &WorkerProfile{
		ID:            "profile1",
		WorkerID:      "worker1",
		Level:         1,
		XP:            50,
		XPToNextLevel: 100,
		TotalPoints:   200,
	}
	repo.workerProfiles["worker1"] = profile

	err := service.AwardPoints(ctx, "worker1", 100, "Completed task")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedProfile := repo.workerProfiles["worker1"]
	if updatedProfile.TotalPoints != 300 {
		t.Errorf("Expected 300 points, got %d", updatedProfile.TotalPoints)
	}
}

func TestAdvancedFeaturesService_AwardPoints_LevelUp(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup profile close to level up
	profile := &WorkerProfile{
		ID:            "profile1",
		WorkerID:      "worker1",
		Level:         1,
		XP:            95,
		XPToNextLevel: 100,
		TotalPoints:   950,
	}
	repo.workerProfiles["worker1"] = profile

	// Award 100 points = 10 XP, should cause level up
	err := service.AwardPoints(ctx, "worker1", 100, "Big bonus")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedProfile := repo.workerProfiles["worker1"]
	if updatedProfile.Level != 2 {
		t.Errorf("Expected level 2 after level up, got %d", updatedProfile.Level)
	}
}

func TestAdvancedFeaturesService_GetLeaderboard(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup leaderboard
	repo.leaderboards["weekly"] = &Leaderboard{
		Type: "weekly",
		Entries: []LeaderboardEntry{
			{WorkerID: "w1", WorkerName: "Worker 1", Score: 100},
			{WorkerID: "w2", WorkerName: "Worker 2", Score: 200},
			{WorkerID: "w3", WorkerName: "Worker 3", Score: 150},
		},
	}

	lb, err := service.GetLeaderboard(ctx, "weekly", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should be sorted by score descending
	if lb.Entries[0].WorkerID != "w2" {
		t.Errorf("Expected w2 first, got %s", lb.Entries[0].WorkerID)
	}
	if lb.Entries[0].Rank != 1 {
		t.Errorf("Expected rank 1, got %d", lb.Entries[0].Rank)
	}
}

func TestAdvancedFeaturesService_CheckAchievements(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)
	ctx := context.Background()

	// Setup profile with achievement ready to complete
	profile := &WorkerProfile{
		ID:       "profile1",
		WorkerID: "worker1",
		Achievements: []Achievement{
			{ID: "ach1", Name: "First Pick", Target: 10, Progress: 15, Completed: false, XPReward: 50},
		},
	}
	repo.workerProfiles["worker1"] = profile

	newAchievements, err := service.CheckAchievements(ctx, "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(newAchievements) != 1 {
		t.Fatalf("Expected 1 new achievement, got %d", len(newAchievements))
	}
	if !newAchievements[0].Completed {
		t.Error("Expected achievement to be completed")
	}
}

func TestAdvancedFeaturesService_SelectLocationsForCount_Random(t *testing.T) {
	repo := newMockAdvancedFeaturesRepository()
	service := NewAdvancedFeaturesService(repo)

	plan := &CycleCountPlan{
		Method:            "random",
		LocationsPerCount: 5,
	}

	locations := service.selectLocationsForCount(plan)
	if len(locations) != 5 {
		t.Errorf("Expected 5 locations, got %d", len(locations))
	}
	for _, loc := range locations {
		if loc.Status != "pending" {
			t.Errorf("Expected status 'pending', got %s", loc.Status)
		}
	}
}
