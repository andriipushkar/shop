package pim

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/google/uuid"
)

// Cache interface for caching operations
type Cache interface {
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Get(ctx context.Context, key string, dest interface{}) error
	Delete(ctx context.Context, keys ...string) error
	InvalidateProducts(ctx context.Context) error
	InvalidateProduct(ctx context.Context, productID string) error
	InvalidateCategories(ctx context.Context) error
	InvalidateCategory(ctx context.Context, categoryID string) error
}

const (
	productsListKey   = "products:all"
	categoriesListKey = "categories:all"
	productKeyPrefix  = "product:"
	categoryKeyPrefix = "category:"
	defaultTTL        = 5 * time.Minute
	listTTL           = 2 * time.Minute
)

// Category represents a product category
type Category struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// Product represents a simplified product entity
type Product struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	SKU         string    `json:"sku"`
	Stock       int       `json:"stock"`
	ImageURL    string    `json:"image_url,omitempty"`
	CategoryID  string    `json:"category_id,omitempty"`
	Category    *Category `json:"category,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProductFilter contains search and filter parameters
type ProductFilter struct {
	Search     string
	MinPrice   *float64
	MaxPrice   *float64
	CategoryID string
}

// Review represents a product review
type Review struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	UserID    int64     `json:"user_id"`
	UserName  string    `json:"user_name"`
	Rating    int       `json:"rating"` // 1-5
	Comment   string    `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

// CartItem represents an item in a user's cart
type CartItem struct {
	UserID    int64     `json:"user_id"`
	ProductID string    `json:"product_id"`
	Name      string    `json:"name"`
	Price     float64   `json:"price"`
	Quantity  int       `json:"quantity"`
	ImageURL  string    `json:"image_url,omitempty"`
	AddedAt   time.Time `json:"added_at"`
}

// Repository defines the interface for product storage
type Repository interface {
	Save(ctx context.Context, product *Product) error
	GetByID(ctx context.Context, id string) (*Product, error)
	List(ctx context.Context) ([]*Product, error)
	ListWithFilter(ctx context.Context, filter ProductFilter) ([]*Product, error)
	Delete(ctx context.Context, id string) error
	UpdateStock(ctx context.Context, id string, stock int) error
	DecrementStock(ctx context.Context, id string, quantity int) error
	UpdateImage(ctx context.Context, id string, imageURL string) error
}

// CategoryRepository defines the interface for category storage
type CategoryRepository interface {
	SaveCategory(ctx context.Context, category *Category) error
	GetCategoryByID(ctx context.Context, id string) (*Category, error)
	ListCategories(ctx context.Context) ([]*Category, error)
	DeleteCategory(ctx context.Context, id string) error
}

// CartRepository defines the interface for cart storage
type CartRepository interface {
	AddToCart(ctx context.Context, item *CartItem) error
	GetCart(ctx context.Context, userID int64) ([]*CartItem, error)
	RemoveFromCart(ctx context.Context, userID int64, productID string) error
	ClearCart(ctx context.Context, userID int64) error
	UpdateCartItemQuantity(ctx context.Context, userID int64, productID string, quantity int) error
}

// WishlistItem represents an item in user's wishlist
type WishlistItem struct {
	UserID    int64     `json:"user_id"`
	ProductID string    `json:"product_id"`
	Name      string    `json:"name"`
	Price     float64   `json:"price"`
	ImageURL  string    `json:"image_url,omitempty"`
	AddedAt   time.Time `json:"added_at"`
}

// PriceHistory represents a price change record
type PriceHistory struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	OldPrice  float64   `json:"old_price"`
	NewPrice  float64   `json:"new_price"`
	ChangedAt time.Time `json:"changed_at"`
}

// WishlistRepository defines the interface for wishlist storage
type WishlistRepository interface {
	AddToWishlist(ctx context.Context, item *WishlistItem) error
	GetWishlist(ctx context.Context, userID int64) ([]*WishlistItem, error)
	RemoveFromWishlist(ctx context.Context, userID int64, productID string) error
	ClearWishlist(ctx context.Context, userID int64) error
	IsInWishlist(ctx context.Context, userID int64, productID string) (bool, error)
}

// PriceHistoryRepository defines the interface for price history storage
type PriceHistoryRepository interface {
	RecordPriceChange(ctx context.Context, record *PriceHistory) error
	GetPriceHistory(ctx context.Context, productID string) ([]*PriceHistory, error)
	GetLatestPrice(ctx context.Context, productID string) (*PriceHistory, error)
}

// ReviewRepository defines the interface for review storage
type ReviewRepository interface {
	CreateReview(ctx context.Context, review *Review) error
	GetProductReviews(ctx context.Context, productID string) ([]*Review, error)
	GetUserReviews(ctx context.Context, userID int64) ([]*Review, error)
	GetReview(ctx context.Context, id string) (*Review, error)
	DeleteReview(ctx context.Context, id string) error
	GetAverageRating(ctx context.Context, productID string) (float64, int, error) // returns avgRating, count, error
}

// ProductRating represents aggregated rating info
type ProductRating struct {
	ProductID     string  `json:"product_id"`
	AverageRating float64 `json:"average_rating"`
	ReviewCount   int     `json:"review_count"`
}

// Recommendation represents a product recommendation
type Recommendation struct {
	Product *Product `json:"product"`
	Reason  string   `json:"reason"` // e.g., "similar_category", "frequently_bought_together", "popular"
	Score   float64  `json:"score"`
}

// LowStockProduct represents a product with low stock
type LowStockProduct struct {
	Product   *Product `json:"product"`
	Stock     int      `json:"stock"`
	Threshold int      `json:"threshold"`
}

// AnalyticsDashboard represents analytics dashboard data
type AnalyticsDashboard struct {
	TotalRevenue      float64              `json:"total_revenue"`
	TotalOrders       int                  `json:"total_orders"`
	TotalProducts     int                  `json:"total_products"`
	TotalCategories   int                  `json:"total_categories"`
	AverageOrderValue float64              `json:"average_order_value"`
	TopProducts       []map[string]interface{} `json:"top_products"`
	DailySales        []map[string]interface{} `json:"daily_sales"`
	SalesByCategory   []map[string]interface{} `json:"sales_by_category"`
}

// AnalyticsRepository defines analytics data access
type AnalyticsRepository interface {
	GetTopSellingProducts(ctx context.Context, limit int) ([]*ProductSalesStats, error)
	GetDailySales(ctx context.Context, days int) ([]*DailySales, error)
	GetSalesByCategory(ctx context.Context) ([]*CategorySales, error)
	GetTotalRevenue(ctx context.Context) (float64, error)
	GetTotalOrders(ctx context.Context) (int, error)
}

// ProductSalesStats for analytics
type ProductSalesStats struct {
	ProductID     string  `json:"product_id"`
	ProductName   string  `json:"product_name"`
	TotalQuantity int     `json:"total_quantity"`
	TotalRevenue  float64 `json:"total_revenue"`
	OrderCount    int     `json:"order_count"`
	AvgOrderValue float64 `json:"avg_order_value"`
	AvgQuantity   float64 `json:"avg_quantity"`
}

// DailySales for analytics
type DailySales struct {
	Date         string  `json:"date"`
	TotalOrders  int     `json:"total_orders"`
	TotalRevenue float64 `json:"total_revenue"`
	TotalItems   int     `json:"total_items"`
}

// CategorySales for analytics
type CategorySales struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	TotalRevenue float64 `json:"total_revenue"`
	OrderCount   int     `json:"order_count"`
	ItemCount    int     `json:"item_count"`
}

// SearchClient interface for Elasticsearch operations
type SearchClient interface {
	IndexProduct(ctx context.Context, product *SearchProduct) error
	DeleteProduct(ctx context.Context, productID string) error
	Search(ctx context.Context, query *SearchQuery) (*SearchResult, error)
	Suggest(ctx context.Context, prefix string, limit int) ([]string, error)
	BulkIndex(ctx context.Context, products []*SearchProduct) error
}

// SearchProduct represents a searchable product
type SearchProduct struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	CategoryID  string   `json:"category_id"`
	Category    string   `json:"category"`
	Price       float64  `json:"price"`
	Stock       int      `json:"stock"`
	ImageURL    string   `json:"image_url"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
}

// SearchQuery represents search parameters
type SearchQuery struct {
	Query      string   `json:"query"`
	CategoryID string   `json:"category_id,omitempty"`
	MinPrice   *float64 `json:"min_price,omitempty"`
	MaxPrice   *float64 `json:"max_price,omitempty"`
	InStock    *bool    `json:"in_stock,omitempty"`
	SortBy     string   `json:"sort_by,omitempty"`
	Page       int      `json:"page,omitempty"`
	PageSize   int      `json:"page_size,omitempty"`
}

// SearchResult represents search response
type SearchResult struct {
	Products   []*SearchProduct `json:"products"`
	Total      int64            `json:"total"`
	TookMs     int64            `json:"took_ms"`
	Page       int              `json:"page"`
	PageSize   int              `json:"page_size"`
	TotalPages int              `json:"total_pages"`
}

// Service handles PIM business logic
type Service struct {
	repo             Repository
	catRepo          CategoryRepository
	cartRepo         CartRepository
	wishlistRepo     WishlistRepository
	priceHistoryRepo PriceHistoryRepository
	reviewRepo       ReviewRepository
	analyticsRepo    AnalyticsRepository
	cache            Cache
	search           SearchClient
}

// NewService creates a new PIM service
func NewService(repo Repository, catRepo CategoryRepository) *Service {
	return &Service{repo: repo, catRepo: catRepo}
}

// SetCartRepository sets the cart repository (optional)
func (s *Service) SetCartRepository(cartRepo CartRepository) {
	s.cartRepo = cartRepo
}

// SetCache sets the cache (optional)
func (s *Service) SetCache(cache Cache) {
	s.cache = cache
}

// SetWishlistRepository sets the wishlist repository (optional)
func (s *Service) SetWishlistRepository(wishlistRepo WishlistRepository) {
	s.wishlistRepo = wishlistRepo
}

// SetPriceHistoryRepository sets the price history repository (optional)
func (s *Service) SetPriceHistoryRepository(priceHistoryRepo PriceHistoryRepository) {
	s.priceHistoryRepo = priceHistoryRepo
}

// SetReviewRepository sets the review repository (optional)
func (s *Service) SetReviewRepository(reviewRepo ReviewRepository) {
	s.reviewRepo = reviewRepo
}

// SetAnalyticsRepository sets the analytics repository (optional)
func (s *Service) SetAnalyticsRepository(analyticsRepo AnalyticsRepository) {
	s.analyticsRepo = analyticsRepo
}

// SetSearchClient sets the search client (optional)
func (s *Service) SetSearchClient(search SearchClient) {
	s.search = search
}

// CreateProduct creates a new product and validates it
func (s *Service) CreateProduct(ctx context.Context, p *Product) error {
	if p.Name == "" {
		return errors.New("product name is required")
	}
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.Price < 0 {
		return errors.New("product price cannot be negative")
	}

	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()

	if err := s.repo.Save(ctx, p); err != nil {
		return err
	}

	// Index in Elasticsearch
	if s.search != nil {
		searchProduct := s.toSearchProduct(p)
		if err := s.search.IndexProduct(ctx, searchProduct); err != nil {
			log.Printf("elasticsearch index error: %v", err)
		}
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateProducts(ctx); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

// toSearchProduct converts Product to SearchProduct
func (s *Service) toSearchProduct(p *Product) *SearchProduct {
	categoryName := ""
	if p.Category != nil {
		categoryName = p.Category.Name
	}
	return &SearchProduct{
		ID:          p.ID,
		Name:        p.Name,
		Description: p.Description,
		CategoryID:  p.CategoryID,
		Category:    categoryName,
		Price:       p.Price,
		Stock:       p.Stock,
		ImageURL:    p.ImageURL,
		CreatedAt:   p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
	}
}

// List returns all products
func (s *Service) List(ctx context.Context) ([]*Product, error) {
	// Try cache first
	if s.cache != nil {
		var cached []*Product
		if err := s.cache.Get(ctx, productsListKey, &cached); err == nil {
			return cached, nil
		}
	}

	products, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	// Cache result
	if s.cache != nil && len(products) > 0 {
		if err := s.cache.Set(ctx, productsListKey, products, listTTL); err != nil {
			log.Printf("cache set error: %v", err)
		}
	}

	return products, nil
}

// ListWithFilter returns products matching the filter (not cached due to variable filters)
func (s *Service) ListWithFilter(ctx context.Context, filter ProductFilter) ([]*Product, error) {
	return s.repo.ListWithFilter(ctx, filter)
}

func (s *Service) UpdateProduct(ctx context.Context, p *Product) error {
	if p.ID == "" {
		return errors.New("product ID is required for update")
	}

	// Check if price changed and record history
	if s.priceHistoryRepo != nil {
		existingProduct, err := s.repo.GetByID(ctx, p.ID)
		if err == nil && existingProduct.Price != p.Price {
			record := &PriceHistory{
				ID:        uuid.New().String(),
				ProductID: p.ID,
				OldPrice:  existingProduct.Price,
				NewPrice:  p.Price,
				ChangedAt: time.Now(),
			}
			if err := s.priceHistoryRepo.RecordPriceChange(ctx, record); err != nil {
				log.Printf("price history record error: %v", err)
			}
		}
	}

	p.UpdatedAt = time.Now()

	if err := s.repo.Save(ctx, p); err != nil {
		return err
	}

	// Update in Elasticsearch
	if s.search != nil {
		searchProduct := s.toSearchProduct(p)
		if err := s.search.IndexProduct(ctx, searchProduct); err != nil {
			log.Printf("elasticsearch update error: %v", err)
		}
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateProduct(ctx, p.ID); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

func (s *Service) DeleteProduct(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	// Delete from Elasticsearch
	if s.search != nil {
		if err := s.search.DeleteProduct(ctx, id); err != nil {
			log.Printf("elasticsearch delete error: %v", err)
		}
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateProduct(ctx, id); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

func (s *Service) GetProduct(ctx context.Context, id string) (*Product, error) {
	// Try cache first
	if s.cache != nil {
		var cached Product
		if err := s.cache.Get(ctx, productKeyPrefix+id, &cached); err == nil {
			return &cached, nil
		}
	}

	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Cache result
	if s.cache != nil {
		if err := s.cache.Set(ctx, productKeyPrefix+id, product, defaultTTL); err != nil {
			log.Printf("cache set error: %v", err)
		}
	}

	return product, nil
}

func (s *Service) UpdateStock(ctx context.Context, id string, stock int) error {
	if stock < 0 {
		return errors.New("stock cannot be negative")
	}
	if err := s.repo.UpdateStock(ctx, id, stock); err != nil {
		return err
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateProduct(ctx, id); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

func (s *Service) DecrementStock(ctx context.Context, id string, quantity int) error {
	if quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	if err := s.repo.DecrementStock(ctx, id, quantity); err != nil {
		return err
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateProduct(ctx, id); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

func (s *Service) UpdateImage(ctx context.Context, id string, imageURL string) error {
	if err := s.repo.UpdateImage(ctx, id, imageURL); err != nil {
		return err
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateProduct(ctx, id); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

// Category methods

func (s *Service) CreateCategory(ctx context.Context, c *Category) error {
	if c.Name == "" {
		return errors.New("category name is required")
	}
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.CreatedAt = time.Now()

	if err := s.catRepo.SaveCategory(ctx, c); err != nil {
		return err
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateCategories(ctx); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

func (s *Service) ListCategories(ctx context.Context) ([]*Category, error) {
	// Try cache first
	if s.cache != nil {
		var cached []*Category
		if err := s.cache.Get(ctx, categoriesListKey, &cached); err == nil {
			return cached, nil
		}
	}

	categories, err := s.catRepo.ListCategories(ctx)
	if err != nil {
		return nil, err
	}

	// Cache result
	if s.cache != nil && len(categories) > 0 {
		if err := s.cache.Set(ctx, categoriesListKey, categories, listTTL); err != nil {
			log.Printf("cache set error: %v", err)
		}
	}

	return categories, nil
}

func (s *Service) GetCategory(ctx context.Context, id string) (*Category, error) {
	// Try cache first
	if s.cache != nil {
		var cached Category
		if err := s.cache.Get(ctx, categoryKeyPrefix+id, &cached); err == nil {
			return &cached, nil
		}
	}

	category, err := s.catRepo.GetCategoryByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Cache result
	if s.cache != nil {
		if err := s.cache.Set(ctx, categoryKeyPrefix+id, category, defaultTTL); err != nil {
			log.Printf("cache set error: %v", err)
		}
	}

	return category, nil
}

func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	if err := s.catRepo.DeleteCategory(ctx, id); err != nil {
		return err
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.InvalidateCategory(ctx, id); err != nil {
			log.Printf("cache invalidation error: %v", err)
		}
	}

	return nil
}

// Cart methods

func (s *Service) AddToCart(ctx context.Context, userID int64, productID string, quantity int) error {
	if s.cartRepo == nil {
		return errors.New("cart repository not configured")
	}
	if quantity <= 0 {
		return errors.New("quantity must be positive")
	}

	// Get product info
	product, err := s.repo.GetByID(ctx, productID)
	if err != nil {
		return err
	}

	item := &CartItem{
		UserID:    userID,
		ProductID: productID,
		Name:      product.Name,
		Price:     product.Price,
		Quantity:  quantity,
		ImageURL:  product.ImageURL,
		AddedAt:   time.Now(),
	}

	return s.cartRepo.AddToCart(ctx, item)
}

func (s *Service) GetCart(ctx context.Context, userID int64) ([]*CartItem, error) {
	if s.cartRepo == nil {
		return nil, errors.New("cart repository not configured")
	}
	return s.cartRepo.GetCart(ctx, userID)
}

func (s *Service) RemoveFromCart(ctx context.Context, userID int64, productID string) error {
	if s.cartRepo == nil {
		return errors.New("cart repository not configured")
	}
	return s.cartRepo.RemoveFromCart(ctx, userID, productID)
}

func (s *Service) ClearCart(ctx context.Context, userID int64) error {
	if s.cartRepo == nil {
		return errors.New("cart repository not configured")
	}
	return s.cartRepo.ClearCart(ctx, userID)
}

func (s *Service) UpdateCartItemQuantity(ctx context.Context, userID int64, productID string, quantity int) error {
	if s.cartRepo == nil {
		return errors.New("cart repository not configured")
	}
	if quantity <= 0 {
		return s.cartRepo.RemoveFromCart(ctx, userID, productID)
	}
	return s.cartRepo.UpdateCartItemQuantity(ctx, userID, productID, quantity)
}

// Wishlist methods

func (s *Service) AddToWishlist(ctx context.Context, userID int64, productID string) error {
	if s.wishlistRepo == nil {
		return errors.New("wishlist repository not configured")
	}

	// Get product info
	product, err := s.repo.GetByID(ctx, productID)
	if err != nil {
		return err
	}

	item := &WishlistItem{
		UserID:    userID,
		ProductID: productID,
		Name:      product.Name,
		Price:     product.Price,
		ImageURL:  product.ImageURL,
		AddedAt:   time.Now(),
	}

	return s.wishlistRepo.AddToWishlist(ctx, item)
}

func (s *Service) GetWishlist(ctx context.Context, userID int64) ([]*WishlistItem, error) {
	if s.wishlistRepo == nil {
		return nil, errors.New("wishlist repository not configured")
	}
	return s.wishlistRepo.GetWishlist(ctx, userID)
}

func (s *Service) RemoveFromWishlist(ctx context.Context, userID int64, productID string) error {
	if s.wishlistRepo == nil {
		return errors.New("wishlist repository not configured")
	}
	return s.wishlistRepo.RemoveFromWishlist(ctx, userID, productID)
}

func (s *Service) ClearWishlist(ctx context.Context, userID int64) error {
	if s.wishlistRepo == nil {
		return errors.New("wishlist repository not configured")
	}
	return s.wishlistRepo.ClearWishlist(ctx, userID)
}

func (s *Service) IsInWishlist(ctx context.Context, userID int64, productID string) (bool, error) {
	if s.wishlistRepo == nil {
		return false, errors.New("wishlist repository not configured")
	}
	return s.wishlistRepo.IsInWishlist(ctx, userID, productID)
}

func (s *Service) MoveWishlistToCart(ctx context.Context, userID int64, productID string) error {
	if s.wishlistRepo == nil {
		return errors.New("wishlist repository not configured")
	}
	if s.cartRepo == nil {
		return errors.New("cart repository not configured")
	}

	// Add to cart
	if err := s.AddToCart(ctx, userID, productID, 1); err != nil {
		return err
	}

	// Remove from wishlist
	return s.wishlistRepo.RemoveFromWishlist(ctx, userID, productID)
}

// Price history methods

func (s *Service) GetPriceHistory(ctx context.Context, productID string) ([]*PriceHistory, error) {
	if s.priceHistoryRepo == nil {
		return nil, errors.New("price history repository not configured")
	}
	return s.priceHistoryRepo.GetPriceHistory(ctx, productID)
}

func (s *Service) GetLatestPriceChange(ctx context.Context, productID string) (*PriceHistory, error) {
	if s.priceHistoryRepo == nil {
		return nil, errors.New("price history repository not configured")
	}
	return s.priceHistoryRepo.GetLatestPrice(ctx, productID)
}

// Review methods

func (s *Service) CreateReview(ctx context.Context, review *Review) error {
	if s.reviewRepo == nil {
		return errors.New("review repository not configured")
	}
	if review.ProductID == "" {
		return errors.New("product ID is required")
	}
	if review.UserID == 0 {
		return errors.New("user ID is required")
	}
	if review.Rating < 1 || review.Rating > 5 {
		return errors.New("rating must be between 1 and 5")
	}
	if review.ID == "" {
		review.ID = uuid.New().String()
	}
	review.CreatedAt = time.Now()
	return s.reviewRepo.CreateReview(ctx, review)
}

func (s *Service) GetProductReviews(ctx context.Context, productID string) ([]*Review, error) {
	if s.reviewRepo == nil {
		return nil, errors.New("review repository not configured")
	}
	return s.reviewRepo.GetProductReviews(ctx, productID)
}

func (s *Service) GetUserReviews(ctx context.Context, userID int64) ([]*Review, error) {
	if s.reviewRepo == nil {
		return nil, errors.New("review repository not configured")
	}
	return s.reviewRepo.GetUserReviews(ctx, userID)
}

func (s *Service) GetReview(ctx context.Context, id string) (*Review, error) {
	if s.reviewRepo == nil {
		return nil, errors.New("review repository not configured")
	}
	return s.reviewRepo.GetReview(ctx, id)
}

func (s *Service) DeleteReview(ctx context.Context, id string) error {
	if s.reviewRepo == nil {
		return errors.New("review repository not configured")
	}
	return s.reviewRepo.DeleteReview(ctx, id)
}

func (s *Service) GetProductRating(ctx context.Context, productID string) (*ProductRating, error) {
	if s.reviewRepo == nil {
		return nil, errors.New("review repository not configured")
	}
	avgRating, count, err := s.reviewRepo.GetAverageRating(ctx, productID)
	if err != nil {
		return nil, err
	}
	return &ProductRating{
		ProductID:     productID,
		AverageRating: avgRating,
		ReviewCount:   count,
	}, nil
}

// Recommendation methods

// GetSimilarProducts returns products in the same category
func (s *Service) GetSimilarProducts(ctx context.Context, productID string, limit int) ([]*Recommendation, error) {
	product, err := s.repo.GetByID(ctx, productID)
	if err != nil {
		return nil, err
	}

	if product.CategoryID == "" {
		return []*Recommendation{}, nil
	}

	// Get products in the same category
	products, err := s.repo.ListWithFilter(ctx, ProductFilter{CategoryID: product.CategoryID})
	if err != nil {
		return nil, err
	}

	var recommendations []*Recommendation
	for _, p := range products {
		if p.ID == productID {
			continue // Skip the current product
		}

		score := 1.0
		// Boost score based on reviews if available
		if s.reviewRepo != nil {
			avgRating, count, _ := s.reviewRepo.GetAverageRating(ctx, p.ID)
			if count > 0 {
				score = avgRating * float64(count) / 10.0 // Simple scoring
			}
		}

		recommendations = append(recommendations, &Recommendation{
			Product: p,
			Reason:  "similar_category",
			Score:   score,
		})

		if len(recommendations) >= limit {
			break
		}
	}

	return recommendations, nil
}

// GetPopularProducts returns top-rated products
func (s *Service) GetPopularProducts(ctx context.Context, limit int) ([]*Recommendation, error) {
	products, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	type scoredProduct struct {
		product *Product
		score   float64
	}

	var scored []scoredProduct
	for _, p := range products {
		score := 0.0
		if s.reviewRepo != nil {
			avgRating, count, _ := s.reviewRepo.GetAverageRating(ctx, p.ID)
			if count > 0 {
				score = avgRating * float64(count)
			}
		}
		scored = append(scored, scoredProduct{product: p, score: score})
	}

	// Sort by score descending (simple bubble sort for small lists)
	for i := 0; i < len(scored)-1; i++ {
		for j := 0; j < len(scored)-i-1; j++ {
			if scored[j].score < scored[j+1].score {
				scored[j], scored[j+1] = scored[j+1], scored[j]
			}
		}
	}

	var recommendations []*Recommendation
	for i, sp := range scored {
		if i >= limit {
			break
		}
		recommendations = append(recommendations, &Recommendation{
			Product: sp.product,
			Reason:  "popular",
			Score:   sp.score,
		})
	}

	return recommendations, nil
}

// GetFrequentlyBoughtTogether returns products often in the same cart
func (s *Service) GetFrequentlyBoughtTogether(ctx context.Context, productID string, limit int) ([]*Recommendation, error) {
	// For simplicity, we'll use same-category products as a proxy
	// In production, this would use order/cart history analytics
	return s.GetSimilarProducts(ctx, productID, limit)
}

// GetPersonalizedRecommendations returns recommendations based on user's history
func (s *Service) GetPersonalizedRecommendations(ctx context.Context, userID int64, limit int) ([]*Recommendation, error) {
	var recommendations []*Recommendation

	// Get items from user's wishlist
	if s.wishlistRepo != nil {
		wishlist, err := s.wishlistRepo.GetWishlist(ctx, userID)
		if err == nil && len(wishlist) > 0 {
			// Get similar products to wishlist items
			for _, item := range wishlist {
				similar, _ := s.GetSimilarProducts(ctx, item.ProductID, 2)
				recommendations = append(recommendations, similar...)
				if len(recommendations) >= limit {
					break
				}
			}
		}
	}

	// If we don't have enough, add popular products
	if len(recommendations) < limit {
		popular, _ := s.GetPopularProducts(ctx, limit-len(recommendations))
		recommendations = append(recommendations, popular...)
	}

	// Limit and deduplicate
	seen := make(map[string]bool)
	var unique []*Recommendation
	for _, r := range recommendations {
		if !seen[r.Product.ID] {
			seen[r.Product.ID] = true
			unique = append(unique, r)
			if len(unique) >= limit {
				break
			}
		}
	}

	return unique, nil
}

// Inventory methods

// GetLowStockProducts returns products with stock below threshold
func (s *Service) GetLowStockProducts(ctx context.Context, threshold int) ([]*LowStockProduct, error) {
	products, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	var lowStock []*LowStockProduct
	for _, p := range products {
		if p.Stock <= threshold {
			lowStock = append(lowStock, &LowStockProduct{
				Product:   p,
				Stock:     p.Stock,
				Threshold: threshold,
			})
		}
	}

	return lowStock, nil
}

// GetOutOfStockProducts returns products with zero stock
func (s *Service) GetOutOfStockProducts(ctx context.Context) ([]*Product, error) {
	products, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	var outOfStock []*Product
	for _, p := range products {
		if p.Stock == 0 {
			outOfStock = append(outOfStock, p)
		}
	}

	return outOfStock, nil
}

// GetInventoryStats returns inventory statistics
func (s *Service) GetInventoryStats(ctx context.Context) (map[string]interface{}, error) {
	products, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	totalProducts := len(products)
	outOfStock := 0
	lowStock := 0
	totalValue := 0.0

	for _, p := range products {
		if p.Stock == 0 {
			outOfStock++
		} else if p.Stock <= 10 {
			lowStock++
		}
		totalValue += p.Price * float64(p.Stock)
	}

	return map[string]interface{}{
		"total_products":     totalProducts,
		"out_of_stock":       outOfStock,
		"low_stock":          lowStock,
		"in_stock":           totalProducts - outOfStock,
		"total_inventory_value": totalValue,
	}, nil
}

// Analytics methods

func (s *Service) GetAnalyticsDashboard(ctx context.Context) (*AnalyticsDashboard, error) {
	dashboard := &AnalyticsDashboard{}

	// Get product and category counts
	products, err := s.repo.List(ctx)
	if err == nil {
		dashboard.TotalProducts = len(products)
	}

	categories, err := s.catRepo.ListCategories(ctx)
	if err == nil {
		dashboard.TotalCategories = len(categories)
	}

	// Get analytics data if repository is available
	if s.analyticsRepo != nil {
		if revenue, err := s.analyticsRepo.GetTotalRevenue(ctx); err == nil {
			dashboard.TotalRevenue = revenue
		}
		if orders, err := s.analyticsRepo.GetTotalOrders(ctx); err == nil {
			dashboard.TotalOrders = orders
			if orders > 0 {
				dashboard.AverageOrderValue = dashboard.TotalRevenue / float64(orders)
			}
		}

		if topProducts, err := s.analyticsRepo.GetTopSellingProducts(ctx, 5); err == nil {
			for _, p := range topProducts {
				dashboard.TopProducts = append(dashboard.TopProducts, map[string]interface{}{
					"product_id":     p.ProductID,
					"product_name":   p.ProductName,
					"total_quantity": p.TotalQuantity,
					"total_revenue":  p.TotalRevenue,
					"order_count":    p.OrderCount,
				})
			}
		}

		if dailySales, err := s.analyticsRepo.GetDailySales(ctx, 7); err == nil {
			for _, d := range dailySales {
				dashboard.DailySales = append(dashboard.DailySales, map[string]interface{}{
					"date":          d.Date,
					"total_orders":  d.TotalOrders,
					"total_revenue": d.TotalRevenue,
					"total_items":   d.TotalItems,
				})
			}
		}

		if salesByCat, err := s.analyticsRepo.GetSalesByCategory(ctx); err == nil {
			for _, c := range salesByCat {
				dashboard.SalesByCategory = append(dashboard.SalesByCategory, map[string]interface{}{
					"category_id":   c.CategoryID,
					"category_name": c.CategoryName,
					"total_revenue": c.TotalRevenue,
					"order_count":   c.OrderCount,
					"item_count":    c.ItemCount,
				})
			}
		}
	}

	return dashboard, nil
}

func (s *Service) GetTopSellingProducts(ctx context.Context, limit int) ([]*ProductSalesStats, error) {
	if s.analyticsRepo == nil {
		return []*ProductSalesStats{}, nil
	}
	return s.analyticsRepo.GetTopSellingProducts(ctx, limit)
}

func (s *Service) GetDailySalesReport(ctx context.Context, days int) ([]*DailySales, error) {
	if s.analyticsRepo == nil {
		return []*DailySales{}, nil
	}
	return s.analyticsRepo.GetDailySales(ctx, days)
}

func (s *Service) GetSalesByCategory(ctx context.Context) ([]*CategorySales, error) {
	if s.analyticsRepo == nil {
		return []*CategorySales{}, nil
	}
	return s.analyticsRepo.GetSalesByCategory(ctx)
}

// Search methods

// SearchProducts performs full-text search on products
func (s *Service) SearchProducts(ctx context.Context, query *SearchQuery) (*SearchResult, error) {
	if s.search == nil {
		// Fallback to database search if Elasticsearch is not available
		filter := ProductFilter{
			Search:     query.Query,
			CategoryID: query.CategoryID,
			MinPrice:   query.MinPrice,
			MaxPrice:   query.MaxPrice,
		}
		products, err := s.repo.ListWithFilter(ctx, filter)
		if err != nil {
			return nil, err
		}

		// Convert to search products
		searchProducts := make([]*SearchProduct, len(products))
		for i, p := range products {
			searchProducts[i] = s.toSearchProduct(p)
		}

		return &SearchResult{
			Products:   searchProducts,
			Total:      int64(len(products)),
			Page:       1,
			PageSize:   len(products),
			TotalPages: 1,
		}, nil
	}

	return s.search.Search(ctx, query)
}

// SearchSuggest returns autocomplete suggestions
func (s *Service) SearchSuggest(ctx context.Context, prefix string, limit int) ([]string, error) {
	if s.search == nil {
		return []string{}, nil
	}
	return s.search.Suggest(ctx, prefix, limit)
}

// ReindexAllProducts reindexes all products in Elasticsearch
func (s *Service) ReindexAllProducts(ctx context.Context) error {
	if s.search == nil {
		return errors.New("search client not configured")
	}

	products, err := s.repo.List(ctx)
	if err != nil {
		return err
	}

	searchProducts := make([]*SearchProduct, len(products))
	for i, p := range products {
		searchProducts[i] = s.toSearchProduct(p)
	}

	return s.search.BulkIndex(ctx, searchProducts)
}
