// Package support provides AI-powered customer support automation
package support

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Agent handles automated customer support tasks
type Agent struct {
	visionProvider VisionProvider
	llmProvider    LLMProvider
	ticketRepo     TicketRepository
	returnRepo     ReturnRepository
	config         AgentConfig
}

type AgentConfig struct {
	AutoApproveThreshold  float64       // Confidence threshold for auto-approval
	MaxImageSize          int64         // Max image size in bytes
	SupportedImageFormats []string      // Supported image formats
	ResponseLanguage      string        // Response language (uk, en)
	Timeout               time.Duration
}

func DefaultAgentConfig() AgentConfig {
	return AgentConfig{
		AutoApproveThreshold:  0.85,
		MaxImageSize:          10 * 1024 * 1024, // 10MB
		SupportedImageFormats: []string{"image/jpeg", "image/png", "image/webp"},
		ResponseLanguage:      "uk",
		Timeout:               60 * time.Second,
	}
}

// VisionProvider analyzes images
type VisionProvider interface {
	AnalyzeImage(ctx context.Context, imageData []byte, prompt string) (*VisionAnalysis, error)
}

// LLMProvider generates text responses
type LLMProvider interface {
	Complete(ctx context.Context, messages []Message, maxTokens int) (string, error)
}

type Message struct {
	Role    string
	Content string
}

type VisionAnalysis struct {
	Description    string
	DefectDetected bool
	DefectType     string
	Confidence     float64
	Details        map[string]interface{}
}

// TicketRepository manages support tickets
type TicketRepository interface {
	Create(ctx context.Context, ticket *Ticket) error
	Update(ctx context.Context, ticket *Ticket) error
	GetByID(ctx context.Context, id string) (*Ticket, error)
}

// ReturnRepository manages return requests
type ReturnRepository interface {
	Create(ctx context.Context, ret *Return) error
	Update(ctx context.Context, ret *Return) error
	GetByID(ctx context.Context, id string) (*Return, error)
}

type Ticket struct {
	ID          string
	TenantID    string
	CustomerID  string
	OrderID     string
	Subject     string
	Description string
	Status      string
	Priority    string
	Category    string
	AIAnalysis  *AIAnalysis
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Return struct {
	ID             string
	TenantID       string
	OrderID        string
	ProductID      string
	Reason         string
	Description    string
	ImageURLs      []string
	Status         string
	AIAnalysis     *AIAnalysis
	AutoApproved   bool
	ApprovalReason string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type AIAnalysis struct {
	Summary          string
	DefectConfirmed  bool
	DefectType       string
	Confidence       float64
	RecommendedAction string
	Details          map[string]interface{}
	ProcessedAt      time.Time
}

func NewAgent(
	vision VisionProvider,
	llm LLMProvider,
	tickets TicketRepository,
	returns ReturnRepository,
	config AgentConfig,
) *Agent {
	return &Agent{
		visionProvider: vision,
		llmProvider:    llm,
		ticketRepo:     tickets,
		returnRepo:     returns,
		config:         config,
	}
}

// =============================================================================
// RETURN PROCESSING
// =============================================================================

type ProcessReturnRequest struct {
	TenantID    string
	ReturnID    string
	OrderID     string
	ProductID   string
	ProductName string
	Reason      string
	Description string
	Images      []ImageData
}

type ImageData struct {
	Data        []byte
	ContentType string
	URL         string
}

type ProcessReturnResponse struct {
	ReturnID         string
	AutoApproved     bool
	ApprovalReason   string
	DefectConfirmed  bool
	DefectType       string
	Confidence       float64
	CustomerMessage  string
	InternalNotes    string
	RecommendedAction string
}

// ProcessReturn analyzes a return request using vision AI
func (a *Agent) ProcessReturn(ctx context.Context, req ProcessReturnRequest) (*ProcessReturnResponse, error) {
	if len(req.Images) == 0 {
		return nil, fmt.Errorf("at least one image is required for return processing")
	}

	// Analyze each image
	var analyses []*VisionAnalysis
	for _, img := range req.Images {
		prompt := fmt.Sprintf(`Проаналізуй це фото товару "%s" для запиту на повернення.

Причина повернення від клієнта: %s
Опис проблеми: %s

Визнач:
1. Чи видно дефект на фото?
2. Який тип дефекту (механічне пошкодження, виробничий брак, неповна комплектація, невідповідність опису)?
3. Чи відповідає стан товару опису клієнта?
4. Рівень впевненості у твоєму аналізі (0-1)

Відповідай у форматі JSON:
{
  "defect_detected": true/false,
  "defect_type": "тип дефекту",
  "matches_description": true/false,
  "confidence": 0.95,
  "details": "детальний опис того, що ти бачиш"
}`, req.ProductName, req.Reason, req.Description)

		analysis, err := a.visionProvider.AnalyzeImage(ctx, img.Data, prompt)
		if err != nil {
			return nil, fmt.Errorf("failed to analyze image: %w", err)
		}
		analyses = append(analyses, analysis)
	}

	// Aggregate analysis results
	aggregated := a.aggregateAnalyses(analyses)

	// Determine if we can auto-approve
	autoApprove := aggregated.Confidence >= a.config.AutoApproveThreshold && aggregated.DefectDetected

	// Generate customer message
	customerMessage := a.generateCustomerMessage(aggregated, autoApprove)

	// Generate internal notes
	internalNotes := a.generateInternalNotes(req, analyses)

	// Determine recommended action
	recommendedAction := "manual_review"
	if autoApprove {
		recommendedAction = "approve"
	} else if !aggregated.DefectDetected && aggregated.Confidence >= 0.8 {
		recommendedAction = "reject"
	}

	// Create approval reason
	approvalReason := ""
	if autoApprove {
		approvalReason = fmt.Sprintf("Автоматично схвалено: виявлено %s з впевненістю %.0f%%",
			aggregated.DefectType, aggregated.Confidence*100)
	}

	return &ProcessReturnResponse{
		ReturnID:          req.ReturnID,
		AutoApproved:      autoApprove,
		ApprovalReason:    approvalReason,
		DefectConfirmed:   aggregated.DefectDetected,
		DefectType:        aggregated.DefectType,
		Confidence:        aggregated.Confidence,
		CustomerMessage:   customerMessage,
		InternalNotes:     internalNotes,
		RecommendedAction: recommendedAction,
	}, nil
}

func (a *Agent) aggregateAnalyses(analyses []*VisionAnalysis) *VisionAnalysis {
	if len(analyses) == 0 {
		return &VisionAnalysis{}
	}

	if len(analyses) == 1 {
		return analyses[0]
	}

	// Count defect votes
	defectVotes := 0
	totalConfidence := 0.0
	defectTypes := make(map[string]int)

	for _, analysis := range analyses {
		if analysis.DefectDetected {
			defectVotes++
			defectTypes[analysis.DefectType]++
		}
		totalConfidence += analysis.Confidence
	}

	// Find most common defect type
	mostCommonDefect := ""
	maxCount := 0
	for defectType, count := range defectTypes {
		if count > maxCount {
			maxCount = count
			mostCommonDefect = defectType
		}
	}

	// Majority voting for defect detection
	defectDetected := defectVotes > len(analyses)/2

	return &VisionAnalysis{
		DefectDetected: defectDetected,
		DefectType:     mostCommonDefect,
		Confidence:     totalConfidence / float64(len(analyses)),
		Description:    fmt.Sprintf("Аналіз %d зображень", len(analyses)),
	}
}

func (a *Agent) generateCustomerMessage(analysis *VisionAnalysis, autoApproved bool) string {
	if autoApproved {
		return fmt.Sprintf(`Шановний клієнте,

Ми проаналізували ваше фото та підтверджуємо наявність дефекту (%s).

Ваш запит на повернення автоматично схвалено. Найближчим часом з вами зв'яжеться наш менеджер для уточнення деталей повернення коштів.

Дякуємо за ваше терпіння!

З повагою,
Служба підтримки`, analysis.DefectType)
	}

	if !analysis.DefectDetected && analysis.Confidence >= 0.8 {
		return `Шановний клієнте,

Ми проаналізували надіслані фото. На жаль, ми не змогли виявити дефект, описаний у вашому зверненні.

Будь ласка, надішліть додаткові фото з іншого ракурсу або зв'яжіться з нашою службою підтримки для детальнішого розгляду вашого запиту.

З повагою,
Служба підтримки`
	}

	return `Шановний клієнте,

Дякуємо за звернення. Ваш запит на повернення отримано та передано на розгляд нашому спеціалісту.

Ми зв'яжемося з вами протягом 24 годин.

З повагою,
Служба підтримки`
}

func (a *Agent) generateInternalNotes(req ProcessReturnRequest, analyses []*VisionAnalysis) string {
	var sb strings.Builder

	sb.WriteString("=== AI Аналіз повернення ===\n\n")
	sb.WriteString(fmt.Sprintf("Товар: %s\n", req.ProductName))
	sb.WriteString(fmt.Sprintf("Причина клієнта: %s\n", req.Reason))
	sb.WriteString(fmt.Sprintf("Опис клієнта: %s\n\n", req.Description))

	sb.WriteString("Результати аналізу зображень:\n")
	for i, analysis := range analyses {
		sb.WriteString(fmt.Sprintf("\nЗображення %d:\n", i+1))
		sb.WriteString(fmt.Sprintf("  - Дефект виявлено: %v\n", analysis.DefectDetected))
		sb.WriteString(fmt.Sprintf("  - Тип дефекту: %s\n", analysis.DefectType))
		sb.WriteString(fmt.Sprintf("  - Впевненість: %.2f\n", analysis.Confidence))
		sb.WriteString(fmt.Sprintf("  - Деталі: %s\n", analysis.Description))
	}

	return sb.String()
}

// =============================================================================
// TICKET CLASSIFICATION
// =============================================================================

type ClassifyTicketRequest struct {
	TenantID    string
	TicketID    string
	Subject     string
	Description string
}

type ClassifyTicketResponse struct {
	Category      string
	Priority      string
	Sentiment     string
	SuggestedTags []string
	AutoResponse  string
	NeedsHuman    bool
}

// ClassifyTicket automatically classifies and prioritizes a support ticket
func (a *Agent) ClassifyTicket(ctx context.Context, req ClassifyTicketRequest) (*ClassifyTicketResponse, error) {
	prompt := fmt.Sprintf(`Проаналізуй цей тікет підтримки:

Тема: %s
Опис: %s

Визнач:
1. Категорію (оплата, доставка, повернення, товар, технічна_проблема, інше)
2. Пріоритет (low, medium, high, urgent)
3. Настрій клієнта (positive, neutral, negative, angry)
4. Теги для класифікації
5. Чи можна відповісти автоматично?
6. Якщо можна - запропонуй автовідповідь

Відповідай у JSON форматі.`, req.Subject, req.Description)

	response, err := a.llmProvider.Complete(ctx, []Message{
		{Role: "system", Content: "Ти — AI асистент для класифікації тікетів підтримки. Відповідай тільки JSON."},
		{Role: "user", Content: prompt},
	}, 500)
	if err != nil {
		return nil, fmt.Errorf("failed to classify ticket: %w", err)
	}

	// Parse JSON response
	var result struct {
		Category     string   `json:"category"`
		Priority     string   `json:"priority"`
		Sentiment    string   `json:"sentiment"`
		Tags         []string `json:"tags"`
		CanAutoReply bool     `json:"can_auto_reply"`
		AutoResponse string   `json:"auto_response"`
	}

	// Try to extract JSON from response
	jsonStart := strings.Index(response, "{")
	jsonEnd := strings.LastIndex(response, "}") + 1
	if jsonStart >= 0 && jsonEnd > jsonStart {
		if err := json.Unmarshal([]byte(response[jsonStart:jsonEnd]), &result); err != nil {
			// Default values if parsing fails
			result.Category = "інше"
			result.Priority = "medium"
			result.Sentiment = "neutral"
		}
	}

	return &ClassifyTicketResponse{
		Category:      result.Category,
		Priority:      result.Priority,
		Sentiment:     result.Sentiment,
		SuggestedTags: result.Tags,
		AutoResponse:  result.AutoResponse,
		NeedsHuman:    !result.CanAutoReply || result.Sentiment == "angry",
	}, nil
}

// =============================================================================
// VISION PROVIDER IMPLEMENTATIONS
// =============================================================================

// OpenAIVisionProvider uses GPT-4 Vision for image analysis
type OpenAIVisionProvider struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

type OpenAIVisionConfig struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

func NewOpenAIVisionProvider(config OpenAIVisionConfig) *OpenAIVisionProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.openai.com/v1"
	}
	if config.Model == "" {
		config.Model = "gpt-4o"
	}
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}

	return &OpenAIVisionProvider{
		apiKey:  config.APIKey,
		baseURL: config.BaseURL,
		model:   config.Model,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

func (p *OpenAIVisionProvider) AnalyzeImage(ctx context.Context, imageData []byte, prompt string) (*VisionAnalysis, error) {
	// Encode image to base64
	imageBase64 := base64.StdEncoding.EncodeToString(imageData)

	requestBody := map[string]interface{}{
		"model": p.model,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type": "image_url",
						"image_url": map[string]string{
							"url": fmt.Sprintf("data:image/jpeg;base64,%s", imageBase64),
						},
					},
				},
			},
		},
		"max_tokens": 1000,
	}

	body, _ := json.Marshal(requestBody)

	req, err := http.NewRequestWithContext(ctx, "POST",
		p.baseURL+"/chat/completions",
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API error: %s", string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	content := result.Choices[0].Message.Content

	// Parse JSON response
	var analysisResult struct {
		DefectDetected     bool    `json:"defect_detected"`
		DefectType         string  `json:"defect_type"`
		MatchesDescription bool    `json:"matches_description"`
		Confidence         float64 `json:"confidence"`
		Details            string  `json:"details"`
	}

	jsonStart := strings.Index(content, "{")
	jsonEnd := strings.LastIndex(content, "}") + 1
	if jsonStart >= 0 && jsonEnd > jsonStart {
		json.Unmarshal([]byte(content[jsonStart:jsonEnd]), &analysisResult)
	}

	return &VisionAnalysis{
		Description:    analysisResult.Details,
		DefectDetected: analysisResult.DefectDetected,
		DefectType:     analysisResult.DefectType,
		Confidence:     analysisResult.Confidence,
		Details: map[string]interface{}{
			"matches_description": analysisResult.MatchesDescription,
		},
	}, nil
}

// AnthropicVisionProvider uses Claude Vision for image analysis
type AnthropicVisionProvider struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

func NewAnthropicVisionProvider(config OpenAIVisionConfig) *AnthropicVisionProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.anthropic.com/v1"
	}
	if config.Model == "" {
		config.Model = "claude-3-5-sonnet-20241022"
	}
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}

	return &AnthropicVisionProvider{
		apiKey:  config.APIKey,
		baseURL: config.BaseURL,
		model:   config.Model,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

func (p *AnthropicVisionProvider) AnalyzeImage(ctx context.Context, imageData []byte, prompt string) (*VisionAnalysis, error) {
	imageBase64 := base64.StdEncoding.EncodeToString(imageData)

	requestBody := map[string]interface{}{
		"model":      p.model,
		"max_tokens": 1000,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "image",
						"source": map[string]string{
							"type":         "base64",
							"media_type":   "image/jpeg",
							"data":         imageBase64,
						},
					},
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
	}

	body, _ := json.Marshal(requestBody)

	req, err := http.NewRequestWithContext(ctx, "POST",
		p.baseURL+"/messages",
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Anthropic API error: %s", string(respBody))
	}

	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	var content string
	for _, c := range result.Content {
		if c.Type == "text" {
			content = c.Text
			break
		}
	}

	// Parse JSON response
	var analysisResult struct {
		DefectDetected     bool    `json:"defect_detected"`
		DefectType         string  `json:"defect_type"`
		MatchesDescription bool    `json:"matches_description"`
		Confidence         float64 `json:"confidence"`
		Details            string  `json:"details"`
	}

	jsonStart := strings.Index(content, "{")
	jsonEnd := strings.LastIndex(content, "}") + 1
	if jsonStart >= 0 && jsonEnd > jsonStart {
		json.Unmarshal([]byte(content[jsonStart:jsonEnd]), &analysisResult)
	}

	return &VisionAnalysis{
		Description:    analysisResult.Details,
		DefectDetected: analysisResult.DefectDetected,
		DefectType:     analysisResult.DefectType,
		Confidence:     analysisResult.Confidence,
		Details: map[string]interface{}{
			"matches_description": analysisResult.MatchesDescription,
		},
	}, nil
}
