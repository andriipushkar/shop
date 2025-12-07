package customer

import (
	"database/sql"
)

type Repository struct {
	DB *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{DB: db}
}

func (r *Repository) InitDB() error {
	query := `
	CREATE TABLE IF NOT EXISTS customers (
		id TEXT PRIMARY KEY,
		first_name TEXT,
		last_name TEXT,
		phone TEXT,
		email TEXT,
		telegram_id BIGINT UNIQUE,
		created_at TIMESTAMP,
		updated_at TIMESTAMP
	);`
	_, err := r.DB.Exec(query)
	return err
}

func (r *Repository) CreateOrUpdate(c *Customer) error {
	query := `
	INSERT INTO customers (id, first_name, last_name, phone, email, telegram_id, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	ON CONFLICT (telegram_id) DO UPDATE SET
		first_name = EXCLUDED.first_name,
		last_name = EXCLUDED.last_name,
		phone = EXCLUDED.phone,
		email = EXCLUDED.email,
		updated_at = EXCLUDED.updated_at
	RETURNING id;`

	row := r.DB.QueryRow(query, c.ID, c.FirstName, c.LastName, c.Phone, c.Email, c.TelegramID, c.CreatedAt, c.UpdatedAt)
	return row.Scan(&c.ID)
}

func (r *Repository) FindByTelegramID(telegramID int64) (*Customer, error) {
	query := `SELECT id, first_name, last_name, phone, email, telegram_id, created_at, updated_at FROM customers WHERE telegram_id = $1`
	row := r.DB.QueryRow(query, telegramID)

	var c Customer
	err := row.Scan(&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.TelegramID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
