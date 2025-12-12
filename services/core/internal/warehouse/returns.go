package warehouse

import (
	"context"
	"errors"
	"time"
)

// Return-related errors
var (
	ErrReturnNotFound     = errors.New("return not found")
	ErrInvalidReturnState = errors.New("invalid return state")
	ErrReturnExpired      = errors.New("return period expired")
	ErrItemNotReturnable  = errors.New("item is not returnable")
)

// ReturnReason represents reason for return
type ReturnReason string

const (
	ReturnReasonDefective     ReturnReason = "defective"
	ReturnReasonWrongItem     ReturnReason = "wrong_item"
	ReturnReasonNotAsDescribed ReturnReason = "not_as_described"
	ReturnReasonChangedMind   ReturnReason = "changed_mind"
	ReturnReasonDamaged       ReturnReason = "damaged_in_shipping"
	ReturnReasonQuality       ReturnReason = "quality_issue"
	ReturnReasonSize          ReturnReason = "wrong_size"
	ReturnReasonOther         ReturnReason = "other"
)

// ReturnStatus represents return processing status
type ReturnStatus string

const (
	ReturnStatusRequested   ReturnStatus = "requested"
	ReturnStatusApproved    ReturnStatus = "approved"
	ReturnStatusRejected    ReturnStatus = "rejected"
	ReturnStatusInTransit   ReturnStatus = "in_transit"
	ReturnStatusReceived    ReturnStatus = "received"
	ReturnStatusInspecting  ReturnStatus = "inspecting"
	ReturnStatusCompleted   ReturnStatus = "completed"
	ReturnStatusRefunded    ReturnStatus = "refunded"
)

// ReturnCondition represents item condition after inspection
type ReturnCondition string

const (
	ConditionNew         ReturnCondition = "new"          // Unopened, resellable
	ConditionLikeNew     ReturnCondition = "like_new"     // Opened but unused
	ConditionGood        ReturnCondition = "good"         // Minor wear, resellable at discount
	ConditionAcceptable  ReturnCondition = "acceptable"   // Visible wear, needs refurbishment
	ConditionDamaged     ReturnCondition = "damaged"      // Cannot be resold
	ConditionDefective   ReturnCondition = "defective"    // Manufacturing defect
)

// ReturnDisposition represents what to do with returned item
type ReturnDisposition string

const (
	DispositionRestock      ReturnDisposition = "restock"       // Return to regular stock
	DispositionRefurbish    ReturnDisposition = "refurbish"     // Send for refurbishment
	DispositionSellAsUsed   ReturnDisposition = "sell_as_used"  // Sell as used/open box
	DispositionWriteOff     ReturnDisposition = "write_off"     // Write off as loss
	DispositionReturnVendor ReturnDisposition = "return_vendor" // Return to vendor
	DispositionDonate       ReturnDisposition = "donate"        // Donate
	DispositionRecycle      ReturnDisposition = "recycle"       // Recycle/dispose
)

// ReturnRequest represents a return request
type ReturnRequest struct {
	ID              string        `json:"id"`
	OrderID         string        `json:"order_id"`
	CustomerID      string        `json:"customer_id"`
	CustomerName    string        `json:"customer_name"`
	CustomerEmail   string        `json:"customer_email"`
	CustomerPhone   string        `json:"customer_phone,omitempty"`
	Status          ReturnStatus  `json:"status"`
	Items           []ReturnItem  `json:"items"`
	Reason          ReturnReason  `json:"reason"`
	ReasonDetails   string        `json:"reason_details,omitempty"`
	Photos          []string      `json:"photos,omitempty"`
	TrackingNumber  string        `json:"tracking_number,omitempty"`
	Carrier         string        `json:"carrier,omitempty"`
	WarehouseID     string        `json:"warehouse_id,omitempty"`
	ReceivedAt      *time.Time    `json:"received_at,omitempty"`
	InspectedAt     *time.Time    `json:"inspected_at,omitempty"`
	InspectedBy     string        `json:"inspected_by,omitempty"`
	RefundAmount    float64       `json:"refund_amount,omitempty"`
	RefundMethod    string        `json:"refund_method,omitempty"`
	RefundedAt      *time.Time    `json:"refunded_at,omitempty"`
	Notes           string        `json:"notes,omitempty"`
	InternalNotes   string        `json:"internal_notes,omitempty"`
	RequestedAt     time.Time     `json:"requested_at"`
	ApprovedAt      *time.Time    `json:"approved_at,omitempty"`
	ApprovedBy      string        `json:"approved_by,omitempty"`
	CompletedAt     *time.Time    `json:"completed_at,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

// ReturnItem represents an item in return request
type ReturnItem struct {
	ID             string            `json:"id"`
	ProductID      string            `json:"product_id"`
	SKU            string            `json:"sku"`
	ProductName    string            `json:"product_name"`
	Quantity       int               `json:"quantity"`
	ReturnedQty    int               `json:"returned_qty"`
	UnitPrice      float64           `json:"unit_price"`
	Condition      ReturnCondition   `json:"condition,omitempty"`
	Disposition    ReturnDisposition `json:"disposition,omitempty"`
	SerialNumber   string            `json:"serial_number,omitempty"`
	BatchNumber    string            `json:"batch_number,omitempty"`
	InspectionNote string            `json:"inspection_note,omitempty"`
	Photos         []string          `json:"photos,omitempty"`
	RefundAmount   float64           `json:"refund_amount,omitempty"`
	RestockedAt    *time.Time        `json:"restocked_at,omitempty"`
	Location       string            `json:"location,omitempty"` // Where item was placed
}

// ReturnPolicy defines return policy rules
type ReturnPolicy struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	ReturnDays       int      `json:"return_days"`        // Days allowed for return
	RefundPercentage float64  `json:"refund_percentage"`  // % of original price
	RequireReceipt   bool     `json:"require_receipt"`
	RequirePackaging bool     `json:"require_packaging"`
	RequireUnused    bool     `json:"require_unused"`
	FreeReturn       bool     `json:"free_return"`
	RestockingFee    float64  `json:"restocking_fee"`     // Fixed fee or percentage
	ExcludedReasons  []string `json:"excluded_reasons"`   // Reasons not covered
	ExcludedCategories []string `json:"excluded_categories"` // Product categories not returnable
	IsActive         bool     `json:"is_active"`
}

// ReturnLabel represents return shipping label
type ReturnLabel struct {
	ID             string    `json:"id"`
	ReturnID       string    `json:"return_id"`
	Carrier        string    `json:"carrier"`
	TrackingNumber string    `json:"tracking_number"`
	LabelURL       string    `json:"label_url"`
	LabelBase64    string    `json:"label_base64,omitempty"`
	Cost           float64   `json:"cost"`
	ExpiresAt      time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
}

// ReturnStats contains return statistics
type ReturnStats struct {
	TotalReturns      int                     `json:"total_returns"`
	PendingReturns    int                     `json:"pending_returns"`
	CompletedReturns  int                     `json:"completed_returns"`
	TotalRefunded     float64                 `json:"total_refunded"`
	AverageProcessTime float64                `json:"average_process_time_hours"`
	ReturnRate        float64                 `json:"return_rate_percent"`
	ByReason          map[ReturnReason]int    `json:"by_reason"`
	ByCondition       map[ReturnCondition]int `json:"by_condition"`
	ByDisposition     map[ReturnDisposition]int `json:"by_disposition"`
	TopReturnedProducts []ProductReturnInfo   `json:"top_returned_products"`
}

// ProductReturnInfo contains product return info
type ProductReturnInfo struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	SKU         string  `json:"sku"`
	ReturnCount int     `json:"return_count"`
	ReturnRate  float64 `json:"return_rate_percent"`
}

// ReturnRepository defines return data access
type ReturnRepository interface {
	// Returns
	CreateReturn(ctx context.Context, r *ReturnRequest) error
	UpdateReturn(ctx context.Context, r *ReturnRequest) error
	GetReturn(ctx context.Context, id string) (*ReturnRequest, error)
	GetReturnByOrder(ctx context.Context, orderID string) ([]*ReturnRequest, error)
	GetReturnsByCustomer(ctx context.Context, customerID string, limit int) ([]*ReturnRequest, error)
	ListReturns(ctx context.Context, status ReturnStatus, warehouseID string, limit, offset int) ([]*ReturnRequest, error)
	GetReturnStats(ctx context.Context, warehouseID string, from, to time.Time) (*ReturnStats, error)

	// Policies
	CreatePolicy(ctx context.Context, p *ReturnPolicy) error
	UpdatePolicy(ctx context.Context, p *ReturnPolicy) error
	GetPolicy(ctx context.Context, id string) (*ReturnPolicy, error)
	GetDefaultPolicy(ctx context.Context) (*ReturnPolicy, error)
	ListPolicies(ctx context.Context) ([]*ReturnPolicy, error)

	// Labels
	CreateReturnLabel(ctx context.Context, label *ReturnLabel) error
	GetReturnLabel(ctx context.Context, returnID string) (*ReturnLabel, error)
}

// ReturnService manages returns processing
type ReturnService struct {
	repo          ReturnRepository
	warehouseRepo WarehouseRepository
}

// NewReturnService creates return service
func NewReturnService(repo ReturnRepository, warehouseRepo WarehouseRepository) *ReturnService {
	return &ReturnService{
		repo:          repo,
		warehouseRepo: warehouseRepo,
	}
}

// CreateReturnRequest creates new return request
func (s *ReturnService) CreateReturnRequest(ctx context.Context, orderID, customerID, customerName, customerEmail string, items []ReturnItem, reason ReturnReason, reasonDetails string, photos []string) (*ReturnRequest, error) {
	// Validate items
	if len(items) == 0 {
		return nil, errors.New("no items in return request")
	}

	// Check return policy
	policy, err := s.repo.GetDefaultPolicy(ctx)
	if err != nil {
		return nil, err
	}

	// Check if reason is excluded
	for _, excluded := range policy.ExcludedReasons {
		if excluded == string(reason) {
			return nil, ErrItemNotReturnable
		}
	}

	// Calculate refund amount
	var totalRefund float64
	for i := range items {
		items[i].ID = generateID()
		itemRefund := items[i].UnitPrice * float64(items[i].Quantity)
		if policy.RefundPercentage < 100 {
			itemRefund = itemRefund * (policy.RefundPercentage / 100)
		}
		if policy.RestockingFee > 0 {
			itemRefund -= policy.RestockingFee
		}
		items[i].RefundAmount = itemRefund
		totalRefund += itemRefund
	}

	returnReq := &ReturnRequest{
		ID:            generateID(),
		OrderID:       orderID,
		CustomerID:    customerID,
		CustomerName:  customerName,
		CustomerEmail: customerEmail,
		Status:        ReturnStatusRequested,
		Items:         items,
		Reason:        reason,
		ReasonDetails: reasonDetails,
		Photos:        photos,
		RefundAmount:  totalRefund,
		RequestedAt:   time.Now(),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.repo.CreateReturn(ctx, returnReq); err != nil {
		return nil, err
	}

	return returnReq, nil
}

// ApproveReturn approves return request
func (s *ReturnService) ApproveReturn(ctx context.Context, returnID, approvedBy string) error {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return err
	}

	if ret.Status != ReturnStatusRequested {
		return ErrInvalidReturnState
	}

	now := time.Now()
	ret.Status = ReturnStatusApproved
	ret.ApprovedAt = &now
	ret.ApprovedBy = approvedBy
	ret.UpdatedAt = now

	return s.repo.UpdateReturn(ctx, ret)
}

// RejectReturn rejects return request
func (s *ReturnService) RejectReturn(ctx context.Context, returnID, rejectedBy, reason string) error {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return err
	}

	if ret.Status != ReturnStatusRequested {
		return ErrInvalidReturnState
	}

	ret.Status = ReturnStatusRejected
	ret.InternalNotes = reason
	ret.UpdatedAt = time.Now()

	return s.repo.UpdateReturn(ctx, ret)
}

// ReceiveReturn marks return as received at warehouse
func (s *ReturnService) ReceiveReturn(ctx context.Context, returnID, warehouseID, receivedBy string) error {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return err
	}

	if ret.Status != ReturnStatusApproved && ret.Status != ReturnStatusInTransit {
		return ErrInvalidReturnState
	}

	now := time.Now()
	ret.Status = ReturnStatusReceived
	ret.WarehouseID = warehouseID
	ret.ReceivedAt = &now
	ret.UpdatedAt = now

	return s.repo.UpdateReturn(ctx, ret)
}

// InspectReturnItem inspects a single item in return
func (s *ReturnService) InspectReturnItem(ctx context.Context, returnID, itemID string, condition ReturnCondition, disposition ReturnDisposition, notes string, photos []string) error {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return err
	}

	if ret.Status != ReturnStatusReceived && ret.Status != ReturnStatusInspecting {
		return ErrInvalidReturnState
	}

	// Find and update item
	found := false
	for i := range ret.Items {
		if ret.Items[i].ID == itemID {
			ret.Items[i].Condition = condition
			ret.Items[i].Disposition = disposition
			ret.Items[i].InspectionNote = notes
			ret.Items[i].Photos = append(ret.Items[i].Photos, photos...)
			found = true
			break
		}
	}

	if !found {
		return errors.New("item not found in return")
	}

	// Update status to inspecting if first inspection
	if ret.Status == ReturnStatusReceived {
		ret.Status = ReturnStatusInspecting
	}

	ret.UpdatedAt = time.Now()

	return s.repo.UpdateReturn(ctx, ret)
}

// CompleteInspection completes return inspection
func (s *ReturnService) CompleteInspection(ctx context.Context, returnID, inspectedBy string) error {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return err
	}

	if ret.Status != ReturnStatusInspecting {
		return ErrInvalidReturnState
	}

	// Verify all items are inspected
	for _, item := range ret.Items {
		if item.Condition == "" || item.Disposition == "" {
			return errors.New("not all items have been inspected")
		}
	}

	now := time.Now()
	ret.Status = ReturnStatusCompleted
	ret.InspectedAt = &now
	ret.InspectedBy = inspectedBy
	ret.UpdatedAt = now

	return s.repo.UpdateReturn(ctx, ret)
}

// ProcessDisposition processes item disposition (restock, write-off, etc.)
func (s *ReturnService) ProcessDisposition(ctx context.Context, returnID string) error {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return err
	}

	if ret.Status != ReturnStatusCompleted {
		return ErrInvalidReturnState
	}

	if ret.WarehouseID == "" {
		return errors.New("warehouse not set")
	}

	now := time.Now()

	for i := range ret.Items {
		item := &ret.Items[i]

		switch item.Disposition {
		case DispositionRestock:
			// Return to regular stock
			err := s.restockItem(ctx, ret.WarehouseID, item)
			if err != nil {
				return err
			}
			item.RestockedAt = &now

		case DispositionSellAsUsed:
			// Create separate used/open-box listing
			// This would integrate with product service
			item.RestockedAt = &now

		case DispositionWriteOff:
			// Record write-off
			// This would integrate with accounting

		case DispositionReturnVendor:
			// Create vendor return request
			// This would integrate with vendor management

		case DispositionRefurbish:
			// Create refurbishment task
			// This would integrate with task management
		}
	}

	ret.UpdatedAt = now
	return s.repo.UpdateReturn(ctx, ret)
}

// restockItem returns item to warehouse stock
func (s *ReturnService) restockItem(ctx context.Context, warehouseID string, item *ReturnItem) error {
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
			Location:    item.Location,
			UpdatedAt:   time.Now(),
		}
	}

	stock.Quantity += item.ReturnedQty
	stock.Available = stock.Quantity - stock.Reserved
	stock.UpdatedAt = time.Now()

	if err := s.warehouseRepo.UpdateStock(ctx, stock); err != nil {
		return err
	}

	// Record movement
	movement := &StockMovement{
		ID:            generateID(),
		Type:          "return",
		WarehouseToID: warehouseID,
		ProductID:     item.ProductID,
		SKU:           item.SKU,
		Quantity:      item.ReturnedQty,
		DocumentType:  "return",
		Notes:         "Return restock: " + string(item.Condition),
		CreatedAt:     time.Now(),
	}

	return s.warehouseRepo.CreateMovement(ctx, movement)
}

// ProcessRefund processes refund for completed return
func (s *ReturnService) ProcessRefund(ctx context.Context, returnID, refundMethod string) error {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return err
	}

	if ret.Status != ReturnStatusCompleted {
		return ErrInvalidReturnState
	}

	// Recalculate refund based on actual conditions
	var totalRefund float64
	for _, item := range ret.Items {
		refundAmount := item.RefundAmount

		// Adjust based on condition
		switch item.Condition {
		case ConditionDamaged, ConditionDefective:
			// Full refund for damaged/defective
		case ConditionAcceptable:
			refundAmount *= 0.8 // 80% refund
		case ConditionGood:
			refundAmount *= 0.9 // 90% refund
		}

		totalRefund += refundAmount
	}

	now := time.Now()
	ret.RefundAmount = totalRefund
	ret.RefundMethod = refundMethod
	ret.RefundedAt = &now
	ret.Status = ReturnStatusRefunded
	ret.CompletedAt = &now
	ret.UpdatedAt = now

	return s.repo.UpdateReturn(ctx, ret)
}

// GenerateReturnLabel generates return shipping label
func (s *ReturnService) GenerateReturnLabel(ctx context.Context, returnID, carrier string) (*ReturnLabel, error) {
	ret, err := s.repo.GetReturn(ctx, returnID)
	if err != nil {
		return nil, err
	}

	if ret.Status != ReturnStatusApproved {
		return nil, ErrInvalidReturnState
	}

	// Generate tracking number (would integrate with carrier API)
	trackingNum := "RTN" + generateID()

	label := &ReturnLabel{
		ID:             generateID(),
		ReturnID:       returnID,
		Carrier:        carrier,
		TrackingNumber: trackingNum,
		LabelURL:       "https://labels.example.com/" + trackingNum,
		Cost:           0, // Free return or calculated cost
		ExpiresAt:      time.Now().AddDate(0, 0, 30), // Valid for 30 days
		CreatedAt:      time.Now(),
	}

	if err := s.repo.CreateReturnLabel(ctx, label); err != nil {
		return nil, err
	}

	// Update return with tracking info
	ret.TrackingNumber = trackingNum
	ret.Carrier = carrier
	ret.Status = ReturnStatusInTransit
	ret.UpdatedAt = time.Now()

	if err := s.repo.UpdateReturn(ctx, ret); err != nil {
		return nil, err
	}

	return label, nil
}

// GetReturn returns return by ID
func (s *ReturnService) GetReturn(ctx context.Context, id string) (*ReturnRequest, error) {
	return s.repo.GetReturn(ctx, id)
}

// ListReturns returns list of returns
func (s *ReturnService) ListReturns(ctx context.Context, status ReturnStatus, warehouseID string, limit, offset int) ([]*ReturnRequest, error) {
	return s.repo.ListReturns(ctx, status, warehouseID, limit, offset)
}

// GetReturnsByCustomer returns customer's return history
func (s *ReturnService) GetReturnsByCustomer(ctx context.Context, customerID string, limit int) ([]*ReturnRequest, error) {
	return s.repo.GetReturnsByCustomer(ctx, customerID, limit)
}

// GetReturnStats returns return statistics
func (s *ReturnService) GetReturnStats(ctx context.Context, warehouseID string, from, to time.Time) (*ReturnStats, error) {
	return s.repo.GetReturnStats(ctx, warehouseID, from, to)
}

// GetReturnPolicy returns return policy
func (s *ReturnService) GetReturnPolicy(ctx context.Context, policyID string) (*ReturnPolicy, error) {
	return s.repo.GetPolicy(ctx, policyID)
}

// CreateReturnPolicy creates new return policy
func (s *ReturnService) CreateReturnPolicy(ctx context.Context, policy *ReturnPolicy) error {
	policy.ID = generateID()
	return s.repo.CreatePolicy(ctx, policy)
}

// UpdateReturnPolicy updates return policy
func (s *ReturnService) UpdateReturnPolicy(ctx context.Context, policy *ReturnPolicy) error {
	return s.repo.UpdatePolicy(ctx, policy)
}

// CanReturn checks if order can be returned
func (s *ReturnService) CanReturn(ctx context.Context, orderID string, orderDate time.Time) (bool, string, error) {
	policy, err := s.repo.GetDefaultPolicy(ctx)
	if err != nil {
		return false, "", err
	}

	// Check if return period has expired
	returnDeadline := orderDate.AddDate(0, 0, policy.ReturnDays)
	if time.Now().After(returnDeadline) {
		return false, "Return period has expired", nil
	}

	// Check if there's already an active return for this order
	existing, err := s.repo.GetReturnByOrder(ctx, orderID)
	if err != nil {
		return false, "", err
	}

	for _, r := range existing {
		if r.Status != ReturnStatusRejected && r.Status != ReturnStatusRefunded {
			return false, "Active return request already exists", nil
		}
	}

	return true, "", nil
}

// GetReturnReasons returns available return reasons
func (s *ReturnService) GetReturnReasons() []ReturnReason {
	return []ReturnReason{
		ReturnReasonDefective,
		ReturnReasonWrongItem,
		ReturnReasonNotAsDescribed,
		ReturnReasonChangedMind,
		ReturnReasonDamaged,
		ReturnReasonQuality,
		ReturnReasonSize,
		ReturnReasonOther,
	}
}

// GetReturnConditions returns available return conditions
func (s *ReturnService) GetReturnConditions() []ReturnCondition {
	return []ReturnCondition{
		ConditionNew,
		ConditionLikeNew,
		ConditionGood,
		ConditionAcceptable,
		ConditionDamaged,
		ConditionDefective,
	}
}

// GetDispositionOptions returns available disposition options
func (s *ReturnService) GetDispositionOptions() []ReturnDisposition {
	return []ReturnDisposition{
		DispositionRestock,
		DispositionRefurbish,
		DispositionSellAsUsed,
		DispositionWriteOff,
		DispositionReturnVendor,
		DispositionDonate,
		DispositionRecycle,
	}
}
