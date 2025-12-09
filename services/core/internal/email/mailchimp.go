package email

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// MailchimpClient implements Mailchimp email provider
type MailchimpClient struct {
	apiKey     string
	server     string // e.g., "us1", "us2", etc.
	httpClient *http.Client
}

// NewMailchimpClient creates Mailchimp client
func NewMailchimpClient(apiKey string) *MailchimpClient {
	// Extract server from API key (format: key-server)
	parts := strings.Split(apiKey, "-")
	server := "us1"
	if len(parts) > 1 {
		server = parts[len(parts)-1]
	}

	return &MailchimpClient{
		apiKey:     apiKey,
		server:     server,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *MailchimpClient) Name() string { return "mailchimp" }

func (c *MailchimpClient) apiURL() string {
	return fmt.Sprintf("https://%s.api.mailchimp.com/3.0", c.server)
}

// SendEmail sends transactional email via Mandrill/Mailchimp Transactional
func (c *MailchimpClient) SendEmail(ctx context.Context, email *Email) (*SendResult, error) {
	// Note: Mailchimp Marketing API doesn't support transactional emails directly
	// This uses the Mailchimp Transactional (Mandrill) API
	// For production, use separate Mandrill API key

	// For now, create a campaign and send immediately
	campaign, err := c.CreateCampaign(ctx, &Campaign{
		Name:     "Transactional: " + email.Subject,
		Subject:  email.Subject,
		From:     email.From,
		FromName: email.FromName,
		HTML:     email.HTML,
		Text:     email.Text,
	})
	if err != nil {
		return nil, err
	}

	if err := c.SendCampaign(ctx, campaign.ID); err != nil {
		return nil, err
	}

	return &SendResult{
		MessageID: campaign.ID,
		Status:    EmailStatusSent,
	}, nil
}

// AddSubscriber adds member to list
func (c *MailchimpClient) AddSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	payload := map[string]interface{}{
		"email_address": sub.Email,
		"status":        "subscribed",
		"merge_fields": map[string]string{
			"FNAME": sub.FirstName,
			"LNAME": sub.LastName,
			"PHONE": sub.Phone,
		},
	}

	if sub.Tags != nil && len(sub.Tags) > 0 {
		payload["tags"] = sub.Tags
	}

	_, err := c.doRequest(ctx, "POST", "/lists/"+listID+"/members", payload)
	if err != nil {
		// Try update if member exists
		if strings.Contains(err.Error(), "already a list member") {
			return c.UpdateSubscriber(ctx, listID, sub)
		}
		return err
	}

	return nil
}

// RemoveSubscriber removes member from list (archives)
func (c *MailchimpClient) RemoveSubscriber(ctx context.Context, listID, email string) error {
	subscriberHash := c.emailHash(email)
	_, err := c.doRequest(ctx, "DELETE", "/lists/"+listID+"/members/"+subscriberHash, nil)
	return err
}

// UpdateSubscriber updates member info
func (c *MailchimpClient) UpdateSubscriber(ctx context.Context, listID string, sub *Subscriber) error {
	subscriberHash := c.emailHash(sub.Email)

	payload := map[string]interface{}{
		"merge_fields": map[string]string{
			"FNAME": sub.FirstName,
			"LNAME": sub.LastName,
			"PHONE": sub.Phone,
		},
	}

	if sub.Status != "" {
		payload["status"] = sub.Status
	}

	_, err := c.doRequest(ctx, "PATCH", "/lists/"+listID+"/members/"+subscriberHash, payload)
	return err
}

// GetSubscriber gets member by email
func (c *MailchimpClient) GetSubscriber(ctx context.Context, listID, email string) (*Subscriber, error) {
	subscriberHash := c.emailHash(email)

	resp, err := c.doRequest(ctx, "GET", "/lists/"+listID+"/members/"+subscriberHash, nil)
	if err != nil {
		return nil, err
	}

	sub := &Subscriber{
		Email: email,
	}

	if status, ok := resp["status"].(string); ok {
		sub.Status = status
	}

	if mergeFields, ok := resp["merge_fields"].(map[string]interface{}); ok {
		if fname, ok := mergeFields["FNAME"].(string); ok {
			sub.FirstName = fname
		}
		if lname, ok := mergeFields["LNAME"].(string); ok {
			sub.LastName = lname
		}
		if phone, ok := mergeFields["PHONE"].(string); ok {
			sub.Phone = phone
		}
	}

	if tags, ok := resp["tags"].([]interface{}); ok {
		sub.Tags = make([]string, len(tags))
		for i, tag := range tags {
			if tagMap, ok := tag.(map[string]interface{}); ok {
				if name, ok := tagMap["name"].(string); ok {
					sub.Tags[i] = name
				}
			}
		}
	}

	return sub, nil
}

// GetLists returns all lists/audiences
func (c *MailchimpClient) GetLists(ctx context.Context) ([]List, error) {
	resp, err := c.doRequest(ctx, "GET", "/lists?count=100", nil)
	if err != nil {
		return nil, err
	}

	lists := make([]List, 0)

	if data, ok := resp["lists"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})
			list := List{
				ID:   itemMap["id"].(string),
				Name: itemMap["name"].(string),
			}
			if stats, ok := itemMap["stats"].(map[string]interface{}); ok {
				if count, ok := stats["member_count"].(float64); ok {
					list.Subscribers = int(count)
				}
			}
			lists = append(lists, list)
		}
	}

	return lists, nil
}

// CreateCampaign creates email campaign
func (c *MailchimpClient) CreateCampaign(ctx context.Context, campaign *Campaign) (*Campaign, error) {
	// Create campaign
	payload := map[string]interface{}{
		"type": "regular",
		"recipients": map[string]interface{}{
			"list_id": campaign.Lists[0],
		},
		"settings": map[string]interface{}{
			"subject_line": campaign.Subject,
			"title":        campaign.Name,
			"from_name":    campaign.FromName,
			"reply_to":     campaign.From,
		},
	}

	if len(campaign.Segments) > 0 {
		payload["recipients"].(map[string]interface{})["segment_opts"] = map[string]interface{}{
			"saved_segment_id": campaign.Segments[0],
		}
	}

	resp, err := c.doRequest(ctx, "POST", "/campaigns", payload)
	if err != nil {
		return nil, err
	}

	campaignID := resp["id"].(string)

	// Set content
	if campaign.HTML != "" || campaign.Text != "" {
		contentPayload := map[string]interface{}{}
		if campaign.HTML != "" {
			contentPayload["html"] = campaign.HTML
		}
		if campaign.Text != "" {
			contentPayload["plain_text"] = campaign.Text
		}

		_, err = c.doRequest(ctx, "PUT", "/campaigns/"+campaignID+"/content", contentPayload)
		if err != nil {
			return nil, err
		}
	}

	result := &Campaign{
		ID:      campaignID,
		Name:    campaign.Name,
		Subject: campaign.Subject,
		Status:  "save",
	}

	return result, nil
}

// SendCampaign sends campaign
func (c *MailchimpClient) SendCampaign(ctx context.Context, campaignID string) error {
	_, err := c.doRequest(ctx, "POST", "/campaigns/"+campaignID+"/actions/send", nil)
	return err
}

// ScheduleCampaign schedules campaign
func (c *MailchimpClient) ScheduleCampaign(ctx context.Context, campaignID string, scheduleTime time.Time) error {
	payload := map[string]interface{}{
		"schedule_time": scheduleTime.Format(time.RFC3339),
	}

	_, err := c.doRequest(ctx, "POST", "/campaigns/"+campaignID+"/actions/schedule", payload)
	return err
}

// GetCampaignStats gets campaign statistics
func (c *MailchimpClient) GetCampaignStats(ctx context.Context, campaignID string) (*CampaignStats, error) {
	resp, err := c.doRequest(ctx, "GET", "/reports/"+campaignID, nil)
	if err != nil {
		return nil, err
	}

	stats := &CampaignStats{}

	if emailsSent, ok := resp["emails_sent"].(float64); ok {
		stats.Sent = int(emailsSent)
	}

	if opens, ok := resp["opens"].(map[string]interface{}); ok {
		if unique, ok := opens["unique_opens"].(float64); ok {
			stats.Opened = int(unique)
		}
		if rate, ok := opens["open_rate"].(float64); ok {
			stats.OpenRate = rate * 100
		}
	}

	if clicks, ok := resp["clicks"].(map[string]interface{}); ok {
		if unique, ok := clicks["unique_clicks"].(float64); ok {
			stats.Clicked = int(unique)
		}
		if rate, ok := clicks["click_rate"].(float64); ok {
			stats.ClickRate = rate * 100
		}
	}

	if bounces, ok := resp["bounces"].(map[string]interface{}); ok {
		if hard, ok := bounces["hard_bounces"].(float64); ok {
			stats.Bounced = int(hard)
		}
	}

	if unsubs, ok := resp["unsubscribed"].(float64); ok {
		stats.Unsubscribed = int(unsubs)
	}

	if abuseReports, ok := resp["abuse_reports"].(float64); ok {
		stats.Spam = int(abuseReports)
	}

	// Calculate delivered
	stats.Delivered = stats.Sent - stats.Bounced

	return stats, nil
}

// CreateTemplate creates email template
func (c *MailchimpClient) CreateTemplate(ctx context.Context, template *Template) (*Template, error) {
	payload := map[string]interface{}{
		"name": template.Name,
		"html": template.HTML,
	}

	resp, err := c.doRequest(ctx, "POST", "/templates", payload)
	if err != nil {
		return nil, err
	}

	result := &Template{
		Name: template.Name,
		HTML: template.HTML,
	}

	if id, ok := resp["id"].(float64); ok {
		result.ID = fmt.Sprintf("%.0f", id)
	}

	return result, nil
}

// GetTemplates returns all templates
func (c *MailchimpClient) GetTemplates(ctx context.Context) ([]Template, error) {
	resp, err := c.doRequest(ctx, "GET", "/templates?count=100", nil)
	if err != nil {
		return nil, err
	}

	templates := make([]Template, 0)

	if data, ok := resp["templates"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})
			tpl := Template{
				ID:   fmt.Sprintf("%.0f", itemMap["id"].(float64)),
				Name: itemMap["name"].(string),
			}
			templates = append(templates, tpl)
		}
	}

	return templates, nil
}

// CreateSegment creates segment in list
func (c *MailchimpClient) CreateSegment(ctx context.Context, listID, name string, conditions []SegmentCondition) (string, error) {
	mailchimpConditions := make([]map[string]interface{}, len(conditions))
	for i, cond := range conditions {
		mailchimpConditions[i] = map[string]interface{}{
			"field":    cond.Field,
			"op":       cond.Condition,
			"value":    cond.Value,
		}
	}

	payload := map[string]interface{}{
		"name": name,
		"options": map[string]interface{}{
			"match":      "all",
			"conditions": mailchimpConditions,
		},
	}

	resp, err := c.doRequest(ctx, "POST", "/lists/"+listID+"/segments", payload)
	if err != nil {
		return "", err
	}

	if id, ok := resp["id"].(float64); ok {
		return fmt.Sprintf("%.0f", id), nil
	}

	return "", nil
}

// SegmentCondition is now defined in esputnik.go

// AddTag adds tag to member
func (c *MailchimpClient) AddTag(ctx context.Context, listID, email string, tags []string) error {
	subscriberHash := c.emailHash(email)

	tagsList := make([]map[string]string, len(tags))
	for i, tag := range tags {
		tagsList[i] = map[string]string{
			"name":   tag,
			"status": "active",
		}
	}

	payload := map[string]interface{}{
		"tags": tagsList,
	}

	_, err := c.doRequest(ctx, "POST", "/lists/"+listID+"/members/"+subscriberHash+"/tags", payload)
	return err
}

// RemoveTag removes tag from member
func (c *MailchimpClient) RemoveTag(ctx context.Context, listID, email string, tags []string) error {
	subscriberHash := c.emailHash(email)

	tagsList := make([]map[string]string, len(tags))
	for i, tag := range tags {
		tagsList[i] = map[string]string{
			"name":   tag,
			"status": "inactive",
		}
	}

	payload := map[string]interface{}{
		"tags": tagsList,
	}

	_, err := c.doRequest(ctx, "POST", "/lists/"+listID+"/members/"+subscriberHash+"/tags", payload)
	return err
}

// CreateAutomation creates automation workflow
func (c *MailchimpClient) CreateAutomation(ctx context.Context, listID string, settings AutomationSettings) (string, error) {
	payload := map[string]interface{}{
		"recipients": map[string]string{
			"list_id": listID,
		},
		"trigger_settings": map[string]interface{}{
			"workflow_type": settings.TriggerType,
		},
		"settings": map[string]interface{}{
			"title":     settings.Name,
			"from_name": settings.FromName,
			"reply_to":  settings.ReplyTo,
		},
	}

	resp, err := c.doRequest(ctx, "POST", "/automations", payload)
	if err != nil {
		return "", err
	}

	if id, ok := resp["id"].(string); ok {
		return id, nil
	}

	return "", nil
}

// AutomationSettings represents automation settings
type AutomationSettings struct {
	Name        string `json:"name"`
	TriggerType string `json:"trigger_type"` // subscribedToList, api, etc.
	FromName    string `json:"from_name"`
	ReplyTo     string `json:"reply_to"`
}

// GetEcommerceStore creates or gets e-commerce store connection
func (c *MailchimpClient) CreateEcommerceStore(ctx context.Context, storeID, name, domain, currencyCode string) error {
	payload := map[string]interface{}{
		"id":            storeID,
		"list_id":       storeID, // Typically same as store ID
		"name":          name,
		"domain":        domain,
		"currency_code": currencyCode,
	}

	_, err := c.doRequest(ctx, "POST", "/ecommerce/stores", payload)
	return err
}

// AddEcommerceProduct adds product to store
func (c *MailchimpClient) AddEcommerceProduct(ctx context.Context, storeID string, product EcommerceProduct) error {
	_, err := c.doRequest(ctx, "POST", "/ecommerce/stores/"+storeID+"/products", product)
	return err
}

// EcommerceProduct represents e-commerce product
type EcommerceProduct struct {
	ID          string                   `json:"id"`
	Title       string                   `json:"title"`
	Handle      string                   `json:"handle,omitempty"`
	URL         string                   `json:"url,omitempty"`
	Description string                   `json:"description,omitempty"`
	Type        string                   `json:"type,omitempty"`
	Vendor      string                   `json:"vendor,omitempty"`
	ImageURL    string                   `json:"image_url,omitempty"`
	Variants    []EcommerceProductVariant `json:"variants"`
}

// EcommerceProductVariant represents product variant
type EcommerceProductVariant struct {
	ID    string  `json:"id"`
	Title string  `json:"title"`
	URL   string  `json:"url,omitempty"`
	SKU   string  `json:"sku,omitempty"`
	Price float64 `json:"price"`
}

// AddEcommerceOrder adds order to store
func (c *MailchimpClient) AddEcommerceOrder(ctx context.Context, storeID string, order EcommerceOrder) error {
	_, err := c.doRequest(ctx, "POST", "/ecommerce/stores/"+storeID+"/orders", order)
	return err
}

// EcommerceOrder represents e-commerce order
type EcommerceOrder struct {
	ID               string              `json:"id"`
	Customer         EcommerceCustomer   `json:"customer"`
	CurrencyCode     string              `json:"currency_code"`
	OrderTotal       float64             `json:"order_total"`
	TaxTotal         float64             `json:"tax_total,omitempty"`
	ShippingTotal    float64             `json:"shipping_total,omitempty"`
	ProcessedAtForeign string            `json:"processed_at_foreign,omitempty"`
	FinancialStatus  string              `json:"financial_status,omitempty"`
	FulfillmentStatus string             `json:"fulfillment_status,omitempty"`
	Lines            []EcommerceOrderLine `json:"lines"`
}

// EcommerceCustomer represents e-commerce customer
type EcommerceCustomer struct {
	ID           string `json:"id"`
	EmailAddress string `json:"email_address"`
	OptInStatus  bool   `json:"opt_in_status"`
	FirstName    string `json:"first_name,omitempty"`
	LastName     string `json:"last_name,omitempty"`
}

// EcommerceOrderLine represents order line item
type EcommerceOrderLine struct {
	ID               string  `json:"id"`
	ProductID        string  `json:"product_id"`
	ProductVariantID string  `json:"product_variant_id"`
	Quantity         int     `json:"quantity"`
	Price            float64 `json:"price"`
}

func (c *MailchimpClient) emailHash(email string) string {
	hash := md5.Sum([]byte(strings.ToLower(email)))
	return hex.EncodeToString(hash[:])
}

func (c *MailchimpClient) doRequest(ctx context.Context, method, path string, payload interface{}) (map[string]interface{}, error) {
	var body io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, c.apiURL()+path, body)
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth("anystring", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		var errResp struct {
			Title  string `json:"title"`
			Detail string `json:"detail"`
		}
		json.Unmarshal(respBody, &errResp)
		return nil, fmt.Errorf("Mailchimp error: %s - %s", errResp.Title, errResp.Detail)
	}

	if len(respBody) == 0 {
		return map[string]interface{}{}, nil
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return result, nil
}
