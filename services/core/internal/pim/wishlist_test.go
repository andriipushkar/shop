package pim

import (
	"context"
	"testing"
	"time"
)

// MockWishlistRepository is a mock implementation for testing
type MockWishlistRepository struct {
	items map[int64]map[string]*WishlistItem
}

func NewMockWishlistRepository() *MockWishlistRepository {
	return &MockWishlistRepository{
		items: make(map[int64]map[string]*WishlistItem),
	}
}

func (m *MockWishlistRepository) AddToWishlist(ctx context.Context, item *WishlistItem) error {
	if m.items[item.UserID] == nil {
		m.items[item.UserID] = make(map[string]*WishlistItem)
	}
	m.items[item.UserID][item.ProductID] = item
	return nil
}

func (m *MockWishlistRepository) GetWishlist(ctx context.Context, userID int64) ([]*WishlistItem, error) {
	var result []*WishlistItem
	if userItems, ok := m.items[userID]; ok {
		for _, item := range userItems {
			result = append(result, item)
		}
	}
	return result, nil
}

func (m *MockWishlistRepository) RemoveFromWishlist(ctx context.Context, userID int64, productID string) error {
	if userItems, ok := m.items[userID]; ok {
		delete(userItems, productID)
	}
	return nil
}

func (m *MockWishlistRepository) ClearWishlist(ctx context.Context, userID int64) error {
	delete(m.items, userID)
	return nil
}

func (m *MockWishlistRepository) IsInWishlist(ctx context.Context, userID int64, productID string) (bool, error) {
	if userItems, ok := m.items[userID]; ok {
		_, exists := userItems[productID]
		return exists, nil
	}
	return false, nil
}

func TestWishlistItem_Fields(t *testing.T) {
	item := WishlistItem{
		UserID:    12345,
		ProductID: "prod-001",
		Name:      "Test Product",
		Price:     99.99,
		ImageURL:  "https://example.com/image.jpg",
		AddedAt:   time.Now(),
	}

	if item.UserID != 12345 {
		t.Errorf("Expected UserID 12345, got %d", item.UserID)
	}
	if item.ProductID != "prod-001" {
		t.Errorf("Expected ProductID 'prod-001', got '%s'", item.ProductID)
	}
	if item.Price != 99.99 {
		t.Errorf("Expected Price 99.99, got %f", item.Price)
	}
}

func TestMockWishlistRepository_AddToWishlist(t *testing.T) {
	repo := NewMockWishlistRepository()
	ctx := context.Background()

	item := &WishlistItem{
		UserID:    12345,
		ProductID: "prod-001",
		Name:      "Test Product",
		Price:     99.99,
		AddedAt:   time.Now(),
	}

	err := repo.AddToWishlist(ctx, item)
	if err != nil {
		t.Fatalf("AddToWishlist failed: %v", err)
	}

	// Verify item exists
	exists, err := repo.IsInWishlist(ctx, 12345, "prod-001")
	if err != nil {
		t.Fatalf("IsInWishlist failed: %v", err)
	}
	if !exists {
		t.Error("Expected item to exist in wishlist")
	}
}

func TestMockWishlistRepository_GetWishlist(t *testing.T) {
	repo := NewMockWishlistRepository()
	ctx := context.Background()

	// Add multiple items
	items := []*WishlistItem{
		{UserID: 12345, ProductID: "prod-001", Name: "Product 1", Price: 10.00, AddedAt: time.Now()},
		{UserID: 12345, ProductID: "prod-002", Name: "Product 2", Price: 20.00, AddedAt: time.Now()},
		{UserID: 12345, ProductID: "prod-003", Name: "Product 3", Price: 30.00, AddedAt: time.Now()},
	}

	for _, item := range items {
		repo.AddToWishlist(ctx, item)
	}

	// Get wishlist
	wishlist, err := repo.GetWishlist(ctx, 12345)
	if err != nil {
		t.Fatalf("GetWishlist failed: %v", err)
	}

	if len(wishlist) != 3 {
		t.Errorf("Expected 3 items in wishlist, got %d", len(wishlist))
	}
}

func TestMockWishlistRepository_RemoveFromWishlist(t *testing.T) {
	repo := NewMockWishlistRepository()
	ctx := context.Background()

	// Add item
	item := &WishlistItem{
		UserID:    12345,
		ProductID: "prod-001",
		Name:      "Test Product",
		Price:     99.99,
		AddedAt:   time.Now(),
	}
	repo.AddToWishlist(ctx, item)

	// Remove item
	err := repo.RemoveFromWishlist(ctx, 12345, "prod-001")
	if err != nil {
		t.Fatalf("RemoveFromWishlist failed: %v", err)
	}

	// Verify item is gone
	exists, _ := repo.IsInWishlist(ctx, 12345, "prod-001")
	if exists {
		t.Error("Expected item to be removed from wishlist")
	}
}

func TestMockWishlistRepository_ClearWishlist(t *testing.T) {
	repo := NewMockWishlistRepository()
	ctx := context.Background()

	// Add multiple items
	items := []*WishlistItem{
		{UserID: 12345, ProductID: "prod-001", Name: "Product 1", Price: 10.00, AddedAt: time.Now()},
		{UserID: 12345, ProductID: "prod-002", Name: "Product 2", Price: 20.00, AddedAt: time.Now()},
	}

	for _, item := range items {
		repo.AddToWishlist(ctx, item)
	}

	// Clear wishlist
	err := repo.ClearWishlist(ctx, 12345)
	if err != nil {
		t.Fatalf("ClearWishlist failed: %v", err)
	}

	// Verify wishlist is empty
	wishlist, _ := repo.GetWishlist(ctx, 12345)
	if len(wishlist) != 0 {
		t.Errorf("Expected empty wishlist, got %d items", len(wishlist))
	}
}

func TestMockWishlistRepository_IsInWishlist(t *testing.T) {
	repo := NewMockWishlistRepository()
	ctx := context.Background()

	// Item not in wishlist
	exists, err := repo.IsInWishlist(ctx, 12345, "prod-001")
	if err != nil {
		t.Fatalf("IsInWishlist failed: %v", err)
	}
	if exists {
		t.Error("Expected item not to exist in wishlist")
	}

	// Add item
	item := &WishlistItem{
		UserID:    12345,
		ProductID: "prod-001",
		Name:      "Test Product",
		Price:     99.99,
		AddedAt:   time.Now(),
	}
	repo.AddToWishlist(ctx, item)

	// Item in wishlist
	exists, err = repo.IsInWishlist(ctx, 12345, "prod-001")
	if err != nil {
		t.Fatalf("IsInWishlist failed: %v", err)
	}
	if !exists {
		t.Error("Expected item to exist in wishlist")
	}
}

func TestMockWishlistRepository_MultipleUsers(t *testing.T) {
	repo := NewMockWishlistRepository()
	ctx := context.Background()

	// Add items for different users
	items := []*WishlistItem{
		{UserID: 1, ProductID: "prod-001", Name: "Product 1", Price: 10.00, AddedAt: time.Now()},
		{UserID: 1, ProductID: "prod-002", Name: "Product 2", Price: 20.00, AddedAt: time.Now()},
		{UserID: 2, ProductID: "prod-001", Name: "Product 1", Price: 10.00, AddedAt: time.Now()},
	}

	for _, item := range items {
		repo.AddToWishlist(ctx, item)
	}

	// User 1 should have 2 items
	wishlist1, _ := repo.GetWishlist(ctx, 1)
	if len(wishlist1) != 2 {
		t.Errorf("Expected user 1 to have 2 items, got %d", len(wishlist1))
	}

	// User 2 should have 1 item
	wishlist2, _ := repo.GetWishlist(ctx, 2)
	if len(wishlist2) != 1 {
		t.Errorf("Expected user 2 to have 1 item, got %d", len(wishlist2))
	}

	// Clear user 1's wishlist
	repo.ClearWishlist(ctx, 1)

	// User 1's wishlist should be empty
	wishlist1After, _ := repo.GetWishlist(ctx, 1)
	if len(wishlist1After) != 0 {
		t.Errorf("Expected user 1 to have 0 items after clear, got %d", len(wishlist1After))
	}

	// User 2's wishlist should be unaffected
	wishlist2After, _ := repo.GetWishlist(ctx, 2)
	if len(wishlist2After) != 1 {
		t.Errorf("Expected user 2 to still have 1 item, got %d", len(wishlist2After))
	}
}

func TestWishlistService_AddToWishlist_NoRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	err := service.AddToWishlist(ctx, 12345, "prod-001")
	if err == nil {
		t.Error("Expected error when wishlist repository is not configured")
	}
}

func TestWishlistService_GetWishlist_NoRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	_, err := service.GetWishlist(ctx, 12345)
	if err == nil {
		t.Error("Expected error when wishlist repository is not configured")
	}
}

func TestWishlistService_RemoveFromWishlist_NoRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	err := service.RemoveFromWishlist(ctx, 12345, "prod-001")
	if err == nil {
		t.Error("Expected error when wishlist repository is not configured")
	}
}

func TestWishlistService_ClearWishlist_NoRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	err := service.ClearWishlist(ctx, 12345)
	if err == nil {
		t.Error("Expected error when wishlist repository is not configured")
	}
}

func TestWishlistService_IsInWishlist_NoRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	_, err := service.IsInWishlist(ctx, 12345, "prod-001")
	if err == nil {
		t.Error("Expected error when wishlist repository is not configured")
	}
}

func TestWishlistService_MoveWishlistToCart_NoWishlistRepo(t *testing.T) {
	service := NewService(nil, nil)
	ctx := context.Background()

	err := service.MoveWishlistToCart(ctx, 12345, "prod-001")
	if err == nil {
		t.Error("Expected error when wishlist repository is not configured")
	}
}

func TestWishlistService_MoveWishlistToCart_NoCartRepo(t *testing.T) {
	service := NewService(nil, nil)
	service.SetWishlistRepository(NewMockWishlistRepository())
	ctx := context.Background()

	err := service.MoveWishlistToCart(ctx, 12345, "prod-001")
	if err == nil {
		t.Error("Expected error when cart repository is not configured")
	}
}
