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

const smsUAURL = "https://im.sms.ua/api/v2"

// SMSUAClient implements SMS.ua provider
type SMSUAClient struct {
	apiKey     string
	sender     string
	httpClient *http.Client
}

// NewSMSUAClient creates SMS.ua client
func NewSMSUAClient(apiKey, sender string) *SMSUAClient {
	return &SMSUAClient{
		apiKey:     apiKey,
		sender:     sender,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *SMSUAClient) Name() string { return "smsua" }

// Send sends single SMS
func (c *SMSUAClient) Send(ctx context.Context, msg *Message) (*SendResult, error) {
	sender := msg.Sender
	if sender == "" {
		sender = c.sender
	}

	payload := map[string]interface{}{
		"phone":  c.normalizePhone(msg.Phone),
		"sender": sender,
		"text":   msg.Text,
	}

	resp, err := c.doRequest(ctx, "POST", "/send", payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Phone:  msg.Phone,
		Status: StatusQueued,
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		if msgID, ok := data["id"].(string); ok {
			result.MessageID = msgID
		}
		if status, ok := data["status"].(string); ok {
			result.Status = c.mapStatus(status)
		}
		if cost, ok := data["cost"].(float64); ok {
			result.Cost = cost
		}
	}

	if resp["success"] == false {
		result.Status = StatusFailed
		if errMsg, ok := resp["error"].(string); ok {
			result.ErrorText = errMsg
		}
	}

	return result, nil
}

// SendBulk sends bulk SMS
func (c *SMSUAClient) SendBulk(ctx context.Context, msg *BulkMessage) ([]SendResult, error) {
	sender := msg.Sender
	if sender == "" {
		sender = c.sender
	}

	// SMS.ua uses different format for bulk
	messages := make([]map[string]interface{}, len(msg.Phones))
	for i, phone := range msg.Phones {
		messages[i] = map[string]interface{}{
			"phone":  c.normalizePhone(phone),
			"sender": sender,
			"text":   msg.Text,
		}
	}

	payload := map[string]interface{}{
		"messages": messages,
	}

	resp, err := c.doRequest(ctx, "POST", "/send/batch", payload)
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

			if msgID, ok := itemMap["id"].(string); ok {
				result.MessageID = msgID
			}
			if status, ok := itemMap["status"].(string); ok {
				result.Status = c.mapStatus(status)
			}
			if errMsg, ok := itemMap["error"].(string); ok {
				result.Status = StatusFailed
				result.ErrorText = errMsg
			}

			results = append(results, result)
		}
	}

	return results, nil
}

// GetStatus gets message status
func (c *SMSUAClient) GetStatus(ctx context.Context, messageID string) (*DeliveryReport, error) {
	resp, err := c.doRequest(ctx, "GET", "/status/"+messageID, nil)
	if err != nil {
		return nil, err
	}

	report := &DeliveryReport{
		MessageID: messageID,
		Status:    StatusQueued,
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		if phone, ok := data["phone"].(string); ok {
			report.Phone = phone
		}
		if status, ok := data["status"].(string); ok {
			report.Status = c.mapStatus(status)
		}
		if deliveredAt, ok := data["delivered_at"].(string); ok {
			if t, err := time.Parse(time.RFC3339, deliveredAt); err == nil {
				report.DeliveredAt = &t
			}
		}
		if errCode, ok := data["error_code"].(string); ok {
			report.ErrorCode = errCode
		}
	}

	return report, nil
}

// GetBalance gets account balance
func (c *SMSUAClient) GetBalance(ctx context.Context) (*Balance, error) {
	resp, err := c.doRequest(ctx, "GET", "/balance", nil)
	if err != nil {
		return nil, err
	}

	balance := &Balance{
		Currency: "UAH",
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		if amount, ok := data["balance"].(float64); ok {
			balance.Amount = amount
		}
		if currency, ok := data["currency"].(string); ok {
			balance.Currency = currency
		}
	}

	return balance, nil
}

// GetSenders gets list of registered senders
func (c *SMSUAClient) GetSenders(ctx context.Context) ([]string, error) {
	resp, err := c.doRequest(ctx, "GET", "/senders", nil)
	if err != nil {
		return nil, err
	}

	senders := make([]string, 0)
	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			if sender, ok := item.(string); ok {
				senders = append(senders, sender)
			}
		}
	}

	return senders, nil
}

// GetStatistics gets message statistics
func (c *SMSUAClient) GetStatistics(ctx context.Context, dateFrom, dateTo time.Time) (map[string]interface{}, error) {
	params := fmt.Sprintf("?date_from=%s&date_to=%s",
		dateFrom.Format("2006-01-02"),
		dateTo.Format("2006-01-02"))

	resp, err := c.doRequest(ctx, "GET", "/statistics"+params, nil)
	if err != nil {
		return nil, err
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		return data, nil
	}

	return nil, nil
}

func (c *SMSUAClient) doRequest(ctx context.Context, method, path string, payload interface{}) (map[string]interface{}, error) {
	var body io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, smsUAURL+path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if success, ok := result["success"].(bool); ok && !success {
		return result, fmt.Errorf("SMS.ua error: %v", result["error"])
	}

	return result, nil
}

func (c *SMSUAClient) normalizePhone(phone string) string {
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

func (c *SMSUAClient) mapStatus(status string) MessageStatus {
	switch status {
	case "delivered":
		return StatusDelivered
	case "sent", "accepted":
		return StatusSent
	case "expired":
		return StatusExpired
	case "rejected":
		return StatusRejected
	case "failed", "error":
		return StatusFailed
	case "queued", "pending":
		return StatusQueued
	default:
		return StatusQueued
	}
}
