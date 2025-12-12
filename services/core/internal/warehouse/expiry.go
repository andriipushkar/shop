package warehouse

import (
	"context"
	"errors"
	"sort"
	"time"
)

// Expiry-related errors
var (
	ErrExpiredStock      = errors.New("stock has expired")
	ErrExpiryDateInPast  = errors.New("expiry date is in the past")
	ErrNoValidStock      = errors.New("no valid stock available")
)

// ExpiryAlert represents an expiry notification
type ExpiryAlert struct {
	ID          string     `json:"id"`
	WarehouseID string     `json:"warehouse_id"`
	ProductID   string     `json:"product_id"`
	SKU         string     `json:"sku"`
	BatchNumber string     `json:"batch_number"`
	ExpiryDate  time.Time  `json:"expiry_date"`
	Quantity    int        `json:"quantity"`
	DaysLeft    int        `json:"days_left"`
	AlertType   string     `json:"alert_type"` // expiring_soon, expired, critical
	Status      string     `json:"status"`     // pending, acknowledged, resolved
	CreatedAt   time.Time  `json:"created_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
	AcknowledgedBy string    `json:"acknowledged_by,omitempty"`
}

// BatchStock represents stock with batch and expiry info
type BatchStock struct {
	ID          string     `json:"id"`
	WarehouseID string     `json:"warehouse_id"`
	ProductID   string     `json:"product_id"`
	SKU         string     `json:"sku"`
	BatchNumber string     `json:"batch_number"`
	LotNumber   string     `json:"lot_number,omitempty"`
	ExpiryDate  *time.Time `json:"expiry_date,omitempty"`
	Quantity    int        `json:"quantity"`
	Reserved    int        `json:"reserved"`
	Available   int        `json:"available"`
	Location    string     `json:"location,omitempty"`
	ReceivedAt  time.Time  `json:"received_at"`
	CostPrice   float64    `json:"cost_price,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ExpiryConfig holds expiry management settings
type ExpiryConfig struct {
	CriticalDays    int  `json:"critical_days"`    // Days before critical alert (e.g., 7)
	WarningDays     int  `json:"warning_days"`     // Days before warning alert (e.g., 30)
	InfoDays        int  `json:"info_days"`        // Days before info alert (e.g., 90)
	AutoWriteOff    bool `json:"auto_write_off"`   // Auto write-off expired stock
	BlockExpired    bool `json:"block_expired"`    // Block selling expired stock
	FEFOEnabled     bool `json:"fefo_enabled"`     // First Expired First Out
}

// ExpiryRepository defines expiry-related data access
type ExpiryRepository interface {
	// Batch Stock
	CreateBatchStock(ctx context.Context, batch *BatchStock) error
	UpdateBatchStock(ctx context.Context, batch *BatchStock) error
	GetBatchStock(ctx context.Context, id string) (*BatchStock, error)
	GetBatchStockByProduct(ctx context.Context, warehouseID, productID string) ([]*BatchStock, error)
	GetBatchStockByBatch(ctx context.Context, batchNumber string) ([]*BatchStock, error)
	ListExpiringStock(ctx context.Context, warehouseID string, beforeDate time.Time) ([]*BatchStock, error)
	ListExpiredStock(ctx context.Context, warehouseID string) ([]*BatchStock, error)

	// Alerts
	CreateExpiryAlert(ctx context.Context, alert *ExpiryAlert) error
	UpdateExpiryAlert(ctx context.Context, alert *ExpiryAlert) error
	GetExpiryAlert(ctx context.Context, id string) (*ExpiryAlert, error)
	ListExpiryAlerts(ctx context.Context, warehouseID, status string, limit int) ([]*ExpiryAlert, error)
	GetPendingAlertsCount(ctx context.Context, warehouseID string) (int, error)
}

// ExpiryService manages expiry and FEFO operations
type ExpiryService struct {
	repo   ExpiryRepository
	config ExpiryConfig
}

// NewExpiryService creates expiry service
func NewExpiryService(repo ExpiryRepository, config ExpiryConfig) *ExpiryService {
	// Set defaults if not provided
	if config.CriticalDays == 0 {
		config.CriticalDays = 7
	}
	if config.WarningDays == 0 {
		config.WarningDays = 30
	}
	if config.InfoDays == 0 {
		config.InfoDays = 90
	}

	return &ExpiryService{
		repo:   repo,
		config: config,
	}
}

// ReceiveBatchStock receives stock with batch and expiry info
func (s *ExpiryService) ReceiveBatchStock(ctx context.Context, warehouseID, productID, sku, batchNumber, lotNumber string, quantity int, expiryDate *time.Time, costPrice float64, location string) (*BatchStock, error) {
	if quantity <= 0 {
		return nil, ErrInvalidQuantity
	}

	// Validate expiry date if provided
	if expiryDate != nil && expiryDate.Before(time.Now()) {
		return nil, ErrExpiryDateInPast
	}

	batch := &BatchStock{
		ID:          generateID(),
		WarehouseID: warehouseID,
		ProductID:   productID,
		SKU:         sku,
		BatchNumber: batchNumber,
		LotNumber:   lotNumber,
		ExpiryDate:  expiryDate,
		Quantity:    quantity,
		Reserved:    0,
		Available:   quantity,
		Location:    location,
		ReceivedAt:  time.Now(),
		CostPrice:   costPrice,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateBatchStock(ctx, batch); err != nil {
		return nil, err
	}

	// Check if this batch will expire soon and create alert
	if expiryDate != nil {
		s.checkAndCreateAlert(ctx, batch)
	}

	return batch, nil
}

// GetFEFOStock returns stock sorted by expiry date (First Expired First Out)
func (s *ExpiryService) GetFEFOStock(ctx context.Context, warehouseID, productID string, requiredQty int) ([]*BatchStock, error) {
	batches, err := s.repo.GetBatchStockByProduct(ctx, warehouseID, productID)
	if err != nil {
		return nil, err
	}

	// Filter valid batches
	validBatches := make([]*BatchStock, 0)
	for _, batch := range batches {
		if batch.Available <= 0 {
			continue
		}

		// Skip expired stock if blocking is enabled
		if s.config.BlockExpired && batch.ExpiryDate != nil && batch.ExpiryDate.Before(time.Now()) {
			continue
		}

		validBatches = append(validBatches, batch)
	}

	if len(validBatches) == 0 {
		return nil, ErrNoValidStock
	}

	// Sort by expiry date (FEFO)
	sort.Slice(validBatches, func(i, j int) bool {
		// Batches without expiry date go last
		if validBatches[i].ExpiryDate == nil {
			return false
		}
		if validBatches[j].ExpiryDate == nil {
			return true
		}
		return validBatches[i].ExpiryDate.Before(*validBatches[j].ExpiryDate)
	})

	// Select batches to fulfill required quantity
	result := make([]*BatchStock, 0)
	remainingQty := requiredQty

	for _, batch := range validBatches {
		if remainingQty <= 0 {
			break
		}
		result = append(result, batch)
		remainingQty -= batch.Available
	}

	if remainingQty > 0 {
		return nil, ErrInsufficientStock
	}

	return result, nil
}

// AllocateFEFO allocates stock using FEFO algorithm
func (s *ExpiryService) AllocateFEFO(ctx context.Context, warehouseID, productID string, quantity int) ([]*BatchAllocation, error) {
	batches, err := s.GetFEFOStock(ctx, warehouseID, productID, quantity)
	if err != nil {
		return nil, err
	}

	allocations := make([]*BatchAllocation, 0)
	remainingQty := quantity

	for _, batch := range batches {
		if remainingQty <= 0 {
			break
		}

		allocQty := batch.Available
		if allocQty > remainingQty {
			allocQty = remainingQty
		}

		allocations = append(allocations, &BatchAllocation{
			BatchID:     batch.ID,
			BatchNumber: batch.BatchNumber,
			Quantity:    allocQty,
			ExpiryDate:  batch.ExpiryDate,
			Location:    batch.Location,
		})

		remainingQty -= allocQty
	}

	return allocations, nil
}

// BatchAllocation represents allocation from a specific batch
type BatchAllocation struct {
	BatchID     string     `json:"batch_id"`
	BatchNumber string     `json:"batch_number"`
	Quantity    int        `json:"quantity"`
	ExpiryDate  *time.Time `json:"expiry_date,omitempty"`
	Location    string     `json:"location,omitempty"`
}

// GetExpiringStock returns stock expiring within specified days
func (s *ExpiryService) GetExpiringStock(ctx context.Context, warehouseID string, days int) ([]*BatchStock, error) {
	beforeDate := time.Now().AddDate(0, 0, days)
	return s.repo.ListExpiringStock(ctx, warehouseID, beforeDate)
}

// GetExpiredStock returns all expired stock
func (s *ExpiryService) GetExpiredStock(ctx context.Context, warehouseID string) ([]*BatchStock, error) {
	return s.repo.ListExpiredStock(ctx, warehouseID)
}

// CheckExpiryAlerts scans stock and creates alerts
func (s *ExpiryService) CheckExpiryAlerts(ctx context.Context, warehouseID string) ([]*ExpiryAlert, error) {
	alerts := make([]*ExpiryAlert, 0)

	// Check critical (7 days)
	criticalDate := time.Now().AddDate(0, 0, s.config.CriticalDays)
	criticalStock, err := s.repo.ListExpiringStock(ctx, warehouseID, criticalDate)
	if err != nil {
		return nil, err
	}

	for _, batch := range criticalStock {
		if batch.ExpiryDate == nil {
			continue
		}

		daysLeft := int(time.Until(*batch.ExpiryDate).Hours() / 24)
		alertType := "expiring_soon"

		if daysLeft <= 0 {
			alertType = "expired"
		} else if daysLeft <= s.config.CriticalDays {
			alertType = "critical"
		}

		alert := &ExpiryAlert{
			ID:          generateID(),
			WarehouseID: warehouseID,
			ProductID:   batch.ProductID,
			SKU:         batch.SKU,
			BatchNumber: batch.BatchNumber,
			ExpiryDate:  *batch.ExpiryDate,
			Quantity:    batch.Available,
			DaysLeft:    daysLeft,
			AlertType:   alertType,
			Status:      "pending",
			CreatedAt:   time.Now(),
		}

		if err := s.repo.CreateExpiryAlert(ctx, alert); err != nil {
			continue
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// AcknowledgeAlert marks alert as acknowledged
func (s *ExpiryService) AcknowledgeAlert(ctx context.Context, alertID, userID string) error {
	alert, err := s.repo.GetExpiryAlert(ctx, alertID)
	if err != nil {
		return err
	}

	now := time.Now()
	alert.Status = "acknowledged"
	alert.AcknowledgedAt = &now
	alert.AcknowledgedBy = userID

	return s.repo.UpdateExpiryAlert(ctx, alert)
}

// ResolveAlert marks alert as resolved
func (s *ExpiryService) ResolveAlert(ctx context.Context, alertID string) error {
	alert, err := s.repo.GetExpiryAlert(ctx, alertID)
	if err != nil {
		return err
	}

	alert.Status = "resolved"
	return s.repo.UpdateExpiryAlert(ctx, alert)
}

// GetExpiryDashboard returns expiry statistics
func (s *ExpiryService) GetExpiryDashboard(ctx context.Context, warehouseID string) (*ExpiryDashboard, error) {
	expired, err := s.repo.ListExpiredStock(ctx, warehouseID)
	if err != nil {
		return nil, err
	}

	criticalDate := time.Now().AddDate(0, 0, s.config.CriticalDays)
	critical, err := s.repo.ListExpiringStock(ctx, warehouseID, criticalDate)
	if err != nil {
		return nil, err
	}

	warningDate := time.Now().AddDate(0, 0, s.config.WarningDays)
	warning, err := s.repo.ListExpiringStock(ctx, warehouseID, warningDate)
	if err != nil {
		return nil, err
	}

	pendingAlerts, err := s.repo.GetPendingAlertsCount(ctx, warehouseID)
	if err != nil {
		return nil, err
	}

	// Calculate values
	var expiredValue, criticalValue, warningValue float64
	for _, b := range expired {
		expiredValue += float64(b.Available) * b.CostPrice
	}
	for _, b := range critical {
		if b.ExpiryDate != nil && b.ExpiryDate.After(time.Now()) {
			criticalValue += float64(b.Available) * b.CostPrice
		}
	}
	for _, b := range warning {
		if b.ExpiryDate != nil && b.ExpiryDate.After(criticalDate) {
			warningValue += float64(b.Available) * b.CostPrice
		}
	}

	return &ExpiryDashboard{
		ExpiredCount:    len(expired),
		ExpiredValue:    expiredValue,
		CriticalCount:   len(critical) - len(expired),
		CriticalValue:   criticalValue,
		WarningCount:    len(warning) - len(critical),
		WarningValue:    warningValue,
		PendingAlerts:   pendingAlerts,
		LastChecked:     time.Now(),
	}, nil
}

// ExpiryDashboard contains expiry statistics
type ExpiryDashboard struct {
	ExpiredCount    int       `json:"expired_count"`
	ExpiredValue    float64   `json:"expired_value"`
	CriticalCount   int       `json:"critical_count"`
	CriticalValue   float64   `json:"critical_value"`
	WarningCount    int       `json:"warning_count"`
	WarningValue    float64   `json:"warning_value"`
	PendingAlerts   int       `json:"pending_alerts"`
	LastChecked     time.Time `json:"last_checked"`
}

// checkAndCreateAlert creates alert if batch is expiring soon
func (s *ExpiryService) checkAndCreateAlert(ctx context.Context, batch *BatchStock) {
	if batch.ExpiryDate == nil {
		return
	}

	daysLeft := int(time.Until(*batch.ExpiryDate).Hours() / 24)

	var alertType string
	if daysLeft <= 0 {
		alertType = "expired"
	} else if daysLeft <= s.config.CriticalDays {
		alertType = "critical"
	} else if daysLeft <= s.config.WarningDays {
		alertType = "expiring_soon"
	} else {
		return // No alert needed
	}

	alert := &ExpiryAlert{
		ID:          generateID(),
		WarehouseID: batch.WarehouseID,
		ProductID:   batch.ProductID,
		SKU:         batch.SKU,
		BatchNumber: batch.BatchNumber,
		ExpiryDate:  *batch.ExpiryDate,
		Quantity:    batch.Available,
		DaysLeft:    daysLeft,
		AlertType:   alertType,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}

	s.repo.CreateExpiryAlert(ctx, alert)
}

// AutoWriteOffExpired automatically writes off expired stock
func (s *ExpiryService) AutoWriteOffExpired(ctx context.Context, warehouseID string) ([]*BatchStock, error) {
	if !s.config.AutoWriteOff {
		return nil, nil
	}

	expired, err := s.repo.ListExpiredStock(ctx, warehouseID)
	if err != nil {
		return nil, err
	}

	writtenOff := make([]*BatchStock, 0)

	for _, batch := range expired {
		if batch.Available <= 0 {
			continue
		}

		// Mark as written off (set quantity to 0)
		batch.Quantity = batch.Reserved
		batch.Available = 0
		batch.UpdatedAt = time.Now()

		if err := s.repo.UpdateBatchStock(ctx, batch); err != nil {
			continue
		}

		writtenOff = append(writtenOff, batch)
	}

	return writtenOff, nil
}
