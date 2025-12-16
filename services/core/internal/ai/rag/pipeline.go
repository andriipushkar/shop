// Package rag implements Retrieval-Augmented Generation for shopping assistance
package rag

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

// Pipeline orchestrates the RAG process: retrieve relevant context, then generate response
type Pipeline struct {
	vectorStore   VectorStore
	llmProvider   LLMProvider
	embedder      Embedder
	productRepo   ProductRepository
	orderRepo     OrderRepository
	config        Config
}

type Config struct {
	MaxContextItems    int           `json:"max_context_items"`
	SimilarityThreshold float64      `json:"similarity_threshold"`
	MaxTokens          int           `json:"max_tokens"`
	Temperature        float64       `json:"temperature"`
	SystemPrompt       string        `json:"system_prompt"`
	Timeout            time.Duration `json:"timeout"`
}

func DefaultConfig() Config {
	return Config{
		MaxContextItems:    10,
		SimilarityThreshold: 0.7,
		MaxTokens:          1024,
		Temperature:        0.7,
		SystemPrompt:       defaultSystemPrompt,
		Timeout:            30 * time.Second,
	}
}

const defaultSystemPrompt = `Ти — розумний помічник покупок для українського інтернет-магазину.
Твоя мета — допомогти клієнту знайти ідеальний товар, відповісти на питання та надати персоналізовані рекомендації.

Правила:
1. Відповідай українською мовою
2. Будь дружнім та корисним
3. Використовуй інформацію про товари з контексту
4. Якщо не знаєш відповіді — чесно скажи про це
5. Пропонуй альтернативи, якщо товар не підходить
6. Враховуй попередні покупки клієнта для персоналізації

Формат відповіді:
- Коротко та по суті
- Використовуй списки для порівняння товарів
- Вказуй ціни в гривнях
- Додавай emoji для візуального виділення`

// Interfaces for dependency injection
type VectorStore interface {
	Search(ctx context.Context, tenantID string, vector []float32, limit int, threshold float64) ([]VectorResult, error)
	SearchByText(ctx context.Context, tenantID, text string, limit int) ([]VectorResult, error)
}

type VectorResult struct {
	ID         string
	ProductID  string
	Score      float64
	Metadata   map[string]interface{}
}

type LLMProvider interface {
	Complete(ctx context.Context, request CompletionRequest) (*CompletionResponse, error)
	StreamComplete(ctx context.Context, request CompletionRequest) (<-chan StreamChunk, error)
}

type CompletionRequest struct {
	Messages    []Message
	MaxTokens   int
	Temperature float64
	Model       string
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type CompletionResponse struct {
	Content    string
	TokensUsed int
	Model      string
}

type StreamChunk struct {
	Content string
	Done    bool
	Error   error
}

type Embedder interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	EmbedBatch(ctx context.Context, texts []string) ([][]float32, error)
}

type ProductRepository interface {
	GetByIDs(ctx context.Context, tenantID string, ids []string) ([]Product, error)
}

type OrderRepository interface {
	GetRecentByCustomer(ctx context.Context, tenantID, customerID string, limit int) ([]Order, error)
}

type Product struct {
	ID          string
	Name        string
	Description string
	Price       float64
	Currency    string
	Category    string
	Brand       string
	InStock     bool
	Attributes  map[string]string
	ImageURL    string
}

type Order struct {
	ID        string
	Products  []OrderProduct
	Total     float64
	CreatedAt time.Time
}

type OrderProduct struct {
	ProductID string
	Name      string
	Quantity  int
}

// NewPipeline creates a new RAG pipeline
func NewPipeline(
	vectorStore VectorStore,
	llmProvider LLMProvider,
	embedder Embedder,
	productRepo ProductRepository,
	orderRepo OrderRepository,
	config Config,
) *Pipeline {
	return &Pipeline{
		vectorStore: vectorStore,
		llmProvider: llmProvider,
		embedder:    embedder,
		productRepo: productRepo,
		orderRepo:   orderRepo,
		config:      config,
	}
}

// ChatRequest represents a user chat request
type ChatRequest struct {
	TenantID    string
	CustomerID  string
	Query       string
	History     []Message
	Preferences map[string]string
}

// ChatResponse represents the assistant's response
type ChatResponse struct {
	Answer       string
	Products     []Product
	Suggestions  []string
	TokensUsed   int
	ResponseTime time.Duration
}

// Chat processes a user query and returns a response with relevant products
func (p *Pipeline) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	start := time.Now()

	// Step 1: Embed the user query
	queryVector, err := p.embedder.Embed(ctx, req.Query)
	if err != nil {
		return nil, fmt.Errorf("failed to embed query: %w", err)
	}

	// Step 2: Retrieve relevant products from vector store
	vectorResults, err := p.vectorStore.Search(
		ctx,
		req.TenantID,
		queryVector,
		p.config.MaxContextItems,
		p.config.SimilarityThreshold,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to search vector store: %w", err)
	}

	// Step 3: Fetch full product details
	productIDs := make([]string, len(vectorResults))
	for i, r := range vectorResults {
		productIDs[i] = r.ProductID
	}

	products, err := p.productRepo.GetByIDs(ctx, req.TenantID, productIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch products: %w", err)
	}

	// Step 4: Get customer's recent orders for personalization
	var recentOrders []Order
	if req.CustomerID != "" {
		recentOrders, _ = p.orderRepo.GetRecentByCustomer(ctx, req.TenantID, req.CustomerID, 5)
	}

	// Step 5: Build context for LLM
	context := p.buildContext(products, recentOrders, req.Preferences)

	// Step 6: Build messages for LLM
	messages := p.buildMessages(context, req.Query, req.History)

	// Step 7: Generate response
	completion, err := p.llmProvider.Complete(ctx, CompletionRequest{
		Messages:    messages,
		MaxTokens:   p.config.MaxTokens,
		Temperature: p.config.Temperature,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate response: %w", err)
	}

	// Step 8: Extract product suggestions from response
	suggestions := p.extractSuggestions(completion.Content, products)

	return &ChatResponse{
		Answer:       completion.Content,
		Products:     products,
		Suggestions:  suggestions,
		TokensUsed:   completion.TokensUsed,
		ResponseTime: time.Since(start),
	}, nil
}

// StreamChat streams the response for real-time display
func (p *Pipeline) StreamChat(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	// Similar to Chat but returns streaming response
	queryVector, err := p.embedder.Embed(ctx, req.Query)
	if err != nil {
		errChan := make(chan StreamChunk, 1)
		errChan <- StreamChunk{Error: fmt.Errorf("failed to embed query: %w", err)}
		close(errChan)
		return errChan, nil
	}

	vectorResults, err := p.vectorStore.Search(
		ctx,
		req.TenantID,
		queryVector,
		p.config.MaxContextItems,
		p.config.SimilarityThreshold,
	)
	if err != nil {
		errChan := make(chan StreamChunk, 1)
		errChan <- StreamChunk{Error: fmt.Errorf("failed to search: %w", err)}
		close(errChan)
		return errChan, nil
	}

	productIDs := make([]string, len(vectorResults))
	for i, r := range vectorResults {
		productIDs[i] = r.ProductID
	}

	products, _ := p.productRepo.GetByIDs(ctx, req.TenantID, productIDs)
	var recentOrders []Order
	if req.CustomerID != "" {
		recentOrders, _ = p.orderRepo.GetRecentByCustomer(ctx, req.TenantID, req.CustomerID, 5)
	}

	context := p.buildContext(products, recentOrders, req.Preferences)
	messages := p.buildMessages(context, req.Query, req.History)

	return p.llmProvider.StreamComplete(ctx, CompletionRequest{
		Messages:    messages,
		MaxTokens:   p.config.MaxTokens,
		Temperature: p.config.Temperature,
	})
}

func (p *Pipeline) buildContext(products []Product, orders []Order, preferences map[string]string) string {
	var sb strings.Builder

	// Products context
	sb.WriteString("## Доступні товари:\n\n")
	for i, prod := range products {
		sb.WriteString(fmt.Sprintf("%d. **%s** (%s)\n", i+1, prod.Name, prod.Brand))
		sb.WriteString(fmt.Sprintf("   - Ціна: %.2f %s\n", prod.Price, prod.Currency))
		sb.WriteString(fmt.Sprintf("   - Категорія: %s\n", prod.Category))
		if prod.InStock {
			sb.WriteString("   - ✅ В наявності\n")
		} else {
			sb.WriteString("   - ❌ Немає в наявності\n")
		}
		if prod.Description != "" {
			desc := prod.Description
			if len(desc) > 200 {
				desc = desc[:200] + "..."
			}
			sb.WriteString(fmt.Sprintf("   - Опис: %s\n", desc))
		}
		sb.WriteString("\n")
	}

	// Order history for personalization
	if len(orders) > 0 {
		sb.WriteString("## Попередні покупки клієнта:\n\n")
		for _, order := range orders {
			for _, item := range order.Products {
				sb.WriteString(fmt.Sprintf("- %s (x%d)\n", item.Name, item.Quantity))
			}
		}
		sb.WriteString("\n")
	}

	// User preferences
	if len(preferences) > 0 {
		sb.WriteString("## Уподобання клієнта:\n\n")
		for key, value := range preferences {
			sb.WriteString(fmt.Sprintf("- %s: %s\n", key, value))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func (p *Pipeline) buildMessages(context, query string, history []Message) []Message {
	messages := []Message{
		{Role: "system", Content: p.config.SystemPrompt},
	}

	// Add context as a system message
	messages = append(messages, Message{
		Role:    "system",
		Content: fmt.Sprintf("Контекст для відповіді:\n\n%s", context),
	})

	// Add conversation history
	for _, msg := range history {
		messages = append(messages, msg)
	}

	// Add current query
	messages = append(messages, Message{
		Role:    "user",
		Content: query,
	})

	return messages
}

func (p *Pipeline) extractSuggestions(response string, products []Product) []string {
	var suggestions []string

	// Simple extraction: find product names mentioned in response
	responseLower := strings.ToLower(response)
	for _, prod := range products {
		if strings.Contains(responseLower, strings.ToLower(prod.Name)) {
			suggestions = append(suggestions, prod.ID)
		}
	}

	return suggestions
}

// AnalyzeImage processes an image query for visual search + RAG
func (p *Pipeline) AnalyzeImage(ctx context.Context, req ImageAnalysisRequest) (*ChatResponse, error) {
	// This would integrate with a vision model for image understanding
	// Then use the description to search products

	// For now, return a placeholder
	return nil, fmt.Errorf("image analysis not implemented - requires vision model integration")
}

type ImageAnalysisRequest struct {
	TenantID   string
	CustomerID string
	ImageURL   string
	Query      string
}
