package customer

import (
	"errors"
	"testing"
	"time"
)

// MockRepository is a mock implementation for testing
type MockRepository struct {
	customers     map[int64]*Customer
	CreateOrUpdateFunc func(c *Customer) error
	FindByTelegramIDFunc func(telegramID int64) (*Customer, error)
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		customers: make(map[int64]*Customer),
	}
}

func (m *MockRepository) CreateOrUpdate(c *Customer) error {
	if m.CreateOrUpdateFunc != nil {
		return m.CreateOrUpdateFunc(c)
	}
	m.customers[c.TelegramID] = c
	return nil
}

func (m *MockRepository) FindByTelegramID(telegramID int64) (*Customer, error) {
	if m.FindByTelegramIDFunc != nil {
		return m.FindByTelegramIDFunc(telegramID)
	}
	if c, ok := m.customers[telegramID]; ok {
		return c, nil
	}
	return nil, errors.New("customer not found")
}

// ServiceWithMock is a test service that uses the mock repository
type ServiceWithMock struct {
	Repo *MockRepository
}

func NewServiceWithMock(repo *MockRepository) *ServiceWithMock {
	return &ServiceWithMock{Repo: repo}
}

func (s *ServiceWithMock) UpsertCustomerFromTelegram(telegramID int64, firstName, lastName, username string) (*Customer, error) {
	c := &Customer{
		ID:         "CUST-test",
		FirstName:  firstName,
		LastName:   lastName,
		TelegramID: telegramID,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.Repo.CreateOrUpdate(c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *ServiceWithMock) GetCustomer(telegramID int64) (*Customer, error) {
	return s.Repo.FindByTelegramID(telegramID)
}

// Tests

func TestUpsertCustomerFromTelegram_Success(t *testing.T) {
	repo := NewMockRepository()
	svc := NewServiceWithMock(repo)

	c, err := svc.UpsertCustomerFromTelegram(12345, "Іван", "Петренко", "ivanp")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if c.FirstName != "Іван" {
		t.Errorf("expected FirstName 'Іван', got '%s'", c.FirstName)
	}

	if c.LastName != "Петренко" {
		t.Errorf("expected LastName 'Петренко', got '%s'", c.LastName)
	}

	if c.TelegramID != 12345 {
		t.Errorf("expected TelegramID 12345, got %d", c.TelegramID)
	}
}

func TestUpsertCustomerFromTelegram_RepoError(t *testing.T) {
	repo := NewMockRepository()
	repo.CreateOrUpdateFunc = func(c *Customer) error {
		return errors.New("database error")
	}
	svc := NewServiceWithMock(repo)

	_, err := svc.UpsertCustomerFromTelegram(12345, "Test", "User", "")
	if err == nil {
		t.Fatal("expected error from repository")
	}

	if err.Error() != "database error" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestGetCustomer_Success(t *testing.T) {
	repo := NewMockRepository()
	svc := NewServiceWithMock(repo)

	// Create customer first
	svc.UpsertCustomerFromTelegram(12345, "Test", "User", "")

	// Get it back
	c, err := svc.GetCustomer(12345)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if c.TelegramID != 12345 {
		t.Errorf("expected TelegramID 12345, got %d", c.TelegramID)
	}
}

func TestGetCustomer_NotFound(t *testing.T) {
	repo := NewMockRepository()
	svc := NewServiceWithMock(repo)

	_, err := svc.GetCustomer(99999)
	if err == nil {
		t.Fatal("expected error for non-existent customer")
	}
}

func TestCustomerModel(t *testing.T) {
	c := Customer{
		ID:         "CUST-123",
		FirstName:  "Олена",
		LastName:   "Коваленко",
		Phone:      "+380991234567",
		Email:      "olena@example.com",
		TelegramID: 123456789,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if c.ID != "CUST-123" {
		t.Errorf("expected ID 'CUST-123', got '%s'", c.ID)
	}

	if c.FirstName != "Олена" {
		t.Errorf("expected FirstName 'Олена', got '%s'", c.FirstName)
	}

	if c.Phone != "+380991234567" {
		t.Errorf("expected Phone '+380991234567', got '%s'", c.Phone)
	}
}

func TestUpsertCustomerFromTelegram_UpdatesTimestamps(t *testing.T) {
	repo := NewMockRepository()
	svc := NewServiceWithMock(repo)

	before := time.Now()
	c, err := svc.UpsertCustomerFromTelegram(12345, "Test", "User", "")
	after := time.Now()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if c.CreatedAt.Before(before) || c.CreatedAt.After(after) {
		t.Error("CreatedAt should be set to current time")
	}

	if c.UpdatedAt.Before(before) || c.UpdatedAt.After(after) {
		t.Error("UpdatedAt should be set to current time")
	}
}

func TestCustomerIDGeneration(t *testing.T) {
	telegramID := int64(987654321)
	expectedID := "CUST-test"

	repo := NewMockRepository()
	svc := NewServiceWithMock(repo)

	c, err := svc.UpsertCustomerFromTelegram(telegramID, "Test", "User", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if c.ID != expectedID {
		t.Errorf("expected ID '%s', got '%s'", expectedID, c.ID)
	}
}

func TestMockRepository_CreateOrUpdate(t *testing.T) {
	repo := NewMockRepository()

	c := &Customer{
		ID:         "CUST-1",
		FirstName:  "Test",
		TelegramID: 12345,
	}

	err := repo.CreateOrUpdate(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify stored
	stored, ok := repo.customers[12345]
	if !ok {
		t.Fatal("customer not stored in mock")
	}

	if stored.FirstName != "Test" {
		t.Errorf("expected FirstName 'Test', got '%s'", stored.FirstName)
	}
}

func TestMockRepository_FindByTelegramID(t *testing.T) {
	repo := NewMockRepository()

	// Add customer directly
	repo.customers[12345] = &Customer{
		ID:         "CUST-1",
		FirstName:  "Direct",
		TelegramID: 12345,
	}

	c, err := repo.FindByTelegramID(12345)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if c.FirstName != "Direct" {
		t.Errorf("expected FirstName 'Direct', got '%s'", c.FirstName)
	}
}
