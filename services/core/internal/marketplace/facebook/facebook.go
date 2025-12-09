package facebook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"core/internal/marketplace"
	"core/internal/marketplace/feeds"
)

const (
	graphAPIURL = "https://graph.facebook.com/v18.0"
)

// Client implements Facebook Commerce / Instagram Shopping integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.FacebookCatalogFeed
	catalogID  string
}

// New creates a new Facebook Commerce client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceFacebook
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	c.catalogID = config.ShopID

	c.feedGen = feeds.NewFacebookFeedGenerator(config.BaseURL, "UAH")

	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != "" && c.catalogID != ""
}

// ExportProducts exports products to Facebook Catalog
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceFacebook,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Facebook Catalog API supports batch operations
	batchSize := 100
	for i := 0; i < len(products); i += batchSize {
		end := i + batchSize
		if end > len(products) {
			end = len(products)
		}
		batch := products[i:end]

		requests := make([]map[string]interface{}, 0, len(batch))
		for _, p := range batch {
			item := c.mapProductToFacebook(p)
			requests = append(requests, map[string]interface{}{
				"method":       "UPDATE",
				"retailer_id":  p.SKU,
				"data":         item,
			})
		}

		resp, err := c.doRequest(ctx, "POST",
			fmt.Sprintf("/%s/batch", c.catalogID),
			map[string]interface{}{
				"requests": requests,
			})

		if err != nil {
			for _, p := range batch {
				result.FailedItems++
				result.Errors = append(result.Errors, marketplace.SyncError{
					SKU:     p.SKU,
					Message: err.Error(),
				})
			}
		} else {
			// Parse response
			if handles, ok := resp["handles"].([]interface{}); ok {
				// Handles are returned, need to check status later
				result.SuccessItems += len(handles)
			}
			if errors, ok := resp["errors"].([]interface{}); ok {
				for _, e := range errors {
					em := e.(map[string]interface{})
					result.FailedItems++
					result.Errors = append(result.Errors, marketplace.SyncError{
						SKU:     fmt.Sprintf("%v", em["retailer_id"]),
						Message: fmt.Sprintf("%v", em["message"]),
					})
				}
			}
		}
		result.ProcessedItems += len(batch)
	}

	now := time.Now()
	result.CompletedAt = &now
	result.Status = marketplace.SyncStatusCompleted
	if result.FailedItems > 0 && result.SuccessItems == 0 {
		result.Status = marketplace.SyncStatusFailed
	}

	return result, nil
}

func (c *Client) mapProductToFacebook(p *marketplace.Product) map[string]interface{} {
	product := map[string]interface{}{
		"id":              p.SKU,
		"title":           truncate(p.Name, 200),
		"description":     truncate(p.Description, 9999),
		"link":            p.URL,
		"price":           fmt.Sprintf("%d UAH", int(p.Price*100)), // Price in cents
		"condition":       "new",
		"brand":           p.Brand,
		"item_group_id":   p.CategoryID,
		"product_type":    p.CategoryPath,
	}

	// Availability
	if p.IsAvailable && p.Quantity > 0 {
		product["availability"] = "in stock"
	} else {
		product["availability"] = "out of stock"
	}

	// Sale price
	if p.OldPrice > p.Price {
		product["sale_price"] = fmt.Sprintf("%d UAH", int(p.Price*100))
		product["price"] = fmt.Sprintf("%d UAH", int(p.OldPrice*100))
	}

	// Images
	if len(p.Images) > 0 {
		product["image_link"] = p.Images[0]
		if len(p.Images) > 1 {
			// Facebook supports up to 10 additional images
			additional := p.Images[1:]
			if len(additional) > 10 {
				additional = additional[:10]
			}
			product["additional_image_link"] = strings.Join(additional, ",")
		}
	}

	// Inventory
	product["inventory"] = p.Quantity

	// Shipping weight
	if p.Weight > 0 {
		product["shipping_weight"] = map[string]interface{}{
			"value": p.Weight,
			"unit":  "kg",
		}
	}

	// Custom labels for filtering
	if len(p.Attributes) > 0 {
		idx := 0
		for name, value := range p.Attributes {
			if idx < 5 { // Facebook supports custom_label_0 through custom_label_4
				product[fmt.Sprintf("custom_label_%d", idx)] = fmt.Sprintf("%s: %s", name, value)
				idx++
			}
		}
	}

	return product
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	data := c.mapProductToFacebook(product)
	_, err := c.doRequest(ctx, "POST",
		fmt.Sprintf("/%s/products", c.catalogID),
		map[string]interface{}{
			"requests": []map[string]interface{}{
				{
					"method":      "UPDATE",
					"retailer_id": product.SKU,
					"data":        data,
				},
			},
		})
	return err
}

// UpdateStock updates product availability
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	availability := "out of stock"
	if quantity > 0 {
		availability = "in stock"
	}

	_, err := c.doRequest(ctx, "POST",
		fmt.Sprintf("/%s/products", c.catalogID),
		map[string]interface{}{
			"requests": []map[string]interface{}{
				{
					"method":      "UPDATE",
					"retailer_id": sku,
					"data": map[string]interface{}{
						"availability": availability,
						"inventory":    quantity,
					},
				},
			},
		})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "POST",
		fmt.Sprintf("/%s/products", c.catalogID),
		map[string]interface{}{
			"requests": []map[string]interface{}{
				{
					"method":      "UPDATE",
					"retailer_id": sku,
					"data": map[string]interface{}{
						"price": fmt.Sprintf("%d UAH", int(price*100)),
					},
				},
			},
		})
	return err
}

// DeleteProduct deletes a product from catalog
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "POST",
		fmt.Sprintf("/%s/products", c.catalogID),
		map[string]interface{}{
			"requests": []map[string]interface{}{
				{
					"method":      "DELETE",
					"retailer_id": sku,
				},
			},
		})
	return err
}

// ImportOrders imports orders from Facebook/Instagram shops
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	// Get commerce account orders
	params := url.Values{}
	params.Set("fields", "id,buyer_details,channel,created,items,ship_by_date,state")
	params.Set("since", fmt.Sprintf("%d", since.Unix()))

	resp, err := c.doRequest(ctx, "GET",
		fmt.Sprintf("/%s/commerce_orders?%s", c.config.ShopID, params.Encode()),
		nil)
	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["data"].([]interface{})
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
		ExternalID:  fmt.Sprintf("%v", data["id"]),
		Marketplace: marketplace.MarketplaceFacebook,
		Status:      fmt.Sprintf("%v", data["state"]),
	}

	if buyer, ok := data["buyer_details"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", buyer["name"])
		if email, ok := buyer["email"].(string); ok {
			order.CustomerEmail = email
		}
	}

	// Shipping details would be in separate API call
	if channel, ok := data["channel"].(string); ok {
		if channel == "instagram" {
			order.Comment = "Instagram Shop"
		} else {
			order.Comment = "Facebook Shop"
		}
	}

	if items, ok := data["items"].(map[string]interface{}); ok {
		if itemData, ok := items["data"].([]interface{}); ok {
			for _, id := range itemData {
				im := id.(map[string]interface{})
				item := marketplace.OrderItem{
					ExternalID: fmt.Sprintf("%v", im["id"]),
					Name:       fmt.Sprintf("%v", im["product_name"]),
					Quantity:   int(im["quantity"].(float64)),
				}
				if price, ok := im["price_per_unit"].(map[string]interface{}); ok {
					item.Price = price["amount"].(float64) / 100 // Convert from cents
				}
				item.Total = item.Price * float64(item.Quantity)
				order.Items = append(order.Items, item)
				order.Total += item.Total
			}
		}
	}

	if created, ok := data["created"].(string); ok {
		order.CreatedAt, _ = time.Parse(time.RFC3339, created)
	}

	return order
}

// UpdateOrderStatus updates order fulfillment status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	// Map status to Facebook commerce states
	fbState := "IN_PROGRESS"
	switch status {
	case "shipped":
		fbState = "SHIPPED"
	case "delivered":
		fbState = "COMPLETED"
	case "cancelled":
		fbState = "CANCELLED"
	case "refunded":
		fbState = "REFUNDED"
	}

	_, err := c.doRequest(ctx, "POST",
		fmt.Sprintf("/%s", orderID),
		map[string]interface{}{
			"state": fbState,
		})
	return err
}

// SetFulfillment sets shipping/fulfillment info for order
func (c *Client) SetFulfillment(ctx context.Context, orderID string, fulfillment FulfillmentInfo) error {
	_, err := c.doRequest(ctx, "POST",
		fmt.Sprintf("/%s/shipments", orderID),
		map[string]interface{}{
			"tracking_info": map[string]interface{}{
				"tracking_number": fulfillment.TrackingNumber,
				"carrier":         fulfillment.Carrier,
			},
			"fulfillment": map[string]interface{}{
				"fulfillment_location_id": fulfillment.LocationID,
			},
		})
	return err
}

// FulfillmentInfo contains shipping information
type FulfillmentInfo struct {
	TrackingNumber string
	Carrier        string
	LocationID     string
}

// GetCategories returns Facebook product categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET",
		fmt.Sprintf("/%s/product_categories", c.catalogID),
		nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	categories := make([]marketplace.Category, 0, len(catsData))
	for _, cd := range catsData {
		cm := cd.(map[string]interface{})
		cat := marketplace.Category{
			ID:   fmt.Sprintf("%v", cm["id"]),
			Name: fmt.Sprintf("%v", cm["name"]),
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// GenerateFeed generates Facebook Catalog CSV feed
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.feedGen.GenerateCSV(products)
}

// GetCatalogInfo returns catalog information
func (c *Client) GetCatalogInfo(ctx context.Context) (map[string]interface{}, error) {
	return c.doRequest(ctx, "GET",
		fmt.Sprintf("/%s?fields=id,name,product_count", c.catalogID),
		nil)
}

// CreatePixelEvent sends conversion event to Facebook Pixel
func (c *Client) CreatePixelEvent(ctx context.Context, pixelID string, event PixelEvent) error {
	_, err := c.doRequest(ctx, "POST",
		fmt.Sprintf("/%s/events", pixelID),
		map[string]interface{}{
			"data": []map[string]interface{}{
				{
					"event_name":  event.EventName,
					"event_time":  event.EventTime.Unix(),
					"action_source": "website",
					"user_data": map[string]interface{}{
						"em":    event.UserEmail,
						"ph":    event.UserPhone,
						"client_ip_address": event.ClientIP,
						"client_user_agent": event.UserAgent,
					},
					"custom_data": event.CustomData,
				},
			},
		})
	return err
}

// PixelEvent represents a Facebook Pixel event
type PixelEvent struct {
	EventName  string
	EventTime  time.Time
	UserEmail  string
	UserPhone  string
	ClientIP   string
	UserAgent  string
	CustomData map[string]interface{}
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

	urlStr := graphAPIURL + path
	if !strings.Contains(path, "?") {
		urlStr += "?access_token=" + c.config.AccessToken
	} else {
		urlStr += "&access_token=" + c.config.AccessToken
	}

	req, err := http.NewRequestWithContext(ctx, method, urlStr, reqBody)
	if err != nil {
		return nil, err
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return nil, marketplace.ErrRateLimited
	}

	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return nil, marketplace.ErrAuthentication
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Check for Facebook API error
	if errorInfo, ok := result["error"].(map[string]interface{}); ok {
		return nil, fmt.Errorf("Facebook API error: %v", errorInfo["message"])
	}

	return result, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
