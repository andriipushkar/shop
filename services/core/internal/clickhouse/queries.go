package clickhouse

import (
	"context"
	"time"
)

// SalesMetrics represents sales metrics for a time period
type SalesMetrics struct {
	Period             string  `json:"period"`
	OrdersCount        int64   `json:"orders_count"`
	ItemsCount         int64   `json:"items_count"`
	Revenue            float64 `json:"revenue"`
	AvgOrderValue      float64 `json:"avg_order_value"`
	UniqueCustomers    int64   `json:"unique_customers"`
	NewCustomers       int64   `json:"new_customers"`
	ReturningCustomers int64   `json:"returning_customers"`
}

// GetSalesMetrics returns sales metrics for a tenant
func (c *Client) GetSalesMetrics(ctx context.Context, tenantID string, from, to time.Time) (*SalesMetrics, error) {
	query := `
		SELECT
			count(*) as orders_count,
			sum(items_count) as items_count,
			sum(total) as revenue,
			avg(total) as avg_order_value,
			uniqExact(customer_id) as unique_customers
		FROM orders_analytics
		WHERE tenant_id = ?
		  AND created_at >= ?
		  AND created_at < ?
		  AND status NOT IN ('cancelled', 'refunded')
	`

	var metrics SalesMetrics
	err := c.db.QueryRowContext(ctx, query, tenantID, from, to).Scan(
		&metrics.OrdersCount,
		&metrics.ItemsCount,
		&metrics.Revenue,
		&metrics.AvgOrderValue,
		&metrics.UniqueCustomers,
	)
	if err != nil {
		return nil, err
	}

	return &metrics, nil
}

// DailySales represents daily sales data
type DailySales struct {
	Date          time.Time `json:"date"`
	OrdersCount   int64     `json:"orders_count"`
	Revenue       float64   `json:"revenue"`
	AvgOrderValue float64   `json:"avg_order_value"`
}

// GetDailySales returns daily sales for a tenant
func (c *Client) GetDailySales(ctx context.Context, tenantID string, from, to time.Time) ([]DailySales, error) {
	query := `
		SELECT
			toDate(created_at) as date,
			count(*) as orders_count,
			sum(total) as revenue,
			avg(total) as avg_order_value
		FROM orders_analytics
		WHERE tenant_id = ?
		  AND created_at >= ?
		  AND created_at < ?
		  AND status NOT IN ('cancelled', 'refunded')
		GROUP BY date
		ORDER BY date
	`

	rows, err := c.db.QueryContext(ctx, query, tenantID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []DailySales
	for rows.Next() {
		var ds DailySales
		if err := rows.Scan(&ds.Date, &ds.OrdersCount, &ds.Revenue, &ds.AvgOrderValue); err != nil {
			return nil, err
		}
		result = append(result, ds)
	}

	return result, rows.Err()
}

// HourlySales represents hourly sales data
type HourlySales struct {
	Hour        time.Time `json:"hour"`
	OrdersCount int64     `json:"orders_count"`
	Revenue     float64   `json:"revenue"`
}

// GetHourlySales returns hourly sales for a tenant (last 24 hours)
func (c *Client) GetHourlySales(ctx context.Context, tenantID string) ([]HourlySales, error) {
	query := `
		SELECT
			toStartOfHour(created_at) as hour,
			count(*) as orders_count,
			sum(total) as revenue
		FROM orders_analytics
		WHERE tenant_id = ?
		  AND created_at >= now() - INTERVAL 24 HOUR
		  AND status NOT IN ('cancelled', 'refunded')
		GROUP BY hour
		ORDER BY hour
	`

	rows, err := c.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []HourlySales
	for rows.Next() {
		var hs HourlySales
		if err := rows.Scan(&hs.Hour, &hs.OrdersCount, &hs.Revenue); err != nil {
			return nil, err
		}
		result = append(result, hs)
	}

	return result, rows.Err()
}

// TopProduct represents top-selling product data
type TopProduct struct {
	ProductID    string  `json:"product_id"`
	ProductName  string  `json:"product_name"`
	QuantitySold int64   `json:"quantity_sold"`
	Revenue      float64 `json:"revenue"`
	OrdersCount  int64   `json:"orders_count"`
}

// GetTopProducts returns top-selling products for a tenant
func (c *Client) GetTopProducts(ctx context.Context, tenantID string, from, to time.Time, limit int) ([]TopProduct, error) {
	query := `
		SELECT
			product_id,
			product_name,
			sum(quantity) as quantity_sold,
			sum(total) as revenue,
			count(DISTINCT order_id) as orders_count
		FROM order_items_analytics
		WHERE tenant_id = ?
		  AND created_at >= ?
		  AND created_at < ?
		GROUP BY product_id, product_name
		ORDER BY revenue DESC
		LIMIT ?
	`

	rows, err := c.db.QueryContext(ctx, query, tenantID, from, to, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []TopProduct
	for rows.Next() {
		var tp TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.QuantitySold, &tp.Revenue, &tp.OrdersCount); err != nil {
			return nil, err
		}
		result = append(result, tp)
	}

	return result, rows.Err()
}

// TopCategory represents top-selling category data
type TopCategory struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	QuantitySold int64   `json:"quantity_sold"`
	Revenue      float64 `json:"revenue"`
	ProductCount int64   `json:"product_count"`
}

// GetTopCategories returns top-selling categories for a tenant
func (c *Client) GetTopCategories(ctx context.Context, tenantID string, from, to time.Time, limit int) ([]TopCategory, error) {
	query := `
		SELECT
			category_id,
			category_name,
			sum(quantity) as quantity_sold,
			sum(total) as revenue,
			uniqExact(product_id) as product_count
		FROM order_items_analytics
		WHERE tenant_id = ?
		  AND created_at >= ?
		  AND created_at < ?
		GROUP BY category_id, category_name
		ORDER BY revenue DESC
		LIMIT ?
	`

	rows, err := c.db.QueryContext(ctx, query, tenantID, from, to, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []TopCategory
	for rows.Next() {
		var tc TopCategory
		if err := rows.Scan(&tc.CategoryID, &tc.CategoryName, &tc.QuantitySold, &tc.Revenue, &tc.ProductCount); err != nil {
			return nil, err
		}
		result = append(result, tc)
	}

	return result, rows.Err()
}

// CohortData represents cohort analysis data
type CohortData struct {
	CohortMonth      time.Time `json:"cohort_month"`
	CustomersCount   int64     `json:"customers_count"`
	Month0Retention  float64   `json:"month_0_retention"`
	Month1Retention  float64   `json:"month_1_retention"`
	Month2Retention  float64   `json:"month_2_retention"`
	Month3Retention  float64   `json:"month_3_retention"`
	Month6Retention  float64   `json:"month_6_retention"`
	Month12Retention float64   `json:"month_12_retention"`
}

// GetCohortAnalysis returns cohort retention analysis
func (c *Client) GetCohortAnalysis(ctx context.Context, tenantID string, months int) ([]CohortData, error) {
	query := `
		WITH cohorts AS (
			SELECT
				customer_id,
				toStartOfMonth(min(created_at)) as cohort_month
			FROM orders_analytics
			WHERE tenant_id = ?
			GROUP BY customer_id
		),
		activity AS (
			SELECT
				customer_id,
				toStartOfMonth(created_at) as activity_month
			FROM orders_analytics
			WHERE tenant_id = ?
			GROUP BY customer_id, activity_month
		)
		SELECT
			c.cohort_month,
			count(DISTINCT c.customer_id) as customers_count,
			count(DISTINCT CASE WHEN dateDiff('month', c.cohort_month, a.activity_month) = 0 THEN c.customer_id END) * 100.0 / count(DISTINCT c.customer_id) as month_0,
			count(DISTINCT CASE WHEN dateDiff('month', c.cohort_month, a.activity_month) = 1 THEN c.customer_id END) * 100.0 / count(DISTINCT c.customer_id) as month_1,
			count(DISTINCT CASE WHEN dateDiff('month', c.cohort_month, a.activity_month) = 2 THEN c.customer_id END) * 100.0 / count(DISTINCT c.customer_id) as month_2,
			count(DISTINCT CASE WHEN dateDiff('month', c.cohort_month, a.activity_month) = 3 THEN c.customer_id END) * 100.0 / count(DISTINCT c.customer_id) as month_3,
			count(DISTINCT CASE WHEN dateDiff('month', c.cohort_month, a.activity_month) = 6 THEN c.customer_id END) * 100.0 / count(DISTINCT c.customer_id) as month_6,
			count(DISTINCT CASE WHEN dateDiff('month', c.cohort_month, a.activity_month) = 12 THEN c.customer_id END) * 100.0 / count(DISTINCT c.customer_id) as month_12
		FROM cohorts c
		LEFT JOIN activity a ON c.customer_id = a.customer_id
		WHERE c.cohort_month >= now() - INTERVAL ? MONTH
		GROUP BY c.cohort_month
		ORDER BY c.cohort_month
	`

	rows, err := c.db.QueryContext(ctx, query, tenantID, tenantID, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CohortData
	for rows.Next() {
		var cd CohortData
		if err := rows.Scan(
			&cd.CohortMonth, &cd.CustomersCount,
			&cd.Month0Retention, &cd.Month1Retention, &cd.Month2Retention,
			&cd.Month3Retention, &cd.Month6Retention, &cd.Month12Retention,
		); err != nil {
			return nil, err
		}
		result = append(result, cd)
	}

	return result, rows.Err()
}

// FunnelStep represents a funnel conversion step
type FunnelStep struct {
	Step       string  `json:"step"`
	Count      int64   `json:"count"`
	Conversion float64 `json:"conversion"`
}

// GetConversionFunnel returns conversion funnel data
func (c *Client) GetConversionFunnel(ctx context.Context, tenantID string, from, to time.Time) ([]FunnelStep, error) {
	query := `
		SELECT
			event_type,
			uniqExact(session_id) as sessions
		FROM events
		WHERE tenant_id = ?
		  AND event_time >= ?
		  AND event_time < ?
		  AND event_type IN ('page_view', 'product_view', 'add_to_cart', 'begin_checkout', 'purchase')
		GROUP BY event_type
	`

	rows, err := c.db.QueryContext(ctx, query, tenantID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int64)
	for rows.Next() {
		var eventType string
		var count int64
		if err := rows.Scan(&eventType, &count); err != nil {
			return nil, err
		}
		counts[eventType] = count
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Build funnel with conversion rates
	steps := []string{"page_view", "product_view", "add_to_cart", "begin_checkout", "purchase"}
	var result []FunnelStep
	var prevCount int64 = 0

	for i, step := range steps {
		count := counts[step]
		conversion := float64(100)
		if i > 0 && prevCount > 0 {
			conversion = float64(count) * 100 / float64(prevCount)
		}
		result = append(result, FunnelStep{
			Step:       step,
			Count:      count,
			Conversion: conversion,
		})
		prevCount = count
	}

	return result, nil
}

// RealTimeMetrics represents real-time dashboard metrics
type RealTimeMetrics struct {
	ActiveVisitors    int64   `json:"active_visitors"`
	OrdersLast5Min    int64   `json:"orders_last_5_min"`
	OrdersLastHour    int64   `json:"orders_last_hour"`
	RevenueLast5Min   float64 `json:"revenue_last_5_min"`
	RevenueLastHour   float64 `json:"revenue_last_hour"`
	CartAbandonsLast5 int64   `json:"cart_abandons_last_5_min"`
}

// GetRealTimeMetrics returns real-time metrics for a tenant
func (c *Client) GetRealTimeMetrics(ctx context.Context, tenantID string) (*RealTimeMetrics, error) {
	var metrics RealTimeMetrics

	// Active visitors (sessions in last 5 minutes)
	err := c.db.QueryRowContext(ctx, `
		SELECT uniqExact(session_id)
		FROM events
		WHERE tenant_id = ? AND event_time >= now() - INTERVAL 5 MINUTE
	`, tenantID).Scan(&metrics.ActiveVisitors)
	if err != nil {
		return nil, err
	}

	// Orders and revenue last 5 minutes
	err = c.db.QueryRowContext(ctx, `
		SELECT count(*), sum(total)
		FROM orders_analytics
		WHERE tenant_id = ? AND created_at >= now() - INTERVAL 5 MINUTE
	`, tenantID).Scan(&metrics.OrdersLast5Min, &metrics.RevenueLast5Min)
	if err != nil {
		return nil, err
	}

	// Orders and revenue last hour
	err = c.db.QueryRowContext(ctx, `
		SELECT count(*), sum(total)
		FROM orders_analytics
		WHERE tenant_id = ? AND created_at >= now() - INTERVAL 1 HOUR
	`, tenantID).Scan(&metrics.OrdersLastHour, &metrics.RevenueLastHour)
	if err != nil {
		return nil, err
	}

	// Cart abandons last 5 minutes
	err = c.db.QueryRowContext(ctx, `
		SELECT count(*)
		FROM events
		WHERE tenant_id = ?
		  AND event_type = 'cart_abandoned'
		  AND event_time >= now() - INTERVAL 5 MINUTE
	`, tenantID).Scan(&metrics.CartAbandonsLast5)
	if err != nil {
		return nil, err
	}

	return &metrics, nil
}
