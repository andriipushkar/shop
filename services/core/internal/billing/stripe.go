// Package billing provides Stripe integration for SaaS billing
package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/customer"
	"github.com/stripe/stripe-go/v76/invoice"
	"github.com/stripe/stripe-go/v76/paymentmethod"
	"github.com/stripe/stripe-go/v76/subscription"
	"github.com/stripe/stripe-go/v76/webhook"
	"go.uber.org/zap"
)

// PlanType represents subscription plan types
type PlanType string

const (
	PlanFree       PlanType = "free"
	PlanStarter    PlanType = "starter"
	PlanPro        PlanType = "pro"
	PlanEnterprise PlanType = "enterprise"
)

// StripePriceIDs maps plans to Stripe price IDs
var StripePriceIDs = map[PlanType]string{
	PlanStarter:    "price_starter_monthly",
	PlanPro:        "price_pro_monthly",
	PlanEnterprise: "price_enterprise_monthly",
}

// Tenant interface for billing operations
type Tenant interface {
	GetID() string
	GetName() string
	GetEmail() string
	GetPlan() PlanType
	GetStripeID() string
}

// SimpleTenant is a simple tenant implementation
type SimpleTenant struct {
	ID       string
	Name     string
	Email    string
	Plan     PlanType
	StripeID string
}

func (t *SimpleTenant) GetID() string       { return t.ID }
func (t *SimpleTenant) GetName() string     { return t.Name }
func (t *SimpleTenant) GetEmail() string    { return t.Email }
func (t *SimpleTenant) GetPlan() PlanType   { return t.Plan }
func (t *SimpleTenant) GetStripeID() string { return t.StripeID }

// UsageRecord represents billing usage
type UsageRecord struct {
	TenantID    string    `json:"tenant_id"`
	Period      string    `json:"period"`
	Products    int       `json:"products_count"`
	Orders      int       `json:"orders_count"`
	Storage     int64     `json:"storage_bytes"`
	APIRequests int       `json:"api_requests"`
	AIRequests  int       `json:"ai_requests"`
	RecordedAt  time.Time `json:"recorded_at"`
}

// Subscription represents a billing subscription
type Subscription struct {
	ID                   string    `json:"id"`
	TenantID             string    `json:"tenant_id"`
	StripeSubscriptionID string    `json:"stripe_subscription_id"`
	Plan                 PlanType  `json:"plan"`
	Status               string    `json:"status"`
	CurrentPeriodStart   time.Time `json:"current_period_start"`
	CurrentPeriodEnd     time.Time `json:"current_period_end"`
	CancelAtPeriodEnd    bool      `json:"cancel_at_period_end"`
	TrialEnd             *time.Time `json:"trial_end,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// Invoice represents a billing invoice
type Invoice struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenant_id"`
	StripeInvoiceID  string    `json:"stripe_invoice_id"`
	Amount           int64     `json:"amount"`
	Currency         string    `json:"currency"`
	Status           string    `json:"status"`
	InvoiceURL       string    `json:"invoice_url"`
	InvoicePDF       string    `json:"invoice_pdf"`
	PeriodStart      time.Time `json:"period_start"`
	PeriodEnd        time.Time `json:"period_end"`
	PaidAt           *time.Time `json:"paid_at,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// PaymentMethod represents a payment method
type PaymentMethod struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Card      *Card  `json:"card,omitempty"`
	IsDefault bool   `json:"is_default"`
}

// Card represents card details
type Card struct {
	Brand    string `json:"brand"`
	Last4    string `json:"last4"`
	ExpMonth int64  `json:"exp_month"`
	ExpYear  int64  `json:"exp_year"`
}

// Config holds Stripe configuration
type Config struct {
	SecretKey      string `json:"secret_key"`
	PublishableKey string `json:"publishable_key"`
	WebhookSecret  string `json:"webhook_secret"`
	SuccessURL     string `json:"success_url"`
	CancelURL      string `json:"cancel_url"`
	TrialDays      int64  `json:"trial_days"`
}

// StripeProvider implements billing using Stripe
type StripeProvider struct {
	config Config
	logger *zap.Logger
}

// NewStripeProvider creates a new Stripe billing provider
func NewStripeProvider(config Config, logger *zap.Logger) *StripeProvider {
	stripe.Key = config.SecretKey
	return &StripeProvider{
		config: config,
		logger: logger,
	}
}

// CreateCustomer creates a Stripe customer for a tenant
func (p *StripeProvider) CreateCustomer(ctx context.Context, tenant Tenant) (string, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(tenant.GetEmail()),
		Name:  stripe.String(tenant.GetName()),
		Metadata: map[string]string{
			"tenant_id": tenant.GetID(),
		},
	}

	c, err := customer.New(params)
	if err != nil {
		p.logger.Error("Failed to create Stripe customer",
			zap.Error(err),
			zap.String("tenant_id", tenant.GetID()),
		)
		return "", fmt.Errorf("failed to create customer: %w", err)
	}

	p.logger.Info("Stripe customer created",
		zap.String("customer_id", c.ID),
		zap.String("tenant_id", tenant.GetID()),
	)

	return c.ID, nil
}

// CreateSubscription creates a new subscription
func (p *StripeProvider) CreateSubscription(ctx context.Context, customerID string, plan PlanType) (string, error) {
	priceID, ok := StripePriceIDs[plan]
	if !ok {
		return "", fmt.Errorf("unknown plan: %s", plan)
	}

	params := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(priceID),
			},
		},
	}

	// Add trial period for new subscriptions
	if p.config.TrialDays > 0 {
		params.TrialPeriodDays = stripe.Int64(p.config.TrialDays)
	}

	sub, err := subscription.New(params)
	if err != nil {
		p.logger.Error("Failed to create subscription",
			zap.Error(err),
			zap.String("customer_id", customerID),
		)
		return "", fmt.Errorf("failed to create subscription: %w", err)
	}

	p.logger.Info("Subscription created",
		zap.String("subscription_id", sub.ID),
		zap.String("customer_id", customerID),
		zap.String("plan", string(plan)),
	)

	return sub.ID, nil
}

// UpdateSubscription updates an existing subscription plan
func (p *StripeProvider) UpdateSubscription(ctx context.Context, subscriptionID string, plan PlanType) error {
	priceID, ok := StripePriceIDs[plan]
	if !ok {
		return fmt.Errorf("unknown plan: %s", plan)
	}

	// Get current subscription
	sub, err := subscription.Get(subscriptionID, nil)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}

	// Update the subscription item
	params := &stripe.SubscriptionParams{
		Items: []*stripe.SubscriptionItemsParams{
			{
				ID:    stripe.String(sub.Items.Data[0].ID),
				Price: stripe.String(priceID),
			},
		},
		ProrationBehavior: stripe.String(string(stripe.SubscriptionProrationBehaviorCreateProrations)),
	}

	_, err = subscription.Update(subscriptionID, params)
	if err != nil {
		p.logger.Error("Failed to update subscription",
			zap.Error(err),
			zap.String("subscription_id", subscriptionID),
		)
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	p.logger.Info("Subscription updated",
		zap.String("subscription_id", subscriptionID),
		zap.String("new_plan", string(plan)),
	)

	return nil
}

// CancelSubscription cancels a subscription at period end
func (p *StripeProvider) CancelSubscription(ctx context.Context, subscriptionID string) error {
	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(true),
	}

	_, err := subscription.Update(subscriptionID, params)
	if err != nil {
		p.logger.Error("Failed to cancel subscription",
			zap.Error(err),
			zap.String("subscription_id", subscriptionID),
		)
		return fmt.Errorf("failed to cancel subscription: %w", err)
	}

	p.logger.Info("Subscription scheduled for cancellation",
		zap.String("subscription_id", subscriptionID),
	)

	return nil
}

// ReactivateSubscription reactivates a cancelled subscription
func (p *StripeProvider) ReactivateSubscription(ctx context.Context, subscriptionID string) error {
	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(false),
	}

	_, err := subscription.Update(subscriptionID, params)
	if err != nil {
		return fmt.Errorf("failed to reactivate subscription: %w", err)
	}

	p.logger.Info("Subscription reactivated", zap.String("subscription_id", subscriptionID))

	return nil
}

// GetSubscription retrieves subscription details
func (p *StripeProvider) GetSubscription(ctx context.Context, subscriptionID string) (*Subscription, error) {
	sub, err := subscription.Get(subscriptionID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}

	result := &Subscription{
		StripeSubscriptionID: sub.ID,
		Status:               string(sub.Status),
		CurrentPeriodStart:   time.Unix(sub.CurrentPeriodStart, 0),
		CurrentPeriodEnd:     time.Unix(sub.CurrentPeriodEnd, 0),
		CancelAtPeriodEnd:    sub.CancelAtPeriodEnd,
		CreatedAt:            time.Unix(sub.Created, 0),
	}

	if sub.TrialEnd > 0 {
		trialEnd := time.Unix(sub.TrialEnd, 0)
		result.TrialEnd = &trialEnd
	}

	// Extract plan from price
	if len(sub.Items.Data) > 0 {
		for plan, priceID := range StripePriceIDs {
			if sub.Items.Data[0].Price.ID == priceID {
				result.Plan = plan
				break
			}
		}
	}

	return result, nil
}

// GetUsage retrieves usage data (placeholder - would integrate with metering)
func (p *StripeProvider) GetUsage(ctx context.Context, customerID string) (*UsageRecord, error) {
	// In a real implementation, this would query usage meters
	return &UsageRecord{
		Period:     time.Now().Format("2006-01"),
		RecordedAt: time.Now(),
	}, nil
}

// CreateCheckoutSession creates a Stripe Checkout session
func (p *StripeProvider) CreateCheckoutSession(ctx context.Context, customerID string, plan PlanType) (string, error) {
	priceID, ok := StripePriceIDs[plan]
	if !ok {
		return "", fmt.Errorf("unknown plan: %s", plan)
	}

	params := &stripe.CheckoutSessionParams{
		Customer: stripe.String(customerID),
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(p.config.SuccessURL),
		CancelURL:  stripe.String(p.config.CancelURL),
	}

	sess, err := session.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create checkout session: %w", err)
	}

	return sess.URL, nil
}

// CreateBillingPortalSession creates a Stripe Billing Portal session
func (p *StripeProvider) CreateBillingPortalSession(ctx context.Context, customerID, returnURL string) (string, error) {
	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(customerID),
		ReturnURL: stripe.String(returnURL),
	}

	// Note: requires billing portal configuration in Stripe dashboard
	sess, err := stripe.BillingPortalSession.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create portal session: %w", err)
	}

	return sess.URL, nil
}

// GetPaymentMethods retrieves customer payment methods
func (p *StripeProvider) GetPaymentMethods(ctx context.Context, customerID string) ([]*PaymentMethod, error) {
	params := &stripe.PaymentMethodListParams{
		Customer: stripe.String(customerID),
		Type:     stripe.String("card"),
	}

	iter := paymentmethod.List(params)
	var methods []*PaymentMethod

	for iter.Next() {
		pm := iter.PaymentMethod()
		method := &PaymentMethod{
			ID:   pm.ID,
			Type: string(pm.Type),
		}

		if pm.Card != nil {
			method.Card = &Card{
				Brand:    string(pm.Card.Brand),
				Last4:    pm.Card.Last4,
				ExpMonth: pm.Card.ExpMonth,
				ExpYear:  pm.Card.ExpYear,
			}
		}

		methods = append(methods, method)
	}

	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("failed to list payment methods: %w", err)
	}

	return methods, nil
}

// GetInvoices retrieves customer invoices
func (p *StripeProvider) GetInvoices(ctx context.Context, customerID string, limit int) ([]*Invoice, error) {
	params := &stripe.InvoiceListParams{
		Customer: stripe.String(customerID),
	}
	params.Limit = stripe.Int64(int64(limit))

	iter := invoice.List(params)
	var invoices []*Invoice

	for iter.Next() {
		inv := iter.Invoice()
		result := &Invoice{
			StripeInvoiceID: inv.ID,
			Amount:          inv.AmountDue,
			Currency:        string(inv.Currency),
			Status:          string(inv.Status),
			InvoiceURL:      inv.HostedInvoiceURL,
			InvoicePDF:      inv.InvoicePDF,
			PeriodStart:     time.Unix(inv.PeriodStart, 0),
			PeriodEnd:       time.Unix(inv.PeriodEnd, 0),
			CreatedAt:       time.Unix(inv.Created, 0),
		}

		if inv.StatusTransitions != nil && inv.StatusTransitions.PaidAt > 0 {
			paidAt := time.Unix(inv.StatusTransitions.PaidAt, 0)
			result.PaidAt = &paidAt
		}

		invoices = append(invoices, result)
	}

	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("failed to list invoices: %w", err)
	}

	return invoices, nil
}

// WebhookEvent represents a parsed webhook event
type WebhookEvent struct {
	Type            string
	TenantID        string
	CustomerID      string
	SubscriptionID  string
	InvoiceID       string
	Amount          int64
	Currency        string
	Status          string
	Plan            PlanType
	RawData         json.RawMessage
}

// HandleWebhook processes Stripe webhook events
func (p *StripeProvider) HandleWebhook(r *http.Request) (*WebhookEvent, error) {
	payload := make([]byte, r.ContentLength)
	_, err := r.Body.Read(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to read webhook body: %w", err)
	}

	sig := r.Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sig, p.config.WebhookSecret)
	if err != nil {
		return nil, fmt.Errorf("invalid webhook signature: %w", err)
	}

	result := &WebhookEvent{
		Type:    string(event.Type),
		RawData: event.Data.Raw,
	}

	switch event.Type {
	case "customer.subscription.created",
		"customer.subscription.updated",
		"customer.subscription.deleted":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			return nil, err
		}
		result.CustomerID = sub.Customer.ID
		result.SubscriptionID = sub.ID
		result.Status = string(sub.Status)
		if sub.Metadata != nil {
			result.TenantID = sub.Metadata["tenant_id"]
		}

	case "invoice.paid", "invoice.payment_failed":
		var inv stripe.Invoice
		if err := json.Unmarshal(event.Data.Raw, &inv); err != nil {
			return nil, err
		}
		result.CustomerID = inv.Customer.ID
		result.InvoiceID = inv.ID
		result.Amount = inv.AmountPaid
		result.Currency = string(inv.Currency)
		result.Status = string(inv.Status)

	case "checkout.session.completed":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			return nil, err
		}
		result.CustomerID = sess.Customer.ID
		if sess.Subscription != nil {
			result.SubscriptionID = sess.Subscription.ID
		}
	}

	p.logger.Info("Webhook processed",
		zap.String("type", result.Type),
		zap.String("customer_id", result.CustomerID),
	)

	return result, nil
}

// BillingPortalSession is a placeholder for the billing portal session type
type BillingPortalSession struct {
	URL string
}

// Stripe BillingPortalSession placeholder
var stripe_billing_portal_session = struct {
	New func(*stripe.BillingPortalSessionParams) (*BillingPortalSession, error)
}{
	New: func(params *stripe.BillingPortalSessionParams) (*BillingPortalSession, error) {
		return nil, errors.New("billing portal not implemented in test")
	},
}

// Initialize the placeholder
func init() {
	stripe.BillingPortalSession = stripe_billing_portal_session
}
