package warehouse

import (
	"context"
	"errors"
	"sort"
	"time"
)

// Purchasing errors
var (
	ErrPurchaseOrderNotFound = errors.New("purchase order not found")
	ErrSupplierNotFound      = errors.New("supplier not found")
	ErrInvalidPOState        = errors.New("invalid purchase order state")
	ErrNothingToReorder      = errors.New("nothing to reorder")
)

// POStatus represents purchase order status
type POStatus string

const (
	POStatusDraft      POStatus = "draft"
	POStatusPending    POStatus = "pending"      // Waiting for approval
	POStatusApproved   POStatus = "approved"
	POStatusOrdered    POStatus = "ordered"      // Sent to supplier
	POStatusConfirmed  POStatus = "confirmed"    // Supplier confirmed
	POStatusShipped    POStatus = "shipped"
	POStatusReceived   POStatus = "received"     // Partially or fully
	POStatusCompleted  POStatus = "completed"
	POStatusCancelled  POStatus = "cancelled"
)

// PurchaseOrder represents purchase order to supplier
type PurchaseOrder struct {
	ID              string          `json:"id"`
	PONumber        string          `json:"po_number"`
	SupplierID      string          `json:"supplier_id"`
	SupplierName    string          `json:"supplier_name"`
	WarehouseID     string          `json:"warehouse_id"`
	Status          POStatus        `json:"status"`
	Items           []POItem        `json:"items"`
	Subtotal        float64         `json:"subtotal"`
	TaxAmount       float64         `json:"tax_amount"`
	ShippingCost    float64         `json:"shipping_cost"`
	TotalAmount     float64         `json:"total_amount"`
	Currency        string          `json:"currency"`
	PaymentTerms    string          `json:"payment_terms,omitempty"`
	ShippingMethod  string          `json:"shipping_method,omitempty"`
	ExpectedDate    *time.Time      `json:"expected_date,omitempty"`
	Notes           string          `json:"notes,omitempty"`
	InternalNotes   string          `json:"internal_notes,omitempty"`
	CreatedBy       string          `json:"created_by"`
	ApprovedBy      string          `json:"approved_by,omitempty"`
	ApprovedAt      *time.Time      `json:"approved_at,omitempty"`
	OrderedAt       *time.Time      `json:"ordered_at,omitempty"`
	ReceivedAt      *time.Time      `json:"received_at,omitempty"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// POItem represents item in purchase order
type POItem struct {
	ID              string     `json:"id"`
	ProductID       string     `json:"product_id"`
	SKU             string     `json:"sku"`
	ProductName     string     `json:"product_name"`
	SupplierSKU     string     `json:"supplier_sku,omitempty"`
	Quantity        int        `json:"quantity"`
	ReceivedQty     int        `json:"received_qty"`
	UnitPrice       float64    `json:"unit_price"`
	TotalPrice      float64    `json:"total_price"`
	Tax             float64    `json:"tax,omitempty"`
	ExpectedDate    *time.Time `json:"expected_date,omitempty"`
	Notes           string     `json:"notes,omitempty"`
}

// Supplier represents supplier/vendor
type Supplier struct {
	ID              string            `json:"id"`
	Code            string            `json:"code"`
	Name            string            `json:"name"`
	ContactName     string            `json:"contact_name,omitempty"`
	Email           string            `json:"email"`
	Phone           string            `json:"phone,omitempty"`
	Address         *Address          `json:"address,omitempty"`
	PaymentTerms    string            `json:"payment_terms,omitempty"` // NET30, COD, etc.
	Currency        string            `json:"currency"`
	MinOrderAmount  float64           `json:"min_order_amount,omitempty"`
	LeadTimeDays    int               `json:"lead_time_days"`
	Rating          float64           `json:"rating,omitempty"`
	IsActive        bool              `json:"is_active"`
	Tags            []string          `json:"tags,omitempty"`
	Notes           string            `json:"notes,omitempty"`
	Products        []SupplierProduct `json:"products,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

// SupplierProduct represents product from supplier
type SupplierProduct struct {
	ProductID    string  `json:"product_id"`
	SupplierSKU  string  `json:"supplier_sku"`
	ProductName  string  `json:"product_name"`
	UnitPrice    float64 `json:"unit_price"`
	MinOrderQty  int     `json:"min_order_qty"`
	PackSize     int     `json:"pack_size"`
	LeadTimeDays int     `json:"lead_time_days,omitempty"`
	IsPreferred  bool    `json:"is_preferred"`
}

// ReorderRule defines automatic reorder rules
type ReorderRule struct {
	ID              string  `json:"id"`
	ProductID       string  `json:"product_id"`
	WarehouseID     string  `json:"warehouse_id"`
	ReorderPoint    int     `json:"reorder_point"`     // Trigger when stock falls below
	ReorderQty      int     `json:"reorder_qty"`       // Quantity to order
	MaxStock        int     `json:"max_stock"`         // Don't order if above this
	PreferredSupplierID string `json:"preferred_supplier_id,omitempty"`
	IsActive        bool    `json:"is_active"`
	AutoOrder       bool    `json:"auto_order"`        // Create PO automatically
	LastChecked     *time.Time `json:"last_checked,omitempty"`
	LastOrderedAt   *time.Time `json:"last_ordered_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ReorderSuggestion represents suggested reorder
type ReorderSuggestion struct {
	ProductID       string  `json:"product_id"`
	ProductName     string  `json:"product_name"`
	SKU             string  `json:"sku"`
	CurrentStock    int     `json:"current_stock"`
	ReorderPoint    int     `json:"reorder_point"`
	SuggestedQty    int     `json:"suggested_qty"`
	SupplierID      string  `json:"supplier_id,omitempty"`
	SupplierName    string  `json:"supplier_name,omitempty"`
	UnitPrice       float64 `json:"unit_price,omitempty"`
	LeadTimeDays    int     `json:"lead_time_days,omitempty"`
	Priority        string  `json:"priority"` // urgent, high, normal, low
	DaysOfStock     int     `json:"days_of_stock"` // Estimated days until stockout
}

// PurchasingStats contains purchasing statistics
type PurchasingStats struct {
	TotalOrders       int     `json:"total_orders"`
	PendingOrders     int     `json:"pending_orders"`
	TotalSpent        float64 `json:"total_spent"`
	AverageLeadTime   float64 `json:"average_lead_time_days"`
	OnTimeDelivery    float64 `json:"on_time_delivery_percent"`
	TopSuppliers      []SupplierStat `json:"top_suppliers"`
}

// SupplierStat contains supplier statistics
type SupplierStat struct {
	SupplierID   string  `json:"supplier_id"`
	SupplierName string  `json:"supplier_name"`
	OrderCount   int     `json:"order_count"`
	TotalSpent   float64 `json:"total_spent"`
	AvgLeadTime  float64 `json:"avg_lead_time_days"`
	OnTimeRate   float64 `json:"on_time_rate_percent"`
}

// PurchasingRepository defines purchasing data access
type PurchasingRepository interface {
	// Purchase Orders
	CreatePurchaseOrder(ctx context.Context, po *PurchaseOrder) error
	UpdatePurchaseOrder(ctx context.Context, po *PurchaseOrder) error
	GetPurchaseOrder(ctx context.Context, id string) (*PurchaseOrder, error)
	GetPurchaseOrderByNumber(ctx context.Context, poNumber string) (*PurchaseOrder, error)
	ListPurchaseOrders(ctx context.Context, status POStatus, supplierID string, limit, offset int) ([]*PurchaseOrder, error)
	GetNextPONumber(ctx context.Context) (string, error)

	// Suppliers
	CreateSupplier(ctx context.Context, s *Supplier) error
	UpdateSupplier(ctx context.Context, s *Supplier) error
	GetSupplier(ctx context.Context, id string) (*Supplier, error)
	ListSuppliers(ctx context.Context, activeOnly bool) ([]*Supplier, error)
	GetSuppliersByProduct(ctx context.Context, productID string) ([]*Supplier, error)

	// Reorder Rules
	CreateReorderRule(ctx context.Context, rule *ReorderRule) error
	UpdateReorderRule(ctx context.Context, rule *ReorderRule) error
	GetReorderRule(ctx context.Context, id string) (*ReorderRule, error)
	GetReorderRuleByProduct(ctx context.Context, productID, warehouseID string) (*ReorderRule, error)
	ListReorderRules(ctx context.Context, warehouseID string, activeOnly bool) ([]*ReorderRule, error)

	// Stats
	GetPurchasingStats(ctx context.Context, from, to time.Time) (*PurchasingStats, error)
}

// PurchasingService manages purchasing and reordering
type PurchasingService struct {
	repo          PurchasingRepository
	warehouseRepo WarehouseRepository
}

// NewPurchasingService creates purchasing service
func NewPurchasingService(repo PurchasingRepository, warehouseRepo WarehouseRepository) *PurchasingService {
	return &PurchasingService{
		repo:          repo,
		warehouseRepo: warehouseRepo,
	}
}

// CreatePurchaseOrder creates new purchase order
func (s *PurchasingService) CreatePurchaseOrder(ctx context.Context, supplierID, warehouseID, createdBy string, items []POItem, notes string) (*PurchaseOrder, error) {
	if len(items) == 0 {
		return nil, errors.New("no items in purchase order")
	}

	// Get supplier
	supplier, err := s.repo.GetSupplier(ctx, supplierID)
	if err != nil {
		return nil, ErrSupplierNotFound
	}

	// Get next PO number
	poNumber, err := s.repo.GetNextPONumber(ctx)
	if err != nil {
		poNumber = "PO-" + generateID()[:8]
	}

	// Calculate totals
	var subtotal float64
	for i := range items {
		items[i].ID = generateID()
		items[i].TotalPrice = items[i].UnitPrice * float64(items[i].Quantity)
		subtotal += items[i].TotalPrice
	}

	po := &PurchaseOrder{
		ID:           generateID(),
		PONumber:     poNumber,
		SupplierID:   supplierID,
		SupplierName: supplier.Name,
		WarehouseID:  warehouseID,
		Status:       POStatusDraft,
		Items:        items,
		Subtotal:     subtotal,
		TotalAmount:  subtotal, // Tax and shipping added later
		Currency:     supplier.Currency,
		PaymentTerms: supplier.PaymentTerms,
		Notes:        notes,
		CreatedBy:    createdBy,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Calculate expected date
	expectedDate := time.Now().AddDate(0, 0, supplier.LeadTimeDays)
	po.ExpectedDate = &expectedDate

	if err := s.repo.CreatePurchaseOrder(ctx, po); err != nil {
		return nil, err
	}

	return po, nil
}

// UpdatePurchaseOrder updates purchase order
func (s *PurchasingService) UpdatePurchaseOrder(ctx context.Context, po *PurchaseOrder) error {
	if po.Status != POStatusDraft {
		return ErrInvalidPOState
	}

	// Recalculate totals
	var subtotal float64
	for i := range po.Items {
		po.Items[i].TotalPrice = po.Items[i].UnitPrice * float64(po.Items[i].Quantity)
		subtotal += po.Items[i].TotalPrice
	}

	po.Subtotal = subtotal
	po.TotalAmount = subtotal + po.TaxAmount + po.ShippingCost
	po.UpdatedAt = time.Now()

	return s.repo.UpdatePurchaseOrder(ctx, po)
}

// SubmitPurchaseOrder submits PO for approval
func (s *PurchasingService) SubmitPurchaseOrder(ctx context.Context, poID string) error {
	po, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return err
	}

	if po.Status != POStatusDraft {
		return ErrInvalidPOState
	}

	po.Status = POStatusPending
	po.UpdatedAt = time.Now()

	return s.repo.UpdatePurchaseOrder(ctx, po)
}

// ApprovePurchaseOrder approves PO
func (s *PurchasingService) ApprovePurchaseOrder(ctx context.Context, poID, approvedBy string) error {
	po, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return err
	}

	if po.Status != POStatusPending {
		return ErrInvalidPOState
	}

	now := time.Now()
	po.Status = POStatusApproved
	po.ApprovedBy = approvedBy
	po.ApprovedAt = &now
	po.UpdatedAt = now

	return s.repo.UpdatePurchaseOrder(ctx, po)
}

// SendPurchaseOrder marks PO as sent to supplier
func (s *PurchasingService) SendPurchaseOrder(ctx context.Context, poID string) error {
	po, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return err
	}

	if po.Status != POStatusApproved {
		return ErrInvalidPOState
	}

	now := time.Now()
	po.Status = POStatusOrdered
	po.OrderedAt = &now
	po.UpdatedAt = now

	return s.repo.UpdatePurchaseOrder(ctx, po)
}

// ConfirmPurchaseOrder confirms supplier received order
func (s *PurchasingService) ConfirmPurchaseOrder(ctx context.Context, poID string, expectedDate *time.Time) error {
	po, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return err
	}

	if po.Status != POStatusOrdered {
		return ErrInvalidPOState
	}

	po.Status = POStatusConfirmed
	if expectedDate != nil {
		po.ExpectedDate = expectedDate
	}
	po.UpdatedAt = time.Now()

	return s.repo.UpdatePurchaseOrder(ctx, po)
}

// ReceivePurchaseOrder receives items from PO
func (s *PurchasingService) ReceivePurchaseOrder(ctx context.Context, poID string, receivedItems map[string]int) error {
	po, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return err
	}

	if po.Status != POStatusConfirmed && po.Status != POStatusShipped && po.Status != POStatusReceived {
		return ErrInvalidPOState
	}

	now := time.Now()
	allReceived := true

	for i := range po.Items {
		if qty, ok := receivedItems[po.Items[i].ID]; ok {
			po.Items[i].ReceivedQty += qty

			// Receive stock
			err := s.receiveStock(ctx, po.WarehouseID, po.Items[i], qty)
			if err != nil {
				return err
			}
		}

		if po.Items[i].ReceivedQty < po.Items[i].Quantity {
			allReceived = false
		}
	}

	if po.ReceivedAt == nil {
		po.ReceivedAt = &now
	}
	po.Status = POStatusReceived

	if allReceived {
		po.Status = POStatusCompleted
		po.CompletedAt = &now
	}

	po.UpdatedAt = now

	return s.repo.UpdatePurchaseOrder(ctx, po)
}

// receiveStock adds received items to warehouse stock
func (s *PurchasingService) receiveStock(ctx context.Context, warehouseID string, item POItem, quantity int) error {
	stock, err := s.warehouseRepo.GetStock(ctx, warehouseID, item.ProductID)
	if err != nil {
		// Create new stock record
		stock = &Stock{
			ID:          generateID(),
			WarehouseID: warehouseID,
			ProductID:   item.ProductID,
			SKU:         item.SKU,
			Quantity:    0,
			Reserved:    0,
			Available:   0,
			CostPrice:   item.UnitPrice,
			UpdatedAt:   time.Now(),
		}
	}

	stock.Quantity += quantity
	stock.Available = stock.Quantity - stock.Reserved
	stock.CostPrice = item.UnitPrice // Update cost price
	stock.UpdatedAt = time.Now()

	if err := s.warehouseRepo.UpdateStock(ctx, stock); err != nil {
		return err
	}

	// Record movement
	movement := &StockMovement{
		ID:            generateID(),
		Type:          "receipt",
		WarehouseToID: warehouseID,
		ProductID:     item.ProductID,
		SKU:           item.SKU,
		Quantity:      quantity,
		DocumentType:  "purchase",
		Notes:         "PO Receipt",
		CreatedAt:     time.Now(),
	}

	return s.warehouseRepo.CreateMovement(ctx, movement)
}

// CancelPurchaseOrder cancels PO
func (s *PurchasingService) CancelPurchaseOrder(ctx context.Context, poID, reason string) error {
	po, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return err
	}

	if po.Status == POStatusCompleted || po.Status == POStatusCancelled {
		return ErrInvalidPOState
	}

	po.Status = POStatusCancelled
	po.InternalNotes = reason
	po.UpdatedAt = time.Now()

	return s.repo.UpdatePurchaseOrder(ctx, po)
}

// GetPurchaseOrder returns PO by ID
func (s *PurchasingService) GetPurchaseOrder(ctx context.Context, id string) (*PurchaseOrder, error) {
	return s.repo.GetPurchaseOrder(ctx, id)
}

// ListPurchaseOrders returns list of POs
func (s *PurchasingService) ListPurchaseOrders(ctx context.Context, status POStatus, supplierID string, limit, offset int) ([]*PurchaseOrder, error) {
	return s.repo.ListPurchaseOrders(ctx, status, supplierID, limit, offset)
}

// CreateSupplier creates new supplier
func (s *PurchasingService) CreateSupplier(ctx context.Context, supplier *Supplier) error {
	supplier.ID = generateID()
	supplier.CreatedAt = time.Now()
	supplier.UpdatedAt = time.Now()
	return s.repo.CreateSupplier(ctx, supplier)
}

// UpdateSupplier updates supplier
func (s *PurchasingService) UpdateSupplier(ctx context.Context, supplier *Supplier) error {
	supplier.UpdatedAt = time.Now()
	return s.repo.UpdateSupplier(ctx, supplier)
}

// GetSupplier returns supplier by ID
func (s *PurchasingService) GetSupplier(ctx context.Context, id string) (*Supplier, error) {
	return s.repo.GetSupplier(ctx, id)
}

// ListSuppliers returns list of suppliers
func (s *PurchasingService) ListSuppliers(ctx context.Context, activeOnly bool) ([]*Supplier, error) {
	return s.repo.ListSuppliers(ctx, activeOnly)
}

// CreateReorderRule creates reorder rule
func (s *PurchasingService) CreateReorderRule(ctx context.Context, rule *ReorderRule) error {
	rule.ID = generateID()
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	return s.repo.CreateReorderRule(ctx, rule)
}

// UpdateReorderRule updates reorder rule
func (s *PurchasingService) UpdateReorderRule(ctx context.Context, rule *ReorderRule) error {
	rule.UpdatedAt = time.Now()
	return s.repo.UpdateReorderRule(ctx, rule)
}

// GetReorderSuggestions returns products that need reordering
func (s *PurchasingService) GetReorderSuggestions(ctx context.Context, warehouseID string) ([]*ReorderSuggestion, error) {
	// Get all active reorder rules
	rules, err := s.repo.ListReorderRules(ctx, warehouseID, true)
	if err != nil {
		return nil, err
	}

	var suggestions []*ReorderSuggestion

	for _, rule := range rules {
		// Get current stock
		stock, err := s.warehouseRepo.GetStock(ctx, warehouseID, rule.ProductID)
		if err != nil {
			continue
		}

		// Check if below reorder point
		if stock.Available <= rule.ReorderPoint {
			// Calculate suggested quantity
			suggestedQty := rule.ReorderQty
			if rule.MaxStock > 0 {
				suggestedQty = rule.MaxStock - stock.Quantity
				if suggestedQty > rule.ReorderQty {
					suggestedQty = rule.ReorderQty
				}
			}

			if suggestedQty <= 0 {
				continue
			}

			// Determine priority
			priority := "normal"
			if stock.Available <= 0 {
				priority = "urgent"
			} else if stock.Available <= rule.ReorderPoint/2 {
				priority = "high"
			}

			// Estimate days of stock (based on average daily sales)
			daysOfStock := 0
			if stock.Available > 0 {
				// This would need sales data to calculate properly
				daysOfStock = stock.Available * 7 / (rule.ReorderPoint + 1)
			}

			suggestion := &ReorderSuggestion{
				ProductID:    rule.ProductID,
				SKU:          stock.SKU,
				CurrentStock: stock.Available,
				ReorderPoint: rule.ReorderPoint,
				SuggestedQty: suggestedQty,
				Priority:     priority,
				DaysOfStock:  daysOfStock,
			}

			// Get preferred supplier
			if rule.PreferredSupplierID != "" {
				supplier, err := s.repo.GetSupplier(ctx, rule.PreferredSupplierID)
				if err == nil {
					suggestion.SupplierID = supplier.ID
					suggestion.SupplierName = supplier.Name
					suggestion.LeadTimeDays = supplier.LeadTimeDays

					// Get product price from supplier
					for _, sp := range supplier.Products {
						if sp.ProductID == rule.ProductID {
							suggestion.UnitPrice = sp.UnitPrice
							break
						}
					}
				}
			}

			suggestions = append(suggestions, suggestion)
		}
	}

	// Sort by priority
	sort.Slice(suggestions, func(i, j int) bool {
		priorityOrder := map[string]int{"urgent": 0, "high": 1, "normal": 2, "low": 3}
		return priorityOrder[suggestions[i].Priority] < priorityOrder[suggestions[j].Priority]
	})

	return suggestions, nil
}

// ProcessAutoReorders automatically creates POs for items needing reorder
func (s *PurchasingService) ProcessAutoReorders(ctx context.Context, warehouseID, createdBy string) ([]*PurchaseOrder, error) {
	// Get rules with auto_order enabled
	rules, err := s.repo.ListReorderRules(ctx, warehouseID, true)
	if err != nil {
		return nil, err
	}

	// Group by supplier
	supplierItems := make(map[string][]POItem)

	for _, rule := range rules {
		if !rule.AutoOrder {
			continue
		}

		// Get current stock
		stock, err := s.warehouseRepo.GetStock(ctx, warehouseID, rule.ProductID)
		if err != nil {
			continue
		}

		// Check if below reorder point
		if stock.Available > rule.ReorderPoint {
			continue
		}

		// Get preferred supplier
		if rule.PreferredSupplierID == "" {
			continue
		}

		supplier, err := s.repo.GetSupplier(ctx, rule.PreferredSupplierID)
		if err != nil {
			continue
		}

		// Find product in supplier catalog
		var unitPrice float64
		var supplierSKU string
		for _, sp := range supplier.Products {
			if sp.ProductID == rule.ProductID {
				unitPrice = sp.UnitPrice
				supplierSKU = sp.SupplierSKU
				break
			}
		}

		if unitPrice == 0 {
			continue
		}

		// Calculate quantity
		qty := rule.ReorderQty
		if rule.MaxStock > 0 && rule.MaxStock > stock.Quantity {
			maxQty := rule.MaxStock - stock.Quantity
			if maxQty < qty {
				qty = maxQty
			}
		}

		if qty <= 0 {
			continue
		}

		item := POItem{
			ProductID:   rule.ProductID,
			SKU:         stock.SKU,
			SupplierSKU: supplierSKU,
			Quantity:    qty,
			UnitPrice:   unitPrice,
		}

		supplierItems[rule.PreferredSupplierID] = append(supplierItems[rule.PreferredSupplierID], item)

		// Update last checked
		now := time.Now()
		rule.LastChecked = &now
		s.repo.UpdateReorderRule(ctx, rule)
	}

	// Create POs
	var createdPOs []*PurchaseOrder

	for supplierID, items := range supplierItems {
		if len(items) == 0 {
			continue
		}

		po, err := s.CreatePurchaseOrder(ctx, supplierID, warehouseID, createdBy, items, "Auto-reorder")
		if err != nil {
			continue
		}

		// Auto-submit
		po.Status = POStatusPending
		s.repo.UpdatePurchaseOrder(ctx, po)

		createdPOs = append(createdPOs, po)
	}

	if len(createdPOs) == 0 {
		return nil, ErrNothingToReorder
	}

	return createdPOs, nil
}

// CreatePOFromSuggestions creates PO from reorder suggestions
func (s *PurchasingService) CreatePOFromSuggestions(ctx context.Context, warehouseID, supplierID, createdBy string, productIDs []string) (*PurchaseOrder, error) {
	supplier, err := s.repo.GetSupplier(ctx, supplierID)
	if err != nil {
		return nil, ErrSupplierNotFound
	}

	var items []POItem

	for _, productID := range productIDs {
		// Get stock
		stock, err := s.warehouseRepo.GetStock(ctx, warehouseID, productID)
		if err != nil {
			continue
		}

		// Get reorder rule
		rule, err := s.repo.GetReorderRuleByProduct(ctx, productID, warehouseID)
		if err != nil {
			continue
		}

		// Find in supplier catalog
		var unitPrice float64
		var supplierSKU string
		for _, sp := range supplier.Products {
			if sp.ProductID == productID {
				unitPrice = sp.UnitPrice
				supplierSKU = sp.SupplierSKU
				break
			}
		}

		if unitPrice == 0 {
			continue
		}

		qty := rule.ReorderQty
		if rule.MaxStock > 0 {
			maxQty := rule.MaxStock - stock.Quantity
			if maxQty < qty {
				qty = maxQty
			}
		}

		if qty <= 0 {
			continue
		}

		items = append(items, POItem{
			ProductID:   productID,
			SKU:         stock.SKU,
			SupplierSKU: supplierSKU,
			Quantity:    qty,
			UnitPrice:   unitPrice,
		})
	}

	if len(items) == 0 {
		return nil, ErrNothingToReorder
	}

	return s.CreatePurchaseOrder(ctx, supplierID, warehouseID, createdBy, items, "Created from suggestions")
}

// GetPurchasingStats returns purchasing statistics
func (s *PurchasingService) GetPurchasingStats(ctx context.Context, from, to time.Time) (*PurchasingStats, error) {
	return s.repo.GetPurchasingStats(ctx, from, to)
}

// DuplicatePurchaseOrder creates copy of existing PO
func (s *PurchasingService) DuplicatePurchaseOrder(ctx context.Context, poID, createdBy string) (*PurchaseOrder, error) {
	original, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return nil, err
	}

	// Reset item IDs and received quantities
	items := make([]POItem, len(original.Items))
	for i, item := range original.Items {
		items[i] = POItem{
			ProductID:   item.ProductID,
			SKU:         item.SKU,
			ProductName: item.ProductName,
			SupplierSKU: item.SupplierSKU,
			Quantity:    item.Quantity,
			UnitPrice:   item.UnitPrice,
		}
	}

	return s.CreatePurchaseOrder(ctx, original.SupplierID, original.WarehouseID, createdBy, items, "Duplicate of "+original.PONumber)
}
