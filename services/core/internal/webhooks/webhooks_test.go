package webhooks

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestWebhookService_Create(t *testing.T) {
	repo := newMockWebhookRepository()
	service := NewWebhookService(repo, 1)
	defer service.Stop()

	ctx := context.Background()

	webhook := &Webhook{
		ID:       "wh_test_123",
		URL:      "https://example.com/webhook",
		Secret:   "test_secret",
		Events:   []EventType{EventOrderCreated, EventOrderPaid},
		IsActive: true,
	}

	err := service.CreateWebhook(ctx, webhook)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify webhook was stored
	stored, err := repo.GetWebhook(ctx, "wh_test_123")
	if err != nil {
		t.Errorf("Expected webhook to be stored, got %v", err)
	}
	if stored.URL != webhook.URL {
		t.Errorf("Expected URL %s, got %s", webhook.URL, stored.URL)
	}
	if stored.RetryPolicy == nil {
		t.Error("Expected default retry policy to be set")
	}
}

func TestWebhookService_Trigger(t *testing.T) {
	repo := newMockWebhookRepository()

	// Track received webhooks
	var receivedCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&receivedCount, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	service := NewWebhookService(repo, 1)
	defer service.Stop()
	ctx := context.Background()

	// Create webhook
	webhook := &Webhook{
		URL:      server.URL,
		Events:   []EventType{EventOrderCreated},
		IsActive: true,
	}
	service.CreateWebhook(ctx, webhook)

	// Trigger event
	data := map[string]interface{}{
		"order_id": "order123",
		"total":    1000.00,
	}

	err := service.Trigger(ctx, EventOrderCreated, data)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Wait for async delivery
	time.Sleep(200 * time.Millisecond)

	if atomic.LoadInt32(&receivedCount) != 1 {
		t.Errorf("Expected 1 webhook delivery, got %d", receivedCount)
	}
}

func TestVerifySignature(t *testing.T) {
	secret := "test_secret_key"
	payload := []byte(`{"event":"order.created","data":{"id":"123"}}`)

	// Generate signature
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	signature := hex.EncodeToString(mac.Sum(nil))

	tests := []struct {
		name      string
		payload   []byte
		signature string
		secret    string
		valid     bool
	}{
		{
			name:      "Valid signature",
			payload:   payload,
			signature: signature,
			secret:    secret,
			valid:     true,
		},
		{
			name:      "Invalid signature",
			payload:   payload,
			signature: "invalid_signature",
			secret:    secret,
			valid:     false,
		},
		{
			name:      "Wrong secret",
			payload:   payload,
			signature: signature,
			secret:    "wrong_secret",
			valid:     false,
		},
		{
			name:      "Modified payload",
			payload:   []byte(`{"event":"order.created","data":{"id":"456"}}`),
			signature: signature,
			secret:    secret,
			valid:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := testVerifySignature(tt.payload, tt.signature, tt.secret)
			if valid != tt.valid {
				t.Errorf("Expected valid=%v, got %v", tt.valid, valid)
			}
		})
	}
}

func TestWebhookEvent_Serialization(t *testing.T) {
	event := &WebhookEvent{
		ID:        "evt_123",
		Type:      EventOrderCreated,
		CreatedAt: time.Now(),
		Data: map[string]interface{}{
			"order_id": "order_456",
			"customer": "customer_789",
			"total":    1500.50,
		},
	}

	// Serialize
	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("Failed to serialize event: %v", err)
	}

	// Deserialize
	var decoded WebhookEvent
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("Failed to deserialize event: %v", err)
	}

	if decoded.ID != event.ID {
		t.Errorf("Expected ID %s, got %s", event.ID, decoded.ID)
	}
	if decoded.Type != event.Type {
		t.Errorf("Expected type %s, got %s", event.Type, decoded.Type)
	}
}

func TestRetryPolicy(t *testing.T) {
	policy := DefaultRetryPolicy()

	tests := []struct {
		attempt     int
		shouldRetry bool
	}{
		{1, true},
		{2, true},
		{3, true},
		{4, true},
		{5, true},
		{6, false}, // Exceeds max retries (5)
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			shouldRetry := tt.attempt <= policy.MaxRetries
			if shouldRetry != tt.shouldRetry {
				t.Errorf("Attempt %d: expected retry=%v, got %v",
					tt.attempt, tt.shouldRetry, shouldRetry)
			}
		})
	}
}

func TestCalculateBackoff(t *testing.T) {
	policy := &RetryPolicy{
		InitialDelay:  time.Second,
		MaxDelay:      time.Minute,
		BackoffFactor: 2.0,
	}

	tests := []struct {
		attempt  int
		minDelay time.Duration
		maxDelay time.Duration
	}{
		{1, time.Second, 2 * time.Second},
		{2, 2 * time.Second, 4 * time.Second},
		{3, 4 * time.Second, 8 * time.Second},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			delay := testCalculateBackoff(policy, tt.attempt)
			if delay < tt.minDelay || delay > tt.maxDelay {
				t.Errorf("Attempt %d: expected delay between %v and %v, got %v",
					tt.attempt, tt.minDelay, tt.maxDelay, delay)
			}
		})
	}
}

func TestEventTypes(t *testing.T) {
	events := []EventType{
		EventOrderCreated,
		EventOrderPaid,
		EventOrderShipped,
		EventOrderDelivered,
		EventOrderCancelled,
		EventProductCreated,
		EventProductUpdated,
		EventInventoryUpdated,
		EventCustomerCreated,
		EventPaymentReceived,
		EventPaymentRefunded,
	}

	for _, event := range events {
		if event == "" {
			t.Error("Event type should not be empty")
		}
	}
}

func TestDeliveryStatus(t *testing.T) {
	statuses := []DeliveryStatus{
		StatusPending,
		StatusDelivered,
		StatusFailed,
		StatusRetrying,
	}

	for _, status := range statuses {
		if status == "" {
			t.Error("Delivery status should not be empty")
		}
	}
}

func TestWebhook_Struct(t *testing.T) {
	webhook := &Webhook{
		ID:          "wh_123",
		URL:         "https://example.com/webhook",
		Secret:      "secret_key",
		Events:      []EventType{EventOrderCreated},
		IsActive:    true,
		Description: "Test webhook",
		Headers: map[string]string{
			"X-Custom": "value",
		},
		RetryPolicy: DefaultRetryPolicy(),
	}

	if webhook.ID == "" {
		t.Error("Expected ID to be set")
	}
	if len(webhook.Events) != 1 {
		t.Error("Expected 1 event")
	}
	if webhook.Headers["X-Custom"] != "value" {
		t.Error("Expected custom header")
	}
}

func TestWebhookDelivery_Struct(t *testing.T) {
	now := time.Now()
	delivery := &WebhookDelivery{
		ID:           "del_123",
		WebhookID:    "wh_123",
		EventID:      "evt_123",
		URL:          "https://example.com/webhook",
		Status:       StatusPending,
		StatusCode:   200,
		RequestBody:  `{"event":"test"}`,
		ResponseBody: `{"ok":true}`,
		Attempts:     1,
		DeliveredAt:  &now,
		Duration:     100 * time.Millisecond,
		CreatedAt:    now,
	}

	if delivery.Status != StatusPending {
		t.Error("Expected pending status")
	}
	if delivery.Attempts != 1 {
		t.Error("Expected 1 attempt")
	}
}

// Helper functions
func testVerifySignature(payload []byte, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expected))
}

func testCalculateBackoff(policy *RetryPolicy, attempt int) time.Duration {
	delay := policy.InitialDelay
	for i := 1; i < attempt; i++ {
		delay = time.Duration(float64(delay) * policy.BackoffFactor)
		if delay > policy.MaxDelay {
			delay = policy.MaxDelay
			break
		}
	}
	return delay
}

// Mock repository
type mockWebhookRepository struct {
	webhooks   map[string]*Webhook
	deliveries []*WebhookDelivery
}

func newMockWebhookRepository() *mockWebhookRepository {
	return &mockWebhookRepository{
		webhooks:   make(map[string]*Webhook),
		deliveries: make([]*WebhookDelivery, 0),
	}
}

func (r *mockWebhookRepository) CreateWebhook(ctx context.Context, w *Webhook) error {
	r.webhooks[w.ID] = w
	return nil
}

func (r *mockWebhookRepository) UpdateWebhook(ctx context.Context, w *Webhook) error {
	r.webhooks[w.ID] = w
	return nil
}

func (r *mockWebhookRepository) DeleteWebhook(ctx context.Context, id string) error {
	delete(r.webhooks, id)
	return nil
}

func (r *mockWebhookRepository) GetWebhook(ctx context.Context, id string) (*Webhook, error) {
	if w, ok := r.webhooks[id]; ok {
		return w, nil
	}
	return nil, ErrWebhookNotFound
}

func (r *mockWebhookRepository) ListWebhooks(ctx context.Context) ([]*Webhook, error) {
	result := make([]*Webhook, 0)
	for _, w := range r.webhooks {
		result = append(result, w)
	}
	return result, nil
}

func (r *mockWebhookRepository) GetWebhooksForEvent(ctx context.Context, eventType EventType) ([]*Webhook, error) {
	result := make([]*Webhook, 0)
	for _, w := range r.webhooks {
		if !w.IsActive {
			continue
		}
		for _, e := range w.Events {
			if e == eventType {
				result = append(result, w)
				break
			}
		}
	}
	return result, nil
}

func (r *mockWebhookRepository) CreateDelivery(ctx context.Context, d *WebhookDelivery) error {
	r.deliveries = append(r.deliveries, d)
	return nil
}

func (r *mockWebhookRepository) UpdateDelivery(ctx context.Context, d *WebhookDelivery) error {
	for i, delivery := range r.deliveries {
		if delivery.ID == d.ID {
			r.deliveries[i] = d
			return nil
		}
	}
	return nil
}

func (r *mockWebhookRepository) GetDelivery(ctx context.Context, id string) (*WebhookDelivery, error) {
	for _, d := range r.deliveries {
		if d.ID == id {
			return d, nil
		}
	}
	return nil, ErrWebhookNotFound
}

func (r *mockWebhookRepository) ListDeliveries(ctx context.Context, webhookID string, limit int) ([]*WebhookDelivery, error) {
	result := make([]*WebhookDelivery, 0)
	for _, d := range r.deliveries {
		if d.WebhookID == webhookID {
			result = append(result, d)
		}
	}
	return result, nil
}

func (r *mockWebhookRepository) GetPendingDeliveries(ctx context.Context) ([]*WebhookDelivery, error) {
	result := make([]*WebhookDelivery, 0)
	for _, d := range r.deliveries {
		if d.Status == StatusPending || d.Status == StatusRetrying {
			result = append(result, d)
		}
	}
	return result, nil
}
