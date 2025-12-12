package warehouse

import (
	"context"
	"errors"
	"math/rand"
	"sort"
	"time"
)

// =====================================================
// CYCLE COUNTING
// =====================================================

// CycleCountPlan represents cycle counting plan
type CycleCountPlan struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	WarehouseID  string           `json:"warehouse_id"`
	Frequency    string           `json:"frequency"` // daily, weekly, monthly
	Method       string           `json:"method"`    // abc, random, zone, all
	ABCSettings  *ABCSettings     `json:"abc_settings,omitempty"`
	Zones        []string         `json:"zones,omitempty"`
	LocationsPerCount int         `json:"locations_per_count"`
	IsActive     bool             `json:"is_active"`
	LastRun      *time.Time       `json:"last_run,omitempty"`
	NextRun      *time.Time       `json:"next_run,omitempty"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

// ABCSettings for cycle counting
type ABCSettings struct {
	ACountFrequency int `json:"a_count_frequency_days"` // e.g., 30
	BCountFrequency int `json:"b_count_frequency_days"` // e.g., 60
	CCountFrequency int `json:"c_count_frequency_days"` // e.g., 90
}

// CycleCount represents a cycle count session
type CycleCount struct {
	ID           string           `json:"id"`
	PlanID       string           `json:"plan_id,omitempty"`
	WarehouseID  string           `json:"warehouse_id"`
	Status       string           `json:"status"` // pending, in_progress, completed
	Locations    []CountLocation  `json:"locations"`
	TotalLocations int            `json:"total_locations"`
	CountedLocations int          `json:"counted_locations"`
	Variances    int              `json:"variances"`
	AssignedTo   string           `json:"assigned_to,omitempty"`
	StartedAt    *time.Time       `json:"started_at,omitempty"`
	CompletedAt  *time.Time       `json:"completed_at,omitempty"`
	CreatedBy    string           `json:"created_by"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

// CountLocation represents location in cycle count
type CountLocation struct {
	LocationID   string     `json:"location_id"`
	LocationCode string     `json:"location_code"`
	ProductID    string     `json:"product_id,omitempty"`
	SKU          string     `json:"sku,omitempty"`
	ExpectedQty  int        `json:"expected_qty"`
	CountedQty   *int       `json:"counted_qty,omitempty"`
	Variance     int        `json:"variance"`
	Status       string     `json:"status"` // pending, counted, verified
	CountedAt    *time.Time `json:"counted_at,omitempty"`
	CountedBy    string     `json:"counted_by,omitempty"`
	Notes        string     `json:"notes,omitempty"`
}

// =====================================================
// BATCH/LOT TRACKING
// =====================================================

// Batch represents a product batch/lot
type Batch struct {
	ID           string     `json:"id"`
	BatchNumber  string     `json:"batch_number"`
	LotNumber    string     `json:"lot_number,omitempty"`
	ProductID    string     `json:"product_id"`
	SKU          string     `json:"sku"`
	ManufactureDate *time.Time `json:"manufacture_date,omitempty"`
	ExpiryDate   *time.Time `json:"expiry_date,omitempty"`
	SupplierID   string     `json:"supplier_id,omitempty"`
	PONumber     string     `json:"po_number,omitempty"`
	CostPrice    float64    `json:"cost_price,omitempty"`
	Quantity     int        `json:"quantity"`
	RemainingQty int        `json:"remaining_qty"`
	Status       string     `json:"status"` // active, depleted, recalled, expired
	QCStatus     string     `json:"qc_status,omitempty"` // pending, passed, failed
	Certificates []string   `json:"certificates,omitempty"`
	Notes        string     `json:"notes,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// BatchMovement tracks batch movement history
type BatchMovement struct {
	ID          string    `json:"id"`
	BatchID     string    `json:"batch_id"`
	BatchNumber string    `json:"batch_number"`
	ProductID   string    `json:"product_id"`
	Type        string    `json:"type"` // receipt, shipment, transfer, adjustment, return
	FromWarehouse string  `json:"from_warehouse,omitempty"`
	ToWarehouse string    `json:"to_warehouse,omitempty"`
	Quantity    int       `json:"quantity"`
	DocumentID  string    `json:"document_id,omitempty"`
	Notes       string    `json:"notes,omitempty"`
	UserID      string    `json:"user_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// BatchRecall represents batch recall
type BatchRecall struct {
	ID           string    `json:"id"`
	BatchNumbers []string  `json:"batch_numbers"`
	ProductID    string    `json:"product_id"`
	Reason       string    `json:"reason"`
	Status       string    `json:"status"` // initiated, in_progress, completed
	AffectedQty  int       `json:"affected_qty"`
	RecalledQty  int       `json:"recalled_qty"`
	Instructions string    `json:"instructions"`
	InitiatedBy  string    `json:"initiated_by"`
	InitiatedAt  time.Time `json:"initiated_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

// =====================================================
// TEMPERATURE MONITORING
// =====================================================

// TemperatureZoneConfig represents temperature zone configuration
type TemperatureZoneConfig struct {
	ID           string    `json:"id"`
	WarehouseID  string    `json:"warehouse_id"`
	ZoneID       string    `json:"zone_id"`
	ZoneName     string    `json:"zone_name"`
	Type         string    `json:"type"` // ambient, cooled, refrigerated, frozen
	MinTemp      float64   `json:"min_temp_celsius"`
	MaxTemp      float64   `json:"max_temp_celsius"`
	TargetTemp   float64   `json:"target_temp_celsius"`
	Humidity     *float64  `json:"target_humidity_percent,omitempty"`
	AlertEnabled bool      `json:"alert_enabled"`
	SensorIDs    []string  `json:"sensor_ids,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

// TemperatureReading represents temperature sensor reading
type TemperatureReading struct {
	ID          string    `json:"id"`
	SensorID    string    `json:"sensor_id"`
	ZoneID      string    `json:"zone_id"`
	WarehouseID string    `json:"warehouse_id"`
	Temperature float64   `json:"temperature_celsius"`
	Humidity    *float64  `json:"humidity_percent,omitempty"`
	IsAlert     bool      `json:"is_alert"`
	AlertType   string    `json:"alert_type,omitempty"` // high, low, critical
	ReadAt      time.Time `json:"read_at"`
}

// TemperatureAlert represents temperature alert
type TemperatureAlert struct {
	ID            string     `json:"id"`
	ZoneID        string     `json:"zone_id"`
	ZoneName      string     `json:"zone_name"`
	WarehouseID   string     `json:"warehouse_id"`
	AlertType     string     `json:"alert_type"` // high, low, critical
	CurrentTemp   float64    `json:"current_temp_celsius"`
	ThresholdTemp float64    `json:"threshold_temp_celsius"`
	Duration      int        `json:"duration_minutes"`
	Status        string     `json:"status"` // active, acknowledged, resolved
	AcknowledgedBy string    `json:"acknowledged_by,omitempty"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
	ResolvedAt    *time.Time `json:"resolved_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// =====================================================
// RFID SUPPORT
// =====================================================

// RFIDTag represents RFID tag
type RFIDTag struct {
	ID          string    `json:"id"`
	TagID       string    `json:"tag_id"` // EPC code
	ProductID   string    `json:"product_id,omitempty"`
	SKU         string    `json:"sku,omitempty"`
	SerialNumber string   `json:"serial_number,omitempty"`
	BatchNumber string    `json:"batch_number,omitempty"`
	Type        string    `json:"type"` // product, pallet, container, asset
	Status      string    `json:"status"` // active, inactive, lost
	LastSeen    *time.Time `json:"last_seen,omitempty"`
	LastLocation string   `json:"last_location,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// RFIDReader represents RFID reader
type RFIDReader struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Location    string    `json:"location"`
	WarehouseID string    `json:"warehouse_id"`
	ZoneID      string    `json:"zone_id,omitempty"`
	Type        string    `json:"type"` // handheld, portal, fixed
	Status      string    `json:"status"` // online, offline
	LastPing    time.Time `json:"last_ping"`
	CreatedAt   time.Time `json:"created_at"`
}

// RFIDScan represents RFID scan event
type RFIDScan struct {
	ID          string    `json:"id"`
	ReaderID    string    `json:"reader_id"`
	TagIDs      []string  `json:"tag_ids"`
	Location    string    `json:"location"`
	EventType   string    `json:"event_type"` // inventory, movement, pick, receive
	UserID      string    `json:"user_id,omitempty"`
	DocumentID  string    `json:"document_id,omitempty"`
	ScannedAt   time.Time `json:"scanned_at"`
}

// =====================================================
// AMR (AUTONOMOUS MOBILE ROBOTS) INTEGRATION
// =====================================================

// AMRRobot represents autonomous mobile robot
type AMRRobot struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Model        string    `json:"model"`
	WarehouseID  string    `json:"warehouse_id"`
	Status       string    `json:"status"` // idle, working, charging, maintenance, error
	BatteryLevel int       `json:"battery_level"`
	CurrentTask  string    `json:"current_task_id,omitempty"`
	CurrentLocation Position `json:"current_location"`
	Payload      *Payload  `json:"payload,omitempty"`
	LastActive   time.Time `json:"last_active"`
	CreatedAt    time.Time `json:"created_at"`
}

// Position represents robot position
type Position struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Z     float64 `json:"z"`
	Floor int     `json:"floor"`
}

// Payload represents robot payload
type Payload struct {
	Type       string   `json:"type"` // bin, pallet, cart
	ID         string   `json:"id"`
	Weight     float64  `json:"weight_kg"`
	ItemCount  int      `json:"item_count"`
	ProductIDs []string `json:"product_ids,omitempty"`
}

// AMRTask represents task for AMR
type AMRTask struct {
	ID           string     `json:"id"`
	RobotID      string     `json:"robot_id,omitempty"`
	Type         string     `json:"type"` // transport, pick, putaway, replenish
	Priority     int        `json:"priority"`
	Status       string     `json:"status"` // pending, assigned, in_progress, completed, failed
	FromLocation string     `json:"from_location"`
	ToLocation   string     `json:"to_location"`
	Items        []TaskItem `json:"items,omitempty"`
	EstimatedTime int       `json:"estimated_time_seconds"`
	ActualTime   int        `json:"actual_time_seconds,omitempty"`
	AssignedAt   *time.Time `json:"assigned_at,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// =====================================================
// VOICE PICKING
// =====================================================

// VoiceDevice represents voice picking device
type VoiceDevice struct {
	ID          string    `json:"id"`
	DeviceID    string    `json:"device_id"`
	AssignedTo  string    `json:"assigned_to,omitempty"`
	WorkerName  string    `json:"worker_name,omitempty"`
	Status      string    `json:"status"` // available, in_use, charging, offline
	BatteryLevel int      `json:"battery_level"`
	Language    string    `json:"language"`
	LastActive  time.Time `json:"last_active"`
	CreatedAt   time.Time `json:"created_at"`
}

// VoiceCommand represents voice command
type VoiceCommand struct {
	ID          string    `json:"id"`
	DeviceID    string    `json:"device_id"`
	TaskID      string    `json:"task_id,omitempty"`
	Command     string    `json:"command"` // pick, confirm, skip, quantity, location
	SpokenText  string    `json:"spoken_text"`
	RecognizedText string `json:"recognized_text"`
	Confidence  float64   `json:"confidence"`
	Response    string    `json:"response"`
	Success     bool      `json:"success"`
	CreatedAt   time.Time `json:"created_at"`
}

// VoicePickingSession represents voice picking session
type VoicePickingSession struct {
	ID          string    `json:"id"`
	DeviceID    string    `json:"device_id"`
	WorkerID    string    `json:"worker_id"`
	TaskID      string    `json:"task_id"`
	Status      string    `json:"status"` // active, paused, completed
	ItemsPicked int       `json:"items_picked"`
	Errors      int       `json:"errors"`
	StartedAt   time.Time `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`
}

// =====================================================
// GAMIFICATION
// =====================================================

// WorkerProfile represents gamification profile
type WorkerProfile struct {
	ID              string    `json:"id"`
	WorkerID        string    `json:"worker_id"`
	WorkerName      string    `json:"worker_name"`
	Level           int       `json:"level"`
	XP              int       `json:"xp"`
	XPToNextLevel   int       `json:"xp_to_next_level"`
	TotalPoints     int       `json:"total_points"`
	CurrentStreak   int       `json:"current_streak_days"`
	LongestStreak   int       `json:"longest_streak_days"`
	Badges          []Badge   `json:"badges"`
	Achievements    []Achievement `json:"achievements"`
	Rank            int       `json:"rank"`
	TotalRanked     int       `json:"total_ranked"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Badge represents earned badge
type Badge struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Rarity      string    `json:"rarity"` // common, rare, epic, legendary
	EarnedAt    time.Time `json:"earned_at"`
}

// Achievement represents achievement
type Achievement struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Category    string     `json:"category"` // speed, accuracy, volume, streak
	Target      int        `json:"target"`
	Progress    int        `json:"progress"`
	Completed   bool       `json:"completed"`
	XPReward    int        `json:"xp_reward"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// DailyChallenge represents daily challenge
type DailyChallenge struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Type        string    `json:"type"` // picks, accuracy, speed
	Target      int       `json:"target"`
	Reward      int       `json:"reward_points"`
	Date        time.Time `json:"date"`
	IsActive    bool      `json:"is_active"`
}

// Leaderboard represents leaderboard
type Leaderboard struct {
	Type       string             `json:"type"` // daily, weekly, monthly, all_time
	Period     string             `json:"period"`
	Entries    []LeaderboardEntry `json:"entries"`
	UpdatedAt  time.Time          `json:"updated_at"`
}

// LeaderboardEntry represents leaderboard entry
type LeaderboardEntry struct {
	Rank       int    `json:"rank"`
	WorkerID   string `json:"worker_id"`
	WorkerName string `json:"worker_name"`
	Score      int    `json:"score"`
	Level      int    `json:"level"`
	Change     int    `json:"change"` // Position change from previous
}

// =====================================================
// ADVANCED FEATURES SERVICE
// =====================================================

// AdvancedFeaturesRepository defines data access for advanced features
type AdvancedFeaturesRepository interface {
	// Cycle Counting
	CreateCycleCountPlan(ctx context.Context, plan *CycleCountPlan) error
	GetCycleCountPlan(ctx context.Context, id string) (*CycleCountPlan, error)
	ListCycleCountPlans(ctx context.Context, warehouseID string) ([]*CycleCountPlan, error)
	CreateCycleCount(ctx context.Context, count *CycleCount) error
	UpdateCycleCount(ctx context.Context, count *CycleCount) error
	GetCycleCount(ctx context.Context, id string) (*CycleCount, error)

	// Batch Tracking
	CreateBatch(ctx context.Context, batch *Batch) error
	UpdateBatch(ctx context.Context, batch *Batch) error
	GetBatch(ctx context.Context, id string) (*Batch, error)
	GetBatchByNumber(ctx context.Context, batchNumber string) (*Batch, error)
	ListBatches(ctx context.Context, productID string, status string) ([]*Batch, error)
	CreateBatchMovement(ctx context.Context, movement *BatchMovement) error

	// Temperature
	CreateTempZone(ctx context.Context, zone *TemperatureZoneConfig) error
	GetTempZone(ctx context.Context, id string) (*TemperatureZoneConfig, error)
	ListTempZones(ctx context.Context, warehouseID string) ([]*TemperatureZoneConfig, error)
	RecordTemperature(ctx context.Context, reading *TemperatureReading) error
	CreateTempAlert(ctx context.Context, alert *TemperatureAlert) error
	ListTempAlerts(ctx context.Context, warehouseID string, status string) ([]*TemperatureAlert, error)

	// RFID
	CreateRFIDTag(ctx context.Context, tag *RFIDTag) error
	GetRFIDTag(ctx context.Context, tagID string) (*RFIDTag, error)
	UpdateRFIDTag(ctx context.Context, tag *RFIDTag) error
	RecordRFIDScan(ctx context.Context, scan *RFIDScan) error

	// AMR
	CreateAMRRobot(ctx context.Context, robot *AMRRobot) error
	UpdateAMRRobot(ctx context.Context, robot *AMRRobot) error
	GetAMRRobot(ctx context.Context, id string) (*AMRRobot, error)
	ListAMRRobots(ctx context.Context, warehouseID string) ([]*AMRRobot, error)
	CreateAMRTask(ctx context.Context, task *AMRTask) error
	UpdateAMRTask(ctx context.Context, task *AMRTask) error
	GetNextAMRTask(ctx context.Context, warehouseID string) (*AMRTask, error)

	// Gamification
	GetWorkerProfile(ctx context.Context, workerID string) (*WorkerProfile, error)
	UpdateWorkerProfile(ctx context.Context, profile *WorkerProfile) error
	GetLeaderboard(ctx context.Context, leaderboardType string, limit int) (*Leaderboard, error)
	GetDailyChallenges(ctx context.Context, date time.Time) ([]*DailyChallenge, error)
	AwardBadge(ctx context.Context, workerID, badgeID string) error
	AddXP(ctx context.Context, workerID string, xp int, reason string) error
}

// AdvancedFeaturesService manages advanced warehouse features
type AdvancedFeaturesService struct {
	repo AdvancedFeaturesRepository
}

// NewAdvancedFeaturesService creates advanced features service
func NewAdvancedFeaturesService(repo AdvancedFeaturesRepository) *AdvancedFeaturesService {
	return &AdvancedFeaturesService{repo: repo}
}

// CreateCycleCountPlan creates cycle count plan
func (s *AdvancedFeaturesService) CreateCycleCountPlan(ctx context.Context, plan *CycleCountPlan) error {
	plan.ID = generateID()
	plan.CreatedAt = time.Now()
	plan.UpdatedAt = time.Now()
	return s.repo.CreateCycleCountPlan(ctx, plan)
}

// GenerateCycleCount generates cycle count from plan
func (s *AdvancedFeaturesService) GenerateCycleCount(ctx context.Context, planID, createdBy string) (*CycleCount, error) {
	plan, err := s.repo.GetCycleCountPlan(ctx, planID)
	if err != nil {
		return nil, err
	}

	// Generate locations to count based on method
	locations := s.selectLocationsForCount(plan)

	count := &CycleCount{
		ID:             generateID(),
		PlanID:         planID,
		WarehouseID:    plan.WarehouseID,
		Status:         "pending",
		Locations:      locations,
		TotalLocations: len(locations),
		CreatedBy:      createdBy,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.repo.CreateCycleCount(ctx, count); err != nil {
		return nil, err
	}

	// Update plan last run
	now := time.Now()
	plan.LastRun = &now
	s.repo.CreateCycleCountPlan(ctx, plan)

	return count, nil
}

// selectLocationsForCount selects locations based on count method
func (s *AdvancedFeaturesService) selectLocationsForCount(plan *CycleCountPlan) []CountLocation {
	// This would typically query actual locations
	// Simplified implementation
	var locations []CountLocation

	switch plan.Method {
	case "random":
		// Random selection
		for i := 0; i < plan.LocationsPerCount; i++ {
			locations = append(locations, CountLocation{
				LocationID:   generateID(),
				LocationCode: "LOC-" + string(rune('A'+rand.Intn(26))) + "-" + string(rune('0'+rand.Intn(10))),
				Status:       "pending",
			})
		}
	case "abc":
		// ABC analysis based selection
		// A items more frequently
	case "zone":
		// Zone by zone
	}

	return locations
}

// RecordCount records count for location
func (s *AdvancedFeaturesService) RecordCount(ctx context.Context, countID, locationID string, countedQty int, countedBy, notes string) error {
	count, err := s.repo.GetCycleCount(ctx, countID)
	if err != nil {
		return err
	}

	now := time.Now()
	for i := range count.Locations {
		if count.Locations[i].LocationID == locationID {
			count.Locations[i].CountedQty = &countedQty
			count.Locations[i].Variance = countedQty - count.Locations[i].ExpectedQty
			count.Locations[i].Status = "counted"
			count.Locations[i].CountedAt = &now
			count.Locations[i].CountedBy = countedBy
			count.Locations[i].Notes = notes
			break
		}
	}

	count.CountedLocations++
	if count.Locations[0].Variance != 0 {
		count.Variances++
	}
	count.UpdatedAt = now

	return s.repo.UpdateCycleCount(ctx, count)
}

// CreateBatch creates new batch
func (s *AdvancedFeaturesService) CreateBatch(ctx context.Context, batch *Batch) error {
	batch.ID = generateID()
	batch.Status = "active"
	batch.RemainingQty = batch.Quantity
	batch.CreatedAt = time.Now()
	batch.UpdatedAt = time.Now()
	return s.repo.CreateBatch(ctx, batch)
}

// RecordBatchMovement records batch movement
func (s *AdvancedFeaturesService) RecordBatchMovement(ctx context.Context, batchID, movementType, fromWarehouse, toWarehouse string, quantity int, documentID, notes, userID string) error {
	batch, err := s.repo.GetBatch(ctx, batchID)
	if err != nil {
		return err
	}

	movement := &BatchMovement{
		ID:            generateID(),
		BatchID:       batchID,
		BatchNumber:   batch.BatchNumber,
		ProductID:     batch.ProductID,
		Type:          movementType,
		FromWarehouse: fromWarehouse,
		ToWarehouse:   toWarehouse,
		Quantity:      quantity,
		DocumentID:    documentID,
		Notes:         notes,
		UserID:        userID,
		CreatedAt:     time.Now(),
	}

	// Update remaining quantity
	if movementType == "shipment" {
		batch.RemainingQty -= quantity
		if batch.RemainingQty <= 0 {
			batch.Status = "depleted"
		}
	} else if movementType == "return" {
		batch.RemainingQty += quantity
		if batch.Status == "depleted" {
			batch.Status = "active"
		}
	}

	batch.UpdatedAt = time.Now()

	if err := s.repo.UpdateBatch(ctx, batch); err != nil {
		return err
	}

	return s.repo.CreateBatchMovement(ctx, movement)
}

// RecordTemperature records temperature reading
func (s *AdvancedFeaturesService) RecordTemperature(ctx context.Context, sensorID, zoneID, warehouseID string, temperature float64, humidity *float64) error {
	// Get zone config to check thresholds
	zone, err := s.repo.GetTempZone(ctx, zoneID)
	if err != nil {
		return err
	}

	reading := &TemperatureReading{
		ID:          generateID(),
		SensorID:    sensorID,
		ZoneID:      zoneID,
		WarehouseID: warehouseID,
		Temperature: temperature,
		Humidity:    humidity,
		ReadAt:      time.Now(),
	}

	// Check for alert
	if temperature < zone.MinTemp || temperature > zone.MaxTemp {
		reading.IsAlert = true
		if temperature < zone.MinTemp {
			reading.AlertType = "low"
		} else {
			reading.AlertType = "high"
		}

		// Create alert
		if zone.AlertEnabled {
			alert := &TemperatureAlert{
				ID:            generateID(),
				ZoneID:        zoneID,
				ZoneName:      zone.ZoneName,
				WarehouseID:   warehouseID,
				AlertType:     reading.AlertType,
				CurrentTemp:   temperature,
				ThresholdTemp: zone.MinTemp,
				Status:        "active",
				CreatedAt:     time.Now(),
			}
			if temperature > zone.MaxTemp {
				alert.ThresholdTemp = zone.MaxTemp
			}
			s.repo.CreateTempAlert(ctx, alert)
		}
	}

	return s.repo.RecordTemperature(ctx, reading)
}

// ProcessRFIDScan processes RFID scan
func (s *AdvancedFeaturesService) ProcessRFIDScan(ctx context.Context, readerID string, tagIDs []string, location, eventType, userID, documentID string) (*RFIDScan, error) {
	scan := &RFIDScan{
		ID:         generateID(),
		ReaderID:   readerID,
		TagIDs:     tagIDs,
		Location:   location,
		EventType:  eventType,
		UserID:     userID,
		DocumentID: documentID,
		ScannedAt:  time.Now(),
	}

	// Update tag locations
	for _, tagID := range tagIDs {
		tag, err := s.repo.GetRFIDTag(ctx, tagID)
		if err == nil {
			now := time.Now()
			tag.LastSeen = &now
			tag.LastLocation = location
			s.repo.UpdateRFIDTag(ctx, tag)
		}
	}

	if err := s.repo.RecordRFIDScan(ctx, scan); err != nil {
		return nil, err
	}

	return scan, nil
}

// AssignAMRTask assigns task to robot
func (s *AdvancedFeaturesService) AssignAMRTask(ctx context.Context, taskID, robotID string) error {
	task, err := s.repo.GetNextAMRTask(ctx, "")
	if err != nil {
		return err
	}

	robot, err := s.repo.GetAMRRobot(ctx, robotID)
	if err != nil {
		return err
	}

	if robot.Status != "idle" {
		return errors.New("robot is not idle")
	}

	now := time.Now()
	task.RobotID = robotID
	task.Status = "assigned"
	task.AssignedAt = &now

	robot.Status = "working"
	robot.CurrentTask = taskID
	robot.LastActive = now

	if err := s.repo.UpdateAMRTask(ctx, task); err != nil {
		return err
	}

	return s.repo.UpdateAMRRobot(ctx, robot)
}

// AwardPoints awards gamification points
func (s *AdvancedFeaturesService) AwardPoints(ctx context.Context, workerID string, points int, reason string) error {
	profile, err := s.repo.GetWorkerProfile(ctx, workerID)
	if err != nil {
		// Create new profile
		profile = &WorkerProfile{
			ID:            generateID(),
			WorkerID:      workerID,
			Level:         1,
			XP:            0,
			XPToNextLevel: 100,
			TotalPoints:   0,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
	}

	profile.TotalPoints += points

	// Add XP
	xpGained := points / 10
	if err := s.repo.AddXP(ctx, workerID, xpGained, reason); err != nil {
		return err
	}

	profile.XP += xpGained

	// Check level up
	for profile.XP >= profile.XPToNextLevel {
		profile.XP -= profile.XPToNextLevel
		profile.Level++
		profile.XPToNextLevel = profile.Level * 100 // XP needed increases per level
	}

	profile.UpdatedAt = time.Now()

	return s.repo.UpdateWorkerProfile(ctx, profile)
}

// GetLeaderboard returns leaderboard
func (s *AdvancedFeaturesService) GetLeaderboard(ctx context.Context, leaderboardType string, limit int) (*Leaderboard, error) {
	leaderboard, err := s.repo.GetLeaderboard(ctx, leaderboardType, limit)
	if err != nil {
		return nil, err
	}

	// Sort by score
	sort.Slice(leaderboard.Entries, func(i, j int) bool {
		return leaderboard.Entries[i].Score > leaderboard.Entries[j].Score
	})

	// Assign ranks
	for i := range leaderboard.Entries {
		leaderboard.Entries[i].Rank = i + 1
	}

	return leaderboard, nil
}

// CheckAchievements checks and awards achievements
func (s *AdvancedFeaturesService) CheckAchievements(ctx context.Context, workerID string) ([]Achievement, error) {
	profile, err := s.repo.GetWorkerProfile(ctx, workerID)
	if err != nil {
		return nil, err
	}

	var newAchievements []Achievement

	// Check various achievement conditions
	// This would be more complex in production
	for i, ach := range profile.Achievements {
		if !ach.Completed && ach.Progress >= ach.Target {
			now := time.Now()
			profile.Achievements[i].Completed = true
			profile.Achievements[i].CompletedAt = &now

			// Award XP
			s.repo.AddXP(ctx, workerID, ach.XPReward, "Achievement: "+ach.Name)

			newAchievements = append(newAchievements, profile.Achievements[i])
		}
	}

	if len(newAchievements) > 0 {
		profile.UpdatedAt = time.Now()
		s.repo.UpdateWorkerProfile(ctx, profile)
	}

	return newAchievements, nil
}
