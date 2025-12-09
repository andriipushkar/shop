package logistics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const ukrPoshtaAPIURL = "https://www.ukrposhta.ua/ecom/0.0.1"

// UkrPoshtaClient implements Ukrposhta API integration
type UkrPoshtaClient struct {
	bearerToken string
	counterpartyToken string
	httpClient  *http.Client
}

// NewUkrPoshtaClient creates Ukrposhta client
func NewUkrPoshtaClient(bearerToken, counterpartyToken string) *UkrPoshtaClient {
	return &UkrPoshtaClient{
		bearerToken:       bearerToken,
		counterpartyToken: counterpartyToken,
		httpClient:        &http.Client{Timeout: 30 * time.Second},
	}
}

// UPAddress represents an address
type UPAddress struct {
	ID              int64  `json:"id,omitempty"`
	PostCode        string `json:"postcode"`
	Country         string `json:"country"`
	Region          string `json:"region"`
	District        string `json:"district"`
	City            string `json:"city"`
	Street          string `json:"street"`
	HouseNumber     string `json:"houseNumber"`
	ApartmentNumber string `json:"apartmentNumber"`
	Description     string `json:"description,omitempty"`
}

// UPClient represents a client/counterparty
type UPClient struct {
	UUID            string `json:"uuid,omitempty"`
	Name            string `json:"name"`
	FirstName       string `json:"firstName"`
	MiddleName      string `json:"middleName"`
	LastName        string `json:"lastName"`
	PhoneNumber     string `json:"phoneNumber"`
	Email           string `json:"email,omitempty"`
	Type            string `json:"type"` // INDIVIDUAL/COMPANY
	Resident        bool   `json:"resident"`
	ExternalID      string `json:"externalId,omitempty"`
	UniqueRegistrationNumber string `json:"uniqueRegistrationNumber,omitempty"` // EDRPOU for companies
	AddressID       int64  `json:"addressId,omitempty"`
	Individual      bool   `json:"individual"`
	CounterpartyUUID string `json:"counterpartyUuid,omitempty"`
	BankCode        string `json:"bankCode,omitempty"`
	BankAccount     string `json:"bankAccount,omitempty"`
}

// UPShipment represents a shipment
type UPShipment struct {
	UUID              string   `json:"uuid,omitempty"`
	Barcode           string   `json:"barcode,omitempty"`
	Sender            UPClient `json:"sender"`
	Recipient         UPClient `json:"recipient"`
	SenderAddress     UPAddress `json:"senderAddress,omitempty"`
	RecipientAddress  UPAddress `json:"recipientAddress,omitempty"`
	DeliveryType      string   `json:"deliveryType"`      // W2W, W2D, D2W, D2D
	PaidByRecipient   bool     `json:"paidByRecipient"`
	Parcels           []UPParcel `json:"parcels"`
	DeliveryPrice     float64  `json:"deliveryPrice,omitempty"`
	PostPay           float64  `json:"postPay,omitempty"`
	Description       string   `json:"description"`
	OnFailReceiveType string   `json:"onFailReceiveType"` // RETURN/PROCESS_AS_REFUSAL
	LastModified      string   `json:"lastModified,omitempty"`
	Status            string   `json:"status,omitempty"`
}

// UPParcel represents a parcel
type UPParcel struct {
	Weight        float64 `json:"weight"`
	Length        float64 `json:"length"`
	Width         float64 `json:"width"`
	Height        float64 `json:"height"`
	DeclaredPrice float64 `json:"declaredPrice"`
}

// UPTrackingEvent represents tracking event
type UPTrackingEvent struct {
	Barcode     string `json:"barcode"`
	Step        int    `json:"step"`
	Date        string `json:"date"`
	Time        string `json:"time"`
	Index       string `json:"index"`
	Name        string `json:"name"`
	EventName   string `json:"eventName"`
	Country     string `json:"country"`
	EventReason string `json:"eventReason,omitempty"`
}

// UPPostOffice represents a post office
type UPPostOffice struct {
	ID               int64   `json:"id"`
	PostIndex        string  `json:"postIndex"`
	Name             string  `json:"name"`
	Address          string  `json:"address"`
	Phone            string  `json:"phone"`
	Latitude         float64 `json:"latitude"`
	Longitude        float64 `json:"longitude"`
	City             string  `json:"city"`
	District         string  `json:"district"`
	Region           string  `json:"region"`
	Type             string  `json:"type"`
	LockCode         string  `json:"lockCode,omitempty"`
	MeestPickUpPoint bool    `json:"meestPickUpPoint"`
}

// CreateAddress creates a new address
func (c *UkrPoshtaClient) CreateAddress(ctx context.Context, addr *UPAddress) (*UPAddress, error) {
	resp, err := c.doRequest(ctx, "POST", "/addresses", addr)
	if err != nil {
		return nil, err
	}

	var result UPAddress
	if err := mapToStruct(resp, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateClient creates a client/counterparty
func (c *UkrPoshtaClient) CreateClient(ctx context.Context, client *UPClient) (*UPClient, error) {
	resp, err := c.doRequest(ctx, "POST", "/clients?token="+c.counterpartyToken, client)
	if err != nil {
		return nil, err
	}

	var result UPClient
	if err := mapToStruct(resp, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetClient gets client by UUID
func (c *UkrPoshtaClient) GetClient(ctx context.Context, uuid string) (*UPClient, error) {
	resp, err := c.doRequest(ctx, "GET", "/clients/"+uuid+"?token="+c.counterpartyToken, nil)
	if err != nil {
		return nil, err
	}

	var result UPClient
	if err := mapToStruct(resp, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateShipment creates a new shipment
func (c *UkrPoshtaClient) CreateShipment(ctx context.Context, shipment *UPShipment) (*UPShipment, error) {
	resp, err := c.doRequest(ctx, "POST", "/shipments?token="+c.counterpartyToken, shipment)
	if err != nil {
		return nil, err
	}

	var result UPShipment
	if err := mapToStruct(resp, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetShipment gets shipment by UUID
func (c *UkrPoshtaClient) GetShipment(ctx context.Context, uuid string) (*UPShipment, error) {
	resp, err := c.doRequest(ctx, "GET", "/shipments/"+uuid+"?token="+c.counterpartyToken, nil)
	if err != nil {
		return nil, err
	}

	var result UPShipment
	if err := mapToStruct(resp, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// DeleteShipment deletes a shipment
func (c *UkrPoshtaClient) DeleteShipment(ctx context.Context, uuid string) error {
	_, err := c.doRequest(ctx, "DELETE", "/shipments/"+uuid+"?token="+c.counterpartyToken, nil)
	return err
}

// GetShipmentLabel gets shipment label PDF
func (c *UkrPoshtaClient) GetShipmentLabel(ctx context.Context, uuid string, format string) ([]byte, error) {
	// format: pdf100x100, pdf_a5, pdf_a4
	url := ukrPoshtaAPIURL + "/shipments/" + uuid + "/label?token=" + c.counterpartyToken
	if format != "" {
		url += "&type=" + format
	}

	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+c.bearerToken)
	req.Header.Set("Accept", "application/pdf")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ukrposhta API error %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

// CreateShipmentGroup creates a group of shipments
func (c *UkrPoshtaClient) CreateShipmentGroup(ctx context.Context, name string, shipmentUUIDs []string) (map[string]interface{}, error) {
	return c.doRequest(ctx, "POST", "/shipment-groups?token="+c.counterpartyToken, map[string]interface{}{
		"name":           name,
		"shipmentUuids":  shipmentUUIDs,
	})
}

// TrackShipment tracks a shipment by barcode
func (c *UkrPoshtaClient) TrackShipment(ctx context.Context, barcode string) ([]UPTrackingEvent, error) {
	resp, err := c.doRequest(ctx, "GET", "/statuses?barcode="+barcode, nil)
	if err != nil {
		return nil, err
	}

	eventsData, ok := resp["events"].([]interface{})
	if !ok {
		// Try to parse as direct array
		data, _ := json.Marshal(resp)
		var events []UPTrackingEvent
		if err := json.Unmarshal(data, &events); err == nil {
			return events, nil
		}
		return nil, nil
	}

	events := make([]UPTrackingEvent, 0, len(eventsData))
	for _, e := range eventsData {
		em := e.(map[string]interface{})
		event := UPTrackingEvent{
			Barcode:   fmt.Sprintf("%v", em["barcode"]),
			EventName: fmt.Sprintf("%v", em["eventName"]),
			Date:      fmt.Sprintf("%v", em["date"]),
			Time:      fmt.Sprintf("%v", em["time"]),
			Index:     fmt.Sprintf("%v", em["index"]),
			Name:      fmt.Sprintf("%v", em["name"]),
			Country:   fmt.Sprintf("%v", em["country"]),
		}
		if step, ok := em["step"].(float64); ok {
			event.Step = int(step)
		}
		events = append(events, event)
	}

	return events, nil
}

// GetLastStatus gets last tracking status
func (c *UkrPoshtaClient) GetLastStatus(ctx context.Context, barcode string) (*UPTrackingEvent, error) {
	resp, err := c.doRequest(ctx, "GET", "/statuses/last?barcode="+barcode, nil)
	if err != nil {
		return nil, err
	}

	var event UPTrackingEvent
	if err := mapToStruct(resp, &event); err != nil {
		return nil, err
	}
	return &event, nil
}

// CalculateDeliveryPrice calculates delivery price
func (c *UkrPoshtaClient) CalculateDeliveryPrice(ctx context.Context, senderPostcode, recipientPostcode string, weight float64, declaredPrice float64, deliveryType string) (float64, error) {
	resp, err := c.doRequest(ctx, "GET", fmt.Sprintf("/domestic/delivery-price?senderPostcode=%s&recipientPostcode=%s&weight=%.2f&declaredPrice=%.2f&deliveryType=%s",
		senderPostcode, recipientPostcode, weight, declaredPrice, deliveryType), nil)
	if err != nil {
		return 0, err
	}

	if price, ok := resp["deliveryPrice"].(float64); ok {
		return price, nil
	}
	return 0, nil
}

// GetPostOffices gets post offices by city
func (c *UkrPoshtaClient) GetPostOffices(ctx context.Context, city string, region string) ([]UPPostOffice, error) {
	url := "/post-offices?city=" + city
	if region != "" {
		url += "&region=" + region
	}

	resp, err := c.doRequest(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	officesData, ok := resp["offices"].([]interface{})
	if !ok {
		// Try to parse as direct array
		data, _ := json.Marshal(resp)
		var offices []UPPostOffice
		if err := json.Unmarshal(data, &offices); err == nil {
			return offices, nil
		}
		return nil, nil
	}

	offices := make([]UPPostOffice, 0, len(officesData))
	for _, o := range officesData {
		om := o.(map[string]interface{})
		office := UPPostOffice{
			PostIndex: fmt.Sprintf("%v", om["postIndex"]),
			Name:      fmt.Sprintf("%v", om["name"]),
			Address:   fmt.Sprintf("%v", om["address"]),
			City:      fmt.Sprintf("%v", om["city"]),
			Region:    fmt.Sprintf("%v", om["region"]),
		}
		if id, ok := om["id"].(float64); ok {
			office.ID = int64(id)
		}
		if lat, ok := om["latitude"].(float64); ok {
			office.Latitude = lat
		}
		if lon, ok := om["longitude"].(float64); ok {
			office.Longitude = lon
		}
		offices = append(offices, office)
	}

	return offices, nil
}

// GetPostOfficeByIndex gets post office by postal index
func (c *UkrPoshtaClient) GetPostOfficeByIndex(ctx context.Context, postIndex string) (*UPPostOffice, error) {
	resp, err := c.doRequest(ctx, "GET", "/post-offices/"+postIndex, nil)
	if err != nil {
		return nil, err
	}

	var office UPPostOffice
	if err := mapToStruct(resp, &office); err != nil {
		return nil, err
	}
	return &office, nil
}

// SearchCities searches cities
func (c *UkrPoshtaClient) SearchCities(ctx context.Context, query string) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "GET", "/cities?name="+query, nil)
	if err != nil {
		return nil, err
	}

	if cities, ok := resp["cities"].([]interface{}); ok {
		result := make([]map[string]interface{}, 0, len(cities))
		for _, city := range cities {
			result = append(result, city.(map[string]interface{}))
		}
		return result, nil
	}
	return nil, nil
}

// SearchStreets searches streets in a city
func (c *UkrPoshtaClient) SearchStreets(ctx context.Context, cityID int64, query string) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "GET", fmt.Sprintf("/streets?cityId=%d&name=%s", cityID, query), nil)
	if err != nil {
		return nil, err
	}

	if streets, ok := resp["streets"].([]interface{}); ok {
		result := make([]map[string]interface{}, 0, len(streets))
		for _, street := range streets {
			result = append(result, street.(map[string]interface{}))
		}
		return result, nil
	}
	return nil, nil
}

func (c *UkrPoshtaClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, ukrPoshtaAPIURL+path, reqBody)
	req.Header.Set("Authorization", "Bearer "+c.bearerToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ukrposhta API error %d: %s", resp.StatusCode, string(body))
	}

	if resp.StatusCode == 204 {
		return nil, nil
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func mapToStruct(m map[string]interface{}, v interface{}) error {
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}
