package pim

import (
	"context"
	"database/sql"
	"errors"
	
	_ "github.com/lib/pq"
)

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) (*PostgresRepository, error) {
	repo := &PostgresRepository{db: db}
	if err := repo.init(); err != nil {
		return nil, err
	}
	return repo, nil
}

func (r *PostgresRepository) init() error {
	query := `
	CREATE TABLE IF NOT EXISTS products (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		price DECIMAL(10, 2) NOT NULL,
		sku TEXT UNIQUE NOT NULL,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);`
	_, err := r.db.Exec(query)
	return err
}

func (r *PostgresRepository) Save(ctx context.Context, p *Product) error {
	query := `
	INSERT INTO products (id, name, description, price, sku, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (id) DO UPDATE SET
		name = EXCLUDED.name,
		description = EXCLUDED.description,
		price = EXCLUDED.price,
		sku = EXCLUDED.sku,
		updated_at = EXCLUDED.updated_at;
	`
	_, err := r.db.ExecContext(ctx, query, p.ID, p.Name, p.Description, p.Price, p.SKU, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *PostgresRepository) GetByID(ctx context.Context, id string) (*Product, error) {
	query := `SELECT id, name, description, price, sku, created_at, updated_at FROM products WHERE id = $1`
	row := r.db.QueryRowContext(ctx, query, id)

	var p Product
	if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.SKU, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("product not found")
		}
		return nil, err
	}
	return &p, nil
}

func (r *PostgresRepository) List(ctx context.Context) ([]*Product, error) {
	query := `SELECT id, name, description, price, sku, created_at, updated_at FROM products ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.SKU, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		products = append(products, &p)
	}
	return products, rows.Err()
}
