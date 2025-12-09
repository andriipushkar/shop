package feeds

import (
	"bytes"
	"encoding/xml"
	"strings"
	"testing"

	"core/internal/marketplace"
)

func TestYMLGenerator_Generate(t *testing.T) {
	config := &YMLConfig{
		ShopName:     "Test Shop",
		CompanyName:  "Test Company",
		ShopURL:      "https://shop.test",
		Currency:     "UAH",
		DeliveryCost: 50,
		DeliveryDays: 3,
	}

	gen := NewYMLGenerator(config)

	products := []*marketplace.Product{
		{
			SKU:         "SKU-1",
			Name:        "Test Product 1",
			Description: "Description 1",
			Price:       100.00,
			CategoryID:  "1",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    10,
			Images:      []string{"https://img.test/1.jpg"},
			Brand:       "TestBrand",
		},
		{
			SKU:         "SKU-2",
			Name:        "Test Product 2",
			Description: "Description 2",
			Price:       150.00,
			OldPrice:    200.00,
			CategoryID:  "1",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    5,
		},
	}

	categories := []marketplace.Category{
		{ID: "1", Name: "Category 1"},
	}

	feed, err := gen.Generate(products, categories)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	// Verify XML structure
	var catalog YMLCatalog
	if err := xml.Unmarshal(feed, &catalog); err != nil {
		t.Fatalf("Failed to parse feed: %v", err)
	}

	if catalog.Shop.Name != "Test Shop" {
		t.Errorf("Expected shop name 'Test Shop', got %s", catalog.Shop.Name)
	}

	if len(catalog.Shop.Offers.Offer) != 2 {
		t.Errorf("Expected 2 offers, got %d", len(catalog.Shop.Offers.Offer))
	}

	// Check first offer
	offer := catalog.Shop.Offers.Offer[0]
	if offer.ID != "SKU-1" {
		t.Errorf("Expected offer ID 'SKU-1', got %s", offer.ID)
	}
	if offer.Price != 100.00 {
		t.Errorf("Expected price 100.00, got %.2f", offer.Price)
	}
	if offer.Available != "true" {
		t.Errorf("Expected available 'true', got %s", offer.Available)
	}

	// Check second offer has old price
	offer2 := catalog.Shop.Offers.Offer[1]
	if offer2.OldPrice != 200.00 {
		t.Errorf("Expected old price 200.00, got %.2f", offer2.OldPrice)
	}
}

func TestYMLGenerator_GenerateSimpleFeed(t *testing.T) {
	gen := NewYMLGenerator(nil) // Test with default config

	products := []*marketplace.Product{
		{
			SKU:          "SKU-1",
			Name:         "Product",
			Price:        100.00,
			CategoryID:   "1",
			CategoryPath: "Category 1",
			IsActive:     true,
			IsAvailable:  true,
			Quantity:     5,
		},
	}

	feed, err := gen.GenerateSimpleFeed(products)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	if !strings.Contains(string(feed), "<yml_catalog") {
		t.Error("Expected yml_catalog root element")
	}

	if !strings.Contains(string(feed), "SKU-1") {
		t.Error("Expected product SKU in feed")
	}
}

func TestYMLGenerator_InactiveProducts(t *testing.T) {
	gen := NewYMLGenerator(nil)

	products := []*marketplace.Product{
		{
			SKU:         "SKU-1",
			Name:        "Active Product",
			Price:       100.00,
			CategoryID:  "1",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    5,
		},
		{
			SKU:         "SKU-2",
			Name:        "Inactive Product",
			Price:       100.00,
			CategoryID:  "1",
			IsActive:    false, // Should be skipped
			IsAvailable: true,
			Quantity:    5,
		},
	}

	categories := []marketplace.Category{{ID: "1", Name: "Cat"}}
	feed, err := gen.Generate(products, categories)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	var catalog YMLCatalog
	if err := xml.Unmarshal(feed, &catalog); err != nil {
		t.Fatalf("Failed to parse feed: %v", err)
	}

	if len(catalog.Shop.Offers.Offer) != 1 {
		t.Errorf("Expected 1 offer (inactive skipped), got %d", len(catalog.Shop.Offers.Offer))
	}
}

func TestYMLGenerator_ProductWithDimensions(t *testing.T) {
	gen := NewYMLGenerator(nil)

	products := []*marketplace.Product{
		{
			SKU:         "SKU-1",
			Name:        "Product with dimensions",
			Price:       100.00,
			CategoryID:  "1",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    5,
			Weight:      2.5,
			Dimensions: &marketplace.Dimensions{
				Length: 30.0,
				Width:  20.0,
				Height: 10.0,
			},
		},
	}

	categories := []marketplace.Category{{ID: "1", Name: "Cat"}}
	feed, err := gen.Generate(products, categories)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	var catalog YMLCatalog
	if err := xml.Unmarshal(feed, &catalog); err != nil {
		t.Fatalf("Failed to parse feed: %v", err)
	}

	offer := catalog.Shop.Offers.Offer[0]
	if offer.Weight != 2.5 {
		t.Errorf("Expected weight 2.5, got %.2f", offer.Weight)
	}
	if offer.Dimensions != "30.0/20.0/10.0" {
		t.Errorf("Expected dimensions '30.0/20.0/10.0', got %s", offer.Dimensions)
	}
}

func TestYMLGenerator_ProductWithParams(t *testing.T) {
	gen := NewYMLGenerator(nil)

	products := []*marketplace.Product{
		{
			SKU:         "SKU-1",
			Name:        "Product with params",
			Price:       100.00,
			CategoryID:  "1",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    5,
			Attributes: map[string]string{
				"Color": "Red",
				"Size":  "M",
			},
		},
	}

	categories := []marketplace.Category{{ID: "1", Name: "Cat"}}
	feed, err := gen.Generate(products, categories)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	var catalog YMLCatalog
	if err := xml.Unmarshal(feed, &catalog); err != nil {
		t.Fatalf("Failed to parse feed: %v", err)
	}

	offer := catalog.Shop.Offers.Offer[0]
	if len(offer.Params) != 2 {
		t.Errorf("Expected 2 params, got %d", len(offer.Params))
	}
}

func TestGoogleFeedGenerator_Generate(t *testing.T) {
	gen := NewGoogleFeedGenerator("https://shop.test", "UAH")

	products := []*marketplace.Product{
		{
			SKU:         "SKU-1",
			Name:        "Google Product",
			Description: "Test description",
			Price:       100.00,
			URL:         "https://shop.test/product/1",
			CategoryPath: "Electronics > Phones",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    5,
			Brand:       "TestBrand",
			Images:      []string{"https://img.test/1.jpg", "https://img.test/2.jpg"},
		},
		{
			SKU:         "SKU-2",
			Name:        "Sale Product",
			Description: "On sale",
			Price:       80.00,
			OldPrice:    100.00,
			URL:         "https://shop.test/product/2",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    3,
		},
	}

	feed, err := gen.Generate(products)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	// Check RSS structure
	if !strings.Contains(string(feed), "<rss") {
		t.Error("Expected rss root element")
	}

	if !strings.Contains(string(feed), "xmlns:g") {
		t.Error("Expected Google namespace")
	}

	if !strings.Contains(string(feed), "<g:id>SKU-1</g:id>") {
		t.Error("Expected product ID")
	}

	if !strings.Contains(string(feed), "100.00 UAH") {
		t.Error("Expected price format")
	}

	if !strings.Contains(string(feed), "in stock") {
		t.Error("Expected availability")
	}

	// Check sale price for second product
	if !strings.Contains(string(feed), "<g:sale_price>80.00 UAH</g:sale_price>") {
		t.Error("Expected sale price for discounted product")
	}
}

func TestGoogleFeedGenerator_OutOfStock(t *testing.T) {
	gen := NewGoogleFeedGenerator("https://shop.test", "UAH")

	products := []*marketplace.Product{
		{
			SKU:         "SKU-1",
			Name:        "Out of stock product",
			Price:       100.00,
			IsActive:    true,
			IsAvailable: false,
			Quantity:    0,
		},
	}

	feed, err := gen.Generate(products)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	if !strings.Contains(string(feed), "out of stock") {
		t.Error("Expected 'out of stock' availability")
	}
}

func TestFacebookCatalogFeed_GenerateCSV(t *testing.T) {
	gen := NewFacebookFeedGenerator("https://shop.test", "UAH")

	products := []*marketplace.Product{
		{
			SKU:         "SKU-1",
			Name:        "Facebook Product",
			Description: "Test description",
			Price:       100.00,
			URL:         "https://shop.test/product/1",
			CategoryPath: "Electronics",
			IsActive:    true,
			IsAvailable: true,
			Quantity:    5,
			Brand:       "TestBrand",
			Images:      []string{"https://img.test/1.jpg"},
		},
	}

	csv, err := gen.GenerateCSV(products)
	if err != nil {
		t.Fatalf("Failed to generate CSV: %v", err)
	}

	lines := strings.Split(string(csv), "\n")

	// Check header
	if !strings.Contains(lines[0], "id,title,description") {
		t.Error("Expected CSV header")
	}

	// Check data row
	if len(lines) < 2 {
		t.Error("Expected at least 2 lines")
	}

	if !strings.Contains(lines[1], "SKU-1") {
		t.Error("Expected product SKU in data")
	}

	if !strings.Contains(lines[1], "in stock") {
		t.Error("Expected availability in data")
	}
}

func TestCsvEscape(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"simple", "simple"},
		{"with,comma", `"with,comma"`},
		{`with"quote`, `"with""quote"`},
		{"with\nnewline", `"with
newline"`},
		{"normal text", "normal text"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := csvEscape(tt.input)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestTruncateDescription(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"short", 10, "short"},
		{"exactly 10", 10, "exactly 10"},
		{"this is longer than max", 10, "this is..."},
		{"", 10, ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := truncateDescription(tt.input, tt.maxLen)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestBoolToYML(t *testing.T) {
	if boolToYML(true) != "true" {
		t.Error("Expected 'true'")
	}
	if boolToYML(false) != "false" {
		t.Error("Expected 'false'")
	}
}

func TestYMLGenerator_XMLHeader(t *testing.T) {
	gen := NewYMLGenerator(nil)
	products := []*marketplace.Product{}
	categories := []marketplace.Category{}

	feed, err := gen.Generate(products, categories)
	if err != nil {
		t.Fatalf("Failed to generate feed: %v", err)
	}

	if !bytes.HasPrefix(feed, []byte("<?xml")) {
		t.Error("Expected XML declaration at start")
	}
}

func TestDefaultYMLConfig(t *testing.T) {
	config := DefaultYMLConfig()

	if config.ShopName == "" {
		t.Error("Expected default shop name")
	}
	if config.Currency == "" {
		t.Error("Expected default currency")
	}
	if config.DeliveryDays <= 0 {
		t.Error("Expected default delivery days")
	}
}
