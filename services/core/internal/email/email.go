package email

import (
	"context"
	"errors"
	"time"
)

// Common errors
var (
	ErrInvalidEmail      = errors.New("invalid email address")
	ErrTemplateNotFound  = errors.New("template not found")
	ErrSendFailed        = errors.New("email send failed")
	ErrSubscriberExists  = errors.New("subscriber already exists")
	ErrSubscriberNotFound = errors.New("subscriber not found")
)

// EmailStatus represents email status
type EmailStatus string

const (
	EmailStatusQueued    EmailStatus = "queued"
	EmailStatusSent      EmailStatus = "sent"
	EmailStatusDelivered EmailStatus = "delivered"
	EmailStatusOpened    EmailStatus = "opened"
	EmailStatusClicked   EmailStatus = "clicked"
	EmailStatusBounced   EmailStatus = "bounced"
	EmailStatusSpam      EmailStatus = "spam"
	EmailStatusFailed    EmailStatus = "failed"
)

// Email represents an email message
type Email struct {
	To          []string          `json:"to"`
	CC          []string          `json:"cc,omitempty"`
	BCC         []string          `json:"bcc,omitempty"`
	From        string            `json:"from,omitempty"`
	FromName    string            `json:"from_name,omitempty"`
	ReplyTo     string            `json:"reply_to,omitempty"`
	Subject     string            `json:"subject"`
	HTML        string            `json:"html,omitempty"`
	Text        string            `json:"text,omitempty"`
	TemplateID  string            `json:"template_id,omitempty"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
	Attachments []Attachment      `json:"attachments,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// Attachment represents email attachment
type Attachment struct {
	Filename    string `json:"filename"`
	Content     []byte `json:"content"`
	ContentType string `json:"content_type"`
	ContentID   string `json:"content_id,omitempty"` // For inline images
}

// SendResult represents send result
type SendResult struct {
	MessageID string      `json:"message_id"`
	Status    EmailStatus `json:"status"`
	Error     string      `json:"error,omitempty"`
}

// Subscriber represents email subscriber
type Subscriber struct {
	Email       string            `json:"email"`
	FirstName   string            `json:"first_name,omitempty"`
	LastName    string            `json:"last_name,omitempty"`
	Phone       string            `json:"phone,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
	Status      string            `json:"status,omitempty"` // active, unsubscribed, bounced
	SubscribedAt *time.Time       `json:"subscribed_at,omitempty"`
}

// List represents mailing list
type List struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Subscribers int    `json:"subscribers,omitempty"`
}

// Campaign represents email campaign
type Campaign struct {
	ID          string            `json:"id,omitempty"`
	Name        string            `json:"name"`
	Subject     string            `json:"subject"`
	From        string            `json:"from"`
	FromName    string            `json:"from_name,omitempty"`
	HTML        string            `json:"html,omitempty"`
	Text        string            `json:"text,omitempty"`
	TemplateID  string            `json:"template_id,omitempty"`
	Lists       []string          `json:"lists,omitempty"`
	Segments    []string          `json:"segments,omitempty"`
	ScheduledAt *time.Time        `json:"scheduled_at,omitempty"`
	Status      string            `json:"status,omitempty"`
	Stats       *CampaignStats    `json:"stats,omitempty"`
}

// CampaignStats represents campaign statistics
type CampaignStats struct {
	Sent       int     `json:"sent"`
	Delivered  int     `json:"delivered"`
	Opened     int     `json:"opened"`
	Clicked    int     `json:"clicked"`
	Bounced    int     `json:"bounced"`
	Spam       int     `json:"spam"`
	Unsubscribed int   `json:"unsubscribed"`
	OpenRate   float64 `json:"open_rate"`
	ClickRate  float64 `json:"click_rate"`
}

// Template represents email template
type Template struct {
	ID       string            `json:"id,omitempty"`
	Name     string            `json:"name"`
	Subject  string            `json:"subject,omitempty"`
	HTML     string            `json:"html"`
	Text     string            `json:"text,omitempty"`
	Variables []string         `json:"variables,omitempty"`
}

// EmailProvider defines interface for email marketing providers
type EmailProvider interface {
	// Name returns provider name
	Name() string

	// SendEmail sends transactional email
	SendEmail(ctx context.Context, email *Email) (*SendResult, error)

	// AddSubscriber adds subscriber to list
	AddSubscriber(ctx context.Context, listID string, sub *Subscriber) error

	// RemoveSubscriber removes subscriber from list
	RemoveSubscriber(ctx context.Context, listID, email string) error

	// UpdateSubscriber updates subscriber
	UpdateSubscriber(ctx context.Context, listID string, sub *Subscriber) error

	// GetSubscriber gets subscriber by email
	GetSubscriber(ctx context.Context, listID, email string) (*Subscriber, error)

	// GetLists returns all mailing lists
	GetLists(ctx context.Context) ([]List, error)

	// CreateCampaign creates email campaign
	CreateCampaign(ctx context.Context, campaign *Campaign) (*Campaign, error)

	// SendCampaign sends campaign
	SendCampaign(ctx context.Context, campaignID string) error

	// GetCampaignStats gets campaign statistics
	GetCampaignStats(ctx context.Context, campaignID string) (*CampaignStats, error)
}

// EmailService manages email providers
type EmailService struct {
	providers       map[string]EmailProvider
	defaultProvider string
	defaultFrom     string
	defaultFromName string
}

// NewEmailService creates email service
func NewEmailService() *EmailService {
	return &EmailService{
		providers: make(map[string]EmailProvider),
	}
}

// RegisterProvider registers email provider
func (s *EmailService) RegisterProvider(provider EmailProvider) {
	s.providers[provider.Name()] = provider
}

// SetDefaultProvider sets default provider
func (s *EmailService) SetDefaultProvider(name string) {
	s.defaultProvider = name
}

// SetDefaultFrom sets default from address
func (s *EmailService) SetDefaultFrom(email, name string) {
	s.defaultFrom = email
	s.defaultFromName = name
}

// GetProvider returns provider by name
func (s *EmailService) GetProvider(name string) (EmailProvider, error) {
	if name == "" {
		name = s.defaultProvider
	}
	provider, ok := s.providers[name]
	if !ok {
		return nil, errors.New("email provider not found: " + name)
	}
	return provider, nil
}

// SendEmail sends email with specified or default provider
func (s *EmailService) SendEmail(ctx context.Context, providerName string, email *Email) (*SendResult, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}

	if email.From == "" {
		email.From = s.defaultFrom
		email.FromName = s.defaultFromName
	}

	return provider.SendEmail(ctx, email)
}

// SendOrderConfirmation sends order confirmation email
func (s *EmailService) SendOrderConfirmation(ctx context.Context, to, orderID string, items []map[string]interface{}, total float64) error {
	email := &Email{
		To:         []string{to},
		Subject:    "Підтвердження замовлення #" + orderID,
		TemplateID: "order_confirmation",
		Variables: map[string]interface{}{
			"order_id": orderID,
			"items":    items,
			"total":    total,
		},
	}

	_, err := s.SendEmail(ctx, "", email)
	return err
}

// SendShippingNotification sends shipping notification
func (s *EmailService) SendShippingNotification(ctx context.Context, to, orderID, trackingNumber, carrier string) error {
	email := &Email{
		To:         []string{to},
		Subject:    "Ваше замовлення #" + orderID + " відправлено",
		TemplateID: "shipping_notification",
		Variables: map[string]interface{}{
			"order_id":        orderID,
			"tracking_number": trackingNumber,
			"carrier":         carrier,
		},
	}

	_, err := s.SendEmail(ctx, "", email)
	return err
}

// SendPasswordReset sends password reset email
func (s *EmailService) SendPasswordReset(ctx context.Context, to, resetLink string) error {
	email := &Email{
		To:         []string{to},
		Subject:    "Скидання пароля",
		TemplateID: "password_reset",
		Variables: map[string]interface{}{
			"reset_link": resetLink,
		},
	}

	_, err := s.SendEmail(ctx, "", email)
	return err
}

// SendWelcome sends welcome email
func (s *EmailService) SendWelcome(ctx context.Context, to, name string) error {
	email := &Email{
		To:         []string{to},
		Subject:    "Вітаємо в нашому магазині!",
		TemplateID: "welcome",
		Variables: map[string]interface{}{
			"name": name,
		},
	}

	_, err := s.SendEmail(ctx, "", email)
	return err
}
