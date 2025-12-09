package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"core/internal/pim"

	"github.com/google/uuid"
)

// Mock Repository for testing
type MockRepository struct {
	products map[string]*pim.Product
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		products: make(map[string]*pim.Product),
	}
}

func (m *MockRepository) Save(ctx context.Context, p *pim.Product) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	m.products[p.ID] = p
	return nil
}

func (m *MockRepository) GetByID(ctx context.Context, id string) (*pim.Product, error) {
	if p, ok := m.products[id]; ok {
		return p, nil
	}
	return nil, errors.New("product not found")
}

func (m *MockRepository) List(ctx context.Context) ([]*pim.Product, error) {
	result := make([]*pim.Product, 0, len(m.products))
	for _, p := range m.products {
		result = append(result, p)
	}
	return result, nil
}

func (m *MockRepository) ListWithFilter(ctx context.Context, filter pim.ProductFilter) ([]*pim.Product, error) {
	products, _ := m.List(ctx)
	var filtered []*pim.Product
	for _, p := range products {
		if filter.CategoryID != "" && p.CategoryID != filter.CategoryID {
			continue
		}
		filtered = append(filtered, p)
	}
	return filtered, nil
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

func (m *MockRepository) UpdateImage(ctx context.Context, id, imageURL string) error {
	if p, ok := m.products[id]; ok {
		p.ImageURL = imageURL
		return nil
	}
	return errors.New("product not found")
}

func (m *MockRepository) Update(ctx context.Context, p *pim.Product) error {
	if _, ok := m.products[p.ID]; !ok {
		return errors.New("product not found")
	}
	m.products[p.ID] = p
	return nil
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

// Mock Category Repository
type MockCategoryRepository struct {
	categories map[string]*pim.Category
}

func NewMockCategoryRepository() *MockCategoryRepository {
	return &MockCategoryRepository{
		categories: make(map[string]*pim.Category),
	}
}

func (m *MockCategoryRepository) SaveCategory(ctx context.Context, c *pim.Category) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.CreatedAt = time.Now()
	m.categories[c.ID] = c
	return nil
}

func (m *MockCategoryRepository) GetCategoryByID(ctx context.Context, id string) (*pim.Category, error) {
	if c, ok := m.categories[id]; ok {
		return c, nil
	}
	return nil, errors.New("category not found")
}

func (m *MockCategoryRepository) ListCategories(ctx context.Context) ([]*pim.Category, error) {
	result := make([]*pim.Category, 0, len(m.categories))
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

func setupHandler() (*Handler, *MockRepository, *MockCategoryRepository) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := pim.NewService(repo, catRepo)
	handler := NewHandler(service)
	return handler, repo, catRepo
}

// ============================================
// Product Handler Tests
// ============================================

func TestCreateProduct_Success(t *testing.T) {
	handler, _, _ := setupHandler()

	body := `{"name": "Test Product", "price": 99.99, "stock": 10}`
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.CreateProduct(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected status %d, got %d", http.StatusCreated, rec.Code)
	}

	var product pim.Product
	if err := json.NewDecoder(rec.Body).Decode(&product); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if product.Name != "Test Product" {
		t.Errorf("expected name 'Test Product', got %s", product.Name)
	}
	if product.ID == "" {
		t.Error("expected ID to be set")
	}
}

func TestCreateProduct_InvalidJSON(t *testing.T) {
	handler, _, _ := setupHandler()

	body := `{"name": invalid}`
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()

	handler.CreateProduct(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestCreateProduct_MethodNotAllowed(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	rec := httptest.NewRecorder()

	handler.CreateProduct(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, rec.Code)
	}
}

func TestCreateProduct_ValidationError(t *testing.T) {
	handler, _, _ := setupHandler()

	body := `{"name": "", "price": 99.99}` // Empty name
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()

	handler.CreateProduct(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestListProducts_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	// Add products directly to repo
	repo.Save(context.Background(), &pim.Product{Name: "Product 1", Price: 100.0})
	repo.Save(context.Background(), &pim.Product{Name: "Product 2", Price: 200.0})

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	rec := httptest.NewRecorder()

	handler.ListProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var products []*pim.Product
	if err := json.NewDecoder(rec.Body).Decode(&products); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(products) != 2 {
		t.Errorf("expected 2 products, got %d", len(products))
	}
}

func TestListProducts_Empty(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	rec := httptest.NewRecorder()

	handler.ListProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var products []*pim.Product
	if err := json.NewDecoder(rec.Body).Decode(&products); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Should return empty array, not null
	if products == nil {
		t.Error("expected empty array, got nil")
	}
}

func TestListProducts_WithFilter(t *testing.T) {
	handler, repo, catRepo := setupHandler()

	// Create category
	cat := &pim.Category{Name: "Electronics"}
	catRepo.SaveCategory(context.Background(), cat)

	// Add products
	repo.Save(context.Background(), &pim.Product{Name: "iPhone", Price: 999.0, CategoryID: cat.ID})
	repo.Save(context.Background(), &pim.Product{Name: "T-Shirt", Price: 29.0, CategoryID: "other"})

	req := httptest.NewRequest(http.MethodGet, "/products?category_id="+cat.ID, nil)
	rec := httptest.NewRecorder()

	handler.ListProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var products []*pim.Product
	if err := json.NewDecoder(rec.Body).Decode(&products); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(products) != 1 {
		t.Errorf("expected 1 product, got %d", len(products))
	}
}

func TestGetProduct_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	// Create product
	p := &pim.Product{Name: "Test Product", Price: 99.99}
	repo.Save(context.Background(), p)

	req := httptest.NewRequest(http.MethodGet, "/products/"+p.ID, nil)
	rec := httptest.NewRecorder()

	handler.GetProduct(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var product pim.Product
	if err := json.NewDecoder(rec.Body).Decode(&product); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if product.Name != "Test Product" {
		t.Errorf("expected name 'Test Product', got %s", product.Name)
	}
}

func TestGetProduct_NotFound(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/products/nonexistent-id", nil)
	rec := httptest.NewRecorder()

	handler.GetProduct(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
}

func TestDeleteProduct_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	// Create product
	p := &pim.Product{Name: "Test Product", Price: 99.99}
	repo.Save(context.Background(), p)

	req := httptest.NewRequest(http.MethodDelete, "/products/"+p.ID, nil)
	rec := httptest.NewRecorder()

	handler.DeleteProduct(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected status %d, got %d", http.StatusNoContent, rec.Code)
	}

	// Verify product is deleted
	_, err := repo.GetByID(context.Background(), p.ID)
	if err == nil {
		t.Error("expected product to be deleted")
	}
}

func TestUpdateStock_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	// Create product
	p := &pim.Product{Name: "Test Product", Price: 99.99, Stock: 10}
	repo.Save(context.Background(), p)

	body := `{"stock": 50}`
	req := httptest.NewRequest(http.MethodPatch, "/products/"+p.ID+"/stock", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()

	handler.UpdateStock(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	// Verify stock updated
	updated, _ := repo.GetByID(context.Background(), p.ID)
	if updated.Stock != 50 {
		t.Errorf("expected stock 50, got %d", updated.Stock)
	}
}

func TestUpdateImage_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	// Create product
	p := &pim.Product{Name: "Test Product", Price: 99.99}
	repo.Save(context.Background(), p)

	body := `{"image_url": "https://example.com/image.jpg"}`
	req := httptest.NewRequest(http.MethodPatch, "/products/"+p.ID+"/image", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()

	handler.UpdateImage(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

// ============================================
// Category Handler Tests
// ============================================

func TestCreateCategory_Success(t *testing.T) {
	handler, _, _ := setupHandler()

	body := `{"name": "Electronics"}`
	req := httptest.NewRequest(http.MethodPost, "/categories", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()

	handler.CreateCategory(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected status %d, got %d", http.StatusCreated, rec.Code)
	}

	var category pim.Category
	if err := json.NewDecoder(rec.Body).Decode(&category); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if category.Name != "Electronics" {
		t.Errorf("expected name 'Electronics', got %s", category.Name)
	}
}

func TestCreateCategory_InvalidJSON(t *testing.T) {
	handler, _, _ := setupHandler()

	body := `{"name": invalid}`
	req := httptest.NewRequest(http.MethodPost, "/categories", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()

	handler.CreateCategory(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestListCategories_Success(t *testing.T) {
	handler, _, catRepo := setupHandler()

	catRepo.SaveCategory(context.Background(), &pim.Category{Name: "Electronics"})
	catRepo.SaveCategory(context.Background(), &pim.Category{Name: "Clothing"})

	req := httptest.NewRequest(http.MethodGet, "/categories", nil)
	rec := httptest.NewRecorder()

	handler.ListCategories(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var categories []*pim.Category
	if err := json.NewDecoder(rec.Body).Decode(&categories); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(categories) != 2 {
		t.Errorf("expected 2 categories, got %d", len(categories))
	}
}

func TestGetCategory_Success(t *testing.T) {
	handler, _, catRepo := setupHandler()

	cat := &pim.Category{Name: "Electronics"}
	catRepo.SaveCategory(context.Background(), cat)

	req := httptest.NewRequest(http.MethodGet, "/categories/"+cat.ID, nil)
	rec := httptest.NewRecorder()

	handler.GetCategory(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestGetCategory_NotFound(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/categories/nonexistent-id", nil)
	rec := httptest.NewRecorder()

	handler.GetCategory(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
}

func TestDeleteCategory_Success(t *testing.T) {
	handler, _, catRepo := setupHandler()

	cat := &pim.Category{Name: "Electronics"}
	catRepo.SaveCategory(context.Background(), cat)

	req := httptest.NewRequest(http.MethodDelete, "/categories/"+cat.ID, nil)
	rec := httptest.NewRecorder()

	handler.DeleteCategory(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected status %d, got %d", http.StatusNoContent, rec.Code)
	}
}

// ============================================
// Search Handler Tests
// ============================================

func TestSearchProducts_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	// Create products
	repo.Save(context.Background(), &pim.Product{Name: "iPhone 15", Price: 999.0})
	repo.Save(context.Background(), &pim.Product{Name: "Samsung Galaxy", Price: 899.0})

	req := httptest.NewRequest(http.MethodGet, "/search?q=iphone", nil)
	rec := httptest.NewRecorder()

	handler.SearchProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestSearchProducts_WithPriceFilter(t *testing.T) {
	handler, repo, _ := setupHandler()

	repo.Save(context.Background(), &pim.Product{Name: "Cheap Product", Price: 50.0})
	repo.Save(context.Background(), &pim.Product{Name: "Expensive Product", Price: 500.0})

	req := httptest.NewRequest(http.MethodGet, "/search?q=product&min_price=100&max_price=1000", nil)
	rec := httptest.NewRecorder()

	handler.SearchProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestSearchSuggest_Success(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/search/suggest?q=iph", nil)
	rec := httptest.NewRecorder()

	handler.SearchSuggest(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

// ============================================
// Inventory Handler Tests
// ============================================

func TestGetLowStockProducts_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	repo.Save(context.Background(), &pim.Product{Name: "Low Stock", Price: 100.0, Stock: 5})
	repo.Save(context.Background(), &pim.Product{Name: "Normal Stock", Price: 200.0, Stock: 50})

	req := httptest.NewRequest(http.MethodGet, "/inventory/low-stock?threshold=10", nil)
	rec := httptest.NewRecorder()

	handler.GetLowStockProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var products []*pim.Product
	if err := json.NewDecoder(rec.Body).Decode(&products); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(products) != 1 {
		t.Errorf("expected 1 low stock product, got %d", len(products))
	}
}

func TestGetOutOfStockProducts_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	repo.Save(context.Background(), &pim.Product{Name: "Out of Stock", Price: 100.0, Stock: 0})
	repo.Save(context.Background(), &pim.Product{Name: "In Stock", Price: 200.0, Stock: 10})

	req := httptest.NewRequest(http.MethodGet, "/inventory/out-of-stock", nil)
	rec := httptest.NewRecorder()

	handler.GetOutOfStockProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var products []*pim.Product
	if err := json.NewDecoder(rec.Body).Decode(&products); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(products) != 1 {
		t.Errorf("expected 1 out of stock product, got %d", len(products))
	}
}

func TestGetInventoryStats_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	repo.Save(context.Background(), &pim.Product{Name: "P1", Price: 100.0, Stock: 0})
	repo.Save(context.Background(), &pim.Product{Name: "P2", Price: 200.0, Stock: 10})

	req := httptest.NewRequest(http.MethodGet, "/inventory/stats", nil)
	rec := httptest.NewRecorder()

	handler.GetInventoryStats(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var stats map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&stats); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if stats["total_products"] == nil {
		t.Error("expected total_products in stats")
	}
}

// ============================================
// Analytics Handler Tests
// ============================================

func TestGetAnalyticsDashboard_Success(t *testing.T) {
	handler, repo, catRepo := setupHandler()

	repo.Save(context.Background(), &pim.Product{Name: "P1", Price: 100.0})
	catRepo.SaveCategory(context.Background(), &pim.Category{Name: "Cat1"})

	req := httptest.NewRequest(http.MethodGet, "/analytics/dashboard", nil)
	rec := httptest.NewRecorder()

	handler.GetAnalyticsDashboard(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestGetTopSellingProducts_Success(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/analytics/top-products?limit=10", nil)
	rec := httptest.NewRecorder()

	handler.GetTopSellingProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestGetDailySalesReport_Success(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/analytics/daily-sales?days=7", nil)
	rec := httptest.NewRecorder()

	handler.GetDailySalesReport(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestGetSalesByCategory_Success(t *testing.T) {
	handler, _, _ := setupHandler()

	req := httptest.NewRequest(http.MethodGet, "/analytics/by-category", nil)
	rec := httptest.NewRecorder()

	handler.GetSalesByCategory(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

// ============================================
// Recommendations Handler Tests
// ============================================

func TestGetSimilarProducts_Success(t *testing.T) {
	handler, repo, catRepo := setupHandler()

	// Create category
	cat := &pim.Category{Name: "Electronics"}
	catRepo.SaveCategory(context.Background(), cat)

	// Create products in same category
	p1 := &pim.Product{Name: "iPhone 15", Price: 999.0, CategoryID: cat.ID}
	p2 := &pim.Product{Name: "iPhone 14", Price: 799.0, CategoryID: cat.ID}
	repo.Save(context.Background(), p1)
	repo.Save(context.Background(), p2)

	req := httptest.NewRequest(http.MethodGet, "/products/"+p1.ID+"/similar?limit=5", nil)
	rec := httptest.NewRecorder()

	handler.GetSimilarProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestGetPopularProducts_Success(t *testing.T) {
	handler, repo, _ := setupHandler()

	repo.Save(context.Background(), &pim.Product{Name: "Popular 1", Price: 100.0})
	repo.Save(context.Background(), &pim.Product{Name: "Popular 2", Price: 200.0})

	req := httptest.NewRequest(http.MethodGet, "/recommendations/popular?limit=10", nil)
	rec := httptest.NewRecorder()

	handler.GetPopularProducts(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

// ============================================
// Helper function tests
// ============================================

func TestSplitPath(t *testing.T) {
	tests := []struct {
		path     string
		expected []string
	}{
		{"/123/item/abc", []string{"123", "item", "abc"}},
		{"123/item/abc", []string{"123", "item", "abc"}},
		{"/123/", []string{"123"}},
		{"", []string{}},
	}

	for _, tt := range tests {
		result := splitPath(tt.path)
		if len(result) != len(tt.expected) {
			t.Errorf("splitPath(%q) = %v, want %v", tt.path, result, tt.expected)
			continue
		}
		for i, v := range result {
			if v != tt.expected[i] {
				t.Errorf("splitPath(%q)[%d] = %q, want %q", tt.path, i, v, tt.expected[i])
			}
		}
	}
}

// ============================================
// Method Not Allowed Tests
// ============================================

func TestMethodNotAllowed(t *testing.T) {
	handler, _, _ := setupHandler()

	tests := []struct {
		name        string
		method      string
		path        string
		handlerFunc func(http.ResponseWriter, *http.Request)
	}{
		{"CreateProduct_GET", http.MethodGet, "/products", handler.CreateProduct},
		{"ListProducts_POST", http.MethodPost, "/products", handler.ListProducts},
		{"GetProduct_POST", http.MethodPost, "/products/1", handler.GetProduct},
		{"DeleteProduct_POST", http.MethodPost, "/products/1", handler.DeleteProduct},
		{"UpdateStock_POST", http.MethodPost, "/products/1/stock", handler.UpdateStock},
		{"CreateCategory_GET", http.MethodGet, "/categories", handler.CreateCategory},
		{"ListCategories_POST", http.MethodPost, "/categories", handler.ListCategories},
		{"GetCategory_POST", http.MethodPost, "/categories/1", handler.GetCategory},
		{"DeleteCategory_POST", http.MethodPost, "/categories/1", handler.DeleteCategory},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rec := httptest.NewRecorder()

			tt.handlerFunc(rec, req)

			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s: expected status %d, got %d", tt.name, http.StatusMethodNotAllowed, rec.Code)
			}
		})
	}
}

// ============================================
// Empty ID Tests
// ============================================

func TestEmptyID_Returns400(t *testing.T) {
	handler, _, _ := setupHandler()

	tests := []struct {
		name        string
		method      string
		path        string
		handlerFunc func(http.ResponseWriter, *http.Request)
	}{
		{"GetProduct", http.MethodGet, "/products/", handler.GetProduct},
		{"DeleteProduct", http.MethodDelete, "/products/", handler.DeleteProduct},
		{"GetCategory", http.MethodGet, "/categories/", handler.GetCategory},
		{"DeleteCategory", http.MethodDelete, "/categories/", handler.DeleteCategory},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rec := httptest.NewRecorder()

			tt.handlerFunc(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("%s: expected status %d, got %d", tt.name, http.StatusBadRequest, rec.Code)
			}
		})
	}
}
