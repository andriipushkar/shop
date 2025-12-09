package amazon

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

const (
	euBaseURL = "https://sellingpartnerapi-eu.amazon.com"
	naBaseURL = "https://sellingpartnerapi-na.amazon.com"
)

// Client implements Amazon Selling Partner API integration
type Client struct {
	config       *marketplace.Config
	httpClient   *http.Client
	accessToken  string
	tokenExpires time.Time
	region       string
	marketplaceID string
}

// New creates a new Amazon client
func New(region string) *Client {
	return &Client{
		region:     region,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceType("amazon_" + c.region)
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	c.marketplaceID = config.ShopID
	return nil
}

// IsConfigured returns true if configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.ClientID != "" && c.config.APISecret != ""
}

// refreshToken refreshes access token using LWA
func (c *Client) refreshToken(ctx context.Context) error {
	if c.accessToken != "" && time.Now().Before(c.tokenExpires) {
		return nil
	}

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", c.config.RefreshToken)
	data.Set("client_id", c.config.ClientID)
	data.Set("client_secret", c.config.APISecret)

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.amazon.com/auth/o2/token",
		strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

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

// ExportProducts exports products to Amazon
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

	// Create feeds submission
	messages := make([]map[string]interface{}, 0, len(products))
	for i, p := range products {
		msg := c.mapProductToAmazon(p, i+1)
		messages = append(messages, msg)
	}

	feed := map[string]interface{}{
		"header": map[string]interface{}{
			"sellerId":    c.config.ShopID,
			"version":     "2.0",
			"issueLocale": "en_US",
		},
		"messages": messages,
	}

	resp, err := c.doRequest(ctx, "POST", "/feeds/2021-06-30/feeds", map[string]interface{}{
		"feedType":       "POST_PRODUCT_DATA",
		"marketplaceIds": []string{c.marketplaceID},
		"inputFeedDocumentId": c.createFeedDocument(ctx, feed),
	})

	if err != nil {
		result.Status = marketplace.SyncStatusFailed
		result.Errors = append(result.Errors, marketplace.SyncError{Message: err.Error()})
	} else {
		if feedId, ok := resp["feedId"].(string); ok {
			result.ID = feedId
		}
		result.SuccessItems = len(products)
		result.ProcessedItems = len(products)
		result.Status = marketplace.SyncStatusCompleted
	}

	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

func (c *Client) createFeedDocument(ctx context.Context, feed map[string]interface{}) string {
	// In real implementation, this would create a feed document and return its ID
	return "feed-doc-id"
}

func (c *Client) mapProductToAmazon(p *marketplace.Product, messageID int) map[string]interface{} {
	product := map[string]interface{}{
		"messageId": messageID,
		"sku":       p.SKU,
		"productType": map[string]interface{}{
			"productType": "PRODUCT",
		},
		"attributes": map[string]interface{}{
			"item_name": []map[string]interface{}{
				{"value": p.Name, "language_tag": "en_US"},
			},
			"brand": []map[string]interface{}{
				{"value": p.Brand},
			},
			"product_description": []map[string]interface{}{
				{"value": truncate(p.Description, 2000), "language_tag": "en_US"},
			},
			"list_price": []map[string]interface{}{
				{"value": p.Price, "currency": "USD"},
			},
			"fulfillment_availability": []map[string]interface{}{
				{
					"fulfillment_channel_code": "DEFAULT",
					"quantity":                 p.Quantity,
				},
			},
		},
	}

	if len(p.Images) > 0 {
		product["attributes"].(map[string]interface{})["main_product_image_locator"] = []map[string]interface{}{
			{"media_location": p.Images[0]},
		}
		if len(p.Images) > 1 {
			otherImages := make([]map[string]interface{}, 0)
			for _, img := range p.Images[1:] {
				otherImages = append(otherImages, map[string]interface{}{
					"media_location": img,
				})
			}
			product["attributes"].(map[string]interface{})["other_product_image_locator"] = otherImages
		}
	}

	return product
}

// UpdateProduct updates a single product
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "PATCH", "/listings/2021-08-01/items/"+c.config.ShopID+"/"+product.SKU,
		map[string]interface{}{
			"productType": "PRODUCT",
			"patches": []map[string]interface{}{
				{
					"op":    "replace",
					"path":  "/attributes/list_price",
					"value": []map[string]interface{}{{"value": product.Price, "currency": "USD"}},
				},
			},
		})
	return err
}

// UpdateStock updates product inventory
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "PUT", "/fba/inventory/v1/items/"+sku,
		map[string]interface{}{
			"sellerSku": sku,
			"quantity":  quantity,
		})
	return err
}

// UpdatePrice updates product price
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "PATCH", "/listings/2021-08-01/items/"+c.config.ShopID+"/"+sku,
		map[string]interface{}{
			"productType": "PRODUCT",
			"patches": []map[string]interface{}{
				{
					"op":    "replace",
					"path":  "/attributes/list_price",
					"value": []map[string]interface{}{{"value": price, "currency": "USD"}},
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

	_, err := c.doRequest(ctx, "DELETE", "/listings/2021-08-01/items/"+c.config.ShopID+"/"+sku, nil)
	return err
}

// ImportOrders imports orders from Amazon
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	if err := c.refreshToken(ctx); err != nil {
		return nil, err
	}

	params := url.Values{}
	params.Set("MarketplaceIds", c.marketplaceID)
	params.Set("CreatedAfter", since.Format(time.RFC3339))

	resp, err := c.doRequest(ctx, "GET", "/orders/v0/orders?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["Orders"].([]interface{})
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
		ExternalID:  fmt.Sprintf("%v", data["AmazonOrderId"]),
		Marketplace: c.Type(),
		Status:      fmt.Sprintf("%v", data["OrderStatus"]),
	}

	if amount, ok := data["OrderTotal"].(map[string]interface{}); ok {
		if val, ok := amount["Amount"].(string); ok {
			fmt.Sscanf(val, "%f", &order.Total)
		}
	}

	if shipping, ok := data["ShippingAddress"].(map[string]interface{}); ok {
		order.CustomerName = fmt.Sprintf("%v", shipping["Name"])
		order.DeliveryCity = fmt.Sprintf("%v", shipping["City"])
		order.DeliveryAddress = fmt.Sprintf("%v %v", shipping["AddressLine1"], shipping["AddressLine2"])
	}

	if purchaseDate, ok := data["PurchaseDate"].(string); ok {
		order.CreatedAt, _ = time.Parse(time.RFC3339, purchaseDate)
	}

	return order
}

// UpdateOrderStatus updates order status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	// Amazon order status is managed through shipment confirmation
	return nil
}

// ConfirmShipment confirms order shipment
func (c *Client) ConfirmShipment(ctx context.Context, orderID, trackingNumber, carrier string) error {
	if err := c.refreshToken(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "POST", "/orders/v0/orders/"+orderID+"/shipment",
		map[string]interface{}{
			"marketplaceId": c.marketplaceID,
			"shipmentStatus": "Shipped",
			"trackingNumber": trackingNumber,
			"carrierCode":    carrier,
		})
	return err
}

// GetCategories returns Amazon categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return nil, nil // Amazon uses product type definitions instead
}

// GenerateFeed - Amazon uses Feeds API
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

func (c *Client) getBaseURL() string {
	if c.region == "eu" {
		return euBaseURL
	}
	return naBaseURL
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

	// Sign request with AWS Signature Version 4
	c.signRequest(req)

	req.Header.Set("x-amz-access-token", c.accessToken)
	req.Header.Set("Content-Type", "application/json")

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

func (c *Client) signRequest(req *http.Request) {
	// AWS Signature Version 4 signing (simplified)
	now := time.Now().UTC()
	dateStamp := now.Format("20060102")
	amzDate := now.Format("20060102T150405Z")

	req.Header.Set("x-amz-date", amzDate)

	// Create canonical request
	canonicalHeaders := "host:" + req.Host + "\n" + "x-amz-date:" + amzDate + "\n"
	signedHeaders := "host;x-amz-date"

	payloadHash := sha256Hash("")
	canonicalRequest := req.Method + "\n" + req.URL.Path + "\n" + req.URL.RawQuery + "\n" +
		canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash

	// Create string to sign
	algorithm := "AWS4-HMAC-SHA256"
	credentialScope := dateStamp + "/eu-west-1/execute-api/aws4_request"
	stringToSign := algorithm + "\n" + amzDate + "\n" + credentialScope + "\n" + sha256Hash(canonicalRequest)

	// Calculate signature
	signingKey := getSignatureKey(c.config.APISecret, dateStamp, "eu-west-1", "execute-api")
	signature := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))

	// Add authorization header
	authHeader := algorithm + " Credential=" + c.config.ClientID + "/" + credentialScope +
		", SignedHeaders=" + signedHeaders + ", Signature=" + signature
	req.Header.Set("Authorization", authHeader)
}

func sha256Hash(data string) string {
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func getSignatureKey(secret, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), dateStamp)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	return hmacSHA256(kService, "aws4_request")
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// Ensure unused import is used
var _ = sort.Strings
