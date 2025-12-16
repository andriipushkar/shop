# Prom.ua Integration

Інтеграція з маркетплейсом Prom.ua для продажу товарів.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROM.UA INTEGRATION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                              ┌──────────────┐             │
│  │ Shop         │                              │ Prom.ua      │             │
│  │ Products     │─────── XML Feed ────────────▶│ Catalog      │             │
│  └──────────────┘                              └──────────────┘             │
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Shop         │◀────│ Webhook      │◀────│ Prom.ua      │                │
│  │ OMS          │     │ Handler      │     │ Orders       │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Shop         │────▶│ API Client   │────▶│ Prom.ua API  │                │
│  │ Inventory    │     │              │     │ (orders,     │                │
│  └──────────────┘     └──────────────┘     │ products)    │                │
│                                            └──────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Prom.ua API
PROM_API_URL=https://my.prom.ua/api/v1
PROM_API_TOKEN=your_api_token

# Feed Generation
PROM_FEED_URL=https://shop.ua/feeds/prom.xml
PROM_COMPANY_NAME="Shop.ua"
PROM_COMPANY_URL=https://shop.ua
```

### Go Configuration

```go
// config/prom.go
type PromConfig struct {
    APIURL      string `env:"PROM_API_URL" envDefault:"https://my.prom.ua/api/v1"`
    APIToken    string `env:"PROM_API_TOKEN,required"`
    FeedURL     string `env:"PROM_FEED_URL"`
    CompanyName string `env:"PROM_COMPANY_NAME"`
    CompanyURL  string `env:"PROM_COMPANY_URL"`
}
```

## XML Feed Generation

### Feed Structure (YML Format)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE yml_catalog SYSTEM "shops.dtd">
<yml_catalog date="2024-01-15 10:00">
    <shop>
        <name>Shop.ua</name>
        <company>Shop.ua LLC</company>
        <url>https://shop.ua</url>
        <currencies>
            <currency id="UAH" rate="1"/>
        </currencies>
        <categories>
            <category id="1">Електроніка</category>
            <category id="2" parentId="1">Смартфони</category>
            <category id="3" parentId="1">Ноутбуки</category>
        </categories>
        <offers>
            <offer id="prod_abc123" available="true">
                <name>Samsung Galaxy S24 128GB Black</name>
                <url>https://shop.ua/products/samsung-galaxy-s24</url>
                <price>35999</price>
                <currencyId>UAH</currencyId>
                <categoryId>2</categoryId>
                <picture>https://cdn.shop.ua/products/samsung-s24-1.jpg</picture>
                <picture>https://cdn.shop.ua/products/samsung-s24-2.jpg</picture>
                <vendor>Samsung</vendor>
                <vendorCode>SM-S921B</vendorCode>
                <description>Флагманський смартфон Samsung...</description>
                <param name="Колір">Чорний</param>
                <param name="Пам'ять">128 ГБ</param>
                <param name="Гарантія">24 місяці</param>
                <stock_quantity>50</stock_quantity>
            </offer>
        </offers>
    </shop>
</yml_catalog>
```

### Feed Generator

```go
// pkg/feeds/prom/generator.go
package prom

import (
    "encoding/xml"
    "fmt"
    "time"
)

type FeedGenerator struct {
    productRepo  ProductRepository
    categoryRepo CategoryRepository
    config       *PromConfig
}

type YMLCatalog struct {
    XMLName xml.Name `xml:"yml_catalog"`
    Date    string   `xml:"date,attr"`
    Shop    Shop     `xml:"shop"`
}

type Shop struct {
    Name       string     `xml:"name"`
    Company    string     `xml:"company"`
    URL        string     `xml:"url"`
    Currencies Currencies `xml:"currencies"`
    Categories Categories `xml:"categories"`
    Offers     Offers     `xml:"offers"`
}

type Currencies struct {
    Currency []Currency `xml:"currency"`
}

type Currency struct {
    ID   string `xml:"id,attr"`
    Rate string `xml:"rate,attr"`
}

type Categories struct {
    Category []Category `xml:"category"`
}

type Category struct {
    ID       string `xml:"id,attr"`
    ParentID string `xml:"parentId,attr,omitempty"`
    Name     string `xml:",chardata"`
}

type Offers struct {
    Offer []Offer `xml:"offer"`
}

type Offer struct {
    ID            string   `xml:"id,attr"`
    Available     string   `xml:"available,attr"`
    Name          string   `xml:"name"`
    URL           string   `xml:"url"`
    Price         float64  `xml:"price"`
    CurrencyID    string   `xml:"currencyId"`
    CategoryID    string   `xml:"categoryId"`
    Pictures      []string `xml:"picture"`
    Vendor        string   `xml:"vendor,omitempty"`
    VendorCode    string   `xml:"vendorCode,omitempty"`
    Description   string   `xml:"description"`
    Params        []Param  `xml:"param"`
    StockQuantity int      `xml:"stock_quantity"`
}

type Param struct {
    Name  string `xml:"name,attr"`
    Value string `xml:",chardata"`
}

// Generate creates XML feed
func (g *FeedGenerator) Generate(ctx context.Context, tenantID string) ([]byte, error) {
    // Get categories
    categories, err := g.categoryRepo.GetAll(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    // Get active products
    products, err := g.productRepo.GetActiveForFeed(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    // Build catalog
    catalog := &YMLCatalog{
        Date: time.Now().Format("2006-01-02 15:04"),
        Shop: Shop{
            Name:    g.config.CompanyName,
            Company: g.config.CompanyName,
            URL:     g.config.CompanyURL,
            Currencies: Currencies{
                Currency: []Currency{{ID: "UAH", Rate: "1"}},
            },
            Categories: g.buildCategories(categories),
            Offers:     g.buildOffers(products),
        },
    }

    // Marshal to XML
    output, err := xml.MarshalIndent(catalog, "", "    ")
    if err != nil {
        return nil, err
    }

    // Add XML header
    return append([]byte(xml.Header), output...), nil
}

func (g *FeedGenerator) buildCategories(categories []*Category) Categories {
    result := Categories{Category: make([]Category, len(categories))}
    for i, cat := range categories {
        result.Category[i] = Category{
            ID:       cat.ID,
            ParentID: cat.ParentID,
            Name:     cat.Name,
        }
    }
    return result
}

func (g *FeedGenerator) buildOffers(products []*Product) Offers {
    offers := make([]Offer, 0, len(products))

    for _, p := range products {
        if p.Quantity <= 0 {
            continue // Skip out of stock
        }

        offer := Offer{
            ID:            p.ID,
            Available:     "true",
            Name:          p.Name,
            URL:           fmt.Sprintf("%s/products/%s", g.config.CompanyURL, p.Slug),
            Price:         p.Price,
            CurrencyID:    "UAH",
            CategoryID:    p.CategoryID,
            Pictures:      p.GetImageURLs(),
            Vendor:        p.BrandName,
            VendorCode:    p.SKU,
            Description:   p.Description,
            StockQuantity: p.Quantity,
        }

        // Add attributes as params
        for key, value := range p.Attributes {
            offer.Params = append(offer.Params, Param{Name: key, Value: value})
        }

        offers = append(offers, offer)
    }

    return Offers{Offer: offers}
}
```

### Feed HTTP Handler

```go
// handlers/feed.go
func (h *Handler) HandlePromFeed(w http.ResponseWriter, r *http.Request) {
    tenantID := r.URL.Query().Get("tenant")
    if tenantID == "" {
        http.Error(w, "tenant required", http.StatusBadRequest)
        return
    }

    // Check cache
    cacheKey := fmt.Sprintf("feed:prom:%s", tenantID)
    if cached, err := h.cache.Get(r.Context(), cacheKey); err == nil {
        w.Header().Set("Content-Type", "application/xml; charset=utf-8")
        w.Write(cached)
        return
    }

    // Generate feed
    feed, err := h.feedGenerator.Generate(r.Context(), tenantID)
    if err != nil {
        http.Error(w, "failed to generate feed", http.StatusInternalServerError)
        return
    }

    // Cache for 30 minutes
    h.cache.Set(r.Context(), cacheKey, feed, 30*time.Minute)

    w.Header().Set("Content-Type", "application/xml; charset=utf-8")
    w.Write(feed)
}
```

## Prom.ua API Client

### Client Implementation

```go
// pkg/prom/client.go
package prom

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type Client struct {
    httpClient *http.Client
    baseURL    string
    token      string
}

func NewClient(cfg *PromConfig) *Client {
    return &Client{
        httpClient: &http.Client{Timeout: 30 * time.Second},
        baseURL:    cfg.APIURL,
        token:      cfg.APIToken,
    }
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
    var bodyReader io.Reader
    if body != nil {
        jsonBody, _ := json.Marshal(body)
        bodyReader = bytes.NewReader(jsonBody)
    }

    req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Authorization", "Bearer "+c.token)
    req.Header.Set("Content-Type", "application/json")

    return c.httpClient.Do(req)
}
```

### Orders API

```go
// Get orders from Prom.ua
func (c *Client) GetOrders(ctx context.Context, status string, limit int) ([]PromOrder, error) {
    path := fmt.Sprintf("/orders/list?status=%s&limit=%d", status, limit)

    resp, err := c.doRequest(ctx, "GET", path, nil)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Orders []PromOrder `json:"orders"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Orders, nil
}

// PromOrder represents an order from Prom.ua
type PromOrder struct {
    ID          int64           `json:"id"`
    Status      string          `json:"status"`
    DateCreated time.Time       `json:"date_created"`
    Price       float64         `json:"price"`
    Products    []PromProduct   `json:"products"`
    Client      PromClient      `json:"client"`
    Delivery    PromDelivery    `json:"delivery"`
    Payment     PromPayment     `json:"payment"`
}

type PromProduct struct {
    ExternalID string  `json:"external_id"`
    Name       string  `json:"name"`
    Quantity   int     `json:"quantity"`
    Price      float64 `json:"price"`
}

type PromClient struct {
    Name  string `json:"name"`
    Phone string `json:"phone"`
    Email string `json:"email"`
}

type PromDelivery struct {
    Type    string `json:"type"`
    Address string `json:"address"`
    City    string `json:"city"`
}

// UpdateOrderStatus updates order status on Prom.ua
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID int64, status string) error {
    body := map[string]interface{}{
        "status": status,
    }

    resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/orders/%d/set_status", orderID), body)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to update status: %d", resp.StatusCode)
    }

    return nil
}
```

### Products API

```go
// GetProducts retrieves products from Prom.ua
func (c *Client) GetProducts(ctx context.Context, limit, offset int) ([]PromCatalogProduct, error) {
    path := fmt.Sprintf("/products/list?limit=%d&offset=%d", limit, offset)

    resp, err := c.doRequest(ctx, "GET", path, nil)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Products []PromCatalogProduct `json:"products"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Products, nil
}

// UpdateProductQuantity updates stock on Prom.ua
func (c *Client) UpdateProductQuantity(ctx context.Context, productID string, quantity int) error {
    body := map[string]interface{}{
        "presence": map[string]interface{}{
            "quantity": quantity,
        },
    }

    resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/products/%s/edit", productID), body)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}

// UpdateProductPrice updates price on Prom.ua
func (c *Client) UpdateProductPrice(ctx context.Context, productID string, price float64) error {
    body := map[string]interface{}{
        "price": price,
    }

    resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/products/%s/edit", productID), body)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}
```

## Order Synchronization

### Order Importer

```go
// services/core/internal/prom/importer.go
type OrderImporter struct {
    promClient  *prom.Client
    orderRepo   OrderRepository
    productRepo ProductRepository
    queue       *rabbitmq.Publisher
}

// ImportNewOrders imports new orders from Prom.ua
func (i *OrderImporter) ImportNewOrders(ctx context.Context) error {
    // Get new orders
    orders, err := i.promClient.GetOrders(ctx, "pending", 100)
    if err != nil {
        return fmt.Errorf("fetch orders: %w", err)
    }

    for _, promOrder := range orders {
        // Check if already imported
        if exists, _ := i.orderRepo.ExistsByExternalID(ctx, fmt.Sprintf("prom_%d", promOrder.ID)); exists {
            continue
        }

        // Create order
        order, err := i.createOrder(ctx, &promOrder)
        if err != nil {
            log.Error().Err(err).Int64("prom_order", promOrder.ID).Msg("failed to import order")
            continue
        }

        // Update status on Prom.ua
        i.promClient.UpdateOrderStatus(ctx, promOrder.ID, "received")

        // Publish event
        i.queue.Publish(ctx, events.OrderImported{
            OrderID:    order.ID,
            Source:     "prom.ua",
            ExternalID: promOrder.ID,
        })
    }

    return nil
}

func (i *OrderImporter) createOrder(ctx context.Context, promOrder *PromOrder) (*Order, error) {
    // Map products
    items := make([]OrderItem, 0, len(promOrder.Products))
    for _, p := range promOrder.Products {
        // Find product by external ID
        product, err := i.productRepo.FindByExternalID(ctx, p.ExternalID)
        if err != nil {
            return nil, fmt.Errorf("product not found: %s", p.ExternalID)
        }

        items = append(items, OrderItem{
            ProductID: product.ID,
            Name:      p.Name,
            SKU:       product.SKU,
            Quantity:  p.Quantity,
            Price:     p.Price,
            Total:     p.Price * float64(p.Quantity),
        })
    }

    // Create order
    order := &Order{
        ExternalID: fmt.Sprintf("prom_%d", promOrder.ID),
        Source:     "prom.ua",
        Status:     "pending",
        Customer: Customer{
            Name:  promOrder.Client.Name,
            Phone: promOrder.Client.Phone,
            Email: promOrder.Client.Email,
        },
        ShippingAddress: Address{
            City:    promOrder.Delivery.City,
            Address: promOrder.Delivery.Address,
        },
        ShippingMethod: promOrder.Delivery.Type,
        Items:          items,
        Total:          promOrder.Price,
        CreatedAt:      promOrder.DateCreated,
    }

    return i.orderRepo.Create(ctx, order)
}
```

### Status Synchronization

```go
// SyncOrderStatus syncs order status back to Prom.ua
func (s *PromSyncService) SyncOrderStatus(ctx context.Context, order *Order) error {
    // Extract Prom order ID
    if !strings.HasPrefix(order.ExternalID, "prom_") {
        return nil // Not a Prom order
    }

    promOrderID, _ := strconv.ParseInt(strings.TrimPrefix(order.ExternalID, "prom_"), 10, 64)

    // Map status
    promStatus := mapToPromStatus(order.Status)

    // Update on Prom.ua
    return s.client.UpdateOrderStatus(ctx, promOrderID, promStatus)
}

func mapToPromStatus(status string) string {
    switch status {
    case "pending":
        return "received"
    case "confirmed":
        return "accepted"
    case "shipped":
        return "sent"
    case "delivered":
        return "success"
    case "cancelled":
        return "canceled"
    default:
        return "received"
    }
}
```

## Inventory Synchronization

### Stock Updater

```go
// services/core/internal/prom/stock.go
type StockSynchronizer struct {
    promClient  *prom.Client
    productRepo ProductRepository
}

// SyncStock updates stock levels on Prom.ua
func (s *StockSynchronizer) SyncStock(ctx context.Context) error {
    // Get products with Prom external IDs
    products, err := s.productRepo.GetWithExternalID(ctx, "prom")
    if err != nil {
        return err
    }

    for _, p := range products {
        if err := s.promClient.UpdateProductQuantity(ctx, p.ExternalID, p.Quantity); err != nil {
            log.Error().Err(err).Str("product", p.ID).Msg("failed to sync stock to Prom")
        }
    }

    return nil
}

// Event handler for inventory changes
func (s *StockSynchronizer) HandleInventoryChanged(ctx context.Context, event events.InventoryChanged) error {
    product, err := s.productRepo.FindByID(ctx, event.ProductID)
    if err != nil {
        return err
    }

    if product.PromExternalID == "" {
        return nil // Not listed on Prom
    }

    return s.promClient.UpdateProductQuantity(ctx, product.PromExternalID, event.NewQuantity)
}
```

### Price Synchronization

```go
// SyncPrices updates prices on Prom.ua
func (s *PriceSynchronizer) SyncPrices(ctx context.Context) error {
    products, err := s.productRepo.GetWithExternalID(ctx, "prom")
    if err != nil {
        return err
    }

    for _, p := range products {
        if err := s.promClient.UpdateProductPrice(ctx, p.ExternalID, p.Price); err != nil {
            log.Error().Err(err).Str("product", p.ID).Msg("failed to sync price to Prom")
        }
    }

    return nil
}
```

## Scheduled Jobs

```go
// Background jobs for Prom.ua synchronization
func SetupPromJobs(s *PromService) {
    // Import orders every 5 minutes
    cron.Schedule("*/5 * * * *", func() {
        ctx := context.Background()
        if err := s.importer.ImportNewOrders(ctx); err != nil {
            log.Error().Err(err).Msg("prom order import failed")
        }
    })

    // Sync stock every 15 minutes
    cron.Schedule("*/15 * * * *", func() {
        ctx := context.Background()
        if err := s.stock.SyncStock(ctx); err != nil {
            log.Error().Err(err).Msg("prom stock sync failed")
        }
    })

    // Regenerate feed every hour
    cron.Schedule("0 * * * *", func() {
        ctx := context.Background()
        s.feedGenerator.RegenerateAll(ctx)
    })
}
```

## Monitoring

### Metrics

```go
var (
    ordersImported = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "prom_orders_imported_total",
            Help: "Orders imported from Prom.ua",
        },
        []string{"status"},
    )

    stockSynced = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "prom_stock_synced_total",
            Help: "Stock sync operations",
        },
        []string{"status"},
    )
)
```

## See Also

- [Rozetka Integration](./ROZETKA.md)
- [Product Feeds](../modules/FEEDS.md)
- [Order Management](../modules/ORDERS.md)
