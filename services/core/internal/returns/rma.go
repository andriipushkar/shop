package returns

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var (
	ErrReturnNotFound       = errors.New("return request not found")
	ErrInvalidStatus        = errors.New("invalid return status")
	ErrOrderNotReturnable   = errors.New("order is not eligible for return")
	ErrReturnWindowExpired  = errors.New("return window has expired")
	ErrItemAlreadyReturned  = errors.New("item has already been returned")
	ErrRefundFailed         = errors.New("refund processing failed")
)

// ReturnStatus represents the status of a return request
type ReturnStatus string

const (
	StatusPending          ReturnStatus = "pending"
	StatusApproved         ReturnStatus = "approved"
	StatusRejected         ReturnStatus = "rejected"
	StatusShipmentCreated  ReturnStatus = "shipment_created"
	StatusInTransit        ReturnStatus = "in_transit"
	StatusReceived         ReturnStatus = "received"
	StatusInspecting       ReturnStatus = "inspecting"
	StatusApprovedForRefund ReturnStatus = "approved_for_refund"
	StatusRefunded         ReturnStatus = "refunded"
	StatusCompleted        ReturnStatus = "completed"
	StatusCancelled        ReturnStatus = "cancelled"
)

// ReturnReason represents why item is being returned
type ReturnReason string

const (
	ReasonDefective       ReturnReason = "defective"
	ReasonWrongItem       ReturnReason = "wrong_item"
	ReasonNotAsDescribed  ReturnReason = "not_as_described"
	ReasonDamaged         ReturnReason = "damaged"
	ReasonChangedMind     ReturnReason = "changed_mind"
	ReasonSizeFit         ReturnReason = "size_fit"
	ReasonBetterPrice     ReturnReason = "better_price"
	ReasonOther           ReturnReason = "other"
)

// ItemCondition represents the condition of returned item
type ItemCondition string

const (
	ConditionNew        ItemCondition = "new"
	ConditionLikeNew    ItemCondition = "like_new"
	ConditionGood       ItemCondition = "good"
	ConditionAcceptable ItemCondition = "acceptable"
	ConditionDamaged    ItemCondition = "damaged"
	ConditionDefective  ItemCondition = "defective"
)

// RefundMethod represents how refund will be processed
type RefundMethod string

const (
	RefundOriginalPayment RefundMethod = "original_payment"
	RefundStoreCredit     RefundMethod = "store_credit"
	RefundBankTransfer    RefundMethod = "bank_transfer"
	RefundExchange        RefundMethod = "exchange"
)

// ReturnRequest represents a return merchandise authorization request
type ReturnRequest struct {
	ID              string       `json:"id"`
	TenantID        string       `json:"tenant_id"`
	OrderID         string       `json:"order_id"`
	OrderNumber     string       `json:"order_number"`
	CustomerID      string       `json:"customer_id"`
	CustomerEmail   string       `json:"customer_email"`
	CustomerPhone   string       `json:"customer_phone"`
	CustomerName    string       `json:"customer_name"`

	Status          ReturnStatus `json:"status"`
	Reason          ReturnReason `json:"reason"`
	ReasonDetails   string       `json:"reason_details,omitempty"`

	// Shipping
	ReturnTrackingNumber string      `json:"return_tracking_number,omitempty"`
	ReturnCarrier        string      `json:"return_carrier,omitempty"`
	ReturnShipmentID     string      `json:"return_shipment_id,omitempty"`
	LabelURL             string      `json:"label_url,omitempty"`

	// Inspection
	InspectionNotes  string        `json:"inspection_notes,omitempty"`
	InspectedBy      string        `json:"inspected_by,omitempty"`
	InspectedAt      *time.Time    `json:"inspected_at,omitempty"`

	// Refund
	RefundMethod     RefundMethod  `json:"refund_method"`
	RefundAmount     float64       `json:"refund_amount"`
	RefundStatus     string        `json:"refund_status,omitempty"`
	RefundID         string        `json:"refund_id,omitempty"`
	RefundedAt       *time.Time    `json:"refunded_at,omitempty"`

	// Items
	Items            []ReturnItem  `json:"items"`

	// Admin
	AdminNotes       string        `json:"admin_notes,omitempty"`
	ProcessedBy      string        `json:"processed_by,omitempty"`

	// Dates
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
	ApprovedAt       *time.Time    `json:"approved_at,omitempty"`
	ReceivedAt       *time.Time    `json:"received_at,omitempty"`
	CompletedAt      *time.Time    `json:"completed_at,omitempty"`
}

// ReturnItem represents an item in the return request
type ReturnItem struct {
	ID              string        `json:"id"`
	ReturnID        string        `json:"return_id"`
	OrderItemID     string        `json:"order_item_id"`
	ProductID       string        `json:"product_id"`
	VariantID       string        `json:"variant_id,omitempty"`
	SKU             string        `json:"sku"`
	Name            string        `json:"name"`
	Quantity        int           `json:"quantity"`
	Price           float64       `json:"price"`
	RefundAmount    float64       `json:"refund_amount"`
	Reason          ReturnReason  `json:"reason"`
	Condition       ItemCondition `json:"condition,omitempty"`
	Images          []string      `json:"images,omitempty"`
	Notes           string        `json:"notes,omitempty"`

	// Warehouse decision
	Decision        string        `json:"decision,omitempty"` // restock, damage, dispose
	DecisionNotes   string        `json:"decision_notes,omitempty"`
	DecisionBy      string        `json:"decision_by,omitempty"`
	DecisionAt      *time.Time    `json:"decision_at,omitempty"`
}

// ReturnHistory represents a history entry
type ReturnHistory struct {
	ID        string       `json:"id"`
	ReturnID  string       `json:"return_id"`
	Status    ReturnStatus `json:"status"`
	Comment   string       `json:"comment,omitempty"`
	CreatedBy string       `json:"created_by,omitempty"`
	CreatedAt time.Time    `json:"created_at"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// ReturnPolicy represents return policy configuration
type ReturnPolicy struct {
	TenantID              string        `json:"tenant_id"`
	ReturnWindowDays      int           `json:"return_window_days"`
	AllowedReasons        []ReturnReason `json:"allowed_reasons"`
	RequireImages         bool          `json:"require_images"`
	FreeReturn            bool          `json:"free_return"`
	RestockingFeePercent  float64       `json:"restocking_fee_percent"`
	AutoApprove           bool          `json:"auto_approve"`
	AutoApproveMaxAmount  float64       `json:"auto_approve_max_amount"`
	ExcludedCategories    []string      `json:"excluded_categories"`
	ExcludedProducts      []string      `json:"excluded_products"`
}

// DefaultReturnPolicy returns default return policy
func DefaultReturnPolicy() *ReturnPolicy {
	return &ReturnPolicy{
		ReturnWindowDays: 14,
		AllowedReasons: []ReturnReason{
			ReasonDefective, ReasonWrongItem, ReasonNotAsDescribed,
			ReasonDamaged, ReasonChangedMind, ReasonSizeFit,
		},
		RequireImages:        true,
		FreeReturn:           false,
		RestockingFeePercent: 0,
		AutoApprove:          false,
		AutoApproveMaxAmount: 500,
	}
}

// Repository interface for return storage
type Repository interface {
	Create(ctx context.Context, ret *ReturnRequest) error
	GetByID(ctx context.Context, id string) (*ReturnRequest, error)
	GetByOrderID(ctx context.Context, orderID string) ([]*ReturnRequest, error)
	GetByCustomerID(ctx context.Context, customerID string, limit, offset int) ([]*ReturnRequest, int, error)
	List(ctx context.Context, tenantID string, filter *ReturnFilter) ([]*ReturnRequest, int, error)
	Update(ctx context.Context, ret *ReturnRequest) error
	UpdateStatus(ctx context.Context, id string, status ReturnStatus, comment, updatedBy string) error
	AddHistoryEntry(ctx context.Context, entry *ReturnHistory) error
	GetHistory(ctx context.Context, returnID string) ([]*ReturnHistory, error)
	GetPolicy(ctx context.Context, tenantID string) (*ReturnPolicy, error)
	SavePolicy(ctx context.Context, policy *ReturnPolicy) error
}

// ReturnFilter for listing returns
type ReturnFilter struct {
	Status    ReturnStatus `json:"status,omitempty"`
	Reason    ReturnReason `json:"reason,omitempty"`
	DateFrom  *time.Time   `json:"date_from,omitempty"`
	DateTo    *time.Time   `json:"date_to,omitempty"`
	Search    string       `json:"search,omitempty"`
	Limit     int          `json:"limit"`
	Offset    int          `json:"offset"`
}

// ShippingProvider interface for creating return labels
type ShippingProvider interface {
	CreateReturnShipment(ctx context.Context, request *ReturnShipmentRequest) (*ReturnShipmentResponse, error)
	TrackShipment(ctx context.Context, trackingNumber string) (*ShipmentStatus, error)
}

// ReturnShipmentRequest for creating return shipment
type ReturnShipmentRequest struct {
	TenantID        string
	ReturnID        string
	SenderName      string
	SenderPhone     string
	SenderCity      string
	SenderAddress   string
	ReceiverName    string
	ReceiverPhone   string
	ReceiverCity    string
	ReceiverAddress string
	Weight          float64
	Description     string
}

// ReturnShipmentResponse from shipping provider
type ReturnShipmentResponse struct {
	ShipmentID     string `json:"shipment_id"`
	TrackingNumber string `json:"tracking_number"`
	LabelURL       string `json:"label_url,omitempty"`
	EstimatedCost  float64 `json:"estimated_cost"`
}

// ShipmentStatus from tracking
type ShipmentStatus struct {
	TrackingNumber string    `json:"tracking_number"`
	Status         string    `json:"status"`
	Location       string    `json:"location,omitempty"`
	UpdatedAt      time.Time `json:"updated_at"`
	Delivered      bool      `json:"delivered"`
}

// PaymentProvider interface for refunds
type PaymentProvider interface {
	ProcessRefund(ctx context.Context, request *RefundRequest) (*RefundResponse, error)
	GetRefundStatus(ctx context.Context, refundID string) (string, error)
}

// RefundRequest for processing refund
type RefundRequest struct {
	TenantID          string
	ReturnID          string
	OriginalPaymentID string
	Amount            float64
	Currency          string
	Reason            string
	Method            RefundMethod
	CustomerEmail     string
}

// RefundResponse from payment provider
type RefundResponse struct {
	RefundID   string    `json:"refund_id"`
	Status     string    `json:"status"`
	Amount     float64   `json:"amount"`
	ProcessedAt time.Time `json:"processed_at"`
}

// InventoryService interface for restocking
type InventoryService interface {
	RestockItem(ctx context.Context, tenantID, productID, variantID, warehouseID string, quantity int, notes string) error
	WriteOffItem(ctx context.Context, tenantID, productID, variantID, warehouseID string, quantity int, reason, notes string) error
}

// NotificationService interface for sending notifications
type NotificationService interface {
	SendReturnConfirmation(ctx context.Context, ret *ReturnRequest) error
	SendReturnStatusUpdate(ctx context.Context, ret *ReturnRequest, oldStatus ReturnStatus) error
	SendReturnLabelReady(ctx context.Context, ret *ReturnRequest) error
	SendRefundProcessed(ctx context.Context, ret *ReturnRequest) error
}

// Service handles return operations
type Service struct {
	repo         Repository
	shipping     ShippingProvider
	payment      PaymentProvider
	inventory    InventoryService
	notification NotificationService
}

// NewService creates a new return service
func NewService(repo Repository, shipping ShippingProvider, payment PaymentProvider, inventory InventoryService, notification NotificationService) *Service {
	return &Service{
		repo:         repo,
		shipping:     shipping,
		payment:      payment,
		inventory:    inventory,
		notification: notification,
	}
}

// CreateReturnRequest creates a new return request
func (s *Service) CreateReturnRequest(ctx context.Context, req *CreateReturnInput) (*ReturnRequest, error) {
	// Get return policy
	policy, err := s.repo.GetPolicy(ctx, req.TenantID)
	if err != nil {
		policy = DefaultReturnPolicy()
	}

	// Validate return window
	if req.OrderDate.Add(time.Duration(policy.ReturnWindowDays) * 24 * time.Hour).Before(time.Now()) {
		return nil, ErrReturnWindowExpired
	}

	// Calculate refund amount
	var totalRefund float64
	for i := range req.Items {
		itemRefund := req.Items[i].Price * float64(req.Items[i].Quantity)
		if policy.RestockingFeePercent > 0 {
			itemRefund -= itemRefund * policy.RestockingFeePercent / 100
		}
		req.Items[i].RefundAmount = itemRefund
		totalRefund += itemRefund
	}

	ret := &ReturnRequest{
		ID:            generateID(),
		TenantID:      req.TenantID,
		OrderID:       req.OrderID,
		OrderNumber:   req.OrderNumber,
		CustomerID:    req.CustomerID,
		CustomerEmail: req.CustomerEmail,
		CustomerPhone: req.CustomerPhone,
		CustomerName:  req.CustomerName,
		Status:        StatusPending,
		Reason:        req.Reason,
		ReasonDetails: req.ReasonDetails,
		RefundMethod:  req.RefundMethod,
		RefundAmount:  totalRefund,
		Items:         req.Items,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Auto-approve if enabled and under threshold
	if policy.AutoApprove && totalRefund <= policy.AutoApproveMaxAmount {
		ret.Status = StatusApproved
		now := time.Now()
		ret.ApprovedAt = &now
	}

	if err := s.repo.Create(ctx, ret); err != nil {
		return nil, err
	}

	// Add history entry
	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  ret.ID,
		Status:    ret.Status,
		Comment:   "Return request created",
		CreatedAt: time.Now(),
	})

	// Send notification
	if s.notification != nil {
		s.notification.SendReturnConfirmation(ctx, ret)
	}

	return ret, nil
}

// CreateReturnInput for creating return request
type CreateReturnInput struct {
	TenantID      string
	OrderID       string
	OrderNumber   string
	OrderDate     time.Time
	CustomerID    string
	CustomerEmail string
	CustomerPhone string
	CustomerName  string
	Reason        ReturnReason
	ReasonDetails string
	RefundMethod  RefundMethod
	Items         []ReturnItem
}

// ApproveReturn approves a return request
func (s *Service) ApproveReturn(ctx context.Context, id, approvedBy, notes string) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if ret.Status != StatusPending {
		return ErrInvalidStatus
	}

	oldStatus := ret.Status
	now := time.Now()
	ret.Status = StatusApproved
	ret.ApprovedAt = &now
	ret.ProcessedBy = approvedBy
	ret.AdminNotes = notes
	ret.UpdatedAt = now

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusApproved,
		Comment:   notes,
		CreatedBy: approvedBy,
		CreatedAt: now,
	})

	if s.notification != nil {
		s.notification.SendReturnStatusUpdate(ctx, ret, oldStatus)
	}

	return nil
}

// RejectReturn rejects a return request
func (s *Service) RejectReturn(ctx context.Context, id, rejectedBy, reason string) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if ret.Status != StatusPending {
		return ErrInvalidStatus
	}

	oldStatus := ret.Status
	ret.Status = StatusRejected
	ret.ProcessedBy = rejectedBy
	ret.AdminNotes = reason
	ret.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusRejected,
		Comment:   reason,
		CreatedBy: rejectedBy,
		CreatedAt: time.Now(),
	})

	if s.notification != nil {
		s.notification.SendReturnStatusUpdate(ctx, ret, oldStatus)
	}

	return nil
}

// CreateReturnShipment creates a return shipment with carrier
func (s *Service) CreateReturnShipment(ctx context.Context, id string, warehouseAddress *WarehouseAddress) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if ret.Status != StatusApproved {
		return ErrInvalidStatus
	}

	// Create shipment with shipping provider
	shipmentReq := &ReturnShipmentRequest{
		TenantID:        ret.TenantID,
		ReturnID:        ret.ID,
		SenderName:      ret.CustomerName,
		SenderPhone:     ret.CustomerPhone,
		ReceiverName:    warehouseAddress.Name,
		ReceiverPhone:   warehouseAddress.Phone,
		ReceiverCity:    warehouseAddress.City,
		ReceiverAddress: warehouseAddress.Address,
		Description:     fmt.Sprintf("Return %s", ret.ID[:8]),
	}

	resp, err := s.shipping.CreateReturnShipment(ctx, shipmentReq)
	if err != nil {
		return err
	}

	ret.Status = StatusShipmentCreated
	ret.ReturnShipmentID = resp.ShipmentID
	ret.ReturnTrackingNumber = resp.TrackingNumber
	ret.LabelURL = resp.LabelURL
	ret.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusShipmentCreated,
		Comment:   fmt.Sprintf("Return shipment created: %s", resp.TrackingNumber),
		CreatedAt: time.Now(),
	})

	if s.notification != nil {
		s.notification.SendReturnLabelReady(ctx, ret)
	}

	return nil
}

// WarehouseAddress for return shipment
type WarehouseAddress struct {
	Name    string
	Phone   string
	City    string
	Address string
}

// ReceiveReturn marks return as received at warehouse
func (s *Service) ReceiveReturn(ctx context.Context, id, receivedBy string) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	now := time.Now()
	ret.Status = StatusReceived
	ret.ReceivedAt = &now
	ret.UpdatedAt = now

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusReceived,
		Comment:   "Package received at warehouse",
		CreatedBy: receivedBy,
		CreatedAt: now,
	})

	return nil
}

// InspectReturn records inspection results
func (s *Service) InspectReturn(ctx context.Context, id string, input *InspectionInput) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if ret.Status != StatusReceived && ret.Status != StatusInspecting {
		return ErrInvalidStatus
	}

	now := time.Now()
	ret.Status = StatusInspecting
	ret.InspectionNotes = input.Notes
	ret.InspectedBy = input.InspectedBy
	ret.InspectedAt = &now
	ret.UpdatedAt = now

	// Update item conditions and decisions
	for i := range ret.Items {
		for _, itemInput := range input.Items {
			if ret.Items[i].ID == itemInput.ItemID {
				ret.Items[i].Condition = itemInput.Condition
				ret.Items[i].Decision = itemInput.Decision
				ret.Items[i].DecisionNotes = itemInput.Notes
				ret.Items[i].DecisionBy = input.InspectedBy
				ret.Items[i].DecisionAt = &now
			}
		}
	}

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusInspecting,
		Comment:   input.Notes,
		CreatedBy: input.InspectedBy,
		CreatedAt: now,
	})

	return nil
}

// InspectionInput for recording inspection
type InspectionInput struct {
	InspectedBy string
	Notes       string
	Items       []ItemInspection
}

// ItemInspection for individual item inspection
type ItemInspection struct {
	ItemID    string
	Condition ItemCondition
	Decision  string // restock, damage, dispose
	Notes     string
}

// ApproveRefund approves return for refund
func (s *Service) ApproveRefund(ctx context.Context, id, approvedBy string) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if ret.Status != StatusInspecting {
		return ErrInvalidStatus
	}

	ret.Status = StatusApprovedForRefund
	ret.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	// Process inventory
	if s.inventory != nil {
		for _, item := range ret.Items {
			switch item.Decision {
			case "restock":
				s.inventory.RestockItem(ctx, ret.TenantID, item.ProductID, item.VariantID, "", item.Quantity, item.DecisionNotes)
			case "damage", "dispose":
				s.inventory.WriteOffItem(ctx, ret.TenantID, item.ProductID, item.VariantID, "", item.Quantity, item.Decision, item.DecisionNotes)
			}
		}
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusApprovedForRefund,
		Comment:   "Approved for refund",
		CreatedBy: approvedBy,
		CreatedAt: time.Now(),
	})

	return nil
}

// ProcessRefund processes the refund
func (s *Service) ProcessRefund(ctx context.Context, id, processedBy, originalPaymentID string) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if ret.Status != StatusApprovedForRefund {
		return ErrInvalidStatus
	}

	// Process refund with payment provider
	refundReq := &RefundRequest{
		TenantID:          ret.TenantID,
		ReturnID:          ret.ID,
		OriginalPaymentID: originalPaymentID,
		Amount:            ret.RefundAmount,
		Currency:          "UAH",
		Reason:            string(ret.Reason),
		Method:            ret.RefundMethod,
		CustomerEmail:     ret.CustomerEmail,
	}

	resp, err := s.payment.ProcessRefund(ctx, refundReq)
	if err != nil {
		return ErrRefundFailed
	}

	now := time.Now()
	ret.Status = StatusRefunded
	ret.RefundID = resp.RefundID
	ret.RefundStatus = resp.Status
	ret.RefundedAt = &now
	ret.UpdatedAt = now

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusRefunded,
		Comment:   fmt.Sprintf("Refund processed: %s", resp.RefundID),
		CreatedBy: processedBy,
		CreatedAt: now,
	})

	if s.notification != nil {
		s.notification.SendRefundProcessed(ctx, ret)
	}

	return nil
}

// CompleteReturn marks return as completed
func (s *Service) CompleteReturn(ctx context.Context, id, completedBy string) error {
	ret, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	now := time.Now()
	ret.Status = StatusCompleted
	ret.CompletedAt = &now
	ret.UpdatedAt = now

	if err := s.repo.Update(ctx, ret); err != nil {
		return err
	}

	s.repo.AddHistoryEntry(ctx, &ReturnHistory{
		ID:        generateID(),
		ReturnID:  id,
		Status:    StatusCompleted,
		Comment:   "Return completed",
		CreatedBy: completedBy,
		CreatedAt: now,
	})

	return nil
}

// GetReturn retrieves a return by ID
func (s *Service) GetReturn(ctx context.Context, id string) (*ReturnRequest, error) {
	return s.repo.GetByID(ctx, id)
}

// GetReturnsByOrder retrieves returns by order ID
func (s *Service) GetReturnsByOrder(ctx context.Context, orderID string) ([]*ReturnRequest, error) {
	return s.repo.GetByOrderID(ctx, orderID)
}

// GetCustomerReturns retrieves returns for a customer
func (s *Service) GetCustomerReturns(ctx context.Context, customerID string, limit, offset int) ([]*ReturnRequest, int, error) {
	return s.repo.GetByCustomerID(ctx, customerID, limit, offset)
}

// ListReturns lists returns with filters
func (s *Service) ListReturns(ctx context.Context, tenantID string, filter *ReturnFilter) ([]*ReturnRequest, int, error) {
	return s.repo.List(ctx, tenantID, filter)
}

// GetReturnHistory retrieves return history
func (s *Service) GetReturnHistory(ctx context.Context, returnID string) ([]*ReturnHistory, error) {
	return s.repo.GetHistory(ctx, returnID)
}

// GetReturnStats retrieves return statistics
func (s *Service) GetReturnStats(ctx context.Context, tenantID string, from, to time.Time) (*ReturnStats, error) {
	// This would be implemented with proper queries
	return &ReturnStats{
		TenantID:     tenantID,
		Period:       fmt.Sprintf("%s - %s", from.Format("2006-01-02"), to.Format("2006-01-02")),
	}, nil
}

// ReturnStats represents return statistics
type ReturnStats struct {
	TenantID       string             `json:"tenant_id"`
	Period         string             `json:"period"`
	TotalReturns   int                `json:"total_returns"`
	PendingReturns int                `json:"pending_returns"`
	CompletedReturns int              `json:"completed_returns"`
	TotalRefunded  float64            `json:"total_refunded"`
	ByReason       map[string]int     `json:"by_reason"`
	ByStatus       map[string]int     `json:"by_status"`
	AverageProcessingDays float64     `json:"average_processing_days"`
	ReturnRate     float64            `json:"return_rate"` // percentage
}

// Helper function to generate unique ID
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// PostgresRepository implements Repository using PostgreSQL
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a new PostgreSQL repository
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// Create creates a new return request
func (r *PostgresRepository) Create(ctx context.Context, ret *ReturnRequest) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO return_requests (
			id, tenant_id, order_id, order_number, customer_id,
			customer_email, customer_phone, customer_name,
			status, reason, reason_details, refund_method, refund_amount,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err = tx.ExecContext(ctx, query,
		ret.ID, ret.TenantID, ret.OrderID, ret.OrderNumber, ret.CustomerID,
		ret.CustomerEmail, ret.CustomerPhone, ret.CustomerName,
		ret.Status, ret.Reason, ret.ReasonDetails, ret.RefundMethod, ret.RefundAmount,
		ret.CreatedAt, ret.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// Insert items
	for _, item := range ret.Items {
		itemQuery := `
			INSERT INTO return_items (
				id, return_id, order_item_id, product_id, variant_id,
				sku, name, quantity, price, refund_amount, reason, notes
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`
		_, err = tx.ExecContext(ctx, itemQuery,
			item.ID, ret.ID, item.OrderItemID, item.ProductID, item.VariantID,
			item.SKU, item.Name, item.Quantity, item.Price, item.RefundAmount,
			item.Reason, item.Notes,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetByID retrieves return by ID
func (r *PostgresRepository) GetByID(ctx context.Context, id string) (*ReturnRequest, error) {
	query := `
		SELECT id, tenant_id, order_id, order_number, customer_id,
			   customer_email, customer_phone, customer_name,
			   status, reason, reason_details,
			   return_tracking_number, return_carrier, return_shipment_id, label_url,
			   inspection_notes, inspected_by, inspected_at,
			   refund_method, refund_amount, refund_status, refund_id, refunded_at,
			   admin_notes, processed_by,
			   created_at, updated_at, approved_at, received_at, completed_at
		FROM return_requests WHERE id = $1
	`

	var ret ReturnRequest
	var trackingNumber, carrier, shipmentID, labelURL sql.NullString
	var inspectionNotes, inspectedBy sql.NullString
	var refundStatus, refundID sql.NullString
	var adminNotes, processedBy sql.NullString
	var inspectedAt, refundedAt, approvedAt, receivedAt, completedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&ret.ID, &ret.TenantID, &ret.OrderID, &ret.OrderNumber, &ret.CustomerID,
		&ret.CustomerEmail, &ret.CustomerPhone, &ret.CustomerName,
		&ret.Status, &ret.Reason, &ret.ReasonDetails,
		&trackingNumber, &carrier, &shipmentID, &labelURL,
		&inspectionNotes, &inspectedBy, &inspectedAt,
		&ret.RefundMethod, &ret.RefundAmount, &refundStatus, &refundID, &refundedAt,
		&adminNotes, &processedBy,
		&ret.CreatedAt, &ret.UpdatedAt, &approvedAt, &receivedAt, &completedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrReturnNotFound
	}
	if err != nil {
		return nil, err
	}

	// Set nullable fields
	if trackingNumber.Valid {
		ret.ReturnTrackingNumber = trackingNumber.String
	}
	if carrier.Valid {
		ret.ReturnCarrier = carrier.String
	}
	if shipmentID.Valid {
		ret.ReturnShipmentID = shipmentID.String
	}
	if labelURL.Valid {
		ret.LabelURL = labelURL.String
	}
	if inspectionNotes.Valid {
		ret.InspectionNotes = inspectionNotes.String
	}
	if inspectedBy.Valid {
		ret.InspectedBy = inspectedBy.String
	}
	if inspectedAt.Valid {
		ret.InspectedAt = &inspectedAt.Time
	}
	if refundStatus.Valid {
		ret.RefundStatus = refundStatus.String
	}
	if refundID.Valid {
		ret.RefundID = refundID.String
	}
	if refundedAt.Valid {
		ret.RefundedAt = &refundedAt.Time
	}
	if adminNotes.Valid {
		ret.AdminNotes = adminNotes.String
	}
	if processedBy.Valid {
		ret.ProcessedBy = processedBy.String
	}
	if approvedAt.Valid {
		ret.ApprovedAt = &approvedAt.Time
	}
	if receivedAt.Valid {
		ret.ReceivedAt = &receivedAt.Time
	}
	if completedAt.Valid {
		ret.CompletedAt = &completedAt.Time
	}

	// Get items
	itemsQuery := `
		SELECT id, return_id, order_item_id, product_id, variant_id,
			   sku, name, quantity, price, refund_amount, reason, condition,
			   notes, decision, decision_notes, decision_by, decision_at
		FROM return_items WHERE return_id = $1
	`
	rows, err := r.db.QueryContext(ctx, itemsQuery, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item ReturnItem
		var variantID, condition, notes, decision, decisionNotes, decisionBy sql.NullString
		var decisionAt sql.NullTime

		err := rows.Scan(
			&item.ID, &item.ReturnID, &item.OrderItemID, &item.ProductID, &variantID,
			&item.SKU, &item.Name, &item.Quantity, &item.Price, &item.RefundAmount,
			&item.Reason, &condition, &notes, &decision, &decisionNotes, &decisionBy, &decisionAt,
		)
		if err != nil {
			return nil, err
		}

		if variantID.Valid {
			item.VariantID = variantID.String
		}
		if condition.Valid {
			item.Condition = ItemCondition(condition.String)
		}
		if notes.Valid {
			item.Notes = notes.String
		}
		if decision.Valid {
			item.Decision = decision.String
		}
		if decisionNotes.Valid {
			item.DecisionNotes = decisionNotes.String
		}
		if decisionBy.Valid {
			item.DecisionBy = decisionBy.String
		}
		if decisionAt.Valid {
			item.DecisionAt = &decisionAt.Time
		}

		ret.Items = append(ret.Items, item)
	}

	return &ret, nil
}

// GetByOrderID retrieves returns by order ID
func (r *PostgresRepository) GetByOrderID(ctx context.Context, orderID string) ([]*ReturnRequest, error) {
	query := `SELECT id FROM return_requests WHERE order_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var returns []*ReturnRequest
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ret, err := r.GetByID(ctx, id)
		if err != nil {
			return nil, err
		}
		returns = append(returns, ret)
	}

	return returns, nil
}

// GetByCustomerID retrieves returns by customer ID
func (r *PostgresRepository) GetByCustomerID(ctx context.Context, customerID string, limit, offset int) ([]*ReturnRequest, int, error) {
	var total int
	countQuery := `SELECT COUNT(*) FROM return_requests WHERE customer_id = $1`
	if err := r.db.QueryRowContext(ctx, countQuery, customerID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `SELECT id FROM return_requests WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.QueryContext(ctx, query, customerID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var returns []*ReturnRequest
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, 0, err
		}
		ret, err := r.GetByID(ctx, id)
		if err != nil {
			return nil, 0, err
		}
		returns = append(returns, ret)
	}

	return returns, total, nil
}

// List lists returns with filters
func (r *PostgresRepository) List(ctx context.Context, tenantID string, filter *ReturnFilter) ([]*ReturnRequest, int, error) {
	// Build query with filters
	baseQuery := `FROM return_requests WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIndex := 2

	if filter.Status != "" {
		baseQuery += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, filter.Status)
		argIndex++
	}

	if filter.Reason != "" {
		baseQuery += fmt.Sprintf(" AND reason = $%d", argIndex)
		args = append(args, filter.Reason)
		argIndex++
	}

	if filter.DateFrom != nil {
		baseQuery += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		args = append(args, filter.DateFrom)
		argIndex++
	}

	if filter.DateTo != nil {
		baseQuery += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		args = append(args, filter.DateTo)
		argIndex++
	}

	if filter.Search != "" {
		baseQuery += fmt.Sprintf(" AND (order_number ILIKE $%d OR customer_name ILIKE $%d OR customer_email ILIKE $%d)", argIndex, argIndex, argIndex)
		args = append(args, "%"+filter.Search+"%")
		argIndex++
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get IDs
	listQuery := "SELECT id " + baseQuery + " ORDER BY created_at DESC"
	if filter.Limit > 0 {
		listQuery += fmt.Sprintf(" LIMIT %d", filter.Limit)
	}
	if filter.Offset > 0 {
		listQuery += fmt.Sprintf(" OFFSET %d", filter.Offset)
	}

	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var returns []*ReturnRequest
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, 0, err
		}
		ret, err := r.GetByID(ctx, id)
		if err != nil {
			return nil, 0, err
		}
		returns = append(returns, ret)
	}

	return returns, total, nil
}

// Update updates a return request
func (r *PostgresRepository) Update(ctx context.Context, ret *ReturnRequest) error {
	query := `
		UPDATE return_requests SET
			status = $2, reason = $3, reason_details = $4,
			return_tracking_number = $5, return_carrier = $6, return_shipment_id = $7, label_url = $8,
			inspection_notes = $9, inspected_by = $10, inspected_at = $11,
			refund_method = $12, refund_amount = $13, refund_status = $14, refund_id = $15, refunded_at = $16,
			admin_notes = $17, processed_by = $18,
			updated_at = $19, approved_at = $20, received_at = $21, completed_at = $22
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		ret.ID, ret.Status, ret.Reason, ret.ReasonDetails,
		nullString(ret.ReturnTrackingNumber), nullString(ret.ReturnCarrier),
		nullString(ret.ReturnShipmentID), nullString(ret.LabelURL),
		nullString(ret.InspectionNotes), nullString(ret.InspectedBy), ret.InspectedAt,
		ret.RefundMethod, ret.RefundAmount, nullString(ret.RefundStatus),
		nullString(ret.RefundID), ret.RefundedAt,
		nullString(ret.AdminNotes), nullString(ret.ProcessedBy),
		ret.UpdatedAt, ret.ApprovedAt, ret.ReceivedAt, ret.CompletedAt,
	)
	return err
}

// UpdateStatus updates return status
func (r *PostgresRepository) UpdateStatus(ctx context.Context, id string, status ReturnStatus, comment, updatedBy string) error {
	query := `UPDATE return_requests SET status = $2, admin_notes = $3, processed_by = $4, updated_at = $5 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, status, comment, updatedBy, time.Now())
	return err
}

// AddHistoryEntry adds a history entry
func (r *PostgresRepository) AddHistoryEntry(ctx context.Context, entry *ReturnHistory) error {
	query := `
		INSERT INTO return_history (id, return_id, status, comment, created_by, created_at, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.db.ExecContext(ctx, query,
		entry.ID, entry.ReturnID, entry.Status, entry.Comment,
		entry.CreatedBy, entry.CreatedAt, entry.Metadata,
	)
	return err
}

// GetHistory retrieves return history
func (r *PostgresRepository) GetHistory(ctx context.Context, returnID string) ([]*ReturnHistory, error) {
	query := `
		SELECT id, return_id, status, comment, created_by, created_at, metadata
		FROM return_history WHERE return_id = $1 ORDER BY created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, returnID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*ReturnHistory
	for rows.Next() {
		var entry ReturnHistory
		var createdBy sql.NullString
		if err := rows.Scan(&entry.ID, &entry.ReturnID, &entry.Status, &entry.Comment, &createdBy, &entry.CreatedAt, &entry.Metadata); err != nil {
			return nil, err
		}
		if createdBy.Valid {
			entry.CreatedBy = createdBy.String
		}
		history = append(history, &entry)
	}

	return history, nil
}

// GetPolicy retrieves return policy
func (r *PostgresRepository) GetPolicy(ctx context.Context, tenantID string) (*ReturnPolicy, error) {
	query := `SELECT settings FROM return_policies WHERE tenant_id = $1`
	var settings []byte
	err := r.db.QueryRowContext(ctx, query, tenantID).Scan(&settings)
	if err == sql.ErrNoRows {
		return nil, errors.New("policy not found")
	}
	if err != nil {
		return nil, err
	}

	var policy ReturnPolicy
	if err := json.Unmarshal(settings, &policy); err != nil {
		return nil, err
	}
	policy.TenantID = tenantID
	return &policy, nil
}

// SavePolicy saves return policy
func (r *PostgresRepository) SavePolicy(ctx context.Context, policy *ReturnPolicy) error {
	settings, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO return_policies (tenant_id, settings, updated_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (tenant_id) DO UPDATE SET settings = $2, updated_at = $3
	`
	_, err = r.db.ExecContext(ctx, query, policy.TenantID, settings, time.Now())
	return err
}

// Helper to convert empty string to NULL
func nullString(s string) sql.NullString {
	return sql.NullString{
		String: s,
		Valid:  s != "",
	}
}
