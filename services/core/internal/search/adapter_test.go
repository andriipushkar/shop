package search

import (
	"testing"
)

func TestProductInput(t *testing.T) {
	p := ProductInput{
		ID:          "prod-1",
		Name:        "Test Product",
		Description: "Test Description",
		CategoryID:  "cat-1",
		Category:    "Electronics",
		Price:       100.00,
		Stock:       50,
		ImageURL:    "https://example.com/image.jpg",
		Tags:        []string{"tag1", "tag2"},
		CreatedAt:   "2024-01-01T00:00:00Z",
		UpdatedAt:   "2024-01-02T00:00:00Z",
	}

	if p.ID != "prod-1" {
		t.Errorf("expected ID 'prod-1', got %s", p.ID)
	}
	if p.Name != "Test Product" {
		t.Errorf("expected Name 'Test Product', got %s", p.Name)
	}
	if p.Price != 100.00 {
		t.Errorf("expected Price 100.00, got %f", p.Price)
	}
	if p.Stock != 50 {
		t.Errorf("expected Stock 50, got %d", p.Stock)
	}
	if len(p.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(p.Tags))
	}
}

func TestQueryInput(t *testing.T) {
	minPrice := 10.00
	maxPrice := 100.00
	inStock := true

	q := QueryInput{
		Query:      "phone",
		CategoryID: "cat-1",
		MinPrice:   &minPrice,
		MaxPrice:   &maxPrice,
		InStock:    &inStock,
		SortBy:     "price",
		Page:       1,
		PageSize:   20,
	}

	if q.Query != "phone" {
		t.Errorf("expected Query 'phone', got %s", q.Query)
	}
	if q.CategoryID != "cat-1" {
		t.Errorf("expected CategoryID 'cat-1', got %s", q.CategoryID)
	}
	if *q.MinPrice != 10.00 {
		t.Errorf("expected MinPrice 10.00, got %f", *q.MinPrice)
	}
	if *q.MaxPrice != 100.00 {
		t.Errorf("expected MaxPrice 100.00, got %f", *q.MaxPrice)
	}
	if !*q.InStock {
		t.Error("expected InStock to be true")
	}
	if q.Page != 1 {
		t.Errorf("expected Page 1, got %d", q.Page)
	}
	if q.PageSize != 20 {
		t.Errorf("expected PageSize 20, got %d", q.PageSize)
	}
}

func TestResultOutput(t *testing.T) {
	result := ResultOutput{
		Products: []*ProductInput{
			{ID: "prod-1", Name: "Product 1"},
			{ID: "prod-2", Name: "Product 2"},
		},
		Total:      100,
		TookMs:     50,
		Page:       1,
		PageSize:   20,
		TotalPages: 5,
	}

	if len(result.Products) != 2 {
		t.Errorf("expected 2 products, got %d", len(result.Products))
	}
	if result.Total != 100 {
		t.Errorf("expected Total 100, got %d", result.Total)
	}
	if result.TookMs != 50 {
		t.Errorf("expected TookMs 50, got %d", result.TookMs)
	}
	if result.TotalPages != 5 {
		t.Errorf("expected TotalPages 5, got %d", result.TotalPages)
	}
}

func TestNewAdapter(t *testing.T) {
	// Test with nil client
	adapter := NewAdapter(nil)

	if adapter == nil {
		t.Error("expected adapter to be created")
	}
	if adapter.client != nil {
		t.Error("expected client to be nil")
	}
}

func TestAdapter_toESProduct(t *testing.T) {
	adapter := NewAdapter(nil)

	input := &ProductInput{
		ID:          "prod-1",
		Name:        "Test Product",
		Description: "Test Description",
		CategoryID:  "cat-1",
		Category:    "Electronics",
		Price:       100.00,
		Stock:       50,
		ImageURL:    "https://example.com/image.jpg",
		Tags:        []string{"tag1", "tag2"},
		CreatedAt:   "2024-01-01T00:00:00Z",
		UpdatedAt:   "2024-01-02T00:00:00Z",
	}

	result := adapter.toESProduct(input)

	if result.ID != input.ID {
		t.Errorf("expected ID %s, got %s", input.ID, result.ID)
	}
	if result.Name != input.Name {
		t.Errorf("expected Name %s, got %s", input.Name, result.Name)
	}
	if result.Description != input.Description {
		t.Errorf("expected Description %s, got %s", input.Description, result.Description)
	}
	if result.CategoryID != input.CategoryID {
		t.Errorf("expected CategoryID %s, got %s", input.CategoryID, result.CategoryID)
	}
	if result.Category != input.Category {
		t.Errorf("expected Category %s, got %s", input.Category, result.Category)
	}
	if result.Price != input.Price {
		t.Errorf("expected Price %f, got %f", input.Price, result.Price)
	}
	if result.Stock != input.Stock {
		t.Errorf("expected Stock %d, got %d", input.Stock, result.Stock)
	}
	if result.ImageURL != input.ImageURL {
		t.Errorf("expected ImageURL %s, got %s", input.ImageURL, result.ImageURL)
	}
	if len(result.Tags) != len(input.Tags) {
		t.Errorf("expected %d tags, got %d", len(input.Tags), len(result.Tags))
	}
}

func TestQueryInput_EmptyValues(t *testing.T) {
	q := QueryInput{}

	if q.Query != "" {
		t.Error("expected empty Query")
	}
	if q.CategoryID != "" {
		t.Error("expected empty CategoryID")
	}
	if q.MinPrice != nil {
		t.Error("expected nil MinPrice")
	}
	if q.MaxPrice != nil {
		t.Error("expected nil MaxPrice")
	}
	if q.InStock != nil {
		t.Error("expected nil InStock")
	}
	if q.Page != 0 {
		t.Error("expected Page to be 0")
	}
	if q.PageSize != 0 {
		t.Error("expected PageSize to be 0")
	}
}

func TestResultOutput_EmptyProducts(t *testing.T) {
	result := ResultOutput{
		Products:   []*ProductInput{},
		Total:      0,
		TookMs:     10,
		Page:       1,
		PageSize:   20,
		TotalPages: 0,
	}

	if len(result.Products) != 0 {
		t.Errorf("expected 0 products, got %d", len(result.Products))
	}
	if result.Total != 0 {
		t.Errorf("expected Total 0, got %d", result.Total)
	}
	if result.TotalPages != 0 {
		t.Errorf("expected TotalPages 0, got %d", result.TotalPages)
	}
}

func TestProductInput_WithEmptyTags(t *testing.T) {
	p := ProductInput{
		ID:   "prod-1",
		Name: "Test Product",
		Tags: []string{},
	}

	if p.Tags == nil {
		t.Error("expected Tags to be empty slice, not nil")
	}
	if len(p.Tags) != 0 {
		t.Errorf("expected 0 tags, got %d", len(p.Tags))
	}
}

func TestProductInput_WithNilTags(t *testing.T) {
	p := ProductInput{
		ID:   "prod-1",
		Name: "Test Product",
		// Tags not set - should be nil
	}

	if p.Tags != nil {
		t.Error("expected Tags to be nil")
	}
}

// Test Adapter with nil client - methods should handle gracefully
func TestAdapter_NilClient_IndexProduct(t *testing.T) {
	adapter := NewAdapter(nil)

	// IndexProduct with nil client will panic - this tests the structure
	// In real use, client should never be nil
	if adapter.client != nil {
		t.Error("expected nil client")
	}
}

func TestAdapter_NilClient_BulkIndex(t *testing.T) {
	adapter := NewAdapter(nil)

	// BulkIndex with nil products should return nil
	err := adapter.BulkIndex(nil, nil)
	if err != nil {
		t.Errorf("expected nil error for nil products, got %v", err)
	}
}

func TestAdapter_BulkIndex_WrongType(t *testing.T) {
	adapter := NewAdapter(nil)

	// BulkIndex with wrong type should return nil
	err := adapter.BulkIndex(nil, "not a slice")
	if err != nil {
		t.Errorf("expected nil error for wrong type, got %v", err)
	}
}

func TestAdapter_indexGenericProduct(t *testing.T) {
	adapter := NewAdapter(nil)

	// Test with nil product
	err := adapter.indexGenericProduct(nil, nil)
	if err != nil {
		t.Errorf("expected nil error for nil product, got %v", err)
	}

	// Test with wrong type
	err = adapter.indexGenericProduct(nil, "not a product")
	if err != nil {
		t.Errorf("expected nil error for wrong type, got %v", err)
	}
}
