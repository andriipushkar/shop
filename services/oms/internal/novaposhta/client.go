package novaposhta

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	APIEndpoint = "https://api.novaposhta.ua/v2.0/json/"
)

// Client handles Nova Poshta API requests
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Nova Poshta API client
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Request represents a generic Nova Poshta API request
type Request struct {
	APIKey           string      `json:"apiKey"`
	ModelName        string      `json:"modelName"`
	CalledMethod     string      `json:"calledMethod"`
	MethodProperties interface{} `json:"methodProperties"`
}

// Response represents a generic Nova Poshta API response
type Response struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Errors  []string        `json:"errors"`
	Warnings []string       `json:"warnings"`
}

// City represents a city from Nova Poshta
type City struct {
	Ref         string `json:"Ref"`
	Description string `json:"Description"`
	DescriptionRu string `json:"DescriptionRu"`
	Area        string `json:"Area"`
	SettlementType string `json:"SettlementType"`
	AreaDescription string `json:"AreaDescription"`
}

// Warehouse represents a warehouse/branch from Nova Poshta
type Warehouse struct {
	Ref                string `json:"Ref"`
	SiteKey            string `json:"SiteKey"`
	Description        string `json:"Description"`
	DescriptionRu      string `json:"DescriptionRu"`
	ShortAddress       string `json:"ShortAddress"`
	ShortAddressRu     string `json:"ShortAddressRu"`
	Phone              string `json:"Phone"`
	TypeOfWarehouse    string `json:"TypeOfWarehouse"`
	Number             string `json:"Number"`
	CityRef            string `json:"CityRef"`
	CityDescription    string `json:"CityDescription"`
	Longitude          string `json:"Longitude"`
	Latitude           string `json:"Latitude"`
	PostFinance        string `json:"PostFinance"`
	BicycleParking     string `json:"BicycleParking"`
	PaymentAccess      string `json:"PaymentAccess"`
	POSTerminal        string `json:"POSTerminal"`
	InternationalShipping string `json:"InternationalShipping"`
	TotalMaxWeightAllowed string `json:"TotalMaxWeightAllowed"`
	PlaceMaxWeightAllowed string `json:"PlaceMaxWeightAllowed"`
	ReceivingLimitationsOnDimensions interface{} `json:"ReceivingLimitationsOnDimensions"`
	Schedule           interface{} `json:"Schedule"`
}

// TrackingInfo represents tracking information
type TrackingInfo struct {
	Number                string `json:"Number"`
	StatusCode            string `json:"StatusCode"`
	Status                string `json:"Status"`
	ScheduledDeliveryDate string `json:"ScheduledDeliveryDate"`
	ActualDeliveryDate    string `json:"ActualDeliveryDate"`
	RecipientDateTime     string `json:"RecipientDateTime"`
	CitySender            string `json:"CitySender"`
	CityRecipient         string `json:"CityRecipient"`
	WarehouseRecipient    string `json:"WarehouseRecipient"`
	WarehouseSender       string `json:"WarehouseSender"`
	RecipientFullName     string `json:"RecipientFullName"`
	DocumentWeight        string `json:"DocumentWeight"`
	DateCreated           string `json:"DateCreated"`
	DateScan              string `json:"DateScan"`
	PaymentMethod         string `json:"PaymentMethod"`
	PaymentStatus         string `json:"PaymentStatus"`
}

func (c *Client) doRequest(ctx context.Context, req *Request) (*Response, error) {
	req.APIKey = c.apiKey

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, APIEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var response Response
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !response.Success && len(response.Errors) > 0 {
		return nil, fmt.Errorf("API error: %v", response.Errors)
	}

	return &response, nil
}

// SearchCities searches for cities by name
func (c *Client) SearchCities(ctx context.Context, query string, limit int) ([]City, error) {
	if limit == 0 {
		limit = 20
	}

	req := &Request{
		ModelName:    "Address",
		CalledMethod: "searchSettlements",
		MethodProperties: map[string]interface{}{
			"CityName": query,
			"Limit":    limit,
		},
	}

	resp, err := c.doRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	var result struct {
		Addresses []City `json:"Addresses"`
	}
	if err := json.Unmarshal(resp.Data, &[]interface{}{&result}); err != nil {
		// Try direct unmarshal
		var cities []City
		if err := json.Unmarshal(resp.Data, &cities); err != nil {
			return nil, fmt.Errorf("failed to parse cities: %w", err)
		}
		return cities, nil
	}

	return result.Addresses, nil
}

// GetWarehouses returns warehouses for a city
func (c *Client) GetWarehouses(ctx context.Context, cityRef string, warehouseType string, limit int) ([]Warehouse, error) {
	if limit == 0 {
		limit = 50
	}

	props := map[string]interface{}{
		"CityRef": cityRef,
		"Limit":   limit,
	}

	if warehouseType != "" {
		props["TypeOfWarehouseRef"] = warehouseType
	}

	req := &Request{
		ModelName:        "Address",
		CalledMethod:     "getWarehouses",
		MethodProperties: props,
	}

	resp, err := c.doRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	var warehouses []Warehouse
	if err := json.Unmarshal(resp.Data, &warehouses); err != nil {
		return nil, fmt.Errorf("failed to parse warehouses: %w", err)
	}

	return warehouses, nil
}

// SearchWarehouses searches for warehouses by string query
func (c *Client) SearchWarehouses(ctx context.Context, cityName string, query string, limit int) ([]Warehouse, error) {
	if limit == 0 {
		limit = 20
	}

	req := &Request{
		ModelName:    "Address",
		CalledMethod: "getWarehouses",
		MethodProperties: map[string]interface{}{
			"CityName":        cityName,
			"FindByString":    query,
			"Limit":           limit,
		},
	}

	resp, err := c.doRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	var warehouses []Warehouse
	if err := json.Unmarshal(resp.Data, &warehouses); err != nil {
		return nil, fmt.Errorf("failed to parse warehouses: %w", err)
	}

	return warehouses, nil
}

// TrackDocument tracks a parcel by TTN number
func (c *Client) TrackDocument(ctx context.Context, trackingNumber string) (*TrackingInfo, error) {
	req := &Request{
		ModelName:    "TrackingDocument",
		CalledMethod: "getStatusDocuments",
		MethodProperties: map[string]interface{}{
			"Documents": []map[string]string{
				{"DocumentNumber": trackingNumber},
			},
		},
	}

	resp, err := c.doRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	var trackingList []TrackingInfo
	if err := json.Unmarshal(resp.Data, &trackingList); err != nil {
		return nil, fmt.Errorf("failed to parse tracking: %w", err)
	}

	if len(trackingList) == 0 {
		return nil, fmt.Errorf("tracking not found")
	}

	return &trackingList[0], nil
}

// TrackMultiple tracks multiple parcels at once
func (c *Client) TrackMultiple(ctx context.Context, trackingNumbers []string) ([]TrackingInfo, error) {
	docs := make([]map[string]string, len(trackingNumbers))
	for i, num := range trackingNumbers {
		docs[i] = map[string]string{"DocumentNumber": num}
	}

	req := &Request{
		ModelName:    "TrackingDocument",
		CalledMethod: "getStatusDocuments",
		MethodProperties: map[string]interface{}{
			"Documents": docs,
		},
	}

	resp, err := c.doRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	var trackingList []TrackingInfo
	if err := json.Unmarshal(resp.Data, &trackingList); err != nil {
		return nil, fmt.Errorf("failed to parse tracking: %w", err)
	}

	return trackingList, nil
}

// Status codes mapping (Ukrainian)
var StatusMap = map[string]string{
	"1":   "Відправлення очікує відправника",
	"2":   "Видалено",
	"3":   "Номер не знайдено",
	"4":   "Відправлення у місті відправника",
	"5":   "Відправлення прямує до міста отримувача",
	"6":   "Відправлення у місті отримувача",
	"7":   "Відправлення прибуло на склад отримувача",
	"8":   "Відправлення прибуло на відділення",
	"9":   "Відправлення отримано",
	"10":  "Відправлення у процесі доставки",
	"11":  "Відправлення у процесі доставки (адресна)",
	"14":  "Відправлення отримано отримувачем",
	"101": "Відправлення на шляху до відправника",
	"102": "Відправлення повертається",
	"103": "Відправлення повернуто",
	"104": "Адреса змінена",
	"105": "Припинено зберігання",
	"106": "Одержано грошовий переказ",
	"107": "Виплачено",
	"108": "Підготовлено до зворотної доставки",
}

// GetStatusDescription returns human-readable status
func GetStatusDescription(code string) string {
	if desc, ok := StatusMap[code]; ok {
		return desc
	}
	return "Невідомий статус"
}
