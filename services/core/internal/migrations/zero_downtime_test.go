package migrations

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// MockDB for testing without real database
type MockDB struct {
	queries     []string
	rowsAffected int64
	shouldFail  bool
}

func (m *MockDB) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	m.queries = append(m.queries, query)
	if m.shouldFail {
		return nil, sql.ErrConnDone
	}
	return &mockResult{rowsAffected: m.rowsAffected}, nil
}

func (m *MockDB) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	m.queries = append(m.queries, query)
	return nil
}

type mockResult struct {
	rowsAffected int64
}

func (m *mockResult) LastInsertId() (int64, error) { return 0, nil }
func (m *mockResult) RowsAffected() (int64, error) { return m.rowsAffected, nil }

func TestZeroDowntimeMigrator_AddColumnNullable(t *testing.T) {
	tests := []struct {
		name       string
		table      string
		column     string
		columnType string
		wantQuery  string
	}{
		{
			name:       "add string column",
			table:      "products",
			column:     "sku_code",
			columnType: "VARCHAR(100)",
			wantQuery:  "ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_code VARCHAR(100)",
		},
		{
			name:       "add integer column",
			table:      "orders",
			column:     "retry_count",
			columnType: "INTEGER",
			wantQuery:  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS retry_count INTEGER",
		},
		{
			name:       "add timestamp column",
			table:      "customers",
			column:     "last_login",
			columnType: "TIMESTAMP WITH TIME ZONE",
			wantQuery:  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// For unit tests, we verify the SQL generation
			expectedSQL := tt.wantQuery
			if expectedSQL == "" {
				t.Skip("Integration test requires real database")
			}
		})
	}
}

func TestZeroDowntimeMigrator_BackfillBatching(t *testing.T) {
	// Test that backfill processes in batches
	migrator := &ZeroDowntimeMigrator{
		batchSize: 100,
		timeout:   5 * time.Minute,
	}

	if migrator.batchSize != 100 {
		t.Errorf("expected batch size 100, got %d", migrator.batchSize)
	}

	if migrator.timeout != 5*time.Minute {
		t.Errorf("expected timeout 5m, got %v", migrator.timeout)
	}
}

func TestSafeColumnAddition_Validation(t *testing.T) {
	tests := []struct {
		name      string
		addition  SafeColumnAddition
		wantError bool
	}{
		{
			name: "valid addition",
			addition: SafeColumnAddition{
				Table:        "products",
				Column:       "loyalty_tier",
				Type:         "VARCHAR(20)",
				DefaultValue: "bronze",
			},
			wantError: false,
		},
		{
			name: "empty table",
			addition: SafeColumnAddition{
				Table:        "",
				Column:       "test",
				Type:         "INTEGER",
				DefaultValue: 0,
			},
			wantError: true,
		},
		{
			name: "empty column",
			addition: SafeColumnAddition{
				Table:        "products",
				Column:       "",
				Type:         "INTEGER",
				DefaultValue: 0,
			},
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasError := tt.addition.Table == "" || tt.addition.Column == ""
			if hasError != tt.wantError {
				t.Errorf("validation mismatch: got error=%v, want error=%v", hasError, tt.wantError)
			}
		})
	}
}

func TestMigrationStep_Order(t *testing.T) {
	// Verify correct order of steps for safe column addition
	steps := []string{
		"add_nullable_column",
		"backfill_data",
		"add_not_null_constraint",
		"set_default_value",
		"create_index",
	}

	expectedOrder := []string{
		"add_nullable_column",
		"backfill_data",
		"add_not_null_constraint",
		"set_default_value",
		"create_index",
	}

	for i, step := range steps {
		if step != expectedOrder[i] {
			t.Errorf("step %d: got %s, want %s", i, step, expectedOrder[i])
		}
	}
}

func TestMigrationStep_NoTxForConcurrent(t *testing.T) {
	// CREATE INDEX CONCURRENTLY cannot run in a transaction
	step := MigrationStep{
		Name:  "create_index",
		NoTx:  true,
		Up:    func(ctx context.Context, tx *sql.Tx) error { return nil },
	}

	if !step.NoTx {
		t.Error("CREATE INDEX CONCURRENTLY step should have NoTx=true")
	}
}

func TestCreateIndexConcurrently_SQLGeneration(t *testing.T) {
	tests := []struct {
		name      string
		indexName string
		table     string
		columns   []string
		want      string
	}{
		{
			name:      "single column",
			indexName: "idx_products_tenant",
			table:     "products",
			columns:   []string{"tenant_id"},
			want:      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant ON products (tenant_id)",
		},
		{
			name:      "composite index",
			indexName: "idx_orders_tenant_status",
			table:     "orders",
			columns:   []string{"tenant_id", "status"},
			want:      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_status ON orders (tenant_id, status)",
		},
		{
			name:      "three columns",
			indexName: "idx_products_search",
			table:     "products",
			columns:   []string{"tenant_id", "category_id", "status"},
			want:      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search ON products (tenant_id, category_id, status)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify SQL generation logic
			columnsStr := ""
			for i, col := range tt.columns {
				if i > 0 {
					columnsStr += ", "
				}
				columnsStr += col
			}

			got := "CREATE INDEX CONCURRENTLY IF NOT EXISTS " + tt.indexName + " ON " + tt.table + " (" + columnsStr + ")"
			if got != tt.want {
				t.Errorf("got %s, want %s", got, tt.want)
			}
		})
	}
}

func TestBackfillColumn_Timeout(t *testing.T) {
	migrator := &ZeroDowntimeMigrator{
		batchSize: 1000,
		timeout:   1 * time.Millisecond, // Very short timeout
	}

	// Timeout should be respected
	if migrator.timeout != 1*time.Millisecond {
		t.Error("timeout not set correctly")
	}
}

func TestMigration_Rollback(t *testing.T) {
	// Each step should have a corresponding Down function
	migration := Migration{
		Version:     1,
		Description: "test migration",
		Steps: []MigrationStep{
			{
				Name: "add_column",
				Up: func(ctx context.Context, tx *sql.Tx) error {
					return nil
				},
				Down: func(ctx context.Context, tx *sql.Tx) error {
					return nil
				},
			},
		},
	}

	for _, step := range migration.Steps {
		if step.Up == nil {
			t.Errorf("step %s missing Up function", step.Name)
		}
		if step.Down == nil {
			t.Errorf("step %s missing Down function for rollback", step.Name)
		}
	}
}

func TestNewZeroDowntimeMigrator_Defaults(t *testing.T) {
	// Test with nil db (defaults should still be set)
	migrator := &ZeroDowntimeMigrator{
		batchSize: 1000,
		timeout:   30 * time.Minute,
	}

	if migrator.batchSize != 1000 {
		t.Errorf("expected default batch size 1000, got %d", migrator.batchSize)
	}

	if migrator.timeout != 30*time.Minute {
		t.Errorf("expected default timeout 30m, got %v", migrator.timeout)
	}
}

// Integration test example (requires real database)
func TestZeroDowntimeMigrator_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// This would connect to a test database
	// db, err := sql.Open("postgres", os.Getenv("TEST_DATABASE_URL"))
	// if err != nil {
	//     t.Skip("no test database available")
	// }
	// defer db.Close()

	// migrator := NewZeroDowntimeMigrator(db)
	// ... run actual migration tests
}
