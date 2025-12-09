package analytics

import (
	"context"
	"testing"
	"time"
)

// MockRepository for analytics testing
type MockRepository struct {
	salesRecords      []*SalesRecord
	productStats      map[string]*ProductSalesStats
	topProducts       []*ProductSalesStats
	dailySales        []*DailySales
	categorySales     []*CategorySales
	recordSaleErr     error
	getProductStatsErr error
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		salesRecords: make([]*SalesRecord, 0),
		productStats: make(map[string]*ProductSalesStats),
	}
}

func (m *MockRepository) RecordSale(ctx context.Context, record *SalesRecord) error {
	if m.recordSaleErr != nil {
		return m.recordSaleErr
	}
	m.salesRecords = append(m.salesRecords, record)
	return nil
}

func (m *MockRepository) GetProductSalesStats(ctx context.Context, productID string, from, to time.Time) (*ProductSalesStats, error) {
	if m.getProductStatsErr != nil {
		return nil, m.getProductStatsErr
	}
	if stats, ok := m.productStats[productID]; ok {
		return stats, nil
	}
	return &ProductSalesStats{ProductID: productID}, nil
}

func (m *MockRepository) GetTopSellingProducts(ctx context.Context, limit int, from, to time.Time) ([]*ProductSalesStats, error) {
	if m.topProducts == nil {
		return []*ProductSalesStats{}, nil
	}
	if limit > len(m.topProducts) {
		return m.topProducts, nil
	}
	return m.topProducts[:limit], nil
}

func (m *MockRepository) GetDailySales(ctx context.Context, from, to time.Time) ([]*DailySales, error) {
	if m.dailySales == nil {
		return []*DailySales{}, nil
	}
	return m.dailySales, nil
}

func (m *MockRepository) GetSalesByCategory(ctx context.Context, from, to time.Time) ([]*CategorySales, error) {
	if m.categorySales == nil {
		return []*CategorySales{}, nil
	}
	return m.categorySales, nil
}

func (m *MockRepository) SetTopProducts(products []*ProductSalesStats) {
	m.topProducts = products
}

func (m *MockRepository) SetDailySales(sales []*DailySales) {
	m.dailySales = sales
}

func (m *MockRepository) SetCategorySales(sales []*CategorySales) {
	m.categorySales = sales
}

func (m *MockRepository) SetProductStats(productID string, stats *ProductSalesStats) {
	m.productStats[productID] = stats
}

// Tests

func TestSalesRecord(t *testing.T) {
	now := time.Now()
	record := SalesRecord{
		ID:         "sale-1",
		ProductID:  "prod-1",
		Quantity:   5,
		Price:      100.00,
		TotalValue: 500.00,
		UserID:     123,
		OrderID:    "order-1",
		CreatedAt:  now,
	}

	if record.ID != "sale-1" {
		t.Errorf("expected ID 'sale-1', got %s", record.ID)
	}
	if record.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", record.ProductID)
	}
	if record.TotalValue != 500.00 {
		t.Errorf("expected TotalValue 500.00, got %f", record.TotalValue)
	}
}

func TestProductSalesStats(t *testing.T) {
	stats := ProductSalesStats{
		ProductID:     "prod-1",
		ProductName:   "Test Product",
		TotalQuantity: 100,
		TotalRevenue:  10000.00,
		OrderCount:    50,
		AvgOrderValue: 200.00,
		AvgQuantity:   2.0,
	}

	if stats.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", stats.ProductID)
	}
	if stats.TotalRevenue != 10000.00 {
		t.Errorf("expected TotalRevenue 10000.00, got %f", stats.TotalRevenue)
	}
	if stats.AvgOrderValue != 200.00 {
		t.Errorf("expected AvgOrderValue 200.00, got %f", stats.AvgOrderValue)
	}
}

func TestDailySales(t *testing.T) {
	sales := DailySales{
		Date:         "2024-01-01",
		TotalOrders:  25,
		TotalRevenue: 5000.00,
		TotalItems:   100,
	}

	if sales.Date != "2024-01-01" {
		t.Errorf("expected Date '2024-01-01', got %s", sales.Date)
	}
	if sales.TotalOrders != 25 {
		t.Errorf("expected TotalOrders 25, got %d", sales.TotalOrders)
	}
}

func TestCategorySales(t *testing.T) {
	sales := CategorySales{
		CategoryID:   "cat-1",
		CategoryName: "Electronics",
		TotalRevenue: 50000.00,
		OrderCount:   200,
		ItemCount:    500,
	}

	if sales.CategoryID != "cat-1" {
		t.Errorf("expected CategoryID 'cat-1', got %s", sales.CategoryID)
	}
	if sales.TotalRevenue != 50000.00 {
		t.Errorf("expected TotalRevenue 50000.00, got %f", sales.TotalRevenue)
	}
}

func TestDashboardStats(t *testing.T) {
	stats := DashboardStats{
		TotalRevenue:      100000.00,
		TotalOrders:       500,
		TotalProducts:     1000,
		TotalCategories:   50,
		AverageOrderValue: 200.00,
		TopProducts: []*ProductSalesStats{
			{ProductID: "prod-1", TotalRevenue: 10000.00},
		},
		SalesByCategory: []*CategorySales{
			{CategoryID: "cat-1", TotalRevenue: 50000.00},
		},
		RecentSales: []*DailySales{
			{Date: "2024-01-01", TotalRevenue: 5000.00},
		},
	}

	if stats.TotalRevenue != 100000.00 {
		t.Errorf("expected TotalRevenue 100000.00, got %f", stats.TotalRevenue)
	}
	if stats.AverageOrderValue != 200.00 {
		t.Errorf("expected AverageOrderValue 200.00, got %f", stats.AverageOrderValue)
	}
	if len(stats.TopProducts) != 1 {
		t.Errorf("expected 1 top product, got %d", len(stats.TopProducts))
	}
}

func TestNewService(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	if service == nil {
		t.Fatal("expected service to be created")
	}
	if service.repo == nil {
		t.Error("expected repo to be set")
	}
}

func TestNewService_NilRepo(t *testing.T) {
	service := NewService(nil)

	if service == nil {
		t.Fatal("expected service to be created")
	}
	if service.repo != nil {
		t.Error("expected repo to be nil")
	}
}

func TestService_RecordSale(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)
	ctx := context.Background()

	record := &SalesRecord{
		ID:        "sale-1",
		ProductID: "prod-1",
		Quantity:  3,
		Price:     50.00,
		OrderID:   "order-1",
	}

	err := service.RecordSale(ctx, record)
	if err != nil {
		t.Fatalf("RecordSale error: %v", err)
	}

	// Verify TotalValue was calculated
	if record.TotalValue != 150.00 {
		t.Errorf("expected TotalValue 150.00, got %f", record.TotalValue)
	}

	// Verify CreatedAt was set
	if record.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set")
	}

	// Verify sale was recorded
	if len(repo.salesRecords) != 1 {
		t.Errorf("expected 1 sale record, got %d", len(repo.salesRecords))
	}
}

func TestService_RecordSale_NilRepo(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	record := &SalesRecord{
		ID:        "sale-1",
		ProductID: "prod-1",
		Quantity:  3,
		Price:     50.00,
	}

	// Should not panic with nil repo
	err := service.RecordSale(ctx, record)
	if err != nil {
		t.Errorf("expected nil error with nil repo, got: %v", err)
	}
}

func TestService_GetProductStats(t *testing.T) {
	repo := NewMockRepository()
	repo.SetProductStats("prod-1", &ProductSalesStats{
		ProductID:     "prod-1",
		TotalQuantity: 50,
		TotalRevenue:  5000.00,
	})

	service := NewService(repo)
	ctx := context.Background()

	stats, err := service.GetProductStats(ctx, "prod-1", 30)
	if err != nil {
		t.Fatalf("GetProductStats error: %v", err)
	}

	if stats.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", stats.ProductID)
	}
	if stats.TotalQuantity != 50 {
		t.Errorf("expected TotalQuantity 50, got %d", stats.TotalQuantity)
	}
}

func TestService_GetProductStats_NilRepo(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	stats, err := service.GetProductStats(ctx, "prod-1", 30)
	if err != nil {
		t.Errorf("expected nil error with nil repo, got: %v", err)
	}
	if stats != nil {
		t.Error("expected nil stats with nil repo")
	}
}

func TestService_GetTopProducts(t *testing.T) {
	repo := NewMockRepository()
	repo.SetTopProducts([]*ProductSalesStats{
		{ProductID: "prod-1", TotalRevenue: 10000.00},
		{ProductID: "prod-2", TotalRevenue: 8000.00},
		{ProductID: "prod-3", TotalRevenue: 5000.00},
	})

	service := NewService(repo)
	ctx := context.Background()

	products, err := service.GetTopProducts(ctx, 2, 30)
	if err != nil {
		t.Fatalf("GetTopProducts error: %v", err)
	}

	if len(products) != 2 {
		t.Errorf("expected 2 products, got %d", len(products))
	}
}

func TestService_GetTopProducts_NilRepo(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	products, err := service.GetTopProducts(ctx, 10, 30)
	if err != nil {
		t.Errorf("expected nil error with nil repo, got: %v", err)
	}
	if len(products) != 0 {
		t.Errorf("expected empty slice with nil repo, got %d", len(products))
	}
}

func TestService_GetDailySales(t *testing.T) {
	repo := NewMockRepository()
	repo.SetDailySales([]*DailySales{
		{Date: "2024-01-01", TotalRevenue: 5000.00},
		{Date: "2024-01-02", TotalRevenue: 6000.00},
		{Date: "2024-01-03", TotalRevenue: 4500.00},
	})

	service := NewService(repo)
	ctx := context.Background()

	sales, err := service.GetDailySales(ctx, 7)
	if err != nil {
		t.Fatalf("GetDailySales error: %v", err)
	}

	if len(sales) != 3 {
		t.Errorf("expected 3 daily sales, got %d", len(sales))
	}
}

func TestService_GetDailySales_NilRepo(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	sales, err := service.GetDailySales(ctx, 7)
	if err != nil {
		t.Errorf("expected nil error with nil repo, got: %v", err)
	}
	if len(sales) != 0 {
		t.Errorf("expected empty slice with nil repo, got %d", len(sales))
	}
}

func TestService_GetSalesByCategory(t *testing.T) {
	repo := NewMockRepository()
	repo.SetCategorySales([]*CategorySales{
		{CategoryID: "cat-1", CategoryName: "Electronics", TotalRevenue: 50000.00},
		{CategoryID: "cat-2", CategoryName: "Clothing", TotalRevenue: 30000.00},
	})

	service := NewService(repo)
	ctx := context.Background()

	sales, err := service.GetSalesByCategory(ctx, 30)
	if err != nil {
		t.Fatalf("GetSalesByCategory error: %v", err)
	}

	if len(sales) != 2 {
		t.Errorf("expected 2 category sales, got %d", len(sales))
	}
}

func TestService_GetSalesByCategory_NilRepo(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	sales, err := service.GetSalesByCategory(ctx, 30)
	if err != nil {
		t.Errorf("expected nil error with nil repo, got: %v", err)
	}
	if len(sales) != 0 {
		t.Errorf("expected empty slice with nil repo, got %d", len(sales))
	}
}

func TestMockRepository_RecordSale(t *testing.T) {
	repo := NewMockRepository()
	ctx := context.Background()

	record := &SalesRecord{
		ID:        "sale-1",
		ProductID: "prod-1",
		Quantity:  5,
		Price:     100.00,
	}

	err := repo.RecordSale(ctx, record)
	if err != nil {
		t.Fatalf("RecordSale error: %v", err)
	}

	if len(repo.salesRecords) != 1 {
		t.Errorf("expected 1 record, got %d", len(repo.salesRecords))
	}
}

func TestMockRepository_GetProductSalesStats(t *testing.T) {
	repo := NewMockRepository()
	ctx := context.Background()

	// Without preset stats
	stats, err := repo.GetProductSalesStats(ctx, "prod-1", time.Now(), time.Now())
	if err != nil {
		t.Fatalf("GetProductSalesStats error: %v", err)
	}
	if stats.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", stats.ProductID)
	}

	// With preset stats
	repo.SetProductStats("prod-2", &ProductSalesStats{
		ProductID:     "prod-2",
		TotalQuantity: 100,
	})

	stats, err = repo.GetProductSalesStats(ctx, "prod-2", time.Now(), time.Now())
	if err != nil {
		t.Fatalf("GetProductSalesStats error: %v", err)
	}
	if stats.TotalQuantity != 100 {
		t.Errorf("expected TotalQuantity 100, got %d", stats.TotalQuantity)
	}
}

func TestMockRepository_GetTopSellingProducts(t *testing.T) {
	repo := NewMockRepository()
	ctx := context.Background()

	// Without preset data
	products, err := repo.GetTopSellingProducts(ctx, 10, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("GetTopSellingProducts error: %v", err)
	}
	if len(products) != 0 {
		t.Errorf("expected 0 products, got %d", len(products))
	}

	// With preset data
	repo.SetTopProducts([]*ProductSalesStats{
		{ProductID: "prod-1"},
		{ProductID: "prod-2"},
		{ProductID: "prod-3"},
	})

	products, err = repo.GetTopSellingProducts(ctx, 2, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("GetTopSellingProducts error: %v", err)
	}
	if len(products) != 2 {
		t.Errorf("expected 2 products, got %d", len(products))
	}

	// Request more than available
	products, err = repo.GetTopSellingProducts(ctx, 10, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("GetTopSellingProducts error: %v", err)
	}
	if len(products) != 3 {
		t.Errorf("expected 3 products, got %d", len(products))
	}
}
