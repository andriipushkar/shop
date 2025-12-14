package globalsearch

import (
	"context"
	"errors"
	"time"
)

// Errors
var (
	ErrProductNotFound    = errors.New("product not found")
	ErrTenantNotIndexed   = errors.New("tenant not indexed in global search")
	ErrIndexingFailed     = errors.New("indexing failed")
	ErrSearchFailed       = errors.New("search failed")
)

// ProductVisibility defines who can see the product
type ProductVisibility string

const (
	VisibilityPrivate  ProductVisibility = "private"  // Only tenant's store
	VisibilityPublic   ProductVisibility = "public"   // Global marketplace
	VisibilityPartners ProductVisibility = "partners" // Partner network only
)

// GlobalProduct represents a product in the global index
type GlobalProduct struct {
	ID            string            `json:"id"`
	TenantID      string            `json:"tenant_id"`
	TenantName    string            `json:"tenant_name"`
	TenantDomain  string            `json:"tenant_domain"`
	SKU           string            `json:"sku"`
	Name          string            `json:"name"`
	Description   string            `json:"description"`
	Category      string            `json:"category"`
	Categories    []string          `json:"categories"`
	Brand         string            `json:"brand,omitempty"`
	Price         float64           `json:"price"`
	SalePrice     *float64          `json:"sale_price,omitempty"`
	Currency      string            `json:"currency"`
	ImageURL      string            `json:"image_url"`
	Images        []string          `json:"images,omitempty"`
	URL           string            `json:"url"`
	InStock       bool              `json:"in_stock"`
	StockQuantity int               `json:"stock_quantity,omitempty"`
	Rating        float64           `json:"rating,omitempty"`
	ReviewCount   int               `json:"review_count,omitempty"`
	Attributes    map[string]string `json:"attributes,omitempty"`
	Tags          []string          `json:"tags,omitempty"`
	Visibility    ProductVisibility `json:"visibility"`
	IndexedAt     time.Time         `json:"indexed_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

// TenantIndexConfig defines how a tenant participates in global search
type TenantIndexConfig struct {
	TenantID         string            `json:"tenant_id"`
	TenantName       string            `json:"tenant_name"`
	TenantDomain     string            `json:"tenant_domain"`
	IsEnabled        bool              `json:"is_enabled"`
	Visibility       ProductVisibility `json:"default_visibility"`
	CategoryMapping  map[string]string `json:"category_mapping,omitempty"` // Local → Global category
	ExcludeCategories []string         `json:"exclude_categories,omitempty"`
	PriceMarkup      float64           `json:"price_markup,omitempty"` // % markup for marketplace
	CommissionRate   float64           `json:"commission_rate,omitempty"` // Platform commission %
	LastSyncAt       *time.Time        `json:"last_sync_at,omitempty"`
	ProductCount     int               `json:"product_count"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

// SearchQuery represents a search request
type SearchQuery struct {
	Query       string            `json:"query"`
	Categories  []string          `json:"categories,omitempty"`
	Brands      []string          `json:"brands,omitempty"`
	PriceMin    *float64          `json:"price_min,omitempty"`
	PriceMax    *float64          `json:"price_max,omitempty"`
	InStock     *bool             `json:"in_stock,omitempty"`
	Tenants     []string          `json:"tenants,omitempty"` // Filter by specific tenants
	Attributes  map[string]string `json:"attributes,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	SortBy      string            `json:"sort_by,omitempty"` // relevance, price_asc, price_desc, rating, newest
	Page        int               `json:"page,omitempty"`
	PageSize    int               `json:"page_size,omitempty"`
}

// SearchResult represents search results
type SearchResult struct {
	Products    []*GlobalProduct  `json:"products"`
	Total       int64             `json:"total"`
	Page        int               `json:"page"`
	PageSize    int               `json:"page_size"`
	Facets      *SearchFacets     `json:"facets,omitempty"`
	Suggestions []string          `json:"suggestions,omitempty"`
	Took        int64             `json:"took_ms"`
}

// SearchFacets for filtering
type SearchFacets struct {
	Categories  []FacetBucket `json:"categories,omitempty"`
	Brands      []FacetBucket `json:"brands,omitempty"`
	Tenants     []FacetBucket `json:"tenants,omitempty"`
	PriceRanges []FacetBucket `json:"price_ranges,omitempty"`
	Attributes  map[string][]FacetBucket `json:"attributes,omitempty"`
}

// FacetBucket represents a facet count
type FacetBucket struct {
	Key   string `json:"key"`
	Count int64  `json:"count"`
}

// ComparisonProduct for price comparison
type ComparisonProduct struct {
	Product     *GlobalProduct `json:"product"`
	TenantName  string         `json:"tenant_name"`
	TenantDomain string        `json:"tenant_domain"`
	Price       float64        `json:"price"`
	DeliveryInfo string        `json:"delivery_info,omitempty"`
}

// PriceComparison for comparing prices across tenants
type PriceComparison struct {
	SKU         string               `json:"sku"`
	ProductName string               `json:"product_name"`
	Offers      []*ComparisonProduct `json:"offers"`
	LowestPrice float64              `json:"lowest_price"`
	HighestPrice float64             `json:"highest_price"`
	OfferCount  int                  `json:"offer_count"`
}

// GlobalCategory represents a category in the global taxonomy
type GlobalCategory struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Slug        string           `json:"slug"`
	ParentID    string           `json:"parent_id,omitempty"`
	Level       int              `json:"level"`
	Path        string           `json:"path"`
	ProductCount int64           `json:"product_count"`
	Children    []*GlobalCategory `json:"children,omitempty"`
}

// Repository interface for global search
type Repository interface {
	// Product indexing
	IndexProduct(ctx context.Context, product *GlobalProduct) error
	IndexProducts(ctx context.Context, products []*GlobalProduct) error
	UpdateProduct(ctx context.Context, product *GlobalProduct) error
	DeleteProduct(ctx context.Context, tenantID, productID string) error
	DeleteTenantProducts(ctx context.Context, tenantID string) error
	GetProduct(ctx context.Context, tenantID, productID string) (*GlobalProduct, error)

	// Search
	Search(ctx context.Context, query SearchQuery) (*SearchResult, error)
	Suggest(ctx context.Context, query string, limit int) ([]string, error)

	// Price comparison
	GetPriceComparison(ctx context.Context, sku string) (*PriceComparison, error)
	SearchBySKU(ctx context.Context, sku string) ([]*GlobalProduct, error)

	// Categories
	GetCategories(ctx context.Context) ([]*GlobalCategory, error)
	GetCategoryProducts(ctx context.Context, categorySlug string, page, pageSize int) (*SearchResult, error)

	// Tenant config
	SaveTenantConfig(ctx context.Context, config *TenantIndexConfig) error
	GetTenantConfig(ctx context.Context, tenantID string) (*TenantIndexConfig, error)
	ListEnabledTenants(ctx context.Context) ([]*TenantIndexConfig, error)
	UpdateTenantProductCount(ctx context.Context, tenantID string, count int) error
}

// ProductSource interface for fetching products from tenants
type ProductSource interface {
	FetchProducts(ctx context.Context, tenantID string, since *time.Time) ([]*GlobalProduct, error)
	FetchProduct(ctx context.Context, tenantID, productID string) (*GlobalProduct, error)
}

// Service handles global search operations
type Service struct {
	repo   Repository
	source ProductSource
}

// NewService creates a new global search service
func NewService(repo Repository, source ProductSource) *Service {
	return &Service{
		repo:   repo,
		source: source,
	}
}

// ==================== Search Operations ====================

// Search performs a global product search
func (s *Service) Search(ctx context.Context, query SearchQuery) (*SearchResult, error) {
	if query.PageSize == 0 {
		query.PageSize = 20
	}
	if query.Page == 0 {
		query.Page = 1
	}

	return s.repo.Search(ctx, query)
}

// Suggest returns search suggestions
func (s *Service) Suggest(ctx context.Context, query string) ([]string, error) {
	return s.repo.Suggest(ctx, query, 10)
}

// SearchByCategory returns products in a category
func (s *Service) SearchByCategory(ctx context.Context, categorySlug string, page, pageSize int) (*SearchResult, error) {
	return s.repo.GetCategoryProducts(ctx, categorySlug, page, pageSize)
}

// GetCategories returns the global category tree
func (s *Service) GetCategories(ctx context.Context) ([]*GlobalCategory, error) {
	return s.repo.GetCategories(ctx)
}

// ==================== Price Comparison ====================

// ComparePrices returns price comparison for a SKU
func (s *Service) ComparePrices(ctx context.Context, sku string) (*PriceComparison, error) {
	products, err := s.repo.SearchBySKU(ctx, sku)
	if err != nil {
		return nil, err
	}

	if len(products) == 0 {
		return nil, ErrProductNotFound
	}

	comparison := &PriceComparison{
		SKU:         sku,
		ProductName: products[0].Name,
		Offers:      make([]*ComparisonProduct, 0, len(products)),
		OfferCount:  len(products),
	}

	for i, p := range products {
		offer := &ComparisonProduct{
			Product:      p,
			TenantName:   p.TenantName,
			TenantDomain: p.TenantDomain,
			Price:        p.Price,
		}
		if p.SalePrice != nil {
			offer.Price = *p.SalePrice
		}

		comparison.Offers = append(comparison.Offers, offer)

		// Track min/max
		if i == 0 || offer.Price < comparison.LowestPrice {
			comparison.LowestPrice = offer.Price
		}
		if i == 0 || offer.Price > comparison.HighestPrice {
			comparison.HighestPrice = offer.Price
		}
	}

	return comparison, nil
}

// ==================== Indexing Operations ====================

// EnableTenant enables a tenant for global indexing
func (s *Service) EnableTenant(ctx context.Context, config *TenantIndexConfig) error {
	config.IsEnabled = true
	config.CreatedAt = time.Now()
	config.UpdatedAt = time.Now()

	return s.repo.SaveTenantConfig(ctx, config)
}

// DisableTenant disables a tenant from global indexing
func (s *Service) DisableTenant(ctx context.Context, tenantID string) error {
	config, err := s.repo.GetTenantConfig(ctx, tenantID)
	if err != nil {
		return err
	}

	config.IsEnabled = false
	config.UpdatedAt = time.Now()

	// Remove all products from global index
	if err := s.repo.DeleteTenantProducts(ctx, tenantID); err != nil {
		return err
	}

	return s.repo.SaveTenantConfig(ctx, config)
}

// SyncTenant syncs all products from a tenant
func (s *Service) SyncTenant(ctx context.Context, tenantID string) error {
	config, err := s.repo.GetTenantConfig(ctx, tenantID)
	if err != nil {
		return ErrTenantNotIndexed
	}

	if !config.IsEnabled {
		return ErrTenantNotIndexed
	}

	// Fetch all products
	products, err := s.source.FetchProducts(ctx, tenantID, config.LastSyncAt)
	if err != nil {
		return err
	}

	// Apply config (visibility, category mapping, etc.)
	for _, p := range products {
		s.applyTenantConfig(p, config)
	}

	// Index in batches
	batchSize := 100
	for i := 0; i < len(products); i += batchSize {
		end := i + batchSize
		if end > len(products) {
			end = len(products)
		}

		if err := s.repo.IndexProducts(ctx, products[i:end]); err != nil {
			return err
		}
	}

	// Update last sync time
	now := time.Now()
	config.LastSyncAt = &now
	config.ProductCount = len(products)
	config.UpdatedAt = now

	return s.repo.SaveTenantConfig(ctx, config)
}

// IndexProduct indexes a single product
func (s *Service) IndexProduct(ctx context.Context, tenantID, productID string) error {
	config, err := s.repo.GetTenantConfig(ctx, tenantID)
	if err != nil || !config.IsEnabled {
		return nil // Silently skip if tenant not enabled
	}

	product, err := s.source.FetchProduct(ctx, tenantID, productID)
	if err != nil {
		return err
	}

	s.applyTenantConfig(product, config)

	return s.repo.IndexProduct(ctx, product)
}

// RemoveProduct removes a product from the global index
func (s *Service) RemoveProduct(ctx context.Context, tenantID, productID string) error {
	return s.repo.DeleteProduct(ctx, tenantID, productID)
}

// UpdateProduct updates a product in the global index
func (s *Service) UpdateProduct(ctx context.Context, product *GlobalProduct) error {
	config, err := s.repo.GetTenantConfig(ctx, product.TenantID)
	if err != nil || !config.IsEnabled {
		return nil
	}

	s.applyTenantConfig(product, config)
	return s.repo.UpdateProduct(ctx, product)
}

// applyTenantConfig applies tenant-specific config to a product
func (s *Service) applyTenantConfig(product *GlobalProduct, config *TenantIndexConfig) {
	// Apply default visibility
	if product.Visibility == "" {
		product.Visibility = config.Visibility
	}

	// Apply category mapping
	if config.CategoryMapping != nil {
		if mapped, ok := config.CategoryMapping[product.Category]; ok {
			product.Category = mapped
		}
	}

	// Check excluded categories
	for _, excluded := range config.ExcludeCategories {
		if product.Category == excluded {
			product.Visibility = VisibilityPrivate
			break
		}
	}

	// Apply price markup
	if config.PriceMarkup > 0 {
		product.Price = product.Price * (1 + config.PriceMarkup/100)
		if product.SalePrice != nil {
			newSale := *product.SalePrice * (1 + config.PriceMarkup/100)
			product.SalePrice = &newSale
		}
	}

	// Set tenant info
	product.TenantName = config.TenantName
	product.TenantDomain = config.TenantDomain
	product.IndexedAt = time.Now()
}

// ==================== Analytics ====================

// GetPopularProducts returns most viewed/sold products
func (s *Service) GetPopularProducts(ctx context.Context, limit int) ([]*GlobalProduct, error) {
	result, err := s.repo.Search(ctx, SearchQuery{
		Query:    "*",
		SortBy:   "popularity",
		PageSize: limit,
	})
	if err != nil {
		return nil, err
	}
	return result.Products, nil
}

// GetNewArrivals returns recently added products
func (s *Service) GetNewArrivals(ctx context.Context, limit int) ([]*GlobalProduct, error) {
	result, err := s.repo.Search(ctx, SearchQuery{
		Query:    "*",
		SortBy:   "newest",
		PageSize: limit,
	})
	if err != nil {
		return nil, err
	}
	return result.Products, nil
}

// GetTenantStats returns indexing stats for a tenant
func (s *Service) GetTenantStats(ctx context.Context, tenantID string) (*TenantIndexConfig, error) {
	return s.repo.GetTenantConfig(ctx, tenantID)
}

// GetGlobalStats returns global marketplace stats
func (s *Service) GetGlobalStats(ctx context.Context) (*GlobalStats, error) {
	tenants, err := s.repo.ListEnabledTenants(ctx)
	if err != nil {
		return nil, err
	}

	stats := &GlobalStats{
		TenantCount: len(tenants),
	}

	for _, t := range tenants {
		stats.ProductCount += t.ProductCount
	}

	return stats, nil
}

// GlobalStats represents global marketplace statistics
type GlobalStats struct {
	TenantCount  int `json:"tenant_count"`
	ProductCount int `json:"product_count"`
	CategoryCount int `json:"category_count"`
}
