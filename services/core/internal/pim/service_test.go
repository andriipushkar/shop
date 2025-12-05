package pim

import (
	"context"
	"errors"
	"testing"
)

// MockRepository is a mock implementation of Repository for testing
type MockRepository struct {
	SaveFunc    func(ctx context.Context, p *Product) error
	GetByIDFunc func(ctx context.Context, id string) (*Product, error)
	ListFunc    func(ctx context.Context) ([]*Product, error)
}

func (m *MockRepository) Save(ctx context.Context, p *Product) error {
	if m.SaveFunc != nil {
		return m.SaveFunc(ctx, p)
	}
	return nil
}

func (m *MockRepository) GetByID(ctx context.Context, id string) (*Product, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockRepository) List(ctx context.Context) ([]*Product, error) {
	if m.ListFunc != nil {
		return m.ListFunc(ctx)
	}
	return nil, nil
}

func TestCreateProduct_Success(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo)

	p := &Product{
		Name:  "Test Product",
		Price: 100.0,
		SKU:   "TEST-001",
	}

	err := service.CreateProduct(context.Background(), p)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if p.ID == "" {
		t.Error("expected ID to be generated")
	}

	if p.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set")
	}
}

func TestCreateProduct_NameRequired(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo)

	p := &Product{
		Name:  "",
		Price: 100.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "product name is required" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestCreateProduct_NegativePrice(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo)

	p := &Product{
		Name:  "Test",
		Price: -50.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err == nil {
		t.Fatal("expected error for negative price")
	}

	if err.Error() != "product price cannot be negative" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestCreateProduct_PreservesExistingID(t *testing.T) {
	repo := &MockRepository{}
	service := NewService(repo)

	existingID := "existing-id-123"
	p := &Product{
		ID:    existingID,
		Name:  "Test",
		Price: 100.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if p.ID != existingID {
		t.Errorf("expected ID to remain %s, got %s", existingID, p.ID)
	}
}

func TestCreateProduct_RepoError(t *testing.T) {
	repo := &MockRepository{
		SaveFunc: func(ctx context.Context, p *Product) error {
			return errors.New("database error")
		},
	}
	service := NewService(repo)

	p := &Product{
		Name:  "Test",
		Price: 100.0,
	}

	err := service.CreateProduct(context.Background(), p)
	if err == nil {
		t.Fatal("expected error from repository")
	}

	if err.Error() != "database error" {
		t.Errorf("unexpected error: %v", err)
	}
}
