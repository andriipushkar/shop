package warehouse

import (
	"context"
	"errors"
	"time"
)

// Kitting errors
var (
	ErrKitNotFound           = errors.New("kit not found")
	ErrInsufficientComponents = errors.New("insufficient components for assembly")
	ErrKitAlreadyAssembled   = errors.New("kit already assembled")
	ErrCannotDisassemble     = errors.New("cannot disassemble kit")
)

// KitType represents type of kit
type KitType string

const (
	KitTypeBundle    KitType = "bundle"    // Fixed bundle (gift set)
	KitTypeAssembly  KitType = "assembly"  // Assembled product
	KitTypeConfigurable KitType = "configurable" // Customer configures
)

// Kit represents a kit/bundle definition
type Kit struct {
	ID            string        `json:"id"`
	SKU           string        `json:"sku"`
	Name          string        `json:"name"`
	Description   string        `json:"description,omitempty"`
	Type          KitType       `json:"type"`
	Components    []KitComponent `json:"components"`
	Price         float64       `json:"price"`       // Kit price (may differ from sum of components)
	ComponentCost float64       `json:"component_cost"` // Sum of component costs
	AssemblyTime  int           `json:"assembly_time_minutes,omitempty"`
	Instructions  string        `json:"instructions,omitempty"`
	ImageURL      string        `json:"image_url,omitempty"`
	IsActive      bool          `json:"is_active"`
	AssembleOnDemand bool       `json:"assemble_on_demand"` // Build when ordered vs pre-assemble
	MinQuantity   int           `json:"min_quantity,omitempty"` // Min assembly batch
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// KitComponent represents component in kit
type KitComponent struct {
	ProductID    string  `json:"product_id"`
	SKU          string  `json:"sku"`
	Name         string  `json:"name"`
	Quantity     int     `json:"quantity"`
	UnitCost     float64 `json:"unit_cost"`
	IsRequired   bool    `json:"is_required"`   // vs optional
	IsSubstitutable bool `json:"is_substitutable"` // Can use alternative
	Substitutes  []string `json:"substitutes,omitempty"` // Alternative product IDs
	Notes        string  `json:"notes,omitempty"`
}

// KitStock represents assembled kit stock
type KitStock struct {
	ID          string    `json:"id"`
	KitID       string    `json:"kit_id"`
	WarehouseID string    `json:"warehouse_id"`
	Quantity    int       `json:"quantity"`
	Reserved    int       `json:"reserved"`
	Available   int       `json:"available"`
	Location    string    `json:"location,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AssemblyOrder represents order to assemble kits
type AssemblyOrder struct {
	ID             string           `json:"id"`
	KitID          string           `json:"kit_id"`
	KitName        string           `json:"kit_name"`
	WarehouseID    string           `json:"warehouse_id"`
	Quantity       int              `json:"quantity"`
	Status         string           `json:"status"` // pending, in_progress, completed, cancelled
	Priority       int              `json:"priority"`
	ComponentsUsed []ComponentUsage `json:"components_used,omitempty"`
	AssignedTo     string           `json:"assigned_to,omitempty"`
	StartedAt      *time.Time       `json:"started_at,omitempty"`
	CompletedAt    *time.Time       `json:"completed_at,omitempty"`
	Notes          string           `json:"notes,omitempty"`
	CreatedBy      string           `json:"created_by"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

// ComponentUsage tracks components used in assembly
type ComponentUsage struct {
	ProductID    string `json:"product_id"`
	SKU          string `json:"sku"`
	Required     int    `json:"required"`
	Used         int    `json:"used"`
	Substituted  bool   `json:"substituted"`
	SubstituteID string `json:"substitute_id,omitempty"`
}

// DisassemblyOrder represents order to disassemble kits
type DisassemblyOrder struct {
	ID                string             `json:"id"`
	KitID             string             `json:"kit_id"`
	KitName           string             `json:"kit_name"`
	WarehouseID       string             `json:"warehouse_id"`
	Quantity          int                `json:"quantity"`
	Status            string             `json:"status"`
	ComponentsRecovered []ComponentUsage `json:"components_recovered,omitempty"`
	Reason            string             `json:"reason"`
	AssignedTo        string             `json:"assigned_to,omitempty"`
	CompletedAt       *time.Time         `json:"completed_at,omitempty"`
	CreatedBy         string             `json:"created_by"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
}

// KitAvailability represents kit availability info
type KitAvailability struct {
	KitID         string              `json:"kit_id"`
	WarehouseID   string              `json:"warehouse_id"`
	PreAssembled  int                 `json:"pre_assembled"`  // Ready kits
	CanAssemble   int                 `json:"can_assemble"`   // Based on components
	TotalAvailable int                `json:"total_available"`
	Components    []ComponentAvailability `json:"components"`
	Bottleneck    *ComponentAvailability  `json:"bottleneck,omitempty"` // Limiting component
}

// ComponentAvailability represents component availability for kit
type ComponentAvailability struct {
	ProductID   string `json:"product_id"`
	SKU         string `json:"sku"`
	Name        string `json:"name"`
	Required    int    `json:"required"`    // Per kit
	Available   int    `json:"available"`   // In warehouse
	CanMake     int    `json:"can_make"`    // Kits this component can make
	IsBottleneck bool  `json:"is_bottleneck"`
}

// KittingRepository defines kitting data access
type KittingRepository interface {
	// Kits
	CreateKit(ctx context.Context, kit *Kit) error
	UpdateKit(ctx context.Context, kit *Kit) error
	GetKit(ctx context.Context, id string) (*Kit, error)
	GetKitBySKU(ctx context.Context, sku string) (*Kit, error)
	ListKits(ctx context.Context, activeOnly bool, limit, offset int) ([]*Kit, error)
	DeleteKit(ctx context.Context, id string) error

	// Kit Stock
	GetKitStock(ctx context.Context, kitID, warehouseID string) (*KitStock, error)
	UpdateKitStock(ctx context.Context, stock *KitStock) error

	// Assembly Orders
	CreateAssemblyOrder(ctx context.Context, order *AssemblyOrder) error
	UpdateAssemblyOrder(ctx context.Context, order *AssemblyOrder) error
	GetAssemblyOrder(ctx context.Context, id string) (*AssemblyOrder, error)
	ListAssemblyOrders(ctx context.Context, status string, warehouseID string, limit int) ([]*AssemblyOrder, error)

	// Disassembly Orders
	CreateDisassemblyOrder(ctx context.Context, order *DisassemblyOrder) error
	UpdateDisassemblyOrder(ctx context.Context, order *DisassemblyOrder) error
	GetDisassemblyOrder(ctx context.Context, id string) (*DisassemblyOrder, error)
	ListDisassemblyOrders(ctx context.Context, status string, limit int) ([]*DisassemblyOrder, error)
}

// KittingService manages kit assembly and disassembly
type KittingService struct {
	repo          KittingRepository
	warehouseRepo WarehouseRepository
}

// NewKittingService creates kitting service
func NewKittingService(repo KittingRepository, warehouseRepo WarehouseRepository) *KittingService {
	return &KittingService{
		repo:          repo,
		warehouseRepo: warehouseRepo,
	}
}

// CreateKit creates new kit definition
func (s *KittingService) CreateKit(ctx context.Context, kit *Kit) error {
	kit.ID = generateID()
	kit.CreatedAt = time.Now()
	kit.UpdatedAt = time.Now()

	// Calculate component cost
	var componentCost float64
	for _, c := range kit.Components {
		componentCost += c.UnitCost * float64(c.Quantity)
	}
	kit.ComponentCost = componentCost

	return s.repo.CreateKit(ctx, kit)
}

// UpdateKit updates kit definition
func (s *KittingService) UpdateKit(ctx context.Context, kit *Kit) error {
	// Recalculate component cost
	var componentCost float64
	for _, c := range kit.Components {
		componentCost += c.UnitCost * float64(c.Quantity)
	}
	kit.ComponentCost = componentCost
	kit.UpdatedAt = time.Now()

	return s.repo.UpdateKit(ctx, kit)
}

// GetKit returns kit by ID
func (s *KittingService) GetKit(ctx context.Context, id string) (*Kit, error) {
	return s.repo.GetKit(ctx, id)
}

// ListKits returns list of kits
func (s *KittingService) ListKits(ctx context.Context, activeOnly bool, limit, offset int) ([]*Kit, error) {
	return s.repo.ListKits(ctx, activeOnly, limit, offset)
}

// GetKitAvailability returns kit availability information
func (s *KittingService) GetKitAvailability(ctx context.Context, kitID, warehouseID string) (*KitAvailability, error) {
	kit, err := s.repo.GetKit(ctx, kitID)
	if err != nil {
		return nil, err
	}

	// Get pre-assembled stock
	kitStock, _ := s.repo.GetKitStock(ctx, kitID, warehouseID)
	preAssembled := 0
	if kitStock != nil {
		preAssembled = kitStock.Available
	}

	// Calculate component availability
	components := make([]ComponentAvailability, 0, len(kit.Components))
	minCanMake := -1

	for _, comp := range kit.Components {
		stock, err := s.warehouseRepo.GetStock(ctx, warehouseID, comp.ProductID)
		available := 0
		if err == nil {
			available = stock.Available
		}

		canMake := 0
		if comp.Quantity > 0 {
			canMake = available / comp.Quantity
		}

		compAvail := ComponentAvailability{
			ProductID: comp.ProductID,
			SKU:       comp.SKU,
			Name:      comp.Name,
			Required:  comp.Quantity,
			Available: available,
			CanMake:   canMake,
		}

		if comp.IsRequired {
			if minCanMake == -1 || canMake < minCanMake {
				minCanMake = canMake
			}
		}

		components = append(components, compAvail)
	}

	if minCanMake < 0 {
		minCanMake = 0
	}

	// Mark bottleneck
	var bottleneck *ComponentAvailability
	for i := range components {
		if components[i].CanMake == minCanMake && components[i].Required > 0 {
			components[i].IsBottleneck = true
			if bottleneck == nil {
				bottleneck = &components[i]
			}
		}
	}

	return &KitAvailability{
		KitID:          kitID,
		WarehouseID:    warehouseID,
		PreAssembled:   preAssembled,
		CanAssemble:    minCanMake,
		TotalAvailable: preAssembled + minCanMake,
		Components:     components,
		Bottleneck:     bottleneck,
	}, nil
}

// CreateAssemblyOrder creates order to assemble kits
func (s *KittingService) CreateAssemblyOrder(ctx context.Context, kitID, warehouseID, createdBy string, quantity int, priority int) (*AssemblyOrder, error) {
	kit, err := s.repo.GetKit(ctx, kitID)
	if err != nil {
		return nil, ErrKitNotFound
	}

	// Check component availability
	availability, err := s.GetKitAvailability(ctx, kitID, warehouseID)
	if err != nil {
		return nil, err
	}

	if availability.CanAssemble < quantity {
		return nil, ErrInsufficientComponents
	}

	order := &AssemblyOrder{
		ID:          generateID(),
		KitID:       kitID,
		KitName:     kit.Name,
		WarehouseID: warehouseID,
		Quantity:    quantity,
		Status:      "pending",
		Priority:    priority,
		CreatedBy:   createdBy,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateAssemblyOrder(ctx, order); err != nil {
		return nil, err
	}

	return order, nil
}

// StartAssembly starts assembly order
func (s *KittingService) StartAssembly(ctx context.Context, orderID, assignedTo string) error {
	order, err := s.repo.GetAssemblyOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status != "pending" {
		return errors.New("order is not pending")
	}

	now := time.Now()
	order.Status = "in_progress"
	order.AssignedTo = assignedTo
	order.StartedAt = &now
	order.UpdatedAt = now

	return s.repo.UpdateAssemblyOrder(ctx, order)
}

// CompleteAssembly completes assembly and updates stock
func (s *KittingService) CompleteAssembly(ctx context.Context, orderID string, componentsUsed []ComponentUsage) error {
	order, err := s.repo.GetAssemblyOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status != "in_progress" {
		return errors.New("order is not in progress")
	}

	kit, err := s.repo.GetKit(ctx, order.KitID)
	if err != nil {
		return err
	}

	// Deduct components from stock
	for _, comp := range kit.Components {
		productID := comp.ProductID
		qty := comp.Quantity * order.Quantity

		// Check if substituted
		for _, used := range componentsUsed {
			if used.ProductID == comp.ProductID && used.Substituted {
				productID = used.SubstituteID
				break
			}
		}

		// Deduct from warehouse stock
		stock, err := s.warehouseRepo.GetStock(ctx, order.WarehouseID, productID)
		if err != nil {
			return ErrInsufficientComponents
		}

		if stock.Available < qty {
			return ErrInsufficientComponents
		}

		stock.Quantity -= qty
		stock.Available = stock.Quantity - stock.Reserved
		stock.UpdatedAt = time.Now()

		if err := s.warehouseRepo.UpdateStock(ctx, stock); err != nil {
			return err
		}

		// Record movement
		movement := &StockMovement{
			ID:              generateID(),
			Type:            "adjustment",
			WarehouseFromID: order.WarehouseID,
			ProductID:       productID,
			SKU:             comp.SKU,
			Quantity:        qty,
			Reason:          "kit_assembly",
			Notes:           "Used for kit: " + kit.Name,
			CreatedAt:       time.Now(),
		}
		s.warehouseRepo.CreateMovement(ctx, movement)
	}

	// Add assembled kits to stock
	kitStock, err := s.repo.GetKitStock(ctx, order.KitID, order.WarehouseID)
	if err != nil {
		kitStock = &KitStock{
			ID:          generateID(),
			KitID:       order.KitID,
			WarehouseID: order.WarehouseID,
			Quantity:    0,
			Reserved:    0,
			Available:   0,
			UpdatedAt:   time.Now(),
		}
	}

	kitStock.Quantity += order.Quantity
	kitStock.Available = kitStock.Quantity - kitStock.Reserved
	kitStock.UpdatedAt = time.Now()

	if err := s.repo.UpdateKitStock(ctx, kitStock); err != nil {
		return err
	}

	// Update order
	now := time.Now()
	order.Status = "completed"
	order.CompletedAt = &now
	order.ComponentsUsed = componentsUsed
	order.UpdatedAt = now

	return s.repo.UpdateAssemblyOrder(ctx, order)
}

// CancelAssembly cancels assembly order
func (s *KittingService) CancelAssembly(ctx context.Context, orderID, reason string) error {
	order, err := s.repo.GetAssemblyOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status == "completed" {
		return errors.New("cannot cancel completed order")
	}

	order.Status = "cancelled"
	order.Notes = reason
	order.UpdatedAt = time.Now()

	return s.repo.UpdateAssemblyOrder(ctx, order)
}

// CreateDisassemblyOrder creates order to disassemble kits
func (s *KittingService) CreateDisassemblyOrder(ctx context.Context, kitID, warehouseID, createdBy, reason string, quantity int) (*DisassemblyOrder, error) {
	kit, err := s.repo.GetKit(ctx, kitID)
	if err != nil {
		return nil, ErrKitNotFound
	}

	// Check kit stock
	kitStock, err := s.repo.GetKitStock(ctx, kitID, warehouseID)
	if err != nil || kitStock.Available < quantity {
		return nil, ErrCannotDisassemble
	}

	order := &DisassemblyOrder{
		ID:          generateID(),
		KitID:       kitID,
		KitName:     kit.Name,
		WarehouseID: warehouseID,
		Quantity:    quantity,
		Status:      "pending",
		Reason:      reason,
		CreatedBy:   createdBy,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateDisassemblyOrder(ctx, order); err != nil {
		return nil, err
	}

	return order, nil
}

// CompleteDisassembly completes disassembly and returns components
func (s *KittingService) CompleteDisassembly(ctx context.Context, orderID string, componentsRecovered []ComponentUsage) error {
	order, err := s.repo.GetDisassemblyOrder(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status == "completed" {
		return errors.New("order already completed")
	}

	kit, err := s.repo.GetKit(ctx, order.KitID)
	if err != nil {
		return err
	}

	// Deduct kits from stock
	kitStock, err := s.repo.GetKitStock(ctx, order.KitID, order.WarehouseID)
	if err != nil {
		return err
	}

	if kitStock.Available < order.Quantity {
		return ErrCannotDisassemble
	}

	kitStock.Quantity -= order.Quantity
	kitStock.Available = kitStock.Quantity - kitStock.Reserved
	kitStock.UpdatedAt = time.Now()

	if err := s.repo.UpdateKitStock(ctx, kitStock); err != nil {
		return err
	}

	// Return components to stock
	for _, comp := range kit.Components {
		recovered := comp.Quantity * order.Quantity

		// Check if different amount recovered
		for _, rec := range componentsRecovered {
			if rec.ProductID == comp.ProductID {
				recovered = rec.Used
				break
			}
		}

		if recovered <= 0 {
			continue
		}

		// Add to warehouse stock
		stock, err := s.warehouseRepo.GetStock(ctx, order.WarehouseID, comp.ProductID)
		if err != nil {
			stock = &Stock{
				ID:          generateID(),
				WarehouseID: order.WarehouseID,
				ProductID:   comp.ProductID,
				SKU:         comp.SKU,
				Quantity:    0,
				Reserved:    0,
				Available:   0,
				UpdatedAt:   time.Now(),
			}
		}

		stock.Quantity += recovered
		stock.Available = stock.Quantity - stock.Reserved
		stock.UpdatedAt = time.Now()

		if err := s.warehouseRepo.UpdateStock(ctx, stock); err != nil {
			continue
		}

		// Record movement
		movement := &StockMovement{
			ID:            generateID(),
			Type:          "adjustment",
			WarehouseToID: order.WarehouseID,
			ProductID:     comp.ProductID,
			SKU:           comp.SKU,
			Quantity:      recovered,
			Reason:        "kit_disassembly",
			Notes:         "Recovered from kit: " + kit.Name,
			CreatedAt:     time.Now(),
		}
		s.warehouseRepo.CreateMovement(ctx, movement)
	}

	// Update order
	now := time.Now()
	order.Status = "completed"
	order.CompletedAt = &now
	order.ComponentsRecovered = componentsRecovered
	order.UpdatedAt = now

	return s.repo.UpdateDisassemblyOrder(ctx, order)
}

// ListAssemblyOrders returns list of assembly orders
func (s *KittingService) ListAssemblyOrders(ctx context.Context, status string, warehouseID string, limit int) ([]*AssemblyOrder, error) {
	return s.repo.ListAssemblyOrders(ctx, status, warehouseID, limit)
}

// ListDisassemblyOrders returns list of disassembly orders
func (s *KittingService) ListDisassemblyOrders(ctx context.Context, status string, limit int) ([]*DisassemblyOrder, error) {
	return s.repo.ListDisassemblyOrders(ctx, status, limit)
}

// ReserveKit reserves assembled kit for order
func (s *KittingService) ReserveKit(ctx context.Context, kitID, warehouseID, orderID string, quantity int) error {
	kitStock, err := s.repo.GetKitStock(ctx, kitID, warehouseID)
	if err != nil {
		return ErrKitNotFound
	}

	if kitStock.Available < quantity {
		return ErrInsufficientStock
	}

	kitStock.Reserved += quantity
	kitStock.Available = kitStock.Quantity - kitStock.Reserved
	kitStock.UpdatedAt = time.Now()

	return s.repo.UpdateKitStock(ctx, kitStock)
}

// ShipKit deducts reserved kit for shipping
func (s *KittingService) ShipKit(ctx context.Context, kitID, warehouseID string, quantity int) error {
	kitStock, err := s.repo.GetKitStock(ctx, kitID, warehouseID)
	if err != nil {
		return ErrKitNotFound
	}

	if kitStock.Reserved < quantity {
		return errors.New("not enough reserved stock")
	}

	kitStock.Quantity -= quantity
	kitStock.Reserved -= quantity
	kitStock.Available = kitStock.Quantity - kitStock.Reserved
	kitStock.UpdatedAt = time.Now()

	return s.repo.UpdateKitStock(ctx, kitStock)
}
