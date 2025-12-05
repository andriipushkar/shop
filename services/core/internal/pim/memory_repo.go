package pim

import (
	"context"
	"errors"
	"sync"
)

// MemoryRepository is an in-memory implementation of Repository
type MemoryRepository struct {
	mu       sync.RWMutex
	products map[string]*Product
}

// NewMemoryRepository creates a new in-memory repository
func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		products: make(map[string]*Product),
	}
}

// Save saves a product to memory
func (r *MemoryRepository) Save(ctx context.Context, product *Product) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if product.ID == "" {
		return errors.New("product ID is required")
	}
	
	r.products[product.ID] = product
	return nil
}

// GetByID retrieves a product by ID
func (r *MemoryRepository) GetByID(ctx context.Context, id string) (*Product, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	if p, ok := r.products[id]; ok {
		return p, nil
	}
	
	return nil, errors.New("product not found")
}

// List returns all products
func (r *MemoryRepository) List(ctx context.Context) ([]*Product, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	products := make([]*Product, 0, len(r.products))
	for _, p := range r.products {
		products = append(products, p)
	}
	
	return products, nil
}
