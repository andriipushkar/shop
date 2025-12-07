package pim

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

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
	// Create categories table first (products references it)
	catQuery := `
	CREATE TABLE IF NOT EXISTS categories (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		created_at TIMESTAMP NOT NULL
	);`
	if _, err := r.db.Exec(catQuery); err != nil {
		return err
	}

	query := `
	CREATE TABLE IF NOT EXISTS products (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		price DECIMAL(10, 2) NOT NULL,
		sku TEXT UNIQUE NOT NULL,
		stock INT NOT NULL DEFAULT 0,
		category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);`
	_, err := r.db.Exec(query)
	if err != nil {
		return err
	}
	// Add stock column if it doesn't exist (for existing tables)
	_, _ = r.db.Exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 0`)
	// Add category_id column if it doesn't exist
	_, _ = r.db.Exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id) ON DELETE SET NULL`)
	// Add image_url column if it doesn't exist
	_, _ = r.db.Exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''`)
	return nil
}

func (r *PostgresRepository) Save(ctx context.Context, p *Product) error {
	query := `
	INSERT INTO products (id, name, description, price, sku, stock, image_url, category_id, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, $10)
	ON CONFLICT (id) DO UPDATE SET
		name = EXCLUDED.name,
		description = EXCLUDED.description,
		price = EXCLUDED.price,
		sku = EXCLUDED.sku,
		stock = EXCLUDED.stock,
		image_url = EXCLUDED.image_url,
		category_id = EXCLUDED.category_id,
		updated_at = EXCLUDED.updated_at;
	`
	_, err := r.db.ExecContext(ctx, query, p.ID, p.Name, p.Description, p.Price, p.SKU, p.Stock, p.ImageURL, p.CategoryID, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *PostgresRepository) GetByID(ctx context.Context, id string) (*Product, error) {
	query := `
		SELECT p.id, p.name, p.description, p.price, p.sku, p.stock, COALESCE(p.image_url, ''), COALESCE(p.category_id, ''), p.created_at, p.updated_at,
		       c.id, c.name, c.created_at
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.id = $1`
	row := r.db.QueryRowContext(ctx, query, id)

	var p Product
	var catID, catName sql.NullString
	var catCreatedAt sql.NullTime
	if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.SKU, &p.Stock, &p.ImageURL, &p.CategoryID, &p.CreatedAt, &p.UpdatedAt,
		&catID, &catName, &catCreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("product not found")
		}
		return nil, err
	}
	if catID.Valid {
		p.Category = &Category{ID: catID.String, Name: catName.String, CreatedAt: catCreatedAt.Time}
	}
	return &p, nil
}

func (r *PostgresRepository) List(ctx context.Context) ([]*Product, error) {
	query := `
		SELECT p.id, p.name, p.description, p.price, p.sku, p.stock, COALESCE(p.image_url, ''), COALESCE(p.category_id, ''), p.created_at, p.updated_at,
		       c.id, c.name, c.created_at
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		ORDER BY p.created_at DESC`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*Product
	for rows.Next() {
		var p Product
		var catID, catName sql.NullString
		var catCreatedAt sql.NullTime
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.SKU, &p.Stock, &p.ImageURL, &p.CategoryID, &p.CreatedAt, &p.UpdatedAt,
			&catID, &catName, &catCreatedAt); err != nil {
			return nil, err
		}
		if catID.Valid {
			p.Category = &Category{ID: catID.String, Name: catName.String, CreatedAt: catCreatedAt.Time}
		}
		products = append(products, &p)
	}
	return products, rows.Err()
}

func (r *PostgresRepository) ListWithFilter(ctx context.Context, filter ProductFilter) ([]*Product, error) {
	query := `
		SELECT p.id, p.name, p.description, p.price, p.sku, p.stock, COALESCE(p.image_url, ''), COALESCE(p.category_id, ''), p.created_at, p.updated_at,
		       c.id, c.name, c.created_at
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE 1=1`
	var args []interface{}
	argNum := 1

	if filter.Search != "" {
		query += fmt.Sprintf(" AND (LOWER(p.name) LIKE LOWER($%d) OR LOWER(p.sku) LIKE LOWER($%d))", argNum, argNum)
		args = append(args, "%"+filter.Search+"%")
		argNum++
	}

	if filter.MinPrice != nil {
		query += fmt.Sprintf(" AND p.price >= $%d", argNum)
		args = append(args, *filter.MinPrice)
		argNum++
	}

	if filter.MaxPrice != nil {
		query += fmt.Sprintf(" AND p.price <= $%d", argNum)
		args = append(args, *filter.MaxPrice)
		argNum++
	}

	if filter.CategoryID != "" {
		query += fmt.Sprintf(" AND p.category_id = $%d", argNum)
		args = append(args, filter.CategoryID)
		argNum++
	}

	query += " ORDER BY p.created_at DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*Product
	for rows.Next() {
		var p Product
		var catID, catName sql.NullString
		var catCreatedAt sql.NullTime
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.SKU, &p.Stock, &p.ImageURL, &p.CategoryID, &p.CreatedAt, &p.UpdatedAt,
			&catID, &catName, &catCreatedAt); err != nil {
			return nil, err
		}
		if catID.Valid {
			p.Category = &Category{ID: catID.String, Name: catName.String, CreatedAt: catCreatedAt.Time}
		}
		products = append(products, &p)
	}
	return products, rows.Err()
}

func (r *PostgresRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM products WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("product not found")
	}
	return nil
}

func (r *PostgresRepository) UpdateStock(ctx context.Context, id string, stock int) error {
	query := `UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2`
	result, err := r.db.ExecContext(ctx, query, stock, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("product not found")
	}
	return nil
}

func (r *PostgresRepository) DecrementStock(ctx context.Context, id string, quantity int) error {
	query := `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1`
	result, err := r.db.ExecContext(ctx, query, quantity, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("insufficient stock or product not found")
	}
	return nil
}

// Category methods

func (r *PostgresRepository) SaveCategory(ctx context.Context, c *Category) error {
	query := `
	INSERT INTO categories (id, name, created_at)
	VALUES ($1, $2, $3)
	ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
	`
	_, err := r.db.ExecContext(ctx, query, c.ID, c.Name, c.CreatedAt)
	return err
}

func (r *PostgresRepository) GetCategoryByID(ctx context.Context, id string) (*Category, error) {
	query := `SELECT id, name, created_at FROM categories WHERE id = $1`
	row := r.db.QueryRowContext(ctx, query, id)

	var c Category
	if err := row.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	return &c, nil
}

func (r *PostgresRepository) ListCategories(ctx context.Context) ([]*Category, error) {
	query := `SELECT id, name, created_at FROM categories ORDER BY name`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, &c)
	}
	return categories, rows.Err()
}

func (r *PostgresRepository) DeleteCategory(ctx context.Context, id string) error {
	query := `DELETE FROM categories WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("category not found")
	}
	return nil
}
