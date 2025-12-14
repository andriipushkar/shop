# Search Module

Повнотекстовий пошук та фільтрація на базі Elasticsearch.

## Огляд

| Властивість | Значення |
|-------------|----------|
| Технологія | Elasticsearch 8.11 |
| Тип | Cross-Tenant Search |
| Індекси | Products, Orders, Customers |

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      SEARCH MODULE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │   API       │────▶│   Search    │────▶│  Elasticsearch  │   │
│  │  Gateway    │     │   Service   │     │     Cluster     │   │
│  └─────────────┘     └─────────────┘     └─────────────────┘   │
│                             │                     │             │
│                             │              ┌──────┴──────┐      │
│                             │              │   Indices   │      │
│                             │              │             │      │
│                             │              │ • products  │      │
│                             ▼              │ • orders    │      │
│                      ┌─────────────┐       │ • customers │      │
│                      │  RabbitMQ   │       │ • categories│      │
│                      │  (Indexer)  │       └─────────────┘      │
│                      └─────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Індекси

### Products Index

```json
{
  "mappings": {
    "properties": {
      "tenant_id": { "type": "keyword" },
      "id": { "type": "keyword" },
      "sku": { "type": "keyword" },
      "name": {
        "type": "text",
        "analyzer": "ukrainian",
        "fields": {
          "keyword": { "type": "keyword" },
          "suggest": { "type": "completion" }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "ukrainian"
      },
      "category_id": { "type": "keyword" },
      "category_path": { "type": "keyword" },
      "brand": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "price": { "type": "float" },
      "sale_price": { "type": "float" },
      "currency": { "type": "keyword" },
      "in_stock": { "type": "boolean" },
      "stock_quantity": { "type": "integer" },
      "attributes": {
        "type": "nested",
        "properties": {
          "name": { "type": "keyword" },
          "value": { "type": "keyword" }
        }
      },
      "tags": { "type": "keyword" },
      "rating": { "type": "float" },
      "reviews_count": { "type": "integer" },
      "sold_count": { "type": "integer" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  }
}
```

### Orders Index

```json
{
  "mappings": {
    "properties": {
      "tenant_id": { "type": "keyword" },
      "id": { "type": "keyword" },
      "order_number": { "type": "keyword" },
      "customer_id": { "type": "keyword" },
      "customer_name": { "type": "text" },
      "customer_email": { "type": "keyword" },
      "customer_phone": { "type": "keyword" },
      "status": { "type": "keyword" },
      "payment_status": { "type": "keyword" },
      "total": { "type": "float" },
      "items_count": { "type": "integer" },
      "items": {
        "type": "nested",
        "properties": {
          "product_id": { "type": "keyword" },
          "sku": { "type": "keyword" },
          "name": { "type": "text" }
        }
      },
      "created_at": { "type": "date" },
      "shipped_at": { "type": "date" }
    }
  }
}
```

### Customers Index

```json
{
  "mappings": {
    "properties": {
      "tenant_id": { "type": "keyword" },
      "id": { "type": "keyword" },
      "email": { "type": "keyword" },
      "phone": { "type": "keyword" },
      "first_name": { "type": "text" },
      "last_name": { "type": "text" },
      "full_name": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "segment": { "type": "keyword" },
      "tier": { "type": "keyword" },
      "total_orders": { "type": "integer" },
      "total_spent": { "type": "float" },
      "last_order_at": { "type": "date" },
      "created_at": { "type": "date" }
    }
  }
}
```

## Пошукові запити

### Повнотекстовий пошук

```go
type SearchRequest struct {
    Query      string            `json:"query"`
    Filters    map[string]any    `json:"filters,omitempty"`
    Sort       []SortField       `json:"sort,omitempty"`
    Page       int               `json:"page"`
    PageSize   int               `json:"page_size"`
    Facets     []string          `json:"facets,omitempty"`
}

type SearchResponse struct {
    Hits       []SearchHit       `json:"hits"`
    Total      int64             `json:"total"`
    Facets     map[string][]Facet `json:"facets,omitempty"`
    Suggestions []string         `json:"suggestions,omitempty"`
}
```

### Elasticsearch Query DSL

```json
{
  "query": {
    "bool": {
      "must": [
        { "term": { "tenant_id": "tenant_abc" } },
        {
          "multi_match": {
            "query": "iPhone 15",
            "fields": ["name^3", "description", "brand^2", "sku"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [
        { "term": { "in_stock": true } },
        { "range": { "price": { "gte": 1000, "lte": 50000 } } },
        { "terms": { "category_id": ["electronics", "phones"] } }
      ]
    }
  },
  "aggs": {
    "categories": {
      "terms": { "field": "category_path", "size": 20 }
    },
    "brands": {
      "terms": { "field": "brand.keyword", "size": 20 }
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 1000 },
          { "from": 1000, "to": 5000 },
          { "from": 5000, "to": 10000 },
          { "from": 10000 }
        ]
      }
    },
    "attributes": {
      "nested": { "path": "attributes" },
      "aggs": {
        "attr_names": {
          "terms": { "field": "attributes.name" },
          "aggs": {
            "attr_values": {
              "terms": { "field": "attributes.value" }
            }
          }
        }
      }
    }
  },
  "sort": [
    { "_score": "desc" },
    { "sold_count": "desc" }
  ],
  "from": 0,
  "size": 24
}
```

## Фільтрація

### Типи фільтрів

| Фільтр | Тип | Приклад |
|--------|-----|---------|
| Категорія | Terms | `category_id: ["phones"]` |
| Ціна | Range | `price: { min: 1000, max: 5000 }` |
| Бренд | Terms | `brand: ["Apple", "Samsung"]` |
| В наявності | Boolean | `in_stock: true` |
| Атрибути | Nested | `attributes.color: "black"` |
| Рейтинг | Range | `rating: { min: 4 }` |

### Реалізація фільтрів

```go
func buildFilters(filters map[string]any) []map[string]any {
    var esFilters []map[string]any

    if categoryID, ok := filters["category_id"]; ok {
        esFilters = append(esFilters, map[string]any{
            "terms": map[string]any{"category_id": categoryID},
        })
    }

    if priceRange, ok := filters["price"].(map[string]any); ok {
        rangeQuery := map[string]any{}
        if min, ok := priceRange["min"]; ok {
            rangeQuery["gte"] = min
        }
        if max, ok := priceRange["max"]; ok {
            rangeQuery["lte"] = max
        }
        esFilters = append(esFilters, map[string]any{
            "range": map[string]any{"price": rangeQuery},
        })
    }

    if attrs, ok := filters["attributes"].(map[string]any); ok {
        for name, value := range attrs {
            esFilters = append(esFilters, map[string]any{
                "nested": map[string]any{
                    "path": "attributes",
                    "query": map[string]any{
                        "bool": map[string]any{
                            "must": []map[string]any{
                                {"term": map[string]any{"attributes.name": name}},
                                {"term": map[string]any{"attributes.value": value}},
                            },
                        },
                    },
                },
            })
        }
    }

    return esFilters
}
```

## Автозаповнення (Suggest)

### Completion Suggester

```go
func (s *SearchService) Suggest(ctx context.Context, tenantID, prefix string) ([]string, error) {
    query := map[string]any{
        "suggest": map[string]any{
            "product-suggest": map[string]any{
                "prefix": prefix,
                "completion": map[string]any{
                    "field": "name.suggest",
                    "size":  10,
                    "contexts": map[string]any{
                        "tenant": tenantID,
                    },
                    "fuzzy": map[string]any{
                        "fuzziness": 1,
                    },
                },
            },
        },
    }
    // Execute and parse results...
}
```

### Search-as-you-type

```json
{
  "query": {
    "bool": {
      "must": [
        { "term": { "tenant_id": "tenant_abc" } },
        {
          "match_phrase_prefix": {
            "name": {
              "query": "iph",
              "max_expansions": 10
            }
          }
        }
      ]
    }
  },
  "size": 5,
  "_source": ["id", "name", "price", "image"]
}
```

## Фасетна навігація

### Aggregations

```go
type Facet struct {
    Value string `json:"value"`
    Count int64  `json:"count"`
}

func parseFacets(aggs map[string]any) map[string][]Facet {
    facets := make(map[string][]Facet)

    // Parse category facets
    if cats, ok := aggs["categories"].(map[string]any); ok {
        if buckets, ok := cats["buckets"].([]any); ok {
            for _, b := range buckets {
                bucket := b.(map[string]any)
                facets["categories"] = append(facets["categories"], Facet{
                    Value: bucket["key"].(string),
                    Count: int64(bucket["doc_count"].(float64)),
                })
            }
        }
    }

    // Parse brand facets
    // Parse price range facets
    // Parse attribute facets (nested)

    return facets
}
```

## Індексація

### Event-Driven Indexing

```go
// Підписка на події продуктів
consumer.Subscribe("search.products", func(event Event) error {
    switch event.Type {
    case "product.created", "product.updated":
        return indexProduct(event)
    case "product.deleted":
        return deleteFromIndex(event)
    }
    return nil
})

func indexProduct(event Event) error {
    var product ProductData
    json.Unmarshal(event.Data, &product)

    doc := ProductDocument{
        TenantID:      event.TenantID,
        ID:            product.ID,
        SKU:           product.SKU,
        Name:          product.Name,
        Description:   product.Description,
        CategoryID:    product.CategoryID,
        CategoryPath:  product.CategoryPath,
        Brand:         product.Brand,
        Price:         product.Price,
        SalePrice:     product.SalePrice,
        InStock:       product.StockQuantity > 0,
        StockQuantity: product.StockQuantity,
        Attributes:    product.Attributes,
        Tags:          product.Tags,
        Rating:        product.Rating,
        ReviewsCount:  product.ReviewsCount,
        SoldCount:     product.SoldCount,
        UpdatedAt:     time.Now(),
    }

    return esClient.Index("products", product.ID, doc)
}
```

### Bulk Indexing

```go
func (s *SearchService) ReindexAll(ctx context.Context, tenantID string) error {
    bulkIndexer, _ := esutil.NewBulkIndexer(esutil.BulkIndexerConfig{
        Client:     s.esClient,
        Index:      "products",
        NumWorkers: 4,
        FlushBytes: 5e+6, // 5MB
    })

    // Stream products from database
    products := s.productRepo.StreamAll(ctx, tenantID)

    for product := range products {
        doc, _ := json.Marshal(productToDocument(product))

        bulkIndexer.Add(ctx, esutil.BulkIndexerItem{
            Action:     "index",
            DocumentID: product.ID,
            Body:       bytes.NewReader(doc),
        })
    }

    return bulkIndexer.Close(ctx)
}
```

## Multi-Tenancy

### Tenant Isolation

```go
// Всі запити фільтруються по tenant_id
func (s *SearchService) Search(ctx context.Context, tenantID string, req SearchRequest) (*SearchResponse, error) {
    query := map[string]any{
        "query": map[string]any{
            "bool": map[string]any{
                "must": []map[string]any{
                    // Обов'язковий фільтр по tenant
                    {"term": map[string]any{"tenant_id": tenantID}},
                },
            },
        },
    }
    // Add user query and filters...
}
```

### Index per Tenant (Optional)

```go
// Для великих тенантів - окремий індекс
func getIndexName(tenantID string, baseIndex string) string {
    if isLargeTenant(tenantID) {
        return fmt.Sprintf("%s_%s", baseIndex, tenantID)
    }
    return baseIndex
}
```

## API Endpoints

### Search Products

```
GET /api/v1/search/products
```

Query Parameters:
| Параметр | Тип | Опис |
|----------|-----|------|
| q | string | Пошуковий запит |
| category | string | ID категорії |
| brand | string[] | Бренди |
| price_min | number | Мін. ціна |
| price_max | number | Макс. ціна |
| in_stock | boolean | Тільки в наявності |
| sort | string | Сортування |
| page | number | Сторінка |
| limit | number | Кількість (max 100) |

Response:
```json
{
  "products": [
    {
      "id": "prod_123",
      "name": "iPhone 15 Pro",
      "price": 49999.00,
      "in_stock": true,
      "image": "https://..."
    }
  ],
  "total": 156,
  "page": 1,
  "pages": 7,
  "facets": {
    "categories": [
      { "value": "Смартфони", "count": 85 },
      { "value": "Аксесуари", "count": 71 }
    ],
    "brands": [
      { "value": "Apple", "count": 45 },
      { "value": "Samsung", "count": 38 }
    ],
    "price_ranges": [
      { "value": "0-10000", "count": 23 },
      { "value": "10000-30000", "count": 67 }
    ]
  }
}
```

### Autocomplete

```
GET /api/v1/search/suggest?q=iph
```

Response:
```json
{
  "suggestions": [
    "iPhone 15",
    "iPhone 15 Pro",
    "iPhone 15 Pro Max",
    "iPhone 14"
  ]
}
```

### Admin Search

```
GET /api/v1/admin/search/orders?q=ORD-2024
GET /api/v1/admin/search/customers?q=john@example.com
```

## Analyzers

### Ukrainian Analyzer

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "ukrainian": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "ukrainian_stop",
            "ukrainian_stemmer"
          ]
        }
      },
      "filter": {
        "ukrainian_stop": {
          "type": "stop",
          "stopwords": "_ukrainian_"
        },
        "ukrainian_stemmer": {
          "type": "stemmer",
          "language": "ukrainian"
        }
      }
    }
  }
}
```

## Метрики

| Метрика | Опис |
|---------|------|
| `search_requests_total` | Кількість пошукових запитів |
| `search_latency_seconds` | Час відповіді |
| `search_results_count` | Кількість результатів |
| `search_zero_results_total` | Запити без результатів |
| `index_operations_total` | Операції індексації |

## Конфігурація

```bash
# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# Indices
ES_PRODUCTS_INDEX=products
ES_ORDERS_INDEX=orders
ES_CUSTOMERS_INDEX=customers

# Search settings
SEARCH_DEFAULT_PAGE_SIZE=24
SEARCH_MAX_PAGE_SIZE=100
SEARCH_FUZZINESS=AUTO

# Indexing
INDEX_BULK_SIZE=1000
INDEX_FLUSH_INTERVAL=5s
```
