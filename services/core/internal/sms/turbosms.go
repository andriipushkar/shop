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

const turboSMSURL = "https://api.turbosms.ua/message"

// TurboSMSClient implements TurboSMS provider
type TurboSMSClient struct {
	apiKey     string
	sender     string
	httpClient *http.Client
}

// NewTurboSMSClient creates TurboSMS client
func NewTurboSMSClient(apiKey, sender string) *TurboSMSClient {
	return &TurboSMSClient{
		apiKey:     apiKey,
		sender:     sender,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *TurboSMSClient) Name() string { return "turbosms" }

// Send sends single SMS
func (c *TurboSMSClient) Send(ctx context.Context, msg *Message) (*SendResult, error) {
	sender := msg.Sender
	if sender == "" {
		sender = c.sender
	}

	payload := map[string]interface{}{
		"recipients": []string{c.normalizePhone(msg.Phone)},
		"sms": map[string]interface{}{
			"sender": sender,
			"text":   msg.Text,
		},
	}

	resp, err := c.doRequest(ctx, "/send.json", payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Phone:  msg.Phone,
		Status: StatusQueued,
	}

	if responseResult, ok := resp["response_result"].([]interface{}); ok && len(responseResult) > 0 {
		item := responseResult[0].(map[string]interface{})
		result.MessageID = fmt.Sprintf("%v", item["message_id"])

		if status, ok := item["response_status"].(string); ok {
			switch status {
			case "OK":
				result.Status = StatusSent
			default:
				result.Status = StatusFailed
				result.ErrorText = fmt.Sprintf("%v", item["response_code"])
			}
		}
	}

	return result, nil
}

// SendBulk sends bulk SMS
func (c *TurboSMSClient) SendBulk(ctx context.Context, msg *BulkMessage) ([]SendResult, error) {
	sender := msg.Sender
	if sender == "" {
		sender = c.sender
	}

	// Normalize phones
	phones := make([]string, len(msg.Phones))
	for i, phone := range msg.Phones {
		phones[i] = c.normalizePhone(phone)
	}

	payload := map[string]interface{}{
		"recipients": phones,
		"sms": map[string]interface{}{
			"sender": sender,
			"text":   msg.Text,
		},
	}

	resp, err := c.doRequest(ctx, "/send.json", payload)
	if err != nil {
		return nil, err
	}

	results := make([]SendResult, 0)

	if responseResult, ok := resp["response_result"].([]interface{}); ok {
		for i, item := range responseResult {
			itemMap := item.(map[string]interface{})
			result := SendResult{
				MessageID: fmt.Sprintf("%v", itemMap["message_id"]),
				Phone:     msg.Phones[i],
				Status:    StatusQueued,
			}

			if status, ok := itemMap["response_status"].(string); ok {
				switch status {
				case "OK":
					result.Status = StatusSent
				default:
					result.Status = StatusFailed
					result.ErrorText = fmt.Sprintf("%v", itemMap["response_code"])
				}
			}

			results = append(results, result)
		}
	}

	return results, nil
}

// GetStatus gets message status
func (c *TurboSMSClient) GetStatus(ctx context.Context, messageID string) (*DeliveryReport, error) {
	payload := map[string]interface{}{
		"message_id": messageID,
	}

	resp, err := c.doRequest(ctx, "/status.json", payload)
	if err != nil {
		return nil, err
	}

	report := &DeliveryReport{
		MessageID: messageID,
		Status:    StatusQueued,
	}

	if responseResult, ok := resp["response_result"].(map[string]interface{}); ok {
		if phone, ok := responseResult["recipient"].(string); ok {
			report.Phone = phone
		}

		if status, ok := responseResult["status"].(string); ok {
			report.Status = c.mapStatus(status)
		}

		if sendTime, ok := responseResult["crediting_date"].(string); ok {
			if t, err := time.Parse("2006-01-02 15:04:05", sendTime); err == nil {
				report.DeliveredAt = &t
			}
		}
	}

	return report, nil
}

// GetBalance gets account balance
func (c *TurboSMSClient) GetBalance(ctx context.Context) (*Balance, error) {
	resp, err := c.doRequest(ctx, "/balance.json", nil)
	if err != nil {
		return nil, err
	}

	balance := &Balance{
		Currency: "UAH",
	}

	if result, ok := resp["response_result"].(map[string]interface{}); ok {
		if amount, ok := result["balance"].(float64); ok {
			balance.Amount = amount
		}
	}

	return balance, nil
}

// SendViber sends Viber message (TurboSMS supports Viber)
func (c *TurboSMSClient) SendViber(ctx context.Context, phone, text, imageURL string, button *ViberButton) (*SendResult, error) {
	payload := map[string]interface{}{
		"recipients": []string{c.normalizePhone(phone)},
		"viber": map[string]interface{}{
			"sender": c.sender,
			"text":   text,
		},
	}

	if imageURL != "" {
		payload["viber"].(map[string]interface{})["image_url"] = imageURL
	}

	if button != nil {
		payload["viber"].(map[string]interface{})["button"] = map[string]interface{}{
			"text": button.Text,
			"url":  button.URL,
		}
	}

	resp, err := c.doRequest(ctx, "/send.json", payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Phone:  phone,
		Status: StatusQueued,
	}

	if responseResult, ok := resp["response_result"].([]interface{}); ok && len(responseResult) > 0 {
		item := responseResult[0].(map[string]interface{})
		result.MessageID = fmt.Sprintf("%v", item["message_id"])
		if status, ok := item["response_status"].(string); ok && status == "OK" {
			result.Status = StatusSent
		}
	}

	return result, nil
}

// ViberButton represents Viber message button
type ViberButton struct {
	Text string `json:"text"`
	URL  string `json:"url"`
}

// SendHybrid sends hybrid SMS+Viber (tries Viber first, falls back to SMS)
func (c *TurboSMSClient) SendHybrid(ctx context.Context, phone, text string) (*SendResult, error) {
	payload := map[string]interface{}{
		"recipients": []string{c.normalizePhone(phone)},
		"viber": map[string]interface{}{
			"sender": c.sender,
			"text":   text,
		},
		"sms": map[string]interface{}{
			"sender": c.sender,
			"text":   text,
		},
	}

	resp, err := c.doRequest(ctx, "/send.json", payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Phone:  phone,
		Status: StatusQueued,
	}

	if responseResult, ok := resp["response_result"].([]interface{}); ok && len(responseResult) > 0 {
		item := responseResult[0].(map[string]interface{})
		result.MessageID = fmt.Sprintf("%v", item["message_id"])
		if status, ok := item["response_status"].(string); ok && status == "OK" {
			result.Status = StatusSent
		}
	}

	return result, nil
}

func (c *TurboSMSClient) doRequest(ctx context.Context, path string, payload interface{}) (map[string]interface{}, error) {
	var body io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, "POST", turboSMSURL+path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if respStatus, ok := result["response_status"].(string); ok && respStatus != "OK" {
		return nil, fmt.Errorf("TurboSMS error: %v - %v", result["response_code"], result["response_status"])
	}

	return result, nil
}

func (c *TurboSMSClient) normalizePhone(phone string) string {
	// Remove all non-digit characters
	digits := ""
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}

	// Add Ukraine country code if needed
	if len(digits) == 9 {
		digits = "380" + digits
	} else if len(digits) == 10 && digits[0] == '0' {
		digits = "38" + digits
	}

	return digits
}

func (c *TurboSMSClient) mapStatus(status string) MessageStatus {
	switch status {
	case "DELIVERED", "DELIVRD":
		return StatusDelivered
	case "SENT", "ACCEPTD":
		return StatusSent
	case "EXPIRED", "UNDELIV":
		return StatusExpired
	case "REJECTD":
		return StatusRejected
	case "FAILED":
		return StatusFailed
	default:
		return StatusQueued
	}
}
