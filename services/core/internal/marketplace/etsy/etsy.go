package etsy

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
	apiURL = "https://openapi.etsy.com/v3"
)

// Client implements Etsy API integration
type Client struct {
	config       *marketplace.Config
	httpClient   *http.Client
	accessToken  string
	tokenExpires time.Time
	shopID       string
}

// New creates a new Etsy client
func New() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "etsy"
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	c.shopID = config.ShopID
	return nil
}

// IsConfigured returns true if configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != "" && c.shopID != ""
}

// ExportProducts exports products to Etsy
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(),
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
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
	listing := map[string]interface{}{
		"quantity":      p.Quantity,
		"title":         truncate(p.Name, 140),
		"description":   p.Description,
		"price": map[string]interface{}{
			"amount":        int(p.Price * 100), // Etsy uses cents
			"divisor":       100,
			"currency_code": "USD",
		},
		"who_made":       "i_did",
		"when_made":      "2020_2024",
		"taxonomy_id":    p.CategoryID,
		"is_supply":      false,
		"sku":            []string{p.SKU},
		"should_auto_renew": true,
	}

	// Try to find existing listing by SKU
	existingID, _ := c.findListingBySKU(ctx, p.SKU)

	var err error
	if existingID != "" {
		_, err = c.doRequest(ctx, "PATCH", "/application/shops/"+c.shopID+"/listings/"+existingID, listing)
	} else {
		resp, createErr := c.doRequest(ctx, "POST", "/application/shops/"+c.shopID+"/listings", listing)
		if createErr != nil {
			return createErr
		}
		// Upload images for new listing
		if listingID, ok := resp["listing_id"].(float64); ok && len(p.Images) > 0 {
			c.uploadImages(ctx, fmt.Sprintf("%.0f", listingID), p.Images)
		}
		err = createErr
	}

	return err
}

func (c *Client) findListingBySKU(ctx context.Context, sku string) (string, error) {
	resp, err := c.doRequest(ctx, "GET", "/application/shops/"+c.shopID+"/listings?sku="+url.QueryEscape(sku), nil)
	if err != nil {
		return "", err
	}

	listings, ok := resp["results"].([]interface{})
	if !ok || len(listings) == 0 {
		return "", nil
	}

	listing := listings[0].(map[string]interface{})
	return fmt.Sprintf("%.0f", listing["listing_id"].(float64)), nil
}

func (c *Client) uploadImages(ctx context.Context, listingID string, images []string) {
	for rank, imageURL := range images {
		c.doRequest(ctx, "POST", "/application/shops/"+c.shopID+"/listings/"+listingID+"/images",
			map[string]interface{}{
				"image_url": imageURL,
				"rank":      rank + 1,
			})
	}
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.createOrUpdateListing(ctx, product)
}

// UpdateStock updates product inventory
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	listingID, err := c.findListingBySKU(ctx, sku)
	if err != nil || listingID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "PATCH", "/application/shops/"+c.shopID+"/listings/"+listingID,
		map[string]interface{}{"quantity": quantity})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	listingID, err := c.findListingBySKU(ctx, sku)
	if err != nil || listingID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "PATCH", "/application/shops/"+c.shopID+"/listings/"+listingID,
		map[string]interface{}{
			"price": map[string]interface{}{
				"amount":        int(price * 100),
				"divisor":       100,
				"currency_code": "USD",
			},
		})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	listingID, err := c.findListingBySKU(ctx, sku)
	if err != nil || listingID == "" {
		return marketplace.ErrProductNotFound
	}

	_, err = c.doRequest(ctx, "DELETE", "/application/shops/"+c.shopID+"/listings/"+listingID, nil)
	return err
}

// ImportOrders imports orders from Etsy
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	params := url.Values{}
	params.Set("min_created", fmt.Sprintf("%d", since.Unix()))

	resp, err := c.doRequest(ctx, "GET", "/application/shops/"+c.shopID+"/receipts?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	receiptsData, ok := resp["results"].([]interface{})
	if !ok {
		return nil, nil
	}

	orders := make([]*marketplace.Order, 0, len(receiptsData))
	for _, rd := range receiptsData {
		rm := rd.(map[string]interface{})
		order := c.mapOrder(rm)
		orders = append(orders, order)
	}

	return orders, nil
}

func (c *Client) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%.0f", data["receipt_id"].(float64)),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["status"]),
	}

	if grandTotal, ok := data["grandtotal"].(map[string]interface{}); ok {
		if amount, ok := grandTotal["amount"].(float64); ok {
			divisor := grandTotal["divisor"].(float64)
			order.Total = amount / divisor
		}
	}

	order.CustomerName = fmt.Sprintf("%v", data["name"])

	if addr, ok := data["formatted_address"].(string); ok {
		order.DeliveryAddress = addr
	}

	if city, ok := data["city"].(string); ok {
		order.DeliveryCity = city
	}

	if transactions, ok := data["transactions"].([]interface{}); ok {
		for _, t := range transactions {
			tm := t.(map[string]interface{})
			item := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%.0f", tm["transaction_id"].(float64)),
				Name:       fmt.Sprintf("%v", tm["title"]),
				Quantity:   int(tm["quantity"].(float64)),
			}
			if price, ok := tm["price"].(map[string]interface{}); ok {
				if amount, ok := price["amount"].(float64); ok {
					divisor := price["divisor"].(float64)
					item.Price = amount / divisor
				}
			}
			item.Total = item.Price * float64(item.Quantity)
			order.Items = append(order.Items, item)
		}
	}

	if createTimestamp, ok := data["create_timestamp"].(float64); ok {
		order.CreatedAt = time.Unix(int64(createTimestamp), 0)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil // Etsy receipts don't have status updates
}

// MarkAsShipped marks order as shipped
func (c *Client) MarkAsShipped(ctx context.Context, receiptID, carrier, trackingCode string) error {
	_, err := c.doRequest(ctx, "POST", "/application/shops/"+c.shopID+"/receipts/"+receiptID+"/tracking",
		map[string]interface{}{
			"carrier_name":  carrier,
			"tracking_code": trackingCode,
		})
	return err
}

// GetCategories returns Etsy taxonomy
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/application/seller-taxonomy/nodes", nil)
	if err != nil {
		return nil, err
	}

	nodesData, ok := resp["results"].([]interface{})
	if !ok {
		return nil, nil
	}

	categories := make([]marketplace.Category, 0)
	for _, nd := range nodesData {
		nm := nd.(map[string]interface{})
		cat := marketplace.Category{
			ID:   fmt.Sprintf("%.0f", nm["id"].(float64)),
			Name: fmt.Sprintf("%v", nm["name"]),
		}
		if parentID, ok := nm["parent_id"].(float64); ok {
			cat.ParentID = fmt.Sprintf("%.0f", parentID)
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// GenerateFeed - Etsy uses API
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
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

	req, err := http.NewRequestWithContext(ctx, method, apiURL+path, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.config.AccessToken)
	req.Header.Set("x-api-key", c.config.APIKey)
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
