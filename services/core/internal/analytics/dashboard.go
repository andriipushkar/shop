package analytics

import (
	"context"
	"time"
)

// Period represents time period for analytics
type Period struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

// DashboardMetrics represents main dashboard metrics
type DashboardMetrics struct {
	Period            Period             `json:"period"`
	TotalRevenue      float64            `json:"total_revenue"`
	TotalOrders       int                `json:"total_orders"`
	AverageOrderValue float64            `json:"average_order_value"`
	TotalCustomers    int                `json:"total_customers"`
	NewCustomers      int                `json:"new_customers"`
	ReturningCustomers int               `json:"returning_customers"`
	ConversionRate    float64            `json:"conversion_rate"`
	CartAbandonment   float64            `json:"cart_abandonment_rate"`
	TotalProducts     int                `json:"total_products"`
	ProductsSold      int                `json:"products_sold"`
	TopProducts       []ProductMetric    `json:"top_products"`
	TopCategories     []CategoryMetric   `json:"top_categories"`
	RevenueByDay      []DailyRevenue     `json:"revenue_by_day"`
	OrdersByStatus    map[string]int     `json:"orders_by_status"`
	PaymentMethods    map[string]float64 `json:"payment_methods"`
	TrafficSources    map[string]int     `json:"traffic_sources"`
}

// ProductMetric represents product analytics
type ProductMetric struct {
	ProductID     string  `json:"product_id"`
	SKU           string  `json:"sku"`
	Name          string  `json:"name"`
	Revenue       float64 `json:"revenue"`
	Quantity      int     `json:"quantity"`
	OrderCount    int     `json:"order_count"`
	AvgPrice      float64 `json:"avg_price"`
	Margin        float64 `json:"margin,omitempty"`
	MarginPercent float64 `json:"margin_percent,omitempty"`
}

// CategoryMetric represents category analytics
type CategoryMetric struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Revenue      float64 `json:"revenue"`
	Quantity     int     `json:"quantity"`
	OrderCount   int     `json:"order_count"`
	ProductCount int     `json:"product_count"`
}

// DailyRevenue represents daily revenue data
type DailyRevenue struct {
	Date      string  `json:"date"`
	Revenue   float64 `json:"revenue"`
	Orders    int     `json:"orders"`
	Customers int     `json:"customers"`
}

// CustomerMetric represents customer analytics
type CustomerMetric struct {
	CustomerID     string    `json:"customer_id"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	TotalSpent     float64   `json:"total_spent"`
	OrderCount     int       `json:"order_count"`
	AvgOrderValue  float64   `json:"avg_order_value"`
	FirstOrderDate time.Time `json:"first_order_date"`
	LastOrderDate  time.Time `json:"last_order_date"`
	DaysSinceOrder int       `json:"days_since_order"`
	LifetimeValue  float64   `json:"lifetime_value"`
}

// SalesComparison represents period comparison
type SalesComparison struct {
	CurrentPeriod   Period  `json:"current_period"`
	PreviousPeriod  Period  `json:"previous_period"`
	RevenueChange   float64 `json:"revenue_change"`
	OrdersChange    float64 `json:"orders_change"`
	CustomersChange float64 `json:"customers_change"`
	AOVChange       float64 `json:"aov_change"`
}

// InventoryMetrics represents inventory analytics
type InventoryMetrics struct {
	TotalProducts    int                `json:"total_products"`
	TotalValue       float64            `json:"total_value"`
	LowStockCount    int                `json:"low_stock_count"`
	OutOfStockCount  int                `json:"out_of_stock_count"`
	OverstockCount   int                `json:"overstock_count"`
	AverageTurnover  float64            `json:"average_turnover"`
	LowStockProducts []InventoryProduct `json:"low_stock_products"`
}

// InventoryProduct represents product inventory status
type InventoryProduct struct {
	ProductID   string  `json:"product_id"`
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Stock       int     `json:"stock"`
	MinStock    int     `json:"min_stock"`
	Reserved    int     `json:"reserved"`
	Available   int     `json:"available"`
	Value       float64 `json:"value"`
	Turnover    float64 `json:"turnover"`
	DaysOfStock int     `json:"days_of_stock"`
}

// DashboardRepository defines data access interface for dashboard
type DashboardRepository interface {
	GetDashboardMetrics(ctx context.Context, period Period) (*DashboardMetrics, error)
	GetProductMetrics(ctx context.Context, period Period, limit int) ([]ProductMetric, error)
	GetCategoryMetrics(ctx context.Context, period Period) ([]CategoryMetric, error)
	GetCustomerMetrics(ctx context.Context, period Period, limit int) ([]CustomerMetric, error)
	GetDailyRevenue(ctx context.Context, period Period) ([]DailyRevenue, error)
	GetInventoryMetrics(ctx context.Context) (*InventoryMetrics, error)

	// For ABC/XYZ analysis
	GetProductSalesData(ctx context.Context, period Period) ([]ProductSalesData, error)

	// For RFM analysis
	GetCustomerTransactions(ctx context.Context, period Period) ([]CustomerTransaction, error)
}

// ProductSalesData for ABC/XYZ analysis
type ProductSalesData struct {
	ProductID    string      `json:"product_id"`
	SKU          string      `json:"sku"`
	Name         string      `json:"name"`
	Category     string      `json:"category"`
	Revenue      float64     `json:"revenue"`
	Quantity     int         `json:"quantity"`
	CostPrice    float64     `json:"cost_price"`
	Margin       float64     `json:"margin"`
	SalesDates   []time.Time `json:"-"`
	MonthlySales []float64   `json:"-"`
}

// CustomerTransaction for RFM analysis
type CustomerTransaction struct {
	CustomerID    string    `json:"customer_id"`
	CustomerName  string    `json:"customer_name"`
	CustomerEmail string    `json:"customer_email"`
	OrderID       string    `json:"order_id"`
	OrderDate     time.Time `json:"order_date"`
	OrderTotal    float64   `json:"order_total"`
}

// DashboardService provides dashboard analytics functionality
type DashboardService struct {
	repo DashboardRepository
}

// NewDashboardService creates dashboard service
func NewDashboardService(repo DashboardRepository) *DashboardService {
	return &DashboardService{repo: repo}
}

// AnalyticsService provides comprehensive analytics including ABC/XYZ and RFM
type AnalyticsService struct {
	repo DashboardRepository
}

// NewAnalyticsService creates analytics service
func NewAnalyticsService(repo DashboardRepository) *AnalyticsService {
	return &AnalyticsService{repo: repo}
}

// GetDashboard returns dashboard metrics
func (s *DashboardService) GetDashboard(ctx context.Context, period Period) (*DashboardMetrics, error) {
	return s.repo.GetDashboardMetrics(ctx, period)
}

// GetTopProductsMetrics returns top selling products
func (s *DashboardService) GetTopProductsMetrics(ctx context.Context, period Period, limit int) ([]ProductMetric, error) {
	return s.repo.GetProductMetrics(ctx, period, limit)
}

// GetTopCategoriesMetrics returns top categories
func (s *DashboardService) GetTopCategoriesMetrics(ctx context.Context, period Period) ([]CategoryMetric, error) {
	return s.repo.GetCategoryMetrics(ctx, period)
}

// GetTopCustomersMetrics returns top customers by spending
func (s *DashboardService) GetTopCustomersMetrics(ctx context.Context, period Period, limit int) ([]CustomerMetric, error) {
	return s.repo.GetCustomerMetrics(ctx, period, limit)
}

// GetRevenueChart returns revenue data for charts
func (s *DashboardService) GetRevenueChart(ctx context.Context, period Period) ([]DailyRevenue, error) {
	return s.repo.GetDailyRevenue(ctx, period)
}

// GetInventory returns inventory analytics
func (s *DashboardService) GetInventory(ctx context.Context) (*InventoryMetrics, error) {
	return s.repo.GetInventoryMetrics(ctx)
}

// ComparePeriods compares two periods
func (s *DashboardService) ComparePeriods(ctx context.Context, current, previous Period) (*SalesComparison, error) {
	currentMetrics, err := s.repo.GetDashboardMetrics(ctx, current)
	if err != nil {
		return nil, err
	}

	previousMetrics, err := s.repo.GetDashboardMetrics(ctx, previous)
	if err != nil {
		return nil, err
	}

	comparison := &SalesComparison{
		CurrentPeriod:  current,
		PreviousPeriod: previous,
	}

	if previousMetrics.TotalRevenue > 0 {
		comparison.RevenueChange = (currentMetrics.TotalRevenue - previousMetrics.TotalRevenue) / previousMetrics.TotalRevenue * 100
	}
	if previousMetrics.TotalOrders > 0 {
		comparison.OrdersChange = float64(currentMetrics.TotalOrders-previousMetrics.TotalOrders) / float64(previousMetrics.TotalOrders) * 100
	}
	if previousMetrics.TotalCustomers > 0 {
		comparison.CustomersChange = float64(currentMetrics.TotalCustomers-previousMetrics.TotalCustomers) / float64(previousMetrics.TotalCustomers) * 100
	}
	if previousMetrics.AverageOrderValue > 0 {
		comparison.AOVChange = (currentMetrics.AverageOrderValue - previousMetrics.AverageOrderValue) / previousMetrics.AverageOrderValue * 100
	}

	return comparison, nil
}

// Period helper functions
func Today() Period {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return Period{From: start, To: now}
}

func Yesterday() Period {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day()-1, 0, 0, 0, 0, now.Location())
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return Period{From: start, To: end}
}

func ThisWeek() Period {
	now := time.Now()
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	start := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, now.Location())
	return Period{From: start, To: now}
}

func ThisMonth() Period {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	return Period{From: start, To: now}
}

func LastMonth() Period {
	now := time.Now()
	start := time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, now.Location())
	end := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	return Period{From: start, To: end}
}

func ThisYear() Period {
	now := time.Now()
	start := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	return Period{From: start, To: now}
}

func Last30Days() Period {
	now := time.Now()
	start := now.AddDate(0, 0, -30)
	return Period{From: start, To: now}
}

func Last90Days() Period {
	now := time.Now()
	start := now.AddDate(0, 0, -90)
	return Period{From: start, To: now}
}

func Last365Days() Period {
	now := time.Now()
	start := now.AddDate(-1, 0, 0)
	return Period{From: start, To: now}
}
