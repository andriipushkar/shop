# Products Module

Модуль управління товарами Shop Platform.

## Огляд

Модуль Products забезпечує:
- Управління каталогом товарів
- Варіанти товарів (розміри, кольори)
- Зображення та медіа
- SEO оптимізацію
- Імпорт/експорт товарів

## Моделі даних

### Product

```go
// internal/products/models.go
package products

import (
	"time"

	"github.com/shopspring/decimal"
)

type ProductStatus string

const (
	ProductStatusDraft     ProductStatus = "draft"
	ProductStatusActive    ProductStatus = "active"
	ProductStatusArchived  ProductStatus = "archived"
)

type ProductType string

const (
	ProductTypeSimple   ProductType = "simple"
	ProductTypeVariable ProductType = "variable"
	ProductTypeDigital  ProductType = "digital"
	ProductTypeService  ProductType = "service"
)

type Product struct {
	ID               string            `gorm:"primaryKey" json:"id"`
	TenantID         string            `gorm:"index" json:"tenant_id"`

	// Basic Info
	SKU              string            `gorm:"index" json:"sku"`
	Name             string            `json:"name"`
	Slug             string            `gorm:"index" json:"slug"`
	Description      string            `json:"description,omitempty"`
	ShortDescription string            `json:"short_description,omitempty"`

	// Pricing
	Price            decimal.Decimal   `json:"price"`
	CompareAtPrice   *decimal.Decimal  `json:"compare_at_price,omitempty"`
	CostPrice        *decimal.Decimal  `json:"cost_price,omitempty"`
	Currency         string            `json:"currency"`

	// Status
	Status           ProductStatus     `json:"status"`
	Visibility       string            `json:"visibility"` // visible, hidden, catalog, search
	Type             ProductType       `json:"type"`

	// Physical Properties
	Weight           *decimal.Decimal  `json:"weight,omitempty"`
	WeightUnit       string            `json:"weight_unit"` // kg, g, lb, oz
	Length           *decimal.Decimal  `json:"length,omitempty"`
	Width            *decimal.Decimal  `json:"width,omitempty"`
	Height           *decimal.Decimal  `json:"height,omitempty"`
	DimensionUnit    string            `json:"dimension_unit"` // cm, m, in

	// Inventory
	TrackInventory   bool              `json:"track_inventory"`
	InventoryQuantity int              `json:"inventory_quantity"`
	AllowBackorder   bool              `json:"allow_backorder"`
	InventoryPolicy  string            `json:"inventory_policy"` // deny, allow
	LowStockThreshold int              `json:"low_stock_threshold"`

	// Shipping
	RequiresShipping bool              `json:"requires_shipping"`

	// Tax
	Taxable          bool              `json:"taxable"`
	TaxClass         string            `json:"tax_class,omitempty"`

	// SEO
	MetaTitle        string            `json:"meta_title,omitempty"`
	MetaDescription  string            `json:"meta_description,omitempty"`
	MetaKeywords     string            `json:"meta_keywords,omitempty"`

	// Attributes (for filtering)
	Attributes       map[string]any    `gorm:"serializer:json" json:"attributes,omitempty"`

	// Tags
	Tags             []string          `gorm:"serializer:json" json:"tags,omitempty"`

	// Brand
	BrandID          *string           `json:"brand_id,omitempty"`
	Brand            *Brand            `gorm:"foreignKey:BrandID" json:"brand,omitempty"`

	// Vendor/Supplier
	VendorID         *string           `json:"vendor_id,omitempty"`

	// Relations
	Categories       []Category        `gorm:"many2many:product_categories" json:"categories,omitempty"`
	Images           []ProductImage    `gorm:"foreignKey:ProductID" json:"images,omitempty"`
	Variants         []ProductVariant  `gorm:"foreignKey:ProductID" json:"variants,omitempty"`

	// Timestamps
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
	PublishedAt      *time.Time        `json:"published_at,omitempty"`
}

type ProductImage struct {
	ID        string `gorm:"primaryKey" json:"id"`
	TenantID  string `json:"tenant_id"`
	ProductID string `gorm:"index" json:"product_id"`
	URL       string `json:"url"`
	AltText   string `json:"alt_text,omitempty"`
	Position  int    `json:"position"`
	IsPrimary bool   `json:"is_primary"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type ProductVariant struct {
	ID               string           `gorm:"primaryKey" json:"id"`
	TenantID         string           `json:"tenant_id"`
	ProductID        string           `gorm:"index" json:"product_id"`
	SKU              string           `gorm:"index" json:"sku"`
	Name             string           `json:"name,omitempty"`

	// Pricing
	Price            *decimal.Decimal `json:"price,omitempty"`
	CompareAtPrice   *decimal.Decimal `json:"compare_at_price,omitempty"`
	CostPrice        *decimal.Decimal `json:"cost_price,omitempty"`

	// Inventory
	InventoryQuantity int             `json:"inventory_quantity"`

	// Physical
	Weight           *decimal.Decimal `json:"weight,omitempty"`

	// Options (e.g., {"color": "red", "size": "XL"})
	Options          map[string]string `gorm:"serializer:json" json:"options"`

	// Barcode
	Barcode          string           `json:"barcode,omitempty"`

	// Image
	ImageURL         string           `json:"image_url,omitempty"`

	Position         int              `json:"position"`
	IsActive         bool             `json:"is_active"`

	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

type Brand struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TenantID    string    `gorm:"index" json:"tenant_id"`
	Name        string    `json:"name"`
	Slug        string    `gorm:"index" json:"slug"`
	Logo        string    `json:"logo,omitempty"`
	Description string    `json:"description,omitempty"`
	Website     string    `json:"website,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
```

## Product Service

```go
// internal/products/service.go
package products

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gosimple/slug"
	"gorm.io/gorm"
)

type ProductService struct {
	db       *gorm.DB
	search   SearchService
	cache    CacheService
	storage  StorageService
	eventBus EventBus
}

type CreateProductRequest struct {
	SKU              string            `json:"sku" binding:"required"`
	Name             string            `json:"name" binding:"required"`
	Slug             string            `json:"slug"`
	Description      string            `json:"description"`
	ShortDescription string            `json:"short_description"`
	Price            decimal.Decimal   `json:"price" binding:"required"`
	CompareAtPrice   *decimal.Decimal  `json:"compare_at_price"`
	CostPrice        *decimal.Decimal  `json:"cost_price"`
	Status           ProductStatus     `json:"status"`
	Type             ProductType       `json:"type"`
	CategoryIDs      []string          `json:"category_ids"`
	BrandID          *string           `json:"brand_id"`
	Weight           *decimal.Decimal  `json:"weight"`
	WeightUnit       string            `json:"weight_unit"`
	TrackInventory   bool              `json:"track_inventory"`
	InventoryQuantity int              `json:"inventory_quantity"`
	Attributes       map[string]any    `json:"attributes"`
	Tags             []string          `json:"tags"`
	MetaTitle        string            `json:"meta_title"`
	MetaDescription  string            `json:"meta_description"`
	Variants         []CreateVariantRequest `json:"variants"`
}

type CreateVariantRequest struct {
	SKU              string            `json:"sku" binding:"required"`
	Name             string            `json:"name"`
	Price            *decimal.Decimal  `json:"price"`
	Options          map[string]string `json:"options"`
	InventoryQuantity int              `json:"inventory_quantity"`
	Weight           *decimal.Decimal  `json:"weight"`
	Barcode          string            `json:"barcode"`
}

func (s *ProductService) Create(ctx context.Context, tenantID string, req CreateProductRequest) (*Product, error) {
	// Generate slug if not provided
	productSlug := req.Slug
	if productSlug == "" {
		productSlug = slug.Make(req.Name)
	}

	// Ensure unique slug
	productSlug = s.ensureUniqueSlug(ctx, tenantID, productSlug)

	// Check SKU uniqueness
	var count int64
	s.db.Model(&Product{}).Where("tenant_id = ? AND sku = ?", tenantID, req.SKU).Count(&count)
	if count > 0 {
		return nil, fmt.Errorf("SKU already exists")
	}

	product := &Product{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		SKU:              req.SKU,
		Name:             req.Name,
		Slug:             productSlug,
		Description:      req.Description,
		ShortDescription: req.ShortDescription,
		Price:            req.Price,
		CompareAtPrice:   req.CompareAtPrice,
		CostPrice:        req.CostPrice,
		Currency:         "UAH",
		Status:           req.Status,
		Type:             req.Type,
		BrandID:          req.BrandID,
		Weight:           req.Weight,
		WeightUnit:       req.WeightUnit,
		TrackInventory:   req.TrackInventory,
		InventoryQuantity: req.InventoryQuantity,
		Attributes:       req.Attributes,
		Tags:             req.Tags,
		MetaTitle:        req.MetaTitle,
		MetaDescription:  req.MetaDescription,
		RequiresShipping: true,
		Taxable:          true,
	}

	if product.Status == "" {
		product.Status = ProductStatusDraft
	}
	if product.Type == "" {
		product.Type = ProductTypeSimple
	}

	tx := s.db.Begin()

	// Create product
	if err := tx.Create(product).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Associate categories
	if len(req.CategoryIDs) > 0 {
		var categories []Category
		tx.Where("tenant_id = ? AND id IN ?", tenantID, req.CategoryIDs).Find(&categories)
		if err := tx.Model(product).Association("Categories").Replace(categories); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	// Create variants
	for i, v := range req.Variants {
		variant := ProductVariant{
			ID:               uuid.New().String(),
			TenantID:         tenantID,
			ProductID:        product.ID,
			SKU:              v.SKU,
			Name:             v.Name,
			Price:            v.Price,
			Options:          v.Options,
			InventoryQuantity: v.InventoryQuantity,
			Weight:           v.Weight,
			Barcode:          v.Barcode,
			Position:         i,
			IsActive:         true,
		}
		if err := tx.Create(&variant).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		product.Variants = append(product.Variants, variant)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// Index in search engine
	go s.search.IndexProduct(ctx, product)

	// Invalidate cache
	s.cache.Delete(ctx, fmt.Sprintf("product:%s:%s", tenantID, product.ID))
	s.cache.Delete(ctx, fmt.Sprintf("product:%s:slug:%s", tenantID, product.Slug))

	// Publish event
	s.eventBus.Publish(ctx, "product.created", ProductCreatedEvent{
		ProductID: product.ID,
		TenantID:  tenantID,
		SKU:       product.SKU,
		Name:      product.Name,
	})

	return product, nil
}

func (s *ProductService) GetByID(ctx context.Context, tenantID, productID string) (*Product, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("product:%s:%s", tenantID, productID)
	var product Product
	if err := s.cache.Get(ctx, cacheKey, &product); err == nil {
		return &product, nil
	}

	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND id = ?", tenantID, productID).
		Preload("Categories").
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("position ASC")
		}).
		Preload("Variants", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("position ASC")
		}).
		Preload("Brand").
		First(&product).Error

	if err != nil {
		return nil, err
	}

	// Cache for 5 minutes
	s.cache.Set(ctx, cacheKey, &product, 5*time.Minute)

	return &product, nil
}

func (s *ProductService) GetBySlug(ctx context.Context, tenantID, productSlug string) (*Product, error) {
	cacheKey := fmt.Sprintf("product:%s:slug:%s", tenantID, productSlug)
	var product Product
	if err := s.cache.Get(ctx, cacheKey, &product); err == nil {
		return &product, nil
	}

	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND slug = ? AND status = ?", tenantID, productSlug, ProductStatusActive).
		Preload("Categories").
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("position ASC")
		}).
		Preload("Variants", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("position ASC")
		}).
		Preload("Brand").
		First(&product).Error

	if err != nil {
		return nil, err
	}

	s.cache.Set(ctx, cacheKey, &product, 5*time.Minute)

	return &product, nil
}

func (s *ProductService) List(ctx context.Context, tenantID string, params ProductListParams) (*ProductListResult, error) {
	var products []Product
	var total int64

	query := s.db.WithContext(ctx).Model(&Product{}).Where("tenant_id = ?", tenantID)

	// Filters
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if params.CategoryID != "" {
		query = query.Joins("JOIN product_categories ON product_categories.product_id = products.id").
			Where("product_categories.category_id = ?", params.CategoryID)
	}
	if params.BrandID != "" {
		query = query.Where("brand_id = ?", params.BrandID)
	}
	if params.MinPrice != nil {
		query = query.Where("price >= ?", params.MinPrice)
	}
	if params.MaxPrice != nil {
		query = query.Where("price <= ?", params.MaxPrice)
	}
	if params.InStock {
		query = query.Where("inventory_quantity > 0 OR NOT track_inventory")
	}
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR sku ILIKE ?", search, search)
	}
	if len(params.Tags) > 0 {
		query = query.Where("tags && ?", params.Tags)
	}

	// Get total count
	query.Count(&total)

	// Sorting
	sortBy := "created_at"
	sortOrder := "DESC"
	if params.SortBy != "" {
		sortBy = params.SortBy
	}
	if params.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	// Pagination
	offset := (params.Page - 1) * params.Limit
	query = query.Offset(offset).Limit(params.Limit)

	// Load relations
	err := query.
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_primary = ?", true)
		}).
		Preload("Categories").
		Find(&products).Error

	if err != nil {
		return nil, err
	}

	return &ProductListResult{
		Products: products,
		Total:    total,
		Page:     params.Page,
		Limit:    params.Limit,
	}, nil
}

func (s *ProductService) Update(ctx context.Context, tenantID, productID string, req UpdateProductRequest) (*Product, error) {
	product, err := s.GetByID(ctx, tenantID, productID)
	if err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
		// Update slug if name changed
		updates["slug"] = s.ensureUniqueSlug(ctx, tenantID, slug.Make(*req.Name))
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Price != nil {
		updates["price"] = *req.Price
	}
	if req.Status != nil {
		updates["status"] = *req.Status
		if *req.Status == ProductStatusActive && product.PublishedAt == nil {
			now := time.Now()
			updates["published_at"] = &now
		}
	}
	if req.InventoryQuantity != nil {
		updates["inventory_quantity"] = *req.InventoryQuantity
	}
	if req.Attributes != nil {
		updates["attributes"] = req.Attributes
	}

	updates["updated_at"] = time.Now()

	if err := s.db.Model(product).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Update categories
	if req.CategoryIDs != nil {
		var categories []Category
		s.db.Where("tenant_id = ? AND id IN ?", tenantID, req.CategoryIDs).Find(&categories)
		s.db.Model(product).Association("Categories").Replace(categories)
	}

	// Invalidate cache
	s.cache.Delete(ctx, fmt.Sprintf("product:%s:%s", tenantID, productID))
	s.cache.Delete(ctx, fmt.Sprintf("product:%s:slug:%s", tenantID, product.Slug))

	// Reindex
	go s.search.IndexProduct(ctx, product)

	// Publish event
	s.eventBus.Publish(ctx, "product.updated", ProductUpdatedEvent{
		ProductID: productID,
		TenantID:  tenantID,
	})

	return s.GetByID(ctx, tenantID, productID)
}

func (s *ProductService) Delete(ctx context.Context, tenantID, productID string) error {
	product, err := s.GetByID(ctx, tenantID, productID)
	if err != nil {
		return err
	}

	// Soft delete - just archive
	if err := s.db.Model(product).Update("status", ProductStatusArchived).Error; err != nil {
		return err
	}

	// Remove from search index
	go s.search.DeleteProduct(ctx, tenantID, productID)

	// Invalidate cache
	s.cache.Delete(ctx, fmt.Sprintf("product:%s:%s", tenantID, productID))
	s.cache.Delete(ctx, fmt.Sprintf("product:%s:slug:%s", tenantID, product.Slug))

	return nil
}

func (s *ProductService) AddImage(ctx context.Context, tenantID, productID string, imageURL, altText string, isPrimary bool) (*ProductImage, error) {
	// Get current max position
	var maxPosition int
	s.db.Model(&ProductImage{}).
		Where("tenant_id = ? AND product_id = ?", tenantID, productID).
		Select("COALESCE(MAX(position), -1)").
		Scan(&maxPosition)

	image := &ProductImage{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		ProductID: productID,
		URL:       imageURL,
		AltText:   altText,
		Position:  maxPosition + 1,
		IsPrimary: isPrimary,
	}

	// If primary, unset other primary images
	if isPrimary {
		s.db.Model(&ProductImage{}).
			Where("tenant_id = ? AND product_id = ?", tenantID, productID).
			Update("is_primary", false)
	}

	if err := s.db.Create(image).Error; err != nil {
		return nil, err
	}

	// Invalidate cache
	s.cache.Delete(ctx, fmt.Sprintf("product:%s:%s", tenantID, productID))

	return image, nil
}

func (s *ProductService) ensureUniqueSlug(ctx context.Context, tenantID, baseSlug string) string {
	slugCandidate := baseSlug
	counter := 1

	for {
		var count int64
		s.db.Model(&Product{}).Where("tenant_id = ? AND slug = ?", tenantID, slugCandidate).Count(&count)
		if count == 0 {
			return slugCandidate
		}
		counter++
		slugCandidate = fmt.Sprintf("%s-%d", baseSlug, counter)
	}
}
```

## API Endpoints

```go
// internal/products/handlers.go
package products

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ProductHandler struct {
	service *ProductService
}

// ListProducts GET /api/v1/products
func (h *ProductHandler) ListProducts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var params ProductListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if params.Page == 0 {
		params.Page = 1
	}
	if params.Limit == 0 {
		params.Limit = 20
	}

	result, err := h.service.List(c.Request.Context(), tenantID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetProduct GET /api/v1/products/:id
func (h *ProductHandler) GetProduct(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	productID := c.Param("id")

	product, err := h.service.GetByID(c.Request.Context(), tenantID, productID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// GetProductBySlug GET /api/v1/products/slug/:slug
func (h *ProductHandler) GetProductBySlug(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	productSlug := c.Param("slug")

	product, err := h.service.GetBySlug(c.Request.Context(), tenantID, productSlug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// CreateProduct POST /api/v1/products (admin)
func (h *ProductHandler) CreateProduct(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	product, err := h.service.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, product)
}

// UpdateProduct PUT /api/v1/products/:id (admin)
func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	productID := c.Param("id")

	var req UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	product, err := h.service.Update(c.Request.Context(), tenantID, productID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, product)
}

// DeleteProduct DELETE /api/v1/products/:id (admin)
func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	productID := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), tenantID, productID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "product deleted"})
}

// UploadImage POST /api/v1/products/:id/images (admin)
func (h *ProductHandler) UploadImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	productID := c.Param("id")

	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image required"})
		return
	}

	// Upload to storage
	imageURL, err := h.service.storage.Upload(c.Request.Context(), file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	altText := c.PostForm("alt_text")
	isPrimary := c.PostForm("is_primary") == "true"

	image, err := h.service.AddImage(c.Request.Context(), tenantID, productID, imageURL, altText, isPrimary)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, image)
}
```

## Frontend Components

```typescript
// src/components/products/ProductCard.tsx
import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/types/product';
import { formatPrice } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;

  return (
    <div className="group">
      <Link href={`/products/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          {primaryImage && (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt_text || product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
          )}
          {hasDiscount && (
            <span className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 text-xs rounded">
              Sale
            </span>
          )}
        </div>
        <div className="mt-3">
          <h3 className="text-sm font-medium">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-semibold">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <span className="text-sm text-gray-500 line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
```

## Див. також

- [Categories](./CATEGORIES.md)
- [Inventory](./INVENTORY.md)
- [Search](./SEARCH.md)
- [PIM](./PIM.md)
