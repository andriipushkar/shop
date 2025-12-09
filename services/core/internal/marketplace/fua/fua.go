package fua

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"core/internal/marketplace"
	"core/internal/marketplace/feeds"
)

const (
	baseURL = "https://seller.f.ua/api/v1"
)

// Client implements F.ua marketplace integration
// F.ua is a major electronics marketplace in Ukraine
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.YMLGenerator
}

// New creates a new F.ua client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "fua"
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

// ExportProducts exports products to F.ua
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(),
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Batch upload
	batch := make([]map[string]interface{}, 0, len(products))
	for _, p := range products {
		item := c.mapProduct(p)
		batch = append(batch, item)
	}

	chunkSize := 50
	for i := 0; i < len(batch); i += chunkSize {
		end := i + chunkSize
		if end > len(batch) {
			end = len(batch)
		}
		chunk := batch[i:end]

		resp, err := c.doRequest(ctx, "POST", "/products/import", map[string]interface{}{
			"products": chunk,
		})

		if err != nil {
			for j := range chunk {
				if i+j < len(products) {
					result.FailedItems++
					result.Errors = append(result.Errors, marketplace.SyncError{
						SKU:     products[i+j].SKU,
						Message: err.Error(),
					})
				}
			}
		} else {
			if success, ok := resp["imported"].(float64); ok {
				result.SuccessItems += int(success)
			}
			if errors, ok := resp["errors"].([]interface{}); ok {
				for _, e := range errors {
					em := e.(map[string]interface{})
					result.FailedItems++
					result.Errors = append(result.Errors, marketplace.SyncError{
						SKU:     fmt.Sprintf("%v", em["sku"]),
						Message: fmt.Sprintf("%v", em["error"]),
					})
				}
			}
		}
		result.ProcessedItems += len(chunk)
	}

	now := time.Now()
	result.CompletedAt = &now
	result.Status = marketplace.SyncStatusCompleted
	if result.FailedItems > 0 && result.SuccessItems == 0 {
		result.Status = marketplace.SyncStatusFailed
	}

	return result, nil
}

func (c *Client) mapProduct(p *marketplace.Product) map[string]interface{} {
	product := map[string]interface{}{
		"sku":         p.SKU,
		"name":        p.Name,
		"description": p.Description,
		"price":       p.Price,
		"currency":    "UAH",
		"stock":       p.Quantity,
		"available":   p.IsAvailable && p.Quantity > 0,
		"category_id": p.CategoryID,
		"brand":       p.Brand,
		"url":         p.URL,
	}

	if p.OldPrice > p.Price {
		product["old_price"] = p.OldPrice
	}

	if len(p.Images) > 0 {
		product["image"] = p.Images[0]
		if len(p.Images) > 1 {
			product["gallery"] = p.Images[1:]
		}
	}

	// Electronics specific
	if p.Warranty > 0 {
		product["warranty"] = p.Warranty
	}

	if p.Weight > 0 {
		product["weight"] = p.Weight
	}

	if p.Dimensions != nil {
		product["dimensions"] = map[string]float64{
			"length": p.Dimensions.Length,
			"width":  p.Dimensions.Width,
			"height": p.Dimensions.Height,
		}
	}

	// Attributes
	if len(p.Attributes) > 0 {
		attrs := make([]map[string]string, 0)
		for name, value := range p.Attributes {
			attrs = append(attrs, map[string]string{
				"name":  name,
				"value": value,
			})
		}
		product["attributes"] = attrs
	}

	return product
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	data := c.mapProduct(product)
	_, err := c.doRequest(ctx, "PUT", "/products/"+product.SKU, data)
	return err
}

// UpdateStock updates product stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/stock", map[string]interface{}{
		"stock":     quantity,
		"available": quantity > 0,
	})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/price", map[string]interface{}{
		"price": price,
	})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "DELETE", "/products/"+sku, nil)
	return err
}

// ImportOrders imports orders from F.ua
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	resp, err := c.doRequest(ctx, "GET", fmt.Sprintf("/orders?since=%s", since.Format("2006-01-02")), nil)
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
		Status:      fmt.Sprintf("%v", data["status"]),
		Total:       data["total"].(float64),
	}

	if customer, ok := data["customer"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", customer["name"])
		order.CustomerPhone = fmt.Sprintf("%v", customer["phone"])
		if email, ok := customer["email"].(string); ok {
			order.CustomerEmail = email
		}
	}

	if delivery, ok := data["delivery"].(map[string]interface{}); ok {
		order.DeliveryType = fmt.Sprintf("%v", delivery["type"])
		order.DeliveryCity = fmt.Sprintf("%v", delivery["city"])
		order.DeliveryAddress = fmt.Sprintf("%v", delivery["address"])
	}

	if items, ok := data["items"].([]interface{}); ok {
		for _, item := range items {
			im := item.(map[string]interface{})
			orderItem := marketplace.OrderItem{
				SKU:      fmt.Sprintf("%v", im["sku"]),
				Name:     fmt.Sprintf("%v", im["name"]),
				Price:    im["price"].(float64),
				Quantity: int(im["quantity"].(float64)),
			}
			orderItem.Total = orderItem.Price * float64(orderItem.Quantity)
			order.Items = append(order.Items, orderItem)
		}
	}

	if created, ok := data["created_at"].(string); ok {
		order.CreatedAt, _ = time.Parse(time.RFC3339, created)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := c.doRequest(ctx, "PATCH", "/orders/"+orderID+"/status", map[string]interface{}{
		"status": status,
	})
	return err
}

// GetCategories returns F.ua categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/categories", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["categories"].([]interface{})
	if !ok {
		return nil, nil
	}

	categories := make([]marketplace.Category, 0)
	for _, cd := range catsData {
		cm := cd.(map[string]interface{})
		cat := marketplace.Category{
			ID:   fmt.Sprintf("%.0f", cm["id"].(float64)),
			Name: fmt.Sprintf("%v", cm["name"]),
		}
		if parent, ok := cm["parent_id"].(float64); ok {
			cat.ParentID = fmt.Sprintf("%.0f", parent)
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
