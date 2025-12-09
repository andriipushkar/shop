package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const stripeAPIURL = "https://api.stripe.com/v1"

// StripeClient implements Stripe payment provider
type StripeClient struct {
	secretKey      string
	publishableKey string
	webhookSecret  string
	httpClient     *http.Client
}

// NewStripeClient creates Stripe client
func NewStripeClient(secretKey, publishableKey string) *StripeClient {
	return &StripeClient{
		secretKey:      secretKey,
		publishableKey: publishableKey,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

// SetWebhookSecret sets webhook secret for signature verification
func (c *StripeClient) SetWebhookSecret(secret string) {
	c.webhookSecret = secret
}

// Name returns provider name
func (c *StripeClient) Name() string { return "stripe" }

// CreatePayment creates Stripe Checkout Session
func (c *StripeClient) CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// Stripe uses smallest currency unit (cents)
	amountCents := int64(req.Amount * 100)

	params := url.Values{}
	params.Set("mode", "payment")
	params.Set("payment_method_types[0]", "card")
	params.Set("line_items[0][price_data][currency]", strings.ToLower(string(req.Currency)))
	params.Set("line_items[0][price_data][product_data][name]", req.Description)
	params.Set("line_items[0][price_data][unit_amount]", fmt.Sprintf("%d", amountCents))
	params.Set("line_items[0][quantity]", "1")
	params.Set("client_reference_id", req.OrderID)

	// Multiple line items
	if len(req.Products) > 0 {
		params.Del("line_items[0][price_data][product_data][name]")
		params.Del("line_items[0][price_data][unit_amount]")
		params.Del("line_items[0][quantity]")

		for i, p := range req.Products {
			prefix := fmt.Sprintf("line_items[%d]", i)
			params.Set(prefix+"[price_data][currency]", strings.ToLower(string(req.Currency)))
			params.Set(prefix+"[price_data][product_data][name]", p.Name)
			params.Set(prefix+"[price_data][unit_amount]", fmt.Sprintf("%d", int64(p.Price*100)))
			params.Set(prefix+"[quantity]", fmt.Sprintf("%d", p.Quantity))
		}
	}

	if req.ReturnURL != "" {
		params.Set("success_url", req.ReturnURL+"?session_id={CHECKOUT_SESSION_ID}")
		params.Set("cancel_url", req.ReturnURL+"?cancelled=true")
	}

	if req.CustomerEmail != "" {
		params.Set("customer_email", req.CustomerEmail)
	}

	if req.Language != "" {
		params.Set("locale", req.Language)
	}

	// Metadata
	params.Set("metadata[order_id]", req.OrderID)
	for k, v := range req.Metadata {
		params.Set("metadata["+k+"]", v)
	}

	// Expire after 24 hours
	params.Set("expires_at", fmt.Sprintf("%d", time.Now().Add(24*time.Hour).Unix()))

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", stripeAPIURL+"/checkout/sessions",
		strings.NewReader(params.Encode()))
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if errObj, ok := result["error"].(map[string]interface{}); ok {
		return nil, fmt.Errorf("stripe error: %v", errObj["message"])
	}

	return &PaymentResponse{
		PaymentID:  fmt.Sprintf("%v", result["id"]),
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: fmt.Sprintf("%v", result["url"]),
		CreatedAt:  time.Now(),
	}, nil
}

// CreatePaymentIntent creates Payment Intent for custom integration
func (c *StripeClient) CreatePaymentIntent(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	amountCents := int64(req.Amount * 100)

	params := url.Values{}
	params.Set("amount", fmt.Sprintf("%d", amountCents))
	params.Set("currency", strings.ToLower(string(req.Currency)))
	params.Set("payment_method_types[0]", "card")
	params.Set("description", req.Description)
	params.Set("metadata[order_id]", req.OrderID)

	if req.CustomerEmail != "" {
		// Create or get customer
		customerID, _ := c.getOrCreateCustomer(ctx, req.CustomerEmail, req.CustomerName)
		if customerID != "" {
			params.Set("customer", customerID)
		}
	}

	// For 3D Secure
	params.Set("confirm", "false")

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", stripeAPIURL+"/payment_intents",
		strings.NewReader(params.Encode()))
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if errObj, ok := result["error"].(map[string]interface{}); ok {
		return nil, fmt.Errorf("stripe error: %v", errObj["message"])
	}

	response := &PaymentResponse{
		PaymentID: fmt.Sprintf("%v", result["id"]),
		OrderID:   req.OrderID,
		Status:    c.mapStatus(fmt.Sprintf("%v", result["status"])),
		Amount:    req.Amount,
		Currency:  req.Currency,
		CreatedAt: time.Now(),
	}

	// Client secret for frontend
	if clientSecret, ok := result["client_secret"].(string); ok {
		response.Metadata = map[string]string{"client_secret": clientSecret}
	}

	return response, nil
}

// GetPayment gets payment/session status
func (c *StripeClient) GetPayment(ctx context.Context, sessionID string) (*PaymentResponse, error) {
	endpoint := "/checkout/sessions/" + sessionID
	if strings.HasPrefix(sessionID, "pi_") {
		endpoint = "/payment_intents/" + sessionID
	}

	httpReq, _ := http.NewRequestWithContext(ctx, "GET", stripeAPIURL+endpoint, nil)
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	response := &PaymentResponse{
		PaymentID: sessionID,
		CreatedAt: time.Now(),
	}

	// Handle checkout session
	if strings.HasPrefix(sessionID, "cs_") {
		response.Status = c.mapSessionStatus(fmt.Sprintf("%v", result["payment_status"]))
		if metadata, ok := result["metadata"].(map[string]interface{}); ok {
			if orderID, ok := metadata["order_id"].(string); ok {
				response.OrderID = orderID
			}
		}
		if amountTotal, ok := result["amount_total"].(float64); ok {
			response.Amount = amountTotal / 100
		}
	} else {
		// Handle payment intent
		response.Status = c.mapStatus(fmt.Sprintf("%v", result["status"]))
		if amount, ok := result["amount"].(float64); ok {
			response.Amount = amount / 100
		}
	}

	if currency, ok := result["currency"].(string); ok {
		response.Currency = Currency(strings.ToUpper(currency))
	}

	return response, nil
}

// ProcessCallback processes Stripe webhook
func (c *StripeClient) ProcessCallback(ctx context.Context, data []byte, signature string) (*PaymentCallback, error) {
	// Verify signature
	if !c.VerifySignature(data, signature) {
		return nil, ErrCallbackInvalid
	}

	var event map[string]interface{}
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, err
	}

	eventType := fmt.Sprintf("%v", event["type"])
	eventData := event["data"].(map[string]interface{})["object"].(map[string]interface{})

	callback := &PaymentCallback{
		RawData: eventData,
	}

	switch eventType {
	case "checkout.session.completed":
		callback.PaymentID = fmt.Sprintf("%v", eventData["id"])
		callback.Status = StatusSuccess
		if metadata, ok := eventData["metadata"].(map[string]interface{}); ok {
			callback.OrderID = fmt.Sprintf("%v", metadata["order_id"])
		}
		if amountTotal, ok := eventData["amount_total"].(float64); ok {
			callback.Amount = amountTotal / 100
		}

	case "payment_intent.succeeded":
		callback.PaymentID = fmt.Sprintf("%v", eventData["id"])
		callback.Status = StatusSuccess
		if amount, ok := eventData["amount"].(float64); ok {
			callback.Amount = amount / 100
		}
		if metadata, ok := eventData["metadata"].(map[string]interface{}); ok {
			callback.OrderID = fmt.Sprintf("%v", metadata["order_id"])
		}

	case "payment_intent.payment_failed":
		callback.PaymentID = fmt.Sprintf("%v", eventData["id"])
		callback.Status = StatusFailed
		if lastError, ok := eventData["last_payment_error"].(map[string]interface{}); ok {
			callback.ErrorMessage = fmt.Sprintf("%v", lastError["message"])
		}

	case "charge.refunded":
		callback.PaymentID = fmt.Sprintf("%v", eventData["payment_intent"])
		callback.Status = StatusRefunded
	}

	if currency, ok := eventData["currency"].(string); ok {
		callback.Currency = Currency(strings.ToUpper(currency))
	}

	return callback, nil
}

// Refund creates refund
func (c *StripeClient) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
	params := url.Values{}

	// Payment intent or charge
	if strings.HasPrefix(req.PaymentID, "pi_") {
		params.Set("payment_intent", req.PaymentID)
	} else {
		params.Set("charge", req.PaymentID)
	}

	if req.Amount > 0 {
		params.Set("amount", fmt.Sprintf("%d", int64(req.Amount*100)))
	}
	if req.Reason != "" {
		params.Set("reason", req.Reason)
	}

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", stripeAPIURL+"/refunds",
		strings.NewReader(params.Encode()))
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if errObj, ok := result["error"].(map[string]interface{}); ok {
		return nil, fmt.Errorf("refund failed: %v", errObj["message"])
	}

	refundResp := &RefundResponse{
		RefundID:  fmt.Sprintf("%v", result["id"]),
		PaymentID: req.PaymentID,
		Status:    StatusRefunded,
		CreatedAt: time.Now(),
	}

	if amount, ok := result["amount"].(float64); ok {
		refundResp.Amount = amount / 100
	}

	return refundResp, nil
}

// VerifySignature verifies webhook signature
func (c *StripeClient) VerifySignature(payload []byte, header string) bool {
	if c.webhookSecret == "" {
		return true
	}

	// Parse header
	parts := strings.Split(header, ",")
	var timestamp, signature string
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signature = kv[1]
		}
	}

	if timestamp == "" || signature == "" {
		return false
	}

	// Calculate expected signature
	signedPayload := timestamp + "." + string(payload)
	h := hmac.New(sha256.New, []byte(c.webhookSecret))
	h.Write([]byte(signedPayload))
	expected := hex.EncodeToString(h.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(signature))
}

// CreateCustomer creates Stripe customer
func (c *StripeClient) CreateCustomer(ctx context.Context, email, name, phone string) (string, error) {
	params := url.Values{}
	params.Set("email", email)
	if name != "" {
		params.Set("name", name)
	}
	if phone != "" {
		params.Set("phone", phone)
	}

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", stripeAPIURL+"/customers",
		strings.NewReader(params.Encode()))
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return fmt.Sprintf("%v", result["id"]), nil
}

func (c *StripeClient) getOrCreateCustomer(ctx context.Context, email, name string) (string, error) {
	// Search for existing customer
	params := url.Values{}
	params.Set("query", "email:'"+email+"'")

	httpReq, _ := http.NewRequestWithContext(ctx, "GET", stripeAPIURL+"/customers/search?"+params.Encode(), nil)
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if data, ok := result["data"].([]interface{}); ok && len(data) > 0 {
		customer := data[0].(map[string]interface{})
		return fmt.Sprintf("%v", customer["id"]), nil
	}

	// Create new customer
	return c.CreateCustomer(ctx, email, name, "")
}

// CreateSubscription creates subscription
func (c *StripeClient) CreateSubscription(ctx context.Context, customerID, priceID string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("customer", customerID)
	params.Set("items[0][price]", priceID)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", stripeAPIURL+"/subscriptions",
		strings.NewReader(params.Encode()))
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return result, nil
}

// GetBalance gets account balance
func (c *StripeClient) GetBalance(ctx context.Context) (map[string]interface{}, error) {
	httpReq, _ := http.NewRequestWithContext(ctx, "GET", stripeAPIURL+"/balance", nil)
	httpReq.SetBasicAuth(c.secretKey, "")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return result, nil
}

func (c *StripeClient) mapStatus(status string) PaymentStatus {
	switch status {
	case "succeeded":
		return StatusSuccess
	case "canceled":
		return StatusCancelled
	case "requires_payment_method", "requires_confirmation", "requires_action", "processing":
		return StatusProcessing
	default:
		return StatusPending
	}
}

func (c *StripeClient) mapSessionStatus(status string) PaymentStatus {
	switch status {
	case "paid":
		return StatusSuccess
	case "unpaid":
		return StatusPending
	case "no_payment_required":
		return StatusSuccess
	default:
		return StatusPending
	}
}
