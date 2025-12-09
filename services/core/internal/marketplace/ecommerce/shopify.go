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

// ShopifyClient implements Shopify API integration
type ShopifyClient struct {
	config     *marketplace.Config
	httpClient *http.Client
	shopDomain string
	apiVersion string
}

// NewShopifyClient creates Shopify client
func NewShopifyClient() *ShopifyClient {
	return &ShopifyClient{
		httpClient: &http.Client{Timeout: 60 * time.Second},
		apiVersion: "2024-01",
	}
}

// Type returns type
func (c *ShopifyClient) Type() marketplace.MarketplaceType { return "shopify" }

// Configure configures
func (c *ShopifyClient) Configure(config *marketplace.Config) error {
	c.config = config
	c.shopDomain = config.ShopID // myshop.myshopify.com
	return nil
}

// IsConfigured returns if configured
func (c *ShopifyClient) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != "" && c.shopDomain != ""
}

func (c *ShopifyClient) baseURL() string {
	return fmt.Sprintf("https://%s/admin/api/%s", c.shopDomain, c.apiVersion)
}

// ExportProducts exports products to Shopify
func (c *ShopifyClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
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

func (c *ShopifyClient) createOrUpdateProduct(ctx context.Context, p *marketplace.Product) error {
	// Check if product exists by SKU
	existingID, _ := c.findProductBySKU(ctx, p.SKU)

	shopifyProduct := map[string]interface{}{
		"product": map[string]interface{}{
			"title":        p.Name,
			"body_html":    p.Description,
			"vendor":       p.Brand,
			"product_type": p.CategoryID,
			"status":       "active",
			"variants": []map[string]interface{}{
				{
					"sku":                 p.SKU,
					"price":               fmt.Sprintf("%.2f", p.Price),
					"compare_at_price":    formatComparePrice(p.OldPrice, p.Price),
					"inventory_quantity":  p.Quantity,
					"inventory_management": "shopify",
					"weight":              p.Weight,
					"weight_unit":         "kg",
					"barcode":             p.Barcode,
				},
			},
		},
	}

	// Add images
	if len(p.Images) > 0 {
		images := make([]map[string]interface{}, 0)
		for i, img := range p.Images {
			images = append(images, map[string]interface{}{
				"src":      img,
				"position": i + 1,
			})
		}
		shopifyProduct["product"].(map[string]interface{})["images"] = images
	}

	// Add tags from attributes
	if len(p.Attributes) > 0 {
		tags := ""
		for name, value := range p.Attributes {
			if tags != "" {
				tags += ", "
			}
			tags += name + ":" + value
		}
		shopifyProduct["product"].(map[string]interface{})["tags"] = tags
	}

	var err error
	if existingID != "" {
		_, err = c.doRequest(ctx, "PUT", "/products/"+existingID+".json", shopifyProduct)
	} else {
		_, err = c.doRequest(ctx, "POST", "/products.json", shopifyProduct)
	}

	return err
}

func (c *ShopifyClient) findProductBySKU(ctx context.Context, sku string) (string, error) {
	resp, err := c.doRequest(ctx, "GET", "/products.json?fields=id,variants&limit=250", nil)
	if err != nil {
		return "", err
	}

	products, ok := resp["products"].([]interface{})
	if !ok {
		return "", nil
	}

	for _, prod := range products {
		pm := prod.(map[string]interface{})
		variants, ok := pm["variants"].([]interface{})
		if !ok {
			continue
		}
		for _, v := range variants {
			vm := v.(map[string]interface{})
			if vm["sku"] == sku {
				return fmt.Sprintf("%.0f", pm["id"].(float64)), nil
			}
		}
	}

	return "", nil
}

// UpdateProduct updates product
func (c *ShopifyClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.createOrUpdateProduct(ctx, product)
}

// UpdateStock updates inventory
func (c *ShopifyClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	// Find inventory item ID by SKU
	inventoryItemID, locationID, err := c.findInventoryItemBySKU(ctx, sku)
	if err != nil || inventoryItemID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "POST", "/inventory_levels/set.json", map[string]interface{}{
		"inventory_item_id": inventoryItemID,
		"location_id":       locationID,
		"available":         quantity,
	})
	return err
}

func (c *ShopifyClient) findInventoryItemBySKU(ctx context.Context, sku string) (string, string, error) {
	// Get locations
	locResp, err := c.doRequest(ctx, "GET", "/locations.json", nil)
	if err != nil {
		return "", "", err
	}

	locations := locResp["locations"].([]interface{})
	if len(locations) == 0 {
		return "", "", fmt.Errorf("no locations found")
	}
	locationID := fmt.Sprintf("%.0f", locations[0].(map[string]interface{})["id"].(float64))

	// Find variant by SKU
	resp, err := c.doRequest(ctx, "GET", "/products.json?fields=id,variants&limit=250", nil)
	if err != nil {
		return "", "", err
	}

	products := resp["products"].([]interface{})
	for _, prod := range products {
		pm := prod.(map[string]interface{})
		variants := pm["variants"].([]interface{})
		for _, v := range variants {
			vm := v.(map[string]interface{})
			if vm["sku"] == sku {
				return fmt.Sprintf("%.0f", vm["inventory_item_id"].(float64)), locationID, nil
			}
		}
	}

	return "", "", nil
}

// UpdatePrice updates price
func (c *ShopifyClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	variantID, err := c.findVariantBySKU(ctx, sku)
	if err != nil || variantID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "PUT", "/variants/"+variantID+".json", map[string]interface{}{
		"variant": map[string]interface{}{
			"id":    variantID,
			"price": fmt.Sprintf("%.2f", price),
		},
	})
	return err
}

func (c *ShopifyClient) findVariantBySKU(ctx context.Context, sku string) (string, error) {
	resp, err := c.doRequest(ctx, "GET", "/products.json?fields=id,variants&limit=250", nil)
	if err != nil {
		return "", err
	}

	products := resp["products"].([]interface{})
	for _, prod := range products {
		pm := prod.(map[string]interface{})
		variants := pm["variants"].([]interface{})
		for _, v := range variants {
			vm := v.(map[string]interface{})
			if vm["sku"] == sku {
				return fmt.Sprintf("%.0f", vm["id"].(float64)), nil
			}
		}
	}

	return "", nil
}

// DeleteProduct deletes product
func (c *ShopifyClient) DeleteProduct(ctx context.Context, sku string) error {
	productID, err := c.findProductBySKU(ctx, sku)
	if err != nil || productID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "DELETE", "/products/"+productID+".json", nil)
	return err
}

// ImportOrders imports orders
func (c *ShopifyClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	resp, err := c.doRequest(ctx, "GET", fmt.Sprintf("/orders.json?created_at_min=%s&status=any",
		since.Format(time.RFC3339)), nil)
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

func (c *ShopifyClient) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%.0f", data["id"].(float64)),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["financial_status"]),
	}

	if total, ok := data["total_price"].(string); ok {
		fmt.Sscanf(total, "%f", &order.Total)
	}

	if customer, ok := data["customer"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v %v", customer["first_name"], customer["last_name"])
		order.CustomerEmail = fmt.Sprintf("%v", customer["email"])
		order.CustomerPhone = fmt.Sprintf("%v", customer["phone"])
	}

	if shipping, ok := data["shipping_address"].(map[string]interface{}); ok {
		order.DeliveryCity = fmt.Sprintf("%v", shipping["city"])
		order.DeliveryAddress = fmt.Sprintf("%v, %v", shipping["address1"], shipping["address2"])
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
			if price, ok := im["price"].(string); ok {
				fmt.Sscanf(price, "%f", &orderItem.Price)
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
func (c *ShopifyClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil // Use fulfillment API
}

// FulfillOrder creates fulfillment
func (c *ShopifyClient) FulfillOrder(ctx context.Context, orderID, trackingNumber, carrier, trackingURL string) error {
	_, err := c.doRequest(ctx, "POST", "/orders/"+orderID+"/fulfillments.json", map[string]interface{}{
		"fulfillment": map[string]interface{}{
			"tracking_number":  trackingNumber,
			"tracking_company": carrier,
			"tracking_url":     trackingURL,
			"notify_customer":  true,
		},
	})
	return err
}

// GetCategories returns collections
func (c *ShopifyClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/custom_collections.json", nil)
	if err != nil {
		return nil, err
	}

	collectionsData, ok := resp["custom_collections"].([]interface{})
	if !ok {
		return nil, nil
	}

	categories := make([]marketplace.Category, 0)
	for _, cd := range collectionsData {
		cm := cd.(map[string]interface{})
		cat := marketplace.Category{
			ID:   fmt.Sprintf("%.0f", cm["id"].(float64)),
			Name: fmt.Sprintf("%v", cm["title"]),
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// GenerateFeed not applicable - uses API
func (c *ShopifyClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

// CreateWebhook registers webhook
func (c *ShopifyClient) CreateWebhook(ctx context.Context, topic, address string) error {
	_, err := c.doRequest(ctx, "POST", "/webhooks.json", map[string]interface{}{
		"webhook": map[string]interface{}{
			"topic":   topic,
			"address": address,
			"format":  "json",
		},
	})
	return err
}

func (c *ShopifyClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, c.baseURL()+path, reqBody)
	req.Header.Set("X-Shopify-Access-Token", c.config.AccessToken)
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
		return nil, fmt.Errorf("Shopify API error %d: %s", resp.StatusCode, string(body))
	}

	if resp.StatusCode == 204 {
		return nil, nil
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func formatComparePrice(oldPrice, currentPrice float64) string {
	if oldPrice > currentPrice {
		return fmt.Sprintf("%.2f", oldPrice)
	}
	return ""
}
