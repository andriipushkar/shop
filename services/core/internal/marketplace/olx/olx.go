package olx

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
	baseURL     = "https://www.olx.ua/api/partner"
	authURL     = "https://www.olx.ua/api/open/oauth/token"
	userAgent   = "ShopIntegration/1.0"
)

// Client implements OLX API integration
type Client struct {
	config       *marketplace.Config
	httpClient   *http.Client
	accessToken  string
	tokenExpires time.Time
}

// New creates a new OLX client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceOLX
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.ClientID != "" && c.config.APISecret != ""
}

// authenticate performs OAuth2 authentication
func (c *Client) authenticate(ctx context.Context) error {
	if c.accessToken != "" && time.Now().Before(c.tokenExpires) {
		return nil
	}

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", c.config.ClientID)
	data.Set("client_secret", c.config.APISecret)
	data.Set("scope", "read write v2")

	req, err := http.NewRequestWithContext(ctx, "POST", authURL, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("auth failed: %s", string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return err
	}

	c.accessToken = tokenResp.AccessToken
	c.tokenExpires = time.Now().Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second)

	return nil
}

// ExportProducts exports products to OLX
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceOLX,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	if err := c.authenticate(ctx); err != nil {
		result.Status = marketplace.SyncStatusFailed
		result.Errors = append(result.Errors, marketplace.SyncError{Message: err.Error()})
		return result, nil
	}

	for _, p := range products {
		if err := c.exportProduct(ctx, p); err != nil {
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

func (c *Client) exportProduct(ctx context.Context, p *marketplace.Product) error {
	// Check if advert exists
	existing, _ := c.getAdvertByExternalID(ctx, p.SKU)

	advert := c.mapProductToOLX(p)

	if existing != nil {
		// Update existing advert
		return c.updateAdvert(ctx, existing["id"].(float64), advert)
	}

	// Create new advert
	return c.createAdvert(ctx, advert)
}

func (c *Client) mapProductToOLX(p *marketplace.Product) map[string]interface{} {
	advert := map[string]interface{}{
		"title":       truncate(p.Name, 70),
		"description": truncate(p.Description, 9000),
		"category_id": p.CategoryID,
		"price": map[string]interface{}{
			"value":    p.Price,
			"currency": "UAH",
		},
		"external_id": p.SKU,
		"contact": map[string]interface{}{
			"name": "Shop",
		},
	}

	// Images
	if len(p.Images) > 0 {
		images := make([]map[string]string, 0, len(p.Images))
		for _, img := range p.Images {
			images = append(images, map[string]string{"url": img})
		}
		advert["images"] = images
	}

	// Attributes
	if len(p.Attributes) > 0 {
		attrs := make([]map[string]interface{}, 0)
		for name, value := range p.Attributes {
			attrs = append(attrs, map[string]interface{}{
				"code":  name,
				"value": value,
			})
		}
		advert["attributes"] = attrs
	}

	return advert
}

func (c *Client) createAdvert(ctx context.Context, data map[string]interface{}) error {
	_, err := c.doRequest(ctx, "POST", "/adverts", data)
	return err
}

func (c *Client) updateAdvert(ctx context.Context, id float64, data map[string]interface{}) error {
	_, err := c.doRequest(ctx, "PUT", fmt.Sprintf("/adverts/%.0f", id), data)
	return err
}

func (c *Client) getAdvertByExternalID(ctx context.Context, externalID string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("external_id", externalID)

	resp, err := c.doRequest(ctx, "GET", "/adverts?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	adverts, ok := resp["data"].([]interface{})
	if !ok || len(adverts) == 0 {
		return nil, nil
	}

	return adverts[0].(map[string]interface{}), nil
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	if err := c.authenticate(ctx); err != nil {
		return err
	}
	return c.exportProduct(ctx, product)
}

// UpdateStock updates product stock (OLX doesn't have stock, so we activate/deactivate)
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	if err := c.authenticate(ctx); err != nil {
		return err
	}

	existing, err := c.getAdvertByExternalID(ctx, sku)
	if err != nil || existing == nil {
		return marketplace.ErrProductNotFound
	}

	advertID := existing["id"].(float64)

	if quantity <= 0 {
		// Deactivate advert
		_, err = c.doRequest(ctx, "POST", fmt.Sprintf("/adverts/%.0f/deactivate", advertID), nil)
	} else {
		// Activate advert
		_, err = c.doRequest(ctx, "POST", fmt.Sprintf("/adverts/%.0f/activate", advertID), nil)
	}

	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	if err := c.authenticate(ctx); err != nil {
		return err
	}

	existing, err := c.getAdvertByExternalID(ctx, sku)
	if err != nil || existing == nil {
		return marketplace.ErrProductNotFound
	}

	advertID := existing["id"].(float64)
	data := map[string]interface{}{
		"price": map[string]interface{}{
			"value":    price,
			"currency": "UAH",
		},
	}

	_, err = c.doRequest(ctx, "PUT", fmt.Sprintf("/adverts/%.0f", advertID), data)
	return err
}

// DeleteProduct deletes a product (archives advert)
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	if err := c.authenticate(ctx); err != nil {
		return err
	}

	existing, err := c.getAdvertByExternalID(ctx, sku)
	if err != nil || existing == nil {
		return marketplace.ErrProductNotFound
	}

	advertID := existing["id"].(float64)
	_, err = c.doRequest(ctx, "DELETE", fmt.Sprintf("/adverts/%.0f", advertID), nil)
	return err
}

// ImportOrders imports orders/messages from OLX
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	if err := c.authenticate(ctx); err != nil {
		return nil, err
	}

	// OLX doesn't have traditional orders - it has threads (conversations)
	params := url.Values{}
	params.Set("offset", "0")
	params.Set("limit", "100")

	resp, err := c.doRequest(ctx, "GET", "/threads?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	threadsData, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	orders := make([]*marketplace.Order, 0)
	for _, td := range threadsData {
		thread := td.(map[string]interface{})

		createdAt := time.Now()
		if created, ok := thread["created_at"].(string); ok {
			createdAt, _ = time.Parse(time.RFC3339, created)
		}

		if createdAt.Before(since) {
			continue
		}

		order := &marketplace.Order{
			ExternalID:  fmt.Sprintf("%.0f", thread["id"].(float64)),
			Marketplace: marketplace.MarketplaceOLX,
			Status:      "new",
			CreatedAt:   createdAt,
		}

		// Get user info from thread
		if user, ok := thread["user"].(map[string]interface{}); ok {
			order.CustomerName = fmt.Sprintf("%v", user["name"])
			if phone, ok := user["phone"].(string); ok {
				order.CustomerPhone = phone
			}
		}

		// Get advert info
		if advert, ok := thread["advert"].(map[string]interface{}); ok {
			item := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%.0f", advert["id"].(float64)),
				Name:       fmt.Sprintf("%v", advert["title"]),
			}
			if price, ok := advert["price"].(map[string]interface{}); ok {
				item.Price = price["value"].(float64)
			}
			item.Quantity = 1
			item.Total = item.Price
			order.Items = append(order.Items, item)
			order.Total = item.Total
		}

		orders = append(orders, order)
	}

	return orders, nil
}

// UpdateOrderStatus - OLX doesn't have order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	// OLX threads don't have traditional status updates
	return nil
}

// GetCategories returns OLX categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	if err := c.authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/categories", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["data"].([]interface{})
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

// GenerateFeed - OLX doesn't use XML feeds
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	// OLX primarily uses API, not XML feeds
	// Return empty for now
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

	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Version", "2.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return nil, marketplace.ErrRateLimited
	}

	if resp.StatusCode == 401 {
		// Token might be expired, clear it
		c.accessToken = ""
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

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
