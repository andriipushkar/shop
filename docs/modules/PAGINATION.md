# Pagination

Система курсорної пагінації для ефективної роботи з великими наборами даних.

## Overview

Модуль pagination забезпечує:
- Курсорна пагінація (стабільна при змінах)
- Offset пагінація (для простих випадків)
- Keyset пагінація (для швидкого скролу)
- Infinite scroll підтримка
- Консистентні результати

## Cursor vs Offset Pagination

| Feature | Cursor | Offset |
|---------|--------|--------|
| Стабільність при змінах | Стабільна | Нестабільна |
| Швидкість на великих даних | O(1) | O(n) |
| Пропуск сторінок | Ні | Так |
| Infinite scroll | Ідеально | Проблеми |
| Підрахунок total | Дорого | Легко |

## Cursor Pagination

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Cursor = encoded(last_id, last_sort_value)                 │
│                                                             │
│  Page 1: items 1-20  ────────────► cursor: "abc123"        │
│  Page 2: items 21-40 (cursor: "abc123") ──► cursor: "def456"│
│  Page 3: items 41-60 (cursor: "def456") ──► cursor: "ghi789"│
│                                                             │
│  Even if item 15 is deleted between page loads,            │
│  you won't skip or duplicate items!                        │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```go
package pagination

import (
    "encoding/base64"
    "encoding/json"
    "time"
)

// Cursor represents pagination cursor
type Cursor struct {
    ID        string    `json:"id"`
    SortValue any       `json:"sv,omitempty"`
    SortField string    `json:"sf,omitempty"`
    CreatedAt time.Time `json:"ca"`
}

// Encode encodes cursor to string
func (c *Cursor) Encode() string {
    data, _ := json.Marshal(c)
    return base64.URLEncoding.EncodeToString(data)
}

// Decode decodes cursor from string
func Decode(s string) (*Cursor, error) {
    data, err := base64.URLEncoding.DecodeString(s)
    if err != nil {
        return nil, err
    }
    var cursor Cursor
    if err := json.Unmarshal(data, &cursor); err != nil {
        return nil, err
    }
    return &cursor, nil
}

// PageRequest represents pagination request
type PageRequest struct {
    First  int     // Number of items (forward)
    After  string  // Cursor (forward)
    Last   int     // Number of items (backward)
    Before string  // Cursor (backward)
}

// PageInfo represents pagination info
type PageInfo struct {
    HasNextPage     bool   `json:"hasNextPage"`
    HasPreviousPage bool   `json:"hasPreviousPage"`
    StartCursor     string `json:"startCursor,omitempty"`
    EndCursor       string `json:"endCursor,omitempty"`
    TotalCount      int    `json:"totalCount,omitempty"`
}

// Connection represents paginated response (Relay spec)
type Connection[T any] struct {
    Edges    []Edge[T] `json:"edges"`
    PageInfo PageInfo  `json:"pageInfo"`
}

// Edge represents single item with cursor
type Edge[T any] struct {
    Node   T      `json:"node"`
    Cursor string `json:"cursor"`
}
```

### Database Query

```go
func (r *Repository) ListProducts(ctx context.Context, req PageRequest, sort string) (*Connection[Product], error) {
    limit := req.First
    if limit == 0 {
        limit = 20
    }

    query := `
        SELECT id, name, price, created_at
        FROM products
        WHERE deleted_at IS NULL
    `
    args := []any{}

    // Apply cursor
    if req.After != "" {
        cursor, _ := pagination.Decode(req.After)
        switch sort {
        case "price_asc":
            query += " AND (price > $1 OR (price = $1 AND id > $2))"
            args = append(args, cursor.SortValue, cursor.ID)
        case "price_desc":
            query += " AND (price < $1 OR (price = $1 AND id < $2))"
            args = append(args, cursor.SortValue, cursor.ID)
        default:
            query += " AND id > $1"
            args = append(args, cursor.ID)
        }
    }

    // Order and limit
    query += fmt.Sprintf(" ORDER BY %s LIMIT $%d", sortClause(sort), len(args)+1)
    args = append(args, limit+1) // +1 to check hasNextPage

    rows, err := r.db.QueryContext(ctx, query, args...)
    // ... process rows

    // Build connection
    hasNextPage := len(products) > limit
    if hasNextPage {
        products = products[:limit]
    }

    edges := make([]Edge[Product], len(products))
    for i, p := range products {
        edges[i] = Edge[Product]{
            Node:   p,
            Cursor: pagination.Cursor{ID: p.ID, SortValue: p.Price}.Encode(),
        }
    }

    return &Connection[Product]{
        Edges: edges,
        PageInfo: PageInfo{
            HasNextPage: hasNextPage,
            StartCursor: edges[0].Cursor,
            EndCursor:   edges[len(edges)-1].Cursor,
        },
    }, nil
}
```

## Usage

### API Request

```typescript
// First page
GET /api/v1/products?first=20

// Next page
GET /api/v1/products?first=20&after=eyJpZCI6IjEyMyIsInN2IjoxMDAwfQ

// Previous page
GET /api/v1/products?last=20&before=eyJpZCI6IjQ1NiIsInN2IjoyMDAwfQ
```

### API Response

```json
{
  "edges": [
    {
      "node": {
        "id": "prod-123",
        "name": "iPhone 15 Pro",
        "price": 45000
      },
      "cursor": "eyJpZCI6InByb2QtMTIzIiwic3YiOjQ1MDAwfQ"
    },
    {
      "node": {
        "id": "prod-456",
        "name": "Samsung Galaxy S24",
        "price": 35000
      },
      "cursor": "eyJpZCI6InByb2QtNDU2Iiwic3YiOjM1MDAwfQ"
    }
  ],
  "pageInfo": {
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "eyJpZCI6InByb2QtMTIzIiwic3YiOjQ1MDAwfQ",
    "endCursor": "eyJpZCI6InByb2QtNDU2Iiwic3YiOjM1MDAwfQ",
    "totalCount": 1523
  }
}
```

### GraphQL

```graphql
query Products($first: Int, $after: String) {
  products(first: $first, after: $after) {
    edges {
      node {
        id
        name
        price
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### React Hook

```typescript
function useInfiniteProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || (pageInfo && !pageInfo.hasNextPage)) return;

    setLoading(true);
    const response = await fetch(
      `/api/v1/products?first=20${pageInfo?.endCursor ? `&after=${pageInfo.endCursor}` : ''}`
    );
    const data = await response.json();

    setProducts(prev => [...prev, ...data.edges.map((e: Edge<Product>) => e.node)]);
    setPageInfo(data.pageInfo);
    setLoading(false);
  }, [pageInfo, loading]);

  return { products, loadMore, hasMore: pageInfo?.hasNextPage, loading };
}

// Usage with intersection observer
function ProductList() {
  const { products, loadMore, hasMore, loading } = useInfiniteProducts();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
      <div ref={loadMoreRef}>
        {loading && <Spinner />}
      </div>
    </div>
  );
}
```

## Offset Pagination

For admin panels where page navigation is needed:

```typescript
// Request
GET /api/v1/admin/products?page=5&perPage=50

// Response
{
  "data": [...],
  "meta": {
    "currentPage": 5,
    "perPage": 50,
    "totalPages": 31,
    "totalCount": 1523
  }
}
```

```go
type OffsetRequest struct {
    Page    int `query:"page" default:"1"`
    PerPage int `query:"perPage" default:"20" max:"100"`
}

type OffsetResponse[T any] struct {
    Data []T        `json:"data"`
    Meta OffsetMeta `json:"meta"`
}

type OffsetMeta struct {
    CurrentPage int `json:"currentPage"`
    PerPage     int `json:"perPage"`
    TotalPages  int `json:"totalPages"`
    TotalCount  int `json:"totalCount"`
}
```

## Best Practices

1. **Use cursor for public APIs** - Stability over convenience
2. **Use offset for admin** - When page navigation needed
3. **Set max page size** - Prevent huge queries
4. **Index sort columns** - Essential for performance
5. **Include sort in cursor** - For multi-field sorts
6. **Calculate total async** - Don't block main query
7. **Cache counts** - Total counts are expensive

## See Also

- [GraphQL](../architecture/GRAPHQL.md)
- [API Design](../api/README.md)
- [Performance Guide](../guides/PERFORMANCE.md)
