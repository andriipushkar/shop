package returns

import (
	"context"
	"testing"
	"time"
)

// MockReturnRepository for testing
type MockReturnRepository struct {
	returns map[string]*ReturnRequest
	items   map[string][]*ReturnItem
	history map[string][]*ReturnHistory
}

func NewMockReturnRepository() *MockReturnRepository {
	return &MockReturnRepository{
		returns: make(map[string]*ReturnRequest),
		items:   make(map[string][]*ReturnItem),
		history: make(map[string][]*ReturnHistory),
	}
}

func (m *MockReturnRepository) Create(ctx context.Context, req *ReturnRequest) error {
	m.returns[req.ID] = req
	return nil
}

func (m *MockReturnRepository) GetByID(ctx context.Context, id string) (*ReturnRequest, error) {
	if r, ok := m.returns[id]; ok {
		return r, nil
	}
	return nil, ErrReturnNotFound
}

func (m *MockReturnRepository) Update(ctx context.Context, req *ReturnRequest) error {
	m.returns[req.ID] = req
	return nil
}

func (m *MockReturnRepository) List(ctx context.Context, filter ReturnFilter) ([]*ReturnRequest, int, error) {
	var result []*ReturnRequest
	for _, r := range m.returns {
		if filter.TenantID != "" && r.TenantID != filter.TenantID {
			continue
		}
		if filter.Status != "" && r.Status != ReturnStatus(filter.Status) {
			continue
		}
		result = append(result, r)
	}
	return result, len(result), nil
}

func (m *MockReturnRepository) AddItem(ctx context.Context, item *ReturnItem) error {
	m.items[item.ReturnID] = append(m.items[item.ReturnID], item)
	return nil
}

func (m *MockReturnRepository) GetItems(ctx context.Context, returnID string) ([]*ReturnItem, error) {
	return m.items[returnID], nil
}

func (m *MockReturnRepository) UpdateItem(ctx context.Context, item *ReturnItem) error {
	items := m.items[item.ReturnID]
	for i, it := range items {
		if it.ID == item.ID {
			items[i] = item
			break
		}
	}
	return nil
}

func (m *MockReturnRepository) AddHistory(ctx context.Context, history *ReturnHistory) error {
	m.history[history.ReturnID] = append(m.history[history.ReturnID], history)
	return nil
}

func (m *MockReturnRepository) GetHistory(ctx context.Context, returnID string) ([]*ReturnHistory, error) {
	return m.history[returnID], nil
}

func (m *MockReturnRepository) GetPolicy(ctx context.Context, tenantID string) (*ReturnPolicy, error) {
	return &ReturnPolicy{
		TenantID:          tenantID,
		ReturnWindowDays:  14,
		AllowedReasons:    []string{"defective", "wrong_item", "not_as_described", "changed_mind"},
		RequirePhotos:     true,
		AutoApproveUnder:  5000,
		RestockingFeeRate: 0,
	}, nil
}

func (m *MockReturnRepository) SavePolicy(ctx context.Context, policy *ReturnPolicy) error {
	return nil
}

// MockShippingProvider for testing
type MockShippingProvider struct {
	shipments map[string]*ShipmentInfo
}

func NewMockShippingProvider() *MockShippingProvider {
	return &MockShippingProvider{
		shipments: make(map[string]*ShipmentInfo),
	}
}

func (m *MockShippingProvider) CreateReturnShipment(ctx context.Context, req *ReturnRequest) (*ShipmentInfo, error) {
	info := &ShipmentInfo{
		TrackingNumber: "TTN-" + req.ID,
		Carrier:        "Nova Poshta",
		LabelURL:       "https://labels.novaposhta.ua/" + req.ID,
		EstimatedDays:  3,
	}
	m.shipments[req.ID] = info
	return info, nil
}

func (m *MockShippingProvider) GetShipmentStatus(ctx context.Context, trackingNumber string) (string, error) {
	return "in_transit", nil
}

// MockPaymentProvider for testing
type MockPaymentProvider struct {
	refunds map[string]float64
}

func NewMockPaymentProvider() *MockPaymentProvider {
	return &MockPaymentProvider{
		refunds: make(map[string]float64),
	}
}

func (m *MockPaymentProvider) ProcessRefund(ctx context.Context, req *ReturnRequest, amount float64) (string, error) {
	refundID := "refund-" + req.ID
	m.refunds[refundID] = amount
	return refundID, nil
}

// MockInventoryService for testing
type MockInventoryService struct {
	restocked  map[string]int
	writtenOff map[string]int
}

func NewMockInventoryService() *MockInventoryService {
	return &MockInventoryService{
		restocked:  make(map[string]int),
		writtenOff: make(map[string]int),
	}
}

func (m *MockInventoryService) Restock(ctx context.Context, productID, variantID string, quantity int) error {
	key := productID + ":" + variantID
	m.restocked[key] = quantity
	return nil
}

func (m *MockInventoryService) WriteOff(ctx context.Context, productID, variantID string, quantity int, reason string) error {
	key := productID + ":" + variantID
	m.writtenOff[key] = quantity
	return nil
}

// MockNotificationService for testing
type MockNotificationService struct {
	notifications []string
}

func NewMockNotificationService() *MockNotificationService {
	return &MockNotificationService{
		notifications: make([]string, 0),
	}
}

func (m *MockNotificationService) SendReturnStatusUpdate(ctx context.Context, req *ReturnRequest, status ReturnStatus) error {
	m.notifications = append(m.notifications, string(status))
	return nil
}

func TestRMAService_CreateRequest(t *testing.T) {
	repo := NewMockReturnRepository()
	shipping := NewMockShippingProvider()
	payment := NewMockPaymentProvider()
	inventory := NewMockInventoryService()
	notifier := NewMockNotificationService()

	service := NewRMAService(repo, shipping, payment, inventory, notifier)

	input := CreateReturnInput{
		TenantID:      "tenant-1",
		OrderID:       "order-123",
		OrderNumber:   "ORD-2024-001",
		CustomerEmail: "customer@example.com",
		CustomerName:  "John Doe",
		Reason:        ReasonDefective,
		ReasonDetails: "Screen is cracked",
		Items: []ReturnItemInput{
			{
				ProductID:    "prod-1",
				SKU:          "SKU-001",
				Name:         "iPhone Case",
				Quantity:     1,
				Price:        1500,
				RefundAmount: 1500,
				Reason:       string(ReasonDefective),
			},
		},
	}

	req, err := service.CreateRequest(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if req.Status != StatusPending {
		t.Errorf("expected status %s, got %s", StatusPending, req.Status)
	}

	if req.OrderID != input.OrderID {
		t.Errorf("expected order ID %s, got %s", input.OrderID, req.OrderID)
	}

	if req.RefundAmount != 1500 {
		t.Errorf("expected refund amount 1500, got %f", req.RefundAmount)
	}

	// Check history was created
	history, _ := repo.GetHistory(context.Background(), req.ID)
	if len(history) != 1 {
		t.Error("expected 1 history entry")
	}
}

func TestRMAService_ApproveRequest(t *testing.T) {
	repo := NewMockReturnRepository()
	shipping := NewMockShippingProvider()
	payment := NewMockPaymentProvider()
	inventory := NewMockInventoryService()
	notifier := NewMockNotificationService()

	service := NewRMAService(repo, shipping, payment, inventory, notifier)

	// Create a pending request
	req := &ReturnRequest{
		ID:            "return-1",
		TenantID:      "tenant-1",
		OrderID:       "order-1",
		CustomerEmail: "test@example.com",
		Status:        StatusPending,
		Reason:        ReasonDefective,
		RefundAmount:  1000,
	}
	repo.returns[req.ID] = req

	// Approve
	err := service.ApproveRequest(context.Background(), "return-1", "admin-1", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.returns["return-1"]
	if updated.Status != StatusApproved {
		t.Errorf("expected status %s, got %s", StatusApproved, updated.Status)
	}

	if updated.ApprovedAt == nil {
		t.Error("expected approved_at to be set")
	}
}

func TestRMAService_CreateShipment(t *testing.T) {
	repo := NewMockReturnRepository()
	shipping := NewMockShippingProvider()
	payment := NewMockPaymentProvider()
	inventory := NewMockInventoryService()
	notifier := NewMockNotificationService()

	service := NewRMAService(repo, shipping, payment, inventory, notifier)

	// Create an approved request
	req := &ReturnRequest{
		ID:            "return-1",
		TenantID:      "tenant-1",
		OrderID:       "order-1",
		CustomerEmail: "test@example.com",
		Status:        StatusApproved,
	}
	repo.returns[req.ID] = req

	// Create shipment
	info, err := service.CreateShipment(context.Background(), "return-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if info.TrackingNumber != "TTN-return-1" {
		t.Errorf("expected tracking number TTN-return-1, got %s", info.TrackingNumber)
	}

	updated := repo.returns["return-1"]
	if updated.Status != StatusShipmentCreated {
		t.Errorf("expected status %s, got %s", StatusShipmentCreated, updated.Status)
	}

	if updated.ReturnTrackingNumber != info.TrackingNumber {
		t.Error("expected tracking number to be saved")
	}
}

func TestRMAService_MarkReceived(t *testing.T) {
	repo := NewMockReturnRepository()
	shipping := NewMockShippingProvider()
	payment := NewMockPaymentProvider()
	inventory := NewMockInventoryService()
	notifier := NewMockNotificationService()

	service := NewRMAService(repo, shipping, payment, inventory, notifier)

	req := &ReturnRequest{
		ID:       "return-1",
		TenantID: "tenant-1",
		Status:   StatusInTransit,
	}
	repo.returns[req.ID] = req

	err := service.MarkReceived(context.Background(), "return-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.returns["return-1"]
	if updated.Status != StatusReceived {
		t.Errorf("expected status %s, got %s", StatusReceived, updated.Status)
	}

	if updated.ReceivedAt == nil {
		t.Error("expected received_at to be set")
	}
}

func TestRMAService_InspectItems(t *testing.T) {
	repo := NewMockReturnRepository()
	shipping := NewMockShippingProvider()
	payment := NewMockPaymentProvider()
	inventory := NewMockInventoryService()
	notifier := NewMockNotificationService()

	service := NewRMAService(repo, shipping, payment, inventory, notifier)

	req := &ReturnRequest{
		ID:       "return-1",
		TenantID: "tenant-1",
		Status:   StatusReceived,
	}
	repo.returns[req.ID] = req

	item := &ReturnItem{
		ID:        "item-1",
		ReturnID:  "return-1",
		ProductID: "prod-1",
		Quantity:  1,
	}
	repo.items["return-1"] = []*ReturnItem{item}

	inspections := []ItemInspection{
		{
			ItemID:    "item-1",
			Decision:  DecisionRestock,
			Condition: "good",
			Notes:     "Item is in good condition",
		},
	}

	err := service.InspectItems(context.Background(), "return-1", "warehouse-1", inspections)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.returns["return-1"]
	if updated.Status != StatusApprovedForRefund {
		t.Errorf("expected status %s, got %s", StatusApprovedForRefund, updated.Status)
	}

	// Check item was restocked
	if inventory.restocked["prod-1:"] != 1 {
		t.Error("expected item to be restocked")
	}
}

func TestRMAService_ProcessRefund(t *testing.T) {
	repo := NewMockReturnRepository()
	shipping := NewMockShippingProvider()
	payment := NewMockPaymentProvider()
	inventory := NewMockInventoryService()
	notifier := NewMockNotificationService()

	service := NewRMAService(repo, shipping, payment, inventory, notifier)

	req := &ReturnRequest{
		ID:           "return-1",
		TenantID:     "tenant-1",
		Status:       StatusApprovedForRefund,
		RefundAmount: 1500,
		RefundMethod: RefundMethodOriginal,
	}
	repo.returns[req.ID] = req

	err := service.ProcessRefund(context.Background(), "return-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.returns["return-1"]
	if updated.Status != StatusRefunded {
		t.Errorf("expected status %s, got %s", StatusRefunded, updated.Status)
	}

	if updated.RefundID != "refund-return-1" {
		t.Errorf("expected refund ID, got %s", updated.RefundID)
	}

	// Check refund was processed
	if payment.refunds["refund-return-1"] != 1500 {
		t.Error("expected refund to be processed")
	}
}

func TestRMAService_RejectRequest(t *testing.T) {
	repo := NewMockReturnRepository()
	shipping := NewMockShippingProvider()
	payment := NewMockPaymentProvider()
	inventory := NewMockInventoryService()
	notifier := NewMockNotificationService()

	service := NewRMAService(repo, shipping, payment, inventory, notifier)

	req := &ReturnRequest{
		ID:       "return-1",
		TenantID: "tenant-1",
		Status:   StatusPending,
	}
	repo.returns[req.ID] = req

	err := service.RejectRequest(context.Background(), "return-1", "admin-1", "Item was used")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.returns["return-1"]
	if updated.Status != StatusRejected {
		t.Errorf("expected status %s, got %s", StatusRejected, updated.Status)
	}

	if updated.AdminNotes != "Item was used" {
		t.Error("expected admin notes to be set")
	}
}

func TestRMAService_StatusTransitions(t *testing.T) {
	tests := []struct {
		name        string
		fromStatus  ReturnStatus
		action      string
		toStatus    ReturnStatus
		shouldError bool
	}{
		{"approve pending", StatusPending, "approve", StatusApproved, false},
		{"reject pending", StatusPending, "reject", StatusRejected, false},
		{"create shipment after approval", StatusApproved, "create_shipment", StatusShipmentCreated, false},
		{"receive after in transit", StatusInTransit, "receive", StatusReceived, false},
		{"cannot approve already approved", StatusApproved, "approve", StatusApproved, true},
		{"cannot receive pending", StatusPending, "receive", StatusReceived, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := NewMockReturnRepository()
			shipping := NewMockShippingProvider()
			payment := NewMockPaymentProvider()
			inventory := NewMockInventoryService()
			notifier := NewMockNotificationService()

			service := NewRMAService(repo, shipping, payment, inventory, notifier)

			req := &ReturnRequest{
				ID:       "return-1",
				TenantID: "tenant-1",
				Status:   tt.fromStatus,
			}
			repo.returns[req.ID] = req

			var err error
			switch tt.action {
			case "approve":
				err = service.ApproveRequest(context.Background(), "return-1", "admin-1", "")
			case "reject":
				err = service.RejectRequest(context.Background(), "return-1", "admin-1", "reason")
			case "create_shipment":
				_, err = service.CreateShipment(context.Background(), "return-1")
			case "receive":
				err = service.MarkReceived(context.Background(), "return-1")
			}

			if tt.shouldError && err == nil {
				t.Error("expected error but got none")
			}
			if !tt.shouldError && err != nil {
				t.Errorf("expected no error, got %v", err)
			}
		})
	}
}

func TestReturnPolicy_IsReasonAllowed(t *testing.T) {
	policy := &ReturnPolicy{
		AllowedReasons: []string{"defective", "wrong_item"},
	}

	if !policy.IsReasonAllowed("defective") {
		t.Error("expected defective to be allowed")
	}

	if policy.IsReasonAllowed("changed_mind") {
		t.Error("expected changed_mind to not be allowed")
	}
}

func TestReturnPolicy_IsWithinReturnWindow(t *testing.T) {
	policy := &ReturnPolicy{
		ReturnWindowDays: 14,
	}

	// Order from 10 days ago - should be allowed
	orderDate := time.Now().AddDate(0, 0, -10)
	if !policy.IsWithinReturnWindow(orderDate) {
		t.Error("expected order from 10 days ago to be within window")
	}

	// Order from 20 days ago - should not be allowed
	oldOrderDate := time.Now().AddDate(0, 0, -20)
	if policy.IsWithinReturnWindow(oldOrderDate) {
		t.Error("expected order from 20 days ago to be outside window")
	}
}
