package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const wayforpayAPIURL = "https://api.wayforpay.com/api"

// WayForPayClient implements WayForPay payment provider
type WayForPayClient struct {
	merchantAccount string
	merchantDomain  string
	secretKey       string
	httpClient      *http.Client
}

// NewWayForPayClient creates WayForPay client
func NewWayForPayClient(merchantAccount, merchantDomain, secretKey string) *WayForPayClient {
	return &WayForPayClient{
		merchantAccount: merchantAccount,
		merchantDomain:  merchantDomain,
		secretKey:       secretKey,
		httpClient:      &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *WayForPayClient) Name() string { return "wayforpay" }

// CreatePayment creates WayForPay payment
func (c *WayForPayClient) CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// WayForPay uses kopiyky
	amountKopiyky := int(req.Amount * 100)
	orderDate := time.Now().Unix()

	// Prepare products
	productNames := make([]string, 0)
	productCounts := make([]int, 0)
	productPrices := make([]int, 0)

	if len(req.Products) > 0 {
		for _, p := range req.Products {
			productNames = append(productNames, p.Name)
			productCounts = append(productCounts, p.Quantity)
			productPrices = append(productPrices, int(p.Price*100))
		}
	} else {
		// Default single product
		productNames = append(productNames, req.Description)
		productCounts = append(productCounts, 1)
		productPrices = append(productPrices, amountKopiyky)
	}

	params := map[string]interface{}{
		"transactionType":   "CREATE_INVOICE",
		"merchantAccount":   c.merchantAccount,
		"merchantDomainName": c.merchantDomain,
		"merchantAuthType":  "SimpleSignature",
		"orderReference":    req.OrderID,
		"orderDate":         orderDate,
		"amount":            amountKopiyky,
		"currency":          string(req.Currency),
		"productName":       productNames,
		"productCount":      productCounts,
		"productPrice":      productPrices,
	}

	if req.ReturnURL != "" {
		params["returnUrl"] = req.ReturnURL
	}
	if req.CallbackURL != "" {
		params["serviceUrl"] = req.CallbackURL
	}
	if req.CustomerEmail != "" {
		params["clientEmail"] = req.CustomerEmail
	}
	if req.CustomerPhone != "" {
		params["clientPhone"] = req.CustomerPhone
	}
	if req.CustomerName != "" {
		nameParts := strings.SplitN(req.CustomerName, " ", 2)
		if len(nameParts) >= 1 {
			params["clientFirstName"] = nameParts[0]
		}
		if len(nameParts) >= 2 {
			params["clientLastName"] = nameParts[1]
		}
	}
	if req.Language != "" {
		params["language"] = strings.ToUpper(req.Language)
	}

	// Payment method
	if req.Method == MethodApplePay {
		params["paymentSystems"] = []string{"applePay"}
	} else if req.Method == MethodGooglePay {
		params["paymentSystems"] = []string{"googlePay"}
	}

	// Invoice validity
	params["orderTimeout"] = 86400 // 24 hours

	// Calculate signature
	signString := fmt.Sprintf("%s;%s;%s;%d;%d;%s;%s;%s",
		c.merchantAccount,
		c.merchantDomain,
		req.OrderID,
		orderDate,
		amountKopiyky,
		string(req.Currency),
		strings.Join(productNames, ";"),
		strings.Join(intSliceToStrings(productCounts), ";"),
	)
	params["merchantSignature"] = c.calculateSignature(signString)

	data, _ := json.Marshal(params)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", wayforpayAPIURL, bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if result["reasonCode"].(float64) != 1100 {
		return nil, fmt.Errorf("wayforpay error: %v", result["reason"])
	}

	return &PaymentResponse{
		PaymentID:  fmt.Sprintf("%v", result["invoiceUrl"]),
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: fmt.Sprintf("%v", result["invoiceUrl"]),
		CreatedAt:  time.Now(),
	}, nil
}

// GetPayment gets payment status
func (c *WayForPayClient) GetPayment(ctx context.Context, orderID string) (*PaymentResponse, error) {
	params := map[string]interface{}{
		"transactionType":   "CHECK_STATUS",
		"merchantAccount":   c.merchantAccount,
		"orderReference":    orderID,
		"merchantSignature": c.calculateSignature(c.merchantAccount + ";" + orderID),
		"apiVersion":        1,
	}

	data, _ := json.Marshal(params)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", wayforpayAPIURL, bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	response := &PaymentResponse{
		OrderID:   orderID,
		Status:    c.mapStatus(fmt.Sprintf("%v", result["transactionStatus"])),
		CreatedAt: time.Now(),
	}

	if amount, ok := result["amount"].(float64); ok {
		response.Amount = amount / 100
	}
	if currency, ok := result["currency"].(string); ok {
		response.Currency = Currency(currency)
	}
	if reasonCode, ok := result["reasonCode"].(float64); ok && reasonCode != 1100 {
		response.ErrorCode = fmt.Sprintf("%.0f", reasonCode)
		response.ErrorMessage = fmt.Sprintf("%v", result["reason"])
	}

	return response, nil
}

// ProcessCallback processes WayForPay callback
func (c *WayForPayClient) ProcessCallback(ctx context.Context, data []byte, signature string) (*PaymentCallback, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	// Verify signature
	if !c.VerifySignature(data, signature) {
		return nil, ErrCallbackInvalid
	}

	callback := &PaymentCallback{
		OrderID: fmt.Sprintf("%v", payload["orderReference"]),
		Status:  c.mapStatus(fmt.Sprintf("%v", payload["transactionStatus"])),
		RawData: payload,
	}

	if amount, ok := payload["amount"].(float64); ok {
		callback.Amount = amount / 100
	}
	if currency, ok := payload["currency"].(string); ok {
		callback.Currency = Currency(currency)
	}
	if cardPan, ok := payload["cardPan"].(string); ok {
		callback.CardMask = cardPan
	}
	if cardType, ok := payload["cardType"].(string); ok {
		callback.CardType = cardType
	}
	if cardBank, ok := payload["issuerBankName"].(string); ok {
		callback.CardBank = cardBank
	}
	if txID, ok := payload["transactionId"].(float64); ok {
		callback.TransactionID = fmt.Sprintf("%.0f", txID)
	}
	if reasonCode, ok := payload["reasonCode"].(float64); ok && reasonCode != 1100 {
		callback.ErrorCode = fmt.Sprintf("%.0f", reasonCode)
		callback.ErrorMessage = fmt.Sprintf("%v", payload["reason"])
	}

	return callback, nil
}

// Refund creates refund
func (c *WayForPayClient) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
	params := map[string]interface{}{
		"transactionType": "REFUND",
		"merchantAccount": c.merchantAccount,
		"orderReference":  req.PaymentID,
		"apiVersion":      1,
	}

	if req.Amount > 0 {
		params["amount"] = int(req.Amount * 100)
	}
	if req.Reason != "" {
		params["comment"] = req.Reason
	}

	signString := fmt.Sprintf("%s;%s", c.merchantAccount, req.PaymentID)
	if req.Amount > 0 {
		signString += fmt.Sprintf(";%d", int(req.Amount*100))
	}
	params["merchantSignature"] = c.calculateSignature(signString)

	data, _ := json.Marshal(params)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", wayforpayAPIURL, bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["reasonCode"].(float64) != 1100 {
		return nil, fmt.Errorf("refund failed: %v", result["reason"])
	}

	return &RefundResponse{
		RefundID:  fmt.Sprintf("%v", result["transactionId"]),
		PaymentID: req.PaymentID,
		Status:    StatusRefunded,
		CreatedAt: time.Now(),
	}, nil
}

// VerifySignature verifies callback signature
func (c *WayForPayClient) VerifySignature(data []byte, providedSig string) bool {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	// Build signature string
	signValues := []string{
		c.merchantAccount,
		fmt.Sprintf("%v", payload["orderReference"]),
	}

	if amount, ok := payload["amount"].(float64); ok {
		signValues = append(signValues, fmt.Sprintf("%.0f", amount*100))
	}
	if currency, ok := payload["currency"].(string); ok {
		signValues = append(signValues, currency)
	}
	if authCode, ok := payload["authCode"].(string); ok {
		signValues = append(signValues, authCode)
	}
	if cardPan, ok := payload["cardPan"].(string); ok {
		signValues = append(signValues, cardPan)
	}
	if transactionStatus, ok := payload["transactionStatus"].(string); ok {
		signValues = append(signValues, transactionStatus)
	}
	if reasonCode, ok := payload["reasonCode"].(float64); ok {
		signValues = append(signValues, fmt.Sprintf("%.0f", reasonCode))
	}

	calculatedSig := c.calculateSignature(strings.Join(signValues, ";"))
	return calculatedSig == providedSig
}

// Settle settles preauthorized payment
func (c *WayForPayClient) Settle(ctx context.Context, orderID string, amount float64) error {
	params := map[string]interface{}{
		"transactionType": "SETTLE",
		"merchantAccount": c.merchantAccount,
		"orderReference":  orderID,
		"amount":          int(amount * 100),
		"currency":        "UAH",
		"apiVersion":      1,
	}

	signString := fmt.Sprintf("%s;%s;%d;%s",
		c.merchantAccount, orderID, int(amount*100), "UAH")
	params["merchantSignature"] = c.calculateSignature(signString)

	data, _ := json.Marshal(params)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", wayforpayAPIURL, bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["reasonCode"].(float64) != 1100 {
		return fmt.Errorf("settle failed: %v", result["reason"])
	}

	return nil
}

// CreateRegularPayment creates subscription payment
func (c *WayForPayClient) CreateRegularPayment(ctx context.Context, req *PaymentRequest, regularMode string, regularAmount int, dateNext string) (*PaymentResponse, error) {
	amountKopiyky := int(req.Amount * 100)
	orderDate := time.Now().Unix()

	params := map[string]interface{}{
		"transactionType":    "CREATE_INVOICE",
		"merchantAccount":    c.merchantAccount,
		"merchantDomainName": c.merchantDomain,
		"orderReference":     req.OrderID,
		"orderDate":          orderDate,
		"amount":             amountKopiyky,
		"currency":           string(req.Currency),
		"productName":        []string{req.Description},
		"productCount":       []int{1},
		"productPrice":       []int{amountKopiyky},
		"regularMode":        regularMode, // daily, weekly, monthly, quarterly
		"regularAmount":      regularAmount,
		"dateNext":           dateNext, // dd.mm.yyyy
		"regularCount":       0, // 0 = unlimited
	}

	if req.ReturnURL != "" {
		params["returnUrl"] = req.ReturnURL
	}
	if req.CallbackURL != "" {
		params["serviceUrl"] = req.CallbackURL
	}

	signString := fmt.Sprintf("%s;%s;%s;%d;%d;%s;%s;%d",
		c.merchantAccount,
		c.merchantDomain,
		req.OrderID,
		orderDate,
		amountKopiyky,
		string(req.Currency),
		req.Description,
		1,
	)
	params["merchantSignature"] = c.calculateSignature(signString)

	data, _ := json.Marshal(params)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", wayforpayAPIURL, bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["reasonCode"].(float64) != 1100 {
		return nil, fmt.Errorf("error: %v", result["reason"])
	}

	return &PaymentResponse{
		PaymentID:  fmt.Sprintf("%v", result["invoiceUrl"]),
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: fmt.Sprintf("%v", result["invoiceUrl"]),
		CreatedAt:  time.Now(),
	}, nil
}

// GetTransactionList gets transaction history
func (c *WayForPayClient) GetTransactionList(ctx context.Context, dateBegin, dateEnd time.Time) ([]map[string]interface{}, error) {
	params := map[string]interface{}{
		"transactionType": "TRANSACTION_LIST",
		"merchantAccount": c.merchantAccount,
		"dateBegin":       dateBegin.Unix(),
		"dateEnd":         dateEnd.Unix(),
		"apiVersion":      1,
	}

	signString := fmt.Sprintf("%s;%d;%d",
		c.merchantAccount, dateBegin.Unix(), dateEnd.Unix())
	params["merchantSignature"] = c.calculateSignature(signString)

	data, _ := json.Marshal(params)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", wayforpayAPIURL, bytes.NewReader(data))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		TransactionList []map[string]interface{} `json:"transactionList"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return result.TransactionList, nil
}

// GenerateCallbackResponse generates response for callback (to confirm receipt)
func (c *WayForPayClient) GenerateCallbackResponse(orderReference string, status string) []byte {
	response := map[string]interface{}{
		"orderReference": orderReference,
		"status":         status,
		"time":           time.Now().Unix(),
	}

	signString := fmt.Sprintf("%s;%s;%d", orderReference, status, response["time"])
	response["signature"] = c.calculateSignature(signString)

	data, _ := json.Marshal(response)
	return data
}

func (c *WayForPayClient) calculateSignature(signString string) string {
	h := hmac.New(md5.New, []byte(c.secretKey))
	h.Write([]byte(signString))
	return hex.EncodeToString(h.Sum(nil))
}

func (c *WayForPayClient) mapStatus(status string) PaymentStatus {
	switch status {
	case "Approved":
		return StatusSuccess
	case "Declined", "Expired":
		return StatusFailed
	case "Refunded", "Voided":
		return StatusRefunded
	case "InProcessing", "WaitingAuthComplete", "Pending":
		return StatusProcessing
	default:
		return StatusPending
	}
}

func intSliceToStrings(ints []int) []string {
	strs := make([]string, len(ints))
	for i, v := range ints {
		strs[i] = fmt.Sprintf("%d", v)
	}
	return strs
}
