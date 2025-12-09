package marketplace

import (
	"context"
	"errors"
	"time"
)

var (
	ErrMarketplaceNotConfigured = errors.New("marketplace not configured")
	ErrProductNotFound          = errors.New("product not found")
	ErrOrderNotFound            = errors.New("order not found")
	ErrSyncFailed               = errors.New("sync failed")
	ErrRateLimited              = errors.New("rate limited")
	ErrAuthentication           = errors.New("authentication failed")
)

// MarketplaceType represents marketplace type
type MarketplaceType string

const (
	MarketplaceProm      MarketplaceType = "prom"
	MarketplaceRozetka   MarketplaceType = "rozetka"
	MarketplaceOLX       MarketplaceType = "olx"
	MarketplaceHotline   MarketplaceType = "hotline"
	MarketplaceGoogle    MarketplaceType = "google"
	MarketplaceKasta     MarketplaceType = "kasta"
	MarketplaceAllo      MarketplaceType = "allo"
	MarketplaceEpicentr  MarketplaceType = "epicentr"
	MarketplaceFacebook  MarketplaceType = "facebook"
	MarketplaceMakeup    MarketplaceType = "makeup"
	MarketplaceYakaboo   MarketplaceType = "yakaboo"
)

// SyncDirection represents sync direction
type SyncDirection string

const (
	SyncExport SyncDirection = "export" // Shop -> Marketplace
	SyncImport SyncDirection = "import" // Marketplace -> Shop
	SyncBoth   SyncDirection = "both"
)

// SyncStatus represents sync status
type SyncStatus string

const (
	SyncStatusPending   SyncStatus = "pending"
	SyncStatusRunning   SyncStatus = "running"
	SyncStatusCompleted SyncStatus = "completed"
	SyncStatusFailed    SyncStatus = "failed"
)

// Product represents a product for marketplace
type Product struct {
	ID            string            `json:"id"`
	ExternalID    string            `json:"external_id,omitempty"`
	SKU           string            `json:"sku"`
	Barcode       string            `json:"barcode,omitempty"`
	Name          string            `json:"name"`
	Description   string            `json:"description"`
	Price         float64           `json:"price"`
	OldPrice      float64           `json:"old_price,omitempty"`
	Currency      string            `json:"currency"`
	Quantity      int               `json:"quantity"`
	CategoryID    string            `json:"category_id"`
	CategoryPath  string            `json:"category_path,omitempty"`
	Brand         string            `json:"brand,omitempty"`
	Images        []string          `json:"images"`
	Attributes    map[string]string `json:"attributes,omitempty"`
	URL           string            `json:"url,omitempty"`
	IsActive      bool              `json:"is_active"`
	IsAvailable   bool              `json:"is_available"`
	DeliveryDays  int               `json:"delivery_days,omitempty"`
	Warranty      int               `json:"warranty_months,omitempty"`
	Weight        float64           `json:"weight,omitempty"`
	Dimensions    *Dimensions       `json:"dimensions,omitempty"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

// Dimensions represents product dimensions
type Dimensions struct {
	Length float64 `json:"length"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// Order represents a marketplace order
type Order struct {
	ID              string       `json:"id"`
	ExternalID      string       `json:"external_id"`
	Marketplace     MarketplaceType `json:"marketplace"`
	Status          string       `json:"status"`
	CustomerName    string       `json:"customer_name"`
	CustomerPhone   string       `json:"customer_phone"`
	CustomerEmail   string       `json:"customer_email,omitempty"`
	DeliveryType    string       `json:"delivery_type"`
	DeliveryAddress string       `json:"delivery_address"`
	DeliveryCity    string       `json:"delivery_city"`
	DeliveryInfo    string       `json:"delivery_info,omitempty"`
	PaymentType     string       `json:"payment_type"`
	Items           []OrderItem  `json:"items"`
	Total           float64      `json:"total"`
	Comment         string       `json:"comment,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
}

// OrderItem represents an order item
type OrderItem struct {
	ProductID   string  `json:"product_id"`
	ExternalID  string  `json:"external_id"`
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Quantity    int     `json:"quantity"`
	Total       float64 `json:"total"`
}

// SyncResult represents sync operation result
type SyncResult struct {
	ID              string          `json:"id"`
	Marketplace     MarketplaceType `json:"marketplace"`
	Direction       SyncDirection   `json:"direction"`
	Status          SyncStatus      `json:"status"`
	TotalItems      int             `json:"total_items"`
	ProcessedItems  int             `json:"processed_items"`
	SuccessItems    int             `json:"success_items"`
	FailedItems     int             `json:"failed_items"`
	Errors          []SyncError     `json:"errors,omitempty"`
	StartedAt       time.Time       `json:"started_at"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
}

// SyncError represents a sync error
type SyncError struct {
	ProductID string `json:"product_id,omitempty"`
	SKU       string `json:"sku,omitempty"`
	Message   string `json:"message"`
	Code      string `json:"code,omitempty"`
}

// CategoryMapping represents category mapping between shop and marketplace
type CategoryMapping struct {
	ShopCategoryID        string `json:"shop_category_id"`
	MarketplaceCategoryID string `json:"marketplace_category_id"`
	MarketplaceCategoryName string `json:"marketplace_category_name,omitempty"`
}

// Config represents marketplace configuration
type Config struct {
	Type          MarketplaceType `json:"type"`
	Enabled       bool            `json:"enabled"`
	APIKey        string          `json:"api_key,omitempty"`
	APISecret     string          `json:"api_secret,omitempty"`
	ClientID      string          `json:"client_id,omitempty"`
	AccessToken   string          `json:"access_token,omitempty"`
	RefreshToken  string          `json:"refresh_token,omitempty"`
	ShopID        string          `json:"shop_id,omitempty"`
	BaseURL       string          `json:"base_url,omitempty"`
	WebhookSecret string          `json:"webhook_secret,omitempty"`
	SyncInterval  time.Duration   `json:"sync_interval"`
	AutoSync      bool            `json:"auto_sync"`
	PriceMarkup   float64         `json:"price_markup,omitempty"` // Percentage markup
	CategoryMappings []CategoryMapping `json:"category_mappings,omitempty"`
}

// Marketplace defines the marketplace integration interface
type Marketplace interface {
	// Configuration
	Type() MarketplaceType
	Configure(config *Config) error
	IsConfigured() bool

	// Products
	ExportProducts(ctx context.Context, products []*Product) (*SyncResult, error)
	UpdateProduct(ctx context.Context, product *Product) error
	UpdateStock(ctx context.Context, sku string, quantity int) error
	UpdatePrice(ctx context.Context, sku string, price float64) error
	DeleteProduct(ctx context.Context, sku string) error

	// Orders
	ImportOrders(ctx context.Context, since time.Time) ([]*Order, error)
	UpdateOrderStatus(ctx context.Context, orderID, status string) error

	// Categories
	GetCategories(ctx context.Context) ([]Category, error)

	// Feed generation (for XML-based marketplaces)
	GenerateFeed(ctx context.Context, products []*Product) ([]byte, error)
}

// Category represents a marketplace category
type Category struct {
	ID       string     `json:"id"`
	Name     string     `json:"name"`
	ParentID string     `json:"parent_id,omitempty"`
	Path     string     `json:"path,omitempty"`
	Children []Category `json:"children,omitempty"`
}

// Repository defines data store for marketplace sync
type Repository interface {
	// Products
	GetProductsForExport(ctx context.Context, marketplace MarketplaceType) ([]*Product, error)
	GetProductBySKU(ctx context.Context, sku string) (*Product, error)
	UpdateProductExternalID(ctx context.Context, sku, externalID string, marketplace MarketplaceType) error

	// Orders
	SaveMarketplaceOrder(ctx context.Context, order *Order) error
	GetMarketplaceOrder(ctx context.Context, externalID string, marketplace MarketplaceType) (*Order, error)
	UpdateMarketplaceOrderStatus(ctx context.Context, externalID string, marketplace MarketplaceType, status string) error

	// Sync history
	SaveSyncResult(ctx context.Context, result *SyncResult) error
	GetLastSyncResult(ctx context.Context, marketplace MarketplaceType, direction SyncDirection) (*SyncResult, error)

	// Config
	GetConfig(ctx context.Context, marketplace MarketplaceType) (*Config, error)
	SaveConfig(ctx context.Context, config *Config) error

	// Category mappings
	GetCategoryMappings(ctx context.Context, marketplace MarketplaceType) ([]CategoryMapping, error)
	SaveCategoryMapping(ctx context.Context, marketplace MarketplaceType, mapping *CategoryMapping) error
}

// Manager manages all marketplace integrations
type Manager struct {
	repo         Repository
	marketplaces map[MarketplaceType]Marketplace
}

// NewManager creates a new marketplace manager
func NewManager(repo Repository) *Manager {
	return &Manager{
		repo:         repo,
		marketplaces: make(map[MarketplaceType]Marketplace),
	}
}

// Register registers a marketplace integration
func (m *Manager) Register(marketplace Marketplace) {
	m.marketplaces[marketplace.Type()] = marketplace
}

// Get returns a marketplace integration
func (m *Manager) Get(t MarketplaceType) (Marketplace, error) {
	mp, ok := m.marketplaces[t]
	if !ok {
		return nil, ErrMarketplaceNotConfigured
	}
	return mp, nil
}

// GetAll returns all registered marketplaces
func (m *Manager) GetAll() []Marketplace {
	result := make([]Marketplace, 0, len(m.marketplaces))
	for _, mp := range m.marketplaces {
		result = append(result, mp)
	}
	return result
}

// SyncAll syncs all enabled marketplaces
func (m *Manager) SyncAll(ctx context.Context) map[MarketplaceType]*SyncResult {
	results := make(map[MarketplaceType]*SyncResult)

	for t, mp := range m.marketplaces {
		if !mp.IsConfigured() {
			continue
		}

		// Get products for this marketplace
		products, err := m.repo.GetProductsForExport(ctx, t)
		if err != nil {
			results[t] = &SyncResult{
				Marketplace: t,
				Status:      SyncStatusFailed,
				Errors:      []SyncError{{Message: err.Error()}},
			}
			continue
		}

		// Export products
		result, err := mp.ExportProducts(ctx, products)
		if err != nil {
			results[t] = &SyncResult{
				Marketplace: t,
				Status:      SyncStatusFailed,
				Errors:      []SyncError{{Message: err.Error()}},
			}
			continue
		}

		results[t] = result
		_ = m.repo.SaveSyncResult(ctx, result)
	}

	return results
}
