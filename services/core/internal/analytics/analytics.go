package analytics

import (
	"context"
	"time"
)

// SalesRecord represents a sales event
type SalesRecord struct {
	ID         string    `json:"id"`
	ProductID  string    `json:"product_id"`
	Quantity   int       `json:"quantity"`
	Price      float64   `json:"price"`
	TotalValue float64   `json:"total_value"`
	UserID     int64     `json:"user_id"`
	OrderID    string    `json:"order_id"`
	CreatedAt  time.Time `json:"created_at"`
}

// ProductSalesStats represents sales statistics for a product
type ProductSalesStats struct {
	ProductID      string  `json:"product_id"`
	ProductName    string  `json:"product_name"`
	TotalQuantity  int     `json:"total_quantity"`
	TotalRevenue   float64 `json:"total_revenue"`
	OrderCount     int     `json:"order_count"`
	AvgOrderValue  float64 `json:"avg_order_value"`
	AvgQuantity    float64 `json:"avg_quantity"`
}

// DailySales represents daily sales summary
type DailySales struct {
	Date         string  `json:"date"`
	TotalOrders  int     `json:"total_orders"`
	TotalRevenue float64 `json:"total_revenue"`
	TotalItems   int     `json:"total_items"`
}

// CategorySales represents sales by category
type CategorySales struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	TotalRevenue float64 `json:"total_revenue"`
	OrderCount   int     `json:"order_count"`
	ItemCount    int     `json:"item_count"`
}

// DashboardStats represents overall dashboard statistics
type DashboardStats struct {
	TotalRevenue       float64             `json:"total_revenue"`
	TotalOrders        int                 `json:"total_orders"`
	TotalProducts      int                 `json:"total_products"`
	TotalCategories    int                 `json:"total_categories"`
	AverageOrderValue  float64             `json:"average_order_value"`
	TopProducts        []*ProductSalesStats `json:"top_products"`
	SalesByCategory    []*CategorySales     `json:"sales_by_category"`
	RecentSales        []*DailySales        `json:"recent_sales"`
}

// Repository defines analytics data access
type Repository interface {
	RecordSale(ctx context.Context, record *SalesRecord) error
	GetProductSalesStats(ctx context.Context, productID string, from, to time.Time) (*ProductSalesStats, error)
	GetTopSellingProducts(ctx context.Context, limit int, from, to time.Time) ([]*ProductSalesStats, error)
	GetDailySales(ctx context.Context, from, to time.Time) ([]*DailySales, error)
	GetSalesByCategory(ctx context.Context, from, to time.Time) ([]*CategorySales, error)
}

// Service provides analytics operations
type Service struct {
	repo Repository
}

// NewService creates a new analytics service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// RecordSale records a sale event
func (s *Service) RecordSale(ctx context.Context, record *SalesRecord) error {
	if s.repo == nil {
		return nil
	}
	record.CreatedAt = time.Now()
	record.TotalValue = float64(record.Quantity) * record.Price
	return s.repo.RecordSale(ctx, record)
}

// GetProductStats returns sales stats for a product
func (s *Service) GetProductStats(ctx context.Context, productID string, days int) (*ProductSalesStats, error) {
	if s.repo == nil {
		return nil, nil
	}
	to := time.Now()
	from := to.AddDate(0, 0, -days)
	return s.repo.GetProductSalesStats(ctx, productID, from, to)
}

// GetTopProducts returns top selling products
func (s *Service) GetTopProducts(ctx context.Context, limit, days int) ([]*ProductSalesStats, error) {
	if s.repo == nil {
		return []*ProductSalesStats{}, nil
	}
	to := time.Now()
	from := to.AddDate(0, 0, -days)
	return s.repo.GetTopSellingProducts(ctx, limit, from, to)
}

// GetDailySales returns daily sales summary
func (s *Service) GetDailySales(ctx context.Context, days int) ([]*DailySales, error) {
	if s.repo == nil {
		return []*DailySales{}, nil
	}
	to := time.Now()
	from := to.AddDate(0, 0, -days)
	return s.repo.GetDailySales(ctx, from, to)
}

// GetSalesByCategory returns sales by category
func (s *Service) GetSalesByCategory(ctx context.Context, days int) ([]*CategorySales, error) {
	if s.repo == nil {
		return []*CategorySales{}, nil
	}
	to := time.Now()
	from := to.AddDate(0, 0, -days)
	return s.repo.GetSalesByCategory(ctx, from, to)
}
