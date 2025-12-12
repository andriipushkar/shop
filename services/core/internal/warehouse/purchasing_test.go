package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockPurchasingRepository implements PurchasingRepository for testing
type mockPurchasingRepository struct {
	purchaseOrders map[string]*PurchaseOrder
	suppliers      map[string]*Supplier
	reorderRules   map[string]*ReorderRule
	nextPONumber   int
}

func newMockPurchasingRepository() *mockPurchasingRepository {
	return &mockPurchasingRepository{
		purchaseOrders: make(map[string]*PurchaseOrder),
		suppliers:      make(map[string]*Supplier),
		reorderRules:   make(map[string]*ReorderRule),
		nextPONumber:   1001,
	}
}

func (m *mockPurchasingRepository) CreatePurchaseOrder(ctx context.Context, po *PurchaseOrder) error {
	m.purchaseOrders[po.ID] = po
	return nil
}

func (m *mockPurchasingRepository) UpdatePurchaseOrder(ctx context.Context, po *PurchaseOrder) error {
	m.purchaseOrders[po.ID] = po
	return nil
}

func (m *mockPurchasingRepository) GetPurchaseOrder(ctx context.Context, id string) (*PurchaseOrder, error) {
	if po, ok := m.purchaseOrders[id]; ok {
		return po, nil
	}
	return nil, ErrPurchaseOrderNotFound
}

func (m *mockPurchasingRepository) GetPurchaseOrderByNumber(ctx context.Context, poNumber string) (*PurchaseOrder, error) {
	for _, po := range m.purchaseOrders {
		if po.PONumber == poNumber {
			return po, nil
		}
	}
	return nil, ErrPurchaseOrderNotFound
}

func (m *mockPurchasingRepository) ListPurchaseOrders(ctx context.Context, status POStatus, supplierID string, limit, offset int) ([]*PurchaseOrder, error) {
	result := make([]*PurchaseOrder, 0)
	for _, po := range m.purchaseOrders {
		if (status == "" || po.Status == status) && (supplierID == "" || po.SupplierID == supplierID) {
			result = append(result, po)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockPurchasingRepository) GetNextPONumber(ctx context.Context) (string, error) {
	num := m.nextPONumber
	m.nextPONumber++
	return "PO-" + string(rune('0'+num/1000)) + string(rune('0'+(num%1000)/100)) + string(rune('0'+(num%100)/10)) + string(rune('0'+num%10)), nil
}

func (m *mockPurchasingRepository) CreateSupplier(ctx context.Context, s *Supplier) error {
	m.suppliers[s.ID] = s
	return nil
}

func (m *mockPurchasingRepository) UpdateSupplier(ctx context.Context, s *Supplier) error {
	m.suppliers[s.ID] = s
	return nil
}

func (m *mockPurchasingRepository) GetSupplier(ctx context.Context, id string) (*Supplier, error) {
	if supplier, ok := m.suppliers[id]; ok {
		return supplier, nil
	}
	return nil, ErrSupplierNotFound
}

func (m *mockPurchasingRepository) ListSuppliers(ctx context.Context, activeOnly bool) ([]*Supplier, error) {
	result := make([]*Supplier, 0)
	for _, supplier := range m.suppliers {
		if !activeOnly || supplier.IsActive {
			result = append(result, supplier)
		}
	}
	return result, nil
}

func (m *mockPurchasingRepository) GetSuppliersByProduct(ctx context.Context, productID string) ([]*Supplier, error) {
	result := make([]*Supplier, 0)
	for _, supplier := range m.suppliers {
		for _, product := range supplier.Products {
			if product.ProductID == productID {
				result = append(result, supplier)
				break
			}
		}
	}
	return result, nil
}

func (m *mockPurchasingRepository) CreateReorderRule(ctx context.Context, rule *ReorderRule) error {
	m.reorderRules[rule.ID] = rule
	return nil
}

func (m *mockPurchasingRepository) UpdateReorderRule(ctx context.Context, rule *ReorderRule) error {
	m.reorderRules[rule.ID] = rule
	return nil
}

func (m *mockPurchasingRepository) GetReorderRule(ctx context.Context, id string) (*ReorderRule, error) {
	if rule, ok := m.reorderRules[id]; ok {
		return rule, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockPurchasingRepository) GetReorderRuleByProduct(ctx context.Context, productID, warehouseID string) (*ReorderRule, error) {
	for _, rule := range m.reorderRules {
		if rule.ProductID == productID && rule.WarehouseID == warehouseID {
			return rule, nil
		}
	}
	return nil, ErrProductNotFound
}

func (m *mockPurchasingRepository) ListReorderRules(ctx context.Context, warehouseID string, activeOnly bool) ([]*ReorderRule, error) {
	result := make([]*ReorderRule, 0)
	for _, rule := range m.reorderRules {
		if (warehouseID == "" || rule.WarehouseID == warehouseID) && (!activeOnly || rule.IsActive) {
			result = append(result, rule)
		}
	}
	return result, nil
}

func (m *mockPurchasingRepository) GetPurchasingStats(ctx context.Context, from, to time.Time) (*PurchasingStats, error) {
	return &PurchasingStats{
		TotalOrders:     20,
		PendingOrders:   5,
		TotalSpent:      50000,
		AverageLeadTime: 7.5,
		OnTimeDelivery:  92.5,
	}, nil
}

// Tests

func TestPurchasingService_NewService(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
}

func TestPurchasingService_CreatePurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	// Setup supplier
	repo.suppliers["sup1"] = &Supplier{
		ID:           "sup1",
		Name:         "Test Supplier",
		Currency:     "USD",
		PaymentTerms: "NET30",
		LeadTimeDays: 7,
	}

	items := []POItem{
		{ProductID: "prod1", SKU: "SKU001", ProductName: "Product 1", Quantity: 100, UnitPrice: 10.00},
	}

	po, err := service.CreatePurchaseOrder(ctx, "sup1", "wh1", "user1", items, "Test order")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if po.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if po.PONumber == "" {
		t.Error("Expected PO number to be generated")
	}
	if po.Status != POStatusDraft {
		t.Errorf("Expected status 'draft', got %s", po.Status)
	}
	if po.Subtotal != 1000.00 {
		t.Errorf("Expected subtotal 1000, got %.2f", po.Subtotal)
	}
	if po.Currency != "USD" {
		t.Errorf("Expected currency 'USD', got %s", po.Currency)
	}
}

func TestPurchasingService_CreatePurchaseOrder_NoItems(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	_, err := service.CreatePurchaseOrder(ctx, "sup1", "wh1", "user1", []POItem{}, "")
	if err == nil {
		t.Error("Expected error for no items")
	}
}

func TestPurchasingService_CreatePurchaseOrder_SupplierNotFound(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	items := []POItem{{ProductID: "prod1", Quantity: 10, UnitPrice: 10.00}}

	_, err := service.CreatePurchaseOrder(ctx, "unknown", "wh1", "user1", items, "")
	if err != ErrSupplierNotFound {
		t.Errorf("Expected ErrSupplierNotFound, got %v", err)
	}
}

func TestPurchasingService_UpdatePurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{
		ID:     "po1",
		Status: POStatusDraft,
		Items: []POItem{
			{ID: "item1", ProductID: "prod1", Quantity: 100, UnitPrice: 10.00},
		},
	}
	repo.purchaseOrders["po1"] = po

	// Update quantity
	po.Items[0].Quantity = 200
	err := service.UpdatePurchaseOrder(ctx, po)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPO := repo.purchaseOrders["po1"]
	if updatedPO.Subtotal != 2000.00 {
		t.Errorf("Expected subtotal 2000, got %.2f", updatedPO.Subtotal)
	}
}

func TestPurchasingService_UpdatePurchaseOrder_NotDraft(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{
		ID:     "po1",
		Status: POStatusApproved, // Not draft
		Items:  []POItem{{Quantity: 100, UnitPrice: 10.00}},
	}
	repo.purchaseOrders["po1"] = po

	err := service.UpdatePurchaseOrder(ctx, po)
	if err != ErrInvalidPOState {
		t.Errorf("Expected ErrInvalidPOState, got %v", err)
	}
}

func TestPurchasingService_SubmitPurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{ID: "po1", Status: POStatusDraft}
	repo.purchaseOrders["po1"] = po

	err := service.SubmitPurchaseOrder(ctx, "po1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if repo.purchaseOrders["po1"].Status != POStatusPending {
		t.Errorf("Expected status 'pending', got %s", repo.purchaseOrders["po1"].Status)
	}
}

func TestPurchasingService_ApprovePurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{ID: "po1", Status: POStatusPending}
	repo.purchaseOrders["po1"] = po

	err := service.ApprovePurchaseOrder(ctx, "po1", "approver1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPO := repo.purchaseOrders["po1"]
	if updatedPO.Status != POStatusApproved {
		t.Errorf("Expected status 'approved', got %s", updatedPO.Status)
	}
	if updatedPO.ApprovedBy != "approver1" {
		t.Errorf("Expected approved by 'approver1', got %s", updatedPO.ApprovedBy)
	}
}

func TestPurchasingService_SendPurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{ID: "po1", Status: POStatusApproved}
	repo.purchaseOrders["po1"] = po

	err := service.SendPurchaseOrder(ctx, "po1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if repo.purchaseOrders["po1"].Status != POStatusOrdered {
		t.Errorf("Expected status 'ordered', got %s", repo.purchaseOrders["po1"].Status)
	}
}

func TestPurchasingService_ConfirmPurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{ID: "po1", Status: POStatusOrdered}
	repo.purchaseOrders["po1"] = po

	expectedDate := time.Now().Add(7 * 24 * time.Hour)
	err := service.ConfirmPurchaseOrder(ctx, "po1", &expectedDate)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPO := repo.purchaseOrders["po1"]
	if updatedPO.Status != POStatusConfirmed {
		t.Errorf("Expected status 'confirmed', got %s", updatedPO.Status)
	}
}

func TestPurchasingService_ReceivePurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{
		ID:          "po1",
		Status:      POStatusConfirmed,
		WarehouseID: "wh1",
		Items: []POItem{
			{ID: "item1", ProductID: "prod1", SKU: "SKU001", Quantity: 100, UnitPrice: 10.00},
		},
	}
	repo.purchaseOrders["po1"] = po

	received := map[string]int{"item1": 100}
	err := service.ReceivePurchaseOrder(ctx, "po1", received)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPO := repo.purchaseOrders["po1"]
	if updatedPO.Status != POStatusCompleted {
		t.Errorf("Expected status 'completed', got %s", updatedPO.Status)
	}
	if updatedPO.Items[0].ReceivedQty != 100 {
		t.Errorf("Expected received qty 100, got %d", updatedPO.Items[0].ReceivedQty)
	}
}

func TestPurchasingService_ReceivePurchaseOrder_Partial(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{
		ID:          "po1",
		Status:      POStatusConfirmed,
		WarehouseID: "wh1",
		Items: []POItem{
			{ID: "item1", ProductID: "prod1", SKU: "SKU001", Quantity: 100, UnitPrice: 10.00},
		},
	}
	repo.purchaseOrders["po1"] = po

	received := map[string]int{"item1": 50} // Only 50 of 100
	err := service.ReceivePurchaseOrder(ctx, "po1", received)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedPO := repo.purchaseOrders["po1"]
	if updatedPO.Status != POStatusReceived {
		t.Errorf("Expected status 'received' (partial), got %s", updatedPO.Status)
	}
}

func TestPurchasingService_CancelPurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{ID: "po1", Status: POStatusPending}
	repo.purchaseOrders["po1"] = po

	err := service.CancelPurchaseOrder(ctx, "po1", "Changed requirements")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if repo.purchaseOrders["po1"].Status != POStatusCancelled {
		t.Errorf("Expected status 'cancelled', got %s", repo.purchaseOrders["po1"].Status)
	}
}

func TestPurchasingService_CancelPurchaseOrder_AlreadyCompleted(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	po := &PurchaseOrder{ID: "po1", Status: POStatusCompleted}
	repo.purchaseOrders["po1"] = po

	err := service.CancelPurchaseOrder(ctx, "po1", "Too late")
	if err != ErrInvalidPOState {
		t.Errorf("Expected ErrInvalidPOState, got %v", err)
	}
}

func TestPurchasingService_CreateSupplier(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	supplier := &Supplier{
		Name:         "New Supplier",
		Email:        "supplier@example.com",
		Currency:     "EUR",
		LeadTimeDays: 14,
		IsActive:     true,
	}

	err := service.CreateSupplier(ctx, supplier)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if supplier.ID == "" {
		t.Error("Expected ID to be generated")
	}
}

func TestPurchasingService_CreateReorderRule(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	rule := &ReorderRule{
		ProductID:    "prod1",
		WarehouseID:  "wh1",
		ReorderPoint: 50,
		ReorderQty:   100,
		MaxStock:     500,
		IsActive:     true,
	}

	err := service.CreateReorderRule(ctx, rule)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if rule.ID == "" {
		t.Error("Expected ID to be generated")
	}
}

func TestPurchasingService_GetReorderSuggestions(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	// Setup reorder rule
	repo.reorderRules["rule1"] = &ReorderRule{
		ID:                  "rule1",
		ProductID:           "prod1",
		WarehouseID:         "wh1",
		ReorderPoint:        50,
		ReorderQty:          100,
		IsActive:            true,
		PreferredSupplierID: "sup1",
	}

	// Setup supplier
	repo.suppliers["sup1"] = &Supplier{
		ID:           "sup1",
		Name:         "Test Supplier",
		LeadTimeDays: 7,
		Products: []SupplierProduct{
			{ProductID: "prod1", UnitPrice: 10.00},
		},
	}

	// Setup low stock (20 is below reorder point 50 and below half of it (25))
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    20,
		Available:   20, // Below reorder point of 50 and below half (25)
	}

	suggestions, err := service.GetReorderSuggestions(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(suggestions) != 1 {
		t.Fatalf("Expected 1 suggestion, got %d", len(suggestions))
	}
	if suggestions[0].ProductID != "prod1" {
		t.Errorf("Expected product 'prod1', got %s", suggestions[0].ProductID)
	}
	if suggestions[0].Priority != "high" {
		t.Errorf("Expected high priority (below half of reorder point), got %s", suggestions[0].Priority)
	}
}

func TestPurchasingService_GetReorderSuggestions_Urgent(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	repo.reorderRules["rule1"] = &ReorderRule{
		ID:           "rule1",
		ProductID:    "prod1",
		WarehouseID:  "wh1",
		ReorderPoint: 50,
		ReorderQty:   100,
		IsActive:     true,
	}

	// Zero stock
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		Quantity:    0,
		Available:   0,
	}

	suggestions, err := service.GetReorderSuggestions(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(suggestions) != 1 {
		t.Fatalf("Expected 1 suggestion, got %d", len(suggestions))
	}
	if suggestions[0].Priority != "urgent" {
		t.Errorf("Expected urgent priority for zero stock, got %s", suggestions[0].Priority)
	}
}

func TestPurchasingService_ProcessAutoReorders(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	// Setup auto-reorder rule
	repo.reorderRules["rule1"] = &ReorderRule{
		ID:                  "rule1",
		ProductID:           "prod1",
		WarehouseID:         "wh1",
		ReorderPoint:        50,
		ReorderQty:          100,
		IsActive:            true,
		AutoOrder:           true,
		PreferredSupplierID: "sup1",
	}

	// Setup supplier
	repo.suppliers["sup1"] = &Supplier{
		ID:           "sup1",
		Name:         "Auto Supplier",
		Currency:     "USD",
		LeadTimeDays: 5,
		Products: []SupplierProduct{
			{ProductID: "prod1", SupplierSKU: "SUP-001", UnitPrice: 10.00},
		},
	}

	// Setup low stock
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU001",
		Quantity:    20,
		Available:   20,
	}

	orders, err := service.ProcessAutoReorders(ctx, "wh1", "system")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(orders) != 1 {
		t.Fatalf("Expected 1 auto-created PO, got %d", len(orders))
	}
	if orders[0].SupplierID != "sup1" {
		t.Errorf("Expected supplier 'sup1', got %s", orders[0].SupplierID)
	}
}

func TestPurchasingService_ProcessAutoReorders_NothingToReorder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	// No rules
	_, err := service.ProcessAutoReorders(ctx, "wh1", "system")
	if err != ErrNothingToReorder {
		t.Errorf("Expected ErrNothingToReorder, got %v", err)
	}
}

func TestPurchasingService_DuplicatePurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	// Setup original PO (use different number to ensure duplicate gets new one)
	original := &PurchaseOrder{
		ID:          "po1",
		PONumber:    "PO-0500",
		SupplierID:  "sup1",
		WarehouseID: "wh1",
		Status:      POStatusCompleted,
		Items: []POItem{
			{ID: "item1", ProductID: "prod1", SKU: "SKU001", Quantity: 100, UnitPrice: 10.00},
		},
	}
	repo.purchaseOrders["po1"] = original

	repo.suppliers["sup1"] = &Supplier{
		ID:           "sup1",
		Name:         "Test Supplier",
		Currency:     "USD",
		LeadTimeDays: 7,
	}

	duplicate, err := service.DuplicatePurchaseOrder(ctx, "po1", "user1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if duplicate.ID == original.ID {
		t.Error("Expected different ID for duplicate")
	}
	if duplicate.PONumber == original.PONumber {
		t.Error("Expected different PO number for duplicate")
	}
	if duplicate.Status != POStatusDraft {
		t.Errorf("Expected draft status, got %s", duplicate.Status)
	}
	if len(duplicate.Items) != 1 {
		t.Errorf("Expected 1 item, got %d", len(duplicate.Items))
	}
	if duplicate.Items[0].ReceivedQty != 0 {
		t.Error("Expected received qty to be reset")
	}
}

func TestPurchasingService_GetPurchasingStats(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	stats, err := service.GetPurchasingStats(ctx, time.Now().Add(-30*24*time.Hour), time.Now())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if stats.TotalOrders != 20 {
		t.Errorf("Expected 20 total orders, got %d", stats.TotalOrders)
	}
	if stats.OnTimeDelivery != 92.5 {
		t.Errorf("Expected 92.5%% on-time, got %.2f%%", stats.OnTimeDelivery)
	}
}

func TestPurchasingService_ListSuppliers(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	repo.suppliers["sup1"] = &Supplier{ID: "sup1", Name: "Active Supplier", IsActive: true}
	repo.suppliers["sup2"] = &Supplier{ID: "sup2", Name: "Inactive Supplier", IsActive: false}

	// Active only
	active, err := service.ListSuppliers(ctx, true)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(active) != 1 {
		t.Errorf("Expected 1 active supplier, got %d", len(active))
	}

	// All
	all, err := service.ListSuppliers(ctx, false)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(all) != 2 {
		t.Errorf("Expected 2 suppliers, got %d", len(all))
	}
}

func TestPurchasingService_GetPurchaseOrder(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	repo.purchaseOrders["po1"] = &PurchaseOrder{ID: "po1", PONumber: "PO-001", Status: POStatusDraft}

	po, err := service.GetPurchaseOrder(ctx, "po1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if po.PONumber != "PO-001" {
		t.Errorf("Expected 'PO-001', got %s", po.PONumber)
	}
}

func TestPurchasingService_ListPurchaseOrders(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	repo.purchaseOrders["po1"] = &PurchaseOrder{ID: "po1", Status: POStatusDraft, SupplierID: "sup1"}
	repo.purchaseOrders["po2"] = &PurchaseOrder{ID: "po2", Status: POStatusPending, SupplierID: "sup1"}

	list, err := service.ListPurchaseOrders(ctx, POStatusDraft, "", 100, 0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 PO, got %d", len(list))
	}
}

func TestPurchasingService_UpdateSupplier(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	supplier := &Supplier{ID: "sup1", Name: "Test Supplier"}
	repo.suppliers["sup1"] = supplier

	supplier.Name = "Updated Supplier"
	err := service.UpdateSupplier(ctx, supplier)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestPurchasingService_GetSupplier(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	repo.suppliers["sup1"] = &Supplier{ID: "sup1", Name: "Test Supplier"}

	supplier, err := service.GetSupplier(ctx, "sup1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if supplier.Name != "Test Supplier" {
		t.Errorf("Expected 'Test Supplier', got %s", supplier.Name)
	}
}

func TestPurchasingService_UpdateReorderRule(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	rule := &ReorderRule{ID: "rule1", ProductID: "prod1", ReorderPoint: 50}
	repo.reorderRules["rule1"] = rule

	rule.ReorderPoint = 100
	err := service.UpdateReorderRule(ctx, rule)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestPurchasingService_CreatePOFromSuggestions(t *testing.T) {
	repo := newMockPurchasingRepository()
	warehouseRepo := newMockWarehouseRepository()
	service := NewPurchasingService(repo, warehouseRepo)
	ctx := context.Background()

	repo.suppliers["sup1"] = &Supplier{
		ID:           "sup1",
		Name:         "Test Supplier",
		Currency:     "USD",
		LeadTimeDays: 7,
		Products: []SupplierProduct{
			{ProductID: "prod1", SupplierSKU: "SUP-SKU-001", UnitPrice: 10.00},
		},
	}

	// Add stock for the product
	warehouseRepo.stocks["wh1:prod1"] = &Stock{
		ID:          "stock1",
		WarehouseID: "wh1",
		ProductID:   "prod1",
		SKU:         "SKU-001",
		Quantity:    10,
		Reserved:    0,
	}

	// Add reorder rule
	repo.reorderRules["rule1"] = &ReorderRule{
		ID:          "rule1",
		ProductID:   "prod1",
		WarehouseID: "wh1",
		ReorderQty:  100,
		MaxStock:    200,
		IsActive:    true,
	}

	po, err := service.CreatePOFromSuggestions(ctx, "wh1", "sup1", "user1", []string{"prod1"})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if po == nil {
		t.Error("Expected PO to be created")
	}
}
