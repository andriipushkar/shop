package sync

import (
	"context"
	"database/sql"
	"time"

	"github.com/rs/zerolog/log"
)

// ProductSyncer syncs product performance data
type ProductSyncer struct {
	pgDB      *sql.DB
	chDB      *sql.DB
	batchSize int
}

// NewProductSyncer creates a new product syncer
func NewProductSyncer(pgDB, chDB *sql.DB, batchSize int) *ProductSyncer {
	return &ProductSyncer{
		pgDB:      pgDB,
		chDB:      chDB,
		batchSize: batchSize,
	}
}

// Name returns the syncer name
func (s *ProductSyncer) Name() string {
	return "products"
}

// GetLastSyncTime returns the last sync time
func (s *ProductSyncer) GetLastSyncTime(ctx context.Context) (time.Time, error) {
	var lastSync time.Time
	err := s.chDB.QueryRowContext(ctx,
		`SELECT max(last_sync) FROM _sync_state FINAL WHERE syncer_name = ?`, s.Name()).Scan(&lastSync)
	if err != nil && err != sql.ErrNoRows {
		return time.Time{}, err
	}
	if lastSync.IsZero() {
		lastSync = time.Now().AddDate(0, 0, -30)
	}
	return lastSync, nil
}

// Sync syncs product performance aggregations
func (s *ProductSyncer) Sync(ctx context.Context, lastSync time.Time) (int64, error) {
	// Aggregate daily product performance
	query := `
		WITH product_stats AS (
			SELECT
				o.tenant_id::text,
				DATE(o.created_at) as date,
				oi.product_id::text,
				COUNT(DISTINCT CASE WHEN e.event_type = 'product_view' THEN e.session_id END) as views,
				COUNT(DISTINCT CASE WHEN e.event_type = 'add_to_cart' THEN e.session_id END) as add_to_cart,
				COUNT(DISTINCT o.id) as purchases,
				SUM(oi.price * oi.quantity) as revenue,
				SUM(oi.quantity) as quantity_sold
			FROM orders o
			JOIN order_items oi ON o.id = oi.order_id
			LEFT JOIN events e ON e.tenant_id = o.tenant_id
				AND e.properties->>'product_id' = oi.product_id::text
				AND DATE(e.event_time) = DATE(o.created_at)
			WHERE o.created_at > $1
			  AND o.status NOT IN ('cancelled', 'refunded')
			GROUP BY o.tenant_id, DATE(o.created_at), oi.product_id
		)
		SELECT * FROM product_stats
		LIMIT $2
	`

	rows, err := s.pgDB.QueryContext(ctx, query, lastSync, s.batchSize)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	tx, err := s.chDB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO product_performance (
			tenant_id, date, product_id, views, add_to_cart,
			purchases, revenue, quantity_sold
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var count int64
	for rows.Next() {
		var (
			tenantID, productID      string
			date                     time.Time
			views, addToCart         int64
			purchases, quantitySold  int64
			revenue                  float64
		)

		err := rows.Scan(
			&tenantID, &date, &productID,
			&views, &addToCart, &purchases, &revenue, &quantitySold,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan product stats row")
			continue
		}

		_, err = stmt.ExecContext(ctx,
			tenantID, date, productID,
			views, addToCart, purchases, revenue, quantitySold,
		)
		if err != nil {
			log.Error().Err(err).Str("product_id", productID).Msg("Failed to insert product performance")
			continue
		}
		count++
	}

	if err := rows.Err(); err != nil {
		return count, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	// Sync daily sales aggregations
	salesCount, err := s.syncDailySales(ctx, lastSync)
	if err != nil {
		log.Error().Err(err).Msg("Failed to sync daily sales")
	} else {
		log.Info().Int64("sales_synced", salesCount).Msg("Daily sales synced")
	}

	// Sync customer cohorts
	cohortsCount, err := s.syncCustomerCohorts(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to sync customer cohorts")
	} else {
		log.Info().Int64("cohorts_synced", cohortsCount).Msg("Customer cohorts synced")
	}

	return count, nil
}

// syncDailySales syncs daily sales aggregations
func (s *ProductSyncer) syncDailySales(ctx context.Context, lastSync time.Time) (int64, error) {
	query := `
		SELECT
			tenant_id::text,
			DATE(created_at) as date,
			COUNT(*) as orders_count,
			SUM(items_count) as items_count,
			SUM(total) as revenue,
			AVG(total) as avg_order_value,
			COUNT(DISTINCT customer_id) as unique_customers,
			COUNT(DISTINCT CASE
				WHEN (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = orders.customer_id AND o2.created_at < orders.created_at) = 0
				THEN customer_id
			END) as new_customers,
			COUNT(DISTINCT CASE
				WHEN (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = orders.customer_id AND o2.created_at < orders.created_at) > 0
				THEN customer_id
			END) as returning_customers,
			COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
			COALESCE(SUM(total) FILTER (WHERE status = 'refunded'), 0) as refunded_amount
		FROM orders
		WHERE created_at > $1
		  AND status NOT IN ('draft', 'pending_payment')
		GROUP BY tenant_id, DATE(created_at)
		ORDER BY date
		LIMIT $2
	`

	rows, err := s.pgDB.QueryContext(ctx, query, lastSync, s.batchSize)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	tx, err := s.chDB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO sales_daily (
			tenant_id, date, orders_count, items_count, revenue,
			avg_order_value, unique_customers, new_customers, returning_customers,
			cancelled_orders, refunded_amount
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var count int64
	for rows.Next() {
		var (
			tenantID                                     string
			date                                         time.Time
			ordersCount, itemsCount                      int64
			revenue, avgOrderValue                       float64
			uniqueCustomers, newCustomers, returning     int64
			cancelledOrders                              int64
			refundedAmount                               float64
		)

		err := rows.Scan(
			&tenantID, &date, &ordersCount, &itemsCount, &revenue,
			&avgOrderValue, &uniqueCustomers, &newCustomers, &returning,
			&cancelledOrders, &refundedAmount,
		)
		if err != nil {
			continue
		}

		_, err = stmt.ExecContext(ctx,
			tenantID, date, ordersCount, itemsCount, revenue,
			avgOrderValue, uniqueCustomers, newCustomers, returning,
			cancelledOrders, refundedAmount,
		)
		if err != nil {
			continue
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return count, nil
}

// syncCustomerCohorts syncs customer cohort data
func (s *ProductSyncer) syncCustomerCohorts(ctx context.Context) (int64, error) {
	query := `
		SELECT
			tenant_id::text,
			DATE_TRUNC('month', first_order_date)::date as cohort_month,
			customer_id::text,
			first_order_date,
			total_orders,
			total_spent,
			last_order_date
		FROM (
			SELECT
				tenant_id,
				customer_id,
				MIN(created_at)::date as first_order_date,
				COUNT(*) as total_orders,
				SUM(total) as total_spent,
				MAX(created_at)::date as last_order_date
			FROM orders
			WHERE customer_id IS NOT NULL
			  AND status NOT IN ('cancelled', 'refunded')
			GROUP BY tenant_id, customer_id
		) customer_stats
		WHERE last_order_date > NOW() - INTERVAL '7 days'
		LIMIT $1
	`

	rows, err := s.pgDB.QueryContext(ctx, query, s.batchSize)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	tx, err := s.chDB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO customer_cohorts (
			tenant_id, cohort_month, customer_id, first_order_date,
			total_orders, total_spent, last_order_date
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var count int64
	for rows.Next() {
		var (
			tenantID, customerID        string
			cohortMonth, firstOrderDate time.Time
			lastOrderDate               time.Time
			totalOrders                 int
			totalSpent                  float64
		)

		err := rows.Scan(
			&tenantID, &cohortMonth, &customerID, &firstOrderDate,
			&totalOrders, &totalSpent, &lastOrderDate,
		)
		if err != nil {
			continue
		}

		_, err = stmt.ExecContext(ctx,
			tenantID, cohortMonth, customerID, firstOrderDate,
			totalOrders, totalSpent, lastOrderDate,
		)
		if err != nil {
			continue
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return count, nil
}
