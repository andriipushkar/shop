package aliexpress

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"core/internal/marketplace"
)

const (
	apiURL = "https://api-sg.aliexpress.com/sync"
)

// Client implements AliExpress seller API integration
type Client struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// New creates a new AliExpress client
func New() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "aliexpress"
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	return nil
}

// IsConfigured returns true if configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.APIKey != "" && c.config.APISecret != ""
}

// ExportProducts exports products to AliExpress
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(),
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusRunning,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
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
	if result.FailedItems > 0 && result.SuccessItems == 0 {
		result.Status = marketplace.SyncStatusFailed
	}

	return result, nil
}

func (c *Client) createOrUpdateProduct(ctx context.Context, p *marketplace.Product) error {
	product := map[string]interface{}{
		"subject":          p.Name,
		"detail":           p.Description,
		"category_id":      p.CategoryID,
		"product_unit":     "piece",
		"currency_code":    "USD",
		"product_price":    p.Price,
		"inventory":        p.Quantity,
		"external_sku":     p.SKU,
		"package_weight":   p.Weight,
		"is_pack_sell":     false,
		"freight_template_id": "0",
	}

	if len(p.Images) > 0 {
		product["main_image_url"] = p.Images[0]
		if len(p.Images) > 1 {
			product["image_urls"] = strings.Join(p.Images[1:], ";")
		}
	}

	// SKU properties (variations)
	if len(p.Attributes) > 0 {
		props := make([]map[string]string, 0)
		for name, value := range p.Attributes {
			props = append(props, map[string]string{"name": name, "value": value})
		}
		product["sku_info_list"] = props
	}

	_, err := c.doRequest(ctx, "aliexpress.solution.product.post", product)
	return err
}

// UpdateProduct updates a product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return c.createOrUpdateProduct(ctx, product)
}

// UpdateStock updates stock
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	_, err := c.doRequest(ctx, "aliexpress.solution.product.inventory.update", map[string]interface{}{
		"product_id": sku,
		"inventory":  quantity,
	})
	return err
}

// UpdatePrice updates price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "aliexpress.solution.product.price.update", map[string]interface{}{
		"product_id":    sku,
		"product_price": price,
	})
	return err
}

// DeleteProduct deletes a product
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "aliexpress.solution.product.delete", map[string]interface{}{
		"product_id": sku,
	})
	return err
}

// ImportOrders imports orders
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	resp, err := c.doRequest(ctx, "aliexpress.solution.order.get", map[string]interface{}{
		"create_date_start": since.Format("2006-01-02 15:04:05"),
		"create_date_end":   time.Now().Format("2006-01-02 15:04:05"),
		"order_status":      "PLACE_ORDER_SUCCESS,IN_CANCEL,WAIT_SELLER_SEND_GOODS,SELLER_PART_SEND_GOODS",
		"page_size":         50,
	})

	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["target_list"].([]interface{})
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

func (c *Client) mapOrder(data map[string]interface{}) *marketplace.Order {
	order := &marketplace.Order{
		ExternalID:  fmt.Sprintf("%.0f", data["order_id"].(float64)),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["order_status"]),
	}

	if amount, ok := data["order_amount"].(map[string]interface{}); ok {
		if val, ok := amount["amount"].(string); ok {
			fmt.Sscanf(val, "%f", &order.Total)
		}
	}

	if receipt, ok := data["receipt_address"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", receipt["contact_person"])
		order.CustomerPhone = fmt.Sprintf("%v", receipt["mobile_no"])
		order.DeliveryAddress = fmt.Sprintf("%v", receipt["detail_address"])
		order.DeliveryCity = fmt.Sprintf("%v", receipt["city"])
	}

	if products, ok := data["product_list"].([]interface{}); ok {
		for _, pd := range products {
			pm := pd.(map[string]interface{})
			item := marketplace.OrderItem{
				Name:     fmt.Sprintf("%v", pm["product_name"]),
				SKU:      fmt.Sprintf("%v", pm["sku_code"]),
				Quantity: int(pm["product_count"].(float64)),
			}
			if price, ok := pm["product_price"].(map[string]interface{}); ok {
				if val, ok := price["amount"].(string); ok {
					fmt.Sscanf(val, "%f", &item.Price)
				}
			}
			item.Total = item.Price * float64(item.Quantity)
			order.Items = append(order.Items, item)
		}
	}

	if created, ok := data["gmt_create"].(string); ok {
		order.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", created)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// ShipOrder ships order with tracking
func (c *Client) ShipOrder(ctx context.Context, orderID, trackingNumber, carrier string) error {
	_, err := c.doRequest(ctx, "aliexpress.solution.order.fulfill", map[string]interface{}{
		"order_id":           orderID,
		"logistics_no":       trackingNumber,
		"service_name":       carrier,
		"send_type":          "all",
	})
	return err
}

// GetCategories returns categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	resp, err := c.doRequest(ctx, "aliexpress.solution.seller.category.tree.query", nil)
	if err != nil {
		return nil, err
	}

	catsData, ok := resp["child_category_list"].([]interface{})
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
			ID:       fmt.Sprintf("%.0f", cm["category_id"].(float64)),
			Name:     fmt.Sprintf("%v", cm["category_name"]),
			ParentID: parentID,
		}
		categories = append(categories, cat)
		if children, ok := cm["child_category_list"].([]interface{}); ok {
			categories = append(categories, c.parseCategories(children, cat.ID)...)
		}
	}
	return categories
}

// GenerateFeed - AliExpress uses API
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

func (c *Client) doRequest(ctx context.Context, method string, params map[string]interface{}) (map[string]interface{}, error) {
	timestamp := time.Now().Format("2006-01-02 15:04:05")

	// Build system params
	sysParams := map[string]string{
		"method":       method,
		"app_key":      c.config.APIKey,
		"access_token": c.config.AccessToken,
		"timestamp":    timestamp,
		"sign_method":  "sha256",
		"v":            "2.0",
	}

	// Serialize business params
	bizParams, _ := json.Marshal(params)

	// Build sign string
	var keys []string
	for k := range sysParams {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	signStr := ""
	for _, k := range keys {
		signStr += k + sysParams[k]
	}
	signStr += string(bizParams)

	// Generate signature
	h := hmac.New(sha256.New, []byte(c.config.APISecret))
	h.Write([]byte(signStr))
	signature := strings.ToUpper(hex.EncodeToString(h.Sum(nil)))
	sysParams["sign"] = signature

	// Build URL
	urlParams := url.Values{}
	for k, v := range sysParams {
		urlParams.Set(k, v)
	}

	req, _ := http.NewRequestWithContext(ctx, "POST", apiURL+"?"+urlParams.Encode(), bytes.NewReader(bizParams))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Check for API error
	if errResp, ok := result["error_response"].(map[string]interface{}); ok {
		return nil, fmt.Errorf("AliExpress API error: %v", errResp["msg"])
	}

	// Extract response
	respKey := strings.ReplaceAll(method, ".", "_") + "_response"
	if respData, ok := result[respKey].(map[string]interface{}); ok {
		return respData, nil
	}

	return result, nil
}
