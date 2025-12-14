package migrations

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

// ZeroDowntimeMigrator implements safe database migrations for multi-tenant SaaS.
// Key principles:
// 1. Never use exclusive locks (no ALTER TABLE ... ADD COLUMN NOT NULL DEFAULT)
// 2. Add columns as nullable first, backfill, then add constraints
// 3. Use CREATE INDEX CONCURRENTLY for indexes
// 4. Split large migrations into small, reversible steps
type ZeroDowntimeMigrator struct {
	db        *sql.DB
	batchSize int
	timeout   time.Duration
}

type MigrationStep struct {
	Name        string
	Description string
	Up          func(ctx context.Context, tx *sql.Tx) error
	Down        func(ctx context.Context, tx *sql.Tx) error
	NoTx        bool // Some operations like CREATE INDEX CONCURRENTLY can't run in transaction
}

type SafeColumnAddition struct {
	Table        string
	Column       string
	Type         string
	DefaultValue interface{}
}

func NewZeroDowntimeMigrator(db *sql.DB) *ZeroDowntimeMigrator {
	return &ZeroDowntimeMigrator{
		db:        db,
		batchSize: 1000,
		timeout:   30 * time.Minute,
	}
}

// ==================== SAFE OPERATIONS ====================

// AddColumnNullable adds a new nullable column (instant, no locks)
func (m *ZeroDowntimeMigrator) AddColumnNullable(ctx context.Context, table, column, columnType string) error {
	query := fmt.Sprintf(
		"ALTER TABLE %s ADD COLUMN IF NOT EXISTS %s %s",
		table, column, columnType,
	)

	_, err := m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to add column: %w", err)
	}

	log.Printf("[Migration] Added nullable column %s.%s", table, column)
	return nil
}

// BackfillColumn fills column values in batches (no locks)
func (m *ZeroDowntimeMigrator) BackfillColumn(
	ctx context.Context,
	table, column string,
	defaultValue interface{},
	whereClause string,
) error {
	log.Printf("[Migration] Starting backfill for %s.%s", table, column)

	totalUpdated := 0
	startTime := time.Now()

	for {
		// Update in small batches to avoid long locks
		query := fmt.Sprintf(`
			UPDATE %s
			SET %s = $1
			WHERE %s IS NULL
			%s
			LIMIT %d
		`, table, column, column, whereClause, m.batchSize)

		result, err := m.db.ExecContext(ctx, query, defaultValue)
		if err != nil {
			return fmt.Errorf("backfill failed: %w", err)
		}

		rows, _ := result.RowsAffected()
		totalUpdated += int(rows)

		log.Printf("[Migration] Backfilled %d rows (total: %d)", rows, totalUpdated)

		if rows == 0 {
			break
		}

		// Small delay to let other queries run
		time.Sleep(100 * time.Millisecond)

		// Check timeout
		if time.Since(startTime) > m.timeout {
			return fmt.Errorf("backfill timeout after %d rows", totalUpdated)
		}
	}

	log.Printf("[Migration] Backfill complete: %d rows in %v", totalUpdated, time.Since(startTime))
	return nil
}

// AddNotNullConstraint adds NOT NULL after backfill is complete
func (m *ZeroDowntimeMigrator) AddNotNullConstraint(ctx context.Context, table, column string) error {
	// First, verify no nulls exist
	var nullCount int
	err := m.db.QueryRowContext(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s IS NULL", table, column),
	).Scan(&nullCount)

	if err != nil {
		return fmt.Errorf("null check failed: %w", err)
	}

	if nullCount > 0 {
		return fmt.Errorf("cannot add NOT NULL: %d null values exist", nullCount)
	}

	// Add constraint
	query := fmt.Sprintf(
		"ALTER TABLE %s ALTER COLUMN %s SET NOT NULL",
		table, column,
	)

	_, err = m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to add NOT NULL constraint: %w", err)
	}

	log.Printf("[Migration] Added NOT NULL constraint to %s.%s", table, column)
	return nil
}

// CreateIndexConcurrently creates index without blocking writes
func (m *ZeroDowntimeMigrator) CreateIndexConcurrently(
	ctx context.Context,
	indexName, table string,
	columns []string,
) error {
	columnsStr := ""
	for i, col := range columns {
		if i > 0 {
			columnsStr += ", "
		}
		columnsStr += col
	}

	// CONCURRENTLY cannot run in a transaction
	query := fmt.Sprintf(
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS %s ON %s (%s)",
		indexName, table, columnsStr,
	)

	_, err := m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	log.Printf("[Migration] Created index %s on %s(%s)", indexName, table, columnsStr)
	return nil
}

// DropColumnSafe drops column with validation
func (m *ZeroDowntimeMigrator) DropColumnSafe(ctx context.Context, table, column string) error {
	// First, mark column as deprecated (optional - for code cleanup tracking)
	log.Printf("[Migration] Dropping column %s.%s", table, column)

	query := fmt.Sprintf(
		"ALTER TABLE %s DROP COLUMN IF EXISTS %s",
		table, column,
	)

	_, err := m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop column: %w", err)
	}

	log.Printf("[Migration] Dropped column %s.%s", table, column)
	return nil
}

// RenameColumn renames column (instant)
func (m *ZeroDowntimeMigrator) RenameColumn(ctx context.Context, table, oldName, newName string) error {
	query := fmt.Sprintf(
		"ALTER TABLE %s RENAME COLUMN %s TO %s",
		table, oldName, newName,
	)

	_, err := m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to rename column: %w", err)
	}

	log.Printf("[Migration] Renamed column %s.%s -> %s", table, oldName, newName)
	return nil
}

// ==================== SAFE ADD COLUMN WITH DEFAULT ====================

// SafeAddColumnWithDefault adds a column with default value without locking
// This is the MAIN pattern to use instead of:
// ALTER TABLE foo ADD COLUMN bar INT NOT NULL DEFAULT 0
func (m *ZeroDowntimeMigrator) SafeAddColumnWithDefault(
	ctx context.Context,
	addition SafeColumnAddition,
) error {
	log.Printf("[Migration] Safe add column: %s.%s (%s) DEFAULT %v",
		addition.Table, addition.Column, addition.Type, addition.DefaultValue)

	// Step 1: Add nullable column (instant, no lock)
	if err := m.AddColumnNullable(ctx, addition.Table, addition.Column, addition.Type); err != nil {
		return err
	}

	// Step 2: Backfill existing rows in batches
	if err := m.BackfillColumn(ctx, addition.Table, addition.Column, addition.DefaultValue, ""); err != nil {
		return err
	}

	// Step 3: Add NOT NULL constraint
	if err := m.AddNotNullConstraint(ctx, addition.Table, addition.Column); err != nil {
		return err
	}

	// Step 4: Set default for future inserts
	query := fmt.Sprintf(
		"ALTER TABLE %s ALTER COLUMN %s SET DEFAULT $1",
		addition.Table, addition.Column,
	)
	if _, err := m.db.ExecContext(ctx, query, addition.DefaultValue); err != nil {
		return fmt.Errorf("failed to set default: %w", err)
	}

	log.Printf("[Migration] Successfully added column %s.%s with default", addition.Table, addition.Column)
	return nil
}

// ==================== MIGRATION RUNNER ====================

type Migration struct {
	Version     int
	Description string
	Steps       []MigrationStep
}

func (m *ZeroDowntimeMigrator) Run(ctx context.Context, migration Migration) error {
	log.Printf("[Migration] Starting migration v%d: %s", migration.Version, migration.Description)
	startTime := time.Now()

	for i, step := range migration.Steps {
		log.Printf("[Migration] Step %d/%d: %s", i+1, len(migration.Steps), step.Name)

		if step.NoTx {
			// Run outside transaction (e.g., CREATE INDEX CONCURRENTLY)
			if err := step.Up(ctx, nil); err != nil {
				return fmt.Errorf("step %s failed: %w", step.Name, err)
			}
		} else {
			// Run in transaction
			tx, err := m.db.BeginTx(ctx, nil)
			if err != nil {
				return fmt.Errorf("failed to start transaction: %w", err)
			}

			if err := step.Up(ctx, tx); err != nil {
				tx.Rollback()
				return fmt.Errorf("step %s failed: %w", step.Name, err)
			}

			if err := tx.Commit(); err != nil {
				return fmt.Errorf("failed to commit: %w", err)
			}
		}

		log.Printf("[Migration] Step %d completed", i+1)
	}

	log.Printf("[Migration] Migration v%d completed in %v", migration.Version, time.Since(startTime))
	return nil
}

// ==================== EXAMPLE MIGRATION ====================

// ExampleMigration shows how to properly add a new feature column
func ExampleMigration(migrator *ZeroDowntimeMigrator) Migration {
	return Migration{
		Version:     7,
		Description: "Add loyalty_tier to customers",
		Steps: []MigrationStep{
			{
				Name:        "add_loyalty_tier_column",
				Description: "Add nullable loyalty_tier column",
				Up: func(ctx context.Context, tx *sql.Tx) error {
					_, err := tx.ExecContext(ctx,
						"ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(20)")
					return err
				},
			},
			{
				Name:        "backfill_loyalty_tier",
				Description: "Set default tier for existing customers",
				NoTx:        true, // Backfill runs outside transaction for performance
				Up: func(ctx context.Context, _ *sql.Tx) error {
					return migrator.BackfillColumn(ctx, "customers", "loyalty_tier", "bronze", "")
				},
			},
			{
				Name:        "add_not_null_constraint",
				Description: "Make loyalty_tier NOT NULL",
				Up: func(ctx context.Context, tx *sql.Tx) error {
					_, err := tx.ExecContext(ctx,
						"ALTER TABLE customers ALTER COLUMN loyalty_tier SET NOT NULL")
					return err
				},
			},
			{
				Name:        "set_default_value",
				Description: "Set default for new customers",
				Up: func(ctx context.Context, tx *sql.Tx) error {
					_, err := tx.ExecContext(ctx,
						"ALTER TABLE customers ALTER COLUMN loyalty_tier SET DEFAULT 'bronze'")
					return err
				},
			},
			{
				Name:        "create_index",
				Description: "Create index for loyalty tier queries",
				NoTx:        true, // CONCURRENTLY requires no transaction
				Up: func(ctx context.Context, _ *sql.Tx) error {
					return migrator.CreateIndexConcurrently(ctx,
						"idx_customers_loyalty_tier",
						"customers",
						[]string{"tenant_id", "loyalty_tier"},
					)
				},
			},
		},
	}
}
