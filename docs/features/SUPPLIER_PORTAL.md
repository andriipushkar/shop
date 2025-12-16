# Supplier Portal

Портал для постачальників з можливістю управління товарами, замовленнями та інвентарем.

## Можливості

- Реєстрація та верифікація постачальників
- Управління товарами та каталогом
- Обробка замовлень та відвантажень
- Управління інвентарем
- Звітність та аналітика
- Комунікація з адміністрацією

## Моделі даних

```go
// internal/supplier/models.go
package supplier

import (
    "time"
    "github.com/shopspring/decimal"
)

type SupplierStatus string

const (
    SupplierStatusPending   SupplierStatus = "pending"
    SupplierStatusApproved  SupplierStatus = "approved"
    SupplierStatusSuspended SupplierStatus = "suspended"
    SupplierStatusRejected  SupplierStatus = "rejected"
)

type Supplier struct {
    ID               string           `json:"id" gorm:"primaryKey"`
    TenantID         string           `json:"tenant_id" gorm:"index"`

    // Company Info
    CompanyName      string           `json:"company_name"`
    LegalName        string           `json:"legal_name"`
    TaxID            string           `json:"tax_id"` // ЄДРПОУ
    VATNumber        string           `json:"vat_number"`

    // Contact
    ContactName      string           `json:"contact_name"`
    Email            string           `json:"email" gorm:"uniqueIndex"`
    Phone            string           `json:"phone"`
    Website          string           `json:"website"`

    // Address
    Address          Address          `json:"address" gorm:"serializer:json"`
    WarehouseAddress *Address         `json:"warehouse_address" gorm:"serializer:json"`

    // Status
    Status           SupplierStatus   `json:"status"`
    ApprovedAt       *time.Time       `json:"approved_at"`
    ApprovedBy       *string          `json:"approved_by"`
    RejectionReason  string           `json:"rejection_reason"`

    // Financial
    CommissionRate   decimal.Decimal  `json:"commission_rate"` // Platform commission %
    PaymentTerms     int              `json:"payment_terms"`   // Days
    BankAccount      BankAccount      `json:"bank_account" gorm:"serializer:json"`

    // Settings
    AutoApproveProducts bool          `json:"auto_approve_products"`
    AllowDropship    bool             `json:"allow_dropship"`

    // Stats
    ProductCount     int              `json:"product_count"`
    OrderCount       int              `json:"order_count"`
    TotalRevenue     decimal.Decimal  `json:"total_revenue"`
    Rating           float64          `json:"rating"`

    // Documents
    Documents        []SupplierDocument `json:"documents" gorm:"foreignKey:SupplierID"`

    // Owner user
    UserID           string           `json:"user_id"`

    CreatedAt        time.Time        `json:"created_at"`
    UpdatedAt        time.Time        `json:"updated_at"`
}

type SupplierDocument struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    SupplierID  string    `json:"supplier_id" gorm:"index"`
    Type        string    `json:"type"` // registration, tax_certificate, contract
    Name        string    `json:"name"`
    URL         string    `json:"url"`
    VerifiedAt  *time.Time `json:"verified_at"`
    VerifiedBy  *string   `json:"verified_by"`
    CreatedAt   time.Time `json:"created_at"`
}

type BankAccount struct {
    BankName     string `json:"bank_name"`
    AccountName  string `json:"account_name"`
    IBAN         string `json:"iban"`
    SWIFT        string `json:"swift"`
}

type SupplierProduct struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    SupplierID  string          `json:"supplier_id" gorm:"index"`
    ProductID   string          `json:"product_id" gorm:"index"`

    // Supplier-specific data
    SupplierSKU string          `json:"supplier_sku"`
    CostPrice   decimal.Decimal `json:"cost_price"`
    LeadTime    int             `json:"lead_time"` // Days

    // Inventory
    Quantity    int             `json:"quantity"`
    Reserved    int             `json:"reserved"`
    LowStockThreshold int       `json:"low_stock_threshold"`

    // Status
    IsActive    bool            `json:"is_active"`
    IsPrimary   bool            `json:"is_primary"` // Primary supplier for this product

    CreatedAt   time.Time       `json:"created_at"`
    UpdatedAt   time.Time       `json:"updated_at"`
}

type SupplierOrder struct {
    ID              string          `json:"id" gorm:"primaryKey"`
    TenantID        string          `json:"tenant_id" gorm:"index"`
    SupplierID      string          `json:"supplier_id" gorm:"index"`
    OrderID         string          `json:"order_id" gorm:"index"` // Original order

    // Reference
    Number          string          `json:"number" gorm:"uniqueIndex"`
    PurchaseOrderNumber string      `json:"purchase_order_number"` // PO to supplier

    // Status
    Status          SupplierOrderStatus `json:"status"`

    // Items
    Items           []SupplierOrderItem `json:"items" gorm:"foreignKey:SupplierOrderID"`

    // Shipping
    ShippingAddress Address         `json:"shipping_address" gorm:"serializer:json"`
    ShippingMethod  string          `json:"shipping_method"`
    TrackingNumber  string          `json:"tracking_number"`
    ShippedAt       *time.Time      `json:"shipped_at"`
    DeliveredAt     *time.Time      `json:"delivered_at"`

    // Financial
    Subtotal        decimal.Decimal `json:"subtotal"`
    ShippingCost    decimal.Decimal `json:"shipping_cost"`
    Commission      decimal.Decimal `json:"commission"`
    NetAmount       decimal.Decimal `json:"net_amount"` // Amount to supplier

    // Payment
    PaymentStatus   string          `json:"payment_status"`
    PaidAt          *time.Time      `json:"paid_at"`

    // Notes
    SupplierNotes   string          `json:"supplier_notes"`
    InternalNotes   string          `json:"internal_notes"`

    CreatedAt       time.Time       `json:"created_at"`
    UpdatedAt       time.Time       `json:"updated_at"`
}

type SupplierOrderStatus string

const (
    SupplierOrderStatusPending    SupplierOrderStatus = "pending"
    SupplierOrderStatusConfirmed  SupplierOrderStatus = "confirmed"
    SupplierOrderStatusProcessing SupplierOrderStatus = "processing"
    SupplierOrderStatusShipped    SupplierOrderStatus = "shipped"
    SupplierOrderStatusDelivered  SupplierOrderStatus = "delivered"
    SupplierOrderStatusCancelled  SupplierOrderStatus = "cancelled"
)

type SupplierOrderItem struct {
    ID              string          `json:"id" gorm:"primaryKey"`
    SupplierOrderID string          `json:"supplier_order_id" gorm:"index"`
    ProductID       string          `json:"product_id"`
    VariantID       *string         `json:"variant_id"`

    Quantity        int             `json:"quantity"`
    UnitCost        decimal.Decimal `json:"unit_cost"`
    TotalCost       decimal.Decimal `json:"total_cost"`

    // Snapshot
    ProductName     string          `json:"product_name"`
    ProductSKU      string          `json:"product_sku"`
    SupplierSKU     string          `json:"supplier_sku"`

    // Fulfillment
    QtyShipped      int             `json:"qty_shipped"`
}

type SupplierPayout struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    TenantID    string          `json:"tenant_id" gorm:"index"`
    SupplierID  string          `json:"supplier_id" gorm:"index"`
    Number      string          `json:"number" gorm:"uniqueIndex"`

    // Period
    PeriodStart time.Time       `json:"period_start"`
    PeriodEnd   time.Time       `json:"period_end"`

    // Amounts
    GrossAmount decimal.Decimal `json:"gross_amount"`
    Commission  decimal.Decimal `json:"commission"`
    Adjustments decimal.Decimal `json:"adjustments"`
    NetAmount   decimal.Decimal `json:"net_amount"`

    // Orders included
    OrderIDs    []string        `json:"order_ids" gorm:"serializer:json"`
    OrderCount  int             `json:"order_count"`

    // Status
    Status      PayoutStatus    `json:"status"`
    PaidAt      *time.Time      `json:"paid_at"`
    TransactionID string        `json:"transaction_id"`

    CreatedAt   time.Time       `json:"created_at"`
}

type PayoutStatus string

const (
    PayoutStatusPending   PayoutStatus = "pending"
    PayoutStatusProcessing PayoutStatus = "processing"
    PayoutStatusPaid      PayoutStatus = "paid"
    PayoutStatusFailed    PayoutStatus = "failed"
)
```

## Services

### Supplier Service

```go
// internal/supplier/service.go
package supplier

import (
    "context"
    "fmt"
    "time"
)

type SupplierService struct {
    repo   SupplierRepository
    users  UserService
    events EventPublisher
}

type RegisterSupplierRequest struct {
    CompanyName    string
    LegalName      string
    TaxID          string
    VATNumber      string
    ContactName    string
    Email          string
    Phone          string
    Website        string
    Address        Address
    BankAccount    BankAccount
}

// Register registers a new supplier
func (s *SupplierService) Register(ctx context.Context, req *RegisterSupplierRequest) (*Supplier, error) {
    // Check if email already registered
    existing, _ := s.repo.GetByEmail(ctx, req.Email)
    if existing != nil {
        return nil, fmt.Errorf("email already registered")
    }

    // Create user account
    user, err := s.users.Create(ctx, &user.CreateRequest{
        Email:    req.Email,
        Name:     req.ContactName,
        Role:     "supplier",
    })
    if err != nil {
        return nil, err
    }

    supplier := &Supplier{
        ID:              generateID("sup"),
        TenantID:        tenant.GetTenantID(ctx),
        CompanyName:     req.CompanyName,
        LegalName:       req.LegalName,
        TaxID:           req.TaxID,
        VATNumber:       req.VATNumber,
        ContactName:     req.ContactName,
        Email:           req.Email,
        Phone:           req.Phone,
        Website:         req.Website,
        Address:         req.Address,
        BankAccount:     req.BankAccount,
        Status:          SupplierStatusPending,
        CommissionRate:  decimal.NewFromFloat(0.10), // Default 10%
        PaymentTerms:    14, // Default Net 14
        UserID:          user.ID,
        CreatedAt:       time.Now(),
        UpdatedAt:       time.Now(),
    }

    if err := s.repo.Create(ctx, supplier); err != nil {
        return nil, err
    }

    s.events.Publish(ctx, "supplier.registered", map[string]any{
        "supplier_id": supplier.ID,
        "company":     supplier.CompanyName,
    })

    return supplier, nil
}

// Approve approves a supplier registration
func (s *SupplierService) Approve(ctx context.Context, supplierID string, commissionRate float64, autoApproveProducts bool) (*Supplier, error) {
    supplier, err := s.repo.GetByID(ctx, supplierID)
    if err != nil {
        return nil, err
    }

    if supplier.Status != SupplierStatusPending {
        return nil, fmt.Errorf("supplier is not pending approval")
    }

    now := time.Now()
    userID := auth.GetUserID(ctx)

    supplier.Status = SupplierStatusApproved
    supplier.ApprovedAt = &now
    supplier.ApprovedBy = &userID
    supplier.CommissionRate = decimal.NewFromFloat(commissionRate)
    supplier.AutoApproveProducts = autoApproveProducts
    supplier.UpdatedAt = now

    if err := s.repo.Update(ctx, supplier); err != nil {
        return nil, err
    }

    // Activate user account
    s.users.Activate(ctx, supplier.UserID)

    s.events.Publish(ctx, "supplier.approved", map[string]any{
        "supplier_id": supplier.ID,
    })

    return supplier, nil
}

// GetDashboardStats returns supplier dashboard statistics
func (s *SupplierService) GetDashboardStats(ctx context.Context, supplierID string) (*DashboardStats, error) {
    supplier, err := s.repo.GetByID(ctx, supplierID)
    if err != nil {
        return nil, err
    }

    // Get order stats
    orderStats, _ := s.repo.GetOrderStats(ctx, supplierID)

    // Get revenue stats
    revenueStats, _ := s.repo.GetRevenueStats(ctx, supplierID)

    // Get pending payouts
    pendingPayouts, _ := s.repo.GetPendingPayoutAmount(ctx, supplierID)

    // Get low stock products
    lowStockCount, _ := s.repo.GetLowStockCount(ctx, supplierID)

    return &DashboardStats{
        TotalProducts:     supplier.ProductCount,
        TotalOrders:       supplier.OrderCount,
        PendingOrders:     orderStats.Pending,
        ProcessingOrders:  orderStats.Processing,
        RevenueThisMonth:  revenueStats.ThisMonth,
        RevenueLastMonth:  revenueStats.LastMonth,
        PendingPayouts:    pendingPayouts,
        LowStockProducts:  lowStockCount,
        Rating:            supplier.Rating,
    }, nil
}

type DashboardStats struct {
    TotalProducts    int             `json:"total_products"`
    TotalOrders      int             `json:"total_orders"`
    PendingOrders    int             `json:"pending_orders"`
    ProcessingOrders int             `json:"processing_orders"`
    RevenueThisMonth decimal.Decimal `json:"revenue_this_month"`
    RevenueLastMonth decimal.Decimal `json:"revenue_last_month"`
    PendingPayouts   decimal.Decimal `json:"pending_payouts"`
    LowStockProducts int             `json:"low_stock_products"`
    Rating           float64         `json:"rating"`
}
```

### Supplier Order Service

```go
// internal/supplier/order_service.go
package supplier

import (
    "context"
    "fmt"
    "time"
)

type SupplierOrderService struct {
    repo      SupplierOrderRepository
    suppliers *SupplierService
    inventory *InventoryService
    events    EventPublisher
}

// CreateFromOrder creates supplier orders from a customer order
func (s *SupplierOrderService) CreateFromOrder(ctx context.Context, order *order.Order) ([]*SupplierOrder, error) {
    // Group items by supplier
    itemsBySupplier := make(map[string][]order.OrderItem)
    for _, item := range order.Items {
        supplierProduct, _ := s.repo.GetSupplierProduct(ctx, item.ProductID)
        if supplierProduct != nil {
            supplierID := supplierProduct.SupplierID
            itemsBySupplier[supplierID] = append(itemsBySupplier[supplierID], item)
        }
    }

    supplierOrders := make([]*SupplierOrder, 0)

    for supplierID, items := range itemsBySupplier {
        supplier, err := s.suppliers.GetByID(ctx, supplierID)
        if err != nil {
            continue
        }

        // Create supplier order
        so := &SupplierOrder{
            ID:              generateID("so"),
            TenantID:        tenant.GetTenantID(ctx),
            SupplierID:      supplierID,
            OrderID:         order.ID,
            Number:          s.generateOrderNumber(),
            Status:          SupplierOrderStatusPending,
            ShippingAddress: order.ShippingAddress,
            CreatedAt:       time.Now(),
            UpdatedAt:       time.Now(),
        }

        // Add items
        var subtotal decimal.Decimal
        for _, item := range items {
            supplierProduct, _ := s.repo.GetSupplierProduct(ctx, item.ProductID)

            soItem := SupplierOrderItem{
                ID:              generateID("soi"),
                SupplierOrderID: so.ID,
                ProductID:       item.ProductID,
                VariantID:       item.VariantID,
                Quantity:        item.Quantity,
                UnitCost:        supplierProduct.CostPrice,
                TotalCost:       supplierProduct.CostPrice.Mul(decimal.NewFromInt(int64(item.Quantity))),
                ProductName:     item.Name,
                ProductSKU:      item.SKU,
                SupplierSKU:     supplierProduct.SupplierSKU,
            }

            so.Items = append(so.Items, soItem)
            subtotal = subtotal.Add(soItem.TotalCost)
        }

        so.Subtotal = subtotal
        so.Commission = subtotal.Mul(supplier.CommissionRate)
        so.NetAmount = subtotal.Sub(so.Commission)

        if err := s.repo.Create(ctx, so); err != nil {
            continue
        }

        supplierOrders = append(supplierOrders, so)

        // Notify supplier
        s.events.Publish(ctx, "supplier_order.created", map[string]any{
            "supplier_order_id": so.ID,
            "supplier_id":       supplierID,
            "order_id":          order.ID,
        })
    }

    return supplierOrders, nil
}

// ConfirmOrder confirms a supplier order
func (s *SupplierOrderService) ConfirmOrder(ctx context.Context, orderID string) (*SupplierOrder, error) {
    order, err := s.repo.GetByID(ctx, orderID)
    if err != nil {
        return nil, err
    }

    // Verify ownership
    if err := s.verifySupplierAccess(ctx, order.SupplierID); err != nil {
        return nil, err
    }

    if order.Status != SupplierOrderStatusPending {
        return nil, fmt.Errorf("order cannot be confirmed in status: %s", order.Status)
    }

    order.Status = SupplierOrderStatusConfirmed
    order.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, order); err != nil {
        return nil, err
    }

    // Reserve inventory
    for _, item := range order.Items {
        s.inventory.Reserve(ctx, item.ProductID, item.VariantID, order.SupplierID, item.Quantity)
    }

    s.events.Publish(ctx, "supplier_order.confirmed", map[string]any{
        "supplier_order_id": order.ID,
    })

    return order, nil
}

// ShipOrder marks an order as shipped
func (s *SupplierOrderService) ShipOrder(ctx context.Context, orderID string, trackingNumber string, shippedItems []ShippedItem) (*SupplierOrder, error) {
    order, err := s.repo.GetByID(ctx, orderID)
    if err != nil {
        return nil, err
    }

    if err := s.verifySupplierAccess(ctx, order.SupplierID); err != nil {
        return nil, err
    }

    if order.Status != SupplierOrderStatusConfirmed && order.Status != SupplierOrderStatusProcessing {
        return nil, fmt.Errorf("order cannot be shipped in status: %s", order.Status)
    }

    // Update shipped quantities
    for _, shipped := range shippedItems {
        for i, item := range order.Items {
            if item.ID == shipped.ItemID {
                order.Items[i].QtyShipped = shipped.Quantity
            }
        }
    }

    now := time.Now()
    order.TrackingNumber = trackingNumber
    order.ShippedAt = &now
    order.Status = SupplierOrderStatusShipped
    order.UpdatedAt = now

    if err := s.repo.Update(ctx, order); err != nil {
        return nil, err
    }

    // Release reserved inventory
    for _, item := range order.Items {
        s.inventory.ReleaseReservation(ctx, item.ProductID, item.VariantID, order.SupplierID, item.QtyShipped)
        s.inventory.Decrement(ctx, item.ProductID, item.VariantID, order.SupplierID, item.QtyShipped)
    }

    // Update main order tracking
    s.events.Publish(ctx, "supplier_order.shipped", map[string]any{
        "supplier_order_id": order.ID,
        "order_id":          order.OrderID,
        "tracking_number":   trackingNumber,
    })

    return order, nil
}

type ShippedItem struct {
    ItemID   string `json:"item_id"`
    Quantity int    `json:"quantity"`
}

func (s *SupplierOrderService) verifySupplierAccess(ctx context.Context, supplierID string) error {
    currentSupplierID := GetSupplierID(ctx)
    if currentSupplierID != supplierID {
        return fmt.Errorf("access denied")
    }
    return nil
}
```

## Frontend Components

### Supplier Dashboard

```tsx
// components/supplier/Dashboard.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Package, ShoppingCart, DollarSign, AlertTriangle,
  TrendingUp, TrendingDown, Star
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function SupplierDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['supplier-stats'],
    queryFn: () => fetch('/api/supplier/stats').then(r => r.json()),
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['supplier-recent-orders'],
    queryFn: () => fetch('/api/supplier/orders?limit=5').then(r => r.json()),
  });

  const { data: revenueChart } = useQuery({
    queryKey: ['supplier-revenue-chart'],
    queryFn: () => fetch('/api/supplier/analytics/revenue?period=30d').then(r => r.json()),
  });

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          icon={<Package className="w-6 h-6 text-blue-600" />}
          label="Total Products"
          value={stats.total_products}
        />
        <StatCard
          icon={<ShoppingCart className="w-6 h-6 text-green-600" />}
          label="Pending Orders"
          value={stats.pending_orders}
          alert={stats.pending_orders > 0}
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6 text-purple-600" />}
          label="Revenue This Month"
          value={`₴${stats.revenue_this_month.toLocaleString()}`}
          trend={stats.revenue_this_month > stats.revenue_last_month ? 'up' : 'down'}
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
          label="Low Stock"
          value={stats.low_stock_products}
          alert={stats.low_stock_products > 0}
        />
      </div>

      {/* Charts & Tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChart}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#4F46E5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {recentOrders?.items?.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">#{order.number}</div>
                  <div className="text-sm text-gray-600">
                    {order.items.length} items • ₴{order.subtotal.toFixed(2)}
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Payouts */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Pending Payouts</h2>
          <div className="text-2xl font-bold text-green-600">
            ₴{stats.pending_payouts.toLocaleString()}
          </div>
        </div>
        <p className="text-gray-600">
          Next payout scheduled for {new Date().toLocaleDateString('uk-UA')}
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, alert }: any) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${alert ? 'border-orange-300' : ''}`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-gray-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-purple-100 text-purple-800',
    shipped: 'bg-green-100 text-green-800',
    delivered: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}
```

### Product Management

```tsx
// components/supplier/ProductManagement.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Package, AlertTriangle } from 'lucide-react';

export function SupplierProductList() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({ status: 'all', lowStock: false });

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-products', filter],
    queryFn: () =>
      fetch(`/api/supplier/products?status=${filter.status}&low_stock=${filter.lowStock}`)
        .then(r => r.json()),
  });

  const updateInventory = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      fetch(`/api/supplier/products/${productId}/inventory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">All Products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending Approval</option>
          </select>
          <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={filter.lowStock}
              onChange={(e) => setFilter({ ...filter, lowStock: e.target.checked })}
            />
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Low Stock Only
          </label>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Inventory</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.items?.map((product: any) => (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={product.image_url || '/placeholder.png'}
                      alt={product.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                    <span className="font-medium">{product.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{product.supplier_sku}</td>
                <td className="px-4 py-3 text-right">₴{product.cost_price.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {product.quantity <= product.low_stock_threshold && (
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    )}
                    <input
                      type="number"
                      value={product.quantity}
                      onChange={(e) => updateInventory.mutate({
                        productId: product.id,
                        quantity: parseInt(e.target.value),
                      })}
                      className="w-20 px-2 py-1 border rounded text-right"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-red-50 rounded text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Order Processing

```tsx
// components/supplier/OrderProcessing.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Truck, Package } from 'lucide-react';

interface SupplierOrder {
  id: string;
  number: string;
  status: string;
  items: any[];
  shipping_address: any;
  subtotal: number;
  net_amount: number;
}

export function OrderProcessing({ order }: { order: SupplierOrder }) {
  const queryClient = useQueryClient();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedQuantities, setShippedQuantities] = useState<Record<string, number>>({});

  const confirmOrder = useMutation({
    mutationFn: () =>
      fetch(`/api/supplier/orders/${order.id}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-order', order.id] });
    },
  });

  const shipOrder = useMutation({
    mutationFn: () =>
      fetch(`/api/supplier/orders/${order.id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_number: trackingNumber,
          items: order.items.map(item => ({
            item_id: item.id,
            quantity: shippedQuantities[item.id] || item.quantity,
          })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-order', order.id] });
    },
  });

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Order #{order.number}</h2>
          <p className="text-gray-600">Status: {order.status}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Net Amount</p>
          <p className="text-2xl font-bold">₴{order.net_amount.toFixed(2)}</p>
        </div>
      </div>

      {/* Shipping Address */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Ship To:</h3>
        <p>{order.shipping_address.name}</p>
        <p>{order.shipping_address.address1}</p>
        <p>{order.shipping_address.city}, {order.shipping_address.postal_code}</p>
        <p>{order.shipping_address.phone}</p>
      </div>

      {/* Items */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Items</h3>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{item.product_name}</p>
                <p className="text-sm text-gray-600">SKU: {item.supplier_sku}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Qty to ship</p>
                  {order.status === 'confirmed' ? (
                    <input
                      type="number"
                      value={shippedQuantities[item.id] || item.quantity}
                      onChange={(e) => setShippedQuantities({
                        ...shippedQuantities,
                        [item.id]: parseInt(e.target.value),
                      })}
                      max={item.quantity}
                      className="w-20 px-2 py-1 border rounded text-right"
                    />
                  ) : (
                    <p className="font-medium">{item.quantity}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-medium">₴{item.total_cost.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {order.status === 'pending' && (
        <button
          onClick={() => confirmOrder.mutate()}
          disabled={confirmOrder.isPending}
          className="w-full py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Confirm Order
        </button>
      )}

      {order.status === 'confirmed' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tracking Number</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          <button
            onClick={() => shipOrder.mutate()}
            disabled={!trackingNumber || shipOrder.isPending}
            className="w-full py-3 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Truck className="w-5 h-5" />
            Mark as Shipped
          </button>
        </div>
      )}
    </div>
  );
}
```

## API Endpoints

```go
func (h *SupplierHandler) RegisterRoutes(r *gin.RouterGroup) {
    // Public registration
    r.POST("/supplier/register", h.Register)

    // Supplier portal (requires supplier auth)
    supplier := r.Group("/supplier")
    supplier.Use(SupplierAuthMiddleware())
    {
        supplier.GET("/profile", h.GetProfile)
        supplier.PUT("/profile", h.UpdateProfile)
        supplier.GET("/stats", h.GetDashboardStats)

        // Products
        supplier.GET("/products", h.ListProducts)
        supplier.POST("/products", h.CreateProduct)
        supplier.GET("/products/:id", h.GetProduct)
        supplier.PUT("/products/:id", h.UpdateProduct)
        supplier.PATCH("/products/:id/inventory", h.UpdateInventory)
        supplier.DELETE("/products/:id", h.DeleteProduct)

        // Orders
        supplier.GET("/orders", h.ListOrders)
        supplier.GET("/orders/:id", h.GetOrder)
        supplier.POST("/orders/:id/confirm", h.ConfirmOrder)
        supplier.POST("/orders/:id/ship", h.ShipOrder)

        // Payouts
        supplier.GET("/payouts", h.ListPayouts)
        supplier.GET("/payouts/:id", h.GetPayout)

        // Analytics
        supplier.GET("/analytics/revenue", h.GetRevenueAnalytics)
        supplier.GET("/analytics/products", h.GetProductAnalytics)
    }

    // Admin routes
    admin := r.Group("/admin/suppliers")
    admin.Use(AdminMiddleware())
    {
        admin.GET("", h.AdminListSuppliers)
        admin.GET("/:id", h.AdminGetSupplier)
        admin.POST("/:id/approve", h.AdminApproveSupplier)
        admin.POST("/:id/reject", h.AdminRejectSupplier)
        admin.POST("/:id/suspend", h.AdminSuspendSupplier)
        admin.POST("/payouts/process", h.AdminProcessPayouts)
    }
}
```

## Див. також

- [Products](../modules/PRODUCTS.md)
- [Orders](../modules/ORDERS.md)
- [Inventory](../modules/INVENTORY.md)
