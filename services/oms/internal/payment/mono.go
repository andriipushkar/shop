package payment

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	MonoAPIURL = "https://api.monobank.ua/api/merchant/invoice/create"

	StatusCreated    = "created"
	StatusProcessing = "processing"
	StatusHold       = "hold"
	StatusSuccess    = "success"
	StatusFailure    = "failure"
	StatusReversed   = "reversed"
	StatusExpired    = "expired"
)

// MonoClient handles Monobank Acquiring API
type MonoClient struct {
	token      string
	webhookURL string
	httpClient *http.Client
}

// NewMonoClient creates a new Mono Acquiring client
func NewMonoClient(token, webhookURL string) *MonoClient {
	return &MonoClient{
		token:      token,
		webhookURL: webhookURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// InvoiceRequest represents a payment request to Mono
type InvoiceRequest struct {
	Amount          int64             `json:"amount"`          // Amount in kopecks (UAH * 100)
	Ccy             int               `json:"ccy,omitempty"`   // Currency code (980 = UAH)
	MerchantPaymInfo *MerchantPaymInfo `json:"merchantPaymInfo,omitempty"`
	RedirectURL     string            `json:"redirectUrl,omitempty"`
	WebHookURL      string            `json:"webHookUrl,omitempty"`
	Validity        int               `json:"validity,omitempty"` // Invoice validity in seconds
	PaymentType     string            `json:"paymentType,omitempty"` // debit, hold
	Reference       string            `json:"reference,omitempty"` // Order ID
	Comment         string            `json:"comment,omitempty"`
	Destination     string            `json:"destination,omitempty"`
}

// MerchantPaymInfo contains merchant payment details
type MerchantPaymInfo struct {
	Reference   string      `json:"reference"`
	Destination string      `json:"destination"`
	Comment     string      `json:"comment,omitempty"`
	BasketOrder []BasketItem `json:"basketOrder,omitempty"`
}

// BasketItem represents an item in the payment basket
type BasketItem struct {
	Name  string  `json:"name"`
	Qty   float64 `json:"qty"`
	Sum   int64   `json:"sum"` // in kopecks
	Icon  string  `json:"icon,omitempty"`
	Unit  string  `json:"unit,omitempty"`
	Code  string  `json:"code,omitempty"`
}

// InvoiceResponse represents Mono API response
type InvoiceResponse struct {
	InvoiceID  string `json:"invoiceId"`
	PageURL    string `json:"pageUrl"`
	Status     string `json:"status,omitempty"`
	FailureReason string `json:"failureReason,omitempty"`
	ErrCode    string `json:"errCode,omitempty"`
	ErrText    string `json:"errText,omitempty"`
}

// WebhookPayload represents incoming webhook data from Mono
type WebhookPayload struct {
	InvoiceID     string `json:"invoiceId"`
	Status        string `json:"status"`
	FailureReason string `json:"failureReason,omitempty"`
	Amount        int64  `json:"amount"`
	Ccy           int    `json:"ccy"`
	Reference     string `json:"reference"`
	CreatedDate   string `json:"createdDate"`
	ModifiedDate  string `json:"modifiedDate"`
}

// CreateInvoice creates a new payment invoice
func (c *MonoClient) CreateInvoice(ctx context.Context, req *InvoiceRequest) (*InvoiceResponse, error) {
	if req.Ccy == 0 {
		req.Ccy = 980 // UAH
	}
	if req.WebHookURL == "" {
		req.WebHookURL = c.webhookURL
	}
	if req.Validity == 0 {
		req.Validity = 3600 // 1 hour
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, MonoAPIURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Token", c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var invoiceResp InvoiceResponse
	if err := json.Unmarshal(respBody, &invoiceResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if invoiceResp.ErrCode != "" {
		return nil, fmt.Errorf("mono API error: %s - %s", invoiceResp.ErrCode, invoiceResp.ErrText)
	}

	return &invoiceResp, nil
}

// VerifyWebhookSignature verifies the webhook signature from Mono
func (c *MonoClient) VerifyWebhookSignature(body []byte, signature string) bool {
	// Mono uses X-Sign header with base64(sha256(body + token))
	hash := sha256.Sum256(append(body, []byte(c.token)...))
	expected := base64.StdEncoding.EncodeToString(hash[:])
	return signature == expected
}

// Payment represents a stored payment record
type Payment struct {
	ID           string    `json:"id"`
	OrderID      string    `json:"order_id"`
	InvoiceID    string    `json:"invoice_id"`
	Amount       int64     `json:"amount"` // in kopecks
	Status       string    `json:"status"`
	PaymentURL   string    `json:"payment_url,omitempty"`
	FailureReason string   `json:"failure_reason,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// PaymentService handles payment operations
type PaymentService struct {
	mono *MonoClient
	repo PaymentRepository
}

// PaymentRepository defines storage interface
type PaymentRepository interface {
	Save(ctx context.Context, p *Payment) error
	GetByOrderID(ctx context.Context, orderID string) (*Payment, error)
	GetByInvoiceID(ctx context.Context, invoiceID string) (*Payment, error)
	UpdateStatus(ctx context.Context, invoiceID, status, failureReason string) error
}

// NewPaymentService creates a new payment service
func NewPaymentService(mono *MonoClient, repo PaymentRepository) *PaymentService {
	return &PaymentService{mono: mono, repo: repo}
}

// CreatePayment creates a new payment for an order
func (s *PaymentService) CreatePayment(ctx context.Context, orderID string, amount int64, productName string, redirectURL string) (*Payment, error) {
	// Create invoice in Mono
	invoiceReq := &InvoiceRequest{
		Amount:      amount,
		Reference:   orderID,
		Comment:     fmt.Sprintf("Оплата замовлення %s", orderID),
		Destination: productName,
		RedirectURL: redirectURL,
		MerchantPaymInfo: &MerchantPaymInfo{
			Reference:   orderID,
			Destination: productName,
		},
	}

	invoiceResp, err := s.mono.CreateInvoice(ctx, invoiceReq)
	if err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	// Save payment record
	payment := &Payment{
		ID:         fmt.Sprintf("PAY-%d", time.Now().UnixNano()),
		OrderID:    orderID,
		InvoiceID:  invoiceResp.InvoiceID,
		Amount:     amount,
		Status:     StatusCreated,
		PaymentURL: invoiceResp.PageURL,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.Save(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to save payment: %w", err)
	}

	return payment, nil
}

// HandleWebhook processes webhook from Mono
func (s *PaymentService) HandleWebhook(ctx context.Context, payload *WebhookPayload) error {
	return s.repo.UpdateStatus(ctx, payload.InvoiceID, payload.Status, payload.FailureReason)
}

// GetPaymentByOrder returns payment for an order
func (s *PaymentService) GetPaymentByOrder(ctx context.Context, orderID string) (*Payment, error) {
	return s.repo.GetByOrderID(ctx, orderID)
}

// IsPaymentSuccessful checks if payment was successful
func IsPaymentSuccessful(status string) bool {
	return status == StatusSuccess
}

// IsPaymentFinal checks if payment is in final state
func IsPaymentFinal(status string) bool {
	return status == StatusSuccess || status == StatusFailure || status == StatusReversed || status == StatusExpired
}
