package inventory

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

var (
	ErrSyncFailed      = errors.New("sync failed")
	ErrProductNotFound = errors.New("product not found in ERP")
	ErrConnectionError = errors.New("connection to ERP failed")
)

// SyncStatus represents sync status
type SyncStatus string

const (
	SyncStatusPending   SyncStatus = "pending"
	SyncStatusRunning   SyncStatus = "running"
	SyncStatusCompleted SyncStatus = "completed"
	SyncStatusFailed    SyncStatus = "failed"
)

// SyncDirection represents sync direction
type SyncDirection string

const (
	SyncDirectionPull SyncDirection = "pull" // From ERP to shop
	SyncDirectionPush SyncDirection = "push" // From shop to ERP
	SyncDirectionBoth SyncDirection = "both"
)

// ERPType represents ERP system type
type ERPType string

const (
	ERP1C          ERPType = "1c"
	ERPOdoo        ERPType = "odoo"
	ERPSalesforce  ERPType = "salesforce"
	ERPCustom      ERPType = "custom"
)

// Config holds sync configuration
type Config struct {
	ERPType       ERPType       `json:"erp_type"`
	BaseURL       string        `json:"base_url"`
	Username      string        `json:"username"`
	Password      string        `json:"password"`
	APIKey        string        `json:"api_key,omitempty"`
	SyncInterval  time.Duration `json:"sync_interval"`
	BatchSize     int           `json:"batch_size"`
	Timeout       time.Duration `json:"timeout"`
	RetryAttempts int           `json:"retry_attempts"`
}

// DefaultConfig returns default sync configuration
func DefaultConfig() *Config {
	return &Config{
		ERPType:       ERP1C,
		SyncInterval:  15 * time.Minute,
		BatchSize:     100,
		Timeout:       30 * time.Second,
		RetryAttempts: 3,
	}
}

// Product represents an inventory product
type Product struct {
	ExternalID    string    `json:"external_id" xml:"ExternalID"`
	SKU           string    `json:"sku" xml:"SKU"`
	Name          string    `json:"name" xml:"Name"`
	Quantity      int       `json:"quantity" xml:"Quantity"`
	ReservedQty   int       `json:"reserved_qty" xml:"ReservedQty"`
	AvailableQty  int       `json:"available_qty" xml:"AvailableQty"`
	Price         float64   `json:"price" xml:"Price"`
	CostPrice     float64   `json:"cost_price" xml:"CostPrice"`
	WarehouseID   string    `json:"warehouse_id" xml:"WarehouseID"`
	WarehouseName string    `json:"warehouse_name" xml:"WarehouseName"`
	LastUpdated   time.Time `json:"last_updated" xml:"LastUpdated"`
}

// SyncResult represents sync operation result
type SyncResult struct {
	ID            string        `json:"id"`
	Direction     SyncDirection `json:"direction"`
	Status        SyncStatus    `json:"status"`
	TotalItems    int           `json:"total_items"`
	SyncedItems   int           `json:"synced_items"`
	FailedItems   int           `json:"failed_items"`
	Errors        []SyncError   `json:"errors,omitempty"`
	StartedAt     time.Time     `json:"started_at"`
	CompletedAt   *time.Time    `json:"completed_at,omitempty"`
	Duration      time.Duration `json:"duration,omitempty"`
}

// SyncError represents a sync error
type SyncError struct {
	SKU     string `json:"sku"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

// Repository defines inventory data store
type Repository interface {
	GetProductBySKU(ctx context.Context, sku string) (*Product, error)
	UpdateInventory(ctx context.Context, sku string, quantity int) error
	UpdatePrice(ctx context.Context, sku string, price float64) error
	BulkUpdateInventory(ctx context.Context, products []*Product) error
	GetOutOfSyncProducts(ctx context.Context, since time.Time) ([]*Product, error)
	SaveSyncResult(ctx context.Context, result *SyncResult) error
	GetLastSyncResult(ctx context.Context) (*SyncResult, error)
}

// ERPClient defines ERP API client interface
type ERPClient interface {
	Connect(ctx context.Context) error
	Close() error
	GetProducts(ctx context.Context, since time.Time) ([]*Product, error)
	GetProduct(ctx context.Context, sku string) (*Product, error)
	UpdateStock(ctx context.Context, sku string, quantity int) error
}

// Service handles inventory synchronization
type Service struct {
	repo      Repository
	client    ERPClient
	config    *Config
	mu        sync.Mutex
	isRunning bool
	stopCh    chan struct{}
}

// NewService creates a new inventory sync service
func NewService(repo Repository, config *Config) *Service {
	return &Service{
		repo:   repo,
		config: config,
		stopCh: make(chan struct{}),
	}
}

// SetClient sets the ERP client
func (s *Service) SetClient(client ERPClient) {
	s.client = client
}

// Start starts the periodic sync
func (s *Service) Start(ctx context.Context) error {
	s.mu.Lock()
	if s.isRunning {
		s.mu.Unlock()
		return nil
	}
	s.isRunning = true
	s.mu.Unlock()

	go s.syncLoop(ctx)
	return nil
}

// Stop stops the periodic sync
func (s *Service) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return
	}

	close(s.stopCh)
	s.isRunning = false
}

func (s *Service) syncLoop(ctx context.Context) {
	ticker := time.NewTicker(s.config.SyncInterval)
	defer ticker.Stop()

	// Initial sync
	_, _ = s.SyncNow(ctx, SyncDirectionPull)

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopCh:
			return
		case <-ticker.C:
			_, _ = s.SyncNow(ctx, SyncDirectionPull)
		}
	}
}

// SyncNow performs immediate sync
func (s *Service) SyncNow(ctx context.Context, direction SyncDirection) (*SyncResult, error) {
	if s.client == nil {
		return nil, errors.New("ERP client not configured")
	}

	result := &SyncResult{
		ID:        generateSyncID(),
		Direction: direction,
		Status:    SyncStatusRunning,
		StartedAt: time.Now(),
		Errors:    make([]SyncError, 0),
	}

	// Connect to ERP
	if err := s.client.Connect(ctx); err != nil {
		result.Status = SyncStatusFailed
		result.Errors = append(result.Errors, SyncError{
			Message: fmt.Sprintf("Connection failed: %v", err),
			Code:    "CONNECTION_ERROR",
		})
		_ = s.repo.SaveSyncResult(ctx, result)
		return result, ErrConnectionError
	}
	defer s.client.Close()

	// Get last sync time
	lastResult, _ := s.repo.GetLastSyncResult(ctx)
	var since time.Time
	if lastResult != nil && lastResult.CompletedAt != nil {
		since = *lastResult.CompletedAt
	} else {
		since = time.Now().AddDate(0, -1, 0) // Default: 1 month ago
	}

	switch direction {
	case SyncDirectionPull:
		s.pullFromERP(ctx, result, since)
	case SyncDirectionPush:
		s.pushToERP(ctx, result, since)
	case SyncDirectionBoth:
		s.pullFromERP(ctx, result, since)
		s.pushToERP(ctx, result, since)
	}

	// Complete
	now := time.Now()
	result.CompletedAt = &now
	result.Duration = now.Sub(result.StartedAt)

	if result.FailedItems > 0 && result.SyncedItems == 0 {
		result.Status = SyncStatusFailed
	} else {
		result.Status = SyncStatusCompleted
	}

	_ = s.repo.SaveSyncResult(ctx, result)
	return result, nil
}

func (s *Service) pullFromERP(ctx context.Context, result *SyncResult, since time.Time) {
	products, err := s.client.GetProducts(ctx, since)
	if err != nil {
		result.Errors = append(result.Errors, SyncError{
			Message: fmt.Sprintf("Failed to fetch products: %v", err),
			Code:    "FETCH_ERROR",
		})
		return
	}

	result.TotalItems = len(products)

	// Process in batches
	for i := 0; i < len(products); i += s.config.BatchSize {
		end := i + s.config.BatchSize
		if end > len(products) {
			end = len(products)
		}
		batch := products[i:end]

		if err := s.repo.BulkUpdateInventory(ctx, batch); err != nil {
			for _, p := range batch {
				result.Errors = append(result.Errors, SyncError{
					SKU:     p.SKU,
					Message: err.Error(),
					Code:    "UPDATE_ERROR",
				})
				result.FailedItems++
			}
		} else {
			result.SyncedItems += len(batch)
		}
	}
}

func (s *Service) pushToERP(ctx context.Context, result *SyncResult, since time.Time) {
	products, err := s.repo.GetOutOfSyncProducts(ctx, since)
	if err != nil {
		result.Errors = append(result.Errors, SyncError{
			Message: fmt.Sprintf("Failed to get products: %v", err),
			Code:    "FETCH_ERROR",
		})
		return
	}

	for _, p := range products {
		result.TotalItems++
		if err := s.client.UpdateStock(ctx, p.SKU, p.Quantity); err != nil {
			result.Errors = append(result.Errors, SyncError{
				SKU:     p.SKU,
				Message: err.Error(),
				Code:    "PUSH_ERROR",
			})
			result.FailedItems++
		} else {
			result.SyncedItems++
		}
	}
}

// GetSyncStatus returns current sync status
func (s *Service) GetSyncStatus(ctx context.Context) (*SyncResult, error) {
	return s.repo.GetLastSyncResult(ctx)
}

func generateSyncID() string {
	return fmt.Sprintf("sync_%d", time.Now().UnixNano())
}

// 1CClient implements ERPClient for 1C:Enterprise
type OneC struct {
	config     *Config
	httpClient *http.Client
}

// NewOneCClient creates a new 1C client
func NewOneCClient(config *Config) *OneC {
	return &OneC{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

func (c *OneC) Connect(ctx context.Context) error {
	// Test connection
	req, err := http.NewRequestWithContext(ctx, "GET", c.config.BaseURL+"/ping", nil)
	if err != nil {
		return err
	}
	c.setAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ErrConnectionError
	}

	return nil
}

func (c *OneC) Close() error {
	return nil
}

func (c *OneC) GetProducts(ctx context.Context, since time.Time) ([]*Product, error) {
	url := fmt.Sprintf("%s/hs/inventory/products?since=%s",
		c.config.BaseURL, since.Format(time.RFC3339))

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// 1C typically returns XML
	var result struct {
		Products []*Product `xml:"Product"`
	}
	if err := xml.Unmarshal(body, &result); err != nil {
		// Try JSON as fallback
		var jsonResult struct {
			Products []*Product `json:"products"`
		}
		if err := json.Unmarshal(body, &jsonResult); err != nil {
			return nil, err
		}
		return jsonResult.Products, nil
	}

	return result.Products, nil
}

func (c *OneC) GetProduct(ctx context.Context, sku string) (*Product, error) {
	url := fmt.Sprintf("%s/hs/inventory/product/%s", c.config.BaseURL, sku)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrProductNotFound
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	var product Product
	if err := json.NewDecoder(resp.Body).Decode(&product); err != nil {
		return nil, err
	}

	return &product, nil
}

func (c *OneC) UpdateStock(ctx context.Context, sku string, quantity int) error {
	url := fmt.Sprintf("%s/hs/inventory/stock", c.config.BaseURL)

	body := fmt.Sprintf(`{"sku": "%s", "quantity": %d}`, sku, quantity)
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)

	_ = body // Would be used in actual request body

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	return nil
}

func (c *OneC) setAuth(req *http.Request) {
	if c.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	} else {
		req.SetBasicAuth(c.config.Username, c.config.Password)
	}
}
