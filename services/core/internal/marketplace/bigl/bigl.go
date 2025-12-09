package bigl

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"core/internal/marketplace"
	"core/internal/marketplace/feeds"
)

const (
	baseURL = "https://my.bigl.ua/api/v1"
)

// Client implements Bigl.ua marketplace integration
// Bigl.ua is part of EVO group (like Prom.ua)
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.YMLGenerator
}

// New creates a new Bigl.ua client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "bigl"
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	c.feedGen = feeds.NewYMLGenerator(&feeds.YMLConfig{
		ShopName:    "Shop",
		CompanyName: "Company",
		ShopURL:     config.BaseURL,
		Currency:    "UAH",
	})
	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != ""
}

// ExportProducts exports products to Bigl.ua
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(),
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	for _, p := range products {
		if err := c.exportProduct(ctx, p); err != nil {
			result.FailedItems++
			result.Errors = append(result.Errors, marketplace.SyncError{
				SKU:     p.SKU,
				Message: err.Error(),
			})
		} else {
			result.SuccessItems++
		}
		result.ProcessedItems++
	}

	now := time.Now()
	result.CompletedAt = &now
	result.Status = marketplace.SyncStatusCompleted
	if result.FailedItems > 0 && result.SuccessItems == 0 {
		result.Status = marketplace.SyncStatusFailed
	}

	return result, nil
}

func (c *Client) exportProduct(ctx context.Context, p *marketplace.Product) error {
	biglProduct := map[string]interface{}{
		"external_id":      p.SKU,
		"name":             p.Name,
		"description":      p.Description,
		"price":            p.Price,
		"currency":         "UAH",
		"presence":         c.mapPresence(p),
		"quantity_in_stock": p.Quantity,
		"category_id":      p.CategoryID,
		"images":           c.mapImages(p.Images),
	}

	if p.OldPrice > p.Price {
		biglProduct["discount"] = map[string]interface{}{
			"value": p.OldPrice - p.Price,
			"type":  "amount",
		}
	}

	// Check if exists
	existing, _ := c.getByExternalID(ctx, p.SKU)
	if existing != nil {
		biglProduct["id"] = existing["id"]
	}

	_, err := c.doRequest(ctx, "POST", "/products/edit", biglProduct)
	return err
}

func (c *Client) getByExternalID(ctx context.Context, externalID string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("external_id", externalID)

	resp, err := c.doRequest(ctx, "GET", "/products/list?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	products, ok := resp["products"].([]interface{})
	if !ok || len(products) == 0 {
		return nil, nil
	}

	return products[0].(map[string]interface{}), nil
}

func (c *Client) mapPresence(p *marketplace.Product) string {
	if !p.IsAvailable || p.Quantity <= 0 {
		return "not_available"
	}
	if p.Quantity < 5 {
		return "running_low"
	}
	return "available"
}

func (c *Client) mapImages(images []string) []map[string]string {
	result := make([]map[string]string, 0, len(images))
	for _, img := range images {
		result = append(result, map[string]string{"url": img})
	}
	return result
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.exportProduct(ctx, product)
}

// UpdateStock updates product stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	existing, err := c.getByExternalID(ctx, sku)
	if err != nil || existing == nil {
		return marketplace.ErrProductNotFound
	}

	presence := "available"
	if quantity <= 0 {
		presence = "not_available"
	}

	_, err = c.doRequest(ctx, "POST", "/products/edit", map[string]interface{}{
		"id":               existing["id"],
		"quantity_in_stock": quantity,
		"presence":         presence,
	})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	existing, err := c.getByExternalID(ctx, sku)
	if err != nil || existing == nil {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "POST", "/products/edit", map[string]interface{}{
		"id":    existing["id"],
		"price": price,
	})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	existing, err := c.getByExternalID(ctx, sku)
	if err != nil || existing == nil {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "POST", "/products/delete", map[string]interface{}{
		"id": existing["id"],
	})
	return err
}

// ImportOrders imports orders from Bigl.ua
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	params := url.Values{}
	params.Set("date_from", since.Format("2006-01-02"))
	params.Set("status", "pending,accepted,delivered")

	resp, err := c.doRequest(ctx, "GET", "/orders/list?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["orders"].([]interface{})
	if !ok {
		return nil, nil
	}

	orders := make([]*marketplace.Order, 0, len(ordersData))
	for _, od := range ordersData {
		orderMap := od.(map[string]interface{})
		order := c.mapOrder(orderMap)
		orders = append(orders, order)
	}

	return orders, nil
}

func (c *Client) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%.0f", data["id"].(float64)),
		Marketplace: c.Type(),
		Status:      data["status"].(string),
	}

	if client, ok := data["client"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v %v", client["first_name"], client["last_name"])
		if phones, ok := client["phones"].([]interface{}); ok && len(phones) > 0 {
			order.CustomerPhone = phones[0].(string)
		}
		if email, ok := client["email"].(string); ok {
			order.CustomerEmail = email
		}
	}

	if delivery, ok := data["delivery"].(map[string]interface{}); ok {
		order.DeliveryType = fmt.Sprintf("%v", delivery["delivery_type"])
		order.DeliveryAddress = fmt.Sprintf("%v", delivery["address"])
		order.DeliveryCity = fmt.Sprintf("%v", delivery["city"])
	}

	if products, ok := data["products"].([]interface{}); ok {
		for _, pd := range products {
			pm := pd.(map[string]interface{})
			item := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%.0f", pm["id"].(float64)),
				Name:       fmt.Sprintf("%v", pm["name"]),
				Price:      pm["price"].(float64),
				Quantity:   int(pm["quantity"].(float64)),
			}
			item.Total = item.Price * float64(item.Quantity)
			order.Items = append(order.Items, item)
			order.Total += item.Total
		}
	}

	if dateCreated, ok := data["date_created"].(string); ok {
		order.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", dateCreated)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := c.doRequest(ctx, "POST", "/orders/set_status", map[string]interface{}{
		"ids":    []string{orderID},
		"status": status,
	})
	return err
}

// GetCategories returns Bigl.ua categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/categories/list", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["categories"].([]interface{})
	if !ok {
		return nil, nil
	}

	categories := make([]marketplace.Category, 0, len(catsData))
	for _, cd := range catsData {
		cm := cd.(map[string]interface{})
		cat := marketplace.Category{
			ID:   fmt.Sprintf("%.0f", cm["id"].(float64)),
			Name: fmt.Sprintf("%v", cm["caption"]),
		}
		if parentID, ok := cm["parent_id"].(float64); ok {
			cat.ParentID = fmt.Sprintf("%.0f", parentID)
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// GenerateFeed generates YML feed
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.feedGen.GenerateSimpleFeed(products)
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.config.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return nil, marketplace.ErrRateLimited
	}

	if resp.StatusCode == 401 {
		return nil, marketplace.ErrAuthentication
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}
