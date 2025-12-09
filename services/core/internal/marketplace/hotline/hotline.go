package hotline

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
	baseURL = "https://my.hotline.ua/api"
)

// Client implements Hotline integration
// Hotline primarily uses YML feeds but also has partner API
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
	feedGen    *feeds.YMLGenerator
}

// New creates a new Hotline client
func New() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceHotline
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config

	c.feedGen = feeds.NewYMLGenerator(&feeds.YMLConfig{
		ShopName:     "Shop",
		CompanyName:  "Company",
		ShopURL:      config.BaseURL,
		Currency:     "UAH",
		DeliveryCost: 0,
		DeliveryDays: 3,
	})

	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != ""
}

// ExportProducts exports products to Hotline via API
// Note: Most merchants use YML feed upload instead
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceHotline,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Hotline prefers batch upload via YML
	// For API, we send products in batches
	batchSize := 50
	for i := 0; i < len(products); i += batchSize {
		end := i + batchSize
		if end > len(products) {
			end = len(products)
		}
		batch := products[i:end]

		items := make([]map[string]interface{}, 0, len(batch))
		for _, p := range batch {
			item := c.mapProductToHotline(p)
			items = append(items, item)
		}

		resp, err := c.doRequest(ctx, "POST", "/products/batch", map[string]interface{}{
			"products": items,
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
			if results, ok := resp["results"].([]interface{}); ok {
				for idx, r := range results {
					rm := r.(map[string]interface{})
					if success, ok := rm["success"].(bool); ok && success {
						result.SuccessItems++
					} else {
						result.FailedItems++
						if idx < len(batch) {
							result.Errors = append(result.Errors, marketplace.SyncError{
								SKU:     batch[idx].SKU,
								Message: fmt.Sprintf("%v", rm["error"]),
							})
						}
					}
				}
			} else {
				result.SuccessItems += len(batch)
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

func (c *Client) mapProductToHotline(p *marketplace.Product) map[string]interface{} {
	item := map[string]interface{}{
		"id":          p.SKU,
		"name":        p.Name,
		"description": p.Description,
		"url":         p.URL,
		"price":       p.Price,
		"currency":    "UAH",
		"category_id": p.CategoryID,
		"vendor":      p.Brand,
		"available":   p.IsAvailable && p.Quantity > 0,
		"stock":       p.Quantity,
	}

	if p.OldPrice > p.Price {
		item["old_price"] = p.OldPrice
	}

	if len(p.Images) > 0 {
		item["image"] = p.Images[0]
		if len(p.Images) > 1 {
			item["images"] = p.Images[1:]
		}
	}

	// Attributes
	if len(p.Attributes) > 0 {
		params := make([]map[string]string, 0)
		for name, value := range p.Attributes {
			params = append(params, map[string]string{
				"name":  name,
				"value": value,
			})
		}
		item["params"] = params
	}

	if p.Warranty > 0 {
		item["warranty"] = p.Warranty
	}

	return item
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	item := c.mapProductToHotline(product)
	_, err := c.doRequest(ctx, "PUT", "/products/"+product.SKU, item)
	return err
}

// UpdateStock updates product stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	_, err := c.doRequest(ctx, "PATCH", "/products/"+sku+"/stock", map[string]interface{}{
		"stock":     quantity,
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

// ImportOrders - Hotline is a price comparison site, doesn't have orders
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	// Hotline redirects to shop - no orders to import
	return nil, nil
}

// UpdateOrderStatus - Hotline doesn't have orders
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns Hotline categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "GET", "/categories", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["categories"].([]interface{})
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

		if path, ok := cm["path"].(string); ok {
			cat.Path = path
		}

		categories = append(categories, cat)

		if children, ok := cm["children"].([]interface{}); ok && len(children) > 0 {
			childCats := c.parseCategories(children, cat.ID)
			categories = append(categories, childCats...)
		}
	}

	return categories
}

// GenerateFeed generates YML feed for Hotline
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.feedGen.GenerateSimpleFeed(products)
}

// GenerateHotlineFeed generates Hotline-specific XML feed
func (c *Client) GenerateHotlineFeed(products []*marketplace.Product) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	buf.WriteString("\n<price>\n")
	buf.WriteString(fmt.Sprintf("  <date>%s</date>\n", time.Now().Format("2006-01-02 15:04")))
	buf.WriteString("  <firmName>Shop</firmName>\n")
	buf.WriteString(fmt.Sprintf("  <firmId>%s</firmId>\n", c.config.ShopID))

	for _, p := range products {
		if !p.IsActive {
			continue
		}

		buf.WriteString("  <item>\n")
		buf.WriteString(fmt.Sprintf("    <id>%s</id>\n", p.SKU))
		buf.WriteString(fmt.Sprintf("    <category>%s</category>\n", escapeXML(p.CategoryPath)))
		buf.WriteString(fmt.Sprintf("    <vendor>%s</vendor>\n", escapeXML(p.Brand)))
		buf.WriteString(fmt.Sprintf("    <name>%s</name>\n", escapeXML(p.Name)))
		buf.WriteString(fmt.Sprintf("    <description>%s</description>\n", escapeXML(p.Description)))
		buf.WriteString(fmt.Sprintf("    <url>%s</url>\n", p.URL))
		buf.WriteString(fmt.Sprintf("    <price>%.2f</price>\n", p.Price))
		buf.WriteString("    <currency>UAH</currency>\n")

		if len(p.Images) > 0 {
			buf.WriteString(fmt.Sprintf("    <image>%s</image>\n", p.Images[0]))
		}

		if p.IsAvailable && p.Quantity > 0 {
			buf.WriteString("    <stock>В наявності</stock>\n")
		} else {
			buf.WriteString("    <stock>Немає в наявності</stock>\n")
		}

		if p.Warranty > 0 {
			buf.WriteString(fmt.Sprintf("    <guarantee>%d</guarantee>\n", p.Warranty))
		}

		// Attributes
		for name, value := range p.Attributes {
			buf.WriteString(fmt.Sprintf("    <param name=\"%s\">%s</param>\n", escapeXML(name), escapeXML(value)))
		}

		buf.WriteString("  </item>\n")
	}

	buf.WriteString("</price>\n")

	return buf.Bytes(), nil
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
		// Empty response is OK for some endpoints
		return nil, nil
	}

	return result, nil
}

func escapeXML(s string) string {
	var buf bytes.Buffer
	for _, r := range s {
		switch r {
		case '<':
			buf.WriteString("&lt;")
		case '>':
			buf.WriteString("&gt;")
		case '&':
			buf.WriteString("&amp;")
		case '"':
			buf.WriteString("&quot;")
		case '\'':
			buf.WriteString("&apos;")
		default:
			buf.WriteRune(r)
		}
	}
	return buf.String()
}
