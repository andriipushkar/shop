package http

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"

	"core/internal/pim"
)

type YMLCatalog struct {
	XMLName xml.Name `xml:"yml_catalog"`
	Date    string   `xml:"date,attr"`
	Shop    Shop     `xml:"shop"`
}

type Shop struct {
	Name       string     `xml:"name"`
	Company    string     `xml:"company"`
	Url        string     `xml:"url"`
	Currencies Currencies `xml:"currencies"`
	Categories Categories `xml:"categories"`
	Offers     Offers     `xml:"offers"`
}

type Currencies struct {
	Currency []Currency `xml:"currency"`
}

type Currency struct {
	ID   string `xml:"id,attr"`
	Rate string `xml:"rate,attr"`
}

type Categories struct {
	Category []CategoryXML `xml:"category"`
}

type CategoryXML struct {
	ID       string `xml:"id,attr"`
	ParentID string `xml:"parentId,attr,omitempty"`
	Name     string `xml:",chardata"`
}

type Offers struct {
	Offer []Offer `xml:"offer"`
}

type Offer struct {
	ID          string   `xml:"id,attr"`
	Available   bool     `xml:"available,attr"`
	URL         string   `xml:"url,omitempty"`
	Name        string   `xml:"name"`
	Price       float64  `xml:"price"`
	OldPrice    float64  `xml:"oldprice,omitempty"`
	CurrencyID  string   `xml:"currencyId"`
	CategoryID  string   `xml:"categoryId"`
	Picture     []string `xml:"picture,omitempty"`
	Vendor      string   `xml:"vendor,omitempty"`
	Description string   `xml:"description"`
	SKU         string   `xml:"vendorCode"`
	Stock       int      `xml:"stock_quantity,omitempty"`
}

// FeedHandler handles feed generation
type FeedHandler struct {
	service *pim.Service
}

// NewFeedHandler creates a new feed handler
func NewFeedHandler(service *pim.Service) *FeedHandler {
	return &FeedHandler{service: service}
}

func (h *Handler) GenerateFeed(w http.ResponseWriter, r *http.Request) {
	products, err := h.service.List(r.Context())
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	catalog := YMLCatalog{
		Date: time.Now().Format("2006-01-02 15:04"),
		Shop: Shop{
			Name:    "MyShop",
			Company: "MyShop LLC",
			Url:     "https://myshop.ua",
			Currencies: Currencies{
				Currency: []Currency{
					{ID: "UAH", Rate: "1"},
				},
			},
		},
	}

	for _, p := range products {
		catalog.Shop.Offers.Offer = append(catalog.Shop.Offers.Offer, Offer{
			ID:          p.ID,
			Available:   true,
			Name:        p.Name,
			Price:       p.Price,
			CurrencyID:  "UAH",
			Description: fmt.Sprintf("%s (%s)", p.Name, p.SKU),
			SKU:         p.SKU,
		})
	}

	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(xml.Header))
	if err := xml.NewEncoder(w).Encode(catalog); err != nil {
		http.Error(w, "Failed to encode XML", http.StatusInternalServerError)
	}
}

// GenerateYMLFeed generates YML/Yandex Market feed
func (h *FeedHandler) GenerateYMLFeed(w http.ResponseWriter, r *http.Request) {
	products, err := h.service.List(r.Context())
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	categories, err := h.service.ListCategories(r.Context())
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	catalog := YMLCatalog{
		Date: time.Now().Format("2006-01-02 15:04"),
		Shop: Shop{
			Name:    "MyShop",
			Company: "MyShop LLC",
			Url:     "https://myshop.ua",
			Currencies: Currencies{
				Currency: []Currency{
					{ID: "UAH", Rate: "1"},
				},
			},
		},
	}

	// Add categories
	for _, c := range categories {
		catalog.Shop.Categories.Category = append(catalog.Shop.Categories.Category, CategoryXML{
			ID:   c.ID,
			Name: c.Name,
		})
	}

	// Add offers
	for _, p := range products {
		// All products are active in feed
		offer := Offer{
			ID:          p.ID,
			Available:   p.Stock > 0,
			URL:         fmt.Sprintf("https://myshop.ua/product/%s", p.ID),
			Name:        p.Name,
			Price:       p.Price,
			CurrencyID:  "UAH",
			CategoryID:  p.CategoryID,
			Description: p.Description,
			SKU:         p.SKU,
			Stock:       p.Stock,
		}

		if p.ImageURL != "" {
			offer.Picture = []string{p.ImageURL}
		}

		catalog.Shop.Offers.Offer = append(catalog.Shop.Offers.Offer, offer)
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(catalog); err != nil {
		http.Error(w, "Failed to encode XML", http.StatusInternalServerError)
	}
}

// GoogleProductFeed represents Google Merchant feed
type GoogleProductFeed struct {
	XMLName xml.Name      `xml:"rss"`
	Version string        `xml:"version,attr"`
	NS      string        `xml:"xmlns:g,attr"`
	Channel GoogleChannel `xml:"channel"`
}

type GoogleChannel struct {
	Title       string        `xml:"title"`
	Link        string        `xml:"link"`
	Description string        `xml:"description"`
	Items       []GoogleItem  `xml:"item"`
}

type GoogleItem struct {
	ID            string  `xml:"g:id"`
	Title         string  `xml:"title"`
	Description   string  `xml:"description"`
	Link          string  `xml:"link"`
	ImageLink     string  `xml:"g:image_link,omitempty"`
	Availability  string  `xml:"g:availability"`
	Price         string  `xml:"g:price"`
	SalePrice     string  `xml:"g:sale_price,omitempty"`
	Brand         string  `xml:"g:brand,omitempty"`
	GTIN          string  `xml:"g:gtin,omitempty"`
	MPN           string  `xml:"g:mpn,omitempty"`
	Condition     string  `xml:"g:condition"`
	ProductType   string  `xml:"g:product_type,omitempty"`
}

// GenerateGoogleFeed generates Google Merchant feed
func (h *FeedHandler) GenerateGoogleFeed(w http.ResponseWriter, r *http.Request) {
	products, err := h.service.List(r.Context())
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	feed := GoogleProductFeed{
		Version: "2.0",
		NS:      "http://base.google.com/ns/1.0",
		Channel: GoogleChannel{
			Title:       "MyShop Products",
			Link:        "https://myshop.ua",
			Description: "Product feed for Google Merchant Center",
		},
	}

	for _, p := range products {
		availability := "in stock"
		if p.Stock <= 0 {
			availability = "out of stock"
		}

		item := GoogleItem{
			ID:           p.ID,
			Title:        p.Name,
			Description:  p.Description,
			Link:         fmt.Sprintf("https://myshop.ua/product/%s", p.ID),
			ImageLink:    p.ImageURL,
			Availability: availability,
			Price:        fmt.Sprintf("%.2f UAH", p.Price),
			MPN:          p.SKU,
			Condition:    "new",
		}

		feed.Channel.Items = append(feed.Channel.Items, item)
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(feed); err != nil {
		http.Error(w, "Failed to encode XML", http.StatusInternalServerError)
	}
}

// FacebookProductFeed represents Facebook Catalog feed
type FacebookProductFeed struct {
	XMLName xml.Name          `xml:"feed"`
	NS      string            `xml:"xmlns,attr"`
	Title   string            `xml:"title"`
	Link    string            `xml:"link"`
	Entries []FacebookEntry   `xml:"entry"`
}

type FacebookEntry struct {
	ID            string `xml:"g:id"`
	Title         string `xml:"title"`
	Description   string `xml:"description"`
	Link          string `xml:"link"`
	ImageLink     string `xml:"g:image_link,omitempty"`
	Availability  string `xml:"g:availability"`
	Price         string `xml:"g:price"`
	Brand         string `xml:"g:brand,omitempty"`
	Condition     string `xml:"g:condition"`
}

// GenerateFacebookFeed generates Facebook Catalog feed
func (h *FeedHandler) GenerateFacebookFeed(w http.ResponseWriter, r *http.Request) {
	products, err := h.service.List(r.Context())
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	feed := FacebookProductFeed{
		NS:    "http://www.w3.org/2005/Atom",
		Title: "MyShop Products",
		Link:  "https://myshop.ua",
	}

	for _, p := range products {
		availability := "in stock"
		if p.Stock <= 0 {
			availability = "out of stock"
		}

		entry := FacebookEntry{
			ID:           p.ID,
			Title:        p.Name,
			Description:  p.Description,
			Link:         fmt.Sprintf("https://myshop.ua/product/%s", p.ID),
			ImageLink:    p.ImageURL,
			Availability: availability,
			Price:        fmt.Sprintf("%.2f UAH", p.Price),
			Condition:    "new",
		}

		feed.Entries = append(feed.Entries, entry)
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(feed); err != nil {
		http.Error(w, "Failed to encode XML", http.StatusInternalServerError)
	}
}
