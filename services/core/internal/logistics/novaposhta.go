package logistics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const novaPoshtaAPIURL = "https://api.novaposhta.ua/v2.0/json/"

// NovaPoshtaClient implements Nova Poshta API integration
type NovaPoshtaClient struct {
	apiKey     string
	httpClient *http.Client
}

// NewNovaPoshtaClient creates Nova Poshta client
func NewNovaPoshtaClient(apiKey string) *NovaPoshtaClient {
	return &NovaPoshtaClient{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// City represents a city
type City struct {
	Ref         string `json:"Ref"`
	Description string `json:"Description"`
	DescriptionRu string `json:"DescriptionRu"`
	Area        string `json:"Area"`
	SettlementType string `json:"SettlementType"`
}

// Warehouse represents a warehouse/branch
type Warehouse struct {
	Ref              string `json:"Ref"`
	SiteKey          string `json:"SiteKey"`
	Description      string `json:"Description"`
	DescriptionRu    string `json:"DescriptionRu"`
	Phone            string `json:"Phone"`
	TypeOfWarehouse  string `json:"TypeOfWarehouse"`
	Number           string `json:"Number"`
	CityRef          string `json:"CityRef"`
	CityDescription  string `json:"CityDescription"`
	SettlementRef    string `json:"SettlementRef"`
	SettlementDescription string `json:"SettlementDescription"`
	Longitude        string `json:"Longitude"`
	Latitude         string `json:"Latitude"`
	PostFinance      string `json:"PostFinance"`
	TotalMaxWeightAllowed float64 `json:"TotalMaxWeightAllowed"`
	PlaceMaxWeightAllowed float64 `json:"PlaceMaxWeightAllowed"`
	Schedule         map[string]string `json:"Schedule"`
}

// Parcel represents parcel dimensions
type Parcel struct {
	Weight float64 `json:"Weight"`
	Length float64 `json:"Length"`
	Width  float64 `json:"Width"`
	Height float64 `json:"Height"`
}

// InternetDocument represents a waybill
type InternetDocument struct {
	Ref                   string `json:"Ref"`
	IntDocNumber          string `json:"IntDocNumber"`
	CostOnSite            float64 `json:"CostOnSite"`
	EstimatedDeliveryDate string `json:"EstimatedDeliveryDate"`
	DateTime              string `json:"DateTime"`
	RecipientsPhone       string `json:"RecipientsPhone"`
	Status                string `json:"Status"`
	StatusCode            string `json:"StatusCode"`
}

// TrackingInfo represents tracking status
type TrackingInfo struct {
	Number              string `json:"Number"`
	Status              string `json:"Status"`
	StatusCode          string `json:"StatusCode"`
	WarehouseSender     string `json:"WarehouseSender"`
	WarehouseRecipient  string `json:"WarehouseRecipient"`
	WarehouseRecipientNumber string `json:"WarehouseRecipientNumber"`
	CityRecipient       string `json:"CityRecipient"`
	CitySender          string `json:"CitySender"`
	RecipientFullName   string `json:"RecipientFullName"`
	DateCreated         string `json:"DateCreated"`
	DateScan            string `json:"DateScan"`
	DatePayedKeeping    string `json:"DatePayedKeeping"`
	ActualDeliveryDate  string `json:"ActualDeliveryDate"`
	ScheduledDeliveryDate string `json:"ScheduledDeliveryDate"`
	PaymentMethod       string `json:"PaymentMethod"`
	DocumentWeight      float64 `json:"DocumentWeight"`
	DocumentCost        float64 `json:"DocumentCost"`
	SumBeforeCheckWeight float64 `json:"SumBeforeCheckWeight"`
	AnnouncedPrice      float64 `json:"AnnouncedPrice"`
	RedeliverySum       float64 `json:"RedeliverySum"`
}

// DeliveryCost represents delivery cost calculation result
type DeliveryCost struct {
	Cost              float64 `json:"Cost"`
	AssessedCost      float64 `json:"AssessedCost"`
	CostRedelivery    float64 `json:"CostRedelivery"`
	CostPack          float64 `json:"CostPack"`
}

// SearchCities searches for cities by name
func (c *NovaPoshtaClient) SearchCities(ctx context.Context, query string, limit int) ([]City, error) {
	resp, err := c.doRequest(ctx, "Address", "searchSettlements", map[string]interface{}{
		"CityName": query,
		"Limit":    limit,
	})
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok || len(data) == 0 {
		return nil, nil
	}

	// Extract addresses from response
	addresses := data[0].(map[string]interface{})["Addresses"].([]interface{})
	cities := make([]City, 0, len(addresses))
	for _, a := range addresses {
		am := a.(map[string]interface{})
		cities = append(cities, City{
			Ref:         fmt.Sprintf("%v", am["Ref"]),
			Description: fmt.Sprintf("%v", am["Present"]),
		})
	}

	return cities, nil
}

// GetCities returns list of cities
func (c *NovaPoshtaClient) GetCities(ctx context.Context, areaRef string, page int) ([]City, error) {
	props := map[string]interface{}{
		"Page": page,
		"Limit": 150,
	}
	if areaRef != "" {
		props["AreaRef"] = areaRef
	}

	resp, err := c.doRequest(ctx, "Address", "getCities", props)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	cities := make([]City, 0, len(data))
	for _, d := range data {
		dm := d.(map[string]interface{})
		cities = append(cities, City{
			Ref:           fmt.Sprintf("%v", dm["Ref"]),
			Description:   fmt.Sprintf("%v", dm["Description"]),
			DescriptionRu: fmt.Sprintf("%v", dm["DescriptionRu"]),
			Area:          fmt.Sprintf("%v", dm["Area"]),
			SettlementType: fmt.Sprintf("%v", dm["SettlementType"]),
		})
	}

	return cities, nil
}

// GetWarehouses returns warehouses for a city
func (c *NovaPoshtaClient) GetWarehouses(ctx context.Context, cityRef string, typeRef string) ([]Warehouse, error) {
	props := map[string]interface{}{
		"CityRef": cityRef,
	}
	if typeRef != "" {
		props["TypeOfWarehouseRef"] = typeRef
	}

	resp, err := c.doRequest(ctx, "Address", "getWarehouses", props)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	warehouses := make([]Warehouse, 0, len(data))
	for _, d := range data {
		dm := d.(map[string]interface{})
		w := Warehouse{
			Ref:             fmt.Sprintf("%v", dm["Ref"]),
			SiteKey:         fmt.Sprintf("%v", dm["SiteKey"]),
			Description:     fmt.Sprintf("%v", dm["Description"]),
			DescriptionRu:   fmt.Sprintf("%v", dm["DescriptionRu"]),
			Phone:           fmt.Sprintf("%v", dm["Phone"]),
			TypeOfWarehouse: fmt.Sprintf("%v", dm["TypeOfWarehouse"]),
			Number:          fmt.Sprintf("%v", dm["Number"]),
			CityRef:         fmt.Sprintf("%v", dm["CityRef"]),
			CityDescription: fmt.Sprintf("%v", dm["CityDescription"]),
			Longitude:       fmt.Sprintf("%v", dm["Longitude"]),
			Latitude:        fmt.Sprintf("%v", dm["Latitude"]),
		}
		if weight, ok := dm["TotalMaxWeightAllowed"].(float64); ok {
			w.TotalMaxWeightAllowed = weight
		}
		warehouses = append(warehouses, w)
	}

	return warehouses, nil
}

// SearchWarehouses searches warehouses
func (c *NovaPoshtaClient) SearchWarehouses(ctx context.Context, cityName, warehouseID string) ([]Warehouse, error) {
	props := map[string]interface{}{
		"CityName":    cityName,
		"WarehouseId": warehouseID,
	}

	resp, err := c.doRequest(ctx, "Address", "getWarehouses", props)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	warehouses := make([]Warehouse, 0, len(data))
	for _, d := range data {
		dm := d.(map[string]interface{})
		warehouses = append(warehouses, Warehouse{
			Ref:             fmt.Sprintf("%v", dm["Ref"]),
			Description:     fmt.Sprintf("%v", dm["Description"]),
			Number:          fmt.Sprintf("%v", dm["Number"]),
			CityDescription: fmt.Sprintf("%v", dm["CityDescription"]),
		})
	}

	return warehouses, nil
}

// CalculateDeliveryCost calculates delivery cost
func (c *NovaPoshtaClient) CalculateDeliveryCost(ctx context.Context, citySender, cityRecipient string, weight float64, cost float64, serviceType string, cargoType string) (*DeliveryCost, error) {
	props := map[string]interface{}{
		"CitySender":    citySender,
		"CityRecipient": cityRecipient,
		"Weight":        weight,
		"ServiceType":   serviceType,
		"Cost":          cost,
		"CargoType":     cargoType,
		"SeatsAmount":   1,
	}

	resp, err := c.doRequest(ctx, "InternetDocument", "getDocumentPrice", props)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok || len(data) == 0 {
		return nil, fmt.Errorf("no cost data returned")
	}

	dm := data[0].(map[string]interface{})
	result := &DeliveryCost{}
	if cost, ok := dm["Cost"].(float64); ok {
		result.Cost = cost
	}
	if assessed, ok := dm["AssessedCost"].(float64); ok {
		result.AssessedCost = assessed
	}
	if redelivery, ok := dm["CostRedelivery"].(float64); ok {
		result.CostRedelivery = redelivery
	}

	return result, nil
}

// CreateInternetDocument creates a waybill
func (c *NovaPoshtaClient) CreateInternetDocument(ctx context.Context, doc *CreateDocumentRequest) (*InternetDocument, error) {
	props := map[string]interface{}{
		"PayerType":        doc.PayerType,
		"PaymentMethod":    doc.PaymentMethod,
		"DateTime":         doc.DateTime,
		"CargoType":        doc.CargoType,
		"Weight":           doc.Weight,
		"ServiceType":      doc.ServiceType,
		"SeatsAmount":      doc.SeatsAmount,
		"Description":      doc.Description,
		"Cost":             doc.Cost,
		"CitySender":       doc.CitySender,
		"Sender":           doc.Sender,
		"SenderAddress":    doc.SenderAddress,
		"ContactSender":    doc.ContactSender,
		"SendersPhone":     doc.SendersPhone,
		"CityRecipient":    doc.CityRecipient,
		"Recipient":        doc.Recipient,
		"RecipientAddress": doc.RecipientAddress,
		"ContactRecipient": doc.ContactRecipient,
		"RecipientsPhone":  doc.RecipientsPhone,
	}

	// Cash on delivery
	if doc.BackwardDeliveryData != nil {
		props["BackwardDeliveryData"] = doc.BackwardDeliveryData
	}

	// Volume weight
	if doc.VolumeGeneral > 0 {
		props["VolumeGeneral"] = doc.VolumeGeneral
	}

	resp, err := c.doRequest(ctx, "InternetDocument", "save", props)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok || len(data) == 0 {
		if errors, ok := resp["errors"].([]interface{}); ok && len(errors) > 0 {
			return nil, fmt.Errorf("Nova Poshta error: %v", errors)
		}
		return nil, fmt.Errorf("failed to create document")
	}

	dm := data[0].(map[string]interface{})
	return &InternetDocument{
		Ref:                   fmt.Sprintf("%v", dm["Ref"]),
		IntDocNumber:          fmt.Sprintf("%v", dm["IntDocNumber"]),
		EstimatedDeliveryDate: fmt.Sprintf("%v", dm["EstimatedDeliveryDate"]),
	}, nil
}

// CreateDocumentRequest represents request to create waybill
type CreateDocumentRequest struct {
	PayerType             string                 `json:"PayerType"`      // Sender/Recipient/ThirdPerson
	PaymentMethod         string                 `json:"PaymentMethod"`  // Cash/NonCash
	DateTime              string                 `json:"DateTime"`       // dd.mm.yyyy
	CargoType             string                 `json:"CargoType"`      // Cargo/Documents/TiresWheels/Pallet
	Weight                float64                `json:"Weight"`
	ServiceType           string                 `json:"ServiceType"`    // WarehouseWarehouse/WarehouseDoors/DoorsWarehouse/DoorsDoors
	SeatsAmount           int                    `json:"SeatsAmount"`
	Description           string                 `json:"Description"`
	Cost                  float64                `json:"Cost"`
	CitySender            string                 `json:"CitySender"`
	Sender                string                 `json:"Sender"`         // Counterparty Ref
	SenderAddress         string                 `json:"SenderAddress"`  // Warehouse Ref
	ContactSender         string                 `json:"ContactSender"`
	SendersPhone          string                 `json:"SendersPhone"`
	CityRecipient         string                 `json:"CityRecipient"`
	Recipient             string                 `json:"Recipient"`
	RecipientAddress      string                 `json:"RecipientAddress"`
	ContactRecipient      string                 `json:"ContactRecipient"`
	RecipientsPhone       string                 `json:"RecipientsPhone"`
	VolumeGeneral         float64                `json:"VolumeGeneral"`
	BackwardDeliveryData  []map[string]interface{} `json:"BackwardDeliveryData"` // Cash on delivery
}

// TrackDocument tracks a shipment
func (c *NovaPoshtaClient) TrackDocument(ctx context.Context, documentNumber string) (*TrackingInfo, error) {
	resp, err := c.doRequest(ctx, "TrackingDocument", "getStatusDocuments", map[string]interface{}{
		"Documents": []map[string]string{
			{"DocumentNumber": documentNumber},
		},
	})
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok || len(data) == 0 {
		return nil, fmt.Errorf("tracking info not found")
	}

	dm := data[0].(map[string]interface{})
	info := &TrackingInfo{
		Number:             fmt.Sprintf("%v", dm["Number"]),
		Status:             fmt.Sprintf("%v", dm["Status"]),
		StatusCode:         fmt.Sprintf("%v", dm["StatusCode"]),
		WarehouseSender:    fmt.Sprintf("%v", dm["WarehouseSender"]),
		WarehouseRecipient: fmt.Sprintf("%v", dm["WarehouseRecipient"]),
		CityRecipient:      fmt.Sprintf("%v", dm["CityRecipient"]),
		CitySender:         fmt.Sprintf("%v", dm["CitySender"]),
		RecipientFullName:  fmt.Sprintf("%v", dm["RecipientFullName"]),
		DateCreated:        fmt.Sprintf("%v", dm["DateCreated"]),
		ScheduledDeliveryDate: fmt.Sprintf("%v", dm["ScheduledDeliveryDate"]),
		ActualDeliveryDate: fmt.Sprintf("%v", dm["ActualDeliveryDate"]),
	}

	if weight, ok := dm["DocumentWeight"].(float64); ok {
		info.DocumentWeight = weight
	}
	if cost, ok := dm["DocumentCost"].(float64); ok {
		info.DocumentCost = cost
	}

	return info, nil
}

// TrackMultiple tracks multiple shipments
func (c *NovaPoshtaClient) TrackMultiple(ctx context.Context, documentNumbers []string) ([]TrackingInfo, error) {
	documents := make([]map[string]string, len(documentNumbers))
	for i, num := range documentNumbers {
		documents[i] = map[string]string{"DocumentNumber": num}
	}

	resp, err := c.doRequest(ctx, "TrackingDocument", "getStatusDocuments", map[string]interface{}{
		"Documents": documents,
	})
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	results := make([]TrackingInfo, 0, len(data))
	for _, d := range data {
		dm := d.(map[string]interface{})
		info := TrackingInfo{
			Number:     fmt.Sprintf("%v", dm["Number"]),
			Status:     fmt.Sprintf("%v", dm["Status"]),
			StatusCode: fmt.Sprintf("%v", dm["StatusCode"]),
		}
		results = append(results, info)
	}

	return results, nil
}

// DeleteDocument deletes a waybill
func (c *NovaPoshtaClient) DeleteDocument(ctx context.Context, documentRef string) error {
	_, err := c.doRequest(ctx, "InternetDocument", "delete", map[string]interface{}{
		"DocumentRefs": documentRef,
	})
	return err
}

// GetCounterparties returns sender/recipient counterparties
func (c *NovaPoshtaClient) GetCounterparties(ctx context.Context, counterpartyType string) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "Counterparty", "getCounterparties", map[string]interface{}{
		"CounterpartyProperty": counterpartyType, // Sender/Recipient
	})
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	result := make([]map[string]interface{}, 0, len(data))
	for _, d := range data {
		result = append(result, d.(map[string]interface{}))
	}
	return result, nil
}

// GetContactPersons returns contact persons for counterparty
func (c *NovaPoshtaClient) GetContactPersons(ctx context.Context, counterpartyRef string) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "Counterparty", "getCounterpartyContactPersons", map[string]interface{}{
		"Ref": counterpartyRef,
	})
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	result := make([]map[string]interface{}, 0, len(data))
	for _, d := range data {
		result = append(result, d.(map[string]interface{}))
	}
	return result, nil
}

// GetAreas returns list of regions/areas
func (c *NovaPoshtaClient) GetAreas(ctx context.Context) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "Address", "getAreas", nil)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	result := make([]map[string]interface{}, 0, len(data))
	for _, d := range data {
		result = append(result, d.(map[string]interface{}))
	}
	return result, nil
}

// GetWarehouseTypes returns types of warehouses
func (c *NovaPoshtaClient) GetWarehouseTypes(ctx context.Context) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "Address", "getWarehouseTypes", nil)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].([]interface{})
	if !ok {
		return nil, nil
	}

	result := make([]map[string]interface{}, 0, len(data))
	for _, d := range data {
		result = append(result, d.(map[string]interface{}))
	}
	return result, nil
}

func (c *NovaPoshtaClient) doRequest(ctx context.Context, modelName, calledMethod string, methodProperties map[string]interface{}) (map[string]interface{}, error) {
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

	req, err := http.NewRequestWithContext(ctx, "POST", novaPoshtaAPIURL, bytes.NewReader(data))
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

	if success, ok := result["success"].(bool); !ok || !success {
		if errors, ok := result["errors"].([]interface{}); ok && len(errors) > 0 {
			return nil, fmt.Errorf("Nova Poshta API error: %v", errors)
		}
	}

	return result, nil
}
