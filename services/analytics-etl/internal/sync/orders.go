package sync

import (
	"context"
	"database/sql"
	"time"

	"github.com/rs/zerolog/log"
)

// OrderSyncer syncs orders from PostgreSQL to ClickHouse
type OrderSyncer struct {
	pgDB      *sql.DB
	chDB      *sql.DB
	batchSize int
}

// NewOrderSyncer creates a new order syncer
func NewOrderSyncer(pgDB, chDB *sql.DB, batchSize int) *OrderSyncer {
	return &OrderSyncer{
		pgDB:      pgDB,
		chDB:      chDB,
		batchSize: batchSize,
	}
}

// Name returns the syncer name
func (s *OrderSyncer) Name() string {
	return "orders"
}

// GetLastSyncTime returns the last sync time
func (s *OrderSyncer) GetLastSyncTime(ctx context.Context) (time.Time, error) {
	var lastSync time.Time
	err := s.chDB.QueryRowContext(ctx,
		`SELECT max(last_sync) FROM _sync_state FINAL WHERE syncer_name = ?`, s.Name()).Scan(&lastSync)
	if err != nil && err != sql.ErrNoRows {
		return time.Time{}, err
	}
	if lastSync.IsZero() {
		// If no previous sync, start from 30 days ago
		lastSync = time.Now().AddDate(0, 0, -30)
	}
	return lastSync, nil
}

// Sync syncs orders from PostgreSQL to ClickHouse
func (s *OrderSyncer) Sync(ctx context.Context, lastSync time.Time) (int64, error) {
	// Query orders from PostgreSQL
	query := `
		SELECT
			o.id::text,
			o.order_number,
			o.tenant_id::text,
			COALESCE(o.customer_id::text, ''),
			o.status,
			COALESCE(o.payment_method, ''),
			COALESCE(o.shipping_method, ''),
			COALESCE(o.subtotal, 0),
			COALESCE(o.discount, 0),
			COALESCE(o.shipping_cost, 0),
			COALESCE(o.tax, 0),
			COALESCE(o.total, 0),
			COALESCE(o.currency, 'UAH'),
			COALESCE(o.items_count, 0),
			COALESCE(o.promo_code, ''),
			COALESCE(o.utm_source, ''),
			COALESCE(o.utm_medium, ''),
			COALESCE(o.utm_campaign, ''),
			o.created_at,
			o.paid_at,
			o.shipped_at,
			o.delivered_at,
			o.cancelled_at
		FROM orders o
		WHERE o.updated_at > $1
		ORDER BY o.updated_at
		LIMIT $2
	`

	rows, err := s.pgDB.QueryContext(ctx, query, lastSync, s.batchSize)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	// Prepare batch insert
	tx, err := s.chDB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO orders_analytics (
			order_id, order_number, tenant_id, customer_id, status,
			payment_method, shipping_method, subtotal, discount, shipping_cost,
			tax, total, currency, items_count, promo_code,
			utm_source, utm_medium, utm_campaign, created_at,
			paid_at, shipped_at, delivered_at, cancelled_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var count int64
	for rows.Next() {
		var (
			orderID, orderNumber, tenantID, customerID    string
			status, paymentMethod, shippingMethod         string
			subtotal, discount, shippingCost, tax, total  float64
			currency, promoCode                           string
			utmSource, utmMedium, utmCampaign             string
			itemsCount                                    int
			createdAt                                     time.Time
			paidAt, shippedAt, deliveredAt, cancelledAt   sql.NullTime
		)

		err := rows.Scan(
			&orderID, &orderNumber, &tenantID, &customerID,
			&status, &paymentMethod, &shippingMethod,
			&subtotal, &discount, &shippingCost, &tax, &total,
			&currency, &itemsCount, &promoCode,
			&utmSource, &utmMedium, &utmCampaign,
			&createdAt, &paidAt, &shippedAt, &deliveredAt, &cancelledAt,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan order row")
			continue
		}

		_, err = stmt.ExecContext(ctx,
			orderID, orderNumber, tenantID, customerID,
			status, paymentMethod, shippingMethod,
			subtotal, discount, shippingCost, tax, total,
			currency, itemsCount, promoCode,
			utmSource, utmMedium, utmCampaign,
			createdAt,
			nullTimeToPtr(paidAt),
			nullTimeToPtr(shippedAt),
			nullTimeToPtr(deliveredAt),
			nullTimeToPtr(cancelledAt),
		)
		if err != nil {
			log.Error().Err(err).Str("order_id", orderID).Msg("Failed to insert order")
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

	// Sync order items
	itemsCount, err := s.syncOrderItems(ctx, lastSync)
	if err != nil {
		log.Error().Err(err).Msg("Failed to sync order items")
	} else {
		log.Info().Int64("items_synced", itemsCount).Msg("Order items synced")
	}

	return count, nil
}

// syncOrderItems syncs order items
func (s *OrderSyncer) syncOrderItems(ctx context.Context, lastSync time.Time) (int64, error) {
	query := `
		SELECT
			oi.order_id::text,
			o.tenant_id::text,
			oi.product_id::text,
			COALESCE(oi.product_name, ''),
			COALESCE(oi.sku, ''),
			COALESCE(oi.category_id::text, ''),
			COALESCE(oi.category_name, ''),
			oi.quantity,
			oi.price,
			oi.quantity * oi.price as total,
			o.created_at
		FROM order_items oi
		JOIN orders o ON oi.order_id = o.id
		WHERE o.updated_at > $1
		LIMIT $2
	`

	rows, err := s.pgDB.QueryContext(ctx, query, lastSync, s.batchSize*10)
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
		INSERT INTO order_items_analytics (
			order_id, tenant_id, product_id, product_name, sku,
			category_id, category_name, quantity, price, total, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var count int64
	for rows.Next() {
		var (
			orderID, tenantID, productID, productName, sku string
			categoryID, categoryName                       string
			quantity                                       int
			price, total                                   float64
			createdAt                                      time.Time
		)

		err := rows.Scan(
			&orderID, &tenantID, &productID, &productName, &sku,
			&categoryID, &categoryName, &quantity, &price, &total, &createdAt,
		)
		if err != nil {
			continue
		}

		_, err = stmt.ExecContext(ctx,
			orderID, tenantID, productID, productName, sku,
			categoryID, categoryName, quantity, price, total, createdAt,
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

func nullTimeToPtr(nt sql.NullTime) *time.Time {
	if nt.Valid {
		return &nt.Time
	}
	return nil
}
