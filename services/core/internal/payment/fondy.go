package payment

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

const fondyAPIURL = "https://pay.fondy.eu/api"

// FondyClient implements Fondy payment provider
type FondyClient struct {
	merchantID     string
	secretKey      string
	httpClient     *http.Client
	creditKey      string // For credit operations
}

// NewFondyClient creates Fondy client
func NewFondyClient(merchantID, secretKey string) *FondyClient {
	return &FondyClient{
		merchantID: merchantID,
		secretKey:  secretKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SetCreditKey sets credit key for payouts
func (c *FondyClient) SetCreditKey(key string) {
	c.creditKey = key
}

// Name returns provider name
func (c *FondyClient) Name() string { return "fondy" }

// CreatePayment creates Fondy payment
func (c *FondyClient) CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// Fondy uses kopiyky
	amountKopiyky := int(req.Amount * 100)

	params := map[string]interface{}{
		"merchant_id":       c.merchantID,
		"order_id":          req.OrderID,
		"order_desc":        req.Description,
		"amount":            amountKopiyky,
		"currency":          string(req.Currency),
	}

	if req.ReturnURL != "" {
		params["response_url"] = req.ReturnURL
	}
	if req.CallbackURL != "" {
		params["server_callback_url"] = req.CallbackURL
	}
	if req.CustomerEmail != "" {
		params["sender_email"] = req.CustomerEmail
	}
	if req.Language != "" {
		params["lang"] = req.Language
	}

	// Payment lifetime
	params["lifetime"] = 86400 // 24 hours

	// Preauth mode
	if req.Metadata != nil && req.Metadata["preauth"] == "true" {
		params["preauth"] = "Y"
	}

	// Recurring
	if req.Metadata != nil && req.Metadata["recurring"] == "true" {
		params["recurring_data"] = map[string]interface{}{
			"start_time":   time.Now().Format("2006-01-02"),
			"amount":       amountKopiyky,
			"every":        30, // days
			"period":       "day",
			"state":        "y",
		}
		params["required_rectoken"] = "Y"
	}

	// Subscription token
	if req.Metadata != nil && req.Metadata["rectoken"] != "" {
		params["rectoken"] = req.Metadata["rectoken"]
	}

	// Product data
	if len(req.Products) > 0 {
		products := make([]map[string]interface{}, len(req.Products))
		for i, p := range req.Products {
			products[i] = map[string]interface{}{
				"id":       i + 1,
				"name":     p.Name,
				"price":    int(p.Price * 100),
				"total_amount": int(p.Price * float64(p.Quantity) * 100),
				"quantity": fmt.Sprintf("%.2f", float64(p.Quantity)),
			}
		}
		productsJSON, _ := json.Marshal(products)
		params["product_data"] = string(productsJSON)
	}

	// Calculate signature
	params["signature"] = c.calculateSignature(params)

	// Make request
	requestBody := map[string]interface{}{
		"request": params,
	}

	data, _ := json.Marshal(requestBody)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", fondyAPIURL+"/checkout/url/", bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Response struct {
			CheckoutURL   string `json:"checkout_url"`
			PaymentID     string `json:"payment_id"`
			ResponseStatus string `json:"response_status"`
			ErrorCode     string `json:"error_code"`
			ErrorMessage  string `json:"error_message"`
		} `json:"response"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if result.Response.ResponseStatus != "success" {
		return nil, fmt.Errorf("fondy error: %s - %s", result.Response.ErrorCode, result.Response.ErrorMessage)
	}

	return &PaymentResponse{
		PaymentID:  result.Response.PaymentID,
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: result.Response.CheckoutURL,
		CreatedAt:  time.Now(),
	}, nil
}

// GetPayment gets payment status
func (c *FondyClient) GetPayment(ctx context.Context, orderID string) (*PaymentResponse, error) {
	params := map[string]interface{}{
		"merchant_id": c.merchantID,
		"order_id":    orderID,
	}

	params["signature"] = c.calculateSignature(params)

	requestBody := map[string]interface{}{
		"request": params,
	}

	data, _ := json.Marshal(requestBody)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", fondyAPIURL+"/status/order_id/", bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response map[string]interface{} `json:"response"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	response := &PaymentResponse{
		OrderID:   orderID,
		Status:    c.mapStatus(fmt.Sprintf("%v", result.Response["order_status"])),
		CreatedAt: time.Now(),
	}

	if paymentID, ok := result.Response["payment_id"].(string); ok {
		response.PaymentID = paymentID
	}
	if amount, ok := result.Response["actual_amount"].(float64); ok {
		response.Amount = amount / 100
	}
	if currency, ok := result.Response["currency"].(string); ok {
		response.Currency = Currency(currency)
	}
	if errCode, ok := result.Response["response_code"].(string); ok && errCode != "" {
		response.ErrorCode = errCode
	}
	if errDesc, ok := result.Response["response_description"].(string); ok {
		response.ErrorMessage = errDesc
	}

	return response, nil
}

// ProcessCallback processes Fondy callback
func (c *FondyClient) ProcessCallback(ctx context.Context, data []byte, signature string) (*PaymentCallback, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	// Verify signature
	if !c.VerifySignature(data, signature) {
		return nil, ErrCallbackInvalid
	}

	callback := &PaymentCallback{
		PaymentID: fmt.Sprintf("%v", payload["payment_id"]),
		OrderID:   fmt.Sprintf("%v", payload["order_id"]),
		Status:    c.mapStatus(fmt.Sprintf("%v", payload["order_status"])),
		RawData:   payload,
	}

	if amount, ok := payload["actual_amount"].(float64); ok {
		callback.Amount = amount / 100
	} else if amount, ok := payload["actual_amount"].(string); ok {
		fmt.Sscanf(amount, "%f", &callback.Amount)
		callback.Amount /= 100
	}

	if currency, ok := payload["currency"].(string); ok {
		callback.Currency = Currency(currency)
	}
	if cardMask, ok := payload["masked_card"].(string); ok {
		callback.CardMask = cardMask
	}
	if cardType, ok := payload["card_type"].(string); ok {
		callback.CardType = cardType
	}
	if txID, ok := payload["tran_id"].(string); ok {
		callback.TransactionID = txID
	}
	if errCode, ok := payload["response_code"].(string); ok {
		callback.ErrorCode = errCode
	}
	if errDesc, ok := payload["response_description"].(string); ok {
		callback.ErrorMessage = errDesc
	}

	return callback, nil
}

// Refund creates refund
func (c *FondyClient) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
	params := map[string]interface{}{
		"merchant_id": c.merchantID,
		"order_id":    req.PaymentID,
		"currency":    "UAH",
	}

	if req.Amount > 0 {
		params["amount"] = int(req.Amount * 100)
	}
	if req.Reason != "" {
		params["comment"] = req.Reason
	}

	params["signature"] = c.calculateSignature(params)

	requestBody := map[string]interface{}{
		"request": params,
	}

	data, _ := json.Marshal(requestBody)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", fondyAPIURL+"/reverse/order_id/", bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response map[string]interface{} `json:"response"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if result.Response["response_status"] != "success" {
		return nil, fmt.Errorf("refund failed: %v", result.Response["error_message"])
	}

	return &RefundResponse{
		RefundID:  fmt.Sprintf("%v", result.Response["reversal_id"]),
		PaymentID: req.PaymentID,
		Status:    StatusRefunded,
		CreatedAt: time.Now(),
	}, nil
}

// VerifySignature verifies callback signature
func (c *FondyClient) VerifySignature(data []byte, providedSig string) bool {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	calculatedSig := c.calculateSignature(payload)
	return calculatedSig == providedSig
}

// Capture captures preauthorized payment
func (c *FondyClient) Capture(ctx context.Context, orderID string, amount float64) error {
	params := map[string]interface{}{
		"merchant_id": c.merchantID,
		"order_id":    orderID,
		"amount":      int(amount * 100),
		"currency":    "UAH",
	}

	params["signature"] = c.calculateSignature(params)

	requestBody := map[string]interface{}{
		"request": params,
	}

	data, _ := json.Marshal(requestBody)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", fondyAPIURL+"/capture/order_id/", bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		Response map[string]interface{} `json:"response"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if result.Response["response_status"] != "success" {
		return fmt.Errorf("capture failed: %v", result.Response["error_message"])
	}

	return nil
}

// CreatePayout creates payout to card
func (c *FondyClient) CreatePayout(ctx context.Context, orderID string, amount float64, card string, receiverName string) error {
	params := map[string]interface{}{
		"merchant_id":     c.merchantID,
		"order_id":        orderID,
		"order_desc":      "Payout",
		"amount":          int(amount * 100),
		"currency":        "UAH",
		"receiver_card_number": card,
	}

	if receiverName != "" {
		params["receiver"] = map[string]interface{}{
			"requisites": map[string]interface{}{
				"last_name":  strings.Split(receiverName, " ")[0],
				"first_name": strings.Split(receiverName, " ")[1],
			},
		}
	}

	// Use credit key for signature
	params["signature"] = c.calculateSignatureWithKey(params, c.creditKey)

	requestBody := map[string]interface{}{
		"request": params,
	}

	data, _ := json.Marshal(requestBody)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", fondyAPIURL+"/p2pcredit/", bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		Response map[string]interface{} `json:"response"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if result.Response["response_status"] != "success" {
		return fmt.Errorf("payout failed: %v", result.Response["error_message"])
	}

	return nil
}

// CreateRecurringPayment creates payment with saved card token
func (c *FondyClient) CreateRecurringPayment(ctx context.Context, req *PaymentRequest, rectoken string) (*PaymentResponse, error) {
	params := map[string]interface{}{
		"merchant_id":  c.merchantID,
		"order_id":     req.OrderID,
		"order_desc":   req.Description,
		"amount":       int(req.Amount * 100),
		"currency":     string(req.Currency),
		"rectoken":     rectoken,
	}

	if req.CallbackURL != "" {
		params["server_callback_url"] = req.CallbackURL
	}

	params["signature"] = c.calculateSignature(params)

	requestBody := map[string]interface{}{
		"request": params,
	}

	data, _ := json.Marshal(requestBody)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", fondyAPIURL+"/recurring/", bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response map[string]interface{} `json:"response"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if result.Response["response_status"] != "success" {
		return nil, fmt.Errorf("recurring payment failed: %v", result.Response["error_message"])
	}

	return &PaymentResponse{
		PaymentID: fmt.Sprintf("%v", result.Response["payment_id"]),
		OrderID:   req.OrderID,
		Status:    c.mapStatus(fmt.Sprintf("%v", result.Response["order_status"])),
		Amount:    req.Amount,
		Currency:  req.Currency,
		CreatedAt: time.Now(),
	}, nil
}

// GetReports gets transaction reports
func (c *FondyClient) GetReports(ctx context.Context, dateFrom, dateTo time.Time) ([]map[string]interface{}, error) {
	params := map[string]interface{}{
		"merchant_id": c.merchantID,
		"date_from":   dateFrom.Format("02.01.2006"),
		"date_to":     dateTo.Format("02.01.2006"),
	}

	params["signature"] = c.calculateSignature(params)

	requestBody := map[string]interface{}{
		"request": params,
	}

	data, _ := json.Marshal(requestBody)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", fondyAPIURL+"/reports/", bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response []map[string]interface{} `json:"response"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return result.Response, nil
}

func (c *FondyClient) calculateSignature(params map[string]interface{}) string {
	return c.calculateSignatureWithKey(params, c.secretKey)
}

func (c *FondyClient) calculateSignatureWithKey(params map[string]interface{}, key string) string {
	// Sort keys
	keys := make([]string, 0, len(params))
	for k := range params {
		if k != "signature" && k != "response_signature_string" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	// Build string
	values := make([]string, 0, len(keys)+1)
	values = append(values, key)
	for _, k := range keys {
		val := fmt.Sprintf("%v", params[k])
		if val != "" {
			values = append(values, val)
		}
	}

	signStr := strings.Join(values, "|")
	hash := sha1.Sum([]byte(signStr))
	return hex.EncodeToString(hash[:])
}

func (c *FondyClient) mapStatus(status string) PaymentStatus {
	switch status {
	case "approved":
		return StatusSuccess
	case "declined", "expired":
		return StatusFailed
	case "reversed":
		return StatusRefunded
	case "processing", "created":
		return StatusProcessing
	default:
		return StatusPending
	}
}
