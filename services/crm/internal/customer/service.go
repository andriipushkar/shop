package customer

import (
	"fmt"
	"time"
)

type Service struct {
	Repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) UpsertCustomerFromTelegram(telegramID int64, firstName, lastName, username string) (*Customer, error) {
	c := &Customer{
		ID:         fmt.Sprintf("CUST-%d", telegramID), // Simple ID generation strategy for MVP
		FirstName:  firstName,
		LastName:   lastName,
		TelegramID: telegramID,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Try to find existing first to keep original CreatedAt if needed,
	// but UPSERT in repo handles most of it.
	// For now direct upsert is fine.

	if err := s.Repo.CreateOrUpdate(c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) GetCustomer(telegramID int64) (*Customer, error) {
	return s.Repo.FindByTelegramID(telegramID)
}
