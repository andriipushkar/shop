package citrus

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
	baseURL = "https://seller.citrus.ua/api/v1"
)

// Client implements Citrus marketplace integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.YMLGenerator
}

// New creates a new Citrus client
func New() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType { return "citrus" }

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	c.feedGen = feeds.NewYMLGenerator(&feeds.YMLConfig{
		ShopName: "Shop", CompanyName: "Company", ShopURL: config.BaseURL, Currency: "UAH",
	})
	return nil
}

// IsConfigured returns true if configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != ""
}

// ExportProducts exports products
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport, Status: marketplace.SyncStatusRunning,
		TotalItems: len(products), StartedAt: time.Now(),
	}

	for _, p := range products {
		if err := c.exportProduct(ctx, p); err != nil {
			result.FailedItems++
			result.Errors = append(result.Errors, marketplace.SyncError{SKU: p.SKU, Message: err.Error()})
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
	data := map[string]interface{}{
		"sku": p.SKU, "name": p.Name, "description": p.Description,
		"price": p.Price, "stock": p.Quantity, "category_id": p.CategoryID,
		"brand": p.Brand, "available": p.IsAvailable && p.Quantity > 0,
	}
	if p.OldPrice > p.Price {
		data["old_price"] = p.OldPrice
	}
	if len(p.Images) > 0 {
		data["images"] = p.Images
	}
	if p.Warranty > 0 {
		data["warranty"] = p.Warranty
	}
	_, err := c.doRequest(ctx, "POST", "/products", data)
	return err
}

// UpdateProduct updates a product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.exportProduct(ctx, product)
}

// UpdateStock updates stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/stock", map[string]interface{}{"stock": quantity})
	return err
}

// UpdatePrice updates price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/price", map[string]interface{}{"price": price})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "DELETE", "/products/"+sku, nil)
	return err
}

// ImportOrders imports orders
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
		om := od.(map[string]interface{})
		order := &marketplace.Order{
			ExternalID: fmt.Sprintf("%.0f", om["id"].(float64)), Marketplace: c.Type(),
			Status: fmt.Sprintf("%v", om["status"]),
		}
		if customer, ok := om["customer"].(map[string]interface{}); ok {
			order.CustomerName = fmt.Sprintf("%v", customer["name"])
			order.CustomerPhone = fmt.Sprintf("%v", customer["phone"])
		}
		orders = append(orders, order)
	}
	return orders, nil
}

// UpdateOrderStatus updates order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := c.doRequest(ctx, "PATCH", "/orders/"+orderID, map[string]interface{}{"status": status})
	return err
}

// GetCategories returns categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return nil, nil
}

// GenerateFeed generates feed
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.feedGen.GenerateSimpleFeed(products)
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}
	req, _ := http.NewRequestWithContext(ctx, method, baseURL+path, reqBody)
	req.Header.Set("Authorization", "Bearer "+c.config.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}
