# Nova Poshta Integration

Інтеграція з API Нової Пошти для доставки.

## Огляд

| Параметр | Значення |
|----------|----------|
| API Version | 2.0 |
| Base URL | https://api.novaposhta.ua/v2.0/json/ |
| Документація | https://developers.novaposhta.ua |

### Можливості

- Пошук відділень та поштоматів
- Розрахунок вартості доставки
- Створення ТТН (експрес-накладних)
- Відстеження посилок
- Адресна доставка

---

## Конфігурація

### Environment Variables

```env
# .env
NOVA_POSHTA_API_KEY=your_api_key_here
NOVA_POSHTA_SENDER_REF=sender_counterparty_ref
NOVA_POSHTA_SENDER_CONTACT_REF=sender_contact_ref
NOVA_POSHTA_SENDER_ADDRESS_REF=sender_address_ref
NOVA_POSHTA_SENDER_CITY_REF=sender_city_ref
```

### Config Structure

```go
// internal/config/novaposhta.go
type NovaPoshtaConfig struct {
    APIKey            string `env:"NOVA_POSHTA_API_KEY,required"`
    SenderRef         string `env:"NOVA_POSHTA_SENDER_REF,required"`
    SenderContactRef  string `env:"NOVA_POSHTA_SENDER_CONTACT_REF,required"`
    SenderAddressRef  string `env:"NOVA_POSHTA_SENDER_ADDRESS_REF,required"`
    SenderCityRef     string `env:"NOVA_POSHTA_SENDER_CITY_REF,required"`
}
```

---

## Імплементація

### Nova Poshta Client

```go
// pkg/novaposhta/client.go
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
    BaseURL = "https://api.novaposhta.ua/v2.0/json/"
)

type Client struct {
    apiKey     string
    httpClient *http.Client
}

func NewClient(apiKey string) *Client {
    return &Client{
        apiKey: apiKey,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

type Request struct {
    APIKey           string                 `json:"apiKey"`
    ModelName        string                 `json:"modelName"`
    CalledMethod     string                 `json:"calledMethod"`
    MethodProperties map[string]interface{} `json:"methodProperties"`
}

type Response struct {
    Success      bool            `json:"success"`
    Data         json.RawMessage `json:"data"`
    Errors       []string        `json:"errors"`
    Warnings     []string        `json:"warnings"`
    Info         json.RawMessage `json:"info"`
    MessageCodes []string        `json:"messageCodes"`
    ErrorCodes   []string        `json:"errorCodes"`
}

func (c *Client) Call(ctx context.Context, modelName, method string, props map[string]interface{}) (*Response, error) {
    req := Request{
        APIKey:           c.apiKey,
        ModelName:        modelName,
        CalledMethod:     method,
        MethodProperties: props,
    }

    body, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }

    httpReq, err := http.NewRequestWithContext(ctx, "POST", BaseURL, bytes.NewReader(body))
    if err != nil {
        return nil, err
    }
    httpReq.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    respBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result Response
    if err := json.Unmarshal(respBody, &result); err != nil {
        return nil, err
    }

    if !result.Success && len(result.Errors) > 0 {
        return nil, fmt.Errorf("nova poshta error: %v", result.Errors)
    }

    return &result, nil
}
```

### Address Service

```go
// pkg/novaposhta/address.go
package novaposhta

import (
    "context"
    "encoding/json"
)

type City struct {
    Ref           string `json:"Ref"`
    Description   string `json:"Description"`
    DescriptionRu string `json:"DescriptionRu"`
    Area          string `json:"Area"`
    AreaDescription string `json:"AreaDescription"`
    SettlementType string `json:"SettlementType"`
}

type Warehouse struct {
    Ref                  string `json:"Ref"`
    SiteKey              string `json:"SiteKey"`
    Description          string `json:"Description"`
    DescriptionRu        string `json:"DescriptionRu"`
    ShortAddress         string `json:"ShortAddress"`
    ShortAddressRu       string `json:"ShortAddressRu"`
    Phone                string `json:"Phone"`
    TypeOfWarehouse      string `json:"TypeOfWarehouse"`
    Number               string `json:"Number"`
    CityRef              string `json:"CityRef"`
    CityDescription      string `json:"CityDescription"`
    Longitude            string `json:"Longitude"`
    Latitude             string `json:"Latitude"`
    PostFinance          string `json:"PostFinance"`
    BicycleParking       string `json:"BicycleParking"`
    PaymentAccess        string `json:"PaymentAccess"`
    POSTerminal          string `json:"POSTerminal"`
    InternationalShipping string `json:"InternationalShipping"`
    SelfServiceWorkplacesCount string `json:"SelfServiceWorkplacesCount"`
    TotalMaxWeightAllowed      string `json:"TotalMaxWeightAllowed"`
    PlaceMaxWeightAllowed      string `json:"PlaceMaxWeightAllowed"`
    Schedule             map[string]DaySchedule `json:"Schedule"`
}

type DaySchedule struct {
    Monday    string `json:"Monday"`
    Tuesday   string `json:"Tuesday"`
    Wednesday string `json:"Wednesday"`
    Thursday  string `json:"Thursday"`
    Friday    string `json:"Friday"`
    Saturday  string `json:"Saturday"`
    Sunday    string `json:"Sunday"`
}

// SearchCities шукає міста за назвою
func (c *Client) SearchCities(ctx context.Context, query string, limit int) ([]City, error) {
    props := map[string]interface{}{
        "FindByString": query,
        "Limit":        limit,
    }

    resp, err := c.Call(ctx, "Address", "searchSettlements", props)
    if err != nil {
        return nil, err
    }

    var wrapper []struct {
        Addresses []City `json:"Addresses"`
    }
    if err := json.Unmarshal(resp.Data, &wrapper); err != nil {
        return nil, err
    }

    if len(wrapper) == 0 {
        return nil, nil
    }

    return wrapper[0].Addresses, nil
}

// GetWarehouses отримує список відділень міста
func (c *Client) GetWarehouses(ctx context.Context, cityRef string, typeRef string) ([]Warehouse, error) {
    props := map[string]interface{}{
        "CityRef": cityRef,
    }
    if typeRef != "" {
        props["TypeOfWarehouseRef"] = typeRef
    }

    resp, err := c.Call(ctx, "Address", "getWarehouses", props)
    if err != nil {
        return nil, err
    }

    var warehouses []Warehouse
    if err := json.Unmarshal(resp.Data, &warehouses); err != nil {
        return nil, err
    }

    return warehouses, nil
}

// SearchWarehouses шукає відділення
func (c *Client) SearchWarehouses(ctx context.Context, cityRef, query string) ([]Warehouse, error) {
    props := map[string]interface{}{
        "CityRef":         cityRef,
        "FindByString":    query,
    }

    resp, err := c.Call(ctx, "Address", "getWarehouses", props)
    if err != nil {
        return nil, err
    }

    var warehouses []Warehouse
    if err := json.Unmarshal(resp.Data, &warehouses); err != nil {
        return nil, err
    }

    return warehouses, nil
}

// GetStreets отримує вулиці міста
func (c *Client) GetStreets(ctx context.Context, cityRef, query string) ([]Street, error) {
    props := map[string]interface{}{
        "CityRef":      cityRef,
        "FindByString": query,
        "Limit":        20,
    }

    resp, err := c.Call(ctx, "Address", "getStreet", props)
    if err != nil {
        return nil, err
    }

    var streets []Street
    if err := json.Unmarshal(resp.Data, &streets); err != nil {
        return nil, err
    }

    return streets, nil
}

type Street struct {
    Ref           string `json:"Ref"`
    Description   string `json:"Description"`
    StreetsTypeRef string `json:"StreetsTypeRef"`
    StreetsType   string `json:"StreetsType"`
}
```

### Delivery Calculation

```go
// pkg/novaposhta/delivery.go
package novaposhta

import (
    "context"
    "encoding/json"
)

type DeliveryPrice struct {
    Cost              float64 `json:"Cost"`
    AssessedCost      float64 `json:"AssessedCost"`
    CostRedelivery    float64 `json:"CostRedelivery"`
    TZoneInfo         string  `json:"TZoneInfo"`
    CostPack          float64 `json:"CostPack"`
}

type DeliveryDate struct {
    Date            string `json:"DeliveryDate"`
    DateTime        string `json:"DateTime"`
}

type CalculatePriceRequest struct {
    CitySender    string
    CityRecipient string
    Weight        float64
    ServiceType   string // WarehouseWarehouse, WarehouseDoors, DoorsWarehouse, DoorsDoors
    Cost          float64 // Оголошена вартість
    CargoType     string  // Cargo, Documents, TiresWheels, Pallet
    SeatsAmount   int
    RedeliveryCalculate bool
    PackCount     int
    PackRef       string
    Amount        float64
    CargoDetails  []CargoDetail
}

type CargoDetail struct {
    PackRef      string
    Amount       int
    CargoDescription string
}

// CalculatePrice розраховує вартість доставки
func (c *Client) CalculatePrice(ctx context.Context, req *CalculatePriceRequest) (*DeliveryPrice, error) {
    props := map[string]interface{}{
        "CitySender":    req.CitySender,
        "CityRecipient": req.CityRecipient,
        "Weight":        req.Weight,
        "ServiceType":   req.ServiceType,
        "Cost":          req.Cost,
        "CargoType":     req.CargoType,
        "SeatsAmount":   req.SeatsAmount,
    }

    if req.RedeliveryCalculate {
        props["RedeliveryCalculate"] = map[string]interface{}{
            "CargoType":   req.CargoType,
            "Amount":      req.Amount,
        }
    }

    resp, err := c.Call(ctx, "InternetDocument", "getDocumentPrice", props)
    if err != nil {
        return nil, err
    }

    var prices []DeliveryPrice
    if err := json.Unmarshal(resp.Data, &prices); err != nil {
        return nil, err
    }

    if len(prices) == 0 {
        return nil, fmt.Errorf("no price data returned")
    }

    return &prices[0], nil
}

// GetDeliveryDate отримує дату доставки
func (c *Client) GetDeliveryDate(ctx context.Context, citySender, cityRecipient, serviceType string) (*DeliveryDate, error) {
    props := map[string]interface{}{
        "CitySender":    citySender,
        "CityRecipient": cityRecipient,
        "ServiceType":   serviceType,
    }

    resp, err := c.Call(ctx, "InternetDocument", "getDocumentDeliveryDate", props)
    if err != nil {
        return nil, err
    }

    var dates []DeliveryDate
    if err := json.Unmarshal(resp.Data, &dates); err != nil {
        return nil, err
    }

    if len(dates) == 0 {
        return nil, fmt.Errorf("no delivery date returned")
    }

    return &dates[0], nil
}
```

### Create TTN (Shipment)

```go
// pkg/novaposhta/shipment.go
package novaposhta

import (
    "context"
    "encoding/json"
    "time"
)

type CreateShipmentRequest struct {
    // Sender
    SenderRef           string
    ContactSenderRef    string
    SenderAddress       string
    SendersPhone        string

    // Recipient
    RecipientCityRef    string
    RecipientAddress    string
    RecipientName       string
    RecipientPhone      string
    RecipientType       string // PrivatePerson, Organization

    // Cargo
    CargoType           string // Cargo, Documents, TiresWheels, Pallet
    Weight              float64
    ServiceType         string // WarehouseWarehouse, WarehouseDoors, etc.
    SeatsAmount         int
    Description         string
    Cost                float64 // Оголошена вартість

    // Payment
    PayerType           string // Sender, Recipient, ThirdPerson
    PaymentMethod       string // Cash, NonCash

    // Additional
    DateTime            string // Дата відправлення
    AdditionalInformation string

    // Backdelivery (наложений платіж)
    BackwardDeliveryData []BackwardDelivery
}

type BackwardDelivery struct {
    PayerType           string  // Sender, Recipient
    CargoType           string  // Money, Documents, Other
    RedeliveryString    string  // Опис для Documents/Other
}

type ShipmentResponse struct {
    Ref             string `json:"Ref"`
    CostOnSite      float64 `json:"CostOnSite"`
    EstimatedDeliveryDate string `json:"EstimatedDeliveryDate"`
    IntDocNumber    string `json:"IntDocNumber"`
    TypeDocument    string `json:"TypeDocument"`
}

// CreateShipment створює експрес-накладну
func (c *Client) CreateShipment(ctx context.Context, req *CreateShipmentRequest) (*ShipmentResponse, error) {
    props := map[string]interface{}{
        // Sender
        "Sender":              req.SenderRef,
        "ContactSender":       req.ContactSenderRef,
        "SenderAddress":       req.SenderAddress,
        "SendersPhone":        req.SendersPhone,

        // Recipient
        "CitySender":          "", // буде визначено автоматично
        "CityRecipient":       req.RecipientCityRef,
        "RecipientAddress":    req.RecipientAddress,
        "RecipientsPhone":     req.RecipientPhone,
        "RecipientName":       req.RecipientName,
        "RecipientType":       req.RecipientType,

        // Cargo
        "CargoType":           req.CargoType,
        "Weight":              req.Weight,
        "ServiceType":         req.ServiceType,
        "SeatsAmount":         req.SeatsAmount,
        "Description":         req.Description,
        "Cost":                req.Cost,

        // Payment
        "PayerType":           req.PayerType,
        "PaymentMethod":       req.PaymentMethod,

        // Date
        "DateTime":            req.DateTime,

        // Additional
        "AdditionalInformation": req.AdditionalInformation,
    }

    // Наложений платіж
    if len(req.BackwardDeliveryData) > 0 {
        backwardData := make([]map[string]interface{}, len(req.BackwardDeliveryData))
        for i, bd := range req.BackwardDeliveryData {
            backwardData[i] = map[string]interface{}{
                "PayerType": bd.PayerType,
                "CargoType": bd.CargoType,
            }
            if bd.RedeliveryString != "" {
                backwardData[i]["RedeliveryString"] = bd.RedeliveryString
            }
        }
        props["BackwardDeliveryData"] = backwardData
    }

    resp, err := c.Call(ctx, "InternetDocument", "save", props)
    if err != nil {
        return nil, err
    }

    var shipments []ShipmentResponse
    if err := json.Unmarshal(resp.Data, &shipments); err != nil {
        return nil, err
    }

    if len(shipments) == 0 {
        return nil, fmt.Errorf("no shipment data returned")
    }

    return &shipments[0], nil
}

// DeleteShipment видаляє ТТН
func (c *Client) DeleteShipment(ctx context.Context, ref string) error {
    props := map[string]interface{}{
        "DocumentRefs": ref,
    }

    _, err := c.Call(ctx, "InternetDocument", "delete", props)
    return err
}
```

### Tracking

```go
// pkg/novaposhta/tracking.go
package novaposhta

import (
    "context"
    "encoding/json"
)

type TrackingInfo struct {
    Number                  string `json:"Number"`
    StatusCode              string `json:"StatusCode"`
    Status                  string `json:"Status"`
    WarehouseSender         string `json:"WarehouseSender"`
    WarehouseRecipient      string `json:"WarehouseRecipient"`
    WarehouseRecipientAddress string `json:"WarehouseRecipientAddress"`
    CitySender              string `json:"CitySender"`
    CityRecipient           string `json:"CityRecipient"`
    RecipientFullName       string `json:"RecipientFullName"`
    DateCreated             string `json:"DateCreated"`
    ScheduledDeliveryDate   string `json:"ScheduledDeliveryDate"`
    ActualDeliveryDate      string `json:"ActualDeliveryDate"`
    DocumentWeight          string `json:"DocumentWeight"`
    DocumentCost            string `json:"DocumentCost"`
    SumBeforeCheckWeight    string `json:"SumBeforeCheckWeight"`
    PayerType               string `json:"PayerType"`
    RecipientDateTime       string `json:"RecipientDateTime"`
    PaymentMethod           string `json:"PaymentMethod"`
    CargoDescriptionString  string `json:"CargoDescriptionString"`
    CargoType               string `json:"CargoType"`
    SeatsAmount             string `json:"SeatsAmount"`
    RedeliverySum           string `json:"RedeliverySum"`
    RedeliveryNum           string `json:"RedeliveryNum"`
    RedeliveryPayer         string `json:"RedeliveryPayer"`
    AnnouncedPrice          string `json:"AnnouncedPrice"`
    ServiceType             string `json:"ServiceType"`
    LastCreatedOnTheBasisDocumentType string `json:"LastCreatedOnTheBasisDocumentType"`
    LastCreatedOnTheBasisPayerType    string `json:"LastCreatedOnTheBasisPayerType"`
    LastCreatedOnTheBasisDateTime     string `json:"LastCreatedOnTheBasisDateTime"`
}

// GetTracking отримує інформацію про відстеження посилки
func (c *Client) GetTracking(ctx context.Context, trackingNumber string) (*TrackingInfo, error) {
    props := map[string]interface{}{
        "Documents": []map[string]string{
            {"DocumentNumber": trackingNumber},
        },
    }

    resp, err := c.Call(ctx, "TrackingDocument", "getStatusDocuments", props)
    if err != nil {
        return nil, err
    }

    var infos []TrackingInfo
    if err := json.Unmarshal(resp.Data, &infos); err != nil {
        return nil, err
    }

    if len(infos) == 0 {
        return nil, fmt.Errorf("tracking info not found")
    }

    return &infos[0], nil
}

// GetTrackingBatch отримує інформацію про кілька посилок
func (c *Client) GetTrackingBatch(ctx context.Context, trackingNumbers []string) ([]TrackingInfo, error) {
    docs := make([]map[string]string, len(trackingNumbers))
    for i, num := range trackingNumbers {
        docs[i] = map[string]string{"DocumentNumber": num}
    }

    props := map[string]interface{}{
        "Documents": docs,
    }

    resp, err := c.Call(ctx, "TrackingDocument", "getStatusDocuments", props)
    if err != nil {
        return nil, err
    }

    var infos []TrackingInfo
    if err := json.Unmarshal(resp.Data, &infos); err != nil {
        return nil, err
    }

    return infos, nil
}
```

---

## Delivery Service

```go
// internal/services/delivery/novaposhta.go
package delivery

import (
    "context"
    "fmt"
    "time"

    "shop/internal/config"
    "shop/pkg/novaposhta"
)

type NovaPoshtaService struct {
    client *novaposhta.Client
    cfg    *config.NovaPoshtaConfig
    repo   DeliveryRepository
}

func NewNovaPoshtaService(cfg *config.NovaPoshtaConfig, repo DeliveryRepository) *NovaPoshtaService {
    return &NovaPoshtaService{
        client: novaposhta.NewClient(cfg.APIKey),
        cfg:    cfg,
        repo:   repo,
    }
}

// SearchCities шукає міста
func (s *NovaPoshtaService) SearchCities(ctx context.Context, query string) ([]CityDTO, error) {
    cities, err := s.client.SearchCities(ctx, query, 10)
    if err != nil {
        return nil, err
    }

    result := make([]CityDTO, len(cities))
    for i, c := range cities {
        result[i] = CityDTO{
            Ref:         c.Ref,
            Name:        c.Description,
            Area:        c.AreaDescription,
            Type:        c.SettlementType,
        }
    }

    return result, nil
}

// GetWarehouses отримує відділення
func (s *NovaPoshtaService) GetWarehouses(ctx context.Context, cityRef string) ([]WarehouseDTO, error) {
    warehouses, err := s.client.GetWarehouses(ctx, cityRef, "")
    if err != nil {
        return nil, err
    }

    result := make([]WarehouseDTO, len(warehouses))
    for i, w := range warehouses {
        result[i] = WarehouseDTO{
            Ref:         w.Ref,
            Number:      w.Number,
            Name:        w.Description,
            ShortName:   w.ShortAddress,
            Type:        w.TypeOfWarehouse,
            Latitude:    w.Latitude,
            Longitude:   w.Longitude,
            MaxWeight:   w.TotalMaxWeightAllowed,
        }
    }

    return result, nil
}

// CalculateDelivery розраховує вартість
func (s *NovaPoshtaService) CalculateDelivery(ctx context.Context, req *CalculateRequest) (*DeliveryQuote, error) {
    priceReq := &novaposhta.CalculatePriceRequest{
        CitySender:    s.cfg.SenderCityRef,
        CityRecipient: req.CityRef,
        Weight:        req.Weight,
        ServiceType:   req.ServiceType,
        Cost:          req.DeclaredValue,
        CargoType:     "Cargo",
        SeatsAmount:   req.SeatsAmount,
    }

    price, err := s.client.CalculatePrice(ctx, priceReq)
    if err != nil {
        return nil, err
    }

    date, err := s.client.GetDeliveryDate(ctx, s.cfg.SenderCityRef, req.CityRef, req.ServiceType)
    if err != nil {
        return nil, err
    }

    return &DeliveryQuote{
        Provider:       "nova_poshta",
        ServiceType:    req.ServiceType,
        Cost:           int64(price.Cost * 100), // гривні -> копійки
        Currency:       "UAH",
        EstimatedDate:  date.Date,
    }, nil
}

// CreateShipment створює відправлення
func (s *NovaPoshtaService) CreateShipment(ctx context.Context, order *Order) (*Shipment, error) {
    req := &novaposhta.CreateShipmentRequest{
        // Sender
        SenderRef:          s.cfg.SenderRef,
        ContactSenderRef:   s.cfg.SenderContactRef,
        SenderAddress:      s.cfg.SenderAddressRef,
        SendersPhone:       "380501234567",

        // Recipient
        RecipientCityRef:   order.Delivery.CityRef,
        RecipientAddress:   order.Delivery.WarehouseRef,
        RecipientName:      order.Customer.Name,
        RecipientPhone:     order.Customer.Phone,
        RecipientType:      "PrivatePerson",

        // Cargo
        CargoType:          "Cargo",
        Weight:             order.TotalWeight(),
        ServiceType:        order.Delivery.ServiceType,
        SeatsAmount:        order.TotalSeats(),
        Description:        fmt.Sprintf("Замовлення #%s", order.Number),
        Cost:               float64(order.Total) / 100,

        // Payment
        PayerType:          order.Delivery.PayerType,
        PaymentMethod:      "Cash",

        DateTime:           time.Now().Format("02.01.2006"),
    }

    // Наложений платіж
    if order.Payment.Method == PaymentMethodCOD {
        req.BackwardDeliveryData = []novaposhta.BackwardDelivery{
            {
                PayerType: "Recipient",
                CargoType: "Money",
            },
        }
    }

    resp, err := s.client.CreateShipment(ctx, req)
    if err != nil {
        return nil, err
    }

    // Зберігаємо відправлення
    shipment := &Shipment{
        ID:             generateID("shp"),
        OrderID:        order.ID,
        Provider:       "nova_poshta",
        TrackingNumber: resp.IntDocNumber,
        ExternalRef:    resp.Ref,
        Status:         ShipmentStatusCreated,
        Cost:           int64(resp.CostOnSite * 100),
        EstimatedDate:  resp.EstimatedDeliveryDate,
        CreatedAt:      time.Now(),
    }

    if err := s.repo.CreateShipment(ctx, shipment); err != nil {
        return nil, err
    }

    return shipment, nil
}

// GetTracking отримує статус відправлення
func (s *NovaPoshtaService) GetTracking(ctx context.Context, trackingNumber string) (*TrackingStatus, error) {
    info, err := s.client.GetTracking(ctx, trackingNumber)
    if err != nil {
        return nil, err
    }

    return &TrackingStatus{
        TrackingNumber: info.Number,
        Status:         mapNovaPoshtaStatus(info.StatusCode),
        StatusText:     info.Status,
        Location:       info.WarehouseRecipientAddress,
        UpdatedAt:      parseDate(info.RecipientDateTime),
    }, nil
}

func mapNovaPoshtaStatus(code string) ShipmentStatus {
    switch code {
    case "1":
        return ShipmentStatusCreated
    case "2", "3", "4", "5", "6", "7", "8", "14", "15", "101":
        return ShipmentStatusInTransit
    case "9":
        return ShipmentStatusDelivered
    case "102", "103", "104", "105", "106", "111":
        return ShipmentStatusReturning
    case "10", "11":
        return ShipmentStatusReturned
    default:
        return ShipmentStatusUnknown
    }
}
```

---

## API Handlers

```go
// internal/handlers/delivery.go
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

type DeliveryHandler struct {
    service delivery.Service
}

func NewDeliveryHandler(service delivery.Service) *DeliveryHandler {
    return &DeliveryHandler{service: service}
}

// SearchCities godoc
// @Summary Пошук міст
// @Tags delivery
// @Param q query string true "Пошуковий запит"
// @Success 200 {array} CityDTO
// @Router /api/v1/delivery/cities [get]
func (h *DeliveryHandler) SearchCities(c *gin.Context) {
    query := c.Query("q")
    if query == "" || len(query) < 2 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "query too short"})
        return
    }

    cities, err := h.service.SearchCities(c.Request.Context(), query)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, cities)
}

// GetWarehouses godoc
// @Summary Отримати відділення міста
// @Tags delivery
// @Param city_ref query string true "Ref міста"
// @Success 200 {array} WarehouseDTO
// @Router /api/v1/delivery/warehouses [get]
func (h *DeliveryHandler) GetWarehouses(c *gin.Context) {
    cityRef := c.Query("city_ref")
    if cityRef == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "city_ref required"})
        return
    }

    warehouses, err := h.service.GetWarehouses(c.Request.Context(), cityRef)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, warehouses)
}

// CalculateDelivery godoc
// @Summary Розрахувати вартість доставки
// @Tags delivery
// @Param request body CalculateDeliveryRequest true "Параметри"
// @Success 200 {object} DeliveryQuote
// @Router /api/v1/delivery/calculate [post]
func (h *DeliveryHandler) CalculateDelivery(c *gin.Context) {
    var req CalculateDeliveryRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    quote, err := h.service.CalculateDelivery(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, quote)
}

// GetTracking godoc
// @Summary Відстежити посилку
// @Tags delivery
// @Param tracking_number path string true "Номер ТТН"
// @Success 200 {object} TrackingStatus
// @Router /api/v1/delivery/tracking/{tracking_number} [get]
func (h *DeliveryHandler) GetTracking(c *gin.Context) {
    trackingNumber := c.Param("tracking_number")

    status, err := h.service.GetTracking(c.Request.Context(), trackingNumber)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "tracking not found"})
        return
    }

    c.JSON(http.StatusOK, status)
}
```

---

## Frontend Components

### City Search

```tsx
// components/delivery/CitySearch.tsx
import { useState, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';

interface City {
  ref: string;
  name: string;
  area: string;
}

interface CitySearchProps {
  onSelect: (city: City) => void;
}

export function CitySearch({ onSelect }: CitySearchProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data: cities, isLoading } = useQuery({
    queryKey: ['cities', debouncedQuery],
    queryFn: () =>
      fetch(`/api/v1/delivery/cities?q=${encodeURIComponent(debouncedQuery)}`)
        .then(res => res.json()),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Введіть назву міста"
        className="input input-bordered w-full"
      />

      {isLoading && (
        <div className="absolute right-3 top-3">
          <span className="loading loading-spinner loading-sm" />
        </div>
      )}

      {cities && cities.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-base-100 border rounded-box shadow-lg max-h-60 overflow-auto">
          {cities.map((city: City) => (
            <li
              key={city.ref}
              onClick={() => {
                onSelect(city);
                setQuery(city.name);
              }}
              className="px-4 py-2 hover:bg-base-200 cursor-pointer"
            >
              <div className="font-medium">{city.name}</div>
              <div className="text-sm text-gray-500">{city.area}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Warehouse Select

```tsx
// components/delivery/WarehouseSelect.tsx
import { useQuery } from '@tanstack/react-query';

interface Warehouse {
  ref: string;
  number: string;
  name: string;
  shortName: string;
}

interface WarehouseSelectProps {
  cityRef: string;
  value?: string;
  onChange: (warehouse: Warehouse) => void;
}

export function WarehouseSelect({ cityRef, value, onChange }: WarehouseSelectProps) {
  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses', cityRef],
    queryFn: () =>
      fetch(`/api/v1/delivery/warehouses?city_ref=${cityRef}`)
        .then(res => res.json()),
    enabled: !!cityRef,
  });

  if (!cityRef) {
    return <select disabled className="select select-bordered w-full">
      <option>Спочатку оберіть місто</option>
    </select>;
  }

  if (isLoading) {
    return <div className="skeleton h-12 w-full" />;
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        const selected = warehouses?.find((w: Warehouse) => w.ref === e.target.value);
        if (selected) onChange(selected);
      }}
      className="select select-bordered w-full"
    >
      <option value="">Оберіть відділення</option>
      {warehouses?.map((warehouse: Warehouse) => (
        <option key={warehouse.ref} value={warehouse.ref}>
          №{warehouse.number} - {warehouse.shortName}
        </option>
      ))}
    </select>
  );
}
```

### Tracking Widget

```tsx
// components/delivery/TrackingWidget.tsx
import { useQuery } from '@tanstack/react-query';

interface TrackingWidgetProps {
  trackingNumber: string;
}

export function TrackingWidget({ trackingNumber }: TrackingWidgetProps) {
  const { data: tracking, isLoading, error } = useQuery({
    queryKey: ['tracking', trackingNumber],
    queryFn: () =>
      fetch(`/api/v1/delivery/tracking/${trackingNumber}`)
        .then(res => res.json()),
    refetchInterval: 60000, // Оновлювати кожну хвилину
  });

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  if (error) return <div className="alert alert-error">Не вдалося отримати статус</div>;

  const statusColors: Record<string, string> = {
    created: 'badge-info',
    in_transit: 'badge-warning',
    delivered: 'badge-success',
    returning: 'badge-error',
    returned: 'badge-error',
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h3 className="card-title">
          Відстеження посилки
          <span className={`badge ${statusColors[tracking.status] || 'badge-ghost'}`}>
            {tracking.statusText}
          </span>
        </h3>

        <div className="text-sm text-gray-500">
          ТТН: {trackingNumber}
        </div>

        {tracking.location && (
          <div className="mt-2">
            <span className="text-gray-600">Місцезнаходження:</span>
            <span className="ml-2">{tracking.location}</span>
          </div>
        )}

        {tracking.estimatedDate && tracking.status !== 'delivered' && (
          <div className="mt-2">
            <span className="text-gray-600">Очікувана дата доставки:</span>
            <span className="ml-2">{tracking.estimatedDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Статуси Нової Пошти

| Код | Статус | Опис |
|-----|--------|------|
| 1 | Нова пошта очікує надходження | Створено ТТН |
| 2 | Видалено | ТТН видалено |
| 3 | Не доставлено | Невдала спроба доставки |
| 4 | У місті відправника | Прибуло на склад відправника |
| 5 | Прямує до міста отримувача | В дорозі |
| 6 | У місті одержувача | Прибуло в місто |
| 7 | На складі одержувача | На відділенні |
| 9 | Одержано | Доставлено |
| 10 | Повернуто відправнику | Повернення |
| 11 | Повернення завершено | Повернуто |
| 101 | На шляху до одержувача | Кур'єрська доставка |

---

## Моніторинг

```go
var (
    apiRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "novaposhta_api_requests_total",
            Help: "Total Nova Poshta API requests",
        },
        []string{"method", "status"},
    )

    apiRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "novaposhta_api_request_duration_seconds",
            Help:    "API request duration",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method"},
    )

    shipmentsCreated = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "novaposhta_shipments_created_total",
            Help: "Total shipments created",
        },
    )
)
```

---

## Cron Jobs

### Оновлення статусів

```go
// internal/jobs/tracking_update.go
package jobs

import (
    "context"
    "log"
)

type TrackingUpdateJob struct {
    shipmentRepo ShipmentRepository
    npService    delivery.NovaPoshtaService
}

func (j *TrackingUpdateJob) Run() {
    ctx := context.Background()

    // Отримуємо активні відправлення
    shipments, err := j.shipmentRepo.FindActive(ctx)
    if err != nil {
        log.Printf("Error fetching shipments: %v", err)
        return
    }

    // Batch tracking (до 100 за запит)
    for i := 0; i < len(shipments); i += 100 {
        end := i + 100
        if end > len(shipments) {
            end = len(shipments)
        }

        batch := shipments[i:end]
        numbers := make([]string, len(batch))
        for j, s := range batch {
            numbers[j] = s.TrackingNumber
        }

        // Отримуємо статуси
        infos, err := j.npService.GetTrackingBatch(ctx, numbers)
        if err != nil {
            log.Printf("Error fetching tracking: %v", err)
            continue
        }

        // Оновлюємо статуси
        for _, info := range infos {
            shipment := findByTracking(batch, info.TrackingNumber)
            if shipment == nil {
                continue
            }

            newStatus := mapNovaPoshtaStatus(info.StatusCode)
            if shipment.Status != newStatus {
                j.shipmentRepo.UpdateStatus(ctx, shipment.ID, newStatus, info.Status)

                // Відправляємо notification
                j.notifyStatusChange(ctx, shipment, newStatus)
            }
        }
    }
}
```
