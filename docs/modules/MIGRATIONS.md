# Database Migrations

Стратегія та інструменти для міграцій бази даних.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MIGRATION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Migration    │────▶│ Migration    │────▶│ PostgreSQL   │                │
│  │ Files        │     │ Runner       │     │ Database     │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                              │                                              │
│                              ▼                                              │
│                       ┌──────────────┐                                      │
│                       │ Version      │                                      │
│                       │ Tracking     │                                      │
│                       │ (schema_     │                                      │
│                       │  migrations) │                                      │
│                       └──────────────┘                                      │
│                                                                              │
│  Tools:                                                                     │
│  ├── golang-migrate (Go services)                                          │
│  ├── Prisma Migrate (Next.js services)                                     │
│  └── Custom runner for zero-downtime                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Migration Tools

### Go Services (golang-migrate)

```bash
# Install
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create migration
migrate create -ext sql -dir migrations -seq add_orders_table

# Run migrations
migrate -path migrations -database "postgres://user:pass@localhost/shop?sslmode=disable" up

# Rollback
migrate -path migrations -database "postgres://user:pass@localhost/shop?sslmode=disable" down 1

# Force version (fix dirty state)
migrate -path migrations -database "postgres://..." force 20240115
```

### Next.js Services (Prisma)

```bash
# Create migration
npx prisma migrate dev --name add_user_preferences

# Apply migrations (production)
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Generate client
npx prisma generate
```

## Migration File Structure

### Go Services

```
services/core/
├── migrations/
│   ├── 000001_init_schema.up.sql
│   ├── 000001_init_schema.down.sql
│   ├── 000002_add_orders.up.sql
│   ├── 000002_add_orders.down.sql
│   ├── 000003_add_index.up.sql
│   └── 000003_add_index.down.sql
```

### Prisma Services

```
services/storefront/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 20240115100000_init/
│       │   └── migration.sql
│       ├── 20240116100000_add_preferences/
│       │   └── migration.sql
│       └── migration_lock.toml
```

## Zero-Downtime Migrations

### Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ZERO-DOWNTIME MIGRATION PHASES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Expand                                                            │
│  ├── Add new columns (nullable)                                             │
│  ├── Add new tables                                                         │
│  └── Add new indexes (CONCURRENTLY)                                         │
│                                                                              │
│  Phase 2: Migrate Data                                                      │
│  ├── Backfill new columns                                                   │
│  ├── Copy data to new tables                                                │
│  └── Run in batches to avoid locks                                          │
│                                                                              │
│  Phase 3: Code Deploy                                                       │
│  ├── Deploy code that uses both old and new schema                          │
│  ├── Write to both locations                                                │
│  └── Read from new location                                                 │
│                                                                              │
│  Phase 4: Contract                                                          │
│  ├── Remove old columns                                                     │
│  ├── Add NOT NULL constraints                                               │
│  └── Drop old tables/indexes                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example: Rename Column

```sql
-- Phase 1: Add new column
-- 000010_expand_rename_name.up.sql
ALTER TABLE products ADD COLUMN title VARCHAR(500);

-- Phase 2: Backfill data
-- 000011_backfill_title.up.sql
UPDATE products SET title = name WHERE title IS NULL;

-- Create trigger for dual-write
CREATE OR REPLACE FUNCTION sync_product_title()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        NEW.title := COALESCE(NEW.title, NEW.name);
        NEW.name := COALESCE(NEW.name, NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_title_sync
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION sync_product_title();

-- Phase 3: Deploy code reading from 'title'
-- (no SQL migration needed)

-- Phase 4: Contract
-- 000012_contract_remove_name.up.sql
DROP TRIGGER product_title_sync ON products;
DROP FUNCTION sync_product_title();
ALTER TABLE products DROP COLUMN name;
ALTER TABLE products ALTER COLUMN title SET NOT NULL;
```

### Example: Add Non-Nullable Column

```sql
-- Phase 1: Add nullable column with default
-- 000020_add_status.up.sql
ALTER TABLE orders ADD COLUMN status VARCHAR(50) DEFAULT 'pending';

-- Phase 2: Backfill (for existing rows)
-- 000021_backfill_status.up.sql
UPDATE orders SET status = 'completed'
WHERE status IS NULL AND paid_at IS NOT NULL;

UPDATE orders SET status = 'pending'
WHERE status IS NULL;

-- Phase 3: Add NOT NULL constraint
-- 000022_status_not_null.up.sql
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
```

## Concurrent Index Creation

```sql
-- Always use CONCURRENTLY for indexes in production
-- 000030_add_index.up.sql

-- This will NOT lock the table
CREATE INDEX CONCURRENTLY idx_orders_customer
ON orders (customer_id)
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_orders_created
ON orders (created_at DESC);

-- Note: CONCURRENTLY cannot be used in transaction
-- Run each CREATE INDEX in separate migration
```

## Migration Runner

### Go Implementation

```go
// pkg/migrate/runner.go
package migrate

import (
    "database/sql"
    "embed"
    "fmt"

    "github.com/golang-migrate/migrate/v4"
    "github.com/golang-migrate/migrate/v4/database/postgres"
    "github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Runner struct {
    db *sql.DB
    m  *migrate.Migrate
}

func NewRunner(db *sql.DB, dbName string) (*Runner, error) {
    // Source from embedded files
    source, err := iofs.New(migrationsFS, "migrations")
    if err != nil {
        return nil, fmt.Errorf("create source: %w", err)
    }

    // Database driver
    driver, err := postgres.WithInstance(db, &postgres.Config{})
    if err != nil {
        return nil, fmt.Errorf("create driver: %w", err)
    }

    // Create migrate instance
    m, err := migrate.NewWithInstance("iofs", source, dbName, driver)
    if err != nil {
        return nil, fmt.Errorf("create migrate: %w", err)
    }

    return &Runner{db: db, m: m}, nil
}

// Up runs all pending migrations
func (r *Runner) Up() error {
    if err := r.m.Up(); err != nil && err != migrate.ErrNoChange {
        return fmt.Errorf("run migrations: %w", err)
    }
    return nil
}

// Down rolls back n migrations
func (r *Runner) Down(n int) error {
    if err := r.m.Steps(-n); err != nil {
        return fmt.Errorf("rollback migrations: %w", err)
    }
    return nil
}

// Version returns current version
func (r *Runner) Version() (uint, bool, error) {
    return r.m.Version()
}

// Close closes the runner
func (r *Runner) Close() error {
    sourceErr, dbErr := r.m.Close()
    if sourceErr != nil {
        return sourceErr
    }
    return dbErr
}
```

### Auto-Run on Startup

```go
// cmd/core/main.go
func main() {
    // Connect to database
    db, err := sql.Open("postgres", cfg.DatabaseURL)
    if err != nil {
        log.Fatal().Err(err).Msg("connect to database")
    }

    // Run migrations
    runner, err := migrate.NewRunner(db, "shop")
    if err != nil {
        log.Fatal().Err(err).Msg("create migration runner")
    }
    defer runner.Close()

    log.Info().Msg("Running database migrations...")
    if err := runner.Up(); err != nil {
        log.Fatal().Err(err).Msg("run migrations")
    }

    version, dirty, _ := runner.Version()
    log.Info().
        Uint("version", version).
        Bool("dirty", dirty).
        Msg("Migrations completed")

    // Start server...
}
```

## Prisma Schema Example

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  orders    Order[]

  @@map("users")
}

model Order {
  id        String   @id @default(uuid())
  number    String   @unique
  status    String   @default("pending")
  total     Decimal  @db.Decimal(12, 2)
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id])
  items     OrderItem[]

  @@index([userId])
  @@index([status])
  @@map("orders")
}
```

## Data Migrations

### Batch Processing

```go
// pkg/migrate/data.go
package migrate

import (
    "context"
    "database/sql"
    "time"
)

// BatchMigrate processes data in batches
func BatchMigrate(ctx context.Context, db *sql.DB, query string, batchSize int) error {
    var totalProcessed int64

    for {
        result, err := db.ExecContext(ctx, query+" LIMIT $1", batchSize)
        if err != nil {
            return err
        }

        affected, _ := result.RowsAffected()
        if affected == 0 {
            break
        }

        totalProcessed += affected
        log.Info().
            Int64("batch", affected).
            Int64("total", totalProcessed).
            Msg("Migration batch completed")

        // Small delay to reduce load
        time.Sleep(100 * time.Millisecond)
    }

    return nil
}

// Example usage
func MigrateOrderStatuses(ctx context.Context, db *sql.DB) error {
    query := `
        UPDATE orders
        SET status = 'completed'
        WHERE id IN (
            SELECT id FROM orders
            WHERE status IS NULL AND paid_at IS NOT NULL
            LIMIT 1000
        )
    `
    return BatchMigrate(ctx, db, query, 1000)
}
```

## Kubernetes Job

```yaml
# k8s/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: shop/core:latest
          command: ["./migrate", "up"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
      backoffLimit: 3
```

## Best Practices

### Do's
1. Always write both up and down migrations
2. Use CONCURRENTLY for indexes
3. Test migrations on staging first
4. Keep migrations small and focused
5. Use transactions where possible
6. Backup before major migrations

### Don'ts
1. Don't modify existing migrations
2. Don't drop columns without deprecation period
3. Don't run long-running queries in migrations
4. Don't ignore dirty state
5. Don't skip version numbers

## Rollback Strategy

```sql
-- Always have a rollback plan
-- 000030_add_feature.down.sql

-- Reverse the changes
DROP INDEX IF EXISTS idx_feature;
ALTER TABLE products DROP COLUMN IF EXISTS feature;

-- Restore old data if needed
-- (Keep backup tables for 7 days)
```

## See Also

- [Database Diagrams](../architecture/DATABASE_DIAGRAMS.md)
- [Backup & Restore](../operations/BACKUP_RESTORE.md)
- [Zero-Downtime Deployment](../deployment/KUBERNETES.md)
