# Orders Module

Модуль управління замовленнями Shop Platform.

## Огляд

Модуль Orders забезпечує:
- Створення та обробку замовлень
- Управління статусами замовлень
- Інтеграцію з оплатою та доставкою
- Історію та відстеження замовлень
- Повернення та скасування

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        Order Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Cart ──► Checkout ──► Order Created ──► Payment ──► Fulfillment│
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                          │
│                    │   Order States  │                          │
│                    ├─────────────────┤                          │
│                    │ pending         │                          │
│                    │ confirmed       │                          │
│                    │ processing      │                          │
│                    │ shipped         │                          │
│                    │ delivered       │                          │
│                    │ completed       │                          │
│                    │ cancelled       │                          │
│                    │ refunded        │                          │
│                    └─────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Моделі даних

### Order

```go
// internal/orders/models.go
package orders

import (
	"time"

	"github.com/shopspring/decimal"
)

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusConfirmed  OrderStatus = "confirmed"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusShipped    OrderStatus = "shipped"
	OrderStatusDelivered  OrderStatus = "delivered"
	OrderStatusCompleted  OrderStatus = "completed"
	OrderStatusCancelled  OrderStatus = "cancelled"
	OrderStatusRefunded   OrderStatus = "refunded"
)

type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusPaid      PaymentStatus = "paid"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusRefunded  PaymentStatus = "refunded"
	PaymentStatusPartial   PaymentStatus = "partial"
)

type FulfillmentStatus string

const (
	FulfillmentStatusUnfulfilled FulfillmentStatus = "unfulfilled"
	FulfillmentStatusPartial     FulfillmentStatus = "partial"
	FulfillmentStatusFulfilled   FulfillmentStatus = "fulfilled"
)

type Order struct {
	ID                string            `gorm:"primaryKey" json:"id"`
	TenantID          string            `gorm:"index" json:"tenant_id"`
	UserID            *string           `json:"user_id,omitempty"`
	OrderNumber       string            `gorm:"uniqueIndex" json:"order_number"`

	// Status
	Status            OrderStatus       `json:"status"`
	PaymentStatus     PaymentStatus     `json:"payment_status"`
	FulfillmentStatus FulfillmentStatus `json:"fulfillment_status"`

	// Pricing
	Subtotal          decimal.Decimal   `json:"subtotal"`
	DiscountTotal     decimal.Decimal   `json:"discount_total"`
	ShippingTotal     decimal.Decimal   `json:"shipping_total"`
	TaxTotal          decimal.Decimal   `json:"tax_total"`
	GiftCardAmount    decimal.Decimal   `json:"gift_card_amount"`
	Total             decimal.Decimal   `json:"total"`
	Currency          string            `json:"currency"`

	// Customer Info
	Email             string            `json:"email"`
	Phone             string            `json:"phone,omitempty"`
	CustomerNote      string            `json:"customer_note,omitempty"`

	// Addresses (denormalized)
	BillingAddress    *Address          `gorm:"serializer:json" json:"billing_address"`
	ShippingAddress   *Address          `gorm:"serializer:json" json:"shipping_address"`

	// Shipping
	ShippingMethodID   string           `json:"shipping_method_id,omitempty"`
	ShippingMethodName string           `json:"shipping_method_name,omitempty"`
	TrackingNumber     string           `json:"tracking_number,omitempty"`
	ShippedAt          *time.Time       `json:"shipped_at,omitempty"`
	DeliveredAt        *time.Time       `json:"delivered_at,omitempty"`

	// Payment
	PaymentMethod     string            `json:"payment_method,omitempty"`
	PaymentProvider   string            `json:"payment_provider,omitempty"`
	PaymentReference  string            `json:"payment_reference,omitempty"`
	PaidAt            *time.Time        `json:"paid_at,omitempty"`

	// Discounts
	CouponCode        string            `json:"coupon_code,omitempty"`
	DiscountID        *string           `json:"discount_id,omitempty"`
	GiftCardCode      string            `json:"gift_card_code,omitempty"`

	// Meta
	Source            string            `json:"source"` // web, mobile, api, pos
	IPAddress         string            `json:"ip_address,omitempty"`
	UserAgent         string            `json:"user_agent,omitempty"`
	Tags              []string          `gorm:"serializer:json" json:"tags,omitempty"`
	Metadata          map[string]any    `gorm:"serializer:json" json:"metadata,omitempty"`

	// Relations
	Items             []OrderItem       `gorm:"foreignKey:OrderID" json:"items"`
	Transactions      []Transaction     `gorm:"foreignKey:OrderID" json:"transactions,omitempty"`
	Fulfillments      []Fulfillment     `gorm:"foreignKey:OrderID" json:"fulfillments,omitempty"`

	// Timestamps
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
	CancelledAt       *time.Time        `json:"cancelled_at,omitempty"`
	CompletedAt       *time.Time        `json:"completed_at,omitempty"`
}

type OrderItem struct {
	ID                string          `gorm:"primaryKey" json:"id"`
	TenantID          string          `json:"tenant_id"`
	OrderID           string          `gorm:"index" json:"order_id"`
	ProductID         *string         `json:"product_id,omitempty"`
	VariantID         *string         `json:"variant_id,omitempty"`

	// Product snapshot
	SKU               string          `json:"sku"`
	Name              string          `json:"name"`
	VariantName       string          `json:"variant_name,omitempty"`
	ImageURL          string          `json:"image_url,omitempty"`

	// Pricing
	Quantity          int             `json:"quantity"`
	UnitPrice         decimal.Decimal `json:"unit_price"`
	Discount          decimal.Decimal `json:"discount"`
	Tax               decimal.Decimal `json:"tax"`
	Total             decimal.Decimal `json:"total"`

	// Fulfillment
	FulfilledQuantity int             `json:"fulfilled_quantity"`

	Properties        map[string]any  `gorm:"serializer:json" json:"properties,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
}

type Address struct {
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Company      string `json:"company,omitempty"`
	AddressLine1 string `json:"address_line1"`
	AddressLine2 string `json:"address_line2,omitempty"`
	City         string `json:"city"`
	State        string `json:"state,omitempty"`
	PostalCode   string `json:"postal_code"`
	CountryCode  string `json:"country_code"`
	Phone        string `json:"phone,omitempty"`
}
```

### Fulfillment

```go
type Fulfillment struct {
	ID              string           `gorm:"primaryKey" json:"id"`
	TenantID        string           `json:"tenant_id"`
	OrderID         string           `gorm:"index" json:"order_id"`
	Status          string           `json:"status"` // pending, shipped, delivered, cancelled
	TrackingNumber  string           `json:"tracking_number,omitempty"`
	TrackingURL     string           `json:"tracking_url,omitempty"`
	Carrier         string           `json:"carrier,omitempty"`
	ShippedAt       *time.Time       `json:"shipped_at,omitempty"`
	DeliveredAt     *time.Time       `json:"delivered_at,omitempty"`
	Items           []FulfillmentItem `gorm:"foreignKey:FulfillmentID" json:"items"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

type FulfillmentItem struct {
	ID            string `gorm:"primaryKey" json:"id"`
	FulfillmentID string `gorm:"index" json:"fulfillment_id"`
	OrderItemID   string `json:"order_item_id"`
	Quantity      int    `json:"quantity"`
}
```

## Order Service

```go
// internal/orders/service.go
package orders

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type OrderService struct {
	db          *gorm.DB
	cart        CartService
	inventory   InventoryService
	payment     PaymentService
	shipping    ShippingService
	notification NotificationService
	eventBus    EventBus
}

type CreateOrderRequest struct {
	CartID          string            `json:"cart_id"`
	Email           string            `json:"email" binding:"required,email"`
	Phone           string            `json:"phone"`
	BillingAddress  *Address          `json:"billing_address" binding:"required"`
	ShippingAddress *Address          `json:"shipping_address"`
	ShippingMethodID string           `json:"shipping_method_id" binding:"required"`
	PaymentMethod   string            `json:"payment_method" binding:"required"`
	CustomerNote    string            `json:"customer_note"`
	CouponCode      string            `json:"coupon_code"`
	GiftCardCode    string            `json:"gift_card_code"`
	Metadata        map[string]any    `json:"metadata"`
}

func (s *OrderService) CreateOrder(ctx context.Context, tenantID string, userID *string, req CreateOrderRequest) (*Order, error) {
	// 1. Get cart
	cart, err := s.cart.GetCart(ctx, tenantID, req.CartID)
	if err != nil {
		return nil, fmt.Errorf("cart not found: %w", err)
	}

	if len(cart.Items) == 0 {
		return nil, fmt.Errorf("cart is empty")
	}

	// 2. Validate inventory
	for _, item := range cart.Items {
		available, err := s.inventory.CheckAvailability(ctx, tenantID, item.ProductID, item.VariantID, item.Quantity)
		if err != nil || !available {
			return nil, fmt.Errorf("product %s is not available in requested quantity", item.ProductID)
		}
	}

	// 3. Calculate shipping
	shippingCost, err := s.shipping.CalculateRate(ctx, tenantID, req.ShippingMethodID, cart, req.ShippingAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate shipping: %w", err)
	}

	// 4. Apply discounts
	discountTotal := decimal.Zero
	if req.CouponCode != "" {
		discount, err := s.applyDiscount(ctx, tenantID, req.CouponCode, cart)
		if err != nil {
			return nil, fmt.Errorf("invalid coupon: %w", err)
		}
		discountTotal = discount
	}

	// 5. Apply gift card
	giftCardAmount := decimal.Zero
	if req.GiftCardCode != "" {
		amount, err := s.applyGiftCard(ctx, tenantID, req.GiftCardCode, cart.Total.Sub(discountTotal).Add(shippingCost))
		if err != nil {
			return nil, fmt.Errorf("invalid gift card: %w", err)
		}
		giftCardAmount = amount
	}

	// 6. Calculate totals
	subtotal := cart.Subtotal
	taxTotal := s.calculateTax(ctx, tenantID, cart, req.ShippingAddress)
	total := subtotal.Sub(discountTotal).Add(shippingCost).Add(taxTotal).Sub(giftCardAmount)

	// 7. Create order
	orderNumber := s.generateOrderNumber(tenantID)

	order := &Order{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		UserID:            userID,
		OrderNumber:       orderNumber,
		Status:            OrderStatusPending,
		PaymentStatus:     PaymentStatusPending,
		FulfillmentStatus: FulfillmentStatusUnfulfilled,
		Subtotal:          subtotal,
		DiscountTotal:     discountTotal,
		ShippingTotal:     shippingCost,
		TaxTotal:          taxTotal,
		GiftCardAmount:    giftCardAmount,
		Total:             total,
		Currency:          cart.Currency,
		Email:             req.Email,
		Phone:             req.Phone,
		CustomerNote:      req.CustomerNote,
		BillingAddress:    req.BillingAddress,
		ShippingAddress:   req.ShippingAddress,
		ShippingMethodID:  req.ShippingMethodID,
		PaymentMethod:     req.PaymentMethod,
		CouponCode:        req.CouponCode,
		GiftCardCode:      req.GiftCardCode,
		Source:            "web",
		Metadata:          req.Metadata,
	}

	// 8. Create order items
	for _, cartItem := range cart.Items {
		item := OrderItem{
			ID:        uuid.New().String(),
			TenantID:  tenantID,
			OrderID:   order.ID,
			ProductID: &cartItem.ProductID,
			VariantID: cartItem.VariantID,
			SKU:       cartItem.SKU,
			Name:      cartItem.Name,
			ImageURL:  cartItem.ImageURL,
			Quantity:  cartItem.Quantity,
			UnitPrice: cartItem.UnitPrice,
			Total:     cartItem.UnitPrice.Mul(decimal.NewFromInt(int64(cartItem.Quantity))),
		}
		order.Items = append(order.Items, item)
	}

	// 9. Start transaction
	tx := s.db.Begin()

	if err := tx.Create(order).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	// 10. Reserve inventory
	for _, item := range order.Items {
		if err := s.inventory.Reserve(ctx, tenantID, *item.ProductID, item.VariantID, item.Quantity, order.ID); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to reserve inventory: %w", err)
		}
	}

	// 11. Clear cart
	if err := s.cart.Clear(ctx, tenantID, req.CartID); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear cart: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// 12. Publish event
	s.eventBus.Publish(ctx, "order.created", OrderCreatedEvent{
		OrderID:     order.ID,
		TenantID:    tenantID,
		OrderNumber: order.OrderNumber,
		Total:       order.Total,
		Email:       order.Email,
	})

	// 13. Send confirmation email
	go s.notification.SendOrderConfirmation(ctx, order)

	return order, nil
}

func (s *OrderService) GetOrder(ctx context.Context, tenantID, orderID string) (*Order, error) {
	var order Order
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND id = ?", tenantID, orderID).
		Preload("Items").
		Preload("Transactions").
		Preload("Fulfillments.Items").
		First(&order).Error

	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (s *OrderService) GetOrderByNumber(ctx context.Context, tenantID, orderNumber string) (*Order, error) {
	var order Order
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND order_number = ?", tenantID, orderNumber).
		Preload("Items").
		First(&order).Error

	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (s *OrderService) ListOrders(ctx context.Context, tenantID string, params OrderListParams) ([]Order, int64, error) {
	var orders []Order
	var total int64

	query := s.db.WithContext(ctx).Model(&Order{}).Where("tenant_id = ?", tenantID)

	if params.UserID != "" {
		query = query.Where("user_id = ?", params.UserID)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if params.PaymentStatus != "" {
		query = query.Where("payment_status = ?", params.PaymentStatus)
	}
	if params.DateFrom != nil {
		query = query.Where("created_at >= ?", params.DateFrom)
	}
	if params.DateTo != nil {
		query = query.Where("created_at <= ?", params.DateTo)
	}
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("order_number ILIKE ? OR email ILIKE ?", search, search)
	}

	query.Count(&total)

	err := query.
		Order("created_at DESC").
		Offset((params.Page - 1) * params.Limit).
		Limit(params.Limit).
		Preload("Items").
		Find(&orders).Error

	return orders, total, err
}

func (s *OrderService) UpdateStatus(ctx context.Context, tenantID, orderID string, status OrderStatus) error {
	order, err := s.GetOrder(ctx, tenantID, orderID)
	if err != nil {
		return err
	}

	// Validate status transition
	if !s.isValidTransition(order.Status, status) {
		return fmt.Errorf("invalid status transition from %s to %s", order.Status, status)
	}

	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}

	switch status {
	case OrderStatusCancelled:
		now := time.Now()
		updates["cancelled_at"] = &now
		// Release inventory
		for _, item := range order.Items {
			s.inventory.Release(ctx, tenantID, *item.ProductID, item.VariantID, item.Quantity, orderID)
		}
	case OrderStatusCompleted:
		now := time.Now()
		updates["completed_at"] = &now
	}

	if err := s.db.Model(&Order{}).Where("tenant_id = ? AND id = ?", tenantID, orderID).Updates(updates).Error; err != nil {
		return err
	}

	// Publish event
	s.eventBus.Publish(ctx, "order.status_changed", OrderStatusChangedEvent{
		OrderID:   orderID,
		TenantID:  tenantID,
		OldStatus: string(order.Status),
		NewStatus: string(status),
	})

	return nil
}

func (s *OrderService) CancelOrder(ctx context.Context, tenantID, orderID, reason string) error {
	order, err := s.GetOrder(ctx, tenantID, orderID)
	if err != nil {
		return err
	}

	if order.Status == OrderStatusShipped || order.Status == OrderStatusDelivered || order.Status == OrderStatusCompleted {
		return fmt.Errorf("cannot cancel order in status %s", order.Status)
	}

	// If paid, initiate refund
	if order.PaymentStatus == PaymentStatusPaid {
		if err := s.payment.Refund(ctx, order); err != nil {
			return fmt.Errorf("failed to refund: %w", err)
		}
	}

	// Release inventory
	for _, item := range order.Items {
		s.inventory.Release(ctx, tenantID, *item.ProductID, item.VariantID, item.Quantity, orderID)
	}

	// Update status
	now := time.Now()
	updates := map[string]interface{}{
		"status":       OrderStatusCancelled,
		"cancelled_at": &now,
		"metadata": gorm.Expr("metadata || ?", map[string]any{
			"cancellation_reason": reason,
		}),
	}

	if err := s.db.Model(&Order{}).Where("tenant_id = ? AND id = ?", tenantID, orderID).Updates(updates).Error; err != nil {
		return err
	}

	// Send cancellation email
	go s.notification.SendOrderCancellation(ctx, order, reason)

	return nil
}

func (s *OrderService) isValidTransition(from, to OrderStatus) bool {
	transitions := map[OrderStatus][]OrderStatus{
		OrderStatusPending:    {OrderStatusConfirmed, OrderStatusCancelled},
		OrderStatusConfirmed:  {OrderStatusProcessing, OrderStatusCancelled},
		OrderStatusProcessing: {OrderStatusShipped, OrderStatusCancelled},
		OrderStatusShipped:    {OrderStatusDelivered},
		OrderStatusDelivered:  {OrderStatusCompleted, OrderStatusRefunded},
		OrderStatusCompleted:  {OrderStatusRefunded},
	}

	allowed, ok := transitions[from]
	if !ok {
		return false
	}

	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func (s *OrderService) generateOrderNumber(tenantID string) string {
	// Format: YYYYMMDD-XXXXX (e.g., 20241215-00001)
	date := time.Now().Format("20060102")

	var count int64
	s.db.Model(&Order{}).
		Where("tenant_id = ? AND DATE(created_at) = CURRENT_DATE", tenantID).
		Count(&count)

	return fmt.Sprintf("%s-%05d", date, count+1)
}
```

## API Endpoints

### REST API

```go
// internal/orders/handlers.go
package orders

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	service *OrderService
}

// CreateOrder POST /api/v1/orders
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var userIDPtr *string
	if userID != "" {
		userIDPtr = &userID
	}

	order, err := h.service.CreateOrder(c.Request.Context(), tenantID, userIDPtr, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}

// GetOrder GET /api/v1/orders/:id
func (h *OrderHandler) GetOrder(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	orderID := c.Param("id")

	order, err := h.service.GetOrder(c.Request.Context(), tenantID, orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
}

// ListOrders GET /api/v1/orders
func (h *OrderHandler) ListOrders(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var params OrderListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Non-admin users can only see their own orders
	if c.GetString("role") != "admin" {
		params.UserID = userID
	}

	orders, total, err := h.service.ListOrders(c.Request.Context(), tenantID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  orders,
		"total": total,
		"page":  params.Page,
		"limit": params.Limit,
	})
}

// CancelOrder POST /api/v1/orders/:id/cancel
func (h *OrderHandler) CancelOrder(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	orderID := c.Param("id")

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	if err := h.service.CancelOrder(c.Request.Context(), tenantID, orderID, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "order cancelled"})
}

// UpdateOrderStatus PUT /api/v1/orders/:id/status (admin only)
func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	orderID := c.Param("id")

	var req struct {
		Status OrderStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateStatus(c.Request.Context(), tenantID, orderID, req.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}

// TrackOrder GET /api/v1/orders/:number/track (public)
func (h *OrderHandler) TrackOrder(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	orderNumber := c.Param("number")
	email := c.Query("email")

	order, err := h.service.GetOrderByNumber(c.Request.Context(), tenantID, orderNumber)
	if err != nil || order.Email != email {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	// Return limited tracking info
	c.JSON(http.StatusOK, gin.H{
		"order_number":       order.OrderNumber,
		"status":             order.Status,
		"fulfillment_status": order.FulfillmentStatus,
		"tracking_number":    order.TrackingNumber,
		"shipped_at":         order.ShippedAt,
		"delivered_at":       order.DeliveredAt,
	})
}
```

### Routes

```go
// internal/orders/routes.go
func RegisterRoutes(r *gin.RouterGroup, h *OrderHandler, auth gin.HandlerFunc, adminAuth gin.HandlerFunc) {
	orders := r.Group("/orders")
	{
		// Public
		orders.GET("/:number/track", h.TrackOrder)

		// Authenticated
		orders.Use(auth)
		orders.POST("", h.CreateOrder)
		orders.GET("", h.ListOrders)
		orders.GET("/:id", h.GetOrder)
		orders.POST("/:id/cancel", h.CancelOrder)

		// Admin only
		admin := orders.Group("")
		admin.Use(adminAuth)
		admin.PUT("/:id/status", h.UpdateOrderStatus)
		admin.POST("/:id/fulfill", h.CreateFulfillment)
		admin.POST("/:id/refund", h.RefundOrder)
	}
}
```

## Events

```go
// Order events
type OrderCreatedEvent struct {
	OrderID     string          `json:"order_id"`
	TenantID    string          `json:"tenant_id"`
	OrderNumber string          `json:"order_number"`
	Total       decimal.Decimal `json:"total"`
	Email       string          `json:"email"`
}

type OrderPaidEvent struct {
	OrderID       string          `json:"order_id"`
	TenantID      string          `json:"tenant_id"`
	Amount        decimal.Decimal `json:"amount"`
	TransactionID string          `json:"transaction_id"`
}

type OrderShippedEvent struct {
	OrderID        string `json:"order_id"`
	TenantID       string `json:"tenant_id"`
	TrackingNumber string `json:"tracking_number"`
	Carrier        string `json:"carrier"`
}

type OrderDeliveredEvent struct {
	OrderID     string    `json:"order_id"`
	TenantID    string    `json:"tenant_id"`
	DeliveredAt time.Time `json:"delivered_at"`
}

type OrderCancelledEvent struct {
	OrderID  string `json:"order_id"`
	TenantID string `json:"tenant_id"`
	Reason   string `json:"reason"`
}
```

## Frontend Integration

```typescript
// src/lib/api/orders.ts
import { apiClient } from './client';

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  currency: string;
  items: OrderItem[];
  shipping_address: Address;
  billing_address: Address;
  tracking_number?: string;
  created_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export const ordersApi = {
  create: (data: CreateOrderRequest) =>
    apiClient.post<Order>('/orders', data),

  list: (params?: OrderListParams) =>
    apiClient.get<{ data: Order[]; total: number }>('/orders', { params }),

  get: (id: string) =>
    apiClient.get<Order>(`/orders/${id}`),

  cancel: (id: string, reason?: string) =>
    apiClient.post(`/orders/${id}/cancel`, { reason }),

  track: (orderNumber: string, email: string) =>
    apiClient.get(`/orders/${orderNumber}/track`, { params: { email } }),
};
```

## Див. також

- [Cart](./CART.md)
- [Payments](./PAYMENTS.md)
- [Delivery](./DELIVERY.md)
- [Returns](./RETURNS.md)
- [Inventory](./INVENTORY.md)
