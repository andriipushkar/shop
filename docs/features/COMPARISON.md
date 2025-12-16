# Product Comparison

Функціонал порівняння товарів для допомоги покупцям у виборі.

## Можливості

- Порівняння до 4 товарів одночасно
- Динамічне порівняння атрибутів
- Підсвічування відмінностей
- Збереження порівнянь
- Швидке додавання до кошика
- Адаптивний дизайн

## Моделі даних

```go
// internal/comparison/models.go
package comparison

import (
    "time"
)

type Comparison struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    TenantID    string    `json:"tenant_id" gorm:"index"`
    SessionID   string    `json:"session_id" gorm:"index"` // For guests
    UserID      *string   `json:"user_id" gorm:"index"`   // For logged-in users
    CategoryID  string    `json:"category_id" gorm:"index"`

    ProductIDs  []string  `json:"product_ids" gorm:"serializer:json"`

    // Metadata
    Name        string    `json:"name"` // Optional saved comparison name
    IsSaved     bool      `json:"is_saved"`

    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
    ExpiresAt   *time.Time `json:"expires_at"` // For unsaved comparisons
}

// ComparisonAttribute represents an attribute to compare
type ComparisonAttribute struct {
    Name        string         `json:"name"`
    Key         string         `json:"key"`
    Type        string         `json:"type"` // text, number, boolean, list
    Unit        string         `json:"unit,omitempty"`
    Values      []AttributeValue `json:"values"` // One per product
    AllSame     bool           `json:"all_same"`
    Comparable  bool           `json:"comparable"` // Can be compared (e.g., numbers)
}

type AttributeValue struct {
    ProductID   string `json:"product_id"`
    Value       any    `json:"value"`
    Display     string `json:"display"`
    IsBest      bool   `json:"is_best,omitempty"` // For comparable attributes
}
```

## Service

```go
// internal/comparison/service.go
package comparison

import (
    "context"
    "fmt"
    "time"
)

type ComparisonService struct {
    repo     ComparisonRepository
    products ProductService
    categories CategoryService
}

const MaxProductsInComparison = 4

// GetOrCreate gets existing comparison or creates new one
func (s *ComparisonService) GetOrCreate(ctx context.Context, categoryID string) (*Comparison, error) {
    sessionID := session.GetID(ctx)
    userID := auth.GetUserIDPtr(ctx)

    // Try to find existing comparison for this category
    comparison, err := s.repo.FindBySessionAndCategory(ctx, sessionID, userID, categoryID)
    if err == nil && comparison != nil {
        return comparison, nil
    }

    // Create new comparison
    comparison = &Comparison{
        ID:         generateID("cmp"),
        TenantID:   tenant.GetTenantID(ctx),
        SessionID:  sessionID,
        UserID:     userID,
        CategoryID: categoryID,
        ProductIDs: []string{},
        CreatedAt:  time.Now(),
        UpdatedAt:  time.Now(),
    }

    // Set expiration for unsaved comparisons (24 hours)
    expires := time.Now().Add(24 * time.Hour)
    comparison.ExpiresAt = &expires

    if err := s.repo.Create(ctx, comparison); err != nil {
        return nil, err
    }

    return comparison, nil
}

// AddProduct adds a product to comparison
func (s *ComparisonService) AddProduct(ctx context.Context, categoryID, productID string) (*Comparison, error) {
    comparison, err := s.GetOrCreate(ctx, categoryID)
    if err != nil {
        return nil, err
    }

    // Check if already added
    for _, id := range comparison.ProductIDs {
        if id == productID {
            return comparison, nil
        }
    }

    // Check max limit
    if len(comparison.ProductIDs) >= MaxProductsInComparison {
        return nil, fmt.Errorf("maximum %d products can be compared", MaxProductsInComparison)
    }

    // Verify product belongs to category
    product, err := s.products.GetByID(ctx, productID)
    if err != nil {
        return nil, fmt.Errorf("product not found")
    }

    if product.CategoryID != categoryID {
        return nil, fmt.Errorf("product must be from the same category")
    }

    comparison.ProductIDs = append(comparison.ProductIDs, productID)
    comparison.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, comparison); err != nil {
        return nil, err
    }

    return comparison, nil
}

// RemoveProduct removes a product from comparison
func (s *ComparisonService) RemoveProduct(ctx context.Context, categoryID, productID string) (*Comparison, error) {
    comparison, err := s.GetOrCreate(ctx, categoryID)
    if err != nil {
        return nil, err
    }

    newIDs := make([]string, 0)
    for _, id := range comparison.ProductIDs {
        if id != productID {
            newIDs = append(newIDs, id)
        }
    }

    comparison.ProductIDs = newIDs
    comparison.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, comparison); err != nil {
        return nil, err
    }

    return comparison, nil
}

// GetComparisonData returns full comparison data with products and attributes
func (s *ComparisonService) GetComparisonData(ctx context.Context, categoryID string) (*ComparisonData, error) {
    comparison, err := s.GetOrCreate(ctx, categoryID)
    if err != nil {
        return nil, err
    }

    if len(comparison.ProductIDs) == 0 {
        return &ComparisonData{
            Comparison: comparison,
            Products:   []*Product{},
            Attributes: []ComparisonAttribute{},
        }, nil
    }

    // Get products
    products, err := s.products.GetByIDs(ctx, comparison.ProductIDs)
    if err != nil {
        return nil, err
    }

    // Get category for comparison attributes
    category, err := s.categories.GetByID(ctx, categoryID)
    if err != nil {
        return nil, err
    }

    // Build comparison attributes
    attributes := s.buildComparisonAttributes(products, category)

    return &ComparisonData{
        Comparison: comparison,
        Products:   products,
        Attributes: attributes,
        Category:   category,
    }, nil
}

// buildComparisonAttributes builds comparison table from products
func (s *ComparisonService) buildComparisonAttributes(products []*Product, category *Category) []ComparisonAttribute {
    attributes := []ComparisonAttribute{}

    // Base attributes (always shown)
    baseAttrs := []struct {
        Name string
        Key  string
        Type string
        Unit string
        GetValue func(p *Product) (any, string)
    }{
        {
            Name: "Price",
            Key:  "price",
            Type: "number",
            Unit: "UAH",
            GetValue: func(p *Product) (any, string) {
                return p.Price.Float64(), fmt.Sprintf("₴%.2f", p.Price.Float64())
            },
        },
        {
            Name: "Rating",
            Key:  "rating",
            Type: "number",
            GetValue: func(p *Product) (any, string) {
                return p.Rating, fmt.Sprintf("%.1f (%d reviews)", p.Rating, p.ReviewCount)
            },
        },
        {
            Name: "Brand",
            Key:  "brand",
            Type: "text",
            GetValue: func(p *Product) (any, string) {
                return p.Brand, p.Brand
            },
        },
        {
            Name: "Availability",
            Key:  "availability",
            Type: "boolean",
            GetValue: func(p *Product) (any, string) {
                inStock := p.Inventory.Available > 0
                display := "Out of Stock"
                if inStock {
                    display = "In Stock"
                }
                return inStock, display
            },
        },
    }

    for _, attr := range baseAttrs {
        values := make([]AttributeValue, len(products))
        var allValues []any
        for i, p := range products {
            val, display := attr.GetValue(p)
            values[i] = AttributeValue{
                ProductID: p.ID,
                Value:     val,
                Display:   display,
            }
            allValues = append(allValues, val)
        }

        // Check if all values are the same
        allSame := s.areAllSame(allValues)

        // Mark best value for comparable attributes
        if attr.Type == "number" && !allSame {
            s.markBestValue(values, attr.Key)
        }

        attributes = append(attributes, ComparisonAttribute{
            Name:       attr.Name,
            Key:        attr.Key,
            Type:       attr.Type,
            Unit:       attr.Unit,
            Values:     values,
            AllSame:    allSame,
            Comparable: attr.Type == "number",
        })
    }

    // Category-specific attributes
    for _, attrDef := range category.ComparisonAttributes {
        values := make([]AttributeValue, len(products))
        var allValues []any

        for i, p := range products {
            val, display := s.getProductAttribute(p, attrDef.Key)
            values[i] = AttributeValue{
                ProductID: p.ID,
                Value:     val,
                Display:   display,
            }
            allValues = append(allValues, val)
        }

        allSame := s.areAllSame(allValues)
        comparable := attrDef.Type == "number"

        if comparable && !allSame {
            s.markBestValue(values, attrDef.Key)
        }

        attributes = append(attributes, ComparisonAttribute{
            Name:       attrDef.Name,
            Key:        attrDef.Key,
            Type:       attrDef.Type,
            Unit:       attrDef.Unit,
            Values:     values,
            AllSame:    allSame,
            Comparable: comparable,
        })
    }

    return attributes
}

func (s *ComparisonService) getProductAttribute(p *Product, key string) (any, string) {
    for _, attr := range p.Attributes {
        if attr.Key == key {
            return attr.Value, attr.DisplayValue
        }
    }
    return nil, "-"
}

func (s *ComparisonService) areAllSame(values []any) bool {
    if len(values) < 2 {
        return true
    }
    first := values[0]
    for _, v := range values[1:] {
        if v != first {
            return false
        }
    }
    return true
}

func (s *ComparisonService) markBestValue(values []AttributeValue, key string) {
    // For price - lower is better
    // For rating - higher is better
    // For most specs - higher is better

    lowerIsBetter := key == "price"

    var bestIdx int
    var bestVal float64
    isFirst := true

    for i, v := range values {
        if v.Value == nil {
            continue
        }
        val, ok := toFloat64(v.Value)
        if !ok {
            continue
        }
        if isFirst {
            bestVal = val
            bestIdx = i
            isFirst = true
            continue
        }
        if lowerIsBetter {
            if val < bestVal {
                bestVal = val
                bestIdx = i
            }
        } else {
            if val > bestVal {
                bestVal = val
                bestIdx = i
            }
        }
    }

    if !isFirst {
        values[bestIdx].IsBest = true
    }
}

// SaveComparison saves a comparison for later
func (s *ComparisonService) SaveComparison(ctx context.Context, comparisonID, name string) (*Comparison, error) {
    comparison, err := s.repo.GetByID(ctx, comparisonID)
    if err != nil {
        return nil, err
    }

    comparison.Name = name
    comparison.IsSaved = true
    comparison.ExpiresAt = nil
    comparison.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, comparison); err != nil {
        return nil, err
    }

    return comparison, nil
}

// GetSavedComparisons returns user's saved comparisons
func (s *ComparisonService) GetSavedComparisons(ctx context.Context) ([]*Comparison, error) {
    userID := auth.GetUserID(ctx)
    return s.repo.GetSavedByUser(ctx, userID)
}

type ComparisonData struct {
    Comparison *Comparison           `json:"comparison"`
    Products   []*Product            `json:"products"`
    Attributes []ComparisonAttribute `json:"attributes"`
    Category   *Category             `json:"category"`
}
```

## Frontend Components

### Comparison Button

```tsx
// components/comparison/CompareButton.tsx
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale, Check } from 'lucide-react';

interface CompareButtonProps {
  productId: string;
  categoryId: string;
  className?: string;
}

export function CompareButton({ productId, categoryId, className }: CompareButtonProps) {
  const queryClient = useQueryClient();

  const { data: comparison } = useQuery({
    queryKey: ['comparison', categoryId],
    queryFn: () =>
      fetch(`/api/comparison/${categoryId}`).then(r => r.json()),
  });

  const isInComparison = comparison?.product_ids?.includes(productId);
  const isFull = comparison?.product_ids?.length >= 4;

  const toggle = useMutation({
    mutationFn: () => {
      const method = isInComparison ? 'DELETE' : 'POST';
      return fetch(`/api/comparison/${categoryId}/products/${productId}`, { method }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparison', categoryId] });
    },
  });

  return (
    <button
      onClick={() => toggle.mutate()}
      disabled={!isInComparison && isFull}
      className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${
        isInComparison
          ? 'bg-blue-50 border-blue-300 text-blue-600'
          : 'hover:bg-gray-50'
      } ${!isInComparison && isFull ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      title={isFull && !isInComparison ? 'Comparison is full (max 4)' : ''}
    >
      {isInComparison ? (
        <Check className="w-4 h-4" />
      ) : (
        <Scale className="w-4 h-4" />
      )}
      <span className="text-sm">{isInComparison ? 'In Compare' : 'Compare'}</span>
    </button>
  );
}
```

### Comparison Floating Bar

```tsx
// components/comparison/ComparisonBar.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Scale, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ComparisonBar({ categoryId }: { categoryId: string }) {
  const pathname = usePathname();

  const { data: comparisonData } = useQuery({
    queryKey: ['comparison-data', categoryId],
    queryFn: () =>
      fetch(`/api/comparison/${categoryId}/data`).then(r => r.json()),
    enabled: !!categoryId,
  });

  const products = comparisonData?.products || [];

  if (products.length === 0 || pathname.includes('/compare')) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Scale className="w-5 h-5" />
              <span className="font-medium">{products.length} items to compare</span>
            </div>

            <div className="flex items-center gap-2">
              {products.map((product: any) => (
                <div
                  key={product.id}
                  className="relative group"
                >
                  <img
                    src={product.main_image?.url || '/placeholder.png'}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded border"
                  />
                  <button
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {Array.from({ length: 4 - products.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-12 h-12 border-2 border-dashed rounded flex items-center justify-center text-gray-400"
                >
                  +
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="text-gray-600 hover:text-gray-900"
              onClick={() => {/* clear all */}}
            >
              Clear all
            </button>
            <Link
              href={`/compare/${categoryId}`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Compare
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Comparison Table

```tsx
// components/comparison/ComparisonTable.tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ShoppingCart, Heart, Check, Minus } from 'lucide-react';
import Link from 'next/link';

interface ComparisonTableProps {
  categoryId: string;
}

export function ComparisonTable({ categoryId }: ComparisonTableProps) {
  const queryClient = useQueryClient();
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['comparison-data', categoryId],
    queryFn: () =>
      fetch(`/api/comparison/${categoryId}/data`).then(r => r.json()),
  });

  const removeProduct = useMutation({
    mutationFn: (productId: string) =>
      fetch(`/api/comparison/${categoryId}/products/${productId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparison-data', categoryId] });
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (!data?.products?.length) {
    return (
      <div className="text-center py-12">
        <Scale className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-medium mb-2">No products to compare</h2>
        <p className="text-gray-600 mb-4">Add products to compare their features</p>
        <Link href={`/categories/${categoryId}`} className="text-blue-600 hover:underline">
          Browse Products
        </Link>
      </div>
    );
  }

  const { products, attributes, category } = data;

  const filteredAttributes = showOnlyDifferences
    ? attributes.filter((attr: any) => !attr.all_same)
    : attributes;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Compare {category.name}</h1>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyDifferences}
            onChange={(e) => setShowOnlyDifferences(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Show only differences</span>
        </label>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Products Header */}
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 w-48"></th>
              {products.map((product: any) => (
                <th
                  key={product.id}
                  className="min-w-[250px] p-4 text-left align-top border-b"
                >
                  <div className="relative">
                    <button
                      onClick={() => removeProduct.mutate(product.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <Link href={`/products/${product.slug}`}>
                      <img
                        src={product.main_image?.url || '/placeholder.png'}
                        alt={product.name}
                        className="w-full h-40 object-contain mb-3"
                      />
                    </Link>

                    <Link
                      href={`/products/${product.slug}`}
                      className="font-medium hover:text-blue-600 line-clamp-2"
                    >
                      {product.name}
                    </Link>

                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 py-2 bg-blue-600 text-white text-sm rounded flex items-center justify-center gap-1">
                        <ShoppingCart className="w-4 h-4" />
                        Add
                      </button>
                      <button className="p-2 border rounded hover:bg-gray-50">
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Attributes */}
          <tbody>
            {filteredAttributes.map((attr: any, index: number) => (
              <tr
                key={attr.key}
                className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
              >
                <td className="sticky left-0 bg-inherit p-4 font-medium border-r">
                  {attr.name}
                  {attr.unit && <span className="text-gray-500 text-sm ml-1">({attr.unit})</span>}
                </td>
                {attr.values.map((value: any) => (
                  <td
                    key={value.product_id}
                    className={`p-4 ${value.is_best ? 'bg-green-50' : ''}`}
                  >
                    {renderAttributeValue(attr.type, value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderAttributeValue(type: string, value: any) {
  if (value.value === null || value.value === undefined) {
    return <Minus className="w-4 h-4 text-gray-400" />;
  }

  if (type === 'boolean') {
    return value.value ? (
      <Check className="w-5 h-5 text-green-600" />
    ) : (
      <X className="w-5 h-5 text-red-500" />
    );
  }

  return (
    <span className={value.is_best ? 'font-bold text-green-700' : ''}>
      {value.display}
      {value.is_best && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Best</span>}
    </span>
  );
}
```

## API Endpoints

```go
func (h *ComparisonHandler) RegisterRoutes(r *gin.RouterGroup) {
    comparison := r.Group("/comparison")
    {
        comparison.GET("/:categoryId", h.GetComparison)
        comparison.GET("/:categoryId/data", h.GetComparisonData)
        comparison.POST("/:categoryId/products/:productId", h.AddProduct)
        comparison.DELETE("/:categoryId/products/:productId", h.RemoveProduct)
        comparison.POST("/:categoryId/save", h.SaveComparison)
        comparison.DELETE("/:categoryId", h.ClearComparison)
    }

    // Saved comparisons (auth required)
    r.GET("/comparisons/saved", AuthMiddleware(), h.GetSavedComparisons)
}
```

## Конфігурація категорій

```yaml
# config/comparison_attributes.yaml
categories:
  smartphones:
    attributes:
      - key: display_size
        name: Display Size
        type: number
        unit: inches
      - key: battery
        name: Battery Capacity
        type: number
        unit: mAh
      - key: ram
        name: RAM
        type: number
        unit: GB
      - key: storage
        name: Storage
        type: number
        unit: GB
      - key: camera
        name: Main Camera
        type: number
        unit: MP
      - key: 5g
        name: 5G Support
        type: boolean
      - key: nfc
        name: NFC
        type: boolean

  laptops:
    attributes:
      - key: display_size
        name: Display Size
        type: number
        unit: inches
      - key: cpu
        name: Processor
        type: text
      - key: ram
        name: RAM
        type: number
        unit: GB
      - key: storage
        name: Storage
        type: number
        unit: GB
      - key: battery_life
        name: Battery Life
        type: number
        unit: hours
      - key: weight
        name: Weight
        type: number
        unit: kg
```

## Див. також

- [Products](../modules/PRODUCTS.md)
- [Categories](../modules/CATEGORIES.md)
- [Search](../modules/SEARCH.md)
