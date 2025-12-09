package email

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const eSputnikAPIURL = "https://esputnik.com/api/v1"

// ESputnikClient implements eSputnik email provider (Ukrainian)
type ESputnikClient struct {
	apiKey     string
	httpClient *http.Client
}

// NewESputnikClient creates eSputnik client
func NewESputnikClient(apiKey string) *ESputnikClient {
	return &ESputnikClient{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *ESputnikClient) Name() string { return "esputnik" }

// SendEmail sends transactional email
func (c *ESputnikClient) SendEmail(ctx context.Context, email *Email) (*SendResult, error) {
	// eSputnik uses events for transactional emails
	payload := map[string]interface{}{
		"eventTypeKey": email.TemplateID,
		"keyValue":     email.To[0],
		"params":       c.convertVariables(email.Variables),
	}

	resp, err := c.doRequest(ctx, "POST", "/event", payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Status: EmailStatusQueued,
	}

	if id, ok := resp["requestId"].(string); ok {
		result.MessageID = id
	}

	return result, nil
}

// SendSmartEmail sends email using smart message
func (c *ESputnikClient) SendSmartEmail(ctx context.Context, email *Email) (*SendResult, error) {
	recipients := make([]map[string]interface{}, len(email.To))
	for i, to := range email.To {
		recipients[i] = map[string]interface{}{
			"locator":          to,
			"jsonParam":        email.Variables,
		}
	}

	payload := map[string]interface{}{
		"recipients": recipients,
	}

	if email.Tags != nil && len(email.Tags) > 0 {
		payload["tag"] = email.Tags[0]
	}

	resp, err := c.doRequest(ctx, "POST", "/message/"+email.TemplateID+"/smartsend", payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Status: EmailStatusQueued,
	}

	if results, ok := resp["results"].([]interface{}); ok && len(results) > 0 {
		if item, ok := results[0].(map[string]interface{}); ok {
			if id, ok := item["id"].(float64); ok {
				result.MessageID = fmt.Sprintf("%.0f", id)
			}
			if status, ok := item["status"].(string); ok {
				switch status {
				case "OK":
					result.Status = EmailStatusSent
				case "FAILED":
					result.Status = EmailStatusFailed
				}
			}
		}
	}

	return result, nil
}

// AddSubscriber adds contact to eSputnik
func (c *ESputnikClient) AddSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	contact := map[string]interface{}{
		"channels": []map[string]string{
			{"type": "email", "value": sub.Email},
		},
	}

	if sub.FirstName != "" {
		contact["firstName"] = sub.FirstName
	}
	if sub.LastName != "" {
		contact["lastName"] = sub.LastName
	}
	if sub.Phone != "" {
		contact["channels"] = append(contact["channels"].([]map[string]string),
			map[string]string{"type": "sms", "value": sub.Phone})
	}

	// Convert custom variables to fields
	if sub.Variables != nil {
		fields := make([]map[string]interface{}, 0)
		for k, v := range sub.Variables {
			fields = append(fields, map[string]interface{}{
				"id":    k,
				"value": v,
			})
		}
		contact["fields"] = fields
	}

	payload := map[string]interface{}{
		"contacts":          []map[string]interface{}{contact},
		"dedupeOn":          "email",
		"contactListId":     listID,
		"eventTypeKey":      "contactAdded",
		"formType":          "subscribe",
	}

	_, err := c.doRequest(ctx, "POST", "/contacts", payload)
	return err
}

// RemoveSubscriber removes contact from group
func (c *ESputnikClient) RemoveSubscriber(ctx context.Context, listID, email string) error {
	// Find contact ID first
	contact, err := c.findContact(ctx, email)
	if err != nil {
		return err
	}

	if contact == nil {
		return ErrSubscriberNotFound
	}

	contactID := fmt.Sprintf("%.0f", contact["id"].(float64))

	payload := map[string]interface{}{
		"contacts": []string{contactID},
	}

	_, err = c.doRequest(ctx, "DELETE", "/group/"+listID+"/contacts", payload)
	return err
}

// UpdateSubscriber updates contact
func (c *ESputnikClient) UpdateSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	contact, err := c.findContact(ctx, sub.Email)
	if err != nil {
		return err
	}

	if contact == nil {
		return c.AddSubscriber(ctx, listID, sub)
	}

	contactID := fmt.Sprintf("%.0f", contact["id"].(float64))

	updateData := map[string]interface{}{
		"id": contactID,
	}

	if sub.FirstName != "" {
		updateData["firstName"] = sub.FirstName
	}
	if sub.LastName != "" {
		updateData["lastName"] = sub.LastName
	}

	payload := map[string]interface{}{
		"contacts": []map[string]interface{}{updateData},
		"dedupeOn": "email",
	}

	_, err = c.doRequest(ctx, "POST", "/contacts", payload)
	return err
}

// GetSubscriber gets contact by email
func (c *ESputnikClient) GetSubscriber(ctx context.Context, listID, email string) (*Subscriber, error) {
	contact, err := c.findContact(ctx, email)
	if err != nil {
		return nil, err
	}

	if contact == nil {
		return nil, ErrSubscriberNotFound
	}

	sub := &Subscriber{
		Email:  email,
		Status: "active",
	}

	if firstName, ok := contact["firstName"].(string); ok {
		sub.FirstName = firstName
	}
	if lastName, ok := contact["lastName"].(string); ok {
		sub.LastName = lastName
	}
	if channels, ok := contact["channels"].([]interface{}); ok {
		for _, ch := range channels {
			if channel, ok := ch.(map[string]interface{}); ok {
				if channel["type"] == "sms" {
					sub.Phone = channel["value"].(string)
				}
			}
		}
	}

	return sub, nil
}

// GetLists returns all contact groups
func (c *ESputnikClient) GetLists(ctx context.Context) ([]List, error) {
	resp, err := c.doRequest(ctx, "GET", "/groups", nil)
	if err != nil {
		return nil, err
	}

	lists := make([]List, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})
			list := List{
				ID:   fmt.Sprintf("%.0f", itemMap["id"].(float64)),
				Name: itemMap["name"].(string),
			}
			if count, ok := itemMap["contactsCount"].(float64); ok {
				list.Subscribers = int(count)
			}
			lists = append(lists, list)
		}
	}

	return lists, nil
}

// CreateCampaign creates email campaign
func (c *ESputnikClient) CreateCampaign(ctx context.Context, campaign *Campaign) (*Campaign, error) {
	payload := map[string]interface{}{
		"name":        campaign.Name,
		"subject":     campaign.Subject,
		"from":        campaign.From,
		"fromName":    campaign.FromName,
		"htmlContent": campaign.HTML,
		"plainContent": campaign.Text,
		"groups":      campaign.Lists,
	}

	if campaign.ScheduledAt != nil {
		payload["startDate"] = campaign.ScheduledAt.Format(time.RFC3339)
	}

	resp, err := c.doRequest(ctx, "POST", "/messages/email", payload)
	if err != nil {
		return nil, err
	}

	result := &Campaign{
		Name:    campaign.Name,
		Subject: campaign.Subject,
		Status:  "draft",
	}

	if id, ok := resp["id"].(float64); ok {
		result.ID = fmt.Sprintf("%.0f", id)
	}

	return result, nil
}

// SendCampaign sends campaign immediately
func (c *ESputnikClient) SendCampaign(ctx context.Context, campaignID string) error {
	payload := map[string]interface{}{
		"immediately": true,
	}

	_, err := c.doRequest(ctx, "POST", "/messages/"+campaignID+"/send", payload)
	return err
}

// GetCampaignStats gets campaign statistics
func (c *ESputnikClient) GetCampaignStats(ctx context.Context, campaignID string) (*CampaignStats, error) {
	resp, err := c.doRequest(ctx, "GET", "/messages/"+campaignID+"/statistic", nil)
	if err != nil {
		return nil, err
	}

	stats := &CampaignStats{}

	if sent, ok := resp["sent"].(float64); ok {
		stats.Sent = int(sent)
	}
	if delivered, ok := resp["delivered"].(float64); ok {
		stats.Delivered = int(delivered)
	}
	if opened, ok := resp["opens"].(float64); ok {
		stats.Opened = int(opened)
	}
	if clicked, ok := resp["clicks"].(float64); ok {
		stats.Clicked = int(clicked)
	}
	if bounced, ok := resp["hardBounced"].(float64); ok {
		stats.Bounced = int(bounced)
	}
	if spam, ok := resp["spamReports"].(float64); ok {
		stats.Spam = int(spam)
	}
	if unsub, ok := resp["unsubscribed"].(float64); ok {
		stats.Unsubscribed = int(unsub)
	}

	if stats.Sent > 0 {
		stats.OpenRate = float64(stats.Opened) / float64(stats.Sent) * 100
		stats.ClickRate = float64(stats.Clicked) / float64(stats.Sent) * 100
	}

	return stats, nil
}

// SendSMS sends SMS via eSputnik
func (c *ESputnikClient) SendSMS(ctx context.Context, phone, text, sender string) error {
	payload := map[string]interface{}{
		"phone":      phone,
		"text":       text,
		"senderName": sender,
	}

	_, err := c.doRequest(ctx, "POST", "/message/sms", payload)
	return err
}

// SendViber sends Viber message via eSputnik
func (c *ESputnikClient) SendViber(ctx context.Context, phone, text, sender string, button *ViberButton, imageURL string) error {
	payload := map[string]interface{}{
		"phone":      phone,
		"text":       text,
		"senderName": sender,
	}

	if imageURL != "" {
		payload["imageUrl"] = imageURL
	}

	if button != nil {
		payload["button"] = map[string]string{
			"caption": button.Caption,
			"url":     button.URL,
		}
	}

	_, err := c.doRequest(ctx, "POST", "/message/viber", payload)
	return err
}

// ViberButton represents Viber button for eSputnik
type ViberButton struct {
	Caption string `json:"caption"`
	URL     string `json:"url"`
}

// TriggerEvent triggers automation event
func (c *ESputnikClient) TriggerEvent(ctx context.Context, eventType, keyValue string, params map[string]interface{}) error {
	payload := map[string]interface{}{
		"eventTypeKey": eventType,
		"keyValue":     keyValue,
		"params":       c.convertVariables(params),
	}

	_, err := c.doRequest(ctx, "POST", "/event", payload)
	return err
}

// AddOrder adds order for RFM analysis
func (c *ESputnikClient) AddOrder(ctx context.Context, order *ESputnikOrder) error {
	_, err := c.doRequest(ctx, "POST", "/orders", order)
	return err
}

// ESputnikOrder represents order for eSputnik
type ESputnikOrder struct {
	ExternalOrderID string              `json:"externalOrderId"`
	ExternalCustomerID string           `json:"externalCustomerId,omitempty"`
	TotalCost       float64             `json:"totalCost"`
	Status          string              `json:"status"`
	Date            string              `json:"date"`
	Email           string              `json:"email,omitempty"`
	Phone           string              `json:"phone,omitempty"`
	Items           []ESputnikOrderItem `json:"items"`
}

// ESputnikOrderItem represents order item
type ESputnikOrderItem struct {
	ExternalItemID string  `json:"externalItemId"`
	Name           string  `json:"name"`
	Category       string  `json:"category,omitempty"`
	Quantity       int     `json:"quantity"`
	Cost           float64 `json:"cost"`
	URL            string  `json:"url,omitempty"`
	ImageURL       string  `json:"imageUrl,omitempty"`
}

// CreateSegment creates dynamic segment
func (c *ESputnikClient) CreateSegment(ctx context.Context, name string, conditions []SegmentCondition) (string, error) {
	payload := map[string]interface{}{
		"name":       name,
		"conditions": conditions,
	}

	resp, err := c.doRequest(ctx, "POST", "/groups/dynamic", payload)
	if err != nil {
		return "", err
	}

	if id, ok := resp["id"].(float64); ok {
		return fmt.Sprintf("%.0f", id), nil
	}

	return "", nil
}

// SegmentCondition represents segment filter condition
type SegmentCondition struct {
	Field     string `json:"field"`
	Condition string `json:"condition"`
	Value     string `json:"value"`
}

func (c *ESputnikClient) findContact(ctx context.Context, email string) (map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "GET", "/contact?email="+email, nil)
	if err != nil {
		return nil, err
	}

	if contact, ok := resp["data"].(map[string]interface{}); ok {
		return contact, nil
	}

	return nil, nil
}

func (c *ESputnikClient) convertVariables(vars map[string]interface{}) []map[string]interface{} {
	if vars == nil {
		return nil
	}

	result := make([]map[string]interface{}, 0, len(vars))
	for k, v := range vars {
		result = append(result, map[string]interface{}{
			"name":  k,
			"value": fmt.Sprintf("%v", v),
		})
	}
	return result
}

func (c *ESputnikClient) doRequest(ctx context.Context, method, path string, payload interface{}) (map[string]interface{}, error) {
	var body io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, eSputnikAPIURL+path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// eSputnik uses Basic auth with API key as password
	auth := base64.StdEncoding.EncodeToString([]byte(":" + c.apiKey))
	req.Header.Set("Authorization", "Basic "+auth)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("eSputnik error: %s", string(respBody))
	}

	// Handle array response
	if len(respBody) > 0 && respBody[0] == '[' {
		var arr []interface{}
		if err := json.Unmarshal(respBody, &arr); err != nil {
			return nil, err
		}
		return map[string]interface{}{"data": arr}, nil
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		// Some endpoints return empty response
		if len(respBody) == 0 {
			return map[string]interface{}{}, nil
		}
		return nil, err
	}

	return result, nil
}
