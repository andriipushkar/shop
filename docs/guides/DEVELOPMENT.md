# Development Guide

Керівництво для розробників платформи.

## Налаштування середовища

### Вимоги

| Інструмент | Версія | Призначення |
|------------|--------|-------------|
| Go | 1.24+ | Backend |
| Node.js | 20+ | Frontend |
| Docker | 24+ | Контейнеризація |
| Make | 4+ | Автоматизація |

### Встановлення

```bash
# Клонування репозиторію
git clone https://github.com/your-org/shop-platform.git
cd shop-platform

# Встановлення Go залежностей
cd services/core && go mod download
cd ../oms && go mod download

# Встановлення Node.js залежностей
cd ../../apps/admin && npm install
cd ../storefront && npm install

# Копіювання .env
cp .env.example .env

# Запуск інфраструктури
docker compose up -d postgres redis rabbitmq elasticsearch

# Запуск міграцій
make migrate-up

# Запуск seed даних
make seed
```

### IDE Setup

#### VS Code

```json
// .vscode/settings.json
{
  "go.useLanguageServer": true,
  "go.lintTool": "golangci-lint",
  "go.lintOnSave": "package",
  "go.formatTool": "gofumpt",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "[go]": {
    "editor.defaultFormatter": "golang.go"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### VS Code Extensions

- Go (golang.go)
- ESLint
- Prettier
- Docker
- GitLens
- Thunder Client (API testing)

#### GoLand / WebStorm

- Увімкнути `gofumpt` як formatter
- Налаштувати `golangci-lint` як linter
- Увімкнути auto-import

## Структура проекту

```
shop-platform/
├── services/               # Backend мікросервіси (Go)
│   ├── core/              # Продукти, інвентар, пошук
│   │   ├── cmd/           # Entry points
│   │   ├── internal/      # Private packages
│   │   │   ├── product/
│   │   │   ├── inventory/
│   │   │   └── search/
│   │   ├── pkg/           # Public packages
│   │   └── api/           # API handlers
│   ├── oms/               # Order Management
│   ├── crm/               # Customer Management
│   └── notification/      # Notifications
│
├── apps/                   # Frontend (Next.js)
│   ├── admin/             # Admin панель
│   ├── storefront/        # Клієнтський магазин
│   └── shared/            # Спільні компоненти
│
├── packages/               # Shared packages
│   ├── ui/                # UI компоненти
│   ├── api-client/        # API клієнт
│   └── types/             # TypeScript типи
│
├── infrastructure/         # Інфраструктура
│   ├── docker/
│   ├── kubernetes/
│   └── terraform/
│
├── docs/                   # Документація
├── scripts/                # Скрипти
└── docker-compose.yml
```

## Coding Standards

### Go

#### Naming Conventions

```go
// Packages - lowercase, short
package product
package orderservice // НЕ order_service

// Variables - camelCase
var productName string
var orderItems []Item

// Constants - camelCase або PascalCase для exported
const maxRetries = 3
const DefaultTimeout = 30 * time.Second

// Functions - PascalCase для exported, camelCase для private
func GetProductByID(id string) (*Product, error) {}
func calculateDiscount(price float64) float64 {}

// Interfaces - suffix "er" для single method
type Reader interface {
    Read(p []byte) (n int, err error)
}

type ProductService interface {
    GetByID(ctx context.Context, id string) (*Product, error)
    Create(ctx context.Context, input CreateInput) (*Product, error)
}

// Structs
type Product struct {
    ID          string    `json:"id"`
    Name        string    `json:"name"`
    Price       float64   `json:"price"`
    CreatedAt   time.Time `json:"created_at"`
}
```

#### Error Handling

```go
// Визначення помилок
var (
    ErrNotFound      = errors.New("not found")
    ErrInvalidInput  = errors.New("invalid input")
    ErrUnauthorized  = errors.New("unauthorized")
)

// Wrapping errors
func (s *Service) GetProduct(ctx context.Context, id string) (*Product, error) {
    product, err := s.repo.FindByID(ctx, id)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, ErrNotFound
        }
        return nil, fmt.Errorf("get product %s: %w", id, err)
    }
    return product, nil
}

// Handling errors
product, err := service.GetProduct(ctx, id)
if err != nil {
    if errors.Is(err, ErrNotFound) {
        return c.JSON(404, gin.H{"error": "Product not found"})
    }
    log.Error("failed to get product", "error", err)
    return c.JSON(500, gin.H{"error": "Internal server error"})
}
```

#### Context Usage

```go
// Завжди передавайте context першим аргументом
func (s *Service) CreateOrder(ctx context.Context, input CreateOrderInput) (*Order, error) {
    // Перевірка cancellation
    select {
    case <-ctx.Done():
        return nil, ctx.Err()
    default:
    }

    // Передача в залежності
    product, err := s.productService.GetByID(ctx, input.ProductID)
    if err != nil {
        return nil, err
    }

    // Database з context
    err = s.db.WithContext(ctx).Create(&order).Error
    if err != nil {
        return nil, err
    }

    return &order, nil
}
```

### TypeScript/React

#### Component Structure

```tsx
// components/ProductCard/ProductCard.tsx
import { useState, useCallback } from 'react';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/format';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string) => void;
  className?: string;
}

export function ProductCard({
  product,
  onAddToCart,
  className,
}: ProductCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = useCallback(async () => {
    if (!onAddToCart) return;

    setIsLoading(true);
    try {
      await onAddToCart(product.id);
    } finally {
      setIsLoading(false);
    }
  }, [onAddToCart, product.id]);

  return (
    <div className={cn(styles.card, className)}>
      <img src={product.image} alt={product.name} className={styles.image} />
      <h3 className={styles.name}>{product.name}</h3>
      <p className={styles.price}>{formatPrice(product.price)}</p>
      <button
        onClick={handleAddToCart}
        disabled={isLoading || !product.inStock}
        className={styles.button}
      >
        {isLoading ? 'Додавання...' : 'Додати в кошик'}
      </button>
    </div>
  );
}
```

#### Hooks

```tsx
// hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => api.products.list(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => api.products.get(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.products.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

## Git Workflow

### Branch Naming

```
feature/TICKET-123-add-product-search
bugfix/TICKET-456-fix-cart-calculation
hotfix/TICKET-789-security-patch
refactor/improve-order-service
docs/update-api-documentation
```

### Commit Messages

```
feat(products): add product search functionality

- Implement Elasticsearch integration
- Add search API endpoint
- Add filters and facets

Closes #123

---

fix(cart): correct discount calculation

The discount was being applied twice when using promocode.

Fixes #456

---

docs(api): update authentication documentation

- Add OAuth2 flow diagram
- Document refresh token endpoint
- Add code examples
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings

## Screenshots (if applicable)

## Related Issues
Closes #XXX
```

## API Development

### Handler Structure

```go
// api/handlers/product_handler.go
type ProductHandler struct {
    service ProductService
    logger  *slog.Logger
}

func NewProductHandler(service ProductService, logger *slog.Logger) *ProductHandler {
    return &ProductHandler{
        service: service,
        logger:  logger,
    }
}

// GET /api/v1/products/:id
func (h *ProductHandler) GetByID(c *gin.Context) {
    ctx := c.Request.Context()
    id := c.Param("id")

    product, err := h.service.GetByID(ctx, id)
    if err != nil {
        if errors.Is(err, ErrNotFound) {
            c.JSON(http.StatusNotFound, ErrorResponse{
                Error:   "not_found",
                Message: "Product not found",
            })
            return
        }
        h.logger.Error("failed to get product", "error", err, "id", id)
        c.JSON(http.StatusInternalServerError, ErrorResponse{
            Error:   "internal_error",
            Message: "Something went wrong",
        })
        return
    }

    c.JSON(http.StatusOK, product)
}

// POST /api/v1/products
func (h *ProductHandler) Create(c *gin.Context) {
    ctx := c.Request.Context()

    var input CreateProductInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, ErrorResponse{
            Error:   "validation_error",
            Message: "Invalid input",
            Details: parseValidationErrors(err),
        })
        return
    }

    product, err := h.service.Create(ctx, input)
    if err != nil {
        // Handle specific errors...
    }

    c.JSON(http.StatusCreated, product)
}
```

### Validation

```go
type CreateProductInput struct {
    Name        string   `json:"name" binding:"required,min=1,max=255"`
    SKU         string   `json:"sku" binding:"required,alphanum"`
    Price       float64  `json:"price" binding:"required,gt=0"`
    CategoryID  string   `json:"category_id" binding:"required,uuid"`
    Description string   `json:"description" binding:"max=5000"`
    Tags        []string `json:"tags" binding:"max=10,dive,min=1,max=50"`
}

// Custom validator
func init() {
    if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
        v.RegisterValidation("phone_ua", validateUkrainianPhone)
    }
}

func validateUkrainianPhone(fl validator.FieldLevel) bool {
    phone := fl.Field().String()
    matched, _ := regexp.MatchString(`^\+380\d{9}$`, phone)
    return matched
}
```

## Database

### Migrations

```bash
# Створення нової міграції
make migration name=add_product_variants

# Це створить файли:
# migrations/20240115120000_add_product_variants.up.sql
# migrations/20240115120000_add_product_variants.down.sql
```

```sql
-- migrations/20240115120000_add_product_variants.up.sql
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE UNIQUE INDEX idx_variants_sku ON product_variants(sku);

-- migrations/20240115120000_add_product_variants.down.sql
DROP TABLE IF EXISTS product_variants;
```

### Repository Pattern

```go
type ProductRepository interface {
    FindByID(ctx context.Context, id string) (*Product, error)
    FindAll(ctx context.Context, filter ProductFilter) ([]Product, int64, error)
    Create(ctx context.Context, product *Product) error
    Update(ctx context.Context, product *Product) error
    Delete(ctx context.Context, id string) error
}

type productRepository struct {
    db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
    return &productRepository{db: db}
}

func (r *productRepository) FindAll(ctx context.Context, filter ProductFilter) ([]Product, int64, error) {
    var products []Product
    var total int64

    query := r.db.WithContext(ctx).Model(&Product{})

    // Apply filters
    if filter.TenantID != "" {
        query = query.Where("tenant_id = ?", filter.TenantID)
    }
    if filter.CategoryID != "" {
        query = query.Where("category_id = ?", filter.CategoryID)
    }
    if filter.Search != "" {
        query = query.Where("name ILIKE ?", "%"+filter.Search+"%")
    }
    if filter.MinPrice > 0 {
        query = query.Where("price >= ?", filter.MinPrice)
    }
    if filter.MaxPrice > 0 {
        query = query.Where("price <= ?", filter.MaxPrice)
    }

    // Count total
    query.Count(&total)

    // Pagination
    offset := (filter.Page - 1) * filter.PageSize
    query = query.Offset(offset).Limit(filter.PageSize)

    // Sorting
    if filter.SortBy != "" {
        order := filter.SortBy
        if filter.SortDesc {
            order += " DESC"
        }
        query = query.Order(order)
    }

    err := query.Find(&products).Error
    return products, total, err
}
```

## Debugging

### Go Debugging (Delve)

```bash
# Запуск з debugger
dlv debug ./cmd/server

# Attach до процесу
dlv attach <pid>

# VS Code launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Core Service",
      "type": "go",
      "request": "launch",
      "mode": "auto",
      "program": "${workspaceFolder}/services/core/cmd/server",
      "env": {
        "ENV": "development"
      }
    }
  ]
}
```

### Logging

```go
// Structured logging з slog
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelDebug,
}))

logger.Info("processing order",
    slog.String("order_id", order.ID),
    slog.String("customer_id", order.CustomerID),
    slog.Float64("total", order.Total),
)

logger.Error("failed to process payment",
    slog.String("order_id", order.ID),
    slog.Any("error", err),
)
```

### Profiling

```go
import _ "net/http/pprof"

// Endpoints автоматично додаються:
// /debug/pprof/
// /debug/pprof/heap
// /debug/pprof/goroutine
// /debug/pprof/profile

// Аналіз
go tool pprof http://localhost:8080/debug/pprof/heap
go tool pprof http://localhost:8080/debug/pprof/profile?seconds=30
```

## Корисні команди

```bash
# Makefile targets
make run          # Запуск сервісу
make test         # Unit тести
make test-int     # Integration тести
make lint         # Linting
make fmt          # Formatting
make build        # Build binary
make docker       # Build Docker image
make migrate-up   # Run migrations
make migrate-down # Rollback migrations
make seed         # Seed test data
make clean        # Clean build artifacts
```
