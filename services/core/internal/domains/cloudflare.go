package domains

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// CloudflareProvider implements DNSProvider for Cloudflare
type CloudflareProvider struct {
	apiToken string
	client   *http.Client
	baseURL  string
}

// NewCloudflareProvider creates Cloudflare DNS provider
func NewCloudflareProvider(apiToken string) *CloudflareProvider {
	return &CloudflareProvider{
		apiToken: apiToken,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: "https://api.cloudflare.com/client/v4",
	}
}

// CloudflareError represents API error
type CloudflareError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// CloudflareResponse represents API response
type CloudflareResponse struct {
	Success  bool              `json:"success"`
	Errors   []CloudflareError `json:"errors"`
	Messages []string          `json:"messages"`
	Result   json.RawMessage   `json:"result"`
}

// ZoneResult represents zone lookup result
type ZoneResult struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// DNSRecordResult represents DNS record result
type DNSRecordResult struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	TTL     int    `json:"ttl"`
	Proxied bool   `json:"proxied"`
}

// GetZoneID retrieves zone ID for a domain
func (p *CloudflareProvider) GetZoneID(ctx context.Context, domain string) (string, error) {
	// Extract root domain (last two parts)
	rootDomain := extractRootDomain(domain)

	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("%s/zones?name=%s", p.baseURL, rootDomain), nil)
	if err != nil {
		return "", err
	}

	resp, err := p.doRequest(req)
	if err != nil {
		return "", err
	}

	var zones struct {
		Result []ZoneResult `json:"result"`
	}
	if err := json.Unmarshal(resp.Result, &zones.Result); err != nil {
		return "", err
	}

	if len(zones.Result) == 0 {
		return "", errors.New("zone not found")
	}

	return zones.Result[0].ID, nil
}

// CreateRecord creates a DNS record
func (p *CloudflareProvider) CreateRecord(ctx context.Context, zoneID string, record DNSRecord) (string, error) {
	body := map[string]interface{}{
		"type":    record.Type,
		"name":    record.Name,
		"content": record.Value,
		"ttl":     record.TTL,
		"proxied": record.Proxied,
	}

	if record.Priority > 0 {
		body["priority"] = record.Priority
	}

	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/zones/%s/dns_records", p.baseURL, zoneID),
		bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}

	resp, err := p.doRequest(req)
	if err != nil {
		return "", err
	}

	var result DNSRecordResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return "", err
	}

	return result.ID, nil
}

// UpdateRecord updates a DNS record
func (p *CloudflareProvider) UpdateRecord(ctx context.Context, zoneID, recordID string, record DNSRecord) error {
	body := map[string]interface{}{
		"type":    record.Type,
		"name":    record.Name,
		"content": record.Value,
		"ttl":     record.TTL,
		"proxied": record.Proxied,
	}

	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "PUT",
		fmt.Sprintf("%s/zones/%s/dns_records/%s", p.baseURL, zoneID, recordID),
		bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}

	_, err = p.doRequest(req)
	return err
}

// DeleteRecord deletes a DNS record
func (p *CloudflareProvider) DeleteRecord(ctx context.Context, zoneID, recordID string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE",
		fmt.Sprintf("%s/zones/%s/dns_records/%s", p.baseURL, zoneID, recordID), nil)
	if err != nil {
		return err
	}

	_, err = p.doRequest(req)
	return err
}

// ListRecords lists all DNS records for a zone
func (p *CloudflareProvider) ListRecords(ctx context.Context, zoneID string) ([]DNSRecord, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("%s/zones/%s/dns_records", p.baseURL, zoneID), nil)
	if err != nil {
		return nil, err
	}

	resp, err := p.doRequest(req)
	if err != nil {
		return nil, err
	}

	var results []DNSRecordResult
	if err := json.Unmarshal(resp.Result, &results); err != nil {
		return nil, err
	}

	records := make([]DNSRecord, len(results))
	for i, r := range results {
		records[i] = DNSRecord{
			Type:    r.Type,
			Name:    r.Name,
			Value:   r.Content,
			TTL:     r.TTL,
			Proxied: r.Proxied,
		}
	}

	return records, nil
}

// doRequest executes HTTP request with auth
func (p *CloudflareProvider) doRequest(req *http.Request) (*CloudflareResponse, error) {
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiToken))
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var cfResp CloudflareResponse
	if err := json.Unmarshal(body, &cfResp); err != nil {
		return nil, err
	}

	if !cfResp.Success {
		if len(cfResp.Errors) > 0 {
			return nil, fmt.Errorf("cloudflare error: %s", cfResp.Errors[0].Message)
		}
		return nil, errors.New("cloudflare request failed")
	}

	return &cfResp, nil
}

// ==================== Cloudflare SSL for SaaS ====================

// CloudflareSSLProvider implements SSLProvider using Cloudflare SSL for SaaS
type CloudflareSSLProvider struct {
	apiToken string
	zoneID   string
	client   *http.Client
	baseURL  string
}

// NewCloudflareSSLProvider creates Cloudflare SSL provider
func NewCloudflareSSLProvider(apiToken, zoneID string) *CloudflareSSLProvider {
	return &CloudflareSSLProvider{
		apiToken: apiToken,
		zoneID:   zoneID,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: "https://api.cloudflare.com/client/v4",
	}
}

// CustomHostname represents Cloudflare custom hostname
type CustomHostname struct {
	ID                string             `json:"id"`
	Hostname          string             `json:"hostname"`
	SSL               *CustomHostnameSSL `json:"ssl,omitempty"`
	Status            string             `json:"status"`
	VerificationErrors []string          `json:"verification_errors,omitempty"`
	CreatedAt         time.Time          `json:"created_at"`
}

// CustomHostnameSSL represents SSL configuration
type CustomHostnameSSL struct {
	ID               string    `json:"id,omitempty"`
	Status           string    `json:"status"`
	Method           string    `json:"method"`
	Type             string    `json:"type"`
	CertificateAuthority string `json:"certificate_authority,omitempty"`
	ValidationRecords []ValidationRecord `json:"validation_records,omitempty"`
	ExpiresOn        *time.Time `json:"expires_on,omitempty"`
}

// ValidationRecord for SSL validation
type ValidationRecord struct {
	Status   string `json:"status"`
	TxtName  string `json:"txt_name,omitempty"`
	TxtValue string `json:"txt_value,omitempty"`
	HTTPUrl  string `json:"http_url,omitempty"`
	HTTPBody string `json:"http_body,omitempty"`
}

// ProvisionCertificate provisions SSL via Cloudflare SSL for SaaS
func (p *CloudflareSSLProvider) ProvisionCertificate(ctx context.Context, domain string) (*SSLCertificate, error) {
	// Create custom hostname
	body := map[string]interface{}{
		"hostname": domain,
		"ssl": map[string]interface{}{
			"method": "http", // or "txt" for DNS validation
			"type":   "dv",   // Domain Validation
		},
	}

	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/zones/%s/custom_hostnames", p.baseURL, p.zoneID),
		bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiToken))
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body2, _ := io.ReadAll(resp.Body)

	var cfResp struct {
		Success bool           `json:"success"`
		Result  CustomHostname `json:"result"`
		Errors  []CloudflareError `json:"errors"`
	}
	if err := json.Unmarshal(body2, &cfResp); err != nil {
		return nil, err
	}

	if !cfResp.Success {
		if len(cfResp.Errors) > 0 {
			return nil, fmt.Errorf("cloudflare error: %s", cfResp.Errors[0].Message)
		}
		return nil, errors.New("failed to create custom hostname")
	}

	// Map to SSLCertificate
	cert := &SSLCertificate{
		ID:       cfResp.Result.ID,
		Domain:   domain,
		Provider: "cloudflare",
		Status:   mapCloudflareSSLStatus(cfResp.Result.SSL.Status),
		IssuedAt: cfResp.Result.CreatedAt,
	}

	if cfResp.Result.SSL.ExpiresOn != nil {
		cert.ExpiresAt = *cfResp.Result.SSL.ExpiresOn
	}

	return cert, nil
}

// GetCertificateStatus checks certificate status
func (p *CloudflareSSLProvider) GetCertificateStatus(ctx context.Context, certID string) (SSLStatus, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("%s/zones/%s/custom_hostnames/%s", p.baseURL, p.zoneID, certID), nil)
	if err != nil {
		return SSLFailed, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiToken))

	resp, err := p.client.Do(req)
	if err != nil {
		return SSLFailed, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var cfResp struct {
		Success bool           `json:"success"`
		Result  CustomHostname `json:"result"`
	}
	if err := json.Unmarshal(body, &cfResp); err != nil {
		return SSLFailed, err
	}

	if !cfResp.Success || cfResp.Result.SSL == nil {
		return SSLFailed, nil
	}

	return mapCloudflareSSLStatus(cfResp.Result.SSL.Status), nil
}

// RenewCertificate renews certificate (Cloudflare handles auto-renewal)
func (p *CloudflareSSLProvider) RenewCertificate(ctx context.Context, certID string) (*SSLCertificate, error) {
	// Cloudflare SSL for SaaS handles auto-renewal
	// Just return current status
	status, err := p.GetCertificateStatus(ctx, certID)
	if err != nil {
		return nil, err
	}

	return &SSLCertificate{
		ID:       certID,
		Provider: "cloudflare",
		Status:   status,
	}, nil
}

// RevokeCertificate removes custom hostname (revokes SSL)
func (p *CloudflareSSLProvider) RevokeCertificate(ctx context.Context, certID string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE",
		fmt.Sprintf("%s/zones/%s/custom_hostnames/%s", p.baseURL, p.zoneID, certID), nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiToken))

	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func mapCloudflareSSLStatus(status string) SSLStatus {
	switch status {
	case "active":
		return SSLActive
	case "pending", "pending_validation", "pending_issuance", "pending_deployment":
		return SSLProvisioning
	case "expired":
		return SSLExpired
	default:
		return SSLFailed
	}
}

// extractRootDomain extracts root domain from full domain
func extractRootDomain(domain string) string {
	parts := splitDomain(domain)
	if len(parts) >= 2 {
		return parts[len(parts)-2] + "." + parts[len(parts)-1]
	}
	return domain
}

func splitDomain(domain string) []string {
	var parts []string
	current := ""
	for _, c := range domain {
		if c == '.' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}
