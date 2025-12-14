-- Migration: Complete Row Level Security for ALL tenant-scoped tables
-- Version: 006
-- Purpose: "Залізний" захист від Data Leak - база сама не віддасть чужі дані

-- ==================== HELPER FUNCTION ====================

-- Function to get current tenant ID from session
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN NULLIF(current_setting('app.tenant_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is superadmin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_superadmin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('app.is_superadmin', true)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== CORE TABLES RLS ====================

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
    FOR ALL
    USING (
        is_superadmin() OR
        tenant_id IS NULL OR
        tenant_id = current_tenant_id()
    )
    WITH CHECK (
        is_superadmin() OR
        tenant_id = current_tenant_id()
    );

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
CREATE POLICY tenant_isolation_orders ON orders
    FOR ALL
    USING (
        is_superadmin() OR
        tenant_id IS NULL OR
        tenant_id = current_tenant_id()
    )
    WITH CHECK (
        is_superadmin() OR
        tenant_id = current_tenant_id()
    );

-- Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_order_items ON order_items;
CREATE POLICY tenant_isolation_order_items ON order_items
    FOR ALL
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
            AND (o.tenant_id IS NULL OR o.tenant_id = current_tenant_id())
        )
    );

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_categories ON categories;
CREATE POLICY tenant_isolation_categories ON categories
    FOR ALL
    USING (
        is_superadmin() OR
        tenant_id IS NULL OR
        tenant_id = current_tenant_id()
    )
    WITH CHECK (
        is_superadmin() OR
        tenant_id = current_tenant_id()
    );

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
    FOR ALL
    USING (
        is_superadmin() OR
        tenant_id IS NULL OR
        tenant_id = current_tenant_id()
    )
    WITH CHECK (
        is_superadmin() OR
        tenant_id = current_tenant_id()
    );

-- Inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_inventory ON inventory;
CREATE POLICY tenant_isolation_inventory ON inventory
    FOR ALL
    USING (
        is_superadmin() OR
        tenant_id IS NULL OR
        tenant_id = current_tenant_id()
    )
    WITH CHECK (
        is_superadmin() OR
        tenant_id = current_tenant_id()
    );

-- ==================== ADVANCED FEATURES RLS (complete policies) ====================

-- Return Requests (already enabled, add FORCE and improve policy)
ALTER TABLE return_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_return_requests ON return_requests;
CREATE POLICY tenant_isolation_return_requests ON return_requests
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Return Items (via return_requests)
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_return_items ON return_items;
CREATE POLICY tenant_isolation_return_items ON return_items
    FOR ALL
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM return_requests rr
            WHERE rr.id = return_items.return_id
            AND rr.tenant_id = current_tenant_id()
        )
    );

-- Return History (via return_requests)
ALTER TABLE return_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_return_history ON return_history;
CREATE POLICY tenant_isolation_return_history ON return_history
    FOR ALL
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM return_requests rr
            WHERE rr.id = return_history.return_id
            AND rr.tenant_id = current_tenant_id()
        )
    );

-- Return Policies
ALTER TABLE return_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_return_policies ON return_policies;
CREATE POLICY tenant_isolation_return_policies ON return_policies
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- CDP Events
ALTER TABLE cdp_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cdp_events ON cdp_events;
CREATE POLICY tenant_isolation_cdp_events ON cdp_events
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- CDP Customer Profiles
ALTER TABLE cdp_customer_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cdp_profiles ON cdp_customer_profiles;
CREATE POLICY tenant_isolation_cdp_profiles ON cdp_customer_profiles
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- CDP Segments
ALTER TABLE cdp_segments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cdp_segments ON cdp_segments;
CREATE POLICY tenant_isolation_cdp_segments ON cdp_segments
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- CDP Segment Members (via segments)
ALTER TABLE cdp_segment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdp_segment_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cdp_segment_members ON cdp_segment_members;
CREATE POLICY tenant_isolation_cdp_segment_members ON cdp_segment_members
    FOR ALL
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM cdp_segments s
            WHERE s.id = cdp_segment_members.segment_id
            AND s.tenant_id = current_tenant_id()
        )
    );

-- CDP Automations
ALTER TABLE cdp_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdp_automations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cdp_automations ON cdp_automations;
CREATE POLICY tenant_isolation_cdp_automations ON cdp_automations
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Inbox Conversations
ALTER TABLE inbox_conversations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_inbox_conversations ON inbox_conversations;
CREATE POLICY tenant_isolation_inbox_conversations ON inbox_conversations
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Inbox Messages
ALTER TABLE inbox_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_inbox_messages ON inbox_messages;
CREATE POLICY tenant_isolation_inbox_messages ON inbox_messages
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Inbox Quick Replies
ALTER TABLE inbox_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_quick_replies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_inbox_quick_replies ON inbox_quick_replies;
CREATE POLICY tenant_isolation_inbox_quick_replies ON inbox_quick_replies
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Image Embeddings (Visual Search)
ALTER TABLE image_embeddings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_image_embeddings ON image_embeddings;
CREATE POLICY tenant_isolation_image_embeddings ON image_embeddings
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Fraud Assessments
ALTER TABLE fraud_assessments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fraud_assessments ON fraud_assessments;
CREATE POLICY tenant_isolation_fraud_assessments ON fraud_assessments
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Fraud Blacklist
ALTER TABLE fraud_blacklist FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fraud_blacklist ON fraud_blacklist;
CREATE POLICY tenant_isolation_fraud_blacklist ON fraud_blacklist
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- Fraud Rules
ALTER TABLE fraud_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fraud_rules ON fraud_rules;
CREATE POLICY tenant_isolation_fraud_rules ON fraud_rules
    FOR ALL
    USING (is_superadmin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_superadmin() OR tenant_id = current_tenant_id());

-- ==================== TENANTS TABLE (special case) ====================

-- Tenants table - owners can see only their tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_owner_policy ON tenants;
CREATE POLICY tenant_owner_policy ON tenants
    FOR ALL
    USING (
        is_superadmin() OR
        id = current_tenant_id() OR
        owner_id = current_setting('app.user_id', true)
    )
    WITH CHECK (
        is_superadmin() OR
        owner_id = current_setting('app.user_id', true)
    );

-- ==================== AUDIT LOG ====================

-- Create audit log for security tracking
CREATE TABLE IF NOT EXISTS security_audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id VARCHAR(255),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(255),
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_log_tenant ON security_audit_log(tenant_id);
CREATE INDEX idx_audit_log_timestamp ON security_audit_log(timestamp);
CREATE INDEX idx_audit_log_action ON security_audit_log(action);

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_action VARCHAR(100),
    p_table_name VARCHAR(100) DEFAULT NULL,
    p_record_id VARCHAR(255) DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO security_audit_log (
        tenant_id,
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        ip_address
    ) VALUES (
        current_tenant_id(),
        current_setting('app.user_id', true),
        p_action,
        p_table_name,
        p_record_id,
        p_old_data,
        p_new_data,
        inet_client_addr()
    );
END;
$$ LANGUAGE plpgsql;

-- ==================== HELPER VIEWS FOR RLS DEBUGGING ====================

-- View to check RLS status on all tables
CREATE OR REPLACE VIEW rls_status AS
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    forcerowsecurity as rls_forced
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- View to see all policies
CREATE OR REPLACE VIEW rls_policies AS
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==================== COMMENTS ====================

COMMENT ON FUNCTION current_tenant_id() IS 'Returns current tenant ID from session. Used by RLS policies.';
COMMENT ON FUNCTION is_superadmin() IS 'Checks if current user is superadmin (bypasses RLS).';
COMMENT ON FUNCTION log_security_event IS 'Logs security-related events for audit purposes.';
COMMENT ON TABLE security_audit_log IS 'Audit trail for security events and data changes.';

-- ==================== USAGE EXAMPLE ====================
/*
-- Set tenant context before any queries:
SET app.tenant_id = 'tenant-123';
SET app.user_id = 'user-456';
SET app.is_superadmin = 'false';

-- Now all queries will automatically filter by tenant_id
SELECT * FROM products;  -- Only returns tenant-123 products

-- For superadmin access:
SET app.is_superadmin = 'true';
SELECT * FROM products;  -- Returns ALL products

-- Check RLS status:
SELECT * FROM rls_status;

-- Check policies:
SELECT * FROM rls_policies WHERE tablename = 'products';
*/
