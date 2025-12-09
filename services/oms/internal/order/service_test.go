package order

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// MockRepository implements Repository interface for testing
type MockRepository struct {
	SaveFunc func(ctx context.Context, o *Order) error
	orders   map[string]*Order
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		orders: make(map[string]*Order),
	}
}

func (m *MockRepository) Save(ctx context.Context, o *Order) error {
	if m.SaveFunc != nil {
		return m.SaveFunc(ctx, o)
	}
	m.orders[o.ID] = o
	return nil
}

// MockEventPublisher implements EventPublisher interface for testing
type MockEventPublisher struct {
	PublishFunc func(event string, data []byte) error
	events      []struct {
		Event string
		Data  []byte
	}
}

func NewMockEventPublisher() *MockEventPublisher {
	return &MockEventPublisher{}
}

func (m *MockEventPublisher) Publish(event string, data []byte) error {
	if m.PublishFunc != nil {
		return m.PublishFunc(event, data)
	}
	m.events = append(m.events, struct {
		Event string
		Data  []byte
	}{event, data})
	return nil
}

func TestOrder_Fields(t *testing.T) {
	order := Order{
		ID:        "ORD-123",
		ProductID: "PROD-456",
		Quantity:  5,
		Status:    "NEW",
	}

	if order.ID != "ORD-123" {
		t.Errorf("expected ID 'ORD-123', got '%s'", order.ID)
	}
	if order.ProductID != "PROD-456" {
		t.Errorf("expected ProductID 'PROD-456', got '%s'", order.ProductID)
	}
	if order.Quantity != 5 {
		t.Errorf("expected Quantity 5, got %d", order.Quantity)
	}
	if order.Status != "NEW" {
		t.Errorf("expected Status 'NEW', got '%s'", order.Status)
	}
}

func TestNewService(t *testing.T) {
	repo := NewMockRepository()
	publisher := NewMockEventPublisher()

	service := NewService(repo, publisher)

	if service == nil {
		t.Fatal("expected non-nil service")
	}
	if service.repo != repo {
		t.Error("expected repo to be set")
	}
	if service.publisher != publisher {
		t.Error("expected publisher to be set")
	}
}

func TestNewService_NilPublisher(t *testing.T) {
	repo := NewMockRepository()

	service := NewService(repo, nil)

	if service == nil {
		t.Fatal("expected non-nil service")
	}
	if service.publisher != nil {
		t.Error("expected nil publisher")
	}
}

func TestService_CreateOrder_Success(t *testing.T) {
	repo := NewMockRepository()
	publisher := NewMockEventPublisher()
	service := NewService(repo, publisher)

	order, err := service.CreateOrder(context.Background(), "PROD-123", 2)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if order == nil {
		t.Fatal("expected non-nil order")
	}
	if !strings.HasPrefix(order.ID, "ORD-") {
		t.Errorf("expected order ID to start with 'ORD-', got '%s'", order.ID)
	}
	if order.ProductID != "PROD-123" {
		t.Errorf("expected ProductID 'PROD-123', got '%s'", order.ProductID)
	}
	if order.Quantity != 2 {
		t.Errorf("expected Quantity 2, got %d", order.Quantity)
	}
	if order.Status != "NEW" {
		t.Errorf("expected Status 'NEW', got '%s'", order.Status)
	}
	if order.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set")
	}

	// Verify order was saved
	if len(repo.orders) != 1 {
		t.Errorf("expected 1 order in repo, got %d", len(repo.orders))
	}
}

func TestService_CreateOrder_EmptyProductID(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	order, err := service.CreateOrder(context.Background(), "", 1)

	if err == nil {
		t.Fatal("expected error for empty product ID")
	}
	if order != nil {
		t.Error("expected nil order on error")
	}
	if !strings.Contains(err.Error(), "product_id is required") {
		t.Errorf("expected 'product_id is required' error, got '%s'", err.Error())
	}
}

func TestService_CreateOrder_ZeroQuantity(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	order, err := service.CreateOrder(context.Background(), "PROD-123", 0)

	if err == nil {
		t.Fatal("expected error for zero quantity")
	}
	if order != nil {
		t.Error("expected nil order on error")
	}
	if !strings.Contains(err.Error(), "quantity must be positive") {
		t.Errorf("expected 'quantity must be positive' error, got '%s'", err.Error())
	}
}

func TestService_CreateOrder_NegativeQuantity(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	order, err := service.CreateOrder(context.Background(), "PROD-123", -5)

	if err == nil {
		t.Fatal("expected error for negative quantity")
	}
	if order != nil {
		t.Error("expected nil order on error")
	}
	if !strings.Contains(err.Error(), "quantity must be positive") {
		t.Errorf("expected 'quantity must be positive' error, got '%s'", err.Error())
	}
}

func TestService_CreateOrder_RepoError(t *testing.T) {
	repo := NewMockRepository()
	repo.SaveFunc = func(ctx context.Context, o *Order) error {
		return errors.New("database connection failed")
	}
	service := NewService(repo, nil)

	order, err := service.CreateOrder(context.Background(), "PROD-123", 1)

	if err == nil {
		t.Fatal("expected error when repo fails")
	}
	if order != nil {
		t.Error("expected nil order on error")
	}
	if !strings.Contains(err.Error(), "failed to save order") {
		t.Errorf("expected 'failed to save order' error, got '%s'", err.Error())
	}
}

func TestService_CreateOrder_ContextCanceled(t *testing.T) {
	repo := NewMockRepository()
	repo.SaveFunc = func(ctx context.Context, o *Order) error {
		return ctx.Err()
	}
	service := NewService(repo, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	order, err := service.CreateOrder(ctx, "PROD-123", 1)

	if err == nil {
		t.Fatal("expected error when context canceled")
	}
	if order != nil {
		t.Error("expected nil order on error")
	}
}

func TestService_CreateOrder_UniqueIDs(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo, nil)

	order1, err := service.CreateOrder(context.Background(), "PROD-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	order2, err := service.CreateOrder(context.Background(), "PROD-2", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if order1.ID == order2.ID {
		t.Error("expected unique order IDs")
	}
}

func TestService_CreateOrder_WithPublisher(t *testing.T) {
	repo := NewMockRepository()
	publisher := NewMockEventPublisher()
	service := NewService(repo, publisher)

	order, err := service.CreateOrder(context.Background(), "PROD-123", 3)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if order == nil {
		t.Fatal("expected non-nil order")
	}
}

func TestMockRepository_Save(t *testing.T) {
	repo := NewMockRepository()
	order := &Order{
		ID:        "ORD-TEST",
		ProductID: "PROD-1",
		Quantity:  1,
		Status:    "NEW",
	}

	err := repo.Save(context.Background(), order)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.orders["ORD-TEST"] == nil {
		t.Error("expected order to be saved")
	}
}

func TestMockEventPublisher_Publish(t *testing.T) {
	publisher := NewMockEventPublisher()

	err := publisher.Publish("order.created", []byte(`{"id":"ORD-123"}`))

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(publisher.events) != 1 {
		t.Errorf("expected 1 event, got %d", len(publisher.events))
	}
	if publisher.events[0].Event != "order.created" {
		t.Errorf("expected event 'order.created', got '%s'", publisher.events[0].Event)
	}
}
