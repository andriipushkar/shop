package alerts

import (
	"context"
	"encoding/json"
	"time"
)

// AlertType represents the type of inventory alert
type AlertType string

const (
	AlertTypeLowStock    AlertType = "low_stock"
	AlertTypeOutOfStock  AlertType = "out_of_stock"
	AlertTypeRestocked   AlertType = "restocked"
	AlertTypePriceChange AlertType = "price_change"
)

// InventoryAlert represents an inventory-related alert
type InventoryAlert struct {
	ID        string    `json:"id"`
	Type      AlertType `json:"type"`
	ProductID string    `json:"product_id"`
	Product   string    `json:"product_name"`
	OldValue  interface{} `json:"old_value,omitempty"`
	NewValue  interface{} `json:"new_value,omitempty"`
	Threshold int       `json:"threshold,omitempty"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// AlertPublisher defines interface for publishing alerts
type AlertPublisher interface {
	Publish(ctx context.Context, alert *InventoryAlert) error
}

// Config holds alert configuration
type Config struct {
	LowStockThreshold int  // Stock level that triggers low stock alert
	Enabled           bool // Whether alerts are enabled
}

// DefaultConfig returns default alert configuration
func DefaultConfig() Config {
	return Config{
		LowStockThreshold: 10,
		Enabled:           true,
	}
}

// InventoryMonitor monitors inventory and generates alerts
type InventoryMonitor struct {
	config    Config
	publisher AlertPublisher
}

// NewInventoryMonitor creates a new inventory monitor
func NewInventoryMonitor(cfg Config, publisher AlertPublisher) *InventoryMonitor {
	return &InventoryMonitor{
		config:    cfg,
		publisher: publisher,
	}
}

// CheckStock checks product stock and generates alerts if needed
func (m *InventoryMonitor) CheckStock(ctx context.Context, productID, productName string, oldStock, newStock int) error {
	if !m.config.Enabled || m.publisher == nil {
		return nil
	}

	var alert *InventoryAlert

	// Check for out of stock
	if newStock == 0 && oldStock > 0 {
		alert = &InventoryAlert{
			ID:        generateID(),
			Type:      AlertTypeOutOfStock,
			ProductID: productID,
			Product:   productName,
			OldValue:  oldStock,
			NewValue:  newStock,
			Message:   productName + " is now out of stock",
			CreatedAt: time.Now(),
		}
	} else if newStock > 0 && oldStock == 0 {
		// Restocked
		alert = &InventoryAlert{
			ID:        generateID(),
			Type:      AlertTypeRestocked,
			ProductID: productID,
			Product:   productName,
			OldValue:  oldStock,
			NewValue:  newStock,
			Message:   productName + " has been restocked (" + itoa(newStock) + " units)",
			CreatedAt: time.Now(),
		}
	} else if newStock <= m.config.LowStockThreshold && newStock > 0 && oldStock > m.config.LowStockThreshold {
		// Low stock
		alert = &InventoryAlert{
			ID:        generateID(),
			Type:      AlertTypeLowStock,
			ProductID: productID,
			Product:   productName,
			NewValue:  newStock,
			Threshold: m.config.LowStockThreshold,
			Message:   productName + " is running low on stock (" + itoa(newStock) + " units remaining)",
			CreatedAt: time.Now(),
		}
	}

	if alert != nil {
		return m.publisher.Publish(ctx, alert)
	}

	return nil
}

// CheckPriceChange generates alert for significant price changes
func (m *InventoryMonitor) CheckPriceChange(ctx context.Context, productID, productName string, oldPrice, newPrice float64) error {
	if !m.config.Enabled || m.publisher == nil {
		return nil
	}

	// Alert on price changes > 20%
	if oldPrice > 0 {
		changePercent := (newPrice - oldPrice) / oldPrice * 100
		if changePercent < -20 || changePercent > 20 {
			alert := &InventoryAlert{
				ID:        generateID(),
				Type:      AlertTypePriceChange,
				ProductID: productID,
				Product:   productName,
				OldValue:  oldPrice,
				NewValue:  newPrice,
				Message:   productName + " price changed significantly",
				CreatedAt: time.Now(),
			}
			return m.publisher.Publish(ctx, alert)
		}
	}

	return nil
}

// GetLowStockProducts returns products with low stock
type ProductStock struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	Stock       int    `json:"stock"`
	Threshold   int    `json:"threshold"`
}

func generateID() string {
	return time.Now().Format("20060102150405") + "-" + itoa(int(time.Now().UnixNano()%10000))
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	s := ""
	negative := i < 0
	if negative {
		i = -i
	}
	for i > 0 {
		s = string(rune('0'+i%10)) + s
		i /= 10
	}
	if negative {
		s = "-" + s
	}
	return s
}

// LogPublisher is a simple publisher that logs alerts (for dev/testing)
type LogPublisher struct {
	alerts []InventoryAlert
}

// NewLogPublisher creates a new log publisher
func NewLogPublisher() *LogPublisher {
	return &LogPublisher{
		alerts: make([]InventoryAlert, 0),
	}
}

// Publish logs the alert
func (p *LogPublisher) Publish(ctx context.Context, alert *InventoryAlert) error {
	p.alerts = append(p.alerts, *alert)
	return nil
}

// GetAlerts returns all logged alerts
func (p *LogPublisher) GetAlerts() []InventoryAlert {
	return p.alerts
}

// Clear clears all alerts
func (p *LogPublisher) Clear() {
	p.alerts = make([]InventoryAlert, 0)
}

// ToJSON converts alert to JSON
func (a *InventoryAlert) ToJSON() ([]byte, error) {
	return json.Marshal(a)
}
