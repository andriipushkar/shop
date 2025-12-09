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

// YakabooClient implements Yakaboo.ua feed generator
// Yakaboo.ua is a books and media marketplace that uses specialized feeds
type YakabooClient struct {
	config  *marketplace.Config
	feedGen *feeds.YMLGenerator
}

// NewYakabooClient creates a new Yakaboo.ua client
func NewYakabooClient() *YakabooClient {
	return &YakabooClient{}
}

// Type returns the marketplace type
func (c *YakabooClient) Type() marketplace.MarketplaceType {
	return marketplace.MarketplaceYakaboo
}

// Configure configures the client
func (c *YakabooClient) Configure(config *marketplace.Config) error {
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
func (c *YakabooClient) IsConfigured() bool {
	return c.config != nil
}

// ExportProducts - Yakaboo uses feed uploads
func (c *YakabooClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: marketplace.MarketplaceYakaboo,
		Direction:   marketplace.SyncExport,
		Status:      marketplace.SyncStatusCompleted,
		TotalItems:  len(products),
		StartedAt:   time.Now(),
	}

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
func (c *YakabooClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return nil
}

// UpdateStock - not supported, use feed
func (c *YakabooClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	return nil
}

// UpdatePrice - not supported, use feed
func (c *YakabooClient) UpdatePrice(ctx context.Context, sku string, price float64) error {
	return nil
}

// DeleteProduct - not supported, use feed
func (c *YakabooClient) DeleteProduct(ctx context.Context, sku string) error {
	return nil
}

// ImportOrders - Yakaboo doesn't provide public order API
func (c *YakabooClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus - not supported
func (c *YakabooClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns book categories
func (c *YakabooClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	// Yakaboo book categories
	return []marketplace.Category{
		{ID: "1", Name: "Художня література"},
		{ID: "2", Name: "Нехудожня література"},
		{ID: "3", Name: "Дитячі книги"},
		{ID: "4", Name: "Підручники та навчальна література"},
		{ID: "5", Name: "Книги іноземними мовами"},
		{ID: "6", Name: "Комікси та манга"},
		{ID: "7", Name: "Канцтовари"},
		{ID: "8", Name: "Ігри та іграшки"},
		{ID: "9", Name: "Подарунки"},
		{ID: "10", Name: "Аудіокниги"},
		{ID: "11", Name: "Електронні книги"},
	}, nil
}

// GenerateFeed generates Yakaboo-specific feed
func (c *YakabooClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return c.GenerateYakabooFeed(products)
}

// GenerateYakabooFeed generates books-optimized feed
func (c *YakabooClient) GenerateYakabooFeed(products []*marketplace.Product) ([]byte, error) {
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

	// Offers for books
	buf.WriteString("  <offers>\n")
	for _, p := range products {
		if !p.IsActive {
			continue
		}

		available := "false"
		if p.IsAvailable && p.Quantity > 0 {
			available = "true"
		}

		// Books use type="book" offer type
		offerType := ""
		if isBook(p) {
			offerType = " type=\"book\""
		}

		buf.WriteString(fmt.Sprintf("    <offer id=\"%s\" available=\"%s\"%s>\n",
			escapeXML(p.SKU), available, offerType))
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

		// Book-specific fields
		if isBook(p) {
			// Author
			if author, ok := p.Attributes["author"]; ok {
				buf.WriteString(fmt.Sprintf("      <author>%s</author>\n", escapeXML(author)))
			}
			// Publisher
			if publisher, ok := p.Attributes["publisher"]; ok {
				buf.WriteString(fmt.Sprintf("      <publisher>%s</publisher>\n", escapeXML(publisher)))
			}
			// ISBN
			if isbn, ok := p.Attributes["isbn"]; ok {
				buf.WriteString(fmt.Sprintf("      <ISBN>%s</ISBN>\n", escapeXML(isbn)))
			}
			// Year
			if year, ok := p.Attributes["year"]; ok {
				buf.WriteString(fmt.Sprintf("      <year>%s</year>\n", escapeXML(year)))
			}
			// Pages
			if pages, ok := p.Attributes["pages"]; ok {
				buf.WriteString(fmt.Sprintf("      <page_extent>%s</page_extent>\n", escapeXML(pages)))
			}
			// Language
			if lang, ok := p.Attributes["language"]; ok {
				buf.WriteString(fmt.Sprintf("      <language>%s</language>\n", escapeXML(lang)))
			}
			// Binding
			if binding, ok := p.Attributes["binding"]; ok {
				buf.WriteString(fmt.Sprintf("      <binding>%s</binding>\n", escapeXML(binding)))
			}
			// Series
			if series, ok := p.Attributes["series"]; ok {
				buf.WriteString(fmt.Sprintf("      <series>%s</series>\n", escapeXML(series)))
			}
		}

		buf.WriteString(fmt.Sprintf("      <name>%s</name>\n", escapeXML(p.Name)))
		buf.WriteString(fmt.Sprintf("      <vendor>%s</vendor>\n", escapeXML(p.Brand)))
		buf.WriteString(fmt.Sprintf("      <vendorCode>%s</vendorCode>\n", escapeXML(p.SKU)))
		buf.WriteString(fmt.Sprintf("      <description><![CDATA[%s]]></description>\n", p.Description))
		buf.WriteString(fmt.Sprintf("      <stock_quantity>%d</stock_quantity>\n", p.Quantity))

		// Additional params
		for name, value := range p.Attributes {
			// Skip already handled book attributes
			if name == "author" || name == "publisher" || name == "isbn" ||
				name == "year" || name == "pages" || name == "language" ||
				name == "binding" || name == "series" {
				continue
			}
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

// isBook checks if product is a book based on attributes
func isBook(p *marketplace.Product) bool {
	// Check for ISBN attribute
	if _, ok := p.Attributes["isbn"]; ok {
		return true
	}
	// Check for author attribute
	if _, ok := p.Attributes["author"]; ok {
		return true
	}
	return false
}
