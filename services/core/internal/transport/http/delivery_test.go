package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewDeliveryHandler(t *testing.T) {
	handler := NewDeliveryHandler()
	if handler == nil {
		t.Fatal("expected handler to be created")
	}
}

func TestCreateShipment(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodGet,
			body:           nil,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "invalid body",
			method:         http.MethodPost,
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing order_id",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				Provider:         "nova_poshta",
				RecipientAddress: &Address{FirstName: "John"},
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing provider",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				OrderID:          "ORD-123",
				RecipientAddress: &Address{FirstName: "John"},
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "missing recipient address",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				OrderID:  "ORD-123",
				Provider: "nova_poshta",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "invalid provider",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				OrderID:          "ORD-123",
				Provider:         "invalid_provider",
				RecipientAddress: &Address{FirstName: "John"},
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "valid nova_poshta shipment",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				OrderID:  "ORD-123",
				Provider: "nova_poshta",
				RecipientAddress: &Address{
					FirstName: "John",
					LastName:  "Doe",
					Phone:     "+380671234567",
					City:      "Kyiv",
					Address:   "Test Street 1",
				},
				Weight:      1.5,
				ServiceType: "warehouse",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid ukrposhta shipment",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				OrderID:  "ORD-124",
				Provider: "ukrposhta",
				RecipientAddress: &Address{
					FirstName: "Jane",
					LastName:  "Doe",
					Phone:     "+380671234568",
					City:      "Lviv",
					Address:   "Test Street 2",
				},
				Weight: 2.0,
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid meest shipment",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				OrderID:  "ORD-125",
				Provider: "meest",
				RecipientAddress: &Address{
					FirstName: "Test",
					LastName:  "User",
					Phone:     "+380671234569",
					City:      "Odesa",
					Address:   "Test Street 3",
				},
				Weight: 3.0,
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:   "valid justin shipment",
			method: http.MethodPost,
			body: CreateShipmentRequest{
				OrderID:  "ORD-126",
				Provider: "justin",
				RecipientAddress: &Address{
					FirstName: "Another",
					LastName:  "User",
					Phone:     "+380671234560",
					City:      "Kharkiv",
					Address:   "Test Street 4",
				},
				Weight: 4.0,
				Dimensions: &Dimensions{
					Length: 20,
					Width:  15,
					Height: 10,
				},
				InsuredValue: 1000,
				CODAmount:    500,
			},
			expectedStatus: http.StatusCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if tt.body != nil {
				if s, ok := tt.body.(string); ok {
					body = []byte(s)
				} else {
					body, _ = json.Marshal(tt.body)
				}
			}

			req := httptest.NewRequest(tt.method, "/shipments", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.CreateShipment(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusCreated {
				var shipment Shipment
				if err := json.NewDecoder(w.Body).Decode(&shipment); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if shipment.ID == "" {
					t.Error("expected shipment ID in response")
				}
				if shipment.TrackingNumber == "" {
					t.Error("expected tracking number in response")
				}
			}
		})
	}
}

func TestGetShipment(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			path:           "/shipments/SHP-123",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing shipment ID",
			method:         http.MethodGet,
			path:           "/shipments/",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			path:           "/shipments/SHP-123",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.GetShipment(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var shipment Shipment
				if err := json.NewDecoder(w.Body).Decode(&shipment); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if len(shipment.Events) == 0 {
					t.Error("expected events in shipment response")
				}
			}
		})
	}
}

func TestTrackShipment(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		query          string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			query:          "?tracking_number=20450123456789",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing tracking number",
			method:         http.MethodGet,
			query:          "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			query:          "?tracking_number=20450123456789&provider=nova_poshta",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/shipments/track"+tt.query, nil)
			w := httptest.NewRecorder()

			handler.TrackShipment(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if response["events"] == nil {
					t.Error("expected events in tracking response")
				}
			}
		})
	}
}

func TestCalculateDeliveryCost(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		body           interface{}
		expectedStatus int
		checkMultiple  bool
	}{
		{
			name:           "wrong method",
			method:         http.MethodGet,
			body:           nil,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "invalid body",
			method:         http.MethodPost,
			body:           "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "calculate for specific provider",
			method: http.MethodPost,
			body: CalculateDeliveryRequest{
				Provider:      "nova_poshta",
				SenderCity:    "Kyiv",
				RecipientCity: "Lviv",
				Weight:        2.0,
				ServiceType:   "warehouse",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:   "calculate for all providers",
			method: http.MethodPost,
			body: CalculateDeliveryRequest{
				SenderCity:    "Kyiv",
				RecipientCity: "Lviv",
				Weight:        2.0,
			},
			expectedStatus: http.StatusOK,
			checkMultiple:  true,
		},
		{
			name:   "with COD amount",
			method: http.MethodPost,
			body: CalculateDeliveryRequest{
				Provider:      "nova_poshta",
				SenderCity:    "Kyiv",
				RecipientCity: "Lviv",
				Weight:        5.0,
				CODAmount:     1000,
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:   "with dimensions",
			method: http.MethodPost,
			body: CalculateDeliveryRequest{
				Provider:      "ukrposhta",
				SenderCity:    "Kyiv",
				RecipientCity: "Odesa",
				Weight:        3.0,
				Dimensions: &Dimensions{
					Length: 30,
					Width:  20,
					Height: 15,
				},
			},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if tt.body != nil {
				if s, ok := tt.body.(string); ok {
					body = []byte(s)
				} else {
					body, _ = json.Marshal(tt.body)
				}
			}

			req := httptest.NewRequest(tt.method, "/delivery/calculate", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.CalculateDeliveryCost(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				if tt.checkMultiple {
					var responses []*DeliveryCostResponse
					if err := json.NewDecoder(w.Body).Decode(&responses); err != nil {
						t.Errorf("failed to decode response: %v", err)
					}
					if len(responses) < 4 {
						t.Errorf("expected at least 4 providers, got %d", len(responses))
					}
				} else {
					var response DeliveryCostResponse
					if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
						t.Errorf("failed to decode response: %v", err)
					}
					if response.Cost <= 0 {
						t.Error("expected positive cost")
					}
				}
			}
		})
	}
}

func TestGetDeliveryProviders(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/delivery/providers", nil)
			w := httptest.NewRecorder()

			handler.GetDeliveryProviders(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var providers []map[string]interface{}
				if err := json.NewDecoder(w.Body).Decode(&providers); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if len(providers) != 4 {
					t.Errorf("expected 4 providers, got %d", len(providers))
				}
				// Check for expected providers
				providerIDs := make(map[string]bool)
				for _, p := range providers {
					providerIDs[p["id"].(string)] = true
				}
				expectedProviders := []string{"nova_poshta", "ukrposhta", "meest", "justin"}
				for _, ep := range expectedProviders {
					if !providerIDs[ep] {
						t.Errorf("expected provider %s in response", ep)
					}
				}
			}
		})
	}
}

func TestSearchCities(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		query          string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			query:          "?q=Kyiv",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing query",
			method:         http.MethodGet,
			query:          "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid query",
			method:         http.MethodGet,
			query:          "?q=Київ",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with provider",
			method:         http.MethodGet,
			query:          "?q=Lviv&provider=nova_poshta",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/delivery/cities"+tt.query, nil)
			w := httptest.NewRecorder()

			handler.SearchCities(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestGetWarehouses(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		query          string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			query:          "?city_ref=123",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing city_ref",
			method:         http.MethodGet,
			query:          "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request",
			method:         http.MethodGet,
			query:          "?city_ref=8d5a980d-391c-11dd-90d9-001a92567626",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with provider",
			method:         http.MethodGet,
			query:          "?city_ref=123&provider=nova_poshta",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/delivery/warehouses"+tt.query, nil)
			w := httptest.NewRecorder()

			handler.GetWarehouses(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if response["warehouses"] == nil {
					t.Error("expected warehouses in response")
				}
			}
		})
	}
}

func TestPrintLabel(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodPost,
			path:           "/shipments/SHP-123/label",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing shipment ID",
			method:         http.MethodGet,
			path:           "/shipments//label",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid request - default format",
			method:         http.MethodGet,
			path:           "/shipments/SHP-123/label",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid request - pdf format",
			method:         http.MethodGet,
			path:           "/shipments/SHP-123/label?format=pdf",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid request - html format",
			method:         http.MethodGet,
			path:           "/shipments/SHP-123/label?format=html",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.PrintLabel(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
					t.Errorf("failed to decode response: %v", err)
				}
				if response["label_url"] == nil {
					t.Error("expected label_url in response")
				}
			}
		})
	}
}

func TestCancelShipment(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "wrong method",
			method:         http.MethodGet,
			path:           "/shipments/SHP-123/cancel",
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "missing shipment ID",
			method:         http.MethodPost,
			path:           "/shipments//cancel",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "valid cancel",
			method:         http.MethodPost,
			path:           "/shipments/SHP-123/cancel",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.CancelShipment(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestCalculateForProvider(t *testing.T) {
	handler := NewDeliveryHandler()

	tests := []struct {
		provider    string
		weight      float64
		codAmount   float64
		serviceType string
	}{
		{"nova_poshta", 1.0, 0, "warehouse"},
		{"nova_poshta", 5.0, 0, "courier"},
		{"ukrposhta", 2.0, 0, "standard"},
		{"meest", 3.0, 0, "warehouse"},
		{"justin", 4.0, 0, "warehouse"},
		{"nova_poshta", 2.0, 1000, "warehouse"}, // With COD
		{"unknown", 1.0, 0, "standard"},
	}

	for _, tt := range tests {
		t.Run(tt.provider, func(t *testing.T) {
			req := CalculateDeliveryRequest{
				Provider:    tt.provider,
				Weight:      tt.weight,
				CODAmount:   tt.codAmount,
				ServiceType: tt.serviceType,
			}

			resp := handler.calculateForProvider(tt.provider, req)

			if resp.Provider != tt.provider {
				t.Errorf("expected provider %s, got %s", tt.provider, resp.Provider)
			}
			if resp.Cost <= 0 {
				t.Error("expected positive cost")
			}
			if resp.Currency != "UAH" {
				t.Errorf("expected currency UAH, got %s", resp.Currency)
			}
			if resp.EstimatedDays <= 0 {
				t.Error("expected positive estimated days")
			}
		})
	}
}

func TestGetEstimatedDeliveryDays(t *testing.T) {
	tests := []struct {
		provider    string
		serviceType string
		expected    int
	}{
		{"nova_poshta", "express", 1},
		{"nova_poshta", "standard", 2},
		{"ukrposhta", "express", 2},
		{"ukrposhta", "standard", 4},
		{"meest", "standard", 3},
		{"justin", "standard", 2},
		{"unknown", "standard", 3},
	}

	for _, tt := range tests {
		t.Run(tt.provider+"-"+tt.serviceType, func(t *testing.T) {
			days := getEstimatedDeliveryDays(tt.provider, tt.serviceType)
			if days != tt.expected {
				t.Errorf("expected %d days for %s/%s, got %d", tt.expected, tt.provider, tt.serviceType, days)
			}
		})
	}
}

func TestDeliveryTypes(t *testing.T) {
	// Test Shipment struct
	shipment := &Shipment{
		ID:             "SHP-123",
		OrderID:        "ORD-123",
		Provider:       "nova_poshta",
		TrackingNumber: "20450123456789",
		Status:         "in_transit",
	}
	if shipment.ID != "SHP-123" {
		t.Error("expected shipment ID to be set")
	}

	// Test Dimensions struct
	dims := &Dimensions{
		Length: 30,
		Width:  20,
		Height: 15,
	}
	if dims.Length != 30 {
		t.Error("expected length to be 30")
	}

	// Test ShipmentEvent struct
	event := &ShipmentEvent{
		Status:      "in_transit",
		Location:    "Kyiv",
		Description: "Package in transit",
	}
	if event.Status != "in_transit" {
		t.Error("expected status to be in_transit")
	}

	// Test City struct
	city := &City{
		Ref:    "123",
		Name:   "Київ",
		Region: "Київська область",
	}
	if city.Name != "Київ" {
		t.Error("expected city name to be Київ")
	}

	// Test Warehouse struct
	warehouse := &Warehouse{
		Ref:     "456",
		Number:  1,
		Name:    "Відділення №1",
		Address: "вул. Хрещатик, 1",
	}
	if warehouse.Number != 1 {
		t.Error("expected warehouse number to be 1")
	}
}

func TestContainsIgnoreCase(t *testing.T) {
	tests := []struct {
		s        string
		substr   string
		expected bool
	}{
		{"Kyiv", "Kyiv", true},
		{"Kyiv", "", true},
		{"", "test", false},
		{"abc", "abcd", false},
	}

	for _, tt := range tests {
		t.Run(tt.s+"-"+tt.substr, func(t *testing.T) {
			result := containsIgnoreCase(tt.s, tt.substr)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}
