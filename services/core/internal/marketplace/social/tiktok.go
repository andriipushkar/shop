package social

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"core/internal/marketplace"
)

const tiktokAPIURL = "https://open-api.tiktokglobalshop.com"

// TikTokShopClient implements TikTok Shop API integration
type TikTokShopClient struct {
	config       *marketplace.Config
	httpClient   *http.Client
	accessToken  string
	tokenExpires time.Time
}

// NewTikTokShopClient creates TikTok Shop client
func NewTikTokShopClient() *TikTokShopClient {
	return &TikTokShopClient{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns type
func (c *TikTokShopClient) Type() marketplace.MarketplaceType { return "tiktok_shop" }

// Configure configures
func (c *TikTokShopClient) Configure(config *marketplace.Config) error {
	c.config = config
	return nil
}

// IsConfigured returns if configured
func (c *TikTokShopClient) IsConfigured() bool {
	return c.config != nil && c.config.APIKey != "" && c.config.APISecret != ""
}

func (c *TikTokShopClient) refreshToken(ctx context.Context) error {
	if c.accessToken != "" && time.Now().Before(c.tokenExpires) {
		return nil
	}

	params := url.Values{}
	params.Set("app_key", c.config.APIKey)
	params.Set("app_secret", c.config.APISecret)
	params.Set("grant_type", "refresh_token")
	params.Set("refresh_token", c.config.RefreshToken)

	req, _ := http.NewRequestWithContext(ctx, "GET", tiktokAPIURL+"/api/v2/token/refresh?"+params.Encode(), nil)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var tokenResp struct {
		Data struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			ExpiresIn    int    `json:"access_token_expire_in"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&tokenResp)
	c.accessToken = tokenResp.Data.AccessToken
	c.tokenExpires = time.Now().Add(time.Duration(tokenResp.Data.ExpiresIn-60) * time.Second)
	return nil
}

// ExportProducts exports products to TikTok Shop
func (c *TikTokShopClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusRunning, TotalItems: len(products), StartedAt: time.Now(),
	}

	if err := c.refreshToken(ctx); err != nil {
		result.Status = marketplace.SyncStatusFailed
		now := time.Now()
		result.CompletedAt = &now
		return result, nil
	}

	for _, p := range products {
		if err := c.createProduct(ctx, p); err != nil {
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

func (c *TikTokShopClient) createProduct(ctx context.Context, p *marketplace.Product) error {
	// TikTok Shop product structure
	product := map[string]interface{}{
		"product_name": p.Name,
		"description":  p.Description,
		"category_id":  p.CategoryID,
		"brand_id":     "",
		"images": []map[string]interface{}{},
		"skus": []map[string]interface{}{
			{
				"seller_sku": p.SKU,
				"original_price": map[string]interface{}{
					"amount":   fmt.Sprintf("%.2f", p.Price),
					"currency": "USD",
				},
				"inventory": []map[string]interface{}{
					{
						"warehouse_id": c.config.ShopID,
						"quantity":     p.Quantity,
					},
				},
			},
		},
		"package_weight": map[string]interface{}{
			"value": p.Weight,
			"unit":  "KILOGRAM",
		},
		"is_cod_allowed": true,
	}

	// Add images
	if len(p.Images) > 0 {
		images := make([]map[string]interface{}, 0)
		for _, img := range p.Images {
			images = append(images, map[string]interface{}{"url": img})
		}
		product["images"] = images
	}

	// Add attributes
	if len(p.Attributes) > 0 {
		attrs := make([]map[string]interface{}, 0)
		for name, value := range p.Attributes {
			attrs = append(attrs, map[string]interface{}{
				"attribute_name":  name,
				"attribute_value": value,
			})
		}
		product["product_attributes"] = attrs
	}

	_, err := c.doRequest(ctx, "POST", "/api/products", product)
	return err
}

// UpdateProduct updates product
func (c *TikTokShopClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.createProduct(ctx, product)
}

// UpdateStock updates stock
func (c *TikTokShopClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "PUT", "/api/products/stocks", map[string]interface{}{
		"skus": []map[string]interface{}{
			{
				"id": sku,
				"inventory": []map[string]interface{}{
					{
						"warehouse_id": c.config.ShopID,
						"quantity":     quantity,
					},
				},
			},
		},
	})
	return err
}

// UpdatePrice updates price
func (c *TikTokShopClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "PUT", "/api/products/prices", map[string]interface{}{
		"skus": []map[string]interface{}{
			{
				"id": sku,
				"original_price": map[string]interface{}{
					"amount":   fmt.Sprintf("%.2f", price),
					"currency": "USD",
				},
			},
		},
	})
	return err
}

// DeleteProduct deletes product
func (c *TikTokShopClient) DeleteProduct(ctx context.Context, sku string) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "DELETE", "/api/products/"+sku, nil)
	return err
}

// ImportOrders imports orders
func (c *TikTokShopClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	if err := c.refreshToken(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "POST", "/api/orders/search", map[string]interface{}{
		"create_time_from": since.Unix(),
		"create_time_to":   time.Now().Unix(),
		"page_size":        100,
	})
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

func (c *TikTokShopClient) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%v", data["order_id"]),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["order_status"]),
	}

	if payment, ok := data["payment"].(map[string]interface{}); ok {
		if total, ok := payment["total_amount"].(map[string]interface{}); ok {
			if val, ok := total["amount"].(string); ok {
				fmt.Sscanf(val, "%f", &order.Total)
			}
		}
	}

	if recipient, ok := data["recipient_address"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", recipient["name"])
		order.CustomerPhone = fmt.Sprintf("%v", recipient["phone"])
		order.DeliveryCity = fmt.Sprintf("%v", recipient["city"])
		order.DeliveryAddress = fmt.Sprintf("%v", recipient["full_address"])
	}

	if items, ok := data["item_list"].([]interface{}); ok {
		for _, item := range items {
			im := item.(map[string]interface{})
			orderItem := marketplace.OrderItem{
				ExternalID: fmt.Sprintf("%v", im["item_id"]),
				SKU:        fmt.Sprintf("%v", im["seller_sku"]),
				Name:       fmt.Sprintf("%v", im["product_name"]),
				Quantity:   int(im["quantity"].(float64)),
			}
			if price, ok := im["sale_price"].(map[string]interface{}); ok {
				if val, ok := price["amount"].(string); ok {
					fmt.Sscanf(val, "%f", &orderItem.Price)
				}
			}
			orderItem.Total = orderItem.Price * float64(orderItem.Quantity)
			order.Items = append(order.Items, orderItem)
		}
	}

	if createTime, ok := data["create_time"].(float64); ok {
		order.CreatedAt = time.Unix(int64(createTime), 0)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *TikTokShopClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// ShipOrder ships order
func (c *TikTokShopClient) ShipOrder(ctx context.Context, orderID, trackingNumber, carrier string) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "POST", "/api/fulfillment/rts", map[string]interface{}{
		"order_id":        orderID,
		"tracking_number": trackingNumber,
		"shipping_provider_id": carrier,
	})
	return err
}

// GetCategories returns categories
func (c *TikTokShopClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	if err := c.refreshToken(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/api/products/categories", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["category_list"].([]interface{})
	if !ok {
		return nil, nil
	}

	return c.parseCategories(catsData, ""), nil
}

func (c *TikTokShopClient) parseCategories(data []interface{}, parentID string) []marketplace.Category {
	categories := make([]marketplace.Category, 0)
	for _, cd := range data {
		cm := cd.(map[string]interface{})
		cat := marketplace.Category{
			ID:       fmt.Sprintf("%v", cm["id"]),
			Name:     fmt.Sprintf("%v", cm["local_display_name"]),
			ParentID: parentID,
		}
		categories = append(categories, cat)
		if children, ok := cm["children"].([]interface{}); ok {
			categories = append(categories, c.parseCategories(children, cat.ID)...)
		}
	}
	return categories
}

// GenerateFeed not applicable
func (c *TikTokShopClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

func (c *TikTokShopClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	// Build sign string
	signParams := map[string]string{
		"app_key":      c.config.APIKey,
		"timestamp":    timestamp,
		"access_token": c.accessToken,
	}

	var keys []string
	for k := range signParams {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	signStr := c.config.APISecret
	for _, k := range keys {
		signStr += k + signParams[k]
	}
	signStr += c.config.APISecret

	// Generate signature
	h := hmac.New(sha256.New, []byte(c.config.APISecret))
	h.Write([]byte(signStr))
	signature := hex.EncodeToString(h.Sum(nil))

	// Build URL
	urlParams := url.Values{}
	for k, v := range signParams {
		urlParams.Set(k, v)
	}
	urlParams.Set("sign", signature)

	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, tiktokAPIURL+path+"?"+urlParams.Encode(), reqBody)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if code, ok := result["code"].(float64); ok && code != 0 {
		return nil, fmt.Errorf("TikTok API error: %v", result["message"])
	}

	if data, ok := result["data"].(map[string]interface{}); ok {
		return data, nil
	}

	return result, nil
}

// PinterestShoppingClient implements Pinterest Shopping API
type PinterestShoppingClient struct {
	config       *marketplace.Config
	httpClient   *http.Client
	accessToken  string
	tokenExpires time.Time
}

// NewPinterestShoppingClient creates Pinterest client
func NewPinterestShoppingClient() *PinterestShoppingClient {
	return &PinterestShoppingClient{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns type
func (c *PinterestShoppingClient) Type() marketplace.MarketplaceType { return "pinterest" }

// Configure configures
func (c *PinterestShoppingClient) Configure(config *marketplace.Config) error {
	c.config = config
	c.accessToken = config.AccessToken
	return nil
}

// IsConfigured returns if configured
func (c *PinterestShoppingClient) IsConfigured() bool {
	return c.config != nil && c.accessToken != ""
}

// ExportProducts exports products via catalogs
func (c *PinterestShoppingClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusRunning, TotalItems: len(products), StartedAt: time.Now(),
	}

	for _, p := range products {
		if err := c.createCatalogItem(ctx, p); err != nil {
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

func (c *PinterestShoppingClient) createCatalogItem(ctx context.Context, p *marketplace.Product) error {
	item := map[string]interface{}{
		"item_id":        p.SKU,
		"title":          p.Name,
		"description":    truncate(p.Description, 500),
		"link":           p.URL,
		"price":          fmt.Sprintf("%.2f USD", p.Price),
		"availability":   "in stock",
		"item_group_id":  p.CategoryID,
	}

	if len(p.Images) > 0 {
		item["image_link"] = p.Images[0]
		if len(p.Images) > 1 {
			item["additional_image_link"] = strings.Join(p.Images[1:], ",")
		}
	}

	if p.OldPrice > p.Price {
		item["sale_price"] = fmt.Sprintf("%.2f USD", p.Price)
		item["price"] = fmt.Sprintf("%.2f USD", p.OldPrice)
	}

	if p.Quantity <= 0 {
		item["availability"] = "out of stock"
	}

	_, err := c.doRequest(ctx, "POST", "/v5/catalogs/items", item)
	return err
}

// UpdateProduct updates product
func (c *PinterestShoppingClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.createCatalogItem(ctx, product)
}

// UpdateStock updates availability
func (c *PinterestShoppingClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	availability := "in stock"
	if quantity <= 0 {
		availability = "out of stock"
	}

	_, err := c.doRequest(ctx, "PATCH", "/v5/catalogs/items/"+sku, map[string]interface{}{
		"availability": availability,
	})
	return err
}

// UpdatePrice updates price
func (c *PinterestShoppingClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "PATCH", "/v5/catalogs/items/"+sku, map[string]interface{}{
		"price": fmt.Sprintf("%.2f USD", price),
	})
	return err
}

// DeleteProduct deletes product
func (c *PinterestShoppingClient) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "DELETE", "/v5/catalogs/items/"+sku, nil)
	return err
}

// ImportOrders - Pinterest doesn't have orders (redirect to shop)
func (c *PinterestShoppingClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus not applicable
func (c *PinterestShoppingClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns Google product categories (Pinterest uses these)
func (c *PinterestShoppingClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return nil, nil
}

// GenerateFeed generates Pinterest catalog feed
func (c *PinterestShoppingClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	// Pinterest uses same format as Google Shopping
	var buf bytes.Buffer
	buf.WriteString("id\ttitle\tdescription\tlink\timage_link\tprice\tavailability\n")

	for _, p := range products {
		availability := "in stock"
		if p.Quantity <= 0 {
			availability = "out of stock"
		}

		imageLink := ""
		if len(p.Images) > 0 {
			imageLink = p.Images[0]
		}

		buf.WriteString(fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%.2f USD\t%s\n",
			p.SKU,
			escapeTSV(p.Name),
			escapeTSV(truncate(p.Description, 500)),
			p.URL,
			imageLink,
			p.Price,
			availability,
		))
	}

	return buf.Bytes(), nil
}

// CreatePin creates a product pin
func (c *PinterestShoppingClient) CreatePin(ctx context.Context, product *marketplace.Product, boardID string) error {
	if len(product.Images) == 0 {
		return fmt.Errorf("product must have at least one image")
	}

	pin := map[string]interface{}{
		"board_id":    boardID,
		"title":       product.Name,
		"description": truncate(product.Description, 500),
		"link":        product.URL,
		"media_source": map[string]interface{}{
			"source_type": "image_url",
			"url":         product.Images[0],
		},
	}

	_, err := c.doRequest(ctx, "POST", "/v5/pins", pin)
	return err
}

func (c *PinterestShoppingClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, "https://api.pinterest.com"+path, reqBody)
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
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
		return nil, fmt.Errorf("Pinterest API error %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func escapeTSV(s string) string {
	s = strings.ReplaceAll(s, "\t", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", " ")
	return s
}
