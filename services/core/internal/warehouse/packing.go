package warehouse

import (
	"context"
	"errors"
	"math"
	"sort"
	"time"
)

// Packing-related errors
var (
	ErrPackageNotFound   = errors.New("package not found")
	ErrNoSuitablePackage = errors.New("no suitable package found")
	ErrItemsTooLarge     = errors.New("items too large for available packages")
	ErrPackingFailed     = errors.New("packing failed")
)

// PackageType represents type of packaging
type PackageType string

const (
	PackageBox      PackageType = "box"
	PackageEnvelope PackageType = "envelope"
	PackageTube     PackageType = "tube"
	PackagePallet   PackageType = "pallet"
	PackageCustom   PackageType = "custom"
)

// PackageMaterial represents packaging material
type PackageMaterial string

const (
	MaterialCardboard PackageMaterial = "cardboard"
	MaterialPlastic   PackageMaterial = "plastic"
	MaterialPadded    PackageMaterial = "padded"
	MaterialWood      PackageMaterial = "wood"
	MaterialMetal     PackageMaterial = "metal"
)

// Package represents a package template
type Package struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	Type         PackageType     `json:"type"`
	Material     PackageMaterial `json:"material"`
	Length       float64         `json:"length"`  // cm
	Width        float64         `json:"width"`   // cm
	Height       float64         `json:"height"`  // cm
	MaxWeight    float64         `json:"max_weight"` // kg
	TareWeight   float64         `json:"tare_weight"` // package weight kg
	Cost         float64         `json:"cost"`    // cost per package
	InStock      int             `json:"in_stock"`
	ReorderPoint int             `json:"reorder_point"`
	IsActive     bool            `json:"is_active"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// Volume returns package volume in cm³
func (p *Package) Volume() float64 {
	return p.Length * p.Width * p.Height
}

// PackingItem represents an item to pack
type PackingItem struct {
	ProductID   string  `json:"product_id"`
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Quantity    int     `json:"quantity"`
	Length      float64 `json:"length"`  // cm
	Width       float64 `json:"width"`   // cm
	Height      float64 `json:"height"`  // cm
	Weight      float64 `json:"weight"`  // kg per unit
	IsFragile   bool    `json:"is_fragile"`
	IsHazardous bool    `json:"is_hazardous"`
	KeepUpright bool    `json:"keep_upright"`
}

// TotalVolume returns total volume for all units
func (i *PackingItem) TotalVolume() float64 {
	return i.Length * i.Width * i.Height * float64(i.Quantity)
}

// TotalWeight returns total weight for all units
func (i *PackingItem) TotalWeight() float64 {
	return i.Weight * float64(i.Quantity)
}

// PackingResult represents packing calculation result
type PackingResult struct {
	ID           string          `json:"id"`
	OrderID      string          `json:"order_id"`
	Packages     []PackedPackage `json:"packages"`
	TotalWeight  float64         `json:"total_weight"`
	TotalVolume  float64         `json:"total_volume"`
	TotalCost    float64         `json:"total_cost"`
	PackingTime  time.Duration   `json:"packing_time"`
	CreatedAt    time.Time       `json:"created_at"`
}

// PackedPackage represents a packed package
type PackedPackage struct {
	PackageID    string        `json:"package_id"`
	PackageName  string        `json:"package_name"`
	Items        []PackedItem  `json:"items"`
	TotalWeight  float64       `json:"total_weight"`
	UsedVolume   float64       `json:"used_volume"`
	FillRate     float64       `json:"fill_rate"` // percentage
	Dimensions   Dimensions    `json:"dimensions"`
	ShippingCost float64       `json:"shipping_cost,omitempty"`
	TrackingNum  string        `json:"tracking_number,omitempty"`
	LabelURL     string        `json:"label_url,omitempty"`
}

// PackedItem represents item placement in package
type PackedItem struct {
	ProductID string `json:"product_id"`
	SKU       string `json:"sku"`
	Quantity  int             `json:"quantity"`
	Position  PackingPosition `json:"position"`
}

// PackingPosition represents item position in package
type PackingPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Dimensions represents package dimensions
type Dimensions struct {
	Length float64 `json:"length"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// PackingSlip represents packing slip document
type PackingSlip struct {
	ID          string        `json:"id"`
	OrderID     string        `json:"order_id"`
	PackageNum  int           `json:"package_num"`
	TotalPkgs   int           `json:"total_packages"`
	Items       []PackingSlipItem `json:"items"`
	ShipFrom    AddressInfo   `json:"ship_from"`
	ShipTo      AddressInfo   `json:"ship_to"`
	Weight      float64       `json:"weight"`
	Dimensions  string        `json:"dimensions"`
	Notes       string        `json:"notes,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
}

// PackingSlipItem represents item on packing slip
type PackingSlipItem struct {
	SKU      string `json:"sku"`
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
	Location string `json:"location,omitempty"`
}

// AddressInfo represents address on packing slip
type AddressInfo struct {
	Name       string `json:"name"`
	Company    string `json:"company,omitempty"`
	Address1   string `json:"address1"`
	Address2   string `json:"address2,omitempty"`
	City       string `json:"city"`
	State      string `json:"state,omitempty"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
	Phone      string `json:"phone,omitempty"`
}

// PackingStation represents packing workstation
type PackingStation struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Location     string   `json:"location"`
	AssignedUser string   `json:"assigned_user,omitempty"`
	Status       string   `json:"status"` // available, busy, offline
	Equipment    []string `json:"equipment"` // scale, printer, scanner
	CreatedAt    time.Time `json:"created_at"`
}

// PackingTask represents packing task
type PackingTask struct {
	ID             string    `json:"id"`
	OrderID        string    `json:"order_id"`
	StationID      string    `json:"station_id,omitempty"`
	AssignedTo     string    `json:"assigned_to,omitempty"`
	Status         string    `json:"status"` // pending, in_progress, completed, on_hold
	Priority       int       `json:"priority"`
	Items          []PackingItem `json:"items"`
	PackingResult  *PackingResult `json:"packing_result,omitempty"`
	StartedAt      *time.Time `json:"started_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	Notes          string    `json:"notes,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// PackingRepository defines packing data access
type PackingRepository interface {
	// Packages
	CreatePackage(ctx context.Context, pkg *Package) error
	UpdatePackage(ctx context.Context, pkg *Package) error
	GetPackage(ctx context.Context, id string) (*Package, error)
	ListPackages(ctx context.Context, activeOnly bool) ([]*Package, error)
	GetPackagesByType(ctx context.Context, pkgType PackageType) ([]*Package, error)

	// Packing Results
	CreatePackingResult(ctx context.Context, result *PackingResult) error
	GetPackingResult(ctx context.Context, id string) (*PackingResult, error)
	GetPackingResultByOrder(ctx context.Context, orderID string) (*PackingResult, error)

	// Packing Slips
	CreatePackingSlip(ctx context.Context, slip *PackingSlip) error
	GetPackingSlip(ctx context.Context, id string) (*PackingSlip, error)
	GetPackingSlipsByOrder(ctx context.Context, orderID string) ([]*PackingSlip, error)

	// Stations
	CreateStation(ctx context.Context, station *PackingStation) error
	UpdateStation(ctx context.Context, station *PackingStation) error
	GetStation(ctx context.Context, id string) (*PackingStation, error)
	ListStations(ctx context.Context) ([]*PackingStation, error)
	GetAvailableStation(ctx context.Context) (*PackingStation, error)

	// Tasks
	CreatePackingTask(ctx context.Context, task *PackingTask) error
	UpdatePackingTask(ctx context.Context, task *PackingTask) error
	GetPackingTask(ctx context.Context, id string) (*PackingTask, error)
	GetPackingTaskByOrder(ctx context.Context, orderID string) (*PackingTask, error)
	ListPackingTasks(ctx context.Context, status string, limit int) ([]*PackingTask, error)
	GetNextPackingTask(ctx context.Context, stationID string) (*PackingTask, error)
}

// PackingService manages packing operations
type PackingService struct {
	repo PackingRepository
}

// NewPackingService creates packing service
func NewPackingService(repo PackingRepository) *PackingService {
	return &PackingService{repo: repo}
}

// CalculatePacking calculates optimal packing for items
func (s *PackingService) CalculatePacking(ctx context.Context, orderID string, items []PackingItem) (*PackingResult, error) {
	if len(items) == 0 {
		return nil, errors.New("no items to pack")
	}

	// Get available packages
	packages, err := s.repo.ListPackages(ctx, true)
	if err != nil {
		return nil, err
	}

	if len(packages) == 0 {
		return nil, ErrNoSuitablePackage
	}

	// Calculate total weight and volume
	var totalWeight, totalVolume float64
	for _, item := range items {
		totalWeight += item.TotalWeight()
		totalVolume += item.TotalVolume()
	}

	// Try to fit items into packages using bin packing algorithm
	packedPackages, err := s.binPacking(items, packages)
	if err != nil {
		return nil, err
	}

	// Calculate total cost
	var totalCost float64
	for _, pp := range packedPackages {
		pkg, _ := s.repo.GetPackage(ctx, pp.PackageID)
		if pkg != nil {
			totalCost += pkg.Cost
		}
	}

	result := &PackingResult{
		ID:          generateID(),
		OrderID:     orderID,
		Packages:    packedPackages,
		TotalWeight: totalWeight,
		TotalVolume: totalVolume,
		TotalCost:   totalCost,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreatePackingResult(ctx, result); err != nil {
		return nil, err
	}

	return result, nil
}

// binPacking implements bin packing algorithm
func (s *PackingService) binPacking(items []PackingItem, packages []*Package) ([]PackedPackage, error) {
	// Sort packages by volume (smallest first for efficiency)
	sort.Slice(packages, func(i, j int) bool {
		return packages[i].Volume() < packages[j].Volume()
	})

	// Expand items by quantity
	var expandedItems []PackingItem
	for _, item := range items {
		for i := 0; i < item.Quantity; i++ {
			singleItem := item
			singleItem.Quantity = 1
			expandedItems = append(expandedItems, singleItem)
		}
	}

	// Sort items by volume (largest first)
	sort.Slice(expandedItems, func(i, j int) bool {
		return expandedItems[i].TotalVolume() > expandedItems[j].TotalVolume()
	})

	var result []PackedPackage
	remainingItems := expandedItems

	for len(remainingItems) > 0 {
		// Find smallest package that fits remaining items
		packed, remaining, pkg := s.tryPackItems(remainingItems, packages)
		if pkg == nil {
			return nil, ErrItemsTooLarge
		}

		// Calculate fill rate
		var usedVolume float64
		for _, pi := range packed {
			for _, item := range expandedItems {
				if item.ProductID == pi.ProductID {
					usedVolume += item.Length * item.Width * item.Height * float64(pi.Quantity)
					break
				}
			}
		}
		fillRate := (usedVolume / pkg.Volume()) * 100

		packedPkg := PackedPackage{
			PackageID:   pkg.ID,
			PackageName: pkg.Name,
			Items:       packed,
			TotalWeight: pkg.TareWeight,
			UsedVolume:  usedVolume,
			FillRate:    math.Round(fillRate*100) / 100,
			Dimensions: Dimensions{
				Length: pkg.Length,
				Width:  pkg.Width,
				Height: pkg.Height,
			},
		}

		// Add item weights
		for _, pi := range packed {
			for _, item := range expandedItems {
				if item.ProductID == pi.ProductID {
					packedPkg.TotalWeight += item.Weight * float64(pi.Quantity)
					break
				}
			}
		}

		result = append(result, packedPkg)
		remainingItems = remaining
	}

	return result, nil
}

// tryPackItems tries to pack items into available packages
func (s *PackingService) tryPackItems(items []PackingItem, packages []*Package) ([]PackedItem, []PackingItem, *Package) {
	for _, pkg := range packages {
		packed, remaining := s.packIntoPackage(items, pkg)
		if len(packed) > 0 {
			return packed, remaining, pkg
		}
	}
	return nil, items, nil
}

// packIntoPackage packs as many items as possible into a package
func (s *PackingService) packIntoPackage(items []PackingItem, pkg *Package) ([]PackedItem, []PackingItem) {
	var packed []PackedItem
	var remaining []PackingItem

	availableVolume := pkg.Volume()
	availableWeight := pkg.MaxWeight - pkg.TareWeight
	var usedVolume, usedWeight float64

	// Group items by product ID for consolidation
	itemCounts := make(map[string]int)

	for _, item := range items {
		itemVolume := item.Length * item.Width * item.Height
		itemWeight := item.Weight

		// Check if item fits
		if itemVolume <= (availableVolume-usedVolume) && itemWeight <= (availableWeight-usedWeight) {
			// Check dimensional fit (simplified)
			if item.Length <= pkg.Length && item.Width <= pkg.Width && item.Height <= pkg.Height {
				usedVolume += itemVolume
				usedWeight += itemWeight
				itemCounts[item.ProductID]++
			} else {
				remaining = append(remaining, item)
			}
		} else {
			remaining = append(remaining, item)
		}
	}

	// Convert counts to packed items
	for productID, count := range itemCounts {
		// Find SKU from original items
		var sku string
		for _, item := range items {
			if item.ProductID == productID {
				sku = item.SKU
				break
			}
		}

		packed = append(packed, PackedItem{
			ProductID: productID,
			SKU:       sku,
			Quantity:  count,
			Position:  PackingPosition{X: 0, Y: 0, Z: 0}, // Simplified positioning
		})
	}

	return packed, remaining
}

// CreatePackingTask creates new packing task
func (s *PackingService) CreatePackingTask(ctx context.Context, orderID string, items []PackingItem, priority int) (*PackingTask, error) {
	task := &PackingTask{
		ID:        generateID(),
		OrderID:   orderID,
		Status:    "pending",
		Priority:  priority,
		Items:     items,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.CreatePackingTask(ctx, task); err != nil {
		return nil, err
	}

	return task, nil
}

// StartPackingTask starts packing task
func (s *PackingService) StartPackingTask(ctx context.Context, taskID, stationID, userID string) error {
	task, err := s.repo.GetPackingTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status != "pending" {
		return errors.New("task is not pending")
	}

	now := time.Now()
	task.Status = "in_progress"
	task.StationID = stationID
	task.AssignedTo = userID
	task.StartedAt = &now
	task.UpdatedAt = now

	// Update station status
	station, err := s.repo.GetStation(ctx, stationID)
	if err == nil {
		station.Status = "busy"
		station.AssignedUser = userID
		s.repo.UpdateStation(ctx, station)
	}

	return s.repo.UpdatePackingTask(ctx, task)
}

// CompletePackingTask completes packing task
func (s *PackingService) CompletePackingTask(ctx context.Context, taskID string, packingResult *PackingResult) error {
	task, err := s.repo.GetPackingTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status != "in_progress" {
		return errors.New("task is not in progress")
	}

	now := time.Now()
	task.Status = "completed"
	task.PackingResult = packingResult
	task.CompletedAt = &now
	task.UpdatedAt = now

	// Calculate packing time
	if task.StartedAt != nil {
		packingResult.PackingTime = now.Sub(*task.StartedAt)
	}

	// Release station
	if task.StationID != "" {
		station, err := s.repo.GetStation(ctx, task.StationID)
		if err == nil {
			station.Status = "available"
			station.AssignedUser = ""
			s.repo.UpdateStation(ctx, station)
		}
	}

	return s.repo.UpdatePackingTask(ctx, task)
}

// GeneratePackingSlip generates packing slip for package
func (s *PackingService) GeneratePackingSlip(ctx context.Context, orderID string, packageNum, totalPackages int, items []PackingSlipItem, shipFrom, shipTo AddressInfo, weight float64, dimensions string, notes string) (*PackingSlip, error) {
	slip := &PackingSlip{
		ID:         generateID(),
		OrderID:    orderID,
		PackageNum: packageNum,
		TotalPkgs:  totalPackages,
		Items:      items,
		ShipFrom:   shipFrom,
		ShipTo:     shipTo,
		Weight:     weight,
		Dimensions: dimensions,
		Notes:      notes,
		CreatedAt:  time.Now(),
	}

	if err := s.repo.CreatePackingSlip(ctx, slip); err != nil {
		return nil, err
	}

	return slip, nil
}

// GetPackingSlipsByOrder returns packing slips for order
func (s *PackingService) GetPackingSlipsByOrder(ctx context.Context, orderID string) ([]*PackingSlip, error) {
	return s.repo.GetPackingSlipsByOrder(ctx, orderID)
}

// WeighPackage records package weight
func (s *PackingService) WeighPackage(ctx context.Context, orderID string, packageIndex int, actualWeight float64) error {
	result, err := s.repo.GetPackingResultByOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if packageIndex < 0 || packageIndex >= len(result.Packages) {
		return errors.New("invalid package index")
	}

	result.Packages[packageIndex].TotalWeight = actualWeight
	return s.repo.CreatePackingResult(ctx, result)
}

// GetPackingTask returns packing task by ID
func (s *PackingService) GetPackingTask(ctx context.Context, id string) (*PackingTask, error) {
	return s.repo.GetPackingTask(ctx, id)
}

// GetNextPackingTask returns next task for station
func (s *PackingService) GetNextPackingTask(ctx context.Context, stationID string) (*PackingTask, error) {
	return s.repo.GetNextPackingTask(ctx, stationID)
}

// ListPackingTasks returns list of packing tasks
func (s *PackingService) ListPackingTasks(ctx context.Context, status string, limit int) ([]*PackingTask, error) {
	return s.repo.ListPackingTasks(ctx, status, limit)
}

// GetPackages returns list of packages
func (s *PackingService) GetPackages(ctx context.Context, activeOnly bool) ([]*Package, error) {
	return s.repo.ListPackages(ctx, activeOnly)
}

// CreatePackage creates new package template
func (s *PackingService) CreatePackage(ctx context.Context, pkg *Package) error {
	pkg.ID = generateID()
	pkg.CreatedAt = time.Now()
	pkg.UpdatedAt = time.Now()
	return s.repo.CreatePackage(ctx, pkg)
}

// UpdatePackage updates package template
func (s *PackingService) UpdatePackage(ctx context.Context, pkg *Package) error {
	pkg.UpdatedAt = time.Now()
	return s.repo.UpdatePackage(ctx, pkg)
}

// GetPackingStations returns list of packing stations
func (s *PackingService) GetPackingStations(ctx context.Context) ([]*PackingStation, error) {
	return s.repo.ListStations(ctx)
}

// CreatePackingStation creates new packing station
func (s *PackingService) CreatePackingStation(ctx context.Context, station *PackingStation) error {
	station.ID = generateID()
	station.Status = "available"
	station.CreatedAt = time.Now()
	return s.repo.CreateStation(ctx, station)
}

// SuggestPackage suggests best package for items
func (s *PackingService) SuggestPackage(ctx context.Context, items []PackingItem) (*Package, error) {
	// Calculate total dimensions and weight
	var totalVolume, totalWeight float64
	var maxLength, maxWidth, maxHeight float64

	for _, item := range items {
		totalVolume += item.TotalVolume()
		totalWeight += item.TotalWeight()

		if item.Length > maxLength {
			maxLength = item.Length
		}
		if item.Width > maxWidth {
			maxWidth = item.Width
		}
		if item.Height > maxHeight {
			maxHeight = item.Height
		}
	}

	// Get packages that can fit
	packages, err := s.repo.ListPackages(ctx, true)
	if err != nil {
		return nil, err
	}

	var suitable []*Package
	for _, pkg := range packages {
		if pkg.Length >= maxLength && pkg.Width >= maxWidth && pkg.Height >= maxHeight {
			if pkg.Volume() >= totalVolume && (pkg.MaxWeight-pkg.TareWeight) >= totalWeight {
				if pkg.InStock > 0 {
					suitable = append(suitable, pkg)
				}
			}
		}
	}

	if len(suitable) == 0 {
		return nil, ErrNoSuitablePackage
	}

	// Return smallest suitable package
	sort.Slice(suitable, func(i, j int) bool {
		return suitable[i].Volume() < suitable[j].Volume()
	})

	return suitable[0], nil
}
