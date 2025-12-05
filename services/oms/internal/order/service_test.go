package order

import (
	"context"
	"errors"
	"testing"
)

type MockRepository struct {
	SaveFunc func(ctx context.Context, o *Order) error
}

func (m *MockRepository) Save(ctx context.Context, o *Order) error {
	if m.SaveFunc != nil {
		return m.SaveFunc(ctx, o)
	}
	return nil
}

type MockPublisher struct{}

func (m *MockPublisher) Publish(event string, data []byte) error {
	return nil
}

func TestCreateOrder_Success(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo, nil)

	order, err := service.CreateOrder(context.Background(), "product-123", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if order.ID == "" {
		t.Error("expected ID to be generated")
	}

	if order.ProductID != "product-123" {
		t.Errorf("expected ProductID product-123, got %s", order.ProductID)
	}

	if order.Quantity != 2 {
		t.Errorf("expected Quantity 2, got %d", order.Quantity)
	}

	if order.Status != "NEW" {
		t.Errorf("expected Status NEW, got %s", order.Status)
	}
}

func TestCreateOrder_EmptyProductID(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo, nil)

	_, err := service.CreateOrder(context.Background(), "", 1)
	if err == nil {
		t.Fatal("expected error for empty product_id")
	}

	if err.Error() != "product_id is required" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestCreateOrder_ZeroQuantity(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo, nil)

	_, err := service.CreateOrder(context.Background(), "product-123", 0)
	if err == nil {
		t.Fatal("expected error for zero quantity")
	}
}

func TestCreateOrder_NegativeQuantity(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo, nil)

	_, err := service.CreateOrder(context.Background(), "product-123", -5)
	if err == nil {
		t.Fatal("expected error for negative quantity")
	}
}

func TestCreateOrder_RepoError(t *testing.T) {
	repo := &MockRepository{
		SaveFunc: func(ctx context.Context, o *Order) error {
			return errors.New("database error")
		},
	}
	service := NewService(repo, nil)

	_, err := service.CreateOrder(context.Background(), "product-123", 1)
	if err == nil {
		t.Fatal("expected error from repository")
	}
}
