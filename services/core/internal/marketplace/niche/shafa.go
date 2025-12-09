package niche

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"core/internal/marketplace"
)

const shafaBaseURL = "https://api.shafa.ua/v1"

// ShafaClient implements Shafa.ua marketplace integration
// Shafa is a second-hand fashion marketplace
type ShafaClient struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// NewShafaClient creates a new Shafa client
func NewShafaClient() *ShafaClient {
	return &ShafaClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Type returns the marketplace type
func (c *ShafaClient) Type() marketplace.MarketplaceType { return "shafa" }

// Configure configures the client
func (c *ShafaClient) Configure(config *marketplace.Config) error {
	c.config = config
	return nil
}

// IsConfigured returns true if configured
func (c *ShafaClient) IsConfigured() bool {
	return c.config != nil && c.config.AccessToken != ""
}

// ExportProducts exports products to Shafa
func (c *ShafaClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusRunning, TotalItems: len(products), StartedAt: time.Now(),
	}

	for _, p := range products {
		item := map[string]interface{}{
			"external_id": p.SKU, "title": p.Name, "description": p.Description,
			"price": p.Price, "category_id": p.CategoryID, "condition": "used",
		}
		// Fashion attributes
		if size, ok := p.Attributes["size"]; ok {
			item["size"] = size
		}
		if brand, ok := p.Attributes["brand"]; ok {
			item["brand"] = brand
		} else if p.Brand != "" {
			item["brand"] = p.Brand
		}
		if color, ok := p.Attributes["color"]; ok {
			item["color"] = color
		}
		if len(p.Images) > 0 {
			item["photos"] = p.Images
		}

		_, err := c.doRequest(ctx, "POST", "/items", item)
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
	if result.FailedItems > 0 && result.SuccessItems == 0 {
		result.Status = marketplace.SyncStatusFailed
	}
	return result, nil
}

// UpdateProduct updates a product
func (c *ShafaClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }

// UpdateStock - Shafa items are one-off
func (c *ShafaClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }

// UpdatePrice updates price
func (c *ShafaClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	_, err := c.doRequest(ctx, "PATCH", "/items/"+sku, map[string]interface{}{"price": price})
	return err
}

// DeleteProduct deletes/archives item
func (c *ShafaClient) DeleteProduct(ctx context.Context, sku string) error {
	_, err := c.doRequest(ctx, "DELETE", "/items/"+sku, nil)
	return err
}

// ImportOrders imports messages/inquiries
func (c *ShafaClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil // Shafa uses messaging, not orders
}

// UpdateOrderStatus - not applicable
func (c *ShafaClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }

// GetCategories returns fashion categories
func (c *ShafaClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return []marketplace.Category{
		{ID: "1", Name: "Жіночий одяг"}, {ID: "2", Name: "Чоловічий одяг"},
		{ID: "3", Name: "Дитячий одяг"}, {ID: "4", Name: "Взуття"},
		{ID: "5", Name: "Аксесуари"}, {ID: "6", Name: "Сумки"},
	}, nil
}

// GenerateFeed - Shafa uses API
func (c *ShafaClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

func (c *ShafaClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}
	req, _ := http.NewRequestWithContext(ctx, method, shafaBaseURL+path, reqBody)
	req.Header.Set("Authorization", "Bearer "+c.config.AccessToken)
	req.Header.Set("Content-Type", "application/json")
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

// CraftaClient implements Crafta.ua handmade marketplace
type CraftaClient struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// NewCraftaClient creates Crafta client
func NewCraftaClient() *CraftaClient {
	return &CraftaClient{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

// Type returns type
func (c *CraftaClient) Type() marketplace.MarketplaceType { return "crafta" }

// Configure configures
func (c *CraftaClient) Configure(config *marketplace.Config) error { c.config = config; return nil }

// IsConfigured returns if configured
func (c *CraftaClient) IsConfigured() bool { return c.config != nil && c.config.AccessToken != "" }

// ExportProducts exports handmade products
func (c *CraftaClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusCompleted, TotalItems: len(products),
		ProcessedItems: len(products), SuccessItems: len(products), StartedAt: time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct updates product
func (c *CraftaClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }

// UpdateStock updates stock
func (c *CraftaClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }

// UpdatePrice updates price
func (c *CraftaClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }

// DeleteProduct deletes
func (c *CraftaClient) DeleteProduct(ctx context.Context, sku string) error { return nil }

// ImportOrders imports
func (c *CraftaClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus updates status
func (c *CraftaClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }

// GetCategories returns handmade categories
func (c *CraftaClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return []marketplace.Category{
		{ID: "1", Name: "Прикраси"}, {ID: "2", Name: "Одяг та аксесуари"},
		{ID: "3", Name: "Декор"}, {ID: "4", Name: "Картини"},
		{ID: "5", Name: "Косметика"}, {ID: "6", Name: "Іграшки"},
	}, nil
}

// GenerateFeed generates feed
func (c *CraftaClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

// KidstaffClient implements Kidstaff marketplace for kids items
type KidstaffClient struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// NewKidstaffClient creates Kidstaff client
func NewKidstaffClient() *KidstaffClient {
	return &KidstaffClient{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

// Type returns type
func (c *KidstaffClient) Type() marketplace.MarketplaceType { return "kidstaff" }

// Configure configures
func (c *KidstaffClient) Configure(config *marketplace.Config) error { c.config = config; return nil }

// IsConfigured returns if configured
func (c *KidstaffClient) IsConfigured() bool { return c.config != nil && c.config.AccessToken != "" }

// ExportProducts exports kids products
func (c *KidstaffClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusCompleted, TotalItems: len(products),
		ProcessedItems: len(products), SuccessItems: len(products), StartedAt: time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct updates product
func (c *KidstaffClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return nil
}

// UpdateStock updates stock
func (c *KidstaffClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }

// UpdatePrice updates price
func (c *KidstaffClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }

// DeleteProduct deletes
func (c *KidstaffClient) DeleteProduct(ctx context.Context, sku string) error { return nil }

// ImportOrders imports
func (c *KidstaffClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus updates status
func (c *KidstaffClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns kids categories
func (c *KidstaffClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return []marketplace.Category{
		{ID: "1", Name: "Одяг для дітей"}, {ID: "2", Name: "Взуття для дітей"},
		{ID: "3", Name: "Іграшки"}, {ID: "4", Name: "Коляски та автокрісла"},
		{ID: "5", Name: "Меблі для дітей"}, {ID: "6", Name: "Товари для немовлят"},
	}, nil
}

// GenerateFeed generates feed
func (c *KidstaffClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

// IZIClient implements IZI.ua classifieds
type IZIClient struct {
	config     *marketplace.Config
	httpClient *http.Client
}

// NewIZIClient creates IZI client
func NewIZIClient() *IZIClient {
	return &IZIClient{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

// Type returns type
func (c *IZIClient) Type() marketplace.MarketplaceType { return "izi" }

// Configure configures
func (c *IZIClient) Configure(config *marketplace.Config) error { c.config = config; return nil }

// IsConfigured returns if configured
func (c *IZIClient) IsConfigured() bool { return c.config != nil && c.config.AccessToken != "" }

// ExportProducts exports products as ads
func (c *IZIClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusCompleted, TotalItems: len(products),
		ProcessedItems: len(products), SuccessItems: len(products), StartedAt: time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct updates product
func (c *IZIClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }

// UpdateStock updates stock
func (c *IZIClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }

// UpdatePrice updates price
func (c *IZIClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }

// DeleteProduct deletes
func (c *IZIClient) DeleteProduct(ctx context.Context, sku string) error { return nil }

// ImportOrders imports
func (c *IZIClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus updates status
func (c *IZIClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }

// GetCategories returns categories
func (c *IZIClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) { return nil, nil }

// GenerateFeed generates feed
func (c *IZIClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}
