# Product Information Management (PIM)

Централізоване управління інформацією про товари.

## Огляд

| Параметр | Значення |
|----------|----------|
| Data Model | Flexible attributes |
| Channels | Web, Mobile, Marketplaces |
| Languages | Multi-language support |

### Можливості

- Централізоване сховище товарів
- Гнучка система атрибутів
- Мультимовність
- Управління медіа-файлами
- Категоризація та таксономія
- Bulk import/export
- Версіонування змін
- Workflow публікації

---

## Архітектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Import    │     │     PIM     │     │   Export    │
│  (CSV/XML)  │────▶│   Engine    │────▶│  (Channels) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼───┐           ┌──────▼──────┐        ┌──────▼──────┐
│Product│           │  Attributes │        │    Media    │
│ Store │           │    System   │        │   Library   │
└───────┘           └─────────────┘        └─────────────┘
```

---

## Data Models

```go
// internal/pim/models.go
package pim

import "time"

// Product - основна сутність товару
type Product struct {
    ID              string                 `json:"id" gorm:"primaryKey"`
    SKU             string                 `json:"sku" gorm:"uniqueIndex"`
    Barcode         string                 `json:"barcode"`
    Type            ProductType            `json:"type"` // simple, configurable, bundle
    Status          ProductStatus          `json:"status"`

    // Localized content
    Name            LocalizedString        `json:"name" gorm:"serializer:json"`
    Description     LocalizedString        `json:"description" gorm:"serializer:json"`
    ShortDescription LocalizedString       `json:"short_description" gorm:"serializer:json"`

    // Pricing
    Price           int64                  `json:"price"`
    CompareAtPrice  int64                  `json:"compare_at_price"`
    CostPrice       int64                  `json:"cost_price"`
    Currency        string                 `json:"currency"`

    // Categorization
    CategoryID      string                 `json:"category_id"`
    Categories      []Category             `json:"categories" gorm:"many2many:product_categories"`
    Brand           string                 `json:"brand"`
    Vendor          string                 `json:"vendor"`

    // Attributes
    Attributes      map[string]interface{} `json:"attributes" gorm:"serializer:json"`

    // Media
    Images          []ProductImage         `json:"images" gorm:"foreignKey:ProductID"`
    Videos          []ProductVideo         `json:"videos" gorm:"foreignKey:ProductID"`
    Documents       []ProductDocument      `json:"documents" gorm:"foreignKey:ProductID"`

    // Variants (for configurable products)
    Variants        []ProductVariant       `json:"variants" gorm:"foreignKey:ParentID"`
    Options         []ProductOption        `json:"options" gorm:"foreignKey:ProductID"`

    // Inventory
    Stock           int                    `json:"stock"`
    TrackInventory  bool                   `json:"track_inventory"`
    AllowBackorder  bool                   `json:"allow_backorder"`

    // Physical
    Weight          float64                `json:"weight"`
    WeightUnit      string                 `json:"weight_unit"`
    Dimensions      Dimensions             `json:"dimensions" gorm:"embedded"`

    // SEO
    SEO             SEOData                `json:"seo" gorm:"embedded;embeddedPrefix:seo_"`

    // Channels
    Channels        []string               `json:"channels" gorm:"serializer:json"`

    // Timestamps
    PublishedAt     *time.Time             `json:"published_at"`
    CreatedAt       time.Time              `json:"created_at"`
    UpdatedAt       time.Time              `json:"updated_at"`
}

type ProductType string

const (
    ProductTypeSimple       ProductType = "simple"
    ProductTypeConfigurable ProductType = "configurable"
    ProductTypeBundle       ProductType = "bundle"
    ProductTypeVirtual      ProductType = "virtual"
)

type ProductStatus string

const (
    StatusDraft     ProductStatus = "draft"
    StatusPending   ProductStatus = "pending"
    StatusPublished ProductStatus = "published"
    StatusArchived  ProductStatus = "archived"
)

type LocalizedString map[string]string // {"uk": "Назва", "en": "Name"}

type Dimensions struct {
    Length float64 `json:"length"`
    Width  float64 `json:"width"`
    Height float64 `json:"height"`
    Unit   string  `json:"unit"` // cm, in
}

type SEOData struct {
    Title       LocalizedString `json:"title" gorm:"serializer:json"`
    Description LocalizedString `json:"description" gorm:"serializer:json"`
    Keywords    []string        `json:"keywords" gorm:"serializer:json"`
    Slug        string          `json:"slug"`
}

// ProductVariant - варіант товару
type ProductVariant struct {
    ID              string                 `json:"id" gorm:"primaryKey"`
    ParentID        string                 `json:"parent_id"`
    SKU             string                 `json:"sku"`
    Barcode         string                 `json:"barcode"`
    Name            LocalizedString        `json:"name" gorm:"serializer:json"`
    Price           int64                  `json:"price"`
    CompareAtPrice  int64                  `json:"compare_at_price"`
    Stock           int                    `json:"stock"`
    Options         map[string]string      `json:"options" gorm:"serializer:json"` // {"color": "red", "size": "M"}
    Image           string                 `json:"image"`
    Weight          float64                `json:"weight"`
    Dimensions      Dimensions             `json:"dimensions" gorm:"embedded"`
    Attributes      map[string]interface{} `json:"attributes" gorm:"serializer:json"`
    CreatedAt       time.Time              `json:"created_at"`
    UpdatedAt       time.Time              `json:"updated_at"`
}

// ProductOption - опція для configurable products
type ProductOption struct {
    ID        string   `json:"id" gorm:"primaryKey"`
    ProductID string   `json:"product_id"`
    Name      string   `json:"name"` // Color, Size
    Position  int      `json:"position"`
    Values    []string `json:"values" gorm:"serializer:json"` // ["Red", "Blue", "Green"]
}

// AttributeSet - набір атрибутів для категорії
type AttributeSet struct {
    ID         string      `json:"id" gorm:"primaryKey"`
    Name       string      `json:"name"`
    CategoryID string      `json:"category_id"`
    Attributes []Attribute `json:"attributes" gorm:"foreignKey:AttributeSetID"`
}

// Attribute - визначення атрибуту
type Attribute struct {
    ID             string          `json:"id" gorm:"primaryKey"`
    AttributeSetID string          `json:"attribute_set_id"`
    Code           string          `json:"code"` // internal name
    Name           LocalizedString `json:"name" gorm:"serializer:json"`
    Type           AttributeType   `json:"type"`
    Required       bool            `json:"required"`
    Filterable     bool            `json:"filterable"`
    Searchable     bool            `json:"searchable"`
    Visible        bool            `json:"visible"`
    Position       int             `json:"position"`
    Options        []AttributeOption `json:"options" gorm:"foreignKey:AttributeID"`
    Validation     *AttributeValidation `json:"validation" gorm:"serializer:json"`
}

type AttributeType string

const (
    AttrTypeText     AttributeType = "text"
    AttrTypeTextarea AttributeType = "textarea"
    AttrTypeNumber   AttributeType = "number"
    AttrTypeSelect   AttributeType = "select"
    AttrTypeMultiSelect AttributeType = "multiselect"
    AttrTypeBoolean  AttributeType = "boolean"
    AttrTypeDate     AttributeType = "date"
    AttrTypeColor    AttributeType = "color"
)

type AttributeOption struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    AttributeID string          `json:"attribute_id"`
    Value       string          `json:"value"`
    Label       LocalizedString `json:"label" gorm:"serializer:json"`
    Position    int             `json:"position"`
    SwatchValue string          `json:"swatch_value"` // hex color or image URL
}

type AttributeValidation struct {
    MinLength *int     `json:"min_length,omitempty"`
    MaxLength *int     `json:"max_length,omitempty"`
    Min       *float64 `json:"min,omitempty"`
    Max       *float64 `json:"max,omitempty"`
    Pattern   string   `json:"pattern,omitempty"`
}
```

---

## Product Service

```go
// internal/pim/service.go
package pim

import (
    "context"
)

type Service struct {
    repo       ProductRepository
    attrRepo   AttributeRepository
    mediaRepo  MediaRepository
    search     SearchService
    eventBus   EventBus
}

// CreateProduct створює новий товар
func (s *Service) CreateProduct(ctx context.Context, input *CreateProductInput) (*Product, error) {
    // Validate attributes against attribute set
    if err := s.validateAttributes(ctx, input.CategoryID, input.Attributes); err != nil {
        return nil, err
    }

    product := &Product{
        ID:             generateID("prod"),
        SKU:            input.SKU,
        Type:           input.Type,
        Status:         StatusDraft,
        Name:           input.Name,
        Description:    input.Description,
        Price:          input.Price,
        CategoryID:     input.CategoryID,
        Brand:          input.Brand,
        Attributes:     input.Attributes,
        TrackInventory: true,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    // Generate slug
    product.SEO.Slug = s.generateSlug(input.Name["uk"])

    if err := s.repo.Create(ctx, product); err != nil {
        return nil, err
    }

    // Index for search
    go s.search.IndexProduct(ctx, product)

    // Emit event
    s.eventBus.Publish("product.created", product)

    return product, nil
}

// UpdateProduct оновлює товар
func (s *Service) UpdateProduct(ctx context.Context, id string, input *UpdateProductInput) (*Product, error) {
    product, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Create version before update
    s.createVersion(ctx, product)

    // Apply updates
    if input.Name != nil {
        product.Name = *input.Name
    }
    if input.Description != nil {
        product.Description = *input.Description
    }
    if input.Price != nil {
        product.Price = *input.Price
    }
    if input.Attributes != nil {
        product.Attributes = *input.Attributes
    }

    product.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, product); err != nil {
        return nil, err
    }

    // Re-index
    go s.search.IndexProduct(ctx, product)

    // Emit event
    s.eventBus.Publish("product.updated", product)

    return product, nil
}

// PublishProduct публікує товар
func (s *Service) PublishProduct(ctx context.Context, id string, channels []string) error {
    product, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return err
    }

    // Validate completeness
    if err := s.validateForPublish(product); err != nil {
        return err
    }

    now := time.Now()
    product.Status = StatusPublished
    product.PublishedAt = &now
    product.Channels = channels
    product.UpdatedAt = now

    if err := s.repo.Update(ctx, product); err != nil {
        return err
    }

    // Emit event
    s.eventBus.Publish("product.published", map[string]interface{}{
        "product_id": product.ID,
        "channels":   channels,
    })

    return nil
}

func (s *Service) validateForPublish(product *Product) error {
    var errors []string

    if product.Name["uk"] == "" {
        errors = append(errors, "Name (UK) is required")
    }
    if product.Price == 0 {
        errors = append(errors, "Price is required")
    }
    if len(product.Images) == 0 {
        errors = append(errors, "At least one image is required")
    }
    if product.CategoryID == "" {
        errors = append(errors, "Category is required")
    }

    // Validate required attributes
    attrSet, _ := s.attrRepo.FindByCategory(ctx, product.CategoryID)
    for _, attr := range attrSet.Attributes {
        if attr.Required {
            if _, exists := product.Attributes[attr.Code]; !exists {
                errors = append(errors, fmt.Sprintf("Attribute '%s' is required", attr.Name["uk"]))
            }
        }
    }

    if len(errors) > 0 {
        return &ValidationError{Errors: errors}
    }
    return nil
}

func (s *Service) validateAttributes(ctx context.Context, categoryID string, attrs map[string]interface{}) error {
    attrSet, err := s.attrRepo.FindByCategory(ctx, categoryID)
    if err != nil {
        return err
    }

    for code, value := range attrs {
        attr := findAttribute(attrSet.Attributes, code)
        if attr == nil {
            continue // Unknown attribute, skip
        }

        if err := validateAttributeValue(attr, value); err != nil {
            return fmt.Errorf("attribute '%s': %w", code, err)
        }
    }

    return nil
}
```

---

## Import/Export

```go
// internal/pim/import.go
package pim

import (
    "context"
    "encoding/csv"
    "io"
)

type ImportService struct {
    productService *Service
}

type ImportResult struct {
    TotalRows    int      `json:"total_rows"`
    Imported     int      `json:"imported"`
    Updated      int      `json:"updated"`
    Errors       int      `json:"errors"`
    ErrorDetails []string `json:"error_details"`
}

// ImportCSV імпортує товари з CSV
func (s *ImportService) ImportCSV(ctx context.Context, reader io.Reader, options *ImportOptions) (*ImportResult, error) {
    result := &ImportResult{}

    csvReader := csv.NewReader(reader)

    // Read header
    header, err := csvReader.Read()
    if err != nil {
        return nil, err
    }

    columnMap := s.buildColumnMap(header)

    for {
        record, err := csvReader.Read()
        if err == io.EOF {
            break
        }
        if err != nil {
            result.Errors++
            result.ErrorDetails = append(result.ErrorDetails, err.Error())
            continue
        }

        result.TotalRows++

        product, err := s.recordToProduct(record, columnMap)
        if err != nil {
            result.Errors++
            result.ErrorDetails = append(result.ErrorDetails, fmt.Sprintf("Row %d: %s", result.TotalRows, err.Error()))
            continue
        }

        // Check if exists
        existing, _ := s.productService.repo.FindBySKU(ctx, product.SKU)
        if existing != nil {
            // Update
            if err := s.productService.UpdateProduct(ctx, existing.ID, &UpdateProductInput{
                Name:        &product.Name,
                Description: &product.Description,
                Price:       &product.Price,
                Attributes:  &product.Attributes,
            }); err != nil {
                result.Errors++
                result.ErrorDetails = append(result.ErrorDetails, fmt.Sprintf("Row %d: %s", result.TotalRows, err.Error()))
            } else {
                result.Updated++
            }
        } else {
            // Create
            if _, err := s.productService.CreateProduct(ctx, &CreateProductInput{
                SKU:         product.SKU,
                Name:        product.Name,
                Description: product.Description,
                Price:       product.Price,
                CategoryID:  product.CategoryID,
                Attributes:  product.Attributes,
            }); err != nil {
                result.Errors++
                result.ErrorDetails = append(result.ErrorDetails, fmt.Sprintf("Row %d: %s", result.TotalRows, err.Error()))
            } else {
                result.Imported++
            }
        }
    }

    return result, nil
}

// ExportCSV експортує товари в CSV
func (s *ImportService) ExportCSV(ctx context.Context, writer io.Writer, options *ExportOptions) error {
    csvWriter := csv.NewWriter(writer)
    defer csvWriter.Flush()

    // Write header
    header := []string{"sku", "name_uk", "name_en", "description_uk", "price", "category_id", "brand", "stock"}

    // Add attribute columns
    if options.IncludeAttributes {
        attrSet, _ := s.attrRepo.FindByCategory(ctx, options.CategoryID)
        for _, attr := range attrSet.Attributes {
            header = append(header, "attr_"+attr.Code)
        }
    }

    csvWriter.Write(header)

    // Write products
    offset := 0
    limit := 100

    for {
        products, err := s.productService.repo.FindByFilter(ctx, options.Filter, offset, limit)
        if err != nil {
            return err
        }

        if len(products) == 0 {
            break
        }

        for _, product := range products {
            row := []string{
                product.SKU,
                product.Name["uk"],
                product.Name["en"],
                product.Description["uk"],
                strconv.FormatInt(product.Price, 10),
                product.CategoryID,
                product.Brand,
                strconv.Itoa(product.Stock),
            }

            // Add attribute values
            if options.IncludeAttributes {
                for _, attr := range attrSet.Attributes {
                    val := product.Attributes[attr.Code]
                    row = append(row, fmt.Sprintf("%v", val))
                }
            }

            csvWriter.Write(row)
        }

        offset += limit
    }

    return nil
}
```

---

## API Endpoints

### Create Product

```http
POST /api/admin/pim/products
Content-Type: application/json

{
    "sku": "IPHONE-15-128",
    "type": "configurable",
    "name": {
        "uk": "iPhone 15 128GB",
        "en": "iPhone 15 128GB"
    },
    "description": {
        "uk": "Новий iPhone 15 з чіпом A16 Bionic"
    },
    "price": 4999900,
    "category_id": "cat_smartphones",
    "brand": "Apple",
    "attributes": {
        "color": "black",
        "storage": "128",
        "display_size": "6.1"
    }
}
```

### Bulk Import

```http
POST /api/admin/pim/import
Content-Type: multipart/form-data

file: <products.csv>
options: {"update_existing": true, "validate_only": false}
```

### Get Product with Variants

```http
GET /api/admin/pim/products/{id}?include=variants,images,attributes
```

---

## Admin UI

```tsx
// components/admin/pim/ProductEditor.tsx
export function ProductEditor({ productId }: { productId?: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const { data: attributeSet } = useQuery({
    queryKey: ['attribute-set', product?.category_id],
    queryFn: () => fetchAttributeSet(product?.category_id),
    enabled: !!product?.category_id,
  });

  return (
    <form className="space-y-8">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Основна інформація</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Input label="SKU" name="sku" required />
          <Select label="Тип" name="type">
            <option value="simple">Простий</option>
            <option value="configurable">Конфігурований</option>
            <option value="bundle">Набір</option>
          </Select>

          {/* Localized name */}
          <LocalizedInput label="Назва" name="name" languages={['uk', 'en']} />

          <CategorySelect label="Категорія" name="category_id" />
          <Input label="Бренд" name="brand" />
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Ціноутворення</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <PriceInput label="Ціна" name="price" currency="UAH" />
          <PriceInput label="Стара ціна" name="compare_at_price" currency="UAH" />
          <PriceInput label="Собівартість" name="cost_price" currency="UAH" />
        </CardContent>
      </Card>

      {/* Dynamic Attributes */}
      {attributeSet && (
        <Card>
          <CardHeader>
            <CardTitle>Характеристики</CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicAttributeForm
              attributes={attributeSet.attributes}
              values={product?.attributes || {}}
              onChange={(attrs) => setProduct(p => ({ ...p, attributes: attrs }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Media */}
      <Card>
        <CardHeader>
          <CardTitle>Медіа</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaUploader
            images={product?.images || []}
            onUpload={handleImageUpload}
            onRemove={handleImageRemove}
            onReorder={handleImageReorder}
          />
        </CardContent>
      </Card>

      {/* Variants */}
      {product?.type === 'configurable' && (
        <Card>
          <CardHeader>
            <CardTitle>Варіанти</CardTitle>
          </CardHeader>
          <CardContent>
            <VariantManager
              options={product.options}
              variants={product.variants}
              onOptionsChange={handleOptionsChange}
              onVariantsChange={handleVariantsChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline">Зберегти чернетку</Button>
        <Button onClick={handlePublish}>Опублікувати</Button>
      </div>
    </form>
  );
}
```
