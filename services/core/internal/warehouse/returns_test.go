package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockReturnRepository implements ReturnRepository for testing
type mockReturnRepository struct {
	returns  map[string]*ReturnRequest
	policies map[string]*ReturnPolicy
	labels   map[string]*ReturnLabel
}

func newMockReturnRepository() *mockReturnRepository {
	return &mockReturnRepository{
		returns:  make(map[string]*ReturnRequest),
		policies: make(map[string]*ReturnPolicy),
		labels:   make(map[string]*ReturnLabel),
	}
}

func (m *mockReturnRepository) CreateReturn(ctx context.Context, r *ReturnRequest) error {
	m.returns[r.ID] = r
	return nil
}

func (m *mockReturnRepository) UpdateReturn(ctx context.Context, r *ReturnRequest) error {
	m.returns[r.ID] = r
	return nil
}

func (m *mockReturnRepository) GetReturn(ctx context.Context, id string) (*ReturnRequest, error) {
	if r, ok := m.returns[id]; ok {
		return r, nil
	}
	return nil, ErrReturnNotFound
}

func (m *mockReturnRepository) GetReturnByOrder(ctx context.Context, orderID string) ([]*ReturnRequest, error) {
	result := make([]*ReturnRequest, 0)
	for _, r := range m.returns {
		if r.OrderID == orderID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *mockReturnRepository) GetReturnsByCustomer(ctx context.Context, customerID string, limit int) ([]*ReturnRequest, error) {
	result := make([]*ReturnRequest, 0)
	for _, r := range m.returns {
		if r.CustomerID == customerID {
			result = append(result, r)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockReturnRepository) ListReturns(ctx context.Context, status ReturnStatus, warehouseID string, limit, offset int) ([]*ReturnRequest, error) {
	result := make([]*ReturnRequest, 0)
	for _, r := range m.returns {
		if (status == "" || r.Status == status) && (warehouseID == "" || r.WarehouseID == warehouseID) {
			result = append(result, r)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockReturnRepository) GetReturnStats(ctx context.Context, warehouseID string, from, to time.Time) (*ReturnStats, error) {
	return &ReturnStats{
		TotalReturns:   len(m.returns),
		PendingReturns: 0,
		TotalRefunded:  0,
	}, nil
}

func (m *mockReturnRepository) CreatePolicy(ctx context.Context, p *ReturnPolicy) error {
	m.policies[p.ID] = p
	return nil
}

func (m *mockReturnRepository) UpdatePolicy(ctx context.Context, p *ReturnPolicy) error {
	m.policies[p.ID] = p
	return nil
}

func (m *mockReturnRepository) GetPolicy(ctx context.Context, id string) (*ReturnPolicy, error) {
	if p, ok := m.policies[id]; ok {
		return p, nil
	}
	return nil, ErrReturnNotFound
}

func (m *mockReturnRepository) GetDefaultPolicy(ctx context.Context) (*ReturnPolicy, error) {
	for _, p := range m.policies {
		if p.IsActive {
			return p, nil
		}
	}
	return &ReturnPolicy{
		ID:               "default",
		ReturnDays:       30,
		RefundPercentage: 100,
		RestockingFee:    0,
		IsActive:         true,
	}, nil
}

func (m *mockReturnRepository) ListPolicies(ctx context.Context) ([]*ReturnPolicy, error) {
	result := make([]*ReturnPolicy, 0, len(m.policies))
	for _, p := range m.policies {
		result = append(result, p)
	}
	return result, nil
}

func (m *mockReturnRepository) CreateReturnLabel(ctx context.Context, label *ReturnLabel) error {
	m.labels[label.ID] = label
	return nil
}

func (m *mockReturnRepository) GetReturnLabel(ctx context.Context, returnID string) (*ReturnLabel, error) {
	for _, l := range m.labels {
		if l.ReturnID == returnID {
			return l, nil
		}
	}
	return nil, ErrReturnNotFound
}

// Tests

func TestReturnService_CreateReturnRequest(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	// Create default policy
	returnRepo.policies["default"] = &ReturnPolicy{
		ID:               "default",
		ReturnDays:       30,
		RefundPercentage: 100,
		RestockingFee:    0,
		IsActive:         true,
	}

	items := []ReturnItem{
		{ProductID: "prod1", SKU: "SKU001", ProductName: "Product 1", Quantity: 2, UnitPrice: 50.00},
		{ProductID: "prod2", SKU: "SKU002", ProductName: "Product 2", Quantity: 1, UnitPrice: 100.00},
	}

	returnReq, err := service.CreateReturnRequest(ctx, "ORD001", "cust1", "John Doe", "john@example.com", items, ReturnReasonDefective, "Item not working", []string{})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if returnReq.OrderID != "ORD001" {
		t.Errorf("Expected order ID 'ORD001', got %s", returnReq.OrderID)
	}
	if returnReq.Status != ReturnStatusRequested {
		t.Errorf("Expected status 'requested', got %s", returnReq.Status)
	}
	if returnReq.RefundAmount != 200.00 { // (50*2) + 100 = 200
		t.Errorf("Expected refund amount 200.00, got %.2f", returnReq.RefundAmount)
	}
	if len(returnReq.Items) != 2 {
		t.Errorf("Expected 2 items, got %d", len(returnReq.Items))
	}
}

func TestReturnService_CreateReturnRequest_NoItems(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	_, err := service.CreateReturnRequest(ctx, "ORD001", "cust1", "John Doe", "john@example.com", []ReturnItem{}, ReturnReasonDefective, "", nil)
	if err == nil {
		t.Error("Expected error for empty items")
	}
}

func TestReturnService_CreateReturnRequest_ExcludedReason(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.policies["default"] = &ReturnPolicy{
		ID:              "default",
		ExcludedReasons: []string{string(ReturnReasonChangedMind)},
		IsActive:        true,
	}

	items := []ReturnItem{{ProductID: "prod1", Quantity: 1, UnitPrice: 50.00}}

	_, err := service.CreateReturnRequest(ctx, "ORD001", "cust1", "John Doe", "john@example.com", items, ReturnReasonChangedMind, "", nil)
	if err != ErrItemNotReturnable {
		t.Errorf("Expected ErrItemNotReturnable, got %v", err)
	}
}

func TestReturnService_ApproveReturn(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusRequested,
	}

	err := service.ApproveReturn(ctx, "ret1", "admin1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.Status != ReturnStatusApproved {
		t.Errorf("Expected status 'approved', got %s", ret.Status)
	}
	if ret.ApprovedBy != "admin1" {
		t.Errorf("Expected approved by 'admin1', got %s", ret.ApprovedBy)
	}
}

func TestReturnService_ApproveReturn_InvalidState(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusCompleted, // Already completed
	}

	err := service.ApproveReturn(ctx, "ret1", "admin1")
	if err != ErrInvalidReturnState {
		t.Errorf("Expected ErrInvalidReturnState, got %v", err)
	}
}

func TestReturnService_RejectReturn(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusRequested,
	}

	err := service.RejectReturn(ctx, "ret1", "admin1", "Policy violation")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.Status != ReturnStatusRejected {
		t.Errorf("Expected status 'rejected', got %s", ret.Status)
	}
}

func TestReturnService_ReceiveReturn(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusApproved,
	}

	err := service.ReceiveReturn(ctx, "ret1", "wh1", "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.Status != ReturnStatusReceived {
		t.Errorf("Expected status 'received', got %s", ret.Status)
	}
	if ret.WarehouseID != "wh1" {
		t.Errorf("Expected warehouse 'wh1', got %s", ret.WarehouseID)
	}
}

func TestReturnService_InspectReturnItem(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusReceived,
		Items: []ReturnItem{
			{ID: "item1", ProductID: "prod1", Quantity: 1},
		},
	}

	err := service.InspectReturnItem(ctx, "ret1", "item1", ConditionGood, DispositionRestock, "Minor wear", []string{})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.Status != ReturnStatusInspecting {
		t.Errorf("Expected status 'inspecting', got %s", ret.Status)
	}
	if ret.Items[0].Condition != ConditionGood {
		t.Errorf("Expected condition 'good', got %s", ret.Items[0].Condition)
	}
}

func TestReturnService_CompleteInspection(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusInspecting,
		Items: []ReturnItem{
			{ID: "item1", Condition: ConditionGood, Disposition: DispositionRestock},
		},
	}

	err := service.CompleteInspection(ctx, "ret1", "inspector1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.Status != ReturnStatusCompleted {
		t.Errorf("Expected status 'completed', got %s", ret.Status)
	}
	if ret.InspectedBy != "inspector1" {
		t.Errorf("Expected inspected by 'inspector1', got %s", ret.InspectedBy)
	}
}

func TestReturnService_CompleteInspection_NotAllInspected(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusInspecting,
		Items: []ReturnItem{
			{ID: "item1", Condition: ConditionGood, Disposition: DispositionRestock},
			{ID: "item2", Condition: "", Disposition: ""}, // Not inspected
		},
	}

	err := service.CompleteInspection(ctx, "ret1", "inspector1")
	if err == nil {
		t.Error("Expected error for uninspected items")
	}
}

func TestReturnService_ProcessDisposition_Restock(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:          "ret1",
		Status:      ReturnStatusCompleted,
		WarehouseID: "wh1",
		Items: []ReturnItem{
			{ID: "item1", ProductID: "prod1", SKU: "SKU001", ReturnedQty: 2, Condition: ConditionGood, Disposition: DispositionRestock},
		},
	}

	// Set up existing stock
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    50,
		Reserved:    0,
		Available:   50,
	}

	err := service.ProcessDisposition(ctx, "ret1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify stock increased
	stock, _ := warehouseRepo.GetStock(ctx, "wh1", "prod1")
	if stock.Quantity != 52 {
		t.Errorf("Expected quantity 52, got %d", stock.Quantity)
	}
}

func TestReturnService_ProcessRefund(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:           "ret1",
		Status:       ReturnStatusCompleted,
		RefundAmount: 100.00,
		Items: []ReturnItem{
			{ID: "item1", RefundAmount: 100.00, Condition: ConditionGood},
		},
	}

	err := service.ProcessRefund(ctx, "ret1", "credit_card")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.Status != ReturnStatusRefunded {
		t.Errorf("Expected status 'refunded', got %s", ret.Status)
	}
	if ret.RefundMethod != "credit_card" {
		t.Errorf("Expected refund method 'credit_card', got %s", ret.RefundMethod)
	}
}

func TestReturnService_ProcessRefund_AdjustByCondition(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:           "ret1",
		Status:       ReturnStatusCompleted,
		RefundAmount: 100.00,
		Items: []ReturnItem{
			{ID: "item1", RefundAmount: 100.00, Condition: ConditionAcceptable}, // Should get 80%
		},
	}

	err := service.ProcessRefund(ctx, "ret1", "credit_card")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.RefundAmount != 80.00 {
		t.Errorf("Expected refund amount 80.00 (80%%), got %.2f", ret.RefundAmount)
	}
}

func TestReturnService_GenerateReturnLabel(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:     "ret1",
		Status: ReturnStatusApproved,
	}

	label, err := service.GenerateReturnLabel(ctx, "ret1", "ups")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Carrier != "ups" {
		t.Errorf("Expected carrier 'ups', got %s", label.Carrier)
	}
	if label.TrackingNumber == "" {
		t.Error("Expected tracking number to be generated")
	}

	// Verify return status updated
	ret, _ := returnRepo.GetReturn(ctx, "ret1")
	if ret.Status != ReturnStatusInTransit {
		t.Errorf("Expected status 'in_transit', got %s", ret.Status)
	}
}

func TestReturnService_CanReturn(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.policies["default"] = &ReturnPolicy{
		ID:         "default",
		ReturnDays: 30,
		IsActive:   true,
	}

	// Order within return period
	orderDate := time.Now().AddDate(0, 0, -15) // 15 days ago
	canReturn, reason, err := service.CanReturn(ctx, "ORD001", orderDate)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !canReturn {
		t.Errorf("Expected can return to be true, reason: %s", reason)
	}

	// Order outside return period
	orderDate = time.Now().AddDate(0, -2, 0) // 2 months ago
	canReturn, reason, _ = service.CanReturn(ctx, "ORD002", orderDate)
	if canReturn {
		t.Error("Expected can return to be false for expired period")
	}
	if reason == "" {
		t.Error("Expected reason for rejection")
	}
}

func TestReturnService_CanReturn_ExistingReturn(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.policies["default"] = &ReturnPolicy{
		ID:         "default",
		ReturnDays: 30,
		IsActive:   true,
	}

	returnRepo.returns["ret1"] = &ReturnRequest{
		ID:      "ret1",
		OrderID: "ORD001",
		Status:  ReturnStatusApproved, // Active return exists
	}

	orderDate := time.Now().AddDate(0, 0, -15)
	canReturn, _, _ := service.CanReturn(ctx, "ORD001", orderDate)
	if canReturn {
		t.Error("Expected can return to be false when active return exists")
	}
}

func TestReturnService_GetReturnReasons(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)

	reasons := service.GetReturnReasons()
	if len(reasons) == 0 {
		t.Error("Expected return reasons")
	}

	// Check that defective is included
	found := false
	for _, r := range reasons {
		if r == ReturnReasonDefective {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected ReturnReasonDefective in list")
	}
}

func TestReturnService_GetReturnConditions(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)

	conditions := service.GetReturnConditions()
	if len(conditions) != 6 {
		t.Errorf("Expected 6 conditions, got %d", len(conditions))
	}
}

func TestReturnService_GetDispositionOptions(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)

	options := service.GetDispositionOptions()
	if len(options) != 7 {
		t.Errorf("Expected 7 disposition options, got %d", len(options))
	}
}

func TestReturnService_ListReturns(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{ID: "ret1", Status: ReturnStatusRequested}
	returnRepo.returns["ret2"] = &ReturnRequest{ID: "ret2", Status: ReturnStatusCompleted}

	returns, err := service.ListReturns(ctx, ReturnStatusRequested, "", 10, 0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(returns) != 1 {
		t.Errorf("Expected 1 return with requested status, got %d", len(returns))
	}
}

func TestReturnService_GetReturnsByCustomer(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{ID: "ret1", CustomerID: "cust1"}
	returnRepo.returns["ret2"] = &ReturnRequest{ID: "ret2", CustomerID: "cust1"}
	returnRepo.returns["ret3"] = &ReturnRequest{ID: "ret3", CustomerID: "cust2"}

	returns, err := service.GetReturnsByCustomer(ctx, "cust1", 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(returns) != 2 {
		t.Errorf("Expected 2 returns for customer, got %d", len(returns))
	}
}

func TestReturnService_CreateReturnPolicy(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	policy := &ReturnPolicy{
		Name:             "Standard Policy",
		ReturnDays:       30,
		RefundPercentage: 100,
		IsActive:         true,
	}

	err := service.CreateReturnPolicy(ctx, policy)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if policy.ID == "" {
		t.Error("Expected policy ID to be set")
	}
}

func TestReturnService_GetReturnStats(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	from := time.Now().AddDate(0, -1, 0)
	to := time.Now()

	stats, err := service.GetReturnStats(ctx, "wh1", from, to)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if stats == nil {
		t.Error("Expected stats to be returned")
	}
}

func TestReturnService_GetReturn(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.returns["ret1"] = &ReturnRequest{ID: "ret1", OrderID: "ORD001", Status: ReturnStatusRequested}

	ret, err := service.GetReturn(ctx, "ret1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if ret.OrderID != "ORD001" {
		t.Errorf("Expected 'ORD001', got %s", ret.OrderID)
	}
}

func TestReturnService_GetReturnPolicy(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	returnRepo.policies["policy1"] = &ReturnPolicy{ID: "policy1", Name: "Standard Policy", ReturnDays: 30}

	policy, err := service.GetReturnPolicy(ctx, "policy1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if policy.ReturnDays != 30 {
		t.Errorf("Expected 30 days, got %d", policy.ReturnDays)
	}
}

func TestReturnService_UpdateReturnPolicy(t *testing.T) {
	returnRepo := newMockReturnRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewReturnService(returnRepo, warehouseRepo)
	ctx := context.Background()

	policy := &ReturnPolicy{ID: "policy1", Name: "Standard Policy", ReturnDays: 30}
	returnRepo.policies["policy1"] = policy

	policy.ReturnDays = 60
	err := service.UpdateReturnPolicy(ctx, policy)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}
