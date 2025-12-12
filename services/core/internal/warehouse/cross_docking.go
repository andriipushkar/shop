package warehouse

import (
	"context"
	"errors"
	"time"
)

// Cross-docking errors
var (
	ErrCrossDockNotFound = errors.New("cross-dock order not found")
	ErrInvalidDockState  = errors.New("invalid cross-dock state")
	ErrDockNotAvailable  = errors.New("dock not available")
)

// CrossDockStatus represents cross-dock order status
type CrossDockStatus string

const (
	CrossDockStatusScheduled   CrossDockStatus = "scheduled"
	CrossDockStatusReceiving   CrossDockStatus = "receiving"
	CrossDockStatusSorting     CrossDockStatus = "sorting"
	CrossDockStatusLoading     CrossDockStatus = "loading"
	CrossDockStatusCompleted   CrossDockStatus = "completed"
	CrossDockStatusCancelled   CrossDockStatus = "cancelled"
)

// CrossDockType represents type of cross-docking
type CrossDockType string

const (
	CrossDockTypeTransit     CrossDockType = "transit"      // Pass through without storing
	CrossDockTypeMerge       CrossDockType = "merge"        // Combine shipments
	CrossDockTypeBreakBulk   CrossDockType = "break_bulk"   // Split large shipments
	CrossDockTypeDistribution CrossDockType = "distribution" // Sort by destination
)

// CrossDockOrder represents cross-docking order
type CrossDockOrder struct {
	ID              string           `json:"id"`
	Type            CrossDockType    `json:"type"`
	Status          CrossDockStatus  `json:"status"`
	WarehouseID     string           `json:"warehouse_id"`
	DockID          string           `json:"dock_id,omitempty"`
	InboundShipments []InboundShipment `json:"inbound_shipments"`
	OutboundShipments []OutboundShipment `json:"outbound_shipments"`
	ScheduledStart  time.Time        `json:"scheduled_start"`
	ScheduledEnd    time.Time        `json:"scheduled_end"`
	ActualStart     *time.Time       `json:"actual_start,omitempty"`
	ActualEnd       *time.Time       `json:"actual_end,omitempty"`
	Priority        int              `json:"priority"`
	Notes           string           `json:"notes,omitempty"`
	CreatedBy       string           `json:"created_by"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

// InboundShipment represents incoming shipment for cross-dock
type InboundShipment struct {
	ID             string          `json:"id"`
	SupplierID     string          `json:"supplier_id,omitempty"`
	SupplierName   string          `json:"supplier_name,omitempty"`
	PONumber       string          `json:"po_number,omitempty"`
	TrackingNumber string          `json:"tracking_number,omitempty"`
	Carrier        string          `json:"carrier,omitempty"`
	Items          []CrossDockItem `json:"items"`
	ScheduledArrival time.Time     `json:"scheduled_arrival"`
	ActualArrival    *time.Time    `json:"actual_arrival,omitempty"`
	Status         string          `json:"status"` // pending, arrived, unloaded, sorted
	DockDoor       string          `json:"dock_door,omitempty"`
}

// OutboundShipment represents outgoing shipment from cross-dock
type OutboundShipment struct {
	ID             string          `json:"id"`
	DestinationType string         `json:"destination_type"` // warehouse, store, customer
	DestinationID  string          `json:"destination_id"`
	DestinationName string         `json:"destination_name"`
	Carrier        string          `json:"carrier,omitempty"`
	TrackingNumber string          `json:"tracking_number,omitempty"`
	Items          []CrossDockItem `json:"items"`
	ScheduledDeparture time.Time   `json:"scheduled_departure"`
	ActualDeparture    *time.Time  `json:"actual_departure,omitempty"`
	Status         string          `json:"status"` // pending, loading, loaded, departed
	DockDoor       string          `json:"dock_door,omitempty"`
}

// CrossDockItem represents item in cross-dock
type CrossDockItem struct {
	ProductID     string `json:"product_id"`
	SKU           string `json:"sku"`
	Name          string `json:"name"`
	Quantity      int    `json:"quantity"`
	ReceivedQty   int    `json:"received_qty,omitempty"`
	LoadedQty     int    `json:"loaded_qty,omitempty"`
	Location      string `json:"location,omitempty"` // Staging area
	PalletID      string `json:"pallet_id,omitempty"`
}

// Dock represents loading/unloading dock
type Dock struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	WarehouseID string    `json:"warehouse_id"`
	Type        string    `json:"type"` // inbound, outbound, both
	Status      string    `json:"status"` // available, occupied, maintenance
	CurrentOrderID string `json:"current_order_id,omitempty"`
	Equipment   []string  `json:"equipment,omitempty"` // forklift, conveyor, etc.
	CreatedAt   time.Time `json:"created_at"`
}

// StagingArea represents staging area for cross-dock
type StagingArea struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	WarehouseID string    `json:"warehouse_id"`
	Zone        string    `json:"zone"`
	Capacity    int       `json:"capacity"` // Pallets or items
	Used        int       `json:"used"`
	Type        string    `json:"type"` // inbound, outbound, sorting
	CreatedAt   time.Time `json:"created_at"`
}

// CrossDockSchedule represents daily cross-dock schedule
type CrossDockSchedule struct {
	Date       time.Time          `json:"date"`
	WarehouseID string            `json:"warehouse_id"`
	Orders     []*CrossDockOrder  `json:"orders"`
	DockUsage  []DockTimeSlot     `json:"dock_usage"`
}

// DockTimeSlot represents dock usage time slot
type DockTimeSlot struct {
	DockID    string    `json:"dock_id"`
	DockName  string    `json:"dock_name"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	OrderID   string    `json:"order_id"`
	Type      string    `json:"type"` // inbound, outbound
}

// CrossDockRepository defines cross-docking data access
type CrossDockRepository interface {
	// Orders
	CreateCrossDockOrder(ctx context.Context, order *CrossDockOrder) error
	UpdateCrossDockOrder(ctx context.Context, order *CrossDockOrder) error
	GetCrossDockOrder(ctx context.Context, id string) (*CrossDockOrder, error)
	ListCrossDockOrders(ctx context.Context, status CrossDockStatus, warehouseID string, from, to time.Time, limit int) ([]*CrossDockOrder, error)

	// Docks
	CreateDock(ctx context.Context, dock *Dock) error
	UpdateDock(ctx context.Context, dock *Dock) error
	GetDock(ctx context.Context, id string) (*Dock, error)
	ListDocks(ctx context.Context, warehouseID string) ([]*Dock, error)
	GetAvailableDock(ctx context.Context, warehouseID, dockType string, startTime, endTime time.Time) (*Dock, error)

	// Staging Areas
	CreateStagingArea(ctx context.Context, area *StagingArea) error
	UpdateStagingArea(ctx context.Context, area *StagingArea) error
	GetStagingArea(ctx context.Context, id string) (*StagingArea, error)
	ListStagingAreas(ctx context.Context, warehouseID string) ([]*StagingArea, error)
	GetAvailableStagingArea(ctx context.Context, warehouseID, areaType string, requiredCapacity int) (*StagingArea, error)

	// Schedule
	GetDailySchedule(ctx context.Context, warehouseID string, date time.Time) (*CrossDockSchedule, error)
}

// CrossDockService manages cross-docking operations
type CrossDockService struct {
	repo CrossDockRepository
}

// NewCrossDockService creates cross-docking service
func NewCrossDockService(repo CrossDockRepository) *CrossDockService {
	return &CrossDockService{repo: repo}
}

// CreateCrossDockOrder creates new cross-dock order
func (s *CrossDockService) CreateCrossDockOrder(ctx context.Context, warehouseID, createdBy string, dockType CrossDockType, inbound []InboundShipment, outbound []OutboundShipment, scheduledStart, scheduledEnd time.Time, priority int, notes string) (*CrossDockOrder, error) {
	// Validate shipments
	if len(inbound) == 0 {
		return nil, errors.New("no inbound shipments")
	}
	if len(outbound) == 0 {
		return nil, errors.New("no outbound shipments")
	}

	// Assign IDs
	for i := range inbound {
		inbound[i].ID = generateID()
		inbound[i].Status = "pending"
	}
	for i := range outbound {
		outbound[i].ID = generateID()
		outbound[i].Status = "pending"
	}

	order := &CrossDockOrder{
		ID:               generateID(),
		Type:             dockType,
		Status:           CrossDockStatusScheduled,
		WarehouseID:      warehouseID,
		InboundShipments: inbound,
		OutboundShipments: outbound,
		ScheduledStart:   scheduledStart,
		ScheduledEnd:     scheduledEnd,
		Priority:         priority,
		Notes:            notes,
		CreatedBy:        createdBy,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// Find available dock
	dock, err := s.repo.GetAvailableDock(ctx, warehouseID, "both", scheduledStart, scheduledEnd)
	if err == nil && dock != nil {
		order.DockID = dock.ID
	}

	if err := s.repo.CreateCrossDockOrder(ctx, order); err != nil {
		return nil, err
	}

	return order, nil
}

// StartReceiving starts receiving phase
func (s *CrossDockService) StartReceiving(ctx context.Context, orderID string) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status != CrossDockStatusScheduled {
		return ErrInvalidDockState
	}

	now := time.Now()
	order.Status = CrossDockStatusReceiving
	order.ActualStart = &now
	order.UpdatedAt = now

	// Reserve dock
	if order.DockID != "" {
		dock, err := s.repo.GetDock(ctx, order.DockID)
		if err == nil {
			dock.Status = "occupied"
			dock.CurrentOrderID = order.ID
			s.repo.UpdateDock(ctx, dock)
		}
	}

	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// ReceiveInboundShipment marks inbound shipment as arrived
func (s *CrossDockService) ReceiveInboundShipment(ctx context.Context, orderID, shipmentID, dockDoor string, receivedItems map[string]int) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status != CrossDockStatusReceiving {
		return ErrInvalidDockState
	}

	now := time.Now()
	found := false

	for i := range order.InboundShipments {
		if order.InboundShipments[i].ID == shipmentID {
			order.InboundShipments[i].Status = "arrived"
			order.InboundShipments[i].ActualArrival = &now
			order.InboundShipments[i].DockDoor = dockDoor

			// Update received quantities
			for j := range order.InboundShipments[i].Items {
				item := &order.InboundShipments[i].Items[j]
				if qty, ok := receivedItems[item.ProductID]; ok {
					item.ReceivedQty = qty
				}
			}

			found = true
			break
		}
	}

	if !found {
		return errors.New("shipment not found")
	}

	order.UpdatedAt = now
	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// UnloadInboundShipment marks shipment as unloaded to staging
func (s *CrossDockService) UnloadInboundShipment(ctx context.Context, orderID, shipmentID, stagingLocation string) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	for i := range order.InboundShipments {
		if order.InboundShipments[i].ID == shipmentID {
			order.InboundShipments[i].Status = "unloaded"

			// Update item locations
			for j := range order.InboundShipments[i].Items {
				order.InboundShipments[i].Items[j].Location = stagingLocation
			}
			break
		}
	}

	order.UpdatedAt = time.Now()
	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// StartSorting starts sorting phase
func (s *CrossDockService) StartSorting(ctx context.Context, orderID string) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	// Check all inbound are unloaded
	for _, inbound := range order.InboundShipments {
		if inbound.Status != "unloaded" && inbound.Status != "sorted" {
			return errors.New("not all inbound shipments are unloaded")
		}
	}

	order.Status = CrossDockStatusSorting
	order.UpdatedAt = time.Now()

	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// SortToOutbound assigns items to outbound shipments
func (s *CrossDockService) SortToOutbound(ctx context.Context, orderID string, assignments map[string]map[string]int) error {
	// assignments: outboundShipmentID -> productID -> quantity
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status != CrossDockStatusSorting {
		return ErrInvalidDockState
	}

	for i := range order.OutboundShipments {
		shipmentAssignments := assignments[order.OutboundShipments[i].ID]
		if shipmentAssignments == nil {
			continue
		}

		for j := range order.OutboundShipments[i].Items {
			item := &order.OutboundShipments[i].Items[j]
			if qty, ok := shipmentAssignments[item.ProductID]; ok {
				item.LoadedQty = qty
			}
		}
	}

	// Mark inbound as sorted
	for i := range order.InboundShipments {
		order.InboundShipments[i].Status = "sorted"
	}

	order.UpdatedAt = time.Now()
	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// StartLoading starts loading phase
func (s *CrossDockService) StartLoading(ctx context.Context, orderID string) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status != CrossDockStatusSorting {
		return ErrInvalidDockState
	}

	order.Status = CrossDockStatusLoading
	order.UpdatedAt = time.Now()

	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// LoadOutboundShipment marks outbound shipment as loaded
func (s *CrossDockService) LoadOutboundShipment(ctx context.Context, orderID, shipmentID, dockDoor string) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	for i := range order.OutboundShipments {
		if order.OutboundShipments[i].ID == shipmentID {
			order.OutboundShipments[i].Status = "loaded"
			order.OutboundShipments[i].DockDoor = dockDoor
			break
		}
	}

	order.UpdatedAt = time.Now()
	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// DepartOutboundShipment marks outbound shipment as departed
func (s *CrossDockService) DepartOutboundShipment(ctx context.Context, orderID, shipmentID, trackingNumber string) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	now := time.Now()

	for i := range order.OutboundShipments {
		if order.OutboundShipments[i].ID == shipmentID {
			order.OutboundShipments[i].Status = "departed"
			order.OutboundShipments[i].ActualDeparture = &now
			if trackingNumber != "" {
				order.OutboundShipments[i].TrackingNumber = trackingNumber
			}
			break
		}
	}

	// Check if all outbound departed
	allDeparted := true
	for _, outbound := range order.OutboundShipments {
		if outbound.Status != "departed" {
			allDeparted = false
			break
		}
	}

	if allDeparted {
		order.Status = CrossDockStatusCompleted
		order.ActualEnd = &now

		// Release dock
		if order.DockID != "" {
			dock, err := s.repo.GetDock(ctx, order.DockID)
			if err == nil {
				dock.Status = "available"
				dock.CurrentOrderID = ""
				s.repo.UpdateDock(ctx, dock)
			}
		}
	}

	order.UpdatedAt = now
	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// CancelCrossDockOrder cancels order
func (s *CrossDockService) CancelCrossDockOrder(ctx context.Context, orderID, reason string) error {
	order, err := s.repo.GetCrossDockOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status == CrossDockStatusCompleted {
		return ErrInvalidDockState
	}

	order.Status = CrossDockStatusCancelled
	order.Notes = reason
	order.UpdatedAt = time.Now()

	// Release dock
	if order.DockID != "" {
		dock, err := s.repo.GetDock(ctx, order.DockID)
		if err == nil && dock.CurrentOrderID == order.ID {
			dock.Status = "available"
			dock.CurrentOrderID = ""
			s.repo.UpdateDock(ctx, dock)
		}
	}

	return s.repo.UpdateCrossDockOrder(ctx, order)
}

// GetCrossDockOrder returns order by ID
func (s *CrossDockService) GetCrossDockOrder(ctx context.Context, id string) (*CrossDockOrder, error) {
	return s.repo.GetCrossDockOrder(ctx, id)
}

// ListCrossDockOrders returns list of orders
func (s *CrossDockService) ListCrossDockOrders(ctx context.Context, status CrossDockStatus, warehouseID string, from, to time.Time, limit int) ([]*CrossDockOrder, error) {
	return s.repo.ListCrossDockOrders(ctx, status, warehouseID, from, to, limit)
}

// GetDailySchedule returns daily schedule
func (s *CrossDockService) GetDailySchedule(ctx context.Context, warehouseID string, date time.Time) (*CrossDockSchedule, error) {
	return s.repo.GetDailySchedule(ctx, warehouseID, date)
}

// CreateDock creates new dock
func (s *CrossDockService) CreateDock(ctx context.Context, dock *Dock) error {
	dock.ID = generateID()
	dock.Status = "available"
	dock.CreatedAt = time.Now()
	return s.repo.CreateDock(ctx, dock)
}

// ListDocks returns list of docks
func (s *CrossDockService) ListDocks(ctx context.Context, warehouseID string) ([]*Dock, error) {
	return s.repo.ListDocks(ctx, warehouseID)
}

// CreateStagingArea creates new staging area
func (s *CrossDockService) CreateStagingArea(ctx context.Context, area *StagingArea) error {
	area.ID = generateID()
	area.CreatedAt = time.Now()
	return s.repo.CreateStagingArea(ctx, area)
}

// ListStagingAreas returns list of staging areas
func (s *CrossDockService) ListStagingAreas(ctx context.Context, warehouseID string) ([]*StagingArea, error) {
	return s.repo.ListStagingAreas(ctx, warehouseID)
}

// ValidateCrossDockPlan validates if items balance (inbound = outbound)
func (s *CrossDockService) ValidateCrossDockPlan(inbound []InboundShipment, outbound []OutboundShipment) error {
	// Sum inbound items
	inboundTotals := make(map[string]int)
	for _, ship := range inbound {
		for _, item := range ship.Items {
			inboundTotals[item.ProductID] += item.Quantity
		}
	}

	// Sum outbound items
	outboundTotals := make(map[string]int)
	for _, ship := range outbound {
		for _, item := range ship.Items {
			outboundTotals[item.ProductID] += item.Quantity
		}
	}

	// Validate
	for productID, inQty := range inboundTotals {
		outQty := outboundTotals[productID]
		if outQty > inQty {
			return errors.New("outbound exceeds inbound for product: " + productID)
		}
	}

	return nil
}
