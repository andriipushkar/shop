package payment

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

const monoAcquiringURL = "https://api.monobank.ua/api/merchant"

// MonobankClient implements Monobank Acquiring
type MonobankClient struct {
	token      string
	httpClient *http.Client
	publicKey  *ecdsa.PublicKey
}

// NewMonobankClient creates Monobank client
func NewMonobankClient(token string) *MonobankClient {
	return &MonobankClient{
		token:      token,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SetPublicKey sets Monobank public key for signature verification
func (c *MonobankClient) SetPublicKey(pemKey string) error {
	block, _ := pem.Decode([]byte(pemKey))
	if block == nil {
		return fmt.Errorf("failed to parse PEM block")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return err
	}

	ecdsaPub, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		return fmt.Errorf("key is not ECDSA")
	}

	c.publicKey = ecdsaPub
	return nil
}

// Name returns provider name
func (c *MonobankClient) Name() string { return "monobank" }

// CreatePayment creates Monobank payment
func (c *MonobankClient) CreatePayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// Monobank uses kopiyky (1 UAH = 100 kopiyky)
	amountKopiyky := int(req.Amount * 100)

	payload := map[string]interface{}{
		"amount":     amountKopiyky,
		"ccy":        currencyCode(req.Currency),
		"merchantPaymInfo": map[string]interface{}{
			"reference":   req.OrderID,
			"destination": req.Description,
		},
	}

	if req.ReturnURL != "" {
		payload["redirectUrl"] = req.ReturnURL
	}
	if req.CallbackURL != "" {
		payload["webHookUrl"] = req.CallbackURL
	}

	// Payment methods
	if req.Method != "" {
		switch req.Method {
		case MethodApplePay:
			payload["paymentType"] = "applepay"
		case MethodGooglePay:
			payload["paymentType"] = "googlepay"
		case MethodQR:
			payload["qrId"] = req.OrderID
		}
	}

	// Basket items
	if len(req.Products) > 0 {
		basketOrder := make([]map[string]interface{}, len(req.Products))
		for i, p := range req.Products {
			basketOrder[i] = map[string]interface{}{
				"name":  p.Name,
				"qty":   float64(p.Quantity),
				"sum":   int(p.Price * float64(p.Quantity) * 100),
				"icon":  "",
				"unit":  "шт.",
				"code":  fmt.Sprintf("item_%d", i),
			}
		}
		payload["merchantPaymInfo"].(map[string]interface{})["basketOrder"] = basketOrder
	}

	// Validity period
	payload["validity"] = 3600 // 1 hour

	// Save card token
	if req.Metadata != nil && req.Metadata["save_card"] == "true" {
		payload["saveCardData"] = map[string]interface{}{
			"saveCard": true,
		}
	}

	data, _ := json.Marshal(payload)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", monoAcquiringURL+"/invoice/create", bytes.NewReader(data))
	httpReq.Header.Set("X-Token", c.token)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		var errResp map[string]interface{}
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("monobank error: %v", errResp["errText"])
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	return &PaymentResponse{
		PaymentID:  fmt.Sprintf("%v", result["invoiceId"]),
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: fmt.Sprintf("%v", result["pageUrl"]),
		CreatedAt:  time.Now(),
	}, nil
}

// GetPayment gets payment status
func (c *MonobankClient) GetPayment(ctx context.Context, invoiceID string) (*PaymentResponse, error) {
	httpReq, _ := http.NewRequestWithContext(ctx, "GET", monoAcquiringURL+"/invoice/status?invoiceId="+invoiceID, nil)
	httpReq.Header.Set("X-Token", c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	status := c.mapStatus(fmt.Sprintf("%v", result["status"]))

	response := &PaymentResponse{
		PaymentID: invoiceID,
		Status:    status,
		CreatedAt: time.Now(),
	}

	if amount, ok := result["amount"].(float64); ok {
		response.Amount = amount / 100
	}
	if ccy, ok := result["ccy"].(float64); ok {
		response.Currency = currencyFromCode(int(ccy))
	}
	if failureReason, ok := result["failureReason"].(string); ok {
		response.ErrorMessage = failureReason
	}

	// Get reference from merchantPaymInfo
	if info, ok := result["merchantPaymInfo"].(map[string]interface{}); ok {
		if ref, ok := info["reference"].(string); ok {
			response.OrderID = ref
		}
	}

	return response, nil
}

// ProcessCallback processes Monobank webhook
func (c *MonobankClient) ProcessCallback(ctx context.Context, data []byte, signature string) (*PaymentCallback, error) {
	// Verify signature if public key is set
	if c.publicKey != nil && signature != "" {
		if !c.VerifySignature(data, signature) {
			return nil, ErrCallbackInvalid
		}
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	status := c.mapStatus(fmt.Sprintf("%v", payload["status"]))

	callback := &PaymentCallback{
		PaymentID: fmt.Sprintf("%v", payload["invoiceId"]),
		Status:    status,
		RawData:   payload,
	}

	if amount, ok := payload["amount"].(float64); ok {
		callback.Amount = amount / 100
	}
	if ccy, ok := payload["ccy"].(float64); ok {
		callback.Currency = currencyFromCode(int(ccy))
	}

	// Get reference
	if ref, ok := payload["reference"].(string); ok {
		callback.OrderID = ref
	}

	// Card info
	if cardMask, ok := payload["maskedPan"].(string); ok {
		callback.CardMask = cardMask
	}

	// Failure reason
	if failureReason, ok := payload["failureReason"].(string); ok {
		callback.ErrorMessage = failureReason
	}

	return callback, nil
}

// Refund creates refund (cancellation)
func (c *MonobankClient) Refund(ctx context.Context, req *RefundRequest) (*RefundResponse, error) {
	payload := map[string]interface{}{
		"invoiceId": req.PaymentID,
	}

	if req.Amount > 0 {
		payload["amount"] = int(req.Amount * 100)
	}
	if req.Reason != "" {
		payload["extRef"] = req.Reason
	}

	data, _ := json.Marshal(payload)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", monoAcquiringURL+"/invoice/cancel", bytes.NewReader(data))
	httpReq.Header.Set("X-Token", c.token)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		var errResp map[string]interface{}
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("refund failed: %v", errResp["errText"])
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return &RefundResponse{
		RefundID:  fmt.Sprintf("%v", result["invoiceId"]),
		PaymentID: req.PaymentID,
		Status:    StatusRefunded,
		CreatedAt: time.Now(),
	}, nil
}

// VerifySignature verifies webhook signature
func (c *MonobankClient) VerifySignature(data []byte, signature string) bool {
	if c.publicKey == nil {
		return true // Skip if no public key set
	}

	sigBytes, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return false
	}

	hash := sha256.Sum256(data)
	return ecdsa.VerifyASN1(c.publicKey, hash[:], sigBytes)
}

// CreateQRPayment creates QR code payment
func (c *MonobankClient) CreateQRPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	amountKopiyky := int(req.Amount * 100)

	payload := map[string]interface{}{
		"amount": amountKopiyky,
		"ccy":    currencyCode(req.Currency),
		"merchantPaymInfo": map[string]interface{}{
			"reference":   req.OrderID,
			"destination": req.Description,
		},
	}

	if req.CallbackURL != "" {
		payload["webHookUrl"] = req.CallbackURL
	}

	data, _ := json.Marshal(payload)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", monoAcquiringURL+"/qr/details", bytes.NewReader(data))
	httpReq.Header.Set("X-Token", c.token)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return &PaymentResponse{
		PaymentID:  fmt.Sprintf("%v", result["invoiceId"]),
		OrderID:    req.OrderID,
		Status:     StatusPending,
		Amount:     req.Amount,
		Currency:   req.Currency,
		PaymentURL: fmt.Sprintf("%v", result["pageUrl"]),
		QRCode:     fmt.Sprintf("%v", result["qrLink"]),
		CreatedAt:  time.Now(),
	}, nil
}

// Finalize finalizes 2-step payment (confirm after auth)
func (c *MonobankClient) Finalize(ctx context.Context, invoiceID string, amount float64) error {
	payload := map[string]interface{}{
		"invoiceId": invoiceID,
	}
	if amount > 0 {
		payload["amount"] = int(amount * 100)
	}

	data, _ := json.Marshal(payload)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", monoAcquiringURL+"/invoice/finalize", bytes.NewReader(data))
	httpReq.Header.Set("X-Token", c.token)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		var errResp map[string]interface{}
		json.Unmarshal(body, &errResp)
		return fmt.Errorf("finalize failed: %v", errResp["errText"])
	}

	return nil
}

// GetMerchantInfo gets merchant info
func (c *MonobankClient) GetMerchantInfo(ctx context.Context) (map[string]interface{}, error) {
	httpReq, _ := http.NewRequestWithContext(ctx, "GET", monoAcquiringURL+"/details", nil)
	httpReq.Header.Set("X-Token", c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return result, nil
}

// GetStatement gets merchant statement
func (c *MonobankClient) GetStatement(ctx context.Context, from, to time.Time) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/statement?from=%d&to=%d",
		monoAcquiringURL,
		from.Unix(),
		to.Unix())

	httpReq, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	httpReq.Header.Set("X-Token", c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		List []map[string]interface{} `json:"list"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return result.List, nil
}

func (c *MonobankClient) mapStatus(status string) PaymentStatus {
	switch status {
	case "success":
		return StatusSuccess
	case "failure":
		return StatusFailed
	case "reversed":
		return StatusRefunded
	case "created", "processing", "hold":
		return StatusProcessing
	case "expired":
		return StatusExpired
	default:
		return StatusPending
	}
}

func currencyCode(cur Currency) int {
	switch cur {
	case UAH:
		return 980
	case USD:
		return 840
	case EUR:
		return 978
	default:
		return 980
	}
}

func currencyFromCode(code int) Currency {
	switch code {
	case 980:
		return UAH
	case 840:
		return USD
	case 978:
		return EUR
	default:
		return UAH
	}
}

// MonobankPersonalClient for personal account API
type MonobankPersonalClient struct {
	token      string
	httpClient *http.Client
}

// NewMonobankPersonalClient creates personal client
func NewMonobankPersonalClient(token string) *MonobankPersonalClient {
	return &MonobankPersonalClient{
		token:      token,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// GetClientInfo gets client info
func (c *MonobankPersonalClient) GetClientInfo(ctx context.Context) (map[string]interface{}, error) {
	httpReq, _ := http.NewRequestWithContext(ctx, "GET", "https://api.monobank.ua/personal/client-info", nil)
	httpReq.Header.Set("X-Token", c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// GetPersonalStatement gets account statement
func (c *MonobankPersonalClient) GetPersonalStatement(ctx context.Context, account string, from time.Time) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("https://api.monobank.ua/personal/statement/%s/%d", account, from.Unix())

	httpReq, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	httpReq.Header.Set("X-Token", c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// CreateJar creates donation jar payment link
func (c *MonobankPersonalClient) CreateJar(ctx context.Context, jarID string, amount int) string {
	return fmt.Sprintf("https://send.monobank.ua/jar/%s?a=%s", jarID, strconv.Itoa(amount))
}
