-- Performance Optimization: Database Indexes
-- This migration adds strategic indexes to improve query performance

-- ====================
-- PRODUCTS TABLE INDEXES
-- ====================

-- Index on category_id for filtering products by category
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Index on price for price range queries and sorting
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Index on created_at for sorting by newest/oldest
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Composite index for category filtering with price sorting
CREATE INDEX IF NOT EXISTS idx_products_category_price ON products(category_id, price);

-- Composite index for category filtering with date sorting
CREATE INDEX IF NOT EXISTS idx_products_category_created ON products(category_id, created_at DESC);

-- Index on status for filtering active/draft products
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE status = 'ACTIVE';

-- Index on brand_id for brand filtering
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id) WHERE brand_id IS NOT NULL;

-- Composite index for featured products
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, status) WHERE is_featured = true AND status = 'ACTIVE';

-- Composite index for bestsellers
CREATE INDEX IF NOT EXISTS idx_products_bestseller ON products(is_bestseller, status) WHERE is_bestseller = true AND status = 'ACTIVE';

-- Index on rating for sorting by rating
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC);

-- Full-text search index on product name and description (PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_products_search_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_search_name_ua ON products USING gin(to_tsvector('ukrainian', name_ua));
CREATE INDEX IF NOT EXISTS idx_products_search_description ON products USING gin(to_tsvector('english', coalesce(description, '')));

-- Composite full-text search index
CREATE INDEX IF NOT EXISTS idx_products_fulltext_search ON products USING gin(
    (setweight(to_tsvector('english', name), 'A') ||
     setweight(to_tsvector('english', coalesce(description, '')), 'B'))
);

-- ====================
-- ORDERS TABLE INDEXES
-- ====================

-- Index on user_id for user's order history
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id) WHERE user_id IS NOT NULL;

-- Index on status for filtering orders by status
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Index on created_at for sorting by date
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Composite index for user orders sorted by date
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Composite index for user orders by status
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status) WHERE user_id IS NOT NULL;

-- Index on order_number for quick lookups
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);

-- Index on payment_status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Index on shipping_status
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON orders(shipping_status);

-- Composite index for marketplace orders
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders(marketplace, external_id) WHERE marketplace IS NOT NULL;

-- Index on completed_at for analytics
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at DESC) WHERE completed_at IS NOT NULL;

-- ====================
-- REVIEWS TABLE INDEXES
-- ====================

-- Index on product_id for product reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);

-- Index on rating for filtering by rating
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Composite index for product reviews sorted by date
CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON reviews(product_id, created_at DESC);

-- Composite index for published reviews
CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(is_published, product_id, created_at DESC) WHERE is_published = true;

-- Index on user_id for user's reviews
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- Composite index for verified purchase reviews
CREATE INDEX IF NOT EXISTS idx_reviews_verified ON reviews(is_verified, product_id) WHERE is_verified = true;

-- ====================
-- CATEGORIES TABLE INDEXES
-- ====================

-- Index on parent_id for category tree queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id) WHERE parent_id IS NOT NULL;

-- Index on slug for URL lookups
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Index on is_active for filtering active categories
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active, "order") WHERE is_active = true;

-- ====================
-- CART TABLE INDEXES
-- ====================

-- Index on user_id for user carts
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id) WHERE user_id IS NOT NULL;

-- Index on session_id for guest carts
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id) WHERE session_id IS NOT NULL;

-- Index on updated_at for abandoned cart cleanup
CREATE INDEX IF NOT EXISTS idx_carts_updated_at ON carts(updated_at);

-- ====================
-- CART_ITEMS TABLE INDEXES
-- ====================

-- Index on cart_id for cart items
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);

-- Index on product_id for inventory checks
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- ====================
-- INVENTORY TABLE INDEXES
-- ====================

-- Composite index for product inventory by warehouse
CREATE INDEX IF NOT EXISTS idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);

-- Index on warehouse_id for warehouse inventory
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_id ON inventory(warehouse_id);

-- Index on quantity for low stock alerts
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(product_id, quantity) WHERE quantity < min_stock;

-- ====================
-- SESSIONS TABLE INDEXES
-- ====================

-- Index on user_id for user sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Index on token for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- Index on expires_at for session cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ====================
-- WISHLIST TABLE INDEXES
-- ====================

-- Composite index for user wishlist
CREATE INDEX IF NOT EXISTS idx_wishlist_user_product ON wishlist_items(user_id, created_at DESC);

-- Index on product_id for product popularity
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist_items(product_id);

-- ====================
-- PRICE_HISTORY TABLE INDEXES
-- ====================

-- Composite index for product price history
CREATE INDEX IF NOT EXISTS idx_price_history_product_created ON price_history(product_id, created_at DESC);

-- ====================
-- NOTIFICATIONS TABLE INDEXES
-- ====================

-- Composite index for user notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- Index on is_read for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at DESC) WHERE is_read = false;

-- ====================
-- ANALYTICS_EVENTS TABLE INDEXES
-- ====================

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_type_created ON analytics_events(type, created_at DESC);

-- Index on session_id for session analytics
CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id, created_at DESC);

-- Index on user_id for user analytics
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ====================
-- JOBS TABLE INDEXES
-- ====================

-- Composite index for job processing
CREATE INDEX IF NOT EXISTS idx_jobs_queue_status_runat ON jobs(queue, status, run_at) WHERE status = 'pending';

-- Index on status for job monitoring
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at DESC);

-- ====================
-- ORDER_ITEMS TABLE INDEXES
-- ====================

-- Index on order_id for order items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Index on product_id for product sales analytics
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ====================
-- ADDRESSES TABLE INDEXES
-- ====================

-- Composite index for user addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_default ON addresses(user_id, is_default) WHERE is_default = true;

-- ====================
-- PERFORMANCE NOTES
-- ====================

-- 1. Indexes improve SELECT query performance but slow down INSERT/UPDATE/DELETE
-- 2. Use partial indexes (WHERE clause) for frequently filtered data
-- 3. Composite indexes should be ordered: equality filters first, then range/sort
-- 4. Full-text search indexes use GIN (Generalized Inverted Index) for PostgreSQL
-- 5. Monitor index usage with: SELECT * FROM pg_stat_user_indexes;
-- 6. Remove unused indexes to improve write performance
-- 7. VACUUM ANALYZE after creating indexes to update statistics

-- To analyze query performance:
-- EXPLAIN ANALYZE SELECT * FROM products WHERE category_id = 'xxx' ORDER BY price;

-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- To find missing indexes:
-- SELECT schemaname, tablename, attname, n_distinct, correlation
-- FROM pg_stats
-- WHERE schemaname = 'public'
-- AND n_distinct > 100
-- ORDER BY abs(correlation) DESC;
