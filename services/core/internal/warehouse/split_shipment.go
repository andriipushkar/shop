package warehouse

import (
	"context"
	"errors"
	"sort"
	"time"
)

// Split shipment errors
var (
	ErrCannotSplit       = errors.New("cannot split order")
	ErrNoAvailableStock  = errors.New("no available stock for items")
	ErrSplitNotAllowed   = errors.New("split shipment not allowed for this order")
)

// SplitStrategy represents splitting strategy
type SplitStrategy string

const (
	StrategySingleWarehouse SplitStrategy = "single"     // Ship from one warehouse only
	StrategySplitAllowed    SplitStrategy = "split"      // Allow splitting across warehouses
	StrategyFastest         SplitStrategy = "fastest"    // Optimize for speed
	StrategyCheapest        SplitStrategy = "cheapest"   // Optimize for cost
	StrategyBalanced        SplitStrategy = "balanced"   // Balance speed and cost
)

// ShipmentPlan represents multi-warehouse shipment plan
type ShipmentPlan struct {
	ID             string            `json:"id"`
	OrderID        string            `json:"order_id"`
	Strategy       SplitStrategy     `json:"strategy"`
	Shipments      []PlannedShipment `json:"shipments"`
	TotalCost      float64           `json:"total_cost"`
	EstimatedDays  int               `json:"estimated_days"`
	IsSplit        bool              `json:"is_split"`
	SplitReason    string            `json:"split_reason,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	ApprovedAt     *time.Time        `json:"approved_at,omitempty"`
	ApprovedBy     string            `json:"approved_by,omitempty"`
}

// PlannedShipment represents shipment from single warehouse
type PlannedShipment struct {
	ID              string         `json:"id"`
	WarehouseID     string         `json:"warehouse_id"`
	WarehouseName   string         `json:"warehouse_name"`
	Items           []ShipmentItem `json:"items"`
	ShippingMethod  string         `json:"shipping_method"`
	ShippingCost    float64        `json:"shipping_cost"`
	EstimatedDays   int            `json:"estimated_days"`
	Priority        int            `json:"priority"` // Order of shipment
	Status          string         `json:"status"`   // planned, picking, packed, shipped, delivered
	TrackingNumber  string         `json:"tracking_number,omitempty"`
	ShippedAt       *time.Time     `json:"shipped_at,omitempty"`
	DeliveredAt     *time.Time     `json:"delivered_at,omitempty"`
}

// ShipmentItem represents item in shipment
type ShipmentItem struct {
	ProductID    string  `json:"product_id"`
	SKU          string  `json:"sku"`
	Name         string  `json:"name"`
	Quantity     int     `json:"quantity"`
	UnitPrice    float64 `json:"unit_price"`
	Weight       float64 `json:"weight"`
	Location     string  `json:"location,omitempty"`
	BatchNumber  string  `json:"batch_number,omitempty"`
}

// OrderItem represents item to be shipped
type OrderItem struct {
	ProductID string  `json:"product_id"`
	SKU       string  `json:"sku"`
	Name      string  `json:"name"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
	Weight    float64 `json:"weight"`
}

// ShippingRate represents shipping rate
type ShippingRate struct {
	CarrierID      string  `json:"carrier_id"`
	CarrierName    string  `json:"carrier_name"`
	ServiceName    string  `json:"service_name"`
	Cost           float64 `json:"cost"`
	EstimatedDays  int     `json:"estimated_days"`
	MaxWeight      float64 `json:"max_weight"`
}

// SplitConfig contains split shipment configuration
type SplitConfig struct {
	AllowSplit           bool    `json:"allow_split"`
	MaxShipments         int     `json:"max_shipments"`
	MinItemsPerShipment  int     `json:"min_items_per_shipment"`
	CombinedShippingDiscount float64 `json:"combined_shipping_discount"` // % discount for combined
	NotifyCustomer       bool    `json:"notify_customer"`
	RequireApproval      bool    `json:"require_approval"`
}

// WarehouseDistance represents distance/cost from warehouse to destination
type WarehouseDistance struct {
	WarehouseID   string  `json:"warehouse_id"`
	WarehouseName string  `json:"warehouse_name"`
	Distance      float64 `json:"distance_km"`
	ShippingCost  float64 `json:"shipping_cost"`
	EstimatedDays int     `json:"estimated_days"`
}

// SplitShipmentRepository defines split shipment data access
type SplitShipmentRepository interface {
	CreateShipmentPlan(ctx context.Context, plan *ShipmentPlan) error
	UpdateShipmentPlan(ctx context.Context, plan *ShipmentPlan) error
	GetShipmentPlan(ctx context.Context, id string) (*ShipmentPlan, error)
	GetShipmentPlanByOrder(ctx context.Context, orderID string) (*ShipmentPlan, error)
	ListShipmentPlans(ctx context.Context, status string, limit int) ([]*ShipmentPlan, error)

	GetShippingRates(ctx context.Context, warehouseID, destinationZip string, weight float64) ([]*ShippingRate, error)
	GetWarehouseDistances(ctx context.Context, destinationLat, destinationLng float64) ([]*WarehouseDistance, error)
}

// SplitShipmentService manages multi-warehouse fulfillment
type SplitShipmentService struct {
	repo          SplitShipmentRepository
	warehouseRepo WarehouseRepository
	config        SplitConfig
}

// NewSplitShipmentService creates split shipment service
func NewSplitShipmentService(repo SplitShipmentRepository, warehouseRepo WarehouseRepository, config SplitConfig) *SplitShipmentService {
	if config.MaxShipments == 0 {
		config.MaxShipments = 3
	}
	if config.MinItemsPerShipment == 0 {
		config.MinItemsPerShipment = 1
	}

	return &SplitShipmentService{
		repo:          repo,
		warehouseRepo: warehouseRepo,
		config:        config,
	}
}

// PlanShipment creates optimal shipment plan for order
func (s *SplitShipmentService) PlanShipment(ctx context.Context, orderID string, items []OrderItem, destinationLat, destinationLng float64, strategy SplitStrategy) (*ShipmentPlan, error) {
	if len(items) == 0 {
		return nil, errors.New("no items to ship")
	}

	// Get warehouse distances
	distances, err := s.repo.GetWarehouseDistances(ctx, destinationLat, destinationLng)
	if err != nil {
		return nil, err
	}

	// Get stock availability across warehouses
	availability := s.getStockAvailability(ctx, items)

	// Try single warehouse first
	singlePlan := s.trySingleWarehouse(ctx, orderID, items, availability, distances, strategy)
	if singlePlan != nil {
		return singlePlan, nil
	}

	// Need to split
	if !s.config.AllowSplit {
		return nil, ErrSplitNotAllowed
	}

	// Calculate split shipment plan
	splitPlan, err := s.calculateSplitPlan(ctx, orderID, items, availability, distances, strategy)
	if err != nil {
		return nil, err
	}

	return splitPlan, nil
}

// getStockAvailability returns stock availability per warehouse
func (s *SplitShipmentService) getStockAvailability(ctx context.Context, items []OrderItem) map[string]map[string]int {
	availability := make(map[string]map[string]int) // warehouseID -> productID -> available

	for _, item := range items {
		stocks, err := s.warehouseRepo.GetStockByProduct(ctx, item.ProductID)
		if err != nil {
			continue
		}

		for _, stock := range stocks {
			if stock.Available > 0 {
				if availability[stock.WarehouseID] == nil {
					availability[stock.WarehouseID] = make(map[string]int)
				}
				availability[stock.WarehouseID][item.ProductID] = stock.Available
			}
		}
	}

	return availability
}

// trySingleWarehouse tries to fulfill from single warehouse
func (s *SplitShipmentService) trySingleWarehouse(ctx context.Context, orderID string, items []OrderItem, availability map[string]map[string]int, distances []*WarehouseDistance, strategy SplitStrategy) *ShipmentPlan {
	// Find warehouses that can fulfill entire order
	var candidates []string

	for warehouseID, stock := range availability {
		canFulfill := true
		for _, item := range items {
			if stock[item.ProductID] < item.Quantity {
				canFulfill = false
				break
			}
		}
		if canFulfill {
			candidates = append(candidates, warehouseID)
		}
	}

	if len(candidates) == 0 {
		return nil
	}

	// Sort by strategy
	distanceMap := make(map[string]*WarehouseDistance)
	for _, d := range distances {
		distanceMap[d.WarehouseID] = d
	}

	sort.Slice(candidates, func(i, j int) bool {
		di := distanceMap[candidates[i]]
		dj := distanceMap[candidates[j]]
		if di == nil || dj == nil {
			return false
		}

		switch strategy {
		case StrategyFastest:
			return di.EstimatedDays < dj.EstimatedDays
		case StrategyCheapest:
			return di.ShippingCost < dj.ShippingCost
		default: // balanced
			// Score = cost * days
			return (di.ShippingCost * float64(di.EstimatedDays)) < (dj.ShippingCost * float64(dj.EstimatedDays))
		}
	})

	bestWarehouse := candidates[0]
	dist := distanceMap[bestWarehouse]

	// Create shipment items
	shipmentItems := make([]ShipmentItem, len(items))
	for i, item := range items {
		shipmentItems[i] = ShipmentItem{
			ProductID: item.ProductID,
			SKU:       item.SKU,
			Name:      item.Name,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
			Weight:    item.Weight,
		}
	}

	plan := &ShipmentPlan{
		ID:       generateID(),
		OrderID:  orderID,
		Strategy: strategy,
		Shipments: []PlannedShipment{
			{
				ID:             generateID(),
				WarehouseID:    bestWarehouse,
				WarehouseName:  dist.WarehouseName,
				Items:          shipmentItems,
				ShippingMethod: "standard",
				ShippingCost:   dist.ShippingCost,
				EstimatedDays:  dist.EstimatedDays,
				Priority:       1,
				Status:         "planned",
			},
		},
		TotalCost:     dist.ShippingCost,
		EstimatedDays: dist.EstimatedDays,
		IsSplit:       false,
		CreatedAt:     time.Now(),
	}

	s.repo.CreateShipmentPlan(ctx, plan)
	return plan
}

// calculateSplitPlan calculates split shipment plan
func (s *SplitShipmentService) calculateSplitPlan(ctx context.Context, orderID string, items []OrderItem, availability map[string]map[string]int, distances []*WarehouseDistance, strategy SplitStrategy) (*ShipmentPlan, error) {
	// Create distance map
	distanceMap := make(map[string]*WarehouseDistance)
	for _, d := range distances {
		distanceMap[d.WarehouseID] = d
	}

	// Track remaining quantities
	remaining := make(map[string]int)
	for _, item := range items {
		remaining[item.ProductID] = item.Quantity
	}

	var shipments []PlannedShipment
	var totalCost float64
	var maxDays int

	// Sort warehouses by strategy
	var sortedWarehouses []string
	for wh := range availability {
		sortedWarehouses = append(sortedWarehouses, wh)
	}

	sort.Slice(sortedWarehouses, func(i, j int) bool {
		di := distanceMap[sortedWarehouses[i]]
		dj := distanceMap[sortedWarehouses[j]]
		if di == nil || dj == nil {
			return false
		}

		switch strategy {
		case StrategyFastest:
			return di.EstimatedDays < dj.EstimatedDays
		case StrategyCheapest:
			return di.ShippingCost < dj.ShippingCost
		default:
			return (di.ShippingCost * float64(di.EstimatedDays)) < (dj.ShippingCost * float64(dj.EstimatedDays))
		}
	})

	// Allocate items to warehouses
	for _, warehouseID := range sortedWarehouses {
		if len(shipments) >= s.config.MaxShipments {
			break
		}

		stock := availability[warehouseID]
		var shipmentItems []ShipmentItem
		hasItems := false

		for _, item := range items {
			if remaining[item.ProductID] <= 0 {
				continue
			}

			available := stock[item.ProductID]
			if available <= 0 {
				continue
			}

			allocQty := available
			if allocQty > remaining[item.ProductID] {
				allocQty = remaining[item.ProductID]
			}

			shipmentItems = append(shipmentItems, ShipmentItem{
				ProductID: item.ProductID,
				SKU:       item.SKU,
				Name:      item.Name,
				Quantity:  allocQty,
				UnitPrice: item.UnitPrice,
				Weight:    item.Weight,
			})

			remaining[item.ProductID] -= allocQty
			hasItems = true
		}

		if hasItems && len(shipmentItems) >= s.config.MinItemsPerShipment {
			dist := distanceMap[warehouseID]
			if dist == nil {
				continue
			}

			shipment := PlannedShipment{
				ID:             generateID(),
				WarehouseID:    warehouseID,
				WarehouseName:  dist.WarehouseName,
				Items:          shipmentItems,
				ShippingMethod: "standard",
				ShippingCost:   dist.ShippingCost,
				EstimatedDays:  dist.EstimatedDays,
				Priority:       len(shipments) + 1,
				Status:         "planned",
			}

			shipments = append(shipments, shipment)
			totalCost += dist.ShippingCost

			if dist.EstimatedDays > maxDays {
				maxDays = dist.EstimatedDays
			}
		}
	}

	// Check if all items are allocated
	for productID, qty := range remaining {
		if qty > 0 {
			return nil, errors.New("cannot fulfill product: " + productID)
		}
	}

	if len(shipments) == 0 {
		return nil, ErrNoAvailableStock
	}

	// Apply combined shipping discount
	if len(shipments) > 1 && s.config.CombinedShippingDiscount > 0 {
		discount := totalCost * (s.config.CombinedShippingDiscount / 100)
		totalCost -= discount
	}

	plan := &ShipmentPlan{
		ID:            generateID(),
		OrderID:       orderID,
		Strategy:      strategy,
		Shipments:     shipments,
		TotalCost:     totalCost,
		EstimatedDays: maxDays,
		IsSplit:       len(shipments) > 1,
		SplitReason:   "Items not available in single warehouse",
		CreatedAt:     time.Now(),
	}

	if err := s.repo.CreateShipmentPlan(ctx, plan); err != nil {
		return nil, err
	}

	return plan, nil
}

// ApproveShipmentPlan approves split shipment plan
func (s *SplitShipmentService) ApproveShipmentPlan(ctx context.Context, planID, approvedBy string) error {
	plan, err := s.repo.GetShipmentPlan(ctx, planID)
	if err != nil {
		return err
	}

	now := time.Now()
	plan.ApprovedAt = &now
	plan.ApprovedBy = approvedBy

	// Update shipment statuses
	for i := range plan.Shipments {
		plan.Shipments[i].Status = "picking"
	}

	return s.repo.UpdateShipmentPlan(ctx, plan)
}

// UpdateShipmentStatus updates status of individual shipment
func (s *SplitShipmentService) UpdateShipmentStatus(ctx context.Context, planID, shipmentID, status, trackingNumber string) error {
	plan, err := s.repo.GetShipmentPlan(ctx, planID)
	if err != nil {
		return err
	}

	now := time.Now()

	for i := range plan.Shipments {
		if plan.Shipments[i].ID == shipmentID {
			plan.Shipments[i].Status = status
			if trackingNumber != "" {
				plan.Shipments[i].TrackingNumber = trackingNumber
			}
			if status == "shipped" {
				plan.Shipments[i].ShippedAt = &now
			}
			if status == "delivered" {
				plan.Shipments[i].DeliveredAt = &now
			}
			break
		}
	}

	return s.repo.UpdateShipmentPlan(ctx, plan)
}

// GetShipmentPlan returns shipment plan by ID
func (s *SplitShipmentService) GetShipmentPlan(ctx context.Context, id string) (*ShipmentPlan, error) {
	return s.repo.GetShipmentPlan(ctx, id)
}

// GetShipmentPlanByOrder returns shipment plan for order
func (s *SplitShipmentService) GetShipmentPlanByOrder(ctx context.Context, orderID string) (*ShipmentPlan, error) {
	return s.repo.GetShipmentPlanByOrder(ctx, orderID)
}

// CanShipFromSingleWarehouse checks if order can ship from one warehouse
func (s *SplitShipmentService) CanShipFromSingleWarehouse(ctx context.Context, items []OrderItem) (bool, string, error) {
	availability := s.getStockAvailability(ctx, items)

	for warehouseID, stock := range availability {
		canFulfill := true
		for _, item := range items {
			if stock[item.ProductID] < item.Quantity {
				canFulfill = false
				break
			}
		}
		if canFulfill {
			// Get warehouse name
			wh, err := s.warehouseRepo.GetWarehouse(ctx, warehouseID)
			if err != nil {
				return true, warehouseID, nil
			}
			return true, wh.Name, nil
		}
	}

	return false, "", nil
}

// GetShipmentOptions returns available shipment options with costs
func (s *SplitShipmentService) GetShipmentOptions(ctx context.Context, orderID string, items []OrderItem, destinationLat, destinationLng float64) ([]*ShipmentPlan, error) {
	var options []*ShipmentPlan

	strategies := []SplitStrategy{StrategySingleWarehouse, StrategyFastest, StrategyCheapest, StrategyBalanced}

	for _, strategy := range strategies {
		plan, err := s.PlanShipment(ctx, orderID, items, destinationLat, destinationLng, strategy)
		if err != nil {
			continue
		}
		options = append(options, plan)
	}

	if len(options) == 0 {
		return nil, ErrNoAvailableStock
	}

	return options, nil
}

// ConsolidateShipments tries to merge nearby shipments
func (s *SplitShipmentService) ConsolidateShipments(ctx context.Context, planID string) error {
	plan, err := s.repo.GetShipmentPlan(ctx, planID)
	if err != nil {
		return err
	}

	if len(plan.Shipments) <= 1 {
		return nil // Nothing to consolidate
	}

	// Check if any shipments can be consolidated (same region)
	// This would require distance calculation between warehouses
	// For now, just return without changes

	return nil
}

// CalculatePartialShipment creates plan for partial fulfillment
func (s *SplitShipmentService) CalculatePartialShipment(ctx context.Context, orderID string, items []OrderItem, destinationLat, destinationLng float64) (*ShipmentPlan, []OrderItem, error) {
	availability := s.getStockAvailability(ctx, items)
	distances, err := s.repo.GetWarehouseDistances(ctx, destinationLat, destinationLng)
	if err != nil {
		return nil, nil, err
	}

	distanceMap := make(map[string]*WarehouseDistance)
	for _, d := range distances {
		distanceMap[d.WarehouseID] = d
	}

	var shipments []PlannedShipment
	var backordered []OrderItem
	var totalCost float64
	var maxDays int

	remaining := make(map[string]int)
	for _, item := range items {
		remaining[item.ProductID] = item.Quantity
	}

	// Allocate available items
	for warehouseID, stock := range availability {
		dist := distanceMap[warehouseID]
		if dist == nil {
			continue
		}

		var shipmentItems []ShipmentItem

		for _, item := range items {
			if remaining[item.ProductID] <= 0 {
				continue
			}

			available := stock[item.ProductID]
			if available <= 0 {
				continue
			}

			allocQty := available
			if allocQty > remaining[item.ProductID] {
				allocQty = remaining[item.ProductID]
			}

			shipmentItems = append(shipmentItems, ShipmentItem{
				ProductID: item.ProductID,
				SKU:       item.SKU,
				Name:      item.Name,
				Quantity:  allocQty,
				UnitPrice: item.UnitPrice,
				Weight:    item.Weight,
			})

			remaining[item.ProductID] -= allocQty
		}

		if len(shipmentItems) > 0 {
			shipment := PlannedShipment{
				ID:             generateID(),
				WarehouseID:    warehouseID,
				WarehouseName:  dist.WarehouseName,
				Items:          shipmentItems,
				ShippingMethod: "standard",
				ShippingCost:   dist.ShippingCost,
				EstimatedDays:  dist.EstimatedDays,
				Priority:       len(shipments) + 1,
				Status:         "planned",
			}

			shipments = append(shipments, shipment)
			totalCost += dist.ShippingCost

			if dist.EstimatedDays > maxDays {
				maxDays = dist.EstimatedDays
			}
		}
	}

	// Identify backordered items
	for _, item := range items {
		if remaining[item.ProductID] > 0 {
			backordered = append(backordered, OrderItem{
				ProductID: item.ProductID,
				SKU:       item.SKU,
				Name:      item.Name,
				Quantity:  remaining[item.ProductID],
				UnitPrice: item.UnitPrice,
				Weight:    item.Weight,
			})
		}
	}

	if len(shipments) == 0 {
		return nil, items, nil // All items backordered
	}

	plan := &ShipmentPlan{
		ID:            generateID(),
		OrderID:       orderID,
		Strategy:      SplitStrategy("partial"),
		Shipments:     shipments,
		TotalCost:     totalCost,
		EstimatedDays: maxDays,
		IsSplit:       len(shipments) > 1,
		SplitReason:   "Partial fulfillment - some items backordered",
		CreatedAt:     time.Now(),
	}

	if err := s.repo.CreateShipmentPlan(ctx, plan); err != nil {
		return nil, nil, err
	}

	return plan, backordered, nil
}
