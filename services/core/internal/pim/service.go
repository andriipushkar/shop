package pim

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Category represents a product category
type Category struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// Product represents a simplified product entity
type Product struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	SKU         string    `json:"sku"`
	Stock       int       `json:"stock"`
	ImageURL    string    `json:"image_url,omitempty"`
	CategoryID  string    `json:"category_id,omitempty"`
	Category    *Category `json:"category,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProductFilter contains search and filter parameters
type ProductFilter struct {
	Search     string
	MinPrice   *float64
	MaxPrice   *float64
	CategoryID string
}

// Repository defines the interface for product storage
type Repository interface {
	Save(ctx context.Context, product *Product) error
	GetByID(ctx context.Context, id string) (*Product, error)
	List(ctx context.Context) ([]*Product, error)
	ListWithFilter(ctx context.Context, filter ProductFilter) ([]*Product, error)
	Delete(ctx context.Context, id string) error
	UpdateStock(ctx context.Context, id string, stock int) error
	DecrementStock(ctx context.Context, id string, quantity int) error
}

// CategoryRepository defines the interface for category storage
type CategoryRepository interface {
	SaveCategory(ctx context.Context, category *Category) error
	GetCategoryByID(ctx context.Context, id string) (*Category, error)
	ListCategories(ctx context.Context) ([]*Category, error)
	DeleteCategory(ctx context.Context, id string) error
}

// Service handles PIM business logic
type Service struct {
	repo     Repository
	catRepo  CategoryRepository
}

// NewService creates a new PIM service
func NewService(repo Repository, catRepo CategoryRepository) *Service {
	return &Service{repo: repo, catRepo: catRepo}
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

// ListWithFilter returns products matching the filter
func (s *Service) ListWithFilter(ctx context.Context, filter ProductFilter) ([]*Product, error) {
	return s.repo.ListWithFilter(ctx, filter)
}

func (s *Service) UpdateProduct(ctx context.Context, p *Product) error {
	if p.ID == "" {
		return errors.New("product ID is required for update")
	}
	p.UpdatedAt = time.Now()
	// We can reuse Save for upsert, but we should probably check if it exists if we want strict update behavior.
	// For MVP, Save (Upsert) is acceptable.
	return s.repo.Save(ctx, p)
}

func (s *Service) DeleteProduct(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) GetProduct(ctx context.Context, id string) (*Product, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *Service) UpdateStock(ctx context.Context, id string, stock int) error {
	if stock < 0 {
		return errors.New("stock cannot be negative")
	}
	return s.repo.UpdateStock(ctx, id, stock)
}

func (s *Service) DecrementStock(ctx context.Context, id string, quantity int) error {
	if quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	return s.repo.DecrementStock(ctx, id, quantity)
}

// Category methods

func (s *Service) CreateCategory(ctx context.Context, c *Category) error {
	if c.Name == "" {
		return errors.New("category name is required")
	}
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.CreatedAt = time.Now()
	return s.catRepo.SaveCategory(ctx, c)
}

func (s *Service) ListCategories(ctx context.Context) ([]*Category, error) {
	return s.catRepo.ListCategories(ctx)
}

func (s *Service) GetCategory(ctx context.Context, id string) (*Category, error) {
	return s.catRepo.GetCategoryByID(ctx, id)
}

func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	return s.catRepo.DeleteCategory(ctx, id)
}
