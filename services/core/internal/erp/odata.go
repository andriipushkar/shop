package erp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ODataClient provides common OData functionality for 1C/BAS
type ODataClient struct {
	baseURL    string
	username   string
	password   string
	httpClient *http.Client
}

// NewODataClient creates OData client
func NewODataClient(baseURL, username, password string) *ODataClient {
	return &ODataClient{
		baseURL:    strings.TrimSuffix(baseURL, "/"),
		username:   username,
		password:   password,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// ODataResponse represents OData response wrapper
type ODataResponse struct {
	Context  string        `json:"@odata.context,omitempty"`
	Value    []interface{} `json:"value,omitempty"`
	NextLink string        `json:"@odata.nextLink,omitempty"`
}

// Get performs GET request
func (c *ODataClient) Get(ctx context.Context, entity string, filter string, select_ string, expand string) ([]map[string]interface{}, error) {
	params := url.Values{}
	params.Set("$format", "json")

	if filter != "" {
		params.Set("$filter", filter)
	}
	if select_ != "" {
		params.Set("$select", select_)
	}
	if expand != "" {
		params.Set("$expand", expand)
	}

	reqURL := fmt.Sprintf("%s/%s?%s", c.baseURL, entity, params.Encode())

	var allResults []map[string]interface{}

	for reqURL != "" {
		resp, err := c.doRequest(ctx, "GET", reqURL, nil)
		if err != nil {
			return nil, err
		}

		var odataResp ODataResponse
		if err := json.Unmarshal(resp, &odataResp); err != nil {
			return nil, err
		}

		for _, item := range odataResp.Value {
			if m, ok := item.(map[string]interface{}); ok {
				allResults = append(allResults, m)
			}
		}

		reqURL = odataResp.NextLink
	}

	return allResults, nil
}

// GetByID gets single entity by ID
func (c *ODataClient) GetByID(ctx context.Context, entity, id string) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/%s(guid'%s')?$format=json", c.baseURL, entity, id)

	resp, err := c.doRequest(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// Create creates new entity
func (c *ODataClient) Create(ctx context.Context, entity string, data map[string]interface{}) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/%s", c.baseURL, entity)

	body, _ := json.Marshal(data)
	resp, err := c.doRequest(ctx, "POST", reqURL, body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// Update updates entity
func (c *ODataClient) Update(ctx context.Context, entity, id string, data map[string]interface{}) error {
	reqURL := fmt.Sprintf("%s/%s(guid'%s')", c.baseURL, entity, id)

	body, _ := json.Marshal(data)
	_, err := c.doRequest(ctx, "PATCH", reqURL, body)
	return err
}

// Delete deletes entity
func (c *ODataClient) Delete(ctx context.Context, entity, id string) error {
	reqURL := fmt.Sprintf("%s/%s(guid'%s')", c.baseURL, entity, id)
	_, err := c.doRequest(ctx, "DELETE", reqURL, nil)
	return err
}

// ExecuteMethod executes 1C method
func (c *ODataClient) ExecuteMethod(ctx context.Context, method string, params map[string]interface{}) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/%s", c.baseURL, method)

	body, _ := json.Marshal(params)
	resp, err := c.doRequest(ctx, "POST", reqURL, body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func (c *ODataClient) doRequest(ctx context.Context, method, urlStr string, body []byte) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, urlStr, bodyReader)
	if err != nil {
		return nil, err
	}

	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("OData error %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// ParseDateTime parses 1C datetime format
func ParseDateTime(value interface{}) *time.Time {
	if value == nil {
		return nil
	}

	str, ok := value.(string)
	if !ok {
		return nil
	}

	// 1C OData date format
	formats := []string{
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05-07:00",
		"2006-01-02",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, str); err == nil {
			return &t
		}
	}

	return nil
}

// FormatDateTime formats time for 1C OData
func FormatDateTime(t time.Time) string {
	return t.Format("2006-01-02T15:04:05")
}
