package google

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"core/internal/marketplace"
	"core/internal/marketplace/feeds"
)

const (
	baseURL = "https://shoppingcontent.googleapis.com/content/v2.1"
)

// Client implements Google Merchant Center / Google Shopping integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.GoogleFeedGenerator
	merchantID string
}

// New creates a new Google Shopping client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceGoogle
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	c.merchantID = config.ShopID

	c.feedGen = feeds.NewGoogleFeedGenerator(config.BaseURL, "UAH")

	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != "" && c.merchantID != ""
}

// ExportProducts exports products to Google Merchant Center
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceGoogle,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Google supports batch operations
	batchSize := 1000
	for i := 0; i < len(products); i += batchSize {
		end := i + batchSize
		if end > len(products) {
			end = len(products)
		}
		batch := products[i:end]

		entries := make([]map[string]interface{}, 0, len(batch))
		for idx, p := range batch {
			entry := map[string]interface{}{
				"batchId":   i + idx,
				"merchantId": c.merchantID,
				"method":    "insert",
				"product":   c.mapProductToGoogle(p),
			}
			entries = append(entries, entry)
		}

		resp, err := c.doRequest(ctx, "POST", "/products/batch", map[string]interface{}{
			"entries": entries,
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
			// Parse batch response
			if respEntries, ok := resp["entries"].([]interface{}); ok {
				for _, re := range respEntries {
					rem := re.(map[string]interface{})
					if errors, ok := rem["errors"].(map[string]interface{}); ok {
						if errList, ok := errors["errors"].([]interface{}); ok && len(errList) > 0 {
							result.FailedItems++
							errMsg := ""
							for _, e := range errList {
								em := e.(map[string]interface{})
								errMsg += fmt.Sprintf("%v; ", em["message"])
							}
							batchID := int(rem["batchId"].(float64)) - i
							if batchID >= 0 && batchID < len(batch) {
								result.Errors = append(result.Errors, marketplace.SyncError{
									SKU:     batch[batchID].SKU,
									Message: errMsg,
								})
							}
						}
					} else {
						result.SuccessItems++
					}
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

func (c *Client) mapProductToGoogle(p *marketplace.Product) map[string]interface{} {
	product := map[string]interface{}{
		"offerId":       p.SKU,
		"title":         truncate(p.Name, 150),
		"description":   truncate(p.Description, 5000),
		"link":          p.URL,
		"contentLanguage": "uk",
		"targetCountry": "UA",
		"channel":       "online",
		"price": map[string]interface{}{
			"value":    fmt.Sprintf("%.2f", p.Price),
			"currency": "UAH",
		},
		"condition":  "new",
		"brand":      p.Brand,
		"mpn":        p.SKU,
	}

	// Availability
	if p.IsAvailable && p.Quantity > 0 {
		product["availability"] = "in stock"
	} else {
		product["availability"] = "out of stock"
	}

	// Sale price
	if p.OldPrice > p.Price {
		product["salePrice"] = map[string]interface{}{
			"value":    fmt.Sprintf("%.2f", p.Price),
			"currency": "UAH",
		}
		product["price"] = map[string]interface{}{
			"value":    fmt.Sprintf("%.2f", p.OldPrice),
			"currency": "UAH",
		}
	}

	// Images
	if len(p.Images) > 0 {
		product["imageLink"] = p.Images[0]
		if len(p.Images) > 1 {
			product["additionalImageLinks"] = p.Images[1:]
		}
	}

	// Category
	if p.CategoryPath != "" {
		product["productTypes"] = []string{p.CategoryPath}
	}

	// Shipping
	product["shipping"] = []map[string]interface{}{
		{
			"country": "UA",
			"service": "Standard",
			"price": map[string]interface{}{
				"value":    "0",
				"currency": "UAH",
			},
		},
	}

	// Weight
	if p.Weight > 0 {
		product["shippingWeight"] = map[string]interface{}{
			"value": fmt.Sprintf("%.2f", p.Weight),
			"unit":  "kg",
		}
	}

	// Dimensions
	if p.Dimensions != nil {
		product["shippingLength"] = map[string]interface{}{
			"value": fmt.Sprintf("%.1f", p.Dimensions.Length),
			"unit":  "cm",
		}
		product["shippingWidth"] = map[string]interface{}{
			"value": fmt.Sprintf("%.1f", p.Dimensions.Width),
			"unit":  "cm",
		}
		product["shippingHeight"] = map[string]interface{}{
			"value": fmt.Sprintf("%.1f", p.Dimensions.Height),
			"unit":  "cm",
		}
	}

	// Custom attributes
	if len(p.Attributes) > 0 {
		customAttrs := make([]map[string]string, 0)
		for name, value := range p.Attributes {
			customAttrs = append(customAttrs, map[string]string{
				"name":  name,
				"value": value,
			})
		}
		product["customAttributes"] = customAttrs
	}

	return product
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	data := c.mapProductToGoogle(product)
	_, err := c.doRequest(ctx, "PUT",
		fmt.Sprintf("/%s/products/online:uk:UA:%s", c.merchantID, product.SKU),
		data)
	return err
}

// UpdateStock updates product availability
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	availability := "out of stock"
	if quantity > 0 {
		availability = "in stock"
	}

	_, err := c.doRequest(ctx, "PATCH",
		fmt.Sprintf("/%s/products/online:uk:UA:%s", c.merchantID, sku),
		map[string]interface{}{
			"availability": availability,
		})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "PATCH",
		fmt.Sprintf("/%s/products/online:uk:UA:%s", c.merchantID, sku),
		map[string]interface{}{
			"price": map[string]interface{}{
				"value":    fmt.Sprintf("%.2f", price),
				"currency": "UAH",
			},
		})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "DELETE",
		fmt.Sprintf("/%s/products/online:uk:UA:%s", c.merchantID, sku),
		nil)
	return err
}

// ImportOrders - Google Shopping doesn't have direct orders
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	// Google Shopping redirects to your site
	return nil, nil
}

// UpdateOrderStatus - Google Shopping doesn't have orders
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns Google product taxonomy
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	// Google uses their own taxonomy which should be mapped
	// This would typically be loaded from taxonomy file
	return []marketplace.Category{
		{ID: "1", Name: "Animals & Pet Supplies"},
		{ID: "2", Name: "Apparel & Accessories"},
		{ID: "3", Name: "Arts & Entertainment"},
		{ID: "4", Name: "Baby & Toddler"},
		{ID: "5", Name: "Business & Industrial"},
		{ID: "6", Name: "Cameras & Optics"},
		{ID: "7", Name: "Electronics"},
		{ID: "8", Name: "Food, Beverages & Tobacco"},
		{ID: "9", Name: "Furniture"},
		{ID: "10", Name: "Hardware"},
		{ID: "11", Name: "Health & Beauty"},
		{ID: "12", Name: "Home & Garden"},
		{ID: "13", Name: "Luggage & Bags"},
		{ID: "14", Name: "Media"},
		{ID: "15", Name: "Office Supplies"},
		{ID: "16", Name: "Software"},
		{ID: "17", Name: "Sporting Goods"},
		{ID: "18", Name: "Toys & Games"},
		{ID: "19", Name: "Vehicles & Parts"},
	}, nil
}

// GenerateFeed generates Google Merchant Center RSS feed
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.feedGen.Generate(products)
}

// GetProductStatus returns the status of a product in Merchant Center
func (c *Client) GetProductStatus(ctx context.Context, sku string) (map[string]interface{}, error) {
	return c.doRequest(ctx, "GET",
		fmt.Sprintf("/%s/productstatuses/online:uk:UA:%s", c.merchantID, sku),
		nil)
}

// ListProducts returns all products in Merchant Center
func (c *Client) ListProducts(ctx context.Context, pageToken string) ([]map[string]interface{}, string, error) {
	path := fmt.Sprintf("/%s/products", c.merchantID)
	if pageToken != "" {
		path += "?pageToken=" + pageToken
	}

	resp, err := c.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, "", err
	}

	products := make([]map[string]interface{}, 0)
	if resources, ok := resp["resources"].([]interface{}); ok {
		for _, r := range resources {
			products = append(products, r.(map[string]interface{}))
		}
	}

	nextToken := ""
	if token, ok := resp["nextPageToken"].(string); ok {
		nextToken = token
	}

	return products, nextToken, nil
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

	url := baseURL + path
	// For non-batch endpoints, need to include merchant ID
	if path[0] == '/' && path[1] != '/' {
		url = baseURL + "/" + c.merchantID + path
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
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

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
