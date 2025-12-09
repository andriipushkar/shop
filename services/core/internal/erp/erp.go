package erp

import (
	"context"
	"errors"
	"time"
)

// Common errors
var (
	ErrNotFound        = errors.New("entity not found")
	ErrInvalidData     = errors.New("invalid data")
	ErrConnectionFailed = errors.New("connection failed")
	ErrSyncFailed      = errors.New("sync failed")
)

// Product represents ERP product
type Product struct {
	ID          string            `json:"id"`
	ExternalID  string            `json:"external_id,omitempty"`
	SKU         string            `json:"sku"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Category    string            `json:"category,omitempty"`
	Brand       string            `json:"brand,omitempty"`
	Unit        string            `json:"unit,omitempty"`       // шт, кг, л, м, etc.
	Barcode     string            `json:"barcode,omitempty"`
	Price       float64           `json:"price"`
	CostPrice   float64           `json:"cost_price,omitempty"`
	Currency    string            `json:"currency,omitempty"`
	VATRate     float64           `json:"vat_rate,omitempty"`   // % ПДВ
	Stock       int               `json:"stock"`
	Reserved    int               `json:"reserved,omitempty"`
	MinStock    int               `json:"min_stock,omitempty"`
	Weight      float64           `json:"weight,omitempty"`     // кг
	Dimensions  *Dimensions       `json:"dimensions,omitempty"`
	Attributes  map[string]string `json:"attributes,omitempty"`
	Images      []string          `json:"images,omitempty"`
	IsActive    bool              `json:"is_active"`
	CreatedAt   time.Time         `json:"created_at,omitempty"`
	UpdatedAt   time.Time         `json:"updated_at,omitempty"`
}

// Dimensions represents product dimensions
type Dimensions struct {
	Length float64 `json:"length"` // см
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// Order represents ERP order
type Order struct {
	ID             string          `json:"id"`
	ExternalID     string          `json:"external_id,omitempty"`
	Number         string          `json:"number"`
	Date           time.Time       `json:"date"`
	Status         string          `json:"status"`
	Customer       *Customer       `json:"customer"`
	Items          []OrderItem     `json:"items"`
	Subtotal       float64         `json:"subtotal"`
	Discount       float64         `json:"discount,omitempty"`
	DiscountReason string          `json:"discount_reason,omitempty"`
	ShippingCost   float64         `json:"shipping_cost,omitempty"`
	Total          float64         `json:"total"`
	VATAmount      float64         `json:"vat_amount,omitempty"`
	Currency       string          `json:"currency,omitempty"`
	PaymentMethod  string          `json:"payment_method,omitempty"`
	PaymentStatus  string          `json:"payment_status,omitempty"`
	ShippingMethod string          `json:"shipping_method,omitempty"`
	ShippingAddress *Address       `json:"shipping_address,omitempty"`
	TrackingNumber string          `json:"tracking_number,omitempty"`
	Notes          string          `json:"notes,omitempty"`
	ManagerID      string          `json:"manager_id,omitempty"`
	WarehouseID    string          `json:"warehouse_id,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at,omitempty"`
}

// OrderItem represents order line item
type OrderItem struct {
	ProductID   string  `json:"product_id"`
	ExternalID  string  `json:"external_id,omitempty"`
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
	Discount    float64 `json:"discount,omitempty"`
	Total       float64 `json:"total"`
	VATRate     float64 `json:"vat_rate,omitempty"`
	VATAmount   float64 `json:"vat_amount,omitempty"`
	Unit        string  `json:"unit,omitempty"`
	WarehouseID string  `json:"warehouse_id,omitempty"`
}

// Customer represents ERP customer/contractor
type Customer struct {
	ID          string   `json:"id"`
	ExternalID  string   `json:"external_id,omitempty"`
	Type        string   `json:"type,omitempty"` // individual, company
	Name        string   `json:"name"`
	FirstName   string   `json:"first_name,omitempty"`
	LastName    string   `json:"last_name,omitempty"`
	Email       string   `json:"email,omitempty"`
	Phone       string   `json:"phone"`
	CompanyName string   `json:"company_name,omitempty"`
	EDRPOU      string   `json:"edrpou,omitempty"`      // ЄДРПОУ для юр.осіб
	IPN         string   `json:"ipn,omitempty"`         // ІПН для фіз.осіб
	IsVATPayer  bool     `json:"is_vat_payer,omitempty"`
	Address     *Address `json:"address,omitempty"`
	Notes       string   `json:"notes,omitempty"`
	ManagerID   string   `json:"manager_id,omitempty"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
}

// Address represents address
type Address struct {
	Country    string `json:"country,omitempty"`
	Region     string `json:"region,omitempty"`     // Область
	City       string `json:"city"`
	District   string `json:"district,omitempty"`   // Район
	Street     string `json:"street,omitempty"`
	Building   string `json:"building,omitempty"`
	Apartment  string `json:"apartment,omitempty"`
	PostalCode string `json:"postal_code,omitempty"`
	FullAddress string `json:"full_address,omitempty"`
}

// Invoice represents invoice document
type Invoice struct {
	ID          string      `json:"id"`
	ExternalID  string      `json:"external_id,omitempty"`
	Number      string      `json:"number"`
	Date        time.Time   `json:"date"`
	OrderID     string      `json:"order_id,omitempty"`
	CustomerID  string      `json:"customer_id"`
	Items       []OrderItem `json:"items"`
	Subtotal    float64     `json:"subtotal"`
	VATAmount   float64     `json:"vat_amount"`
	Total       float64     `json:"total"`
	Currency    string      `json:"currency"`
	Status      string      `json:"status"`  // draft, issued, paid, cancelled
	DueDate     *time.Time  `json:"due_date,omitempty"`
	PaidDate    *time.Time  `json:"paid_date,omitempty"`
	Notes       string      `json:"notes,omitempty"`
}

// StockMovement represents stock movement
type StockMovement struct {
	ID            string    `json:"id"`
	ExternalID    string    `json:"external_id,omitempty"`
	Type          string    `json:"type"`  // income, outcome, transfer, adjustment
	Date          time.Time `json:"date"`
	ProductID     string    `json:"product_id"`
	SKU           string    `json:"sku"`
	Quantity      int       `json:"quantity"`
	WarehouseFrom string    `json:"warehouse_from,omitempty"`
	WarehouseTo   string    `json:"warehouse_to,omitempty"`
	DocumentType  string    `json:"document_type,omitempty"` // order, invoice, return, etc.
	DocumentID    string    `json:"document_id,omitempty"`
	Notes         string    `json:"notes,omitempty"`
}

// Warehouse represents warehouse
type Warehouse struct {
	ID        string   `json:"id"`
	ExternalID string  `json:"external_id,omitempty"`
	Name      string   `json:"name"`
	Code      string   `json:"code,omitempty"`
	Address   *Address `json:"address,omitempty"`
	IsActive  bool     `json:"is_active"`
	IsDefault bool     `json:"is_default,omitempty"`
}

// SyncResult represents sync operation result
type SyncResult struct {
	EntityType  string    `json:"entity_type"`
	Created     int       `json:"created"`
	Updated     int       `json:"updated"`
	Deleted     int       `json:"deleted"`
	Errors      int       `json:"errors"`
	ErrorList   []string  `json:"error_list,omitempty"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt time.Time `json:"completed_at"`
}

// ERPProvider defines interface for ERP systems
type ERPProvider interface {
	// Name returns provider name
	Name() string

	// Products
	GetProducts(ctx context.Context, updatedSince *time.Time) ([]Product, error)
	GetProduct(ctx context.Context, id string) (*Product, error)
	CreateProduct(ctx context.Context, product *Product) (*Product, error)
	UpdateProduct(ctx context.Context, product *Product) error
	UpdateStock(ctx context.Context, productID string, warehouseID string, quantity int) error

	// Orders
	GetOrders(ctx context.Context, updatedSince *time.Time) ([]Order, error)
	GetOrder(ctx context.Context, id string) (*Order, error)
	CreateOrder(ctx context.Context, order *Order) (*Order, error)
	UpdateOrderStatus(ctx context.Context, orderID string, status string) error

	// Customers
	GetCustomers(ctx context.Context, updatedSince *time.Time) ([]Customer, error)
	GetCustomer(ctx context.Context, id string) (*Customer, error)
	CreateCustomer(ctx context.Context, customer *Customer) (*Customer, error)
	UpdateCustomer(ctx context.Context, customer *Customer) error

	// Stock
	GetStock(ctx context.Context, warehouseID string) ([]ProductStock, error)
	GetWarehouses(ctx context.Context) ([]Warehouse, error)
}

// ProductStock represents product stock in warehouse
type ProductStock struct {
	ProductID   string `json:"product_id"`
	SKU         string `json:"sku"`
	WarehouseID string `json:"warehouse_id"`
	Quantity    int    `json:"quantity"`
	Reserved    int    `json:"reserved"`
	Available   int    `json:"available"`
}

// ERPService manages ERP integrations
type ERPService struct {
	providers      map[string]ERPProvider
	defaultProvider string
}

// NewERPService creates ERP service
func NewERPService() *ERPService {
	return &ERPService{
		providers: make(map[string]ERPProvider),
	}
}

// RegisterProvider registers ERP provider
func (s *ERPService) RegisterProvider(provider ERPProvider) {
	s.providers[provider.Name()] = provider
}

// SetDefaultProvider sets default provider
func (s *ERPService) SetDefaultProvider(name string) {
	s.defaultProvider = name
}

// GetProvider returns provider by name
func (s *ERPService) GetProvider(name string) (ERPProvider, error) {
	if name == "" {
		name = s.defaultProvider
	}
	provider, ok := s.providers[name]
	if !ok {
		return nil, errors.New("ERP provider not found: " + name)
	}
	return provider, nil
}

// SyncProducts syncs products from ERP
func (s *ERPService) SyncProducts(ctx context.Context, providerName string, updatedSince *time.Time) (*SyncResult, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}

	result := &SyncResult{
		EntityType: "products",
		StartedAt:  time.Now(),
	}

	products, err := provider.GetProducts(ctx, updatedSince)
	if err != nil {
		return nil, err
	}

	// Here you would sync with local database
	result.Updated = len(products)
	result.CompletedAt = time.Now()

	return result, nil
}

// SyncOrders syncs orders from ERP
func (s *ERPService) SyncOrders(ctx context.Context, providerName string, updatedSince *time.Time) (*SyncResult, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}

	result := &SyncResult{
		EntityType: "orders",
		StartedAt:  time.Now(),
	}

	orders, err := provider.GetOrders(ctx, updatedSince)
	if err != nil {
		return nil, err
	}

	result.Updated = len(orders)
	result.CompletedAt = time.Now()

	return result, nil
}

// ExportOrder exports order to ERP
func (s *ERPService) ExportOrder(ctx context.Context, providerName string, order *Order) (*Order, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}

	return provider.CreateOrder(ctx, order)
}

// SyncStock syncs stock from ERP
func (s *ERPService) SyncStock(ctx context.Context, providerName string, warehouseID string) ([]ProductStock, error) {
	provider, err := s.GetProvider(providerName)
	if err != nil {
		return nil, err
	}

	return provider.GetStock(ctx, warehouseID)
}
