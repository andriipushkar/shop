package electronics

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

// BaseElectronicsClient provides common functionality for electronics stores
type BaseElectronicsClient struct {
	mpType     marketplace.MarketplaceType
	baseURL    string
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.YMLGenerator
}

// NewComfyClient creates Comfy client
func NewComfyClient() *BaseElectronicsClient {
	return &BaseElectronicsClient{
		mpType:     "comfy",
		baseURL:    "https://seller.comfy.ua/api/v1",
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// NewMoyoClient creates Moyo client
func NewMoyoClient() *BaseElectronicsClient {
	return &BaseElectronicsClient{
		mpType:     "moyo",
		baseURL:    "https://seller.moyo.ua/api/v1",
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// NewFoxtrotClient creates Foxtrot client
func NewFoxtrotClient() *BaseElectronicsClient {
	return &BaseElectronicsClient{
		mpType:     "foxtrot",
		baseURL:    "https://seller.foxtrot.com.ua/api/v1",
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Type returns the marketplace type
func (c *BaseElectronicsClient) Type() marketplace.MarketplaceType {
	return c.mpType
}

// Configure configures the client
func (c *BaseElectronicsClient) Configure(config *marketplace.Config) error {
	c.config = config
	c.feedGen = feeds.NewYMLGenerator(&feeds.YMLConfig{
		ShopName:    "Shop",
		CompanyName: "Company",
		ShopURL:     config.BaseURL,
		Currency:    "UAH",
	})
	return nil
}

// IsConfigured returns true if configured
func (c *BaseElectronicsClient) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != ""
}

// ExportProducts exports products
func (c *BaseElectronicsClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.mpType,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Batch upload
	batch := make([]map[string]interface{}, 0, len(products))
	for _, p := range products {
		batch = append(batch, c.mapProduct(p))
	}

	chunkSize := 50
	for i := 0; i < len(batch); i += chunkSize {
		end := i + chunkSize
		if end > len(batch) {
			end = len(batch)
		}
		chunk := batch[i:end]

		resp, err := c.doRequest(ctx, "POST", "/products/batch", map[string]interface{}{
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
			if success, ok := resp["success"].(float64); ok {
				result.SuccessItems += int(success)
			} else {
				result.SuccessItems += len(chunk)
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

func (c *BaseElectronicsClient) mapProduct(p *marketplace.Product) map[string]interface{} {
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
		product["images"] = p.Images
	}

	if p.Warranty > 0 {
		product["warranty_months"] = p.Warranty
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

	// Electronics attributes
	attrs := make([]map[string]string, 0)
	for name, value := range p.Attributes {
		attrs = append(attrs, map[string]string{"name": name, "value": value})
	}
	if len(attrs) > 0 {
		product["attributes"] = attrs
	}

	return product
}

// UpdateProduct updates a product
func (c *BaseElectronicsClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	data := c.mapProduct(product)
	_, err := c.doRequest(ctx, "PUT", "/products/"+product.SKU, data)
	return err
}

// UpdateStock updates stock
func (c *BaseElectronicsClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/stock", map[string]interface{}{
		"stock":     quantity,
		"available": quantity > 0,
	})
	return err
}

// UpdatePrice updates price
func (c *BaseElectronicsClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/price", map[string]interface{}{
		"price": price,
	})
	return err
}

// DeleteProduct deletes a product
func (c *BaseElectronicsClient) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "DELETE", "/products/"+sku, nil)
	return err
}

// ImportOrders imports orders
func (c *BaseElectronicsClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
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
			ExternalID:  fmt.Sprintf("%.0f", om["id"].(float64)),
			Marketplace: c.mpType,
			Status:      fmt.Sprintf("%v", om["status"]),
		}

		if customer, ok := om["customer"].(map[string]interface{}); ok {
			order.CustomerName = fmt.Sprintf("%v", customer["name"])
			order.CustomerPhone = fmt.Sprintf("%v", customer["phone"])
			if email, ok := customer["email"].(string); ok {
				order.CustomerEmail = email
			}
		}

		if delivery, ok := om["delivery"].(map[string]interface{}); ok {
			order.DeliveryType = fmt.Sprintf("%v", delivery["type"])
			order.DeliveryCity = fmt.Sprintf("%v", delivery["city"])
			order.DeliveryAddress = fmt.Sprintf("%v", delivery["address"])
		}

		if items, ok := om["items"].([]interface{}); ok {
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
				order.Total += orderItem.Total
			}
		}

		if created, ok := om["created_at"].(string); ok {
			order.CreatedAt, _ = time.Parse(time.RFC3339, created)
		}

		orders = append(orders, order)
	}

	return orders, nil
}

// UpdateOrderStatus updates order status
func (c *BaseElectronicsClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := c.doRequest(ctx, "PATCH", "/orders/"+orderID+"/status", map[string]interface{}{
		"status": status,
	})
	return err
}

// GetCategories returns categories
func (c *BaseElectronicsClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
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
func (c *BaseElectronicsClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.feedGen.GenerateSimpleFeed(products)
}

func (c *BaseElectronicsClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
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
