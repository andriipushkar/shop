package ecommerce

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"core/internal/marketplace"
)

// OpenCartClient implements OpenCart API integration
type OpenCartClient struct {
	config     *marketplace.Config
	httpClient *http.Client
	siteURL    string
	apiToken   string
}

// NewOpenCartClient creates OpenCart client
func NewOpenCartClient() *OpenCartClient {
	return &OpenCartClient{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns type
func (c *OpenCartClient) Type() marketplace.MarketplaceType { return "opencart" }

// Configure configures
func (c *OpenCartClient) Configure(config *marketplace.Config) error {
	c.config = config
	c.siteURL = config.ShopID       // https://example.com
	c.apiToken = config.AccessToken // API token from OpenCart
	return nil
}

// IsConfigured returns if configured
func (c *OpenCartClient) IsConfigured() bool {
	return c.config != nil && c.siteURL != "" && c.apiToken != ""
}

func (c *OpenCartClient) baseURL() string {
	return c.siteURL + "/index.php?route=api"
}

// Login authenticates and gets session token
func (c *OpenCartClient) Login(ctx context.Context) error {
	resp, err := c.doRequest(ctx, "POST", "/login", map[string]interface{}{
		"username": c.config.APIKey,
		"key":      c.config.APISecret,
	})
	if err != nil {
		return err
	}

	if token, ok := resp["api_token"].(string); ok {
		c.apiToken = token
	}
	return nil
}

// ExportProducts exports products to OpenCart
func (c *OpenCartClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
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

func (c *OpenCartClient) createOrUpdateProduct(ctx context.Context, p *marketplace.Product) error {
	// Check if product exists by model (SKU)
	existingID, _ := c.findProductByModel(ctx, p.SKU)

	ocProduct := map[string]interface{}{
		"model":       p.SKU,
		"sku":         p.SKU,
		"upc":         p.Barcode,
		"price":       p.Price,
		"quantity":    p.Quantity,
		"minimum":     1,
		"subtract":    1,
		"stock_status_id": stockStatusID(p.Quantity),
		"shipping":    1,
		"weight":      p.Weight,
		"weight_class_id": 1, // kg
		"status":      1,
		"sort_order":  0,
		"manufacturer": p.Brand,
		"product_description": []map[string]interface{}{
			{
				"language_id": 1,
				"name":        p.Name,
				"description": p.Description,
				"meta_title":  p.Name,
				"meta_description": truncateOC(p.Description, 160),
				"meta_keyword": "",
				"tag":         "",
			},
		},
	}

	// Special price (discount)
	if p.OldPrice > p.Price {
		ocProduct["price"] = p.OldPrice
		ocProduct["product_special"] = []map[string]interface{}{
			{
				"customer_group_id": 1,
				"priority":          1,
				"price":             p.Price,
				"date_start":        "",
				"date_end":          "",
			},
		}
	}

	// Images
	if len(p.Images) > 0 {
		ocProduct["image"] = p.Images[0]
		if len(p.Images) > 1 {
			additionalImages := make([]map[string]interface{}, 0)
			for i, img := range p.Images[1:] {
				additionalImages = append(additionalImages, map[string]interface{}{
					"image":      img,
					"sort_order": i + 1,
				})
			}
			ocProduct["product_image"] = additionalImages
		}
	}

	// Categories
	if p.CategoryID != "" {
		ocProduct["product_category"] = []string{p.CategoryID}
	}

	// Attributes
	if len(p.Attributes) > 0 {
		attrs := make([]map[string]interface{}, 0)
		for name, value := range p.Attributes {
			attrs = append(attrs, map[string]interface{}{
				"attribute_id": name, // Should be mapped to actual attribute IDs
				"product_attribute_description": []map[string]interface{}{
					{
						"language_id": 1,
						"text":        value,
					},
				},
			})
		}
		ocProduct["product_attribute"] = attrs
	}

	var err error
	if existingID != "" {
		ocProduct["product_id"] = existingID
		_, err = c.doRequest(ctx, "POST", "/product/edit", ocProduct)
	} else {
		_, err = c.doRequest(ctx, "POST", "/product/add", ocProduct)
	}

	return err
}

func (c *OpenCartClient) findProductByModel(ctx context.Context, model string) (string, error) {
	resp, err := c.doRequest(ctx, "GET", "/product/getProducts&filter_model="+model, nil)
	if err != nil {
		return "", err
	}

	products, ok := resp["products"].([]interface{})
	if !ok || len(products) == 0 {
		return "", nil
	}

	pm := products[0].(map[string]interface{})
	return fmt.Sprintf("%.0f", pm["product_id"].(float64)), nil
}

// UpdateProduct updates product
func (c *OpenCartClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.createOrUpdateProduct(ctx, product)
}

// UpdateStock updates stock
func (c *OpenCartClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	productID, err := c.findProductByModel(ctx, sku)
	if err != nil || productID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "POST", "/product/edit", map[string]interface{}{
		"product_id":      productID,
		"quantity":        quantity,
		"stock_status_id": stockStatusID(quantity),
	})
	return err
}

// UpdatePrice updates price
func (c *OpenCartClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	productID, err := c.findProductByModel(ctx, sku)
	if err != nil || productID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "POST", "/product/edit", map[string]interface{}{
		"product_id": productID,
		"price":      price,
	})
	return err
}

// DeleteProduct deletes product
func (c *OpenCartClient) DeleteProduct(ctx context.Context, sku string) error {
	productID, err := c.findProductByModel(ctx, sku)
	if err != nil || productID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "POST", "/product/delete", map[string]interface{}{
		"selected": []string{productID},
	})
	return err
}

// ImportOrders imports orders
func (c *OpenCartClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	resp, err := c.doRequest(ctx, "GET", fmt.Sprintf("/sale/order&filter_date_added=%s",
		since.Format("2006-01-02")), nil)
	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["orders"].([]interface{})
	if !ok {
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

func (c *OpenCartClient) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%v", data["order_id"]),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["order_status"]),
	}

	if total, ok := data["total"].(float64); ok {
		order.Total = total
	} else if total, ok := data["total"].(string); ok {
		fmt.Sscanf(total, "%f", &order.Total)
	}

	order.CustomerName = fmt.Sprintf("%v %v", data["firstname"], data["lastname"])
	order.CustomerEmail = fmt.Sprintf("%v", data["email"])
	order.CustomerPhone = fmt.Sprintf("%v", data["telephone"])
	order.DeliveryCity = fmt.Sprintf("%v", data["shipping_city"])
	order.DeliveryAddress = fmt.Sprintf("%v, %v", data["shipping_address_1"], data["shipping_address_2"])

	// Get order products
	if products, ok := data["products"].([]interface{}); ok {
		for _, item := range products {
			im := item.(map[string]interface{})
			orderItem := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%v", im["order_product_id"]),
				SKU:        fmt.Sprintf("%v", im["model"]),
				Name:       fmt.Sprintf("%v", im["name"]),
				Quantity:   int(im["quantity"].(float64)),
			}
			if price, ok := im["price"].(float64); ok {
				orderItem.Price = price
			} else if price, ok := im["price"].(string); ok {
				fmt.Sscanf(price, "%f", &orderItem.Price)
			}
			orderItem.Total = orderItem.Price * float64(orderItem.Quantity)
			order.Items = append(order.Items, orderItem)
		}
	}

	if created, ok := data["date_added"].(string); ok {
		order.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", created)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *OpenCartClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	statusID := mapOrderStatus(status)

	_, err := c.doRequest(ctx, "POST", "/sale/order/addHistory", map[string]interface{}{
		"order_id":        orderID,
		"order_status_id": statusID,
		"notify":          1,
		"comment":         "",
	})
	return err
}

// GetCategories returns categories
func (c *OpenCartClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/catalog/category&limit=1000", nil)
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
			ID:   fmt.Sprintf("%.0f", cm["category_id"].(float64)),
			Name: fmt.Sprintf("%v", cm["name"]),
		}
		if parentID, ok := cm["parent_id"].(float64); ok && parentID > 0 {
			cat.ParentID = fmt.Sprintf("%.0f", parentID)
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// GenerateFeed generates OpenCart export feed
func (c *OpenCartClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	// OpenCart uses its own export format or Google Shopping XML
	return nil, nil
}

// BulkUpdateStock updates multiple products stock at once
func (c *OpenCartClient) BulkUpdateStock(ctx context.Context, updates map[string]int) error {
	for sku, quantity := range updates {
		if err := c.UpdateStock(ctx, sku, quantity); err != nil {
			return err
		}
	}
	return nil
}

func (c *OpenCartClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	fullURL := c.baseURL() + path
	if c.apiToken != "" {
		separator := "&"
		if !containsQuery(path) {
			separator = "?"
		}
		fullURL += separator + "api_token=" + c.apiToken
	}

	req, _ := http.NewRequestWithContext(ctx, method, fullURL, reqBody)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenCart API error %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	// Check for error in response
	if errMsg, ok := result["error"].(string); ok && errMsg != "" {
		return nil, fmt.Errorf("OpenCart API error: %s", errMsg)
	}

	return result, nil
}

func stockStatusID(quantity int) int {
	if quantity > 0 {
		return 7 // In Stock
	}
	return 5 // Out Of Stock
}

func mapOrderStatus(status string) int {
	statusMap := map[string]int{
		"pending":    1,
		"processing": 2,
		"shipped":    3,
		"complete":   5,
		"cancelled":  7,
		"refunded":   11,
	}
	if id, ok := statusMap[status]; ok {
		return id
	}
	return 1
}

func containsQuery(path string) bool {
	for _, c := range path {
		if c == '?' || c == '&' {
			return true
		}
	}
	return false
}

func truncateOC(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
