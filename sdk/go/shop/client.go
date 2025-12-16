// Package shop provides a Go SDK for Shop Platform API
// Enables partners to integrate with Shop marketplace in minutes
package shop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const (
	// DefaultBaseURL is the default API endpoint
	DefaultBaseURL = "https://api.shop.com/v1"

	// DefaultTimeout is the default HTTP timeout
	DefaultTimeout = 30 * time.Second
)

// Client is the Shop API client
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	userAgent  string
}

// ClientOption configures the client
type ClientOption func(*Client)

// WithBaseURL sets custom API base URL
func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

// WithHTTPClient sets custom HTTP client
func WithHTTPClient(client *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = client
	}
}

// WithTimeout sets request timeout
func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) {
		c.httpClient.Timeout = timeout
	}
}

// NewClient creates a new Shop API client
func NewClient(apiKey string, opts ...ClientOption) *Client {
	c := &Client{
		baseURL: DefaultBaseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
		userAgent: "shop-go-sdk/1.0.0",
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// =============================================================================
// PRODUCTS API
// =============================================================================

// Product represents a product in the catalog
type Product struct {
	ID             string            `json:"id"`
	SKU            string            `json:"sku"`
	Name           string            `json:"name"`
	Description    string            `json:"description"`
	Price          float64           `json:"price"`
	CompareAtPrice float64           `json:"compare_at_price,omitempty"`
	Currency       string            `json:"currency"`
	CategoryID     string            `json:"category_id"`
	Images         []string          `json:"images"`
	Variants       []ProductVariant  `json:"variants,omitempty"`
	Inventory      int               `json:"inventory"`
	Status         string            `json:"status"`
	Attributes     map[string]string `json:"attributes,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}

// ProductVariant represents a product variant
type ProductVariant struct {
	ID        string            `json:"id"`
	SKU       string            `json:"sku"`
	Name      string            `json:"name"`
	Price     float64           `json:"price"`
	Inventory int               `json:"inventory"`
	Options   map[string]string `json:"options"`
}

// CreateProductInput is the input for creating a product
type CreateProductInput struct {
	SKU            string            `json:"sku"`
	Name           string            `json:"name"`
	Description    string            `json:"description"`
	Price          float64           `json:"price"`
	CompareAtPrice float64           `json:"compare_at_price,omitempty"`
	CategoryID     string            `json:"category_id"`
	Images         []string          `json:"images"`
	Inventory      int               `json:"inventory"`
	Attributes     map[string]string `json:"attributes,omitempty"`
}

// ListProductsParams are parameters for listing products
type ListProductsParams struct {
	Page       int    `url:"page,omitempty"`
	Limit      int    `url:"limit,omitempty"`
	CategoryID string `url:"category_id,omitempty"`
	Status     string `url:"status,omitempty"`
	Search     string `url:"search,omitempty"`
}

// ProductList is a paginated list of products
type ProductList struct {
	Items      []Product `json:"items"`
	Total      int       `json:"total"`
	Page       int       `json:"page"`
	Limit      int       `json:"limit"`
	TotalPages int       `json:"total_pages"`
}

// Products returns a products service
func (c *Client) Products() *ProductsService {
	return &ProductsService{client: c}
}

// ProductsService handles product operations
type ProductsService struct {
	client *Client
}

// Create creates a new product
func (s *ProductsService) Create(ctx context.Context, input CreateProductInput) (*Product, error) {
	var product Product
	err := s.client.post(ctx, "/products", input, &product)
	return &product, err
}

// Get retrieves a product by ID
func (s *ProductsService) Get(ctx context.Context, id string) (*Product, error) {
	var product Product
	err := s.client.get(ctx, "/products/"+id, nil, &product)
	return &product, err
}

// Update updates a product
func (s *ProductsService) Update(ctx context.Context, id string, input CreateProductInput) (*Product, error) {
	var product Product
	err := s.client.put(ctx, "/products/"+id, input, &product)
	return &product, err
}

// Delete deletes a product
func (s *ProductsService) Delete(ctx context.Context, id string) error {
	return s.client.delete(ctx, "/products/"+id)
}

// List lists products with optional filters
func (s *ProductsService) List(ctx context.Context, params *ListProductsParams) (*ProductList, error) {
	var list ProductList
	err := s.client.get(ctx, "/products", params, &list)
	return &list, err
}

// UpdateInventory updates product inventory
func (s *ProductsService) UpdateInventory(ctx context.Context, id string, quantity int) error {
	input := map[string]int{"inventory": quantity}
	return s.client.patch(ctx, "/products/"+id+"/inventory", input, nil)
}

// =============================================================================
// ORDERS API
// =============================================================================

// Order represents an order
type Order struct {
	ID              string      `json:"id"`
	OrderNumber     string      `json:"order_number"`
	Status          OrderStatus `json:"status"`
	CustomerEmail   string      `json:"customer_email"`
	CustomerName    string      `json:"customer_name"`
	ShippingAddress Address     `json:"shipping_address"`
	BillingAddress  Address     `json:"billing_address"`
	Items           []OrderItem `json:"items"`
	Subtotal        float64     `json:"subtotal"`
	ShippingCost    float64     `json:"shipping_cost"`
	Tax             float64     `json:"tax"`
	Discount        float64     `json:"discount"`
	Total           float64     `json:"total"`
	Currency        string      `json:"currency"`
	Notes           string      `json:"notes,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

// OrderStatus represents order status
type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusPaid       OrderStatus = "paid"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusShipped    OrderStatus = "shipped"
	OrderStatusDelivered  OrderStatus = "delivered"
	OrderStatusCancelled  OrderStatus = "cancelled"
	OrderStatusRefunded   OrderStatus = "refunded"
)

// OrderItem represents an item in an order
type OrderItem struct {
	ProductID   string  `json:"product_id"`
	VariantID   string  `json:"variant_id,omitempty"`
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
	TotalPrice  float64 `json:"total_price"`
}

// Address represents a shipping/billing address
type Address struct {
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Company     string `json:"company,omitempty"`
	Address1    string `json:"address1"`
	Address2    string `json:"address2,omitempty"`
	City        string `json:"city"`
	Region      string `json:"region"`
	PostalCode  string `json:"postal_code"`
	Country     string `json:"country"`
	Phone       string `json:"phone,omitempty"`
}

// Orders returns an orders service
func (c *Client) Orders() *OrdersService {
	return &OrdersService{client: c}
}

// OrdersService handles order operations
type OrdersService struct {
	client *Client
}

// Get retrieves an order by ID
func (s *OrdersService) Get(ctx context.Context, id string) (*Order, error) {
	var order Order
	err := s.client.get(ctx, "/orders/"+id, nil, &order)
	return &order, err
}

// List lists orders
func (s *OrdersService) List(ctx context.Context, params *ListOrdersParams) (*OrderList, error) {
	var list OrderList
	err := s.client.get(ctx, "/orders", params, &list)
	return &list, err
}

// UpdateStatus updates order status
func (s *OrdersService) UpdateStatus(ctx context.Context, id string, status OrderStatus) (*Order, error) {
	var order Order
	input := map[string]string{"status": string(status)}
	err := s.client.patch(ctx, "/orders/"+id+"/status", input, &order)
	return &order, err
}

// AddTracking adds tracking information
func (s *OrdersService) AddTracking(ctx context.Context, id string, carrier, trackingNumber string) error {
	input := map[string]string{
		"carrier":         carrier,
		"tracking_number": trackingNumber,
	}
	return s.client.post(ctx, "/orders/"+id+"/tracking", input, nil)
}

// ListOrdersParams are parameters for listing orders
type ListOrdersParams struct {
	Page   int         `url:"page,omitempty"`
	Limit  int         `url:"limit,omitempty"`
	Status OrderStatus `url:"status,omitempty"`
	Since  time.Time   `url:"since,omitempty"`
}

// OrderList is a paginated list of orders
type OrderList struct {
	Items      []Order `json:"items"`
	Total      int     `json:"total"`
	Page       int     `json:"page"`
	Limit      int     `json:"limit"`
	TotalPages int     `json:"total_pages"`
}

// =============================================================================
// WEBHOOKS API
// =============================================================================

// Webhook represents a webhook subscription
type Webhook struct {
	ID        string   `json:"id"`
	URL       string   `json:"url"`
	Events    []string `json:"events"`
	Secret    string   `json:"secret,omitempty"`
	Active    bool     `json:"active"`
	CreatedAt time.Time `json:"created_at"`
}

// WebhookEvent types
const (
	WebhookEventOrderCreated   = "order.created"
	WebhookEventOrderPaid      = "order.paid"
	WebhookEventOrderShipped   = "order.shipped"
	WebhookEventOrderDelivered = "order.delivered"
	WebhookEventOrderCancelled = "order.cancelled"
	WebhookEventProductCreated = "product.created"
	WebhookEventProductUpdated = "product.updated"
	WebhookEventProductDeleted = "product.deleted"
	WebhookEventInventoryLow   = "inventory.low"
)

// Webhooks returns a webhooks service
func (c *Client) Webhooks() *WebhooksService {
	return &WebhooksService{client: c}
}

// WebhooksService handles webhook operations
type WebhooksService struct {
	client *Client
}

// Create creates a new webhook
func (s *WebhooksService) Create(ctx context.Context, url string, events []string) (*Webhook, error) {
	var webhook Webhook
	input := map[string]any{
		"url":    url,
		"events": events,
	}
	err := s.client.post(ctx, "/webhooks", input, &webhook)
	return &webhook, err
}

// Delete deletes a webhook
func (s *WebhooksService) Delete(ctx context.Context, id string) error {
	return s.client.delete(ctx, "/webhooks/"+id)
}

// List lists webhooks
func (s *WebhooksService) List(ctx context.Context) ([]Webhook, error) {
	var webhooks []Webhook
	err := s.client.get(ctx, "/webhooks", nil, &webhooks)
	return webhooks, err
}

// =============================================================================
// HTTP HELPERS
// =============================================================================

func (c *Client) get(ctx context.Context, path string, params any, result any) error {
	return c.request(ctx, http.MethodGet, path, params, nil, result)
}

func (c *Client) post(ctx context.Context, path string, body, result any) error {
	return c.request(ctx, http.MethodPost, path, nil, body, result)
}

func (c *Client) put(ctx context.Context, path string, body, result any) error {
	return c.request(ctx, http.MethodPut, path, nil, body, result)
}

func (c *Client) patch(ctx context.Context, path string, body, result any) error {
	return c.request(ctx, http.MethodPatch, path, nil, body, result)
}

func (c *Client) delete(ctx context.Context, path string) error {
	return c.request(ctx, http.MethodDelete, path, nil, nil, nil)
}

func (c *Client) request(ctx context.Context, method, path string, params, body, result any) error {
	u, err := url.Parse(c.baseURL + path)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, u.String(), bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err != nil {
			return fmt.Errorf("API error: %d", resp.StatusCode)
		}
		return &apiErr
	}

	if result != nil && resp.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}

// APIError represents an API error response
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}
