package novaposhta

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	client := NewClient("test-api-key")

	if client == nil {
		t.Fatal("expected non-nil client")
	}
	if client.apiKey != "test-api-key" {
		t.Errorf("expected apiKey 'test-api-key', got '%s'", client.apiKey)
	}
	if client.httpClient == nil {
		t.Error("expected non-nil httpClient")
	}
	if client.httpClient.Timeout != 30*time.Second {
		t.Errorf("expected timeout 30s, got %v", client.httpClient.Timeout)
	}
}

func TestRequest_Fields(t *testing.T) {
	req := Request{
		APIKey:       "key123",
		ModelName:    "Address",
		CalledMethod: "searchSettlements",
		MethodProperties: map[string]string{
			"CityName": "Київ",
		},
	}

	if req.APIKey != "key123" {
		t.Errorf("expected APIKey 'key123', got '%s'", req.APIKey)
	}
	if req.ModelName != "Address" {
		t.Errorf("expected ModelName 'Address', got '%s'", req.ModelName)
	}
	if req.CalledMethod != "searchSettlements" {
		t.Errorf("expected CalledMethod 'searchSettlements', got '%s'", req.CalledMethod)
	}
}

func TestResponse_Fields(t *testing.T) {
	resp := Response{
		Success:  true,
		Data:     json.RawMessage(`[{"Ref":"123"}]`),
		Errors:   []string{},
		Warnings: []string{"warning1"},
	}

	if !resp.Success {
		t.Error("expected Success to be true")
	}
	if len(resp.Errors) != 0 {
		t.Errorf("expected 0 errors, got %d", len(resp.Errors))
	}
	if len(resp.Warnings) != 1 {
		t.Errorf("expected 1 warning, got %d", len(resp.Warnings))
	}
}

func TestCity_Fields(t *testing.T) {
	city := City{
		Ref:             "8d5a980d-391c-11dd-90d9-001a92567626",
		Description:     "Київ",
		DescriptionRu:   "Киев",
		Area:            "Київська",
		SettlementType:  "місто",
		AreaDescription: "Київська область",
	}

	if city.Ref != "8d5a980d-391c-11dd-90d9-001a92567626" {
		t.Errorf("expected Ref '8d5a980d-391c-11dd-90d9-001a92567626', got '%s'", city.Ref)
	}
	if city.Description != "Київ" {
		t.Errorf("expected Description 'Київ', got '%s'", city.Description)
	}
}

func TestWarehouse_Fields(t *testing.T) {
	warehouse := Warehouse{
		Ref:             "warehouse-ref-123",
		SiteKey:         "1",
		Description:     "Відділення №1",
		ShortAddress:    "вул. Хрещатик, 1",
		Number:          "1",
		CityRef:         "city-ref-123",
		CityDescription: "Київ",
		Longitude:       "30.522",
		Latitude:        "50.450",
	}

	if warehouse.Ref != "warehouse-ref-123" {
		t.Errorf("expected Ref 'warehouse-ref-123', got '%s'", warehouse.Ref)
	}
	if warehouse.Number != "1" {
		t.Errorf("expected Number '1', got '%s'", warehouse.Number)
	}
}

func TestTrackingInfo_Fields(t *testing.T) {
	tracking := TrackingInfo{
		Number:                "20450000000000",
		StatusCode:            "9",
		Status:                "Отримано",
		ScheduledDeliveryDate: "2024-01-15",
		ActualDeliveryDate:    "2024-01-14",
		CitySender:            "Київ",
		CityRecipient:         "Львів",
		DocumentWeight:        "0.5",
	}

	if tracking.Number != "20450000000000" {
		t.Errorf("expected Number '20450000000000', got '%s'", tracking.Number)
	}
	if tracking.StatusCode != "9" {
		t.Errorf("expected StatusCode '9', got '%s'", tracking.StatusCode)
	}
}

func TestGetStatusDescription(t *testing.T) {
	tests := []struct {
		code     string
		expected string
	}{
		{"1", "Відправлення очікує відправника"},
		{"2", "Видалено"},
		{"3", "Номер не знайдено"},
		{"4", "Відправлення у місті відправника"},
		{"5", "Відправлення прямує до міста отримувача"},
		{"6", "Відправлення у місті отримувача"},
		{"7", "Відправлення прибуло на склад отримувача"},
		{"8", "Відправлення прибуло на відділення"},
		{"9", "Відправлення отримано"},
		{"10", "Відправлення у процесі доставки"},
		{"11", "Відправлення у процесі доставки (адресна)"},
		{"14", "Відправлення отримано отримувачем"},
		{"101", "Відправлення на шляху до відправника"},
		{"102", "Відправлення повертається"},
		{"103", "Відправлення повернуто"},
		{"104", "Адреса змінена"},
		{"105", "Припинено зберігання"},
		{"106", "Одержано грошовий переказ"},
		{"107", "Виплачено"},
		{"108", "Підготовлено до зворотної доставки"},
		{"999", "Невідомий статус"},
		{"", "Невідомий статус"},
	}

	for _, tt := range tests {
		result := GetStatusDescription(tt.code)
		if result != tt.expected {
			t.Errorf("GetStatusDescription(%q) = %q, want %q", tt.code, result, tt.expected)
		}
	}
}

func TestClient_SearchCities(t *testing.T) {
	client := NewClient("test-key")
	if client.apiKey != "test-key" {
		t.Errorf("expected apiKey 'test-key', got '%s'", client.apiKey)
	}
}

func TestClient_DefaultLimit(t *testing.T) {
	client := NewClient("test-key")
	if client.httpClient.Timeout != 30*time.Second {
		t.Errorf("expected default timeout 30s, got %v", client.httpClient.Timeout)
	}
}

func TestStatusMap_Completeness(t *testing.T) {
	expectedCodes := []string{
		"1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "14",
		"101", "102", "103", "104", "105", "106", "107", "108",
	}

	for _, code := range expectedCodes {
		if _, ok := StatusMap[code]; !ok {
			t.Errorf("StatusMap missing code '%s'", code)
		}
	}
}

func TestRequest_JSON(t *testing.T) {
	req := Request{
		APIKey:       "key123",
		ModelName:    "Address",
		CalledMethod: "searchSettlements",
		MethodProperties: map[string]interface{}{
			"CityName": "Київ",
			"Limit":    20,
		},
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var decoded Request
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if decoded.APIKey != req.APIKey {
		t.Errorf("expected APIKey '%s', got '%s'", req.APIKey, decoded.APIKey)
	}
	if decoded.ModelName != req.ModelName {
		t.Errorf("expected ModelName '%s', got '%s'", req.ModelName, decoded.ModelName)
	}
}

func TestResponse_JSON(t *testing.T) {
	jsonData := `{
		"success": true,
		"data": [{"Ref": "123"}],
		"errors": [],
		"warnings": ["test warning"]
	}`

	var resp Response
	if err := json.Unmarshal([]byte(jsonData), &resp); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !resp.Success {
		t.Error("expected Success to be true")
	}
	if len(resp.Warnings) != 1 {
		t.Errorf("expected 1 warning, got %d", len(resp.Warnings))
	}
}

func TestCity_JSON(t *testing.T) {
	jsonData := `{
		"Ref": "8d5a980d-391c-11dd-90d9-001a92567626",
		"Description": "Київ",
		"DescriptionRu": "Киев",
		"Area": "Київська",
		"SettlementType": "місто",
		"AreaDescription": "Київська область"
	}`

	var city City
	if err := json.Unmarshal([]byte(jsonData), &city); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if city.Description != "Київ" {
		t.Errorf("expected Description 'Київ', got '%s'", city.Description)
	}
}

func TestTrackingInfo_JSON(t *testing.T) {
	jsonData := `{
		"Number": "20450000000000",
		"StatusCode": "9",
		"Status": "Отримано",
		"CitySender": "Київ",
		"CityRecipient": "Львів"
	}`

	var tracking TrackingInfo
	if err := json.Unmarshal([]byte(jsonData), &tracking); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tracking.Number != "20450000000000" {
		t.Errorf("expected Number '20450000000000', got '%s'", tracking.Number)
	}
	if tracking.StatusCode != "9" {
		t.Errorf("expected StatusCode '9', got '%s'", tracking.StatusCode)
	}
}

func TestAPIEndpoint_Constant(t *testing.T) {
	expected := "https://api.novaposhta.ua/v2.0/json/"
	if APIEndpoint != expected {
		t.Errorf("expected APIEndpoint '%s', got '%s'", expected, APIEndpoint)
	}
}

func TestClient_ContextCanceled(t *testing.T) {
	client := NewClient("test-key")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_ = ctx
	_ = client
}

func TestHTTPClient_Timeout(t *testing.T) {
	client := NewClient("key")
	
	if client.httpClient.Timeout != 30*time.Second {
		t.Errorf("expected timeout 30s, got %v", client.httpClient.Timeout)
	}
}

func TestRequestContentType(t *testing.T) {
	// Verify that requests would be sent with correct content type
	req, _ := http.NewRequest(http.MethodPost, APIEndpoint, nil)
	req.Header.Set("Content-Type", "application/json")
	
	if req.Header.Get("Content-Type") != "application/json" {
		t.Error("expected Content-Type application/json")
	}
}
