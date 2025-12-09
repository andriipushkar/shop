package http

import (
	"context"
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"core/internal/pim"
)

func setupFeedHandler() (*FeedHandler, *MockRepository, *MockCategoryRepository) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := pim.NewService(repo, catRepo)
	return NewFeedHandler(service), repo, catRepo
}

func TestNewFeedHandler(t *testing.T) {
	handler, _, _ := setupFeedHandler()
	if handler == nil {
		t.Fatal("expected handler to be created")
	}
	if handler.service == nil {
		t.Error("expected service to be set")
	}
}

func TestGenerateYMLFeed_Empty(t *testing.T) {
	handler, _, _ := setupFeedHandler()

	req := httptest.NewRequest(http.MethodGet, "/feeds/yml", nil)
	w := httptest.NewRecorder()

	handler.GenerateYMLFeed(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "application/xml") {
		t.Errorf("expected Content-Type application/xml, got %s", contentType)
	}

	// Verify XML structure
	body := w.Body.String()
	if !strings.Contains(body, "<?xml") {
		t.Error("expected XML header")
	}
	if !strings.Contains(body, "yml_catalog") {
		t.Error("expected yml_catalog root element")
	}
}

func TestGenerateYMLFeed_WithProducts(t *testing.T) {
	handler, repo, catRepo := setupFeedHandler()
	ctx := context.Background()

	// Add test category
	catRepo.SaveCategory(ctx, &pim.Category{
		ID:   "cat-1",
		Name: "Electronics",
	})

	// Add test products
	repo.Save(ctx, &pim.Product{
		ID:          "prod-1",
		Name:        "Test Product 1",
		Description: "Test Description",
		Price:       100.00,
		SKU:         "SKU001",
		Stock:       10,
		CategoryID:  "cat-1",
		ImageURL:    "https://example.com/image.jpg",
	})
	repo.Save(ctx, &pim.Product{
		ID:          "prod-2",
		Name:        "Test Product 2",
		Description: "Another Description",
		Price:       200.00,
		SKU:         "SKU002",
		Stock:       0, // Out of stock
		CategoryID:  "cat-1",
	})

	req := httptest.NewRequest(http.MethodGet, "/feeds/yml", nil)
	w := httptest.NewRecorder()

	handler.GenerateYMLFeed(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	body := w.Body.String()

	// Verify offers are present
	if !strings.Contains(body, "<offer") {
		t.Error("expected offer elements")
	}
	if !strings.Contains(body, "Test Product 1") {
		t.Error("expected product name in feed")
	}
	if !strings.Contains(body, "category") {
		t.Error("expected category elements")
	}

	// Verify XML can be parsed
	var catalog YMLCatalog
	if err := xml.Unmarshal([]byte(strings.TrimPrefix(body, xml.Header)), &catalog); err != nil {
		t.Errorf("failed to parse XML: %v", err)
	}

	if catalog.Shop.Name != "MyShop" {
		t.Errorf("expected shop name 'MyShop', got %s", catalog.Shop.Name)
	}
	if len(catalog.Shop.Offers.Offer) != 2 {
		t.Errorf("expected 2 offers, got %d", len(catalog.Shop.Offers.Offer))
	}
}

func TestGenerateGoogleFeed_Empty(t *testing.T) {
	handler, _, _ := setupFeedHandler()

	req := httptest.NewRequest(http.MethodGet, "/feeds/google", nil)
	w := httptest.NewRecorder()

	handler.GenerateGoogleFeed(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "application/xml") {
		t.Errorf("expected Content-Type application/xml, got %s", contentType)
	}

	body := w.Body.String()
	if !strings.Contains(body, "rss") {
		t.Error("expected rss root element")
	}
}

func TestGenerateGoogleFeed_WithProducts(t *testing.T) {
	handler, repo, _ := setupFeedHandler()
	ctx := context.Background()

	repo.Save(ctx, &pim.Product{
		ID:          "prod-1",
		Name:        "Test Product",
		Description: "Test Description",
		Price:       99.99,
		SKU:         "SKU001",
		Stock:       5,
		ImageURL:    "https://example.com/image.jpg",
	})
	repo.Save(ctx, &pim.Product{
		ID:          "prod-2",
		Name:        "Out of Stock Product",
		Description: "No stock",
		Price:       50.00,
		SKU:         "SKU002",
		Stock:       0,
	})

	req := httptest.NewRequest(http.MethodGet, "/feeds/google", nil)
	w := httptest.NewRecorder()

	handler.GenerateGoogleFeed(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	body := w.Body.String()

	// Verify Google feed elements
	if !strings.Contains(body, "<item>") {
		t.Error("expected item elements")
	}
	if !strings.Contains(body, "g:id") {
		t.Error("expected Google product ID")
	}
	if !strings.Contains(body, "g:availability") {
		t.Error("expected availability element")
	}
	if !strings.Contains(body, "in stock") {
		t.Error("expected 'in stock' availability")
	}
	if !strings.Contains(body, "out of stock") {
		t.Error("expected 'out of stock' availability")
	}
	if !strings.Contains(body, "g:price") {
		t.Error("expected price element")
	}
	if !strings.Contains(body, "UAH") {
		t.Error("expected UAH currency")
	}
	if !strings.Contains(body, "g:condition") {
		t.Error("expected condition element")
	}

	// Verify XML structure
	var feed GoogleProductFeed
	if err := xml.Unmarshal([]byte(strings.TrimPrefix(body, xml.Header)), &feed); err != nil {
		t.Errorf("failed to parse Google feed XML: %v", err)
	}

	if len(feed.Channel.Items) != 2 {
		t.Errorf("expected 2 items, got %d", len(feed.Channel.Items))
	}
}

func TestGenerateFacebookFeed_Empty(t *testing.T) {
	handler, _, _ := setupFeedHandler()

	req := httptest.NewRequest(http.MethodGet, "/feeds/facebook", nil)
	w := httptest.NewRecorder()

	handler.GenerateFacebookFeed(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "application/xml") {
		t.Errorf("expected Content-Type application/xml, got %s", contentType)
	}

	body := w.Body.String()
	if !strings.Contains(body, "feed") {
		t.Error("expected feed root element")
	}
}

func TestGenerateFacebookFeed_WithProducts(t *testing.T) {
	handler, repo, _ := setupFeedHandler()
	ctx := context.Background()

	repo.Save(ctx, &pim.Product{
		ID:          "prod-1",
		Name:        "Test Product",
		Description: "Test Description",
		Price:       150.00,
		SKU:         "SKU001",
		Stock:       3,
		ImageURL:    "https://example.com/image.jpg",
	})

	req := httptest.NewRequest(http.MethodGet, "/feeds/facebook", nil)
	w := httptest.NewRecorder()

	handler.GenerateFacebookFeed(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	body := w.Body.String()

	// Verify Facebook feed elements
	if !strings.Contains(body, "<entry>") {
		t.Error("expected entry elements")
	}
	if !strings.Contains(body, "g:id") {
		t.Error("expected product ID")
	}
	if !strings.Contains(body, "g:availability") {
		t.Error("expected availability element")
	}
	if !strings.Contains(body, "g:price") {
		t.Error("expected price element")
	}
	if !strings.Contains(body, "g:condition") {
		t.Error("expected condition element")
	}

	// Verify XML structure
	var feed FacebookProductFeed
	if err := xml.Unmarshal([]byte(strings.TrimPrefix(body, xml.Header)), &feed); err != nil {
		t.Errorf("failed to parse Facebook feed XML: %v", err)
	}

	if len(feed.Entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(feed.Entries))
	}
}

func TestFeedTypes(t *testing.T) {
	// Test YML types
	catalog := &YMLCatalog{
		Date: "2024-01-01 12:00",
		Shop: Shop{
			Name:    "TestShop",
			Company: "TestCompany",
			Url:     "https://test.ua",
		},
	}
	if catalog.Shop.Name != "TestShop" {
		t.Error("expected shop name to be set")
	}

	// Test Currency
	currency := &Currency{
		ID:   "UAH",
		Rate: "1",
	}
	if currency.ID != "UAH" {
		t.Error("expected currency ID to be UAH")
	}

	// Test CategoryXML
	catXML := &CategoryXML{
		ID:       "1",
		ParentID: "0",
		Name:     "Test Category",
	}
	if catXML.Name != "Test Category" {
		t.Error("expected category name")
	}

	// Test Offer
	offer := &Offer{
		ID:          "1",
		Available:   true,
		Name:        "Test Product",
		Price:       100.00,
		OldPrice:    120.00,
		CurrencyID:  "UAH",
		CategoryID:  "1",
		Description: "Test Description",
		SKU:         "SKU001",
		Stock:       10,
		Picture:     []string{"https://example.com/image.jpg"},
		Vendor:      "TestVendor",
		URL:         "https://test.ua/product/1",
	}
	if !offer.Available {
		t.Error("expected offer to be available")
	}

	// Test Google types
	googleItem := &GoogleItem{
		ID:           "1",
		Title:        "Test Product",
		Description:  "Test Description",
		Link:         "https://test.ua/product/1",
		ImageLink:    "https://example.com/image.jpg",
		Availability: "in stock",
		Price:        "100.00 UAH",
		Condition:    "new",
		MPN:          "SKU001",
	}
	if googleItem.Condition != "new" {
		t.Error("expected condition to be new")
	}

	// Test Facebook types
	facebookEntry := &FacebookEntry{
		ID:           "1",
		Title:        "Test Product",
		Description:  "Test Description",
		Link:         "https://test.ua/product/1",
		ImageLink:    "https://example.com/image.jpg",
		Availability: "in stock",
		Price:        "100.00 UAH",
		Condition:    "new",
	}
	if facebookEntry.Availability != "in stock" {
		t.Error("expected availability to be in stock")
	}
}

func TestYMLFeed_XMLStructure(t *testing.T) {
	handler, repo, catRepo := setupFeedHandler()
	ctx := context.Background()

	// Add category
	catRepo.SaveCategory(ctx, &pim.Category{
		ID:   "cat-1",
		Name: "Test Category",
	})

	// Add product
	repo.Save(ctx, &pim.Product{
		ID:          "prod-1",
		Name:        "Test Product",
		Description: "Description",
		Price:       100.00,
		SKU:         "SKU001",
		Stock:       5,
		CategoryID:  "cat-1",
	})

	req := httptest.NewRequest(http.MethodGet, "/feeds/yml", nil)
	w := httptest.NewRecorder()

	handler.GenerateYMLFeed(w, req)

	body := w.Body.String()

	// Parse and validate XML
	var catalog YMLCatalog
	bodyWithoutHeader := strings.TrimPrefix(body, xml.Header)
	if err := xml.Unmarshal([]byte(bodyWithoutHeader), &catalog); err != nil {
		t.Fatalf("failed to parse YML feed: %v", err)
	}

	// Verify shop info
	if catalog.Shop.Name != "MyShop" {
		t.Errorf("expected shop name 'MyShop', got %s", catalog.Shop.Name)
	}
	if catalog.Shop.Company != "MyShop LLC" {
		t.Errorf("expected company 'MyShop LLC', got %s", catalog.Shop.Company)
	}
	if catalog.Shop.Url != "https://myshop.ua" {
		t.Errorf("expected URL 'https://myshop.ua', got %s", catalog.Shop.Url)
	}

	// Verify currencies
	if len(catalog.Shop.Currencies.Currency) != 1 {
		t.Errorf("expected 1 currency, got %d", len(catalog.Shop.Currencies.Currency))
	}
	if catalog.Shop.Currencies.Currency[0].ID != "UAH" {
		t.Error("expected UAH currency")
	}

	// Verify categories
	if len(catalog.Shop.Categories.Category) != 1 {
		t.Errorf("expected 1 category, got %d", len(catalog.Shop.Categories.Category))
	}

	// Verify offers
	if len(catalog.Shop.Offers.Offer) != 1 {
		t.Errorf("expected 1 offer, got %d", len(catalog.Shop.Offers.Offer))
	}

	offer := catalog.Shop.Offers.Offer[0]
	if offer.ID != "prod-1" {
		t.Errorf("expected offer ID 'prod-1', got %s", offer.ID)
	}
	if offer.Name != "Test Product" {
		t.Errorf("expected offer name 'Test Product', got %s", offer.Name)
	}
	if offer.Price != 100.00 {
		t.Errorf("expected price 100.00, got %f", offer.Price)
	}
	if offer.SKU != "SKU001" {
		t.Errorf("expected SKU 'SKU001', got %s", offer.SKU)
	}
}

func TestFeedAvailability(t *testing.T) {
	handler, repo, _ := setupFeedHandler()
	ctx := context.Background()

	// Add in-stock product
	repo.Save(ctx, &pim.Product{
		ID:    "prod-1",
		Name:  "In Stock",
		Price: 100.00,
		Stock: 10,
	})

	// Add out-of-stock product
	repo.Save(ctx, &pim.Product{
		ID:    "prod-2",
		Name:  "Out of Stock",
		Price: 50.00,
		Stock: 0,
	})

	req := httptest.NewRequest(http.MethodGet, "/feeds/yml", nil)
	w := httptest.NewRecorder()

	handler.GenerateYMLFeed(w, req)

	body := w.Body.String()

	// Both should have availability based on stock
	if !strings.Contains(body, `available="true"`) && !strings.Contains(body, `available="false"`) {
		t.Error("expected availability attributes in offers")
	}
}
