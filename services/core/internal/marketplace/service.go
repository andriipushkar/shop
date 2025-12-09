package marketplace

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Service provides high-level marketplace operations
type Service struct {
	manager    *Manager
	repository Repository
	feedCache  map[MarketplaceType][]byte
	feedMu     sync.RWMutex
}

// NewService creates a new marketplace service
func NewService(repo Repository) *Service {
	return &Service{
		manager:    NewManager(repo),
		repository: repo,
		feedCache:  make(map[MarketplaceType][]byte),
	}
}

// RegisterMarketplace registers a marketplace integration
func (s *Service) RegisterMarketplace(mp Marketplace) error {
	s.manager.Register(mp)

	// Load and apply configuration if available
	ctx := context.Background()
	config, err := s.repository.GetConfig(ctx, mp.Type())
	if err == nil && config != nil && config.Enabled {
		return mp.Configure(config)
	}

	return nil
}

// GetMarketplace returns a marketplace by type
func (s *Service) GetMarketplace(t MarketplaceType) (Marketplace, error) {
	return s.manager.Get(t)
}

// GetAllMarketplaces returns all registered marketplaces
func (s *Service) GetAllMarketplaces() []Marketplace {
	return s.manager.GetAll()
}

// GetEnabledMarketplaces returns all configured/enabled marketplaces
func (s *Service) GetEnabledMarketplaces() []Marketplace {
	all := s.manager.GetAll()
	enabled := make([]Marketplace, 0)
	for _, mp := range all {
		if mp.IsConfigured() {
			enabled = append(enabled, mp)
		}
	}
	return enabled
}

// ConfigureMarketplace configures a marketplace with credentials
func (s *Service) ConfigureMarketplace(ctx context.Context, config *Config) error {
	mp, err := s.manager.Get(config.Type)
	if err != nil {
		return err
	}

	if err := mp.Configure(config); err != nil {
		return err
	}

	return s.repository.SaveConfig(ctx, config)
}

// SyncProducts syncs products to a specific marketplace
func (s *Service) SyncProducts(ctx context.Context, mpType MarketplaceType) (*SyncResult, error) {
	mp, err := s.manager.Get(mpType)
	if err != nil {
		return nil, err
	}

	if !mp.IsConfigured() {
		return nil, ErrMarketplaceNotConfigured
	}

	// Get products for this marketplace
	products, err := s.repository.GetProductsForExport(ctx, mpType)
	if err != nil {
		return nil, err
	}

	// Apply category mappings
	mappings, _ := s.repository.GetCategoryMappings(ctx, mpType)
	categoryMap := make(map[string]string)
	for _, m := range mappings {
		categoryMap[m.ShopCategoryID] = m.MarketplaceCategoryID
	}

	for _, p := range products {
		if mapped, ok := categoryMap[p.CategoryID]; ok {
			p.CategoryID = mapped
		}
	}

	// Export
	result, err := mp.ExportProducts(ctx, products)
	if err != nil {
		return nil, err
	}

	// Save result
	if err := s.repository.SaveSyncResult(ctx, result); err != nil {
		// Log but don't fail
		fmt.Printf("Failed to save sync result: %v\n", err)
	}

	return result, nil
}

// SyncAllProducts syncs products to all enabled marketplaces
func (s *Service) SyncAllProducts(ctx context.Context) map[MarketplaceType]*SyncResult {
	return s.manager.SyncAll(ctx)
}

// SyncOrders imports orders from a specific marketplace
func (s *Service) SyncOrders(ctx context.Context, mpType MarketplaceType) ([]*Order, error) {
	mp, err := s.manager.Get(mpType)
	if err != nil {
		return nil, err
	}

	if !mp.IsConfigured() {
		return nil, ErrMarketplaceNotConfigured
	}

	// Get last sync time
	lastResult, _ := s.repository.GetLastSyncResult(ctx, mpType, SyncImport)
	since := time.Now().AddDate(0, 0, -7) // Default: last 7 days
	if lastResult != nil && lastResult.CompletedAt != nil {
		since = *lastResult.CompletedAt
	}

	// Import orders
	orders, err := mp.ImportOrders(ctx, since)
	if err != nil {
		return nil, err
	}

	// Save orders
	for _, order := range orders {
		// Check if already exists
		existing, _ := s.repository.GetMarketplaceOrder(ctx, order.ExternalID, mpType)
		if existing == nil {
			if err := s.repository.SaveMarketplaceOrder(ctx, order); err != nil {
				fmt.Printf("Failed to save order %s: %v\n", order.ExternalID, err)
			}
		}
	}

	return orders, nil
}

// SyncAllOrders imports orders from all enabled marketplaces
func (s *Service) SyncAllOrders(ctx context.Context) map[MarketplaceType][]*Order {
	results := make(map[MarketplaceType][]*Order)

	for _, mp := range s.GetEnabledMarketplaces() {
		orders, err := s.SyncOrders(ctx, mp.Type())
		if err != nil {
			fmt.Printf("Failed to sync orders from %s: %v\n", mp.Type(), err)
			continue
		}
		results[mp.Type()] = orders
	}

	return results
}

// UpdateStock updates stock on a marketplace
func (s *Service) UpdateStock(ctx context.Context, mpType MarketplaceType, sku string, quantity int) error {
	mp, err := s.manager.Get(mpType)
	if err != nil {
		return err
	}

	if !mp.IsConfigured() {
		return ErrMarketplaceNotConfigured
	}

	return mp.UpdateStock(ctx, sku, quantity)
}

// UpdateStockAll updates stock on all enabled marketplaces
func (s *Service) UpdateStockAll(ctx context.Context, sku string, quantity int) map[MarketplaceType]error {
	results := make(map[MarketplaceType]error)

	for _, mp := range s.GetEnabledMarketplaces() {
		err := mp.UpdateStock(ctx, sku, quantity)
		results[mp.Type()] = err
	}

	return results
}

// UpdatePrice updates price on a marketplace
func (s *Service) UpdatePrice(ctx context.Context, mpType MarketplaceType, sku string, price float64) error {
	mp, err := s.manager.Get(mpType)
	if err != nil {
		return err
	}

	if !mp.IsConfigured() {
		return ErrMarketplaceNotConfigured
	}

	return mp.UpdatePrice(ctx, sku, price)
}

// UpdatePriceAll updates price on all enabled marketplaces
func (s *Service) UpdatePriceAll(ctx context.Context, sku string, price float64) map[MarketplaceType]error {
	results := make(map[MarketplaceType]error)

	for _, mp := range s.GetEnabledMarketplaces() {
		// Apply price markup if configured
		config, _ := s.repository.GetConfig(ctx, mp.Type())
		finalPrice := price
		if config != nil && config.PriceMarkup > 0 {
			finalPrice = price * (1 + config.PriceMarkup/100)
		}

		err := mp.UpdatePrice(ctx, sku, finalPrice)
		results[mp.Type()] = err
	}

	return results
}

// UpdateOrderStatus updates order status on marketplace
func (s *Service) UpdateOrderStatus(ctx context.Context, mpType MarketplaceType, orderID, status string) error {
	mp, err := s.manager.Get(mpType)
	if err != nil {
		return err
	}

	if !mp.IsConfigured() {
		return ErrMarketplaceNotConfigured
	}

	if err := mp.UpdateOrderStatus(ctx, orderID, status); err != nil {
		return err
	}

	return s.repository.UpdateMarketplaceOrderStatus(ctx, orderID, mpType, status)
}

// GetFeed generates and returns a feed for marketplace
func (s *Service) GetFeed(ctx context.Context, mpType MarketplaceType, regenerate bool) ([]byte, error) {
	// Check cache
	if !regenerate {
		s.feedMu.RLock()
		if feed, ok := s.feedCache[mpType]; ok {
			s.feedMu.RUnlock()
			return feed, nil
		}
		s.feedMu.RUnlock()
	}

	mp, err := s.manager.Get(mpType)
	if err != nil {
		return nil, err
	}

	// Get products
	products, err := s.repository.GetProductsForExport(ctx, mpType)
	if err != nil {
		return nil, err
	}

	// Generate feed
	feed, err := mp.GenerateFeed(ctx, products)
	if err != nil {
		return nil, err
	}

	// Cache feed
	s.feedMu.Lock()
	s.feedCache[mpType] = feed
	s.feedMu.Unlock()

	return feed, nil
}

// InvalidateFeedCache clears the feed cache for a marketplace
func (s *Service) InvalidateFeedCache(mpType MarketplaceType) {
	s.feedMu.Lock()
	delete(s.feedCache, mpType)
	s.feedMu.Unlock()
}

// InvalidateAllFeedCaches clears all feed caches
func (s *Service) InvalidateAllFeedCaches() {
	s.feedMu.Lock()
	s.feedCache = make(map[MarketplaceType][]byte)
	s.feedMu.Unlock()
}

// GetCategories gets categories from marketplace
func (s *Service) GetCategories(ctx context.Context, mpType MarketplaceType) ([]Category, error) {
	mp, err := s.manager.Get(mpType)
	if err != nil {
		return nil, err
	}

	return mp.GetCategories(ctx)
}

// SaveCategoryMapping saves a category mapping
func (s *Service) SaveCategoryMapping(ctx context.Context, mpType MarketplaceType, mapping *CategoryMapping) error {
	return s.repository.SaveCategoryMapping(ctx, mpType, mapping)
}

// GetCategoryMappings gets category mappings for a marketplace
func (s *Service) GetCategoryMappings(ctx context.Context, mpType MarketplaceType) ([]CategoryMapping, error) {
	return s.repository.GetCategoryMappings(ctx, mpType)
}

// GetSyncHistory gets sync history for a marketplace
func (s *Service) GetSyncHistory(ctx context.Context, mpType MarketplaceType, limit int) ([]*SyncResult, error) {
	// This would be implemented in the repository
	// For now return the last result
	result, err := s.repository.GetLastSyncResult(ctx, mpType, SyncExport)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return []*SyncResult{}, nil
	}
	return []*SyncResult{result}, nil
}

// GetMarketplaceStatus returns status of all marketplaces
func (s *Service) GetMarketplaceStatus(ctx context.Context) map[MarketplaceType]MarketplaceStatus {
	statuses := make(map[MarketplaceType]MarketplaceStatus)

	for _, mp := range s.manager.GetAll() {
		status := MarketplaceStatus{
			Type:        mp.Type(),
			Configured:  mp.IsConfigured(),
		}

		if mp.IsConfigured() {
			// Get last sync
			lastSync, _ := s.repository.GetLastSyncResult(ctx, mp.Type(), SyncExport)
			if lastSync != nil {
				status.LastSync = lastSync.CompletedAt
				status.LastSyncStatus = lastSync.Status
				status.ProductCount = lastSync.TotalItems
			}

			// Get config
			config, _ := s.repository.GetConfig(ctx, mp.Type())
			if config != nil {
				status.AutoSync = config.AutoSync
				status.SyncInterval = config.SyncInterval
			}
		}

		statuses[mp.Type()] = status
	}

	return statuses
}

// MarketplaceStatus represents the current status of a marketplace integration
type MarketplaceStatus struct {
	Type           MarketplaceType `json:"type"`
	Configured     bool            `json:"configured"`
	AutoSync       bool            `json:"auto_sync"`
	SyncInterval   time.Duration   `json:"sync_interval"`
	LastSync       *time.Time      `json:"last_sync,omitempty"`
	LastSyncStatus SyncStatus      `json:"last_sync_status,omitempty"`
	ProductCount   int             `json:"product_count"`
}

// StartAutoSync starts automatic synchronization for marketplaces
func (s *Service) StartAutoSync(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.checkAndRunAutoSync(ctx)
			}
		}
	}()
}

func (s *Service) checkAndRunAutoSync(ctx context.Context) {
	for _, mp := range s.GetEnabledMarketplaces() {
		config, err := s.repository.GetConfig(ctx, mp.Type())
		if err != nil || !config.AutoSync {
			continue
		}

		// Check if sync is due
		lastSync, _ := s.repository.GetLastSyncResult(ctx, mp.Type(), SyncExport)
		if lastSync != nil && lastSync.CompletedAt != nil {
			if time.Since(*lastSync.CompletedAt) < config.SyncInterval {
				continue
			}
		}

		// Run sync
		_, err = s.SyncProducts(ctx, mp.Type())
		if err != nil {
			fmt.Printf("Auto-sync failed for %s: %v\n", mp.Type(), err)
		}
	}
}
