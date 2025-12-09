package zakupka

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
	baseURL = "https://zakupka.com/api/v1"
)

// Client implements Zakupka.com B2B marketplace integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// New creates a new Zakupka client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "zakupka"
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

// ExportProducts exports products to Zakupka
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(),
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Zakupka supports batch operations
	batch := make([]map[string]interface{}, 0, len(products))
	for _, p := range products {
		item := c.mapProduct(p)
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
			if successCount, ok := resp["success"].(float64); ok {
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

func (c *Client) mapProduct(p *marketplace.Product) map[string]interface{} {
	product := map[string]interface{}{
		"sku":          p.SKU,
		"name":         p.Name,
		"description":  p.Description,
		"price":        p.Price,
		"currency":     "UAH",
		"quantity":     p.Quantity,
		"category_id":  p.CategoryID,
		"available":    p.IsAvailable && p.Quantity > 0,
		"url":          p.URL,
	}

	// B2B specific fields
	if p.OldPrice > p.Price {
		product["wholesale_price"] = p.Price
		product["retail_price"] = p.OldPrice
	}

	if len(p.Images) > 0 {
		product["image"] = p.Images[0]
		if len(p.Images) > 1 {
			product["images"] = p.Images[1:]
		}
	}

	if p.Brand != "" {
		product["brand"] = p.Brand
	}

	// Minimum order quantity (B2B)
	if minQty, ok := p.Attributes["min_order"]; ok {
		product["min_order_quantity"] = minQty
	}

	// Unit of measure
	if unit, ok := p.Attributes["unit"]; ok {
		product["unit"] = unit
	}

	// Attributes
	attrs := make([]map[string]string, 0)
	for name, value := range p.Attributes {
		if name != "min_order" && name != "unit" {
			attrs = append(attrs, map[string]string{
				"name":  name,
				"value": value,
			})
		}
	}
	if len(attrs) > 0 {
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

// ImportOrders imports orders (inquiries) from Zakupka
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	params := url.Values{}
	params.Set("date_from", since.Format("2006-01-02"))

	resp, err := c.doRequest(ctx, "GET", "/inquiries?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	inquiriesData, ok := resp["inquiries"].([]interface{})
	if !ok {
		return nil, nil
	}

	orders := make([]*marketplace.Order, 0, len(inquiriesData))
	for _, id := range inquiriesData {
		inquiryMap := id.(map[string]interface{})
		order := c.mapInquiry(inquiryMap)
		orders = append(orders, order)
	}

	return orders, nil
}

func (c *Client) mapInquiry(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%.0f", data["id"].(float64)),
		Marketplace: c.Type(),
		Status:      "inquiry",
		Comment:     "B2B запит з Zakupka",
	}

	if buyer, ok := data["buyer"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", buyer["company_name"])
		if phone, ok := buyer["phone"].(string); ok {
			order.CustomerPhone = phone
		}
		if email, ok := buyer["email"].(string); ok {
			order.CustomerEmail = email
		}
	}

	if message, ok := data["message"].(string); ok {
		order.Comment = message
	}

	if products, ok := data["products"].([]interface{}); ok {
		for _, pd := range products {
			pm := pd.(map[string]interface{})
			item := marketplace.OrderItem{
				SKU:      fmt.Sprintf("%v", pm["sku"]),
				Name:     fmt.Sprintf("%v", pm["name"]),
				Quantity: int(pm["quantity"].(float64)),
			}
			if price, ok := pm["price"].(float64); ok {
				item.Price = price
				item.Total = item.Price * float64(item.Quantity)
				order.Total += item.Total
			}
			order.Items = append(order.Items, item)
		}
	}

	if createdAt, ok := data["created_at"].(string); ok {
		order.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	}

	return order
}

// UpdateOrderStatus updates inquiry status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := c.doRequest(ctx, "PATCH", "/inquiries/"+orderID, map[string]interface{}{
		"status": status,
	})
	return err
}

// GetCategories returns Zakupka categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/categories", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["categories"].([]interface{})
	if !ok {
		return nil, nil
	}

	return parseCategories(catsData, ""), nil
}

func parseCategories(data []interface{}, parentID string) []marketplace.Category {
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
			childCats := parseCategories(children, cat.ID)
			categories = append(categories, childCats...)
		}
	}

	return categories
}

// GenerateFeed generates XML feed
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	// Zakupka uses API primarily
	return nil, nil
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
