package globalsearch

import (
	"context"
	"testing"
	"time"
)

// MockRepository for testing
type MockRepository struct {
	products      map[string]*GlobalProduct
	tenantConfigs map[string]*TenantIndexConfig
	categories    []*GlobalCategory
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		products:      make(map[string]*GlobalProduct),
		tenantConfigs: make(map[string]*TenantIndexConfig),
		categories:    make([]*GlobalCategory, 0),
	}
}

func (m *MockRepository) IndexProduct(ctx context.Context, product *GlobalProduct) error {
	key := product.TenantID + ":" + product.ID
	m.products[key] = product
	return nil
}

func (m *MockRepository) IndexProducts(ctx context.Context, products []*GlobalProduct) error {
	for _, p := range products {
		m.IndexProduct(ctx, p)
	}
	return nil
}

func (m *MockRepository) UpdateProduct(ctx context.Context, product *GlobalProduct) error {
	return m.IndexProduct(ctx, product)
}

func (m *MockRepository) DeleteProduct(ctx context.Context, tenantID, productID string) error {
	key := tenantID + ":" + productID
	delete(m.products, key)
	return nil
}

func (m *MockRepository) DeleteTenantProducts(ctx context.Context, tenantID string) error {
	for key, p := range m.products {
		if p.TenantID == tenantID {
			delete(m.products, key)
		}
	}
	return nil
}

func (m *MockRepository) GetProduct(ctx context.Context, tenantID, productID string) (*GlobalProduct, error) {
	key := tenantID + ":" + productID
	if p, ok := m.products[key]; ok {
		return p, nil
	}
	return nil, ErrProductNotFound
}

func (m *MockRepository) Search(ctx context.Context, query SearchQuery) (*SearchResult, error) {
	var results []*GlobalProduct

	for _, p := range m.products {
		if p.Visibility != VisibilityPublic {
			continue
		}

		// Simple query matching
		if query.Query != "" && query.Query != "*" {
			if !contains(p.Name, query.Query) && !contains(p.Description, query.Query) {
				continue
			}
		}

		// Category filter
		if len(query.Categories) > 0 {
			found := false
			for _, cat := range query.Categories {
				if p.Category == cat {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Price filter
		price := p.Price
		if p.SalePrice != nil {
			price = *p.SalePrice
		}
		if query.PriceMin != nil && price < *query.PriceMin {
			continue
		}
		if query.PriceMax != nil && price > *query.PriceMax {
			continue
		}

		// In stock filter
		if query.InStock != nil && *query.InStock && !p.InStock {
			continue
		}

		results = append(results, p)
	}

	return &SearchResult{
		Products: results,
		Total:    int64(len(results)),
		Page:     query.Page,
		PageSize: query.PageSize,
		Took:     10,
	}, nil
}

func (m *MockRepository) Suggest(ctx context.Context, query string, limit int) ([]string, error) {
	suggestions := make(map[string]bool)

	for _, p := range m.products {
		if contains(p.Name, query) {
			suggestions[p.Name] = true
		}
		if contains(p.Category, query) {
			suggestions[p.Category] = true
		}
	}

	result := make([]string, 0)
	for s := range suggestions {
		result = append(result, s)
		if len(result) >= limit {
			break
		}
	}

	return result, nil
}

func (m *MockRepository) GetPriceComparison(ctx context.Context, sku string) (*PriceComparison, error) {
	return nil, nil
}

func (m *MockRepository) SearchBySKU(ctx context.Context, sku string) ([]*GlobalProduct, error) {
	var results []*GlobalProduct
	for _, p := range m.products {
		if p.SKU == sku && p.Visibility == VisibilityPublic {
			results = append(results, p)
		}
	}
	return results, nil
}

func (m *MockRepository) GetCategories(ctx context.Context) ([]*GlobalCategory, error) {
	return m.categories, nil
}

func (m *MockRepository) GetCategoryProducts(ctx context.Context, categorySlug string, page, pageSize int) (*SearchResult, error) {
	return m.Search(ctx, SearchQuery{
		Categories: []string{categorySlug},
		Page:       page,
		PageSize:   pageSize,
	})
}

func (m *MockRepository) SaveTenantConfig(ctx context.Context, config *TenantIndexConfig) error {
	m.tenantConfigs[config.TenantID] = config
	return nil
}

func (m *MockRepository) GetTenantConfig(ctx context.Context, tenantID string) (*TenantIndexConfig, error) {
	if config, ok := m.tenantConfigs[tenantID]; ok {
		return config, nil
	}
	return nil, ErrTenantNotIndexed
}

func (m *MockRepository) ListEnabledTenants(ctx context.Context) ([]*TenantIndexConfig, error) {
	var result []*TenantIndexConfig
	for _, c := range m.tenantConfigs {
		if c.IsEnabled {
			result = append(result, c)
		}
	}
	return result, nil
}

func (m *MockRepository) UpdateTenantProductCount(ctx context.Context, tenantID string, count int) error {
	if config, ok := m.tenantConfigs[tenantID]; ok {
		config.ProductCount = count
	}
	return nil
}

// Helper
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0)
}

// MockProductSource for testing
type MockProductSource struct {
	products map[string][]*GlobalProduct
}

func NewMockProductSource() *MockProductSource {
	return &MockProductSource{
		products: make(map[string][]*GlobalProduct),
	}
}

func (m *MockProductSource) AddProducts(tenantID string, products []*GlobalProduct) {
	m.products[tenantID] = products
}

func (m *MockProductSource) FetchProducts(ctx context.Context, tenantID string, since *time.Time) ([]*GlobalProduct, error) {
	if products, ok := m.products[tenantID]; ok {
		return products, nil
	}
	return []*GlobalProduct{}, nil
}

func (m *MockProductSource) FetchProduct(ctx context.Context, tenantID, productID string) (*GlobalProduct, error) {
	if products, ok := m.products[tenantID]; ok {
		for _, p := range products {
			if p.ID == productID {
				return p, nil
			}
		}
	}
	return nil, ErrProductNotFound
}

// Tests

func TestService_EnableTenant(t *testing.T) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	config := &TenantIndexConfig{
		TenantID:     "tenant-1",
		TenantName:   "Test Store",
		TenantDomain: "teststore.shop.com",
		Visibility:   VisibilityPublic,
	}

	err := service.EnableTenant(context.Background(), config)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify config saved
	saved, err := repo.GetTenantConfig(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected config to be saved, got %v", err)
	}

	if !saved.IsEnabled {
		t.Error("expected tenant to be enabled")
	}
}

func TestService_DisableTenant(t *testing.T) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	// Enable first
	config := &TenantIndexConfig{
		TenantID:   "tenant-1",
		TenantName: "Test Store",
		Visibility: VisibilityPublic,
	}
	service.EnableTenant(context.Background(), config)

	// Add some products
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:       "prod-1",
		TenantID: "tenant-1",
		Name:     "Product 1",
	})

	// Disable
	err := service.DisableTenant(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify products removed
	_, err = repo.GetProduct(context.Background(), "tenant-1", "prod-1")
	if err != ErrProductNotFound {
		t.Error("expected products to be removed")
	}
}

func TestService_SyncTenant(t *testing.T) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	// Enable tenant
	config := &TenantIndexConfig{
		TenantID:     "tenant-1",
		TenantName:   "Test Store",
		TenantDomain: "teststore.shop.com",
		Visibility:   VisibilityPublic,
	}
	service.EnableTenant(context.Background(), config)

	// Add products to source
	source.AddProducts("tenant-1", []*GlobalProduct{
		{ID: "prod-1", TenantID: "tenant-1", Name: "iPhone 15", Price: 999},
		{ID: "prod-2", TenantID: "tenant-1", Name: "MacBook Pro", Price: 2499},
	})

	// Sync
	err := service.SyncTenant(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify products indexed
	p1, _ := repo.GetProduct(context.Background(), "tenant-1", "prod-1")
	if p1 == nil {
		t.Error("expected product 1 to be indexed")
	}

	p2, _ := repo.GetProduct(context.Background(), "tenant-1", "prod-2")
	if p2 == nil {
		t.Error("expected product 2 to be indexed")
	}

	// Verify config updated
	savedConfig, _ := repo.GetTenantConfig(context.Background(), "tenant-1")
	if savedConfig.ProductCount != 2 {
		t.Errorf("expected product count 2, got %d", savedConfig.ProductCount)
	}
	if savedConfig.LastSyncAt == nil {
		t.Error("expected last sync time to be set")
	}
}

func TestService_Search(t *testing.T) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	// Add products
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-1",
		TenantID:   "tenant-1",
		Name:       "iPhone 15",
		Category:   "phones",
		Price:      999,
		InStock:    true,
		Visibility: VisibilityPublic,
	})
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-2",
		TenantID:   "tenant-1",
		Name:       "MacBook Pro",
		Category:   "laptops",
		Price:      2499,
		InStock:    true,
		Visibility: VisibilityPublic,
	})
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-3",
		TenantID:   "tenant-2",
		Name:       "Private Product",
		Category:   "phones",
		Price:      500,
		Visibility: VisibilityPrivate, // Should not appear in search
	})

	// Search all
	result, err := service.Search(context.Background(), SearchQuery{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if result.Total != 2 {
		t.Errorf("expected 2 public products, got %d", result.Total)
	}
}

func TestService_Search_WithFilters(t *testing.T) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	// Add products
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-1",
		TenantID:   "tenant-1",
		Name:       "iPhone 15",
		Category:   "phones",
		Price:      999,
		InStock:    true,
		Visibility: VisibilityPublic,
	})
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-2",
		TenantID:   "tenant-1",
		Name:       "iPhone SE",
		Category:   "phones",
		Price:      429,
		InStock:    false,
		Visibility: VisibilityPublic,
	})
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-3",
		TenantID:   "tenant-1",
		Name:       "MacBook Pro",
		Category:   "laptops",
		Price:      2499,
		InStock:    true,
		Visibility: VisibilityPublic,
	})

	// Filter by category
	result, _ := service.Search(context.Background(), SearchQuery{
		Categories: []string{"phones"},
	})
	if result.Total != 2 {
		t.Errorf("expected 2 phones, got %d", result.Total)
	}

	// Filter by price
	priceMin := 500.0
	result, _ = service.Search(context.Background(), SearchQuery{
		PriceMin: &priceMin,
	})
	if result.Total != 2 {
		t.Errorf("expected 2 products above $500, got %d", result.Total)
	}

	// Filter in stock only
	inStock := true
	result, _ = service.Search(context.Background(), SearchQuery{
		InStock: &inStock,
	})
	if result.Total != 2 {
		t.Errorf("expected 2 in-stock products, got %d", result.Total)
	}
}

func TestService_ComparePrices(t *testing.T) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	// Same SKU from different tenants
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-1",
		TenantID:   "tenant-1",
		TenantName: "Store A",
		SKU:        "IPHONE-15-128",
		Name:       "iPhone 15 128GB",
		Price:      999,
		Visibility: VisibilityPublic,
	})
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-2",
		TenantID:   "tenant-2",
		TenantName: "Store B",
		SKU:        "IPHONE-15-128",
		Name:       "iPhone 15 128GB",
		Price:      949,
		Visibility: VisibilityPublic,
	})
	repo.IndexProduct(context.Background(), &GlobalProduct{
		ID:         "prod-3",
		TenantID:   "tenant-3",
		TenantName: "Store C",
		SKU:        "IPHONE-15-128",
		Name:       "iPhone 15 128GB",
		Price:      1049,
		Visibility: VisibilityPublic,
	})

	comparison, err := service.ComparePrices(context.Background(), "IPHONE-15-128")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if comparison.OfferCount != 3 {
		t.Errorf("expected 3 offers, got %d", comparison.OfferCount)
	}

	if comparison.LowestPrice != 949 {
		t.Errorf("expected lowest price $949, got $%.2f", comparison.LowestPrice)
	}

	if comparison.HighestPrice != 1049 {
		t.Errorf("expected highest price $1049, got $%.2f", comparison.HighestPrice)
	}
}

func TestService_ApplyTenantConfig_CategoryMapping(t *testing.T) {
	service := &Service{}

	product := &GlobalProduct{
		ID:       "prod-1",
		TenantID: "tenant-1",
		Category: "телефони",
		Price:    1000,
	}

	config := &TenantIndexConfig{
		TenantID:   "tenant-1",
		TenantName: "Test Store",
		Visibility: VisibilityPublic,
		CategoryMapping: map[string]string{
			"телефони": "phones", // Local to global mapping
		},
	}

	service.applyTenantConfig(product, config)

	if product.Category != "phones" {
		t.Errorf("expected category 'phones', got %s", product.Category)
	}
}

func TestService_ApplyTenantConfig_PriceMarkup(t *testing.T) {
	service := &Service{}

	salePrice := 800.0
	product := &GlobalProduct{
		ID:        "prod-1",
		TenantID:  "tenant-1",
		Price:     1000,
		SalePrice: &salePrice,
	}

	config := &TenantIndexConfig{
		TenantID:    "tenant-1",
		TenantName:  "Test Store",
		Visibility:  VisibilityPublic,
		PriceMarkup: 10, // 10% markup
	}

	service.applyTenantConfig(product, config)

	// Use tolerance for floating point comparison
	tolerance := 0.01
	if product.Price < 1099.99 || product.Price > 1100.01 {
		t.Errorf("expected price $1100 after 10%% markup, got $%.2f", product.Price)
	}

	if *product.SalePrice < 880-tolerance || *product.SalePrice > 880+tolerance {
		t.Errorf("expected sale price $880 after 10%% markup, got $%.2f", *product.SalePrice)
	}
}

func TestService_ApplyTenantConfig_ExcludeCategory(t *testing.T) {
	service := &Service{}

	product := &GlobalProduct{
		ID:         "prod-1",
		TenantID:   "tenant-1",
		Category:   "adult",
		Visibility: VisibilityPublic,
	}

	config := &TenantIndexConfig{
		TenantID:          "tenant-1",
		TenantName:        "Test Store",
		Visibility:        VisibilityPublic,
		ExcludeCategories: []string{"adult", "tobacco"},
	}

	service.applyTenantConfig(product, config)

	if product.Visibility != VisibilityPrivate {
		t.Error("expected excluded category to become private")
	}
}

func TestProductVisibility(t *testing.T) {
	visibilities := []ProductVisibility{
		VisibilityPrivate,
		VisibilityPublic,
		VisibilityPartners,
	}

	for _, v := range visibilities {
		if v == "" {
			t.Error("visibility should not be empty")
		}
	}
}

func TestGlobalProduct_Struct(t *testing.T) {
	salePrice := 899.0
	product := &GlobalProduct{
		ID:           "prod-123",
		TenantID:     "tenant-1",
		TenantName:   "Best Store",
		TenantDomain: "beststore.shop.com",
		SKU:          "IPHONE-15",
		Name:         "iPhone 15",
		Description:  "Latest iPhone",
		Category:     "phones",
		Categories:   []string{"phones", "smartphones", "apple"},
		Brand:        "Apple",
		Price:        999.0,
		SalePrice:    &salePrice,
		Currency:     "USD",
		ImageURL:     "https://example.com/iphone.jpg",
		InStock:      true,
		Rating:       4.8,
		ReviewCount:  1250,
		Visibility:   VisibilityPublic,
	}

	if product.Name != "iPhone 15" {
		t.Error("product name mismatch")
	}
	if *product.SalePrice != 899.0 {
		t.Error("sale price mismatch")
	}
}

func TestSearchQuery_Defaults(t *testing.T) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	result, _ := service.Search(context.Background(), SearchQuery{})

	if result.PageSize != 20 {
		t.Errorf("expected default page size 20, got %d", result.PageSize)
	}
	if result.Page != 1 {
		t.Errorf("expected default page 1, got %d", result.Page)
	}
}

func TestTenantIndexConfig_Struct(t *testing.T) {
	now := time.Now()
	config := &TenantIndexConfig{
		TenantID:         "tenant-1",
		TenantName:       "Test Store",
		TenantDomain:     "test.shop.com",
		IsEnabled:        true,
		Visibility:       VisibilityPublic,
		CategoryMapping:  map[string]string{"local": "global"},
		ExcludeCategories: []string{"adult"},
		PriceMarkup:      5.0,
		CommissionRate:   10.0,
		LastSyncAt:       &now,
		ProductCount:     1000,
	}

	if config.PriceMarkup != 5.0 {
		t.Error("price markup mismatch")
	}
	if config.CommissionRate != 10.0 {
		t.Error("commission rate mismatch")
	}
}

func BenchmarkSearch(b *testing.B) {
	repo := NewMockRepository()
	source := NewMockProductSource()
	service := NewService(repo, source)

	// Add 1000 products
	for i := 0; i < 1000; i++ {
		repo.IndexProduct(context.Background(), &GlobalProduct{
			ID:         string(rune(i)),
			TenantID:   "tenant-1",
			Name:       "Product",
			Category:   "phones",
			Price:      float64(i * 10),
			InStock:    true,
			Visibility: VisibilityPublic,
		})
	}

	ctx := context.Background()
	query := SearchQuery{Categories: []string{"phones"}}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.Search(ctx, query)
	}
}
