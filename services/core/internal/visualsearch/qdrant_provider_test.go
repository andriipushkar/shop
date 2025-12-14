package visualsearch

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestQdrantProvider_CreateCollection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/collections/product_images" {
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{"result": true})
			return
		}
		if r.Method == "PUT" && r.URL.Path == "/collections/product_images/index" {
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{"result": true})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	err := provider.CreateCollection(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestQdrantProvider_UpsertPoint(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/collections/product_images/points" {
			json.NewDecoder(r.Body).Decode(&receivedBody)
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{"result": true})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	embedding := &ImageEmbedding{
		ID:        "emb-1",
		TenantID:  "tenant-1",
		ProductID: "prod-1",
		ImageURL:  "https://example.com/image.jpg",
		Embedding: make([]float32, 512),
		CreatedAt: time.Now(),
	}

	err := provider.UpsertPoint(context.Background(), embedding)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check that the request was made correctly
	points, ok := receivedBody["points"].([]interface{})
	if !ok || len(points) != 1 {
		t.Error("expected 1 point in request")
	}
}

func TestQdrantProvider_UpsertBatch(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/collections/product_images/points" {
			json.NewDecoder(r.Body).Decode(&receivedBody)
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{"result": true})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	embeddings := []*ImageEmbedding{
		{ID: "emb-1", TenantID: "tenant-1", ProductID: "prod-1", Embedding: make([]float32, 512)},
		{ID: "emb-2", TenantID: "tenant-1", ProductID: "prod-2", Embedding: make([]float32, 512)},
		{ID: "emb-3", TenantID: "tenant-1", ProductID: "prod-3", Embedding: make([]float32, 512)},
	}

	err := provider.UpsertBatch(context.Background(), embeddings)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	points, ok := receivedBody["points"].([]interface{})
	if !ok || len(points) != 3 {
		t.Errorf("expected 3 points in request, got %d", len(points))
	}
}

func TestQdrantProvider_DeletePoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/collections/product_images/points/delete" {
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{"result": true})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	err := provider.DeletePoint(context.Background(), "emb-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestQdrantProvider_DeleteByTenant(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/collections/product_images/points/delete" {
			json.NewDecoder(r.Body).Decode(&receivedBody)
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{"result": true})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	err := provider.DeleteByTenant(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check filter was applied
	filter, ok := receivedBody["filter"].(map[string]interface{})
	if !ok {
		t.Error("expected filter in request")
	}

	must, ok := filter["must"].([]interface{})
	if !ok || len(must) != 1 {
		t.Error("expected must filter with 1 condition")
	}
}

func TestQdrantProvider_Search(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/collections/product_images/points/search" {
			response := map[string]interface{}{
				"result": []map[string]interface{}{
					{
						"id":    "emb-1",
						"score": 0.95,
						"payload": map[string]interface{}{
							"tenant_id":  "tenant-1",
							"product_id": "prod-1",
							"image_url":  "https://example.com/image1.jpg",
						},
					},
					{
						"id":    "emb-2",
						"score": 0.85,
						"payload": map[string]interface{}{
							"tenant_id":  "tenant-1",
							"product_id": "prod-2",
							"image_url":  "https://example.com/image2.jpg",
						},
					},
				},
				"time": 0.001,
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	vector := make([]float32, 512)
	results, err := provider.Search(context.Background(), "tenant-1", vector, 10, 0.7)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(results) != 2 {
		t.Errorf("expected 2 results, got %d", len(results))
	}

	if results[0].ProductID != "prod-1" {
		t.Errorf("expected first result prod-1, got %s", results[0].ProductID)
	}

	if results[0].Similarity != 0.95 {
		t.Errorf("expected similarity 0.95, got %f", results[0].Similarity)
	}
}

func TestQdrantProvider_SearchWithTenantIsolation(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/collections/product_images/points/search" {
			json.NewDecoder(r.Body).Decode(&receivedBody)
			response := map[string]interface{}{
				"result": []map[string]interface{}{},
				"time":   0.001,
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	vector := make([]float32, 512)
	provider.Search(context.Background(), "tenant-123", vector, 10, 0.7)

	// Check tenant filter was applied
	filter, ok := receivedBody["filter"].(map[string]interface{})
	if !ok {
		t.Fatal("expected filter in request")
	}

	must, ok := filter["must"].([]interface{})
	if !ok || len(must) != 1 {
		t.Fatal("expected must filter with 1 condition")
	}

	condition := must[0].(map[string]interface{})
	if condition["key"] != "tenant_id" {
		t.Error("expected tenant_id filter")
	}

	match := condition["match"].(map[string]interface{})
	if match["value"] != "tenant-123" {
		t.Errorf("expected tenant-123 filter, got %v", match["value"])
	}
}

func TestQdrantProvider_GetCollectionInfo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/collections/product_images" {
			response := map[string]interface{}{
				"result": map[string]interface{}{
					"points_count": 1500,
					"status":       "green",
				},
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	info, err := provider.GetCollectionInfo(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if info.PointsCount != 1500 {
		t.Errorf("expected 1500 points, got %d", info.PointsCount)
	}

	if info.Status != "green" {
		t.Errorf("expected status green, got %s", info.Status)
	}
}

func TestQdrantProvider_CountByTenant(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/collections/product_images/points/count" {
			response := map[string]interface{}{
				"result": map[string]interface{}{
					"count": 250,
				},
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	count, err := provider.CountByTenant(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if count != 250 {
		t.Errorf("expected 250, got %d", count)
	}
}

func TestQdrantProvider_HealthCheck(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	err := provider.HealthCheck(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestQdrantProvider_HealthCheckFailed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	err := provider.HealthCheck(context.Background())
	if err == nil {
		t.Error("expected error for unhealthy service")
	}
}

func TestQdrantProvider_SearchByProductID(t *testing.T) {
	callCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++

		if r.Method == "POST" && r.URL.Path == "/collections/product_images/points/scroll" {
			// First call - get vector for product
			response := map[string]interface{}{
				"result": map[string]interface{}{
					"points": []map[string]interface{}{
						{
							"id":     "emb-1",
							"vector": make([]float32, 512),
						},
					},
				},
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}

		if r.Method == "POST" && r.URL.Path == "/collections/product_images/points/search" {
			// Second call - search for similar
			response := map[string]interface{}{
				"result": []map[string]interface{}{
					{
						"id":    "emb-1",
						"score": 1.0, // Same product
						"payload": map[string]interface{}{
							"product_id": "prod-1",
							"image_url":  "https://example.com/image1.jpg",
						},
					},
					{
						"id":    "emb-2",
						"score": 0.85,
						"payload": map[string]interface{}{
							"product_id": "prod-2",
							"image_url":  "https://example.com/image2.jpg",
						},
					},
				},
				"time": 0.001,
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		Collection: "product_images",
	})

	results, err := provider.SearchByProductID(context.Background(), "tenant-1", "prod-1", 5)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Should not include the query product
	for _, r := range results {
		if r.ProductID == "prod-1" {
			t.Error("query product should be excluded from results")
		}
	}
}

func TestQdrantProvider_SetHeaders(t *testing.T) {
	headerReceived := ""

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headerReceived = r.Header.Get("api-key")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	provider := NewQdrantProvider(QdrantConfig{
		URL:        server.URL,
		APIKey:     "test-api-key",
		Collection: "product_images",
	})

	provider.HealthCheck(context.Background())

	if headerReceived != "test-api-key" {
		t.Errorf("expected api-key header, got %s", headerReceived)
	}
}

func TestQdrantConfig_Defaults(t *testing.T) {
	provider := NewQdrantProvider(QdrantConfig{
		URL: "http://localhost:6333",
	})

	if provider.collection != "product_images" {
		t.Errorf("expected default collection product_images, got %s", provider.collection)
	}

	if provider.httpClient.Timeout != 30*time.Second {
		t.Error("expected default timeout 30s")
	}
}
