# Database Schema

Complete database schema documentation for the Shop Platform.

## Overview

The platform uses PostgreSQL 15 with the following databases:

| Database | Service | Description |
|----------|---------|-------------|
| shop_core | Core | Products, categories, inventory |
| shop_oms | OMS | Orders, payments, shipments |
| shop_crm | CRM | Customers, segments |

## Core Database Schema

### Products

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL,
    description TEXT,
    short_description VARCHAR(1000),
    price DECIMAL(12,2) NOT NULL,
    old_price DECIMAL(12,2),
    cost_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'UAH',
    category_id UUID REFERENCES categories(id),
    brand_id UUID REFERENCES brands(id),
    status VARCHAR(50) DEFAULT 'draft',
    visibility VARCHAR(50) DEFAULT 'visible',
    stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    weight DECIMAL(10,3),
    dimensions JSONB,
    images JSONB DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    meta_title VARCHAR(200),
    meta_description VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,

    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('simple', name || ' ' || COALESCE(description, '')));
```

### Categories

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    parent_id UUID REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    meta_title VARCHAR(200),
    meta_description VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
```

### Product Attributes (EAV)

```sql
CREATE TABLE attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL, -- text, number, boolean, select, multiselect
    options JSONB, -- For select/multiselect types
    unit VARCHAR(50),
    is_filterable BOOLEAN DEFAULT false,
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES attributes(id),
    value TEXT,
    value_numeric DECIMAL(15,4),
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(product_id, attribute_id)
);

CREATE INDEX idx_product_attributes_product ON product_attributes(product_id);
CREATE INDEX idx_product_attributes_attribute ON product_attributes(attribute_id);
```

### Inventory

```sql
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    available INTEGER GENERATED ALWAYS AS (quantity - reserved) STORED,
    bin_location VARCHAR(50),
    lot_number VARCHAR(100),
    expiry_date DATE,
    cost DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(product_id, warehouse_id, lot_number)
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
```

### Price History

```sql
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    old_price DECIMAL(12,2),
    new_price DECIMAL(12,2) NOT NULL,
    reason VARCHAR(200),
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_price_history_product ON price_history(product_id);
CREATE INDEX idx_price_history_date ON price_history(created_at);
```

## OMS Database Schema

### Orders

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    customer_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    source VARCHAR(50) DEFAULT 'website', -- website, rozetka, prom, telegram
    external_id VARCHAR(100), -- For marketplace orders

    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UAH',

    -- Promo
    promo_code VARCHAR(50),
    promo_discount DECIMAL(12,2),

    -- Customer info
    customer_email VARCHAR(200),
    customer_phone VARCHAR(20),
    customer_name VARCHAR(200),

    -- Addresses
    shipping_address JSONB,
    billing_address JSONB,

    -- Shipping
    shipping_method VARCHAR(100),
    shipping_carrier VARCHAR(50),
    tracking_number VARCHAR(100),
    estimated_delivery DATE,

    -- Payment
    payment_method VARCHAR(50),
    payment_id VARCHAR(100),

    notes TEXT,
    internal_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP,

    UNIQUE(tenant_id, order_number)
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_external ON orders(external_id);
```

### Order Items

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    attributes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

### Payments

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(50) NOT NULL, -- liqpay, mono, stripe
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UAH',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    transaction_id VARCHAR(200),
    provider_response JSONB,
    error_message TEXT,
    paid_at TIMESTAMP,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
```

### Promo Codes

```sql
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL, -- percentage, fixed, free_shipping
    value DECIMAL(12,2) NOT NULL,
    min_order_value DECIMAL(12,2),
    max_discount DECIMAL(12,2),
    max_uses INTEGER,
    uses_per_customer INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    conditions JSONB,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_promo_codes_tenant ON promo_codes(tenant_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
```

## CRM Database Schema

### Customers

```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    email VARCHAR(200),
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    avatar_url VARCHAR(500),

    -- Addresses
    addresses JSONB DEFAULT '[]',
    default_shipping_address_id UUID,
    default_billing_address_id UUID,

    -- Loyalty
    loyalty_tier VARCHAR(50) DEFAULT 'bronze',
    loyalty_points INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,

    -- Analytics
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    average_order_value DECIMAL(12,2),
    last_order_date TIMESTAMP,
    first_order_date TIMESTAMP,

    -- RFM
    rfm_segment VARCHAR(50),
    recency_score INTEGER,
    frequency_score INTEGER,
    monetary_score INTEGER,

    -- Communication
    email_opt_in BOOLEAN DEFAULT false,
    sms_opt_in BOOLEAN DEFAULT false,
    push_opt_in BOOLEAN DEFAULT false,

    -- Source
    source VARCHAR(50),
    referral_code VARCHAR(50),
    referred_by UUID REFERENCES customers(id),

    tags TEXT[],
    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, email),
    UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_rfm ON customers(rfm_segment);
```

### Customer Addresses

```sql
CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(20) DEFAULT 'shipping', -- shipping, billing
    is_default BOOLEAN DEFAULT false,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(200),
    phone VARCHAR(20),
    country VARCHAR(2) DEFAULT 'UA',
    city VARCHAR(100),
    region VARCHAR(100),
    address_line1 VARCHAR(500),
    address_line2 VARCHAR(500),
    postal_code VARCHAR(20),
    delivery_instructions TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customer_addresses_customer ON customer_addresses(customer_id);
```

## Multi-Tenancy

### Tenants Table

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(200),
    logo_url VARCHAR(500),
    settings JSONB DEFAULT '{}',
    plan VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Row-Level Security

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy for tenant isolation
CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Set current tenant in session
SET app.current_tenant = 'tenant-uuid-here';
```

## Indexes & Performance

### Recommended Indexes

```sql
-- Full-text search
CREATE INDEX idx_products_fts ON products
    USING gin(to_tsvector('ukrainian', name || ' ' || COALESCE(description, '')));

-- JSONB indexes for attributes
CREATE INDEX idx_products_attributes ON products USING gin(attributes);

-- Composite indexes for common queries
CREATE INDEX idx_orders_tenant_status_date ON orders(tenant_id, status, created_at DESC);
CREATE INDEX idx_inventory_available ON inventory(product_id, warehouse_id) WHERE available > 0;
```

### Query Optimization

```sql
-- Analyze tables regularly
ANALYZE products;
ANALYZE orders;

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

## Migrations

### Migration Files

```
migrations/
├── 001_create_tenants.up.sql
├── 001_create_tenants.down.sql
├── 002_create_products.up.sql
├── 002_create_products.down.sql
├── 003_create_orders.up.sql
└── ...
```

### Running Migrations

```bash
# Apply all migrations
go run cmd/migrate/main.go up

# Rollback last migration
go run cmd/migrate/main.go down 1

# Check status
go run cmd/migrate/main.go status
```

## Backup & Recovery

### Backup Script

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups

pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f $BACKUP_DIR/shop_$DATE.dump

# Upload to S3
aws s3 cp $BACKUP_DIR/shop_$DATE.dump s3://shop-backups/db/

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete
```

### Restore

```bash
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c backup.dump
```
