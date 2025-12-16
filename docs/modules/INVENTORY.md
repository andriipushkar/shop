# Inventory Module

Модуль управління запасами Shop Platform.

## Огляд

Модуль Inventory забезпечує:
- Відстеження залишків товарів
- Багатоскладову інвентаризацію
- Резервування товарів
- Історію змін залишків
- Сповіщення про низькі залишки
- Інтеграцію з ERP/WMS

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inventory System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐      │
│   │  Locations  │──►│   Levels     │──►│   Movements     │      │
│   │ (Warehouse) │   │ (Stock qty)  │   │ (History)       │      │
│   └─────────────┘   └──────────────┘   └─────────────────┘      │
│                            │                                     │
│                            ▼                                     │
│                    ┌──────────────┐                              │
│                    │ Reservations │                              │
│                    │ (Pending)    │                              │
│                    └──────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Моделі даних

```go
// internal/inventory/models.go
package inventory

import (
	"time"
)

// InventoryLocation represents a physical location (warehouse, store)
type InventoryLocation struct {
	ID          string            `gorm:"primaryKey" json:"id"`
	TenantID    string            `gorm:"index" json:"tenant_id"`
	Name        string            `json:"name"`
	Code        string            `gorm:"index" json:"code"`
	Type        string            `json:"type"` // warehouse, store, supplier, virtual
	Address     *LocationAddress  `gorm:"serializer:json" json:"address,omitempty"`
	IsActive    bool              `json:"is_active"`
	IsDefault   bool              `json:"is_default"`
	Priority    int               `json:"priority"` // For allocation
	Metadata    map[string]any    `gorm:"serializer:json" json:"metadata,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type LocationAddress struct {
	AddressLine1 string `json:"address_line1"`
	AddressLine2 string `json:"address_line2,omitempty"`
	City         string `json:"city"`
	State        string `json:"state,omitempty"`
	PostalCode   string `json:"postal_code"`
	CountryCode  string `json:"country_code"`
	Phone        string `json:"phone,omitempty"`
}

// InventoryLevel represents stock level at a specific location
type InventoryLevel struct {
	ID               string    `gorm:"primaryKey" json:"id"`
	TenantID         string    `gorm:"index" json:"tenant_id"`
	LocationID       string    `gorm:"index" json:"location_id"`
	ProductID        string    `gorm:"index" json:"product_id"`
	VariantID        *string   `gorm:"index" json:"variant_id,omitempty"`

	// Quantities
	Quantity         int       `json:"quantity"`          // Total on hand
	ReservedQuantity int       `json:"reserved_quantity"` // Reserved for orders
	AvailableQuantity int      `json:"available_quantity"` // quantity - reserved (computed)
	IncomingQuantity int       `json:"incoming_quantity"` // Expected from POs

	// Reorder settings
	ReorderPoint     *int      `json:"reorder_point,omitempty"`
	ReorderQuantity  *int      `json:"reorder_quantity,omitempty"`

	// Bin/Location within warehouse
	BinLocation      string    `json:"bin_location,omitempty"`

	UpdatedAt        time.Time `json:"updated_at"`
}

// InventoryMovement represents a stock movement/transaction
type InventoryMovement struct {
	ID            string          `gorm:"primaryKey" json:"id"`
	TenantID      string          `gorm:"index" json:"tenant_id"`
	LocationID    string          `gorm:"index" json:"location_id"`
	ProductID     string          `gorm:"index" json:"product_id"`
	VariantID     *string         `json:"variant_id,omitempty"`

	// Movement type
	Type          MovementType    `json:"type"`
	Quantity      int             `json:"quantity"` // Can be negative
	PreviousQty   int             `json:"previous_qty"`
	NewQty        int             `json:"new_qty"`

	// Reference
	ReferenceType string          `json:"reference_type,omitempty"` // order, transfer, adjustment, purchase_order
	ReferenceID   string          `json:"reference_id,omitempty"`

	// Details
	Reason        string          `json:"reason,omitempty"`
	Cost          *decimal.Decimal `json:"cost,omitempty"` // For COGS tracking
	Notes         string          `json:"notes,omitempty"`

	// Audit
	CreatedBy     string          `json:"created_by,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

type MovementType string

const (
	MovementTypeReceived   MovementType = "received"
	MovementTypeSold       MovementType = "sold"
	MovementTypeReturned   MovementType = "returned"
	MovementTypeAdjusted   MovementType = "adjusted"
	MovementTypeTransferIn MovementType = "transfer_in"
	MovementTypeTransferOut MovementType = "transfer_out"
	MovementTypeReserved   MovementType = "reserved"
	MovementTypeReleased   MovementType = "released"
	MovementTypeDamaged    MovementType = "damaged"
	MovementTypeExpired    MovementType = "expired"
)

// InventoryReservation represents a stock reservation for an order
type InventoryReservation struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TenantID    string    `gorm:"index" json:"tenant_id"`
	LocationID  string    `gorm:"index" json:"location_id"`
	ProductID   string    `gorm:"index" json:"product_id"`
	VariantID   *string   `json:"variant_id,omitempty"`
	OrderID     string    `gorm:"index" json:"order_id"`
	OrderItemID string    `json:"order_item_id"`
	Quantity    int       `json:"quantity"`
	Status      string    `json:"status"` // pending, confirmed, fulfilled, cancelled
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// InventoryTransfer represents a stock transfer between locations
type InventoryTransfer struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	TenantID        string    `gorm:"index" json:"tenant_id"`
	FromLocationID  string    `json:"from_location_id"`
	ToLocationID    string    `json:"to_location_id"`
	Status          string    `json:"status"` // pending, in_transit, received, cancelled
	Notes           string    `json:"notes,omitempty"`
	Items           []TransferItem `gorm:"foreignKey:TransferID" json:"items"`
	ShippedAt       *time.Time `json:"shipped_at,omitempty"`
	ReceivedAt      *time.Time `json:"received_at,omitempty"`
	CreatedBy       string    `json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type TransferItem struct {
	ID           string  `gorm:"primaryKey" json:"id"`
	TransferID   string  `gorm:"index" json:"transfer_id"`
	ProductID    string  `json:"product_id"`
	VariantID    *string `json:"variant_id,omitempty"`
	Quantity     int     `json:"quantity"`
	ReceivedQty  int     `json:"received_qty"`
}
```

## Inventory Service

```go
// internal/inventory/service.go
package inventory

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InventoryService struct {
	db       *gorm.DB
	cache    CacheService
	eventBus EventBus
	notifier NotificationService
}

// GetAvailability returns available quantity across all locations
func (s *InventoryService) GetAvailability(ctx context.Context, tenantID, productID string, variantID *string) (*AvailabilityResult, error) {
	var levels []InventoryLevel

	query := s.db.WithContext(ctx).
		Where("tenant_id = ? AND product_id = ?", tenantID, productID).
		Joins("JOIN inventory_locations ON inventory_locations.id = inventory_levels.location_id").
		Where("inventory_locations.is_active = ?", true)

	if variantID != nil {
		query = query.Where("inventory_levels.variant_id = ?", *variantID)
	} else {
		query = query.Where("inventory_levels.variant_id IS NULL")
	}

	if err := query.Find(&levels).Error; err != nil {
		return nil, err
	}

	result := &AvailabilityResult{
		ProductID:    productID,
		VariantID:    variantID,
		Locations:    make([]LocationAvailability, 0),
	}

	for _, level := range levels {
		available := level.Quantity - level.ReservedQuantity
		if available < 0 {
			available = 0
		}

		result.TotalQuantity += level.Quantity
		result.TotalReserved += level.ReservedQuantity
		result.TotalAvailable += available
		result.TotalIncoming += level.IncomingQuantity

		result.Locations = append(result.Locations, LocationAvailability{
			LocationID:       level.LocationID,
			Quantity:         level.Quantity,
			ReservedQuantity: level.ReservedQuantity,
			AvailableQuantity: available,
			IncomingQuantity: level.IncomingQuantity,
		})
	}

	result.InStock = result.TotalAvailable > 0

	return result, nil
}

// CheckAvailability checks if quantity is available
func (s *InventoryService) CheckAvailability(ctx context.Context, tenantID, productID string, variantID *string, quantity int) (bool, error) {
	availability, err := s.GetAvailability(ctx, tenantID, productID, variantID)
	if err != nil {
		return false, err
	}
	return availability.TotalAvailable >= quantity, nil
}

// Reserve reserves inventory for an order
func (s *InventoryService) Reserve(ctx context.Context, tenantID, productID string, variantID *string, quantity int, orderID string) error {
	// Find best location to reserve from (based on priority, availability)
	var level InventoryLevel

	query := s.db.WithContext(ctx).
		Where("tenant_id = ? AND product_id = ?", tenantID, productID).
		Joins("JOIN inventory_locations ON inventory_locations.id = inventory_levels.location_id").
		Where("inventory_locations.is_active = ?", true).
		Where("inventory_levels.quantity - inventory_levels.reserved_quantity >= ?", quantity).
		Order("inventory_locations.priority DESC, inventory_levels.quantity DESC")

	if variantID != nil {
		query = query.Where("inventory_levels.variant_id = ?", *variantID)
	}

	if err := query.First(&level).Error; err != nil {
		return fmt.Errorf("insufficient inventory")
	}

	tx := s.db.Begin()

	// Create reservation
	reservation := &InventoryReservation{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		LocationID: level.LocationID,
		ProductID:  productID,
		VariantID:  variantID,
		OrderID:    orderID,
		Quantity:   quantity,
		Status:     "pending",
		ExpiresAt:  timePtr(time.Now().Add(30 * time.Minute)),
	}

	if err := tx.Create(reservation).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Update level
	if err := tx.Model(&level).Updates(map[string]interface{}{
		"reserved_quantity": gorm.Expr("reserved_quantity + ?", quantity),
		"updated_at":        time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Create movement record
	movement := &InventoryMovement{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		LocationID:    level.LocationID,
		ProductID:     productID,
		VariantID:     variantID,
		Type:          MovementTypeReserved,
		Quantity:      quantity,
		PreviousQty:   level.Quantity,
		NewQty:        level.Quantity,
		ReferenceType: "order",
		ReferenceID:   orderID,
	}

	if err := tx.Create(movement).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	// Check for low stock alert
	go s.checkLowStock(ctx, tenantID, level.LocationID, productID, variantID)

	return nil
}

// Release releases reserved inventory
func (s *InventoryService) Release(ctx context.Context, tenantID, productID string, variantID *string, quantity int, orderID string) error {
	var reservation InventoryReservation

	query := s.db.Where("tenant_id = ? AND product_id = ? AND order_id = ? AND status = ?",
		tenantID, productID, orderID, "pending")

	if variantID != nil {
		query = query.Where("variant_id = ?", *variantID)
	}

	if err := query.First(&reservation).Error; err != nil {
		return nil // No reservation to release
	}

	tx := s.db.Begin()

	// Update reservation status
	if err := tx.Model(&reservation).Update("status", "cancelled").Error; err != nil {
		tx.Rollback()
		return err
	}

	// Update level
	if err := tx.Model(&InventoryLevel{}).
		Where("tenant_id = ? AND location_id = ? AND product_id = ?",
			tenantID, reservation.LocationID, productID).
		Updates(map[string]interface{}{
			"reserved_quantity": gorm.Expr("reserved_quantity - ?", reservation.Quantity),
			"updated_at":        time.Now(),
		}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Create movement record
	movement := &InventoryMovement{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		LocationID:    reservation.LocationID,
		ProductID:     productID,
		VariantID:     variantID,
		Type:          MovementTypeReleased,
		Quantity:      -reservation.Quantity,
		ReferenceType: "order",
		ReferenceID:   orderID,
		Reason:        "Order cancelled",
	}

	if err := tx.Create(movement).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// Deduct deducts inventory (after order fulfillment)
func (s *InventoryService) Deduct(ctx context.Context, tenantID, locationID, productID string, variantID *string, quantity int, orderID string) error {
	tx := s.db.Begin()

	// Get current level
	var level InventoryLevel
	if err := tx.Where("tenant_id = ? AND location_id = ? AND product_id = ?",
		tenantID, locationID, productID).First(&level).Error; err != nil {
		tx.Rollback()
		return err
	}

	previousQty := level.Quantity

	// Update level
	if err := tx.Model(&level).Updates(map[string]interface{}{
		"quantity":          gorm.Expr("quantity - ?", quantity),
		"reserved_quantity": gorm.Expr("GREATEST(reserved_quantity - ?, 0)", quantity),
		"updated_at":        time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Update reservation status
	tx.Model(&InventoryReservation{}).
		Where("tenant_id = ? AND product_id = ? AND order_id = ? AND status = ?",
			tenantID, productID, orderID, "pending").
		Update("status", "fulfilled")

	// Create movement record
	movement := &InventoryMovement{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		LocationID:    locationID,
		ProductID:     productID,
		VariantID:     variantID,
		Type:          MovementTypeSold,
		Quantity:      -quantity,
		PreviousQty:   previousQty,
		NewQty:        previousQty - quantity,
		ReferenceType: "order",
		ReferenceID:   orderID,
	}

	if err := tx.Create(movement).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	// Check for low stock
	go s.checkLowStock(ctx, tenantID, locationID, productID, variantID)

	// Publish event
	s.eventBus.Publish(ctx, "inventory.updated", InventoryUpdatedEvent{
		TenantID:   tenantID,
		LocationID: locationID,
		ProductID:  productID,
		VariantID:  variantID,
		NewQuantity: previousQty - quantity,
	})

	return nil
}

// AdjustInventory adjusts inventory manually
func (s *InventoryService) AdjustInventory(ctx context.Context, tenantID string, req AdjustInventoryRequest) error {
	tx := s.db.Begin()

	var level InventoryLevel
	err := tx.Where("tenant_id = ? AND location_id = ? AND product_id = ?",
		tenantID, req.LocationID, req.ProductID).First(&level).Error

	if err == gorm.ErrRecordNotFound {
		// Create new level
		level = InventoryLevel{
			ID:         uuid.New().String(),
			TenantID:   tenantID,
			LocationID: req.LocationID,
			ProductID:  req.ProductID,
			VariantID:  req.VariantID,
			Quantity:   0,
		}
		if err := tx.Create(&level).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	previousQty := level.Quantity
	var newQty int
	var movementQty int

	if req.AdjustmentType == "set" {
		newQty = req.Quantity
		movementQty = req.Quantity - previousQty
	} else {
		newQty = previousQty + req.Quantity
		movementQty = req.Quantity
	}

	// Update level
	if err := tx.Model(&level).Updates(map[string]interface{}{
		"quantity":   newQty,
		"updated_at": time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Create movement
	movement := &InventoryMovement{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		LocationID:    req.LocationID,
		ProductID:     req.ProductID,
		VariantID:     req.VariantID,
		Type:          MovementTypeAdjusted,
		Quantity:      movementQty,
		PreviousQty:   previousQty,
		NewQty:        newQty,
		ReferenceType: "adjustment",
		Reason:        req.Reason,
		Notes:         req.Notes,
		CreatedBy:     req.UserID,
	}

	if err := tx.Create(movement).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// CreateTransfer creates an inventory transfer
func (s *InventoryService) CreateTransfer(ctx context.Context, tenantID string, req CreateTransferRequest) (*InventoryTransfer, error) {
	transfer := &InventoryTransfer{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		FromLocationID: req.FromLocationID,
		ToLocationID:   req.ToLocationID,
		Status:         "pending",
		Notes:          req.Notes,
		CreatedBy:      req.UserID,
	}

	tx := s.db.Begin()

	if err := tx.Create(transfer).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	for _, item := range req.Items {
		transferItem := TransferItem{
			ID:         uuid.New().String(),
			TransferID: transfer.ID,
			ProductID:  item.ProductID,
			VariantID:  item.VariantID,
			Quantity:   item.Quantity,
		}

		if err := tx.Create(&transferItem).Error; err != nil {
			tx.Rollback()
			return nil, err
		}

		transfer.Items = append(transfer.Items, transferItem)
	}

	return transfer, tx.Commit().Error
}

// ShipTransfer marks transfer as shipped
func (s *InventoryService) ShipTransfer(ctx context.Context, tenantID, transferID string) error {
	var transfer InventoryTransfer
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, transferID).
		Preload("Items").First(&transfer).Error; err != nil {
		return err
	}

	if transfer.Status != "pending" {
		return fmt.Errorf("transfer cannot be shipped")
	}

	tx := s.db.Begin()

	// Deduct from source location
	for _, item := range transfer.Items {
		// Update level
		if err := tx.Model(&InventoryLevel{}).
			Where("tenant_id = ? AND location_id = ? AND product_id = ?",
				tenantID, transfer.FromLocationID, item.ProductID).
			Updates(map[string]interface{}{
				"quantity":   gorm.Expr("quantity - ?", item.Quantity),
				"updated_at": time.Now(),
			}).Error; err != nil {
			tx.Rollback()
			return err
		}

		// Create movement
		movement := &InventoryMovement{
			ID:            uuid.New().String(),
			TenantID:      tenantID,
			LocationID:    transfer.FromLocationID,
			ProductID:     item.ProductID,
			VariantID:     item.VariantID,
			Type:          MovementTypeTransferOut,
			Quantity:      -item.Quantity,
			ReferenceType: "transfer",
			ReferenceID:   transfer.ID,
		}
		tx.Create(movement)
	}

	// Update transfer status
	now := time.Now()
	if err := tx.Model(&transfer).Updates(map[string]interface{}{
		"status":     "in_transit",
		"shipped_at": &now,
	}).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// ReceiveTransfer marks transfer as received
func (s *InventoryService) ReceiveTransfer(ctx context.Context, tenantID, transferID string, receivedItems []ReceivedItem) error {
	var transfer InventoryTransfer
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, transferID).
		Preload("Items").First(&transfer).Error; err != nil {
		return err
	}

	if transfer.Status != "in_transit" {
		return fmt.Errorf("transfer cannot be received")
	}

	tx := s.db.Begin()

	// Add to destination location
	for _, received := range receivedItems {
		// Update or create level
		var level InventoryLevel
		err := tx.Where("tenant_id = ? AND location_id = ? AND product_id = ?",
			tenantID, transfer.ToLocationID, received.ProductID).First(&level).Error

		if err == gorm.ErrRecordNotFound {
			level = InventoryLevel{
				ID:         uuid.New().String(),
				TenantID:   tenantID,
				LocationID: transfer.ToLocationID,
				ProductID:  received.ProductID,
				VariantID:  received.VariantID,
				Quantity:   received.ReceivedQty,
			}
			tx.Create(&level)
		} else {
			tx.Model(&level).Updates(map[string]interface{}{
				"quantity":   gorm.Expr("quantity + ?", received.ReceivedQty),
				"updated_at": time.Now(),
			})
		}

		// Create movement
		movement := &InventoryMovement{
			ID:            uuid.New().String(),
			TenantID:      tenantID,
			LocationID:    transfer.ToLocationID,
			ProductID:     received.ProductID,
			VariantID:     received.VariantID,
			Type:          MovementTypeTransferIn,
			Quantity:      received.ReceivedQty,
			ReferenceType: "transfer",
			ReferenceID:   transfer.ID,
		}
		tx.Create(movement)

		// Update transfer item
		tx.Model(&TransferItem{}).Where("transfer_id = ? AND product_id = ?", transfer.ID, received.ProductID).
			Update("received_qty", received.ReceivedQty)
	}

	// Update transfer status
	now := time.Now()
	tx.Model(&transfer).Updates(map[string]interface{}{
		"status":      "received",
		"received_at": &now,
	})

	return tx.Commit().Error
}

func (s *InventoryService) checkLowStock(ctx context.Context, tenantID, locationID, productID string, variantID *string) {
	var level InventoryLevel
	s.db.Where("tenant_id = ? AND location_id = ? AND product_id = ?", tenantID, locationID, productID).First(&level)

	if level.ReorderPoint != nil && level.Quantity <= *level.ReorderPoint {
		s.eventBus.Publish(ctx, "inventory.low_stock", LowStockEvent{
			TenantID:     tenantID,
			LocationID:   locationID,
			ProductID:    productID,
			VariantID:    variantID,
			CurrentQty:   level.Quantity,
			ReorderPoint: *level.ReorderPoint,
		})

		s.notifier.SendLowStockAlert(ctx, tenantID, productID, level.Quantity)
	}
}
```

## API Endpoints

```go
// GET /api/v1/inventory/locations - List locations
// POST /api/v1/inventory/locations - Create location (admin)
// GET /api/v1/inventory/levels - Get inventory levels
// GET /api/v1/inventory/products/:id - Get product availability
// POST /api/v1/inventory/adjust - Adjust inventory (admin)
// GET /api/v1/inventory/movements - Get movement history
// POST /api/v1/inventory/transfers - Create transfer (admin)
// POST /api/v1/inventory/transfers/:id/ship - Ship transfer (admin)
// POST /api/v1/inventory/transfers/:id/receive - Receive transfer (admin)
```

## Див. також

- [Products](./PRODUCTS.md)
- [Orders](./ORDERS.md)
- [Warehouse](../warehouse/README.md)
