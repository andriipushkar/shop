package clickhouse

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/ClickHouse/clickhouse-go/v2"
)

// Config holds ClickHouse connection configuration
type Config struct {
	Host     string
	Port     int
	Database string
	Username string
	Password string
	Debug    bool
}

// DefaultConfig returns default ClickHouse configuration
func DefaultConfig() *Config {
	return &Config{
		Host:     "localhost",
		Port:     9000,
		Database: "shop_analytics",
		Username: "default",
		Password: "",
		Debug:    false,
	}
}

// Client is the ClickHouse client for analytics
type Client struct {
	db     *sql.DB
	config *Config
}

// New creates a new ClickHouse client
func New(cfg *Config) (*Client, error) {
	dsn := fmt.Sprintf("clickhouse://%s:%s@%s:%d/%s?dial_timeout=10s&max_execution_time=60",
		cfg.Username, cfg.Password, cfg.Host, cfg.Port, cfg.Database)

	db, err := sql.Open("clickhouse", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	// Verify connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping ClickHouse: %w", err)
	}

	return &Client{db: db, config: cfg}, nil
}

// Close closes the ClickHouse connection
func (c *Client) Close() error {
	return c.db.Close()
}

// InitSchema creates the analytics tables
func (c *Client) InitSchema(ctx context.Context) error {
	schemas := []string{
		// Events table - main analytics events
		`CREATE TABLE IF NOT EXISTS events (
			event_id UUID,
			event_type String,
			event_time DateTime64(3),
			tenant_id String,
			user_id String,
			session_id String,
			device_type String,
			browser String,
			os String,
			country String,
			city String,
			page_url String,
			referrer String,
			properties String, -- JSON
			created_at DateTime DEFAULT now()
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(event_time)
		ORDER BY (tenant_id, event_time, event_type)
		TTL event_time + INTERVAL 2 YEAR`,

		// Orders table - denormalized order data
		`CREATE TABLE IF NOT EXISTS orders_analytics (
			order_id String,
			order_number String,
			tenant_id String,
			customer_id String,
			status String,
			payment_method String,
			shipping_method String,
			subtotal Decimal64(2),
			discount Decimal64(2),
			shipping_cost Decimal64(2),
			tax Decimal64(2),
			total Decimal64(2),
			currency String,
			items_count UInt32,
			promo_code String,
			utm_source String,
			utm_medium String,
			utm_campaign String,
			created_at DateTime,
			paid_at Nullable(DateTime),
			shipped_at Nullable(DateTime),
			delivered_at Nullable(DateTime),
			cancelled_at Nullable(DateTime)
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(created_at)
		ORDER BY (tenant_id, created_at, order_id)`,

		// Order items table
		`CREATE TABLE IF NOT EXISTS order_items_analytics (
			order_id String,
			tenant_id String,
			product_id String,
			product_name String,
			sku String,
			category_id String,
			category_name String,
			quantity UInt32,
			price Decimal64(2),
			total Decimal64(2),
			created_at DateTime
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(created_at)
		ORDER BY (tenant_id, created_at, order_id)`,

		// Product views table
		`CREATE TABLE IF NOT EXISTS product_views (
			view_id UUID,
			tenant_id String,
			product_id String,
			user_id String,
			session_id String,
			viewed_at DateTime64(3),
			source String,
			device_type String
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(viewed_at)
		ORDER BY (tenant_id, viewed_at, product_id)
		TTL viewed_at + INTERVAL 1 YEAR`,

		// Search queries table
		`CREATE TABLE IF NOT EXISTS search_queries (
			query_id UUID,
			tenant_id String,
			user_id String,
			session_id String,
			query String,
			results_count UInt32,
			clicked_product_id String,
			clicked_position UInt32,
			searched_at DateTime64(3)
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(searched_at)
		ORDER BY (tenant_id, searched_at, query)
		TTL searched_at + INTERVAL 1 YEAR`,

		// Hourly sales aggregation (materialized view)
		`CREATE TABLE IF NOT EXISTS sales_hourly (
			tenant_id String,
			hour DateTime,
			orders_count UInt64,
			items_count UInt64,
			revenue Decimal64(2),
			avg_order_value Decimal64(2),
			unique_customers UInt64
		) ENGINE = SummingMergeTree()
		PARTITION BY toYYYYMM(hour)
		ORDER BY (tenant_id, hour)`,

		// Daily sales aggregation
		`CREATE TABLE IF NOT EXISTS sales_daily (
			tenant_id String,
			date Date,
			orders_count UInt64,
			items_count UInt64,
			revenue Decimal64(2),
			avg_order_value Decimal64(2),
			unique_customers UInt64,
			new_customers UInt64,
			returning_customers UInt64,
			cancelled_orders UInt64,
			refunded_amount Decimal64(2)
		) ENGINE = SummingMergeTree()
		PARTITION BY toYYYYMM(date)
		ORDER BY (tenant_id, date)`,

		// Product performance table
		`CREATE TABLE IF NOT EXISTS product_performance (
			tenant_id String,
			date Date,
			product_id String,
			views UInt64,
			add_to_cart UInt64,
			purchases UInt64,
			revenue Decimal64(2),
			quantity_sold UInt64
		) ENGINE = SummingMergeTree()
		PARTITION BY toYYYYMM(date)
		ORDER BY (tenant_id, date, product_id)`,

		// Customer cohorts table
		`CREATE TABLE IF NOT EXISTS customer_cohorts (
			tenant_id String,
			cohort_month Date,
			customer_id String,
			first_order_date Date,
			total_orders UInt32,
			total_spent Decimal64(2),
			last_order_date Date
		) ENGINE = ReplacingMergeTree(last_order_date)
		PARTITION BY toYYYYMM(cohort_month)
		ORDER BY (tenant_id, cohort_month, customer_id)`,
	}

	for _, schema := range schemas {
		if _, err := c.db.ExecContext(ctx, schema); err != nil {
			return fmt.Errorf("failed to create schema: %w", err)
		}
	}

	return nil
}

// Event represents an analytics event
type Event struct {
	EventID    string
	EventType  string
	EventTime  time.Time
	TenantID   string
	UserID     string
	SessionID  string
	DeviceType string
	Browser    string
	OS         string
	Country    string
	City       string
	PageURL    string
	Referrer   string
	Properties string // JSON
}

// InsertEvent inserts a single event
func (c *Client) InsertEvent(ctx context.Context, event *Event) error {
	query := `INSERT INTO events (
		event_id, event_type, event_time, tenant_id, user_id, session_id,
		device_type, browser, os, country, city, page_url, referrer, properties
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := c.db.ExecContext(ctx, query,
		event.EventID, event.EventType, event.EventTime, event.TenantID,
		event.UserID, event.SessionID, event.DeviceType, event.Browser,
		event.OS, event.Country, event.City, event.PageURL, event.Referrer,
		event.Properties,
	)
	return err
}

// InsertEvents inserts multiple events in batch
func (c *Client) InsertEvents(ctx context.Context, events []*Event) error {
	if len(events) == 0 {
		return nil
	}

	tx, err := c.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `INSERT INTO events (
		event_id, event_type, event_time, tenant_id, user_id, session_id,
		device_type, browser, os, country, city, page_url, referrer, properties
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, event := range events {
		_, err := stmt.ExecContext(ctx,
			event.EventID, event.EventType, event.EventTime, event.TenantID,
			event.UserID, event.SessionID, event.DeviceType, event.Browser,
			event.OS, event.Country, event.City, event.PageURL, event.Referrer,
			event.Properties,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// OrderAnalytics represents order data for analytics
type OrderAnalytics struct {
	OrderID        string
	OrderNumber    string
	TenantID       string
	CustomerID     string
	Status         string
	PaymentMethod  string
	ShippingMethod string
	Subtotal       float64
	Discount       float64
	ShippingCost   float64
	Tax            float64
	Total          float64
	Currency       string
	ItemsCount     int
	PromoCode      string
	UTMSource      string
	UTMMedium      string
	UTMCampaign    string
	CreatedAt      time.Time
	PaidAt         *time.Time
	ShippedAt      *time.Time
	DeliveredAt    *time.Time
	CancelledAt    *time.Time
}

// InsertOrder inserts an order for analytics
func (c *Client) InsertOrder(ctx context.Context, order *OrderAnalytics) error {
	query := `INSERT INTO orders_analytics (
		order_id, order_number, tenant_id, customer_id, status, payment_method,
		shipping_method, subtotal, discount, shipping_cost, tax, total, currency,
		items_count, promo_code, utm_source, utm_medium, utm_campaign,
		created_at, paid_at, shipped_at, delivered_at, cancelled_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := c.db.ExecContext(ctx, query,
		order.OrderID, order.OrderNumber, order.TenantID, order.CustomerID,
		order.Status, order.PaymentMethod, order.ShippingMethod,
		order.Subtotal, order.Discount, order.ShippingCost, order.Tax,
		order.Total, order.Currency, order.ItemsCount, order.PromoCode,
		order.UTMSource, order.UTMMedium, order.UTMCampaign,
		order.CreatedAt, order.PaidAt, order.ShippedAt, order.DeliveredAt,
		order.CancelledAt,
	)
	return err
}

// DB returns the underlying database connection for custom queries
func (c *Client) DB() *sql.DB {
	return c.db
}
