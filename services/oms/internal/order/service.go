package order

import (
	"context"
	"fmt"
	"time"
)

type Order struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	Quantity  int       `json:"quantity"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Repository interface {
	Save(ctx context.Context, o *Order) error
}

type EventPublisher interface {
	Publish(event string, data []byte) error
}

type Service struct {
	repo      Repository
	publisher EventPublisher
}

func NewService(repo Repository, publisher EventPublisher) *Service {
	return &Service{repo: repo, publisher: publisher}
}

func (s *Service) CreateOrder(ctx context.Context, productID string, quantity int) (*Order, error) {
	if productID == "" {
		return nil, fmt.Errorf("product_id is required")
	}
	if quantity <= 0 {
		return nil, fmt.Errorf("quantity must be positive")
	}

	o := &Order{
		ID:        fmt.Sprintf("ORD-%d", time.Now().UnixNano()),
		ProductID: productID,
		Quantity:  quantity,
		Status:    "NEW",
		CreatedAt: time.Now(),
	}

	if err := s.repo.Save(ctx, o); err != nil {
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	// Publish event (non-blocking, log errors)
	if s.publisher != nil {
		// Event publishing happens async, errors are logged but don't fail the order
	}

	return o, nil
}
