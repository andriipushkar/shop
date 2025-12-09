package warehouse

import (
	"context"
	"errors"
	"time"
)

// Common errors
var (
	ErrWarehouseNotFound  = errors.New("warehouse not found")
	ErrInsufficientStock  = errors.New("insufficient stock")
	ErrInvalidQuantity    = errors.New("invalid quantity")
	ErrProductNotFound    = errors.New("product not found")
	ErrStockReserved      = errors.New("stock is reserved")
	ErrInvalidTransfer    = errors.New("invalid transfer")
)

// Warehouse represents a warehouse/store location
type Warehouse struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // main, store, dropship, supplier
	Address     *Address  `json:"address,omitempty"`
	Phone       string    `json:"phone,omitempty"`
	Email       string    `json:"email,omitempty"`
	Manager     string    `json:"manager,omitempty"`
	Priority    int       `json:"priority"` // for stock allocation
	IsActive    bool      `json:"is_active"`
	IsDefault   bool      `json:"is_default"`
	AcceptsOrders bool    `json:"accepts_orders"` // can fulfill orders
	ExternalID  string    `json:"external_id,omitempty"` // for ERP sync
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Address represents warehouse address
type Address struct {
	Country    string  `json:"country"`
	Region     string  `json:"region"`
	City       string  `json:"city"`
	Street     string  `json:"street"`
	Building   string  `json:"building"`
	PostalCode string  `json:"postal_code"`
	Latitude   float64 `json:"latitude,omitempty"`
	Longitude  float64 `json:"longitude,omitempty"`
}

// Stock represents product stock in warehouse
type Stock struct {
	ID          string    `json:"id"`
	WarehouseID string    `json:"warehouse_id"`
	ProductID   string    `json:"product_id"`
	SKU         string    `json:"sku"`
	Quantity    int       `json:"quantity"`
	Reserved    int       `json:"reserved"`
	Available   int       `json:"available"`
	MinStock    int       `json:"min_stock"`
	MaxStock    int       `json:"max_stock,omitempty"`
	ReorderPoint int      `json:"reorder_point,omitempty"`
	Location    string    `json:"location,omitempty"` // shelf/bin location
	BatchNumber string    `json:"batch_number,omitempty"`
	ExpiryDate  *time.Time `json:"expiry_date,omitempty"`
	CostPrice   float64   `json:"cost_price,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// StockMovement represents stock movement record
type StockMovement struct {
	ID              string    `json:"id"`
	Type            string    `json:"type"` // receipt, shipment, transfer, adjustment, return
	WarehouseFromID string    `json:"warehouse_from_id,omitempty"`
	WarehouseToID   string    `json:"warehouse_to_id,omitempty"`
	ProductID       string    `json:"product_id"`
	SKU             string    `json:"sku"`
	Quantity        int       `json:"quantity"`
	DocumentType    string    `json:"document_type,omitempty"` // order, purchase, transfer, adjustment
	DocumentID      string    `json:"document_id,omitempty"`
	Reason          string    `json:"reason,omitempty"`
	Notes           string    `json:"notes,omitempty"`
	UserID          string    `json:"user_id,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// StockReservation represents stock reservation for order
type StockReservation struct {
	ID          string    `json:"id"`
	OrderID     string    `json:"order_id"`
	WarehouseID string    `json:"warehouse_id"`
	ProductID   string    `json:"product_id"`
	Quantity    int       `json:"quantity"`
	Status      string    `json:"status"` // active, fulfilled, cancelled, expired
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
}

// TransferRequest represents stock transfer request
type TransferRequest struct {
	ID            string    `json:"id"`
	FromWarehouse string    `json:"from_warehouse"`
	ToWarehouse   string    `json:"to_warehouse"`
	Status        string    `json:"status"` // draft, pending, in_transit, completed, cancelled
	Items         []TransferItem `json:"items"`
	Notes         string    `json:"notes,omitempty"`
	RequestedBy   string    `json:"requested_by,omitempty"`
	ApprovedBy    string    `json:"approved_by,omitempty"`
	ShippedAt     *time.Time `json:"shipped_at,omitempty"`
	ReceivedAt    *time.Time `json:"received_at,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TransferItem represents item in transfer
type TransferItem struct {
	ProductID        string `json:"product_id"`
	SKU              string `json:"sku"`
	RequestedQty     int    `json:"requested_qty"`
	ShippedQty       int    `json:"shipped_qty,omitempty"`
	ReceivedQty      int    `json:"received_qty,omitempty"`
	DamagedQty       int    `json:"damaged_qty,omitempty"`
}

// AllocationResult represents stock allocation result
type AllocationResult struct {
	ProductID   string `json:"product_id"`
	WarehouseID string `json:"warehouse_id"`
	Quantity    int    `json:"quantity"`
	Available   bool   `json:"available"`
}

// WarehouseRepository defines data access interface
type WarehouseRepository interface {
	// Warehouses
	CreateWarehouse(ctx context.Context, w *Warehouse) error
	UpdateWarehouse(ctx context.Context, w *Warehouse) error
	DeleteWarehouse(ctx context.Context, id string) error
	GetWarehouse(ctx context.Context, id string) (*Warehouse, error)
	GetWarehouseByCode(ctx context.Context, code string) (*Warehouse, error)
	ListWarehouses(ctx context.Context, activeOnly bool) ([]*Warehouse, error)
	GetDefaultWarehouse(ctx context.Context) (*Warehouse, error)

	// Stock
	GetStock(ctx context.Context, warehouseID, productID string) (*Stock, error)
	GetStockByProduct(ctx context.Context, productID string) ([]*Stock, error)
	GetStockByWarehouse(ctx context.Context, warehouseID string, limit, offset int) ([]*Stock, error)
	UpdateStock(ctx context.Context, stock *Stock) error
	GetLowStock(ctx context.Context, warehouseID string) ([]*Stock, error)
	GetTotalStock(ctx context.Context, productID string) (int, error)

	// Movements
	CreateMovement(ctx context.Context, m *StockMovement) error
	ListMovements(ctx context.Context, warehouseID string, from, to time.Time, limit int) ([]*StockMovement, error)

	// Reservations
	CreateReservation(ctx context.Context, r *StockReservation) error
	GetReservation(ctx context.Context, id string) (*StockReservation, error)
	GetReservationsByOrder(ctx context.Context, orderID string) ([]*StockReservation, error)
	UpdateReservation(ctx context.Context, r *StockReservation) error
	DeleteExpiredReservations(ctx context.Context) error

	// Transfers
	CreateTransfer(ctx context.Context, t *TransferRequest) error
	UpdateTransfer(ctx context.Context, t *TransferRequest) error
	GetTransfer(ctx context.Context, id string) (*TransferRequest, error)
	ListTransfers(ctx context.Context, status string, limit int) ([]*TransferRequest, error)
}

// WarehouseService manages multi-warehouse operations
type WarehouseService struct {
	repo WarehouseRepository
}

// NewWarehouseService creates warehouse service
func NewWarehouseService(repo WarehouseRepository) *WarehouseService {
	return &WarehouseService{repo: repo}
}

// CreateWarehouse creates new warehouse
func (s *WarehouseService) CreateWarehouse(ctx context.Context, w *Warehouse) error {
	w.CreatedAt = time.Now()
	w.UpdatedAt = time.Now()
	return s.repo.CreateWarehouse(ctx, w)
}

// UpdateWarehouse updates warehouse
func (s *WarehouseService) UpdateWarehouse(ctx context.Context, w *Warehouse) error {
	w.UpdatedAt = time.Now()
	return s.repo.UpdateWarehouse(ctx, w)
}

// DeleteWarehouse deletes warehouse (soft delete if has stock)
func (s *WarehouseService) DeleteWarehouse(ctx context.Context, id string) error {
	return s.repo.DeleteWarehouse(ctx, id)
}

// GetWarehouse returns warehouse by ID
func (s *WarehouseService) GetWarehouse(ctx context.Context, id string) (*Warehouse, error) {
	return s.repo.GetWarehouse(ctx, id)
}

// ListWarehouses returns all warehouses
func (s *WarehouseService) ListWarehouses(ctx context.Context, activeOnly bool) ([]*Warehouse, error) {
	return s.repo.ListWarehouses(ctx, activeOnly)
}

// GetStock returns stock for product in warehouse
func (s *WarehouseService) GetStock(ctx context.Context, warehouseID, productID string) (*Stock, error) {
	return s.repo.GetStock(ctx, warehouseID, productID)
}

// GetProductStock returns stock for product across all warehouses
func (s *WarehouseService) GetProductStock(ctx context.Context, productID string) ([]*Stock, error) {
	return s.repo.GetStockByProduct(ctx, productID)
}

// GetTotalAvailable returns total available quantity across all warehouses
func (s *WarehouseService) GetTotalAvailable(ctx context.Context, productID string) (int, error) {
	stocks, err := s.repo.GetStockByProduct(ctx, productID)
	if err != nil {
		return 0, err
	}

	total := 0
	for _, stock := range stocks {
		total += stock.Available
	}
	return total, nil
}

// ReceiveStock receives stock into warehouse
func (s *WarehouseService) ReceiveStock(ctx context.Context, warehouseID, productID, sku string, quantity int, documentType, documentID, notes string) error {
	if quantity <= 0 {
		return ErrInvalidQuantity
	}

	stock, err := s.repo.GetStock(ctx, warehouseID, productID)
	if err != nil {
		// Create new stock record
		stock = &Stock{
			ID:          generateID(),
			WarehouseID: warehouseID,
			ProductID:   productID,
			SKU:         sku,
			Quantity:    0,
			Reserved:    0,
			Available:   0,
			UpdatedAt:   time.Now(),
		}
	}

	stock.Quantity += quantity
	stock.Available = stock.Quantity - stock.Reserved
	stock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, stock); err != nil {
		return err
	}

	// Record movement
	movement := &StockMovement{
		ID:            generateID(),
		Type:          "receipt",
		WarehouseToID: warehouseID,
		ProductID:     productID,
		SKU:           sku,
		Quantity:      quantity,
		DocumentType:  documentType,
		DocumentID:    documentID,
		Notes:         notes,
		CreatedAt:     time.Now(),
	}

	return s.repo.CreateMovement(ctx, movement)
}

// ShipStock ships stock from warehouse
func (s *WarehouseService) ShipStock(ctx context.Context, warehouseID, productID, sku string, quantity int, documentType, documentID string) error {
	if quantity <= 0 {
		return ErrInvalidQuantity
	}

	stock, err := s.repo.GetStock(ctx, warehouseID, productID)
	if err != nil {
		return ErrProductNotFound
	}

	if stock.Available < quantity {
		return ErrInsufficientStock
	}

	stock.Quantity -= quantity
	stock.Available = stock.Quantity - stock.Reserved
	stock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, stock); err != nil {
		return err
	}

	// Record movement
	movement := &StockMovement{
		ID:              generateID(),
		Type:            "shipment",
		WarehouseFromID: warehouseID,
		ProductID:       productID,
		SKU:             sku,
		Quantity:        quantity,
		DocumentType:    documentType,
		DocumentID:      documentID,
		CreatedAt:       time.Now(),
	}

	return s.repo.CreateMovement(ctx, movement)
}

// ReserveStock reserves stock for order
func (s *WarehouseService) ReserveStock(ctx context.Context, orderID, warehouseID, productID string, quantity int, expiresAt time.Time) (*StockReservation, error) {
	if quantity <= 0 {
		return nil, ErrInvalidQuantity
	}

	stock, err := s.repo.GetStock(ctx, warehouseID, productID)
	if err != nil {
		return nil, ErrProductNotFound
	}

	if stock.Available < quantity {
		return nil, ErrInsufficientStock
	}

	// Update stock
	stock.Reserved += quantity
	stock.Available = stock.Quantity - stock.Reserved
	stock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, stock); err != nil {
		return nil, err
	}

	// Create reservation
	reservation := &StockReservation{
		ID:          generateID(),
		OrderID:     orderID,
		WarehouseID: warehouseID,
		ProductID:   productID,
		Quantity:    quantity,
		Status:      "active",
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateReservation(ctx, reservation); err != nil {
		return nil, err
	}

	return reservation, nil
}

// ReleaseReservation releases stock reservation
func (s *WarehouseService) ReleaseReservation(ctx context.Context, reservationID string) error {
	reservation, err := s.repo.GetReservation(ctx, reservationID)
	if err != nil {
		return err
	}

	if reservation.Status != "active" {
		return nil // Already released or fulfilled
	}

	stock, err := s.repo.GetStock(ctx, reservation.WarehouseID, reservation.ProductID)
	if err != nil {
		return err
	}

	stock.Reserved -= reservation.Quantity
	if stock.Reserved < 0 {
		stock.Reserved = 0
	}
	stock.Available = stock.Quantity - stock.Reserved
	stock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, stock); err != nil {
		return err
	}

	reservation.Status = "cancelled"
	return s.repo.UpdateReservation(ctx, reservation)
}

// FulfillReservation fulfills reservation (ships the stock)
func (s *WarehouseService) FulfillReservation(ctx context.Context, reservationID string) error {
	reservation, err := s.repo.GetReservation(ctx, reservationID)
	if err != nil {
		return err
	}

	if reservation.Status != "active" {
		return errors.New("reservation is not active")
	}

	stock, err := s.repo.GetStock(ctx, reservation.WarehouseID, reservation.ProductID)
	if err != nil {
		return err
	}

	// Remove from reserved and quantity
	stock.Reserved -= reservation.Quantity
	stock.Quantity -= reservation.Quantity
	if stock.Reserved < 0 {
		stock.Reserved = 0
	}
	stock.Available = stock.Quantity - stock.Reserved
	stock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, stock); err != nil {
		return err
	}

	reservation.Status = "fulfilled"
	return s.repo.UpdateReservation(ctx, reservation)
}

// TransferStock transfers stock between warehouses
func (s *WarehouseService) TransferStock(ctx context.Context, fromWarehouseID, toWarehouseID, productID, sku string, quantity int, notes string) error {
	if quantity <= 0 {
		return ErrInvalidQuantity
	}

	if fromWarehouseID == toWarehouseID {
		return ErrInvalidTransfer
	}

	// Check source stock
	fromStock, err := s.repo.GetStock(ctx, fromWarehouseID, productID)
	if err != nil {
		return ErrProductNotFound
	}

	if fromStock.Available < quantity {
		return ErrInsufficientStock
	}

	// Decrease source stock
	fromStock.Quantity -= quantity
	fromStock.Available = fromStock.Quantity - fromStock.Reserved
	fromStock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, fromStock); err != nil {
		return err
	}

	// Increase destination stock
	toStock, err := s.repo.GetStock(ctx, toWarehouseID, productID)
	if err != nil {
		toStock = &Stock{
			ID:          generateID(),
			WarehouseID: toWarehouseID,
			ProductID:   productID,
			SKU:         sku,
			Quantity:    0,
			Reserved:    0,
			Available:   0,
			UpdatedAt:   time.Now(),
		}
	}

	toStock.Quantity += quantity
	toStock.Available = toStock.Quantity - toStock.Reserved
	toStock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, toStock); err != nil {
		return err
	}

	// Record movement
	movement := &StockMovement{
		ID:              generateID(),
		Type:            "transfer",
		WarehouseFromID: fromWarehouseID,
		WarehouseToID:   toWarehouseID,
		ProductID:       productID,
		SKU:             sku,
		Quantity:        quantity,
		Notes:           notes,
		CreatedAt:       time.Now(),
	}

	return s.repo.CreateMovement(ctx, movement)
}

// AllocateStock finds best warehouse to fulfill order
func (s *WarehouseService) AllocateStock(ctx context.Context, productID string, quantity int) (*AllocationResult, error) {
	stocks, err := s.repo.GetStockByProduct(ctx, productID)
	if err != nil {
		return nil, err
	}

	// Get warehouses ordered by priority
	warehouses, err := s.repo.ListWarehouses(ctx, true)
	if err != nil {
		return nil, err
	}

	// Build priority map
	priorityMap := make(map[string]int)
	for _, w := range warehouses {
		if w.AcceptsOrders {
			priorityMap[w.ID] = w.Priority
		}
	}

	// Find best warehouse with sufficient stock
	var bestWarehouse string
	bestPriority := -1

	for _, stock := range stocks {
		if stock.Available >= quantity {
			priority, ok := priorityMap[stock.WarehouseID]
			if ok && (bestPriority == -1 || priority < bestPriority) {
				bestWarehouse = stock.WarehouseID
				bestPriority = priority
			}
		}
	}

	if bestWarehouse == "" {
		return &AllocationResult{
			ProductID: productID,
			Available: false,
		}, nil
	}

	return &AllocationResult{
		ProductID:   productID,
		WarehouseID: bestWarehouse,
		Quantity:    quantity,
		Available:   true,
	}, nil
}

// AdjustStock adjusts stock quantity (for inventory count)
func (s *WarehouseService) AdjustStock(ctx context.Context, warehouseID, productID, sku string, newQuantity int, reason, notes string) error {
	stock, err := s.repo.GetStock(ctx, warehouseID, productID)
	if err != nil {
		// Create new stock record
		stock = &Stock{
			ID:          generateID(),
			WarehouseID: warehouseID,
			ProductID:   productID,
			SKU:         sku,
			Quantity:    0,
			Reserved:    0,
			Available:   0,
			UpdatedAt:   time.Now(),
		}
	}

	difference := newQuantity - stock.Quantity
	if difference == 0 {
		return nil
	}

	stock.Quantity = newQuantity
	stock.Available = stock.Quantity - stock.Reserved
	if stock.Available < 0 {
		return ErrStockReserved
	}
	stock.UpdatedAt = time.Now()

	if err := s.repo.UpdateStock(ctx, stock); err != nil {
		return err
	}

	// Record adjustment
	movement := &StockMovement{
		ID:            generateID(),
		Type:          "adjustment",
		WarehouseToID: warehouseID,
		ProductID:     productID,
		SKU:           sku,
		Quantity:      difference,
		Reason:        reason,
		Notes:         notes,
		CreatedAt:     time.Now(),
	}

	if difference < 0 {
		movement.WarehouseFromID = warehouseID
		movement.WarehouseToID = ""
		movement.Quantity = -difference
	}

	return s.repo.CreateMovement(ctx, movement)
}

// GetLowStockProducts returns products below minimum stock level
func (s *WarehouseService) GetLowStockProducts(ctx context.Context, warehouseID string) ([]*Stock, error) {
	return s.repo.GetLowStock(ctx, warehouseID)
}

// GetMovementHistory returns stock movement history
func (s *WarehouseService) GetMovementHistory(ctx context.Context, warehouseID string, from, to time.Time, limit int) ([]*StockMovement, error) {
	return s.repo.ListMovements(ctx, warehouseID, from, to, limit)
}

func generateID() string {
	return time.Now().Format("20060102150405") + randomString(6)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}
