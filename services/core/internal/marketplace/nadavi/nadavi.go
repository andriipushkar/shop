package nadavi

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"time"

	"core/internal/marketplace"
)

// Client implements Nadavi.net feed generator
// Nadavi is a Ukrainian price aggregator
type Client struct {
	config *marketplace.Config
}

// New creates a new Nadavi client
func New() *Client {
	return &Client{}
}

// Type returns the marketplace type
func (c *Client) Type() marketplace.MarketplaceType {
	return "nadavi"
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

// ExportProducts - Nadavi fetches feed from URL
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

// UpdateProduct - not supported
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

// ImportOrders - Nadavi redirects to shop
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

// GenerateFeed generates Nadavi XML feed
func (c *Client) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.GenerateNadaviFeed(products)
}

// GenerateNadaviFeed generates Nadavi specific feed
func (c *Client) GenerateNadaviFeed(products []*marketplace.Product) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString(xml.Header)
	buf.WriteString(fmt.Sprintf("<yml_catalog date=\"%s\">\n", time.Now().Format("2006-01-02 15:04")))
	buf.WriteString("<shop>\n")
	buf.WriteString(fmt.Sprintf("  <name>%s</name>\n", escapeXML(c.config.ShopID)))
	buf.WriteString(fmt.Sprintf("  <company>%s</company>\n", escapeXML(c.config.ShopID)))
	buf.WriteString(fmt.Sprintf("  <url>%s</url>\n", escapeXML(c.config.BaseURL)))
	buf.WriteString("  <currencies>\n")
	buf.WriteString("    <currency id=\"UAH\" rate=\"1\"/>\n")
	buf.WriteString("  </currencies>\n")

	// Categories
	categoryMap := make(map[string]string)
	buf.WriteString("  <categories>\n")
	for _, p := range products {
		if _, ok := categoryMap[p.CategoryID]; !ok {
			categoryMap[p.CategoryID] = p.CategoryPath
			buf.WriteString(fmt.Sprintf("    <category id=\"%s\">%s</category>\n",
				escapeXML(p.CategoryID), escapeXML(p.CategoryPath)))
		}
	}
	buf.WriteString("  </categories>\n")

	// Offers
	buf.WriteString("  <offers>\n")
	for _, p := range products {
		if !p.IsActive {
			continue
		}

		available := "false"
		if p.IsAvailable && p.Quantity > 0 {
			available = "true"
		}

		buf.WriteString(fmt.Sprintf("    <offer id=\"%s\" available=\"%s\">\n",
			escapeXML(p.SKU), available))
		buf.WriteString(fmt.Sprintf("      <url>%s</url>\n", escapeXML(p.URL)))
		buf.WriteString(fmt.Sprintf("      <price>%.2f</price>\n", p.Price))

		if p.OldPrice > p.Price {
			buf.WriteString(fmt.Sprintf("      <oldprice>%.2f</oldprice>\n", p.OldPrice))
		}

		buf.WriteString("      <currencyId>UAH</currencyId>\n")
		buf.WriteString(fmt.Sprintf("      <categoryId>%s</categoryId>\n", escapeXML(p.CategoryID)))

		for _, img := range p.Images {
			buf.WriteString(fmt.Sprintf("      <picture>%s</picture>\n", escapeXML(img)))
		}

		buf.WriteString(fmt.Sprintf("      <name>%s</name>\n", escapeXML(p.Name)))
		buf.WriteString(fmt.Sprintf("      <vendor>%s</vendor>\n", escapeXML(p.Brand)))
		buf.WriteString(fmt.Sprintf("      <description><![CDATA[%s]]></description>\n", p.Description))
		buf.WriteString(fmt.Sprintf("      <stock_quantity>%d</stock_quantity>\n", p.Quantity))

		// Nadavi specific: delivery info
		buf.WriteString("      <delivery>true</delivery>\n")
		buf.WriteString("      <local_delivery_cost>0</local_delivery_cost>\n")

		for name, value := range p.Attributes {
			buf.WriteString(fmt.Sprintf("      <param name=\"%s\">%s</param>\n",
				escapeXML(name), escapeXML(value)))
		}

		buf.WriteString("    </offer>\n")
	}
	buf.WriteString("  </offers>\n")
	buf.WriteString("</shop>\n")
	buf.WriteString("</yml_catalog>\n")

	return buf.Bytes(), nil
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
