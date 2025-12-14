package visualsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// QdrantProvider implements vector storage using Qdrant vector database
// Qdrant is better than pgvector for >1M vectors - provides millisecond search
type QdrantProvider struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	collection string
}

type QdrantConfig struct {
	URL        string
	APIKey     string
	Collection string
	Timeout    time.Duration
}

func NewQdrantProvider(config QdrantConfig) *QdrantProvider {
	if config.Collection == "" {
		config.Collection = "product_images"
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	return &QdrantProvider{
		baseURL:    config.URL,
		apiKey:     config.APIKey,
		collection: config.Collection,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

// ==================== COLLECTION MANAGEMENT ====================

type CollectionConfig struct {
	Vectors VectorsConfig `json:"vectors"`
}

type VectorsConfig struct {
	Size     int    `json:"size"`
	Distance string `json:"distance"` // Cosine, Euclid, Dot
}

// CreateCollection creates the collection for image embeddings
func (q *QdrantProvider) CreateCollection(ctx context.Context) error {
	config := CollectionConfig{
		Vectors: VectorsConfig{
			Size:     512, // CLIP ViT-B/32 dimension
			Distance: "Cosine",
		},
	}

	body, _ := json.Marshal(config)

	req, err := http.NewRequestWithContext(ctx, "PUT",
		fmt.Sprintf("%s/collections/%s", q.baseURL, q.collection),
		bytes.NewReader(body))
	if err != nil {
		return err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusConflict {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to create collection: %s", string(body))
	}

	// Create payload index for tenant_id filtering
	if err := q.createPayloadIndex(ctx, "tenant_id", "keyword"); err != nil {
		return fmt.Errorf("failed to create tenant index: %w", err)
	}

	// Create payload index for product_id
	if err := q.createPayloadIndex(ctx, "product_id", "keyword"); err != nil {
		return fmt.Errorf("failed to create product index: %w", err)
	}

	return nil
}

func (q *QdrantProvider) createPayloadIndex(ctx context.Context, field, fieldType string) error {
	body := map[string]interface{}{
		"field_name":   field,
		"field_schema": fieldType,
	}

	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "PUT",
		fmt.Sprintf("%s/collections/%s/index", q.baseURL, q.collection),
		bytes.NewReader(data))
	if err != nil {
		return err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// ==================== POINT OPERATIONS ====================

type QdrantPoint struct {
	ID      string                 `json:"id"`
	Vector  []float32              `json:"vector"`
	Payload map[string]interface{} `json:"payload"`
}

type UpsertPointsRequest struct {
	Points []QdrantPoint `json:"points"`
}

// UpsertPoint stores or updates a point in Qdrant
func (q *QdrantProvider) UpsertPoint(ctx context.Context, embedding *ImageEmbedding) error {
	point := QdrantPoint{
		ID:     embedding.ID,
		Vector: embedding.Embedding,
		Payload: map[string]interface{}{
			"tenant_id":  embedding.TenantID,
			"product_id": embedding.ProductID,
			"image_url":  embedding.ImageURL,
			"created_at": embedding.CreatedAt.Format(time.RFC3339),
		},
	}

	request := UpsertPointsRequest{
		Points: []QdrantPoint{point},
	}

	body, _ := json.Marshal(request)

	req, err := http.NewRequestWithContext(ctx, "PUT",
		fmt.Sprintf("%s/collections/%s/points", q.baseURL, q.collection),
		bytes.NewReader(body))
	if err != nil {
		return err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to upsert point: %s", string(respBody))
	}

	return nil
}

// UpsertBatch stores multiple points at once (more efficient)
func (q *QdrantProvider) UpsertBatch(ctx context.Context, embeddings []*ImageEmbedding) error {
	points := make([]QdrantPoint, len(embeddings))
	for i, emb := range embeddings {
		points[i] = QdrantPoint{
			ID:     emb.ID,
			Vector: emb.Embedding,
			Payload: map[string]interface{}{
				"tenant_id":  emb.TenantID,
				"product_id": emb.ProductID,
				"image_url":  emb.ImageURL,
				"created_at": emb.CreatedAt.Format(time.RFC3339),
			},
		}
	}

	request := UpsertPointsRequest{Points: points}
	body, _ := json.Marshal(request)

	req, err := http.NewRequestWithContext(ctx, "PUT",
		fmt.Sprintf("%s/collections/%s/points", q.baseURL, q.collection),
		bytes.NewReader(body))
	if err != nil {
		return err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to upsert batch: %s", string(respBody))
	}

	return nil
}

// DeletePoint removes a point from Qdrant
func (q *QdrantProvider) DeletePoint(ctx context.Context, pointID string) error {
	body := map[string]interface{}{
		"points": []string{pointID},
	}

	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/collections/%s/points/delete", q.baseURL, q.collection),
		bytes.NewReader(data))
	if err != nil {
		return err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// DeleteByTenant removes all points for a tenant
func (q *QdrantProvider) DeleteByTenant(ctx context.Context, tenantID string) error {
	body := map[string]interface{}{
		"filter": map[string]interface{}{
			"must": []map[string]interface{}{
				{
					"key":   "tenant_id",
					"match": map[string]interface{}{"value": tenantID},
				},
			},
		},
	}

	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/collections/%s/points/delete", q.baseURL, q.collection),
		bytes.NewReader(data))
	if err != nil {
		return err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// ==================== SEARCH ====================

type SearchRequest struct {
	Vector      []float32              `json:"vector"`
	Limit       int                    `json:"limit"`
	Filter      map[string]interface{} `json:"filter,omitempty"`
	WithPayload bool                   `json:"with_payload"`
	ScoreThreshold float64             `json:"score_threshold,omitempty"`
}

type SearchResponse struct {
	Result []SearchResult `json:"result"`
	Time   float64        `json:"time"`
}

type SearchResult struct {
	ID      string                 `json:"id"`
	Score   float64                `json:"score"`
	Payload map[string]interface{} `json:"payload"`
}

// Search finds similar vectors with tenant isolation
func (q *QdrantProvider) Search(ctx context.Context, tenantID string, vector []float32, limit int, threshold float64) ([]*SimilarProduct, error) {
	if limit <= 0 {
		limit = 10
	}
	if threshold <= 0 {
		threshold = 0.7
	}

	request := SearchRequest{
		Vector:      vector,
		Limit:       limit,
		WithPayload: true,
		ScoreThreshold: threshold,
		Filter: map[string]interface{}{
			"must": []map[string]interface{}{
				{
					"key":   "tenant_id",
					"match": map[string]interface{}{"value": tenantID},
				},
			},
		},
	}

	body, _ := json.Marshal(request)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/collections/%s/points/search", q.baseURL, q.collection),
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("search failed: %s", string(respBody))
	}

	var searchResp SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	results := make([]*SimilarProduct, len(searchResp.Result))
	for i, r := range searchResp.Result {
		productID, _ := r.Payload["product_id"].(string)
		imageURL, _ := r.Payload["image_url"].(string)

		results[i] = &SimilarProduct{
			ProductID:  productID,
			ImageURL:   imageURL,
			Similarity: r.Score,
		}
	}

	return results, nil
}

// ==================== COLLECTION INFO ====================

type CollectionInfo struct {
	PointsCount int `json:"points_count"`
	Status      string `json:"status"`
}

func (q *QdrantProvider) GetCollectionInfo(ctx context.Context) (*CollectionInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("%s/collections/%s", q.baseURL, q.collection), nil)
	if err != nil {
		return nil, err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Result struct {
			PointsCount int `json:"points_count"`
			Status      string `json:"status"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &CollectionInfo{
		PointsCount: result.Result.PointsCount,
		Status:      result.Result.Status,
	}, nil
}

// CountByTenant counts points for a specific tenant
func (q *QdrantProvider) CountByTenant(ctx context.Context, tenantID string) (int, error) {
	body := map[string]interface{}{
		"filter": map[string]interface{}{
			"must": []map[string]interface{}{
				{
					"key":   "tenant_id",
					"match": map[string]interface{}{"value": tenantID},
				},
			},
		},
		"exact": true,
	}

	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/collections/%s/points/count", q.baseURL, q.collection),
		bytes.NewReader(data))
	if err != nil {
		return 0, err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Result struct {
			Count int `json:"count"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	return result.Result.Count, nil
}

// ==================== HELPERS ====================

func (q *QdrantProvider) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if q.apiKey != "" {
		req.Header.Set("api-key", q.apiKey)
	}
}

// ==================== HEALTH CHECK ====================

func (q *QdrantProvider) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("%s/", q.baseURL), nil)
	if err != nil {
		return err
	}

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("qdrant unhealthy: status %d", resp.StatusCode)
	}

	return nil
}

// ==================== RECOMMENDATION HELPERS ====================

// SearchByProductID finds products similar to a given product
func (q *QdrantProvider) SearchByProductID(ctx context.Context, tenantID, productID string, limit int) ([]*SimilarProduct, error) {
	// First, get the vector for this product
	body := map[string]interface{}{
		"filter": map[string]interface{}{
			"must": []map[string]interface{}{
				{"key": "tenant_id", "match": map[string]interface{}{"value": tenantID}},
				{"key": "product_id", "match": map[string]interface{}{"value": productID}},
			},
		},
		"limit":        1,
		"with_payload": false,
		"with_vector":  true,
	}

	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/collections/%s/points/scroll", q.baseURL, q.collection),
		bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	q.setHeaders(req)

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scrollResp struct {
		Result struct {
			Points []struct {
				Vector []float32 `json:"vector"`
			} `json:"points"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&scrollResp); err != nil {
		return nil, err
	}

	if len(scrollResp.Result.Points) == 0 {
		return nil, fmt.Errorf("product not found in index")
	}

	// Search for similar products (excluding the query product)
	results, err := q.Search(ctx, tenantID, scrollResp.Result.Points[0].Vector, limit+1, 0.5)
	if err != nil {
		return nil, err
	}

	// Filter out the query product
	filtered := make([]*SimilarProduct, 0, len(results))
	for _, r := range results {
		if r.ProductID != productID {
			filtered = append(filtered, r)
		}
		if len(filtered) >= limit {
			break
		}
	}

	return filtered, nil
}
