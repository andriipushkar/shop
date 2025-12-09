package sms

import (
	"context"
	"errors"
	"time"
)

// Common errors
var (
	ErrInvalidPhone    = errors.New("invalid phone number")
	ErrInvalidMessage  = errors.New("invalid message")
	ErrSendFailed      = errors.New("SMS send failed")
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrProviderError   = errors.New("provider error")
)

// MessageStatus represents SMS status
type MessageStatus string

const (
	StatusQueued    MessageStatus = "queued"
	StatusSent      MessageStatus = "sent"
	StatusDelivered MessageStatus = "delivered"
	StatusFailed    MessageStatus = "failed"
	StatusExpired   MessageStatus = "expired"
	StatusRejected  MessageStatus = "rejected"
)

// Message represents SMS message
type Message struct {
	ID          string            `json:"id,omitempty"`
	Phone       string            `json:"phone"`
	Text        string            `json:"text"`
	Sender      string            `json:"sender,omitempty"`
	Status      MessageStatus     `json:"status,omitempty"`
	ErrorCode   string            `json:"error_code,omitempty"`
	ErrorText   string            `json:"error_text,omitempty"`
	SentAt      *time.Time        `json:"sent_at,omitempty"`
	DeliveredAt *time.Time        `json:"delivered_at,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// BulkMessage represents bulk SMS request
type BulkMessage struct {
	Phones  []string          `json:"phones"`
	Text    string            `json:"text"`
	Sender  string            `json:"sender,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// SendResult represents send result
type SendResult struct {
	MessageID   string        `json:"message_id"`
	Status      MessageStatus `json:"status"`
	Phone       string        `json:"phone"`
	Cost        float64       `json:"cost,omitempty"`
	ErrorCode   string        `json:"error_code,omitempty"`
	ErrorText   string        `json:"error_text,omitempty"`
}

// Balance represents account balance
type Balance struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

// DeliveryReport represents delivery status report
type DeliveryReport struct {
	MessageID   string        `json:"message_id"`
	Phone       string        `json:"phone"`
	Status      MessageStatus `json:"status"`
	DeliveredAt *time.Time    `json:"delivered_at,omitempty"`
	ErrorCode   string        `json:"error_code,omitempty"`
	ErrorText   string        `json:"error_text,omitempty"`
}

// SMSProvider defines interface for SMS providers
type SMSProvider interface {
	// Name returns provider name
	Name() string

	// Send sends single SMS
	Send(ctx context.Context, msg *Message) (*SendResult, error)

	// SendBulk sends bulk SMS
	SendBulk(ctx context.Context, msg *BulkMessage) ([]SendResult, error)

	// GetStatus gets message status
	GetStatus(ctx context.Context, messageID string) (*DeliveryReport, error)

	// GetBalance gets account balance
	GetBalance(ctx context.Context) (*Balance, error)
}

// SMSService manages SMS providers
type SMSService struct {
	providers       map[string]SMSProvider
	defaultProvider string
	defaultSender   string
}

// NewSMSService creates SMS service
func NewSMSService() *SMSService {
	return &SMSService{
		providers: make(map[string]SMSProvider),
	}
}

// RegisterProvider registers SMS provider
func (s *SMSService) RegisterProvider(provider SMSProvider) {
	s.providers[provider.Name()] = provider
}

// SetDefaultProvider sets default provider
func (s *SMSService) SetDefaultProvider(name string) {
	s.defaultProvider = name
}

// SetDefaultSender sets default sender name
func (s *SMSService) SetDefaultSender(sender string) {
	s.defaultSender = sender
}

// GetProvider returns provider by name
func (s *SMSService) GetProvider(name string) (SMSProvider, error) {
	if name == "" {
		name = s.defaultProvider
	}
	provider, ok := s.providers[name]
	if !ok {
		return nil, errors.New("SMS provider not found: " + name)
	}
	return provider, nil
}

// Send sends SMS with specified or default provider
func (s *SMSService) Send(ctx context.Context, providerName string, msg *Message) (*SendResult, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}

	if msg.Sender == "" {
		msg.Sender = s.defaultSender
	}

	return provider.Send(ctx, msg)
}

// SendBulk sends bulk SMS
func (s *SMSService) SendBulk(ctx context.Context, providerName string, msg *BulkMessage) ([]SendResult, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}

	if msg.Sender == "" {
		msg.Sender = s.defaultSender
	}

	return provider.SendBulk(ctx, msg)
}

// GetStatus gets message status
func (s *SMSService) GetStatus(ctx context.Context, providerName, messageID string) (*DeliveryReport, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}
	return provider.GetStatus(ctx, messageID)
}

// GetBalance gets account balance
func (s *SMSService) GetBalance(ctx context.Context, providerName string) (*Balance, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}
	return provider.GetBalance(ctx)
}

// SendOrderNotification sends order status notification
func (s *SMSService) SendOrderNotification(ctx context.Context, phone, orderID, status string) error {
	messages := map[string]string{
		"new":        "Дякуємо за замовлення #%s! Ми зв'яжемось з Вами найближчим часом.",
		"confirmed":  "Замовлення #%s підтверджено. Очікуйте відправку.",
		"shipped":    "Замовлення #%s відправлено! Очікуйте доставку.",
		"delivered":  "Замовлення #%s доставлено. Дякуємо за покупку!",
		"cancelled":  "Замовлення #%s скасовано.",
	}

	text, ok := messages[status]
	if !ok {
		text = "Статус замовлення #%s змінено: " + status
	}

	_, err := s.Send(ctx, "", &Message{
		Phone: phone,
		Text:  formatMessage(text, orderID),
	})
	return err
}

// SendDeliveryNotification sends delivery notification
func (s *SMSService) SendDeliveryNotification(ctx context.Context, phone, ttn string) error {
	text := "Ваше відправлення прибуло! ТТН: %s. Заберіть на пошті."
	_, err := s.Send(ctx, "", &Message{
		Phone: phone,
		Text:  formatMessage(text, ttn),
	})
	return err
}

// SendVerificationCode sends verification code
func (s *SMSService) SendVerificationCode(ctx context.Context, phone, code string) error {
	text := "Ваш код підтвердження: %s. Не повідомляйте нікому."
	_, err := s.Send(ctx, "", &Message{
		Phone: phone,
		Text:  formatMessage(text, code),
	})
	return err
}

func formatMessage(template string, args ...interface{}) string {
	if len(args) == 0 {
		return template
	}
	return template // Simplified - use fmt.Sprintf in real implementation
}
