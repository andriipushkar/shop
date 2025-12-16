package sync

import (
	"context"
	"database/sql"
	"time"

	"github.com/rs/zerolog/log"
)

// EventSyncer syncs events from PostgreSQL to ClickHouse
type EventSyncer struct {
	pgDB      *sql.DB
	chDB      *sql.DB
	batchSize int
}

// NewEventSyncer creates a new event syncer
func NewEventSyncer(pgDB, chDB *sql.DB, batchSize int) *EventSyncer {
	return &EventSyncer{
		pgDB:      pgDB,
		chDB:      chDB,
		batchSize: batchSize,
	}
}

// Name returns the syncer name
func (s *EventSyncer) Name() string {
	return "events"
}

// GetLastSyncTime returns the last sync time
func (s *EventSyncer) GetLastSyncTime(ctx context.Context) (time.Time, error) {
	var lastSync time.Time
	err := s.chDB.QueryRowContext(ctx,
		`SELECT max(last_sync) FROM _sync_state FINAL WHERE syncer_name = ?`, s.Name()).Scan(&lastSync)
	if err != nil && err != sql.ErrNoRows {
		return time.Time{}, err
	}
	if lastSync.IsZero() {
		lastSync = time.Now().AddDate(0, 0, -7) // Start from 7 days ago
	}
	return lastSync, nil
}

// Sync syncs events from PostgreSQL to ClickHouse
func (s *EventSyncer) Sync(ctx context.Context, lastSync time.Time) (int64, error) {
	query := `
		SELECT
			e.id::text,
			e.event_type,
			e.event_time,
			e.tenant_id::text,
			COALESCE(e.user_id::text, ''),
			COALESCE(e.session_id, ''),
			COALESCE(e.device_type, ''),
			COALESCE(e.browser, ''),
			COALESCE(e.os, ''),
			COALESCE(e.country, ''),
			COALESCE(e.city, ''),
			COALESCE(e.page_url, ''),
			COALESCE(e.referrer, ''),
			COALESCE(e.properties::text, '{}')
		FROM events e
		WHERE e.event_time > $1
		ORDER BY e.event_time
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
		INSERT INTO events (
			event_id, event_type, event_time, tenant_id, user_id,
			session_id, device_type, browser, os, country,
			city, page_url, referrer, properties
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var count int64
	for rows.Next() {
		var (
			eventID, eventType, tenantID, userID, sessionID string
			deviceType, browser, os, country, city          string
			pageURL, referrer, properties                   string
			eventTime                                       time.Time
		)

		err := rows.Scan(
			&eventID, &eventType, &eventTime, &tenantID, &userID,
			&sessionID, &deviceType, &browser, &os, &country,
			&city, &pageURL, &referrer, &properties,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan event row")
			continue
		}

		_, err = stmt.ExecContext(ctx,
			eventID, eventType, eventTime, tenantID, userID,
			sessionID, deviceType, browser, os, country,
			city, pageURL, referrer, properties,
		)
		if err != nil {
			log.Error().Err(err).Str("event_id", eventID).Msg("Failed to insert event")
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

	// Sync product views
	viewsCount, err := s.syncProductViews(ctx, lastSync)
	if err != nil {
		log.Error().Err(err).Msg("Failed to sync product views")
	} else {
		log.Info().Int64("views_synced", viewsCount).Msg("Product views synced")
	}

	return count, nil
}

// syncProductViews syncs product view events
func (s *EventSyncer) syncProductViews(ctx context.Context, lastSync time.Time) (int64, error) {
	query := `
		SELECT
			e.id::text,
			e.tenant_id::text,
			COALESCE(e.properties->>'product_id', ''),
			COALESCE(e.user_id::text, ''),
			COALESCE(e.session_id, ''),
			e.event_time,
			COALESCE(e.properties->>'source', 'direct'),
			COALESCE(e.device_type, '')
		FROM events e
		WHERE e.event_type = 'product_view'
		  AND e.event_time > $1
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
		INSERT INTO product_views (
			view_id, tenant_id, product_id, user_id, session_id,
			viewed_at, source, device_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var count int64
	for rows.Next() {
		var (
			viewID, tenantID, productID, userID, sessionID string
			source, deviceType                             string
			viewedAt                                       time.Time
		)

		err := rows.Scan(
			&viewID, &tenantID, &productID, &userID, &sessionID,
			&viewedAt, &source, &deviceType,
		)
		if err != nil {
			continue
		}

		if productID == "" {
			continue
		}

		_, err = stmt.ExecContext(ctx,
			viewID, tenantID, productID, userID, sessionID,
			viewedAt, source, deviceType,
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
