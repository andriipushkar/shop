package payment

import (
	"context"
	"errors"
	"time"
)

// Common errors
var (
	ErrPaymentNotFound     = errors.New("payment not found")
	ErrPaymentFailed       = errors.New("payment failed")
	ErrInvalidAmount       = errors.New("invalid amount")
	ErrInvalidCurrency     = errors.New("invalid currency")
	ErrRefundNotAllowed    = errors.New("refund not allowed")
	ErrCallbackInvalid     = errors.New("invalid callback signature")
)

// PaymentStatus represents payment status
type PaymentStatus string

const (
	StatusPending    PaymentStatus = "pending"
	StatusProcessing PaymentStatus = "processing"
	StatusSuccess    PaymentStatus = "success"
	StatusFailed     PaymentStatus = "failed"
	StatusCancelled  PaymentStatus = "cancelled"
	StatusRefunded   PaymentStatus = "refunded"
	StatusExpired    PaymentStatus = "expired"
)

// PaymentMethod represents payment method type
type PaymentMethod string

const (
	MethodCard       PaymentMethod = "card"
	MethodApplePay   PaymentMethod = "apple_pay"
	MethodGooglePay  PaymentMethod = "google_pay"
	MethodPrivat24   PaymentMethod = "privat24"
	MethodInstalment PaymentMethod = "instalment"
	MethodInvoice    PaymentMethod = "invoice"
	MethodCash       PaymentMethod = "cash"
	MethodQR         PaymentMethod = "qr"
)

// Currency represents currency code
type Currency string

const (
	UAH Currency = "UAH"
	USD Currency = "USD"
	EUR Currency = "EUR"
	PLN Currency = "PLN"
)

// PaymentRequest represents a payment request
type PaymentRequest struct {
	OrderID       string            `json:"order_id"`
	Amount        float64           `json:"amount"`
	Currency      Currency          `json:"currency"`
	Description   string            `json:"description"`
	CustomerEmail string            `json:"customer_email,omitempty"`
	CustomerPhone string            `json:"customer_phone,omitempty"`
	CustomerName  string            `json:"customer_name,omitempty"`
	ReturnURL     string            `json:"return_url,omitempty"`
	CallbackURL   string            `json:"callback_url,omitempty"`
	Language      string            `json:"language,omitempty"`
	Method        PaymentMethod     `json:"method,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	// For instalments
	InstalmentParts int `json:"instalment_parts,omitempty"`
	// Product info for receipt
	Products []PaymentProduct `json:"products,omitempty"`
}

// PaymentProduct represents product in payment
type PaymentProduct struct {
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

// PaymentResponse represents payment response
type PaymentResponse struct {
	PaymentID    string            `json:"payment_id"`
	OrderID      string            `json:"order_id"`
	Status       PaymentStatus     `json:"status"`
	Amount       float64           `json:"amount"`
	Currency     Currency          `json:"currency"`
	PaymentURL   string            `json:"payment_url,omitempty"`
	CheckoutHTML string            `json:"checkout_html,omitempty"`
	QRCode       string            `json:"qr_code,omitempty"`
	ErrorCode    string            `json:"error_code,omitempty"`
	ErrorMessage string            `json:"error_message,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
}

// PaymentCallback represents callback from payment provider
type PaymentCallback struct {
	PaymentID      string            `json:"payment_id"`
	OrderID        string            `json:"order_id"`
	Status         PaymentStatus     `json:"status"`
	Amount         float64           `json:"amount"`
	Currency       Currency          `json:"currency"`
	Commission     float64           `json:"commission,omitempty"`
	TransactionID  string            `json:"transaction_id,omitempty"`
	CardMask       string            `json:"card_mask,omitempty"`
	CardType       string            `json:"card_type,omitempty"`
	CardBank       string            `json:"card_bank,omitempty"`
	ErrorCode      string            `json:"error_code,omitempty"`
	ErrorMessage   string            `json:"error_message,omitempty"`
	CompletedAt    *time.Time        `json:"completed_at,omitempty"`
	RawData        map[string]interface{} `json:"raw_data,omitempty"`
}

// RefundRequest represents refund request
type RefundRequest struct {
	PaymentID string  `json:"payment_id"`
	Amount    float64 `json:"amount,omitempty"` // Partial refund, 0 = full
	Reason    string  `json:"reason,omitempty"`
}

// RefundResponse represents refund response
type RefundResponse struct {
	RefundID  string        `json:"refund_id"`
	PaymentID string        `json:"payment_id"`
	Amount    float64       `json:"amount"`
	Status    PaymentStatus `json:"status"`
	CreatedAt time.Time     `json:"created_at"`
}

// PaymentProvider defines interface for payment providers
type PaymentProvider interface {
	// Name returns provider name
	Name() string

	// CreatePayment creates new payment
	CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error)

	// GetPayment gets payment status
	GetPayment(ctx context.Context, paymentID string) (*PaymentResponse, error)

	// ProcessCallback processes callback from provider
	ProcessCallback(ctx context.Context, data []byte, signature string) (*PaymentCallback, error)

	// Refund creates refund
	Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error)

	// VerifySignature verifies callback signature
	VerifySignature(data []byte, signature string) bool
}

// PaymentService manages multiple payment providers
type PaymentService struct {
	providers map[string]PaymentProvider
	defaultProvider string
}

// NewPaymentService creates payment service
func NewPaymentService() *PaymentService {
	return &PaymentService{
		providers: make(map[string]PaymentProvider),
	}
}

// RegisterProvider registers payment provider
func (s *PaymentService) RegisterProvider(provider PaymentProvider) {
	s.providers[provider.Name()] = provider
}

// SetDefaultProvider sets default provider
func (s *PaymentService) SetDefaultProvider(name string) {
	s.defaultProvider = name
}

// GetProvider returns provider by name
func (s *PaymentService) GetProvider(name string) (PaymentProvider, error) {
	if name == "" {
		name = s.defaultProvider
	}
	provider, ok := s.providers[name]
	if !ok {
		return nil, errors.New("payment provider not found: " + name)
	}
	return provider, nil
}

// CreatePayment creates payment with specified or default provider
func (s *PaymentService) CreatePayment(ctx context.Context, providerName string, req *PaymentRequest) (*PaymentResponse, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}
	return provider.CreatePayment(ctx, req)
}

// ProcessCallback routes callback to appropriate provider
func (s *PaymentService) ProcessCallback(ctx context.Context, providerName string, data []byte, signature string) (*PaymentCallback, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}
	return provider.ProcessCallback(ctx, data, signature)
}
