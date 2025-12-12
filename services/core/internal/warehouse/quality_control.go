package warehouse

import (
	"context"
	"errors"
	"time"
)

// QC errors
var (
	ErrQCCheckNotFound  = errors.New("QC check not found")
	ErrInvalidQCState   = errors.New("invalid QC state")
	ErrQCFailed         = errors.New("QC check failed")
)

// QCCheckType represents type of quality check
type QCCheckType string

const (
	QCTypeReceiving   QCCheckType = "receiving"    // At goods receipt
	QCTypeRandom      QCCheckType = "random"       // Random sampling
	QCTypePutaway     QCCheckType = "putaway"      // Before putaway
	QCTypePreShip     QCCheckType = "pre_ship"     // Before shipping
	QCTypeReturns     QCCheckType = "returns"      // Return inspection
	QCTypeProduction  QCCheckType = "production"   // After assembly
	QCTypePeriodic    QCCheckType = "periodic"     // Scheduled checks
)

// QCResult represents check result
type QCResult string

const (
	QCResultPass      QCResult = "pass"
	QCResultFail      QCResult = "fail"
	QCResultPartial   QCResult = "partial"    // Some items passed
	QCResultPending   QCResult = "pending"
	QCResultOnHold    QCResult = "on_hold"
)

// QCCheck represents quality control check
type QCCheck struct {
	ID              string        `json:"id"`
	Type            QCCheckType   `json:"type"`
	Status          string        `json:"status"` // pending, in_progress, completed
	Result          QCResult      `json:"result"`
	WarehouseID     string        `json:"warehouse_id"`
	DocumentType    string        `json:"document_type,omitempty"` // receipt, order, return
	DocumentID      string        `json:"document_id,omitempty"`
	Items           []QCItem      `json:"items"`
	Checklist       []ChecklistItem `json:"checklist,omitempty"`
	TotalItems      int           `json:"total_items"`
	PassedItems     int           `json:"passed_items"`
	FailedItems     int           `json:"failed_items"`
	PassRate        float64       `json:"pass_rate"`
	Inspector       string        `json:"inspector,omitempty"`
	InspectorName   string        `json:"inspector_name,omitempty"`
	Notes           string        `json:"notes,omitempty"`
	StartedAt       *time.Time    `json:"started_at,omitempty"`
	CompletedAt     *time.Time    `json:"completed_at,omitempty"`
	CreatedBy       string        `json:"created_by"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

// QCItem represents item in QC check
type QCItem struct {
	ID            string      `json:"id"`
	ProductID     string      `json:"product_id"`
	SKU           string      `json:"sku"`
	Name          string      `json:"name"`
	Quantity      int         `json:"quantity"`
	SampleSize    int         `json:"sample_size"` // Items to inspect
	InspectedQty  int         `json:"inspected_qty"`
	PassedQty     int         `json:"passed_qty"`
	FailedQty     int         `json:"failed_qty"`
	Result        QCResult    `json:"result"`
	Defects       []Defect    `json:"defects,omitempty"`
	Measurements  []Measurement `json:"measurements,omitempty"`
	Photos        []string    `json:"photos,omitempty"`
	Notes         string      `json:"notes,omitempty"`
	BatchNumber   string      `json:"batch_number,omitempty"`
	SerialNumbers []string    `json:"serial_numbers,omitempty"`
	Location      string      `json:"location,omitempty"`
}

// Defect represents found defect
type Defect struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // visual, functional, dimensional, packaging
	Severity    string    `json:"severity"` // critical, major, minor
	Description string    `json:"description"`
	Quantity    int       `json:"quantity"`
	Photo       string    `json:"photo,omitempty"`
	Location    string    `json:"location,omitempty"` // Where on product
	Action      string    `json:"action"` // reject, rework, accept
	FoundAt     time.Time `json:"found_at"`
}

// Measurement represents quality measurement
type Measurement struct {
	Name      string  `json:"name"`
	Target    float64 `json:"target"`
	Tolerance float64 `json:"tolerance"`
	Actual    float64 `json:"actual"`
	Unit      string  `json:"unit"`
	Pass      bool    `json:"pass"`
}

// ChecklistItem represents QC checklist item
type ChecklistItem struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
	Checked     bool   `json:"checked"`
	Pass        bool   `json:"pass"`
	Notes       string `json:"notes,omitempty"`
}

// QCTemplate represents QC template for product/category
type QCTemplate struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	Type         QCCheckType     `json:"type"`
	ProductID    string          `json:"product_id,omitempty"`
	CategoryID   string          `json:"category_id,omitempty"`
	Checklist    []ChecklistItem `json:"checklist"`
	Measurements []MeasurementSpec `json:"measurements,omitempty"`
	SamplePercent float64        `json:"sample_percent"` // % of items to inspect
	MinSampleSize int            `json:"min_sample_size"`
	MaxSampleSize int            `json:"max_sample_size"`
	IsActive     bool            `json:"is_active"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// MeasurementSpec represents measurement specification
type MeasurementSpec struct {
	Name      string  `json:"name"`
	Target    float64 `json:"target"`
	Tolerance float64 `json:"tolerance"`
	Unit      string  `json:"unit"`
	Required  bool    `json:"required"`
}

// QCHold represents hold on inventory pending QC
type QCHold struct {
	ID          string    `json:"id"`
	WarehouseID string    `json:"warehouse_id"`
	ProductID   string    `json:"product_id"`
	SKU         string    `json:"sku"`
	Quantity    int       `json:"quantity"`
	Location    string    `json:"location,omitempty"`
	Reason      string    `json:"reason"`
	QCCheckID   string    `json:"qc_check_id,omitempty"`
	Status      string    `json:"status"` // pending, released, rejected
	PlacedBy    string    `json:"placed_by"`
	ReleasedBy  string    `json:"released_by,omitempty"`
	ReleasedAt  *time.Time `json:"released_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// QCStats represents QC statistics
type QCStats struct {
	TotalChecks     int     `json:"total_checks"`
	PassedChecks    int     `json:"passed_checks"`
	FailedChecks    int     `json:"failed_checks"`
	PassRate        float64 `json:"pass_rate_percent"`
	AvgCheckTime    float64 `json:"avg_check_time_minutes"`
	TopDefects      []DefectStat `json:"top_defects"`
	ByInspector     []InspectorStat `json:"by_inspector"`
	Trend           []QCTrendPoint `json:"trend"`
}

// DefectStat represents defect statistics
type DefectStat struct {
	Type        string  `json:"type"`
	Count       int     `json:"count"`
	Percentage  float64 `json:"percentage"`
}

// InspectorStat represents inspector statistics
type InspectorStat struct {
	InspectorID   string  `json:"inspector_id"`
	InspectorName string  `json:"inspector_name"`
	ChecksCount   int     `json:"checks_count"`
	PassRate      float64 `json:"pass_rate"`
	AvgTime       float64 `json:"avg_time_minutes"`
}

// QCTrendPoint represents QC trend data point
type QCTrendPoint struct {
	Date        time.Time `json:"date"`
	TotalChecks int       `json:"total_checks"`
	PassRate    float64   `json:"pass_rate"`
}

// QCRepository defines QC data access
type QCRepository interface {
	// Checks
	CreateQCCheck(ctx context.Context, check *QCCheck) error
	UpdateQCCheck(ctx context.Context, check *QCCheck) error
	GetQCCheck(ctx context.Context, id string) (*QCCheck, error)
	GetQCCheckByDocument(ctx context.Context, documentType, documentID string) (*QCCheck, error)
	ListQCChecks(ctx context.Context, warehouseID string, status string, checkType QCCheckType, limit, offset int) ([]*QCCheck, error)

	// Templates
	CreateQCTemplate(ctx context.Context, template *QCTemplate) error
	UpdateQCTemplate(ctx context.Context, template *QCTemplate) error
	GetQCTemplate(ctx context.Context, id string) (*QCTemplate, error)
	GetQCTemplateByProduct(ctx context.Context, productID string, checkType QCCheckType) (*QCTemplate, error)
	ListQCTemplates(ctx context.Context, checkType QCCheckType) ([]*QCTemplate, error)

	// Holds
	CreateQCHold(ctx context.Context, hold *QCHold) error
	UpdateQCHold(ctx context.Context, hold *QCHold) error
	GetQCHold(ctx context.Context, id string) (*QCHold, error)
	ListQCHolds(ctx context.Context, warehouseID string, status string) ([]*QCHold, error)
	GetHoldsByProduct(ctx context.Context, warehouseID, productID string) ([]*QCHold, error)

	// Stats
	GetQCStats(ctx context.Context, warehouseID string, from, to time.Time) (*QCStats, error)
}

// QCService manages quality control
type QCService struct {
	repo QCRepository
}

// NewQCService creates QC service
func NewQCService(repo QCRepository) *QCService {
	return &QCService{repo: repo}
}

// CreateQCCheck creates new QC check
func (s *QCService) CreateQCCheck(ctx context.Context, check *QCCheck) error {
	check.ID = generateID()
	check.Status = "pending"
	check.Result = QCResultPending
	check.CreatedAt = time.Now()
	check.UpdatedAt = time.Now()

	// Assign IDs to items
	for i := range check.Items {
		check.Items[i].ID = generateID()
		check.Items[i].Result = QCResultPending

		// Calculate sample size if not set
		if check.Items[i].SampleSize == 0 {
			template, err := s.repo.GetQCTemplateByProduct(ctx, check.Items[i].ProductID, check.Type)
			if err == nil && template != nil {
				sampleSize := int(float64(check.Items[i].Quantity) * template.SamplePercent / 100)
				if sampleSize < template.MinSampleSize {
					sampleSize = template.MinSampleSize
				}
				if sampleSize > template.MaxSampleSize && template.MaxSampleSize > 0 {
					sampleSize = template.MaxSampleSize
				}
				check.Items[i].SampleSize = sampleSize
			} else {
				// Default 10% sample
				check.Items[i].SampleSize = max(1, check.Items[i].Quantity/10)
			}
		}
	}

	// Calculate totals
	check.TotalItems = len(check.Items)

	return s.repo.CreateQCCheck(ctx, check)
}

// CreateReceivingQC creates QC check for receiving
func (s *QCService) CreateReceivingQC(ctx context.Context, warehouseID, receiptID, createdBy string, items []QCItem) (*QCCheck, error) {
	check := &QCCheck{
		Type:         QCTypeReceiving,
		WarehouseID:  warehouseID,
		DocumentType: "receipt",
		DocumentID:   receiptID,
		Items:        items,
		CreatedBy:    createdBy,
	}

	if err := s.CreateQCCheck(ctx, check); err != nil {
		return nil, err
	}

	return check, nil
}

// CreateReturnQC creates QC check for returns
func (s *QCService) CreateReturnQC(ctx context.Context, warehouseID, returnID, createdBy string, items []QCItem) (*QCCheck, error) {
	check := &QCCheck{
		Type:         QCTypeReturns,
		WarehouseID:  warehouseID,
		DocumentType: "return",
		DocumentID:   returnID,
		Items:        items,
		CreatedBy:    createdBy,
	}

	if err := s.CreateQCCheck(ctx, check); err != nil {
		return nil, err
	}

	return check, nil
}

// StartQCCheck starts QC check
func (s *QCService) StartQCCheck(ctx context.Context, checkID, inspectorID, inspectorName string) error {
	check, err := s.repo.GetQCCheck(ctx, checkID)
	if err != nil {
		return err
	}

	if check.Status != "pending" {
		return ErrInvalidQCState
	}

	now := time.Now()
	check.Status = "in_progress"
	check.Inspector = inspectorID
	check.InspectorName = inspectorName
	check.StartedAt = &now
	check.UpdatedAt = now

	return s.repo.UpdateQCCheck(ctx, check)
}

// InspectItem inspects single item in QC check
func (s *QCService) InspectItem(ctx context.Context, checkID, itemID string, passedQty, failedQty int, defects []Defect, measurements []Measurement, photos []string, notes string) error {
	check, err := s.repo.GetQCCheck(ctx, checkID)
	if err != nil {
		return err
	}

	if check.Status != "in_progress" {
		return ErrInvalidQCState
	}

	found := false
	for i := range check.Items {
		if check.Items[i].ID == itemID {
			check.Items[i].InspectedQty = passedQty + failedQty
			check.Items[i].PassedQty = passedQty
			check.Items[i].FailedQty = failedQty
			check.Items[i].Defects = defects
			check.Items[i].Measurements = measurements
			check.Items[i].Photos = photos
			check.Items[i].Notes = notes

			// Determine result
			if failedQty == 0 {
				check.Items[i].Result = QCResultPass
			} else if passedQty == 0 {
				check.Items[i].Result = QCResultFail
			} else {
				check.Items[i].Result = QCResultPartial
			}

			found = true
			break
		}
	}

	if !found {
		return errors.New("item not found")
	}

	check.UpdatedAt = time.Now()
	return s.repo.UpdateQCCheck(ctx, check)
}

// AddDefect adds defect to item
func (s *QCService) AddDefect(ctx context.Context, checkID, itemID string, defect Defect) error {
	check, err := s.repo.GetQCCheck(ctx, checkID)
	if err != nil {
		return err
	}

	defect.ID = generateID()
	defect.FoundAt = time.Now()

	for i := range check.Items {
		if check.Items[i].ID == itemID {
			check.Items[i].Defects = append(check.Items[i].Defects, defect)
			check.Items[i].FailedQty += defect.Quantity
			break
		}
	}

	check.UpdatedAt = time.Now()
	return s.repo.UpdateQCCheck(ctx, check)
}

// CompleteQCCheck completes QC check
func (s *QCService) CompleteQCCheck(ctx context.Context, checkID string) error {
	check, err := s.repo.GetQCCheck(ctx, checkID)
	if err != nil {
		return err
	}

	if check.Status != "in_progress" {
		return ErrInvalidQCState
	}

	// Calculate totals
	var passedItems, failedItems int
	for _, item := range check.Items {
		if item.Result == QCResultPass {
			passedItems++
		} else if item.Result == QCResultFail {
			failedItems++
		}
	}

	check.PassedItems = passedItems
	check.FailedItems = failedItems

	if check.TotalItems > 0 {
		check.PassRate = float64(passedItems) / float64(check.TotalItems) * 100
	}

	// Determine overall result
	if failedItems == 0 {
		check.Result = QCResultPass
	} else if passedItems == 0 {
		check.Result = QCResultFail
	} else {
		check.Result = QCResultPartial
	}

	now := time.Now()
	check.Status = "completed"
	check.CompletedAt = &now
	check.UpdatedAt = now

	return s.repo.UpdateQCCheck(ctx, check)
}

// GetQCCheck returns QC check by ID
func (s *QCService) GetQCCheck(ctx context.Context, id string) (*QCCheck, error) {
	return s.repo.GetQCCheck(ctx, id)
}

// ListQCChecks returns list of QC checks
func (s *QCService) ListQCChecks(ctx context.Context, warehouseID string, status string, checkType QCCheckType, limit, offset int) ([]*QCCheck, error) {
	return s.repo.ListQCChecks(ctx, warehouseID, status, checkType, limit, offset)
}

// CreateQCHold creates hold on inventory
func (s *QCService) CreateQCHold(ctx context.Context, warehouseID, productID, sku string, quantity int, location, reason, placedBy, qcCheckID string) (*QCHold, error) {
	hold := &QCHold{
		ID:          generateID(),
		WarehouseID: warehouseID,
		ProductID:   productID,
		SKU:         sku,
		Quantity:    quantity,
		Location:    location,
		Reason:      reason,
		QCCheckID:   qcCheckID,
		Status:      "pending",
		PlacedBy:    placedBy,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateQCHold(ctx, hold); err != nil {
		return nil, err
	}

	return hold, nil
}

// ReleaseQCHold releases hold on inventory
func (s *QCService) ReleaseQCHold(ctx context.Context, holdID, releasedBy string) error {
	hold, err := s.repo.GetQCHold(ctx, holdID)
	if err != nil {
		return err
	}

	if hold.Status != "pending" {
		return errors.New("hold is not pending")
	}

	now := time.Now()
	hold.Status = "released"
	hold.ReleasedBy = releasedBy
	hold.ReleasedAt = &now

	return s.repo.UpdateQCHold(ctx, hold)
}

// RejectQCHold rejects held inventory
func (s *QCService) RejectQCHold(ctx context.Context, holdID, releasedBy string) error {
	hold, err := s.repo.GetQCHold(ctx, holdID)
	if err != nil {
		return err
	}

	if hold.Status != "pending" {
		return errors.New("hold is not pending")
	}

	now := time.Now()
	hold.Status = "rejected"
	hold.ReleasedBy = releasedBy
	hold.ReleasedAt = &now

	return s.repo.UpdateQCHold(ctx, hold)
}

// ListQCHolds returns list of QC holds
func (s *QCService) ListQCHolds(ctx context.Context, warehouseID string, status string) ([]*QCHold, error) {
	return s.repo.ListQCHolds(ctx, warehouseID, status)
}

// CreateQCTemplate creates QC template
func (s *QCService) CreateQCTemplate(ctx context.Context, template *QCTemplate) error {
	template.ID = generateID()
	template.CreatedAt = time.Now()
	template.UpdatedAt = time.Now()

	// Assign IDs to checklist items
	for i := range template.Checklist {
		template.Checklist[i].ID = generateID()
	}

	return s.repo.CreateQCTemplate(ctx, template)
}

// UpdateQCTemplate updates QC template
func (s *QCService) UpdateQCTemplate(ctx context.Context, template *QCTemplate) error {
	template.UpdatedAt = time.Now()
	return s.repo.UpdateQCTemplate(ctx, template)
}

// GetQCTemplate returns QC template by ID
func (s *QCService) GetQCTemplate(ctx context.Context, id string) (*QCTemplate, error) {
	return s.repo.GetQCTemplate(ctx, id)
}

// ListQCTemplates returns list of QC templates
func (s *QCService) ListQCTemplates(ctx context.Context, checkType QCCheckType) ([]*QCTemplate, error) {
	return s.repo.ListQCTemplates(ctx, checkType)
}

// GetQCStats returns QC statistics
func (s *QCService) GetQCStats(ctx context.Context, warehouseID string, from, to time.Time) (*QCStats, error) {
	return s.repo.GetQCStats(ctx, warehouseID, from, to)
}

// IsProductOnHold checks if product has active QC hold
func (s *QCService) IsProductOnHold(ctx context.Context, warehouseID, productID string) (bool, int, error) {
	holds, err := s.repo.GetHoldsByProduct(ctx, warehouseID, productID)
	if err != nil {
		return false, 0, err
	}

	totalHeld := 0
	for _, hold := range holds {
		if hold.Status == "pending" {
			totalHeld += hold.Quantity
		}
	}

	return totalHeld > 0, totalHeld, nil
}

// GetPendingQCCount returns count of pending QC checks
func (s *QCService) GetPendingQCCount(ctx context.Context, warehouseID string) (int, error) {
	checks, err := s.repo.ListQCChecks(ctx, warehouseID, "pending", "", 1000, 0)
	if err != nil {
		return 0, err
	}
	return len(checks), nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
