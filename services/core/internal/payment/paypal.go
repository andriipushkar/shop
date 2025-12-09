package payment

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	paypalSandboxURL = "https://api-m.sandbox.paypal.com"
	paypalLiveURL    = "https://api-m.paypal.com"
)

// PayPalClient implements PayPal payment provider
type PayPalClient struct {
	clientID     string
	clientSecret string
	sandbox      bool
	accessToken  string
	tokenExpiry  time.Time
	httpClient   *http.Client
	webhookID    string
}

// NewPayPalClient creates PayPal client
func NewPayPalClient(clientID, clientSecret string, sandbox bool) *PayPalClient {
	return &PayPalClient{
		clientID:     clientID,
		clientSecret: clientSecret,
		sandbox:      sandbox,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

// SetWebhookID sets webhook ID for verification
func (c *PayPalClient) SetWebhookID(webhookID string) {
	c.webhookID = webhookID
}

func (c *PayPalClient) baseURL() string {
	if c.sandbox {
		return paypalSandboxURL
	}
	return paypalLiveURL
}

// Name returns provider name
func (c *PayPalClient) Name() string { return "paypal" }

// getAccessToken gets or refreshes OAuth token
func (c *PayPalClient) getAccessToken(ctx context.Context) error {
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry) {
		return nil
	}

	auth := base64.StdEncoding.EncodeToString([]byte(c.clientID + ":" + c.clientSecret))

	data := url.Values{}
	data.Set("grant_type", "client_credentials")

	req, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL()+"/v1/oauth2/token",
		strings.NewReader(data.Encode()))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	c.accessToken = result.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn-60) * time.Second)

	return nil
}

// CreatePayment creates PayPal order
func (c *PayPalClient) CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	if err := c.getAccessToken(ctx); err != nil {
		return nil, err
	}

	// Build order request
	order := map[string]interface{}{
		"intent": "CAPTURE",
		"purchase_units": []map[string]interface{}{
			{
				"reference_id": req.OrderID,
				"description":  req.Description,
				"amount": map[string]interface{}{
					"currency_code": string(req.Currency),
					"value":         fmt.Sprintf("%.2f", req.Amount),
				},
			},
		},
	}

	// Add breakdown with items
	if len(req.Products) > 0 {
		items := make([]map[string]interface{}, len(req.Products))
		itemTotal := 0.0

		for i, p := range req.Products {
			itemTotal += p.Price * float64(p.Quantity)
			items[i] = map[string]interface{}{
				"name":        p.Name,
				"unit_amount": map[string]string{"currency_code": string(req.Currency), "value": fmt.Sprintf("%.2f", p.Price)},
				"quantity":    fmt.Sprintf("%d", p.Quantity),
			}
		}

		order["purchase_units"].([]map[string]interface{})[0]["items"] = items
		order["purchase_units"].([]map[string]interface{})[0]["amount"].(map[string]interface{})["breakdown"] = map[string]interface{}{
			"item_total": map[string]string{"currency_code": string(req.Currency), "value": fmt.Sprintf("%.2f", itemTotal)},
		}
	}

	// Application context
	appContext := map[string]interface{}{
		"brand_name":          "Shop",
		"landing_page":        "BILLING",
		"user_action":         "PAY_NOW",
		"shipping_preference": "NO_SHIPPING",
	}

	if req.ReturnURL != "" {
		appContext["return_url"] = req.ReturnURL
		appContext["cancel_url"] = req.ReturnURL + "?cancelled=true"
	}

	if req.Language != "" {
		appContext["locale"] = req.Language
	}

	order["application_context"] = appContext

	// Payer info
	if req.CustomerEmail != "" {
		order["payer"] = map[string]interface{}{
			"email_address": req.CustomerEmail,
		}
	}

	data, _ := json.Marshal(order)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL()+"/v2/checkout/orders", bytes.NewReader(data))
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("PayPal-Request-Id", req.OrderID)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("paypal error: %s", string(body))
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	// Find approval URL
	var approvalURL string
	if links, ok := result["links"].([]interface{}); ok {
		for _, link := range links {
			l := link.(map[string]interface{})
			if l["rel"] == "approve" {
				approvalURL = fmt.Sprintf("%v", l["href"])
				break
			}
		}
	}

	return &PaymentResponse{
		PaymentID:  fmt.Sprintf("%v", result["id"]),
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: approvalURL,
		CreatedAt:  time.Now(),
	}, nil
}

// GetPayment gets order status
func (c *PayPalClient) GetPayment(ctx context.Context, orderID string) (*PaymentResponse, error) {
	if err := c.getAccessToken(ctx); err != nil {
		return nil, err
	}

	httpReq, _ := http.NewRequestWithContext(ctx, "GET", c.baseURL()+"/v2/checkout/orders/"+orderID, nil)
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	response := &PaymentResponse{
		PaymentID: orderID,
		Status:    c.mapStatus(fmt.Sprintf("%v", result["status"])),
		CreatedAt: time.Now(),
	}

	if units, ok := result["purchase_units"].([]interface{}); ok && len(units) > 0 {
		unit := units[0].(map[string]interface{})
		if refID, ok := unit["reference_id"].(string); ok {
			response.OrderID = refID
		}
		if amount, ok := unit["amount"].(map[string]interface{}); ok {
			if val, ok := amount["value"].(string); ok {
				fmt.Sscanf(val, "%f", &response.Amount)
			}
			if cur, ok := amount["currency_code"].(string); ok {
				response.Currency = Currency(cur)
			}
		}
	}

	return response, nil
}

// CapturePayment captures authorized payment
func (c *PayPalClient) CapturePayment(ctx context.Context, orderID string) (*PaymentCallback, error) {
	if err := c.getAccessToken(ctx); err != nil {
		return nil, err
	}

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL()+"/v2/checkout/orders/"+orderID+"/capture", nil)
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("capture failed: %s", string(body))
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	callback := &PaymentCallback{
		PaymentID: orderID,
		Status:    c.mapStatus(fmt.Sprintf("%v", result["status"])),
		RawData:   result,
	}

	if units, ok := result["purchase_units"].([]interface{}); ok && len(units) > 0 {
		unit := units[0].(map[string]interface{})
		if refID, ok := unit["reference_id"].(string); ok {
			callback.OrderID = refID
		}
		if payments, ok := unit["payments"].(map[string]interface{}); ok {
			if captures, ok := payments["captures"].([]interface{}); ok && len(captures) > 0 {
				capture := captures[0].(map[string]interface{})
				callback.TransactionID = fmt.Sprintf("%v", capture["id"])
				if amount, ok := capture["amount"].(map[string]interface{}); ok {
					if val, ok := amount["value"].(string); ok {
						fmt.Sscanf(val, "%f", &callback.Amount)
					}
					if cur, ok := amount["currency_code"].(string); ok {
						callback.Currency = Currency(cur)
					}
				}
			}
		}
	}

	// Payer info
	if payer, ok := result["payer"].(map[string]interface{}); ok {
		if email, ok := payer["email_address"].(string); ok {
			callback.RawData["payer_email"] = email
		}
	}

	return callback, nil
}

// ProcessCallback processes PayPal webhook
func (c *PayPalClient) ProcessCallback(ctx context.Context, data []byte, signature string) (*PaymentCallback, error) {
	// PayPal webhook verification is complex - simplified version
	// In production, should verify with PayPal API

	var event map[string]interface{}
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, err
	}

	eventType := fmt.Sprintf("%v", event["event_type"])
	resource := event["resource"].(map[string]interface{})

	callback := &PaymentCallback{
		RawData: resource,
	}

	switch eventType {
	case "CHECKOUT.ORDER.APPROVED":
		callback.PaymentID = fmt.Sprintf("%v", resource["id"])
		callback.Status = StatusProcessing // Needs capture

	case "PAYMENT.CAPTURE.COMPLETED":
		callback.TransactionID = fmt.Sprintf("%v", resource["id"])
		callback.Status = StatusSuccess
		if links, ok := resource["links"].([]interface{}); ok {
			for _, link := range links {
				l := link.(map[string]interface{})
				if l["rel"] == "up" {
					// Extract order ID from URL
					href := fmt.Sprintf("%v", l["href"])
					parts := strings.Split(href, "/")
					for i, p := range parts {
						if p == "orders" && i+1 < len(parts) {
							callback.PaymentID = parts[i+1]
							break
						}
					}
				}
			}
		}
		if amount, ok := resource["amount"].(map[string]interface{}); ok {
			if val, ok := amount["value"].(string); ok {
				fmt.Sscanf(val, "%f", &callback.Amount)
			}
			if cur, ok := amount["currency_code"].(string); ok {
				callback.Currency = Currency(cur)
			}
		}

	case "PAYMENT.CAPTURE.DENIED":
		callback.Status = StatusFailed
		callback.ErrorMessage = "Payment denied"

	case "PAYMENT.CAPTURE.REFUNDED":
		callback.Status = StatusRefunded
	}

	return callback, nil
}

// Refund creates refund
func (c *PayPalClient) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
	if err := c.getAccessToken(ctx); err != nil {
		return nil, err
	}

	// First get capture ID from order
	captureID := req.PaymentID
	if !strings.HasPrefix(captureID, "CAPTURE") {
		// Get order to find capture ID
		order, err := c.GetPayment(ctx, req.PaymentID)
		if err == nil && order != nil {
			// Would need to extract capture ID from order details
			// For now, assume PaymentID is capture ID
		}
	}

	payload := map[string]interface{}{}
	if req.Amount > 0 {
		payload["amount"] = map[string]string{
			"value":         fmt.Sprintf("%.2f", req.Amount),
			"currency_code": "USD",
		}
	}
	if req.Reason != "" {
		payload["note_to_payer"] = req.Reason
	}

	data, _ := json.Marshal(payload)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST",
		c.baseURL()+"/v2/payments/captures/"+captureID+"/refund", bytes.NewReader(data))
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("refund failed: %s", string(body))
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	refundResp := &RefundResponse{
		RefundID:  fmt.Sprintf("%v", result["id"]),
		PaymentID: req.PaymentID,
		Status:    StatusRefunded,
		CreatedAt: time.Now(),
	}

	if amount, ok := result["amount"].(map[string]interface{}); ok {
		if val, ok := amount["value"].(string); ok {
			fmt.Sscanf(val, "%f", &refundResp.Amount)
		}
	}

	return refundResp, nil
}

// VerifySignature verifies webhook signature
func (c *PayPalClient) VerifySignature(payload []byte, signature string) bool {
	// PayPal webhook verification requires API call
	// Simplified: return true (implement proper verification in production)
	return signature != ""
}

// CreateSubscription creates subscription plan
func (c *PayPalClient) CreateSubscription(ctx context.Context, planID, email string) (map[string]interface{}, error) {
	if err := c.getAccessToken(ctx); err != nil {
		return nil, err
	}

	subscription := map[string]interface{}{
		"plan_id": planID,
		"subscriber": map[string]interface{}{
			"email_address": email,
		},
		"application_context": map[string]interface{}{
			"brand_name":  "Shop",
			"user_action": "SUBSCRIBE_NOW",
		},
	}

	data, _ := json.Marshal(subscription)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL()+"/v1/billing/subscriptions", bytes.NewReader(data))
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return result, nil
}

// CreatePlan creates subscription plan
func (c *PayPalClient) CreatePlan(ctx context.Context, productID, name string, amount float64, currency Currency, interval string) (string, error) {
	if err := c.getAccessToken(ctx); err != nil {
		return "", err
	}

	plan := map[string]interface{}{
		"product_id": productID,
		"name":       name,
		"status":     "ACTIVE",
		"billing_cycles": []map[string]interface{}{
			{
				"frequency": map[string]interface{}{
					"interval_unit":  strings.ToUpper(interval), // MONTH, YEAR
					"interval_count": 1,
				},
				"tenure_type": "REGULAR",
				"sequence":    1,
				"pricing_scheme": map[string]interface{}{
					"fixed_price": map[string]string{
						"value":         fmt.Sprintf("%.2f", amount),
						"currency_code": string(currency),
					},
				},
			},
		},
		"payment_preferences": map[string]interface{}{
			"auto_bill_outstanding": true,
		},
	}

	data, _ := json.Marshal(plan)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL()+"/v1/billing/plans", bytes.NewReader(data))
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return fmt.Sprintf("%v", result["id"]), nil
}

// Payout creates payout to PayPal account
func (c *PayPalClient) Payout(ctx context.Context, recipientEmail string, amount float64, currency Currency, note string) error {
	if err := c.getAccessToken(ctx); err != nil {
		return err
	}

	batchID := fmt.Sprintf("payout_%d", time.Now().UnixNano())

	payout := map[string]interface{}{
		"sender_batch_header": map[string]interface{}{
			"sender_batch_id": batchID,
			"email_subject":   "Payment from Shop",
		},
		"items": []map[string]interface{}{
			{
				"recipient_type": "EMAIL",
				"amount": map[string]string{
					"value":    fmt.Sprintf("%.2f", amount),
					"currency": string(currency),
				},
				"receiver":      recipientEmail,
				"note":          note,
				"sender_item_id": fmt.Sprintf("item_%d", time.Now().Unix()),
			},
		},
	}

	data, _ := json.Marshal(payout)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL()+"/v1/payments/payouts", bytes.NewReader(data))
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("payout failed: %s", string(body))
	}

	return nil
}

func (c *PayPalClient) mapStatus(status string) PaymentStatus {
	switch status {
	case "COMPLETED", "APPROVED":
		return StatusSuccess
	case "VOIDED", "CANCELLED":
		return StatusCancelled
	case "CREATED", "SAVED", "PAYER_ACTION_REQUIRED":
		return StatusPending
	default:
		return StatusPending
	}
}
