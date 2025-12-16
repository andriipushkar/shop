# Database Schema

Entity-Relationship Diagram (ERD) та структура бази даних Shop Platform.

## Огляд

База даних використовує PostgreSQL 15 з row-level security для multi-tenancy.

## Core Schema

### Tenants & Users

```sql
-- Tenants (магазини)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,
    plan_id UUID REFERENCES plans(id),
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'customer',
    status VARCHAR(50) DEFAULT 'active',
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- User Addresses
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'shipping',
    is_default BOOLEAN DEFAULT false,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country_code CHAR(2) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE INDEX idx_addresses_tenant ON addresses(tenant_id);
```

### Products & Categories

```sql
-- Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    position INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    meta_title VARCHAR(255),
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    short_description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    cost_price DECIMAL(10, 2),
    currency CHAR(3) DEFAULT 'UAH',
    status VARCHAR(50) DEFAULT 'draft',
    visibility VARCHAR(50) DEFAULT 'visible',
    type VARCHAR(50) DEFAULT 'simple',
    weight DECIMAL(10, 3),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    inventory_quantity INT DEFAULT 0,
    inventory_policy VARCHAR(50) DEFAULT 'deny',
    track_inventory BOOLEAN DEFAULT true,
    allow_backorder BOOLEAN DEFAULT false,
    requires_shipping BOOLEAN DEFAULT true,
    tax_class VARCHAR(50),
    meta_title VARCHAR(255),
    meta_description TEXT,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_products_attributes ON products USING GIN(attributes);

-- Product Categories (Many-to-Many)
CREATE TABLE product_categories (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    position INT DEFAULT 0,
    PRIMARY KEY (product_id, category_id)
);

-- Product Images
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    position INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    width INT,
    height INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- Product Variants
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    price DECIMAL(10, 2),
    compare_at_price DECIMAL(10, 2),
    cost_price DECIMAL(10, 2),
    inventory_quantity INT DEFAULT 0,
    weight DECIMAL(10, 3),
    barcode VARCHAR(100),
    options JSONB DEFAULT '{}',
    image_url VARCHAR(500),
    position INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
```

### Orders & Transactions

```sql
-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',

    -- Pricing
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_total DECIMAL(10, 2) DEFAULT 0,
    shipping_total DECIMAL(10, 2) DEFAULT 0,
    tax_total DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    currency CHAR(3) DEFAULT 'UAH',

    -- Customer Info
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    customer_note TEXT,

    -- Addresses (denormalized for history)
    billing_address JSONB,
    shipping_address JSONB,

    -- Shipping
    shipping_method_id UUID,
    shipping_method_name VARCHAR(255),
    tracking_number VARCHAR(255),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Payment
    payment_method VARCHAR(50),
    payment_provider VARCHAR(50),
    payment_reference VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    source VARCHAR(50) DEFAULT 'web',
    ip_address INET,
    user_agent TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, order_number)
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_email ON orders(email);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,

    -- Product snapshot
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(255),
    image_url VARCHAR(500),

    -- Pricing
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    tax DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,

    -- Fulfillment
    fulfilled_quantity INT DEFAULT 0,

    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- payment, refund, capture, void
    status VARCHAR(50) DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL,
    currency CHAR(3) DEFAULT 'UAH',
    payment_method VARCHAR(50),
    provider VARCHAR(50),
    provider_transaction_id VARCHAR(255),
    gateway_response JSONB,
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_order ON transactions(order_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Refunds
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id),
    amount DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(255),
    note TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    refunded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_refunds_order ON refunds(order_id);
```

### Cart & Checkout

```sql
-- Carts
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    email VARCHAR(255),

    -- Pricing (calculated)
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount_total DECIMAL(10, 2) DEFAULT 0,
    tax_total DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) DEFAULT 0,
    currency CHAR(3) DEFAULT 'UAH',

    -- Addresses
    billing_address JSONB,
    shipping_address JSONB,

    -- Shipping
    shipping_method_id UUID,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,

    -- Discounts
    coupon_code VARCHAR(50),
    discount_id UUID,

    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_carts_tenant ON carts(tenant_id);
CREATE INDEX idx_carts_user ON carts(user_id);
CREATE INDEX idx_carts_session ON carts(session_id);
CREATE INDEX idx_carts_expires ON carts(expires_at);

-- Cart Items
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE UNIQUE INDEX idx_cart_items_unique ON cart_items(cart_id, product_id, variant_id);
```

### Discounts & Promotions

```sql
-- Discounts
CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- percentage, fixed_amount, buy_x_get_y, free_shipping
    value DECIMAL(10, 2) NOT NULL,

    -- Scope
    applies_to VARCHAR(50) DEFAULT 'all', -- all, specific_products, specific_categories
    product_ids UUID[],
    category_ids UUID[],

    -- Limits
    minimum_order_amount DECIMAL(10, 2),
    maximum_discount_amount DECIMAL(10, 2),
    usage_limit INT,
    usage_limit_per_customer INT,
    usage_count INT DEFAULT 0,

    -- Validity
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,

    -- Conditions
    conditions JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_discounts_tenant ON discounts(tenant_id);
CREATE INDEX idx_discounts_code ON discounts(code);
CREATE INDEX idx_discounts_active ON discounts(is_active) WHERE is_active = true;

-- Discount Usage
CREATE TABLE discount_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_discount_usages_discount ON discount_usages(discount_id);
CREATE INDEX idx_discount_usages_user ON discount_usages(user_id);
```

### Inventory

```sql
-- Inventory Locations
CREATE TABLE inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    type VARCHAR(50) DEFAULT 'warehouse', -- warehouse, store, supplier
    address JSONB,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_locations_tenant ON inventory_locations(tenant_id);

-- Inventory Levels
CREATE TABLE inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    incoming_quantity INT DEFAULT 0,
    reorder_point INT,
    reorder_quantity INT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(location_id, product_id, variant_id)
);

CREATE INDEX idx_inventory_levels_location ON inventory_levels(location_id);
CREATE INDEX idx_inventory_levels_product ON inventory_levels(product_id);

-- Inventory Movements
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- received, sold, adjusted, transferred, returned
    quantity INT NOT NULL,
    reference_type VARCHAR(50), -- order, transfer, adjustment
    reference_id UUID,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_inventory_movements_location ON inventory_movements(location_id);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(type);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at DESC);
```

### Shipping

```sql
-- Shipping Methods
CREATE TABLE shipping_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    carrier VARCHAR(100),
    carrier_service_code VARCHAR(100),
    type VARCHAR(50) DEFAULT 'flat_rate', -- flat_rate, weight_based, price_based, carrier_calculated

    -- Pricing
    price DECIMAL(10, 2),
    free_shipping_threshold DECIMAL(10, 2),

    -- Rules (for weight/price based)
    rules JSONB DEFAULT '[]',

    -- Restrictions
    min_weight DECIMAL(10, 3),
    max_weight DECIMAL(10, 3),
    min_order_amount DECIMAL(10, 2),
    max_order_amount DECIMAL(10, 2),

    -- Zones
    zone_ids UUID[],

    -- Delivery estimates
    min_delivery_days INT,
    max_delivery_days INT,

    is_active BOOLEAN DEFAULT true,
    position INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shipping_methods_tenant ON shipping_methods(tenant_id);
CREATE INDEX idx_shipping_methods_active ON shipping_methods(is_active);

-- Shipping Zones
CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    countries CHAR(2)[],
    states VARCHAR(100)[],
    postal_codes VARCHAR(20)[],
    is_rest_of_world BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shipping_zones_tenant ON shipping_zones(tenant_id);
```

### Reviews & Ratings

```sql
-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT,

    -- Reviewer info
    reviewer_name VARCHAR(100),
    reviewer_email VARCHAR(255),

    -- Media
    images TEXT[],

    -- Moderation
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    moderation_note TEXT,

    -- Helpfulness
    helpful_count INT DEFAULT 0,
    unhelpful_count INT DEFAULT 0,

    is_verified_purchase BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Review Responses
CREATE TABLE review_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    responder_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_review_responses_review ON review_responses(review_id);
```

### SaaS Billing

```sql
-- Plans
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,

    -- Pricing
    monthly_price DECIMAL(10, 2),
    yearly_price DECIMAL(10, 2),
    currency CHAR(3) DEFAULT 'UAH',

    -- Limits
    product_limit INT,
    order_limit INT,
    user_limit INT,
    storage_limit_gb INT,
    api_rate_limit INT,

    -- Features
    features JSONB DEFAULT '[]',

    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    trial_days INT DEFAULT 14,
    position INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(50) DEFAULT 'active', -- active, cancelled, past_due, paused

    -- Billing
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Payment
    payment_method_id VARCHAR(255),

    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,

    -- Trial
    trial_ends_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    invoice_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, open, paid, void, uncollectible

    -- Dates
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,

    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    amount_due DECIMAL(10, 2) NOT NULL,
    currency CHAR(3) DEFAULT 'UAH',

    -- Billing info
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,

    -- PDF
    pdf_url VARCHAR(500),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- Invoice Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50) DEFAULT 'subscription', -- subscription, usage, one_time
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Usage Records (для metered billing)
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    metric VARCHAR(100) NOT NULL, -- orders, api_calls, storage_gb
    quantity DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_usage_records_tenant ON usage_records(tenant_id);
CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_metric ON usage_records(metric);
CREATE INDEX idx_usage_records_period ON usage_records(period_start, period_end);
```

## ERD Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     tenants     │───────│      users      │───────│    addresses    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ name            │       │ tenant_id (FK)  │       │ tenant_id (FK)  │
│ slug            │       │ email           │       │ user_id (FK)    │
│ domain          │       │ password_hash   │       │ type            │
│ plan_id (FK)    │       │ first_name      │       │ address_line1   │
│ status          │       │ last_name       │       │ city            │
│ settings (JSON) │       │ role            │       │ country_code    │
└────────┬────────┘       └────────┬────────┘       └─────────────────┘
         │                         │
         │                         │
┌────────┴────────┐       ┌────────┴────────┐       ┌─────────────────┐
│   categories    │       │      carts      │───────│   cart_items    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ tenant_id (FK)  │       │ tenant_id (FK)  │       │ cart_id (FK)    │
│ parent_id (FK)  │       │ user_id (FK)    │       │ product_id (FK) │
│ name            │       │ session_id      │       │ variant_id (FK) │
│ slug            │       │ subtotal        │       │ quantity        │
│ position        │       │ total           │       │ unit_price      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │
         │
┌────────┴────────┐       ┌─────────────────┐       ┌─────────────────┐
│    products     │───────│ product_variants│       │ product_images  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ tenant_id (FK)  │       │ product_id (FK) │       │ product_id (FK) │
│ sku             │       │ sku             │       │ url             │
│ name            │       │ price           │       │ alt_text        │
│ slug            │       │ inventory_qty   │       │ position        │
│ price           │       │ options (JSON)  │       │ is_primary      │
│ inventory_qty   │       └─────────────────┘       └─────────────────┘
│ attributes(JSON)│
└────────┬────────┘
         │
         │
┌────────┴────────┐       ┌─────────────────┐       ┌─────────────────┐
│     orders      │───────│   order_items   │       │  transactions   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ tenant_id (FK)  │       │ order_id (FK)   │       │ order_id (FK)   │
│ user_id (FK)    │       │ product_id (FK) │       │ type            │
│ order_number    │       │ variant_id (FK) │       │ status          │
│ status          │       │ sku             │       │ amount          │
│ payment_status  │       │ name            │       │ provider        │
│ subtotal        │       │ quantity        │       │ provider_tx_id  │
│ total           │       │ unit_price      │       └─────────────────┘
│ shipping_addr   │       │ total           │
└─────────────────┘       └─────────────────┘


┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      plans      │───────│  subscriptions  │───────│    invoices     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ name            │       │ tenant_id (FK)  │       │ tenant_id (FK)  │
│ slug            │       │ plan_id (FK)    │       │ subscription_id │
│ monthly_price   │       │ status          │       │ invoice_number  │
│ yearly_price    │       │ billing_cycle   │       │ status          │
│ product_limit   │       │ period_start    │       │ subtotal        │
│ order_limit     │       │ period_end      │       │ total           │
│ features (JSON) │       │ trial_ends_at   │       │ due_date        │
└─────────────────┘       └─────────────────┘       └─────────────────┘


┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   discounts     │───────│discount_usages  │       │    reviews      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ tenant_id (FK)  │       │ discount_id(FK) │       │ product_id (FK) │
│ code            │       │ order_id (FK)   │       │ user_id (FK)    │
│ type            │       │ user_id (FK)    │       │ rating          │
│ value           │       │ amount          │       │ title           │
│ usage_limit     │       └─────────────────┘       │ content         │
│ starts_at       │                                 │ status          │
│ ends_at         │                                 └─────────────────┘
└─────────────────┘


┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│inventory_locs   │───────│inventory_levels │       │inventory_moves  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ tenant_id (FK)  │       │ location_id(FK) │       │ location_id(FK) │
│ name            │       │ product_id (FK) │       │ product_id (FK) │
│ type            │       │ variant_id (FK) │       │ type            │
│ is_default      │       │ quantity        │       │ quantity        │
└─────────────────┘       │ reserved_qty    │       │ reference_id    │
                          └─────────────────┘       └─────────────────┘
```

## Row-Level Security

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for tenant isolation
CREATE POLICY tenant_isolation_policy ON products
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON orders
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON users
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Set tenant context
SET app.current_tenant = 'tenant-uuid-here';
```

## Migrations

```go
// internal/database/migrations/000001_init.up.sql
// Усі CREATE TABLE statements

// internal/database/migrations/000001_init.down.sql
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS usage_records CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
// ... решта таблиць
```

## Індекси для продуктивності

```sql
-- Повнотекстовий пошук
CREATE INDEX idx_products_search ON products
    USING GIN(to_tsvector('ukrainian', name || ' ' || COALESCE(description, '')));

-- Композитні індекси для типових запитів
CREATE INDEX idx_orders_tenant_status_created ON orders(tenant_id, status, created_at DESC);
CREATE INDEX idx_products_tenant_status_price ON products(tenant_id, status, price);

-- Часткові індекси
CREATE INDEX idx_active_products ON products(tenant_id, name) WHERE status = 'active';
CREATE INDEX idx_pending_orders ON orders(tenant_id, created_at) WHERE status = 'pending';

-- BRIN індекси для часових рядів
CREATE INDEX idx_orders_created_brin ON orders USING BRIN(created_at);
CREATE INDEX idx_transactions_created_brin ON transactions USING BRIN(created_at);
```

## Див. також

- [Terraform](./TERRAFORM.md)
- [Environment Variables](./ENV_VARS.md)
- [Multi-tenancy](../architecture/MULTI_TENANCY.md)
