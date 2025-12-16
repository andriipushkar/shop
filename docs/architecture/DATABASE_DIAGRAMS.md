# Database Diagrams

Схеми бази даних та зв'язки між таблицями.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │   PostgreSQL     │    │     Redis        │    │  Elasticsearch   │      │
│  │   (Primary DB)   │    │   (Cache/Queue)  │    │    (Search)      │      │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘      │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Application Layer                             │  │
│  │    Core Service │ OMS Service │ CRM Service │ Notification Service   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Schema

### Tenants & Users

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MULTI-TENANT SCHEMA                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐     ┌─────────────────────┐                        │
│  │      tenants        │     │   tenant_settings   │                        │
│  ├─────────────────────┤     ├─────────────────────┤                        │
│  │ id (PK)             │────▶│ tenant_id (FK)      │                        │
│  │ name                │     │ key                 │                        │
│  │ domain              │     │ value               │                        │
│  │ status              │     │ created_at          │                        │
│  │ plan_id             │     └─────────────────────┘                        │
│  │ created_at          │                                                    │
│  │ updated_at          │     ┌─────────────────────┐                        │
│  └─────────┬───────────┘     │       users         │                        │
│            │                 ├─────────────────────┤                        │
│            │                 │ id (PK)             │                        │
│            └────────────────▶│ tenant_id (FK)      │                        │
│                              │ email               │                        │
│                              │ password_hash       │                        │
│                              │ role                │                        │
│                              │ status              │                        │
│                              │ created_at          │                        │
│                              └─────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SQL Schema

```sql
-- Tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    plan_id UUID REFERENCES plans(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email);
```

## Products Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTS SCHEMA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐     ┌─────────────────────┐                        │
│  │     categories      │     │      products       │                        │
│  ├─────────────────────┤     ├─────────────────────┤                        │
│  │ id (PK)             │◀────│ id (PK)             │                        │
│  │ tenant_id (FK)      │     │ tenant_id (FK)      │                        │
│  │ parent_id (FK)      │     │ category_id (FK)    │                        │
│  │ name                │     │ brand_id (FK)       │──────┐                 │
│  │ slug                │     │ name                │      │                 │
│  │ description         │     │ slug                │      ▼                 │
│  │ position            │     │ sku                 │ ┌─────────────────┐    │
│  │ is_active           │     │ description         │ │     brands      │    │
│  └─────────────────────┘     │ price               │ ├─────────────────┤    │
│                              │ compare_at_price    │ │ id (PK)         │    │
│  ┌─────────────────────┐     │ cost_price          │ │ tenant_id       │    │
│  │   product_images    │     │ quantity            │ │ name            │    │
│  ├─────────────────────┤     │ status              │ │ slug            │    │
│  │ id (PK)             │     │ created_at          │ │ logo_url        │    │
│  │ product_id (FK)     │◀────│ updated_at          │ └─────────────────┘    │
│  │ url                 │     └──────────┬──────────┘                        │
│  │ position            │                │                                   │
│  │ is_primary          │                ▼                                   │
│  └─────────────────────┘     ┌─────────────────────┐                        │
│                              │  product_variants   │                        │
│  ┌─────────────────────┐     ├─────────────────────┤                        │
│  │ product_attributes  │     │ id (PK)             │                        │
│  ├─────────────────────┤     │ product_id (FK)     │                        │
│  │ id (PK)             │◀────│ sku                 │                        │
│  │ product_id (FK)     │     │ name                │                        │
│  │ attribute_id (FK)   │     │ price               │                        │
│  │ value               │     │ quantity            │                        │
│  └─────────────────────┘     │ options (JSONB)     │                        │
│                              └─────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SQL Schema

```sql
-- Categories (nested set model)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    position INTEGER DEFAULT 0,
    lft INTEGER,
    rgt INTEGER,
    depth INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, slug)
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    brand_id UUID REFERENCES brands(id),
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL,
    sku VARCHAR(100),
    description TEXT,
    short_description TEXT,
    price DECIMAL(12,2) NOT NULL,
    compare_at_price DECIMAL(12,2),
    cost_price DECIMAL(12,2),
    quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT false,
    weight DECIMAL(10,3),
    dimensions JSONB,
    seo_title VARCHAR(255),
    seo_description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,

    UNIQUE(tenant_id, slug),
    UNIQUE(tenant_id, sku)
);

-- Indexes
CREATE INDEX idx_products_tenant ON products(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('ukrainian', name || ' ' || COALESCE(description, '')));

-- Product variants
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    price DECIMAL(12,2),
    compare_at_price DECIMAL(12,2),
    quantity INTEGER DEFAULT 0,
    options JSONB DEFAULT '{}',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Orders Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORDERS SCHEMA                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │      customers      │                                                    │
│  ├─────────────────────┤                                                    │
│  │ id (PK)             │                                                    │
│  │ tenant_id (FK)      │                                                    │
│  │ email               │                                                    │
│  │ phone               │                                                    │
│  │ first_name          │     ┌─────────────────────┐                        │
│  │ last_name           │     │       orders        │                        │
│  │ orders_count        │     ├─────────────────────┤                        │
│  │ total_spent         │◀────│ id (PK)             │                        │
│  └─────────────────────┘     │ tenant_id (FK)      │                        │
│                              │ customer_id (FK)    │                        │
│                              │ number              │                        │
│  ┌─────────────────────┐     │ status              │                        │
│  │    order_items      │     │ payment_status      │                        │
│  ├─────────────────────┤     │ subtotal            │                        │
│  │ id (PK)             │     │ discount            │                        │
│  │ order_id (FK)       │◀────│ shipping_cost       │                        │
│  │ product_id          │     │ total               │                        │
│  │ variant_id          │     │ shipping_address    │                        │
│  │ name                │     │ billing_address     │                        │
│  │ sku                 │     │ notes               │                        │
│  │ quantity            │     │ created_at          │                        │
│  │ price               │     └──────────┬──────────┘                        │
│  │ total               │                │                                   │
│  └─────────────────────┘                │                                   │
│                                         ▼                                   │
│                              ┌─────────────────────┐                        │
│  ┌─────────────────────┐     │    order_history    │                        │
│  │     payments        │     ├─────────────────────┤                        │
│  ├─────────────────────┤     │ id (PK)             │                        │
│  │ id (PK)             │     │ order_id (FK)       │                        │
│  │ order_id (FK)       │◀────│ status              │                        │
│  │ method              │     │ comment             │                        │
│  │ amount              │     │ user_id             │                        │
│  │ status              │     │ created_at          │                        │
│  │ transaction_id      │     └─────────────────────┘                        │
│  └─────────────────────┘                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SQL Schema

```sql
-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    email VARCHAR(255),
    phone VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    accepts_marketing BOOLEAN DEFAULT false,
    orders_count INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, email),
    UNIQUE(tenant_id, phone)
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    number VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',

    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,

    -- Addresses (JSONB for flexibility)
    shipping_address JSONB,
    billing_address JSONB,

    -- Shipping
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(255),

    -- Meta
    source VARCHAR(50) DEFAULT 'web',
    notes TEXT,
    tags TEXT[],

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    cancelled_at TIMESTAMP,

    UNIQUE(tenant_id, number)
);

-- Order items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID,
    variant_id UUID,
    name VARCHAR(500) NOT NULL,
    sku VARCHAR(100),
    quantity INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(tenant_id, number);
```

## Inventory Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INVENTORY SCHEMA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐     ┌─────────────────────┐                        │
│  │     warehouses      │     │  inventory_items    │                        │
│  ├─────────────────────┤     ├─────────────────────┤                        │
│  │ id (PK)             │◀────│ id (PK)             │                        │
│  │ tenant_id (FK)      │     │ warehouse_id (FK)   │                        │
│  │ name                │     │ product_id (FK)     │                        │
│  │ code                │     │ variant_id (FK)     │                        │
│  │ address             │     │ quantity            │                        │
│  │ is_default          │     │ reserved            │                        │
│  │ is_active           │     │ available           │                        │
│  └─────────────────────┘     │ min_stock           │                        │
│                              │ max_stock           │                        │
│                              └──────────┬──────────┘                        │
│                                         │                                   │
│                                         ▼                                   │
│                              ┌─────────────────────┐                        │
│                              │ inventory_movements │                        │
│                              ├─────────────────────┤                        │
│                              │ id (PK)             │                        │
│                              │ inventory_item_id   │                        │
│                              │ type                │                        │
│                              │ quantity_before     │                        │
│                              │ quantity_change     │                        │
│                              │ quantity_after      │                        │
│                              │ reason              │                        │
│                              │ reference_type      │                        │
│                              │ reference_id        │                        │
│                              │ created_at          │                        │
│                              └─────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SQL Schema

```sql
-- Warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address JSONB,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, code)
);

-- Inventory items
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    available INTEGER GENERATED ALWAYS AS (quantity - reserved) STORED,
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER,
    location VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(warehouse_id, product_id, variant_id)
);

-- Inventory movements (audit log)
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES inventory_items(id),
    type VARCHAR(50) NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason VARCHAR(255),
    reference_type VARCHAR(50),
    reference_id UUID,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_movements_item ON inventory_movements(inventory_item_id);
CREATE INDEX idx_movements_created ON inventory_movements(created_at DESC);
```

## Partitioning Strategy

```sql
-- Orders partitioned by month
CREATE TABLE orders (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL,
    ...
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE orders_2024_02 PARTITION OF orders
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automate partition creation
CREATE OR REPLACE FUNCTION create_orders_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name := 'orders_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF orders
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly
SELECT cron.schedule('create-orders-partition', '0 0 25 * *', 'SELECT create_orders_partition()');
```

## Row Level Security

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Set tenant context in application
SET app.tenant_id = 'tenant-uuid-here';
```

## Database Relationships Summary

| Table | References | Relationship |
|-------|------------|--------------|
| users | tenants | Many-to-One |
| products | tenants, categories, brands | Many-to-One |
| product_variants | products | Many-to-One |
| orders | tenants, customers | Many-to-One |
| order_items | orders, products | Many-to-One |
| inventory_items | warehouses, products | Many-to-One |
| customers | tenants, users | Many-to-One |

## See Also

- [Multi-Tenancy](./MULTI_TENANCY.md)
- [Database Schema](../infrastructure/DATABASE_SCHEMA.md)
- [Migration Guide](../guides/MIGRATIONS.md)
