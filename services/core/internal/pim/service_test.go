package pim

import (
	"context"
	"errors"
	"testing"
)

// MockRepository is a mock implementation of Repository for testing
type MockRepository struct {
	products map[string]*Product
	SaveFunc func(ctx context.Context, p *Product) error
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		products: make(map[string]*Product),
	}
}

func (m *MockRepository) Save(ctx context.Context, p *Product) error {
	if m.SaveFunc != nil {
		return m.SaveFunc(ctx, p)
	}
	m.products[p.ID] = p
	return nil
}

func (m *MockRepository) GetByID(ctx context.Context, id string) (*Product, error) {
	if p, ok := m.products[id]; ok {
		return p, nil
	}
	return nil, errors.New("product not found")
}

func (m *MockRepository) List(ctx context.Context) ([]*Product, error) {
	var result []*Product
	for _, p := range m.products {
		result = append(result, p)
	}
	return result, nil
}

func (m *MockRepository) ListWithFilter(ctx context.Context, filter ProductFilter) ([]*Product, error) {
	products, err := m.List(ctx)
	if err != nil {
		return nil, err
	}

	// Filter by category if specified
	if filter.CategoryID != "" {
		var filtered []*Product
		for _, p := range products {
			if p.CategoryID == filter.CategoryID {
				filtered = append(filtered, p)
			}
		}
		return filtered, nil
	}

	return products, nil
}

func (m *MockRepository) Delete(ctx context.Context, id string) error {
	if _, ok := m.products[id]; !ok {
		return errors.New("product not found")
	}
	delete(m.products, id)
	return nil
}

func (m *MockRepository) UpdateStock(ctx context.Context, id string, stock int) error {
	if p, ok := m.products[id]; ok {
		p.Stock = stock
		return nil
	}
	return errors.New("product not found")
}

func (m *MockRepository) DecrementStock(ctx context.Context, id string, quantity int) error {
	if p, ok := m.products[id]; ok {
		if p.Stock < quantity {
			return errors.New("insufficient stock")
		}
		p.Stock -= quantity
		return nil
	}
	return errors.New("product not found")
}

func (m *MockRepository) UpdateImage(ctx context.Context, id string, imageURL string) error {
	if p, ok := m.products[id]; ok {
		p.ImageURL = imageURL
		return nil
	}
	return errors.New("product not found")
}

// MockCategoryRepository is a mock implementation of CategoryRepository
type MockCategoryRepository struct {
	categories map[string]*Category
}

func NewMockCategoryRepository() *MockCategoryRepository {
	return &MockCategoryRepository{
		categories: make(map[string]*Category),
	}
}

func (m *MockCategoryRepository) SaveCategory(ctx context.Context, c *Category) error {
	m.categories[c.ID] = c
	return nil
}

func (m *MockCategoryRepository) GetCategoryByID(ctx context.Context, id string) (*Category, error) {
	if c, ok := m.categories[id]; ok {
		return c, nil
	}
	return nil, errors.New("category not found")
}

func (m *MockCategoryRepository) ListCategories(ctx context.Context) ([]*Category, error) {
	var result []*Category
	for _, c := range m.categories {
		result = append(result, c)
	}
	return result, nil
}

func (m *MockCategoryRepository) DeleteCategory(ctx context.Context, id string) error {
	if _, ok := m.categories[id]; !ok {
		return errors.New("category not found")
	}
	delete(m.categories, id)
	return nil
}

// Tests for Product Service

func TestCreateProduct_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
	}

	err := service.CreateProduct(context.Background(), p)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if p.ID == "" {
		t.Error("expected ID to be generated")
	}

	if p.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set")
	}

	if p.UpdatedAt.IsZero() {
		t.Error("expected UpdatedAt to be set")
	}
}

func TestCreateProduct_NameRequired(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	p := &Product{
		Name:  "",
		Price: 100.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "product name is required" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestCreateProduct_NegativePrice(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	p := &Product{
		Name:  "Test",
		Price: -50.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err == nil {
		t.Fatal("expected error for negative price")
	}

	if err.Error() != "product price cannot be negative" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestCreateProduct_PreservesExistingID(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	existingID := "existing-id-123"
	p := &Product{
		ID:    existingID,
		Name:  "Test",
		Price: 100.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if p.ID != existingID {
		t.Errorf("expected ID to remain %s, got %s", existingID, p.ID)
	}
}

func TestCreateProduct_RepoError(t *testing.T) {
	repo := NewMockRepository()
	repo.SaveFunc = func(ctx context.Context, p *Product) error {
		return errors.New("database error")
	}
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	p := &Product{
		Name:  "Test",
		Price: 100.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err == nil {
		t.Fatal("expected error from repository")
	}

	if err.Error() != "database error" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestGetProduct_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create a product first
	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
	}
	service.CreateProduct(context.Background(), p)

	// Get the product
	found, err := service.GetProduct(context.Background(), p.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if found.Name != "Test Product" {
		t.Errorf("expected name 'Test Product', got '%s'", found.Name)
	}
}

func TestGetProduct_NotFound(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	_, err := service.GetProduct(context.Background(), "non-existent-id")
	if err == nil {
		t.Fatal("expected error for non-existent product")
	}
}

func TestUpdateStock_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create a product first
	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
		Stock: 10,
	}
	service.CreateProduct(context.Background(), p)

	// Update stock
	err := service.UpdateStock(context.Background(), p.ID, 50)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify
	found, _ := service.GetProduct(context.Background(), p.ID)
	if found.Stock != 50 {
		t.Errorf("expected stock 50, got %d", found.Stock)
	}
}

func TestUpdateStock_NegativeStock(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	err := service.UpdateStock(context.Background(), "some-id", -10)
	if err == nil {
		t.Fatal("expected error for negative stock")
	}
}

func TestDecrementStock_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create a product with stock
	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
		Stock: 10,
	}
	service.CreateProduct(context.Background(), p)

	// Decrement stock
	err := service.DecrementStock(context.Background(), p.ID, 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify
	found, _ := service.GetProduct(context.Background(), p.ID)
	if found.Stock != 7 {
		t.Errorf("expected stock 7, got %d", found.Stock)
	}
}

func TestDecrementStock_InsufficientStock(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create a product with low stock
	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
		Stock: 5,
	}
	service.CreateProduct(context.Background(), p)

	// Try to decrement more than available
	err := service.DecrementStock(context.Background(), p.ID, 10)
	if err == nil {
		t.Fatal("expected error for insufficient stock")
	}
}

func TestDecrementStock_ZeroQuantity(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	err := service.DecrementStock(context.Background(), "some-id", 0)
	if err == nil {
		t.Fatal("expected error for zero quantity")
	}
}

func TestDeleteProduct_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create a product first
	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
	}
	service.CreateProduct(context.Background(), p)

	// Delete it
	err := service.DeleteProduct(context.Background(), p.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify it's gone
	_, err = service.GetProduct(context.Background(), p.ID)
	if err == nil {
		t.Fatal("expected error for deleted product")
	}
}

func TestUpdateImage_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create a product first
	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
	}
	service.CreateProduct(context.Background(), p)

	// Update image
	imageURL := "https://example.com/image.jpg"
	err := service.UpdateImage(context.Background(), p.ID, imageURL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify
	found, _ := service.GetProduct(context.Background(), p.ID)
	if found.ImageURL != imageURL {
		t.Errorf("expected imageURL '%s', got '%s'", imageURL, found.ImageURL)
	}
}

// Tests for Category Service

func TestCreateCategory_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	c := &Category{
		Name: "Electronics",
	}

	err := service.CreateCategory(context.Background(), c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if c.ID == "" {
		t.Error("expected ID to be generated")
	}

	if c.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set")
	}
}

func TestCreateCategory_NameRequired(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	c := &Category{
		Name: "",
	}

	err := service.CreateCategory(context.Background(), c)
	if err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestGetCategory_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create category
	c := &Category{Name: "Electronics"}
	service.CreateCategory(context.Background(), c)

	// Get it
	found, err := service.GetCategory(context.Background(), c.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if found.Name != "Electronics" {
		t.Errorf("expected name 'Electronics', got '%s'", found.Name)
	}
}

func TestDeleteCategory_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create category
	c := &Category{Name: "Electronics"}
	service.CreateCategory(context.Background(), c)

	// Delete it
	err := service.DeleteCategory(context.Background(), c.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify it's gone
	_, err = service.GetCategory(context.Background(), c.ID)
	if err == nil {
		t.Fatal("expected error for deleted category")
	}
}

func TestListCategories(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create categories
	service.CreateCategory(context.Background(), &Category{Name: "Electronics"})
	service.CreateCategory(context.Background(), &Category{Name: "Clothing"})

	// List them
	categories, err := service.ListCategories(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(categories) != 2 {
		t.Errorf("expected 2 categories, got %d", len(categories))
	}
}

// ============================================
// Mock Repositories for new features
// ============================================

// MockReviewRepository implements ReviewRepository
type MockReviewRepository struct {
	reviews map[string]*Review
}

func NewMockReviewRepository() *MockReviewRepository {
	return &MockReviewRepository{
		reviews: make(map[string]*Review),
	}
}

func (m *MockReviewRepository) CreateReview(ctx context.Context, r *Review) error {
	m.reviews[r.ID] = r
	return nil
}

func (m *MockReviewRepository) GetReview(ctx context.Context, id string) (*Review, error) {
	if r, ok := m.reviews[id]; ok {
		return r, nil
	}
	return nil, errors.New("review not found")
}

func (m *MockReviewRepository) GetProductReviews(ctx context.Context, productID string) ([]*Review, error) {
	var result []*Review
	for _, r := range m.reviews {
		if r.ProductID == productID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockReviewRepository) GetUserReviews(ctx context.Context, userID int64) ([]*Review, error) {
	var result []*Review
	for _, r := range m.reviews {
		if r.UserID == userID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockReviewRepository) DeleteReview(ctx context.Context, id string) error {
	if _, ok := m.reviews[id]; !ok {
		return errors.New("review not found")
	}
	delete(m.reviews, id)
	return nil
}

func (m *MockReviewRepository) GetAverageRating(ctx context.Context, productID string) (float64, int, error) {
	var sum float64
	var count int
	for _, r := range m.reviews {
		if r.ProductID == productID {
			sum += float64(r.Rating)
			count++
		}
	}
	if count == 0 {
		return 0, 0, nil
	}
	return sum / float64(count), count, nil
}

// MockAnalyticsRepository implements AnalyticsRepository
type MockAnalyticsRepository struct {
	topProducts []*ProductSalesStats
}

func NewMockAnalyticsRepository() *MockAnalyticsRepository {
	return &MockAnalyticsRepository{
		topProducts: make([]*ProductSalesStats, 0),
	}
}

func (m *MockAnalyticsRepository) AddTopProduct(stats *ProductSalesStats) {
	m.topProducts = append(m.topProducts, stats)
}

func (m *MockAnalyticsRepository) GetTopSellingProducts(ctx context.Context, limit int) ([]*ProductSalesStats, error) {
	if len(m.topProducts) > limit {
		return m.topProducts[:limit], nil
	}
	return m.topProducts, nil
}

func (m *MockAnalyticsRepository) GetDailySales(ctx context.Context, days int) ([]*DailySales, error) {
	return []*DailySales{
		{Date: "2024-01-01", TotalOrders: 10, TotalRevenue: 1000.0, TotalItems: 25},
		{Date: "2024-01-02", TotalOrders: 15, TotalRevenue: 1500.0, TotalItems: 35},
	}, nil
}

func (m *MockAnalyticsRepository) GetSalesByCategory(ctx context.Context) ([]*CategorySales, error) {
	return []*CategorySales{
		{CategoryID: "cat-1", CategoryName: "Electronics", TotalRevenue: 5000.0, OrderCount: 50},
		{CategoryID: "cat-2", CategoryName: "Clothing", TotalRevenue: 3000.0, OrderCount: 30},
	}, nil
}

func (m *MockAnalyticsRepository) GetTotalRevenue(ctx context.Context) (float64, error) {
	var total float64
	for _, p := range m.topProducts {
		total += p.TotalRevenue
	}
	return total, nil
}

func (m *MockAnalyticsRepository) GetTotalOrders(ctx context.Context) (int, error) {
	var total int
	for _, p := range m.topProducts {
		total += p.OrderCount
	}
	return total, nil
}

// MockSearchClient implements SearchClient
type MockSearchClient struct {
	products []*SearchProduct
}

func NewMockSearchClient() *MockSearchClient {
	return &MockSearchClient{
		products: make([]*SearchProduct, 0),
	}
}

func (m *MockSearchClient) IndexProduct(ctx context.Context, p *SearchProduct) error {
	// Replace if exists
	for i, existing := range m.products {
		if existing.ID == p.ID {
			m.products[i] = p
			return nil
		}
	}
	m.products = append(m.products, p)
	return nil
}

func (m *MockSearchClient) DeleteProduct(ctx context.Context, productID string) error {
	for i, p := range m.products {
		if p.ID == productID {
			m.products = append(m.products[:i], m.products[i+1:]...)
			return nil
		}
	}
	return nil
}

func (m *MockSearchClient) Search(ctx context.Context, query *SearchQuery) (*SearchResult, error) {
	var filtered []*SearchProduct
	for _, p := range m.products {
		if query.Query == "" || contains(p.Name, query.Query) || contains(p.Description, query.Query) {
			if query.CategoryID == "" || p.CategoryID == query.CategoryID {
				if query.MinPrice == nil || p.Price >= *query.MinPrice {
					if query.MaxPrice == nil || p.Price <= *query.MaxPrice {
						if query.InStock == nil || !*query.InStock || p.Stock > 0 {
							filtered = append(filtered, p)
						}
					}
				}
			}
		}
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	start := (page - 1) * pageSize
	end := start + pageSize
	if start > len(filtered) {
		start = len(filtered)
	}
	if end > len(filtered) {
		end = len(filtered)
	}

	return &SearchResult{
		Products:   filtered[start:end],
		Total:      int64(len(filtered)),
		Page:       page,
		PageSize:   pageSize,
		TotalPages: (len(filtered) + pageSize - 1) / pageSize,
	}, nil
}

func (m *MockSearchClient) Suggest(ctx context.Context, prefix string, limit int) ([]string, error) {
	var suggestions []string
	seen := make(map[string]bool)
	for _, p := range m.products {
		if contains(p.Name, prefix) && !seen[p.Name] {
			suggestions = append(suggestions, p.Name)
			seen[p.Name] = true
			if len(suggestions) >= limit {
				break
			}
		}
	}
	return suggestions, nil
}

func (m *MockSearchClient) BulkIndex(ctx context.Context, products []*SearchProduct) error {
	for _, p := range products {
		m.IndexProduct(ctx, p)
	}
	return nil
}

func contains(s, substr string) bool {
	return len(substr) == 0 || (len(s) >= len(substr) && (s == substr || len(s) > 0 && containsIgnoreCase(s, substr)))
}

func containsIgnoreCase(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if equalFoldAt(s, i, substr) {
			return true
		}
	}
	return false
}

func equalFoldAt(s string, i int, substr string) bool {
	for j := 0; j < len(substr); j++ {
		c1 := s[i+j]
		c2 := substr[j]
		if c1 >= 'A' && c1 <= 'Z' {
			c1 += 32
		}
		if c2 >= 'A' && c2 <= 'Z' {
			c2 += 32
		}
		if c1 != c2 {
			return false
		}
	}
	return true
}

// ============================================
// Tests for Reviews
// ============================================

func TestCreateReview_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	// Create a product first
	p := &Product{Name: "Test Product", Price: 100.0}
	service.CreateProduct(context.Background(), p)

	review := &Review{
		ProductID: p.ID,
		UserID:    123,
		UserName:  "Test User",
		Rating:    5,
		Comment:   "Great product!",
	}

	err := service.CreateReview(context.Background(), review)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if review.ID == "" {
		t.Error("expected ID to be generated")
	}
	if review.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set")
	}
}

func TestCreateReview_InvalidRating(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	tests := []struct {
		name   string
		rating int
	}{
		{"rating too low", 0},
		{"rating negative", -1},
		{"rating too high", 6},
		{"rating way too high", 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			review := &Review{
				ProductID: "prod-1",
				UserID:    123,
				Rating:    tt.rating,
			}

			err := service.CreateReview(context.Background(), review)
			if err == nil {
				t.Errorf("expected error for rating %d", tt.rating)
			}
		})
	}
}

func TestCreateReview_MissingProductID(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	review := &Review{
		ProductID: "",
		UserID:    123,
		Rating:    5,
	}

	err := service.CreateReview(context.Background(), review)
	if err == nil {
		t.Error("expected error for missing product ID")
	}
}

func TestCreateReview_NoRepository(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	// Don't set review repository

	review := &Review{
		ProductID: "prod-1",
		UserID:    123,
		Rating:    5,
	}

	err := service.CreateReview(context.Background(), review)
	if err == nil {
		t.Error("expected error when review repository is not set")
	}
}

func TestGetReview_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	// Create a review first
	review := &Review{
		ProductID: "prod-1",
		UserID:    123,
		Rating:    5,
		Comment:   "Great!",
	}
	service.CreateReview(context.Background(), review)

	// Get it
	found, err := service.GetReview(context.Background(), review.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if found.Comment != "Great!" {
		t.Errorf("expected comment 'Great!', got '%s'", found.Comment)
	}
}

func TestGetReview_NotFound(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	_, err := service.GetReview(context.Background(), "non-existent")
	if err == nil {
		t.Error("expected error for non-existent review")
	}
}

func TestDeleteReview_Success(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	review := &Review{ProductID: "prod-1", UserID: 123, Rating: 5}
	service.CreateReview(context.Background(), review)

	err := service.DeleteReview(context.Background(), review.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = service.GetReview(context.Background(), review.ID)
	if err == nil {
		t.Error("expected error for deleted review")
	}
}

func TestGetProductReviews(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	productID := "prod-1"

	// Create multiple reviews
	service.CreateReview(context.Background(), &Review{ProductID: productID, UserID: 1, Rating: 5})
	service.CreateReview(context.Background(), &Review{ProductID: productID, UserID: 2, Rating: 4})
	service.CreateReview(context.Background(), &Review{ProductID: "prod-2", UserID: 3, Rating: 3}) // Different product

	reviews, err := service.GetProductReviews(context.Background(), productID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(reviews) != 2 {
		t.Errorf("expected 2 reviews, got %d", len(reviews))
	}
}

func TestGetUserReviews(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	userID := int64(123)

	// Create multiple reviews
	service.CreateReview(context.Background(), &Review{ProductID: "prod-1", UserID: userID, Rating: 5})
	service.CreateReview(context.Background(), &Review{ProductID: "prod-2", UserID: userID, Rating: 4})
	service.CreateReview(context.Background(), &Review{ProductID: "prod-3", UserID: 456, Rating: 3}) // Different user

	reviews, err := service.GetUserReviews(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(reviews) != 2 {
		t.Errorf("expected 2 reviews, got %d", len(reviews))
	}
}

func TestGetProductRating(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	productID := "prod-1"

	// Create reviews with different ratings
	service.CreateReview(context.Background(), &Review{ProductID: productID, UserID: 1, Rating: 5})
	service.CreateReview(context.Background(), &Review{ProductID: productID, UserID: 2, Rating: 4})
	service.CreateReview(context.Background(), &Review{ProductID: productID, UserID: 3, Rating: 3})

	rating, err := service.GetProductRating(context.Background(), productID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedAvg := 4.0 // (5+4+3)/3
	if rating.AverageRating != expectedAvg {
		t.Errorf("expected average rating %.1f, got %.1f", expectedAvg, rating.AverageRating)
	}
	if rating.ReviewCount != 3 {
		t.Errorf("expected count 3, got %d", rating.ReviewCount)
	}
}

func TestGetProductRating_NoReviews(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	service.SetReviewRepository(reviewRepo)

	rating, err := service.GetProductRating(context.Background(), "no-reviews-product")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if rating.AverageRating != 0 {
		t.Errorf("expected average rating 0, got %.1f", rating.AverageRating)
	}
	if rating.ReviewCount != 0 {
		t.Errorf("expected count 0, got %d", rating.ReviewCount)
	}
}

// ============================================
// Tests for Recommendations
// ============================================

func TestGetSimilarProducts(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create category
	cat := &Category{Name: "Electronics"}
	service.CreateCategory(context.Background(), cat)

	// Create products in same category
	p1 := &Product{Name: "iPhone 15", Price: 999.0, CategoryID: cat.ID}
	p2 := &Product{Name: "iPhone 14", Price: 799.0, CategoryID: cat.ID}
	p3 := &Product{Name: "Samsung S24", Price: 899.0, CategoryID: cat.ID}
	p4 := &Product{Name: "T-Shirt", Price: 29.0, CategoryID: "other-cat"} // Different category

	service.CreateProduct(context.Background(), p1)
	service.CreateProduct(context.Background(), p2)
	service.CreateProduct(context.Background(), p3)
	service.CreateProduct(context.Background(), p4)

	similar, err := service.GetSimilarProducts(context.Background(), p1.ID, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should return p2 and p3, but not p1 (itself) or p4 (different category)
	if len(similar) != 2 {
		t.Errorf("expected 2 similar products, got %d", len(similar))
	}

	for _, rec := range similar {
		if rec.Product.ID == p1.ID {
			t.Error("should not include the product itself")
		}
		if rec.Product.CategoryID != cat.ID {
			t.Error("should only include products from same category")
		}
		if rec.Reason != "similar_category" {
			t.Errorf("expected reason 'similar_category', got '%s'", rec.Reason)
		}
	}
}

func TestGetSimilarProducts_Limit(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	cat := &Category{Name: "Electronics"}
	service.CreateCategory(context.Background(), cat)

	// Create many products
	for i := 0; i < 10; i++ {
		p := &Product{Name: "Product", Price: 100.0, CategoryID: cat.ID}
		service.CreateProduct(context.Background(), p)
	}

	products, _ := service.List(context.Background())
	similar, _ := service.GetSimilarProducts(context.Background(), products[0].ID, 3)

	if len(similar) > 3 {
		t.Errorf("expected at most 3 products, got %d", len(similar))
	}
}

func TestGetPopularProducts(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	analyticsRepo := NewMockAnalyticsRepository()
	service.SetAnalyticsRepository(analyticsRepo)

	// Create products
	p1 := &Product{Name: "Popular Product", Price: 100.0, Stock: 50}
	p2 := &Product{Name: "Less Popular", Price: 200.0, Stock: 30}
	service.CreateProduct(context.Background(), p1)
	service.CreateProduct(context.Background(), p2)

	// Add top products data to mock
	analyticsRepo.AddTopProduct(&ProductSalesStats{ProductID: p1.ID, ProductName: p1.Name, TotalQuantity: 150, TotalRevenue: 15000})
	analyticsRepo.AddTopProduct(&ProductSalesStats{ProductID: p2.ID, ProductName: p2.Name, TotalQuantity: 10, TotalRevenue: 2000})

	popular, err := service.GetPopularProducts(context.Background(), 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(popular) < 1 {
		t.Error("expected at least 1 popular product")
	}
}

func TestGetPopularProducts_NoAnalyticsRepo(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	// Don't set analytics repository

	// Create some products so we have something to return
	service.CreateProduct(context.Background(), &Product{Name: "P1", Price: 100.0})
	service.CreateProduct(context.Background(), &Product{Name: "P2", Price: 200.0})

	popular, err := service.GetPopularProducts(context.Background(), 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should still return products even without analytics repo (with zero scores)
	if len(popular) != 2 {
		t.Errorf("expected 2 products, got %d", len(popular))
	}
}

// ============================================
// Tests for Inventory
// ============================================

func TestGetLowStockProducts(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	// Create products with different stock levels
	service.CreateProduct(context.Background(), &Product{Name: "Low Stock 1", Price: 100.0, Stock: 5})
	service.CreateProduct(context.Background(), &Product{Name: "Low Stock 2", Price: 100.0, Stock: 8})
	service.CreateProduct(context.Background(), &Product{Name: "Normal Stock", Price: 100.0, Stock: 50})
	service.CreateProduct(context.Background(), &Product{Name: "High Stock", Price: 100.0, Stock: 100})

	lowStock, err := service.GetLowStockProducts(context.Background(), 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(lowStock) != 2 {
		t.Errorf("expected 2 low stock products, got %d", len(lowStock))
	}

	for _, ls := range lowStock {
		if ls.Stock > 10 {
			t.Errorf("product with stock %d should not be in low stock list (threshold 10)", ls.Stock)
		}
		if ls.Threshold != 10 {
			t.Errorf("expected threshold 10, got %d", ls.Threshold)
		}
	}
}

func TestGetLowStockProducts_CustomThreshold(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	service.CreateProduct(context.Background(), &Product{Name: "Product 1", Price: 100.0, Stock: 15})
	service.CreateProduct(context.Background(), &Product{Name: "Product 2", Price: 100.0, Stock: 25})

	lowStock, _ := service.GetLowStockProducts(context.Background(), 20)
	if len(lowStock) != 1 {
		t.Errorf("expected 1 low stock product with threshold 20, got %d", len(lowStock))
	}
}

func TestGetOutOfStockProducts(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	service.CreateProduct(context.Background(), &Product{Name: "Out of Stock 1", Price: 100.0, Stock: 0})
	service.CreateProduct(context.Background(), &Product{Name: "Out of Stock 2", Price: 100.0, Stock: 0})
	service.CreateProduct(context.Background(), &Product{Name: "In Stock", Price: 100.0, Stock: 10})

	outOfStock, err := service.GetOutOfStockProducts(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(outOfStock) != 2 {
		t.Errorf("expected 2 out of stock products, got %d", len(outOfStock))
	}

	for _, p := range outOfStock {
		if p.Stock != 0 {
			t.Errorf("product with stock %d should not be in out of stock list", p.Stock)
		}
	}
}

func TestGetInventoryStats(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)

	service.CreateProduct(context.Background(), &Product{Name: "P1", Price: 100.0, Stock: 0})   // Out of stock
	service.CreateProduct(context.Background(), &Product{Name: "P2", Price: 200.0, Stock: 5})   // Low stock
	service.CreateProduct(context.Background(), &Product{Name: "P3", Price: 300.0, Stock: 50})  // In stock
	service.CreateProduct(context.Background(), &Product{Name: "P4", Price: 400.0, Stock: 100}) // In stock

	stats, err := service.GetInventoryStats(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if totalProducts, ok := stats["total_products"].(int); !ok || totalProducts != 4 {
		t.Errorf("expected 4 total products, got %v", stats["total_products"])
	}
	if outOfStock, ok := stats["out_of_stock"].(int); !ok || outOfStock != 1 {
		t.Errorf("expected 1 out of stock, got %v", stats["out_of_stock"])
	}
	if lowStock, ok := stats["low_stock"].(int); !ok || lowStock != 1 {
		t.Errorf("expected 1 low stock, got %v", stats["low_stock"])
	}
	// in_stock = totalProducts - outOfStock = 4 - 1 = 3
	if inStock, ok := stats["in_stock"].(int); !ok || inStock != 3 {
		t.Errorf("expected 3 in stock, got %v", stats["in_stock"])
	}

	expectedValue := 100.0*0 + 200.0*5 + 300.0*50 + 400.0*100
	if totalValue, ok := stats["total_inventory_value"].(float64); !ok || totalValue != expectedValue {
		t.Errorf("expected total value %.2f, got %v", expectedValue, stats["total_inventory_value"])
	}
}

// ============================================
// Tests for Analytics
// ============================================

func TestGetAnalyticsDashboard(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	analyticsRepo := NewMockAnalyticsRepository()
	service.SetAnalyticsRepository(analyticsRepo)

	// Create products and categories
	cat := &Category{Name: "Electronics"}
	service.CreateCategory(context.Background(), cat)
	service.CreateProduct(context.Background(), &Product{Name: "P1", Price: 100.0, Stock: 10, CategoryID: cat.ID})
	service.CreateProduct(context.Background(), &Product{Name: "P2", Price: 200.0, Stock: 20, CategoryID: cat.ID})

	dashboard, err := service.GetAnalyticsDashboard(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if dashboard.TotalProducts != 2 {
		t.Errorf("expected 2 products, got %d", dashboard.TotalProducts)
	}
	if dashboard.TotalCategories != 1 {
		t.Errorf("expected 1 category, got %d", dashboard.TotalCategories)
	}
}

func TestGetTopSellingProducts(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	analyticsRepo := NewMockAnalyticsRepository()
	service.SetAnalyticsRepository(analyticsRepo)

	// Add top selling products to mock
	analyticsRepo.AddTopProduct(&ProductSalesStats{ProductID: "p1", ProductName: "Best Seller", TotalQuantity: 100, TotalRevenue: 10000})
	analyticsRepo.AddTopProduct(&ProductSalesStats{ProductID: "p2", ProductName: "Good Seller", TotalQuantity: 50, TotalRevenue: 5000})

	topProducts, err := service.GetTopSellingProducts(context.Background(), 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(topProducts) != 2 {
		t.Errorf("expected 2 products, got %d", len(topProducts))
	}
}

func TestGetDailySalesReport(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	analyticsRepo := NewMockAnalyticsRepository()
	service.SetAnalyticsRepository(analyticsRepo)

	dailySales, err := service.GetDailySalesReport(context.Background(), 7)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(dailySales) != 2 { // MockAnalyticsRepository returns 2 days
		t.Errorf("expected 2 days, got %d", len(dailySales))
	}
}

func TestGetSalesByCategory(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	analyticsRepo := NewMockAnalyticsRepository()
	service.SetAnalyticsRepository(analyticsRepo)

	salesByCategory, err := service.GetSalesByCategory(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(salesByCategory) != 2 { // MockAnalyticsRepository returns 2 categories
		t.Errorf("expected 2 categories, got %d", len(salesByCategory))
	}
}

// ============================================
// Tests for Search
// ============================================

func TestSearchProducts_Basic(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	// Create products (they should be indexed automatically)
	p1 := &Product{Name: "iPhone 15 Pro", Price: 999.0, Stock: 10}
	p2 := &Product{Name: "Samsung Galaxy S24", Price: 899.0, Stock: 20}
	p3 := &Product{Name: "Google Pixel 8", Price: 699.0, Stock: 15}
	service.CreateProduct(context.Background(), p1)
	service.CreateProduct(context.Background(), p2)
	service.CreateProduct(context.Background(), p3)

	// Search for iPhone
	result, err := service.SearchProducts(context.Background(), &SearchQuery{Query: "iPhone"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Total != 1 {
		t.Errorf("expected 1 result, got %d", result.Total)
	}
}

func TestSearchProducts_WithFilters(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	cat := &Category{Name: "Phones"}
	service.CreateCategory(context.Background(), cat)

	service.CreateProduct(context.Background(), &Product{Name: "Phone 1", Price: 500.0, Stock: 10, CategoryID: cat.ID})
	service.CreateProduct(context.Background(), &Product{Name: "Phone 2", Price: 800.0, Stock: 5, CategoryID: cat.ID})
	service.CreateProduct(context.Background(), &Product{Name: "Phone 3", Price: 1200.0, Stock: 0, CategoryID: cat.ID})

	minPrice := 600.0
	maxPrice := 1000.0
	inStock := true

	result, _ := service.SearchProducts(context.Background(), &SearchQuery{
		MinPrice: &minPrice,
		MaxPrice: &maxPrice,
		InStock:  &inStock,
	})

	// Only Phone 2 (800, in stock) matches
	if result.Total != 1 {
		t.Errorf("expected 1 result with filters, got %d", result.Total)
	}
}

func TestSearchProducts_Pagination(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	// Create 15 products
	for i := 0; i < 15; i++ {
		service.CreateProduct(context.Background(), &Product{Name: "Product", Price: 100.0, Stock: 10})
	}

	// Get first page
	result1, _ := service.SearchProducts(context.Background(), &SearchQuery{Page: 1, PageSize: 10})
	if len(result1.Products) != 10 {
		t.Errorf("expected 10 products on page 1, got %d", len(result1.Products))
	}
	if result1.TotalPages != 2 {
		t.Errorf("expected 2 total pages, got %d", result1.TotalPages)
	}

	// Get second page
	result2, _ := service.SearchProducts(context.Background(), &SearchQuery{Page: 2, PageSize: 10})
	if len(result2.Products) != 5 {
		t.Errorf("expected 5 products on page 2, got %d", len(result2.Products))
	}
}

func TestSearchProducts_FallbackToDatabase(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	// Don't set search client - should fall back to database

	service.CreateProduct(context.Background(), &Product{Name: "Test Product", Price: 100.0, Stock: 10})

	result, err := service.SearchProducts(context.Background(), &SearchQuery{Query: "Test"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should return results from database
	if result == nil {
		t.Error("expected result, got nil")
	}
}

func TestSearchSuggest(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	service.CreateProduct(context.Background(), &Product{Name: "iPhone 15", Price: 999.0})
	service.CreateProduct(context.Background(), &Product{Name: "iPhone 14", Price: 799.0})
	service.CreateProduct(context.Background(), &Product{Name: "iPad Pro", Price: 1099.0})

	suggestions, err := service.SearchSuggest(context.Background(), "iPh", 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(suggestions) < 2 {
		t.Errorf("expected at least 2 suggestions, got %d", len(suggestions))
	}
}

func TestSearchSuggest_NoSearchClient(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	// Don't set search client

	suggestions, err := service.SearchSuggest(context.Background(), "test", 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if suggestions == nil {
		t.Error("expected empty slice, not nil")
	}
}

func TestReindexAllProducts(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	// Create products without indexing (simulating old products)
	repo.products["p1"] = &Product{ID: "p1", Name: "Product 1", Price: 100.0}
	repo.products["p2"] = &Product{ID: "p2", Name: "Product 2", Price: 200.0}
	repo.products["p3"] = &Product{ID: "p3", Name: "Product 3", Price: 300.0}

	err := service.ReindexAllProducts(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all products are indexed
	result, _ := service.SearchProducts(context.Background(), &SearchQuery{})
	if result.Total != 3 {
		t.Errorf("expected 3 products after reindex, got %d", result.Total)
	}
}

func TestReindexAllProducts_NoSearchClient(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	// Don't set search client

	err := service.ReindexAllProducts(context.Background())
	if err == nil {
		t.Error("expected error when search client not configured")
	}
}

// ============================================
// Tests for Product Updates with Search Index
// ============================================

func TestCreateProduct_IndexesInSearch(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	p := &Product{Name: "New Product", Price: 100.0}
	service.CreateProduct(context.Background(), p)

	// Verify product is searchable
	result, _ := service.SearchProducts(context.Background(), &SearchQuery{Query: "New Product"})
	if result.Total != 1 {
		t.Error("new product should be indexed in search")
	}
}

func TestUpdateProduct_UpdatesSearchIndex(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	p := &Product{Name: "Original Name", Price: 100.0}
	service.CreateProduct(context.Background(), p)

	// Update the product
	p.Name = "Updated Name"
	service.UpdateProduct(context.Background(), p)

	// Verify search reflects the update
	result, _ := service.SearchProducts(context.Background(), &SearchQuery{Query: "Updated"})
	if result.Total != 1 {
		t.Error("updated product should be found with new name")
	}

	result2, _ := service.SearchProducts(context.Background(), &SearchQuery{Query: "Original"})
	if result2.Total != 0 {
		t.Error("old name should not be found")
	}
}

func TestDeleteProduct_RemovesFromSearchIndex(t *testing.T) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	service.SetSearchClient(searchClient)

	p := &Product{Name: "To Delete", Price: 100.0}
	service.CreateProduct(context.Background(), p)

	// Verify it exists
	result1, _ := service.SearchProducts(context.Background(), &SearchQuery{Query: "Delete"})
	if result1.Total != 1 {
		t.Error("product should exist before deletion")
	}

	// Delete it
	service.DeleteProduct(context.Background(), p.ID)

	// Verify it's removed from search
	result2, _ := service.SearchProducts(context.Background(), &SearchQuery{Query: "Delete"})
	if result2.Total != 0 {
		t.Error("deleted product should not be found")
	}
}
