package rozetka

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
	baseURL = "https://seller-api.rozetka.com.ua"
)

// Client implements Rozetka Seller API integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.YMLGenerator
}

// New creates a new Rozetka client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceRozetka
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

// ExportProducts exports products to Rozetka
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceRozetka,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Rozetka uses batch operations
	batch := make([]map[string]interface{}, 0, len(products))

	for _, p := range products {
		item := c.mapProductToRozetka(p)
		batch = append(batch, item)
	}

	// Send batch in chunks
	chunkSize := 100
	for i := 0; i < len(batch); i += chunkSize {
		end := i + chunkSize
		if end > len(batch) {
			end = len(batch)
		}
		chunk := batch[i:end]

		resp, err := c.doRequest(ctx, "POST", "/items", map[string]interface{}{
			"items": chunk,
		})

		if err != nil {
			for _, item := range chunk {
				result.FailedItems++
				result.Errors = append(result.Errors, marketplace.SyncError{
					SKU:     item["article"].(string),
					Message: err.Error(),
				})
			}
		} else {
			// Parse response for individual results
			if items, ok := resp["content"].(map[string]interface{}); ok {
				if success, ok := items["success"].([]interface{}); ok {
					result.SuccessItems += len(success)
				}
				if errors, ok := items["errors"].([]interface{}); ok {
					for _, e := range errors {
						em := e.(map[string]interface{})
						result.FailedItems++
						result.Errors = append(result.Errors, marketplace.SyncError{
							SKU:     fmt.Sprintf("%v", em["article"]),
							Message: fmt.Sprintf("%v", em["message"]),
						})
					}
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

func (c *Client) mapProductToRozetka(p *marketplace.Product) map[string]interface{} {
	item := map[string]interface{}{
		"article":     p.SKU,
		"name":        p.Name,
		"description": p.Description,
		"price":       p.Price,
		"old_price":   p.OldPrice,
		"stock":       p.Quantity,
		"category_id": p.CategoryID,
		"brand":       p.Brand,
		"status":      c.mapStatus(p),
	}

	if len(p.Images) > 0 {
		item["main_image"] = p.Images[0]
		if len(p.Images) > 1 {
			item["images"] = p.Images[1:]
		}
	}

	// Parameters
	params := make([]map[string]interface{}, 0)
	for name, value := range p.Attributes {
		params = append(params, map[string]interface{}{
			"name":  name,
			"value": value,
		})
	}
	if len(params) > 0 {
		item["parameters"] = params
	}

	return item
}

func (c *Client) mapStatus(p *marketplace.Product) string {
	if !p.IsActive {
		return "inactive"
	}
	if p.Quantity <= 0 {
		return "out_of_stock"
	}
	return "active"
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	item := c.mapProductToRozetka(product)
	_, err := c.doRequest(ctx, "PUT", "/items/"+product.SKU, item)
	return err
}

// UpdateStock updates product stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	_, err := c.doRequest(ctx, "PATCH", "/items/stock", map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"article": sku,
				"stock":   quantity,
			},
		},
	})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "PATCH", "/items/price", map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"article": sku,
				"price":   price,
			},
		},
	})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "DELETE", "/items/"+sku, nil)
	return err
}

// ImportOrders imports orders from Rozetka
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	params := url.Values{}
	params.Set("created_from", since.Format("2006-01-02T15:04:05Z"))
	params.Set("expand", "items,delivery,payment")

	resp, err := c.doRequest(ctx, "GET", "/orders?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["content"].([]interface{})
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
		Marketplace: marketplace.MarketplaceRozetka,
		Status:      fmt.Sprintf("%v", data["status"]),
		Total:       data["amount"].(float64),
	}

	if customer, ok := data["customer"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v %v", customer["first_name"], customer["last_name"])
		order.CustomerPhone = fmt.Sprintf("%v", customer["phone"])
		if email, ok := customer["email"].(string); ok {
			order.CustomerEmail = email
		}
	}

	if delivery, ok := data["delivery"].(map[string]interface{}); ok {
		order.DeliveryType = fmt.Sprintf("%v", delivery["delivery_service"])
		order.DeliveryAddress = fmt.Sprintf("%v", delivery["recipient_address"])
		order.DeliveryCity = fmt.Sprintf("%v", delivery["city"])
		if ttn, ok := delivery["ttn"].(string); ok {
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
				SKU:        fmt.Sprintf("%v", im["article"]),
				Name:       fmt.Sprintf("%v", im["name"]),
				Price:      im["price"].(float64),
				Quantity:   int(im["quantity"].(float64)),
			}
			item.Total = item.Price * float64(item.Quantity)
			order.Items = append(order.Items, item)
		}
	}

	if createdAt, ok := data["created"].(string); ok {
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

// GetCategories returns Rozetka categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/categories", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["content"].([]interface{})
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

		// Recursively parse children
		if children, ok := cm["children"].([]interface{}); ok && len(children) > 0 {
			childCats := c.parseCategories(children, cat.ID)
			categories = append(categories, childCats...)
		}
	}

	return categories
}

// GenerateFeed generates YML feed for Rozetka
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

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// SetTTN sets tracking number for order
func (c *Client) SetTTN(ctx context.Context, orderID, ttn string) error {
	_, err := c.doRequest(ctx, "PATCH", "/orders/"+orderID+"/delivery", map[string]interface{}{
		"ttn": ttn,
	})
	return err
}
