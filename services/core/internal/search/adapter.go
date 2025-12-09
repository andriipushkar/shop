package search

import (
	"context"
)

// Adapter wraps the Elasticsearch client to implement pim.SearchClient interface
type Adapter struct {
	client *Client
}

// NewAdapter creates a new search adapter
func NewAdapter(client *Client) *Adapter {
	return &Adapter{client: client}
}

// ProductInput represents product for indexing (matches pim.SearchProduct)
type ProductInput struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	CategoryID  string   `json:"category_id"`
	Category    string   `json:"category"`
	Price       float64  `json:"price"`
	Stock       int      `json:"stock"`
	ImageURL    string   `json:"image_url"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
}

// QueryInput represents search query (matches pim.SearchQuery)
type QueryInput struct {
	Query      string   `json:"query"`
	CategoryID string   `json:"category_id,omitempty"`
	MinPrice   *float64 `json:"min_price,omitempty"`
	MaxPrice   *float64 `json:"max_price,omitempty"`
	InStock    *bool    `json:"in_stock,omitempty"`
	SortBy     string   `json:"sort_by,omitempty"`
	Page       int      `json:"page,omitempty"`
	PageSize   int      `json:"page_size,omitempty"`
}

// ResultOutput represents search result (matches pim.SearchResult)
type ResultOutput struct {
	Products   []*ProductInput `json:"products"`
	Total      int64           `json:"total"`
	TookMs     int64           `json:"took_ms"`
	Page       int             `json:"page"`
	PageSize   int             `json:"page_size"`
	TotalPages int             `json:"total_pages"`
}

// IndexProduct indexes a product
func (a *Adapter) IndexProduct(ctx context.Context, product interface{}) error {
	p, ok := product.(*ProductInput)
	if !ok {
		// Try to convert from any struct with same fields
		return a.indexGenericProduct(ctx, product)
	}
	return a.client.IndexProduct(ctx, a.toESProduct(p))
}

// indexGenericProduct handles interface{} product
func (a *Adapter) indexGenericProduct(ctx context.Context, product interface{}) error {
	// Use type assertion for the expected interface
	type searchProduct interface {
		GetID() string
		GetName() string
		GetDescription() string
		GetCategoryID() string
		GetCategory() string
		GetPrice() float64
		GetStock() int
		GetImageURL() string
		GetCreatedAt() string
		GetUpdatedAt() string
	}

	// Just try direct conversion for pointer
	if p, ok := product.(*Product); ok {
		return a.client.IndexProduct(ctx, p)
	}

	return nil
}

// toESProduct converts ProductInput to ES Product
func (a *Adapter) toESProduct(p *ProductInput) *Product {
	return &Product{
		ID:          p.ID,
		Name:        p.Name,
		Description: p.Description,
		CategoryID:  p.CategoryID,
		Category:    p.Category,
		Price:       p.Price,
		Stock:       p.Stock,
		ImageURL:    p.ImageURL,
		Tags:        p.Tags,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}

// DeleteProduct removes a product from index
func (a *Adapter) DeleteProduct(ctx context.Context, productID string) error {
	return a.client.DeleteProduct(ctx, productID)
}

// Search performs product search
func (a *Adapter) Search(ctx context.Context, query interface{}) (interface{}, error) {
	q, ok := query.(*QueryInput)
	if !ok {
		q = &QueryInput{}
	}

	esQuery := &SearchQuery{
		Query:      q.Query,
		CategoryID: q.CategoryID,
		MinPrice:   q.MinPrice,
		MaxPrice:   q.MaxPrice,
		InStock:    q.InStock,
		SortBy:     q.SortBy,
		Page:       q.Page,
		PageSize:   q.PageSize,
	}

	result, err := a.client.Search(ctx, esQuery)
	if err != nil {
		return nil, err
	}

	// Convert to output format
	products := make([]*ProductInput, len(result.Products))
	for i, p := range result.Products {
		products[i] = &ProductInput{
			ID:          p.ID,
			Name:        p.Name,
			Description: p.Description,
			CategoryID:  p.CategoryID,
			Category:    p.Category,
			Price:       p.Price,
			Stock:       p.Stock,
			ImageURL:    p.ImageURL,
			Tags:        p.Tags,
			CreatedAt:   p.CreatedAt,
			UpdatedAt:   p.UpdatedAt,
		}
	}

	return &ResultOutput{
		Products:   products,
		Total:      result.Total,
		TookMs:     result.TookMs,
		Page:       result.Page,
		PageSize:   result.PageSize,
		TotalPages: result.TotalPages,
	}, nil
}

// Suggest returns autocomplete suggestions
func (a *Adapter) Suggest(ctx context.Context, prefix string, limit int) ([]string, error) {
	return a.client.Suggest(ctx, prefix, limit)
}

// BulkIndex indexes multiple products
func (a *Adapter) BulkIndex(ctx context.Context, products interface{}) error {
	ps, ok := products.([]*ProductInput)
	if !ok {
		return nil
	}

	esProducts := make([]*Product, len(ps))
	for i, p := range ps {
		esProducts[i] = a.toESProduct(p)
	}

	return a.client.BulkIndex(ctx, esProducts)
}

// Healthy checks if Elasticsearch is healthy
func (a *Adapter) Healthy(ctx context.Context) bool {
	return a.client.Healthy(ctx)
}
