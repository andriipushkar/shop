# Pricing Module

Модуль управління цінами Shop Platform.

## Огляд

Модуль Pricing забезпечує:
- Базові ціни та ціни порівняння
- Групові ціни (B2B)
- Оптові ціни (тіри)
- Акційні ціни
- Мультивалютність
- Динамічне ціноутворення

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     Price Resolution                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Request ──► Context ──► Price Rules ──► Final Price           │
│                 │              │                                 │
│                 ▼              ▼                                 │
│          ┌──────────┐   ┌───────────┐                           │
│          │ Customer │   │   Rules   │                           │
│          │ - Group  │   │ - Tier    │                           │
│          │ - B2B    │   │ - Promo   │                           │
│          │ - VIP    │   │ - Dynamic │                           │
│          └──────────┘   └───────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Моделі даних

```go
// internal/pricing/models.go
package pricing

import (
	"time"

	"github.com/shopspring/decimal"
)

// PriceList represents a price list (e.g., Retail, Wholesale, VIP)
type PriceList struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TenantID    string    `gorm:"index" json:"tenant_id"`
	Name        string    `json:"name"`
	Code        string    `gorm:"index" json:"code"` // retail, wholesale, vip
	Currency    string    `json:"currency"`
	IsDefault   bool      `json:"is_default"`
	Priority    int       `json:"priority"` // Higher priority wins
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProductPrice represents a price for a product in a specific price list
type ProductPrice struct {
	ID            string          `gorm:"primaryKey" json:"id"`
	TenantID      string          `gorm:"index" json:"tenant_id"`
	ProductID     string          `gorm:"index" json:"product_id"`
	VariantID     *string         `gorm:"index" json:"variant_id,omitempty"`
	PriceListID   string          `gorm:"index" json:"price_list_id"`

	Price         decimal.Decimal `json:"price"`
	CompareAtPrice *decimal.Decimal `json:"compare_at_price,omitempty"`
	CostPrice     *decimal.Decimal `json:"cost_price,omitempty"`
	Currency      string          `json:"currency"`

	// Validity
	StartDate     *time.Time      `json:"start_date,omitempty"`
	EndDate       *time.Time      `json:"end_date,omitempty"`

	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// TierPrice represents volume-based pricing
type TierPrice struct {
	ID          string          `gorm:"primaryKey" json:"id"`
	TenantID    string          `gorm:"index" json:"tenant_id"`
	ProductID   string          `gorm:"index" json:"product_id"`
	VariantID   *string         `json:"variant_id,omitempty"`
	PriceListID *string         `json:"price_list_id,omitempty"`

	MinQuantity int             `json:"min_quantity"`
	MaxQuantity *int            `json:"max_quantity,omitempty"`
	Price       decimal.Decimal `json:"price"`
	DiscountType string         `json:"discount_type"` // fixed, percentage
	DiscountValue decimal.Decimal `json:"discount_value"`

	CreatedAt   time.Time       `json:"created_at"`
}

// CustomerGroup represents a customer group with specific pricing
type CustomerGroup struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TenantID    string    `gorm:"index" json:"tenant_id"`
	Name        string    `json:"name"`
	Code        string    `gorm:"index" json:"code"`
	PriceListID *string   `json:"price_list_id,omitempty"`
	DiscountPercent *decimal.Decimal `json:"discount_percent,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PromotionalPrice represents time-limited promotional pricing
type PromotionalPrice struct {
	ID          string          `gorm:"primaryKey" json:"id"`
	TenantID    string          `gorm:"index" json:"tenant_id"`
	Name        string          `json:"name"`
	ProductID   *string         `json:"product_id,omitempty"` // nil for category-wide
	CategoryID  *string         `json:"category_id,omitempty"`
	VariantID   *string         `json:"variant_id,omitempty"`

	DiscountType string         `json:"discount_type"` // fixed, percentage
	DiscountValue decimal.Decimal `json:"discount_value"`
	MinPrice    *decimal.Decimal `json:"min_price,omitempty"` // Floor price

	StartDate   time.Time       `json:"start_date"`
	EndDate     time.Time       `json:"end_date"`
	IsActive    bool            `json:"is_active"`

	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// PriceContext contains all context for price calculation
type PriceContext struct {
	TenantID      string
	CustomerID    *string
	CustomerGroup *string
	PriceListID   *string
	Currency      string
	Quantity      int
	Date          time.Time
}

// ResolvedPrice is the final calculated price
type ResolvedPrice struct {
	Price          decimal.Decimal `json:"price"`
	CompareAtPrice *decimal.Decimal `json:"compare_at_price,omitempty"`
	Currency       string          `json:"currency"`
	PriceListID    string          `json:"price_list_id"`
	TierApplied    *TierPrice      `json:"tier_applied,omitempty"`
	PromoApplied   *PromotionalPrice `json:"promo_applied,omitempty"`
	DiscountAmount decimal.Decimal `json:"discount_amount"`
	FinalPrice     decimal.Decimal `json:"final_price"`
}
```

## Pricing Service

```go
// internal/pricing/service.go
package pricing

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PricingService struct {
	db    *gorm.DB
	cache CacheService
}

// ResolvePrice calculates the final price for a product based on context
func (s *PricingService) ResolvePrice(ctx context.Context, productID string, variantID *string, pctx PriceContext) (*ResolvedPrice, error) {
	result := &ResolvedPrice{
		Currency: pctx.Currency,
	}

	// 1. Get base price from appropriate price list
	basePrice, err := s.getBasePrice(ctx, productID, variantID, pctx)
	if err != nil {
		return nil, err
	}

	result.Price = basePrice.Price
	result.CompareAtPrice = basePrice.CompareAtPrice
	result.PriceListID = basePrice.PriceListID

	// 2. Check tier pricing
	if pctx.Quantity > 1 {
		tierPrice, err := s.getTierPrice(ctx, productID, variantID, pctx)
		if err == nil && tierPrice != nil {
			result.TierApplied = tierPrice
			result.Price = tierPrice.Price
		}
	}

	// 3. Check promotional pricing
	promo, err := s.getPromotionalPrice(ctx, productID, variantID, pctx)
	if err == nil && promo != nil {
		promoPrice := s.calculatePromoPrice(result.Price, promo)
		if promoPrice.LessThan(result.Price) {
			result.PromoApplied = promo
			result.CompareAtPrice = &result.Price
			result.Price = promoPrice
		}
	}

	// 4. Apply customer group discount
	if pctx.CustomerGroup != nil {
		groupDiscount, err := s.getCustomerGroupDiscount(ctx, pctx.TenantID, *pctx.CustomerGroup)
		if err == nil && groupDiscount != nil && groupDiscount.GreaterThan(decimal.Zero) {
			discount := result.Price.Mul(*groupDiscount).Div(decimal.NewFromInt(100))
			result.Price = result.Price.Sub(discount)
			result.DiscountAmount = result.DiscountAmount.Add(discount)
		}
	}

	result.FinalPrice = result.Price

	return result, nil
}

func (s *PricingService) getBasePrice(ctx context.Context, productID string, variantID *string, pctx PriceContext) (*ProductPrice, error) {
	var price ProductPrice

	query := s.db.WithContext(ctx).
		Where("tenant_id = ? AND product_id = ?", pctx.TenantID, productID)

	if variantID != nil {
		query = query.Where("variant_id = ?", *variantID)
	} else {
		query = query.Where("variant_id IS NULL")
	}

	// Check validity dates
	now := pctx.Date
	query = query.Where("(start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)", now, now)

	// Determine price list
	if pctx.PriceListID != nil {
		// Try specific price list first
		err := query.Where("price_list_id = ?", *pctx.PriceListID).First(&price).Error
		if err == nil {
			return &price, nil
		}
	}

	// Fall back to default price list
	var defaultPriceList PriceList
	s.db.Where("tenant_id = ? AND is_default = ?", pctx.TenantID, true).First(&defaultPriceList)

	err := query.Where("price_list_id = ?", defaultPriceList.ID).First(&price).Error
	if err != nil {
		// Last resort: get from product table
		var product struct {
			Price          decimal.Decimal
			CompareAtPrice *decimal.Decimal
		}
		if err := s.db.Table("products").
			Where("tenant_id = ? AND id = ?", pctx.TenantID, productID).
			Select("price, compare_at_price").
			First(&product).Error; err != nil {
			return nil, err
		}
		return &ProductPrice{
			Price:          product.Price,
			CompareAtPrice: product.CompareAtPrice,
			PriceListID:    defaultPriceList.ID,
		}, nil
	}

	return &price, nil
}

func (s *PricingService) getTierPrice(ctx context.Context, productID string, variantID *string, pctx PriceContext) (*TierPrice, error) {
	var tier TierPrice

	query := s.db.WithContext(ctx).
		Where("tenant_id = ? AND product_id = ? AND min_quantity <= ?",
			pctx.TenantID, productID, pctx.Quantity)

	if variantID != nil {
		query = query.Where("variant_id = ?", *variantID)
	}

	if pctx.PriceListID != nil {
		query = query.Where("(price_list_id IS NULL OR price_list_id = ?)", *pctx.PriceListID)
	}

	err := query.
		Where("max_quantity IS NULL OR max_quantity >= ?", pctx.Quantity).
		Order("min_quantity DESC").
		First(&tier).Error

	if err != nil {
		return nil, err
	}

	return &tier, nil
}

func (s *PricingService) getPromotionalPrice(ctx context.Context, productID string, variantID *string, pctx PriceContext) (*PromotionalPrice, error) {
	var promo PromotionalPrice

	now := pctx.Date

	query := s.db.WithContext(ctx).
		Where("tenant_id = ? AND is_active = ?", pctx.TenantID, true).
		Where("start_date <= ? AND end_date >= ?", now, now).
		Where("(product_id = ? OR product_id IS NULL)", productID)

	if variantID != nil {
		query = query.Where("(variant_id IS NULL OR variant_id = ?)", *variantID)
	}

	err := query.Order("product_id DESC NULLS LAST").First(&promo).Error
	if err != nil {
		return nil, err
	}

	return &promo, nil
}

func (s *PricingService) calculatePromoPrice(basePrice decimal.Decimal, promo *PromotionalPrice) decimal.Decimal {
	var discountedPrice decimal.Decimal

	if promo.DiscountType == "percentage" {
		discount := basePrice.Mul(promo.DiscountValue).Div(decimal.NewFromInt(100))
		discountedPrice = basePrice.Sub(discount)
	} else {
		discountedPrice = basePrice.Sub(promo.DiscountValue)
	}

	// Apply floor price
	if promo.MinPrice != nil && discountedPrice.LessThan(*promo.MinPrice) {
		discountedPrice = *promo.MinPrice
	}

	if discountedPrice.LessThan(decimal.Zero) {
		discountedPrice = decimal.Zero
	}

	return discountedPrice
}

func (s *PricingService) getCustomerGroupDiscount(ctx context.Context, tenantID, groupCode string) (*decimal.Decimal, error) {
	var group CustomerGroup
	err := s.db.Where("tenant_id = ? AND code = ? AND is_active = ?", tenantID, groupCode, true).First(&group).Error
	if err != nil {
		return nil, err
	}
	return group.DiscountPercent, nil
}

// BulkResolvePrice resolves prices for multiple products
func (s *PricingService) BulkResolvePrice(ctx context.Context, productIDs []string, pctx PriceContext) (map[string]*ResolvedPrice, error) {
	result := make(map[string]*ResolvedPrice)

	for _, productID := range productIDs {
		price, err := s.ResolvePrice(ctx, productID, nil, pctx)
		if err != nil {
			continue
		}
		result[productID] = price
	}

	return result, nil
}

// CreatePriceList creates a new price list
func (s *PricingService) CreatePriceList(ctx context.Context, tenantID string, req CreatePriceListRequest) (*PriceList, error) {
	priceList := &PriceList{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Code:      req.Code,
		Currency:  req.Currency,
		IsDefault: req.IsDefault,
		Priority:  req.Priority,
		IsActive:  true,
	}

	// If this is default, unset other defaults
	if req.IsDefault {
		s.db.Model(&PriceList{}).Where("tenant_id = ?", tenantID).Update("is_default", false)
	}

	if err := s.db.Create(priceList).Error; err != nil {
		return nil, err
	}

	return priceList, nil
}

// SetProductPrice sets price for a product in a price list
func (s *PricingService) SetProductPrice(ctx context.Context, tenantID string, req SetProductPriceRequest) (*ProductPrice, error) {
	var existing ProductPrice
	err := s.db.Where("tenant_id = ? AND product_id = ? AND price_list_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))",
		tenantID, req.ProductID, req.PriceListID, req.VariantID, req.VariantID).First(&existing).Error

	if err == nil {
		// Update existing
		existing.Price = req.Price
		existing.CompareAtPrice = req.CompareAtPrice
		existing.CostPrice = req.CostPrice
		existing.StartDate = req.StartDate
		existing.EndDate = req.EndDate
		existing.UpdatedAt = time.Now()

		if err := s.db.Save(&existing).Error; err != nil {
			return nil, err
		}
		return &existing, nil
	}

	// Create new
	price := &ProductPrice{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		ProductID:      req.ProductID,
		VariantID:      req.VariantID,
		PriceListID:    req.PriceListID,
		Price:          req.Price,
		CompareAtPrice: req.CompareAtPrice,
		CostPrice:      req.CostPrice,
		Currency:       req.Currency,
		StartDate:      req.StartDate,
		EndDate:        req.EndDate,
	}

	if err := s.db.Create(price).Error; err != nil {
		return nil, err
	}

	return price, nil
}

// CreateTierPrice creates tier pricing
func (s *PricingService) CreateTierPrice(ctx context.Context, tenantID string, req CreateTierPriceRequest) (*TierPrice, error) {
	tier := &TierPrice{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ProductID:     req.ProductID,
		VariantID:     req.VariantID,
		PriceListID:   req.PriceListID,
		MinQuantity:   req.MinQuantity,
		MaxQuantity:   req.MaxQuantity,
		Price:         req.Price,
		DiscountType:  req.DiscountType,
		DiscountValue: req.DiscountValue,
	}

	if err := s.db.Create(tier).Error; err != nil {
		return nil, err
	}

	return tier, nil
}
```

## API Endpoints

```go
// Price Lists
// GET /api/v1/price-lists - List price lists
// POST /api/v1/price-lists - Create price list (admin)
// PUT /api/v1/price-lists/:id - Update price list (admin)

// Product Prices
// GET /api/v1/products/:id/prices - Get all prices for product
// POST /api/v1/products/:id/prices - Set product price (admin)
// DELETE /api/v1/products/:id/prices/:priceId - Delete price (admin)

// Tier Pricing
// GET /api/v1/products/:id/tiers - Get tier prices
// POST /api/v1/products/:id/tiers - Create tier price (admin)

// Promotions
// GET /api/v1/promotions - List promotional prices
// POST /api/v1/promotions - Create promotion (admin)

// Price Resolution (internal/storefront)
// GET /api/v1/products/:id/resolved-price - Get resolved price for context
```

## Frontend Integration

```typescript
// src/lib/pricing.ts
import { apiClient } from './api/client';

interface PriceContext {
  customerId?: string;
  customerGroup?: string;
  priceListId?: string;
  currency?: string;
  quantity?: number;
}

export async function getResolvedPrice(
  productId: string,
  variantId?: string,
  context?: PriceContext
): Promise<ResolvedPrice> {
  const params = new URLSearchParams();
  if (variantId) params.set('variant_id', variantId);
  if (context?.quantity) params.set('quantity', String(context.quantity));
  if (context?.customerGroup) params.set('customer_group', context.customerGroup);

  const response = await apiClient.get<ResolvedPrice>(
    `/products/${productId}/resolved-price?${params.toString()}`
  );
  return response.data;
}

// Price display component
export function formatPrice(price: number, currency = 'UAH'): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
  }).format(price);
}

// Calculate savings
export function calculateSavings(
  price: number,
  compareAtPrice?: number
): { amount: number; percent: number } | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;

  const amount = compareAtPrice - price;
  const percent = Math.round((amount / compareAtPrice) * 100);

  return { amount, percent };
}
```

## Див. також

- [Products](./PRODUCTS.md)
- [B2B](../features/B2B.md)
- [Discounts](./DISCOUNTS.md)
