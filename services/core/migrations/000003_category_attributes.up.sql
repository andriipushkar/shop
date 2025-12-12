-- EAV (Entity-Attribute-Value) System for Dynamic Product Attributes
-- Migration: 000003_category_attributes

-- ===================
-- 1. Attributes Dictionary (Словник атрибутів)
-- ===================
CREATE TABLE IF NOT EXISTS attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,           -- "screen_size", "material", "cpu_series"
    name JSONB NOT NULL,                          -- {"uk": "Діагональ екрану", "en": "Screen Size"}
    description JSONB,                            -- {"uk": "Розмір екрану в дюймах", "en": "..."}
    type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'number', 'select', 'multiselect', 'bool', 'color', 'range')),
    unit VARCHAR(50),                             -- "кг", "см", "ГБ", "дюйм", "мАг"
    is_filterable BOOLEAN DEFAULT true,           -- Show in filters sidebar
    is_searchable BOOLEAN DEFAULT true,           -- Include in search
    is_comparable BOOLEAN DEFAULT true,           -- Show in comparison table
    is_visible_on_product BOOLEAN DEFAULT true,   -- Show on product page
    validation_rules JSONB,                       -- {"min": 0, "max": 100, "pattern": "..."}
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attributes_code ON attributes(code);
CREATE INDEX idx_attributes_type ON attributes(type);
CREATE INDEX idx_attributes_active ON attributes(is_active);
CREATE INDEX idx_attributes_filterable ON attributes(is_filterable) WHERE is_filterable = true;

-- ===================
-- 2. Attribute Options (Значення для Select полів)
-- ===================
CREATE TABLE IF NOT EXISTS attribute_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,                  -- "Intel Core i5", "Бавовна", "Червоний"
    label JSONB,                                  -- {"uk": "Червоний", "en": "Red"} - optional localized label
    color_hex VARCHAR(7),                         -- For color type: "#FF0000"
    image_url VARCHAR(512),                       -- Optional image for option
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attribute_options_attribute ON attribute_options(attribute_id);
CREATE INDEX idx_attribute_options_value ON attribute_options(value);
CREATE INDEX idx_attribute_options_active ON attribute_options(is_active);

-- ===================
-- 3. Attribute Groups (Групи атрибутів для організації)
-- ===================
CREATE TABLE IF NOT EXISTS attribute_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,            -- "technical", "physical", "warranty"
    name JSONB NOT NULL,                          -- {"uk": "Технічні характеристики", "en": "Technical Specs"}
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attribute_groups_code ON attribute_groups(code);

-- ===================
-- 4. Attribute to Group mapping
-- ===================
CREATE TABLE IF NOT EXISTS attribute_group_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES attribute_groups(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(group_id, attribute_id)
);

CREATE INDEX idx_attribute_group_items_group ON attribute_group_items(group_id);
CREATE INDEX idx_attribute_group_items_attribute ON attribute_group_items(attribute_id);

-- ===================
-- 5. Category Attributes (Шаблон атрибутів для категорій)
-- ===================
CREATE TABLE IF NOT EXISTS category_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT false,            -- Must be filled when creating product
    is_variant BOOLEAN DEFAULT false,             -- Attribute creates product variants (size, color)
    default_value VARCHAR(255),                   -- Default value for this category
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, attribute_id)
);

CREATE INDEX idx_category_attributes_category ON category_attributes(category_id);
CREATE INDEX idx_category_attributes_attribute ON category_attributes(attribute_id);
CREATE INDEX idx_category_attributes_required ON category_attributes(is_required) WHERE is_required = true;
CREATE INDEX idx_category_attributes_variant ON category_attributes(is_variant) WHERE is_variant = true;

-- ===================
-- 6. Update Product Attributes (зв'язуємо з словником)
-- ===================
-- Add new columns to existing product_attributes table
ALTER TABLE product_attributes
    ADD COLUMN IF NOT EXISTS attribute_id UUID REFERENCES attributes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES attribute_options(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS numeric_value DECIMAL(15, 4),
    ADD COLUMN IF NOT EXISTS bool_value BOOLEAN,
    ADD COLUMN IF NOT EXISTS date_value DATE;

CREATE INDEX IF NOT EXISTS idx_product_attributes_attribute ON product_attributes(attribute_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_option ON product_attributes(option_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_numeric ON product_attributes(numeric_value) WHERE numeric_value IS NOT NULL;

-- ===================
-- 7. Product Variants (Варіанти товару: розмір, колір)
-- ===================
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    price DECIMAL(10, 2),                         -- NULL = use parent price
    compare_at_price DECIMAL(10, 2),
    cost_price DECIMAL(10, 2),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    weight DECIMAL(10, 3),
    image_url VARCHAR(512),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_active ON product_variants(is_active);

-- ===================
-- 8. Variant Attribute Values (Значення атрибутів варіанту)
-- ===================
CREATE TABLE IF NOT EXISTS variant_attribute_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    option_id UUID REFERENCES attribute_options(id) ON DELETE SET NULL,
    value VARCHAR(255),
    UNIQUE(variant_id, attribute_id)
);

CREATE INDEX idx_variant_attributes_variant ON variant_attribute_values(variant_id);
CREATE INDEX idx_variant_attributes_attribute ON variant_attribute_values(attribute_id);
CREATE INDEX idx_variant_attributes_option ON variant_attribute_values(option_id);

-- ===================
-- 9. Category Inheritance View (Наслідування атрибутів)
-- ===================
CREATE OR REPLACE VIEW category_inherited_attributes AS
WITH RECURSIVE category_tree AS (
    -- Base: categories without parent
    SELECT id, parent_id, name, 0 as level, ARRAY[id] as path
    FROM categories WHERE parent_id IS NULL

    UNION ALL

    -- Recursive: child categories
    SELECT c.id, c.parent_id, c.name, ct.level + 1, ct.path || c.id
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT
    ct.id as category_id,
    ct.name as category_name,
    ct.level,
    ct.path,
    a.id as attribute_id,
    a.code as attribute_code,
    a.name as attribute_name,
    a.type as attribute_type,
    ca.is_required,
    ca.is_variant,
    ca.sort_order
FROM category_tree ct
JOIN category_attributes ca ON ca.category_id = ANY(ct.path)
JOIN attributes a ON ca.attribute_id = a.id
WHERE a.is_active = true
ORDER BY ct.id, ca.sort_order;

-- ===================
-- 10. Product Full Attributes View (Всі атрибути товару)
-- ===================
CREATE OR REPLACE VIEW product_full_attributes AS
SELECT
    p.id as product_id,
    p.name as product_name,
    p.category_id,
    a.id as attribute_id,
    a.code as attribute_code,
    a.name as attribute_name,
    a.type as attribute_type,
    a.unit as attribute_unit,
    a.is_filterable,
    a.is_comparable,
    COALESCE(ao.value, pa.value) as value,
    COALESCE((ao.label->>'uk'), ao.value, pa.value) as display_value,
    pa.numeric_value,
    pa.bool_value,
    ao.color_hex,
    ao.image_url as option_image
FROM products p
JOIN product_attributes pa ON pa.product_id = p.id
LEFT JOIN attributes a ON pa.attribute_id = a.id
LEFT JOIN attribute_options ao ON pa.option_id = ao.id
WHERE a.is_active = true OR a.id IS NULL;

-- ===================
-- 11. Triggers
-- ===================
CREATE TRIGGER update_attributes_updated_at
    BEFORE UPDATE ON attributes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================
-- 12. Functions for attribute operations
-- ===================

-- Function to get all attributes for a category (including inherited)
CREATE OR REPLACE FUNCTION get_category_attributes(cat_id UUID)
RETURNS TABLE (
    attribute_id UUID,
    attribute_code VARCHAR(100),
    attribute_name JSONB,
    attribute_type VARCHAR(50),
    attribute_unit VARCHAR(50),
    is_required BOOLEAN,
    is_variant BOOLEAN,
    sort_order INTEGER
) AS $$
WITH RECURSIVE ancestors AS (
    SELECT id, parent_id FROM categories WHERE id = cat_id
    UNION ALL
    SELECT c.id, c.parent_id FROM categories c
    JOIN ancestors a ON c.id = a.parent_id
)
SELECT DISTINCT ON (a.id)
    a.id,
    a.code,
    a.name,
    a.type,
    a.unit,
    ca.is_required,
    ca.is_variant,
    ca.sort_order
FROM ancestors anc
JOIN category_attributes ca ON ca.category_id = anc.id
JOIN attributes a ON ca.attribute_id = a.id
WHERE a.is_active = true
ORDER BY a.id, ca.sort_order;
$$ LANGUAGE SQL;

-- Function to get filterable attributes for category with counts
CREATE OR REPLACE FUNCTION get_category_filters(cat_id UUID)
RETURNS TABLE (
    attribute_id UUID,
    attribute_code VARCHAR(100),
    attribute_name JSONB,
    attribute_type VARCHAR(50),
    attribute_unit VARCHAR(50),
    options JSONB
) AS $$
SELECT
    a.id,
    a.code,
    a.name,
    a.type,
    a.unit,
    CASE
        WHEN a.type IN ('select', 'multiselect', 'color') THEN
            (SELECT jsonb_agg(jsonb_build_object(
                'id', ao.id,
                'value', ao.value,
                'label', ao.label,
                'color_hex', ao.color_hex,
                'count', (
                    SELECT COUNT(*) FROM product_attributes pa2
                    JOIN products p ON pa2.product_id = p.id
                    WHERE pa2.option_id = ao.id
                    AND p.category_id = cat_id
                    AND p.is_active = true
                )
            ) ORDER BY ao.sort_order)
            FROM attribute_options ao
            WHERE ao.attribute_id = a.id AND ao.is_active = true)
        WHEN a.type = 'number' THEN
            (SELECT jsonb_build_object(
                'min', MIN(pa2.numeric_value),
                'max', MAX(pa2.numeric_value)
            )
            FROM product_attributes pa2
            JOIN products p ON pa2.product_id = p.id
            WHERE pa2.attribute_id = a.id
            AND p.category_id = cat_id
            AND p.is_active = true)
        ELSE NULL
    END
FROM attributes a
JOIN category_attributes ca ON ca.attribute_id = a.id
WHERE ca.category_id = cat_id
AND a.is_filterable = true
AND a.is_active = true
ORDER BY ca.sort_order;
$$ LANGUAGE SQL;

-- ===================
-- 13. Comments
-- ===================
COMMENT ON TABLE attributes IS 'Dictionary of all product attributes in the system';
COMMENT ON TABLE attribute_options IS 'Predefined values for select/multiselect attributes';
COMMENT ON TABLE attribute_groups IS 'Logical grouping of attributes (Technical specs, Warranty, etc.)';
COMMENT ON TABLE category_attributes IS 'Template: which attributes belong to which category';
COMMENT ON TABLE product_variants IS 'Product variants (size, color combinations)';
COMMENT ON TABLE variant_attribute_values IS 'Attribute values that define each variant';
COMMENT ON COLUMN attributes.type IS 'text=free text, number=numeric, select=dropdown, multiselect=multiple choice, bool=yes/no, color=color picker, range=min-max range';
COMMENT ON COLUMN category_attributes.is_variant IS 'If true, this attribute creates product variants (like Size, Color)';
