package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Shipment represents a shipment/delivery
type Shipment struct {
	ID               string     `json:"id"`
	OrderID          string     `json:"order_id"`
	Provider         string     `json:"provider"`
	TrackingNumber   string     `json:"tracking_number"`
	Status           string     `json:"status"`
	EstimatedDelivery *time.Time `json:"estimated_delivery,omitempty"`
	ActualDelivery   *time.Time `json:"actual_delivery,omitempty"`
	SenderAddress    *Address   `json:"sender_address"`
	RecipientAddress *Address   `json:"recipient_address"`
	Weight           float64    `json:"weight"`
	Dimensions       *Dimensions `json:"dimensions,omitempty"`
	DeliveryCost     float64    `json:"delivery_cost"`
	InsuredValue     float64    `json:"insured_value,omitempty"`
	CODAmount        float64    `json:"cod_amount,omitempty"`
	Events           []*ShipmentEvent `json:"events,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type Dimensions struct {
	Length float64 `json:"length"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type ShipmentEvent struct {
	Timestamp   time.Time `json:"timestamp"`
	Status      string    `json:"status"`
	Location    string    `json:"location,omitempty"`
	Description string    `json:"description"`
}

// CreateShipmentRequest represents a shipment creation request
type CreateShipmentRequest struct {
	OrderID          string      `json:"order_id"`
	Provider         string      `json:"provider"`
	RecipientAddress *Address    `json:"recipient_address"`
	SenderAddress    *Address    `json:"sender_address,omitempty"`
	Weight           float64     `json:"weight"`
	Dimensions       *Dimensions `json:"dimensions,omitempty"`
	Description      string      `json:"description"`
	InsuredValue     float64     `json:"insured_value,omitempty"`
	CODAmount        float64     `json:"cod_amount,omitempty"`
	ServiceType      string      `json:"service_type"` // warehouse, courier, etc.
}

// CalculateDeliveryRequest represents a delivery cost calculation request
type CalculateDeliveryRequest struct {
	Provider    string      `json:"provider"`
	SenderCity  string      `json:"sender_city"`
	RecipientCity string    `json:"recipient_city"`
	Weight      float64     `json:"weight"`
	Dimensions  *Dimensions `json:"dimensions,omitempty"`
	ServiceType string      `json:"service_type"`
	CODAmount   float64     `json:"cod_amount,omitempty"`
}

type DeliveryCostResponse struct {
	Provider         string     `json:"provider"`
	Cost             float64    `json:"cost"`
	Currency         string     `json:"currency"`
	EstimatedDays    int        `json:"estimated_days"`
	EstimatedDelivery *time.Time `json:"estimated_delivery,omitempty"`
	ServiceType      string     `json:"service_type"`
}

type City struct {
	Ref         string `json:"ref"`
	Name        string `json:"name"`
	NameRu      string `json:"name_ru,omitempty"`
	Region      string `json:"region,omitempty"`
	Description string `json:"description,omitempty"`
}

type Warehouse struct {
	Ref         string  `json:"ref"`
	Number      int     `json:"number"`
	Name        string  `json:"name"`
	Address     string  `json:"address"`
	Phone       string  `json:"phone,omitempty"`
	Schedule    string  `json:"schedule,omitempty"`
	Lat         float64 `json:"lat,omitempty"`
	Lng         float64 `json:"lng,omitempty"`
	MaxWeight   float64 `json:"max_weight,omitempty"`
}

// DeliveryHandler handles delivery-related HTTP requests
type DeliveryHandler struct {
	// In real implementation, inject delivery services
}

// NewDeliveryHandler creates a new delivery handler
func NewDeliveryHandler() *DeliveryHandler {
	return &DeliveryHandler{}
}

// CreateShipment creates a new shipment
func (h *DeliveryHandler) CreateShipment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateShipmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.OrderID == "" {
		http.Error(w, "Order ID is required", http.StatusBadRequest)
		return
	}
	if req.Provider == "" {
		http.Error(w, "Provider is required", http.StatusBadRequest)
		return
	}
	if req.RecipientAddress == nil {
		http.Error(w, "Recipient address is required", http.StatusBadRequest)
		return
	}

	// Validate provider
	validProviders := map[string]bool{
		"nova_poshta": true,
		"ukrposhta":   true,
		"meest":       true,
		"justin":      true,
	}
	if !validProviders[req.Provider] {
		http.Error(w, "Invalid delivery provider", http.StatusBadRequest)
		return
	}

	// Create shipment with provider
	shipment := &Shipment{
		ID:               fmt.Sprintf("SHP-%d", time.Now().UnixNano()),
		OrderID:          req.OrderID,
		Provider:         req.Provider,
		Status:           "created",
		RecipientAddress: req.RecipientAddress,
		SenderAddress:    req.SenderAddress,
		Weight:           req.Weight,
		Dimensions:       req.Dimensions,
		InsuredValue:     req.InsuredValue,
		CODAmount:        req.CODAmount,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// In real implementation, call provider API to create shipment
	switch req.Provider {
	case "nova_poshta":
		shipment.TrackingNumber = fmt.Sprintf("20450%d", time.Now().UnixNano()%1000000000)
	case "ukrposhta":
		shipment.TrackingNumber = fmt.Sprintf("UA%d", time.Now().UnixNano()%100000000)
	case "meest":
		shipment.TrackingNumber = fmt.Sprintf("ME%d", time.Now().UnixNano()%100000000)
	case "justin":
		shipment.TrackingNumber = fmt.Sprintf("JE%d", time.Now().UnixNano()%100000000)
	}

	// Calculate estimated delivery
	estimatedDays := getEstimatedDeliveryDays(req.Provider, req.ServiceType)
	estimatedDelivery := time.Now().AddDate(0, 0, estimatedDays)
	shipment.EstimatedDelivery = &estimatedDelivery

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(shipment)
}

// GetShipment retrieves a shipment by ID
func (h *DeliveryHandler) GetShipment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract shipment ID from path: /shipments/{id}
	shipmentID := r.URL.Path[len("/shipments/"):]
	if shipmentID == "" {
		http.Error(w, "Shipment ID is required", http.StatusBadRequest)
		return
	}

	// In real implementation, fetch from database
	estimatedDelivery := time.Now().AddDate(0, 0, 2)
	shipment := &Shipment{
		ID:               shipmentID,
		OrderID:          "ORD-123",
		Provider:         "nova_poshta",
		TrackingNumber:   "20450123456789",
		Status:           "in_transit",
		EstimatedDelivery: &estimatedDelivery,
		DeliveryCost:     70.00,
		CreatedAt:        time.Now().Add(-24 * time.Hour),
		UpdatedAt:        time.Now(),
		Events: []*ShipmentEvent{
			{
				Timestamp:   time.Now().Add(-24 * time.Hour),
				Status:      "created",
				Description: "Відправлення створено",
			},
			{
				Timestamp:   time.Now().Add(-12 * time.Hour),
				Status:      "accepted",
				Location:    "Київ",
				Description: "Прийнято у відділенні",
			},
			{
				Timestamp:   time.Now().Add(-6 * time.Hour),
				Status:      "in_transit",
				Description: "В дорозі",
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shipment)
}

// TrackShipment tracks a shipment by tracking number
func (h *DeliveryHandler) TrackShipment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	trackingNumber := r.URL.Query().Get("tracking_number")
	provider := r.URL.Query().Get("provider")

	if trackingNumber == "" {
		http.Error(w, "Tracking number is required", http.StatusBadRequest)
		return
	}

	// In real implementation, call provider tracking API
	events := []*ShipmentEvent{
		{
			Timestamp:   time.Now().Add(-48 * time.Hour),
			Status:      "created",
			Description: "Відправлення створено",
		},
		{
			Timestamp:   time.Now().Add(-36 * time.Hour),
			Status:      "accepted",
			Location:    "Київ, відділення №1",
			Description: "Прийнято у відділенні",
		},
		{
			Timestamp:   time.Now().Add(-24 * time.Hour),
			Status:      "departed",
			Location:    "Київ",
			Description: "Відправлено з міста",
		},
		{
			Timestamp:   time.Now().Add(-12 * time.Hour),
			Status:      "in_transit",
			Description: "В дорозі",
		},
		{
			Timestamp:   time.Now().Add(-2 * time.Hour),
			Status:      "arrived",
			Location:    "Львів",
			Description: "Прибуло у місто призначення",
		},
	}

	response := map[string]interface{}{
		"tracking_number": trackingNumber,
		"provider":        provider,
		"status":          "arrived",
		"events":          events,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CalculateDeliveryCost calculates delivery cost
func (h *DeliveryHandler) CalculateDeliveryCost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CalculateDeliveryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Provider == "" {
		// Calculate for all providers
		responses := []*DeliveryCostResponse{
			h.calculateForProvider("nova_poshta", req),
			h.calculateForProvider("ukrposhta", req),
			h.calculateForProvider("meest", req),
			h.calculateForProvider("justin", req),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(responses)
		return
	}

	response := h.calculateForProvider(req.Provider, req)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetDeliveryProviders returns available delivery providers
func (h *DeliveryHandler) GetDeliveryProviders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	providers := []map[string]interface{}{
		{
			"id":          "nova_poshta",
			"name":        "Нова Пошта",
			"description": "Найбільша служба доставки в Україні",
			"icon":        "/icons/nova-poshta.svg",
			"enabled":     true,
			"services": []string{"warehouse", "courier", "express"},
		},
		{
			"id":          "ukrposhta",
			"name":        "Укрпошта",
			"description": "Національний поштовий оператор",
			"icon":        "/icons/ukrposhta.svg",
			"enabled":     true,
			"services": []string{"standard", "express"},
		},
		{
			"id":          "meest",
			"name":        "Meest",
			"description": "Міжнародна доставка та логістика",
			"icon":        "/icons/meest.svg",
			"enabled":     true,
			"services": []string{"warehouse", "courier"},
		},
		{
			"id":          "justin",
			"name":        "Justin",
			"description": "Швидка доставка по Україні",
			"icon":        "/icons/justin.svg",
			"enabled":     true,
			"services": []string{"warehouse", "courier"},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(providers)
}

// SearchCities searches for cities by name
func (h *DeliveryHandler) SearchCities(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	provider := r.URL.Query().Get("provider")

	if query == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	// In real implementation, call provider API
	// Mock response
	cities := []*City{
		{Ref: "8d5a980d-391c-11dd-90d9-001a92567626", Name: "Київ", Region: "Київська область"},
		{Ref: "db5c88e0-391c-11dd-90d9-001a92567626", Name: "Львів", Region: "Львівська область"},
		{Ref: "e71abb60-4b33-11e4-ab6d-005056801329", Name: "Одеса", Region: "Одеська область"},
		{Ref: "e71f8842-4b33-11e4-ab6d-005056801329", Name: "Харків", Region: "Харківська область"},
		{Ref: "e71f8565-4b33-11e4-ab6d-005056801329", Name: "Дніпро", Region: "Дніпропетровська область"},
	}

	// Filter by query
	var filtered []*City
	for _, city := range cities {
		if containsIgnoreCase(city.Name, query) {
			filtered = append(filtered, city)
		}
	}

	response := map[string]interface{}{
		"provider": provider,
		"cities":   filtered,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetWarehouses retrieves warehouses for a city
func (h *DeliveryHandler) GetWarehouses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cityRef := r.URL.Query().Get("city_ref")
	provider := r.URL.Query().Get("provider")

	if cityRef == "" {
		http.Error(w, "City ref is required", http.StatusBadRequest)
		return
	}

	// In real implementation, call provider API
	warehouses := []*Warehouse{
		{Ref: "1", Number: 1, Name: "Відділення №1", Address: "вул. Хрещатик, 1", Phone: "0800500609"},
		{Ref: "2", Number: 2, Name: "Відділення №2", Address: "вул. Хрещатик, 22", Phone: "0800500609"},
		{Ref: "3", Number: 3, Name: "Відділення №3", Address: "вул. Саксаганського, 12", Phone: "0800500609"},
		{Ref: "4", Number: 4, Name: "Відділення №4 (до 30 кг)", Address: "вул. Велика Васильківська, 45", Phone: "0800500609"},
		{Ref: "5", Number: 5, Name: "Поштомат №1", Address: "вул. Хрещатик, 15", MaxWeight: 30},
	}

	response := map[string]interface{}{
		"provider":   provider,
		"city_ref":   cityRef,
		"warehouses": warehouses,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// PrintLabel generates and returns a shipping label
func (h *DeliveryHandler) PrintLabel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract shipment ID from path: /shipments/{id}/label
	path := r.URL.Path[len("/shipments/"):]
	shipmentID := path[:len(path)-len("/label")]
	if shipmentID == "" {
		http.Error(w, "Shipment ID is required", http.StatusBadRequest)
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "pdf"
	}

	// In real implementation, generate label from provider API
	// Return label URL or PDF data
	response := map[string]interface{}{
		"shipment_id": shipmentID,
		"format":      format,
		"label_url":   fmt.Sprintf("/api/shipments/%s/label.%s", shipmentID, format),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CancelShipment cancels a shipment
func (h *DeliveryHandler) CancelShipment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract shipment ID from path: /shipments/{id}/cancel
	path := r.URL.Path[len("/shipments/"):]
	shipmentID := path[:len(path)-len("/cancel")]
	if shipmentID == "" {
		http.Error(w, "Shipment ID is required", http.StatusBadRequest)
		return
	}

	// In real implementation, call provider API to cancel
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"shipment_id": shipmentID,
		"message":     "Shipment cancelled successfully",
	})
}

// Helper functions

func (h *DeliveryHandler) calculateForProvider(provider string, req CalculateDeliveryRequest) *DeliveryCostResponse {
	var cost float64
	var estimatedDays int

	switch provider {
	case "nova_poshta":
		cost = 70.00
		if req.Weight > 2 {
			cost += (req.Weight - 2) * 10
		}
		if req.ServiceType == "courier" {
			cost += 30.00
		}
		estimatedDays = 2
	case "ukrposhta":
		cost = 50.00
		if req.Weight > 2 {
			cost += (req.Weight - 2) * 8
		}
		estimatedDays = 4
	case "meest":
		cost = 65.00
		if req.Weight > 2 {
			cost += (req.Weight - 2) * 9
		}
		estimatedDays = 3
	case "justin":
		cost = 55.00
		if req.Weight > 2 {
			cost += (req.Weight - 2) * 8
		}
		estimatedDays = 2
	default:
		cost = 70.00
		estimatedDays = 3
	}

	// Add COD fee if applicable
	if req.CODAmount > 0 {
		cost += 20.00 + req.CODAmount*0.02 // 2% of COD amount
	}

	estimatedDelivery := time.Now().AddDate(0, 0, estimatedDays)

	return &DeliveryCostResponse{
		Provider:          provider,
		Cost:              cost,
		Currency:          "UAH",
		EstimatedDays:     estimatedDays,
		EstimatedDelivery: &estimatedDelivery,
		ServiceType:       req.ServiceType,
	}
}

func getEstimatedDeliveryDays(provider, serviceType string) int {
	switch provider {
	case "nova_poshta":
		if serviceType == "express" {
			return 1
		}
		return 2
	case "ukrposhta":
		if serviceType == "express" {
			return 2
		}
		return 4
	case "meest":
		return 3
	case "justin":
		return 2
	default:
		return 3
	}
}

func containsIgnoreCase(s, substr string) bool {
	// Simple implementation - in real code use proper Unicode handling
	return len(s) >= len(substr) && (s == substr || len(substr) == 0)
}
