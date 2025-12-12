package pim

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PostgresAttributeRepository implements AttributeRepository using PostgreSQL
type PostgresAttributeRepository struct {
	db *sqlx.DB
}

// NewPostgresAttributeRepository creates a new PostgreSQL attribute repository
func NewPostgresAttributeRepository(db *sqlx.DB) *PostgresAttributeRepository {
	return &PostgresAttributeRepository{db: db}
}

// CreateAttribute creates a new attribute
func (r *PostgresAttributeRepository) CreateAttribute(ctx context.Context, attr *Attribute) error {
	if attr.ID == "" {
		attr.ID = uuid.New().String()
	}

	nameJSON, err := json.Marshal(attr.Name)
	if err != nil {
		return fmt.Errorf("marshal name: %w", err)
	}

	var descJSON []byte
	if attr.Description != nil {
		descJSON, _ = json.Marshal(attr.Description)
	}

	var rulesJSON []byte
	if attr.ValidationRules != nil {
		rulesJSON, _ = json.Marshal(attr.ValidationRules)
	}

	query := `
		INSERT INTO attributes (id, code, name, description, type, unit, is_filterable, is_searchable,
			is_comparable, is_visible_on_product, validation_rules, sort_order, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`
	_, err = r.db.ExecContext(ctx, query,
		attr.ID, attr.Code, nameJSON, descJSON, attr.Type, attr.Unit,
		attr.IsFilterable, attr.IsSearchable, attr.IsComparable, attr.IsVisibleOnProduct,
		rulesJSON, attr.SortOrder, attr.IsActive, attr.CreatedAt, attr.UpdatedAt,
	)
	return err
}

// GetAttribute returns an attribute by ID
func (r *PostgresAttributeRepository) GetAttribute(ctx context.Context, id string) (*Attribute, error) {
	query := `
		SELECT id, code, name, description, type, unit, is_filterable, is_searchable,
			is_comparable, is_visible_on_product, validation_rules, sort_order, is_active, created_at, updated_at
		FROM attributes WHERE id = $1
	`
	return r.scanAttribute(ctx, query, id)
}

// GetAttributeByCode returns an attribute by code
func (r *PostgresAttributeRepository) GetAttributeByCode(ctx context.Context, code string) (*Attribute, error) {
	query := `
		SELECT id, code, name, description, type, unit, is_filterable, is_searchable,
			is_comparable, is_visible_on_product, validation_rules, sort_order, is_active, created_at, updated_at
		FROM attributes WHERE code = $1
	`
	return r.scanAttribute(ctx, query, code)
}

func (r *PostgresAttributeRepository) scanAttribute(ctx context.Context, query string, arg interface{}) (*Attribute, error) {
	var attr Attribute
	var nameJSON, descJSON, rulesJSON []byte

	err := r.db.QueryRowContext(ctx, query, arg).Scan(
		&attr.ID, &attr.Code, &nameJSON, &descJSON, &attr.Type, &attr.Unit,
		&attr.IsFilterable, &attr.IsSearchable, &attr.IsComparable, &attr.IsVisibleOnProduct,
		&rulesJSON, &attr.SortOrder, &attr.IsActive, &attr.CreatedAt, &attr.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("attribute not found")
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(nameJSON, &attr.Name)
	if descJSON != nil {
		json.Unmarshal(descJSON, &attr.Description)
	}
	if rulesJSON != nil {
		json.Unmarshal(rulesJSON, &attr.ValidationRules)
	}

	return &attr, nil
}

// ListAttributes returns all attributes
func (r *PostgresAttributeRepository) ListAttributes(ctx context.Context) ([]*Attribute, error) {
	query := `
		SELECT id, code, name, description, type, unit, is_filterable, is_searchable,
			is_comparable, is_visible_on_product, validation_rules, sort_order, is_active, created_at, updated_at
		FROM attributes WHERE is_active = true ORDER BY sort_order, code
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attrs []*Attribute
	for rows.Next() {
		var attr Attribute
		var nameJSON, descJSON, rulesJSON []byte

		err := rows.Scan(
			&attr.ID, &attr.Code, &nameJSON, &descJSON, &attr.Type, &attr.Unit,
			&attr.IsFilterable, &attr.IsSearchable, &attr.IsComparable, &attr.IsVisibleOnProduct,
			&rulesJSON, &attr.SortOrder, &attr.IsActive, &attr.CreatedAt, &attr.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(nameJSON, &attr.Name)
		if descJSON != nil {
			json.Unmarshal(descJSON, &attr.Description)
		}
		if rulesJSON != nil {
			json.Unmarshal(rulesJSON, &attr.ValidationRules)
		}

		attrs = append(attrs, &attr)
	}

	return attrs, nil
}

// UpdateAttribute updates an attribute
func (r *PostgresAttributeRepository) UpdateAttribute(ctx context.Context, attr *Attribute) error {
	nameJSON, _ := json.Marshal(attr.Name)
	descJSON, _ := json.Marshal(attr.Description)
	rulesJSON, _ := json.Marshal(attr.ValidationRules)

	query := `
		UPDATE attributes SET
			code = $2, name = $3, description = $4, type = $5, unit = $6,
			is_filterable = $7, is_searchable = $8, is_comparable = $9, is_visible_on_product = $10,
			validation_rules = $11, sort_order = $12, is_active = $13, updated_at = $14
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query,
		attr.ID, attr.Code, nameJSON, descJSON, attr.Type, attr.Unit,
		attr.IsFilterable, attr.IsSearchable, attr.IsComparable, attr.IsVisibleOnProduct,
		rulesJSON, attr.SortOrder, attr.IsActive, attr.UpdatedAt,
	)
	return err
}

// DeleteAttribute deletes an attribute
func (r *PostgresAttributeRepository) DeleteAttribute(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM attributes WHERE id = $1", id)
	return err
}

// CreateAttributeOption creates a new option
func (r *PostgresAttributeRepository) CreateAttributeOption(ctx context.Context, opt *AttributeOption) error {
	if opt.ID == "" {
		opt.ID = uuid.New().String()
	}

	var labelJSON []byte
	if opt.Label != nil {
		labelJSON, _ = json.Marshal(opt.Label)
	}

	query := `
		INSERT INTO attribute_options (id, attribute_id, value, label, color_hex, image_url, sort_order, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.ExecContext(ctx, query,
		opt.ID, opt.AttributeID, opt.Value, labelJSON, opt.ColorHex, opt.ImageURL,
		opt.SortOrder, opt.IsActive, opt.CreatedAt,
	)
	return err
}

// GetAttributeOptions returns all options for an attribute
func (r *PostgresAttributeRepository) GetAttributeOptions(ctx context.Context, attributeID string) ([]*AttributeOption, error) {
	query := `
		SELECT id, attribute_id, value, label, color_hex, image_url, sort_order, is_active, created_at
		FROM attribute_options WHERE attribute_id = $1 AND is_active = true ORDER BY sort_order
	`
	rows, err := r.db.QueryContext(ctx, query, attributeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var opts []*AttributeOption
	for rows.Next() {
		var opt AttributeOption
		var labelJSON []byte
		var colorHex, imageURL sql.NullString

		err := rows.Scan(
			&opt.ID, &opt.AttributeID, &opt.Value, &labelJSON,
			&colorHex, &imageURL, &opt.SortOrder, &opt.IsActive, &opt.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if labelJSON != nil {
			json.Unmarshal(labelJSON, &opt.Label)
		}
		if colorHex.Valid {
			opt.ColorHex = colorHex.String
		}
		if imageURL.Valid {
			opt.ImageURL = imageURL.String
		}

		opts = append(opts, &opt)
	}

	return opts, nil
}

// UpdateAttributeOption updates an option
func (r *PostgresAttributeRepository) UpdateAttributeOption(ctx context.Context, opt *AttributeOption) error {
	labelJSON, _ := json.Marshal(opt.Label)

	query := `
		UPDATE attribute_options SET
			value = $2, label = $3, color_hex = $4, image_url = $5, sort_order = $6, is_active = $7
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query,
		opt.ID, opt.Value, labelJSON, opt.ColorHex, opt.ImageURL, opt.SortOrder, opt.IsActive,
	)
	return err
}

// DeleteAttributeOption deletes an option
func (r *PostgresAttributeRepository) DeleteAttributeOption(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM attribute_options WHERE id = $1", id)
	return err
}

// CreateAttributeGroup creates a new group
func (r *PostgresAttributeRepository) CreateAttributeGroup(ctx context.Context, group *AttributeGroup) error {
	if group.ID == "" {
		group.ID = uuid.New().String()
	}

	nameJSON, _ := json.Marshal(group.Name)

	query := `
		INSERT INTO attribute_groups (id, code, name, sort_order, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.ExecContext(ctx, query,
		group.ID, group.Code, nameJSON, group.SortOrder, group.IsActive, group.CreatedAt,
	)
	return err
}

// GetAttributeGroup returns a group by ID
func (r *PostgresAttributeRepository) GetAttributeGroup(ctx context.Context, id string) (*AttributeGroup, error) {
	query := `SELECT id, code, name, sort_order, is_active, created_at FROM attribute_groups WHERE id = $1`

	var group AttributeGroup
	var nameJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&group.ID, &group.Code, &nameJSON, &group.SortOrder, &group.IsActive, &group.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("group not found")
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(nameJSON, &group.Name)
	return &group, nil
}

// ListAttributeGroups returns all groups
func (r *PostgresAttributeRepository) ListAttributeGroups(ctx context.Context) ([]*AttributeGroup, error) {
	query := `SELECT id, code, name, sort_order, is_active, created_at FROM attribute_groups WHERE is_active = true ORDER BY sort_order`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []*AttributeGroup
	for rows.Next() {
		var group AttributeGroup
		var nameJSON []byte

		err := rows.Scan(&group.ID, &group.Code, &nameJSON, &group.SortOrder, &group.IsActive, &group.CreatedAt)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(nameJSON, &group.Name)
		groups = append(groups, &group)
	}

	return groups, nil
}

// UpdateAttributeGroup updates a group
func (r *PostgresAttributeRepository) UpdateAttributeGroup(ctx context.Context, group *AttributeGroup) error {
	nameJSON, _ := json.Marshal(group.Name)

	query := `UPDATE attribute_groups SET code = $2, name = $3, sort_order = $4, is_active = $5 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, group.ID, group.Code, nameJSON, group.SortOrder, group.IsActive)
	return err
}

// DeleteAttributeGroup deletes a group
func (r *PostgresAttributeRepository) DeleteAttributeGroup(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM attribute_groups WHERE id = $1", id)
	return err
}

// AddAttributeToGroup adds an attribute to a group
func (r *PostgresAttributeRepository) AddAttributeToGroup(ctx context.Context, groupID, attributeID string, sortOrder int) error {
	query := `
		INSERT INTO attribute_group_items (id, group_id, attribute_id, sort_order)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (group_id, attribute_id) DO UPDATE SET sort_order = $4
	`
	_, err := r.db.ExecContext(ctx, query, uuid.New().String(), groupID, attributeID, sortOrder)
	return err
}

// RemoveAttributeFromGroup removes an attribute from a group
func (r *PostgresAttributeRepository) RemoveAttributeFromGroup(ctx context.Context, groupID, attributeID string) error {
	query := `DELETE FROM attribute_group_items WHERE group_id = $1 AND attribute_id = $2`
	_, err := r.db.ExecContext(ctx, query, groupID, attributeID)
	return err
}

// AssignAttributeToCategory assigns an attribute to a category
func (r *PostgresAttributeRepository) AssignAttributeToCategory(ctx context.Context, catAttr *CategoryAttribute) error {
	if catAttr.ID == "" {
		catAttr.ID = uuid.New().String()
	}

	query := `
		INSERT INTO category_attributes (id, category_id, attribute_id, is_required, is_variant, default_value, sort_order, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (category_id, attribute_id) DO UPDATE SET
			is_required = $4, is_variant = $5, default_value = $6, sort_order = $7
	`
	_, err := r.db.ExecContext(ctx, query,
		catAttr.ID, catAttr.CategoryID, catAttr.AttributeID,
		catAttr.IsRequired, catAttr.IsVariant, catAttr.DefaultValue, catAttr.SortOrder, catAttr.CreatedAt,
	)
	return err
}

// GetCategoryAttributes returns attributes for a category
func (r *PostgresAttributeRepository) GetCategoryAttributes(ctx context.Context, categoryID string) ([]*CategoryAttribute, error) {
	query := `
		SELECT ca.id, ca.category_id, ca.attribute_id, ca.is_required, ca.is_variant, ca.default_value, ca.sort_order, ca.created_at,
			a.id, a.code, a.name, a.type, a.unit, a.is_filterable
		FROM category_attributes ca
		JOIN attributes a ON ca.attribute_id = a.id
		WHERE ca.category_id = $1 AND a.is_active = true
		ORDER BY ca.sort_order
	`
	return r.scanCategoryAttributes(ctx, query, categoryID)
}

// GetCategoryAttributesInherited returns all attributes including inherited
func (r *PostgresAttributeRepository) GetCategoryAttributesInherited(ctx context.Context, categoryID string) ([]*CategoryAttribute, error) {
	query := `
		WITH RECURSIVE category_tree AS (
			SELECT id, parent_id FROM categories WHERE id = $1
			UNION ALL
			SELECT c.id, c.parent_id FROM categories c
			JOIN category_tree ct ON c.id = ct.parent_id
		)
		SELECT DISTINCT ON (a.id)
			ca.id, ca.category_id, ca.attribute_id, ca.is_required, ca.is_variant, ca.default_value, ca.sort_order, ca.created_at,
			a.id, a.code, a.name, a.type, a.unit, a.is_filterable
		FROM category_tree ct
		JOIN category_attributes ca ON ca.category_id = ct.id
		JOIN attributes a ON ca.attribute_id = a.id
		WHERE a.is_active = true
		ORDER BY a.id, ca.sort_order
	`
	return r.scanCategoryAttributes(ctx, query, categoryID)
}

func (r *PostgresAttributeRepository) scanCategoryAttributes(ctx context.Context, query string, categoryID string) ([]*CategoryAttribute, error) {
	rows, err := r.db.QueryContext(ctx, query, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attrs []*CategoryAttribute
	for rows.Next() {
		var ca CategoryAttribute
		var attr Attribute
		var nameJSON []byte
		var defaultValue sql.NullString

		err := rows.Scan(
			&ca.ID, &ca.CategoryID, &ca.AttributeID, &ca.IsRequired, &ca.IsVariant,
			&defaultValue, &ca.SortOrder, &ca.CreatedAt,
			&attr.ID, &attr.Code, &nameJSON, &attr.Type, &attr.Unit, &attr.IsFilterable,
		)
		if err != nil {
			return nil, err
		}

		if defaultValue.Valid {
			ca.DefaultValue = defaultValue.String
		}
		json.Unmarshal(nameJSON, &attr.Name)
		ca.Attribute = &attr

		attrs = append(attrs, &ca)
	}

	return attrs, nil
}

// RemoveAttributeFromCategory removes an attribute from a category
func (r *PostgresAttributeRepository) RemoveAttributeFromCategory(ctx context.Context, categoryID, attributeID string) error {
	query := `DELETE FROM category_attributes WHERE category_id = $1 AND attribute_id = $2`
	_, err := r.db.ExecContext(ctx, query, categoryID, attributeID)
	return err
}

// UpdateCategoryAttribute updates a category attribute
func (r *PostgresAttributeRepository) UpdateCategoryAttribute(ctx context.Context, catAttr *CategoryAttribute) error {
	query := `
		UPDATE category_attributes SET
			is_required = $3, is_variant = $4, default_value = $5, sort_order = $6
		WHERE category_id = $1 AND attribute_id = $2
	`
	_, err := r.db.ExecContext(ctx, query,
		catAttr.CategoryID, catAttr.AttributeID, catAttr.IsRequired,
		catAttr.IsVariant, catAttr.DefaultValue, catAttr.SortOrder,
	)
	return err
}

// SetProductAttributeValue sets an attribute value for a product
func (r *PostgresAttributeRepository) SetProductAttributeValue(ctx context.Context, pav *ProductAttributeValue) error {
	if pav.ID == "" {
		pav.ID = uuid.New().String()
	}

	query := `
		INSERT INTO product_attributes (id, product_id, attribute_id, option_id, value, numeric_value, bool_value, created_at, name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '')
		ON CONFLICT (product_id, attribute_id) DO UPDATE SET
			option_id = $4, value = $5, numeric_value = $6, bool_value = $7
	`
	_, err := r.db.ExecContext(ctx, query,
		pav.ID, pav.ProductID, pav.AttributeID, pav.OptionID,
		pav.Value, pav.NumericValue, pav.BoolValue, pav.CreatedAt,
	)
	return err
}

// GetProductAttributes returns all attribute values for a product
func (r *PostgresAttributeRepository) GetProductAttributes(ctx context.Context, productID string) ([]*ProductAttributeValue, error) {
	query := `
		SELECT pa.id, pa.product_id, pa.attribute_id, pa.option_id, pa.value, pa.numeric_value, pa.bool_value, pa.created_at,
			a.id, a.code, a.name, a.type, a.unit,
			ao.id, ao.value, ao.label, ao.color_hex
		FROM product_attributes pa
		JOIN attributes a ON pa.attribute_id = a.id
		LEFT JOIN attribute_options ao ON pa.option_id = ao.id
		WHERE pa.product_id = $1 AND a.is_active = true
	`
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attrs []*ProductAttributeValue
	for rows.Next() {
		var pav ProductAttributeValue
		var attr Attribute
		var opt AttributeOption
		var nameJSON, labelJSON []byte
		var optID, optValue, colorHex sql.NullString

		err := rows.Scan(
			&pav.ID, &pav.ProductID, &pav.AttributeID, &pav.OptionID, &pav.Value,
			&pav.NumericValue, &pav.BoolValue, &pav.CreatedAt,
			&attr.ID, &attr.Code, &nameJSON, &attr.Type, &attr.Unit,
			&optID, &optValue, &labelJSON, &colorHex,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(nameJSON, &attr.Name)
		pav.Attribute = &attr

		if optID.Valid {
			opt.ID = optID.String
			opt.Value = optValue.String
			if labelJSON != nil {
				json.Unmarshal(labelJSON, &opt.Label)
			}
			if colorHex.Valid {
				opt.ColorHex = colorHex.String
			}
			pav.Option = &opt
		}

		attrs = append(attrs, &pav)
	}

	return attrs, nil
}

// DeleteProductAttribute deletes a product attribute
func (r *PostgresAttributeRepository) DeleteProductAttribute(ctx context.Context, productID, attributeID string) error {
	query := `DELETE FROM product_attributes WHERE product_id = $1 AND attribute_id = $2`
	_, err := r.db.ExecContext(ctx, query, productID, attributeID)
	return err
}

// ClearProductAttributes clears all attributes for a product
func (r *PostgresAttributeRepository) ClearProductAttributes(ctx context.Context, productID string) error {
	query := `DELETE FROM product_attributes WHERE product_id = $1 AND attribute_id IS NOT NULL`
	_, err := r.db.ExecContext(ctx, query, productID)
	return err
}

// CreateVariant creates a new product variant
func (r *PostgresAttributeRepository) CreateVariant(ctx context.Context, variant *ProductVariant) error {
	if variant.ID == "" {
		variant.ID = uuid.New().String()
	}

	query := `
		INSERT INTO product_variants (id, product_id, sku, barcode, price, compare_at_price, cost_price, stock, weight, image_url, is_active, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.db.ExecContext(ctx, query,
		variant.ID, variant.ProductID, variant.SKU, variant.Barcode,
		variant.Price, variant.CompareAtPrice, variant.CostPrice, variant.Stock,
		variant.Weight, variant.ImageURL, variant.IsActive, variant.SortOrder,
		variant.CreatedAt, variant.UpdatedAt,
	)
	return err
}

// GetVariant returns a variant by ID
func (r *PostgresAttributeRepository) GetVariant(ctx context.Context, id string) (*ProductVariant, error) {
	query := `
		SELECT id, product_id, sku, barcode, price, compare_at_price, cost_price, stock, weight, image_url, is_active, sort_order, created_at, updated_at
		FROM product_variants WHERE id = $1
	`
	var v ProductVariant
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&v.ID, &v.ProductID, &v.SKU, &v.Barcode, &v.Price, &v.CompareAtPrice,
		&v.CostPrice, &v.Stock, &v.Weight, &v.ImageURL, &v.IsActive, &v.SortOrder,
		&v.CreatedAt, &v.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("variant not found")
	}
	return &v, err
}

// GetProductVariants returns all variants for a product
func (r *PostgresAttributeRepository) GetProductVariants(ctx context.Context, productID string) ([]*ProductVariant, error) {
	query := `
		SELECT id, product_id, sku, barcode, price, compare_at_price, cost_price, stock, weight, image_url, is_active, sort_order, created_at, updated_at
		FROM product_variants WHERE product_id = $1 AND is_active = true ORDER BY sort_order
	`
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variants []*ProductVariant
	for rows.Next() {
		var v ProductVariant
		err := rows.Scan(
			&v.ID, &v.ProductID, &v.SKU, &v.Barcode, &v.Price, &v.CompareAtPrice,
			&v.CostPrice, &v.Stock, &v.Weight, &v.ImageURL, &v.IsActive, &v.SortOrder,
			&v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		variants = append(variants, &v)
	}

	return variants, nil
}

// UpdateVariant updates a variant
func (r *PostgresAttributeRepository) UpdateVariant(ctx context.Context, variant *ProductVariant) error {
	query := `
		UPDATE product_variants SET
			sku = $2, barcode = $3, price = $4, compare_at_price = $5, cost_price = $6,
			stock = $7, weight = $8, image_url = $9, is_active = $10, sort_order = $11, updated_at = $12
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query,
		variant.ID, variant.SKU, variant.Barcode, variant.Price, variant.CompareAtPrice,
		variant.CostPrice, variant.Stock, variant.Weight, variant.ImageURL,
		variant.IsActive, variant.SortOrder, variant.UpdatedAt,
	)
	return err
}

// DeleteVariant deletes a variant
func (r *PostgresAttributeRepository) DeleteVariant(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM product_variants WHERE id = $1", id)
	return err
}

// SetVariantAttributeValue sets an attribute value for a variant
func (r *PostgresAttributeRepository) SetVariantAttributeValue(ctx context.Context, vav *VariantAttributeValue) error {
	if vav.ID == "" {
		vav.ID = uuid.New().String()
	}

	query := `
		INSERT INTO variant_attribute_values (id, variant_id, attribute_id, option_id, value)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (variant_id, attribute_id) DO UPDATE SET option_id = $4, value = $5
	`
	_, err := r.db.ExecContext(ctx, query, vav.ID, vav.VariantID, vav.AttributeID, vav.OptionID, vav.Value)
	return err
}

// GetVariantAttributes returns all attribute values for a variant
func (r *PostgresAttributeRepository) GetVariantAttributes(ctx context.Context, variantID string) ([]*VariantAttributeValue, error) {
	query := `
		SELECT vav.id, vav.variant_id, vav.attribute_id, vav.option_id, vav.value,
			a.code, a.name, a.type,
			ao.value, ao.label, ao.color_hex
		FROM variant_attribute_values vav
		JOIN attributes a ON vav.attribute_id = a.id
		LEFT JOIN attribute_options ao ON vav.option_id = ao.id
		WHERE vav.variant_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, variantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attrs []*VariantAttributeValue
	for rows.Next() {
		var vav VariantAttributeValue
		var attr Attribute
		var opt AttributeOption
		var nameJSON, labelJSON []byte
		var optValue, colorHex sql.NullString

		err := rows.Scan(
			&vav.ID, &vav.VariantID, &vav.AttributeID, &vav.OptionID, &vav.Value,
			&attr.Code, &nameJSON, &attr.Type,
			&optValue, &labelJSON, &colorHex,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(nameJSON, &attr.Name)
		vav.Attribute = &attr

		if optValue.Valid {
			opt.Value = optValue.String
			if labelJSON != nil {
				json.Unmarshal(labelJSON, &opt.Label)
			}
			if colorHex.Valid {
				opt.ColorHex = colorHex.String
			}
			vav.Option = &opt
		}

		attrs = append(attrs, &vav)
	}

	return attrs, nil
}

// GetCategoryFilters returns filterable attributes with values for a category
func (r *PostgresAttributeRepository) GetCategoryFilters(ctx context.Context, categoryID string) ([]*CategoryFilter, error) {
	query := `
		SELECT
			a.id, a.code, a.name, a.type, a.unit,
			CASE
				WHEN a.type IN ('select', 'multiselect', 'color') THEN (
					SELECT json_agg(json_build_object(
						'id', ao.id,
						'value', ao.value,
						'label', ao.label,
						'color_hex', ao.color_hex,
						'count', (
							SELECT COUNT(DISTINCT pa.product_id)
							FROM product_attributes pa
							JOIN products p ON pa.product_id = p.id
							WHERE pa.option_id = ao.id AND p.category_id = $1 AND p.is_active = true
						)
					) ORDER BY ao.sort_order)
					FROM attribute_options ao
					WHERE ao.attribute_id = a.id AND ao.is_active = true
				)
				WHEN a.type = 'number' THEN (
					SELECT json_build_object(
						'min', MIN(pa.numeric_value),
						'max', MAX(pa.numeric_value)
					)
					FROM product_attributes pa
					JOIN products p ON pa.product_id = p.id
					WHERE pa.attribute_id = a.id AND p.category_id = $1 AND p.is_active = true
				)
				ELSE NULL
			END as filter_data
		FROM attributes a
		JOIN category_attributes ca ON ca.attribute_id = a.id
		WHERE ca.category_id = $1 AND a.is_filterable = true AND a.is_active = true
		ORDER BY ca.sort_order
	`

	rows, err := r.db.QueryContext(ctx, query, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var filters []*CategoryFilter
	for rows.Next() {
		var f CategoryFilter
		var nameJSON, filterDataJSON []byte

		err := rows.Scan(&f.AttributeID, &f.AttributeCode, &nameJSON, &f.AttributeType, &f.Unit, &filterDataJSON)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(nameJSON, &f.AttributeName)

		if filterDataJSON != nil {
			if f.AttributeType == AttributeTypeSelect || f.AttributeType == AttributeTypeMultiSelect || f.AttributeType == AttributeTypeColor {
				json.Unmarshal(filterDataJSON, &f.Options)
			} else if f.AttributeType == AttributeTypeNumber {
				var rangeData struct {
					Min *float64 `json:"min"`
					Max *float64 `json:"max"`
				}
				json.Unmarshal(filterDataJSON, &rangeData)
				f.MinValue = rangeData.Min
				f.MaxValue = rangeData.Max
			}
		}

		filters = append(filters, &f)
	}

	return filters, nil
}
