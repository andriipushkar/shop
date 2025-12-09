package ecommerce

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"core/internal/marketplace"
)

// WooCommerceClient implements WooCommerce REST API integration
type WooCommerceClient struct {
	config      *marketplace.Config
	httpClient  *http.Client
	siteURL     string
	consumerKey string
	consumerSecret string
}

// NewWooCommerceClient creates WooCommerce client
func NewWooCommerceClient() *WooCommerceClient {
	return &WooCommerceClient{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns type
func (c *WooCommerceClient) Type() marketplace.MarketplaceType { return "woocommerce" }

// Configure configures
func (c *WooCommerceClient) Configure(config *marketplace.Config) error {
	c.config = config
	c.siteURL = config.ShopID     // https://example.com
	c.consumerKey = config.APIKey
	c.consumerSecret = config.APISecret
	return nil
}

// IsConfigured returns if configured
func (c *WooCommerceClient) IsConfigured() bool {
	return c.config != nil && c.siteURL != "" && c.consumerKey != "" && c.consumerSecret != ""
}

func (c *WooCommerceClient) baseURL() string {
	return c.siteURL + "/wp-json/wc/v3"
}

// ExportProducts exports products to WooCommerce
func (c *WooCommerceClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusRunning, TotalItems: len(products), StartedAt: time.Now(),
	}

	for _, p := range products {
		if err := c.createOrUpdateProduct(ctx, p); err != nil {
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
	return result, nil
}

func (c *WooCommerceClient) createOrUpdateProduct(ctx context.Context, p *marketplace.Product) error {
	// Check if product exists by SKU
	existingID, _ := c.findProductBySKU(ctx, p.SKU)

	wooProduct := map[string]interface{}{
		"name":              p.Name,
		"type":              "simple",
		"status":            "publish",
		"description":       p.Description,
		"short_description": truncate(p.Description, 400),
		"sku":               p.SKU,
		"regular_price":     fmt.Sprintf("%.2f", p.Price),
		"manage_stock":      true,
		"stock_quantity":    p.Quantity,
		"stock_status":      stockStatus(p.Quantity),
		"weight":            fmt.Sprintf("%.2f", p.Weight),
	}

	// Sale price
	if p.OldPrice > p.Price {
		wooProduct["regular_price"] = fmt.Sprintf("%.2f", p.OldPrice)
		wooProduct["sale_price"] = fmt.Sprintf("%.2f", p.Price)
	}

	// Images
	if len(p.Images) > 0 {
		images := make([]map[string]interface{}, 0)
		for _, img := range p.Images {
			images = append(images, map[string]interface{}{"src": img})
		}
		wooProduct["images"] = images
	}

	// Categories
	if p.CategoryID != "" {
		wooProduct["categories"] = []map[string]interface{}{
			{"id": p.CategoryID},
		}
	}

	// Attributes
	if len(p.Attributes) > 0 {
		attrs := make([]map[string]interface{}, 0)
		for name, value := range p.Attributes {
			attrs = append(attrs, map[string]interface{}{
				"name":    name,
				"options": []string{value},
				"visible": true,
			})
		}
		wooProduct["attributes"] = attrs
	}

	var err error
	if existingID != "" {
		_, err = c.doRequest(ctx, "PUT", "/products/"+existingID, wooProduct)
	} else {
		_, err = c.doRequest(ctx, "POST", "/products", wooProduct)
	}

	return err
}

func (c *WooCommerceClient) findProductBySKU(ctx context.Context, sku string) (string, error) {
	resp, err := c.doRequest(ctx, "GET", "/products?sku="+sku, nil)
	if err != nil {
		return "", err
	}

	products, ok := resp["data"].([]interface{})
	if !ok || len(products) == 0 {
		// Try direct response
		if products, ok := resp["products"].([]interface{}); ok && len(products) > 0 {
			pm := products[0].(map[string]interface{})
			return fmt.Sprintf("%.0f", pm["id"].(float64)), nil
		}
		return "", nil
	}

	pm := products[0].(map[string]interface{})
	return fmt.Sprintf("%.0f", pm["id"].(float64)), nil
}

// UpdateProduct updates product
func (c *WooCommerceClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.createOrUpdateProduct(ctx, product)
}

// UpdateStock updates stock
func (c *WooCommerceClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	productID, err := c.findProductBySKU(ctx, sku)
	if err != nil || productID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "PUT", "/products/"+productID, map[string]interface{}{
		"stock_quantity": quantity,
		"stock_status":   stockStatus(quantity),
	})
	return err
}

// UpdatePrice updates price
func (c *WooCommerceClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	productID, err := c.findProductBySKU(ctx, sku)
	if err != nil || productID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "PUT", "/products/"+productID, map[string]interface{}{
		"regular_price": fmt.Sprintf("%.2f", price),
	})
	return err
}

// DeleteProduct deletes product
func (c *WooCommerceClient) DeleteProduct(ctx context.Context, sku string) error {
	productID, err := c.findProductBySKU(ctx, sku)
	if err != nil || productID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "DELETE", "/products/"+productID+"?force=true", nil)
	return err
}

// ImportOrders imports orders
func (c *WooCommerceClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	resp, err := c.doRequest(ctx, "GET", fmt.Sprintf("/orders?after=%s&per_page=100",
		since.Format(time.RFC3339)), nil)
	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["data"].([]interface{})
	if !ok {
		// Try direct array response
		respBytes, _ := json.Marshal(resp)
		var ordersArray []interface{}
		if json.Unmarshal(respBytes, &ordersArray) == nil {
			ordersData = ordersArray
		}
	}

	if ordersData == nil {
		return nil, nil
	}

	orders := make([]*marketplace.Order, 0)
	for _, od := range ordersData {
		om := od.(map[string]interface{})
		order := c.mapOrder(om)
		orders = append(orders, order)
	}

	return orders, nil
}

func (c *WooCommerceClient) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%.0f", data["id"].(float64)),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["status"]),
	}

	if total, ok := data["total"].(string); ok {
		fmt.Sscanf(total, "%f", &order.Total)
	}

	if billing, ok := data["billing"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v %v", billing["first_name"], billing["last_name"])
		order.CustomerEmail = fmt.Sprintf("%v", billing["email"])
		order.CustomerPhone = fmt.Sprintf("%v", billing["phone"])
	}

	if shipping, ok := data["shipping"].(map[string]interface{}); ok {
		order.DeliveryCity = fmt.Sprintf("%v", shipping["city"])
		order.DeliveryAddress = fmt.Sprintf("%v, %v", shipping["address_1"], shipping["address_2"])
	}

	if items, ok := data["line_items"].([]interface{}); ok {
		for _, item := range items {
			im := item.(map[string]interface{})
			orderItem := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%.0f", im["id"].(float64)),
				SKU:        fmt.Sprintf("%v", im["sku"]),
				Name:       fmt.Sprintf("%v", im["name"]),
				Quantity:   int(im["quantity"].(float64)),
			}
			if price, ok := im["price"].(float64); ok {
				orderItem.Price = price
			}
			orderItem.Total = orderItem.Price * float64(orderItem.Quantity)
			order.Items = append(order.Items, orderItem)
		}
	}

	if created, ok := data["date_created"].(string); ok {
		order.CreatedAt, _ = time.Parse("2006-01-02T15:04:05", created)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *WooCommerceClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := c.doRequest(ctx, "PUT", "/orders/"+orderID, map[string]interface{}{
		"status": status,
	})
	return err
}

// AddOrderNote adds note to order
func (c *WooCommerceClient) AddOrderNote(ctx context.Context, orderID, note string, customerNote bool) error {
	_, err := c.doRequest(ctx, "POST", "/orders/"+orderID+"/notes", map[string]interface{}{
		"note":          note,
		"customer_note": customerNote,
	})
	return err
}

// GetCategories returns categories
func (c *WooCommerceClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/products/categories?per_page=100", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["data"].([]interface{})
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
		if parentID, ok := cm["parent"].(float64); ok && parentID > 0 {
			cat.ParentID = fmt.Sprintf("%.0f", parentID)
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// GenerateFeed not applicable
func (c *WooCommerceClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

// CreateWebhook registers webhook
func (c *WooCommerceClient) CreateWebhook(ctx context.Context, topic, deliveryURL string) error {
	_, err := c.doRequest(ctx, "POST", "/webhooks", map[string]interface{}{
		"name":         topic + " webhook",
		"topic":        topic,
		"delivery_url": deliveryURL,
		"status":       "active",
	})
	return err
}

func (c *WooCommerceClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, c.baseURL()+path, reqBody)

	// Basic auth
	auth := base64.StdEncoding.EncodeToString([]byte(c.consumerKey + ":" + c.consumerSecret))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return nil, marketplace.ErrRateLimited
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("WooCommerce API error %d: %s", resp.StatusCode, string(body))
	}

	if resp.StatusCode == 204 {
		return nil, nil
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func stockStatus(quantity int) string {
	if quantity > 0 {
		return "instock"
	}
	return "outofstock"
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
