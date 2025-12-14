# Global Search Documentation

## Overview

Global Search is a cross-tenant product aggregator that enables marketplace functionality across all stores in the platform. It powers features like price comparison, product discovery, and a unified shopping experience similar to Google Shopping.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Search Service                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Indexer    │  │   Searcher   │  │  Recommendations │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│           │                │                   │            │
│           └────────────────┼───────────────────┘            │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │  Elasticsearch  │                       │
│                   │   Cluster       │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
         ▲                                        ▲
         │                                        │
    ┌────┴─────┐   ┌──────────┐   ┌──────────┐  │
    │ Tenant A │   │ Tenant B │   │ Tenant C │──┘
    └──────────┘   └──────────┘   └──────────┘
```

## Features

- **Cross-Tenant Search**: Search products across all participating stores
- **Price Comparison**: Compare prices for similar products
- **Faceted Search**: Filter by category, brand, price, attributes
- **Geo-Location**: Find products near the user
- **Recommendations**: Personalized product suggestions
- **Trending Products**: Discover popular items
- **Auto-Complete**: Search suggestions as you type

## Elasticsearch Indices

### Products Index

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "tenant_id": { "type": "keyword" },
      "tenant_name": { "type": "text" },
      "name": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": { "type": "keyword" },
          "autocomplete": { "type": "text", "analyzer": "autocomplete" }
        }
      },
      "description": { "type": "text" },
      "category": { "type": "keyword" },
      "categories": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "price": { "type": "float" },
      "sale_price": { "type": "float" },
      "currency": { "type": "keyword" },
      "in_stock": { "type": "boolean" },
      "rating": { "type": "float" },
      "review_count": { "type": "integer" },
      "location": { "type": "geo_point" },
      "attributes": { "type": "object" },
      "tags": { "type": "keyword" },
      "visibility": { "type": "keyword" },
      "indexed_at": { "type": "date" }
    }
  }
}
```

### Stores Index

```json
{
  "mappings": {
    "properties": {
      "tenant_id": { "type": "keyword" },
      "name": { "type": "text" },
      "domain": { "type": "keyword" },
      "description": { "type": "text" },
      "logo": { "type": "keyword" },
      "categories": { "type": "keyword" },
      "rating": { "type": "float" },
      "product_count": { "type": "integer" },
      "location": { "type": "geo_point" },
      "is_verified": { "type": "boolean" }
    }
  }
}
```

## API Endpoints

### Search Products

```
POST /api/v1/global/search
Content-Type: application/json

{
  "query": "iphone case",
  "categories": ["electronics", "accessories"],
  "brands": ["Apple", "Samsung"],
  "price_min": 10,
  "price_max": 100,
  "in_stock": true,
  "sort_by": "price_asc",
  "page": 1,
  "page_size": 20
}
```

Response:
```json
{
  "products": [
    {
      "id": "prod_123",
      "tenant_id": "store_abc",
      "store_name": "TechShop",
      "store_domain": "techshop.example.com",
      "name": "iPhone 15 Silicone Case",
      "price": 29.99,
      "sale_price": 24.99,
      "currency": "USD",
      "image_url": "https://...",
      "url": "https://techshop.example.com/product/iphone-case",
      "in_stock": true,
      "rating": 4.5,
      "review_count": 128
    }
  ],
  "total": 1250,
  "page": 1,
  "page_size": 20,
  "facets": {
    "categories": [
      { "key": "phone-cases", "count": 450 },
      { "key": "screen-protectors", "count": 320 }
    ],
    "brands": [
      { "key": "Apple", "count": 200 },
      { "key": "Spigen", "count": 180 }
    ],
    "price_ranges": [
      { "key": "0-25", "count": 400 },
      { "key": "25-50", "count": 500 }
    ]
  },
  "suggestions": ["iphone 15 case", "iphone 14 case"],
  "took_ms": 45
}
```

### Compare Prices

```
GET /api/v1/global/compare?product_id={id}
```

Response:
```json
{
  "product_name": "iPhone 15 Pro Case",
  "image": "https://...",
  "offers": [
    {
      "store_id": "store_abc",
      "store_name": "TechShop",
      "price": 29.99,
      "currency": "USD",
      "in_stock": true,
      "url": "https://...",
      "shipping": "Free shipping"
    },
    {
      "store_id": "store_xyz",
      "store_name": "GadgetWorld",
      "price": 34.99,
      "currency": "USD",
      "in_stock": true,
      "url": "https://..."
    }
  ],
  "price_range": {
    "min": 29.99,
    "max": 45.00,
    "average": 35.50
  }
}
```

### Get Trending Products

```
GET /api/v1/global/trending?category={category}&limit=10
```

### Get Recommendations

```
GET /api/v1/global/recommendations?user_id={id}&limit=10
```

### Auto-Complete

```
GET /api/v1/global/suggest?q=iph&limit=5
```

Response:
```json
{
  "suggestions": [
    "iphone 15",
    "iphone case",
    "iphone charger",
    "iphone screen protector"
  ]
}
```

### Geo Search

```
POST /api/v1/global/search
Content-Type: application/json

{
  "query": "coffee",
  "location": {
    "lat": 40.7128,
    "lon": -74.0060
  },
  "radius": "10km",
  "sort_by": "distance"
}
```

## Tenant Configuration

### Enable Global Search

```
POST /api/v1/global/tenants/{tenant_id}/enable
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "visibility": "public",
  "category_mapping": {
    "phones": "electronics/phones",
    "laptops": "electronics/computers"
  },
  "exclude_categories": ["internal", "test"],
  "price_markup": 0,
  "commission_rate": 5.0
}
```

### Sync Products

```
POST /api/v1/global/tenants/{tenant_id}/sync
Authorization: Bearer {admin_token}
```

### Get Sync Status

```
GET /api/v1/global/tenants/{tenant_id}/status
```

Response:
```json
{
  "tenant_id": "store_abc",
  "is_enabled": true,
  "product_count": 5000,
  "last_sync_at": "2024-01-15T10:00:00Z",
  "sync_status": "completed",
  "errors": []
}
```

## Product Visibility

| Level | Description |
|-------|-------------|
| `private` | Only visible in tenant's own store |
| `public` | Visible in global marketplace |
| `partners` | Visible only to partner network |

## Indexing Flow

1. **Product Created/Updated**: Webhook triggers indexing
2. **Apply Tenant Config**: Map categories, apply markup
3. **Index to Elasticsearch**: Store in global index
4. **Update Store Stats**: Increment product count

```go
// Enable tenant for global search
config := &TenantIndexConfig{
    TenantID:     "tenant_123",
    TenantName:   "My Store",
    TenantDomain: "mystore.com",
    IsEnabled:    true,
    Visibility:   VisibilityPublic,
    CategoryMapping: map[string]string{
        "local-phones": "electronics/phones",
    },
    CommissionRate: 5.0,
}
err := globalSearch.ConfigureTenant(ctx, config)

// Sync all products
err = globalSearch.SyncTenant(ctx, "tenant_123")
```

## Search Features

### Boosting

Products are boosted based on:
- **Rating**: Higher rated products score better
- **Availability**: In-stock items preferred
- **Recency**: Newer products get a slight boost
- **Store Reputation**: Verified stores rank higher

### Synonyms

```json
{
  "settings": {
    "analysis": {
      "filter": {
        "synonym_filter": {
          "type": "synonym",
          "synonyms": [
            "phone, mobile, cell phone",
            "laptop, notebook",
            "tv, television"
          ]
        }
      }
    }
  }
}
```

## Commission & Pricing

When products are sold through global marketplace:

1. **Price Markup**: Optional % added to base price
2. **Platform Commission**: % taken from each sale
3. **Settlement**: Daily settlement to tenant accounts

```
Final Price = Base Price * (1 + Price Markup)
Commission = Final Price * Commission Rate
Tenant Revenue = Final Price - Commission
```

## Monitoring

### Metrics

- `globalsearch_queries_total` - Total search queries
- `globalsearch_latency_seconds` - Search latency
- `globalsearch_products_indexed` - Products in index by tenant
- `globalsearch_sync_duration_seconds` - Sync duration

### Alerts

| Alert | Condition |
|-------|-----------|
| Search Latency High | p99 > 500ms |
| Index Size Growing | > 10% daily growth |
| Sync Failures | > 3 consecutive failures |

## Best Practices

1. **Category Mapping**: Map local categories to global taxonomy
2. **Quality Data**: Ensure products have images, descriptions
3. **Keep Stock Updated**: Real-time inventory sync
4. **Monitor Performance**: Track search relevance metrics
