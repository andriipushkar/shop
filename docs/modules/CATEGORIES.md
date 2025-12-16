# Categories Module

Модуль управління категоріями товарів Shop Platform.

## Огляд

Модуль Categories забезпечує:
- Ієрархічну структуру категорій
- Навігацію по каталогу
- SEO оптимізацію категорій
- Фільтрацію товарів за категоріями

## Моделі даних

```go
// internal/categories/models.go
package categories

import (
	"time"
)

type Category struct {
	ID              string      `gorm:"primaryKey" json:"id"`
	TenantID        string      `gorm:"index" json:"tenant_id"`
	ParentID        *string     `gorm:"index" json:"parent_id,omitempty"`

	// Basic Info
	Name            string      `json:"name"`
	Slug            string      `gorm:"index" json:"slug"`
	Description     string      `json:"description,omitempty"`

	// Media
	ImageURL        string      `json:"image_url,omitempty"`
	IconURL         string      `json:"icon_url,omitempty"`
	BannerURL       string      `json:"banner_url,omitempty"`

	// Hierarchy
	Level           int         `json:"level"`
	Path            string      `json:"path"` // e.g., "1.2.5" for breadcrumbs
	Position        int         `json:"position"`

	// Status
	IsActive        bool        `json:"is_active"`
	IsVisible       bool        `json:"is_visible"` // Show in navigation

	// SEO
	MetaTitle       string      `json:"meta_title,omitempty"`
	MetaDescription string      `json:"meta_description,omitempty"`
	MetaKeywords    string      `json:"meta_keywords,omitempty"`

	// Filtering
	Attributes      []CategoryAttribute `gorm:"serializer:json" json:"attributes,omitempty"`

	// Relations
	Parent          *Category   `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children        []Category  `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	ProductCount    int         `gorm:"-" json:"product_count,omitempty"`

	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

type CategoryAttribute struct {
	Name    string   `json:"name"`
	Key     string   `json:"key"`
	Type    string   `json:"type"` // text, number, select, color
	Options []string `json:"options,omitempty"`
}
```

## Category Service

```go
// internal/categories/service.go
package categories

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/gosimple/slug"
	"gorm.io/gorm"
)

type CategoryService struct {
	db    *gorm.DB
	cache CacheService
}

type CreateCategoryRequest struct {
	Name            string               `json:"name" binding:"required"`
	Slug            string               `json:"slug"`
	ParentID        *string              `json:"parent_id"`
	Description     string               `json:"description"`
	ImageURL        string               `json:"image_url"`
	Position        int                  `json:"position"`
	IsActive        bool                 `json:"is_active"`
	IsVisible       bool                 `json:"is_visible"`
	MetaTitle       string               `json:"meta_title"`
	MetaDescription string               `json:"meta_description"`
	Attributes      []CategoryAttribute  `json:"attributes"`
}

func (s *CategoryService) Create(ctx context.Context, tenantID string, req CreateCategoryRequest) (*Category, error) {
	categorySlug := req.Slug
	if categorySlug == "" {
		categorySlug = slug.Make(req.Name)
	}
	categorySlug = s.ensureUniqueSlug(ctx, tenantID, categorySlug)

	// Determine level and path
	level := 0
	path := ""
	if req.ParentID != nil {
		parent, err := s.GetByID(ctx, tenantID, *req.ParentID)
		if err != nil {
			return nil, fmt.Errorf("parent category not found")
		}
		level = parent.Level + 1
		path = parent.Path
	}

	category := &Category{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		ParentID:        req.ParentID,
		Name:            req.Name,
		Slug:            categorySlug,
		Description:     req.Description,
		ImageURL:        req.ImageURL,
		Level:           level,
		Position:        req.Position,
		IsActive:        req.IsActive,
		IsVisible:       req.IsVisible,
		MetaTitle:       req.MetaTitle,
		MetaDescription: req.MetaDescription,
		Attributes:      req.Attributes,
	}

	if err := s.db.Create(category).Error; err != nil {
		return nil, err
	}

	// Update path
	if path != "" {
		category.Path = fmt.Sprintf("%s.%s", path, category.ID)
	} else {
		category.Path = category.ID
	}
	s.db.Model(category).Update("path", category.Path)

	s.invalidateCache(ctx, tenantID)

	return category, nil
}

func (s *CategoryService) GetByID(ctx context.Context, tenantID, categoryID string) (*Category, error) {
	var category Category
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND id = ?", tenantID, categoryID).
		First(&category).Error
	return &category, err
}

func (s *CategoryService) GetBySlug(ctx context.Context, tenantID, categorySlug string) (*Category, error) {
	var category Category
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND slug = ? AND is_active = ?", tenantID, categorySlug, true).
		First(&category).Error
	return &category, err
}

func (s *CategoryService) GetTree(ctx context.Context, tenantID string) ([]Category, error) {
	cacheKey := fmt.Sprintf("categories:tree:%s", tenantID)

	var categories []Category
	if err := s.cache.Get(ctx, cacheKey, &categories); err == nil {
		return categories, nil
	}

	// Get all categories
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Order("level ASC, position ASC").
		Find(&categories).Error

	if err != nil {
		return nil, err
	}

	// Build tree
	tree := s.buildTree(categories, nil)

	s.cache.Set(ctx, cacheKey, tree, 10*time.Minute)

	return tree, nil
}

func (s *CategoryService) GetChildren(ctx context.Context, tenantID, parentID string) ([]Category, error) {
	var categories []Category
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND parent_id = ? AND is_active = ?", tenantID, parentID, true).
		Order("position ASC").
		Find(&categories).Error
	return categories, err
}

func (s *CategoryService) GetBreadcrumbs(ctx context.Context, tenantID, categoryID string) ([]Category, error) {
	category, err := s.GetByID(ctx, tenantID, categoryID)
	if err != nil {
		return nil, err
	}

	if category.Path == "" {
		return []Category{*category}, nil
	}

	// Parse path IDs
	pathIDs := strings.Split(category.Path, ".")

	var breadcrumbs []Category
	err = s.db.WithContext(ctx).
		Where("tenant_id = ? AND id IN ?", tenantID, pathIDs).
		Order("level ASC").
		Find(&breadcrumbs).Error

	return breadcrumbs, err
}

func (s *CategoryService) GetWithProductCount(ctx context.Context, tenantID string, parentID *string) ([]Category, error) {
	var categories []Category

	query := s.db.WithContext(ctx).
		Select("categories.*, COUNT(DISTINCT product_categories.product_id) as product_count").
		Joins("LEFT JOIN product_categories ON product_categories.category_id = categories.id").
		Where("categories.tenant_id = ? AND categories.is_active = ?", tenantID, true).
		Group("categories.id").
		Order("categories.position ASC")

	if parentID != nil {
		query = query.Where("categories.parent_id = ?", *parentID)
	} else {
		query = query.Where("categories.parent_id IS NULL")
	}

	err := query.Find(&categories).Error
	return categories, err
}

func (s *CategoryService) Update(ctx context.Context, tenantID, categoryID string, req UpdateCategoryRequest) (*Category, error) {
	category, err := s.GetByID(ctx, tenantID, categoryID)
	if err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
		updates["slug"] = s.ensureUniqueSlug(ctx, tenantID, slug.Make(*req.Name))
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.ImageURL != nil {
		updates["image_url"] = *req.ImageURL
	}
	if req.Position != nil {
		updates["position"] = *req.Position
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.IsVisible != nil {
		updates["is_visible"] = *req.IsVisible
	}
	if req.MetaTitle != nil {
		updates["meta_title"] = *req.MetaTitle
	}
	if req.MetaDescription != nil {
		updates["meta_description"] = *req.MetaDescription
	}
	if req.Attributes != nil {
		updates["attributes"] = req.Attributes
	}

	if err := s.db.Model(category).Updates(updates).Error; err != nil {
		return nil, err
	}

	s.invalidateCache(ctx, tenantID)

	return s.GetByID(ctx, tenantID, categoryID)
}

func (s *CategoryService) Delete(ctx context.Context, tenantID, categoryID string) error {
	// Check for children
	var childCount int64
	s.db.Model(&Category{}).Where("tenant_id = ? AND parent_id = ?", tenantID, categoryID).Count(&childCount)
	if childCount > 0 {
		return fmt.Errorf("cannot delete category with children")
	}

	// Check for products
	var productCount int64
	s.db.Table("product_categories").Where("category_id = ?", categoryID).Count(&productCount)
	if productCount > 0 {
		return fmt.Errorf("cannot delete category with products")
	}

	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, categoryID).Delete(&Category{}).Error; err != nil {
		return err
	}

	s.invalidateCache(ctx, tenantID)

	return nil
}

func (s *CategoryService) Reorder(ctx context.Context, tenantID string, orders []CategoryOrder) error {
	tx := s.db.Begin()

	for _, order := range orders {
		if err := tx.Model(&Category{}).
			Where("tenant_id = ? AND id = ?", tenantID, order.ID).
			Update("position", order.Position).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	s.invalidateCache(ctx, tenantID)

	return nil
}

func (s *CategoryService) buildTree(categories []Category, parentID *string) []Category {
	var result []Category

	for i := range categories {
		cat := categories[i]

		// Check if this category's parent matches
		isMatch := false
		if parentID == nil && cat.ParentID == nil {
			isMatch = true
		} else if parentID != nil && cat.ParentID != nil && *parentID == *cat.ParentID {
			isMatch = true
		}

		if isMatch {
			// Recursively build children
			cat.Children = s.buildTree(categories, &cat.ID)
			result = append(result, cat)
		}
	}

	return result
}

func (s *CategoryService) ensureUniqueSlug(ctx context.Context, tenantID, baseSlug string) string {
	slugCandidate := baseSlug
	counter := 1

	for {
		var count int64
		s.db.Model(&Category{}).Where("tenant_id = ? AND slug = ?", tenantID, slugCandidate).Count(&count)
		if count == 0 {
			return slugCandidate
		}
		counter++
		slugCandidate = fmt.Sprintf("%s-%d", baseSlug, counter)
	}
}

func (s *CategoryService) invalidateCache(ctx context.Context, tenantID string) {
	s.cache.Delete(ctx, fmt.Sprintf("categories:tree:%s", tenantID))
}

type CategoryOrder struct {
	ID       string `json:"id"`
	Position int    `json:"position"`
}
```

## API Endpoints

```go
// GET /api/v1/categories - List categories (tree or flat)
// GET /api/v1/categories/:id - Get category
// GET /api/v1/categories/:slug - Get by slug
// GET /api/v1/categories/:id/children - Get children
// GET /api/v1/categories/:id/breadcrumbs - Get breadcrumbs
// GET /api/v1/categories/:id/products - Get products in category
// POST /api/v1/categories - Create category (admin)
// PUT /api/v1/categories/:id - Update category (admin)
// DELETE /api/v1/categories/:id - Delete category (admin)
// POST /api/v1/categories/reorder - Reorder categories (admin)
```

## Frontend Components

```typescript
// src/components/categories/CategoryTree.tsx
'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Category } from '@/types/category';
import { cn } from '@/lib/utils';

interface CategoryTreeProps {
  categories: Category[];
  activeId?: string;
}

export function CategoryTree({ categories, activeId }: CategoryTreeProps) {
  return (
    <nav className="space-y-1">
      {categories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          activeId={activeId}
        />
      ))}
    </nav>
  );
}

function CategoryItem({ category, activeId, level = 0 }: {
  category: Category;
  activeId?: string;
  level?: number;
}) {
  const isActive = category.id === activeId;
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div>
      <Link
        href={`/categories/${category.slug}`}
        className={cn(
          'flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent',
          level > 0 && 'ml-4'
        )}
      >
        <span>{category.name}</span>
        {category.product_count !== undefined && (
          <span className="text-xs text-muted-foreground">
            ({category.product_count})
          </span>
        )}
      </Link>
      {hasChildren && (
        <div className="ml-2 border-l pl-2 mt-1">
          {category.children!.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              activeId={activeId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Breadcrumbs
export function CategoryBreadcrumbs({ categories }: { categories: Category[] }) {
  return (
    <nav className="flex items-center space-x-2 text-sm">
      <Link href="/" className="text-muted-foreground hover:text-foreground">
        Home
      </Link>
      {categories.map((category, index) => (
        <div key={category.id} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {index === categories.length - 1 ? (
            <span className="ml-2 font-medium">{category.name}</span>
          ) : (
            <Link
              href={`/categories/${category.slug}`}
              className="ml-2 text-muted-foreground hover:text-foreground"
            >
              {category.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
```

## Див. також

- [Products](./PRODUCTS.md)
- [Search](./SEARCH.md)
- [PIM](./PIM.md)
