# GraphQL API

GraphQL API для гнучких запитів та мутацій з підтримкою real-time subscriptions.

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      GraphQL Layer                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Client ──►  ┌──────────────────────────────────────────┐      │
│               │           GraphQL Gateway                 │      │
│               │  ┌────────────┐  ┌────────────┐          │      │
│               │  │   Schema   │  │  Resolver  │          │      │
│               │  │  Stitching │  │   Layer    │          │      │
│               │  └────────────┘  └────────────┘          │      │
│               │  ┌────────────┐  ┌────────────┐          │      │
│               │  │   Query    │  │ Mutation   │          │      │
│               │  │   Parser   │  │  Handler   │          │      │
│               │  └────────────┘  └────────────┘          │      │
│               └──────────────────────────────────────────┘      │
│                          │                                       │
│           ┌──────────────┼──────────────┐                       │
│           ▼              ▼              ▼                       │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│   │   Products   │ │   Orders     │ │   Users      │           │
│   │   Service    │ │   Service    │ │   Service    │           │
│   └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Schema Definition

### Base Schema

```graphql
# schema/schema.graphql

# Scalars
scalar DateTime
scalar JSON
scalar Money
scalar Upload

# Directives
directive @auth(requires: Role = USER) on FIELD_DEFINITION
directive @tenant on FIELD_DEFINITION
directive @rateLimit(limit: Int!, window: String!) on FIELD_DEFINITION
directive @cacheControl(maxAge: Int, scope: CacheControlScope) on FIELD_DEFINITION

enum CacheControlScope {
  PUBLIC
  PRIVATE
}

enum Role {
  GUEST
  USER
  ADMIN
  SUPER_ADMIN
}

# Root Types
type Query {
  # Products
  products(filter: ProductFilter, pagination: PaginationInput): ProductConnection! @tenant
  product(id: ID!): Product @tenant
  productBySlug(slug: String!): Product @tenant

  # Categories
  categories(parentId: ID): [Category!]! @tenant
  category(id: ID!): Category @tenant

  # Orders
  orders(filter: OrderFilter, pagination: PaginationInput): OrderConnection! @auth @tenant
  order(id: ID!): Order @auth @tenant

  # Cart
  cart: Cart @tenant

  # User
  me: User @auth
  user(id: ID!): User @auth(requires: ADMIN) @tenant

  # Search
  search(query: String!, type: SearchType, pagination: PaginationInput): SearchResult! @tenant @rateLimit(limit: 60, window: "1m")

  # Analytics (Admin)
  analytics(dateRange: DateRangeInput!): Analytics! @auth(requires: ADMIN) @tenant
}

type Mutation {
  # Auth
  login(input: LoginInput!): AuthPayload!
  register(input: RegisterInput!): AuthPayload!
  logout: Boolean! @auth
  refreshToken(refreshToken: String!): AuthPayload!

  # Products (Admin)
  createProduct(input: CreateProductInput!): Product! @auth(requires: ADMIN) @tenant
  updateProduct(id: ID!, input: UpdateProductInput!): Product! @auth(requires: ADMIN) @tenant
  deleteProduct(id: ID!): Boolean! @auth(requires: ADMIN) @tenant

  # Cart
  addToCart(input: AddToCartInput!): Cart! @tenant
  updateCartItem(itemId: ID!, quantity: Int!): Cart! @tenant
  removeFromCart(itemId: ID!): Cart! @tenant
  clearCart: Cart! @tenant

  # Orders
  createOrder(input: CreateOrderInput!): Order! @auth @tenant
  cancelOrder(id: ID!, reason: String): Order! @auth @tenant
  updateOrderStatus(id: ID!, status: OrderStatus!): Order! @auth(requires: ADMIN) @tenant

  # User
  updateProfile(input: UpdateProfileInput!): User! @auth
  updatePassword(input: UpdatePasswordInput!): Boolean! @auth

  # Checkout
  initiateCheckout(input: CheckoutInput!): CheckoutSession! @tenant
  completeCheckout(sessionId: ID!, paymentData: JSON): Order! @tenant
}

type Subscription {
  # Real-time updates
  orderUpdated(orderId: ID!): Order! @auth
  cartUpdated: Cart! @tenant
  productUpdated(productId: ID!): Product! @tenant
  inventoryAlert(productId: ID!): InventoryAlert! @auth(requires: ADMIN) @tenant
}
```

### Product Types

```graphql
# schema/product.graphql

type Product {
  id: ID!
  name: String!
  slug: String!
  description: String
  shortDescription: String

  # Pricing
  price: Money!
  compareAtPrice: Money
  costPrice: Money @auth(requires: ADMIN)

  # Media
  images: [ProductImage!]!
  mainImage: ProductImage

  # Classification
  category: Category
  categories: [Category!]!
  tags: [String!]!

  # Inventory
  sku: String
  barcode: String
  inventory: ProductInventory!
  trackInventory: Boolean!

  # Variants
  hasVariants: Boolean!
  variants: [ProductVariant!]!
  options: [ProductOption!]!

  # SEO
  seo: SEO

  # Attributes
  attributes: [ProductAttribute!]!

  # Related
  relatedProducts: [Product!]!

  # Status
  status: ProductStatus!
  visibility: ProductVisibility!

  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
  publishedAt: DateTime
}

type ProductVariant {
  id: ID!
  sku: String!
  name: String!
  price: Money!
  compareAtPrice: Money
  inventory: Int!
  options: [VariantOption!]!
  image: ProductImage
  weight: Float
  dimensions: Dimensions
  isDefault: Boolean!
}

type ProductOption {
  id: ID!
  name: String!
  values: [String!]!
}

type VariantOption {
  name: String!
  value: String!
}

type ProductImage {
  id: ID!
  url: String!
  alt: String
  width: Int
  height: Int
  position: Int!
}

type ProductInventory {
  quantity: Int!
  reserved: Int!
  available: Int!
  lowStockThreshold: Int
  isLowStock: Boolean!
  isOutOfStock: Boolean!
}

type ProductAttribute {
  name: String!
  value: String!
  visible: Boolean!
}

type Dimensions {
  length: Float
  width: Float
  height: Float
  unit: String!
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum ProductVisibility {
  VISIBLE
  HIDDEN
  SEARCH_ONLY
}

# Inputs
input ProductFilter {
  query: String
  categoryId: ID
  categorySlug: String
  status: ProductStatus
  visibility: ProductVisibility
  priceMin: Float
  priceMax: Float
  inStock: Boolean
  hasDiscount: Boolean
  tags: [String!]
  attributes: [AttributeFilter!]
  sortBy: ProductSortBy
  sortOrder: SortOrder
}

input AttributeFilter {
  name: String!
  values: [String!]!
}

enum ProductSortBy {
  NAME
  PRICE
  CREATED_AT
  UPDATED_AT
  POPULARITY
  RATING
}

enum SortOrder {
  ASC
  DESC
}

input CreateProductInput {
  name: String!
  slug: String
  description: String
  shortDescription: String
  price: Float!
  compareAtPrice: Float
  costPrice: Float
  categoryId: ID
  categoryIds: [ID!]
  tags: [String!]
  sku: String
  barcode: String
  trackInventory: Boolean
  inventoryQuantity: Int
  lowStockThreshold: Int
  status: ProductStatus
  visibility: ProductVisibility
  images: [ProductImageInput!]
  attributes: [ProductAttributeInput!]
  variants: [ProductVariantInput!]
  options: [ProductOptionInput!]
  seo: SEOInput
}

input UpdateProductInput {
  name: String
  slug: String
  description: String
  shortDescription: String
  price: Float
  compareAtPrice: Float
  costPrice: Float
  categoryId: ID
  categoryIds: [ID!]
  tags: [String!]
  sku: String
  barcode: String
  trackInventory: Boolean
  inventoryQuantity: Int
  lowStockThreshold: Int
  status: ProductStatus
  visibility: ProductVisibility
  images: [ProductImageInput!]
  attributes: [ProductAttributeInput!]
  seo: SEOInput
}

input ProductImageInput {
  url: String!
  alt: String
  position: Int
}

input ProductAttributeInput {
  name: String!
  value: String!
  visible: Boolean
}

input ProductVariantInput {
  sku: String!
  name: String
  price: Float!
  compareAtPrice: Float
  inventory: Int
  options: [VariantOptionInput!]!
  imageUrl: String
  weight: Float
  isDefault: Boolean
}

input ProductOptionInput {
  name: String!
  values: [String!]!
}

input VariantOptionInput {
  name: String!
  value: String!
}
```

### Order Types

```graphql
# schema/order.graphql

type Order {
  id: ID!
  number: String!
  status: OrderStatus!

  # Customer
  customer: Customer!
  customerEmail: String!

  # Items
  items: [OrderItem!]!
  itemCount: Int!

  # Shipping
  shippingAddress: Address!
  billingAddress: Address
  shippingMethod: ShippingMethod
  trackingNumber: String
  trackingUrl: String

  # Payment
  paymentStatus: PaymentStatus!
  paymentMethod: PaymentMethod

  # Pricing
  subtotal: Money!
  shippingCost: Money!
  discount: Money!
  tax: Money!
  total: Money!

  # Discounts
  appliedDiscounts: [AppliedDiscount!]!
  couponCode: String

  # Notes
  customerNote: String
  internalNote: String @auth(requires: ADMIN)

  # Timeline
  timeline: [OrderEvent!]!

  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
  paidAt: DateTime
  shippedAt: DateTime
  deliveredAt: DateTime
  cancelledAt: DateTime
}

type OrderItem {
  id: ID!
  product: Product
  productId: ID!
  variantId: ID
  name: String!
  sku: String
  quantity: Int!
  unitPrice: Money!
  totalPrice: Money!
  discount: Money!
  image: String
  options: [OrderItemOption!]!
}

type OrderItemOption {
  name: String!
  value: String!
}

type OrderEvent {
  id: ID!
  type: OrderEventType!
  message: String!
  data: JSON
  createdAt: DateTime!
  createdBy: User
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  PAID
  PARTIALLY_REFUNDED
  REFUNDED
  FAILED
}

enum OrderEventType {
  CREATED
  CONFIRMED
  PAYMENT_RECEIVED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
  NOTE_ADDED
  STATUS_CHANGED
}

type AppliedDiscount {
  code: String
  type: DiscountType!
  value: Float!
  amount: Money!
  description: String
}

enum DiscountType {
  PERCENTAGE
  FIXED
  FREE_SHIPPING
}

# Inputs
input OrderFilter {
  status: [OrderStatus!]
  paymentStatus: [PaymentStatus!]
  customerId: ID
  dateFrom: DateTime
  dateTo: DateTime
  minTotal: Float
  maxTotal: Float
  query: String
  sortBy: OrderSortBy
  sortOrder: SortOrder
}

enum OrderSortBy {
  CREATED_AT
  UPDATED_AT
  TOTAL
  NUMBER
}

input CreateOrderInput {
  items: [OrderItemInput!]!
  shippingAddress: AddressInput!
  billingAddress: AddressInput
  shippingMethodId: ID!
  paymentMethodId: ID!
  couponCode: String
  customerNote: String
}

input OrderItemInput {
  productId: ID!
  variantId: ID
  quantity: Int!
}

input AddressInput {
  firstName: String!
  lastName: String!
  company: String
  address1: String!
  address2: String
  city: String!
  state: String
  postalCode: String!
  country: String!
  phone: String
}
```

### Connection Types (Pagination)

```graphql
# schema/pagination.graphql

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  totalCount: Int!
  totalPages: Int!
  currentPage: Int!
}

type ProductConnection {
  edges: [ProductEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProductEdge {
  cursor: String!
  node: Product!
}

type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrderEdge {
  cursor: String!
  node: Order!
}

input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
  page: Int
  limit: Int
}
```

## Go Implementation

### Server Setup

```go
// internal/graphql/server.go
package graphql

import (
    "context"
    "net/http"

    "github.com/99designs/gqlgen/graphql"
    "github.com/99designs/gqlgen/graphql/handler"
    "github.com/99designs/gqlgen/graphql/handler/extension"
    "github.com/99designs/gqlgen/graphql/handler/lru"
    "github.com/99designs/gqlgen/graphql/handler/transport"
    "github.com/99designs/gqlgen/graphql/playground"
    "github.com/gorilla/websocket"
)

type Server struct {
    handler    *handler.Server
    playground http.Handler
}

func NewServer(resolver *Resolver, config Config) *Server {
    schema := NewExecutableSchema(Config{
        Resolvers:  resolver,
        Directives: DirectiveRoot{
            Auth:         AuthDirective,
            Tenant:       TenantDirective,
            RateLimit:    RateLimitDirective,
            CacheControl: CacheControlDirective,
        },
        Complexity: ComplexityRoot{
            Query: QueryComplexity{
                Products: func(childComplexity int, filter *ProductFilter, pagination *PaginationInput) int {
                    return childComplexity * 10
                },
                Search: func(childComplexity int, query string, searchType *SearchType, pagination *PaginationInput) int {
                    return childComplexity * 20
                },
            },
        },
    })

    srv := handler.NewDefaultServer(schema)

    // Transports
    srv.AddTransport(transport.Websocket{
        Upgrader: websocket.Upgrader{
            CheckOrigin: func(r *http.Request) bool {
                return true // Configure for production
            },
        },
        KeepAlivePingInterval: 10 * time.Second,
    })
    srv.AddTransport(transport.Options{})
    srv.AddTransport(transport.GET{})
    srv.AddTransport(transport.POST{})
    srv.AddTransport(transport.MultipartForm{})

    // Caching
    srv.SetQueryCache(lru.New(1000))

    // Extensions
    srv.Use(extension.Introspection{})
    srv.Use(extension.AutomaticPersistedQuery{
        Cache: lru.New(100),
    })
    srv.Use(&ComplexityLimit{Limit: config.ComplexityLimit})

    // Error handling
    srv.SetErrorPresenter(ErrorPresenter)
    srv.SetRecoverFunc(RecoverFunc)

    // Middleware
    srv.AroundOperations(OperationMiddleware)
    srv.AroundFields(FieldMiddleware)

    return &Server{
        handler:    srv,
        playground: playground.Handler("GraphQL Playground", "/graphql"),
    }
}

func (s *Server) Handler() http.Handler {
    return s.handler
}

func (s *Server) Playground() http.Handler {
    return s.playground
}
```

### Resolver Implementation

```go
// internal/graphql/resolver.go
package graphql

import (
    "context"

    "github.com/your-org/shop/internal/product"
    "github.com/your-org/shop/internal/order"
    "github.com/your-org/shop/internal/cart"
    "github.com/your-org/shop/internal/user"
)

type Resolver struct {
    productService *product.Service
    orderService   *order.Service
    cartService    *cart.Service
    userService    *user.Service
    searchService  *search.Service
}

func NewResolver(
    productService *product.Service,
    orderService *order.Service,
    cartService *cart.Service,
    userService *user.Service,
    searchService *search.Service,
) *Resolver {
    return &Resolver{
        productService: productService,
        orderService:   orderService,
        cartService:    cartService,
        userService:    userService,
        searchService:  searchService,
    }
}

// Query resolvers
func (r *queryResolver) Products(ctx context.Context, filter *ProductFilter, pagination *PaginationInput) (*ProductConnection, error) {
    // Convert GraphQL filter to service filter
    serviceFilter := product.Filter{}
    if filter != nil {
        serviceFilter.Query = filter.Query
        serviceFilter.CategoryID = filter.CategoryID
        serviceFilter.Status = (*product.Status)(filter.Status)
        serviceFilter.PriceMin = filter.PriceMin
        serviceFilter.PriceMax = filter.PriceMax
        serviceFilter.InStock = filter.InStock
    }

    // Get pagination
    page, limit := getPagination(pagination)

    // Fetch products
    products, total, err := r.productService.List(ctx, serviceFilter, page, limit)
    if err != nil {
        return nil, err
    }

    // Build connection
    return buildProductConnection(products, total, page, limit), nil
}

func (r *queryResolver) Product(ctx context.Context, id string) (*Product, error) {
    return r.productService.GetByID(ctx, id)
}

func (r *queryResolver) ProductBySlug(ctx context.Context, slug string) (*Product, error) {
    return r.productService.GetBySlug(ctx, slug)
}

func (r *queryResolver) Search(ctx context.Context, query string, searchType *SearchType, pagination *PaginationInput) (*SearchResult, error) {
    page, limit := getPagination(pagination)

    results, err := r.searchService.Search(ctx, query, &search.Options{
        Type:  string(*searchType),
        Page:  page,
        Limit: limit,
    })
    if err != nil {
        return nil, err
    }

    return &SearchResult{
        Products:   results.Products,
        Categories: results.Categories,
        TotalCount: results.TotalCount,
    }, nil
}

// Mutation resolvers
func (r *mutationResolver) CreateProduct(ctx context.Context, input CreateProductInput) (*Product, error) {
    // Convert input to service model
    productData := &product.Product{
        Name:             input.Name,
        Slug:             input.Slug,
        Description:      input.Description,
        ShortDescription: input.ShortDescription,
        Price:            decimal.NewFromFloat(input.Price),
        CategoryID:       input.CategoryID,
        Tags:             input.Tags,
        SKU:              input.Sku,
        Status:           product.Status(*input.Status),
    }

    if input.CompareAtPrice != nil {
        productData.CompareAtPrice = decimal.NewFromFloat(*input.CompareAtPrice)
    }

    // Create product
    return r.productService.Create(ctx, productData)
}

func (r *mutationResolver) AddToCart(ctx context.Context, input AddToCartInput) (*Cart, error) {
    return r.cartService.AddItem(ctx, input.ProductID, input.VariantID, input.Quantity)
}

func (r *mutationResolver) CreateOrder(ctx context.Context, input CreateOrderInput) (*Order, error) {
    orderData := &order.CreateRequest{
        Items:            convertOrderItems(input.Items),
        ShippingAddress:  convertAddress(input.ShippingAddress),
        BillingAddress:   convertAddress(input.BillingAddress),
        ShippingMethodID: input.ShippingMethodID,
        PaymentMethodID:  input.PaymentMethodID,
        CouponCode:       input.CouponCode,
        CustomerNote:     input.CustomerNote,
    }

    return r.orderService.Create(ctx, orderData)
}

// Field resolvers
func (r *productResolver) Images(ctx context.Context, obj *Product) ([]*ProductImage, error) {
    return r.productService.GetImages(ctx, obj.ID)
}

func (r *productResolver) Category(ctx context.Context, obj *Product) (*Category, error) {
    if obj.CategoryID == nil {
        return nil, nil
    }
    return r.categoryService.GetByID(ctx, *obj.CategoryID)
}

func (r *productResolver) RelatedProducts(ctx context.Context, obj *Product) ([]*Product, error) {
    return r.productService.GetRelated(ctx, obj.ID, 4)
}

func (r *orderResolver) Customer(ctx context.Context, obj *Order) (*Customer, error) {
    return r.customerService.GetByID(ctx, obj.CustomerID)
}

func (r *orderResolver) Timeline(ctx context.Context, obj *Order) ([]*OrderEvent, error) {
    return r.orderService.GetTimeline(ctx, obj.ID)
}

// Subscription resolvers
func (r *subscriptionResolver) OrderUpdated(ctx context.Context, orderID string) (<-chan *Order, error) {
    ch := make(chan *Order, 1)

    // Subscribe to order updates
    r.eventBus.Subscribe(ctx, fmt.Sprintf("order.%s.updated", orderID), func(event Event) {
        order, err := r.orderService.GetByID(ctx, orderID)
        if err == nil {
            ch <- order
        }
    })

    return ch, nil
}

func (r *subscriptionResolver) CartUpdated(ctx context.Context) (<-chan *Cart, error) {
    ch := make(chan *Cart, 1)

    sessionID := cart.GetSessionID(ctx)
    r.eventBus.Subscribe(ctx, fmt.Sprintf("cart.%s.updated", sessionID), func(event Event) {
        cart, err := r.cartService.Get(ctx)
        if err == nil {
            ch <- cart
        }
    })

    return ch, nil
}

// Helper functions
func getPagination(input *PaginationInput) (page, limit int) {
    page = 1
    limit = 20

    if input != nil {
        if input.Page != nil {
            page = *input.Page
        }
        if input.Limit != nil {
            limit = *input.Limit
        }
    }

    if limit > 100 {
        limit = 100
    }

    return page, limit
}

func buildProductConnection(products []*Product, total int64, page, limit int) *ProductConnection {
    edges := make([]*ProductEdge, len(products))
    for i, p := range products {
        edges[i] = &ProductEdge{
            Cursor: encodeCursor(p.ID),
            Node:   p,
        }
    }

    totalPages := int(math.Ceil(float64(total) / float64(limit)))

    return &ProductConnection{
        Edges: edges,
        PageInfo: &PageInfo{
            HasNextPage:     page < totalPages,
            HasPreviousPage: page > 1,
            TotalCount:      int(total),
            TotalPages:      totalPages,
            CurrentPage:     page,
        },
        TotalCount: int(total),
    }
}
```

### Directives

```go
// internal/graphql/directives.go
package graphql

import (
    "context"
    "fmt"

    "github.com/99designs/gqlgen/graphql"
)

// AuthDirective handles authentication
func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver, requires Role) (interface{}, error) {
    user := auth.GetUser(ctx)

    if user == nil {
        return nil, fmt.Errorf("access denied: authentication required")
    }

    // Check role
    if !user.HasRole(string(requires)) {
        return nil, fmt.Errorf("access denied: insufficient permissions")
    }

    return next(ctx)
}

// TenantDirective ensures tenant isolation
func TenantDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
    tenantID := tenant.GetTenantID(ctx)
    if tenantID == "" {
        return nil, fmt.Errorf("tenant context required")
    }
    return next(ctx)
}

// RateLimitDirective handles rate limiting
func RateLimitDirective(ctx context.Context, obj interface{}, next graphql.Resolver, limit int, window string) (interface{}, error) {
    // Parse window
    windowDuration, err := time.ParseDuration(window)
    if err != nil {
        return nil, fmt.Errorf("invalid rate limit window: %s", window)
    }

    // Get rate limiter
    limiter := ratelimit.GetLimiter(ctx)
    key := fmt.Sprintf("graphql:%s:%s", graphql.GetFieldContext(ctx).Path().String(), auth.GetUserID(ctx))

    allowed, info, err := limiter.Allow(ctx, key, int64(limit), windowDuration)
    if err != nil {
        // Log error but allow request
        log.Printf("Rate limit check failed: %v", err)
        return next(ctx)
    }

    if !allowed {
        return nil, &RateLimitError{
            Message:    "Rate limit exceeded",
            Limit:      info.Limit,
            Remaining:  info.Remaining,
            ResetAfter: info.ResetAfter,
        }
    }

    return next(ctx)
}

// CacheControlDirective sets cache headers
func CacheControlDirective(ctx context.Context, obj interface{}, next graphql.Resolver, maxAge int, scope CacheControlScope) (interface{}, error) {
    result, err := next(ctx)
    if err != nil {
        return result, err
    }

    // Set cache hint
    graphql.GetFieldContext(ctx).Args["__cacheControl"] = &CacheControl{
        MaxAge: maxAge,
        Scope:  scope,
    }

    return result, nil
}

type RateLimitError struct {
    Message    string
    Limit      int64
    Remaining  int64
    ResetAfter time.Duration
}

func (e *RateLimitError) Error() string {
    return e.Message
}

func (e *RateLimitError) Extensions() map[string]interface{} {
    return map[string]interface{}{
        "code":        "RATE_LIMIT_EXCEEDED",
        "limit":       e.Limit,
        "remaining":   e.Remaining,
        "retryAfter":  e.ResetAfter.Seconds(),
    }
}
```

### DataLoaders (N+1 Problem)

```go
// internal/graphql/dataloader.go
package graphql

import (
    "context"
    "time"

    "github.com/graph-gophers/dataloader/v7"
)

type Loaders struct {
    ProductByID    *dataloader.Loader[string, *Product]
    CategoryByID   *dataloader.Loader[string, *Category]
    UserByID       *dataloader.Loader[string, *User]
    ProductImages  *dataloader.Loader[string, []*ProductImage]
}

func NewLoaders(services *Services) *Loaders {
    return &Loaders{
        ProductByID: dataloader.NewBatchedLoader(
            func(ctx context.Context, keys []string) []*dataloader.Result[*Product] {
                products, err := services.Product.GetByIDs(ctx, keys)
                if err != nil {
                    return makeErrorResults[*Product](len(keys), err)
                }

                // Map results
                productMap := make(map[string]*Product)
                for _, p := range products {
                    productMap[p.ID] = p
                }

                results := make([]*dataloader.Result[*Product], len(keys))
                for i, key := range keys {
                    results[i] = &dataloader.Result[*Product]{Data: productMap[key]}
                }
                return results
            },
            dataloader.WithBatchCapacity[string, *Product](100),
            dataloader.WithWait[string, *Product](1*time.Millisecond),
        ),

        CategoryByID: dataloader.NewBatchedLoader(
            func(ctx context.Context, keys []string) []*dataloader.Result[*Category] {
                categories, err := services.Category.GetByIDs(ctx, keys)
                if err != nil {
                    return makeErrorResults[*Category](len(keys), err)
                }

                categoryMap := make(map[string]*Category)
                for _, c := range categories {
                    categoryMap[c.ID] = c
                }

                results := make([]*dataloader.Result[*Category], len(keys))
                for i, key := range keys {
                    results[i] = &dataloader.Result[*Category]{Data: categoryMap[key]}
                }
                return results
            },
        ),

        ProductImages: dataloader.NewBatchedLoader(
            func(ctx context.Context, keys []string) []*dataloader.Result[[]*ProductImage] {
                imagesMap, err := services.Product.GetImagesByProductIDs(ctx, keys)
                if err != nil {
                    return makeErrorResults[[]*ProductImage](len(keys), err)
                }

                results := make([]*dataloader.Result[[]*ProductImage], len(keys))
                for i, key := range keys {
                    results[i] = &dataloader.Result[[]*ProductImage]{Data: imagesMap[key]}
                }
                return results
            },
        ),
    }
}

func makeErrorResults[T any](count int, err error) []*dataloader.Result[T] {
    results := make([]*dataloader.Result[T], count)
    for i := range results {
        results[i] = &dataloader.Result[T]{Error: err}
    }
    return results
}

// Middleware to add loaders to context
func DataLoaderMiddleware(services *Services) func(next http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            loaders := NewLoaders(services)
            ctx := context.WithValue(r.Context(), loadersKey, loaders)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

// Usage in resolver
func (r *productResolver) Category(ctx context.Context, obj *Product) (*Category, error) {
    if obj.CategoryID == nil {
        return nil, nil
    }

    loaders := GetLoaders(ctx)
    thunk := loaders.CategoryByID.Load(ctx, *obj.CategoryID)
    return thunk()
}
```

### Error Handling

```go
// internal/graphql/errors.go
package graphql

import (
    "context"
    "fmt"

    "github.com/99designs/gqlgen/graphql"
    "github.com/vektah/gqlparser/v2/gqlerror"
)

func ErrorPresenter(ctx context.Context, err error) *gqlerror.Error {
    // Extract original error
    var gqlErr *gqlerror.Error
    if errors.As(err, &gqlErr) {
        return gqlErr
    }

    // Handle specific error types
    var validationErr *ValidationError
    if errors.As(err, &validationErr) {
        return &gqlerror.Error{
            Message: validationErr.Message,
            Path:    graphql.GetPath(ctx),
            Extensions: map[string]interface{}{
                "code":   "VALIDATION_ERROR",
                "fields": validationErr.Fields,
            },
        }
    }

    var notFoundErr *NotFoundError
    if errors.As(err, &notFoundErr) {
        return &gqlerror.Error{
            Message: notFoundErr.Message,
            Path:    graphql.GetPath(ctx),
            Extensions: map[string]interface{}{
                "code": "NOT_FOUND",
            },
        }
    }

    var authErr *AuthError
    if errors.As(err, &authErr) {
        return &gqlerror.Error{
            Message: authErr.Message,
            Path:    graphql.GetPath(ctx),
            Extensions: map[string]interface{}{
                "code": "UNAUTHORIZED",
            },
        }
    }

    var rateLimitErr *RateLimitError
    if errors.As(err, &rateLimitErr) {
        return &gqlerror.Error{
            Message:    rateLimitErr.Message,
            Path:       graphql.GetPath(ctx),
            Extensions: rateLimitErr.Extensions(),
        }
    }

    // Default internal error
    log.Printf("GraphQL error: %v", err)
    return &gqlerror.Error{
        Message: "Internal server error",
        Path:    graphql.GetPath(ctx),
        Extensions: map[string]interface{}{
            "code": "INTERNAL_ERROR",
        },
    }
}

func RecoverFunc(ctx context.Context, err interface{}) error {
    log.Printf("GraphQL panic: %v", err)
    return fmt.Errorf("internal server error")
}

// Custom error types
type ValidationError struct {
    Message string
    Fields  map[string]string
}

func (e *ValidationError) Error() string {
    return e.Message
}

type NotFoundError struct {
    Message  string
    Resource string
    ID       string
}

func (e *NotFoundError) Error() string {
    return e.Message
}

type AuthError struct {
    Message string
}

func (e *AuthError) Error() string {
    return e.Message
}
```

## Frontend Client

### Apollo Client Setup

```typescript
// lib/apollo.ts
import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || '/graphql',
});

const wsLink = typeof window !== 'undefined' ? new GraphQLWsLink(
  createClient({
    url: process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || 'ws://localhost:8080/graphql',
    connectionParams: () => ({
      authorization: localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '',
    }),
  })
) : null;

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(`[GraphQL error]: Message: ${message}, Path: ${path}`);

      if (extensions?.code === 'UNAUTHORIZED') {
        // Handle unauthorized
        window.location.href = '/login';
      }
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink)
    )
  : authLink.concat(httpLink);

export const client = new ApolloClient({
  link: errorLink.concat(splitLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          products: {
            keyArgs: ['filter'],
            merge(existing, incoming, { args }) {
              if (!existing || !args?.pagination?.after) {
                return incoming;
              }
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
        },
      },
      Product: {
        keyFields: ['id'],
      },
      Order: {
        keyFields: ['id'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
```

### Queries & Mutations

```typescript
// graphql/products.ts
import { gql } from '@apollo/client';

export const PRODUCT_FRAGMENT = gql`
  fragment ProductFields on Product {
    id
    name
    slug
    shortDescription
    price
    compareAtPrice
    mainImage {
      url
      alt
    }
    inventory {
      available
      isOutOfStock
    }
    status
  }
`;

export const PRODUCTS_QUERY = gql`
  ${PRODUCT_FRAGMENT}
  query Products($filter: ProductFilter, $pagination: PaginationInput) {
    products(filter: $filter, pagination: $pagination) {
      edges {
        cursor
        node {
          ...ProductFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
        totalPages
        currentPage
      }
    }
  }
`;

export const PRODUCT_QUERY = gql`
  query Product($id: ID, $slug: String) {
    product(id: $id) @include(if: $id) {
      id
      name
      slug
      description
      shortDescription
      price
      compareAtPrice
      images {
        id
        url
        alt
        position
      }
      category {
        id
        name
        slug
      }
      variants {
        id
        sku
        name
        price
        inventory
        options {
          name
          value
        }
      }
      options {
        id
        name
        values
      }
      attributes {
        name
        value
        visible
      }
      seo {
        title
        description
      }
      relatedProducts {
        id
        name
        slug
        price
        mainImage {
          url
        }
      }
    }
    productBySlug(slug: $slug) @include(if: $slug) {
      # Same fields
    }
  }
`;

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
      name
      slug
    }
  }
`;

export const ADD_TO_CART = gql`
  mutation AddToCart($input: AddToCartInput!) {
    addToCart(input: $input) {
      id
      items {
        id
        product {
          id
          name
        }
        quantity
        unitPrice
        totalPrice
      }
      subtotal
      total
      itemCount
    }
  }
`;

export const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      number
      status
      total
    }
  }
`;
```

### React Hooks

```typescript
// hooks/useProducts.ts
import { useQuery, useMutation } from '@apollo/client';
import { PRODUCTS_QUERY, PRODUCT_QUERY, CREATE_PRODUCT } from '@/graphql/products';

interface ProductFilter {
  query?: string;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export function useProducts(filter?: ProductFilter, pagination?: { page?: number; limit?: number }) {
  const { data, loading, error, fetchMore } = useQuery(PRODUCTS_QUERY, {
    variables: { filter, pagination },
  });

  const loadMore = () => {
    if (!data?.products.pageInfo.hasNextPage) return;

    fetchMore({
      variables: {
        pagination: {
          ...pagination,
          after: data.products.pageInfo.endCursor,
        },
      },
    });
  };

  return {
    products: data?.products.edges.map((e: any) => e.node) || [],
    pageInfo: data?.products.pageInfo,
    loading,
    error,
    loadMore,
  };
}

export function useProduct(id?: string, slug?: string) {
  const { data, loading, error } = useQuery(PRODUCT_QUERY, {
    variables: { id, slug },
    skip: !id && !slug,
  });

  return {
    product: data?.product || data?.productBySlug,
    loading,
    error,
  };
}

export function useCreateProduct() {
  const [createProduct, { loading, error }] = useMutation(CREATE_PRODUCT, {
    refetchQueries: ['Products'],
  });

  return {
    createProduct: (input: any) => createProduct({ variables: { input } }),
    loading,
    error,
  };
}
```

### Subscriptions

```typescript
// hooks/useOrderSubscription.ts
import { useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';

const ORDER_UPDATED = gql`
  subscription OrderUpdated($orderId: ID!) {
    orderUpdated(orderId: $orderId) {
      id
      status
      paymentStatus
      trackingNumber
      timeline {
        id
        type
        message
        createdAt
      }
    }
  }
`;

export function useOrderUpdates(orderId: string) {
  const { data, loading, error } = useSubscription(ORDER_UPDATED, {
    variables: { orderId },
  });

  return {
    order: data?.orderUpdated,
    loading,
    error,
  };
}
```

## Configuration

```yaml
# config/graphql.yaml
graphql:
  enabled: true
  path: "/graphql"
  playground: true
  introspection: true

  # Complexity
  complexity_limit: 1000
  depth_limit: 10

  # Caching
  query_cache_size: 1000
  apq_cache_size: 100

  # Rate limiting
  rate_limit:
    enabled: true
    default_limit: 100
    default_window: "1m"

  # Subscriptions
  subscriptions:
    enabled: true
    keepalive: 10s

  # Upload
  upload:
    enabled: true
    max_file_size: 10MB
    max_files: 5
```

## Див. також

- [REST API](../api/OPENAPI.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [Authentication](../guides/AUTHENTICATION.md)
