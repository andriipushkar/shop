package email

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

// ============================================================================
// Mock Provider
// ============================================================================

type mockProvider struct {
	name          string
	sendEmailFunc func(ctx context.Context, email *Email) (*SendResult, error)
	subscribers   map[string]map[string]*Subscriber
	lists         []List
	campaigns     map[string]*Campaign
}

func newMockProvider(name string) *mockProvider {
	return &mockProvider{
		name:        name,
		subscribers: make(map[string]map[string]*Subscriber),
		lists:       []List{},
		campaigns:   make(map[string]*Campaign),
	}
}

func (p *mockProvider) Name() string {
	return p.name
}

func (p *mockProvider) SendEmail(ctx context.Context, email *Email) (*SendResult, error) {
	if p.sendEmailFunc != nil {
		return p.sendEmailFunc(ctx, email)
	}
	return &SendResult{
		MessageID: "msg-123",
		Status:    EmailStatusSent,
	}, nil
}

func (p *mockProvider) AddSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	if p.subscribers[listID] == nil {
		p.subscribers[listID] = make(map[string]*Subscriber)
	}
	if _, exists := p.subscribers[listID][sub.Email]; exists {
		return ErrSubscriberExists
	}
	p.subscribers[listID][sub.Email] = sub
	return nil
}

func (p *mockProvider) RemoveSubscriber(ctx context.Context, listID, email string) error {
	if p.subscribers[listID] == nil {
		return ErrSubscriberNotFound
	}
	if _, exists := p.subscribers[listID][email]; !exists {
		return ErrSubscriberNotFound
	}
	delete(p.subscribers[listID], email)
	return nil
}

func (p *mockProvider) UpdateSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	if p.subscribers[listID] == nil || p.subscribers[listID][sub.Email] == nil {
		return ErrSubscriberNotFound
	}
	p.subscribers[listID][sub.Email] = sub
	return nil
}

func (p *mockProvider) GetSubscriber(ctx context.Context, listID, email string) (*Subscriber, error) {
	if p.subscribers[listID] == nil || p.subscribers[listID][email] == nil {
		return nil, ErrSubscriberNotFound
	}
	return p.subscribers[listID][email], nil
}

func (p *mockProvider) GetLists(ctx context.Context) ([]List, error) {
	return p.lists, nil
}

func (p *mockProvider) CreateCampaign(ctx context.Context, campaign *Campaign) (*Campaign, error) {
	campaign.ID = "campaign-123"
	campaign.Status = "draft"
	p.campaigns[campaign.ID] = campaign
	return campaign, nil
}

func (p *mockProvider) SendCampaign(ctx context.Context, campaignID string) error {
	if campaign, exists := p.campaigns[campaignID]; exists {
		campaign.Status = "sent"
		return nil
	}
	return errors.New("campaign not found")
}

func (p *mockProvider) GetCampaignStats(ctx context.Context, campaignID string) (*CampaignStats, error) {
	if _, exists := p.campaigns[campaignID]; !exists {
		return nil, errors.New("campaign not found")
	}
	return &CampaignStats{
		Sent:      1000,
		Delivered: 980,
		Opened:    450,
		Clicked:   120,
		Bounced:   20,
		OpenRate:  45.9,
		ClickRate: 12.2,
	}, nil
}

// ============================================================================
// EmailService Tests
// ============================================================================

func TestNewEmailService(t *testing.T) {
	service := NewEmailService()
	if service == nil {
		t.Fatal("expected service to be created")
	}
	if service.providers == nil {
		t.Error("expected providers map to be initialized")
	}
}

func TestRegisterProvider(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("sendpulse")

	service.RegisterProvider(provider)

	got, err := service.GetProvider("sendpulse")
	if err != nil {
		t.Fatalf("failed to get provider: %v", err)
	}
	if got.Name() != "sendpulse" {
		t.Errorf("expected provider name 'sendpulse', got '%s'", got.Name())
	}
}

func TestSetDefaultProvider(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("mailchimp")

	service.RegisterProvider(provider)
	service.SetDefaultProvider("mailchimp")

	got, err := service.GetProvider("")
	if err != nil {
		t.Fatalf("failed to get default provider: %v", err)
	}
	if got.Name() != "mailchimp" {
		t.Errorf("expected default provider 'mailchimp', got '%s'", got.Name())
	}
}

func TestSetDefaultFrom(t *testing.T) {
	service := NewEmailService()
	service.SetDefaultFrom("shop@example.com", "My Shop")

	if service.defaultFrom != "shop@example.com" {
		t.Errorf("expected defaultFrom 'shop@example.com', got '%s'", service.defaultFrom)
	}
	if service.defaultFromName != "My Shop" {
		t.Errorf("expected defaultFromName 'My Shop', got '%s'", service.defaultFromName)
	}
}

func TestGetProvider(t *testing.T) {
	service := NewEmailService()
	provider1 := newMockProvider("provider1")
	provider2 := newMockProvider("provider2")

	service.RegisterProvider(provider1)
	service.RegisterProvider(provider2)
	service.SetDefaultProvider("provider1")

	t.Run("by name", func(t *testing.T) {
		got, err := service.GetProvider("provider2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Name() != "provider2" {
			t.Errorf("expected 'provider2', got '%s'", got.Name())
		}
	})

	t.Run("default when empty", func(t *testing.T) {
		got, err := service.GetProvider("")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Name() != "provider1" {
			t.Errorf("expected default 'provider1', got '%s'", got.Name())
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, err := service.GetProvider("nonexistent")
		if err == nil {
			t.Error("expected error for nonexistent provider")
		}
	})
}

func TestSendEmail(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("test")
	provider.sendEmailFunc = func(ctx context.Context, email *Email) (*SendResult, error) {
		if email.From == "" {
			return nil, errors.New("from is required")
		}
		return &SendResult{
			MessageID: "msg-456",
			Status:    EmailStatusSent,
		}, nil
	}

	service.RegisterProvider(provider)
	service.SetDefaultProvider("test")
	service.SetDefaultFrom("noreply@shop.com", "Shop")

	t.Run("successful send", func(t *testing.T) {
		ctx := context.Background()
		email := &Email{
			To:      []string{"user@example.com"},
			Subject: "Test",
			HTML:    "<p>Test</p>",
		}

		result, err := service.SendEmail(ctx, "", email)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.MessageID != "msg-456" {
			t.Errorf("expected messageID 'msg-456', got '%s'", result.MessageID)
		}
		if email.From != "noreply@shop.com" {
			t.Errorf("expected default from to be set")
		}
	})

	t.Run("with custom from", func(t *testing.T) {
		ctx := context.Background()
		email := &Email{
			To:      []string{"user@example.com"},
			From:    "custom@shop.com",
			Subject: "Test",
		}

		_, err := service.SendEmail(ctx, "", email)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if email.From != "custom@shop.com" {
			t.Errorf("expected custom from to be preserved")
		}
	})

	t.Run("provider not found", func(t *testing.T) {
		ctx := context.Background()
		email := &Email{To: []string{"user@example.com"}}

		_, err := service.SendEmail(ctx, "nonexistent", email)
		if err == nil {
			t.Error("expected error for nonexistent provider")
		}
	})
}

func TestSendOrderConfirmation(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("test")

	var sentEmail *Email
	provider.sendEmailFunc = func(ctx context.Context, email *Email) (*SendResult, error) {
		sentEmail = email
		return &SendResult{Status: EmailStatusSent}, nil
	}

	service.RegisterProvider(provider)
	service.SetDefaultProvider("test")
	service.SetDefaultFrom("orders@shop.com", "Shop")

	ctx := context.Background()
	items := []map[string]interface{}{
		{"name": "Product 1", "price": 100.0, "qty": 2},
		{"name": "Product 2", "price": 50.0, "qty": 1},
	}

	err := service.SendOrderConfirmation(ctx, "customer@example.com", "ORD-12345", items, 250.0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sentEmail == nil {
		t.Fatal("email was not sent")
	}
	if sentEmail.To[0] != "customer@example.com" {
		t.Errorf("expected to 'customer@example.com', got '%s'", sentEmail.To[0])
	}
	if sentEmail.TemplateID != "order_confirmation" {
		t.Errorf("expected template 'order_confirmation', got '%s'", sentEmail.TemplateID)
	}
	if sentEmail.Variables["order_id"] != "ORD-12345" {
		t.Errorf("expected order_id 'ORD-12345'")
	}
}

func TestSendShippingNotification(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("test")

	var sentEmail *Email
	provider.sendEmailFunc = func(ctx context.Context, email *Email) (*SendResult, error) {
		sentEmail = email
		return &SendResult{Status: EmailStatusSent}, nil
	}

	service.RegisterProvider(provider)
	service.SetDefaultProvider("test")
	service.SetDefaultFrom("shipping@shop.com", "Shop")

	ctx := context.Background()
	err := service.SendShippingNotification(ctx, "customer@example.com", "ORD-12345", "20450000001234", "Nova Poshta")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sentEmail.TemplateID != "shipping_notification" {
		t.Errorf("expected template 'shipping_notification', got '%s'", sentEmail.TemplateID)
	}
	if sentEmail.Variables["tracking_number"] != "20450000001234" {
		t.Errorf("expected tracking_number '20450000001234'")
	}
	if sentEmail.Variables["carrier"] != "Nova Poshta" {
		t.Errorf("expected carrier 'Nova Poshta'")
	}
}

func TestSendPasswordReset(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("test")

	var sentEmail *Email
	provider.sendEmailFunc = func(ctx context.Context, email *Email) (*SendResult, error) {
		sentEmail = email
		return &SendResult{Status: EmailStatusSent}, nil
	}

	service.RegisterProvider(provider)
	service.SetDefaultProvider("test")
	service.SetDefaultFrom("noreply@shop.com", "Shop")

	ctx := context.Background()
	err := service.SendPasswordReset(ctx, "user@example.com", "https://shop.com/reset?token=abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sentEmail.TemplateID != "password_reset" {
		t.Errorf("expected template 'password_reset', got '%s'", sentEmail.TemplateID)
	}
	if sentEmail.Variables["reset_link"] != "https://shop.com/reset?token=abc123" {
		t.Errorf("expected reset_link to be set")
	}
}

func TestSendWelcome(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("test")

	var sentEmail *Email
	provider.sendEmailFunc = func(ctx context.Context, email *Email) (*SendResult, error) {
		sentEmail = email
		return &SendResult{Status: EmailStatusSent}, nil
	}

	service.RegisterProvider(provider)
	service.SetDefaultProvider("test")
	service.SetDefaultFrom("welcome@shop.com", "Shop")

	ctx := context.Background()
	err := service.SendWelcome(ctx, "newuser@example.com", "Іван")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sentEmail.TemplateID != "welcome" {
		t.Errorf("expected template 'welcome', got '%s'", sentEmail.TemplateID)
	}
	if sentEmail.Variables["name"] != "Іван" {
		t.Errorf("expected name 'Іван'")
	}
}

// ============================================================================
// Data Structures Tests
// ============================================================================

func TestEmailStruct(t *testing.T) {
	now := time.Now()
	email := Email{
		To:       []string{"user1@example.com", "user2@example.com"},
		CC:       []string{"cc@example.com"},
		BCC:      []string{"bcc@example.com"},
		From:     "sender@example.com",
		FromName: "Sender Name",
		ReplyTo:  "reply@example.com",
		Subject:  "Test Subject",
		HTML:     "<p>HTML content</p>",
		Text:     "Text content",
		TemplateID: "template-123",
		Variables: map[string]interface{}{
			"name": "User",
			"date": now,
		},
		Attachments: []Attachment{
			{
				Filename:    "doc.pdf",
				Content:     []byte("content"),
				ContentType: "application/pdf",
			},
		},
		Tags:     []string{"order", "confirmation"},
		Metadata: map[string]string{"order_id": "123"},
	}

	if len(email.To) != 2 {
		t.Errorf("expected 2 recipients, got %d", len(email.To))
	}
	if len(email.Attachments) != 1 {
		t.Errorf("expected 1 attachment, got %d", len(email.Attachments))
	}
}

func TestAttachmentStruct(t *testing.T) {
	attachment := Attachment{
		Filename:    "image.png",
		Content:     []byte{0x89, 0x50, 0x4E, 0x47},
		ContentType: "image/png",
		ContentID:   "inline-image-1",
	}

	if attachment.Filename != "image.png" {
		t.Errorf("expected filename 'image.png', got '%s'", attachment.Filename)
	}
	if attachment.ContentID != "inline-image-1" {
		t.Error("expected ContentID for inline image")
	}
}

func TestSendResultStruct(t *testing.T) {
	result := SendResult{
		MessageID: "msg-789",
		Status:    EmailStatusDelivered,
		Error:     "",
	}

	if result.Status != EmailStatusDelivered {
		t.Errorf("expected status 'delivered', got '%s'", result.Status)
	}
}

func TestSubscriberStruct(t *testing.T) {
	now := time.Now()
	subscriber := Subscriber{
		Email:     "subscriber@example.com",
		FirstName: "Іван",
		LastName:  "Петренко",
		Phone:     "+380501234567",
		Tags:      []string{"vip", "newsletter"},
		Variables: map[string]interface{}{
			"segment": "premium",
			"score":   100,
		},
		Status:       "active",
		SubscribedAt: &now,
	}

	if subscriber.Email != "subscriber@example.com" {
		t.Errorf("expected email 'subscriber@example.com', got '%s'", subscriber.Email)
	}
	if len(subscriber.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(subscriber.Tags))
	}
}

func TestListStruct(t *testing.T) {
	list := List{
		ID:          "list-123",
		Name:        "Newsletter",
		Description: "Weekly newsletter subscribers",
		Subscribers: 5000,
	}

	if list.ID != "list-123" {
		t.Errorf("expected ID 'list-123', got '%s'", list.ID)
	}
}

func TestCampaignStruct(t *testing.T) {
	scheduledAt := time.Now().Add(24 * time.Hour)
	campaign := Campaign{
		ID:          "campaign-123",
		Name:        "Black Friday Sale",
		Subject:     "Знижки до 70%!",
		From:        "promo@shop.com",
		FromName:    "Shop Promotions",
		TemplateID:  "black-friday",
		Lists:       []string{"list-1", "list-2"},
		Segments:    []string{"active-buyers"},
		ScheduledAt: &scheduledAt,
		Status:      "scheduled",
	}

	if campaign.Name != "Black Friday Sale" {
		t.Errorf("expected name 'Black Friday Sale', got '%s'", campaign.Name)
	}
}

func TestCampaignStatsStruct(t *testing.T) {
	stats := CampaignStats{
		Sent:         10000,
		Delivered:    9800,
		Opened:       4500,
		Clicked:      1200,
		Bounced:      200,
		Spam:         50,
		Unsubscribed: 30,
		OpenRate:     45.9,
		ClickRate:    12.2,
	}

	if stats.OpenRate != 45.9 {
		t.Errorf("expected OpenRate 45.9, got %f", stats.OpenRate)
	}
}

func TestTemplateStruct(t *testing.T) {
	template := Template{
		ID:        "tpl-123",
		Name:      "Order Confirmation",
		Subject:   "Ваше замовлення #{{order_id}}",
		HTML:      "<h1>Дякуємо за замовлення!</h1>",
		Text:      "Дякуємо за замовлення!",
		Variables: []string{"order_id", "items", "total"},
	}

	if len(template.Variables) != 3 {
		t.Errorf("expected 3 variables, got %d", len(template.Variables))
	}
}

// ============================================================================
// EmailStatus Tests
// ============================================================================

func TestEmailStatus(t *testing.T) {
	statuses := []EmailStatus{
		EmailStatusQueued,
		EmailStatusSent,
		EmailStatusDelivered,
		EmailStatusOpened,
		EmailStatusClicked,
		EmailStatusBounced,
		EmailStatusSpam,
		EmailStatusFailed,
	}

	expected := []string{
		"queued", "sent", "delivered", "opened",
		"clicked", "bounced", "spam", "failed",
	}

	for i, status := range statuses {
		if string(status) != expected[i] {
			t.Errorf("expected status '%s', got '%s'", expected[i], status)
		}
	}
}

// ============================================================================
// Error Tests
// ============================================================================

func TestErrors(t *testing.T) {
	errors := []error{
		ErrInvalidEmail,
		ErrTemplateNotFound,
		ErrSendFailed,
		ErrSubscriberExists,
		ErrSubscriberNotFound,
	}

	for _, err := range errors {
		if err == nil {
			t.Error("expected error to be defined")
		}
		if err.Error() == "" {
			t.Error("expected error message to be non-empty")
		}
	}
}

// ============================================================================
// Provider Integration Tests
// ============================================================================

func TestMockProviderAddSubscriber(t *testing.T) {
	provider := newMockProvider("test")
	ctx := context.Background()

	sub := &Subscriber{
		Email:     "test@example.com",
		FirstName: "Test",
	}

	t.Run("add new subscriber", func(t *testing.T) {
		err := provider.AddSubscriber(ctx, "list-1", sub)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("add duplicate subscriber", func(t *testing.T) {
		err := provider.AddSubscriber(ctx, "list-1", sub)
		if err != ErrSubscriberExists {
			t.Errorf("expected ErrSubscriberExists, got %v", err)
		}
	})
}

func TestMockProviderRemoveSubscriber(t *testing.T) {
	provider := newMockProvider("test")
	ctx := context.Background()

	sub := &Subscriber{Email: "test@example.com"}
	provider.AddSubscriber(ctx, "list-1", sub)

	t.Run("remove existing subscriber", func(t *testing.T) {
		err := provider.RemoveSubscriber(ctx, "list-1", "test@example.com")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("remove non-existent subscriber", func(t *testing.T) {
		err := provider.RemoveSubscriber(ctx, "list-1", "nonexistent@example.com")
		if err != ErrSubscriberNotFound {
			t.Errorf("expected ErrSubscriberNotFound, got %v", err)
		}
	})
}

func TestMockProviderCampaign(t *testing.T) {
	provider := newMockProvider("test")
	ctx := context.Background()

	campaign := &Campaign{
		Name:    "Test Campaign",
		Subject: "Test Subject",
	}

	created, err := provider.CreateCampaign(ctx, campaign)
	if err != nil {
		t.Fatalf("failed to create campaign: %v", err)
	}
	if created.ID == "" {
		t.Error("expected campaign ID to be set")
	}
	if created.Status != "draft" {
		t.Errorf("expected status 'draft', got '%s'", created.Status)
	}

	err = provider.SendCampaign(ctx, created.ID)
	if err != nil {
		t.Fatalf("failed to send campaign: %v", err)
	}

	stats, err := provider.GetCampaignStats(ctx, created.ID)
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	if stats.Sent != 1000 {
		t.Errorf("expected sent 1000, got %d", stats.Sent)
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkSendEmail(b *testing.B) {
	service := NewEmailService()
	provider := newMockProvider("test")
	service.RegisterProvider(provider)
	service.SetDefaultProvider("test")

	ctx := context.Background()
	email := &Email{
		To:      []string{"user@example.com"},
		Subject: "Benchmark",
		HTML:    "<p>Test</p>",
		From:    "test@example.com",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = service.SendEmail(ctx, "", email)
	}
}

func BenchmarkAddSubscriber(b *testing.B) {
	provider := newMockProvider("test")
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sub := &Subscriber{
			Email: "user" + string(rune(i)) + "@example.com",
		}
		_ = provider.AddSubscriber(ctx, "list-1", sub)
	}
}

// ============================================================================
// SendPulse Client Tests
// ============================================================================

func TestNewSendPulseClient(t *testing.T) {
	client := NewSendPulseClient("client-id", "client-secret")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.clientID != "client-id" {
		t.Errorf("expected clientID 'client-id', got '%s'", client.clientID)
	}
	if client.clientSecret != "client-secret" {
		t.Errorf("expected clientSecret 'client-secret', got '%s'", client.clientSecret)
	}
}

func TestSendPulseClientName(t *testing.T) {
	client := NewSendPulseClient("id", "secret")
	if client.Name() != "sendpulse" {
		t.Errorf("expected name 'sendpulse', got '%s'", client.Name())
	}
}

func TestSendPulseFormatRecipients(t *testing.T) {
	client := NewSendPulseClient("id", "secret")
	recipients := []string{"user1@example.com", "user2@example.com"}

	formatted := client.formatRecipients(recipients)
	if len(formatted) != 2 {
		t.Errorf("expected 2 formatted recipients, got %d", len(formatted))
	}
}

// ============================================================================
// eSputnik Client Tests
// ============================================================================

func TestNewESputnikClient(t *testing.T) {
	client := NewESputnikClient("api-key-123")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.apiKey != "api-key-123" {
		t.Errorf("expected apiKey 'api-key-123', got '%s'", client.apiKey)
	}
}

func TestESputnikClientName(t *testing.T) {
	client := NewESputnikClient("api-key")
	if client.Name() != "esputnik" {
		t.Errorf("expected name 'esputnik', got '%s'", client.Name())
	}
}

func TestESputnikConvertVariables(t *testing.T) {
	client := NewESputnikClient("api-key")
	vars := map[string]interface{}{
		"name":  "Іван",
		"total": 250.50,
		"count": 3,
	}

	converted := client.convertVariables(vars)
	if len(converted) != 3 {
		t.Errorf("expected 3 converted variables, got %d", len(converted))
	}

	// Check structure
	for _, param := range converted {
		if _, ok := param["name"]; !ok {
			t.Error("expected 'name' key in converted variable")
		}
		if _, ok := param["value"]; !ok {
			t.Error("expected 'value' key in converted variable")
		}
	}
}

// ============================================================================
// Mailchimp Client Tests
// ============================================================================

func TestNewMailchimpClient(t *testing.T) {
	client := NewMailchimpClient("api-key-us1")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.apiKey != "api-key-us1" {
		t.Errorf("expected apiKey 'api-key-us1', got '%s'", client.apiKey)
	}
	if client.server != "us1" {
		t.Errorf("expected server 'us1', got '%s'", client.server)
	}
}

func TestNewMailchimpClientServerExtraction(t *testing.T) {
	tests := []struct {
		apiKey         string
		expectedServer string
	}{
		{"key-us1", "us1"},
		{"key-us2", "us2"},
		{"key-eu1", "eu1"},
		{"keyonly", "us1"}, // Default
		{"complex-key-with-many-dashes-us5", "us5"},
	}

	for _, tt := range tests {
		t.Run(tt.apiKey, func(t *testing.T) {
			client := NewMailchimpClient(tt.apiKey)
			if client.server != tt.expectedServer {
				t.Errorf("expected server '%s', got '%s'", tt.expectedServer, client.server)
			}
		})
	}
}

func TestMailchimpClientName(t *testing.T) {
	client := NewMailchimpClient("api-key-us1")
	if client.Name() != "mailchimp" {
		t.Errorf("expected name 'mailchimp', got '%s'", client.Name())
	}
}

func TestMailchimpAPIURL(t *testing.T) {
	client := NewMailchimpClient("api-key-us1")
	url := client.apiURL()
	if url != "https://us1.api.mailchimp.com/3.0" {
		t.Errorf("expected 'https://us1.api.mailchimp.com/3.0', got '%s'", url)
	}
}

func TestMailchimpAPIURLDifferentServer(t *testing.T) {
	client := NewMailchimpClient("api-key-eu2")
	url := client.apiURL()
	if url != "https://eu2.api.mailchimp.com/3.0" {
		t.Errorf("expected 'https://eu2.api.mailchimp.com/3.0', got '%s'", url)
	}
}

// ============================================================================
// Integration Test Helpers
// ============================================================================

func TestEmailProviderInterface(t *testing.T) {
	// Ensure all providers implement EmailProvider interface
	var _ EmailProvider = (*SendPulseClient)(nil)
	var _ EmailProvider = (*ESputnikClient)(nil)
	var _ EmailProvider = (*MailchimpClient)(nil)
}

// ============================================================================
// Email Validation Tests
// ============================================================================

func TestEmailValidation(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		valid   bool
	}{
		{"valid email", "user@example.com", true},
		{"valid with subdomain", "user@mail.example.com", true},
		{"valid with plus", "user+tag@example.com", true},
		{"empty", "", false},
		{"missing @", "userexample.com", false},
		{"missing domain", "user@", false},
		{"missing local", "@example.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Basic validation
			hasAt := len(tt.email) > 0 && strings.Contains(tt.email, "@")
			parts := strings.Split(tt.email, "@")
			hasLocal := len(parts) > 0 && len(parts[0]) > 0
			hasDomain := len(parts) > 1 && len(parts[1]) > 0

			isValid := hasAt && hasLocal && hasDomain
			if isValid != tt.valid {
				t.Errorf("email '%s' validity expected %v, got %v", tt.email, tt.valid, isValid)
			}
		})
	}
}

// ============================================================================
// Edge Cases Tests
// ============================================================================

func TestEmailWithLargeAttachment(t *testing.T) {
	largeContent := make([]byte, 1024*1024) // 1MB
	attachment := Attachment{
		Filename:    "large_file.pdf",
		Content:     largeContent,
		ContentType: "application/pdf",
	}

	if len(attachment.Content) != 1024*1024 {
		t.Errorf("expected 1MB content, got %d bytes", len(attachment.Content))
	}
}

func TestEmailWithMultipleRecipients(t *testing.T) {
	email := Email{
		To:  make([]string, 100),
		CC:  make([]string, 50),
		BCC: make([]string, 50),
	}

	for i := 0; i < 100; i++ {
		email.To[i] = fmt.Sprintf("user%d@example.com", i)
	}
	for i := 0; i < 50; i++ {
		email.CC[i] = fmt.Sprintf("cc%d@example.com", i)
		email.BCC[i] = fmt.Sprintf("bcc%d@example.com", i)
	}

	if len(email.To) != 100 {
		t.Errorf("expected 100 To recipients, got %d", len(email.To))
	}
	if len(email.CC) != 50 {
		t.Errorf("expected 50 CC recipients, got %d", len(email.CC))
	}
	if len(email.BCC) != 50 {
		t.Errorf("expected 50 BCC recipients, got %d", len(email.BCC))
	}
}

func TestEmailWithUnicodeContent(t *testing.T) {
	email := Email{
		To:       []string{"user@example.com"},
		Subject:  "Вітаємо з покупкою! 🎉",
		HTML:     "<h1>Дякуємо за замовлення!</h1><p>Ваше замовлення №12345 прийнято.</p>",
		Text:     "Дякуємо за замовлення! Ваше замовлення №12345 прийнято.",
		FromName: "Магазин «Україна»",
	}

	if email.Subject != "Вітаємо з покупкою! 🎉" {
		t.Error("Unicode subject was modified")
	}
	if email.FromName != "Магазин «Україна»" {
		t.Error("Unicode FromName was modified")
	}
}

func TestCampaignWithEmptyLists(t *testing.T) {
	campaign := Campaign{
		ID:       "campaign-1",
		Name:     "Test",
		Subject:  "Test",
		Lists:    []string{},
		Segments: []string{},
	}

	if len(campaign.Lists) != 0 {
		t.Error("expected empty lists")
	}
	if len(campaign.Segments) != 0 {
		t.Error("expected empty segments")
	}
}

func TestSubscriberWithAllFields(t *testing.T) {
	now := time.Now()
	sub := Subscriber{
		Email:     "full@example.com",
		FirstName: "Повне",
		LastName:  "Ім'я",
		Phone:     "+380501234567",
		Tags:      []string{"vip", "newsletter", "promo", "active"},
		Variables: map[string]interface{}{
			"segment":     "premium",
			"score":       100,
			"preferences": []string{"email", "sms"},
			"nested": map[string]interface{}{
				"key": "value",
			},
		},
		Status:       "active",
		SubscribedAt: &now,
	}

	if len(sub.Tags) != 4 {
		t.Errorf("expected 4 tags, got %d", len(sub.Tags))
	}
	if len(sub.Variables) != 4 {
		t.Errorf("expected 4 variables, got %d", len(sub.Variables))
	}
}

// ============================================================================
// Sequential Stress Tests
// ============================================================================

func TestSequentialEmailSending(t *testing.T) {
	service := NewEmailService()
	provider := newMockProvider("test")
	service.RegisterProvider(provider)
	service.SetDefaultProvider("test")

	ctx := context.Background()
	emailCount := 100

	for i := 0; i < emailCount; i++ {
		email := &Email{
			To:      []string{fmt.Sprintf("user%d@example.com", i)},
			Subject: fmt.Sprintf("Test %d", i),
			From:    "test@example.com",
		}
		_, err := service.SendEmail(ctx, "", email)
		if err != nil {
			t.Fatalf("failed to send email %d: %v", i, err)
		}
	}
}

func TestSequentialSubscriberOperations(t *testing.T) {
	provider := newMockProvider("test")
	ctx := context.Background()
	subCount := 50

	for i := 0; i < subCount; i++ {
		sub := &Subscriber{
			Email:     fmt.Sprintf("sub%d@example.com", i),
			FirstName: fmt.Sprintf("User%d", i),
		}
		err := provider.AddSubscriber(ctx, "list-1", sub)
		if err != nil {
			t.Fatalf("failed to add subscriber %d: %v", i, err)
		}
	}
}

// ============================================================================
// JSON Serialization Tests
// ============================================================================

func TestEmailJSONSerialization(t *testing.T) {
	email := Email{
		To:       []string{"user@example.com"},
		Subject:  "Test",
		HTML:     "<p>Test</p>",
		Metadata: map[string]string{"order_id": "123"},
	}

	data, err := json.Marshal(email)
	if err != nil {
		t.Fatalf("failed to marshal email: %v", err)
	}

	var decoded Email
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("failed to unmarshal email: %v", err)
	}

	if decoded.Subject != email.Subject {
		t.Errorf("expected subject '%s', got '%s'", email.Subject, decoded.Subject)
	}
}

func TestSubscriberJSONSerialization(t *testing.T) {
	now := time.Now()
	sub := Subscriber{
		Email:        "test@example.com",
		FirstName:    "Тест",
		SubscribedAt: &now,
	}

	data, err := json.Marshal(sub)
	if err != nil {
		t.Fatalf("failed to marshal subscriber: %v", err)
	}

	var decoded Subscriber
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("failed to unmarshal subscriber: %v", err)
	}

	if decoded.Email != sub.Email {
		t.Errorf("expected email '%s', got '%s'", sub.Email, decoded.Email)
	}
}

func TestCampaignJSONSerialization(t *testing.T) {
	scheduledAt := time.Now().Add(24 * time.Hour)
	campaign := Campaign{
		ID:          "campaign-1",
		Name:        "Black Friday",
		ScheduledAt: &scheduledAt,
		Stats: &CampaignStats{
			Sent:     1000,
			OpenRate: 45.5,
		},
	}

	data, err := json.Marshal(campaign)
	if err != nil {
		t.Fatalf("failed to marshal campaign: %v", err)
	}

	var decoded Campaign
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("failed to unmarshal campaign: %v", err)
	}

	if decoded.Name != campaign.Name {
		t.Errorf("expected name '%s', got '%s'", campaign.Name, decoded.Name)
	}
	if decoded.Stats == nil {
		t.Error("expected stats to be decoded")
	}
}
