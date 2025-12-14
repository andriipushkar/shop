# Core API Reference

API для роботи з продуктами, категоріями та інвентарем.

## Products

### List Products

```http
GET /api/v1/products
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Сторінка (default: 1) |
| `limit` | integer | Кількість (default: 20, max: 100) |
| `search` | string | Пошук по назві |
| `category_id` | string | Фільтр по категорії |
| `brand` | string | Фільтр по бренду |
| `price_min` | number | Мінімальна ціна |
| `price_max` | number | Максимальна ціна |
| `in_stock` | boolean | Тільки в наявності |
| `sort` | string | Сортування: `name`, `price`, `created_at`, `sold_count` |
| `order` | string | `asc` або `desc` |

**Response:**

```json
{
  "data": [
    {
      "id": "prod_abc123",
      "sku": "SKU-001",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "description": "Опис товару...",
      "price": 49999.00,
      "sale_price": null,
      "currency": "UAH",
      "category_id": "cat_electronics",
      "brand": "Apple",
      "in_stock": true,
      "stock_quantity": 50,
      "images": [
        {
          "url": "https://cdn.yourstore.com/products/iphone-15-pro.jpg",
          "alt": "iPhone 15 Pro"
        }
      ],
      "attributes": {
        "color": "Black",
        "storage": "256GB"
      },
      "rating": 4.8,
      "reviews_count": 124,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

### Get Product

```http
GET /api/v1/products/{id}
```

**Response:**

```json
{
  "data": {
    "id": "prod_abc123",
    "sku": "SKU-001",
    "name": "iPhone 15 Pro",
    "slug": "iphone-15-pro",
    "description": "Детальний опис товару...",
    "short_description": "Короткий опис",
    "price": 49999.00,
    "sale_price": 47999.00,
    "currency": "UAH",
    "category": {
      "id": "cat_electronics",
      "name": "Електроніка",
      "slug": "electronics"
    },
    "brand": "Apple",
    "in_stock": true,
    "stock_quantity": 50,
    "images": [
      {
        "id": "img_1",
        "url": "https://cdn.yourstore.com/products/iphone-main.jpg",
        "alt": "iPhone 15 Pro",
        "position": 0
      },
      {
        "id": "img_2",
        "url": "https://cdn.yourstore.com/products/iphone-side.jpg",
        "alt": "iPhone 15 Pro вигляд збоку",
        "position": 1
      }
    ],
    "variants": [
      {
        "id": "var_1",
        "sku": "SKU-001-BLK-256",
        "name": "Black / 256GB",
        "price": 49999.00,
        "stock_quantity": 20,
        "attributes": {
          "color": "Black",
          "storage": "256GB"
        }
      },
      {
        "id": "var_2",
        "sku": "SKU-001-BLK-512",
        "name": "Black / 512GB",
        "price": 54999.00,
        "stock_quantity": 15,
        "attributes": {
          "color": "Black",
          "storage": "512GB"
        }
      }
    ],
    "attributes": {
      "color": ["Black", "White", "Blue"],
      "storage": ["256GB", "512GB", "1TB"]
    },
    "specifications": [
      { "name": "Дисплей", "value": "6.1\" Super Retina XDR" },
      { "name": "Процесор", "value": "A17 Pro" },
      { "name": "Камера", "value": "48 MP" }
    ],
    "tags": ["new", "bestseller"],
    "rating": 4.8,
    "reviews_count": 124,
    "meta_title": "iPhone 15 Pro - купити в Україні",
    "meta_description": "iPhone 15 Pro за найкращою ціною...",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### Create Product

```http
POST /api/v1/products
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "sku": "SKU-002",
  "name": "Samsung Galaxy S24",
  "description": "Опис товару",
  "price": 39999.00,
  "category_id": "cat_electronics",
  "brand": "Samsung",
  "stock_quantity": 100,
  "images": [
    {
      "url": "https://cdn.yourstore.com/products/galaxy-s24.jpg",
      "alt": "Samsung Galaxy S24"
    }
  ],
  "attributes": {
    "color": "Black",
    "storage": "256GB"
  }
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "prod_xyz789",
    "sku": "SKU-002",
    "name": "Samsung Galaxy S24",
    ...
  }
}
```

### Update Product

```http
PATCH /api/v1/products/{id}
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "price": 37999.00,
  "sale_price": 35999.00,
  "stock_quantity": 80
}
```

**Response:** `200 OK`

### Delete Product

```http
DELETE /api/v1/products/{id}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

### Update Stock

```http
PATCH /api/v1/products/{id}/stock
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "quantity": 50,
  "operation": "set"  // "set", "add", "subtract"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "prod_abc123",
    "stock_quantity": 50,
    "in_stock": true
  }
}
```

---

## Categories

### List Categories

```http
GET /api/v1/categories
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `parent_id` | string | Фільтр по батьківській категорії |
| `tree` | boolean | Повертати дерево (default: false) |

**Response (flat):**

```json
{
  "data": [
    {
      "id": "cat_electronics",
      "name": "Електроніка",
      "slug": "electronics",
      "parent_id": null,
      "image": "https://cdn.yourstore.com/categories/electronics.jpg",
      "products_count": 450,
      "position": 0
    },
    {
      "id": "cat_phones",
      "name": "Смартфони",
      "slug": "phones",
      "parent_id": "cat_electronics",
      "products_count": 150,
      "position": 0
    }
  ]
}
```

**Response (tree):**

```json
{
  "data": [
    {
      "id": "cat_electronics",
      "name": "Електроніка",
      "slug": "electronics",
      "children": [
        {
          "id": "cat_phones",
          "name": "Смартфони",
          "slug": "phones",
          "children": []
        },
        {
          "id": "cat_laptops",
          "name": "Ноутбуки",
          "slug": "laptops",
          "children": []
        }
      ]
    }
  ]
}
```

### Get Category

```http
GET /api/v1/categories/{id}
```

**Response:**

```json
{
  "data": {
    "id": "cat_phones",
    "name": "Смартфони",
    "slug": "phones",
    "description": "Каталог смартфонів",
    "parent_id": "cat_electronics",
    "parent": {
      "id": "cat_electronics",
      "name": "Електроніка"
    },
    "image": "https://cdn.yourstore.com/categories/phones.jpg",
    "products_count": 150,
    "meta_title": "Смартфони - купити в Україні",
    "meta_description": "Великий вибір смартфонів...",
    "position": 0,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Create Category

```http
POST /api/v1/categories
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Планшети",
  "slug": "tablets",
  "parent_id": "cat_electronics",
  "description": "Каталог планшетів",
  "image": "https://cdn.yourstore.com/categories/tablets.jpg"
}
```

### Update Category

```http
PATCH /api/v1/categories/{id}
Authorization: Bearer <token>
```

### Delete Category

```http
DELETE /api/v1/categories/{id}
Authorization: Bearer <token>
```

---

## Inventory

### Get Inventory

```http
GET /api/v1/inventory
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `warehouse_id` | string | Фільтр по складу |
| `low_stock` | boolean | Тільки з низьким залишком |
| `out_of_stock` | boolean | Тільки без залишку |

**Response:**

```json
{
  "data": [
    {
      "product_id": "prod_abc123",
      "sku": "SKU-001",
      "product_name": "iPhone 15 Pro",
      "warehouses": [
        {
          "warehouse_id": "wh_main",
          "warehouse_name": "Головний склад",
          "quantity": 50,
          "reserved": 5,
          "available": 45
        },
        {
          "warehouse_id": "wh_kyiv",
          "warehouse_name": "Склад Київ",
          "quantity": 20,
          "reserved": 2,
          "available": 18
        }
      ],
      "total_quantity": 70,
      "total_reserved": 7,
      "total_available": 63,
      "low_stock_threshold": 10,
      "is_low_stock": false
    }
  ],
  "meta": {
    "total": 500,
    "low_stock_count": 15,
    "out_of_stock_count": 3
  }
}
```

### Update Inventory

```http
PUT /api/v1/inventory/{product_id}
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "warehouse_id": "wh_main",
  "quantity": 100,
  "reason": "Поповнення складу",
  "reference": "PO-2024-001"
}
```

### Inventory Movements

```http
GET /api/v1/inventory/{product_id}/movements
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": [
    {
      "id": "mov_123",
      "type": "adjustment",
      "quantity": 50,
      "previous_quantity": 50,
      "new_quantity": 100,
      "warehouse_id": "wh_main",
      "reason": "Поповнення складу",
      "reference": "PO-2024-001",
      "user_id": "user_456",
      "created_at": "2024-01-15T14:00:00Z"
    },
    {
      "id": "mov_122",
      "type": "sale",
      "quantity": -1,
      "previous_quantity": 51,
      "new_quantity": 50,
      "warehouse_id": "wh_main",
      "order_id": "ord_789",
      "created_at": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### Reserve Stock

```http
POST /api/v1/inventory/reserve
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "items": [
    {
      "product_id": "prod_abc123",
      "quantity": 2,
      "warehouse_id": "wh_main"
    }
  ],
  "order_id": "ord_pending_123",
  "expires_at": "2024-01-15T15:00:00Z"
}
```

### Release Reservation

```http
DELETE /api/v1/inventory/reserve/{reservation_id}
Authorization: Bearer <token>
```

---

## Search

### Search Products

```http
GET /api/v1/search/products
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Пошуковий запит |
| `category` | string | ID категорії |
| `brand` | string[] | Бренди |
| `price_min` | number | Мін. ціна |
| `price_max` | number | Макс. ціна |
| `in_stock` | boolean | В наявності |
| `sort` | string | Сортування |
| `facets` | boolean | Включити фасети |

**Response:**

```json
{
  "data": [
    {
      "id": "prod_abc123",
      "name": "iPhone 15 Pro",
      "price": 49999.00,
      "image": "https://cdn.yourstore.com/products/iphone.jpg",
      "in_stock": true,
      "rating": 4.8
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 24
  },
  "facets": {
    "categories": [
      { "id": "cat_phones", "name": "Смартфони", "count": 30 },
      { "id": "cat_accessories", "name": "Аксесуари", "count": 15 }
    ],
    "brands": [
      { "value": "Apple", "count": 25 },
      { "value": "Samsung", "count": 20 }
    ],
    "price_ranges": [
      { "min": 0, "max": 10000, "count": 5 },
      { "min": 10000, "max": 30000, "count": 15 },
      { "min": 30000, "max": null, "count": 25 }
    ]
  }
}
```

### Autocomplete

```http
GET /api/v1/search/suggest?q=iph
```

**Response:**

```json
{
  "data": {
    "suggestions": [
      "iPhone 15",
      "iPhone 15 Pro",
      "iPhone 15 Pro Max",
      "iPhone 14"
    ],
    "products": [
      {
        "id": "prod_abc123",
        "name": "iPhone 15 Pro",
        "price": 49999.00,
        "image": "https://..."
      }
    ],
    "categories": [
      {
        "id": "cat_iphone",
        "name": "iPhone"
      }
    ]
  }
}
```

---

## Brands

### List Brands

```http
GET /api/v1/brands
```

**Response:**

```json
{
  "data": [
    {
      "id": "brand_apple",
      "name": "Apple",
      "slug": "apple",
      "logo": "https://cdn.yourstore.com/brands/apple.svg",
      "products_count": 150
    }
  ]
}
```

---

## Reviews

### List Product Reviews

```http
GET /api/v1/products/{id}/reviews
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `rating` | integer | Фільтр по рейтингу (1-5) |
| `sort` | string | `newest`, `highest`, `lowest` |

**Response:**

```json
{
  "data": [
    {
      "id": "rev_123",
      "rating": 5,
      "title": "Відмінний товар!",
      "content": "Дуже задоволений покупкою...",
      "author": {
        "name": "Іван П.",
        "verified_purchase": true
      },
      "images": [],
      "helpful_count": 15,
      "created_at": "2024-01-10T12:00:00Z"
    }
  ],
  "meta": {
    "total": 124,
    "average_rating": 4.8,
    "rating_distribution": {
      "5": 95,
      "4": 20,
      "3": 5,
      "2": 2,
      "1": 2
    }
  }
}
```

### Create Review

```http
POST /api/v1/products/{id}/reviews
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "rating": 5,
  "title": "Чудовий товар",
  "content": "Рекомендую всім!",
  "order_id": "ord_123"
}
```

---

## Wishlists

### Get Wishlist

```http
GET /api/v1/wishlist
Authorization: Bearer <token>
```

### Add to Wishlist

```http
POST /api/v1/wishlist
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "product_id": "prod_abc123"
}
```

### Remove from Wishlist

```http
DELETE /api/v1/wishlist/{product_id}
Authorization: Bearer <token>
```

---

## Error Responses

### 404 Not Found

```json
{
  "error": {
    "code": "not_found",
    "message": "Product not found"
  }
}
```

### 400 Bad Request

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input",
    "details": [
      {
        "field": "price",
        "message": "Price must be greater than 0"
      }
    ]
  }
}
```

### 409 Conflict

```json
{
  "error": {
    "code": "conflict",
    "message": "SKU already exists"
  }
}
```
