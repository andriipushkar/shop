-- Reverse migration: 000001_init_schema

-- Drop triggers
DROP TRIGGER IF EXISTS set_order_number ON orders;
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
DROP TRIGGER IF EXISTS update_user_addresses_updated_at ON user_addresses;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;

-- Drop functions
DROP FUNCTION IF EXISTS generate_order_number();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop sequence
DROP SEQUENCE IF EXISTS order_number_seq;

-- Drop tables in reverse order of creation (respecting foreign keys)
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS ab_test_assignments;
DROP TABLE IF EXISTS ab_tests;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS loyalty_points;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS promo_codes;
DROP TABLE IF EXISTS wishlist_items;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS user_addresses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS product_attributes;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;

-- Drop extensions
DROP EXTENSION IF EXISTS "pg_trgm";
DROP EXTENSION IF EXISTS "uuid-ossp";
