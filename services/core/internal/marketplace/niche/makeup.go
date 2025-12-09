package niche

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"time"

	"core/internal/marketplace"
	"core/internal/marketplace/feeds"
)

// MakeupClient implements Makeup.ua feed generator
// Makeup.ua is a cosmetics marketplace that uses YML-based feeds
type MakeupClient struct {
	config  *marketplace.Config
	feedGen *feeds.YMLGenerator
}

// NewMakeupClient creates a new Makeup.ua client
func NewMakeupClient() *MakeupClient {
	return &MakeupClient{}
}

// Type returns the marketplace type
func (c *MakeupClient) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceMakeup
}

// Configure configures the client
func (c *MakeupClient) Configure(config *marketplace.Config) error {
	c.config = config

	c.feedGen = feeds.NewYMLGenerator(&feeds.YMLConfig{
		ShopName:     "Shop",
		CompanyName:  "Company",
		ShopURL:      config.BaseURL,
		Currency:     "UAH",
		DeliveryCost: 0,
		DeliveryDays: 2,
	})

	return nil
}

// IsConfigured returns true if the client is configured
func (c *MakeupClient) IsConfigured() bool {
	return c.config != nil
}

// ExportProducts - Makeup uses feed uploads, not API
func (c *MakeupClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceMakeup,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusCompleted,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

	// Makeup.ua typically fetches the feed from your URL
	// This just generates the feed
	_, err := c.GenerateFeed(ctx, products)
	if err != nil {
		result.Status = marketplace.SyncStatusFailed
		result.Errors = append(result.Errors, marketplace.SyncError{
			Message: err.Error(),
		})
	} else {
		result.SuccessItems = len(products)
		result.ProcessedItems = len(products)
	}

	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// UpdateProduct - not supported, use feed
func (c *MakeupClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return nil
}

// UpdateStock - not supported, use feed
func (c *MakeupClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	return nil
}

// UpdatePrice - not supported, use feed
func (c *MakeupClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	return nil
}

// DeleteProduct - not supported, use feed
func (c *MakeupClient) DeleteProduct(ctx context.Context, sku string) error {
	return nil
}

// ImportOrders - Makeup doesn't provide order API
func (c *MakeupClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus - not supported
func (c *MakeupClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns cosmetics categories
func (c *MakeupClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	// Makeup.ua cosmetics categories
	return []marketplace.Category{
		{ID: "1", Name: "Парфумерія"},
		{ID: "2", Name: "Макіяж"},
		{ID: "3", Name: "Догляд за обличчям"},
		{ID: "4", Name: "Догляд за тілом"},
		{ID: "5", Name: "Догляд за волоссям"},
		{ID: "6", Name: "Манікюр та педикюр"},
		{ID: "7", Name: "Аксесуари"},
		{ID: "8", Name: "Для чоловіків"},
		{ID: "9", Name: "Органічна косметика"},
		{ID: "10", Name: "Дитяча косметика"},
	}, nil
}

// GenerateFeed generates Makeup.ua-specific YML feed
func (c *MakeupClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.GenerateMakeupFeed(products)
}

// GenerateMakeupFeed generates cosmetics-optimized feed
func (c *MakeupClient) GenerateMakeupFeed(products []*marketplace.Product) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString(xml.Header)
	buf.WriteString(fmt.Sprintf("<yml_catalog date=\"%s\">\n", time.Now().Format("2006-01-02 15:04")))
	buf.WriteString("<shop>\n")
	buf.WriteString(fmt.Sprintf("  <name>%s</name>\n", c.config.ShopID))
	buf.WriteString(fmt.Sprintf("  <company>%s</company>\n", c.config.ShopID))
	buf.WriteString(fmt.Sprintf("  <url>%s</url>\n", c.config.BaseURL))
	buf.WriteString("  <currencies>\n")
	buf.WriteString("    <currency id=\"UAH\" rate=\"1\"/>\n")
	buf.WriteString("  </currencies>\n")

	// Categories
	categoryMap := make(map[string]bool)
	buf.WriteString("  <categories>\n")
	for _, p := range products {
		if !categoryMap[p.CategoryID] {
			categoryMap[p.CategoryID] = true
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

		buf.WriteString("      <delivery>true</delivery>\n")
		buf.WriteString(fmt.Sprintf("      <name>%s</name>\n", escapeXML(p.Name)))
		buf.WriteString(fmt.Sprintf("      <vendor>%s</vendor>\n", escapeXML(p.Brand)))
		buf.WriteString(fmt.Sprintf("      <vendorCode>%s</vendorCode>\n", escapeXML(p.SKU)))
		buf.WriteString(fmt.Sprintf("      <description><![CDATA[%s]]></description>\n", p.Description))
		buf.WriteString(fmt.Sprintf("      <stock_quantity>%d</stock_quantity>\n", p.Quantity))

		// Cosmetics-specific attributes
		for name, value := range p.Attributes {
			buf.WriteString(fmt.Sprintf("      <param name=\"%s\">%s</param>\n",
				escapeXML(name), escapeXML(value)))
		}

		// Country of origin is important for cosmetics
		if country, ok := p.Attributes["country"]; ok {
			buf.WriteString(fmt.Sprintf("      <country_of_origin>%s</country_of_origin>\n",
				escapeXML(country)))
		}

		// Volume/weight for cosmetics
		if volume, ok := p.Attributes["volume"]; ok {
			buf.WriteString(fmt.Sprintf("      <param name=\"Об'єм\">%s</param>\n",
				escapeXML(volume)))
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
