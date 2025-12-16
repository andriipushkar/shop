package sync

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"analytics-etl/internal/config"

	_ "github.com/ClickHouse/clickhouse-go/v2"
	_ "github.com/lib/pq"
	"github.com/rs/zerolog/log"
)

// Manager handles data synchronization between PostgreSQL and ClickHouse
type Manager struct {
	cfg      *config.Config
	pgDB     *sql.DB
	chDB     *sql.DB
	syncers  []Syncer
	wg       sync.WaitGroup
	stopChan chan struct{}
}

// Syncer interface for different sync types
type Syncer interface {
	Name() string
	Sync(ctx context.Context, lastSync time.Time) (int64, error)
	GetLastSyncTime(ctx context.Context) (time.Time, error)
}

// NewManager creates a new sync manager
func NewManager(cfg *config.Config) (*Manager, error) {
	// Connect to PostgreSQL
	pgDB, err := sql.Open("postgres", cfg.PostgresURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	pgDB.SetMaxOpenConns(10)
	pgDB.SetMaxIdleConns(5)
	pgDB.SetConnMaxLifetime(time.Hour)

	if err := pgDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	// Connect to ClickHouse
	chDB, err := sql.Open("clickhouse", cfg.ClickHouseDSN())
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse: %w", err)
	}

	chDB.SetMaxOpenConns(10)
	chDB.SetMaxIdleConns(5)
	chDB.SetConnMaxLifetime(time.Hour)

	if err := chDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping ClickHouse: %w", err)
	}

	m := &Manager{
		cfg:      cfg,
		pgDB:     pgDB,
		chDB:     chDB,
		syncers:  make([]Syncer, 0),
		stopChan: make(chan struct{}),
	}

	// Initialize ClickHouse schema
	if err := m.initSchema(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to init schema: %w", err)
	}

	// Register syncers based on config
	if cfg.SyncOrders {
		m.syncers = append(m.syncers, NewOrderSyncer(pgDB, chDB, cfg.BatchSize))
	}
	if cfg.SyncEvents {
		m.syncers = append(m.syncers, NewEventSyncer(pgDB, chDB, cfg.BatchSize))
	}
	if cfg.SyncProducts {
		m.syncers = append(m.syncers, NewProductSyncer(pgDB, chDB, cfg.BatchSize))
	}

	return m, nil
}

// initSchema creates the necessary ClickHouse tables
func (m *Manager) initSchema(ctx context.Context) error {
	schemas := []string{
		// Sync state table
		`CREATE TABLE IF NOT EXISTS _sync_state (
			syncer_name String,
			last_sync DateTime64(3),
			records_synced UInt64,
			updated_at DateTime DEFAULT now()
		) ENGINE = ReplacingMergeTree(updated_at)
		ORDER BY syncer_name`,

		// Orders analytics table
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
			cancelled_at Nullable(DateTime),
			_synced_at DateTime DEFAULT now()
		) ENGINE = ReplacingMergeTree(_synced_at)
		PARTITION BY toYYYYMM(created_at)
		ORDER BY (tenant_id, created_at, order_id)`,

		// Order items analytics table
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
			created_at DateTime,
			_synced_at DateTime DEFAULT now()
		) ENGINE = ReplacingMergeTree(_synced_at)
		PARTITION BY toYYYYMM(created_at)
		ORDER BY (tenant_id, created_at, order_id, product_id)`,

		// Events table
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
			properties String,
			created_at DateTime DEFAULT now()
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(event_time)
		ORDER BY (tenant_id, event_time, event_type)
		TTL event_time + INTERVAL 2 YEAR`,

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

		// Product performance aggregation
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

		// Customer cohorts
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

		// Search queries analytics
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
	}

	for _, schema := range schemas {
		if _, err := m.chDB.ExecContext(ctx, schema); err != nil {
			return fmt.Errorf("failed to create schema: %w", err)
		}
	}

	log.Info().Msg("ClickHouse schema initialized")
	return nil
}

// Start starts the sync process
func (m *Manager) Start(ctx context.Context) error {
	log.Info().Int("syncers", len(m.syncers)).Msg("Starting sync workers")

	ticker := time.NewTicker(m.cfg.SyncInterval)
	defer ticker.Stop()

	// Initial sync
	m.runSync(ctx)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-m.stopChan:
			return nil
		case <-ticker.C:
			m.runSync(ctx)
		}
	}
}

// runSync runs all syncers
func (m *Manager) runSync(ctx context.Context) {
	log.Info().Msg("Starting sync cycle")
	start := time.Now()

	var totalRecords int64
	for _, syncer := range m.syncers {
		lastSync, err := syncer.GetLastSyncTime(ctx)
		if err != nil {
			log.Error().Err(err).Str("syncer", syncer.Name()).Msg("Failed to get last sync time")
			continue
		}

		count, err := syncer.Sync(ctx, lastSync)
		if err != nil {
			log.Error().Err(err).Str("syncer", syncer.Name()).Msg("Sync failed")
			continue
		}

		totalRecords += count
		log.Info().
			Str("syncer", syncer.Name()).
			Int64("records", count).
			Time("last_sync", lastSync).
			Msg("Sync completed")

		// Update sync state
		m.updateSyncState(ctx, syncer.Name(), count)
	}

	log.Info().
		Int64("total_records", totalRecords).
		Dur("duration", time.Since(start)).
		Msg("Sync cycle completed")
}

// updateSyncState updates the sync state in ClickHouse
func (m *Manager) updateSyncState(ctx context.Context, syncerName string, count int64) {
	_, err := m.chDB.ExecContext(ctx,
		`INSERT INTO _sync_state (syncer_name, last_sync, records_synced) VALUES (?, ?, ?)`,
		syncerName, time.Now(), count)
	if err != nil {
		log.Error().Err(err).Str("syncer", syncerName).Msg("Failed to update sync state")
	}
}

// Shutdown gracefully shuts down the manager
func (m *Manager) Shutdown(ctx context.Context) error {
	close(m.stopChan)
	m.wg.Wait()
	return nil
}

// Close closes all connections
func (m *Manager) Close() {
	if m.pgDB != nil {
		m.pgDB.Close()
	}
	if m.chDB != nil {
		m.chDB.Close()
	}
}
