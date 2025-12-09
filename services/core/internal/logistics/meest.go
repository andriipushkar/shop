package logistics

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const meestAPIURL = "https://api.meest.com/v3.0/openAPI"

// MeestClient implements Meest Express API integration
type MeestClient struct {
	username    string
	password    string
	apiKey      string
	token       string
	tokenExpiry time.Time
	httpClient  *http.Client
}

// NewMeestClient creates Meest client
func NewMeestClient(username, password, apiKey string) *MeestClient {
	return &MeestClient{
		username:   username,
		password:   password,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// MeestBranch represents a branch/post office
type MeestBranch struct {
	BranchID      string  `json:"branchID"`
	BranchNumber  string  `json:"branchNumber"`
	Name          string  `json:"branchNameUKR"`
	NameRU        string  `json:"branchNameRUS"`
	Address       string  `json:"addressUKR"`
	AddressRU     string  `json:"addressRUS"`
	City          string  `json:"cityNameUKR"`
	CityRU        string  `json:"cityNameRUS"`
	Region        string  `json:"regionNameUKR"`
	District      string  `json:"districtNameUKR"`
	PostIndex     string  `json:"postIndex"`
	Phone         string  `json:"phone"`
	Latitude      float64 `json:"lat"`
	Longitude     float64 `json:"lng"`
	WorkHours     string  `json:"workHours"`
	MaxWeight     float64 `json:"maxWeight"`
	Type          string  `json:"type"` // branch, parcelshop
	PaymentCard   bool    `json:"paymentCard"`
	ParcelLocker  bool    `json:"parcelLocker"`
}

// MeestCity represents a city
type MeestCity struct {
	CityID    string `json:"cityID"`
	Name      string `json:"cityNameUKR"`
	NameRU    string `json:"cityNameRUS"`
	Region    string `json:"regionNameUKR"`
	District  string `json:"districtNameUKR"`
	Type      string `json:"cityType"`
	PostIndex string `json:"postIndex"`
}

// MeestParcel represents a parcel for shipment
type MeestParcel struct {
	Weight        float64 `json:"weight"`
	Length        float64 `json:"length"`
	Width         float64 `json:"width"`
	Height        float64 `json:"height"`
	DeclaredValue float64 `json:"declaredValue"`
}

// MeestShipment represents a shipment
type MeestShipment struct {
	ParcelID           string        `json:"parcelID,omitempty"`
	Barcode            string        `json:"barcode,omitempty"`
	SenderBranchID     string        `json:"senderBranchID"`
	ReceiverBranchID   string        `json:"receiverBranchID"`
	SenderName         string        `json:"senderName"`
	SenderPhone        string        `json:"senderPhone"`
	SenderEmail        string        `json:"senderEmail,omitempty"`
	ReceiverName       string        `json:"receiverName"`
	ReceiverPhone      string        `json:"receiverPhone"`
	ReceiverEmail      string        `json:"receiverEmail,omitempty"`
	ServiceType        string        `json:"serviceType"` // Standard, Express
	PaymentType        string        `json:"paymentType"` // Sender, Receiver
	CODAmount          float64       `json:"codAmount,omitempty"` // Cash on delivery
	Parcels            []MeestParcel `json:"parcels"`
	Description        string        `json:"description"`
	DeliveryType       string        `json:"deliveryType"` // Branch, Address
	ReceiverAddress    string        `json:"receiverAddress,omitempty"`
	ReceiverCity       string        `json:"receiverCity,omitempty"`
	ReceiverPostIndex  string        `json:"receiverPostIndex,omitempty"`
	InsuranceAmount    float64       `json:"insuranceAmount,omitempty"`
	NotifyBySMS        bool          `json:"notifyBySMS"`
	NotifyByEmail      bool          `json:"notifyByEmail"`
}

// MeestTrackingEvent represents tracking event
type MeestTrackingEvent struct {
	Date        string `json:"date"`
	Time        string `json:"time"`
	Status      string `json:"statusNameUKR"`
	StatusRU    string `json:"statusNameRUS"`
	StatusCode  string `json:"statusCode"`
	City        string `json:"cityNameUKR"`
	Branch      string `json:"branchNameUKR"`
	Description string `json:"description"`
}

// MeestDeliveryCost represents delivery cost calculation
type MeestDeliveryCost struct {
	TotalCost    float64 `json:"totalCost"`
	DeliveryCost float64 `json:"deliveryCost"`
	InsuranceCost float64 `json:"insuranceCost"`
	CODCost      float64 `json:"codCost"`
	Currency     string  `json:"currency"`
}

// Authenticate authenticates and gets token
func (c *MeestClient) Authenticate(ctx context.Context) error {
	if c.token != "" && time.Now().Before(c.tokenExpiry) {
		return nil
	}

	// Generate password hash
	hash := sha1.Sum([]byte(c.password))
	passwordHash := hex.EncodeToString(hash[:])

	body := map[string]string{
		"username": c.username,
		"password": passwordHash,
	}

	data, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", meestAPIURL+"/auth", bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if token, ok := result["token"].(string); ok {
		c.token = token
		c.tokenExpiry = time.Now().Add(23 * time.Hour) // Token valid for 24 hours
		return nil
	}

	return fmt.Errorf("authentication failed: %v", result)
}

// GetBranches returns branches by city
func (c *MeestClient) GetBranches(ctx context.Context, cityID string) ([]MeestBranch, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/branches?cityID="+cityID, nil)
	if err != nil {
		return nil, err
	}

	branchesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	branches := make([]MeestBranch, 0, len(branchesData))
	for _, b := range branchesData {
		bm := b.(map[string]interface{})
		branch := MeestBranch{
			BranchID:     fmt.Sprintf("%v", bm["branchID"]),
			BranchNumber: fmt.Sprintf("%v", bm["branchNumber"]),
			Name:         fmt.Sprintf("%v", bm["branchNameUKR"]),
			Address:      fmt.Sprintf("%v", bm["addressUKR"]),
			City:         fmt.Sprintf("%v", bm["cityNameUKR"]),
			Region:       fmt.Sprintf("%v", bm["regionNameUKR"]),
			PostIndex:    fmt.Sprintf("%v", bm["postIndex"]),
			Phone:        fmt.Sprintf("%v", bm["phone"]),
			WorkHours:    fmt.Sprintf("%v", bm["workHours"]),
		}
		if lat, ok := bm["lat"].(float64); ok {
			branch.Latitude = lat
		}
		if lng, ok := bm["lng"].(float64); ok {
			branch.Longitude = lng
		}
		if weight, ok := bm["maxWeight"].(float64); ok {
			branch.MaxWeight = weight
		}
		branches = append(branches, branch)
	}

	return branches, nil
}

// SearchBranches searches branches by query
func (c *MeestClient) SearchBranches(ctx context.Context, query string) ([]MeestBranch, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/branches/search?q="+query, nil)
	if err != nil {
		return nil, err
	}

	branchesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	branches := make([]MeestBranch, 0, len(branchesData))
	for _, b := range branchesData {
		bm := b.(map[string]interface{})
		branches = append(branches, MeestBranch{
			BranchID:     fmt.Sprintf("%v", bm["branchID"]),
			BranchNumber: fmt.Sprintf("%v", bm["branchNumber"]),
			Name:         fmt.Sprintf("%v", bm["branchNameUKR"]),
			Address:      fmt.Sprintf("%v", bm["addressUKR"]),
			City:         fmt.Sprintf("%v", bm["cityNameUKR"]),
		})
	}

	return branches, nil
}

// GetCities returns cities by region
func (c *MeestClient) GetCities(ctx context.Context, regionID string) ([]MeestCity, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	url := "/cities"
	if regionID != "" {
		url += "?regionID=" + regionID
	}

	resp, err := c.doRequest(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	citiesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	cities := make([]MeestCity, 0, len(citiesData))
	for _, ct := range citiesData {
		cm := ct.(map[string]interface{})
		cities = append(cities, MeestCity{
			CityID:    fmt.Sprintf("%v", cm["cityID"]),
			Name:      fmt.Sprintf("%v", cm["cityNameUKR"]),
			NameRU:    fmt.Sprintf("%v", cm["cityNameRUS"]),
			Region:    fmt.Sprintf("%v", cm["regionNameUKR"]),
			District:  fmt.Sprintf("%v", cm["districtNameUKR"]),
			Type:      fmt.Sprintf("%v", cm["cityType"]),
			PostIndex: fmt.Sprintf("%v", cm["postIndex"]),
		})
	}

	return cities, nil
}

// SearchCities searches cities
func (c *MeestClient) SearchCities(ctx context.Context, query string) ([]MeestCity, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/cities/search?q="+query, nil)
	if err != nil {
		return nil, err
	}

	citiesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	cities := make([]MeestCity, 0, len(citiesData))
	for _, ct := range citiesData {
		cm := ct.(map[string]interface{})
		cities = append(cities, MeestCity{
			CityID: fmt.Sprintf("%v", cm["cityID"]),
			Name:   fmt.Sprintf("%v", cm["cityNameUKR"]),
			Region: fmt.Sprintf("%v", cm["regionNameUKR"]),
		})
	}

	return cities, nil
}

// CreateShipment creates a new shipment
func (c *MeestClient) CreateShipment(ctx context.Context, shipment *MeestShipment) (*MeestShipment, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "POST", "/parcels", shipment)
	if err != nil {
		return nil, err
	}

	result, ok := resp["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response")
	}

	shipment.ParcelID = fmt.Sprintf("%v", result["parcelID"])
	shipment.Barcode = fmt.Sprintf("%v", result["barcode"])

	return shipment, nil
}

// GetShipment gets shipment by ID
func (c *MeestClient) GetShipment(ctx context.Context, parcelID string) (*MeestShipment, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/parcels/"+parcelID, nil)
	if err != nil {
		return nil, err
	}

	result, ok := resp["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("shipment not found")
	}

	shipment := &MeestShipment{
		ParcelID:     fmt.Sprintf("%v", result["parcelID"]),
		Barcode:      fmt.Sprintf("%v", result["barcode"]),
		SenderName:   fmt.Sprintf("%v", result["senderName"]),
		ReceiverName: fmt.Sprintf("%v", result["receiverName"]),
		Description:  fmt.Sprintf("%v", result["description"]),
	}

	return shipment, nil
}

// DeleteShipment deletes a shipment
func (c *MeestClient) DeleteShipment(ctx context.Context, parcelID string) error {
	if err := c.Authenticate(ctx); err != nil {
		return err
	}

	_, err := c.doRequest(ctx, "DELETE", "/parcels/"+parcelID, nil)
	return err
}

// GetLabel gets shipment label PDF
func (c *MeestClient) GetLabel(ctx context.Context, parcelID string, format string) ([]byte, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	url := meestAPIURL + "/parcels/" + parcelID + "/label"
	if format != "" {
		url += "?format=" + format
	}

	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Accept", "application/pdf")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

// TrackShipment tracks a shipment
func (c *MeestClient) TrackShipment(ctx context.Context, barcode string) ([]MeestTrackingEvent, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/tracking?barcode="+barcode, nil)
	if err != nil {
		return nil, err
	}

	eventsData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	events := make([]MeestTrackingEvent, 0, len(eventsData))
	for _, e := range eventsData {
		em := e.(map[string]interface{})
		events = append(events, MeestTrackingEvent{
			Date:        fmt.Sprintf("%v", em["date"]),
			Time:        fmt.Sprintf("%v", em["time"]),
			Status:      fmt.Sprintf("%v", em["statusNameUKR"]),
			StatusRU:    fmt.Sprintf("%v", em["statusNameRUS"]),
			StatusCode:  fmt.Sprintf("%v", em["statusCode"]),
			City:        fmt.Sprintf("%v", em["cityNameUKR"]),
			Branch:      fmt.Sprintf("%v", em["branchNameUKR"]),
			Description: fmt.Sprintf("%v", em["description"]),
		})
	}

	return events, nil
}

// CalculateDelivery calculates delivery cost
func (c *MeestClient) CalculateDelivery(ctx context.Context, senderBranchID, receiverBranchID string, parcels []MeestParcel, codAmount float64) (*MeestDeliveryCost, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	body := map[string]interface{}{
		"senderBranchID":   senderBranchID,
		"receiverBranchID": receiverBranchID,
		"parcels":          parcels,
	}
	if codAmount > 0 {
		body["codAmount"] = codAmount
	}

	resp, err := c.doRequest(ctx, "POST", "/calculate", body)
	if err != nil {
		return nil, err
	}

	result, ok := resp["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("calculation failed")
	}

	cost := &MeestDeliveryCost{
		Currency: "UAH",
	}
	if total, ok := result["totalCost"].(float64); ok {
		cost.TotalCost = total
	}
	if delivery, ok := result["deliveryCost"].(float64); ok {
		cost.DeliveryCost = delivery
	}
	if insurance, ok := result["insuranceCost"].(float64); ok {
		cost.InsuranceCost = insurance
	}
	if cod, ok := result["codCost"].(float64); ok {
		cost.CODCost = cod
	}

	return cost, nil
}

// GetRegions returns list of regions
func (c *MeestClient) GetRegions(ctx context.Context) ([]map[string]interface{}, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}

	resp, err := c.doRequest(ctx, "GET", "/regions", nil)
	if err != nil {
		return nil, err
	}

	regionsData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	regions := make([]map[string]interface{}, 0, len(regionsData))
	for _, r := range regionsData {
		regions = append(regions, r.(map[string]interface{}))
	}
	return regions, nil
}

func (c *MeestClient) doRequest(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, meestAPIURL+path, reqBody)
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Meest API error %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if status, ok := result["status"].(string); ok && status != "success" {
		return nil, fmt.Errorf("Meest API error: %v", result["message"])
	}

	return result, nil
}
