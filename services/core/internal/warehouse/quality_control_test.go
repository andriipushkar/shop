package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockQCRepository implements QCRepository for testing
type mockQCRepository struct {
	checks    map[string]*QCCheck
	templates map[string]*QCTemplate
	holds     map[string]*QCHold
}

func newMockQCRepository() *mockQCRepository {
	return &mockQCRepository{
		checks:    make(map[string]*QCCheck),
		templates: make(map[string]*QCTemplate),
		holds:     make(map[string]*QCHold),
	}
}

func (m *mockQCRepository) CreateQCCheck(ctx context.Context, check *QCCheck) error {
	m.checks[check.ID] = check
	return nil
}

func (m *mockQCRepository) UpdateQCCheck(ctx context.Context, check *QCCheck) error {
	m.checks[check.ID] = check
	return nil
}

func (m *mockQCRepository) GetQCCheck(ctx context.Context, id string) (*QCCheck, error) {
	if check, ok := m.checks[id]; ok {
		return check, nil
	}
	return nil, ErrQCCheckNotFound
}

func (m *mockQCRepository) GetQCCheckByDocument(ctx context.Context, documentType, documentID string) (*QCCheck, error) {
	for _, check := range m.checks {
		if check.DocumentType == documentType && check.DocumentID == documentID {
			return check, nil
		}
	}
	return nil, ErrQCCheckNotFound
}

func (m *mockQCRepository) ListQCChecks(ctx context.Context, warehouseID string, status string, checkType QCCheckType, limit, offset int) ([]*QCCheck, error) {
	result := make([]*QCCheck, 0)
	for _, check := range m.checks {
		if (warehouseID == "" || check.WarehouseID == warehouseID) &&
			(status == "" || check.Status == status) &&
			(checkType == "" || check.Type == checkType) {
			result = append(result, check)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockQCRepository) CreateQCTemplate(ctx context.Context, template *QCTemplate) error {
	m.templates[template.ID] = template
	return nil
}

func (m *mockQCRepository) UpdateQCTemplate(ctx context.Context, template *QCTemplate) error {
	m.templates[template.ID] = template
	return nil
}

func (m *mockQCRepository) GetQCTemplate(ctx context.Context, id string) (*QCTemplate, error) {
	if template, ok := m.templates[id]; ok {
		return template, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockQCRepository) GetQCTemplateByProduct(ctx context.Context, productID string, checkType QCCheckType) (*QCTemplate, error) {
	for _, template := range m.templates {
		if template.ProductID == productID && template.Type == checkType {
			return template, nil
		}
	}
	return nil, ErrProductNotFound
}

func (m *mockQCRepository) ListQCTemplates(ctx context.Context, checkType QCCheckType) ([]*QCTemplate, error) {
	result := make([]*QCTemplate, 0)
	for _, template := range m.templates {
		if checkType == "" || template.Type == checkType {
			result = append(result, template)
		}
	}
	return result, nil
}

func (m *mockQCRepository) CreateQCHold(ctx context.Context, hold *QCHold) error {
	m.holds[hold.ID] = hold
	return nil
}

func (m *mockQCRepository) UpdateQCHold(ctx context.Context, hold *QCHold) error {
	m.holds[hold.ID] = hold
	return nil
}

func (m *mockQCRepository) GetQCHold(ctx context.Context, id string) (*QCHold, error) {
	if hold, ok := m.holds[id]; ok {
		return hold, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockQCRepository) ListQCHolds(ctx context.Context, warehouseID string, status string) ([]*QCHold, error) {
	result := make([]*QCHold, 0)
	for _, hold := range m.holds {
		if (warehouseID == "" || hold.WarehouseID == warehouseID) &&
			(status == "" || hold.Status == status) {
			result = append(result, hold)
		}
	}
	return result, nil
}

func (m *mockQCRepository) GetHoldsByProduct(ctx context.Context, warehouseID, productID string) ([]*QCHold, error) {
	result := make([]*QCHold, 0)
	for _, hold := range m.holds {
		if hold.WarehouseID == warehouseID && hold.ProductID == productID {
			result = append(result, hold)
		}
	}
	return result, nil
}

func (m *mockQCRepository) GetQCStats(ctx context.Context, warehouseID string, from, to time.Time) (*QCStats, error) {
	return &QCStats{
		TotalChecks:  10,
		PassedChecks: 8,
		FailedChecks: 2,
		PassRate:     80.0,
	}, nil
}

// Tests

func TestQCService_NewService(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
}

func TestQCService_CreateQCCheck(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{
		Type:        QCTypeReceiving,
		WarehouseID: "wh1",
		Items: []QCItem{
			{ProductID: "prod1", SKU: "SKU001", Quantity: 100},
		},
		CreatedBy: "user1",
	}

	err := service.CreateQCCheck(ctx, check)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if check.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if check.Status != "pending" {
		t.Errorf("Expected status 'pending', got %s", check.Status)
	}
	if check.Result != QCResultPending {
		t.Errorf("Expected result 'pending', got %s", check.Result)
	}
	if check.Items[0].SampleSize == 0 {
		t.Error("Expected sample size to be calculated")
	}
}

func TestQCService_CreateQCCheck_WithTemplate(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	// Setup template
	template := &QCTemplate{
		ID:            "template1",
		ProductID:     "prod1",
		Type:          QCTypeReceiving,
		SamplePercent: 20,
		MinSampleSize: 5,
		MaxSampleSize: 50,
	}
	repo.templates["template1"] = template

	check := &QCCheck{
		Type:        QCTypeReceiving,
		WarehouseID: "wh1",
		Items: []QCItem{
			{ProductID: "prod1", Quantity: 100},
		},
		CreatedBy: "user1",
	}

	err := service.CreateQCCheck(ctx, check)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Sample size should be 20% of 100 = 20
	if check.Items[0].SampleSize != 20 {
		t.Errorf("Expected sample size 20, got %d", check.Items[0].SampleSize)
	}
}

func TestQCService_CreateReceivingQC(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	items := []QCItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 100},
	}

	check, err := service.CreateReceivingQC(ctx, "wh1", "receipt123", "user1", items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if check.Type != QCTypeReceiving {
		t.Errorf("Expected type 'receiving', got %s", check.Type)
	}
	if check.DocumentType != "receipt" {
		t.Errorf("Expected document type 'receipt', got %s", check.DocumentType)
	}
}

func TestQCService_CreateReturnQC(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	items := []QCItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 5},
	}

	check, err := service.CreateReturnQC(ctx, "wh1", "return123", "user1", items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if check.Type != QCTypeReturns {
		t.Errorf("Expected type 'returns', got %s", check.Type)
	}
	if check.DocumentType != "return" {
		t.Errorf("Expected document type 'return', got %s", check.DocumentType)
	}
}

func TestQCService_StartQCCheck(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{ID: "check1", Status: "pending"}
	repo.checks["check1"] = check

	err := service.StartQCCheck(ctx, "check1", "inspector1", "John Inspector")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCheck := repo.checks["check1"]
	if updatedCheck.Status != "in_progress" {
		t.Errorf("Expected status 'in_progress', got %s", updatedCheck.Status)
	}
	if updatedCheck.Inspector != "inspector1" {
		t.Errorf("Expected inspector 'inspector1', got %s", updatedCheck.Inspector)
	}
	if updatedCheck.StartedAt == nil {
		t.Error("Expected StartedAt to be set")
	}
}

func TestQCService_StartQCCheck_InvalidState(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{ID: "check1", Status: "in_progress"}
	repo.checks["check1"] = check

	err := service.StartQCCheck(ctx, "check1", "inspector1", "John")
	if err != ErrInvalidQCState {
		t.Errorf("Expected ErrInvalidQCState, got %v", err)
	}
}

func TestQCService_InspectItem(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{
		ID:     "check1",
		Status: "in_progress",
		Items: []QCItem{
			{ID: "item1", ProductID: "prod1", Quantity: 100, SampleSize: 10},
		},
	}
	repo.checks["check1"] = check

	defects := []Defect{
		{Type: "visual", Severity: "minor", Description: "Scratch", Quantity: 1},
	}

	err := service.InspectItem(ctx, "check1", "item1", 9, 1, defects, nil, nil, "Minor scratch found")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCheck := repo.checks["check1"]
	if updatedCheck.Items[0].PassedQty != 9 {
		t.Errorf("Expected passed qty 9, got %d", updatedCheck.Items[0].PassedQty)
	}
	if updatedCheck.Items[0].FailedQty != 1 {
		t.Errorf("Expected failed qty 1, got %d", updatedCheck.Items[0].FailedQty)
	}
	if updatedCheck.Items[0].Result != QCResultPartial {
		t.Errorf("Expected result 'partial', got %s", updatedCheck.Items[0].Result)
	}
}

func TestQCService_InspectItem_AllPass(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{
		ID:     "check1",
		Status: "in_progress",
		Items: []QCItem{
			{ID: "item1", ProductID: "prod1", Quantity: 100, SampleSize: 10},
		},
	}
	repo.checks["check1"] = check

	err := service.InspectItem(ctx, "check1", "item1", 10, 0, nil, nil, nil, "All good")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCheck := repo.checks["check1"]
	if updatedCheck.Items[0].Result != QCResultPass {
		t.Errorf("Expected result 'pass', got %s", updatedCheck.Items[0].Result)
	}
}

func TestQCService_InspectItem_AllFail(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{
		ID:     "check1",
		Status: "in_progress",
		Items: []QCItem{
			{ID: "item1", ProductID: "prod1", Quantity: 100, SampleSize: 10},
		},
	}
	repo.checks["check1"] = check

	err := service.InspectItem(ctx, "check1", "item1", 0, 10, nil, nil, nil, "All defective")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCheck := repo.checks["check1"]
	if updatedCheck.Items[0].Result != QCResultFail {
		t.Errorf("Expected result 'fail', got %s", updatedCheck.Items[0].Result)
	}
}

func TestQCService_AddDefect(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{
		ID:     "check1",
		Status: "in_progress",
		Items: []QCItem{
			{ID: "item1", ProductID: "prod1", Defects: []Defect{}, FailedQty: 0},
		},
	}
	repo.checks["check1"] = check

	defect := Defect{
		Type:        "visual",
		Severity:    "major",
		Description: "Broken seal",
		Quantity:    5,
	}

	err := service.AddDefect(ctx, "check1", "item1", defect)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCheck := repo.checks["check1"]
	if len(updatedCheck.Items[0].Defects) != 1 {
		t.Fatalf("Expected 1 defect, got %d", len(updatedCheck.Items[0].Defects))
	}
	if updatedCheck.Items[0].FailedQty != 5 {
		t.Errorf("Expected failed qty 5, got %d", updatedCheck.Items[0].FailedQty)
	}
}

func TestQCService_CompleteQCCheck(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{
		ID:     "check1",
		Status: "in_progress",
		Items: []QCItem{
			{ID: "item1", Result: QCResultPass},
			{ID: "item2", Result: QCResultPass},
		},
		TotalItems: 2,
	}
	repo.checks["check1"] = check

	err := service.CompleteQCCheck(ctx, "check1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCheck := repo.checks["check1"]
	if updatedCheck.Status != "completed" {
		t.Errorf("Expected status 'completed', got %s", updatedCheck.Status)
	}
	if updatedCheck.Result != QCResultPass {
		t.Errorf("Expected overall result 'pass', got %s", updatedCheck.Result)
	}
	if updatedCheck.PassedItems != 2 {
		t.Errorf("Expected 2 passed items, got %d", updatedCheck.PassedItems)
	}
	if updatedCheck.PassRate != 100.0 {
		t.Errorf("Expected 100%% pass rate, got %.2f%%", updatedCheck.PassRate)
	}
}

func TestQCService_CompleteQCCheck_Partial(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	check := &QCCheck{
		ID:     "check1",
		Status: "in_progress",
		Items: []QCItem{
			{ID: "item1", Result: QCResultPass},
			{ID: "item2", Result: QCResultFail},
		},
		TotalItems: 2,
	}
	repo.checks["check1"] = check

	err := service.CompleteQCCheck(ctx, "check1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedCheck := repo.checks["check1"]
	if updatedCheck.Result != QCResultPartial {
		t.Errorf("Expected result 'partial', got %s", updatedCheck.Result)
	}
}

func TestQCService_CreateQCHold(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	hold, err := service.CreateQCHold(ctx, "wh1", "prod1", "SKU001", 50, "A-01", "Suspected damage", "user1", "check1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if hold.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if hold.Status != "pending" {
		t.Errorf("Expected status 'pending', got %s", hold.Status)
	}
	if hold.Quantity != 50 {
		t.Errorf("Expected quantity 50, got %d", hold.Quantity)
	}
}

func TestQCService_ReleaseQCHold(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	hold := &QCHold{ID: "hold1", Status: "pending", Quantity: 50}
	repo.holds["hold1"] = hold

	err := service.ReleaseQCHold(ctx, "hold1", "releaser1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedHold := repo.holds["hold1"]
	if updatedHold.Status != "released" {
		t.Errorf("Expected status 'released', got %s", updatedHold.Status)
	}
	if updatedHold.ReleasedBy != "releaser1" {
		t.Errorf("Expected released by 'releaser1', got %s", updatedHold.ReleasedBy)
	}
	if updatedHold.ReleasedAt == nil {
		t.Error("Expected ReleasedAt to be set")
	}
}

func TestQCService_ReleaseQCHold_NotPending(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	hold := &QCHold{ID: "hold1", Status: "released"}
	repo.holds["hold1"] = hold

	err := service.ReleaseQCHold(ctx, "hold1", "releaser1")
	if err == nil {
		t.Error("Expected error for non-pending hold")
	}
}

func TestQCService_RejectQCHold(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	hold := &QCHold{ID: "hold1", Status: "pending", Quantity: 50}
	repo.holds["hold1"] = hold

	err := service.RejectQCHold(ctx, "hold1", "rejecter1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedHold := repo.holds["hold1"]
	if updatedHold.Status != "rejected" {
		t.Errorf("Expected status 'rejected', got %s", updatedHold.Status)
	}
}

func TestQCService_CreateQCTemplate(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	template := &QCTemplate{
		Name:          "Standard Receiving QC",
		Type:          QCTypeReceiving,
		SamplePercent: 10,
		MinSampleSize: 5,
		MaxSampleSize: 100,
		Checklist: []ChecklistItem{
			{Description: "Check packaging integrity"},
			{Description: "Verify quantity"},
		},
	}

	err := service.CreateQCTemplate(ctx, template)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if template.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if template.Checklist[0].ID == "" {
		t.Error("Expected checklist item IDs to be generated")
	}
}

func TestQCService_IsProductOnHold(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	repo.holds["hold1"] = &QCHold{ID: "hold1", WarehouseID: "wh1", ProductID: "prod1", Status: "pending", Quantity: 50}
	repo.holds["hold2"] = &QCHold{ID: "hold2", WarehouseID: "wh1", ProductID: "prod1", Status: "pending", Quantity: 30}

	isOnHold, heldQty, err := service.IsProductOnHold(ctx, "wh1", "prod1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !isOnHold {
		t.Error("Expected product to be on hold")
	}
	if heldQty != 80 {
		t.Errorf("Expected 80 held, got %d", heldQty)
	}
}

func TestQCService_IsProductOnHold_NoHolds(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	isOnHold, heldQty, err := service.IsProductOnHold(ctx, "wh1", "prod1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if isOnHold {
		t.Error("Expected product not to be on hold")
	}
	if heldQty != 0 {
		t.Errorf("Expected 0 held, got %d", heldQty)
	}
}

func TestQCService_GetPendingQCCount(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	repo.checks["check1"] = &QCCheck{ID: "check1", WarehouseID: "wh1", Status: "pending"}
	repo.checks["check2"] = &QCCheck{ID: "check2", WarehouseID: "wh1", Status: "pending"}
	repo.checks["check3"] = &QCCheck{ID: "check3", WarehouseID: "wh1", Status: "completed"}

	count, err := service.GetPendingQCCount(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if count != 2 {
		t.Errorf("Expected 2 pending, got %d", count)
	}
}

func TestQCService_GetQCStats(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	stats, err := service.GetQCStats(ctx, "wh1", time.Now().Add(-7*24*time.Hour), time.Now())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if stats.TotalChecks != 10 {
		t.Errorf("Expected 10 total checks, got %d", stats.TotalChecks)
	}
	if stats.PassRate != 80.0 {
		t.Errorf("Expected 80%% pass rate, got %.2f%%", stats.PassRate)
	}
}

func TestMax(t *testing.T) {
	if max(5, 3) != 5 {
		t.Error("Expected max(5,3) = 5")
	}
	if max(3, 5) != 5 {
		t.Error("Expected max(3,5) = 5")
	}
	if max(5, 5) != 5 {
		t.Error("Expected max(5,5) = 5")
	}
}

func TestQCService_GetQCCheck(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	repo.checks["check1"] = &QCCheck{ID: "check1", Type: QCTypeReceiving, Status: "pending"}

	check, err := service.GetQCCheck(ctx, "check1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if check.Type != QCTypeReceiving {
		t.Errorf("Expected QCTypeReceiving, got %s", check.Type)
	}
}

func TestQCService_ListQCChecks(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	repo.checks["check1"] = &QCCheck{ID: "check1", WarehouseID: "wh1", Type: QCTypeReceiving, Status: "pending"}
	repo.checks["check2"] = &QCCheck{ID: "check2", WarehouseID: "wh1", Type: QCTypeReceiving, Status: "completed"}

	list, err := service.ListQCChecks(ctx, "wh1", "pending", QCTypeReceiving, 100, 0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 check, got %d", len(list))
	}
}

func TestQCService_ListQCHolds(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	repo.holds["hold1"] = &QCHold{ID: "hold1", WarehouseID: "wh1", Status: "active"}

	holds, err := service.ListQCHolds(ctx, "wh1", "active")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(holds) != 1 {
		t.Errorf("Expected 1 hold, got %d", len(holds))
	}
}

func TestQCService_UpdateQCTemplate(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	template := &QCTemplate{ID: "tpl1", Name: "Test Template"}
	repo.templates["tpl1"] = template

	template.Name = "Updated Template"
	err := service.UpdateQCTemplate(ctx, template)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestQCService_GetQCTemplate(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	repo.templates["tpl1"] = &QCTemplate{ID: "tpl1", Name: "Test Template"}

	template, err := service.GetQCTemplate(ctx, "tpl1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if template.Name != "Test Template" {
		t.Errorf("Expected 'Test Template', got %s", template.Name)
	}
}

func TestQCService_ListQCTemplates(t *testing.T) {
	repo := newMockQCRepository()
	service := NewQCService(repo)
	ctx := context.Background()

	repo.templates["tpl1"] = &QCTemplate{ID: "tpl1", Name: "Template 1", Type: QCTypeReceiving}
	repo.templates["tpl2"] = &QCTemplate{ID: "tpl2", Name: "Template 2", Type: QCTypeRandom}

	list, err := service.ListQCTemplates(ctx, QCTypeReceiving)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 template, got %d", len(list))
	}
}
