package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// =============================================================================
// OPENAI PROVIDER
// =============================================================================

type OpenAIProvider struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

type OpenAIConfig struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

func NewOpenAIProvider(config OpenAIConfig) *OpenAIProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.openai.com/v1"
	}
	if config.Model == "" {
		config.Model = "gpt-4o-mini"
	}
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}

	return &OpenAIProvider{
		apiKey:  config.APIKey,
		baseURL: config.BaseURL,
		model:   config.Model,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Temperature float64         `json:"temperature,omitempty"`
	Stream      bool            `json:"stream,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
}

func (p *OpenAIProvider) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	messages := make([]openAIMessage, len(req.Messages))
	for i, m := range req.Messages {
		messages[i] = openAIMessage{Role: m.Role, Content: m.Content}
	}

	model := req.Model
	if model == "" {
		model = p.model
	}

	openAIReq := openAIRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
	}

	body, _ := json.Marshal(openAIReq)

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		p.baseURL+"/chat/completions",
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API error: %s", string(respBody))
	}

	var openAIResp openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return nil, err
	}

	if len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	return &CompletionResponse{
		Content:    openAIResp.Choices[0].Message.Content,
		TokensUsed: openAIResp.Usage.TotalTokens,
		Model:      model,
	}, nil
}

func (p *OpenAIProvider) StreamComplete(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error) {
	ch := make(chan StreamChunk, 100)

	go func() {
		defer close(ch)

		messages := make([]openAIMessage, len(req.Messages))
		for i, m := range req.Messages {
			messages[i] = openAIMessage{Role: m.Role, Content: m.Content}
		}

		model := req.Model
		if model == "" {
			model = p.model
		}

		openAIReq := openAIRequest{
			Model:       model,
			Messages:    messages,
			MaxTokens:   req.MaxTokens,
			Temperature: req.Temperature,
			Stream:      true,
		}

		body, _ := json.Marshal(openAIReq)

		httpReq, err := http.NewRequestWithContext(ctx, "POST",
			p.baseURL+"/chat/completions",
			bytes.NewReader(body))
		if err != nil {
			ch <- StreamChunk{Error: err}
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			ch <- StreamChunk{Error: err}
			return
		}
		defer resp.Body.Close()

		decoder := json.NewDecoder(resp.Body)
		for {
			var chunk struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := decoder.Decode(&chunk); err != nil {
				if err == io.EOF {
					break
				}
				ch <- StreamChunk{Error: err}
				return
			}

			if len(chunk.Choices) > 0 {
				if chunk.Choices[0].FinishReason != "" {
					ch <- StreamChunk{Done: true}
					return
				}
				ch <- StreamChunk{Content: chunk.Choices[0].Delta.Content}
			}
		}
	}()

	return ch, nil
}

// =============================================================================
// ANTHROPIC (CLAUDE) PROVIDER
// =============================================================================

type AnthropicProvider struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

type AnthropicConfig struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

func NewAnthropicProvider(config AnthropicConfig) *AnthropicProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.anthropic.com/v1"
	}
	if config.Model == "" {
		config.Model = "claude-3-5-sonnet-20241022"
	}
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}

	return &AnthropicProvider{
		apiKey:  config.APIKey,
		baseURL: config.BaseURL,
		model:   config.Model,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
	Stream    bool               `json:"stream,omitempty"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

func (p *AnthropicProvider) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	var systemPrompt string
	var messages []anthropicMessage

	for _, m := range req.Messages {
		if m.Role == "system" {
			systemPrompt += m.Content + "\n"
		} else {
			messages = append(messages, anthropicMessage{
				Role:    m.Role,
				Content: m.Content,
			})
		}
	}

	model := req.Model
	if model == "" {
		model = p.model
	}

	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1024
	}

	anthropicReq := anthropicRequest{
		Model:     model,
		MaxTokens: maxTokens,
		System:    systemPrompt,
		Messages:  messages,
	}

	body, _ := json.Marshal(anthropicReq)

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		p.baseURL+"/messages",
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Anthropic API error: %s", string(respBody))
	}

	var anthropicResp anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&anthropicResp); err != nil {
		return nil, err
	}

	if len(anthropicResp.Content) == 0 {
		return nil, fmt.Errorf("no response from Anthropic")
	}

	var content string
	for _, c := range anthropicResp.Content {
		if c.Type == "text" {
			content += c.Text
		}
	}

	return &CompletionResponse{
		Content:    content,
		TokensUsed: anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		Model:      model,
	}, nil
}

func (p *AnthropicProvider) StreamComplete(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error) {
	ch := make(chan StreamChunk, 100)

	go func() {
		defer close(ch)

		var systemPrompt string
		var messages []anthropicMessage

		for _, m := range req.Messages {
			if m.Role == "system" {
				systemPrompt += m.Content + "\n"
			} else {
				messages = append(messages, anthropicMessage{
					Role:    m.Role,
					Content: m.Content,
				})
			}
		}

		model := req.Model
		if model == "" {
			model = p.model
		}

		maxTokens := req.MaxTokens
		if maxTokens == 0 {
			maxTokens = 1024
		}

		anthropicReq := anthropicRequest{
			Model:     model,
			MaxTokens: maxTokens,
			System:    systemPrompt,
			Messages:  messages,
			Stream:    true,
		}

		body, _ := json.Marshal(anthropicReq)

		httpReq, err := http.NewRequestWithContext(ctx, "POST",
			p.baseURL+"/messages",
			bytes.NewReader(body))
		if err != nil {
			ch <- StreamChunk{Error: err}
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("x-api-key", p.apiKey)
		httpReq.Header.Set("anthropic-version", "2023-06-01")

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			ch <- StreamChunk{Error: err}
			return
		}
		defer resp.Body.Close()

		// Parse SSE stream
		decoder := json.NewDecoder(resp.Body)
		for {
			var event struct {
				Type  string `json:"type"`
				Delta struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"delta"`
			}

			if err := decoder.Decode(&event); err != nil {
				if err == io.EOF {
					break
				}
				ch <- StreamChunk{Error: err}
				return
			}

			switch event.Type {
			case "content_block_delta":
				ch <- StreamChunk{Content: event.Delta.Text}
			case "message_stop":
				ch <- StreamChunk{Done: true}
				return
			}
		}
	}()

	return ch, nil
}

// =============================================================================
// OPENAI EMBEDDER
// =============================================================================

type OpenAIEmbedder struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

type OpenAIEmbedderConfig struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

func NewOpenAIEmbedder(config OpenAIEmbedderConfig) *OpenAIEmbedder {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.openai.com/v1"
	}
	if config.Model == "" {
		config.Model = "text-embedding-3-small"
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	return &OpenAIEmbedder{
		apiKey:  config.APIKey,
		baseURL: config.BaseURL,
		model:   config.Model,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

func (e *OpenAIEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	embeddings, err := e.EmbedBatch(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	return embeddings[0], nil
}

func (e *OpenAIEmbedder) EmbedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"model": e.model,
		"input": texts,
	})

	req, err := http.NewRequestWithContext(ctx, "POST",
		e.baseURL+"/embeddings",
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI Embeddings API error: %s", string(respBody))
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
			Index     int       `json:"index"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	embeddings := make([][]float32, len(texts))
	for _, d := range result.Data {
		embeddings[d.Index] = d.Embedding
	}

	return embeddings, nil
}

// =============================================================================
// QDRANT VECTOR STORE ADAPTER
// =============================================================================

type QdrantVectorStore struct {
	baseURL    string
	apiKey     string
	collection string
	httpClient *http.Client
	embedder   Embedder
}

type QdrantVectorStoreConfig struct {
	URL        string
	APIKey     string
	Collection string
	Timeout    time.Duration
}

func NewQdrantVectorStore(config QdrantVectorStoreConfig, embedder Embedder) *QdrantVectorStore {
	if config.Collection == "" {
		config.Collection = "products"
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	return &QdrantVectorStore{
		baseURL:    config.URL,
		apiKey:     config.APIKey,
		collection: config.Collection,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		embedder: embedder,
	}
}

func (q *QdrantVectorStore) Search(ctx context.Context, tenantID string, vector []float32, limit int, threshold float64) ([]VectorResult, error) {
	body := map[string]interface{}{
		"vector":      vector,
		"limit":       limit,
		"with_payload": true,
		"score_threshold": threshold,
		"filter": map[string]interface{}{
			"must": []map[string]interface{}{
				{"key": "tenant_id", "match": map[string]interface{}{"value": tenantID}},
			},
		},
	}

	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/collections/%s/points/search", q.baseURL, q.collection),
		bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if q.apiKey != "" {
		req.Header.Set("api-key", q.apiKey)
	}

	resp, err := q.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Result []struct {
			ID      string                 `json:"id"`
			Score   float64                `json:"score"`
			Payload map[string]interface{} `json:"payload"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	results := make([]VectorResult, len(result.Result))
	for i, r := range result.Result {
		productID, _ := r.Payload["product_id"].(string)
		results[i] = VectorResult{
			ID:        r.ID,
			ProductID: productID,
			Score:     r.Score,
			Metadata:  r.Payload,
		}
	}

	return results, nil
}

func (q *QdrantVectorStore) SearchByText(ctx context.Context, tenantID, text string, limit int) ([]VectorResult, error) {
	// Embed the text first
	vector, err := q.embedder.Embed(ctx, text)
	if err != nil {
		return nil, fmt.Errorf("failed to embed text: %w", err)
	}

	return q.Search(ctx, tenantID, vector, limit, 0.5)
}
