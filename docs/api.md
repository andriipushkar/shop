# API Reference

## Core Service (Port 8080)

### Products

#### Create Product
```http
POST /products
Content-Type: application/json

{
  "name": "Product Name",
  "price": 99.99,
  "sku": "SKU-001"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Product Name",
  "price": 99.99,
  "sku": "SKU-001",
  "created_at": "2025-12-05T12:00:00Z"
}
```

#### List Products
```http
GET /products
```

**Response:** `200 OK`
```json
[
  {"id": "uuid", "name": "Product", "price": 99.99, "sku": "SKU-001"}
]
```

---

## OMS Service (Port 8081)

### Orders

#### Create Order
```http
POST /orders
Content-Type: application/json

{
  "product_id": "product-uuid",
  "quantity": 1,
  "user_id": 123456789
}
```

**Response:** `201 Created`
```json
{
  "id": "ORD-1234567890",
  "product_id": "product-uuid",
  "quantity": 1,
  "status": "NEW",
  "user_id": 123456789,
  "created_at": "2025-12-05T12:00:00Z"
}
```

---

## Telegram Bot Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Welcome message | `/start` |
| `/products` | List products with Buy buttons | `/products` |
| `/create` | Create a new product | `/create Laptop 1200 LPT-001` |
| `/buy` | Buy a product (legacy) | `/buy product-uuid 1` |
