# B2B E-commerce Features

Функціонал для B2B (business-to-business) продажів з підтримкою корпоративних клієнтів, оптових цін та процесів затвердження.

## Огляд функціоналу

```
┌─────────────────────────────────────────────────────────────────┐
│                      B2B E-commerce                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Company    │  │   Tiered     │  │   Approval   │          │
│  │   Accounts   │  │   Pricing    │  │   Workflows  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Quote     │  │   Purchase   │  │   Credit     │          │
│  │   Requests   │  │   Orders     │  │   Management │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Bulk       │  │   Contract   │  │   Analytics  │          │
│  │   Ordering   │  │   Pricing    │  │   & Reports  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Моделі даних

### Company Account

```go
// internal/b2b/models.go
package b2b

import (
    "time"
    "github.com/shopspring/decimal"
)

type CompanyStatus string

const (
    CompanyStatusPending  CompanyStatus = "pending"
    CompanyStatusActive   CompanyStatus = "active"
    CompanyStatusSuspended CompanyStatus = "suspended"
    CompanyStatusRejected CompanyStatus = "rejected"
)

type Company struct {
    ID              string         `json:"id" gorm:"primaryKey"`
    TenantID        string         `json:"tenant_id" gorm:"index"`

    // Basic Info
    Name            string         `json:"name"`
    LegalName       string         `json:"legal_name"`
    TaxID           string         `json:"tax_id"` // ЄДРПОУ
    VATNumber       string         `json:"vat_number"` // ІПН
    RegistrationNumber string      `json:"registration_number"`

    // Contact
    Email           string         `json:"email"`
    Phone           string         `json:"phone"`
    Website         string         `json:"website"`

    // Addresses
    BillingAddress  Address        `json:"billing_address" gorm:"serializer:json"`
    ShippingAddresses []Address    `json:"shipping_addresses" gorm:"serializer:json"`

    // Status
    Status          CompanyStatus  `json:"status"`
    ApprovedAt      *time.Time     `json:"approved_at"`
    ApprovedBy      string         `json:"approved_by"`

    // Pricing
    PriceGroupID    *string        `json:"price_group_id"`
    PriceGroup      *PriceGroup    `json:"price_group" gorm:"foreignKey:PriceGroupID"`
    DiscountPercent decimal.Decimal `json:"discount_percent"`

    // Credit
    CreditLimit     decimal.Decimal `json:"credit_limit"`
    CreditUsed      decimal.Decimal `json:"credit_used"`
    PaymentTerms    int            `json:"payment_terms"` // Days

    // Settings
    RequireApproval bool           `json:"require_approval"` // Order approval
    ApprovalLimit   decimal.Decimal `json:"approval_limit"` // Auto-approve under this amount

    // Metadata
    Industry        string         `json:"industry"`
    EmployeeCount   string         `json:"employee_count"`
    AnnualRevenue   string         `json:"annual_revenue"`
    Notes           string         `json:"notes"`

    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
}

type CompanyUser struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    CompanyID   string    `json:"company_id" gorm:"index"`
    UserID      string    `json:"user_id" gorm:"index"`

    // Role within company
    Role        CompanyRole `json:"role"`
    JobTitle    string      `json:"job_title"`
    Department  string      `json:"department"`

    // Permissions
    CanOrder    bool        `json:"can_order"`
    CanApprove  bool        `json:"can_approve"`
    CanViewPrices bool      `json:"can_view_prices"`
    SpendingLimit decimal.Decimal `json:"spending_limit"`

    // Status
    IsActive    bool        `json:"is_active"`
    InvitedAt   *time.Time  `json:"invited_at"`
    AcceptedAt  *time.Time  `json:"accepted_at"`

    CreatedAt   time.Time   `json:"created_at"`
    UpdatedAt   time.Time   `json:"updated_at"`
}

type CompanyRole string

const (
    CompanyRoleAdmin   CompanyRole = "admin"
    CompanyRoleBuyer   CompanyRole = "buyer"
    CompanyRoleApprover CompanyRole = "approver"
    CompanyRoleViewer  CompanyRole = "viewer"
)

type Address struct {
    Name       string `json:"name"`
    Company    string `json:"company"`
    Address1   string `json:"address1"`
    Address2   string `json:"address2"`
    City       string `json:"city"`
    State      string `json:"state"`
    PostalCode string `json:"postal_code"`
    Country    string `json:"country"`
    Phone      string `json:"phone"`
    IsDefault  bool   `json:"is_default"`
}
```

### Tiered Pricing

```go
type PriceGroup struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    TenantID    string    `json:"tenant_id" gorm:"index"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Priority    int       `json:"priority"` // Higher = more important
    IsActive    bool      `json:"is_active"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type ProductPrice struct {
    ID           string          `json:"id" gorm:"primaryKey"`
    TenantID     string          `json:"tenant_id" gorm:"index"`
    ProductID    string          `json:"product_id" gorm:"index"`
    VariantID    *string         `json:"variant_id" gorm:"index"`
    PriceGroupID string          `json:"price_group_id" gorm:"index"`

    // Pricing
    Price        decimal.Decimal `json:"price"`
    MinQuantity  int             `json:"min_quantity"` // For quantity breaks
    MaxQuantity  *int            `json:"max_quantity"`

    // Validity
    ValidFrom    *time.Time      `json:"valid_from"`
    ValidUntil   *time.Time      `json:"valid_until"`

    CreatedAt    time.Time       `json:"created_at"`
    UpdatedAt    time.Time       `json:"updated_at"`
}

// Quantity-based pricing tiers
type QuantityBreak struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    TenantID    string          `json:"tenant_id" gorm:"index"`
    ProductID   string          `json:"product_id" gorm:"index"`
    VariantID   *string         `json:"variant_id" gorm:"index"`

    MinQuantity int             `json:"min_quantity"`
    MaxQuantity *int            `json:"max_quantity"`

    // Discount
    DiscountType DiscountType   `json:"discount_type"`
    DiscountValue decimal.Decimal `json:"discount_value"`

    // Or fixed price
    FixedPrice  *decimal.Decimal `json:"fixed_price"`

    IsActive    bool            `json:"is_active"`
    CreatedAt   time.Time       `json:"created_at"`
}

type DiscountType string

const (
    DiscountTypePercent DiscountType = "percent"
    DiscountTypeFixed   DiscountType = "fixed"
)
```

### Quote Request

```go
type QuoteStatus string

const (
    QuoteStatusDraft     QuoteStatus = "draft"
    QuoteStatusSubmitted QuoteStatus = "submitted"
    QuoteStatusReviewing QuoteStatus = "reviewing"
    QuoteStatusQuoted    QuoteStatus = "quoted"
    QuoteStatusAccepted  QuoteStatus = "accepted"
    QuoteStatusRejected  QuoteStatus = "rejected"
    QuoteStatusExpired   QuoteStatus = "expired"
)

type QuoteRequest struct {
    ID           string          `json:"id" gorm:"primaryKey"`
    TenantID     string          `json:"tenant_id" gorm:"index"`
    Number       string          `json:"number" gorm:"uniqueIndex"`

    // Company
    CompanyID    string          `json:"company_id" gorm:"index"`
    Company      *Company        `json:"company" gorm:"foreignKey:CompanyID"`
    RequestedBy  string          `json:"requested_by"`

    // Items
    Items        []QuoteItem     `json:"items" gorm:"foreignKey:QuoteID"`

    // Status
    Status       QuoteStatus     `json:"status"`

    // Pricing (filled when quoted)
    Subtotal     decimal.Decimal `json:"subtotal"`
    Discount     decimal.Decimal `json:"discount"`
    Tax          decimal.Decimal `json:"tax"`
    Total        decimal.Decimal `json:"total"`

    // Notes
    CustomerNote string          `json:"customer_note"`
    InternalNote string          `json:"internal_note"`
    QuoteNote    string          `json:"quote_note"` // Note to customer with quote

    // Validity
    ExpiresAt    *time.Time      `json:"expires_at"`

    // Conversion
    OrderID      *string         `json:"order_id"`
    ConvertedAt  *time.Time      `json:"converted_at"`

    CreatedAt    time.Time       `json:"created_at"`
    UpdatedAt    time.Time       `json:"updated_at"`
}

type QuoteItem struct {
    ID           string          `json:"id" gorm:"primaryKey"`
    QuoteID      string          `json:"quote_id" gorm:"index"`
    ProductID    string          `json:"product_id"`
    VariantID    *string         `json:"variant_id"`

    // Request
    RequestedQty int             `json:"requested_qty"`
    RequestedNote string         `json:"requested_note"`

    // Quote response
    QuotedQty    *int            `json:"quoted_qty"`
    QuotedPrice  decimal.Decimal `json:"quoted_price"`
    LineTotal    decimal.Decimal `json:"line_total"`

    // Product snapshot
    ProductName  string          `json:"product_name"`
    ProductSKU   string          `json:"product_sku"`
}
```

### Purchase Order

```go
type PurchaseOrderStatus string

const (
    POStatusDraft      PurchaseOrderStatus = "draft"
    POStatusPending    PurchaseOrderStatus = "pending_approval"
    POStatusApproved   PurchaseOrderStatus = "approved"
    POStatusRejected   PurchaseOrderStatus = "rejected"
    POStatusSubmitted  PurchaseOrderStatus = "submitted"
    POStatusProcessing PurchaseOrderStatus = "processing"
    POStatusShipped    PurchaseOrderStatus = "shipped"
    POStatusDelivered  PurchaseOrderStatus = "delivered"
    POStatusCancelled  PurchaseOrderStatus = "cancelled"
)

type PurchaseOrder struct {
    ID              string               `json:"id" gorm:"primaryKey"`
    TenantID        string               `json:"tenant_id" gorm:"index"`
    Number          string               `json:"number" gorm:"uniqueIndex"`

    // Company
    CompanyID       string               `json:"company_id" gorm:"index"`
    Company         *Company             `json:"company" gorm:"foreignKey:CompanyID"`

    // Users
    CreatedBy       string               `json:"created_by"`
    ApprovedBy      *string              `json:"approved_by"`

    // Reference
    CustomerPONumber string              `json:"customer_po_number"` // Customer's internal PO
    QuoteID         *string              `json:"quote_id"`

    // Status
    Status          PurchaseOrderStatus  `json:"status"`

    // Items
    Items           []PurchaseOrderItem  `json:"items" gorm:"foreignKey:PurchaseOrderID"`

    // Addresses
    ShippingAddress Address              `json:"shipping_address" gorm:"serializer:json"`
    BillingAddress  Address              `json:"billing_address" gorm:"serializer:json"`

    // Shipping
    ShippingMethodID string              `json:"shipping_method_id"`
    ShippingCost    decimal.Decimal      `json:"shipping_cost"`

    // Pricing
    Subtotal        decimal.Decimal      `json:"subtotal"`
    Discount        decimal.Decimal      `json:"discount"`
    Tax             decimal.Decimal      `json:"tax"`
    Total           decimal.Decimal      `json:"total"`

    // Payment
    PaymentMethod   string               `json:"payment_method"` // credit, invoice, etc.
    PaymentTerms    string               `json:"payment_terms"`  // Net 30, etc.
    PaymentDueDate  *time.Time           `json:"payment_due_date"`
    PaidAt          *time.Time           `json:"paid_at"`

    // Notes
    Notes           string               `json:"notes"`
    InternalNotes   string               `json:"internal_notes"`

    // Approval
    ApprovalHistory []ApprovalRecord     `json:"approval_history" gorm:"serializer:json"`

    // Dates
    RequestedDeliveryDate *time.Time     `json:"requested_delivery_date"`
    EstimatedDeliveryDate *time.Time     `json:"estimated_delivery_date"`
    ShippedAt       *time.Time           `json:"shipped_at"`
    DeliveredAt     *time.Time           `json:"delivered_at"`

    CreatedAt       time.Time            `json:"created_at"`
    UpdatedAt       time.Time            `json:"updated_at"`
}

type PurchaseOrderItem struct {
    ID              string          `json:"id" gorm:"primaryKey"`
    PurchaseOrderID string          `json:"purchase_order_id" gorm:"index"`
    ProductID       string          `json:"product_id"`
    VariantID       *string         `json:"variant_id"`

    Quantity        int             `json:"quantity"`
    UnitPrice       decimal.Decimal `json:"unit_price"`
    Discount        decimal.Decimal `json:"discount"`
    Tax             decimal.Decimal `json:"tax"`
    LineTotal       decimal.Decimal `json:"line_total"`

    // Snapshot
    ProductName     string          `json:"product_name"`
    ProductSKU      string          `json:"product_sku"`

    // Fulfillment
    QtyShipped      int             `json:"qty_shipped"`
    QtyReceived     int             `json:"qty_received"`
}

type ApprovalRecord struct {
    UserID    string    `json:"user_id"`
    UserName  string    `json:"user_name"`
    Action    string    `json:"action"` // approved, rejected
    Comment   string    `json:"comment"`
    Timestamp time.Time `json:"timestamp"`
}
```

## Services

### Company Service

```go
// internal/b2b/company_service.go
package b2b

import (
    "context"
    "fmt"
    "time"
)

type CompanyService struct {
    repo   CompanyRepository
    events EventPublisher
}

func NewCompanyService(repo CompanyRepository, events EventPublisher) *CompanyService {
    return &CompanyService{
        repo:   repo,
        events: events,
    }
}

type RegisterCompanyRequest struct {
    Name            string
    LegalName       string
    TaxID           string
    VATNumber       string
    Email           string
    Phone           string
    BillingAddress  Address
    Industry        string
    EmployeeCount   string
    RequestedByUser string
}

// Register registers a new B2B company
func (s *CompanyService) Register(ctx context.Context, req *RegisterCompanyRequest) (*Company, error) {
    // Validate tax ID uniqueness
    existing, _ := s.repo.GetByTaxID(ctx, req.TaxID)
    if existing != nil {
        return nil, fmt.Errorf("company with this tax ID already registered")
    }

    company := &Company{
        ID:             generateID("company"),
        TenantID:       tenant.GetTenantID(ctx),
        Name:           req.Name,
        LegalName:      req.LegalName,
        TaxID:          req.TaxID,
        VATNumber:      req.VATNumber,
        Email:          req.Email,
        Phone:          req.Phone,
        BillingAddress: req.BillingAddress,
        ShippingAddresses: []Address{req.BillingAddress},
        Status:         CompanyStatusPending,
        Industry:       req.Industry,
        EmployeeCount:  req.EmployeeCount,
        PaymentTerms:   30, // Default Net 30
        RequireApproval: true,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    if err := s.repo.Create(ctx, company); err != nil {
        return nil, err
    }

    // Create admin user link
    if req.RequestedByUser != "" {
        s.repo.AddUser(ctx, &CompanyUser{
            ID:          generateID("cu"),
            CompanyID:   company.ID,
            UserID:      req.RequestedByUser,
            Role:        CompanyRoleAdmin,
            CanOrder:    true,
            CanApprove:  true,
            CanViewPrices: true,
            IsActive:    true,
            CreatedAt:   time.Now(),
        })
    }

    // Publish event
    s.events.Publish(ctx, "company.registered", map[string]any{
        "company_id": company.ID,
        "name":       company.Name,
    })

    return company, nil
}

// Approve approves a company registration
func (s *CompanyService) Approve(ctx context.Context, companyID string, priceGroupID string, creditLimit decimal.Decimal) (*Company, error) {
    company, err := s.repo.GetByID(ctx, companyID)
    if err != nil {
        return nil, err
    }

    if company.Status != CompanyStatusPending {
        return nil, fmt.Errorf("company is not pending approval")
    }

    now := time.Now()
    userID := auth.GetUserID(ctx)

    company.Status = CompanyStatusActive
    company.ApprovedAt = &now
    company.ApprovedBy = userID
    company.PriceGroupID = &priceGroupID
    company.CreditLimit = creditLimit
    company.UpdatedAt = now

    if err := s.repo.Update(ctx, company); err != nil {
        return nil, err
    }

    s.events.Publish(ctx, "company.approved", map[string]any{
        "company_id": company.ID,
    })

    return company, nil
}

// GetUserCompany returns the company for a user
func (s *CompanyService) GetUserCompany(ctx context.Context, userID string) (*Company, *CompanyUser, error) {
    companyUser, err := s.repo.GetCompanyUser(ctx, userID)
    if err != nil {
        return nil, nil, err
    }

    company, err := s.repo.GetByID(ctx, companyUser.CompanyID)
    if err != nil {
        return nil, nil, err
    }

    return company, companyUser, nil
}

// CheckCredit checks if company has available credit
func (s *CompanyService) CheckCredit(ctx context.Context, companyID string, amount decimal.Decimal) (bool, error) {
    company, err := s.repo.GetByID(ctx, companyID)
    if err != nil {
        return false, err
    }

    availableCredit := company.CreditLimit.Sub(company.CreditUsed)
    return amount.LessThanOrEqual(availableCredit), nil
}

// UseCredit uses company credit
func (s *CompanyService) UseCredit(ctx context.Context, companyID string, amount decimal.Decimal, orderID string) error {
    company, err := s.repo.GetByID(ctx, companyID)
    if err != nil {
        return err
    }

    availableCredit := company.CreditLimit.Sub(company.CreditUsed)
    if amount.GreaterThan(availableCredit) {
        return fmt.Errorf("insufficient credit")
    }

    company.CreditUsed = company.CreditUsed.Add(amount)
    company.UpdatedAt = time.Now()

    return s.repo.Update(ctx, company)
}
```

### Pricing Service

```go
// internal/b2b/pricing_service.go
package b2b

import (
    "context"
    "time"
)

type PricingService struct {
    priceRepo ProductPriceRepository
    breakRepo QuantityBreakRepository
    companyService *CompanyService
}

func NewPricingService(
    priceRepo ProductPriceRepository,
    breakRepo QuantityBreakRepository,
    companyService *CompanyService,
) *PricingService {
    return &PricingService{
        priceRepo:      priceRepo,
        breakRepo:      breakRepo,
        companyService: companyService,
    }
}

type PriceRequest struct {
    ProductID  string
    VariantID  *string
    Quantity   int
    CompanyID  string
}

type PriceResult struct {
    UnitPrice       decimal.Decimal `json:"unit_price"`
    OriginalPrice   decimal.Decimal `json:"original_price"`
    Discount        decimal.Decimal `json:"discount"`
    DiscountPercent decimal.Decimal `json:"discount_percent"`
    TotalPrice      decimal.Decimal `json:"total_price"`
    PriceSource     string          `json:"price_source"` // base, group, contract, quantity_break
}

// GetPrice calculates the best price for a product/company/quantity combination
func (s *PricingService) GetPrice(ctx context.Context, req *PriceRequest) (*PriceResult, error) {
    // Get base price
    basePrice, err := s.getBasePrice(ctx, req.ProductID, req.VariantID)
    if err != nil {
        return nil, err
    }

    result := &PriceResult{
        UnitPrice:     basePrice,
        OriginalPrice: basePrice,
        PriceSource:   "base",
    }

    // Get company for price group
    company, _, err := s.companyService.GetUserCompany(ctx, "")
    if err == nil && company.PriceGroupID != nil {
        // Check group price
        groupPrice, err := s.priceRepo.GetPrice(ctx, req.ProductID, req.VariantID, *company.PriceGroupID)
        if err == nil && groupPrice.Price.LessThan(result.UnitPrice) {
            result.UnitPrice = groupPrice.Price
            result.PriceSource = "group"
        }

        // Apply company discount
        if company.DiscountPercent.GreaterThan(decimal.Zero) {
            discountedPrice := result.UnitPrice.Mul(decimal.NewFromInt(100).Sub(company.DiscountPercent)).Div(decimal.NewFromInt(100))
            if discountedPrice.LessThan(result.UnitPrice) {
                result.UnitPrice = discountedPrice
                result.PriceSource = "company_discount"
            }
        }
    }

    // Check quantity breaks
    if req.Quantity > 1 {
        breaks, err := s.breakRepo.GetForProduct(ctx, req.ProductID, req.VariantID)
        if err == nil {
            for _, b := range breaks {
                if req.Quantity >= b.MinQuantity && (b.MaxQuantity == nil || req.Quantity <= *b.MaxQuantity) {
                    if b.FixedPrice != nil {
                        if b.FixedPrice.LessThan(result.UnitPrice) {
                            result.UnitPrice = *b.FixedPrice
                            result.PriceSource = "quantity_break"
                        }
                    } else {
                        var discountedPrice decimal.Decimal
                        if b.DiscountType == DiscountTypePercent {
                            discountedPrice = result.OriginalPrice.Mul(decimal.NewFromInt(100).Sub(b.DiscountValue)).Div(decimal.NewFromInt(100))
                        } else {
                            discountedPrice = result.OriginalPrice.Sub(b.DiscountValue)
                        }
                        if discountedPrice.LessThan(result.UnitPrice) {
                            result.UnitPrice = discountedPrice
                            result.PriceSource = "quantity_break"
                        }
                    }
                }
            }
        }
    }

    // Calculate totals
    result.Discount = result.OriginalPrice.Sub(result.UnitPrice)
    if result.OriginalPrice.GreaterThan(decimal.Zero) {
        result.DiscountPercent = result.Discount.Div(result.OriginalPrice).Mul(decimal.NewFromInt(100))
    }
    result.TotalPrice = result.UnitPrice.Mul(decimal.NewFromInt(int64(req.Quantity)))

    return result, nil
}

// GetPriceTiers returns all price tiers for a product
func (s *PricingService) GetPriceTiers(ctx context.Context, productID string, variantID *string) ([]PriceTier, error) {
    breaks, err := s.breakRepo.GetForProduct(ctx, productID, variantID)
    if err != nil {
        return nil, err
    }

    basePrice, _ := s.getBasePrice(ctx, productID, variantID)

    tiers := make([]PriceTier, 0)
    tiers = append(tiers, PriceTier{
        MinQuantity: 1,
        MaxQuantity: nil,
        UnitPrice:   basePrice,
    })

    for _, b := range breaks {
        var price decimal.Decimal
        if b.FixedPrice != nil {
            price = *b.FixedPrice
        } else if b.DiscountType == DiscountTypePercent {
            price = basePrice.Mul(decimal.NewFromInt(100).Sub(b.DiscountValue)).Div(decimal.NewFromInt(100))
        } else {
            price = basePrice.Sub(b.DiscountValue)
        }

        tiers = append(tiers, PriceTier{
            MinQuantity: b.MinQuantity,
            MaxQuantity: b.MaxQuantity,
            UnitPrice:   price,
        })
    }

    return tiers, nil
}

type PriceTier struct {
    MinQuantity int             `json:"min_quantity"`
    MaxQuantity *int            `json:"max_quantity"`
    UnitPrice   decimal.Decimal `json:"unit_price"`
}

func (s *PricingService) getBasePrice(ctx context.Context, productID string, variantID *string) (decimal.Decimal, error) {
    // Implementation to get base product price
    return decimal.Zero, nil
}
```

### Quote Service

```go
// internal/b2b/quote_service.go
package b2b

import (
    "context"
    "fmt"
    "time"
)

type QuoteService struct {
    repo     QuoteRepository
    pricing  *PricingService
    products ProductService
    events   EventPublisher
}

// RequestQuote creates a new quote request
func (s *QuoteService) RequestQuote(ctx context.Context, req *CreateQuoteRequest) (*QuoteRequest, error) {
    company, companyUser, err := s.companyService.GetUserCompany(ctx, auth.GetUserID(ctx))
    if err != nil {
        return nil, fmt.Errorf("user is not associated with a company")
    }

    quote := &QuoteRequest{
        ID:           generateID("quote"),
        TenantID:     tenant.GetTenantID(ctx),
        Number:       s.generateQuoteNumber(),
        CompanyID:    company.ID,
        RequestedBy:  companyUser.UserID,
        Status:       QuoteStatusSubmitted,
        CustomerNote: req.Note,
        CreatedAt:    time.Now(),
        UpdatedAt:    time.Now(),
    }

    // Add items
    for _, item := range req.Items {
        product, err := s.products.GetByID(ctx, item.ProductID)
        if err != nil {
            continue
        }

        quote.Items = append(quote.Items, QuoteItem{
            ID:            generateID("qi"),
            QuoteID:       quote.ID,
            ProductID:     item.ProductID,
            VariantID:     item.VariantID,
            RequestedQty:  item.Quantity,
            RequestedNote: item.Note,
            ProductName:   product.Name,
            ProductSKU:    product.SKU,
        })
    }

    if err := s.repo.Create(ctx, quote); err != nil {
        return nil, err
    }

    s.events.Publish(ctx, "quote.requested", map[string]any{
        "quote_id":   quote.ID,
        "company_id": company.ID,
    })

    return quote, nil
}

// SubmitQuote submits pricing for a quote request
func (s *QuoteService) SubmitQuote(ctx context.Context, quoteID string, items []QuotedItem, validDays int, note string) (*QuoteRequest, error) {
    quote, err := s.repo.GetByID(ctx, quoteID)
    if err != nil {
        return nil, err
    }

    if quote.Status != QuoteStatusSubmitted && quote.Status != QuoteStatusReviewing {
        return nil, fmt.Errorf("quote cannot be updated in status: %s", quote.Status)
    }

    // Update items with quoted prices
    var subtotal decimal.Decimal
    for i, item := range quote.Items {
        for _, quoted := range items {
            if item.ID == quoted.ItemID {
                quote.Items[i].QuotedQty = &quoted.Quantity
                quote.Items[i].QuotedPrice = quoted.UnitPrice
                quote.Items[i].LineTotal = quoted.UnitPrice.Mul(decimal.NewFromInt(int64(quoted.Quantity)))
                subtotal = subtotal.Add(quote.Items[i].LineTotal)
            }
        }
    }

    // Calculate totals
    quote.Subtotal = subtotal
    quote.Tax = subtotal.Mul(decimal.NewFromFloat(0.20)) // 20% VAT
    quote.Total = quote.Subtotal.Add(quote.Tax)
    quote.QuoteNote = note
    quote.Status = QuoteStatusQuoted

    // Set expiration
    expiresAt := time.Now().AddDate(0, 0, validDays)
    quote.ExpiresAt = &expiresAt

    quote.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, quote); err != nil {
        return nil, err
    }

    s.events.Publish(ctx, "quote.submitted", map[string]any{
        "quote_id": quote.ID,
        "total":    quote.Total.String(),
    })

    return quote, nil
}

// AcceptQuote accepts a quote and creates a purchase order
func (s *QuoteService) AcceptQuote(ctx context.Context, quoteID string) (*PurchaseOrder, error) {
    quote, err := s.repo.GetByID(ctx, quoteID)
    if err != nil {
        return nil, err
    }

    if quote.Status != QuoteStatusQuoted {
        return nil, fmt.Errorf("quote cannot be accepted in status: %s", quote.Status)
    }

    // Check expiration
    if quote.ExpiresAt != nil && time.Now().After(*quote.ExpiresAt) {
        quote.Status = QuoteStatusExpired
        s.repo.Update(ctx, quote)
        return nil, fmt.Errorf("quote has expired")
    }

    // Create purchase order from quote
    po, err := s.createPOFromQuote(ctx, quote)
    if err != nil {
        return nil, err
    }

    // Update quote
    now := time.Now()
    quote.Status = QuoteStatusAccepted
    quote.OrderID = &po.ID
    quote.ConvertedAt = &now
    quote.UpdatedAt = now
    s.repo.Update(ctx, quote)

    return po, nil
}

type CreateQuoteRequest struct {
    Items []QuoteItemRequest `json:"items"`
    Note  string             `json:"note"`
}

type QuoteItemRequest struct {
    ProductID string  `json:"product_id"`
    VariantID *string `json:"variant_id"`
    Quantity  int     `json:"quantity"`
    Note      string  `json:"note"`
}

type QuotedItem struct {
    ItemID    string          `json:"item_id"`
    Quantity  int             `json:"quantity"`
    UnitPrice decimal.Decimal `json:"unit_price"`
}
```

### Approval Workflow

```go
// internal/b2b/approval_service.go
package b2b

import (
    "context"
    "fmt"
    "time"
)

type ApprovalService struct {
    poRepo         PurchaseOrderRepository
    companyService *CompanyService
    events         EventPublisher
    notifications  NotificationService
}

// SubmitForApproval submits a PO for approval
func (s *ApprovalService) SubmitForApproval(ctx context.Context, poID string) (*PurchaseOrder, error) {
    po, err := s.poRepo.GetByID(ctx, poID)
    if err != nil {
        return nil, err
    }

    if po.Status != POStatusDraft {
        return nil, fmt.Errorf("PO cannot be submitted in status: %s", po.Status)
    }

    company, _, err := s.companyService.GetUserCompany(ctx, po.CreatedBy)
    if err != nil {
        return nil, err
    }

    // Check if approval is needed
    if !company.RequireApproval || po.Total.LessThanOrEqual(company.ApprovalLimit) {
        // Auto-approve
        po.Status = POStatusApproved
        po.ApprovalHistory = append(po.ApprovalHistory, ApprovalRecord{
            UserID:    "system",
            UserName:  "Auto-approved",
            Action:    "approved",
            Comment:   "Under approval limit",
            Timestamp: time.Now(),
        })
    } else {
        po.Status = POStatusPending

        // Notify approvers
        approvers, _ := s.companyService.GetApprovers(ctx, company.ID)
        for _, approver := range approvers {
            s.notifications.Send(ctx, &Notification{
                UserID:   approver.UserID,
                Type:     "po_pending_approval",
                Title:    fmt.Sprintf("PO #%s needs approval", po.Number),
                Body:     fmt.Sprintf("Purchase order for %s %s requires your approval", po.Total.String(), "UAH"),
                ActionURL: fmt.Sprintf("/b2b/orders/%s", po.ID),
            })
        }
    }

    po.UpdatedAt = time.Now()
    if err := s.poRepo.Update(ctx, po); err != nil {
        return nil, err
    }

    return po, nil
}

// Approve approves a purchase order
func (s *ApprovalService) Approve(ctx context.Context, poID string, comment string) (*PurchaseOrder, error) {
    po, err := s.poRepo.GetByID(ctx, poID)
    if err != nil {
        return nil, err
    }

    if po.Status != POStatusPending {
        return nil, fmt.Errorf("PO cannot be approved in status: %s", po.Status)
    }

    // Check if user can approve
    _, companyUser, err := s.companyService.GetUserCompany(ctx, auth.GetUserID(ctx))
    if err != nil || !companyUser.CanApprove {
        return nil, fmt.Errorf("user cannot approve orders")
    }

    user := auth.GetUser(ctx)

    po.Status = POStatusApproved
    po.ApprovedBy = &user.ID
    po.ApprovalHistory = append(po.ApprovalHistory, ApprovalRecord{
        UserID:    user.ID,
        UserName:  user.Name,
        Action:    "approved",
        Comment:   comment,
        Timestamp: time.Now(),
    })
    po.UpdatedAt = time.Now()

    if err := s.poRepo.Update(ctx, po); err != nil {
        return nil, err
    }

    // Notify creator
    s.notifications.Send(ctx, &Notification{
        UserID: po.CreatedBy,
        Type:   "po_approved",
        Title:  fmt.Sprintf("PO #%s approved", po.Number),
        Body:   fmt.Sprintf("Your purchase order has been approved by %s", user.Name),
    })

    s.events.Publish(ctx, "po.approved", map[string]any{
        "po_id":       po.ID,
        "approved_by": user.ID,
    })

    return po, nil
}

// Reject rejects a purchase order
func (s *ApprovalService) Reject(ctx context.Context, poID string, reason string) (*PurchaseOrder, error) {
    po, err := s.poRepo.GetByID(ctx, poID)
    if err != nil {
        return nil, err
    }

    if po.Status != POStatusPending {
        return nil, fmt.Errorf("PO cannot be rejected in status: %s", po.Status)
    }

    _, companyUser, err := s.companyService.GetUserCompany(ctx, auth.GetUserID(ctx))
    if err != nil || !companyUser.CanApprove {
        return nil, fmt.Errorf("user cannot reject orders")
    }

    user := auth.GetUser(ctx)

    po.Status = POStatusRejected
    po.ApprovalHistory = append(po.ApprovalHistory, ApprovalRecord{
        UserID:    user.ID,
        UserName:  user.Name,
        Action:    "rejected",
        Comment:   reason,
        Timestamp: time.Now(),
    })
    po.UpdatedAt = time.Now()

    if err := s.poRepo.Update(ctx, po); err != nil {
        return nil, err
    }

    // Notify creator
    s.notifications.Send(ctx, &Notification{
        UserID: po.CreatedBy,
        Type:   "po_rejected",
        Title:  fmt.Sprintf("PO #%s rejected", po.Number),
        Body:   fmt.Sprintf("Your purchase order has been rejected. Reason: %s", reason),
    })

    return po, nil
}
```

## Frontend Components

### Company Dashboard

```tsx
// components/b2b/CompanyDashboard.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, CreditCard, FileText, ShoppingCart } from 'lucide-react';

export function CompanyDashboard() {
  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => fetch('/api/b2b/company').then(r => r.json()),
  });

  const { data: stats } = useQuery({
    queryKey: ['company-stats'],
    queryFn: () => fetch('/api/b2b/company/stats').then(r => r.json()),
  });

  if (!company) return null;

  const creditUsedPercent = company.credit_limit > 0
    ? (company.credit_used / company.credit_limit) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Company Info */}
      <div className="bg-white rounded-lg p-6 border">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-gray-600">{company.legal_name}</p>
            <p className="text-sm text-gray-500 mt-1">
              ЄДРПОУ: {company.tax_id} | ІПН: {company.vat_number}
            </p>
          </div>
          <div className="ml-auto">
            <span className={`px-3 py-1 rounded-full text-sm ${
              company.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {company.status}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          icon={<CreditCard className="w-6 h-6" />}
          label="Credit Available"
          value={`₴${(company.credit_limit - company.credit_used).toLocaleString()}`}
          subtext={`of ₴${company.credit_limit.toLocaleString()}`}
          progress={creditUsedPercent}
        />
        <StatCard
          icon={<ShoppingCart className="w-6 h-6" />}
          label="Orders This Month"
          value={stats?.orders_this_month || 0}
          subtext={`₴${stats?.total_this_month?.toLocaleString() || 0}`}
        />
        <StatCard
          icon={<FileText className="w-6 h-6" />}
          label="Pending Approvals"
          value={stats?.pending_approvals || 0}
          highlight={stats?.pending_approvals > 0}
        />
        <StatCard
          icon={<FileText className="w-6 h-6" />}
          label="Open Quotes"
          value={stats?.open_quotes || 0}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <RecentOrders />
        <PendingApprovals />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, progress, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  progress?: number;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg p-4 border ${highlight ? 'border-orange-300' : ''}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-gray-100 rounded">{icon}</div>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-sm text-gray-500">{subtext}</div>}
      {progress !== undefined && (
        <div className="mt-2 h-2 bg-gray-200 rounded-full">
          <div
            className={`h-full rounded-full ${
              progress > 80 ? 'bg-red-500' : progress > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

### Quantity Pricing Display

```tsx
// components/b2b/QuantityPricing.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PriceTier {
  min_quantity: number;
  max_quantity: number | null;
  unit_price: number;
}

export function QuantityPricing({ productId, variantId }: { productId: string; variantId?: string }) {
  const [quantity, setQuantity] = useState(1);

  const { data: tiers } = useQuery<PriceTier[]>({
    queryKey: ['price-tiers', productId, variantId],
    queryFn: () =>
      fetch(`/api/b2b/pricing/tiers?product_id=${productId}${variantId ? `&variant_id=${variantId}` : ''}`).then(r => r.json()),
  });

  const { data: price } = useQuery({
    queryKey: ['price', productId, variantId, quantity],
    queryFn: () =>
      fetch(`/api/b2b/pricing?product_id=${productId}${variantId ? `&variant_id=${variantId}` : ''}&quantity=${quantity}`).then(r => r.json()),
  });

  if (!tiers?.length) return null;

  const getCurrentTier = () => {
    return tiers.find(t =>
      quantity >= t.min_quantity &&
      (t.max_quantity === null || quantity <= t.max_quantity)
    );
  };

  const currentTier = getCurrentTier();

  return (
    <div className="space-y-4">
      {/* Quantity Input */}
      <div className="flex items-center gap-4">
        <label className="font-medium">Quantity:</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          className="w-24 px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Price Display */}
      {price && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600">
              ₴{price.unit_price.toFixed(2)}
            </span>
            <span className="text-gray-600">/ unit</span>
          </div>
          {price.discount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="line-through text-gray-400">₴{price.original_price.toFixed(2)}</span>
              <span className="text-green-600 font-medium">-{price.discount_percent.toFixed(0)}%</span>
            </div>
          )}
          <div className="mt-2 text-lg font-medium">
            Total: ₴{price.total_price.toFixed(2)}
          </div>
        </div>
      )}

      {/* Price Tiers */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Quantity</th>
              <th className="px-4 py-2 text-right">Unit Price</th>
              <th className="px-4 py-2 text-right">Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tiers.map((tier, i) => {
              const isActive = tier === currentTier;
              const basePrice = tiers[0].unit_price;
              const savings = basePrice - tier.unit_price;
              const savingsPercent = (savings / basePrice) * 100;

              return (
                <tr
                  key={i}
                  className={isActive ? 'bg-blue-50' : ''}
                >
                  <td className="px-4 py-3">
                    {tier.min_quantity}
                    {tier.max_quantity ? ` - ${tier.max_quantity}` : '+'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ₴{tier.unit_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {savings > 0 ? `-${savingsPercent.toFixed(0)}%` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Quote Request Form

```tsx
// components/b2b/QuoteRequestForm.tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { ProductSearch } from './ProductSearch';

interface QuoteItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  note: string;
  product_name?: string;
}

export function QuoteRequestForm() {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [note, setNote] = useState('');

  const submitQuote = useMutation({
    mutationFn: (data: { items: QuoteItem[]; note: string }) =>
      fetch('/api/b2b/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      alert('Quote request submitted successfully!');
      setItems([]);
      setNote('');
    },
  });

  const addItem = (product: any) => {
    setItems([
      ...items,
      {
        product_id: product.id,
        variant_id: product.variant_id,
        quantity: 1,
        note: '',
        product_name: product.name,
      },
    ]);
  };

  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-xl font-semibold mb-4">Request a Quote</h2>

      {/* Product Search */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Add Products</label>
        <ProductSearch onSelect={addItem} />
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="space-y-4 mb-6">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{item.product_name}</div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-sm text-gray-600">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border rounded mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Note (optional)</label>
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => updateItem(index, { note: e.target.value })}
                      placeholder="Special requirements..."
                      className="w-full px-3 py-2 border rounded mt-1"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeItem(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* General Note */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Additional Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Any additional information about your quote request..."
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Submit */}
      <button
        onClick={() => submitQuote.mutate({ items, note })}
        disabled={items.length === 0 || submitQuote.isPending}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {submitQuote.isPending ? 'Submitting...' : 'Submit Quote Request'}
      </button>
    </div>
  );
}
```

## API Endpoints

```go
// internal/b2b/handlers.go

func (h *B2BHandler) RegisterRoutes(r *gin.RouterGroup) {
    b2b := r.Group("/b2b")
    b2b.Use(B2BMiddleware()) // Check B2B access

    // Company
    b2b.GET("/company", h.GetCompany)
    b2b.PUT("/company", h.UpdateCompany)
    b2b.GET("/company/stats", h.GetCompanyStats)
    b2b.GET("/company/users", h.GetCompanyUsers)
    b2b.POST("/company/users/invite", h.InviteUser)

    // Pricing
    b2b.GET("/pricing", h.GetPrice)
    b2b.GET("/pricing/tiers", h.GetPriceTiers)

    // Quotes
    b2b.GET("/quotes", h.ListQuotes)
    b2b.POST("/quotes", h.RequestQuote)
    b2b.GET("/quotes/:id", h.GetQuote)
    b2b.POST("/quotes/:id/accept", h.AcceptQuote)
    b2b.POST("/quotes/:id/reject", h.RejectQuote)

    // Purchase Orders
    b2b.GET("/orders", h.ListPurchaseOrders)
    b2b.POST("/orders", h.CreatePurchaseOrder)
    b2b.GET("/orders/:id", h.GetPurchaseOrder)
    b2b.PUT("/orders/:id", h.UpdatePurchaseOrder)
    b2b.POST("/orders/:id/submit", h.SubmitForApproval)
    b2b.POST("/orders/:id/approve", h.ApproveOrder)
    b2b.POST("/orders/:id/reject", h.RejectOrder)

    // Admin routes
    admin := r.Group("/admin/b2b")
    admin.Use(AdminMiddleware())
    {
        admin.GET("/companies", h.AdminListCompanies)
        admin.POST("/companies/:id/approve", h.AdminApproveCompany)
        admin.POST("/companies/:id/reject", h.AdminRejectCompany)
        admin.PUT("/companies/:id/credit", h.AdminUpdateCredit)

        admin.GET("/quotes", h.AdminListQuotes)
        admin.POST("/quotes/:id/respond", h.AdminRespondQuote)

        admin.GET("/price-groups", h.ListPriceGroups)
        admin.POST("/price-groups", h.CreatePriceGroup)
        admin.PUT("/price-groups/:id", h.UpdatePriceGroup)
        admin.POST("/prices", h.SetProductPrice)
    }
}
```

## Див. також

- [Orders](../modules/ORDERS.md)
- [Pricing](../modules/PRICING.md)
- [Multi-tenancy](../architecture/MULTI_TENANCY.md)
