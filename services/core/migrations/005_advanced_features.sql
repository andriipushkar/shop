-- Migration: Advanced Features (Multi-tenancy, RMA, CDP, Inbox, Visual Search, Fraud Detection)
-- Version: 005

-- ==================== MULTI-TENANCY ====================

CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(255) PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    custom_domain VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, inactive, suspended, trial
    plan VARCHAR(50) NOT NULL DEFAULT 'free', -- free, starter, professional, enterprise
    owner_id VARCHAR(255) NOT NULL,

    -- Quotas
    product_limit INTEGER DEFAULT 50,
    order_limit INTEGER DEFAULT 100,
    storage_limit BIGINT DEFAULT 104857600, -- 100MB

    -- Usage
    product_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    storage_used BIGINT DEFAULT 0,

    -- Settings (JSON)
    settings JSONB DEFAULT '{}',

    -- Dates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_tenants_status ON tenants(status);

-- Add tenant_id to existing tables (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tenant_id') THEN
        ALTER TABLE products ADD COLUMN tenant_id VARCHAR(255);
        CREATE INDEX idx_products_tenant ON products(tenant_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tenant_id') THEN
        ALTER TABLE orders ADD COLUMN tenant_id VARCHAR(255);
        CREATE INDEX idx_orders_tenant ON orders(tenant_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'tenant_id') THEN
        ALTER TABLE categories ADD COLUMN tenant_id VARCHAR(255);
        CREATE INDEX idx_categories_tenant ON categories(tenant_id);
    END IF;
END $$;

-- ==================== RMA (RETURNS) ====================

CREATE TABLE IF NOT EXISTS return_requests (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    order_number VARCHAR(100),
    customer_id VARCHAR(255),
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_name VARCHAR(255),

    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reason VARCHAR(100) NOT NULL,
    reason_details TEXT,

    -- Shipping
    return_tracking_number VARCHAR(100),
    return_carrier VARCHAR(100),
    return_shipment_id VARCHAR(255),
    label_url TEXT,

    -- Inspection
    inspection_notes TEXT,
    inspected_by VARCHAR(255),
    inspected_at TIMESTAMP WITH TIME ZONE,

    -- Refund
    refund_method VARCHAR(50) NOT NULL DEFAULT 'original_payment',
    refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    refund_status VARCHAR(50),
    refund_id VARCHAR(255),
    refunded_at TIMESTAMP WITH TIME ZONE,

    -- Admin
    admin_notes TEXT,
    processed_by VARCHAR(255),

    -- Dates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_return_requests_tenant ON return_requests(tenant_id);
CREATE INDEX idx_return_requests_order ON return_requests(order_id);
CREATE INDEX idx_return_requests_customer ON return_requests(customer_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);
CREATE INDEX idx_return_requests_created ON return_requests(created_at);

CREATE TABLE IF NOT EXISTS return_items (
    id VARCHAR(255) PRIMARY KEY,
    return_id VARCHAR(255) NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    order_item_id VARCHAR(255),
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255),
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    reason VARCHAR(100),
    condition VARCHAR(50),
    images JSONB DEFAULT '[]',
    notes TEXT,

    -- Warehouse decision
    decision VARCHAR(50),
    decision_notes TEXT,
    decision_by VARCHAR(255),
    decision_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_return_items_return ON return_items(return_id);
CREATE INDEX idx_return_items_product ON return_items(product_id);

CREATE TABLE IF NOT EXISTS return_history (
    id VARCHAR(255) PRIMARY KEY,
    return_id VARCHAR(255) NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    comment TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_return_history_return ON return_history(return_id);

CREATE TABLE IF NOT EXISTS return_policies (
    tenant_id VARCHAR(255) PRIMARY KEY,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== CDP (Customer Data Platform) ====================

CREATE TABLE IF NOT EXISTS cdp_events (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    properties JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(50),
    user_agent TEXT,
    ip VARCHAR(45),
    url TEXT,
    referrer TEXT
);

CREATE INDEX idx_cdp_events_tenant ON cdp_events(tenant_id);
CREATE INDEX idx_cdp_events_customer ON cdp_events(customer_id);
CREATE INDEX idx_cdp_events_session ON cdp_events(session_id);
CREATE INDEX idx_cdp_events_type ON cdp_events(type);
CREATE INDEX idx_cdp_events_timestamp ON cdp_events(timestamp);
CREATE INDEX idx_cdp_events_type_time ON cdp_events(tenant_id, type, timestamp);

CREATE TABLE IF NOT EXISTS cdp_customer_profiles (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    -- Metrics
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12, 2) DEFAULT 0,
    average_order_value DECIMAL(10, 2) DEFAULT 0,
    last_order_date TIMESTAMP WITH TIME ZONE,
    days_since_order INTEGER DEFAULT 0,

    -- RFM
    recency_score INTEGER DEFAULT 1,
    frequency_score INTEGER DEFAULT 1,
    monetary_score INTEGER DEFAULT 1,
    rfm_score INTEGER DEFAULT 0,
    rfm_segment VARCHAR(50),

    -- Behavior
    products_viewed INTEGER DEFAULT 0,
    search_count INTEGER DEFAULT 0,
    cart_abandons INTEGER DEFAULT 0,
    wishlist_items INTEGER DEFAULT 0,
    reviews_written INTEGER DEFAULT 0,
    returns_count INTEGER DEFAULT 0,

    -- Preferences
    favorite_categories TEXT[],
    favorite_brands TEXT[],
    preferred_channel VARCHAR(50),

    -- Lifecycle
    lifecycle_stage VARCHAR(50) DEFAULT 'new',
    customer_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Segments and tags
    segments TEXT[],
    tags TEXT[],
    custom_attributes JSONB DEFAULT '{}',

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cdp_profiles_tenant ON cdp_customer_profiles(tenant_id);
CREATE INDEX idx_cdp_profiles_email ON cdp_customer_profiles(tenant_id, email);
CREATE INDEX idx_cdp_profiles_rfm ON cdp_customer_profiles(tenant_id, rfm_segment);
CREATE INDEX idx_cdp_profiles_lifecycle ON cdp_customer_profiles(tenant_id, lifecycle_stage);

CREATE TABLE IF NOT EXISTS cdp_segments (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'dynamic',
    criteria JSONB DEFAULT '{}',
    member_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cdp_segments_tenant ON cdp_segments(tenant_id);

CREATE TABLE IF NOT EXISTS cdp_segment_members (
    segment_id VARCHAR(255) NOT NULL REFERENCES cdp_segments(id) ON DELETE CASCADE,
    customer_id VARCHAR(255) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (segment_id, customer_id)
);

CREATE TABLE IF NOT EXISTS cdp_automations (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    actions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cdp_automations_tenant ON cdp_automations(tenant_id);
CREATE INDEX idx_cdp_automations_trigger ON cdp_automations(tenant_id, trigger_type);

-- ==================== UNIFIED INBOX ====================

CREATE TABLE IF NOT EXISTS inbox_conversations (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    channel VARCHAR(50) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    priority INTEGER DEFAULT 3,

    -- Customer info
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_avatar TEXT,

    -- Assignment
    assigned_to VARCHAR(255),
    assigned_at TIMESTAMP WITH TIME ZONE,
    team_id VARCHAR(255),

    -- Context
    subject VARCHAR(500),
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',

    -- Stats
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Dates
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    snoozed_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_inbox_conv_tenant ON inbox_conversations(tenant_id);
CREATE INDEX idx_inbox_conv_channel ON inbox_conversations(tenant_id, channel, channel_id);
CREATE INDEX idx_inbox_conv_status ON inbox_conversations(tenant_id, status);
CREATE INDEX idx_inbox_conv_assigned ON inbox_conversations(tenant_id, assigned_to);
CREATE INDEX idx_inbox_conv_last_msg ON inbox_conversations(tenant_id, last_message_at);

CREATE TABLE IF NOT EXISTS inbox_messages (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    direction VARCHAR(20) NOT NULL, -- incoming, outgoing
    channel VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),

    -- Sender
    sender_id VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_type VARCHAR(50), -- customer, agent, bot

    -- Content
    content_type VARCHAR(50) DEFAULT 'text',
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- Status
    status VARCHAR(50) DEFAULT 'sent',
    read_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Reply
    reply_to_id VARCHAR(255),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inbox_msg_conv ON inbox_messages(conversation_id);
CREATE INDEX idx_inbox_msg_tenant ON inbox_messages(tenant_id);
CREATE INDEX idx_inbox_msg_created ON inbox_messages(created_at);

CREATE TABLE IF NOT EXISTS inbox_quick_replies (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[],
    category VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inbox_quick_tenant ON inbox_quick_replies(tenant_id);

-- ==================== VISUAL SEARCH ====================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS image_embeddings (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255) NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    embedding vector(512), -- CLIP ViT-B/32 dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_image_emb_tenant ON image_embeddings(tenant_id);
CREATE INDEX idx_image_emb_product ON image_embeddings(product_id);

-- Create IVFFlat index for fast similarity search
CREATE INDEX idx_image_emb_vector ON image_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ==================== FRAUD DETECTION ====================

CREATE TABLE IF NOT EXISTS fraud_assessments (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL UNIQUE,
    risk_level VARCHAR(50) NOT NULL,
    risk_score DECIMAL(5, 2) NOT NULL,
    factors JSONB DEFAULT '[]',
    recommendation VARCHAR(50),

    -- Review
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    decision VARCHAR(50),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fraud_assess_tenant ON fraud_assessments(tenant_id);
CREATE INDEX idx_fraud_assess_order ON fraud_assessments(order_id);
CREATE INDEX idx_fraud_assess_level ON fraud_assessments(tenant_id, risk_level);
CREATE INDEX idx_fraud_assess_created ON fraud_assessments(created_at);

CREATE TABLE IF NOT EXISTS fraud_blacklist (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- email, phone, ip, card_bin, device
    value VARCHAR(255) NOT NULL,
    reason TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_fraud_blacklist_tenant ON fraud_blacklist(tenant_id);
CREATE INDEX idx_fraud_blacklist_lookup ON fraud_blacklist(tenant_id, type, value);
CREATE INDEX idx_fraud_blacklist_expires ON fraud_blacklist(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS fraud_rules (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL DEFAULT '[]',
    action VARCHAR(50) NOT NULL DEFAULT 'flag',
    risk_score DECIMAL(5, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    match_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fraud_rules_tenant ON fraud_rules(tenant_id);
CREATE INDEX idx_fraud_rules_active ON fraud_rules(tenant_id, is_active);

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS on tenant-scoped tables
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdp_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdp_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (example for return_requests)
-- Applications should set current_setting('app.tenant_id') before queries

CREATE POLICY tenant_isolation_return_requests ON return_requests
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_cdp_events ON cdp_events
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_inbox_conversations ON inbox_conversations
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO shop_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shop_user;
