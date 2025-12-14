# Core Service

The Core Service is the central backend service handling product information management (PIM), catalog, inventory, and search functionality.

## Overview

| Property | Value |
|----------|-------|
| Port | 8080 |
| Technology | Go 1.24 |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Search | Elasticsearch 8.11 |

## Responsibilities

- Product catalog management (CRUD)
- Category hierarchy
- Inventory tracking
- Full-text search
- Image management
- Price management and history
- Attribute management (EAV)
- API key management
- Rate limiting
- Webhook management

## Internal Modules

```
internal/
├── pim/              # Product Information Management
├── auth/             # JWT authentication
├── cache/            # Redis caching
├── search/           # Elasticsearch integration
├── storage/          # MinIO/S3 file storage
├── inventory/        # Stock management
├── warehouse/        # Warehouse operations
├── analytics/        # Product analytics
├── apikeys/          # API key management
├── billing/          # Subscription billing
├── domains/          # Custom domain management
├── export/           # Data export (CSV, Excel)
├── gateway/          # API gateway & rate limiting
├── globalsearch/     # Cross-tenant search
├── loyalty/          # Loyalty program
├── marketplace/      # Marketplace integrations
│   ├── rozetka/
│   ├── prom/
│   └── feeds/
├── metering/         # Usage metering
├── onboarding/       # Tenant onboarding
├── ratelimit/        # Rate limiting
├── tenant/           # Multi-tenancy
├── webhooks/         # Webhook management
└── versioning/       # API versioning
```

## API Endpoints

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List products (paginated) |
| GET | `/api/v1/products/:id` | Get product by ID |
| POST | `/api/v1/products` | Create product |
| PUT | `/api/v1/products/:id` | Update product |
| DELETE | `/api/v1/products/:id` | Delete product |
| POST | `/api/v1/products/bulk` | Bulk operations |
| POST | `/api/v1/products/import` | Import from CSV |
| GET | `/api/v1/products/export` | Export to CSV |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/categories` | List categories (tree) |
| GET | `/api/v1/categories/:id` | Get category |
| POST | `/api/v1/categories` | Create category |
| PUT | `/api/v1/categories/:id` | Update category |
| DELETE | `/api/v1/categories/:id` | Delete category |

### Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/inventory` | Get stock levels |
| PUT | `/api/v1/inventory/:sku` | Update stock |
| POST | `/api/v1/inventory/reserve` | Reserve stock |
| POST | `/api/v1/inventory/release` | Release reservation |
| GET | `/api/v1/inventory/low-stock` | Get low stock items |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/search` | Full-text search |
| GET | `/api/v1/search/suggest` | Autocomplete |
| POST | `/api/v1/search/reindex` | Reindex products |

### Cart & Wishlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cart` | Get user's cart |
| POST | `/api/v1/cart/items` | Add to cart |
| DELETE | `/api/v1/cart/items/:id` | Remove from cart |
| GET | `/api/v1/wishlist` | Get wishlist |
| POST | `/api/v1/wishlist` | Add to wishlist |

## Data Models

### Product

```go
type Product struct {
    ID          string            `json:"id"`
    TenantID    string            `json:"tenant_id"`
    SKU         string            `json:"sku"`
    Name        string            `json:"name"`
    Description string            `json:"description"`
    Price       decimal.Decimal   `json:"price"`
    OldPrice    *decimal.Decimal  `json:"old_price,omitempty"`
    Currency    string            `json:"currency"`
    CategoryID  string            `json:"category_id"`
    Brand       string            `json:"brand,omitempty"`
    Images      []string          `json:"images"`
    Attributes  map[string]any    `json:"attributes"`
    Stock       int               `json:"stock"`
    Status      ProductStatus     `json:"status"`
    CreatedAt   time.Time         `json:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at"`
}
```

### Category

```go
type Category struct {
    ID          string     `json:"id"`
    TenantID    string     `json:"tenant_id"`
    Name        string     `json:"name"`
    Slug        string     `json:"slug"`
    ParentID    *string    `json:"parent_id,omitempty"`
    Description string     `json:"description,omitempty"`
    Image       string     `json:"image,omitempty"`
    SortOrder   int        `json:"sort_order"`
    IsActive    bool       `json:"is_active"`
    Children    []Category `json:"children,omitempty"`
}
```

## Configuration

```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/shop_core

# Redis
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=shop

# Storage (MinIO/S3)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=shop-images
MINIO_USE_SSL=false

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=1m
```

## Events Published

| Event | Trigger | Payload |
|-------|---------|---------|
| `product.created` | New product | Product data |
| `product.updated` | Product modified | Product data, changes |
| `product.deleted` | Product removed | Product ID |
| `stock.updated` | Stock changed | SKU, old/new quantity |
| `stock.low` | Stock below threshold | SKU, current stock |
| `category.updated` | Category changed | Category data |
| `search.reindexed` | Reindex completed | Tenant ID, count |

## Caching Strategy

### Cache Keys

```
product:{tenant_id}:{product_id}      # Single product
products:{tenant_id}:list:{page}      # Product list
category:{tenant_id}:{category_id}    # Category
categories:{tenant_id}:tree           # Category tree
search:{tenant_id}:{query_hash}       # Search results
cart:{user_id}                        # User's cart
```

### TTL Settings

| Cache | TTL | Invalidation |
|-------|-----|--------------|
| Products | 1 hour | On update |
| Categories | 24 hours | On update |
| Search | 5 minutes | TTL only |
| Cart | 7 days | On update |

## Search Configuration

### Elasticsearch Index

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "ukrainian": {
          "tokenizer": "standard",
          "filter": ["lowercase", "ukrainian_stemmer"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "ukrainian",
        "fields": {
          "keyword": { "type": "keyword" },
          "suggest": { "type": "completion" }
        }
      },
      "price": { "type": "float" },
      "category_id": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "in_stock": { "type": "boolean" }
    }
  }
}
```

## Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `core_products_total` | Gauge | Total products count |
| `core_search_requests` | Counter | Search requests |
| `core_search_latency` | Histogram | Search response time |
| `core_cache_hits` | Counter | Cache hit rate |
| `core_inventory_updates` | Counter | Inventory changes |

## Running Locally

```bash
cd services/core

# Install dependencies
go mod download

# Run migrations
go run cmd/migrate/main.go up

# Start server
go run cmd/server/main.go

# Run tests
go test ./...

# With coverage
go test -coverprofile=coverage.out ./...
```

## Docker

```bash
# Build
docker build -t shop-core .

# Run
docker run -p 8080:8080 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  shop-core
```

## Health Endpoints

```bash
# Liveness probe
curl http://localhost:8080/health/live

# Readiness probe
curl http://localhost:8080/health/ready

# Full health check
curl http://localhost:8080/health
```
