package http

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"
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
	Offers     Offers     `xml:"offers"`
}

type Currencies struct {
	Currency []Currency `xml:"currency"`
}

type Currency struct {
	ID   string `xml:"id,attr"`
	Rate string `xml:"rate,attr"`
}

type Offers struct {
	Offer []Offer `xml:"offer"`
}

type Offer struct {
	ID          string  `xml:"id,attr"`
	Available   bool    `xml:"available,attr"`
	Name        string  `xml:"name"`
	Price       float64 `xml:"price"`
	CurrencyID  string  `xml:"currencyId"`
	Description string  `xml:"description"`
	SKU         string  `xml:"vendorCode"`
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
			Url:     "http://myshop.com",
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
