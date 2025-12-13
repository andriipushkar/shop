package visualsearch

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

var (
	ErrImageTooLarge    = errors.New("image size exceeds maximum allowed")
	ErrInvalidImageType = errors.New("invalid image type")
	ErrEmbeddingFailed  = errors.New("failed to generate embedding")
	ErrSearchFailed     = errors.New("visual search failed")
)

const (
	EmbeddingDimension = 512 // CLIP ViT-B/32 dimension
	MaxImageSize       = 10 * 1024 * 1024 // 10MB
)

// ImageEmbedding represents a product image embedding
type ImageEmbedding struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	ProductID   string    `json:"product_id"`
	ImageURL    string    `json:"image_url"`
	Embedding   []float32 `json:"embedding"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// SearchResult represents a visual search result
type SearchResult struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	ImageURL    string  `json:"image_url"`
	Price       float64 `json:"price"`
	Similarity  float64 `json:"similarity"`
}

// SearchRequest for visual search
type SearchRequest struct {
	TenantID   string
	ImageData  []byte
	ImageURL   string
	CategoryID string // Optional: search within category
	Limit      int
}

// SearchResponse from visual search
type SearchResponse struct {
	Query      string          `json:"query,omitempty"`
	Results    []SearchResult  `json:"results"`
	TotalFound int             `json:"total_found"`
	SearchTime float64         `json:"search_time_ms"`
}

// EmbeddingProvider interface for generating embeddings
type EmbeddingProvider interface {
	GenerateImageEmbedding(ctx context.Context, imageData []byte) ([]float32, error)
	GenerateTextEmbedding(ctx context.Context, text string) ([]float32, error)
}

// Repository interface for storing embeddings
type Repository interface {
	Save(ctx context.Context, embedding *ImageEmbedding) error
	GetByProductID(ctx context.Context, productID string) (*ImageEmbedding, error)
	Delete(ctx context.Context, productID string) error
	SearchSimilar(ctx context.Context, tenantID string, embedding []float32, limit int, categoryID string) ([]SearchResult, error)
	BulkSave(ctx context.Context, embeddings []*ImageEmbedding) error
	GetPendingProducts(ctx context.Context, tenantID string, limit int) ([]string, error)
}

// Service handles visual search operations
type Service struct {
	repo       Repository
	provider   EmbeddingProvider
	httpClient *http.Client
}

// NewService creates a new visual search service
func NewService(repo Repository, provider EmbeddingProvider) *Service {
	return &Service{
		repo:     repo,
		provider: provider,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SearchByImage performs visual search using an uploaded image
func (s *Service) SearchByImage(ctx context.Context, req *SearchRequest) (*SearchResponse, error) {
	startTime := time.Now()

	var imageData []byte
	var err error

	if len(req.ImageData) > 0 {
		imageData = req.ImageData
	} else if req.ImageURL != "" {
		imageData, err = s.downloadImage(ctx, req.ImageURL)
		if err != nil {
			return nil, err
		}
	} else {
		return nil, errors.New("no image provided")
	}

	// Validate image
	if len(imageData) > MaxImageSize {
		return nil, ErrImageTooLarge
	}

	// Generate embedding
	embedding, err := s.provider.GenerateImageEmbedding(ctx, imageData)
	if err != nil {
		return nil, ErrEmbeddingFailed
	}

	// Search similar products
	limit := req.Limit
	if limit <= 0 {
		limit = 20
	}

	results, err := s.repo.SearchSimilar(ctx, req.TenantID, embedding, limit, req.CategoryID)
	if err != nil {
		return nil, ErrSearchFailed
	}

	return &SearchResponse{
		Results:    results,
		TotalFound: len(results),
		SearchTime: float64(time.Since(startTime).Milliseconds()),
	}, nil
}

// IndexProduct indexes a product's image for visual search
func (s *Service) IndexProduct(ctx context.Context, tenantID, productID, imageURL string) error {
	// Download image
	imageData, err := s.downloadImage(ctx, imageURL)
	if err != nil {
		return err
	}

	// Generate embedding
	embedding, err := s.provider.GenerateImageEmbedding(ctx, imageData)
	if err != nil {
		return ErrEmbeddingFailed
	}

	// Save embedding
	ie := &ImageEmbedding{
		ID:        generateID(),
		TenantID:  tenantID,
		ProductID: productID,
		ImageURL:  imageURL,
		Embedding: embedding,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return s.repo.Save(ctx, ie)
}

// IndexProducts indexes multiple products (batch)
func (s *Service) IndexProducts(ctx context.Context, tenantID string, products []ProductToIndex) error {
	var embeddings []*ImageEmbedding

	for _, p := range products {
		imageData, err := s.downloadImage(ctx, p.ImageURL)
		if err != nil {
			continue // Skip failed downloads
		}

		embedding, err := s.provider.GenerateImageEmbedding(ctx, imageData)
		if err != nil {
			continue // Skip failed embeddings
		}

		embeddings = append(embeddings, &ImageEmbedding{
			ID:        generateID(),
			TenantID:  tenantID,
			ProductID: p.ProductID,
			ImageURL:  p.ImageURL,
			Embedding: embedding,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		})
	}

	if len(embeddings) == 0 {
		return nil
	}

	return s.repo.BulkSave(ctx, embeddings)
}

// ProductToIndex represents a product to be indexed
type ProductToIndex struct {
	ProductID string
	ImageURL  string
}

// RemoveProduct removes product from visual search index
func (s *Service) RemoveProduct(ctx context.Context, productID string) error {
	return s.repo.Delete(ctx, productID)
}

// ReindexTenant reindexes all products for a tenant
func (s *Service) ReindexTenant(ctx context.Context, tenantID string, getProducts func(offset, limit int) ([]ProductToIndex, error)) error {
	offset := 0
	batchSize := 50

	for {
		products, err := getProducts(offset, batchSize)
		if err != nil {
			return err
		}

		if len(products) == 0 {
			break
		}

		if err := s.IndexProducts(ctx, tenantID, products); err != nil {
			// Log but continue
		}

		offset += len(products)
	}

	return nil
}

// downloadImage downloads image from URL
func (s *Service) downloadImage(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download image: %d", resp.StatusCode)
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		return nil, ErrInvalidImageType
	}

	// Read with size limit
	data, err := io.ReadAll(io.LimitReader(resp.Body, MaxImageSize+1))
	if err != nil {
		return nil, err
	}

	if len(data) > MaxImageSize {
		return nil, ErrImageTooLarge
	}

	return data, nil
}

// Helper function
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// CLIPProvider implements EmbeddingProvider using CLIP model
type CLIPProvider struct {
	apiURL string
	apiKey string
	client *http.Client
}

// NewCLIPProvider creates a new CLIP embedding provider
func NewCLIPProvider(apiURL, apiKey string) *CLIPProvider {
	return &CLIPProvider{
		apiURL: apiURL,
		apiKey: apiKey,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

// GenerateImageEmbedding generates embedding for an image
func (p *CLIPProvider) GenerateImageEmbedding(ctx context.Context, imageData []byte) ([]float32, error) {
	// Create multipart form
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("image", "image.jpg")
	if err != nil {
		return nil, err
	}
	part.Write(imageData)
	writer.Close()

	// Make request
	req, err := http.NewRequestWithContext(ctx, "POST", p.apiURL+"/embed/image", &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("CLIP API error: %s", string(body))
	}

	var result struct {
		Embedding []float32 `json:"embedding"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Embedding, nil
}

// GenerateTextEmbedding generates embedding for text
func (p *CLIPProvider) GenerateTextEmbedding(ctx context.Context, text string) ([]float32, error) {
	reqBody, _ := json.Marshal(map[string]string{"text": text})

	req, err := http.NewRequestWithContext(ctx, "POST", p.apiURL+"/embed/text", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("CLIP API error: %s", string(body))
	}

	var result struct {
		Embedding []float32 `json:"embedding"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Embedding, nil
}

// OpenAICLIPProvider uses OpenAI's CLIP via their API
type OpenAICLIPProvider struct {
	apiKey string
	client *http.Client
}

// NewOpenAICLIPProvider creates a new OpenAI CLIP provider
func NewOpenAICLIPProvider(apiKey string) *OpenAICLIPProvider {
	return &OpenAICLIPProvider{
		apiKey: apiKey,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

// GenerateImageEmbedding generates embedding using OpenAI
func (p *OpenAICLIPProvider) GenerateImageEmbedding(ctx context.Context, imageData []byte) ([]float32, error) {
	// OpenAI doesn't directly support image embeddings via CLIP in their API
	// This would need to be implemented using a self-hosted CLIP service
	// or via a vision model like GPT-4V
	return nil, errors.New("not implemented - use self-hosted CLIP service")
}

// GenerateTextEmbedding generates text embedding
func (p *OpenAICLIPProvider) GenerateTextEmbedding(ctx context.Context, text string) ([]float32, error) {
	reqBody, _ := json.Marshal(map[string]interface{}{
		"model": "text-embedding-3-small",
		"input": text,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/embeddings", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API error: %s", string(body))
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Data) == 0 {
		return nil, errors.New("no embedding returned")
	}

	return result.Data[0].Embedding, nil
}

// PostgresRepository implements Repository using PostgreSQL with pgvector
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a new PostgreSQL repository
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// Save saves an image embedding
func (r *PostgresRepository) Save(ctx context.Context, embedding *ImageEmbedding) error {
	// Convert embedding to pgvector format
	embeddingStr := embeddingToString(embedding.Embedding)

	query := `
		INSERT INTO image_embeddings (id, tenant_id, product_id, image_url, embedding, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5::vector, $6, $7)
		ON CONFLICT (product_id) DO UPDATE SET
			image_url = $4, embedding = $5::vector, updated_at = $7
	`

	_, err := r.db.ExecContext(ctx, query,
		embedding.ID, embedding.TenantID, embedding.ProductID, embedding.ImageURL,
		embeddingStr, embedding.CreatedAt, embedding.UpdatedAt,
	)
	return err
}

// GetByProductID retrieves embedding by product ID
func (r *PostgresRepository) GetByProductID(ctx context.Context, productID string) (*ImageEmbedding, error) {
	query := `
		SELECT id, tenant_id, product_id, image_url, embedding::text, created_at, updated_at
		FROM image_embeddings WHERE product_id = $1
	`

	var embedding ImageEmbedding
	var embeddingStr string

	err := r.db.QueryRowContext(ctx, query, productID).Scan(
		&embedding.ID, &embedding.TenantID, &embedding.ProductID,
		&embedding.ImageURL, &embeddingStr, &embedding.CreatedAt, &embedding.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	embedding.Embedding = stringToEmbedding(embeddingStr)
	return &embedding, nil
}

// Delete deletes embedding by product ID
func (r *PostgresRepository) Delete(ctx context.Context, productID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM image_embeddings WHERE product_id = $1", productID)
	return err
}

// SearchSimilar searches for similar products using cosine similarity
func (r *PostgresRepository) SearchSimilar(ctx context.Context, tenantID string, embedding []float32, limit int, categoryID string) ([]SearchResult, error) {
	embeddingStr := embeddingToString(embedding)

	query := `
		SELECT ie.product_id, p.name, ie.image_url, p.price,
			   1 - (ie.embedding <=> $2::vector) as similarity
		FROM image_embeddings ie
		JOIN products p ON p.id = ie.product_id
		WHERE ie.tenant_id = $1
	`
	args := []interface{}{tenantID, embeddingStr}
	argIndex := 3

	if categoryID != "" {
		query += fmt.Sprintf(" AND p.category_id = $%d", argIndex)
		args = append(args, categoryID)
		argIndex++
	}

	query += fmt.Sprintf(" ORDER BY ie.embedding <=> $2::vector LIMIT $%d", argIndex)
	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var result SearchResult
		if err := rows.Scan(&result.ProductID, &result.ProductName, &result.ImageURL, &result.Price, &result.Similarity); err != nil {
			return nil, err
		}
		results = append(results, result)
	}

	return results, nil
}

// BulkSave saves multiple embeddings
func (r *PostgresRepository) BulkSave(ctx context.Context, embeddings []*ImageEmbedding) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO image_embeddings (id, tenant_id, product_id, image_url, embedding, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5::vector, $6, $7)
		ON CONFLICT (product_id) DO UPDATE SET
			image_url = $4, embedding = $5::vector, updated_at = $7
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, emb := range embeddings {
		embeddingStr := embeddingToString(emb.Embedding)
		_, err := stmt.ExecContext(ctx, emb.ID, emb.TenantID, emb.ProductID, emb.ImageURL,
			embeddingStr, emb.CreatedAt, emb.UpdatedAt)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetPendingProducts gets products that need indexing
func (r *PostgresRepository) GetPendingProducts(ctx context.Context, tenantID string, limit int) ([]string, error) {
	query := `
		SELECT p.id FROM products p
		LEFT JOIN image_embeddings ie ON ie.product_id = p.id
		WHERE p.tenant_id = $1 AND ie.id IS NULL
		LIMIT $2
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var productIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		productIDs = append(productIDs, id)
	}

	return productIDs, nil
}

// Helper functions for converting embeddings
func embeddingToString(embedding []float32) string {
	parts := make([]string, len(embedding))
	for i, v := range embedding {
		parts[i] = fmt.Sprintf("%f", v)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func stringToEmbedding(s string) []float32 {
	// Remove brackets
	s = strings.Trim(s, "[]")
	if s == "" {
		return nil
	}

	parts := strings.Split(s, ",")
	embedding := make([]float32, len(parts))
	for i, p := range parts {
		var v float32
		fmt.Sscanf(strings.TrimSpace(p), "%f", &v)
		embedding[i] = v
	}
	return embedding
}

// HTTP Handler for visual search
type Handler struct {
	service *Service
}

// NewHandler creates a new visual search handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// HandleSearch handles visual search requests
func (h *Handler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxImageSize); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	var imageData []byte
	var imageURL string

	// Check for file upload
	file, _, err := r.FormFile("image")
	if err == nil {
		defer file.Close()
		imageData, err = io.ReadAll(io.LimitReader(file, MaxImageSize))
		if err != nil {
			http.Error(w, "Failed to read image", http.StatusBadRequest)
			return
		}
	} else {
		// Check for URL
		imageURL = r.FormValue("image_url")
		if imageURL == "" {
			http.Error(w, "No image provided", http.StatusBadRequest)
			return
		}
	}

	categoryID := r.FormValue("category_id")
	limit := 20

	req := &SearchRequest{
		TenantID:   tenantID,
		ImageData:  imageData,
		ImageURL:   imageURL,
		CategoryID: categoryID,
		Limit:      limit,
	}

	result, err := h.service.SearchByImage(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
