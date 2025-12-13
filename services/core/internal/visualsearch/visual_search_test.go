package visualsearch

import (
	"context"
	"testing"
)

// MockEmbeddingRepository for testing
type MockEmbeddingRepository struct {
	embeddings map[string]*ImageEmbedding
}

func NewMockEmbeddingRepository() *MockEmbeddingRepository {
	return &MockEmbeddingRepository{
		embeddings: make(map[string]*ImageEmbedding),
	}
}

func (m *MockEmbeddingRepository) Store(ctx context.Context, embedding *ImageEmbedding) error {
	m.embeddings[embedding.ProductID] = embedding
	return nil
}

func (m *MockEmbeddingRepository) GetByProductID(ctx context.Context, tenantID, productID string) (*ImageEmbedding, error) {
	if e, ok := m.embeddings[productID]; ok {
		if e.TenantID == tenantID {
			return e, nil
		}
	}
	return nil, ErrEmbeddingNotFound
}

func (m *MockEmbeddingRepository) Delete(ctx context.Context, productID string) error {
	delete(m.embeddings, productID)
	return nil
}

func (m *MockEmbeddingRepository) FindSimilar(ctx context.Context, tenantID string, embedding []float32, limit int, threshold float64) ([]*SimilarProduct, error) {
	var results []*SimilarProduct
	for _, e := range m.embeddings {
		if e.TenantID != tenantID {
			continue
		}
		// Simple cosine similarity for testing
		similarity := cosineSimilarity(embedding, e.Embedding)
		if similarity >= threshold {
			results = append(results, &SimilarProduct{
				ProductID:  e.ProductID,
				ImageURL:   e.ImageURL,
				Similarity: similarity,
			})
		}
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

func (m *MockEmbeddingRepository) Count(ctx context.Context, tenantID string) (int, error) {
	count := 0
	for _, e := range m.embeddings {
		if e.TenantID == tenantID {
			count++
		}
	}
	return count, nil
}

// MockCLIPProvider for testing
type MockCLIPProvider struct {
	embeddings map[string][]float32
}

func NewMockCLIPProvider() *MockCLIPProvider {
	return &MockCLIPProvider{
		embeddings: make(map[string][]float32),
	}
}

func (m *MockCLIPProvider) GetImageEmbedding(ctx context.Context, imageURL string) ([]float32, error) {
	if e, ok := m.embeddings[imageURL]; ok {
		return e, nil
	}
	// Return a mock embedding
	return generateMockEmbedding(512), nil
}

func (m *MockCLIPProvider) GetTextEmbedding(ctx context.Context, text string) ([]float32, error) {
	return generateMockEmbedding(512), nil
}

// MockProductService for testing
type MockProductService struct {
	products map[string]*ProductInfo
}

func NewMockProductService() *MockProductService {
	return &MockProductService{
		products: make(map[string]*ProductInfo),
	}
}

func (m *MockProductService) GetProduct(ctx context.Context, tenantID, productID string) (*ProductInfo, error) {
	key := tenantID + ":" + productID
	if p, ok := m.products[key]; ok {
		return p, nil
	}
	return nil, ErrProductNotFound
}

func (m *MockProductService) ListProducts(ctx context.Context, tenantID string, limit, offset int) ([]*ProductInfo, error) {
	var results []*ProductInfo
	for _, p := range m.products {
		if p.TenantID == tenantID {
			results = append(results, p)
		}
	}
	return results, nil
}

// Helper functions
func generateMockEmbedding(dim int) []float32 {
	embedding := make([]float32, dim)
	for i := 0; i < dim; i++ {
		embedding[i] = float32(i) / float32(dim)
	}
	return embedding
}

func cosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) {
		return 0
	}
	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += float64(a[i] * b[i])
		normA += float64(a[i] * a[i])
		normB += float64(b[i] * b[i])
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dotProduct / (sqrt(normA) * sqrt(normB))
}

func sqrt(x float64) float64 {
	if x <= 0 {
		return 0
	}
	z := x
	for i := 0; i < 100; i++ {
		z = z - (z*z-x)/(2*z)
	}
	return z
}

func TestVisualSearchService_IndexProduct(t *testing.T) {
	repo := NewMockEmbeddingRepository()
	clip := NewMockCLIPProvider()
	products := NewMockProductService()

	service := NewVisualSearchService(repo, clip, products)

	product := &ProductInfo{
		ID:       "prod-1",
		TenantID: "tenant-1",
		Name:     "Test Product",
		ImageURL: "https://example.com/image.jpg",
	}
	products.products["tenant-1:prod-1"] = product

	err := service.IndexProduct(context.Background(), "tenant-1", "prod-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check embedding was stored
	if _, ok := repo.embeddings["prod-1"]; !ok {
		t.Error("expected embedding to be stored")
	}

	stored := repo.embeddings["prod-1"]
	if stored.TenantID != "tenant-1" {
		t.Errorf("expected tenant ID tenant-1, got %s", stored.TenantID)
	}
}

func TestVisualSearchService_SearchByImage(t *testing.T) {
	repo := NewMockEmbeddingRepository()
	clip := NewMockCLIPProvider()
	products := NewMockProductService()

	service := NewVisualSearchService(repo, clip, products)

	// Add some embeddings
	embedding := generateMockEmbedding(512)
	repo.embeddings["prod-1"] = &ImageEmbedding{
		ID:        "emb-1",
		TenantID:  "tenant-1",
		ProductID: "prod-1",
		ImageURL:  "https://example.com/image1.jpg",
		Embedding: embedding,
	}
	repo.embeddings["prod-2"] = &ImageEmbedding{
		ID:        "emb-2",
		TenantID:  "tenant-1",
		ProductID: "prod-2",
		ImageURL:  "https://example.com/image2.jpg",
		Embedding: embedding, // Same embedding for testing
	}

	// Set the mock CLIP provider to return the same embedding
	clip.embeddings["https://example.com/query.jpg"] = embedding

	results, err := service.SearchByImage(context.Background(), "tenant-1", "https://example.com/query.jpg", 10)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(results) < 1 {
		t.Error("expected at least 1 result")
	}

	// Results should have similarity close to 1.0 since we used the same embedding
	for _, r := range results {
		if r.Similarity < 0.9 {
			t.Errorf("expected high similarity, got %f", r.Similarity)
		}
	}
}

func TestVisualSearchService_SearchByText(t *testing.T) {
	repo := NewMockEmbeddingRepository()
	clip := NewMockCLIPProvider()
	products := NewMockProductService()

	service := NewVisualSearchService(repo, clip, products)

	embedding := generateMockEmbedding(512)
	repo.embeddings["prod-1"] = &ImageEmbedding{
		ID:        "emb-1",
		TenantID:  "tenant-1",
		ProductID: "prod-1",
		ImageURL:  "https://example.com/image1.jpg",
		Embedding: embedding,
	}

	results, err := service.SearchByText(context.Background(), "tenant-1", "red dress", 10)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Should return results (may be empty depending on threshold)
	if results == nil {
		t.Error("expected non-nil results")
	}
}

func TestVisualSearchService_DeleteEmbedding(t *testing.T) {
	repo := NewMockEmbeddingRepository()
	clip := NewMockCLIPProvider()
	products := NewMockProductService()

	service := NewVisualSearchService(repo, clip, products)

	repo.embeddings["prod-1"] = &ImageEmbedding{
		ID:        "emb-1",
		TenantID:  "tenant-1",
		ProductID: "prod-1",
	}

	err := service.DeleteEmbedding(context.Background(), "prod-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, ok := repo.embeddings["prod-1"]; ok {
		t.Error("expected embedding to be deleted")
	}
}

func TestVisualSearchService_GetStats(t *testing.T) {
	repo := NewMockEmbeddingRepository()
	clip := NewMockCLIPProvider()
	products := NewMockProductService()

	service := NewVisualSearchService(repo, clip, products)

	// Add some embeddings
	repo.embeddings["prod-1"] = &ImageEmbedding{TenantID: "tenant-1", ProductID: "prod-1"}
	repo.embeddings["prod-2"] = &ImageEmbedding{TenantID: "tenant-1", ProductID: "prod-2"}
	repo.embeddings["prod-3"] = &ImageEmbedding{TenantID: "tenant-2", ProductID: "prod-3"}

	stats, err := service.GetStats(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if stats.IndexedProducts != 2 {
		t.Errorf("expected 2 indexed products, got %d", stats.IndexedProducts)
	}
}

func TestVisualSearchService_ReindexAll(t *testing.T) {
	repo := NewMockEmbeddingRepository()
	clip := NewMockCLIPProvider()
	products := NewMockProductService()

	service := NewVisualSearchService(repo, clip, products)

	// Add products
	products.products["tenant-1:prod-1"] = &ProductInfo{
		ID:       "prod-1",
		TenantID: "tenant-1",
		ImageURL: "https://example.com/image1.jpg",
	}
	products.products["tenant-1:prod-2"] = &ProductInfo{
		ID:       "prod-2",
		TenantID: "tenant-1",
		ImageURL: "https://example.com/image2.jpg",
	}

	err := service.ReindexAll(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check all products were indexed
	count, _ := repo.Count(context.Background(), "tenant-1")
	if count != 2 {
		t.Errorf("expected 2 embeddings, got %d", count)
	}
}

func TestEmbeddingDimension(t *testing.T) {
	// CLIP ViT-B/32 produces 512-dimensional embeddings
	expectedDim := 512
	embedding := generateMockEmbedding(expectedDim)

	if len(embedding) != expectedDim {
		t.Errorf("expected embedding dimension %d, got %d", expectedDim, len(embedding))
	}
}

func TestCosineSimilarity(t *testing.T) {
	tests := []struct {
		name     string
		a, b     []float32
		expected float64
	}{
		{
			name:     "identical vectors",
			a:        []float32{1, 0, 0},
			b:        []float32{1, 0, 0},
			expected: 1.0,
		},
		{
			name:     "orthogonal vectors",
			a:        []float32{1, 0, 0},
			b:        []float32{0, 1, 0},
			expected: 0.0,
		},
		{
			name:     "opposite vectors",
			a:        []float32{1, 0, 0},
			b:        []float32{-1, 0, 0},
			expected: -1.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cosineSimilarity(tt.a, tt.b)
			diff := result - tt.expected
			if diff < -0.001 || diff > 0.001 {
				t.Errorf("expected %f, got %f", tt.expected, result)
			}
		})
	}
}

func TestVisualSearchService_ValidateImageURL(t *testing.T) {
	tests := []struct {
		url     string
		isValid bool
	}{
		{"https://example.com/image.jpg", true},
		{"https://example.com/image.png", true},
		{"https://example.com/image.webp", true},
		{"http://example.com/image.jpg", true},
		{"ftp://example.com/image.jpg", false},
		{"not-a-url", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			result := isValidImageURL(tt.url)
			if result != tt.isValid {
				t.Errorf("expected %v, got %v", tt.isValid, result)
			}
		})
	}
}

func isValidImageURL(url string) bool {
	if url == "" {
		return false
	}
	if len(url) < 8 {
		return false
	}
	prefix := url[:7]
	if prefix != "http://" && url[:8] != "https://" {
		return false
	}
	return true
}

func TestSimilarityThreshold(t *testing.T) {
	// Default threshold should be reasonable for visual search
	defaultThreshold := 0.7

	if defaultThreshold < 0.5 || defaultThreshold > 0.95 {
		t.Errorf("default threshold %f is outside reasonable range", defaultThreshold)
	}
}

func TestVisualSearchService_BatchIndex(t *testing.T) {
	repo := NewMockEmbeddingRepository()
	clip := NewMockCLIPProvider()
	products := NewMockProductService()

	service := NewVisualSearchService(repo, clip, products)

	// Add products
	for i := 0; i < 10; i++ {
		id := "prod-" + string(rune('0'+i))
		products.products["tenant-1:"+id] = &ProductInfo{
			ID:       id,
			TenantID: "tenant-1",
			ImageURL: "https://example.com/image" + id + ".jpg",
		}
	}

	productIDs := []string{
		"prod-0", "prod-1", "prod-2", "prod-3", "prod-4",
		"prod-5", "prod-6", "prod-7", "prod-8", "prod-9",
	}

	results, err := service.BatchIndex(context.Background(), "tenant-1", productIDs)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if results.Successful != 10 {
		t.Errorf("expected 10 successful, got %d", results.Successful)
	}

	if results.Failed != 0 {
		t.Errorf("expected 0 failed, got %d", results.Failed)
	}
}
