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

const justinAPIURL = "https://api.justin.ua/justin_pms"

// JustinClient implements Justin API integration
type JustinClient struct {
	apiKey     string
	login      string
	httpClient *http.Client
}

// NewJustinClient creates Justin client
func NewJustinClient(apiKey, login string) *JustinClient {
	return &JustinClient{
		apiKey:     apiKey,
		login:      login,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// JustinBranch represents a branch
type JustinBranch struct {
	UUID         string  `json:"uuid"`
	BranchNumber string  `json:"number"`
	SenderCode   string  `json:"senderCode"`
	Address      string  `json:"address"`
	AddressUKR   string  `json:"addressUKR"`
	AddressRU    string  `json:"addressRU"`
	City         string  `json:"city"`
	CityUKR      string  `json:"cityUKR"`
	CityRU       string  `json:"cityRU"`
	Region       string  `json:"region"`
	District     string  `json:"district"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	PostIndex    string  `json:"postIndex"`
	Phone        string  `json:"phone"`
	Schedule     string  `json:"schedule"`
	MaxWeight    float64 `json:"maxWeight"`
	Type         string  `json:"type"` // branch, poshtomat
	Format       string  `json:"format"`
	Active       bool    `json:"active"`
}

// JustinCity represents a city
type JustinCity struct {
	UUID     string `json:"uuid"`
	Name     string `json:"name"`
	NameUKR  string `json:"nameUKR"`
	NameRU   string `json:"nameRU"`
	Region   string `json:"region"`
	District string `json:"district"`
	Type     string `json:"type"`
}

// JustinOrder represents a delivery order
type JustinOrder struct {
	OrderNumber       string            `json:"orderNumber,omitempty"`
	TTN               string            `json:"ttn,omitempty"`
	SenderBranch      string            `json:"senderBranch"`
	RecipientBranch   string            `json:"recipientBranch,omitempty"`
	SenderContact     JustinContact     `json:"senderContact"`
	RecipientContact  JustinContact     `json:"recipientContact"`
	RecipientAddress  *JustinAddress    `json:"recipientAddress,omitempty"` // For door delivery
	DeliveryType      string            `json:"deliveryType"` // branch2branch, branch2door
	ServiceType       string            `json:"serviceType"`  // Standard, Express
	PayerType         string            `json:"payerType"`    // sender, recipient
	Cargo             JustinCargo       `json:"cargo"`
	COD               float64           `json:"cod,omitempty"` // Cash on delivery
	DeclaredValue     float64           `json:"declaredValue"`
	Description       string            `json:"description"`
	OrderDescription  string            `json:"orderDescription"`
	NotifySMS         bool              `json:"notifySMS"`
	NotifyEmail       bool              `json:"notifyEmail"`
	Status            string            `json:"status,omitempty"`
	StatusDate        string            `json:"statusDate,omitempty"`
}

// JustinContact represents a contact person
type JustinContact struct {
	Name       string `json:"name"`
	Phone      string `json:"phone"`
	Email      string `json:"email,omitempty"`
	Company    string `json:"company,omitempty"`
}

// JustinAddress represents a delivery address
type JustinAddress struct {
	City      string `json:"city"`
	Region    string `json:"region"`
	District  string `json:"district,omitempty"`
	Street    string `json:"street"`
	Building  string `json:"building"`
	Apartment string `json:"apartment,omitempty"`
	PostIndex string `json:"postIndex,omitempty"`
}

// JustinCargo represents cargo details
type JustinCargo struct {
	Weight   float64 `json:"weight"`
	Length   float64 `json:"length,omitempty"`
	Width    float64 `json:"width,omitempty"`
	Height   float64 `json:"height,omitempty"`
	Quantity int     `json:"quantity"`
}

// JustinTrackingEvent represents tracking event
type JustinTrackingEvent struct {
	Date        string `json:"date"`
	Time        string `json:"time"`
	Status      string `json:"status"`
	StatusCode  string `json:"statusCode"`
	StatusName  string `json:"statusName"`
	City        string `json:"city"`
	Branch      string `json:"branch"`
	Description string `json:"description"`
}

// JustinDeliveryCost represents delivery cost
type JustinDeliveryCost struct {
	DeliveryCost float64 `json:"deliveryCost"`
	CODCost      float64 `json:"codCost"`
	InsuranceCost float64 `json:"insuranceCost"`
	TotalCost    float64 `json:"totalCost"`
	Currency     string  `json:"currency"`
}

// GetBranches returns list of branches
func (c *JustinClient) GetBranches(ctx context.Context, cityUUID string, branchType string) ([]JustinBranch, error) {
	filter := map[string]interface{}{}
	if cityUUID != "" {
		filter["cityUuid"] = cityUUID
	}
	if branchType != "" {
		filter["type"] = branchType
	}

	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_DepartmentsList",
		"filter":  filter,
	})
	if err != nil {
		return nil, err
	}

	branchesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	branches := make([]JustinBranch, 0, len(branchesData))
	for _, b := range branchesData {
		bm := b.(map[string]interface{})
		branch := JustinBranch{
			UUID:         fmt.Sprintf("%v", bm["uuid"]),
			BranchNumber: fmt.Sprintf("%v", bm["number"]),
			SenderCode:   fmt.Sprintf("%v", bm["senderCode"]),
			Address:      fmt.Sprintf("%v", bm["address"]),
			City:         fmt.Sprintf("%v", bm["city"]),
			Region:       fmt.Sprintf("%v", bm["region"]),
			PostIndex:    fmt.Sprintf("%v", bm["postIndex"]),
			Phone:        fmt.Sprintf("%v", bm["phone"]),
			Schedule:     fmt.Sprintf("%v", bm["schedule"]),
			Type:         fmt.Sprintf("%v", bm["type"]),
		}
		if lat, ok := bm["latitude"].(float64); ok {
			branch.Latitude = lat
		}
		if lng, ok := bm["longitude"].(float64); ok {
			branch.Longitude = lng
		}
		if weight, ok := bm["maxWeight"].(float64); ok {
			branch.MaxWeight = weight
		}
		if active, ok := bm["active"].(bool); ok {
			branch.Active = active
		}
		branches = append(branches, branch)
	}

	return branches, nil
}

// SearchBranches searches branches by address
func (c *JustinClient) SearchBranches(ctx context.Context, query string) ([]JustinBranch, error) {
	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_DepartmentsList",
		"filter": map[string]interface{}{
			"searchString": query,
		},
	})
	if err != nil {
		return nil, err
	}

	branchesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	branches := make([]JustinBranch, 0, len(branchesData))
	for _, b := range branchesData {
		bm := b.(map[string]interface{})
		branches = append(branches, JustinBranch{
			UUID:         fmt.Sprintf("%v", bm["uuid"]),
			BranchNumber: fmt.Sprintf("%v", bm["number"]),
			Address:      fmt.Sprintf("%v", bm["address"]),
			City:         fmt.Sprintf("%v", bm["city"]),
		})
	}

	return branches, nil
}

// GetCities returns list of cities
func (c *JustinClient) GetCities(ctx context.Context, regionUUID string) ([]JustinCity, error) {
	filter := map[string]interface{}{}
	if regionUUID != "" {
		filter["regionUuid"] = regionUUID
	}

	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_CitiesList",
		"filter":  filter,
	})
	if err != nil {
		return nil, err
	}

	citiesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	cities := make([]JustinCity, 0, len(citiesData))
	for _, ct := range citiesData {
		cm := ct.(map[string]interface{})
		cities = append(cities, JustinCity{
			UUID:     fmt.Sprintf("%v", cm["uuid"]),
			Name:     fmt.Sprintf("%v", cm["name"]),
			NameUKR:  fmt.Sprintf("%v", cm["nameUKR"]),
			NameRU:   fmt.Sprintf("%v", cm["nameRU"]),
			Region:   fmt.Sprintf("%v", cm["region"]),
			District: fmt.Sprintf("%v", cm["district"]),
			Type:     fmt.Sprintf("%v", cm["type"]),
		})
	}

	return cities, nil
}

// SearchCities searches cities
func (c *JustinClient) SearchCities(ctx context.Context, query string) ([]JustinCity, error) {
	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_CitiesList",
		"filter": map[string]interface{}{
			"searchString": query,
		},
	})
	if err != nil {
		return nil, err
	}

	citiesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	cities := make([]JustinCity, 0, len(citiesData))
	for _, ct := range citiesData {
		cm := ct.(map[string]interface{})
		cities = append(cities, JustinCity{
			UUID:   fmt.Sprintf("%v", cm["uuid"]),
			Name:   fmt.Sprintf("%v", cm["name"]),
			Region: fmt.Sprintf("%v", cm["region"]),
		})
	}

	return cities, nil
}

// CreateOrder creates a new delivery order
func (c *JustinClient) CreateOrder(ctx context.Context, order *JustinOrder) (*JustinOrder, error) {
	orderData := map[string]interface{}{
		"senderBranch":     order.SenderBranch,
		"deliveryType":     order.DeliveryType,
		"serviceType":      order.ServiceType,
		"payerType":        order.PayerType,
		"declaredValue":    order.DeclaredValue,
		"description":      order.Description,
		"orderDescription": order.OrderDescription,
		"notifySMS":        order.NotifySMS,
		"notifyEmail":      order.NotifyEmail,
		"sender": map[string]interface{}{
			"name":    order.SenderContact.Name,
			"phone":   order.SenderContact.Phone,
			"email":   order.SenderContact.Email,
			"company": order.SenderContact.Company,
		},
		"recipient": map[string]interface{}{
			"name":    order.RecipientContact.Name,
			"phone":   order.RecipientContact.Phone,
			"email":   order.RecipientContact.Email,
			"company": order.RecipientContact.Company,
		},
		"cargo": map[string]interface{}{
			"weight":   order.Cargo.Weight,
			"length":   order.Cargo.Length,
			"width":    order.Cargo.Width,
			"height":   order.Cargo.Height,
			"quantity": order.Cargo.Quantity,
		},
	}

	if order.RecipientBranch != "" {
		orderData["recipientBranch"] = order.RecipientBranch
	}

	if order.RecipientAddress != nil {
		orderData["recipientAddress"] = map[string]interface{}{
			"city":      order.RecipientAddress.City,
			"region":    order.RecipientAddress.Region,
			"district":  order.RecipientAddress.District,
			"street":    order.RecipientAddress.Street,
			"building":  order.RecipientAddress.Building,
			"apartment": order.RecipientAddress.Apartment,
			"postIndex": order.RecipientAddress.PostIndex,
		}
	}

	if order.COD > 0 {
		orderData["cod"] = order.COD
	}

	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_CreateOrder",
		"data":    orderData,
	})
	if err != nil {
		return nil, err
	}

	result, ok := resp["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response")
	}

	order.OrderNumber = fmt.Sprintf("%v", result["orderNumber"])
	order.TTN = fmt.Sprintf("%v", result["ttn"])
	order.Status = fmt.Sprintf("%v", result["status"])

	return order, nil
}

// GetOrder gets order by number
func (c *JustinClient) GetOrder(ctx context.Context, orderNumber string) (*JustinOrder, error) {
	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_GetOrder",
		"filter": map[string]interface{}{
			"orderNumber": orderNumber,
		},
	})
	if err != nil {
		return nil, err
	}

	result, ok := resp["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("order not found")
	}

	order := &JustinOrder{
		OrderNumber:      fmt.Sprintf("%v", result["orderNumber"]),
		TTN:              fmt.Sprintf("%v", result["ttn"]),
		Status:           fmt.Sprintf("%v", result["status"]),
		StatusDate:       fmt.Sprintf("%v", result["statusDate"]),
		Description:      fmt.Sprintf("%v", result["description"]),
		OrderDescription: fmt.Sprintf("%v", result["orderDescription"]),
	}

	if dv, ok := result["declaredValue"].(float64); ok {
		order.DeclaredValue = dv
	}
	if cod, ok := result["cod"].(float64); ok {
		order.COD = cod
	}

	return order, nil
}

// CancelOrder cancels an order
func (c *JustinClient) CancelOrder(ctx context.Context, orderNumber string) error {
	_, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_CancelOrder",
		"data": map[string]interface{}{
			"orderNumber": orderNumber,
		},
	})
	return err
}

// GetLabel gets order label PDF
func (c *JustinClient) GetLabel(ctx context.Context, orderNumber string, format string) ([]byte, error) {
	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_GetOrderSticker",
		"filter": map[string]interface{}{
			"orderNumber": orderNumber,
			"format":      format, // pdf, zpl, png
		},
	})
	if err != nil {
		return nil, err
	}

	if data, ok := resp["result"].(string); ok {
		return []byte(data), nil
	}
	return nil, fmt.Errorf("no label data")
}

// TrackOrder tracks an order
func (c *JustinClient) TrackOrder(ctx context.Context, ttn string) ([]JustinTrackingEvent, error) {
	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_GetOrderTracking",
		"filter": map[string]interface{}{
			"ttn": ttn,
		},
	})
	if err != nil {
		return nil, err
	}

	eventsData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	events := make([]JustinTrackingEvent, 0, len(eventsData))
	for _, e := range eventsData {
		em := e.(map[string]interface{})
		events = append(events, JustinTrackingEvent{
			Date:        fmt.Sprintf("%v", em["date"]),
			Time:        fmt.Sprintf("%v", em["time"]),
			Status:      fmt.Sprintf("%v", em["status"]),
			StatusCode:  fmt.Sprintf("%v", em["statusCode"]),
			StatusName:  fmt.Sprintf("%v", em["statusName"]),
			City:        fmt.Sprintf("%v", em["city"]),
			Branch:      fmt.Sprintf("%v", em["branch"]),
			Description: fmt.Sprintf("%v", em["description"]),
		})
	}

	return events, nil
}

// TrackByTTN tracks by waybill number (public method)
func (c *JustinClient) TrackByTTN(ctx context.Context, ttn string) ([]JustinTrackingEvent, error) {
	resp, err := c.doRequest(ctx, "tracking", map[string]interface{}{
		"ttn": ttn,
	})
	if err != nil {
		return nil, err
	}

	eventsData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	events := make([]JustinTrackingEvent, 0, len(eventsData))
	for _, e := range eventsData {
		em := e.(map[string]interface{})
		events = append(events, JustinTrackingEvent{
			Date:       fmt.Sprintf("%v", em["date"]),
			Status:     fmt.Sprintf("%v", em["status"]),
			StatusName: fmt.Sprintf("%v", em["statusName"]),
			City:       fmt.Sprintf("%v", em["city"]),
			Branch:     fmt.Sprintf("%v", em["branch"]),
		})
	}

	return events, nil
}

// CalculateDelivery calculates delivery cost
func (c *JustinClient) CalculateDelivery(ctx context.Context, senderBranch, recipientBranch string, weight float64, declaredValue float64, cod float64) (*JustinDeliveryCost, error) {
	data := map[string]interface{}{
		"senderBranch":    senderBranch,
		"recipientBranch": recipientBranch,
		"weight":          weight,
		"declaredValue":   declaredValue,
	}
	if cod > 0 {
		data["cod"] = cod
	}

	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_CalculateDelivery",
		"data":    data,
	})
	if err != nil {
		return nil, err
	}

	result, ok := resp["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("calculation failed")
	}

	cost := &JustinDeliveryCost{
		Currency: "UAH",
	}
	if delivery, ok := result["deliveryCost"].(float64); ok {
		cost.DeliveryCost = delivery
	}
	if codCost, ok := result["codCost"].(float64); ok {
		cost.CODCost = codCost
	}
	if insurance, ok := result["insuranceCost"].(float64); ok {
		cost.InsuranceCost = insurance
	}
	if total, ok := result["totalCost"].(float64); ok {
		cost.TotalCost = total
	}

	return cost, nil
}

// GetRegions returns list of regions
func (c *JustinClient) GetRegions(ctx context.Context) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_RegionsList",
	})
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

// GetOrderStatuses returns list of order statuses
func (c *JustinClient) GetOrderStatuses(ctx context.Context) ([]map[string]interface{}, error) {
	resp, err := c.doRequest(ctx, "hs/v2/runRequest", map[string]interface{}{
		"request": "req_StatusesList",
	})
	if err != nil {
		return nil, err
	}

	statusesData, ok := resp["result"].([]interface{})
	if !ok {
		return nil, nil
	}

	statuses := make([]map[string]interface{}, 0, len(statusesData))
	for _, s := range statusesData {
		statuses = append(statuses, s.(map[string]interface{}))
	}
	return statuses, nil
}

func (c *JustinClient) doRequest(ctx context.Context, endpoint string, body interface{}) (map[string]interface{}, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, _ := http.NewRequestWithContext(ctx, "POST", justinAPIURL+"/"+endpoint, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Justin-API-Key %s", c.apiKey))
	if c.login != "" {
		req.Header.Set("Login", c.login)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Justin API error %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if status, ok := result["status"].(string); ok && status != "ok" {
		if errMsg, ok := result["error"].(string); ok {
			return nil, fmt.Errorf("Justin API error: %s", errMsg)
		}
	}

	return result, nil
}
