-- Rollback EAV System
-- Migration: 000003_category_attributes (DOWN)

-- Drop views
DROP VIEW IF EXISTS product_full_attributes;
DROP VIEW IF EXISTS category_inherited_attributes;

-- Drop functions
DROP FUNCTION IF EXISTS get_category_filters(UUID);
DROP FUNCTION IF EXISTS get_category_attributes(UUID);

-- Drop triggers
DROP TRIGGER IF EXISTS update_product_variants_updated_at ON product_variants;
DROP TRIGGER IF EXISTS update_attributes_updated_at ON attributes;

-- Remove columns from product_attributes
ALTER TABLE product_attributes
    DROP COLUMN IF EXISTS attribute_id,
    DROP COLUMN IF EXISTS option_id,
    DROP COLUMN IF EXISTS numeric_value,
    DROP COLUMN IF EXISTS bool_value,
    DROP COLUMN IF EXISTS date_value;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS variant_attribute_values;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS category_attributes;
DROP TABLE IF EXISTS attribute_group_items;
DROP TABLE IF EXISTS attribute_groups;
DROP TABLE IF EXISTS attribute_options;
DROP TABLE IF EXISTS attributes;
