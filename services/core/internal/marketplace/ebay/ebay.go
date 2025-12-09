package ebay

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
	apiURL     = "https://api.ebay.com"
	sandboxURL = "https://api.sandbox.ebay.com"
)

// Client implements eBay API integration
type Client struct {
	config       *marketplace.Config
	httpClient   *http.Client
	accessToken  string
	tokenExpires time.Time
	sandbox      bool
}

// New creates a new eBay client
func New(sandbox bool) *Client {
	return &Client{
		sandbox:    sandbox,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "ebay"
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	return nil
}

// IsConfigured returns true if configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.ClientID != "" && c.config.APISecret != ""
}

// refreshToken refreshes OAuth token
func (c *Client) refreshToken(ctx context.Context) error {
	if c.accessToken != "" && time.Now().Before(c.tokenExpires) {
		return nil
	}

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", c.config.RefreshToken)

	baseURL := apiURL
	if c.sandbox {
		baseURL = sandboxURL
	}

	req, _ := http.NewRequestWithContext(ctx, "POST", baseURL+"/identity/v1/oauth2/token",
		bytes.NewBufferString(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(c.config.ClientID, c.config.APISecret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return err
	}

	c.accessToken = tokenResp.AccessToken
	c.tokenExpires = time.Now().Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second)

	return nil
}

// ExportProducts exports products to eBay
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(),
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	if err := c.refreshToken(ctx); err != nil {
		result.Status = marketplace.SyncStatusFailed
		result.Errors = append(result.Errors, marketplace.SyncError{Message: err.Error()})
		now := time.Now()
		result.CompletedAt = &now
		return result, nil
	}

	for _, p := range products {
		if err := c.createOrUpdateListing(ctx, p); err != nil {
			result.FailedItems++
			result.Errors = append(result.Errors, marketplace.SyncError{
				SKU:     p.SKU,
				Message: err.Error(),
			})
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

func (c *Client) createOrUpdateListing(ctx context.Context, p *marketplace.Product) error {
	listing := c.mapProductToEbay(p)

	// Try to update first, create if not exists
	_, err := c.doRequest(ctx, "PUT", "/sell/inventory/v1/inventory_item/"+p.SKU, listing)
	if err != nil {
		// Create new
		_, err = c.doRequest(ctx, "POST", "/sell/inventory/v1/inventory_item/"+p.SKU, listing)
	}

	if err != nil {
		return err
	}

	// Create/update offer
	offer := map[string]interface{}{
		"sku":               p.SKU,
		"marketplaceId":     "EBAY_US",
		"format":            "FIXED_PRICE",
		"availableQuantity": p.Quantity,
		"pricingSummary": map[string]interface{}{
			"price": map[string]interface{}{
				"value":    fmt.Sprintf("%.2f", p.Price),
				"currency": "USD",
			},
		},
		"listingPolicies": map[string]interface{}{
			"fulfillmentPolicyId": c.config.ShopID,
			"paymentPolicyId":     c.config.ShopID,
			"returnPolicyId":      c.config.ShopID,
		},
	}

	_, err = c.doRequest(ctx, "POST", "/sell/inventory/v1/offer", offer)
	return err
}

func (c *Client) mapProductToEbay(p *marketplace.Product) map[string]interface{} {
	listing := map[string]interface{}{
		"availability": map[string]interface{}{
			"shipToLocationAvailability": map[string]interface{}{
				"quantity": p.Quantity,
			},
		},
		"condition": "NEW",
		"product": map[string]interface{}{
			"title":       truncate(p.Name, 80),
			"description": p.Description,
			"brand":       p.Brand,
			"mpn":         p.SKU,
		},
	}

	if len(p.Images) > 0 {
		listing["product"].(map[string]interface{})["imageUrls"] = p.Images
	}

	// Aspects (attributes)
	if len(p.Attributes) > 0 {
		aspects := make(map[string][]string)
		for name, value := range p.Attributes {
			aspects[name] = []string{value}
		}
		listing["product"].(map[string]interface{})["aspects"] = aspects
	}

	return listing
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}
	return c.createOrUpdateListing(ctx, product)
}

// UpdateStock updates product inventory
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "PUT", "/sell/inventory/v1/inventory_item/"+sku,
		map[string]interface{}{
			"availability": map[string]interface{}{
				"shipToLocationAvailability": map[string]interface{}{
					"quantity": quantity,
				},
			},
		})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	// Get offer ID first
	resp, err := c.doRequest(ctx, "GET", "/sell/inventory/v1/offer?sku="+sku, nil)
	if err != nil {
		return err
	}

	offers, ok := resp["offers"].([]interface{})
	if !ok || len(offers) == 0 {
		return marketplace.ErrProductNotFound
	}

	offerID := offers[0].(map[string]interface{})["offerId"].(string)

	_, err = c.doRequest(ctx, "PUT", "/sell/inventory/v1/offer/"+offerID,
		map[string]interface{}{
			"pricingSummary": map[string]interface{}{
				"price": map[string]interface{}{
					"value":    fmt.Sprintf("%.2f", price),
					"currency": "USD",
				},
			},
		})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "DELETE", "/sell/inventory/v1/inventory_item/"+sku, nil)
	return err
}

// ImportOrders imports orders from eBay
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	if err := c.refreshToken(ctx); err != nil {
		return nil, err
	}

	params := url.Values{}
	params.Set("filter", fmt.Sprintf("creationdate:[%s..]", since.Format("2006-01-02T15:04:05.000Z")))

	resp, err := c.doRequest(ctx, "GET", "/sell/fulfillment/v1/order?"+params.Encode(), nil)
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
		order := c.mapOrder(om)
		orders = append(orders, order)
	}

	return orders, nil
}

func (c *Client) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%v", data["orderId"]),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["orderFulfillmentStatus"]),
	}

	if priceSummary, ok := data["pricingSummary"].(map[string]interface{}); ok {
		if total, ok := priceSummary["total"].(map[string]interface{}); ok {
			if val, ok := total["value"].(string); ok {
				fmt.Sscanf(val, "%f", &order.Total)
			}
		}
	}

	if buyer, ok := data["buyer"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", buyer["username"])
	}

	if fulfillment, ok := data["fulfillmentStartInstructions"].([]interface{}); ok && len(fulfillment) > 0 {
		f := fulfillment[0].(map[string]interface{})
		if shippingStep, ok := f["shippingStep"].(map[string]interface{}); ok {
			if shipTo, ok := shippingStep["shipTo"].(map[string]interface{}); ok {
				order.CustomerName = fmt.Sprintf("%v", shipTo["fullName"])
				if addr, ok := shipTo["contactAddress"].(map[string]interface{}); ok {
					order.DeliveryCity = fmt.Sprintf("%v", addr["city"])
					order.DeliveryAddress = fmt.Sprintf("%v", addr["addressLine1"])
				}
				if phone, ok := shipTo["primaryPhone"].(map[string]interface{}); ok {
					order.CustomerPhone = fmt.Sprintf("%v", phone["phoneNumber"])
				}
			}
		}
	}

	if lineItems, ok := data["lineItems"].([]interface{}); ok {
		for _, li := range lineItems {
			lim := li.(map[string]interface{})
			item := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%v", lim["lineItemId"]),
				SKU:        fmt.Sprintf("%v", lim["sku"]),
				Name:       fmt.Sprintf("%v", lim["title"]),
				Quantity:   int(lim["quantity"].(float64)),
			}
			if linePrice, ok := lim["lineItemCost"].(map[string]interface{}); ok {
				if val, ok := linePrice["value"].(string); ok {
					fmt.Sscanf(val, "%f", &item.Price)
				}
			}
			item.Total = item.Price * float64(item.Quantity)
			order.Items = append(order.Items, item)
		}
	}

	if creationDate, ok := data["creationDate"].(string); ok {
		order.CreatedAt, _ = time.Parse(time.RFC3339, creationDate)
	}

	return order
}

// UpdateOrderStatus updates order status (ship confirmation)
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil // Use CreateShippingFulfillment instead
}

// CreateShippingFulfillment marks order as shipped
func (c *Client) CreateShippingFulfillment(ctx context.Context, orderID, trackingNumber, carrier string) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "POST", "/sell/fulfillment/v1/order/"+orderID+"/shipping_fulfillment",
		map[string]interface{}{
			"shippedDate":    time.Now().Format(time.RFC3339),
			"shippingCarrierCode": carrier,
			"trackingNumber": trackingNumber,
		})
	return err
}

// GetCategories returns eBay categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	if err := c.refreshToken(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/commerce/taxonomy/v1/category_tree/0", nil)
	if err != nil {
		return nil, err
	}

	rootNode, ok := resp["rootCategoryNode"].(map[string]interface{})
	if !ok {
		return nil, nil
	}

	return c.parseCategories(rootNode, ""), nil
}

func (c *Client) parseCategories(node map[string]interface{}, parentID string) []marketplace.Category {
	categories := make([]marketplace.Category, 0)

	category, ok := node["category"].(map[string]interface{})
	if ok {
		cat := marketplace.Category{
			ID:       fmt.Sprintf("%v", category["categoryId"]),
			Name:     fmt.Sprintf("%v", category["categoryName"]),
			ParentID: parentID,
		}
		categories = append(categories, cat)

		if children, ok := node["childCategoryTreeNodes"].([]interface{}); ok {
			for _, child := range children {
				childCats := c.parseCategories(child.(map[string]interface{}), cat.ID)
				categories = append(categories, childCats...)
			}
		}
	}

	return categories
}

// GenerateFeed - eBay uses API
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

func (c *Client) getBaseURL() string {
	if c.sandbox {
		return sandboxURL
	}
	return apiURL
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

	req, err := http.NewRequestWithContext(ctx, method, c.getBaseURL()+path, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.accessToken)
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

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
