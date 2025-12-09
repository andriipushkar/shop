package search

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSearchClient_buildQuery(t *testing.T) {
	client := &Client{
		baseURL:   "http://localhost:9200",
		indexName: "products",
	}

	tests := []struct {
		name     string
		query    *SearchQuery
		wantKeys []string
	}{
		{
			name: "basic query",
			query: &SearchQuery{
				Query:    "test",
				Page:     1,
				PageSize: 10,
			},
			wantKeys: []string{"from", "size", "query", "sort"},
		},
		{
			name: "with category filter",
			query: &SearchQuery{
				Query:      "test",
				CategoryID: "cat-1",
				Page:       1,
				PageSize:   10,
			},
			wantKeys: []string{"from", "size", "query", "sort"},
		},
		{
			name: "with price range",
			query: &SearchQuery{
				Query:    "test",
				MinPrice: ptrFloat64(10.0),
				MaxPrice: ptrFloat64(100.0),
				Page:     1,
				PageSize: 10,
			},
			wantKeys: []string{"from", "size", "query", "sort"},
		},
		{
			name: "with in_stock filter",
			query: &SearchQuery{
				Query:    "test",
				InStock:  ptrBool(true),
				Page:     1,
				PageSize: 10,
			},
			wantKeys: []string{"from", "size", "query", "sort"},
		},
		{
			name: "with sort by price",
			query: &SearchQuery{
				Query:    "test",
				SortBy:   "price_asc",
				Page:     1,
				PageSize: 10,
			},
			wantKeys: []string{"from", "size", "query", "sort"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := client.buildQuery(tt.query)

			for _, key := range tt.wantKeys {
				if _, ok := result[key]; !ok {
					t.Errorf("buildQuery() missing key %q", key)
				}
			}

			// Check pagination
			from, ok := result["from"].(int)
			if !ok {
				t.Error("buildQuery() 'from' should be int")
			}
			expectedFrom := (tt.query.Page - 1) * tt.query.PageSize
			if from != expectedFrom {
				t.Errorf("buildQuery() from = %d, want %d", from, expectedFrom)
			}

			size, ok := result["size"].(int)
			if !ok {
				t.Error("buildQuery() 'size' should be int")
			}
			if size != tt.query.PageSize {
				t.Errorf("buildQuery() size = %d, want %d", size, tt.query.PageSize)
			}
		})
	}
}

func TestSearchQuery_defaults(t *testing.T) {
	query := &SearchQuery{}

	// Test that default values are applied
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 || query.PageSize > 100 {
		query.PageSize = 20
	}

	if query.Page != 1 {
		t.Errorf("default Page = %d, want 1", query.Page)
	}
	if query.PageSize != 20 {
		t.Errorf("default PageSize = %d, want 20", query.PageSize)
	}
}

func TestClient_Ping(t *testing.T) {
	// Create a test server that returns OK
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"cluster_name": "test"}`))
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		httpClient: http.DefaultClient,
		indexName:  "products",
	}

	err := client.Ping(context.Background())
	if err != nil {
		t.Errorf("Ping() error = %v, want nil", err)
	}
}

func TestClient_Ping_Error(t *testing.T) {
	// Create a test server that returns error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		httpClient: http.DefaultClient,
		indexName:  "products",
	}

	err := client.Ping(context.Background())
	if err == nil {
		t.Error("Ping() expected error, got nil")
	}
}

func TestClient_Healthy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		httpClient: http.DefaultClient,
		indexName:  "products",
	}

	if !client.Healthy(context.Background()) {
		t.Error("Healthy() = false, want true")
	}
}

func TestClient_Close(t *testing.T) {
	client := &Client{
		baseURL:    "http://localhost:9200",
		httpClient: http.DefaultClient,
		indexName:  "products",
	}

	err := client.Close()
	if err != nil {
		t.Errorf("Close() error = %v, want nil", err)
	}
}

// Helper functions
func ptrFloat64(v float64) *float64 {
	return &v
}

func ptrBool(v bool) *bool {
	return &v
}
