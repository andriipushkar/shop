package allo

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
	baseURL = "https://seller.allo.ua/api/v2"
)

// Client implements Allo marketplace integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.YMLGenerator
}

// New creates a new Allo client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceAllo
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config

	c.feedGen = feeds.NewYMLGenerator(&feeds.YMLConfig{
		ShopName:     "Shop",
		CompanyName:  "Company",
		ShopURL:      config.BaseURL,
		Currency:     "UAH",
		DeliveryCost: 0,
		DeliveryDays: 3,
	})

	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != ""
}

// ExportProducts exports products to Allo
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceAllo,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Allo uses batch updates
	batch := make([]map[string]interface{}, 0, len(products))
	for _, p := range products {
		item := c.mapProductToAllo(p)
		batch = append(batch, item)
	}

	// Send in chunks
	chunkSize := 100
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
			// Parse response
			if successCount, ok := resp["success_count"].(float64); ok {
				result.SuccessItems += int(successCount)
			}
			if errors, ok := resp["errors"].([]interface{}); ok {
				for _, e := range errors {
					em := e.(map[string]interface{})
					result.FailedItems++
					result.Errors = append(result.Errors, marketplace.SyncError{
						SKU:     fmt.Sprintf("%v", em["sku"]),
						Message: fmt.Sprintf("%v", em["message"]),
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

func (c *Client) mapProductToAllo(p *marketplace.Product) map[string]interface{} {
	product := map[string]interface{}{
		"sku":          p.SKU,
		"name":         p.Name,
		"description":  p.Description,
		"brand":        p.Brand,
		"category_id":  p.CategoryID,
		"price":        p.Price,
		"currency":     "UAH",
		"quantity":     p.Quantity,
		"availability": c.mapAvailability(p),
		"url":          p.URL,
	}

	if p.OldPrice > p.Price {
		product["old_price"] = p.OldPrice
	}

	if len(p.Images) > 0 {
		product["image"] = p.Images[0]
		if len(p.Images) > 1 {
			product["additional_images"] = p.Images[1:]
		}
	}

	// Attributes
	if len(p.Attributes) > 0 {
		attrs := make([]map[string]interface{}, 0)
		for name, value := range p.Attributes {
			attrs = append(attrs, map[string]interface{}{
				"name":  name,
				"value": value,
			})
		}
		product["attributes"] = attrs
	}

	// Warranty
	if p.Warranty > 0 {
		product["warranty_months"] = p.Warranty
	}

	// Weight and dimensions for shipping
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

	return product
}

func (c *Client) mapAvailability(p *marketplace.Product) string {
	if !p.IsAvailable || p.Quantity <= 0 {
		return "out_of_stock"
	}
	if p.Quantity < 5 {
		return "limited"
	}
	return "in_stock"
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	data := c.mapProductToAllo(product)
	_, err := c.doRequest(ctx, "PUT", "/products/"+product.SKU, data)
	return err
}

// UpdateStock updates product stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	availability := "out_of_stock"
	if quantity > 0 {
		availability = "in_stock"
	}

	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/stock", map[string]interface{}{
		"quantity":     quantity,
		"availability": availability,
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

// ImportOrders imports orders from Allo
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	params := url.Values{}
	params.Set("date_from", since.Format("2006-01-02"))
	params.Set("statuses", "new,processing,shipped")

	resp, err := c.doRequest(ctx, "GET", "/orders?"+params.Encode(), nil)
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
		Marketplace: marketplace.MarketplaceAllo,
		Status:      fmt.Sprintf("%v", data["status"]),
		Total:       data["total"].(float64),
	}

	if customer, ok := data["customer"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", customer["name"])
		if phone, ok := customer["phone"].(string); ok {
			order.CustomerPhone = phone
		}
		if email, ok := customer["email"].(string); ok {
			order.CustomerEmail = email
		}
	}

	if delivery, ok := data["delivery"].(map[string]interface{}); ok {
		order.DeliveryType = fmt.Sprintf("%v", delivery["method"])
		order.DeliveryAddress = fmt.Sprintf("%v", delivery["address"])
		order.DeliveryCity = fmt.Sprintf("%v", delivery["city"])
		if tracking, ok := delivery["tracking_number"].(string); ok {
			order.DeliveryInfo = "ТТН: " + tracking
		}
	}

	if payment, ok := data["payment"].(map[string]interface{}); ok {
		order.PaymentType = fmt.Sprintf("%v", payment["method"])
	}

	if comment, ok := data["comment"].(string); ok {
		order.Comment = comment
	}

	if items, ok := data["items"].([]interface{}); ok {
		for _, id := range items {
			im := id.(map[string]interface{})
			item := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%.0f", im["id"].(float64)),
				SKU:        fmt.Sprintf("%v", im["sku"]),
				Name:       fmt.Sprintf("%v", im["name"]),
				Price:      im["price"].(float64),
				Quantity:   int(im["quantity"].(float64)),
			}
			item.Total = item.Price * float64(item.Quantity)
			order.Items = append(order.Items, item)
		}
	}

	if createdAt, ok := data["created_at"].(string); ok {
		order.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := c.doRequest(ctx, "PATCH", "/orders/"+orderID, map[string]interface{}{
		"status": status,
	})
	return err
}

// SetTracking sets tracking number for order
func (c *Client) SetTracking(ctx context.Context, orderID, trackingNumber, carrier string) error {
	_, err := c.doRequest(ctx, "POST", "/orders/"+orderID+"/tracking", map[string]interface{}{
		"tracking_number": trackingNumber,
		"carrier":         carrier,
	})
	return err
}

// GetCategories returns Allo categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/categories", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["categories"].([]interface{})
	if !ok {
		return nil, nil
	}

	return c.parseCategories(catsData, ""), nil
}

func (c *Client) parseCategories(data []interface{}, parentID string) []marketplace.Category {
	categories := make([]marketplace.Category, 0)

	for _, cd := range data {
		cm := cd.(map[string]interface{})
		cat := marketplace.Category{
			ID:       fmt.Sprintf("%.0f", cm["id"].(float64)),
			Name:     fmt.Sprintf("%v", cm["name"]),
			ParentID: parentID,
		}

		if path, ok := cm["path"].(string); ok {
			cat.Path = path
		}

		categories = append(categories, cat)

		if children, ok := cm["children"].([]interface{}); ok && len(children) > 0 {
			childCats := c.parseCategories(children, cat.ID)
			categories = append(categories, childCats...)
		}
	}

	return categories
}

// GenerateFeed generates YML feed for Allo
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.feedGen.GenerateSimpleFeed(products)
}

// GetProductStatuses returns status of products on Allo
func (c *Client) GetProductStatuses(ctx context.Context, skus []string) (map[string]string, error) {
	resp, err := c.doRequest(ctx, "POST", "/products/statuses", map[string]interface{}{
		"skus": skus,
	})
	if err != nil {
		return nil, err
	}

	statuses := make(map[string]string)
	if data, ok := resp["statuses"].(map[string]interface{}); ok {
		for sku, status := range data {
			statuses[sku] = fmt.Sprintf("%v", status)
		}
	}

	return statuses, nil
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
	req.Header.Set("Accept", "application/json")

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

	if resp.StatusCode == 204 {
		return nil, nil
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}
