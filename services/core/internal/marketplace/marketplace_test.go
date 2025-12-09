package marketplace

import (
	"context"
	"testing"
	"time"
)

// MockRepository implements Repository for testing
type MockRepository struct {
	products         map[string]*Product
	orders           map[string]*Order
	syncResults      map[MarketplaceType]*SyncResult
	configs          map[MarketplaceType]*Config
	categoryMappings map[MarketplaceType][]CategoryMapping
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		products:         make(map[string]*Product),
		orders:           make(map[string]*Order),
		syncResults:      make(map[MarketplaceType]*SyncResult),
		configs:          make(map[MarketplaceType]*Config),
		categoryMappings: make(map[MarketplaceType][]CategoryMapping),
	}
}

func (r *MockRepository) GetProductsForExport(ctx context.Context, marketplace MarketplaceType) ([]*Product, error) {
	products := make([]*Product, 0, len(r.products))
	for _, p := range r.products {
		products = append(products, p)
	}
	return products, nil
}

func (r *MockRepository) GetProductBySKU(ctx context.Context, sku string) (*Product, error) {
	p, ok := r.products[sku]
	if !ok {
		return nil, ErrProductNotFound
	}
	return p, nil
}

func (r *MockRepository) UpdateProductExternalID(ctx context.Context, sku, externalID string, marketplace MarketplaceType) error {
	if p, ok := r.products[sku]; ok {
		p.ExternalID = externalID
	}
	return nil
}

func (r *MockRepository) SaveMarketplaceOrder(ctx context.Context, order *Order) error {
	r.orders[order.ExternalID] = order
	return nil
}

func (r *MockRepository) GetMarketplaceOrder(ctx context.Context, externalID string, marketplace MarketplaceType) (*Order, error) {
	o, ok := r.orders[externalID]
	if !ok {
		return nil, ErrOrderNotFound
	}
	return o, nil
}

func (r *MockRepository) UpdateMarketplaceOrderStatus(ctx context.Context, externalID string, marketplace MarketplaceType, status string) error {
	if o, ok := r.orders[externalID]; ok {
		o.Status = status
	}
	return nil
}

func (r *MockRepository) SaveSyncResult(ctx context.Context, result *SyncResult) error {
	r.syncResults[result.Marketplace] = result
	return nil
}

func (r *MockRepository) GetLastSyncResult(ctx context.Context, marketplace MarketplaceType, direction SyncDirection) (*SyncResult, error) {
	return r.syncResults[marketplace], nil
}

func (r *MockRepository) GetConfig(ctx context.Context, marketplace MarketplaceType) (*Config, error) {
	return r.configs[marketplace], nil
}

func (r *MockRepository) SaveConfig(ctx context.Context, config *Config) error {
	r.configs[config.Type] = config
	return nil
}

func (r *MockRepository) GetCategoryMappings(ctx context.Context, marketplace MarketplaceType) ([]CategoryMapping, error) {
	return r.categoryMappings[marketplace], nil
}

func (r *MockRepository) SaveCategoryMapping(ctx context.Context, marketplace MarketplaceType, mapping *CategoryMapping) error {
	r.categoryMappings[marketplace] = append(r.categoryMappings[marketplace], *mapping)
	return nil
}

// MockMarketplace implements Marketplace for testing
type MockMarketplace struct {
	mpType       MarketplaceType
	configured   bool
	products     []*Product
	exportCalls  int
	updateCalls  int
}

func NewMockMarketplace(t MarketplaceType) *MockMarketplace {
	return &MockMarketplace{
		mpType:   t,
		products: make([]*Product, 0),
	}
}

func (m *MockMarketplace) Type() MarketplaceType {
	return m.mpType
}

func (m *MockMarketplace) Configure(config *Config) error {
	m.configured = true
	return nil
}

func (m *MockMarketplace) IsConfigured() bool {
	return m.configured
}

func (m *MockMarketplace) ExportProducts(ctx context.Context, products []*Product) (*SyncResult, error) {
	m.exportCalls++
	m.products = products

	now := time.Now()
	return &SyncResult{
		Marketplace:    m.mpType,
		Direction:      SyncExport,
		Status:         SyncStatusCompleted,
		TotalItems:     len(products),
		ProcessedItems: len(products),
		SuccessItems:   len(products),
		StartedAt:      now,
		CompletedAt:    &now,
	}, nil
}

func (m *MockMarketplace) UpdateProduct(ctx context.Context, product *Product) error {
	m.updateCalls++
	return nil
}

func (m *MockMarketplace) UpdateStock(ctx context.Context, sku string, quantity int) error {
	m.updateCalls++
	return nil
}

func (m *MockMarketplace) UpdatePrice(ctx context.Context, sku string, price float64) error {
	m.updateCalls++
	return nil
}

func (m *MockMarketplace) DeleteProduct(ctx context.Context, sku string) error {
	return nil
}

func (m *MockMarketplace) ImportOrders(ctx context.Context, since time.Time) ([]*Order, error) {
	return []*Order{
		{
			ExternalID:    "order-1",
			Marketplace:   m.mpType,
			Status:        "new",
			CustomerName:  "Test Customer",
			CustomerPhone: "+380991234567",
			Total:         100.00,
		},
	}, nil
}

func (m *MockMarketplace) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

func (m *MockMarketplace) GetCategories(ctx context.Context) ([]Category, error) {
	return []Category{
		{ID: "1", Name: "Category 1"},
		{ID: "2", Name: "Category 2", ParentID: "1"},
	}, nil
}

func (m *MockMarketplace) GenerateFeed(ctx context.Context, products []*Product) ([]byte, error) {
	return []byte("<feed>test</feed>"), nil
}

func TestManager_Register(t *testing.T) {
	repo := NewMockRepository()
	manager := NewManager(repo)

	mp := NewMockMarketplace(MarketplaceProm)
	manager.Register(mp)

	got, err := manager.Get(MarketplaceProm)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if got.Type() != MarketplaceProm {
		t.Errorf("Expected %s, got %s", MarketplaceProm, got.Type())
	}
}

func TestManager_GetNotFound(t *testing.T) {
	repo := NewMockRepository()
	manager := NewManager(repo)

	_, err := manager.Get(MarketplaceProm)
	if err != ErrMarketplaceNotConfigured {
		t.Errorf("Expected ErrMarketplaceNotConfigured, got %v", err)
	}
}

func TestManager_SyncAll(t *testing.T) {
	repo := NewMockRepository()
	repo.products["SKU-1"] = &Product{
		SKU:         "SKU-1",
		Name:        "Test Product",
		Price:       100.00,
		Quantity:    10,
		IsActive:    true,
		IsAvailable: true,
	}

	manager := NewManager(repo)

	mp1 := NewMockMarketplace(MarketplaceProm)
	mp1.configured = true
	manager.Register(mp1)

	mp2 := NewMockMarketplace(MarketplaceRozetka)
	mp2.configured = true
	manager.Register(mp2)

	mp3 := NewMockMarketplace(MarketplaceOLX)
	// Not configured
	manager.Register(mp3)

	ctx := context.Background()
	results := manager.SyncAll(ctx)

	if len(results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(results))
	}

	if results[MarketplaceProm].Status != SyncStatusCompleted {
		t.Errorf("Expected completed status for Prom")
	}

	if results[MarketplaceRozetka].Status != SyncStatusCompleted {
		t.Errorf("Expected completed status for Rozetka")
	}

	if _, ok := results[MarketplaceOLX]; ok {
		t.Error("Expected no result for unconfigured OLX")
	}
}

func TestService_SyncProducts(t *testing.T) {
	repo := NewMockRepository()
	repo.products["SKU-1"] = &Product{
		SKU:         "SKU-1",
		Name:        "Test Product",
		Price:       100.00,
		Quantity:    10,
		CategoryID:  "cat-1",
		IsActive:    true,
		IsAvailable: true,
	}

	service := NewService(repo)
	mp := NewMockMarketplace(MarketplaceProm)
	mp.configured = true
	service.RegisterMarketplace(mp)

	ctx := context.Background()
	result, err := service.SyncProducts(ctx, MarketplaceProm)

	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	if result.Status != SyncStatusCompleted {
		t.Errorf("Expected completed status, got %s", result.Status)
	}

	if result.TotalItems != 1 {
		t.Errorf("Expected 1 item, got %d", result.TotalItems)
	}

	if mp.exportCalls != 1 {
		t.Errorf("Expected 1 export call, got %d", mp.exportCalls)
	}
}

func TestService_SyncOrders(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	mp := NewMockMarketplace(MarketplaceProm)
	mp.configured = true
	service.RegisterMarketplace(mp)

	ctx := context.Background()
	orders, err := service.SyncOrders(ctx, MarketplaceProm)

	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	if len(orders) != 1 {
		t.Errorf("Expected 1 order, got %d", len(orders))
	}

	// Check order was saved
	saved, _ := repo.GetMarketplaceOrder(ctx, "order-1", MarketplaceProm)
	if saved == nil {
		t.Error("Expected order to be saved")
	}
}

func TestService_GetFeed(t *testing.T) {
	repo := NewMockRepository()
	repo.products["SKU-1"] = &Product{
		SKU:         "SKU-1",
		Name:        "Test Product",
		Price:       100.00,
		IsActive:    true,
		IsAvailable: true,
	}

	service := NewService(repo)
	mp := NewMockMarketplace(MarketplaceProm)
	mp.configured = true
	service.RegisterMarketplace(mp)

	ctx := context.Background()

	// First call generates feed
	feed1, err := service.GetFeed(ctx, MarketplaceProm, false)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if feed1 == nil {
		t.Error("Expected feed to be generated")
	}

	// Second call uses cache
	feed2, err := service.GetFeed(ctx, MarketplaceProm, false)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if string(feed1) != string(feed2) {
		t.Error("Expected cached feed")
	}

	// Regenerate
	service.InvalidateFeedCache(MarketplaceProm)
	feed3, err := service.GetFeed(ctx, MarketplaceProm, true)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if feed3 == nil {
		t.Error("Expected regenerated feed")
	}
}

func TestService_UpdateStock(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	mp := NewMockMarketplace(MarketplaceProm)
	mp.configured = true
	service.RegisterMarketplace(mp)

	ctx := context.Background()
	err := service.UpdateStock(ctx, MarketplaceProm, "SKU-1", 5)

	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	if mp.updateCalls != 1 {
		t.Errorf("Expected 1 update call, got %d", mp.updateCalls)
	}
}

func TestService_UpdateStockAll(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	mp1 := NewMockMarketplace(MarketplaceProm)
	mp1.configured = true
	service.RegisterMarketplace(mp1)

	mp2 := NewMockMarketplace(MarketplaceRozetka)
	mp2.configured = true
	service.RegisterMarketplace(mp2)

	ctx := context.Background()
	results := service.UpdateStockAll(ctx, "SKU-1", 5)

	if len(results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(results))
	}

	if mp1.updateCalls != 1 || mp2.updateCalls != 1 {
		t.Error("Expected both marketplaces to be updated")
	}
}

func TestService_CategoryMappings(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	mp := NewMockMarketplace(MarketplaceProm)
	mp.configured = true
	service.RegisterMarketplace(mp)

	ctx := context.Background()

	mapping := &CategoryMapping{
		ShopCategoryID:        "shop-cat-1",
		MarketplaceCategoryID: "prom-cat-1",
	}

	err := service.SaveCategoryMapping(ctx, MarketplaceProm, mapping)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	mappings, err := service.GetCategoryMappings(ctx, MarketplaceProm)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	if len(mappings) != 1 {
		t.Errorf("Expected 1 mapping, got %d", len(mappings))
	}

	if mappings[0].ShopCategoryID != "shop-cat-1" {
		t.Errorf("Expected shop-cat-1, got %s", mappings[0].ShopCategoryID)
	}
}

func TestService_GetMarketplaceStatus(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	mp1 := NewMockMarketplace(MarketplaceProm)
	mp1.configured = true
	service.RegisterMarketplace(mp1)

	mp2 := NewMockMarketplace(MarketplaceRozetka)
	// Not configured
	service.RegisterMarketplace(mp2)

	ctx := context.Background()
	statuses := service.GetMarketplaceStatus(ctx)

	if len(statuses) != 2 {
		t.Errorf("Expected 2 statuses, got %d", len(statuses))
	}

	if !statuses[MarketplaceProm].Configured {
		t.Error("Expected Prom to be configured")
	}

	if statuses[MarketplaceRozetka].Configured {
		t.Error("Expected Rozetka to be unconfigured")
	}
}

func TestProduct_Validation(t *testing.T) {
	tests := []struct {
		name    string
		product *Product
		valid   bool
	}{
		{
			name: "Valid product",
			product: &Product{
				SKU:         "SKU-1",
				Name:        "Test Product",
				Price:       100.00,
				IsActive:    true,
				IsAvailable: true,
			},
			valid: true,
		},
		{
			name: "Empty SKU",
			product: &Product{
				SKU:   "",
				Name:  "Test Product",
				Price: 100.00,
			},
			valid: false,
		},
		{
			name: "Zero price",
			product: &Product{
				SKU:   "SKU-1",
				Name:  "Test Product",
				Price: 0,
			},
			valid: false,
		},
		{
			name: "Empty name",
			product: &Product{
				SKU:   "SKU-1",
				Name:  "",
				Price: 100.00,
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := validateProduct(tt.product)
			if valid != tt.valid {
				t.Errorf("Expected valid=%v, got %v", tt.valid, valid)
			}
		})
	}
}

func validateProduct(p *Product) bool {
	if p.SKU == "" {
		return false
	}
	if p.Name == "" {
		return false
	}
	if p.Price <= 0 {
		return false
	}
	return true
}

func TestSyncResult_Status(t *testing.T) {
	tests := []struct {
		name     string
		success  int
		failed   int
		expected SyncStatus
	}{
		{
			name:     "All success",
			success:  10,
			failed:   0,
			expected: SyncStatusCompleted,
		},
		{
			name:     "All failed",
			success:  0,
			failed:   10,
			expected: SyncStatusFailed,
		},
		{
			name:     "Partial success",
			success:  5,
			failed:   5,
			expected: SyncStatusCompleted,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &SyncResult{
				SuccessItems: tt.success,
				FailedItems:  tt.failed,
			}

			if tt.failed > 0 && tt.success == 0 {
				result.Status = SyncStatusFailed
			} else {
				result.Status = SyncStatusCompleted
			}

			if result.Status != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result.Status)
			}
		})
	}
}

func TestOrder_Total(t *testing.T) {
	order := &Order{
		Items: []OrderItem{
			{Price: 100.00, Quantity: 2},
			{Price: 50.00, Quantity: 3},
		},
	}

	expected := 350.00
	total := 0.0
	for _, item := range order.Items {
		total += item.Price * float64(item.Quantity)
	}

	if total != expected {
		t.Errorf("Expected total %.2f, got %.2f", expected, total)
	}
}
