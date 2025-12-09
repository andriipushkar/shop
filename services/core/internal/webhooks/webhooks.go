package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// Common errors
var (
	ErrWebhookNotFound    = errors.New("webhook not found")
	ErrInvalidURL         = errors.New("invalid webhook URL")
	ErrDeliveryFailed     = errors.New("webhook delivery failed")
	ErrMaxRetriesExceeded = errors.New("max retries exceeded")
)

// EventType represents webhook event type
type EventType string

const (
	// Order events
	EventOrderCreated    EventType = "order.created"
	EventOrderUpdated    EventType = "order.updated"
	EventOrderPaid       EventType = "order.paid"
	EventOrderShipped    EventType = "order.shipped"
	EventOrderDelivered  EventType = "order.delivered"
	EventOrderCancelled  EventType = "order.cancelled"
	EventOrderRefunded   EventType = "order.refunded"

	// Product events
	EventProductCreated  EventType = "product.created"
	EventProductUpdated  EventType = "product.updated"
	EventProductDeleted  EventType = "product.deleted"
	EventProductOutOfStock EventType = "product.out_of_stock"
	EventProductLowStock EventType = "product.low_stock"

	// Customer events
	EventCustomerCreated   EventType = "customer.created"
	EventCustomerUpdated   EventType = "customer.updated"
	EventCustomerDeleted   EventType = "customer.deleted"
	EventCustomerSubscribed EventType = "customer.subscribed"
	EventCustomerUnsubscribed EventType = "customer.unsubscribed"

	// Inventory events
	EventInventoryUpdated EventType = "inventory.updated"
	EventInventoryLow     EventType = "inventory.low"

	// Payment events
	EventPaymentReceived  EventType = "payment.received"
	EventPaymentFailed    EventType = "payment.failed"
	EventPaymentRefunded  EventType = "payment.refunded"

	// Other events
	EventCartAbandoned    EventType = "cart.abandoned"
	EventReviewCreated    EventType = "review.created"
)

// DeliveryStatus represents webhook delivery status
type DeliveryStatus string

const (
	StatusPending   DeliveryStatus = "pending"
	StatusDelivered DeliveryStatus = "delivered"
	StatusFailed    DeliveryStatus = "failed"
	StatusRetrying  DeliveryStatus = "retrying"
)

// Webhook represents webhook configuration
type Webhook struct {
	ID          string      `json:"id"`
	URL         string      `json:"url"`
	Secret      string      `json:"secret,omitempty"`
	Events      []EventType `json:"events"`
	IsActive    bool        `json:"is_active"`
	Description string      `json:"description,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	RetryPolicy *RetryPolicy `json:"retry_policy,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// RetryPolicy defines retry behavior
type RetryPolicy struct {
	MaxRetries     int           `json:"max_retries"`
	InitialDelay   time.Duration `json:"initial_delay"`
	MaxDelay       time.Duration `json:"max_delay"`
	BackoffFactor  float64       `json:"backoff_factor"`
}

// DefaultRetryPolicy returns default retry policy
func DefaultRetryPolicy() *RetryPolicy {
	return &RetryPolicy{
		MaxRetries:    5,
		InitialDelay:  1 * time.Second,
		MaxDelay:      1 * time.Hour,
		BackoffFactor: 2.0,
	}
}

// WebhookEvent represents webhook event payload
type WebhookEvent struct {
	ID        string                 `json:"id"`
	Type      EventType              `json:"type"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt time.Time              `json:"created_at"`
	Metadata  map[string]string      `json:"metadata,omitempty"`
}

// WebhookDelivery represents delivery attempt
type WebhookDelivery struct {
	ID            string         `json:"id"`
	WebhookID     string         `json:"webhook_id"`
	EventID       string         `json:"event_id"`
	URL           string         `json:"url"`
	Status        DeliveryStatus `json:"status"`
	StatusCode    int            `json:"status_code,omitempty"`
	RequestBody   string         `json:"request_body,omitempty"`
	ResponseBody  string         `json:"response_body,omitempty"`
	Error         string         `json:"error,omitempty"`
	Attempts      int            `json:"attempts"`
	NextRetryAt   *time.Time     `json:"next_retry_at,omitempty"`
	DeliveredAt   *time.Time     `json:"delivered_at,omitempty"`
	Duration      time.Duration  `json:"duration,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
}

// WebhookRepository defines data access interface
type WebhookRepository interface {
	// Webhooks
	CreateWebhook(ctx context.Context, webhook *Webhook) error
	UpdateWebhook(ctx context.Context, webhook *Webhook) error
	DeleteWebhook(ctx context.Context, id string) error
	GetWebhook(ctx context.Context, id string) (*Webhook, error)
	ListWebhooks(ctx context.Context) ([]*Webhook, error)
	GetWebhooksForEvent(ctx context.Context, eventType EventType) ([]*Webhook, error)

	// Deliveries
	CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error
	UpdateDelivery(ctx context.Context, delivery *WebhookDelivery) error
	GetDelivery(ctx context.Context, id string) (*WebhookDelivery, error)
	ListDeliveries(ctx context.Context, webhookID string, limit int) ([]*WebhookDelivery, error)
	GetPendingDeliveries(ctx context.Context) ([]*WebhookDelivery, error)
}

// WebhookService manages webhooks
type WebhookService struct {
	repo       WebhookRepository
	httpClient *http.Client
	queue      chan *WebhookDelivery
	workers    int
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

// NewWebhookService creates webhook service
func NewWebhookService(repo WebhookRepository, workers int) *WebhookService {
	ctx, cancel := context.WithCancel(context.Background())

	svc := &WebhookService{
		repo: repo,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		queue:   make(chan *WebhookDelivery, 1000),
		workers: workers,
		ctx:     ctx,
		cancel:  cancel,
	}

	// Start workers
	for i := 0; i < workers; i++ {
		svc.wg.Add(1)
		go svc.worker()
	}

	return svc
}

// Stop stops the webhook service
func (s *WebhookService) Stop() {
	s.cancel()
	close(s.queue)
	s.wg.Wait()
}

// CreateWebhook creates new webhook
func (s *WebhookService) CreateWebhook(ctx context.Context, webhook *Webhook) error {
	webhook.CreatedAt = time.Now()
	webhook.UpdatedAt = time.Now()

	if webhook.RetryPolicy == nil {
		webhook.RetryPolicy = DefaultRetryPolicy()
	}

	return s.repo.CreateWebhook(ctx, webhook)
}

// UpdateWebhook updates webhook
func (s *WebhookService) UpdateWebhook(ctx context.Context, webhook *Webhook) error {
	webhook.UpdatedAt = time.Now()
	return s.repo.UpdateWebhook(ctx, webhook)
}

// DeleteWebhook deletes webhook
func (s *WebhookService) DeleteWebhook(ctx context.Context, id string) error {
	return s.repo.DeleteWebhook(ctx, id)
}

// GetWebhook returns webhook by ID
func (s *WebhookService) GetWebhook(ctx context.Context, id string) (*Webhook, error) {
	return s.repo.GetWebhook(ctx, id)
}

// ListWebhooks returns all webhooks
func (s *WebhookService) ListWebhooks(ctx context.Context) ([]*Webhook, error) {
	return s.repo.ListWebhooks(ctx)
}

// Trigger triggers webhook event
func (s *WebhookService) Trigger(ctx context.Context, eventType EventType, data map[string]interface{}) error {
	event := &WebhookEvent{
		ID:        generateID(),
		Type:      eventType,
		Data:      data,
		CreatedAt: time.Now(),
	}

	webhooks, err := s.repo.GetWebhooksForEvent(ctx, eventType)
	if err != nil {
		return err
	}

	for _, webhook := range webhooks {
		if !webhook.IsActive {
			continue
		}

		delivery := &WebhookDelivery{
			ID:        generateID(),
			WebhookID: webhook.ID,
			EventID:   event.ID,
			URL:       webhook.URL,
			Status:    StatusPending,
			CreatedAt: time.Now(),
		}

		// Serialize request body
		payload, _ := json.Marshal(event)
		delivery.RequestBody = string(payload)

		if err := s.repo.CreateDelivery(ctx, delivery); err != nil {
			continue
		}

		// Queue for delivery
		select {
		case s.queue <- delivery:
		default:
			// Queue full, mark as pending for retry
			delivery.Status = StatusRetrying
			nextRetry := time.Now().Add(time.Minute)
			delivery.NextRetryAt = &nextRetry
			s.repo.UpdateDelivery(ctx, delivery)
		}
	}

	return nil
}

// TriggerAsync triggers webhook event asynchronously
func (s *WebhookService) TriggerAsync(eventType EventType, data map[string]interface{}) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		s.Trigger(ctx, eventType, data)
	}()
}

// GetDeliveries returns webhook deliveries
func (s *WebhookService) GetDeliveries(ctx context.Context, webhookID string, limit int) ([]*WebhookDelivery, error) {
	return s.repo.ListDeliveries(ctx, webhookID, limit)
}

// RetryDelivery retries failed delivery
func (s *WebhookService) RetryDelivery(ctx context.Context, deliveryID string) error {
	delivery, err := s.repo.GetDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	delivery.Status = StatusPending
	delivery.Attempts = 0
	delivery.NextRetryAt = nil

	if err := s.repo.UpdateDelivery(ctx, delivery); err != nil {
		return err
	}

	select {
	case s.queue <- delivery:
		return nil
	default:
		return errors.New("queue full")
	}
}

// worker processes webhook deliveries
func (s *WebhookService) worker() {
	defer s.wg.Done()

	for {
		select {
		case <-s.ctx.Done():
			return
		case delivery, ok := <-s.queue:
			if !ok {
				return
			}
			s.deliver(delivery)
		}
	}
}

func (s *WebhookService) deliver(delivery *WebhookDelivery) {
	ctx := context.Background()

	webhook, err := s.repo.GetWebhook(ctx, delivery.WebhookID)
	if err != nil {
		delivery.Status = StatusFailed
		delivery.Error = "webhook not found"
		s.repo.UpdateDelivery(ctx, delivery)
		return
	}

	// Create request
	req, err := http.NewRequest("POST", delivery.URL, bytes.NewBufferString(delivery.RequestBody))
	if err != nil {
		delivery.Status = StatusFailed
		delivery.Error = err.Error()
		s.repo.UpdateDelivery(ctx, delivery)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Webhook-Service/1.0")
	req.Header.Set("X-Webhook-ID", webhook.ID)
	req.Header.Set("X-Delivery-ID", delivery.ID)

	// Add signature
	if webhook.Secret != "" {
		signature := s.signPayload([]byte(delivery.RequestBody), webhook.Secret)
		req.Header.Set("X-Webhook-Signature", signature)
		req.Header.Set("X-Webhook-Signature-256", "sha256="+signature)
	}

	// Add custom headers
	for k, v := range webhook.Headers {
		req.Header.Set(k, v)
	}

	// Send request
	start := time.Now()
	resp, err := s.httpClient.Do(req)
	delivery.Duration = time.Since(start)
	delivery.Attempts++

	if err != nil {
		s.handleFailure(ctx, webhook, delivery, err.Error())
		return
	}
	defer resp.Body.Close()

	// Read response
	body, _ := io.ReadAll(resp.Body)
	delivery.StatusCode = resp.StatusCode
	delivery.ResponseBody = string(body)

	// Check status code
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		now := time.Now()
		delivery.Status = StatusDelivered
		delivery.DeliveredAt = &now
		s.repo.UpdateDelivery(ctx, delivery)
	} else {
		s.handleFailure(ctx, webhook, delivery, fmt.Sprintf("HTTP %d", resp.StatusCode))
	}
}

func (s *WebhookService) handleFailure(ctx context.Context, webhook *Webhook, delivery *WebhookDelivery, errorMsg string) {
	delivery.Error = errorMsg

	policy := webhook.RetryPolicy
	if policy == nil {
		policy = DefaultRetryPolicy()
	}

	if delivery.Attempts >= policy.MaxRetries {
		delivery.Status = StatusFailed
	} else {
		delivery.Status = StatusRetrying

		// Calculate next retry time with exponential backoff
		delay := policy.InitialDelay
		for i := 1; i < delivery.Attempts; i++ {
			delay = time.Duration(float64(delay) * policy.BackoffFactor)
			if delay > policy.MaxDelay {
				delay = policy.MaxDelay
				break
			}
		}

		nextRetry := time.Now().Add(delay)
		delivery.NextRetryAt = &nextRetry

		// Schedule retry
		go func() {
			time.Sleep(delay)
			select {
			case s.queue <- delivery:
			default:
			}
		}()
	}

	s.repo.UpdateDelivery(ctx, delivery)
}

func (s *WebhookService) signPayload(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

// VerifySignature verifies webhook signature
func VerifySignature(payload []byte, signature, secret string) bool {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	expected := hex.EncodeToString(h.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// Event helper functions

// TriggerOrderCreated triggers order.created event
func (s *WebhookService) TriggerOrderCreated(orderID, orderNumber string, total float64, customerEmail string) {
	s.TriggerAsync(EventOrderCreated, map[string]interface{}{
		"order_id":       orderID,
		"order_number":   orderNumber,
		"total":          total,
		"customer_email": customerEmail,
	})
}

// TriggerOrderPaid triggers order.paid event
func (s *WebhookService) TriggerOrderPaid(orderID, orderNumber string, amount float64, paymentMethod string) {
	s.TriggerAsync(EventOrderPaid, map[string]interface{}{
		"order_id":       orderID,
		"order_number":   orderNumber,
		"amount":         amount,
		"payment_method": paymentMethod,
	})
}

// TriggerOrderShipped triggers order.shipped event
func (s *WebhookService) TriggerOrderShipped(orderID, orderNumber, trackingNumber, carrier string) {
	s.TriggerAsync(EventOrderShipped, map[string]interface{}{
		"order_id":        orderID,
		"order_number":    orderNumber,
		"tracking_number": trackingNumber,
		"carrier":         carrier,
	})
}

// TriggerProductOutOfStock triggers product.out_of_stock event
func (s *WebhookService) TriggerProductOutOfStock(productID, sku, name string) {
	s.TriggerAsync(EventProductOutOfStock, map[string]interface{}{
		"product_id": productID,
		"sku":        sku,
		"name":       name,
	})
}

// TriggerCustomerCreated triggers customer.created event
func (s *WebhookService) TriggerCustomerCreated(customerID, email, name string) {
	s.TriggerAsync(EventCustomerCreated, map[string]interface{}{
		"customer_id": customerID,
		"email":       email,
		"name":        name,
	})
}
