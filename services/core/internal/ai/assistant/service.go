// Package assistant provides the AI Shopping Assistant service
package assistant

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"core/internal/ai/rag"
)

// Service provides AI-powered shopping assistance
type Service struct {
	pipeline     *rag.Pipeline
	sessions     *SessionStore
	rateLimit    *RateLimiter
	analytics    AnalyticsRecorder
	config       ServiceConfig
}

type ServiceConfig struct {
	MaxSessionHistory  int
	SessionTTL         time.Duration
	RateLimitPerMinute int
	EnableAnalytics    bool
}

func DefaultServiceConfig() ServiceConfig {
	return ServiceConfig{
		MaxSessionHistory:  20,
		SessionTTL:         30 * time.Minute,
		RateLimitPerMinute: 30,
		EnableAnalytics:    true,
	}
}

type AnalyticsRecorder interface {
	RecordInteraction(ctx context.Context, event InteractionEvent)
}

type InteractionEvent struct {
	TenantID     string
	CustomerID   string
	SessionID    string
	Query        string
	Response     string
	Products     []string
	ResponseTime time.Duration
	TokensUsed   int
	Timestamp    time.Time
}

// NewService creates a new AI assistant service
func NewService(pipeline *rag.Pipeline, analytics AnalyticsRecorder, config ServiceConfig) *Service {
	return &Service{
		pipeline:  pipeline,
		sessions:  NewSessionStore(config.SessionTTL, config.MaxSessionHistory),
		rateLimit: NewRateLimiter(config.RateLimitPerMinute),
		analytics: analytics,
		config:    config,
	}
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

type Session struct {
	ID          string
	TenantID    string
	CustomerID  string
	History     []rag.Message
	Preferences map[string]string
	CreatedAt   time.Time
	LastActive  time.Time
}

type SessionStore struct {
	sessions map[string]*Session
	mu       sync.RWMutex
	ttl      time.Duration
	maxHistory int
}

func NewSessionStore(ttl time.Duration, maxHistory int) *SessionStore {
	store := &SessionStore{
		sessions:   make(map[string]*Session),
		ttl:        ttl,
		maxHistory: maxHistory,
	}

	// Start cleanup goroutine
	go store.cleanup()

	return store
}

func (s *SessionStore) Get(sessionID string) (*Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[sessionID]
	if !ok {
		return nil, false
	}

	if time.Since(session.LastActive) > s.ttl {
		return nil, false
	}

	return session, true
}

func (s *SessionStore) Create(sessionID, tenantID, customerID string) *Session {
	s.mu.Lock()
	defer s.mu.Unlock()

	session := &Session{
		ID:          sessionID,
		TenantID:    tenantID,
		CustomerID:  customerID,
		History:     make([]rag.Message, 0),
		Preferences: make(map[string]string),
		CreatedAt:   time.Now(),
		LastActive:  time.Now(),
	}

	s.sessions[sessionID] = session
	return session
}

func (s *SessionStore) AddMessage(sessionID string, msg rag.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[sessionID]
	if !ok {
		return
	}

	session.History = append(session.History, msg)
	session.LastActive = time.Now()

	// Trim history if too long
	if len(session.History) > s.maxHistory {
		session.History = session.History[len(session.History)-s.maxHistory:]
	}
}

func (s *SessionStore) SetPreference(sessionID, key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[sessionID]
	if !ok {
		return
	}

	session.Preferences[key] = value
	session.LastActive = time.Now()
}

func (s *SessionStore) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		s.mu.Lock()
		for id, session := range s.sessions {
			if time.Since(session.LastActive) > s.ttl {
				delete(s.sessions, id)
			}
		}
		s.mu.Unlock()
	}
}

// =============================================================================
// RATE LIMITING
// =============================================================================

type RateLimiter struct {
	requests map[string][]time.Time
	mu       sync.Mutex
	limit    int
}

func NewRateLimiter(limitPerMinute int) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limitPerMinute,
	}
}

func (r *RateLimiter) Allow(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-time.Minute)

	// Get requests in the last minute
	requests := r.requests[key]
	var validRequests []time.Time

	for _, t := range requests {
		if t.After(windowStart) {
			validRequests = append(validRequests, t)
		}
	}

	if len(validRequests) >= r.limit {
		r.requests[key] = validRequests
		return false
	}

	r.requests[key] = append(validRequests, now)
	return true
}

// =============================================================================
// API HANDLERS
// =============================================================================

type ChatRequest struct {
	SessionID   string            `json:"session_id"`
	Message     string            `json:"message"`
	Preferences map[string]string `json:"preferences,omitempty"`
}

type ChatResponse struct {
	SessionID    string            `json:"session_id"`
	Message      string            `json:"message"`
	Products     []ProductSummary  `json:"products,omitempty"`
	Suggestions  []string          `json:"suggestions,omitempty"`
	ResponseTime int               `json:"response_time_ms"`
}

type ProductSummary struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Currency string  `json:"currency"`
	ImageURL string  `json:"image_url"`
	InStock  bool    `json:"in_stock"`
}

// Chat handles a chat message
func (s *Service) Chat(ctx context.Context, tenantID, customerID string, req ChatRequest) (*ChatResponse, error) {
	// Rate limit check
	rateKey := fmt.Sprintf("%s:%s", tenantID, customerID)
	if !s.rateLimit.Allow(rateKey) {
		return nil, fmt.Errorf("rate limit exceeded")
	}

	// Get or create session
	session, exists := s.sessions.Get(req.SessionID)
	if !exists {
		session = s.sessions.Create(req.SessionID, tenantID, customerID)
	}

	// Update preferences
	for k, v := range req.Preferences {
		s.sessions.SetPreference(req.SessionID, k, v)
	}

	// Add user message to history
	s.sessions.AddMessage(req.SessionID, rag.Message{
		Role:    "user",
		Content: req.Message,
	})

	// Call RAG pipeline
	ragReq := rag.ChatRequest{
		TenantID:    tenantID,
		CustomerID:  customerID,
		Query:       req.Message,
		History:     session.History,
		Preferences: session.Preferences,
	}

	ragResp, err := s.pipeline.Chat(ctx, ragReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate response: %w", err)
	}

	// Add assistant response to history
	s.sessions.AddMessage(req.SessionID, rag.Message{
		Role:    "assistant",
		Content: ragResp.Answer,
	})

	// Convert products to summaries
	products := make([]ProductSummary, len(ragResp.Products))
	productIDs := make([]string, len(ragResp.Products))
	for i, p := range ragResp.Products {
		products[i] = ProductSummary{
			ID:       p.ID,
			Name:     p.Name,
			Price:    p.Price,
			Currency: p.Currency,
			ImageURL: p.ImageURL,
			InStock:  p.InStock,
		}
		productIDs[i] = p.ID
	}

	// Record analytics
	if s.config.EnableAnalytics && s.analytics != nil {
		s.analytics.RecordInteraction(ctx, InteractionEvent{
			TenantID:     tenantID,
			CustomerID:   customerID,
			SessionID:    req.SessionID,
			Query:        req.Message,
			Response:     ragResp.Answer,
			Products:     productIDs,
			ResponseTime: ragResp.ResponseTime,
			TokensUsed:   ragResp.TokensUsed,
			Timestamp:    time.Now(),
		})
	}

	return &ChatResponse{
		SessionID:    req.SessionID,
		Message:      ragResp.Answer,
		Products:     products,
		Suggestions:  ragResp.Suggestions,
		ResponseTime: int(ragResp.ResponseTime.Milliseconds()),
	}, nil
}

// StreamChat handles streaming chat responses
func (s *Service) StreamChat(ctx context.Context, tenantID, customerID string, req ChatRequest, writer http.ResponseWriter) error {
	// Rate limit check
	rateKey := fmt.Sprintf("%s:%s", tenantID, customerID)
	if !s.rateLimit.Allow(rateKey) {
		return fmt.Errorf("rate limit exceeded")
	}

	// Get or create session
	session, exists := s.sessions.Get(req.SessionID)
	if !exists {
		session = s.sessions.Create(req.SessionID, tenantID, customerID)
	}

	// Add user message to history
	s.sessions.AddMessage(req.SessionID, rag.Message{
		Role:    "user",
		Content: req.Message,
	})

	// Set up SSE
	writer.Header().Set("Content-Type", "text/event-stream")
	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("Connection", "keep-alive")

	flusher, ok := writer.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming not supported")
	}

	// Call streaming RAG pipeline
	ragReq := rag.ChatRequest{
		TenantID:    tenantID,
		CustomerID:  customerID,
		Query:       req.Message,
		History:     session.History,
		Preferences: session.Preferences,
	}

	stream, err := s.pipeline.StreamChat(ctx, ragReq)
	if err != nil {
		return err
	}

	var fullResponse string

	for chunk := range stream {
		if chunk.Error != nil {
			data, _ := json.Marshal(map[string]string{"error": chunk.Error.Error()})
			fmt.Fprintf(writer, "data: %s\n\n", data)
			flusher.Flush()
			return chunk.Error
		}

		if chunk.Done {
			data, _ := json.Marshal(map[string]interface{}{
				"done":    true,
				"message": fullResponse,
			})
			fmt.Fprintf(writer, "data: %s\n\n", data)
			flusher.Flush()

			// Add to history
			s.sessions.AddMessage(req.SessionID, rag.Message{
				Role:    "assistant",
				Content: fullResponse,
			})

			break
		}

		fullResponse += chunk.Content

		data, _ := json.Marshal(map[string]string{
			"content": chunk.Content,
		})
		fmt.Fprintf(writer, "data: %s\n\n", data)
		flusher.Flush()
	}

	return nil
}

// GetSuggestions returns quick action suggestions based on context
func (s *Service) GetSuggestions(ctx context.Context, tenantID, customerID, sessionID string) ([]string, error) {
	session, exists := s.sessions.Get(sessionID)
	if !exists {
		return []string{
			"Покажи популярні товари",
			"Що нового?",
			"Допоможи знайти подарунок",
			"Порівняй товари",
		}, nil
	}

	// Generate context-aware suggestions based on history
	if len(session.History) > 0 {
		lastMessage := session.History[len(session.History)-1]
		if lastMessage.Role == "assistant" {
			return []string{
				"Розкажи більше",
				"Покажи схожі товари",
				"Порівняй ціни",
				"Додай до кошика",
			}, nil
		}
	}

	return []string{
		"Покажи популярні товари",
		"Що нового?",
		"Допоможи знайти подарунок",
	}, nil
}

// ClearSession clears a chat session
func (s *Service) ClearSession(sessionID string) {
	s.sessions.mu.Lock()
	defer s.sessions.mu.Unlock()
	delete(s.sessions.sessions, sessionID)
}
