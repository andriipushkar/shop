package kasta

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
)

const (
	baseURL = "https://api.kasta.ua/v1"
)

// Client implements Kasta (formerly Modna Kasta) marketplace integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// New creates a new Kasta client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceKasta
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != ""
}

// ExportProducts exports products to Kasta
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceKasta,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Kasta prefers batch operations
	batch := make([]map[string]interface{}, 0, len(products))
	for _, p := range products {
		item := c.mapProductToKasta(p)
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
			if results, ok := resp["results"].([]interface{}); ok {
				for idx, r := range results {
					rm := r.(map[string]interface{})
					if success, ok := rm["success"].(bool); ok && success {
						result.SuccessItems++
					} else {
						result.FailedItems++
						if i+idx < len(products) {
							result.Errors = append(result.Errors, marketplace.SyncError{
								SKU:     products[i+idx].SKU,
								Message: fmt.Sprintf("%v", rm["error"]),
							})
						}
					}
				}
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

func (c *Client) mapProductToKasta(p *marketplace.Product) map[string]interface{} {
	product := map[string]interface{}{
		"sku":         p.SKU,
		"name":        p.Name,
		"description": p.Description,
		"brand":       p.Brand,
		"category_id": p.CategoryID,
		"price":       p.Price,
		"currency":    "UAH",
		"quantity":    p.Quantity,
		"available":   p.IsAvailable && p.Quantity > 0,
	}

	if p.OldPrice > p.Price {
		product["old_price"] = p.OldPrice
		product["discount_percent"] = int((1 - p.Price/p.OldPrice) * 100)
	}

	if len(p.Images) > 0 {
		product["main_image"] = p.Images[0]
		if len(p.Images) > 1 {
			product["images"] = p.Images[1:]
		}
	}

	// Attributes for fashion items
	if len(p.Attributes) > 0 {
		attrs := make([]map[string]string, 0)
		for name, value := range p.Attributes {
			attrs = append(attrs, map[string]string{
				"name":  name,
				"value": value,
			})
		}
		product["attributes"] = attrs

		// Common fashion attributes
		if size, ok := p.Attributes["size"]; ok {
			product["size"] = size
		}
		if color, ok := p.Attributes["color"]; ok {
			product["color"] = color
		}
		if material, ok := p.Attributes["material"]; ok {
			product["material"] = material
		}
	}

	return product
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	data := c.mapProductToKasta(product)
	_, err := c.doRequest(ctx, "PUT", "/products/"+product.SKU, data)
	return err
}

// UpdateStock updates product stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/stock", map[string]interface{}{
		"quantity":  quantity,
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

// ImportOrders imports orders from Kasta
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	params := url.Values{}
	params.Set("date_from", since.Format("2006-01-02T15:04:05Z"))
	params.Set("status", "new,confirmed,shipped")

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
		Marketplace: marketplace.MarketplaceKasta,
		Status:      fmt.Sprintf("%v", data["status"]),
	}

	if customer, ok := data["customer"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v %v", customer["first_name"], customer["last_name"])
		if phone, ok := customer["phone"].(string); ok {
			order.CustomerPhone = phone
		}
		if email, ok := customer["email"].(string); ok {
			order.CustomerEmail = email
		}
	}

	if delivery, ok := data["delivery"].(map[string]interface{}); ok {
		order.DeliveryType = fmt.Sprintf("%v", delivery["type"])
		order.DeliveryAddress = fmt.Sprintf("%v", delivery["address"])
		order.DeliveryCity = fmt.Sprintf("%v", delivery["city"])
		if ttn, ok := delivery["tracking_number"].(string); ok {
			order.DeliveryInfo = "ТТН: " + ttn
		}
	}

	if payment, ok := data["payment"].(map[string]interface{}); ok {
		order.PaymentType = fmt.Sprintf("%v", payment["type"])
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
			order.Total += item.Total
		}
	}

	if createdAt, ok := data["created_at"].(string); ok {
		order.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
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

// SetTrackingNumber sets tracking number for order
func (c *Client) SetTrackingNumber(ctx context.Context, orderID, trackingNumber string) error {
	_, err := c.doRequest(ctx, "PATCH", "/orders/"+orderID+"/tracking", map[string]interface{}{
		"tracking_number": trackingNumber,
	})
	return err
}

// GetCategories returns Kasta categories
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

		categories = append(categories, cat)

		if children, ok := cm["children"].([]interface{}); ok && len(children) > 0 {
			childCats := c.parseCategories(children, cat.ID)
			categories = append(categories, childCats...)
		}
	}

	return categories
}

// GenerateFeed - Kasta uses API primarily
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	// Kasta primarily uses API, not XML feeds
	return nil, nil
}

// GetBrands returns available brands on Kasta
func (c *Client) GetBrands(ctx context.Context) ([]string, error) {
	resp, err := c.doRequest(ctx, "GET", "/brands", nil)
	if err != nil {
		return nil, err
	}

	brandsData, ok := resp["brands"].([]interface{})
	if !ok {
		return nil, nil
	}

	brands := make([]string, 0, len(brandsData))
	for _, b := range brandsData {
		bm := b.(map[string]interface{})
		brands = append(brands, fmt.Sprintf("%v", bm["name"]))
	}

	return brands, nil
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
