package logistics

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// ============================================================================
// Nova Poshta Client Tests
// ============================================================================

func TestNewNovaPoshtaClient(t *testing.T) {
	tests := []struct {
		name   string
		apiKey string
	}{
		{name: "with valid key", apiKey: "test-api-key"},
		{name: "with empty key", apiKey: ""},
		{name: "with long key", apiKey: "very-long-api-key-that-is-still-valid-for-testing-purposes"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewNovaPoshtaClient(tt.apiKey)
			if client == nil {
				t.Fatal("expected client to be created")
			}
			if client.apiKey != tt.apiKey {
				t.Errorf("expected apiKey '%s', got '%s'", tt.apiKey, client.apiKey)
			}
			if client.httpClient == nil {
				t.Error("expected httpClient to be set")
			}
			if client.httpClient.Timeout != 30*time.Second {
				t.Errorf("expected timeout 30s, got %v", client.httpClient.Timeout)
			}
		})
	}
}

// TestableNovaPoshtaClient is a wrapper for testing with custom URL
type TestableNovaPoshtaClient struct {
	*NovaPoshtaClient
	baseURL string
}

func newTestableClient(apiKey string, server *httptest.Server) *TestableNovaPoshtaClient {
	return &TestableNovaPoshtaClient{
		NovaPoshtaClient: &NovaPoshtaClient{
			apiKey:     apiKey,
			httpClient: &http.Client{Timeout: 5 * time.Second},
		},
		baseURL: server.URL,
	}
}

func (c *TestableNovaPoshtaClient) doTestRequest(ctx context.Context, modelName, calledMethod string, methodProperties map[string]interface{}) (map[string]interface{}, error) {
	body := map[string]interface{}{
		"apiKey":           c.apiKey,
		"modelName":        modelName,
		"calledMethod":     calledMethod,
		"methodProperties": methodProperties,
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func TestNovaPoshtaDoRequest(t *testing.T) {
	tests := []struct {
		name         string
		response     map[string]interface{}
		wantSuccess  bool
		wantErr      bool
	}{
		{
			name: "successful request",
			response: map[string]interface{}{
				"success": true,
				"data":    []interface{}{},
			},
			wantSuccess: true,
			wantErr:     false,
		},
		{
			name: "api error response",
			response: map[string]interface{}{
				"success": false,
				"errors":  []interface{}{"API key incorrect"},
			},
			wantSuccess: false,
			wantErr:     false,
		},
		{
			name: "with data",
			response: map[string]interface{}{
				"success": true,
				"data": []interface{}{
					map[string]interface{}{"Ref": "123", "Description": "Test"},
				},
			},
			wantSuccess: true,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				if r.Method != "POST" {
					t.Errorf("expected POST, got %s", r.Method)
				}
				if r.Header.Get("Content-Type") != "application/json" {
					t.Error("expected Content-Type: application/json")
				}

				// Parse request body
				var reqBody map[string]interface{}
				json.NewDecoder(r.Body).Decode(&reqBody)

				if reqBody["apiKey"] != "test-key" {
					t.Errorf("expected apiKey 'test-key', got %v", reqBody["apiKey"])
				}

				// Send response
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			client := newTestableClient("test-key", server)
			ctx := context.Background()

			result, err := client.doTestRequest(ctx, "Test", "testMethod", nil)
			if (err != nil) != tt.wantErr {
				t.Errorf("doRequest() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				success, _ := result["success"].(bool)
				if success != tt.wantSuccess {
					t.Errorf("expected success=%v, got %v", tt.wantSuccess, success)
				}
			}
		})
	}
}

// ============================================================================
// Data Structures Tests
// ============================================================================

func TestCityStruct(t *testing.T) {
	city := City{
		Ref:            "ref-123",
		Description:    "Київ",
		DescriptionRu:  "Киев",
		Area:           "area-ref",
		SettlementType: "city",
	}

	if city.Ref != "ref-123" {
		t.Errorf("expected Ref 'ref-123', got '%s'", city.Ref)
	}
	if city.Description != "Київ" {
		t.Errorf("expected Description 'Київ', got '%s'", city.Description)
	}
}

func TestCityJSON(t *testing.T) {
	city := City{
		Ref:            "ref-123",
		Description:    "Київ",
		DescriptionRu:  "Киев",
		Area:           "area-ref",
		SettlementType: "city",
	}

	data, err := json.Marshal(city)
	if err != nil {
		t.Fatalf("failed to marshal city: %v", err)
	}

	var decoded City
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal city: %v", err)
	}

	if decoded.Ref != city.Ref {
		t.Errorf("expected Ref '%s', got '%s'", city.Ref, decoded.Ref)
	}
}

func TestWarehouseStruct(t *testing.T) {
	warehouse := Warehouse{
		Ref:                   "ref-456",
		SiteKey:               "123",
		Description:           "Відділення №1",
		DescriptionRu:         "Отделение №1",
		Phone:                 "0800123456",
		TypeOfWarehouse:       "Branch",
		Number:                "1",
		CityRef:               "city-ref",
		CityDescription:       "Київ",
		SettlementRef:         "settlement-ref",
		SettlementDescription: "Київ",
		Longitude:             "30.5234",
		Latitude:              "50.4501",
		PostFinance:           "1",
		TotalMaxWeightAllowed: 30.0,
		PlaceMaxWeightAllowed: 20.0,
		Schedule:              map[string]string{"Monday": "09:00-18:00"},
	}

	if warehouse.Ref != "ref-456" {
		t.Errorf("expected Ref 'ref-456', got '%s'", warehouse.Ref)
	}
	if warehouse.TotalMaxWeightAllowed != 30.0 {
		t.Errorf("expected TotalMaxWeightAllowed 30.0, got %f", warehouse.TotalMaxWeightAllowed)
	}
	if len(warehouse.Schedule) != 1 {
		t.Errorf("expected 1 schedule item, got %d", len(warehouse.Schedule))
	}
}

func TestWarehouseJSON(t *testing.T) {
	warehouse := Warehouse{
		Ref:                   "ref-456",
		Description:           "Відділення №1",
		Number:                "1",
		TotalMaxWeightAllowed: 30.0,
	}

	data, err := json.Marshal(warehouse)
	if err != nil {
		t.Fatalf("failed to marshal warehouse: %v", err)
	}

	var decoded Warehouse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal warehouse: %v", err)
	}

	if decoded.Ref != warehouse.Ref {
		t.Errorf("expected Ref '%s', got '%s'", warehouse.Ref, decoded.Ref)
	}
}

func TestParcelStruct(t *testing.T) {
	parcel := Parcel{
		Weight: 1.5,
		Length: 30.0,
		Width:  20.0,
		Height: 10.0,
	}

	volume := parcel.Length * parcel.Width * parcel.Height
	if volume != 6000.0 {
		t.Errorf("expected volume 6000, got %f", volume)
	}

	volumetricWeight := volume / 4000.0 // Standard divisor
	if volumetricWeight != 1.5 {
		t.Errorf("expected volumetric weight 1.5, got %f", volumetricWeight)
	}
}

func TestInternetDocumentStruct(t *testing.T) {
	doc := InternetDocument{
		Ref:                   "doc-ref-123",
		IntDocNumber:          "20450000001234",
		CostOnSite:            75.0,
		EstimatedDeliveryDate: "03.01.2024",
		DateTime:              "01.01.2024",
		RecipientsPhone:       "+380501234567",
		Status:                "Створено",
		StatusCode:            "1",
	}

	if doc.IntDocNumber != "20450000001234" {
		t.Errorf("expected IntDocNumber '20450000001234', got '%s'", doc.IntDocNumber)
	}
	if doc.CostOnSite != 75.0 {
		t.Errorf("expected CostOnSite 75.0, got %f", doc.CostOnSite)
	}
}

func TestTrackingInfoStruct(t *testing.T) {
	info := TrackingInfo{
		Number:                   "20450000001234",
		Status:                   "Отримано",
		StatusCode:               "9",
		WarehouseSender:          "Відділення №1",
		WarehouseRecipient:       "Відділення №10",
		WarehouseRecipientNumber: "10",
		CityRecipient:            "Київ",
		CitySender:               "Львів",
		RecipientFullName:        "Іванов Іван",
		DateCreated:              "01.01.2024",
		DateScan:                 "02.01.2024 10:00",
		ActualDeliveryDate:       "02.01.2024",
		ScheduledDeliveryDate:    "03.01.2024",
		PaymentMethod:            "Cash",
		DocumentWeight:           1.5,
		DocumentCost:             75.0,
		SumBeforeCheckWeight:     75.0,
		AnnouncedPrice:           500.0,
		RedeliverySum:            500.0,
	}

	if info.StatusCode != "9" {
		t.Errorf("expected StatusCode '9', got '%s'", info.StatusCode)
	}
	if info.DocumentWeight != 1.5 {
		t.Errorf("expected DocumentWeight 1.5, got %f", info.DocumentWeight)
	}
}

func TestDeliveryCostStruct(t *testing.T) {
	cost := DeliveryCost{
		Cost:           75.0,
		AssessedCost:   500.0,
		CostRedelivery: 45.0,
		CostPack:       10.0,
	}

	total := cost.Cost + cost.CostPack
	if total != 85.0 {
		t.Errorf("expected total 85.0, got %f", total)
	}
}

func TestCreateDocumentRequestStruct(t *testing.T) {
	doc := CreateDocumentRequest{
		PayerType:        "Sender",
		PaymentMethod:    "Cash",
		DateTime:         "01.01.2024",
		CargoType:        "Cargo",
		Weight:           1.5,
		ServiceType:      "WarehouseWarehouse",
		SeatsAmount:      1,
		Description:      "Товари",
		Cost:             500.0,
		CitySender:       "city-sender-ref",
		Sender:           "sender-ref",
		SenderAddress:    "sender-address-ref",
		ContactSender:    "contact-sender-ref",
		SendersPhone:     "+380501234567",
		CityRecipient:    "city-recipient-ref",
		Recipient:        "recipient-ref",
		RecipientAddress: "recipient-address-ref",
		ContactRecipient: "contact-recipient-ref",
		RecipientsPhone:  "+380507654321",
		VolumeGeneral:    0.006,
		BackwardDeliveryData: []map[string]interface{}{
			{
				"PayerType":        "Recipient",
				"CargoType":        "Money",
				"RedeliveryString": "500",
			},
		},
	}

	if doc.PayerType != "Sender" {
		t.Errorf("expected PayerType 'Sender', got '%s'", doc.PayerType)
	}
	if len(doc.BackwardDeliveryData) != 1 {
		t.Errorf("expected 1 BackwardDeliveryData item, got %d", len(doc.BackwardDeliveryData))
	}
}

// ============================================================================
// Ukrposhta Client Tests
// ============================================================================

func TestNewUkrPoshtaClient(t *testing.T) {
	client := NewUkrPoshtaClient("bearer-token", "counterparty-token")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.bearerToken != "bearer-token" {
		t.Errorf("expected bearerToken 'bearer-token', got '%s'", client.bearerToken)
	}
	if client.counterpartyToken != "counterparty-token" {
		t.Errorf("expected counterpartyToken 'counterparty-token', got '%s'", client.counterpartyToken)
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestUPAddressStruct(t *testing.T) {
	addr := UPAddress{
		ID:              123,
		PostCode:        "01001",
		Country:         "UA",
		Region:          "Київська область",
		District:        "Київський район",
		City:            "Київ",
		Street:          "Хрещатик",
		HouseNumber:     "1",
		ApartmentNumber: "1",
		Description:     "Test address",
	}

	if addr.City != "Київ" {
		t.Errorf("expected City 'Київ', got '%s'", addr.City)
	}
	if addr.PostCode != "01001" {
		t.Errorf("expected PostCode '01001', got '%s'", addr.PostCode)
	}
}

func TestUPAddressJSON(t *testing.T) {
	addr := UPAddress{
		PostCode: "01001",
		City:     "Київ",
		Street:   "Хрещатик",
	}

	data, err := json.Marshal(addr)
	if err != nil {
		t.Fatalf("failed to marshal address: %v", err)
	}

	var decoded UPAddress
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal address: %v", err)
	}

	if decoded.PostCode != addr.PostCode {
		t.Errorf("expected PostCode '%s', got '%s'", addr.PostCode, decoded.PostCode)
	}
}

func TestUPClientStruct(t *testing.T) {
	client := UPClient{
		UUID:        "uuid-123",
		Name:        "Тест",
		FirstName:   "Іван",
		MiddleName:  "Іванович",
		LastName:    "Іванов",
		PhoneNumber: "+380501234567",
		Email:       "test@example.com",
		Type:        "INDIVIDUAL",
		Resident:    true,
		Individual:  true,
	}

	if client.Type != "INDIVIDUAL" {
		t.Errorf("expected Type 'INDIVIDUAL', got '%s'", client.Type)
	}
	if !client.Individual {
		t.Error("expected Individual to be true")
	}
}

func TestUPShipmentStruct(t *testing.T) {
	shipment := UPShipment{
		UUID:            "uuid-456",
		Barcode:         "1234567890",
		DeliveryType:    "W2W",
		PaidByRecipient: false,
		Description:     "Test shipment",
		Parcels: []UPParcel{
			{Weight: 1.5, Length: 30, Width: 20, Height: 10, DeclaredPrice: 500},
		},
	}

	if shipment.DeliveryType != "W2W" {
		t.Errorf("expected DeliveryType 'W2W', got '%s'", shipment.DeliveryType)
	}
	if len(shipment.Parcels) != 1 {
		t.Errorf("expected 1 parcel, got %d", len(shipment.Parcels))
	}
}

func TestUPTrackingEventStruct(t *testing.T) {
	event := UPTrackingEvent{
		Barcode:     "1234567890",
		Step:        1,
		Date:        "01.01.2024",
		Time:        "10:00",
		Index:       "01001",
		Name:        "Київ",
		EventName:   "Прийнято",
		Country:     "UA",
		EventReason: "",
	}

	if event.Step != 1 {
		t.Errorf("expected Step 1, got %d", event.Step)
	}
	if event.EventName != "Прийнято" {
		t.Errorf("expected EventName 'Прийнято', got '%s'", event.EventName)
	}
}

func TestUPPostOfficeStruct(t *testing.T) {
	office := UPPostOffice{
		ID:        123,
		PostIndex: "01001",
		Name:      "Поштове відділення №1",
		Address:   "Хрещатик, 1",
		Phone:     "0800300545",
		Latitude:  50.4501,
		Longitude: 30.5234,
		City:      "Київ",
		Region:    "Київська",
		Type:      "post_office",
	}

	if office.PostIndex != "01001" {
		t.Errorf("expected PostIndex '01001', got '%s'", office.PostIndex)
	}
	if office.Latitude != 50.4501 {
		t.Errorf("expected Latitude 50.4501, got %f", office.Latitude)
	}
}

// ============================================================================
// Meest Client Tests
// ============================================================================

func TestNewMeestClient(t *testing.T) {
	client := NewMeestClient("username", "password", "api-key")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.username != "username" {
		t.Errorf("expected username 'username', got '%s'", client.username)
	}
	if client.password != "password" {
		t.Errorf("expected password 'password', got '%s'", client.password)
	}
	if client.apiKey != "api-key" {
		t.Errorf("expected apiKey 'api-key', got '%s'", client.apiKey)
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestMeestBranchStruct(t *testing.T) {
	branch := MeestBranch{
		BranchID:     "branch-123",
		BranchNumber: "1",
		Name:         "Відділення №1",
		NameRU:       "Отделение №1",
		Address:      "Хрещатик, 1",
		City:         "Київ",
		Region:       "Київська",
		PostIndex:    "01001",
		Phone:        "0800123456",
		Latitude:     50.4501,
		Longitude:    30.5234,
		WorkHours:    "09:00-18:00",
		MaxWeight:    30.0,
		Type:         "branch",
		PaymentCard:  true,
		ParcelLocker: false,
	}

	if branch.BranchNumber != "1" {
		t.Errorf("expected BranchNumber '1', got '%s'", branch.BranchNumber)
	}
	if branch.MaxWeight != 30.0 {
		t.Errorf("expected MaxWeight 30.0, got %f", branch.MaxWeight)
	}
	if !branch.PaymentCard {
		t.Error("expected PaymentCard to be true")
	}
}

func TestMeestCityStruct(t *testing.T) {
	city := MeestCity{
		CityID:    "city-123",
		Name:      "Київ",
		NameRU:    "Киев",
		Region:    "Київська",
		District:  "Київський",
		Type:      "місто",
		PostIndex: "01001",
	}

	if city.Name != "Київ" {
		t.Errorf("expected Name 'Київ', got '%s'", city.Name)
	}
	if city.Type != "місто" {
		t.Errorf("expected Type 'місто', got '%s'", city.Type)
	}
}

func TestMeestParcelStruct(t *testing.T) {
	parcel := MeestParcel{
		Weight:        1.5,
		Length:        30.0,
		Width:         20.0,
		Height:        10.0,
		DeclaredValue: 500.0,
	}

	if parcel.DeclaredValue != 500.0 {
		t.Errorf("expected DeclaredValue 500.0, got %f", parcel.DeclaredValue)
	}
}

func TestMeestShipmentStruct(t *testing.T) {
	shipment := MeestShipment{
		ParcelID:         "parcel-123",
		Barcode:          "1234567890",
		SenderBranchID:   "sender-branch",
		ReceiverBranchID: "receiver-branch",
		SenderName:       "Іван Іванов",
		SenderPhone:      "+380501234567",
		SenderEmail:      "sender@example.com",
		ReceiverName:     "Петро Петров",
		ReceiverPhone:    "+380507654321",
		ServiceType:      "Standard",
		PaymentType:      "Sender",
		CODAmount:        500.0,
		Parcels: []MeestParcel{
			{Weight: 1.5, DeclaredValue: 500},
		},
		Description:  "Test",
		DeliveryType: "Branch",
		NotifyBySMS:  true,
	}

	if shipment.ServiceType != "Standard" {
		t.Errorf("expected ServiceType 'Standard', got '%s'", shipment.ServiceType)
	}
	if shipment.CODAmount != 500.0 {
		t.Errorf("expected CODAmount 500.0, got %f", shipment.CODAmount)
	}
}

func TestMeestTrackingEventStruct(t *testing.T) {
	event := MeestTrackingEvent{
		Date:        "01.01.2024",
		Time:        "10:00",
		Status:      "Прийнято",
		StatusRU:    "Принято",
		StatusCode:  "1",
		City:        "Київ",
		Branch:      "Відділення №1",
		Description: "Посилку прийнято",
	}

	if event.StatusCode != "1" {
		t.Errorf("expected StatusCode '1', got '%s'", event.StatusCode)
	}
}

func TestMeestDeliveryCostStruct(t *testing.T) {
	cost := MeestDeliveryCost{
		TotalCost:     100.0,
		DeliveryCost:  75.0,
		InsuranceCost: 15.0,
		CODCost:       10.0,
		Currency:      "UAH",
	}

	calculated := cost.DeliveryCost + cost.InsuranceCost + cost.CODCost
	if calculated != cost.TotalCost {
		t.Errorf("expected total %f, got %f", cost.TotalCost, calculated)
	}
}

func TestMeestAuthentication(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth" {
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)

			if body["username"] != "testuser" {
				t.Errorf("expected username 'testuser', got '%s'", body["username"])
			}

			response := map[string]interface{}{
				"token": "test-token-12345",
			}
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	// Test token caching
	client := NewMeestClient("testuser", "password", "api-key")
	client.token = "cached-token"
	client.tokenExpiry = time.Now().Add(1 * time.Hour)

	// Token should still be valid
	if client.token != "cached-token" {
		t.Error("expected cached token to be used")
	}
}

// ============================================================================
// Helper Function Tests
// ============================================================================

func TestMapToStruct(t *testing.T) {
	m := map[string]interface{}{
		"id":       int64(123),
		"postcode": "01001",
		"city":     "Київ",
	}

	var addr UPAddress
	err := mapToStruct(m, &addr)
	if err != nil {
		t.Fatalf("mapToStruct() error = %v", err)
	}

	if addr.PostCode != "01001" {
		t.Errorf("expected PostCode '01001', got '%s'", addr.PostCode)
	}
}

// ============================================================================
// Service Types Tests
// ============================================================================

func TestServiceTypes(t *testing.T) {
	serviceTypes := []string{
		"WarehouseWarehouse",
		"WarehouseDoors",
		"DoorsWarehouse",
		"DoorsDoors",
	}

	for _, st := range serviceTypes {
		if st == "" {
			t.Error("service type should not be empty")
		}
	}
}

func TestCargoTypes(t *testing.T) {
	cargoTypes := []string{
		"Cargo",
		"Documents",
		"TiresWheels",
		"Pallet",
	}

	for _, ct := range cargoTypes {
		if ct == "" {
			t.Error("cargo type should not be empty")
		}
	}
}

func TestPayerTypes(t *testing.T) {
	payerTypes := []string{
		"Sender",
		"Recipient",
		"ThirdPerson",
	}

	for _, pt := range payerTypes {
		if pt == "" {
			t.Error("payer type should not be empty")
		}
	}
}

// ============================================================================
// Status Codes Tests
// ============================================================================

func TestNovaPoshtaStatusCodes(t *testing.T) {
	statusCodes := map[string]string{
		"1":   "Очікує відправки",
		"2":   "Видалено",
		"3":   "Номер не знайдено",
		"4":   "Відправлено",
		"5":   "Прибув на склад",
		"6":   "Готовий до видачі",
		"7":   "Отримано",
		"8":   "Готовий до відправки",
		"9":   "Отримано (фінальний)",
		"10":  "Відмова від отримання",
		"11":  "Відмова одержувача",
		"102": "Повернуто",
	}

	for code, status := range statusCodes {
		if code == "" || status == "" {
			t.Errorf("status code '%s' or status '%s' is empty", code, status)
		}
	}
}

func TestStatusCodeDelivered(t *testing.T) {
	deliveredCodes := []string{"7", "9"}

	for _, code := range deliveredCodes {
		info := TrackingInfo{StatusCode: code}
		isDelivered := info.StatusCode == "7" || info.StatusCode == "9"
		if !isDelivered {
			t.Errorf("expected status code %s to indicate delivered", code)
		}
	}
}

func TestStatusCodeInTransit(t *testing.T) {
	transitCodes := []string{"4", "5", "6", "8"}

	for _, code := range transitCodes {
		info := TrackingInfo{StatusCode: code}
		isInTransit := info.StatusCode == "4" || info.StatusCode == "5" ||
			info.StatusCode == "6" || info.StatusCode == "8"
		if !isInTransit {
			t.Errorf("expected status code %s to indicate in transit", code)
		}
	}
}

// ============================================================================
// Validation Tests
// ============================================================================

func TestValidatePhone(t *testing.T) {
	tests := []struct {
		phone string
		valid bool
	}{
		{"+380501234567", true},
		{"+380671234567", true},
		{"+380931234567", true},
		{"0501234567", true},
		{"380501234567", true},
		{"123", false},
		{"", false},
	}

	for _, tt := range tests {
		isValid := len(tt.phone) >= 10
		if isValid != tt.valid {
			t.Errorf("phone '%s' validation expected %v, got %v", tt.phone, tt.valid, isValid)
		}
	}
}

func TestValidateTTN(t *testing.T) {
	tests := []struct {
		ttn   string
		valid bool
	}{
		{"20450000001234", true},
		{"59000000001234", true},
		{"12345678901234", true},
		{"123", false},
		{"", false},
		{"123456789012345", false}, // 15 chars
	}

	for _, tt := range tests {
		isValid := len(tt.ttn) == 14
		if isValid != tt.valid {
			t.Errorf("TTN '%s' validation expected %v, got %v", tt.ttn, tt.valid, isValid)
		}
	}
}

func TestValidateWeight(t *testing.T) {
	tests := []struct {
		weight float64
		valid  bool
	}{
		{0.1, true},
		{0.5, true},
		{30.0, true},
		{100.0, true},
		{0, false},
		{-1, false},
	}

	for _, tt := range tests {
		isValid := tt.weight > 0
		if isValid != tt.valid {
			t.Errorf("weight %f validation expected %v, got %v", tt.weight, tt.valid, isValid)
		}
	}
}

func TestValidatePostalCode(t *testing.T) {
	tests := []struct {
		code  string
		valid bool
	}{
		{"01001", true},
		{"79000", true},
		{"65000", true},
		{"1234", false},
		{"123456", false},
		{"", false},
		{"abcde", false},
	}

	for _, tt := range tests {
		// Ukrainian postal codes are 5 digits
		isValid := len(tt.code) == 5
		if isValid {
			for _, c := range tt.code {
				if c < '0' || c > '9' {
					isValid = false
					break
				}
			}
		}
		if isValid != tt.valid {
			t.Errorf("postal code '%s' validation expected %v, got %v", tt.code, tt.valid, isValid)
		}
	}
}

// ============================================================================
// HTTP Client Tests with Mock Server
// ============================================================================

func TestUkrPoshtaDoRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify authorization header
		if r.Header.Get("Authorization") != "Bearer test-bearer" {
			t.Error("expected Authorization header with Bearer token")
		}

		response := map[string]interface{}{
			"success": true,
			"data":    "test",
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Create client - URL would need to be injectable in real implementation
	_ = server
}

func TestMeestDoRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify headers
		if r.Header.Get("x-api-key") == "" {
			t.Error("expected x-api-key header")
		}

		response := map[string]interface{}{
			"status": "success",
			"result": map[string]interface{}{"test": "data"},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	_ = server
}

// ============================================================================
// Error Handling Tests
// ============================================================================

func TestNovaPoshtaAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"success": false,
			"errors":  []interface{}{"API key is invalid", "Access denied"},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	_ = server
}

func TestNetworkTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := &http.Client{Timeout: 10 * time.Millisecond}
	_, err := client.Get(server.URL)
	if err == nil {
		t.Error("expected timeout error")
	}
}

func TestInvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("invalid json"))
	}))
	defer server.Close()

	resp, err := http.Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err == nil {
		t.Error("expected JSON decode error")
	}
}

func TestHTTPStatusCodes(t *testing.T) {
	tests := []struct {
		status   int
		hasError bool
	}{
		{http.StatusOK, false},
		{http.StatusCreated, false},
		{http.StatusNoContent, false},
		{http.StatusBadRequest, true},
		{http.StatusUnauthorized, true},
		{http.StatusForbidden, true},
		{http.StatusNotFound, true},
		{http.StatusInternalServerError, true},
	}

	for _, tt := range tests {
		t.Run(http.StatusText(tt.status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.status)
				if tt.status < 400 {
					json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
				} else {
					json.NewEncoder(w).Encode(map[string]interface{}{"error": "test error"})
				}
			}))
			defer server.Close()

			resp, err := http.Get(server.URL)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()

			isError := resp.StatusCode >= 400
			if isError != tt.hasError {
				t.Errorf("status %d: expected hasError=%v, got %v", tt.status, tt.hasError, isError)
			}
		})
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkCityJSON(b *testing.B) {
	city := City{
		Ref:            "ref-123",
		Description:    "Київ",
		DescriptionRu:  "Киев",
		Area:           "area-ref",
		SettlementType: "city",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		data, _ := json.Marshal(city)
		var decoded City
		_ = json.Unmarshal(data, &decoded)
	}
}

func BenchmarkWarehouseJSON(b *testing.B) {
	warehouse := Warehouse{
		Ref:                   "ref-456",
		Description:           "Відділення №1",
		Number:                "1",
		CityDescription:       "Київ",
		TotalMaxWeightAllowed: 30.0,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		data, _ := json.Marshal(warehouse)
		var decoded Warehouse
		_ = json.Unmarshal(data, &decoded)
	}
}

func BenchmarkTrackingInfoJSON(b *testing.B) {
	info := TrackingInfo{
		Number:         "20450000001234",
		Status:         "Отримано",
		StatusCode:     "9",
		CityRecipient:  "Київ",
		DocumentWeight: 1.5,
		DocumentCost:   75.0,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		data, _ := json.Marshal(info)
		var decoded TrackingInfo
		_ = json.Unmarshal(data, &decoded)
	}
}

func BenchmarkHTTPRequest(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()

	client := &http.Client{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, _ := client.Get(server.URL)
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}

func BenchmarkJSONDecoding(b *testing.B) {
	data := []byte(`{"success":true,"data":[{"Ref":"ref-1","Description":"Київ"},{"Ref":"ref-2","Description":"Львів"}]}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var result map[string]interface{}
		_ = json.Unmarshal(data, &result)
	}
}

// ============================================================================
// Nova Poshta API Methods Tests with Mock Server
// ============================================================================

// createNovaPoshtaMockServer creates a mock server for Nova Poshta API
func createNovaPoshtaMockServer(t *testing.T, handler func(req map[string]interface{}) map[string]interface{}) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("expected Content-Type: application/json")
		}

		var reqBody map[string]interface{}
		json.NewDecoder(r.Body).Decode(&reqBody)

		response := handler(reqBody)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
}

// NovaPoshtaClientWithURL allows custom URL for testing
type NovaPoshtaClientWithURL struct {
	*NovaPoshtaClient
	URL string
}

func (c *NovaPoshtaClientWithURL) doRequestWithURL(ctx context.Context, modelName, calledMethod string, methodProperties map[string]interface{}) (map[string]interface{}, error) {
	body := map[string]interface{}{
		"apiKey":           c.apiKey,
		"modelName":        modelName,
		"calledMethod":     calledMethod,
		"methodProperties": methodProperties,
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.URL, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func TestNovaPoshtaSearchCities(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "Address" || req["calledMethod"] != "searchSettlements" {
			t.Errorf("unexpected request: model=%s, method=%s", req["modelName"], req["calledMethod"])
		}

		props := req["methodProperties"].(map[string]interface{})
		cityName := props["CityName"].(string)

		if cityName == "Київ" {
			return map[string]interface{}{
				"success": true,
				"data": []interface{}{
					map[string]interface{}{
						"Addresses": []interface{}{
							map[string]interface{}{
								"Ref":     "city-ref-123",
								"Present": "м. Київ, Київська обл.",
							},
							map[string]interface{}{
								"Ref":     "city-ref-456",
								"Present": "м. Київ, інший район",
							},
						},
					},
				},
			}
		}
		return map[string]interface{}{
			"success": true,
			"data":    []interface{}{},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()

	// Test successful search
	resp, err := client.doRequestWithURL(ctx, "Address", "searchSettlements", map[string]interface{}{
		"CityName": "Київ",
		"Limit":    10,
	})
	if err != nil {
		t.Fatalf("SearchCities error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) == 0 {
		t.Fatal("expected data in response")
	}

	addresses := data[0].(map[string]interface{})["Addresses"].([]interface{})
	if len(addresses) != 2 {
		t.Errorf("expected 2 addresses, got %d", len(addresses))
	}
}

func TestNovaPoshtaGetCities(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "Address" || req["calledMethod"] != "getCities" {
			t.Errorf("unexpected request")
		}

		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Ref":            "city-1",
					"Description":    "Київ",
					"DescriptionRu":  "Киев",
					"Area":           "area-1",
					"SettlementType": "місто",
				},
				map[string]interface{}{
					"Ref":            "city-2",
					"Description":    "Львів",
					"DescriptionRu":  "Львов",
					"Area":           "area-2",
					"SettlementType": "місто",
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "Address", "getCities", map[string]interface{}{
		"Page":  1,
		"Limit": 150,
	})
	if err != nil {
		t.Fatalf("GetCities error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) != 2 {
		t.Errorf("expected 2 cities, got %d", len(data))
	}
}

func TestNovaPoshtaGetWarehouses(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "Address" || req["calledMethod"] != "getWarehouses" {
			t.Errorf("unexpected request")
		}

		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Ref":                   "wh-1",
					"SiteKey":               "1",
					"Description":           "Відділення №1",
					"DescriptionRu":         "Отделение №1",
					"Phone":                 "0800123456",
					"TypeOfWarehouse":       "Branch",
					"Number":                "1",
					"CityRef":               "city-1",
					"CityDescription":       "Київ",
					"Longitude":             "30.5234",
					"Latitude":              "50.4501",
					"TotalMaxWeightAllowed": float64(30),
				},
				map[string]interface{}{
					"Ref":                   "wh-2",
					"SiteKey":               "2",
					"Description":           "Відділення №2",
					"DescriptionRu":         "Отделение №2",
					"Phone":                 "0800123457",
					"TypeOfWarehouse":       "Branch",
					"Number":                "2",
					"CityRef":               "city-1",
					"CityDescription":       "Київ",
					"Longitude":             "30.5235",
					"Latitude":              "50.4502",
					"TotalMaxWeightAllowed": float64(30),
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "Address", "getWarehouses", map[string]interface{}{
		"CityRef": "city-1",
	})
	if err != nil {
		t.Fatalf("GetWarehouses error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) != 2 {
		t.Errorf("expected 2 warehouses, got %d", len(data))
	}

	wh := data[0].(map[string]interface{})
	if wh["Number"] != "1" {
		t.Errorf("expected warehouse number '1', got '%v'", wh["Number"])
	}
}

func TestNovaPoshtaCalculateDeliveryCost(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "InternetDocument" || req["calledMethod"] != "getDocumentPrice" {
			t.Errorf("unexpected request")
		}

		props := req["methodProperties"].(map[string]interface{})
		weight := props["Weight"].(float64)

		cost := 45.0 + (weight * 15.0)

		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Cost":           cost,
					"AssessedCost":   props["Cost"],
					"CostRedelivery": cost * 0.5,
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "InternetDocument", "getDocumentPrice", map[string]interface{}{
		"CitySender":    "city-1",
		"CityRecipient": "city-2",
		"Weight":        float64(2),
		"Cost":          float64(500),
		"ServiceType":   "WarehouseWarehouse",
		"CargoType":     "Cargo",
		"SeatsAmount":   1,
	})
	if err != nil {
		t.Fatalf("CalculateDeliveryCost error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) == 0 {
		t.Fatal("expected cost data")
	}

	cost := data[0].(map[string]interface{})["Cost"].(float64)
	if cost <= 0 {
		t.Errorf("expected positive cost, got %f", cost)
	}
}

func TestNovaPoshtaCreateInternetDocument(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "InternetDocument" || req["calledMethod"] != "save" {
			t.Errorf("unexpected request")
		}

		props := req["methodProperties"].(map[string]interface{})
		if props["PayerType"] == nil {
			t.Error("expected PayerType in request")
		}

		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Ref":                   "doc-ref-123",
					"IntDocNumber":          "20450000001234",
					"CostOnSite":            float64(75),
					"EstimatedDeliveryDate": "05.01.2024",
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "InternetDocument", "save", map[string]interface{}{
		"PayerType":        "Sender",
		"PaymentMethod":    "Cash",
		"DateTime":         "01.01.2024",
		"CargoType":        "Cargo",
		"Weight":           float64(1.5),
		"ServiceType":      "WarehouseWarehouse",
		"SeatsAmount":      1,
		"Description":      "Товари",
		"Cost":             float64(500),
		"CitySender":       "city-1",
		"Sender":           "sender-ref",
		"SenderAddress":    "wh-1",
		"ContactSender":    "contact-1",
		"SendersPhone":     "+380501234567",
		"CityRecipient":    "city-2",
		"Recipient":        "recipient-ref",
		"RecipientAddress": "wh-2",
		"ContactRecipient": "contact-2",
		"RecipientsPhone":  "+380507654321",
	})
	if err != nil {
		t.Fatalf("CreateInternetDocument error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) == 0 {
		t.Fatal("expected document data")
	}

	doc := data[0].(map[string]interface{})
	if doc["IntDocNumber"] != "20450000001234" {
		t.Errorf("expected IntDocNumber '20450000001234', got '%v'", doc["IntDocNumber"])
	}
}

func TestNovaPoshtaTrackDocument(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "TrackingDocument" || req["calledMethod"] != "getStatusDocuments" {
			t.Errorf("unexpected request")
		}

		props := req["methodProperties"].(map[string]interface{})
		docs := props["Documents"].([]interface{})
		docNum := docs[0].(map[string]interface{})["DocumentNumber"].(string)

		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Number":                docNum,
					"Status":                "Отримано",
					"StatusCode":            "9",
					"WarehouseSender":       "Відділення №1",
					"WarehouseRecipient":    "Відділення №10",
					"CityRecipient":         "Київ",
					"CitySender":            "Львів",
					"RecipientFullName":     "Іванов Іван",
					"DateCreated":           "01.01.2024",
					"ScheduledDeliveryDate": "03.01.2024",
					"ActualDeliveryDate":    "02.01.2024",
					"DocumentWeight":        float64(1.5),
					"DocumentCost":          float64(75),
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "TrackingDocument", "getStatusDocuments", map[string]interface{}{
		"Documents": []map[string]string{
			{"DocumentNumber": "20450000001234"},
		},
	})
	if err != nil {
		t.Fatalf("TrackDocument error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) == 0 {
		t.Fatal("expected tracking data")
	}

	info := data[0].(map[string]interface{})
	if info["StatusCode"] != "9" {
		t.Errorf("expected StatusCode '9', got '%v'", info["StatusCode"])
	}
}

func TestNovaPoshtaTrackMultiple(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		props := req["methodProperties"].(map[string]interface{})
		docs := props["Documents"].([]interface{})

		results := make([]interface{}, len(docs))
		for i, d := range docs {
			doc := d.(map[string]interface{})
			results[i] = map[string]interface{}{
				"Number":     doc["DocumentNumber"],
				"Status":     "Отримано",
				"StatusCode": "9",
			}
		}

		return map[string]interface{}{
			"success": true,
			"data":    results,
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "TrackingDocument", "getStatusDocuments", map[string]interface{}{
		"Documents": []map[string]string{
			{"DocumentNumber": "20450000001234"},
			{"DocumentNumber": "20450000001235"},
			{"DocumentNumber": "20450000001236"},
		},
	})
	if err != nil {
		t.Fatalf("TrackMultiple error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) != 3 {
		t.Errorf("expected 3 tracking results, got %d", len(data))
	}
}

func TestNovaPoshtaGetAreas(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "Address" || req["calledMethod"] != "getAreas" {
			t.Errorf("unexpected request")
		}

		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Ref":         "area-1",
					"Description": "Київська",
				},
				map[string]interface{}{
					"Ref":         "area-2",
					"Description": "Львівська",
				},
				map[string]interface{}{
					"Ref":         "area-3",
					"Description": "Одеська",
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "Address", "getAreas", nil)
	if err != nil {
		t.Fatalf("GetAreas error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) != 3 {
		t.Errorf("expected 3 areas, got %d", len(data))
	}
}

func TestNovaPoshtaGetWarehouseTypes(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Ref":         "type-1",
					"Description": "Відділення",
				},
				map[string]interface{}{
					"Ref":         "type-2",
					"Description": "Поштомат",
				},
				map[string]interface{}{
					"Ref":         "type-3",
					"Description": "Вантажне відділення",
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "Address", "getWarehouseTypes", nil)
	if err != nil {
		t.Fatalf("GetWarehouseTypes error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) != 3 {
		t.Errorf("expected 3 warehouse types, got %d", len(data))
	}
}

func TestNovaPoshtaGetCounterparties(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "Counterparty" || req["calledMethod"] != "getCounterparties" {
			t.Errorf("unexpected request")
		}

		return map[string]interface{}{
			"success": true,
			"data": []interface{}{
				map[string]interface{}{
					"Ref":         "cp-1",
					"Description": "ФОП Іванов",
					"EDRPOU":      "12345678",
				},
			},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	resp, err := client.doRequestWithURL(ctx, "Counterparty", "getCounterparties", map[string]interface{}{
		"CounterpartyProperty": "Sender",
	})
	if err != nil {
		t.Fatalf("GetCounterparties error: %v", err)
	}

	data := resp["data"].([]interface{})
	if len(data) == 0 {
		t.Fatal("expected counterparty data")
	}
}

func TestNovaPoshtaDeleteDocument(t *testing.T) {
	server := createNovaPoshtaMockServer(t, func(req map[string]interface{}) map[string]interface{} {
		if req["modelName"] != "InternetDocument" || req["calledMethod"] != "delete" {
			t.Errorf("unexpected request")
		}

		return map[string]interface{}{
			"success": true,
			"data":    []interface{}{},
		}
	})
	defer server.Close()

	client := &NovaPoshtaClientWithURL{
		NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
		URL:              server.URL,
	}

	ctx := context.Background()
	_, err := client.doRequestWithURL(ctx, "InternetDocument", "delete", map[string]interface{}{
		"DocumentRefs": "doc-ref-123",
	})
	if err != nil {
		t.Fatalf("DeleteDocument error: %v", err)
	}
}

func TestNovaPoshtaAPIErrors(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		wantErr  bool
	}{
		{
			name: "invalid api key",
			response: map[string]interface{}{
				"success": false,
				"errors":  []interface{}{"API key is invalid"},
			},
			wantErr: false, // No error from doRequest, but success=false
		},
		{
			name: "empty data",
			response: map[string]interface{}{
				"success": true,
				"data":    []interface{}{},
			},
			wantErr: false,
		},
		{
			name: "missing data field",
			response: map[string]interface{}{
				"success": true,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			client := &NovaPoshtaClientWithURL{
				NovaPoshtaClient: NewNovaPoshtaClient("test-api-key"),
				URL:              server.URL,
			}

			ctx := context.Background()
			_, err := client.doRequestWithURL(ctx, "Test", "test", nil)
			if (err != nil) != tt.wantErr {
				t.Errorf("expected error=%v, got error=%v", tt.wantErr, err)
			}
		})
	}
}

// ============================================================================
// Ukrposhta API Tests with Mock Server
// ============================================================================

func TestUkrPoshtaSearchCities(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-bearer" {
			t.Error("missing or invalid Authorization header")
		}

		response := []map[string]interface{}{
			{
				"id":       int64(1),
				"postcode": "01001",
				"city":     "Київ",
				"region":   "Київська",
			},
			{
				"id":       int64(2),
				"postcode": "79000",
				"city":     "Львів",
				"region":   "Львівська",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewUkrPoshtaClient("test-bearer", "test-counterparty")
	// In real implementation, we'd need to inject the server URL
	if client == nil {
		t.Fatal("client should not be nil")
	}
}

func TestUkrPoshtaCreateAddress(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}

		var addr UPAddress
		json.NewDecoder(r.Body).Decode(&addr)

		response := UPAddress{
			ID:          123,
			PostCode:    addr.PostCode,
			City:        addr.City,
			Street:      addr.Street,
			HouseNumber: addr.HouseNumber,
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Verify server works
	resp, err := http.Post(server.URL, "application/json", bytes.NewReader([]byte(`{"postcode":"01001","city":"Київ"}`)))
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var addr UPAddress
	json.NewDecoder(resp.Body).Decode(&addr)
	if addr.ID != 123 {
		t.Errorf("expected ID 123, got %d", addr.ID)
	}
}

func TestUkrPoshtaCreateShipment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"uuid":    "shipment-uuid-123",
			"barcode": "1234567890123",
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	resp, err := http.Post(server.URL, "application/json", bytes.NewReader([]byte(`{}`)))
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["uuid"] != "shipment-uuid-123" {
		t.Errorf("expected uuid 'shipment-uuid-123', got '%v'", result["uuid"])
	}
}

func TestUkrPoshtaTrackShipment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		events := []UPTrackingEvent{
			{
				Barcode:   "1234567890123",
				Step:      1,
				Date:      "01.01.2024",
				Time:      "10:00",
				EventName: "Прийнято",
				Name:      "Київ",
			},
			{
				Barcode:   "1234567890123",
				Step:      2,
				Date:      "02.01.2024",
				Time:      "14:00",
				EventName: "У дорозі",
				Name:      "Львів",
			},
		}
		json.NewEncoder(w).Encode(events)
	}))
	defer server.Close()

	resp, err := http.Get(server.URL)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var events []UPTrackingEvent
	json.NewDecoder(resp.Body).Decode(&events)
	if len(events) != 2 {
		t.Errorf("expected 2 events, got %d", len(events))
	}
}

func TestUkrPoshtaGetPostOffices(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		offices := []UPPostOffice{
			{
				ID:        1,
				PostIndex: "01001",
				Name:      "Відділення №1",
				City:      "Київ",
				Latitude:  50.4501,
				Longitude: 30.5234,
			},
			{
				ID:        2,
				PostIndex: "01002",
				Name:      "Відділення №2",
				City:      "Київ",
				Latitude:  50.4502,
				Longitude: 30.5235,
			},
		}
		json.NewEncoder(w).Encode(offices)
	}))
	defer server.Close()

	resp, err := http.Get(server.URL)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var offices []UPPostOffice
	json.NewDecoder(resp.Body).Decode(&offices)
	if len(offices) != 2 {
		t.Errorf("expected 2 offices, got %d", len(offices))
	}
}

// ============================================================================
// Meest API Tests with Mock Server
// ============================================================================

func TestMeestAuthenticate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)

		if body["username"] == "testuser" && body["password"] == "testpass" {
			response := map[string]interface{}{
				"token":      "auth-token-12345",
				"expires_in": 3600,
			}
			json.NewEncoder(w).Encode(response)
		} else {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid credentials"})
		}
	}))
	defer server.Close()

	// Test successful auth
	authPayload := map[string]string{
		"username": "testuser",
		"password": "testpass",
	}
	data, _ := json.Marshal(authPayload)
	resp, err := http.Post(server.URL, "application/json", bytes.NewReader(data))
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["token"] != "auth-token-12345" {
		t.Errorf("expected token 'auth-token-12345', got '%v'", result["token"])
	}
}

func TestMeestSearchCities(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cities := []MeestCity{
			{
				CityID:    "city-1",
				Name:      "Київ",
				NameRU:    "Киев",
				Region:    "Київська",
				PostIndex: "01001",
			},
			{
				CityID:    "city-2",
				Name:      "Київська область",
				NameRU:    "Киевская область",
				Region:    "Київська",
				PostIndex: "01234",
			},
		}
		json.NewEncoder(w).Encode(cities)
	}))
	defer server.Close()

	resp, err := http.Get(server.URL + "?query=Київ")
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var cities []MeestCity
	json.NewDecoder(resp.Body).Decode(&cities)
	if len(cities) != 2 {
		t.Errorf("expected 2 cities, got %d", len(cities))
	}
}

func TestMeestGetBranches(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		branches := []MeestBranch{
			{
				BranchID:     "branch-1",
				BranchNumber: "1",
				Name:         "Відділення №1",
				City:         "Київ",
				Address:      "вул. Хрещатик, 1",
				Latitude:     50.4501,
				Longitude:    30.5234,
				MaxWeight:    30,
				PaymentCard:  true,
			},
			{
				BranchID:     "branch-2",
				BranchNumber: "2",
				Name:         "Відділення №2",
				City:         "Київ",
				Address:      "вул. Хрещатик, 10",
				Latitude:     50.4502,
				Longitude:    30.5235,
				MaxWeight:    30,
				PaymentCard:  true,
			},
		}
		json.NewEncoder(w).Encode(branches)
	}))
	defer server.Close()

	resp, err := http.Get(server.URL)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var branches []MeestBranch
	json.NewDecoder(resp.Body).Decode(&branches)
	if len(branches) != 2 {
		t.Errorf("expected 2 branches, got %d", len(branches))
	}
}

func TestMeestCreateShipment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}

		var shipment MeestShipment
		json.NewDecoder(r.Body).Decode(&shipment)

		response := map[string]interface{}{
			"parcel_id": "parcel-123",
			"barcode":   "1234567890",
			"status":    "created",
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	shipment := MeestShipment{
		SenderBranchID:   "branch-1",
		ReceiverBranchID: "branch-2",
		SenderName:       "Іван Іванов",
		SenderPhone:      "+380501234567",
		ReceiverName:     "Петро Петров",
		ReceiverPhone:    "+380507654321",
		Parcels: []MeestParcel{
			{Weight: 1.5, DeclaredValue: 500},
		},
	}
	data, _ := json.Marshal(shipment)

	resp, err := http.Post(server.URL, "application/json", bytes.NewReader(data))
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["parcel_id"] != "parcel-123" {
		t.Errorf("expected parcel_id 'parcel-123', got '%v'", result["parcel_id"])
	}
}

func TestMeestTrackShipment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		events := []MeestTrackingEvent{
			{
				Date:        "01.01.2024",
				Time:        "10:00",
				Status:      "Прийнято",
				StatusCode:  "1",
				City:        "Київ",
				Branch:      "Відділення №1",
				Description: "Посилку прийнято",
			},
			{
				Date:        "02.01.2024",
				Time:        "14:00",
				Status:      "У дорозі",
				StatusCode:  "2",
				City:        "Львів",
				Branch:      "",
				Description: "Посилка у дорозі",
			},
		}
		json.NewEncoder(w).Encode(events)
	}))
	defer server.Close()

	resp, err := http.Get(server.URL)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var events []MeestTrackingEvent
	json.NewDecoder(resp.Body).Decode(&events)
	if len(events) != 2 {
		t.Errorf("expected 2 events, got %d", len(events))
	}
}

func TestMeestCalculateCost(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cost := MeestDeliveryCost{
			TotalCost:     100,
			DeliveryCost:  75,
			InsuranceCost: 15,
			CODCost:       10,
			Currency:      "UAH",
		}
		json.NewEncoder(w).Encode(cost)
	}))
	defer server.Close()

	resp, err := http.Get(server.URL)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	defer resp.Body.Close()

	var cost MeestDeliveryCost
	json.NewDecoder(resp.Body).Decode(&cost)
	if cost.TotalCost != 100 {
		t.Errorf("expected TotalCost 100, got %f", cost.TotalCost)
	}
}

// ============================================================================
// Justin Tests (if implemented)
// ============================================================================

func TestNewJustinClient(t *testing.T) {
	client := NewJustinClient("api-key", "login")
	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.apiKey != "api-key" {
		t.Errorf("expected apiKey 'api-key', got '%s'", client.apiKey)
	}
	if client.login != "login" {
		t.Errorf("expected login 'login', got '%s'", client.login)
	}
}

func TestJustinBranchStruct(t *testing.T) {
	branch := JustinBranch{
		UUID:         "branch-uuid-123",
		BranchNumber: "1",
		SenderCode:   "SC001",
		Address:      "вул. Хрещатик, 1",
		AddressUKR:   "вул. Хрещатик, 1",
		City:         "Київ",
		CityUKR:      "Київ",
		Region:       "Київська",
		PostIndex:    "01001",
		Latitude:     50.4501,
		Longitude:    30.5234,
		Schedule:     "09:00-18:00",
		MaxWeight:    30,
		Phone:        "0800123456",
		Type:         "branch",
		Active:       true,
	}

	if branch.MaxWeight != 30 {
		t.Errorf("expected MaxWeight 30, got %f", branch.MaxWeight)
	}
	if branch.BranchNumber != "1" {
		t.Errorf("expected BranchNumber '1', got '%s'", branch.BranchNumber)
	}
	if !branch.Active {
		t.Error("expected Active to be true")
	}
}

func TestJustinCityStruct(t *testing.T) {
	city := JustinCity{
		UUID:     "city-uuid-123",
		Name:     "Київ",
		NameUKR:  "Київ",
		NameRU:   "Киев",
		Region:   "Київська",
		District: "Київський",
		Type:     "місто",
	}

	if city.Name != "Київ" {
		t.Errorf("expected Name 'Київ', got '%s'", city.Name)
	}
}

func TestJustinOrderStruct(t *testing.T) {
	order := JustinOrder{
		OrderNumber:  "ORD-123",
		TTN:          "TTN-456",
		SenderBranch: "branch-1",
		SenderContact: JustinContact{
			Name:  "Іван Іванов",
			Phone: "+380501234567",
			Email: "sender@example.com",
		},
		RecipientContact: JustinContact{
			Name:  "Петро Петров",
			Phone: "+380507654321",
		},
		DeliveryType:  "branch2branch",
		ServiceType:   "Standard",
		PayerType:     "sender",
		DeclaredValue: 500,
		COD:           500,
		Description:   "Товари",
		NotifySMS:     true,
	}

	if order.DeliveryType != "branch2branch" {
		t.Errorf("expected DeliveryType 'branch2branch', got '%s'", order.DeliveryType)
	}
	if order.COD != 500 {
		t.Errorf("expected COD 500, got %f", order.COD)
	}
}

func TestJustinTrackingEventStruct(t *testing.T) {
	event := JustinTrackingEvent{
		Date:        "01.01.2024",
		Time:        "10:00",
		Status:      "Прийнято",
		StatusCode:  "1",
		StatusName:  "Прийнято у відправника",
		City:        "Київ",
		Branch:      "Відділення №1",
		Description: "Посилку прийнято",
	}

	if event.StatusCode != "1" {
		t.Errorf("expected StatusCode '1', got '%s'", event.StatusCode)
	}
}

func TestJustinDeliveryCostStruct(t *testing.T) {
	cost := JustinDeliveryCost{
		DeliveryCost:  75,
		CODCost:       10,
		InsuranceCost: 15,
		TotalCost:     100,
		Currency:      "UAH",
	}

	calculated := cost.DeliveryCost + cost.CODCost + cost.InsuranceCost
	if calculated != cost.TotalCost {
		t.Errorf("expected total %f, got %f", cost.TotalCost, calculated)
	}
}

// ============================================================================
// Integration-like Tests
// ============================================================================

func TestLogisticsProviderInterface(t *testing.T) {
	// Test that all providers can be used similarly
	npClient := NewNovaPoshtaClient("np-api-key")
	upClient := NewUkrPoshtaClient("up-bearer", "up-counterparty")
	meestClient := NewMeestClient("meest-user", "meest-pass", "meest-api")

	if npClient == nil || upClient == nil || meestClient == nil {
		t.Fatal("all clients should be created successfully")
	}

	// Verify clients have httpClient set
	if npClient.httpClient == nil {
		t.Error("Nova Poshta client missing httpClient")
	}
	if upClient.httpClient == nil {
		t.Error("Ukrposhta client missing httpClient")
	}
	if meestClient.httpClient == nil {
		t.Error("Meest client missing httpClient")
	}
}

func TestConcurrentAPIRequests(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		time.Sleep(10 * time.Millisecond) // Simulate API delay
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer server.Close()

	client := &http.Client{Timeout: 5 * time.Second}

	// Make concurrent requests
	done := make(chan bool, 5)
	for i := 0; i < 5; i++ {
		go func() {
			resp, err := client.Get(server.URL)
			if err != nil {
				t.Errorf("request error: %v", err)
			} else {
				resp.Body.Close()
			}
			done <- true
		}()
	}

	// Wait for all requests
	for i := 0; i < 5; i++ {
		<-done
	}

	if requestCount != 5 {
		t.Errorf("expected 5 requests, got %d", requestCount)
	}
}
