package feeds

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"html"
	"strings"
	"time"

	"core/internal/marketplace"
)

// YML (Yandex Market Language) feed generator
// Used by: Prom.ua, Rozetka, Hotline, Price.ua, etc.

// YMLCatalog represents the root YML catalog
type YMLCatalog struct {
	XMLName xml.Name `xml:"yml_catalog"`
	Date    string   `xml:"date,attr"`
	Shop    YMLShop  `xml:"shop"`
}

// YMLShop represents shop information
type YMLShop struct {
	Name         string          `xml:"name"`
	Company      string          `xml:"company"`
	URL          string          `xml:"url"`
	Platform     string          `xml:"platform,omitempty"`
	Version      string          `xml:"version,omitempty"`
	Currencies   YMLCurrencies   `xml:"currencies"`
	Categories   YMLCategories   `xml:"categories"`
	DeliveryOpts []YMLDelivery   `xml:"delivery-options>option,omitempty"`
	Offers       YMLOffers       `xml:"offers"`
}

// YMLCurrencies represents currencies
type YMLCurrencies struct {
	Currency []YMLCurrency `xml:"currency"`
}

// YMLCurrency represents a currency
type YMLCurrency struct {
	ID   string `xml:"id,attr"`
	Rate string `xml:"rate,attr"`
}

// YMLCategories represents categories
type YMLCategories struct {
	Category []YMLCategory `xml:"category"`
}

// YMLCategory represents a category
type YMLCategory struct {
	ID       string `xml:"id,attr"`
	ParentID string `xml:"parentId,attr,omitempty"`
	Name     string `xml:",chardata"`
}

// YMLDelivery represents delivery option
type YMLDelivery struct {
	Cost        string `xml:"cost,attr"`
	Days        string `xml:"days,attr"`
	OrderBefore string `xml:"order-before,attr,omitempty"`
}

// YMLOffers represents offers
type YMLOffers struct {
	Offer []YMLOffer `xml:"offer"`
}

// YMLOffer represents a product offer
type YMLOffer struct {
	ID              string      `xml:"id,attr"`
	Available       string      `xml:"available,attr"`
	Type            string      `xml:"type,attr,omitempty"`
	URL             string      `xml:"url,omitempty"`
	Price           float64     `xml:"price"`
	OldPrice        float64     `xml:"oldprice,omitempty"`
	CurrencyID      string      `xml:"currencyId"`
	CategoryID      string      `xml:"categoryId"`
	Pictures        []string    `xml:"picture,omitempty"`
	Delivery        string      `xml:"delivery,omitempty"`
	Pickup          string      `xml:"pickup,omitempty"`
	Store           string      `xml:"store,omitempty"`
	Name            string      `xml:"name,omitempty"`
	TypePrefix      string      `xml:"typePrefix,omitempty"`
	Vendor          string      `xml:"vendor,omitempty"`
	VendorCode      string      `xml:"vendorCode,omitempty"`
	Model           string      `xml:"model,omitempty"`
	Description     string      `xml:"description,omitempty"`
	SalesNotes      string      `xml:"sales_notes,omitempty"`
	ManufacturerWarranty string `xml:"manufacturer_warranty,omitempty"`
	CountryOfOrigin string      `xml:"country_of_origin,omitempty"`
	Barcode         string      `xml:"barcode,omitempty"`
	Weight          float64     `xml:"weight,omitempty"`
	Dimensions      string      `xml:"dimensions,omitempty"`
	Params          []YMLParam  `xml:"param,omitempty"`
	QuantityInStock int         `xml:"quantity_in_stock,omitempty"`
}

// YMLParam represents a product parameter
type YMLParam struct {
	Name  string `xml:"name,attr"`
	Unit  string `xml:"unit,attr,omitempty"`
	Value string `xml:",chardata"`
}

// YMLConfig holds YML feed configuration
type YMLConfig struct {
	ShopName     string
	CompanyName  string
	ShopURL      string
	Currency     string
	DeliveryCost float64
	DeliveryDays int
	Platform     string
	Version      string
}

// DefaultYMLConfig returns default YML configuration
func DefaultYMLConfig() *YMLConfig {
	return &YMLConfig{
		ShopName:     "Shop",
		CompanyName:  "Company",
		ShopURL:      "https://shop.example.com",
		Currency:     "UAH",
		DeliveryCost: 0,
		DeliveryDays: 3,
		Platform:     "Shop Platform",
		Version:      "1.0",
	}
}

// YMLGenerator generates YML feeds
type YMLGenerator struct {
	config *YMLConfig
}

// NewYMLGenerator creates a new YML generator
func NewYMLGenerator(config *YMLConfig) *YMLGenerator {
	if config == nil {
		config = DefaultYMLConfig()
	}
	return &YMLGenerator{config: config}
}

// Generate generates YML feed from products
func (g *YMLGenerator) Generate(products []*marketplace.Product, categories []marketplace.Category) ([]byte, error) {
	catalog := &YMLCatalog{
		Date: time.Now().Format("2006-01-02 15:04"),
		Shop: YMLShop{
			Name:     g.config.ShopName,
			Company:  g.config.CompanyName,
			URL:      g.config.ShopURL,
			Platform: g.config.Platform,
			Version:  g.config.Version,
			Currencies: YMLCurrencies{
				Currency: []YMLCurrency{
					{ID: g.config.Currency, Rate: "1"},
				},
			},
			Categories: g.buildCategories(categories),
			DeliveryOpts: []YMLDelivery{
				{
					Cost: fmt.Sprintf("%.0f", g.config.DeliveryCost),
					Days: fmt.Sprintf("%d", g.config.DeliveryDays),
				},
			},
			Offers: g.buildOffers(products),
		},
	}

	var buf bytes.Buffer
	buf.WriteString(xml.Header)

	encoder := xml.NewEncoder(&buf)
	encoder.Indent("", "  ")

	if err := encoder.Encode(catalog); err != nil {
		return nil, fmt.Errorf("failed to encode YML: %w", err)
	}

	return buf.Bytes(), nil
}

func (g *YMLGenerator) buildCategories(categories []marketplace.Category) YMLCategories {
	result := YMLCategories{
		Category: make([]YMLCategory, 0, len(categories)),
	}

	for _, cat := range categories {
		result.Category = append(result.Category, YMLCategory{
			ID:       cat.ID,
			ParentID: cat.ParentID,
			Name:     cat.Name,
		})
	}

	return result
}

func (g *YMLGenerator) buildOffers(products []*marketplace.Product) YMLOffers {
	offers := YMLOffers{
		Offer: make([]YMLOffer, 0, len(products)),
	}

	for _, p := range products {
		if !p.IsActive {
			continue
		}

		offer := YMLOffer{
			ID:         p.SKU,
			Available:  boolToYML(p.IsAvailable && p.Quantity > 0),
			URL:        p.URL,
			Price:      p.Price,
			CurrencyID: g.config.Currency,
			CategoryID: p.CategoryID,
			Pictures:   p.Images,
			Delivery:   "true",
			Name:       html.EscapeString(p.Name),
			Vendor:     p.Brand,
			VendorCode: p.SKU,
			Description: truncateDescription(html.EscapeString(p.Description), 3000),
			QuantityInStock: p.Quantity,
		}

		if p.OldPrice > p.Price {
			offer.OldPrice = p.OldPrice
		}

		if p.Weight > 0 {
			offer.Weight = p.Weight
		}

		if p.Dimensions != nil {
			offer.Dimensions = fmt.Sprintf("%.1f/%.1f/%.1f",
				p.Dimensions.Length, p.Dimensions.Width, p.Dimensions.Height)
		}

		if p.Warranty > 0 {
			offer.ManufacturerWarranty = "true"
		}

		// Add attributes as params
		for name, value := range p.Attributes {
			offer.Params = append(offer.Params, YMLParam{
				Name:  name,
				Value: value,
			})
		}

		offers.Offer = append(offers.Offer, offer)
	}

	return offers
}

func boolToYML(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

func truncateDescription(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// GenerateSimpleFeed generates a simple YML feed without categories
func (g *YMLGenerator) GenerateSimpleFeed(products []*marketplace.Product) ([]byte, error) {
	// Extract unique categories from products
	categoryMap := make(map[string]bool)
	categories := make([]marketplace.Category, 0)

	for _, p := range products {
		if !categoryMap[p.CategoryID] {
			categoryMap[p.CategoryID] = true
			categories = append(categories, marketplace.Category{
				ID:   p.CategoryID,
				Name: p.CategoryPath,
			})
		}
	}

	return g.Generate(products, categories)
}

// GoogleMerchantFeed generates Google Merchant Center feed (RSS 2.0 with g: namespace)
type GoogleMerchantFeed struct {
	XMLName xml.Name          `xml:"rss"`
	Version string            `xml:"version,attr"`
	NS      string            `xml:"xmlns:g,attr"`
	Channel GoogleMerchantChannel `xml:"channel"`
}

// GoogleMerchantChannel represents channel
type GoogleMerchantChannel struct {
	Title       string                `xml:"title"`
	Link        string                `xml:"link"`
	Description string                `xml:"description"`
	Items       []GoogleMerchantItem  `xml:"item"`
}

// GoogleMerchantItem represents a product item
type GoogleMerchantItem struct {
	ID              string  `xml:"g:id"`
	Title           string  `xml:"title"`
	Description     string  `xml:"description"`
	Link            string  `xml:"link"`
	ImageLink       string  `xml:"g:image_link"`
	AdditionalImages []string `xml:"g:additional_image_link,omitempty"`
	Availability    string  `xml:"g:availability"`
	Price           string  `xml:"g:price"`
	SalePrice       string  `xml:"g:sale_price,omitempty"`
	Brand           string  `xml:"g:brand,omitempty"`
	GTIN            string  `xml:"g:gtin,omitempty"`
	MPN             string  `xml:"g:mpn,omitempty"`
	Condition       string  `xml:"g:condition"`
	ProductType     string  `xml:"g:product_type,omitempty"`
	GoogleCategory  string  `xml:"g:google_product_category,omitempty"`
	Shipping        string  `xml:"g:shipping,omitempty"`
}

// GoogleFeedGenerator generates Google Merchant feeds
type GoogleFeedGenerator struct {
	shopURL  string
	currency string
}

// NewGoogleFeedGenerator creates a new Google feed generator
func NewGoogleFeedGenerator(shopURL, currency string) *GoogleFeedGenerator {
	return &GoogleFeedGenerator{
		shopURL:  shopURL,
		currency: currency,
	}
}

// Generate generates Google Merchant feed
func (g *GoogleFeedGenerator) Generate(products []*marketplace.Product) ([]byte, error) {
	feed := &GoogleMerchantFeed{
		Version: "2.0",
		NS:      "http://base.google.com/ns/1.0",
		Channel: GoogleMerchantChannel{
			Title:       "Shop Products",
			Link:        g.shopURL,
			Description: "Product feed",
			Items:       make([]GoogleMerchantItem, 0, len(products)),
		},
	}

	for _, p := range products {
		if !p.IsActive {
			continue
		}

		availability := "out of stock"
		if p.IsAvailable && p.Quantity > 0 {
			availability = "in stock"
		}

		item := GoogleMerchantItem{
			ID:           p.SKU,
			Title:        p.Name,
			Description:  truncateDescription(p.Description, 5000),
			Link:         p.URL,
			Availability: availability,
			Price:        fmt.Sprintf("%.2f %s", p.Price, g.currency),
			Brand:        p.Brand,
			MPN:          p.SKU,
			Condition:    "new",
			ProductType:  p.CategoryPath,
		}

		if len(p.Images) > 0 {
			item.ImageLink = p.Images[0]
			if len(p.Images) > 1 {
				item.AdditionalImages = p.Images[1:]
			}
		}

		if p.OldPrice > p.Price {
			item.SalePrice = fmt.Sprintf("%.2f %s", p.Price, g.currency)
			item.Price = fmt.Sprintf("%.2f %s", p.OldPrice, g.currency)
		}

		feed.Channel.Items = append(feed.Channel.Items, item)
	}

	var buf bytes.Buffer
	buf.WriteString(xml.Header)

	encoder := xml.NewEncoder(&buf)
	encoder.Indent("", "  ")

	if err := encoder.Encode(feed); err != nil {
		return nil, fmt.Errorf("failed to encode Google feed: %w", err)
	}

	return buf.Bytes(), nil
}

// FacebookCatalogFeed generates Facebook/Instagram catalog feed (CSV or XML)
type FacebookCatalogFeed struct {
	shopURL  string
	currency string
}

// NewFacebookFeedGenerator creates Facebook feed generator
func NewFacebookFeedGenerator(shopURL, currency string) *FacebookCatalogFeed {
	return &FacebookCatalogFeed{
		shopURL:  shopURL,
		currency: currency,
	}
}

// GenerateCSV generates Facebook catalog CSV feed
func (f *FacebookCatalogFeed) GenerateCSV(products []*marketplace.Product) ([]byte, error) {
	var buf bytes.Buffer

	// Header
	buf.WriteString("id,title,description,availability,condition,price,link,image_link,brand,google_product_category\n")

	for _, p := range products {
		if !p.IsActive {
			continue
		}

		availability := "out of stock"
		if p.IsAvailable && p.Quantity > 0 {
			availability = "in stock"
		}

		imageLink := ""
		if len(p.Images) > 0 {
			imageLink = p.Images[0]
		}

		line := fmt.Sprintf("%s,%s,%s,%s,new,%.2f %s,%s,%s,%s,%s\n",
			csvEscape(p.SKU),
			csvEscape(p.Name),
			csvEscape(truncateDescription(p.Description, 5000)),
			availability,
			p.Price, f.currency,
			csvEscape(p.URL),
			csvEscape(imageLink),
			csvEscape(p.Brand),
			csvEscape(p.CategoryPath),
		)
		buf.WriteString(line)
	}

	return buf.Bytes(), nil
}

func csvEscape(s string) string {
	if strings.ContainsAny(s, ",\"\n") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}
