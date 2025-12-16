# Cart Module

Модуль кошика покупок Shop Platform.

## Огляд

Модуль Cart забезпечує:
- Управління кошиком (додавання, видалення, оновлення)
- Підрахунок вартості
- Застосування знижок та промокодів
- Інтеграцію з доставкою
- Збереження кошика для гостей та авторизованих користувачів

## Архітектура

```
┌─────────────────────────────────────────────────────────────┐
│                     Cart Flow                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Add Item ──► Calculate ──► Apply Discounts ──► Checkout   │
│       │            │               │                         │
│       ▼            ▼               ▼                         │
│   ┌────────┐  ┌────────────┐  ┌──────────┐                  │
│   │ Redis  │  │ Product DB │  │ Discount │                  │
│   │ Cache  │  │            │  │ Service  │                  │
│   └────────┘  └────────────┘  └──────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Моделі даних

```go
// internal/cart/models.go
package cart

import (
	"time"

	"github.com/shopspring/decimal"
)

type Cart struct {
	ID              string          `gorm:"primaryKey" json:"id"`
	TenantID        string          `gorm:"index" json:"tenant_id"`
	UserID          *string         `gorm:"index" json:"user_id,omitempty"`
	SessionID       string          `gorm:"index" json:"session_id,omitempty"`
	Email           string          `json:"email,omitempty"`

	// Totals (calculated)
	Subtotal        decimal.Decimal `json:"subtotal"`
	DiscountTotal   decimal.Decimal `json:"discount_total"`
	ShippingCost    decimal.Decimal `json:"shipping_cost"`
	TaxTotal        decimal.Decimal `json:"tax_total"`
	Total           decimal.Decimal `json:"total"`
	Currency        string          `json:"currency"`

	// Items
	Items           []CartItem      `gorm:"foreignKey:CartID" json:"items"`
	ItemCount       int             `json:"item_count"`

	// Addresses
	BillingAddress  *Address        `gorm:"serializer:json" json:"billing_address,omitempty"`
	ShippingAddress *Address        `gorm:"serializer:json" json:"shipping_address,omitempty"`

	// Shipping
	ShippingMethodID string         `json:"shipping_method_id,omitempty"`
	ShippingMethodName string       `json:"shipping_method_name,omitempty"`

	// Discounts
	CouponCode      string          `json:"coupon_code,omitempty"`
	DiscountID      *string         `json:"discount_id,omitempty"`
	GiftCardCode    string          `json:"gift_card_code,omitempty"`
	GiftCardAmount  decimal.Decimal `json:"gift_card_amount"`

	// Metadata
	Metadata        map[string]any  `gorm:"serializer:json" json:"metadata,omitempty"`
	Note            string          `json:"note,omitempty"`

	// TTL
	ExpiresAt       *time.Time      `json:"expires_at,omitempty"`

	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type CartItem struct {
	ID              string          `gorm:"primaryKey" json:"id"`
	TenantID        string          `json:"tenant_id"`
	CartID          string          `gorm:"index" json:"cart_id"`
	ProductID       string          `json:"product_id"`
	VariantID       *string         `json:"variant_id,omitempty"`

	// Product snapshot
	SKU             string          `json:"sku"`
	Name            string          `json:"name"`
	VariantName     string          `json:"variant_name,omitempty"`
	ImageURL        string          `json:"image_url,omitempty"`

	// Quantity & Price
	Quantity        int             `json:"quantity"`
	UnitPrice       decimal.Decimal `json:"unit_price"`
	OriginalPrice   decimal.Decimal `json:"original_price"` // Before discounts
	LineTotal       decimal.Decimal `json:"line_total"`

	// Custom properties (e.g., engraving, gift wrap)
	Properties      map[string]any  `gorm:"serializer:json" json:"properties,omitempty"`

	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}
```

## Cart Service

```go
// internal/cart/service.go
package cart

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type CartService struct {
	db        *gorm.DB
	cache     CacheService
	products  ProductService
	discounts DiscountService
	shipping  ShippingService
	giftCards GiftCardService
	eventBus  EventBus
}

const (
	cartTTL       = 30 * 24 * time.Hour // 30 days
	guestCartTTL  = 7 * 24 * time.Hour  // 7 days
)

// GetOrCreateCart returns existing cart or creates new one
func (s *CartService) GetOrCreateCart(ctx context.Context, tenantID string, userID *string, sessionID string) (*Cart, error) {
	var cart Cart
	var err error

	// Try to find existing cart
	query := s.db.WithContext(ctx).Where("tenant_id = ?", tenantID)

	if userID != nil && *userID != "" {
		// For authenticated users
		err = query.Where("user_id = ?", *userID).
			Preload("Items").
			First(&cart).Error
	} else {
		// For guests
		err = query.Where("session_id = ?", sessionID).
			Preload("Items").
			First(&cart).Error
	}

	if err == nil {
		// Check expiration
		if cart.ExpiresAt != nil && cart.ExpiresAt.Before(time.Now()) {
			s.db.Delete(&cart)
		} else {
			return &cart, nil
		}
	}

	// Create new cart
	ttl := cartTTL
	if userID == nil {
		ttl = guestCartTTL
	}
	expiresAt := time.Now().Add(ttl)

	cart = Cart{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		UserID:    userID,
		SessionID: sessionID,
		Currency:  "UAH",
		ExpiresAt: &expiresAt,
	}

	if err := s.db.Create(&cart).Error; err != nil {
		return nil, err
	}

	return &cart, nil
}

// AddItem adds a product to cart
func (s *CartService) AddItem(ctx context.Context, tenantID, cartID, productID string, variantID *string, quantity int, properties map[string]any) (*Cart, error) {
	// Get product
	product, err := s.products.GetByID(ctx, tenantID, productID)
	if err != nil {
		return nil, fmt.Errorf("product not found")
	}

	// Validate quantity
	if quantity < 1 {
		quantity = 1
	}

	// Get variant if specified
	var variant *ProductVariant
	var price decimal.Decimal
	var sku, name, imageURL string

	if variantID != nil {
		for _, v := range product.Variants {
			if v.ID == *variantID {
				variant = &v
				break
			}
		}
		if variant == nil {
			return nil, fmt.Errorf("variant not found")
		}
		if variant.Price != nil {
			price = *variant.Price
		} else {
			price = product.Price
		}
		sku = variant.SKU
		name = product.Name
		if variant.Name != "" {
			name = fmt.Sprintf("%s - %s", product.Name, variant.Name)
		}
		if variant.ImageURL != "" {
			imageURL = variant.ImageURL
		}
	} else {
		price = product.Price
		sku = product.SKU
		name = product.Name
	}

	if imageURL == "" && len(product.Images) > 0 {
		imageURL = product.Images[0].URL
	}

	// Check inventory
	if product.TrackInventory {
		available := product.InventoryQuantity
		if variant != nil {
			available = variant.InventoryQuantity
		}
		if quantity > available && !product.AllowBackorder {
			return nil, fmt.Errorf("insufficient inventory")
		}
	}

	// Check if item already in cart
	var existingItem CartItem
	err = s.db.Where("cart_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))",
		cartID, productID, variantID, variantID).First(&existingItem).Error

	if err == nil {
		// Update existing item
		existingItem.Quantity += quantity
		existingItem.LineTotal = price.Mul(decimal.NewFromInt(int64(existingItem.Quantity)))
		existingItem.UpdatedAt = time.Now()
		if err := s.db.Save(&existingItem).Error; err != nil {
			return nil, err
		}
	} else {
		// Create new item
		item := CartItem{
			ID:            uuid.New().String(),
			TenantID:      tenantID,
			CartID:        cartID,
			ProductID:     productID,
			VariantID:     variantID,
			SKU:           sku,
			Name:          name,
			ImageURL:      imageURL,
			Quantity:      quantity,
			UnitPrice:     price,
			OriginalPrice: price,
			LineTotal:     price.Mul(decimal.NewFromInt(int64(quantity))),
			Properties:    properties,
		}
		if err := s.db.Create(&item).Error; err != nil {
			return nil, err
		}
	}

	// Recalculate cart
	return s.recalculate(ctx, tenantID, cartID)
}

// UpdateItemQuantity updates item quantity
func (s *CartService) UpdateItemQuantity(ctx context.Context, tenantID, cartID, itemID string, quantity int) (*Cart, error) {
	if quantity < 0 {
		return nil, fmt.Errorf("quantity cannot be negative")
	}

	if quantity == 0 {
		return s.RemoveItem(ctx, tenantID, cartID, itemID)
	}

	var item CartItem
	if err := s.db.Where("id = ? AND cart_id = ?", itemID, cartID).First(&item).Error; err != nil {
		return nil, fmt.Errorf("item not found")
	}

	// Check inventory
	product, _ := s.products.GetByID(ctx, tenantID, item.ProductID)
	if product != nil && product.TrackInventory {
		available := product.InventoryQuantity
		if item.VariantID != nil {
			for _, v := range product.Variants {
				if v.ID == *item.VariantID {
					available = v.InventoryQuantity
					break
				}
			}
		}
		if quantity > available && !product.AllowBackorder {
			return nil, fmt.Errorf("insufficient inventory, only %d available", available)
		}
	}

	item.Quantity = quantity
	item.LineTotal = item.UnitPrice.Mul(decimal.NewFromInt(int64(quantity)))
	item.UpdatedAt = time.Now()

	if err := s.db.Save(&item).Error; err != nil {
		return nil, err
	}

	return s.recalculate(ctx, tenantID, cartID)
}

// RemoveItem removes item from cart
func (s *CartService) RemoveItem(ctx context.Context, tenantID, cartID, itemID string) (*Cart, error) {
	if err := s.db.Where("id = ? AND cart_id = ?", itemID, cartID).Delete(&CartItem{}).Error; err != nil {
		return nil, err
	}

	return s.recalculate(ctx, tenantID, cartID)
}

// ApplyCoupon applies a coupon code
func (s *CartService) ApplyCoupon(ctx context.Context, tenantID, cartID, couponCode string) (*Cart, error) {
	cart, err := s.GetCart(ctx, tenantID, cartID)
	if err != nil {
		return nil, err
	}

	// Validate coupon
	discount, err := s.discounts.ValidateCoupon(ctx, tenantID, couponCode, cart)
	if err != nil {
		return nil, err
	}

	// Update cart
	cart.CouponCode = couponCode
	cart.DiscountID = &discount.ID

	if err := s.db.Save(cart).Error; err != nil {
		return nil, err
	}

	return s.recalculate(ctx, tenantID, cartID)
}

// RemoveCoupon removes applied coupon
func (s *CartService) RemoveCoupon(ctx context.Context, tenantID, cartID string) (*Cart, error) {
	if err := s.db.Model(&Cart{}).Where("id = ?", cartID).Updates(map[string]interface{}{
		"coupon_code": "",
		"discount_id": nil,
	}).Error; err != nil {
		return nil, err
	}

	return s.recalculate(ctx, tenantID, cartID)
}

// ApplyGiftCard applies a gift card
func (s *CartService) ApplyGiftCard(ctx context.Context, tenantID, cartID, giftCardCode string) (*Cart, error) {
	cart, err := s.GetCart(ctx, tenantID, cartID)
	if err != nil {
		return nil, err
	}

	// Validate gift card
	giftCard, err := s.giftCards.GetByCode(ctx, tenantID, giftCardCode)
	if err != nil {
		return nil, fmt.Errorf("invalid gift card")
	}

	if giftCard.Balance.LessThanOrEqual(decimal.Zero) {
		return nil, fmt.Errorf("gift card has no balance")
	}

	cart.GiftCardCode = giftCardCode

	if err := s.db.Save(cart).Error; err != nil {
		return nil, err
	}

	return s.recalculate(ctx, tenantID, cartID)
}

// SetShippingMethod sets shipping method
func (s *CartService) SetShippingMethod(ctx context.Context, tenantID, cartID, methodID string, address *Address) (*Cart, error) {
	cart, err := s.GetCart(ctx, tenantID, cartID)
	if err != nil {
		return nil, err
	}

	if address != nil {
		cart.ShippingAddress = address
	}

	// Get shipping rate
	rate, err := s.shipping.GetRate(ctx, tenantID, methodID, cart, cart.ShippingAddress)
	if err != nil {
		return nil, fmt.Errorf("shipping method not available")
	}

	cart.ShippingMethodID = methodID
	cart.ShippingMethodName = rate.Name
	cart.ShippingCost = rate.Price

	if err := s.db.Save(cart).Error; err != nil {
		return nil, err
	}

	return s.recalculate(ctx, tenantID, cartID)
}

// GetCart returns cart by ID
func (s *CartService) GetCart(ctx context.Context, tenantID, cartID string) (*Cart, error) {
	var cart Cart
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND id = ?", tenantID, cartID).
		Preload("Items").
		First(&cart).Error

	if err != nil {
		return nil, err
	}

	return &cart, nil
}

// Clear clears all items from cart
func (s *CartService) Clear(ctx context.Context, tenantID, cartID string) error {
	tx := s.db.Begin()

	if err := tx.Where("cart_id = ?", cartID).Delete(&CartItem{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(&Cart{}).Where("id = ?", cartID).Updates(map[string]interface{}{
		"subtotal":       decimal.Zero,
		"discount_total": decimal.Zero,
		"shipping_cost":  decimal.Zero,
		"tax_total":      decimal.Zero,
		"total":          decimal.Zero,
		"item_count":     0,
		"coupon_code":    "",
		"discount_id":    nil,
		"gift_card_code": "",
		"gift_card_amount": decimal.Zero,
	}).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// MergeGuestCart merges guest cart into user cart
func (s *CartService) MergeGuestCart(ctx context.Context, tenantID, userID, sessionID string) (*Cart, error) {
	// Get guest cart
	var guestCart Cart
	err := s.db.Where("tenant_id = ? AND session_id = ? AND user_id IS NULL", tenantID, sessionID).
		Preload("Items").
		First(&guestCart).Error

	if err != nil {
		return nil, nil // No guest cart to merge
	}

	// Get or create user cart
	userCart, err := s.GetOrCreateCart(ctx, tenantID, &userID, "")
	if err != nil {
		return nil, err
	}

	// Merge items
	for _, guestItem := range guestCart.Items {
		_, err := s.AddItem(ctx, tenantID, userCart.ID, guestItem.ProductID, guestItem.VariantID, guestItem.Quantity, guestItem.Properties)
		if err != nil {
			// Item might not be available anymore, skip
			continue
		}
	}

	// Delete guest cart
	s.db.Delete(&guestCart)

	return s.GetCart(ctx, tenantID, userCart.ID)
}

// recalculate recalculates all cart totals
func (s *CartService) recalculate(ctx context.Context, tenantID, cartID string) (*Cart, error) {
	cart, err := s.GetCart(ctx, tenantID, cartID)
	if err != nil {
		return nil, err
	}

	// Calculate subtotal
	subtotal := decimal.Zero
	itemCount := 0
	for _, item := range cart.Items {
		subtotal = subtotal.Add(item.LineTotal)
		itemCount += item.Quantity
	}
	cart.Subtotal = subtotal
	cart.ItemCount = itemCount

	// Apply discount
	discountTotal := decimal.Zero
	if cart.DiscountID != nil {
		discount, err := s.discounts.CalculateDiscount(ctx, tenantID, *cart.DiscountID, cart)
		if err == nil {
			discountTotal = discount
		}
	}
	cart.DiscountTotal = discountTotal

	// Apply gift card
	giftCardAmount := decimal.Zero
	if cart.GiftCardCode != "" {
		giftCard, err := s.giftCards.GetByCode(ctx, tenantID, cart.GiftCardCode)
		if err == nil {
			// Apply up to remaining balance or cart total
			remaining := cart.Subtotal.Sub(discountTotal).Add(cart.ShippingCost)
			if giftCard.Balance.LessThan(remaining) {
				giftCardAmount = giftCard.Balance
			} else {
				giftCardAmount = remaining
			}
		}
	}
	cart.GiftCardAmount = giftCardAmount

	// Calculate total
	cart.Total = cart.Subtotal.
		Sub(cart.DiscountTotal).
		Add(cart.ShippingCost).
		Add(cart.TaxTotal).
		Sub(cart.GiftCardAmount)

	if cart.Total.LessThan(decimal.Zero) {
		cart.Total = decimal.Zero
	}

	cart.UpdatedAt = time.Now()

	if err := s.db.Save(cart).Error; err != nil {
		return nil, err
	}

	// Publish event
	s.eventBus.Publish(ctx, "cart.updated", CartUpdatedEvent{
		CartID:    cart.ID,
		TenantID:  tenantID,
		ItemCount: cart.ItemCount,
		Total:     cart.Total,
	})

	return cart, nil
}
```

## API Endpoints

```go
// internal/cart/handlers.go
package cart

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type CartHandler struct {
	service *CartService
}

// GetCart GET /api/v1/cart
func (h *CartHandler) GetCart(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	sessionID := c.GetHeader("X-Session-ID")

	var userIDPtr *string
	if userID != "" {
		userIDPtr = &userID
	}

	cart, err := h.service.GetOrCreateCart(c.Request.Context(), tenantID, userIDPtr, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cart)
}

// AddItem POST /api/v1/cart/items
func (h *CartHandler) AddItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	sessionID := c.GetHeader("X-Session-ID")

	var req struct {
		ProductID  string         `json:"product_id" binding:"required"`
		VariantID  *string        `json:"variant_id"`
		Quantity   int            `json:"quantity"`
		Properties map[string]any `json:"properties"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var userIDPtr *string
	if userID != "" {
		userIDPtr = &userID
	}

	// Get or create cart
	cart, err := h.service.GetOrCreateCart(c.Request.Context(), tenantID, userIDPtr, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add item
	cart, err = h.service.AddItem(c.Request.Context(), tenantID, cart.ID, req.ProductID, req.VariantID, req.Quantity, req.Properties)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cart)
}

// UpdateItem PUT /api/v1/cart/items/:id
func (h *CartHandler) UpdateItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	itemID := c.Param("id")
	cartID := c.GetString("cart_id") // Set by middleware

	var req struct {
		Quantity int `json:"quantity" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cart, err := h.service.UpdateItemQuantity(c.Request.Context(), tenantID, cartID, itemID, req.Quantity)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cart)
}

// RemoveItem DELETE /api/v1/cart/items/:id
func (h *CartHandler) RemoveItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	itemID := c.Param("id")
	cartID := c.GetString("cart_id")

	cart, err := h.service.RemoveItem(c.Request.Context(), tenantID, cartID, itemID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cart)
}

// ApplyCoupon POST /api/v1/cart/coupon
func (h *CartHandler) ApplyCoupon(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cartID := c.GetString("cart_id")

	var req struct {
		Code string `json:"code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cart, err := h.service.ApplyCoupon(c.Request.Context(), tenantID, cartID, req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cart)
}

// RemoveCoupon DELETE /api/v1/cart/coupon
func (h *CartHandler) RemoveCoupon(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cartID := c.GetString("cart_id")

	cart, err := h.service.RemoveCoupon(c.Request.Context(), tenantID, cartID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cart)
}

// SetShipping PUT /api/v1/cart/shipping
func (h *CartHandler) SetShipping(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cartID := c.GetString("cart_id")

	var req struct {
		MethodID string   `json:"method_id" binding:"required"`
		Address  *Address `json:"address"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cart, err := h.service.SetShippingMethod(c.Request.Context(), tenantID, cartID, req.MethodID, req.Address)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cart)
}

// ClearCart DELETE /api/v1/cart
func (h *CartHandler) ClearCart(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cartID := c.GetString("cart_id")

	if err := h.service.Clear(c.Request.Context(), tenantID, cartID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "cart cleared"})
}
```

## Frontend Integration

```typescript
// src/hooks/useCart.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi } from '@/lib/api/cart';
import type { Cart, CartItem } from '@/types/cart';

interface CartStore {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;

  fetchCart: () => Promise<void>;
  addItem: (productId: string, variantId?: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  setShipping: (methodId: string, address?: Address) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      cart: null,
      isLoading: false,
      error: null,

      fetchCart: async () => {
        set({ isLoading: true, error: null });
        try {
          const cart = await cartApi.get();
          set({ cart, isLoading: false });
        } catch (error) {
          set({ error: 'Failed to load cart', isLoading: false });
        }
      },

      addItem: async (productId, variantId, quantity = 1) => {
        set({ isLoading: true, error: null });
        try {
          const cart = await cartApi.addItem({ productId, variantId, quantity });
          set({ cart, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      updateQuantity: async (itemId, quantity) => {
        set({ isLoading: true, error: null });
        try {
          const cart = await cartApi.updateItem(itemId, { quantity });
          set({ cart, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      removeItem: async (itemId) => {
        set({ isLoading: true, error: null });
        try {
          const cart = await cartApi.removeItem(itemId);
          set({ cart, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      applyCoupon: async (code) => {
        set({ isLoading: true, error: null });
        try {
          const cart = await cartApi.applyCoupon(code);
          set({ cart, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      removeCoupon: async () => {
        set({ isLoading: true, error: null });
        try {
          const cart = await cartApi.removeCoupon();
          set({ cart, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      setShipping: async (methodId, address) => {
        set({ isLoading: true, error: null });
        try {
          const cart = await cartApi.setShipping({ methodId, address });
          set({ cart, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      clearCart: async () => {
        set({ isLoading: true, error: null });
        try {
          await cartApi.clear();
          set({ cart: null, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ cart: state.cart }),
    }
  )
);
```

## Див. також

- [Orders](./ORDERS.md)
- [Products](./PRODUCTS.md)
- [Payments](./PAYMENTS.md)
- [Gift Cards](../features/GIFT_CARDS.md)
