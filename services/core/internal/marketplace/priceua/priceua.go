package priceua

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"time"

	"core/internal/marketplace"
)

// Client implements Price.ua feed generator
// Price.ua is a major Ukrainian price comparison site
type Client struct {
	config *marketplace.Config
}

// New creates a new Price.ua client
func New() *Client {
	return &Client{}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "priceua"
}

// Configure configures the client
func (c *Client) Configure(config *marketplace.Config) error {
	c.config = config
	return nil
}

// IsConfigured returns true if the client is configured
func (c *Client) IsConfigured() bool {
	return c.config != nil && c.config.ShopID != ""
}

// ExportProducts - Price.ua fetches feed from URL
func (c *Client) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace:    c.Type(),
		Direction:      marketplace.SyncExport,
		Status:         marketplace.SyncStatusCompleted,
		TotalItems:     len(products),
		ProcessedItems: len(products),
		SuccessItems:   len(products),
		StartedAt:      time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct - not supported, use feed
func (c *Client) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return nil
}

// UpdateStock - not supported
func (c *Client) UpdateStock(ctx context.Context, sku string, quantity int) error {
	return nil
}

// UpdatePrice - not supported
func (c *Client) UpdatePrice(ctx context.Context, sku string, price float64) error {
	return nil
}

// DeleteProduct - not supported
func (c *Client) DeleteProduct(ctx context.Context, sku string) error {
	return nil
}

// ImportOrders - Price.ua redirects to shop
func (c *Client) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus - not supported
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns categories
func (c *Client) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return nil, nil
}

// GenerateFeed generates Price.ua XML feed
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.GeneratePriceUAFeed(products)
}

// PriceUAFeed represents the Price.ua feed structure
type PriceUAFeed struct {
	XMLName xml.Name         `xml:"price"`
	Date    string           `xml:"date,attr"`
	Items   []PriceUAProduct `xml:"item"`
}

// PriceUAProduct represents a product in Price.ua feed
type PriceUAProduct struct {
	ID           string  `xml:"id"`
	Name         string  `xml:"name"`
	Price        float64 `xml:"price"`
	PriceOld     float64 `xml:"priceold,omitempty"`
	Currency     string  `xml:"currency"`
	CategoryID   string  `xml:"categoryId"`
	Category     string  `xml:"category"`
	Vendor       string  `xml:"vendor,omitempty"`
	Model        string  `xml:"model,omitempty"`
	Description  string  `xml:"description"`
	URL          string  `xml:"url"`
	Image        string  `xml:"image,omitempty"`
	Stock        string  `xml:"stock"`
	Warranty     int     `xml:"warranty,omitempty"`
	Params       []Param `xml:"param,omitempty"`
}

// Param represents a product parameter
type Param struct {
	Name  string `xml:"name,attr"`
	Value string `xml:",chardata"`
}

// GeneratePriceUAFeed generates Price.ua specific XML feed
func (c *Client) GeneratePriceUAFeed(products []*marketplace.Product) ([]byte, error) {
	feed := &PriceUAFeed{
		Date:  time.Now().Format("2006-01-02 15:04"),
		Items: make([]PriceUAProduct, 0, len(products)),
	}

	for _, p := range products {
		if !p.IsActive {
			continue
		}

		stock := "Немає в наявності"
		if p.IsAvailable && p.Quantity > 0 {
			if p.Quantity > 10 {
				stock = "В наявності"
			} else {
				stock = "Закінчується"
			}
		}

		item := PriceUAProduct{
			ID:          p.SKU,
			Name:        p.Name,
			Price:       p.Price,
			Currency:    "UAH",
			CategoryID:  p.CategoryID,
			Category:    p.CategoryPath,
			Vendor:      p.Brand,
			Model:       p.SKU,
			Description: truncateDesc(p.Description, 5000),
			URL:         p.URL,
			Stock:       stock,
			Warranty:    p.Warranty,
		}

		if p.OldPrice > p.Price {
			item.PriceOld = p.OldPrice
		}

		if len(p.Images) > 0 {
			item.Image = p.Images[0]
		}

		// Add parameters
		for name, value := range p.Attributes {
			item.Params = append(item.Params, Param{
				Name:  name,
				Value: value,
			})
		}

		feed.Items = append(feed.Items, item)
	}

	var buf bytes.Buffer
	buf.WriteString(xml.Header)

	encoder := xml.NewEncoder(&buf)
	encoder.Indent("", "  ")

	if err := encoder.Encode(feed); err != nil {
		return nil, fmt.Errorf("failed to encode Price.ua feed: %w", err)
	}

	return buf.Bytes(), nil
}

func truncateDesc(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
