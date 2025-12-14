# Rozetka Marketplace Integration

Інтеграція з маркетплейсом Rozetka для продажу товарів.

## Огляд

| Параметр | Значення |
|----------|----------|
| API Version | v3 |
| Base URL | https://api-seller.rozetka.com.ua |
| Документація | https://seller.rozetka.com.ua/api |

### Можливості

- Управління товарами
- Синхронізація залишків та цін
- Отримання замовлень
- Обробка та відвантаження
- Робота з відгуками
- Аналітика продажів

---

## Конфігурація

### Environment Variables

```env
# .env
ROZETKA_USERNAME=your_seller_username
ROZETKA_PASSWORD=your_seller_password
ROZETKA_WEBHOOK_URL=https://api.yourstore.com/webhooks/rozetka
```

### Config Structure

```go
// internal/config/rozetka.go
type RozetkaConfig struct {
    Username   string `env:"ROZETKA_USERNAME,required"`
    Password   string `env:"ROZETKA_PASSWORD,required"`
    WebhookURL string `env:"ROZETKA_WEBHOOK_URL,required"`
}
```

---

## Імплементація

### Authentication

```go
// pkg/rozetka/auth.go
package rozetka

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "sync"
    "time"
)

const (
    BaseURL      = "https://api-seller.rozetka.com.ua"
    AuthEndpoint = "/sites"
)

type Client struct {
    username   string
    password   string
    token      string
    tokenExp   time.Time
    httpClient *http.Client
    mu         sync.RWMutex
}

func NewClient(username, password string) *Client {
    return &Client{
        username: username,
        password: password,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

type AuthRequest struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

type AuthResponse struct {
    Success bool `json:"success"`
    Content struct {
        Token     string `json:"access_token"`
        ExpiresIn int    `json:"expires_in"`
    } `json:"content"`
    Errors []string `json:"errors,omitempty"`
}

// Authenticate отримує access token
func (c *Client) Authenticate(ctx context.Context) error {
    c.mu.Lock()
    defer c.mu.Unlock()

    // Перевіряємо чи токен ще валідний
    if c.token != "" && time.Now().Before(c.tokenExp) {
        return nil
    }

    req := AuthRequest{
        Username: c.username,
        Password: c.password,
    }

    body, err := json.Marshal(req)
    if err != nil {
        return err
    }

    httpReq, err := http.NewRequestWithContext(ctx, "POST", BaseURL+AuthEndpoint, bytes.NewReader(body))
    if err != nil {
        return err
    }
    httpReq.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    respBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return err
    }

    var authResp AuthResponse
    if err := json.Unmarshal(respBody, &authResp); err != nil {
        return err
    }

    if !authResp.Success {
        return fmt.Errorf("auth failed: %v", authResp.Errors)
    }

    c.token = authResp.Content.Token
    c.tokenExp = time.Now().Add(time.Duration(authResp.Content.ExpiresIn) * time.Second)

    return nil
}

func (c *Client) getToken() string {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.token
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
    // Ensure we have a valid token
    if err := c.Authenticate(ctx); err != nil {
        return nil, err
    }

    var reqBody io.Reader
    if body != nil {
        jsonBody, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewReader(jsonBody)
    }

    req, err := http.NewRequestWithContext(ctx, method, BaseURL+path, reqBody)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+c.getToken())

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    respBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode >= 400 {
        var errResp struct {
            Errors []string `json:"errors"`
        }
        json.Unmarshal(respBody, &errResp)
        return nil, fmt.Errorf("rozetka error: %v", errResp.Errors)
    }

    return respBody, nil
}
```

### Products API

```go
// pkg/rozetka/products.go
package rozetka

import (
    "context"
    "encoding/json"
    "fmt"
    "net/url"
    "strconv"
)

type Product struct {
    ID             int64   `json:"id"`
    Name           string  `json:"name"`
    NameUK         string  `json:"name_ua,omitempty"`
    Price          float64 `json:"price"`
    OldPrice       float64 `json:"old_price,omitempty"`
    Currency       string  `json:"currency"`
    Description    string  `json:"description,omitempty"`
    DescriptionUK  string  `json:"description_ua,omitempty"`
    ArticleSeller  string  `json:"article_seller"` // SKU
    Barcode        string  `json:"barcode,omitempty"`
    CategoryID     int64   `json:"category_id"`
    Brand          string  `json:"brand,omitempty"`
    Country        string  `json:"country,omitempty"`
    Status         string  `json:"status"`
    Stock          int     `json:"stock"`
    Images         []Image `json:"images,omitempty"`
    Params         []Param `json:"params,omitempty"`
    Weight         float64 `json:"weight,omitempty"`
    Width          float64 `json:"width,omitempty"`
    Height         float64 `json:"height,omitempty"`
    Depth          float64 `json:"depth,omitempty"`
}

type Image struct {
    URL      string `json:"url"`
    Priority int    `json:"priority"`
}

type Param struct {
    Name  string `json:"name"`
    Value string `json:"value"`
}

type ProductsResponse struct {
    Success bool `json:"success"`
    Content struct {
        Items      []Product `json:"items"`
        TotalItems int       `json:"total_items"`
        TotalPages int       `json:"total_pages"`
    } `json:"content"`
}

// GetProducts отримує список товарів
func (c *Client) GetProducts(ctx context.Context, page, limit int) (*ProductsResponse, error) {
    params := url.Values{}
    params.Set("page", strconv.Itoa(page))
    params.Set("limit", strconv.Itoa(limit))

    body, err := c.doRequest(ctx, "GET", "/items?"+params.Encode(), nil)
    if err != nil {
        return nil, err
    }

    var resp ProductsResponse
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp, nil
}

// GetProduct отримує товар за ID
func (c *Client) GetProduct(ctx context.Context, id int64) (*Product, error) {
    body, err := c.doRequest(ctx, "GET", fmt.Sprintf("/items/%d", id), nil)
    if err != nil {
        return nil, err
    }

    var resp struct {
        Success bool    `json:"success"`
        Content Product `json:"content"`
    }
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp.Content, nil
}

type CreateProductRequest struct {
    Name          string  `json:"name"`
    NameUK        string  `json:"name_ua,omitempty"`
    Price         float64 `json:"price"`
    OldPrice      float64 `json:"old_price,omitempty"`
    Description   string  `json:"description,omitempty"`
    DescriptionUK string  `json:"description_ua,omitempty"`
    ArticleSeller string  `json:"article_seller"`
    Barcode       string  `json:"barcode,omitempty"`
    CategoryID    int64   `json:"category_id"`
    Brand         string  `json:"brand,omitempty"`
    Country       string  `json:"country,omitempty"`
    Stock         int     `json:"stock"`
    Images        []Image `json:"images,omitempty"`
    Params        []Param `json:"params,omitempty"`
    Weight        float64 `json:"weight,omitempty"`
    Width         float64 `json:"width,omitempty"`
    Height        float64 `json:"height,omitempty"`
    Depth         float64 `json:"depth,omitempty"`
}

// CreateProduct створює новий товар
func (c *Client) CreateProduct(ctx context.Context, req *CreateProductRequest) (*Product, error) {
    body, err := c.doRequest(ctx, "POST", "/items", req)
    if err != nil {
        return nil, err
    }

    var resp struct {
        Success bool    `json:"success"`
        Content Product `json:"content"`
    }
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp.Content, nil
}

// UpdateProduct оновлює товар
func (c *Client) UpdateProduct(ctx context.Context, id int64, req *CreateProductRequest) (*Product, error) {
    body, err := c.doRequest(ctx, "PUT", fmt.Sprintf("/items/%d", id), req)
    if err != nil {
        return nil, err
    }

    var resp struct {
        Success bool    `json:"success"`
        Content Product `json:"content"`
    }
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp.Content, nil
}

// DeleteProduct видаляє товар
func (c *Client) DeleteProduct(ctx context.Context, id int64) error {
    _, err := c.doRequest(ctx, "DELETE", fmt.Sprintf("/items/%d", id), nil)
    return err
}
```

### Stock & Price API

```go
// pkg/rozetka/stock.go
package rozetka

import (
    "context"
    "encoding/json"
)

type StockUpdate struct {
    ID    int64 `json:"id"`
    Stock int   `json:"stock"`
}

type PriceUpdate struct {
    ID       int64   `json:"id"`
    Price    float64 `json:"price"`
    OldPrice float64 `json:"old_price,omitempty"`
}

// UpdateStock оновлює залишки
func (c *Client) UpdateStock(ctx context.Context, updates []StockUpdate) error {
    req := map[string]interface{}{
        "items": updates,
    }

    _, err := c.doRequest(ctx, "PUT", "/items/stock", req)
    return err
}

// UpdatePrices оновлює ціни
func (c *Client) UpdatePrices(ctx context.Context, updates []PriceUpdate) error {
    req := map[string]interface{}{
        "items": updates,
    }

    _, err := c.doRequest(ctx, "PUT", "/items/prices", req)
    return err
}

// BulkUpdate масове оновлення
type BulkUpdateItem struct {
    ID       int64   `json:"id"`
    Stock    *int    `json:"stock,omitempty"`
    Price    *float64 `json:"price,omitempty"`
    OldPrice *float64 `json:"old_price,omitempty"`
    Status   *string `json:"status,omitempty"`
}

func (c *Client) BulkUpdate(ctx context.Context, items []BulkUpdateItem) error {
    req := map[string]interface{}{
        "items": items,
    }

    _, err := c.doRequest(ctx, "PUT", "/items/bulk", req)
    return err
}
```

### Orders API

```go
// pkg/rozetka/orders.go
package rozetka

import (
    "context"
    "encoding/json"
    "fmt"
    "net/url"
    "strconv"
)

type Order struct {
    ID              int64       `json:"id"`
    Status          string      `json:"status"`
    StatusID        int         `json:"status_id"`
    CreatedAt       string      `json:"created_at"`
    UpdatedAt       string      `json:"updated_at"`
    Amount          float64     `json:"amount"`
    Commission      float64     `json:"commission"`
    DeliveryAmount  float64     `json:"delivery_amount"`
    Comment         string      `json:"comment,omitempty"`
    Customer        Customer    `json:"customer"`
    Delivery        Delivery    `json:"delivery"`
    Items           []OrderItem `json:"items"`
    PaymentType     string      `json:"payment_type"`
    IsPaid          bool        `json:"is_paid"`
    TrackingNumber  string      `json:"tracking_number,omitempty"`
}

type Customer struct {
    Name       string `json:"name"`
    Phone      string `json:"phone"`
    Email      string `json:"email,omitempty"`
}

type Delivery struct {
    Type          string `json:"type"`           // nova_poshta, self_pickup, courier
    City          string `json:"city"`
    Address       string `json:"address"`
    WarehouseRef  string `json:"warehouse_ref,omitempty"`
}

type OrderItem struct {
    ID            int64   `json:"id"`
    ProductID     int64   `json:"product_id"`
    Name          string  `json:"name"`
    ArticleSeller string  `json:"article_seller"`
    Price         float64 `json:"price"`
    Quantity      int     `json:"quantity"`
    Amount        float64 `json:"amount"`
}

type OrdersResponse struct {
    Success bool `json:"success"`
    Content struct {
        Items      []Order `json:"items"`
        TotalItems int     `json:"total_items"`
        TotalPages int     `json:"total_pages"`
    } `json:"content"`
}

type OrdersFilter struct {
    Status    string
    DateFrom  string
    DateTo    string
    Page      int
    Limit     int
}

// GetOrders отримує список замовлень
func (c *Client) GetOrders(ctx context.Context, filter *OrdersFilter) (*OrdersResponse, error) {
    params := url.Values{}
    if filter.Status != "" {
        params.Set("status", filter.Status)
    }
    if filter.DateFrom != "" {
        params.Set("date_from", filter.DateFrom)
    }
    if filter.DateTo != "" {
        params.Set("date_to", filter.DateTo)
    }
    params.Set("page", strconv.Itoa(filter.Page))
    params.Set("limit", strconv.Itoa(filter.Limit))

    body, err := c.doRequest(ctx, "GET", "/orders?"+params.Encode(), nil)
    if err != nil {
        return nil, err
    }

    var resp OrdersResponse
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp, nil
}

// GetOrder отримує замовлення за ID
func (c *Client) GetOrder(ctx context.Context, id int64) (*Order, error) {
    body, err := c.doRequest(ctx, "GET", fmt.Sprintf("/orders/%d", id), nil)
    if err != nil {
        return nil, err
    }

    var resp struct {
        Success bool  `json:"success"`
        Content Order `json:"content"`
    }
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return &resp.Content, nil
}

type UpdateOrderRequest struct {
    Status         int    `json:"status,omitempty"`
    TrackingNumber string `json:"tracking_number,omitempty"`
    Comment        string `json:"comment,omitempty"`
}

// UpdateOrder оновлює замовлення
func (c *Client) UpdateOrder(ctx context.Context, id int64, req *UpdateOrderRequest) error {
    _, err := c.doRequest(ctx, "PUT", fmt.Sprintf("/orders/%d", id), req)
    return err
}

// ConfirmOrder підтверджує замовлення
func (c *Client) ConfirmOrder(ctx context.Context, id int64) error {
    req := &UpdateOrderRequest{Status: 2} // 2 = confirmed
    return c.UpdateOrder(ctx, id, req)
}

// ShipOrder відправляє замовлення
func (c *Client) ShipOrder(ctx context.Context, id int64, trackingNumber string) error {
    req := &UpdateOrderRequest{
        Status:         4, // 4 = shipped
        TrackingNumber: trackingNumber,
    }
    return c.UpdateOrder(ctx, id, req)
}

// CancelOrder скасовує замовлення
func (c *Client) CancelOrder(ctx context.Context, id int64, reason string) error {
    req := &UpdateOrderRequest{
        Status:  10, // 10 = cancelled
        Comment: reason,
    }
    return c.UpdateOrder(ctx, id, req)
}
```

### Categories API

```go
// pkg/rozetka/categories.go
package rozetka

import (
    "context"
    "encoding/json"
)

type Category struct {
    ID       int64      `json:"id"`
    Name     string     `json:"name"`
    NameUK   string     `json:"name_ua"`
    ParentID int64      `json:"parent_id"`
    Children []Category `json:"children,omitempty"`
}

// GetCategories отримує дерево категорій
func (c *Client) GetCategories(ctx context.Context) ([]Category, error) {
    body, err := c.doRequest(ctx, "GET", "/categories", nil)
    if err != nil {
        return nil, err
    }

    var resp struct {
        Success bool       `json:"success"`
        Content []Category `json:"content"`
    }
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return resp.Content, nil
}

// GetCategoryParams отримує характеристики категорії
func (c *Client) GetCategoryParams(ctx context.Context, categoryID int64) ([]CategoryParam, error) {
    body, err := c.doRequest(ctx, "GET", fmt.Sprintf("/categories/%d/params", categoryID), nil)
    if err != nil {
        return nil, err
    }

    var resp struct {
        Success bool            `json:"success"`
        Content []CategoryParam `json:"content"`
    }
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }

    return resp.Content, nil
}

type CategoryParam struct {
    ID       int64    `json:"id"`
    Name     string   `json:"name"`
    NameUK   string   `json:"name_ua"`
    Type     string   `json:"type"`     // string, number, select
    Required bool     `json:"required"`
    Values   []string `json:"values,omitempty"` // Для type=select
}
```

---

## Rozetka Service

```go
// internal/services/marketplace/rozetka.go
package marketplace

import (
    "context"
    "fmt"
    "time"

    "shop/pkg/rozetka"
)

type RozetkaService struct {
    client       *rozetka.Client
    productRepo  ProductRepository
    orderRepo    OrderRepository
    mappingRepo  MarketplaceMappingRepository
}

func NewRozetkaService(cfg *config.RozetkaConfig, repos Repositories) *RozetkaService {
    return &RozetkaService{
        client:      rozetka.NewClient(cfg.Username, cfg.Password),
        productRepo: repos.ProductRepo,
        orderRepo:   repos.OrderRepo,
        mappingRepo: repos.MappingRepo,
    }
}

// SyncProducts синхронізує товари з Rozetka
func (s *RozetkaService) SyncProducts(ctx context.Context) error {
    page := 1
    limit := 100

    for {
        resp, err := s.client.GetProducts(ctx, page, limit)
        if err != nil {
            return err
        }

        for _, rProduct := range resp.Content.Items {
            // Знаходимо локальний товар за SKU
            product, err := s.productRepo.FindBySKU(ctx, rProduct.ArticleSeller)
            if err != nil {
                continue
            }

            // Оновлюємо маппінг
            mapping := &MarketplaceMapping{
                ProductID:     product.ID,
                Marketplace:   "rozetka",
                ExternalID:    fmt.Sprintf("%d", rProduct.ID),
                ExternalSKU:   rProduct.ArticleSeller,
                Status:        rProduct.Status,
                LastSyncedAt:  time.Now(),
            }
            s.mappingRepo.Upsert(ctx, mapping)
        }

        if page >= resp.Content.TotalPages {
            break
        }
        page++
    }

    return nil
}

// PublishProduct публікує товар на Rozetka
func (s *RozetkaService) PublishProduct(ctx context.Context, productID string, categoryID int64) error {
    product, err := s.productRepo.FindByID(ctx, productID)
    if err != nil {
        return err
    }

    // Формуємо запит
    req := &rozetka.CreateProductRequest{
        Name:          product.Name,
        NameUK:        product.NameUK,
        Price:         float64(product.Price) / 100,
        OldPrice:      float64(product.CompareAtPrice) / 100,
        Description:   product.Description,
        DescriptionUK: product.DescriptionUK,
        ArticleSeller: product.SKU,
        Barcode:       product.Barcode,
        CategoryID:    categoryID,
        Brand:         product.Brand,
        Country:       product.Country,
        Stock:         product.Stock,
        Weight:        product.Weight,
        Width:         product.Width,
        Height:        product.Height,
        Depth:         product.Depth,
    }

    // Додаємо зображення
    for i, img := range product.Images {
        req.Images = append(req.Images, rozetka.Image{
            URL:      img.URL,
            Priority: i,
        })
    }

    // Додаємо характеристики
    for _, attr := range product.Attributes {
        req.Params = append(req.Params, rozetka.Param{
            Name:  attr.Name,
            Value: attr.Value,
        })
    }

    // Створюємо товар
    rProduct, err := s.client.CreateProduct(ctx, req)
    if err != nil {
        return err
    }

    // Зберігаємо маппінг
    mapping := &MarketplaceMapping{
        ProductID:    productID,
        Marketplace:  "rozetka",
        ExternalID:   fmt.Sprintf("%d", rProduct.ID),
        ExternalSKU:  product.SKU,
        Status:       rProduct.Status,
        LastSyncedAt: time.Now(),
    }

    return s.mappingRepo.Create(ctx, mapping)
}

// UpdateStock оновлює залишки
func (s *RozetkaService) UpdateStock(ctx context.Context, productID string, stock int) error {
    mapping, err := s.mappingRepo.FindByProductID(ctx, productID, "rozetka")
    if err != nil {
        return err
    }

    externalID, _ := strconv.ParseInt(mapping.ExternalID, 10, 64)

    return s.client.UpdateStock(ctx, []rozetka.StockUpdate{
        {ID: externalID, Stock: stock},
    })
}

// UpdatePrice оновлює ціну
func (s *RozetkaService) UpdatePrice(ctx context.Context, productID string, price, oldPrice int64) error {
    mapping, err := s.mappingRepo.FindByProductID(ctx, productID, "rozetka")
    if err != nil {
        return err
    }

    externalID, _ := strconv.ParseInt(mapping.ExternalID, 10, 64)

    return s.client.UpdatePrices(ctx, []rozetka.PriceUpdate{
        {
            ID:       externalID,
            Price:    float64(price) / 100,
            OldPrice: float64(oldPrice) / 100,
        },
    })
}

// ImportOrders імпортує замовлення з Rozetka
func (s *RozetkaService) ImportOrders(ctx context.Context) error {
    filter := &rozetka.OrdersFilter{
        Status: "new",
        Page:   1,
        Limit:  100,
    }

    resp, err := s.client.GetOrders(ctx, filter)
    if err != nil {
        return err
    }

    for _, rOrder := range resp.Content.Items {
        // Перевіряємо чи замовлення вже існує
        exists, _ := s.orderRepo.ExistsByExternalID(ctx, fmt.Sprintf("%d", rOrder.ID), "rozetka")
        if exists {
            continue
        }

        // Створюємо локальне замовлення
        order := s.convertOrder(&rOrder)
        if err := s.orderRepo.Create(ctx, order); err != nil {
            log.Printf("Error creating order %d: %v", rOrder.ID, err)
            continue
        }

        // Автоматично підтверджуємо
        if err := s.client.ConfirmOrder(ctx, rOrder.ID); err != nil {
            log.Printf("Error confirming order %d: %v", rOrder.ID, err)
        }
    }

    return nil
}

func (s *RozetkaService) convertOrder(rOrder *rozetka.Order) *Order {
    order := &Order{
        ID:          generateID("ord"),
        Number:      fmt.Sprintf("RZ-%d", rOrder.ID),
        Source:      "rozetka",
        ExternalID:  fmt.Sprintf("%d", rOrder.ID),
        Status:      OrderStatusNew,
        Total:       int64(rOrder.Amount * 100),
        Currency:    "UAH",
        Customer: Customer{
            Name:  rOrder.Customer.Name,
            Phone: rOrder.Customer.Phone,
            Email: rOrder.Customer.Email,
        },
        Delivery: DeliveryInfo{
            Type:         rOrder.Delivery.Type,
            City:         rOrder.Delivery.City,
            Address:      rOrder.Delivery.Address,
            WarehouseRef: rOrder.Delivery.WarehouseRef,
        },
        PaymentMethod: rOrder.PaymentType,
        IsPaid:        rOrder.IsPaid,
        CreatedAt:     parseDate(rOrder.CreatedAt),
    }

    // Конвертуємо items
    for _, item := range rOrder.Items {
        // Знаходимо локальний товар
        product, _ := s.productRepo.FindBySKU(ctx, item.ArticleSeller)

        orderItem := OrderItem{
            ProductID:  product.ID,
            ExternalID: fmt.Sprintf("%d", item.ProductID),
            Name:       item.Name,
            SKU:        item.ArticleSeller,
            Price:      int64(item.Price * 100),
            Quantity:   item.Quantity,
            Total:      int64(item.Amount * 100),
        }
        order.Items = append(order.Items, orderItem)
    }

    return order
}

// ShipOrder відправляє замовлення
func (s *RozetkaService) ShipOrder(ctx context.Context, orderID, trackingNumber string) error {
    order, err := s.orderRepo.FindByID(ctx, orderID)
    if err != nil {
        return err
    }

    if order.Source != "rozetka" {
        return ErrNotRozetkaOrder
    }

    externalID, _ := strconv.ParseInt(order.ExternalID, 10, 64)

    return s.client.ShipOrder(ctx, externalID, trackingNumber)
}
```

---

## Webhook Handler

```go
// internal/handlers/webhooks/rozetka.go
package webhooks

import (
    "encoding/json"
    "net/http"

    "github.com/gin-gonic/gin"
)

type RozetkaWebhookHandler struct {
    orderService OrderService
    stockService StockService
}

type RozetkaWebhookPayload struct {
    Event   string          `json:"event"`
    OrderID int64           `json:"order_id,omitempty"`
    Data    json.RawMessage `json:"data,omitempty"`
}

// Handle обробляє webhook від Rozetka
func (h *RozetkaWebhookHandler) Handle(c *gin.Context) {
    var payload RozetkaWebhookPayload
    if err := c.ShouldBindJSON(&payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
        return
    }

    ctx := c.Request.Context()

    switch payload.Event {
    case "order.created":
        h.handleOrderCreated(ctx, payload.OrderID)
    case "order.cancelled":
        h.handleOrderCancelled(ctx, payload.OrderID)
    case "order.status_changed":
        h.handleOrderStatusChanged(ctx, payload.OrderID, payload.Data)
    }

    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *RozetkaWebhookHandler) handleOrderCreated(ctx context.Context, orderID int64) {
    // Імпортуємо нове замовлення
    log.Printf("New Rozetka order: %d", orderID)
    // Trigger order import
}

func (h *RozetkaWebhookHandler) handleOrderCancelled(ctx context.Context, orderID int64) {
    // Скасовуємо замовлення
    // Повертаємо залишки
}

func (h *RozetkaWebhookHandler) handleOrderStatusChanged(ctx context.Context, orderID int64, data json.RawMessage) {
    var statusData struct {
        OldStatus int `json:"old_status"`
        NewStatus int `json:"new_status"`
    }
    json.Unmarshal(data, &statusData)

    // Оновлюємо статус
}
```

---

## Cron Jobs

### Синхронізація замовлень

```go
// internal/jobs/rozetka_orders.go
package jobs

type RozetkaOrdersJob struct {
    service *marketplace.RozetkaService
}

func (j *RozetkaOrdersJob) Run() {
    ctx := context.Background()

    if err := j.service.ImportOrders(ctx); err != nil {
        log.Printf("Error importing Rozetka orders: %v", err)
    }
}
```

### Синхронізація залишків

```go
// internal/jobs/rozetka_stock.go
package jobs

type RozetkaStockJob struct {
    service     *marketplace.RozetkaService
    productRepo ProductRepository
    mappingRepo MarketplaceMappingRepository
}

func (j *RozetkaStockJob) Run() {
    ctx := context.Background()

    // Отримуємо всі товари з маппінгом на Rozetka
    mappings, _ := j.mappingRepo.FindByMarketplace(ctx, "rozetka")

    updates := make([]rozetka.StockUpdate, 0, len(mappings))

    for _, m := range mappings {
        product, err := j.productRepo.FindByID(ctx, m.ProductID)
        if err != nil {
            continue
        }

        externalID, _ := strconv.ParseInt(m.ExternalID, 10, 64)

        updates = append(updates, rozetka.StockUpdate{
            ID:    externalID,
            Stock: product.Stock,
        })
    }

    // Batch update (по 100)
    for i := 0; i < len(updates); i += 100 {
        end := i + 100
        if end > len(updates) {
            end = len(updates)
        }

        if err := j.service.client.UpdateStock(ctx, updates[i:end]); err != nil {
            log.Printf("Error updating stock batch: %v", err)
        }
    }
}
```

---

## Admin Interface

### Товари на маркетплейсі

```tsx
// components/admin/marketplace/RozetkaProducts.tsx
import { useQuery, useMutation } from '@tanstack/react-query';

export function RozetkaProducts() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['rozetka-products'],
    queryFn: () => fetch('/api/admin/marketplace/rozetka/products').then(r => r.json()),
  });

  const publishMutation = useMutation({
    mutationFn: ({ productId, categoryId }: { productId: string; categoryId: number }) =>
      fetch('/api/admin/marketplace/rozetka/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, categoryId }),
      }),
  });

  if (isLoading) return <div className="skeleton h-96 w-full" />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Товари на Rozetka</h2>

      <table className="table w-full">
        <thead>
          <tr>
            <th>Товар</th>
            <th>SKU</th>
            <th>Статус</th>
            <th>Залишок</th>
            <th>Ціна</th>
            <th>Дії</th>
          </tr>
        </thead>
        <tbody>
          {products?.map((product: any) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.sku}</td>
              <td>
                <StatusBadge status={product.rozetkaStatus} />
              </td>
              <td>{product.stock}</td>
              <td>{formatPrice(product.price)}</td>
              <td>
                {product.rozetkaId ? (
                  <button className="btn btn-sm" onClick={() => syncProduct(product.id)}>
                    Синхронізувати
                  </button>
                ) : (
                  <PublishButton
                    productId={product.id}
                    onPublish={(categoryId) =>
                      publishMutation.mutate({ productId: product.id, categoryId })
                    }
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Замовлення з маркетплейсу

```tsx
// components/admin/marketplace/RozetkaOrders.tsx
export function RozetkaOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['rozetka-orders'],
    queryFn: () => fetch('/api/admin/orders?source=rozetka').then(r => r.json()),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Замовлення з Rozetka</h2>
        <button className="btn btn-primary" onClick={() => syncOrders()}>
          Синхронізувати
        </button>
      </div>

      <table className="table w-full">
        <thead>
          <tr>
            <th>№ замовлення</th>
            <th>Дата</th>
            <th>Клієнт</th>
            <th>Сума</th>
            <th>Статус</th>
            <th>Дії</th>
          </tr>
        </thead>
        <tbody>
          {orders?.map((order: any) => (
            <tr key={order.id}>
              <td>{order.number}</td>
              <td>{formatDate(order.createdAt)}</td>
              <td>{order.customer.name}</td>
              <td>{formatPrice(order.total)}</td>
              <td><OrderStatus status={order.status} /></td>
              <td>
                <Link href={`/admin/orders/${order.id}`}>
                  <button className="btn btn-sm">Переглянути</button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Статуси замовлень Rozetka

| ID | Статус | Опис |
|----|--------|------|
| 1 | new | Нове замовлення |
| 2 | confirmed | Підтверджено |
| 3 | processing | В обробці |
| 4 | shipped | Відправлено |
| 5 | delivered | Доставлено |
| 6 | completed | Виконано |
| 10 | cancelled | Скасовано |
| 11 | returned | Повернення |

---

## Моніторинг

```go
var (
    rozetkaProductsTotal = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "rozetka_products_total",
            Help: "Total products on Rozetka",
        },
    )

    rozetkaOrdersTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "rozetka_orders_total",
            Help: "Total Rozetka orders",
        },
        []string{"status"},
    )

    rozetkaApiLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "rozetka_api_latency_seconds",
            Help:    "Rozetka API request latency",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method"},
    )

    rozetkaApiErrors = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "rozetka_api_errors_total",
            Help: "Total Rozetka API errors",
        },
        []string{"method", "error"},
    )
)
```

---

## Alerts

```yaml
groups:
  - name: rozetka
    rules:
      - alert: RozetkaOrdersNotSyncing
        expr: |
          time() - rozetka_orders_last_sync_timestamp > 3600
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Rozetka orders not syncing"

      - alert: RozetkaApiErrors
        expr: |
          sum(rate(rozetka_api_errors_total[5m])) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High Rozetka API error rate"

      - alert: RozetkaStockMismatch
        expr: |
          abs(rozetka_stock_local - rozetka_stock_remote) > 10
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Stock mismatch between local and Rozetka"
```

---

## Помилки

| Код | Опис | Вирішення |
|-----|------|-----------|
| `AUTH_FAILED` | Помилка авторизації | Перевірити credentials |
| `PRODUCT_NOT_FOUND` | Товар не знайдено | Перевірити ID |
| `CATEGORY_INVALID` | Невірна категорія | Перевірити категорію |
| `STOCK_INVALID` | Невірний залишок | Залишок >= 0 |
| `ORDER_LOCKED` | Замовлення заблоковано | Зачекати |
| `RATE_LIMIT` | Перевищено ліміт запитів | Зменшити частоту |
