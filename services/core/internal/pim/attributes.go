package pim

import (
	"context"
	"encoding/json"
	"time"
)

// AttributeType defines the type of attribute value
type AttributeType string

const (
	AttributeTypeText        AttributeType = "text"
	AttributeTypeNumber      AttributeType = "number"
	AttributeTypeSelect      AttributeType = "select"
	AttributeTypeMultiSelect AttributeType = "multiselect"
	AttributeTypeBool        AttributeType = "bool"
	AttributeTypeColor       AttributeType = "color"
	AttributeTypeRange       AttributeType = "range"
)

// LocalizedString is a map of language codes to strings
type LocalizedString map[string]string

// MarshalJSON for LocalizedString
func (ls LocalizedString) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string(ls))
}

// UnmarshalJSON for LocalizedString
func (ls *LocalizedString) UnmarshalJSON(data []byte) error {
	var m map[string]string
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	*ls = LocalizedString(m)
	return nil
}

// Get returns the value for the given language, falling back to "uk" or first available
func (ls LocalizedString) Get(lang string) string {
	if v, ok := ls[lang]; ok {
		return v
	}
	if v, ok := ls["uk"]; ok {
		return v
	}
	for _, v := range ls {
		return v
	}
	return ""
}

// ValidationRules for attribute values
type ValidationRules struct {
	Min       *float64 `json:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"`
	Pattern   string   `json:"pattern,omitempty"`
	MinLength *int     `json:"min_length,omitempty"`
	MaxLength *int     `json:"max_length,omitempty"`
}

// Attribute represents an attribute definition in the dictionary
type Attribute struct {
	ID                 string          `json:"id" db:"id"`
	Code               string          `json:"code" db:"code"`
	Name               LocalizedString `json:"name" db:"name"`
	Description        LocalizedString `json:"description,omitempty" db:"description"`
	Type               AttributeType   `json:"type" db:"type"`
	Unit               string          `json:"unit,omitempty" db:"unit"`
	IsFilterable       bool            `json:"is_filterable" db:"is_filterable"`
	IsSearchable       bool            `json:"is_searchable" db:"is_searchable"`
	IsComparable       bool            `json:"is_comparable" db:"is_comparable"`
	IsVisibleOnProduct bool            `json:"is_visible_on_product" db:"is_visible_on_product"`
	ValidationRules    *ValidationRules `json:"validation_rules,omitempty" db:"validation_rules"`
	SortOrder          int             `json:"sort_order" db:"sort_order"`
	IsActive           bool            `json:"is_active" db:"is_active"`
	Options            []*AttributeOption `json:"options,omitempty"` // Populated for select types
	CreatedAt          time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at" db:"updated_at"`
}

// AttributeOption represents a predefined value for select/multiselect attributes
type AttributeOption struct {
	ID          string          `json:"id" db:"id"`
	AttributeID string          `json:"attribute_id" db:"attribute_id"`
	Value       string          `json:"value" db:"value"`
	Label       LocalizedString `json:"label,omitempty" db:"label"`
	ColorHex    string          `json:"color_hex,omitempty" db:"color_hex"`
	ImageURL    string          `json:"image_url,omitempty" db:"image_url"`
	SortOrder   int             `json:"sort_order" db:"sort_order"`
	IsActive    bool            `json:"is_active" db:"is_active"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
}

// DisplayLabel returns the label in the given language or falls back to value
func (ao *AttributeOption) DisplayLabel(lang string) string {
	if ao.Label != nil {
		if l := ao.Label.Get(lang); l != "" {
			return l
		}
	}
	return ao.Value
}

// AttributeGroup represents a logical grouping of attributes
type AttributeGroup struct {
	ID         string          `json:"id" db:"id"`
	Code       string          `json:"code" db:"code"`
	Name       LocalizedString `json:"name" db:"name"`
	SortOrder  int             `json:"sort_order" db:"sort_order"`
	IsActive   bool            `json:"is_active" db:"is_active"`
	Attributes []*Attribute    `json:"attributes,omitempty"` // Populated when loading group
	CreatedAt  time.Time       `json:"created_at" db:"created_at"`
}

// CategoryAttribute represents the link between a category and an attribute
type CategoryAttribute struct {
	ID           string    `json:"id" db:"id"`
	CategoryID   string    `json:"category_id" db:"category_id"`
	AttributeID  string    `json:"attribute_id" db:"attribute_id"`
	IsRequired   bool      `json:"is_required" db:"is_required"`
	IsVariant    bool      `json:"is_variant" db:"is_variant"`
	DefaultValue string    `json:"default_value,omitempty" db:"default_value"`
	SortOrder    int       `json:"sort_order" db:"sort_order"`
	Attribute    *Attribute `json:"attribute,omitempty"` // Populated when loading
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// ProductAttributeValue represents a specific attribute value for a product
type ProductAttributeValue struct {
	ID           string      `json:"id" db:"id"`
	ProductID    string      `json:"product_id" db:"product_id"`
	AttributeID  string      `json:"attribute_id" db:"attribute_id"`
	OptionID     *string     `json:"option_id,omitempty" db:"option_id"`
	Value        string      `json:"value,omitempty" db:"value"`
	NumericValue *float64    `json:"numeric_value,omitempty" db:"numeric_value"`
	BoolValue    *bool       `json:"bool_value,omitempty" db:"bool_value"`
	// Populated fields
	Attribute    *Attribute  `json:"attribute,omitempty"`
	Option       *AttributeOption `json:"option,omitempty"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
}

// DisplayValue returns the human-readable value
func (pav *ProductAttributeValue) DisplayValue(lang string) string {
	if pav.Option != nil {
		return pav.Option.DisplayLabel(lang)
	}
	if pav.BoolValue != nil {
		if *pav.BoolValue {
			return "Так"
		}
		return "Ні"
	}
	if pav.NumericValue != nil {
		// Format with unit if available
		return pav.Value
	}
	return pav.Value
}

// ProductVariant represents a product variant (e.g., size/color combination)
type ProductVariant struct {
	ID             string    `json:"id" db:"id"`
	ProductID      string    `json:"product_id" db:"product_id"`
	SKU            string    `json:"sku,omitempty" db:"sku"`
	Barcode        string    `json:"barcode,omitempty" db:"barcode"`
	Price          *float64  `json:"price,omitempty" db:"price"`
	CompareAtPrice *float64  `json:"compare_at_price,omitempty" db:"compare_at_price"`
	CostPrice      *float64  `json:"cost_price,omitempty" db:"cost_price"`
	Stock          int       `json:"stock" db:"stock"`
	Weight         *float64  `json:"weight,omitempty" db:"weight"`
	ImageURL       string    `json:"image_url,omitempty" db:"image_url"`
	IsActive       bool      `json:"is_active" db:"is_active"`
	SortOrder      int       `json:"sort_order" db:"sort_order"`
	Attributes     []*VariantAttributeValue `json:"attributes,omitempty"` // Values that define this variant
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// VariantAttributeValue represents an attribute value for a variant
type VariantAttributeValue struct {
	ID          string `json:"id" db:"id"`
	VariantID   string `json:"variant_id" db:"variant_id"`
	AttributeID string `json:"attribute_id" db:"attribute_id"`
	OptionID    *string `json:"option_id,omitempty" db:"option_id"`
	Value       string `json:"value,omitempty" db:"value"`
	// Populated fields
	Attribute   *Attribute `json:"attribute,omitempty"`
	Option      *AttributeOption `json:"option,omitempty"`
}

// CategoryFilter represents a filter option for a category
type CategoryFilter struct {
	AttributeID   string          `json:"attribute_id"`
	AttributeCode string          `json:"attribute_code"`
	AttributeName LocalizedString `json:"attribute_name"`
	AttributeType AttributeType   `json:"attribute_type"`
	Unit          string          `json:"unit,omitempty"`
	Options       []*FilterOption `json:"options,omitempty"` // For select types
	MinValue      *float64        `json:"min_value,omitempty"` // For number types
	MaxValue      *float64        `json:"max_value,omitempty"` // For number types
}

// FilterOption represents a single filter option with count
type FilterOption struct {
	ID       string          `json:"id"`
	Value    string          `json:"value"`
	Label    LocalizedString `json:"label,omitempty"`
	ColorHex string          `json:"color_hex,omitempty"`
	Count    int             `json:"count"` // Number of products with this value
}

// AttributeRepository defines methods for attribute storage
type AttributeRepository interface {
	// Attribute CRUD
	CreateAttribute(ctx context.Context, attr *Attribute) error
	GetAttribute(ctx context.Context, id string) (*Attribute, error)
	GetAttributeByCode(ctx context.Context, code string) (*Attribute, error)
	ListAttributes(ctx context.Context) ([]*Attribute, error)
	UpdateAttribute(ctx context.Context, attr *Attribute) error
	DeleteAttribute(ctx context.Context, id string) error

	// Attribute Options
	CreateAttributeOption(ctx context.Context, opt *AttributeOption) error
	GetAttributeOptions(ctx context.Context, attributeID string) ([]*AttributeOption, error)
	UpdateAttributeOption(ctx context.Context, opt *AttributeOption) error
	DeleteAttributeOption(ctx context.Context, id string) error

	// Attribute Groups
	CreateAttributeGroup(ctx context.Context, group *AttributeGroup) error
	GetAttributeGroup(ctx context.Context, id string) (*AttributeGroup, error)
	ListAttributeGroups(ctx context.Context) ([]*AttributeGroup, error)
	UpdateAttributeGroup(ctx context.Context, group *AttributeGroup) error
	DeleteAttributeGroup(ctx context.Context, id string) error
	AddAttributeToGroup(ctx context.Context, groupID, attributeID string, sortOrder int) error
	RemoveAttributeFromGroup(ctx context.Context, groupID, attributeID string) error

	// Category Attributes
	AssignAttributeToCategory(ctx context.Context, catAttr *CategoryAttribute) error
	GetCategoryAttributes(ctx context.Context, categoryID string) ([]*CategoryAttribute, error)
	GetCategoryAttributesInherited(ctx context.Context, categoryID string) ([]*CategoryAttribute, error) // Including parent categories
	RemoveAttributeFromCategory(ctx context.Context, categoryID, attributeID string) error
	UpdateCategoryAttribute(ctx context.Context, catAttr *CategoryAttribute) error

	// Product Attributes
	SetProductAttributeValue(ctx context.Context, pav *ProductAttributeValue) error
	GetProductAttributes(ctx context.Context, productID string) ([]*ProductAttributeValue, error)
	DeleteProductAttribute(ctx context.Context, productID, attributeID string) error
	ClearProductAttributes(ctx context.Context, productID string) error

	// Product Variants
	CreateVariant(ctx context.Context, variant *ProductVariant) error
	GetVariant(ctx context.Context, id string) (*ProductVariant, error)
	GetProductVariants(ctx context.Context, productID string) ([]*ProductVariant, error)
	UpdateVariant(ctx context.Context, variant *ProductVariant) error
	DeleteVariant(ctx context.Context, id string) error
	SetVariantAttributeValue(ctx context.Context, vav *VariantAttributeValue) error
	GetVariantAttributes(ctx context.Context, variantID string) ([]*VariantAttributeValue, error)

	// Filters
	GetCategoryFilters(ctx context.Context, categoryID string) ([]*CategoryFilter, error)
}

// AttributeService handles attribute business logic
type AttributeService struct {
	repo AttributeRepository
}

// NewAttributeService creates a new attribute service
func NewAttributeService(repo AttributeRepository) *AttributeService {
	return &AttributeService{repo: repo}
}

// CreateAttribute creates a new attribute definition
func (s *AttributeService) CreateAttribute(ctx context.Context, attr *Attribute) error {
	if attr.Code == "" {
		return ErrAttributeCodeRequired
	}
	if attr.Name == nil || len(attr.Name) == 0 {
		return ErrAttributeNameRequired
	}
	if attr.Type == "" {
		return ErrAttributeTypeRequired
	}

	// Validate type
	switch attr.Type {
	case AttributeTypeText, AttributeTypeNumber, AttributeTypeSelect,
		AttributeTypeMultiSelect, AttributeTypeBool, AttributeTypeColor, AttributeTypeRange:
		// Valid
	default:
		return ErrInvalidAttributeType
	}

	attr.CreatedAt = time.Now()
	attr.UpdatedAt = time.Now()
	attr.IsActive = true

	return s.repo.CreateAttribute(ctx, attr)
}

// GetAttribute returns an attribute by ID with its options
func (s *AttributeService) GetAttribute(ctx context.Context, id string) (*Attribute, error) {
	attr, err := s.repo.GetAttribute(ctx, id)
	if err != nil {
		return nil, err
	}

	// Load options for select types
	if attr.Type == AttributeTypeSelect || attr.Type == AttributeTypeMultiSelect || attr.Type == AttributeTypeColor {
		options, err := s.repo.GetAttributeOptions(ctx, id)
		if err == nil {
			attr.Options = options
		}
	}

	return attr, nil
}

// GetAttributeByCode returns an attribute by code
func (s *AttributeService) GetAttributeByCode(ctx context.Context, code string) (*Attribute, error) {
	attr, err := s.repo.GetAttributeByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// Load options for select types
	if attr.Type == AttributeTypeSelect || attr.Type == AttributeTypeMultiSelect || attr.Type == AttributeTypeColor {
		options, err := s.repo.GetAttributeOptions(ctx, attr.ID)
		if err == nil {
			attr.Options = options
		}
	}

	return attr, nil
}

// ListAttributes returns all attributes
func (s *AttributeService) ListAttributes(ctx context.Context) ([]*Attribute, error) {
	attrs, err := s.repo.ListAttributes(ctx)
	if err != nil {
		return nil, err
	}

	// Load options for each select-type attribute
	for _, attr := range attrs {
		if attr.Type == AttributeTypeSelect || attr.Type == AttributeTypeMultiSelect || attr.Type == AttributeTypeColor {
			options, err := s.repo.GetAttributeOptions(ctx, attr.ID)
			if err == nil {
				attr.Options = options
			}
		}
	}

	return attrs, nil
}

// UpdateAttribute updates an existing attribute
func (s *AttributeService) UpdateAttribute(ctx context.Context, attr *Attribute) error {
	attr.UpdatedAt = time.Now()
	return s.repo.UpdateAttribute(ctx, attr)
}

// DeleteAttribute deletes an attribute
func (s *AttributeService) DeleteAttribute(ctx context.Context, id string) error {
	return s.repo.DeleteAttribute(ctx, id)
}

// AddAttributeOption adds a new option to a select attribute
func (s *AttributeService) AddAttributeOption(ctx context.Context, opt *AttributeOption) error {
	if opt.AttributeID == "" {
		return ErrAttributeIDRequired
	}
	if opt.Value == "" {
		return ErrOptionValueRequired
	}

	opt.CreatedAt = time.Now()
	opt.IsActive = true

	return s.repo.CreateAttributeOption(ctx, opt)
}

// GetAttributeOptions returns all options for an attribute
func (s *AttributeService) GetAttributeOptions(ctx context.Context, attributeID string) ([]*AttributeOption, error) {
	return s.repo.GetAttributeOptions(ctx, attributeID)
}

// UpdateAttributeOption updates an option
func (s *AttributeService) UpdateAttributeOption(ctx context.Context, opt *AttributeOption) error {
	return s.repo.UpdateAttributeOption(ctx, opt)
}

// DeleteAttributeOption deletes an option
func (s *AttributeService) DeleteAttributeOption(ctx context.Context, id string) error {
	return s.repo.DeleteAttributeOption(ctx, id)
}

// CreateAttributeGroup creates a new attribute group
func (s *AttributeService) CreateAttributeGroup(ctx context.Context, group *AttributeGroup) error {
	if group.Code == "" {
		return ErrGroupCodeRequired
	}
	if group.Name == nil || len(group.Name) == 0 {
		return ErrGroupNameRequired
	}

	group.CreatedAt = time.Now()
	group.IsActive = true

	return s.repo.CreateAttributeGroup(ctx, group)
}

// GetAttributeGroup returns a group with its attributes
func (s *AttributeService) GetAttributeGroup(ctx context.Context, id string) (*AttributeGroup, error) {
	return s.repo.GetAttributeGroup(ctx, id)
}

// ListAttributeGroups returns all groups
func (s *AttributeService) ListAttributeGroups(ctx context.Context) ([]*AttributeGroup, error) {
	return s.repo.ListAttributeGroups(ctx)
}

// AssignAttributeToCategory assigns an attribute to a category
func (s *AttributeService) AssignAttributeToCategory(ctx context.Context, catAttr *CategoryAttribute) error {
	if catAttr.CategoryID == "" {
		return ErrCategoryIDRequired
	}
	if catAttr.AttributeID == "" {
		return ErrAttributeIDRequired
	}

	catAttr.CreatedAt = time.Now()
	return s.repo.AssignAttributeToCategory(ctx, catAttr)
}

// GetCategoryAttributes returns attributes for a category
func (s *AttributeService) GetCategoryAttributes(ctx context.Context, categoryID string) ([]*CategoryAttribute, error) {
	return s.repo.GetCategoryAttributes(ctx, categoryID)
}

// GetCategoryAttributesInherited returns all attributes including inherited from parent categories
func (s *AttributeService) GetCategoryAttributesInherited(ctx context.Context, categoryID string) ([]*CategoryAttribute, error) {
	return s.repo.GetCategoryAttributesInherited(ctx, categoryID)
}

// SetProductAttribute sets an attribute value for a product
func (s *AttributeService) SetProductAttribute(ctx context.Context, pav *ProductAttributeValue) error {
	if pav.ProductID == "" {
		return ErrProductIDRequired
	}
	if pav.AttributeID == "" {
		return ErrAttributeIDRequired
	}

	pav.CreatedAt = time.Now()
	return s.repo.SetProductAttributeValue(ctx, pav)
}

// GetProductAttributes returns all attribute values for a product
func (s *AttributeService) GetProductAttributes(ctx context.Context, productID string) ([]*ProductAttributeValue, error) {
	return s.repo.GetProductAttributes(ctx, productID)
}

// SetProductAttributes sets multiple attribute values for a product
func (s *AttributeService) SetProductAttributes(ctx context.Context, productID string, values []*ProductAttributeValue) error {
	// Clear existing and set new
	if err := s.repo.ClearProductAttributes(ctx, productID); err != nil {
		return err
	}

	for _, pav := range values {
		pav.ProductID = productID
		pav.CreatedAt = time.Now()
		if err := s.repo.SetProductAttributeValue(ctx, pav); err != nil {
			return err
		}
	}

	return nil
}

// CreateVariant creates a new product variant
func (s *AttributeService) CreateVariant(ctx context.Context, variant *ProductVariant) error {
	if variant.ProductID == "" {
		return ErrProductIDRequired
	}

	variant.CreatedAt = time.Now()
	variant.UpdatedAt = time.Now()
	variant.IsActive = true

	return s.repo.CreateVariant(ctx, variant)
}

// GetProductVariants returns all variants for a product
func (s *AttributeService) GetProductVariants(ctx context.Context, productID string) ([]*ProductVariant, error) {
	variants, err := s.repo.GetProductVariants(ctx, productID)
	if err != nil {
		return nil, err
	}

	// Load attributes for each variant
	for _, v := range variants {
		attrs, err := s.repo.GetVariantAttributes(ctx, v.ID)
		if err == nil {
			v.Attributes = attrs
		}
	}

	return variants, nil
}

// GetCategoryFilters returns filterable attributes with values for a category
func (s *AttributeService) GetCategoryFilters(ctx context.Context, categoryID string) ([]*CategoryFilter, error) {
	return s.repo.GetCategoryFilters(ctx, categoryID)
}

// Errors
var (
	ErrAttributeCodeRequired = &Error{Code: "ATTR_CODE_REQUIRED", Message: "attribute code is required"}
	ErrAttributeNameRequired = &Error{Code: "ATTR_NAME_REQUIRED", Message: "attribute name is required"}
	ErrAttributeTypeRequired = &Error{Code: "ATTR_TYPE_REQUIRED", Message: "attribute type is required"}
	ErrInvalidAttributeType  = &Error{Code: "INVALID_ATTR_TYPE", Message: "invalid attribute type"}
	ErrAttributeIDRequired   = &Error{Code: "ATTR_ID_REQUIRED", Message: "attribute ID is required"}
	ErrOptionValueRequired   = &Error{Code: "OPT_VALUE_REQUIRED", Message: "option value is required"}
	ErrGroupCodeRequired     = &Error{Code: "GROUP_CODE_REQUIRED", Message: "group code is required"}
	ErrGroupNameRequired     = &Error{Code: "GROUP_NAME_REQUIRED", Message: "group name is required"}
	ErrCategoryIDRequired    = &Error{Code: "CAT_ID_REQUIRED", Message: "category ID is required"}
	ErrProductIDRequired     = &Error{Code: "PROD_ID_REQUIRED", Message: "product ID is required"}
)

// Error represents a domain error
type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *Error) Error() string {
	return e.Message
}
