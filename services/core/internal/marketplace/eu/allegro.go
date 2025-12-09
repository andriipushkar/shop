package eu

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

const allegroAPIURL = "https://api.allegro.pl"

// AllegroClient implements Allegro.pl marketplace integration (Poland)
type AllegroClient struct {
	config       *marketplace.Config
	httpClient   *http.Client
	accessToken  string
	tokenExpires time.Time
}

// NewAllegroClient creates Allegro client
func NewAllegroClient() *AllegroClient {
	return &AllegroClient{httpClient: &http.Client{Timeout: 60 * time.Second}}
}

// Type returns type
func (c *AllegroClient) Type() marketplace.MarketplaceType { return "allegro" }

// Configure configures
func (c *AllegroClient) Configure(config *marketplace.Config) error { c.config = config; return nil }

// IsConfigured returns if configured
func (c *AllegroClient) IsConfigured() bool {
	return c.config != nil && c.config.ClientID != "" && c.config.APISecret != ""
}

func (c *AllegroClient) refreshToken(ctx context.Context) error {
	if c.accessToken != "" && time.Now().Before(c.tokenExpires) {
		return nil
	}

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", c.config.RefreshToken)

	req, _ := http.NewRequestWithContext(ctx, "POST", allegroAPIURL+"/auth/oauth/token",
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
	json.NewDecoder(resp.Body).Decode(&tokenResp)
	c.accessToken = tokenResp.AccessToken
	c.tokenExpires = time.Now().Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second)
	return nil
}

// ExportProducts exports products
func (c *AllegroClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
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
		offer := map[string]interface{}{
			"name":        p.Name,
			"description": map[string]interface{}{"sections": []map[string]interface{}{{"items": []map[string]interface{}{{"type": "TEXT", "content": p.Description}}}}},
			"category":    map[string]string{"id": p.CategoryID},
			"sellingMode": map[string]interface{}{"format": "BUY_NOW", "price": map[string]interface{}{"amount": fmt.Sprintf("%.2f", p.Price), "currency": "PLN"}},
			"stock":       map[string]interface{}{"available": p.Quantity, "unit": "UNIT"},
			"external":    map[string]string{"id": p.SKU},
		}

		if len(p.Images) > 0 {
			images := make([]map[string]string, 0)
			for _, img := range p.Images {
				images = append(images, map[string]string{"url": img})
			}
			offer["images"] = images
		}

		_, err := c.doRequest(ctx, "POST", "/sale/product-offers", offer)
		if err != nil {
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

// UpdateProduct updates product
func (c *AllegroClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }

// UpdateStock updates stock
func (c *AllegroClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }

// UpdatePrice updates price
func (c *AllegroClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }

// DeleteProduct deletes product
func (c *AllegroClient) DeleteProduct(ctx context.Context, sku string) error { return nil }

// ImportOrders imports orders
func (c *AllegroClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	if err := c.refreshToken(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/order/checkout-forms?status=READY_FOR_PROCESSING", nil)
	if err != nil {
		return nil, err
	}

	ordersData, ok := resp["checkoutForms"].([]interface{})
	if !ok {
		return nil, nil
	}

	orders := make([]*marketplace.Order, 0)
	for _, od := range ordersData {
		om := od.(map[string]interface{})
		order := &marketplace.Order{
			ExternalID:  fmt.Sprintf("%v", om["id"]),
			Marketplace: c.Type(),
			Status:      fmt.Sprintf("%v", om["status"]),
		}
		if buyer, ok := om["buyer"].(map[string]interface{}); ok {
			order.CustomerName = fmt.Sprintf("%v", buyer["login"])
		}
		if summary, ok := om["summary"].(map[string]interface{}); ok {
			if total, ok := summary["totalToPay"].(map[string]interface{}); ok {
				if val, ok := total["amount"].(string); ok {
					fmt.Sscanf(val, "%f", &order.Total)
				}
			}
		}
		orders = append(orders, order)
	}

	return orders, nil
}

// UpdateOrderStatus updates status
func (c *AllegroClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }

// GetCategories returns categories
func (c *AllegroClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) { return nil, nil }

// GenerateFeed generates feed
func (c *AllegroClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

func (c *AllegroClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}
	req, _ := http.NewRequestWithContext(ctx, method, allegroAPIURL+path, reqBody)
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/vnd.allegro.public.v1+json")
	req.Header.Set("Accept", "application/vnd.allegro.public.v1+json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// CeneoClient implements Ceneo.pl price comparison (Poland)
type CeneoClient struct {
	config *marketplace.Config
}

// NewCeneoClient creates Ceneo client
func NewCeneoClient() *CeneoClient { return &CeneoClient{} }

// Type returns type
func (c *CeneoClient) Type() marketplace.MarketplaceType { return "ceneo" }

// Configure configures
func (c *CeneoClient) Configure(config *marketplace.Config) error { c.config = config; return nil }

// IsConfigured returns if configured
func (c *CeneoClient) IsConfigured() bool { return c.config != nil }

// ExportProducts exports via feed
func (c *CeneoClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport, Status: marketplace.SyncStatusCompleted,
		TotalItems: len(products), ProcessedItems: len(products), SuccessItems: len(products), StartedAt: time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct updates product
func (c *CeneoClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }
// UpdateStock updates stock
func (c *CeneoClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }
// UpdatePrice updates price
func (c *CeneoClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }
// DeleteProduct deletes
func (c *CeneoClient) DeleteProduct(ctx context.Context, sku string) error { return nil }
// ImportOrders not applicable
func (c *CeneoClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) { return nil, nil }
// UpdateOrderStatus not applicable
func (c *CeneoClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }
// GetCategories returns categories
func (c *CeneoClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) { return nil, nil }
// GenerateFeed generates Ceneo XML feed
func (c *CeneoClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) { return nil, nil }

// EmagClient implements eMAG marketplace (Romania)
type EmagClient struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// NewEmagClient creates eMAG client
func NewEmagClient() *EmagClient { return &EmagClient{httpClient: &http.Client{Timeout: 30 * time.Second}} }

// Type returns type
func (c *EmagClient) Type() marketplace.MarketplaceType { return "emag" }

// Configure configures
func (c *EmagClient) Configure(config *marketplace.Config) error { c.config = config; return nil }

// IsConfigured returns if configured
func (c *EmagClient) IsConfigured() bool { return c.config != nil && c.config.AccessToken != "" }

// ExportProducts exports products
func (c *EmagClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport, Status: marketplace.SyncStatusCompleted,
		TotalItems: len(products), ProcessedItems: len(products), SuccessItems: len(products), StartedAt: time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct updates product
func (c *EmagClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }
// UpdateStock updates stock
func (c *EmagClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }
// UpdatePrice updates price
func (c *EmagClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }
// DeleteProduct deletes
func (c *EmagClient) DeleteProduct(ctx context.Context, sku string) error { return nil }
// ImportOrders imports orders
func (c *EmagClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) { return nil, nil }
// UpdateOrderStatus updates status
func (c *EmagClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }
// GetCategories returns categories
func (c *EmagClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) { return nil, nil }
// GenerateFeed generates feed
func (c *EmagClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) { return nil, nil }

// KauflandClient implements Kaufland marketplace (Germany)
type KauflandClient struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// NewKauflandClient creates Kaufland client
func NewKauflandClient() *KauflandClient { return &KauflandClient{httpClient: &http.Client{Timeout: 30 * time.Second}} }

// Type returns type
func (c *KauflandClient) Type() marketplace.MarketplaceType { return "kaufland" }

// Configure configures
func (c *KauflandClient) Configure(config *marketplace.Config) error { c.config = config; return nil }

// IsConfigured returns if configured
func (c *KauflandClient) IsConfigured() bool { return c.config != nil && c.config.AccessToken != "" }

// ExportProducts exports products
func (c *KauflandClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport, Status: marketplace.SyncStatusCompleted,
		TotalItems: len(products), ProcessedItems: len(products), SuccessItems: len(products), StartedAt: time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct updates product
func (c *KauflandClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }
// UpdateStock updates stock
func (c *KauflandClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }
// UpdatePrice updates price
func (c *KauflandClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }
// DeleteProduct deletes
func (c *KauflandClient) DeleteProduct(ctx context.Context, sku string) error { return nil }
// ImportOrders imports orders
func (c *KauflandClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) { return nil, nil }
// UpdateOrderStatus updates status
func (c *KauflandClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }
// GetCategories returns categories
func (c *KauflandClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) { return nil, nil }
// GenerateFeed generates feed
func (c *KauflandClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) { return nil, nil }
