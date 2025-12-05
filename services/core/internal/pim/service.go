package pim

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Product represents a simplified product entity
type Product struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	SKU         string    `json:"sku"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Repository defines the interface for product storage
type Repository interface {
	Save(ctx context.Context, product *Product) error
	GetByID(ctx context.Context, id string) (*Product, error)
	List(ctx context.Context) ([]*Product, error)
}

// Service handles PIM business logic
type Service struct {
	repo Repository
}

// NewService creates a new PIM service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreateProduct creates a new product and validates it
func (s *Service) CreateProduct(ctx context.Context, p *Product) error {
	if p.Name == "" {
		return errors.New("product name is required")
	}
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.Price < 0 {
		return errors.New("product price cannot be negative")
	}
	
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	
	return s.repo.Save(ctx, p)
}

// List returns all products
func (s *Service) List(ctx context.Context) ([]*Product, error) {
	return s.repo.List(ctx)
}
