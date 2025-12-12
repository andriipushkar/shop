package warehouse

import (
	"context"
	"errors"
	"time"
)

// Map errors
var (
	ErrZoneNotFound     = errors.New("zone not found")
	ErrLocationNotFound = errors.New("location not found")
	ErrLocationOccupied = errors.New("location is occupied")
	ErrInvalidLocation  = errors.New("invalid location")
)

// ZoneType represents warehouse zone type
type ZoneType string

const (
	ZoneTypeHot       ZoneType = "hot"       // Fast-moving items, near shipping
	ZoneTypeWarm      ZoneType = "warm"      // Medium velocity items
	ZoneTypeCold      ZoneType = "cold"      // Slow-moving items
	ZoneTypeFrozen    ZoneType = "frozen"    // Rarely accessed items
	ZoneTypeHazmat    ZoneType = "hazmat"    // Hazardous materials
	ZoneTypeValuable  ZoneType = "valuable"  // High-value items, secured
	ZoneTypeBulk      ZoneType = "bulk"      // Large items, pallets
	ZoneTypePicking   ZoneType = "picking"   // Forward pick locations
	ZoneTypeReserve   ZoneType = "reserve"   // Reserve/overflow stock
	ZoneTypeReceiving ZoneType = "receiving" // Receiving area
	ZoneTypeShipping  ZoneType = "shipping"  // Shipping area
	ZoneTypeStaging   ZoneType = "staging"   // Staging area
	ZoneTypeReturns   ZoneType = "returns"   // Returns processing
	ZoneTypeQC        ZoneType = "qc"        // Quality control
)

// TemperatureZone represents temperature control zone
type TemperatureZone string

const (
	TempAmbient     TemperatureZone = "ambient"      // Room temperature
	TempCooled      TemperatureZone = "cooled"       // 2-8°C
	TempRefrigerated TemperatureZone = "refrigerated" // 0-4°C
	TempFrozen      TemperatureZone = "frozen"       // -18°C
	TempDeepFrozen  TemperatureZone = "deep_frozen"  // -25°C
)

// Zone represents warehouse zone
type Zone struct {
	ID              string          `json:"id"`
	WarehouseID     string          `json:"warehouse_id"`
	Code            string          `json:"code"`
	Name            string          `json:"name"`
	Type            ZoneType        `json:"type"`
	Temperature     TemperatureZone `json:"temperature"`
	Floor           int             `json:"floor"`
	PositionX       float64         `json:"position_x"` // For 2D/3D map
	PositionY       float64         `json:"position_y"`
	Width           float64         `json:"width"`
	Depth           float64         `json:"depth"`
	Height          float64         `json:"height"`
	Color           string          `json:"color,omitempty"` // For visualization
	TotalLocations  int             `json:"total_locations"`
	UsedLocations   int             `json:"used_locations"`
	PickPriority    int             `json:"pick_priority"` // Lower = pick first
	PutawayPriority int             `json:"putaway_priority"`
	IsActive        bool            `json:"is_active"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// Aisle represents warehouse aisle
type Aisle struct {
	ID          string  `json:"id"`
	ZoneID      string  `json:"zone_id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	PositionX   float64 `json:"position_x"`
	PositionY   float64 `json:"position_y"`
	Width       float64 `json:"width"`
	Length      float64 `json:"length"`
	Direction   string  `json:"direction"` // horizontal, vertical
	IsOneWay    bool    `json:"is_one_way"`
	Racks       []Rack  `json:"racks,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Rack represents storage rack
type Rack struct {
	ID          string    `json:"id"`
	AisleID     string    `json:"aisle_id"`
	Code        string    `json:"code"`
	Side        string    `json:"side"` // left, right
	Levels      int       `json:"levels"`
	BaysPerLevel int      `json:"bays_per_level"`
	BayWidth    float64   `json:"bay_width"`
	BayDepth    float64   `json:"bay_depth"`
	LevelHeight float64   `json:"level_height"`
	MaxWeight   float64   `json:"max_weight_per_bay"` // kg
	Locations   []Location `json:"locations,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Location represents storage location (bin)
type Location struct {
	ID           string    `json:"id"`
	WarehouseID  string    `json:"warehouse_id"`
	ZoneID       string    `json:"zone_id"`
	AisleID      string    `json:"aisle_id,omitempty"`
	RackID       string    `json:"rack_id,omitempty"`
	Barcode      string    `json:"barcode"`
	Code         string    `json:"code"` // e.g., A-01-02-03 (Zone-Aisle-Rack-Level-Bay)
	Level        int       `json:"level"`
	Bay          int       `json:"bay"`
	Type         string    `json:"type"` // shelf, floor, pallet, bin
	Width        float64   `json:"width"`
	Depth        float64   `json:"depth"`
	Height       float64   `json:"height"`
	MaxWeight    float64   `json:"max_weight"`
	PositionX    float64   `json:"position_x"`
	PositionY    float64   `json:"position_y"`
	PositionZ    float64   `json:"position_z"`
	Status       string    `json:"status"` // empty, partial, full, blocked
	AssignedSKU  string    `json:"assigned_sku,omitempty"` // Dedicated to specific SKU
	CurrentSKU   string    `json:"current_sku,omitempty"`
	CurrentQty   int       `json:"current_qty"`
	IsPickable   bool      `json:"is_pickable"`
	IsPutawayable bool     `json:"is_putawayable"`
	LastAccessed *time.Time `json:"last_accessed,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// LocationContent represents items in location
type LocationContent struct {
	LocationID  string    `json:"location_id"`
	ProductID   string    `json:"product_id"`
	SKU         string    `json:"sku"`
	Quantity    int       `json:"quantity"`
	BatchNumber string    `json:"batch_number,omitempty"`
	ExpiryDate  *time.Time `json:"expiry_date,omitempty"`
	PalletID    string    `json:"pallet_id,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WarehouseLayout represents warehouse 3D layout
type WarehouseLayout struct {
	WarehouseID string      `json:"warehouse_id"`
	Name        string      `json:"name"`
	Width       float64     `json:"width"`  // meters
	Depth       float64     `json:"depth"`
	Height      float64     `json:"height"`
	Floors      int         `json:"floors"`
	Zones       []Zone      `json:"zones"`
	Aisles      []Aisle     `json:"aisles"`
	Paths       []PathPoint `json:"paths,omitempty"` // Navigation paths
	Obstacles   []Obstacle  `json:"obstacles,omitempty"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// PathPoint represents navigation path point
type PathPoint struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Z         float64 `json:"z"`
	ConnectsTo []string `json:"connects_to"` // Other point IDs
	Type      string  `json:"type"` // junction, waypoint, dock, elevator
}

// Obstacle represents obstacle in warehouse
type Obstacle struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"` // pillar, wall, equipment
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Width    float64 `json:"width"`
	Depth    float64 `json:"depth"`
	Height   float64 `json:"height"`
}

// Heatmap represents location usage heatmap
type Heatmap struct {
	WarehouseID string         `json:"warehouse_id"`
	Type        string         `json:"type"` // picks, putaways, movement
	Period      string         `json:"period"` // day, week, month
	Data        []HeatmapCell  `json:"data"`
	MaxValue    int            `json:"max_value"`
	GeneratedAt time.Time      `json:"generated_at"`
}

// HeatmapCell represents heatmap data point
type HeatmapCell struct {
	LocationID string  `json:"location_id"`
	Code       string  `json:"code"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Z          float64 `json:"z"`
	Value      int     `json:"value"`
	Intensity  float64 `json:"intensity"` // 0-1 normalized
}

// MapRepository defines warehouse map data access
type MapRepository interface {
	// Zones
	CreateZone(ctx context.Context, zone *Zone) error
	UpdateZone(ctx context.Context, zone *Zone) error
	GetZone(ctx context.Context, id string) (*Zone, error)
	GetZoneByCode(ctx context.Context, warehouseID, code string) (*Zone, error)
	ListZones(ctx context.Context, warehouseID string) ([]*Zone, error)

	// Aisles
	CreateAisle(ctx context.Context, aisle *Aisle) error
	GetAisle(ctx context.Context, id string) (*Aisle, error)
	ListAisles(ctx context.Context, zoneID string) ([]*Aisle, error)

	// Racks
	CreateRack(ctx context.Context, rack *Rack) error
	GetRack(ctx context.Context, id string) (*Rack, error)
	ListRacks(ctx context.Context, aisleID string) ([]*Rack, error)

	// Locations
	CreateLocation(ctx context.Context, loc *Location) error
	UpdateLocation(ctx context.Context, loc *Location) error
	GetLocation(ctx context.Context, id string) (*Location, error)
	GetLocationByCode(ctx context.Context, warehouseID, code string) (*Location, error)
	GetLocationByBarcode(ctx context.Context, barcode string) (*Location, error)
	ListLocations(ctx context.Context, zoneID string, status string, limit, offset int) ([]*Location, error)
	GetEmptyLocations(ctx context.Context, warehouseID string, zoneType ZoneType, limit int) ([]*Location, error)

	// Content
	GetLocationContent(ctx context.Context, locationID string) ([]*LocationContent, error)
	UpdateLocationContent(ctx context.Context, content *LocationContent) error
	ClearLocationContent(ctx context.Context, locationID string) error

	// Layout
	GetLayout(ctx context.Context, warehouseID string) (*WarehouseLayout, error)
	UpdateLayout(ctx context.Context, layout *WarehouseLayout) error

	// Heatmap
	GenerateHeatmap(ctx context.Context, warehouseID, heatmapType, period string) (*Heatmap, error)
}

// MapService manages warehouse map and locations
type MapService struct {
	repo MapRepository
}

// NewMapService creates map service
func NewMapService(repo MapRepository) *MapService {
	return &MapService{repo: repo}
}

// CreateZone creates new zone
func (s *MapService) CreateZone(ctx context.Context, zone *Zone) error {
	zone.ID = generateID()
	zone.CreatedAt = time.Now()
	zone.UpdatedAt = time.Now()
	return s.repo.CreateZone(ctx, zone)
}

// UpdateZone updates zone
func (s *MapService) UpdateZone(ctx context.Context, zone *Zone) error {
	zone.UpdatedAt = time.Now()
	return s.repo.UpdateZone(ctx, zone)
}

// GetZone returns zone by ID
func (s *MapService) GetZone(ctx context.Context, id string) (*Zone, error) {
	return s.repo.GetZone(ctx, id)
}

// ListZones returns list of zones
func (s *MapService) ListZones(ctx context.Context, warehouseID string) ([]*Zone, error) {
	return s.repo.ListZones(ctx, warehouseID)
}

// CreateLocation creates new location
func (s *MapService) CreateLocation(ctx context.Context, loc *Location) error {
	loc.ID = generateID()
	loc.Status = "empty"
	loc.CreatedAt = time.Now()
	loc.UpdatedAt = time.Now()

	// Generate barcode if not provided
	if loc.Barcode == "" {
		loc.Barcode = "LOC" + loc.ID[:8]
	}

	return s.repo.CreateLocation(ctx, loc)
}

// UpdateLocation updates location
func (s *MapService) UpdateLocation(ctx context.Context, loc *Location) error {
	loc.UpdatedAt = time.Now()
	return s.repo.UpdateLocation(ctx, loc)
}

// GetLocation returns location by ID
func (s *MapService) GetLocation(ctx context.Context, id string) (*Location, error) {
	return s.repo.GetLocation(ctx, id)
}

// GetLocationByCode returns location by code
func (s *MapService) GetLocationByCode(ctx context.Context, warehouseID, code string) (*Location, error) {
	return s.repo.GetLocationByCode(ctx, warehouseID, code)
}

// GetLocationByBarcode returns location by barcode
func (s *MapService) GetLocationByBarcode(ctx context.Context, barcode string) (*Location, error) {
	return s.repo.GetLocationByBarcode(ctx, barcode)
}

// ListLocations returns list of locations
func (s *MapService) ListLocations(ctx context.Context, zoneID string, status string, limit, offset int) ([]*Location, error) {
	return s.repo.ListLocations(ctx, zoneID, status, limit, offset)
}

// AssignItemToLocation assigns item to location
func (s *MapService) AssignItemToLocation(ctx context.Context, locationID, productID, sku string, quantity int, batchNumber string, expiryDate *time.Time) error {
	loc, err := s.repo.GetLocation(ctx, locationID)
	if err != nil {
		return ErrLocationNotFound
	}

	// Check if location is suitable
	if !loc.IsPutawayable {
		return ErrInvalidLocation
	}

	if loc.Status == "full" || loc.Status == "blocked" {
		return ErrLocationOccupied
	}

	// Check if dedicated to different SKU
	if loc.AssignedSKU != "" && loc.AssignedSKU != sku {
		return errors.New("location is dedicated to different SKU")
	}

	// Update content
	content := &LocationContent{
		LocationID:  locationID,
		ProductID:   productID,
		SKU:         sku,
		Quantity:    quantity,
		BatchNumber: batchNumber,
		ExpiryDate:  expiryDate,
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.UpdateLocationContent(ctx, content); err != nil {
		return err
	}

	// Update location status
	now := time.Now()
	loc.CurrentSKU = sku
	loc.CurrentQty = quantity
	loc.LastAccessed = &now
	loc.UpdatedAt = now

	if quantity > 0 {
		loc.Status = "partial"
	} else {
		loc.Status = "empty"
	}

	return s.repo.UpdateLocation(ctx, loc)
}

// RemoveItemFromLocation removes item from location
func (s *MapService) RemoveItemFromLocation(ctx context.Context, locationID string, quantity int) error {
	loc, err := s.repo.GetLocation(ctx, locationID)
	if err != nil {
		return ErrLocationNotFound
	}

	if loc.CurrentQty < quantity {
		return errors.New("insufficient quantity at location")
	}

	loc.CurrentQty -= quantity
	now := time.Now()
	loc.LastAccessed = &now
	loc.UpdatedAt = now

	if loc.CurrentQty == 0 {
		loc.Status = "empty"
		loc.CurrentSKU = ""
		s.repo.ClearLocationContent(ctx, locationID)
	} else {
		loc.Status = "partial"
	}

	return s.repo.UpdateLocation(ctx, loc)
}

// SuggestPutawayLocation suggests best location for putaway
func (s *MapService) SuggestPutawayLocation(ctx context.Context, warehouseID, sku string, quantity int, zoneType ZoneType) (*Location, error) {
	// First, try to find location with same SKU (consolidate)
	locations, err := s.repo.ListLocations(ctx, "", "partial", 100, 0)
	if err == nil {
		for _, loc := range locations {
			if loc.CurrentSKU == sku && loc.IsPutawayable {
				// Check if there's room
				// This would need capacity calculation
				return loc, nil
			}
		}
	}

	// Find empty location in appropriate zone
	emptyLocs, err := s.repo.GetEmptyLocations(ctx, warehouseID, zoneType, 10)
	if err != nil {
		return nil, err
	}

	if len(emptyLocs) == 0 {
		// Try any zone
		emptyLocs, err = s.repo.GetEmptyLocations(ctx, warehouseID, "", 10)
		if err != nil || len(emptyLocs) == 0 {
			return nil, errors.New("no available locations")
		}
	}

	// Return first available
	return emptyLocs[0], nil
}

// GetWarehouseLayout returns warehouse layout for visualization
func (s *MapService) GetWarehouseLayout(ctx context.Context, warehouseID string) (*WarehouseLayout, error) {
	return s.repo.GetLayout(ctx, warehouseID)
}

// GenerateHeatmap generates usage heatmap
func (s *MapService) GenerateHeatmap(ctx context.Context, warehouseID, heatmapType, period string) (*Heatmap, error) {
	return s.repo.GenerateHeatmap(ctx, warehouseID, heatmapType, period)
}

// CalculateOptimalPath calculates optimal picking path
func (s *MapService) CalculateOptimalPath(ctx context.Context, warehouseID string, locationIDs []string) ([]string, float64, error) {
	// Get all locations
	locations := make([]*Location, 0, len(locationIDs))
	for _, id := range locationIDs {
		loc, err := s.repo.GetLocation(ctx, id)
		if err != nil {
			continue
		}
		locations = append(locations, loc)
	}

	if len(locations) < 2 {
		return locationIDs, 0, nil
	}

	// Simple nearest neighbor algorithm
	// In production, would use more sophisticated algorithms
	optimizedPath := make([]string, 0, len(locations))
	visited := make(map[string]bool)
	var totalDistance float64

	// Start from first location
	current := locations[0]
	optimizedPath = append(optimizedPath, current.ID)
	visited[current.ID] = true

	for len(optimizedPath) < len(locations) {
		var nearest *Location
		nearestDist := float64(-1)

		for _, loc := range locations {
			if visited[loc.ID] {
				continue
			}

			dist := calculateDistance(current, loc)
			if nearestDist < 0 || dist < nearestDist {
				nearest = loc
				nearestDist = dist
			}
		}

		if nearest != nil {
			optimizedPath = append(optimizedPath, nearest.ID)
			visited[nearest.ID] = true
			totalDistance += nearestDist
			current = nearest
		}
	}

	return optimizedPath, totalDistance, nil
}

// calculateDistance calculates Euclidean distance between locations
func calculateDistance(a, b *Location) float64 {
	dx := a.PositionX - b.PositionX
	dy := a.PositionY - b.PositionY
	dz := a.PositionZ - b.PositionZ
	return dx*dx + dy*dy + dz*dz // Squared distance for comparison
}

// GenerateLocationCodes generates location codes for a rack
func (s *MapService) GenerateLocationCodes(zoneCode, aisleCode, rackCode string, levels, baysPerLevel int) []string {
	var codes []string
	for level := 1; level <= levels; level++ {
		for bay := 1; bay <= baysPerLevel; bay++ {
			code := zoneCode + "-" + aisleCode + "-" + rackCode + "-" +
				string(rune('A'+level-1)) + "-" + padNumber(bay, 2)
			codes = append(codes, code)
		}
	}
	return codes
}

func padNumber(n, width int) string {
	s := ""
	for i := 0; i < width; i++ {
		s += "0"
	}
	ns := s + string(rune('0'+n%10))
	if n >= 10 {
		ns = s[:len(s)-1] + string(rune('0'+n/10)) + string(rune('0'+n%10))
	}
	return ns[len(ns)-width:]
}

// GetZoneUtilization returns zone utilization stats
func (s *MapService) GetZoneUtilization(ctx context.Context, warehouseID string) ([]ZoneUtilization, error) {
	zones, err := s.repo.ListZones(ctx, warehouseID)
	if err != nil {
		return nil, err
	}

	var result []ZoneUtilization
	for _, zone := range zones {
		utilization := 0.0
		if zone.TotalLocations > 0 {
			utilization = float64(zone.UsedLocations) / float64(zone.TotalLocations) * 100
		}

		result = append(result, ZoneUtilization{
			ZoneID:         zone.ID,
			ZoneCode:       zone.Code,
			ZoneName:       zone.Name,
			ZoneType:       zone.Type,
			TotalLocations: zone.TotalLocations,
			UsedLocations:  zone.UsedLocations,
			Utilization:    utilization,
		})
	}

	return result, nil
}

// ZoneUtilization represents zone utilization data
type ZoneUtilization struct {
	ZoneID         string   `json:"zone_id"`
	ZoneCode       string   `json:"zone_code"`
	ZoneName       string   `json:"zone_name"`
	ZoneType       ZoneType `json:"zone_type"`
	TotalLocations int      `json:"total_locations"`
	UsedLocations  int      `json:"used_locations"`
	Utilization    float64  `json:"utilization_percent"`
}
