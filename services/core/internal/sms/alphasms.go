package sms

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const alphaSMSURL = "https://alphasms.ua/api/json.php"

// AlphaSMSClient implements AlphaSMS provider
type AlphaSMSClient struct {
	apiKey     string
	login      string
	sender     string
	httpClient *http.Client
}

// NewAlphaSMSClient creates AlphaSMS client
func NewAlphaSMSClient(login, apiKey, sender string) *AlphaSMSClient {
	return &AlphaSMSClient{
		login:      login,
		apiKey:     apiKey,
		sender:     sender,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *AlphaSMSClient) Name() string { return "alphasms" }

// Send sends single SMS
func (c *AlphaSMSClient) Send(ctx context.Context, msg *Message) (*SendResult, error) {
	sender := msg.Sender
	if sender == "" {
		sender = c.sender
	}

	payload := map[string]interface{}{
		"auth": map[string]string{
			"login": c.login,
			"key":   c.apiKey,
		},
		"data": []map[string]interface{}{
			{
				"type":   "sms",
				"sender": sender,
				"phone":  c.normalizePhone(msg.Phone),
				"text":   msg.Text,
			},
		},
	}

	resp, err := c.doRequest(ctx, payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Phone:  msg.Phone,
		Status: StatusQueued,
	}

	if data, ok := resp["data"].([]interface{}); ok && len(data) > 0 {
		item := data[0].(map[string]interface{})

		if msgID, ok := item["id"].(float64); ok {
			result.MessageID = fmt.Sprintf("%.0f", msgID)
		}
		if status, ok := item["status"].(string); ok {
			result.Status = c.mapStatus(status)
		}
		if errCode, ok := item["error"].(float64); ok && errCode != 0 {
			result.Status = StatusFailed
			result.ErrorCode = fmt.Sprintf("%.0f", errCode)
		}
	}

	return result, nil
}

// SendBulk sends bulk SMS
func (c *AlphaSMSClient) SendBulk(ctx context.Context, msg *BulkMessage) ([]SendResult, error) {
	sender := msg.Sender
	if sender == "" {
		sender = c.sender
	}

	messages := make([]map[string]interface{}, len(msg.Phones))
	for i, phone := range msg.Phones {
		messages[i] = map[string]interface{}{
			"type":   "sms",
			"sender": sender,
			"phone":  c.normalizePhone(phone),
			"text":   msg.Text,
		}
	}

	payload := map[string]interface{}{
		"auth": map[string]string{
			"login": c.login,
			"key":   c.apiKey,
		},
		"data": messages,
	}

	resp, err := c.doRequest(ctx, payload)
	if err != nil {
		return nil, err
	}

	results := make([]SendResult, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for i, item := range data {
			itemMap := item.(map[string]interface{})
			result := SendResult{
				Phone:  msg.Phones[i],
				Status: StatusQueued,
			}

			if msgID, ok := itemMap["id"].(float64); ok {
				result.MessageID = fmt.Sprintf("%.0f", msgID)
			}
			if status, ok := itemMap["status"].(string); ok {
				result.Status = c.mapStatus(status)
			}
			if errCode, ok := itemMap["error"].(float64); ok && errCode != 0 {
				result.Status = StatusFailed
				result.ErrorCode = fmt.Sprintf("%.0f", errCode)
			}

			results = append(results, result)
		}
	}

	return results, nil
}

// GetStatus gets message status
func (c *AlphaSMSClient) GetStatus(ctx context.Context, messageID string) (*DeliveryReport, error) {
	payload := map[string]interface{}{
		"auth": map[string]string{
			"login": c.login,
			"key":   c.apiKey,
		},
		"data": []map[string]interface{}{
			{
				"type": "status",
				"id":   messageID,
			},
		},
	}

	resp, err := c.doRequest(ctx, payload)
	if err != nil {
		return nil, err
	}

	report := &DeliveryReport{
		MessageID: messageID,
		Status:    StatusQueued,
	}

	if data, ok := resp["data"].([]interface{}); ok && len(data) > 0 {
		item := data[0].(map[string]interface{})

		if phone, ok := item["phone"].(string); ok {
			report.Phone = phone
		}
		if status, ok := item["status"].(string); ok {
			report.Status = c.mapStatus(status)
		}
		if deliveredAt, ok := item["date_received"].(string); ok {
			if t, err := time.Parse("2006-01-02 15:04:05", deliveredAt); err == nil {
				report.DeliveredAt = &t
			}
		}
		if errCode, ok := item["error"].(float64); ok && errCode != 0 {
			report.ErrorCode = fmt.Sprintf("%.0f", errCode)
		}
	}

	return report, nil
}

// GetBalance gets account balance
func (c *AlphaSMSClient) GetBalance(ctx context.Context) (*Balance, error) {
	payload := map[string]interface{}{
		"auth": map[string]string{
			"login": c.login,
			"key":   c.apiKey,
		},
		"data": []map[string]interface{}{
			{
				"type": "balance",
			},
		},
	}

	resp, err := c.doRequest(ctx, payload)
	if err != nil {
		return nil, err
	}

	balance := &Balance{
		Currency: "UAH",
	}

	if data, ok := resp["data"].([]interface{}); ok && len(data) > 0 {
		item := data[0].(map[string]interface{})
		if amount, ok := item["amount"].(float64); ok {
			balance.Amount = amount
		}
		if currency, ok := item["currency"].(string); ok {
			balance.Currency = currency
		}
	}

	return balance, nil
}

// SendViber sends Viber message (AlphaSMS supports Viber)
func (c *AlphaSMSClient) SendViber(ctx context.Context, phone, text string, button *ViberButton, imageURL string) (*SendResult, error) {
	message := map[string]interface{}{
		"type":   "viber",
		"sender": c.sender,
		"phone":  c.normalizePhone(phone),
		"text":   text,
	}

	if imageURL != "" {
		message["img"] = imageURL
	}

	if button != nil {
		message["button_text"] = button.Text
		message["button_url"] = button.URL
	}

	payload := map[string]interface{}{
		"auth": map[string]string{
			"login": c.login,
			"key":   c.apiKey,
		},
		"data": []map[string]interface{}{message},
	}

	resp, err := c.doRequest(ctx, payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Phone:  phone,
		Status: StatusQueued,
	}

	if data, ok := resp["data"].([]interface{}); ok && len(data) > 0 {
		item := data[0].(map[string]interface{})
		if msgID, ok := item["id"].(float64); ok {
			result.MessageID = fmt.Sprintf("%.0f", msgID)
		}
		if status, ok := item["status"].(string); ok && status == "send" {
			result.Status = StatusSent
		}
	}

	return result, nil
}

// SendViberOrSMS sends Viber with SMS fallback
func (c *AlphaSMSClient) SendViberOrSMS(ctx context.Context, phone, text string) (*SendResult, error) {
	payload := map[string]interface{}{
		"auth": map[string]string{
			"login": c.login,
			"key":   c.apiKey,
		},
		"data": []map[string]interface{}{
			{
				"type":   "viber_sms",
				"sender": c.sender,
				"phone":  c.normalizePhone(phone),
				"text":   text,
			},
		},
	}

	resp, err := c.doRequest(ctx, payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Phone:  phone,
		Status: StatusQueued,
	}

	if data, ok := resp["data"].([]interface{}); ok && len(data) > 0 {
		item := data[0].(map[string]interface{})
		if msgID, ok := item["id"].(float64); ok {
			result.MessageID = fmt.Sprintf("%.0f", msgID)
		}
		if status, ok := item["status"].(string); ok && status == "send" {
			result.Status = StatusSent
		}
	}

	return result, nil
}

// GetSenders gets list of registered senders
func (c *AlphaSMSClient) GetSenders(ctx context.Context) ([]map[string]interface{}, error) {
	payload := map[string]interface{}{
		"auth": map[string]string{
			"login": c.login,
			"key":   c.apiKey,
		},
		"data": []map[string]interface{}{
			{
				"type": "senders",
			},
		},
	}

	resp, err := c.doRequest(ctx, payload)
	if err != nil {
		return nil, err
	}

	senders := make([]map[string]interface{}, 0)
	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			if sender, ok := item.(map[string]interface{}); ok {
				senders = append(senders, sender)
			}
		}
	}

	return senders, nil
}

func (c *AlphaSMSClient) doRequest(ctx context.Context, payload interface{}) (map[string]interface{}, error) {
	data, _ := json.Marshal(payload)

	req, _ := http.NewRequestWithContext(ctx, "POST", alphaSMSURL, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	// Check for errors
	if errCode, ok := result["error"].(float64); ok && errCode != 0 {
		errText := fmt.Sprintf("%.0f", errCode)
		if text, ok := result["text"].(string); ok {
			errText = text
		}
		return nil, fmt.Errorf("AlphaSMS error: %s", errText)
	}

	return result, nil
}

func (c *AlphaSMSClient) normalizePhone(phone string) string {
	digits := ""
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}

	if len(digits) == 9 {
		digits = "380" + digits
	} else if len(digits) == 10 && digits[0] == '0' {
		digits = "38" + digits
	}

	return digits
}

func (c *AlphaSMSClient) mapStatus(status string) MessageStatus {
	switch status {
	case "delivered", "DELIVRD":
		return StatusDelivered
	case "send", "sent", "ACCEPTD":
		return StatusSent
	case "expired", "EXPIRED":
		return StatusExpired
	case "rejected", "REJECTD":
		return StatusRejected
	case "failed", "UNDELIV":
		return StatusFailed
	default:
		return StatusQueued
	}
}
