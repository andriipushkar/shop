package payment

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const liqpayAPIURL = "https://www.liqpay.ua/api"

// LiqPayClient implements LiqPay payment provider (ПриватБанк)
type LiqPayClient struct {
	publicKey  string
	privateKey string
	httpClient *http.Client
	sandbox    bool
}

// NewLiqPayClient creates LiqPay client
func NewLiqPayClient(publicKey, privateKey string, sandbox bool) *LiqPayClient {
	return &LiqPayClient{
		publicKey:  publicKey,
		privateKey: privateKey,
		sandbox:    sandbox,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *LiqPayClient) Name() string { return "liqpay" }

// CreatePayment creates LiqPay payment
func (c *LiqPayClient) CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	action := "pay"
	if req.InstalmentParts > 0 {
		action = "payparts" // Оплата частинами
	}

	params := map[string]interface{}{
		"version":     "3",
		"public_key":  c.publicKey,
		"action":      action,
		"amount":      req.Amount,
		"currency":    string(req.Currency),
		"description": req.Description,
		"order_id":    req.OrderID,
	}

	if c.sandbox {
		params["sandbox"] = "1"
	}

	if req.ReturnURL != "" {
		params["result_url"] = req.ReturnURL
	}
	if req.CallbackURL != "" {
		params["server_url"] = req.CallbackURL
	}
	if req.CustomerEmail != "" {
		params["sender_email"] = req.CustomerEmail
	}
	if req.CustomerPhone != "" {
		params["sender_phone"] = req.CustomerPhone
	}
	if req.Language != "" {
		params["language"] = req.Language
	}

	// Instalment params
	if req.InstalmentParts > 0 {
		params["paytype"] = "privatparts"
		params["payparts_count"] = req.InstalmentParts
	}

	// Products for receipt
	if len(req.Products) > 0 {
		products := make([]map[string]interface{}, len(req.Products))
		for i, p := range req.Products {
			products[i] = map[string]interface{}{
				"name":   p.Name,
				"price":  p.Price,
				"count":  p.Quantity,
			}
		}
		params["goods"] = products
	}

	data, signature := c.encodeParams(params)

	// Generate checkout form HTML
	checkoutHTML := fmt.Sprintf(`
<form method="POST" action="https://www.liqpay.ua/api/3/checkout" accept-charset="utf-8">
    <input type="hidden" name="data" value="%s" />
    <input type="hidden" name="signature" value="%s" />
    <button type="submit">Оплатити через LiqPay</button>
</form>`, data, signature)

	paymentURL := fmt.Sprintf("https://www.liqpay.ua/api/3/checkout?data=%s&signature=%s",
		url.QueryEscape(data), url.QueryEscape(signature))

	return &PaymentResponse{
		PaymentID:    req.OrderID,
		OrderID:      req.OrderID,
		Status:       StatusPending,
		Amount:       req.Amount,
		Currency:     req.Currency,
		PaymentURL:   paymentURL,
		CheckoutHTML: checkoutHTML,
		CreatedAt:    time.Now(),
	}, nil
}

// GetPayment gets payment status
func (c *LiqPayClient) GetPayment(ctx context.Context, orderID string) (*PaymentResponse, error) {
	params := map[string]interface{}{
		"version":    "3",
		"public_key": c.publicKey,
		"action":     "status",
		"order_id":   orderID,
	}

	data, signature := c.encodeParams(params)

	form := url.Values{}
	form.Set("data", data)
	form.Set("signature", signature)

	req, _ := http.NewRequestWithContext(ctx, "POST", liqpayAPIURL+"/request",
		bytes.NewBufferString(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	status := c.mapStatus(fmt.Sprintf("%v", result["status"]))

	response := &PaymentResponse{
		PaymentID: fmt.Sprintf("%v", result["payment_id"]),
		OrderID:   orderID,
		Status:    status,
		CreatedAt: time.Now(),
	}

	if amount, ok := result["amount"].(float64); ok {
		response.Amount = amount
	}
	if currency, ok := result["currency"].(string); ok {
		response.Currency = Currency(currency)
	}
	if errCode, ok := result["err_code"].(string); ok {
		response.ErrorCode = errCode
	}
	if errDesc, ok := result["err_description"].(string); ok {
		response.ErrorMessage = errDesc
	}

	return response, nil
}

// ProcessCallback processes LiqPay callback
func (c *LiqPayClient) ProcessCallback(ctx context.Context, rawData []byte, signature string) (*PaymentCallback, error) {
	// Decode base64 data
	decoded, err := base64.StdEncoding.DecodeString(string(rawData))
	if err != nil {
		return nil, err
	}

	// Verify signature
	if !c.VerifySignature(rawData, signature) {
		return nil, ErrCallbackInvalid
	}

	var data map[string]interface{}
	if err := json.Unmarshal(decoded, &data); err != nil {
		return nil, err
	}

	callback := &PaymentCallback{
		PaymentID: fmt.Sprintf("%v", data["payment_id"]),
		OrderID:   fmt.Sprintf("%v", data["order_id"]),
		Status:    c.mapStatus(fmt.Sprintf("%v", data["status"])),
		RawData:   data,
	}

	if amount, ok := data["amount"].(float64); ok {
		callback.Amount = amount
	}
	if currency, ok := data["currency"].(string); ok {
		callback.Currency = Currency(currency)
	}
	if commission, ok := data["sender_commission"].(float64); ok {
		callback.Commission = commission
	}
	if txID, ok := data["transaction_id"].(float64); ok {
		callback.TransactionID = fmt.Sprintf("%.0f", txID)
	}
	if cardMask, ok := data["sender_card_mask2"].(string); ok {
		callback.CardMask = cardMask
	}
	if cardType, ok := data["sender_card_type"].(string); ok {
		callback.CardType = cardType
	}
	if cardBank, ok := data["sender_card_bank"].(string); ok {
		callback.CardBank = cardBank
	}
	if errCode, ok := data["err_code"].(string); ok {
		callback.ErrorCode = errCode
	}
	if errDesc, ok := data["err_description"].(string); ok {
		callback.ErrorMessage = errDesc
	}

	return callback, nil
}

// Refund creates refund
func (c *LiqPayClient) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
	params := map[string]interface{}{
		"version":    "3",
		"public_key": c.publicKey,
		"action":     "refund",
		"order_id":   req.PaymentID,
	}

	if req.Amount > 0 {
		params["amount"] = req.Amount
	}

	data, signature := c.encodeParams(params)

	form := url.Values{}
	form.Set("data", data)
	form.Set("signature", signature)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", liqpayAPIURL+"/request",
		bytes.NewBufferString(form.Encode()))
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	status := c.mapStatus(fmt.Sprintf("%v", result["status"]))
	if status != StatusSuccess && status != StatusRefunded {
		return nil, fmt.Errorf("refund failed: %v", result["err_description"])
	}

	refundResp := &RefundResponse{
		RefundID:  fmt.Sprintf("%v", result["refund_id"]),
		PaymentID: req.PaymentID,
		Status:    StatusRefunded,
		CreatedAt: time.Now(),
	}

	if amount, ok := result["amount"].(float64); ok {
		refundResp.Amount = amount
	}

	return refundResp, nil
}

// VerifySignature verifies callback signature
func (c *LiqPayClient) VerifySignature(data []byte, signature string) bool {
	expectedSig := c.generateSignature(string(data))
	return expectedSig == signature
}

func (c *LiqPayClient) encodeParams(params map[string]interface{}) (string, string) {
	jsonData, _ := json.Marshal(params)
	data := base64.StdEncoding.EncodeToString(jsonData)
	signature := c.generateSignature(data)
	return data, signature
}

func (c *LiqPayClient) generateSignature(data string) string {
	signStr := c.privateKey + data + c.privateKey
	hash := sha1.Sum([]byte(signStr))
	return base64.StdEncoding.EncodeToString(hash[:])
}

func (c *LiqPayClient) mapStatus(status string) PaymentStatus {
	switch status {
	case "success":
		return StatusSuccess
	case "failure", "error":
		return StatusFailed
	case "reversed", "refund":
		return StatusRefunded
	case "sandbox", "processing", "prepared", "wait_accept", "wait_secure":
		return StatusProcessing
	default:
		return StatusPending
	}
}

// CreateSubscription creates recurring payment subscription
func (c *LiqPayClient) CreateSubscription(ctx context.Context, req *PaymentRequest, periodicity string) (*PaymentResponse, error) {
	params := map[string]interface{}{
		"version":          "3",
		"public_key":       c.publicKey,
		"action":           "subscribe",
		"amount":           req.Amount,
		"currency":         string(req.Currency),
		"description":      req.Description,
		"order_id":         req.OrderID,
		"subscribe":        "1",
		"subscribe_date_start": time.Now().Format("2006-01-02 15:04:05"),
		"subscribe_periodicity": periodicity, // month, year
	}

	if req.ReturnURL != "" {
		params["result_url"] = req.ReturnURL
	}
	if req.CallbackURL != "" {
		params["server_url"] = req.CallbackURL
	}

	data, signature := c.encodeParams(params)

	paymentURL := fmt.Sprintf("https://www.liqpay.ua/api/3/checkout?data=%s&signature=%s",
		url.QueryEscape(data), url.QueryEscape(signature))

	return &PaymentResponse{
		PaymentID:  req.OrderID,
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: paymentURL,
		CreatedAt:  time.Now(),
	}, nil
}

// Hold creates hold payment (preauthorization)
func (c *LiqPayClient) Hold(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	params := map[string]interface{}{
		"version":     "3",
		"public_key":  c.publicKey,
		"action":      "hold",
		"amount":      req.Amount,
		"currency":    string(req.Currency),
		"description": req.Description,
		"order_id":    req.OrderID,
	}

	if req.ReturnURL != "" {
		params["result_url"] = req.ReturnURL
	}
	if req.CallbackURL != "" {
		params["server_url"] = req.CallbackURL
	}

	data, signature := c.encodeParams(params)

	paymentURL := fmt.Sprintf("https://www.liqpay.ua/api/3/checkout?data=%s&signature=%s",
		url.QueryEscape(data), url.QueryEscape(signature))

	return &PaymentResponse{
		PaymentID:  req.OrderID,
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: paymentURL,
		CreatedAt:  time.Now(),
	}, nil
}

// ConfirmHold confirms hold payment
func (c *LiqPayClient) ConfirmHold(ctx context.Context, orderID string, amount float64) error {
	params := map[string]interface{}{
		"version":    "3",
		"public_key": c.publicKey,
		"action":     "hold_completion",
		"order_id":   orderID,
		"amount":     amount,
	}

	data, signature := c.encodeParams(params)

	form := url.Values{}
	form.Set("data", data)
	form.Set("signature", signature)

	req, _ := http.NewRequestWithContext(ctx, "POST", liqpayAPIURL+"/request",
		bytes.NewBufferString(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["status"] != "success" {
		return fmt.Errorf("hold confirmation failed: %v", result["err_description"])
	}

	return nil
}

// InvoiceSend sends invoice to customer
func (c *LiqPayClient) InvoiceSend(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	params := map[string]interface{}{
		"version":     "3",
		"public_key":  c.publicKey,
		"action":      "invoice_send",
		"amount":      req.Amount,
		"currency":    string(req.Currency),
		"description": req.Description,
		"order_id":    req.OrderID,
		"email":       req.CustomerEmail,
	}

	if req.CallbackURL != "" {
		params["server_url"] = req.CallbackURL
	}

	// Products for invoice
	if len(req.Products) > 0 {
		products := make([]map[string]interface{}, len(req.Products))
		for i, p := range req.Products {
			products[i] = map[string]interface{}{
				"name":   p.Name,
				"price":  p.Price,
				"count":  p.Quantity,
			}
		}
		params["goods"] = products
	}

	data, signature := c.encodeParams(params)

	form := url.Values{}
	form.Set("data", data)
	form.Set("signature", signature)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", liqpayAPIURL+"/request",
		bytes.NewBufferString(form.Encode()))
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return &PaymentResponse{
		PaymentID: fmt.Sprintf("%v", result["invoice_id"]),
		OrderID:   req.OrderID,
		Status:    StatusPending,
		Amount:    req.Amount,
		Currency:  req.Currency,
		CreatedAt: time.Now(),
	}, nil
}
