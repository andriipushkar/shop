# Migration Guide

Керівництво з міграції та оновлення платформи.

## Database Migrations

### Інструмент

Використовуємо [golang-migrate](https://github.com/golang-migrate/migrate).

### Структура міграцій

```
migrations/
├── 000001_initial_schema.up.sql
├── 000001_initial_schema.down.sql
├── 000002_add_products.up.sql
├── 000002_add_products.down.sql
├── 000003_add_orders.up.sql
└── 000003_add_orders.down.sql
```

### Створення міграції

```bash
# Через make
make migration name=add_product_variants

# Або напряму
migrate create -ext sql -dir migrations -seq add_product_variants
```

### Запуск міграцій

```bash
# Всі міграції
make migrate-up

# Або напряму
migrate -path migrations -database "postgres://user:pass@localhost:5432/shopdb?sslmode=disable" up

# Конкретна кількість
migrate ... up 2

# Відкат
migrate ... down 1

# Примусовий reset версії (обережно!)
migrate ... force 5
```

### Приклади міграцій

#### Додавання таблиці

```sql
-- 000010_add_product_variants.up.sql
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    compare_at_price DECIMAL(12,2),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    weight DECIMAL(10,3),
    attributes JSONB DEFAULT '{}',
    images TEXT[],
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_attributes ON product_variants USING GIN(attributes);

-- 000010_add_product_variants.down.sql
DROP TABLE IF EXISTS product_variants;
```

#### Додавання колонки

```sql
-- 000011_add_product_seo.up.sql
ALTER TABLE products
ADD COLUMN meta_title VARCHAR(255),
ADD COLUMN meta_description TEXT,
ADD COLUMN slug VARCHAR(255);

CREATE UNIQUE INDEX idx_products_slug ON products(tenant_id, slug);

-- 000011_add_product_seo.down.sql
DROP INDEX IF EXISTS idx_products_slug;

ALTER TABLE products
DROP COLUMN IF EXISTS meta_title,
DROP COLUMN IF EXISTS meta_description,
DROP COLUMN IF EXISTS slug;
```

#### Зміна типу колонки

```sql
-- 000012_change_price_precision.up.sql
ALTER TABLE products
ALTER COLUMN price TYPE DECIMAL(14,2),
ALTER COLUMN sale_price TYPE DECIMAL(14,2);

ALTER TABLE order_items
ALTER COLUMN price TYPE DECIMAL(14,2),
ALTER COLUMN total TYPE DECIMAL(14,2);

-- 000012_change_price_precision.down.sql
ALTER TABLE products
ALTER COLUMN price TYPE DECIMAL(12,2),
ALTER COLUMN sale_price TYPE DECIMAL(12,2);

ALTER TABLE order_items
ALTER COLUMN price TYPE DECIMAL(12,2),
ALTER COLUMN total TYPE DECIMAL(12,2);
```

#### Data migration

```sql
-- 000013_migrate_legacy_status.up.sql

-- Спочатку додаємо нову колонку
ALTER TABLE orders ADD COLUMN status_new VARCHAR(50);

-- Міграція даних
UPDATE orders SET status_new = CASE status
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'confirmed'
    WHEN 2 THEN 'processing'
    WHEN 3 THEN 'shipped'
    WHEN 4 THEN 'delivered'
    WHEN 5 THEN 'cancelled'
    ELSE 'unknown'
END;

-- Видаляємо стару колонку
ALTER TABLE orders DROP COLUMN status;

-- Перейменовуємо нову
ALTER TABLE orders RENAME COLUMN status_new TO status;

-- Додаємо constraint
ALTER TABLE orders ADD CONSTRAINT check_order_status
CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

-- 000013_migrate_legacy_status.down.sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_order_status;

ALTER TABLE orders ADD COLUMN status_old INTEGER;

UPDATE orders SET status_old = CASE status
    WHEN 'pending' THEN 0
    WHEN 'confirmed' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'shipped' THEN 3
    WHEN 'delivered' THEN 4
    WHEN 'cancelled' THEN 5
    ELSE 0
END;

ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders RENAME COLUMN status_old TO status;
```

### Zero-Downtime Migrations

#### Безпечні операції

```sql
-- Додавання nullable колонки
ALTER TABLE products ADD COLUMN new_field VARCHAR(255);

-- Додавання колонки з default
ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Створення індексу CONCURRENTLY
CREATE INDEX CONCURRENTLY idx_products_new ON products(new_field);

-- Видалення індексу CONCURRENTLY
DROP INDEX CONCURRENTLY idx_products_old;
```

#### Небезпечні операції (потребують планування)

```sql
-- НЕ РОБІТЬ: блокує таблицю
ALTER TABLE products ADD COLUMN field VARCHAR(255) NOT NULL DEFAULT 'value';

-- НАТОМІСТЬ: в декілька кроків
-- 1. Додайте nullable колонку
ALTER TABLE products ADD COLUMN field VARCHAR(255);

-- 2. Заповніть дані (можливо batch)
UPDATE products SET field = 'value' WHERE field IS NULL;

-- 3. Додайте NOT NULL (після заповнення)
ALTER TABLE products ALTER COLUMN field SET NOT NULL;

-- 4. Додайте default
ALTER TABLE products ALTER COLUMN field SET DEFAULT 'value';
```

#### Expand/Contract Pattern

```
Phase 1: Expand (нова версія коду читає обидва)
   - Додати нову колонку/таблицю
   - Код пише в обидва місця
   - Код читає зі старого, fallback на нове

Phase 2: Migrate
   - Data migration script
   - Перевірка консистентності

Phase 3: Contract (нова версія коду використовує тільки нове)
   - Код читає/пише тільки нове
   - Видалення старої колонки/таблиці
```

## Version Upgrades

### v1.x to v2.0

#### Breaking Changes

1. **API Response Format**

```diff
// Before (v1.x)
- { "product": { ... } }

// After (v2.0)
+ { "data": { ... }, "meta": { ... } }
```

**Міграція:**
```javascript
// Wrapper для зворотної сумісності
function transformResponse(response) {
  if (response.product) {
    return { data: response.product };
  }
  return response;
}
```

2. **Authentication**

```diff
// Before: Basic Auth header
- Authorization: Basic base64(user:pass)

// After: Bearer token
+ Authorization: Bearer <jwt_token>
```

**Міграція:**
1. Отримати JWT token через `/auth/login`
2. Замінити Basic Auth на Bearer token
3. Реалізувати refresh token flow

3. **Webhook Payload**

```diff
{
-  "order_id": "123",
+  "id": "evt_123",
+  "type": "order.created",
+  "data": {
+    "order_id": "123"
+  }
}
```

**Міграція:**
```javascript
// Wrapper для обробки обох форматів
function handleWebhook(payload) {
  if (payload.data) {
    // v2 format
    return processV2Webhook(payload);
  }
  // v1 format (legacy)
  return processV1Webhook(payload);
}
```

#### Migration Steps

```bash
# 1. Backup
pg_dump -Fc shopdb > backup_v1.dump

# 2. Update dependencies
go get -u ./...
npm update

# 3. Run migrations
migrate -path migrations -database "$DATABASE_URL" up

# 4. Update configuration
cp .env .env.backup
# Edit .env with new required variables

# 5. Deploy with blue-green
kubectl apply -f k8s/v2/

# 6. Verify
curl https://api.yourstore.com/health
curl https://api.yourstore.com/api/v2/products

# 7. Cleanup
kubectl delete -f k8s/v1/
```

### v2.x to v3.0

#### Зміни в структурі даних

```sql
-- Міграція customers
ALTER TABLE customers
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Переносимо legacy fields
UPDATE customers SET metadata = jsonb_build_object(
    'legacy_id', legacy_customer_id,
    'imported_at', imported_at,
    'source', 'v2_migration'
);

ALTER TABLE customers
DROP COLUMN legacy_customer_id,
DROP COLUMN imported_at;
```

## Infrastructure Migration

### Docker to Kubernetes

#### Етапи міграції

1. **Containerization Review**
```bash
# Перевірка Docker images
docker images | grep shop-platform

# Build для K8s
docker build -t ghcr.io/org/core:v3.0 ./services/core
docker push ghcr.io/org/core:v3.0
```

2. **Create K8s manifests**
```yaml
# k8s/deployments/core.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: core-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: core
  template:
    metadata:
      labels:
        app: core
    spec:
      containers:
      - name: core
        image: ghcr.io/org/core:v3.0
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: core-config
        - secretRef:
            name: core-secrets
```

3. **Database Migration**
```bash
# Export from Docker PostgreSQL
docker compose exec postgres pg_dump -Fc shopdb > export.dump

# Import to Cloud SQL / RDS
pg_restore -d $CLOUD_DATABASE_URL export.dump
```

4. **DNS Cutover**
```bash
# Update DNS records
# Old: docker-host.yourstore.com -> A 1.2.3.4
# New: docker-host.yourstore.com -> CNAME k8s-ingress.yourstore.com
```

### Cloud Provider Migration

#### AWS to GCP

1. **Database (RDS to Cloud SQL)**
```bash
# Export from RDS
pg_dump -h rds-endpoint.amazonaws.com -U admin -Fc shopdb > dump.sql

# Import to Cloud SQL
gcloud sql import sql shop-instance gs://bucket/dump.sql --database=shopdb
```

2. **Storage (S3 to GCS)**
```bash
# Using gsutil
gsutil -m rsync -r s3://shop-bucket gs://shop-bucket

# Або rclone
rclone sync aws-s3:shop-bucket gcs:shop-bucket
```

3. **Update Application Config**
```bash
# Before (AWS)
AWS_S3_BUCKET=shop-bucket
AWS_S3_REGION=eu-central-1

# After (GCP)
GCS_BUCKET=shop-bucket
GCS_PROJECT_ID=your-project
```

## Data Migration

### Import from Legacy System

```go
// cmd/migrate-legacy/main.go
package main

import (
    "encoding/csv"
    "log"
    "os"
)

func main() {
    // 1. Read legacy CSV
    file, _ := os.Open("legacy_products.csv")
    reader := csv.NewReader(file)
    records, _ := reader.ReadAll()

    // 2. Transform and validate
    var products []Product
    for i, record := range records[1:] { // Skip header
        product, err := transformLegacyProduct(record)
        if err != nil {
            log.Printf("Row %d: %v", i+2, err)
            continue
        }
        products = append(products, product)
    }

    // 3. Batch insert
    for batch := range chunk(products, 1000) {
        if err := db.Create(&batch).Error; err != nil {
            log.Printf("Batch insert failed: %v", err)
        }
    }

    log.Printf("Migrated %d products", len(products))
}

func transformLegacyProduct(record []string) (Product, error) {
    return Product{
        SKU:         record[0],
        Name:        record[1],
        Description: record[2],
        Price:       parsePrice(record[3]),
        Stock:       parseInt(record[4]),
        // Map legacy category to new ID
        CategoryID:  mapCategory(record[5]),
    }, nil
}
```

### Export for Analytics

```sql
-- Daily export for data warehouse
COPY (
    SELECT
        o.id,
        o.order_number,
        o.customer_id,
        c.email as customer_email,
        o.total,
        o.status,
        o.created_at,
        array_agg(oi.product_id) as product_ids
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.created_at >= CURRENT_DATE - INTERVAL '1 day'
    GROUP BY o.id, c.email
)
TO '/tmp/orders_export.csv'
WITH CSV HEADER;
```

## Rollback Procedures

### Database Rollback

```bash
# Відкат однієї міграції
migrate -path migrations -database "$DATABASE_URL" down 1

# Відкат до конкретної версії
migrate -path migrations -database "$DATABASE_URL" goto 10

# Повний rollback (обережно!)
migrate -path migrations -database "$DATABASE_URL" down

# Відновлення з backup
pg_restore -d shopdb backup.dump
```

### Application Rollback

```bash
# Kubernetes - відкат deployment
kubectl rollout undo deployment/core-service -n shop

# До конкретної revision
kubectl rollout undo deployment/core-service --to-revision=3 -n shop

# Docker Compose
docker compose pull  # Pull previous images
docker compose up -d
```

### Feature Flag Rollback

```go
// Швидкий rollback через feature flags
if !featureFlags.IsEnabled("new_checkout_flow") {
    return legacyCheckout(ctx, order)
}
return newCheckout(ctx, order)

// Вимкнення через API
curl -X POST http://localhost:8080/admin/features/new_checkout_flow/disable
```

## Checklist

### Pre-Migration

- [ ] Backup всіх баз даних
- [ ] Backup конфігурації
- [ ] Повідомити команду
- [ ] Maintenance window запланований
- [ ] Rollback plan готовий
- [ ] Monitoring налаштований

### During Migration

- [ ] Включити maintenance mode
- [ ] Запустити міграції
- [ ] Перевірити логи
- [ ] Запустити smoke tests
- [ ] Перевірити метрики

### Post-Migration

- [ ] Вимкнути maintenance mode
- [ ] Моніторинг протягом години
- [ ] Перевірка критичних flows
- [ ] Оновити документацію
- [ ] Повідомити команду про завершення
