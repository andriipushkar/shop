package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const sendPulseAPIURL = "https://api.sendpulse.com"

// SendPulseClient implements SendPulse email provider
type SendPulseClient struct {
	clientID     string
	clientSecret string
	httpClient   *http.Client

	mu          sync.RWMutex
	accessToken string
	tokenExpiry time.Time
}

// NewSendPulseClient creates SendPulse client
func NewSendPulseClient(clientID, clientSecret string) *SendPulseClient {
	return &SendPulseClient{
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *SendPulseClient) Name() string { return "sendpulse" }

// SendEmail sends transactional email via SMTP
func (c *SendPulseClient) SendEmail(ctx context.Context, email *Email) (*SendResult, error) {
	payload := map[string]interface{}{
		"email": map[string]interface{}{
			"subject": email.Subject,
			"from": map[string]string{
				"name":  email.FromName,
				"email": email.From,
			},
			"to": c.formatRecipients(email.To),
		},
	}

	if email.HTML != "" {
		payload["email"].(map[string]interface{})["html"] = email.HTML
	}
	if email.Text != "" {
		payload["email"].(map[string]interface{})["text"] = email.Text
	}
	if email.TemplateID != "" {
		payload["email"].(map[string]interface{})["template"] = map[string]interface{}{
			"id":        email.TemplateID,
			"variables": email.Variables,
		}
	}
	if len(email.CC) > 0 {
		payload["email"].(map[string]interface{})["cc"] = c.formatRecipients(email.CC)
	}
	if len(email.BCC) > 0 {
		payload["email"].(map[string]interface{})["bcc"] = c.formatRecipients(email.BCC)
	}
	if len(email.Attachments) > 0 {
		attachments := make([]map[string]interface{}, len(email.Attachments))
		for i, att := range email.Attachments {
			attachments[i] = map[string]interface{}{
				"name":    att.Filename,
				"content": att.Content,
				"type":    att.ContentType,
			}
		}
		payload["email"].(map[string]interface{})["attachments"] = attachments
	}

	resp, err := c.doRequest(ctx, "POST", "/smtp/emails", payload)
	if err != nil {
		return nil, err
	}

	result := &SendResult{
		Status: EmailStatusQueued,
	}

	if id, ok := resp["id"].(string); ok {
		result.MessageID = id
	}

	return result, nil
}

// AddSubscriber adds subscriber to address book
func (c *SendPulseClient) AddSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	payload := map[string]interface{}{
		"emails": []map[string]interface{}{
			{
				"email": sub.Email,
				"variables": map[string]interface{}{
					"name":       sub.FirstName,
					"last_name":  sub.LastName,
					"phone":      sub.Phone,
				},
			},
		},
	}

	_, err := c.doRequest(ctx, "POST", "/addressbooks/"+listID+"/emails", payload)
	return err
}

// RemoveSubscriber removes subscriber from address book
func (c *SendPulseClient) RemoveSubscriber(ctx context.Context, listID, email string) error {
	payload := map[string]interface{}{
		"emails": []string{email},
	}

	_, err := c.doRequest(ctx, "DELETE", "/addressbooks/"+listID+"/emails", payload)
	return err
}

// UpdateSubscriber updates subscriber info
func (c *SendPulseClient) UpdateSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	// SendPulse uses add with same email to update
	return c.AddSubscriber(ctx, listID, sub)
}

// GetSubscriber gets subscriber by email
func (c *SendPulseClient) GetSubscriber(ctx context.Context, listID, email string) (*Subscriber, error) {
	resp, err := c.doRequest(ctx, "GET", "/addressbooks/"+listID+"/emails/"+url.PathEscape(email), nil)
	if err != nil {
		return nil, err
	}

	sub := &Subscriber{
		Email: email,
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		if vars, ok := data["variables"].(map[string]interface{}); ok {
			if name, ok := vars["name"].(string); ok {
				sub.FirstName = name
			}
			if lastName, ok := vars["last_name"].(string); ok {
				sub.LastName = lastName
			}
			if phone, ok := vars["phone"].(string); ok {
				sub.Phone = phone
			}
		}
		if status, ok := data["status"].(float64); ok {
			switch int(status) {
			case 0:
				sub.Status = "new"
			case 1:
				sub.Status = "active"
			case 2:
				sub.Status = "unsubscribed"
			case 3:
				sub.Status = "bounced"
			}
		}
	}

	return sub, nil
}

// GetLists returns all address books
func (c *SendPulseClient) GetLists(ctx context.Context) ([]List, error) {
	resp, err := c.doRequest(ctx, "GET", "/addressbooks", nil)
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
			if count, ok := itemMap["all_email_qty"].(float64); ok {
				list.Subscribers = int(count)
			}
			lists = append(lists, list)
		}
	}

	return lists, nil
}

// CreateCampaign creates email campaign
func (c *SendPulseClient) CreateCampaign(ctx context.Context, campaign *Campaign) (*Campaign, error) {
	payload := map[string]interface{}{
		"name":        campaign.Name,
		"subject":     campaign.Subject,
		"sender_name": campaign.FromName,
		"sender_email": campaign.From,
		"list_id":     campaign.Lists,
	}

	if campaign.HTML != "" {
		payload["body"] = campaign.HTML
	}
	if campaign.TemplateID != "" {
		payload["template_id"] = campaign.TemplateID
	}
	if campaign.ScheduledAt != nil {
		payload["send_date"] = campaign.ScheduledAt.Format("2006-01-02 15:04:05")
	}

	resp, err := c.doRequest(ctx, "POST", "/campaigns", payload)
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

// SendCampaign sends campaign
func (c *SendPulseClient) SendCampaign(ctx context.Context, campaignID string) error {
	_, err := c.doRequest(ctx, "POST", "/campaigns/"+campaignID+"/send", nil)
	return err
}

// GetCampaignStats gets campaign statistics
func (c *SendPulseClient) GetCampaignStats(ctx context.Context, campaignID string) (*CampaignStats, error) {
	resp, err := c.doRequest(ctx, "GET", "/campaigns/"+campaignID+"/stat", nil)
	if err != nil {
		return nil, err
	}

	stats := &CampaignStats{}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		if sent, ok := data["sent"].(float64); ok {
			stats.Sent = int(sent)
		}
		if delivered, ok := data["delivered"].(float64); ok {
			stats.Delivered = int(delivered)
		}
		if opened, ok := data["opened"].(float64); ok {
			stats.Opened = int(opened)
		}
		if clicked, ok := data["clicked"].(float64); ok {
			stats.Clicked = int(clicked)
		}
		if bounced, ok := data["bounced"].(float64); ok {
			stats.Bounced = int(bounced)
		}
		if spam, ok := data["spam"].(float64); ok {
			stats.Spam = int(spam)
		}
		if unsub, ok := data["unsubscribed"].(float64); ok {
			stats.Unsubscribed = int(unsub)
		}
	}

	if stats.Sent > 0 {
		stats.OpenRate = float64(stats.Opened) / float64(stats.Sent) * 100
		stats.ClickRate = float64(stats.Clicked) / float64(stats.Sent) * 100
	}

	return stats, nil
}

// CreateTemplate creates email template
func (c *SendPulseClient) CreateTemplate(ctx context.Context, template *Template) (*Template, error) {
	payload := map[string]interface{}{
		"name": template.Name,
		"body": template.HTML,
	}

	if template.Subject != "" {
		payload["subject"] = template.Subject
	}

	resp, err := c.doRequest(ctx, "POST", "/templates", payload)
	if err != nil {
		return nil, err
	}

	result := &Template{
		Name: template.Name,
		HTML: template.HTML,
	}

	if id, ok := resp["real_id"].(float64); ok {
		result.ID = fmt.Sprintf("%.0f", id)
	}

	return result, nil
}

// GetTemplates returns all templates
func (c *SendPulseClient) GetTemplates(ctx context.Context) ([]Template, error) {
	resp, err := c.doRequest(ctx, "GET", "/templates", nil)
	if err != nil {
		return nil, err
	}

	templates := make([]Template, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})
			tpl := Template{
				ID:   fmt.Sprintf("%.0f", itemMap["real_id"].(float64)),
				Name: itemMap["name"].(string),
			}
			templates = append(templates, tpl)
		}
	}

	return templates, nil
}

// SendPush sends web push notification
func (c *SendPulseClient) SendPush(ctx context.Context, websiteID, title, body, link string) error {
	payload := map[string]interface{}{
		"website_id": websiteID,
		"title":      title,
		"body":       body,
		"link":       link,
	}

	_, err := c.doRequest(ctx, "POST", "/push/tasks", payload)
	return err
}

// CreateAutomation creates automation flow
func (c *SendPulseClient) CreateAutomation(ctx context.Context, name string, triggerType string, listID string) (string, error) {
	payload := map[string]interface{}{
		"name":         name,
		"trigger_type": triggerType,
		"list_id":      listID,
	}

	resp, err := c.doRequest(ctx, "POST", "/automation360/autoresponders", payload)
	if err != nil {
		return "", err
	}

	if id, ok := resp["id"].(float64); ok {
		return fmt.Sprintf("%.0f", id), nil
	}

	return "", nil
}

func (c *SendPulseClient) formatRecipients(emails []string) []map[string]string {
	recipients := make([]map[string]string, len(emails))
	for i, email := range emails {
		recipients[i] = map[string]string{"email": email}
	}
	return recipients
}

func (c *SendPulseClient) getAccessToken(ctx context.Context) (string, error) {
	c.mu.RLock()
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry) {
		token := c.accessToken
		c.mu.RUnlock()
		return token, nil
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()

	// Double-check after acquiring write lock
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry) {
		return c.accessToken, nil
	}

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)

	req, _ := http.NewRequestWithContext(ctx, "POST", sendPulseAPIURL+"/oauth/access_token",
		strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	c.accessToken = result.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn-60) * time.Second)

	return c.accessToken, nil
}

func (c *SendPulseClient) doRequest(ctx context.Context, method, path string, payload interface{}) (map[string]interface{}, error) {
	token, err := c.getAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	var body io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, sendPulseAPIURL+path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

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
		return nil, err
	}

	if errMsg, ok := result["error"].(string); ok && errMsg != "" {
		return nil, fmt.Errorf("SendPulse error: %s", errMsg)
	}

	return result, nil
}
