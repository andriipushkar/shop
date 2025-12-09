package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Product represents a searchable product document
type Product struct {
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

// SearchResult represents search response
type SearchResult struct {
	Products   []*Product `json:"products"`
	Total      int64      `json:"total"`
	TookMs     int64      `json:"took_ms"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
	TotalPages int        `json:"total_pages"`
}

// SearchQuery represents search parameters
type SearchQuery struct {
	Query      string   `json:"query"`
	CategoryID string   `json:"category_id,omitempty"`
	MinPrice   *float64 `json:"min_price,omitempty"`
	MaxPrice   *float64 `json:"max_price,omitempty"`
	InStock    *bool    `json:"in_stock,omitempty"`
	SortBy     string   `json:"sort_by,omitempty"`  // price_asc, price_desc, name, relevance
	Page       int      `json:"page,omitempty"`
	PageSize   int      `json:"page_size,omitempty"`
}

// Client is Elasticsearch client
type Client struct {
	baseURL    string
	httpClient *http.Client
	indexName  string
}

// NewClient creates a new Elasticsearch client
func NewClient(url string) (*Client, error) {
	client := &Client{
		baseURL: strings.TrimRight(url, "/"),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		indexName: "products",
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx); err != nil {
		return nil, fmt.Errorf("elasticsearch connection failed: %w", err)
	}

	// Create index if not exists
	if err := client.createIndex(ctx); err != nil {
		return nil, fmt.Errorf("failed to create index: %w", err)
	}

	return client, nil
}

// Ping checks Elasticsearch connectivity
func (c *Client) Ping(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("elasticsearch returned status %d", resp.StatusCode)
	}

	return nil
}

// createIndex creates the products index with mappings
func (c *Client) createIndex(ctx context.Context) error {
	mapping := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 0,
			"analysis": map[string]interface{}{
				"analyzer": map[string]interface{}{
					"product_analyzer": map[string]interface{}{
						"type":      "custom",
						"tokenizer": "standard",
						"filter":    []string{"lowercase", "asciifolding"},
					},
				},
			},
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"id":          map[string]string{"type": "keyword"},
				"name":        map[string]interface{}{"type": "text", "analyzer": "product_analyzer", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
				"description": map[string]interface{}{"type": "text", "analyzer": "product_analyzer"},
				"category_id": map[string]string{"type": "keyword"},
				"category":    map[string]interface{}{"type": "text", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
				"price":       map[string]string{"type": "float"},
				"stock":       map[string]string{"type": "integer"},
				"image_url":   map[string]string{"type": "keyword"},
				"tags":        map[string]string{"type": "keyword"},
				"created_at":  map[string]string{"type": "date"},
				"updated_at":  map[string]string{"type": "date"},
			},
		},
	}

	body, _ := json.Marshal(mapping)
	url := fmt.Sprintf("%s/%s", c.baseURL, c.indexName)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 400 means index already exists, which is fine
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusBadRequest {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to create index: %s", string(bodyBytes))
	}

	return nil
}

// IndexProduct indexes a product document
func (c *Client) IndexProduct(ctx context.Context, product *Product) error {
	body, err := json.Marshal(product)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/%s/_doc/%s", c.baseURL, c.indexName, product.ID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to index product: %s", string(bodyBytes))
	}

	return nil
}

// DeleteProduct removes a product from the index
func (c *Client) DeleteProduct(ctx context.Context, productID string) error {
	url := fmt.Sprintf("%s/%s/_doc/%s", c.baseURL, c.indexName, productID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 404 is ok - product might not exist in index
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete product: %s", string(bodyBytes))
	}

	return nil
}

// Search performs a product search
func (c *Client) Search(ctx context.Context, query *SearchQuery) (*SearchResult, error) {
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 || query.PageSize > 100 {
		query.PageSize = 20
	}

	esQuery := c.buildQuery(query)
	body, _ := json.Marshal(esQuery)

	url := fmt.Sprintf("%s/%s/_search", c.baseURL, c.indexName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("search failed: %s", string(bodyBytes))
	}

	var esResp elasticSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&esResp); err != nil {
		return nil, err
	}

	products := make([]*Product, 0, len(esResp.Hits.Hits))
	for _, hit := range esResp.Hits.Hits {
		products = append(products, &hit.Source)
	}

	total := esResp.Hits.Total.Value
	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return &SearchResult{
		Products:   products,
		Total:      total,
		TookMs:     esResp.Took,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

// Suggest returns autocomplete suggestions
func (c *Client) Suggest(ctx context.Context, prefix string, limit int) ([]string, error) {
	if limit < 1 || limit > 20 {
		limit = 10
	}

	query := map[string]interface{}{
		"size": 0,
		"aggs": map[string]interface{}{
			"suggestions": map[string]interface{}{
				"terms": map[string]interface{}{
					"field":   "name.keyword",
					"size":    limit,
					"include": fmt.Sprintf(".*%s.*", strings.ToLower(prefix)),
				},
			},
		},
		"query": map[string]interface{}{
			"prefix": map[string]interface{}{
				"name": map[string]interface{}{
					"value": strings.ToLower(prefix),
				},
			},
		},
	}

	body, _ := json.Marshal(query)
	url := fmt.Sprintf("%s/%s/_search", c.baseURL, c.indexName)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("suggest failed: %s", string(bodyBytes))
	}

	var esResp struct {
		Hits struct {
			Hits []struct {
				Source struct {
					Name string `json:"name"`
				} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&esResp); err != nil {
		return nil, err
	}

	suggestions := make([]string, 0, len(esResp.Hits.Hits))
	seen := make(map[string]bool)
	for _, hit := range esResp.Hits.Hits {
		if !seen[hit.Source.Name] {
			suggestions = append(suggestions, hit.Source.Name)
			seen[hit.Source.Name] = true
		}
	}

	return suggestions, nil
}

// BulkIndex indexes multiple products at once
func (c *Client) BulkIndex(ctx context.Context, products []*Product) error {
	if len(products) == 0 {
		return nil
	}

	var buf bytes.Buffer
	for _, p := range products {
		meta := map[string]interface{}{
			"index": map[string]string{
				"_index": c.indexName,
				"_id":    p.ID,
			},
		}
		metaLine, _ := json.Marshal(meta)
		buf.Write(metaLine)
		buf.WriteByte('\n')

		docLine, _ := json.Marshal(p)
		buf.Write(docLine)
		buf.WriteByte('\n')
	}

	url := fmt.Sprintf("%s/_bulk", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bulk index failed: %s", string(bodyBytes))
	}

	return nil
}

// buildQuery constructs Elasticsearch query DSL
func (c *Client) buildQuery(q *SearchQuery) map[string]interface{}{
	from := (q.Page - 1) * q.PageSize

	must := []map[string]interface{}{}
	filter := []map[string]interface{}{}

	// Text search
	if q.Query != "" {
		must = append(must, map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":     q.Query,
				"fields":    []string{"name^3", "description", "category", "tags"},
				"fuzziness": "AUTO",
			},
		})
	}

	// Category filter
	if q.CategoryID != "" {
		filter = append(filter, map[string]interface{}{
			"term": map[string]string{"category_id": q.CategoryID},
		})
	}

	// Price range
	priceRange := map[string]interface{}{}
	if q.MinPrice != nil {
		priceRange["gte"] = *q.MinPrice
	}
	if q.MaxPrice != nil {
		priceRange["lte"] = *q.MaxPrice
	}
	if len(priceRange) > 0 {
		filter = append(filter, map[string]interface{}{
			"range": map[string]interface{}{"price": priceRange},
		})
	}

	// In stock filter
	if q.InStock != nil && *q.InStock {
		filter = append(filter, map[string]interface{}{
			"range": map[string]interface{}{"stock": map[string]int{"gt": 0}},
		})
	}

	// Build bool query
	boolQuery := map[string]interface{}{}
	if len(must) > 0 {
		boolQuery["must"] = must
	} else {
		boolQuery["must"] = []map[string]interface{}{{"match_all": map[string]interface{}{}}}
	}
	if len(filter) > 0 {
		boolQuery["filter"] = filter
	}

	// Sort
	sort := []map[string]interface{}{}
	switch q.SortBy {
	case "price_asc":
		sort = append(sort, map[string]interface{}{"price": "asc"})
	case "price_desc":
		sort = append(sort, map[string]interface{}{"price": "desc"})
	case "name":
		sort = append(sort, map[string]interface{}{"name.keyword": "asc"})
	case "newest":
		sort = append(sort, map[string]interface{}{"created_at": "desc"})
	default:
		if q.Query != "" {
			sort = append(sort, map[string]interface{}{"_score": "desc"})
		}
		sort = append(sort, map[string]interface{}{"created_at": "desc"})
	}

	return map[string]interface{}{
		"from":  from,
		"size":  q.PageSize,
		"query": map[string]interface{}{"bool": boolQuery},
		"sort":  sort,
	}
}

// elasticSearchResponse represents ES search response
type elasticSearchResponse struct {
	Took int64 `json:"took"`
	Hits struct {
		Total struct {
			Value int64 `json:"value"`
		} `json:"total"`
		Hits []struct {
			Source Product `json:"_source"`
		} `json:"hits"`
	} `json:"hits"`
}

// Close closes the client
func (c *Client) Close() error {
	c.httpClient.CloseIdleConnections()
	return nil
}

// Healthy checks if Elasticsearch is healthy
func (c *Client) Healthy(ctx context.Context) bool {
	err := c.Ping(ctx)
	return err == nil
}
