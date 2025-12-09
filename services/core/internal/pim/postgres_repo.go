package pim

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

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

	// Create cart_items table
	cartQuery := `
	CREATE TABLE IF NOT EXISTS cart_items (
		user_id BIGINT NOT NULL,
		product_id TEXT NOT NULL,
		name TEXT NOT NULL,
		price DECIMAL(10, 2) NOT NULL,
		quantity INT NOT NULL DEFAULT 1,
		image_url TEXT DEFAULT '',
		added_at TIMESTAMP NOT NULL,
		PRIMARY KEY (user_id, product_id)
	);`
	_, _ = r.db.Exec(cartQuery)

	// Create wishlist_items table
	wishlistQuery := `
	CREATE TABLE IF NOT EXISTS wishlist_items (
		user_id BIGINT NOT NULL,
		product_id TEXT NOT NULL,
		name TEXT NOT NULL,
		price DECIMAL(10, 2) NOT NULL,
		image_url TEXT DEFAULT '',
		added_at TIMESTAMP NOT NULL,
		PRIMARY KEY (user_id, product_id)
	);`
	_, _ = r.db.Exec(wishlistQuery)

	// Create price_history table
	priceHistoryQuery := `
	CREATE TABLE IF NOT EXISTS price_history (
		id TEXT PRIMARY KEY,
		product_id TEXT NOT NULL,
		old_price DECIMAL(10, 2) NOT NULL,
		new_price DECIMAL(10, 2) NOT NULL,
		changed_at TIMESTAMP NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
	CREATE INDEX IF NOT EXISTS idx_price_history_changed_at ON price_history(changed_at DESC);
	`
	_, _ = r.db.Exec(priceHistoryQuery)

	// Create reviews table
	reviewsQuery := `
	CREATE TABLE IF NOT EXISTS reviews (
		id TEXT PRIMARY KEY,
		product_id TEXT NOT NULL,
		user_id BIGINT NOT NULL,
		user_name TEXT NOT NULL DEFAULT '',
		rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
		comment TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMP NOT NULL,
		UNIQUE (product_id, user_id)
	);
	CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
	CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
	CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
	`
	_, _ = r.db.Exec(reviewsQuery)

	// Create sales_records table for analytics
	salesQuery := `
	CREATE TABLE IF NOT EXISTS sales_records (
		id TEXT PRIMARY KEY,
		product_id TEXT NOT NULL,
		quantity INT NOT NULL,
		price DECIMAL(10, 2) NOT NULL,
		total_value DECIMAL(10, 2) NOT NULL,
		user_id BIGINT,
		order_id TEXT,
		created_at TIMESTAMP NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales_records(product_id);
	CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales_records(created_at);
	CREATE INDEX IF NOT EXISTS idx_sales_order_id ON sales_records(order_id);
	`
	_, _ = r.db.Exec(salesQuery)

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

func (r *PostgresRepository) UpdateImage(ctx context.Context, id string, imageURL string) error {
	query := `UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2`
	result, err := r.db.ExecContext(ctx, query, imageURL, id)
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

// Cart methods

func (r *PostgresRepository) AddToCart(ctx context.Context, item *CartItem) error {
	query := `
	INSERT INTO cart_items (user_id, product_id, name, price, quantity, image_url, added_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (user_id, product_id) DO UPDATE SET
		quantity = cart_items.quantity + EXCLUDED.quantity,
		price = EXCLUDED.price,
		name = EXCLUDED.name,
		image_url = EXCLUDED.image_url;
	`
	_, err := r.db.ExecContext(ctx, query, item.UserID, item.ProductID, item.Name, item.Price, item.Quantity, item.ImageURL, item.AddedAt)
	return err
}

func (r *PostgresRepository) GetCart(ctx context.Context, userID int64) ([]*CartItem, error) {
	query := `SELECT user_id, product_id, name, price, quantity, COALESCE(image_url, ''), added_at
		FROM cart_items WHERE user_id = $1 ORDER BY added_at DESC`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*CartItem
	for rows.Next() {
		var item CartItem
		if err := rows.Scan(&item.UserID, &item.ProductID, &item.Name, &item.Price, &item.Quantity, &item.ImageURL, &item.AddedAt); err != nil {
			return nil, err
		}
		items = append(items, &item)
	}
	return items, rows.Err()
}

func (r *PostgresRepository) RemoveFromCart(ctx context.Context, userID int64, productID string) error {
	query := `DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`
	_, err := r.db.ExecContext(ctx, query, userID, productID)
	return err
}

func (r *PostgresRepository) ClearCart(ctx context.Context, userID int64) error {
	query := `DELETE FROM cart_items WHERE user_id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *PostgresRepository) UpdateCartItemQuantity(ctx context.Context, userID int64, productID string, quantity int) error {
	query := `UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3`
	result, err := r.db.ExecContext(ctx, query, quantity, userID, productID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("cart item not found")
	}
	return nil
}

// Wishlist methods

func (r *PostgresRepository) AddToWishlist(ctx context.Context, item *WishlistItem) error {
	query := `
	INSERT INTO wishlist_items (user_id, product_id, name, price, image_url, added_at)
	VALUES ($1, $2, $3, $4, $5, $6)
	ON CONFLICT (user_id, product_id) DO NOTHING;
	`
	_, err := r.db.ExecContext(ctx, query, item.UserID, item.ProductID, item.Name, item.Price, item.ImageURL, item.AddedAt)
	return err
}

func (r *PostgresRepository) GetWishlist(ctx context.Context, userID int64) ([]*WishlistItem, error) {
	query := `SELECT user_id, product_id, name, price, COALESCE(image_url, ''), added_at
		FROM wishlist_items WHERE user_id = $1 ORDER BY added_at DESC`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*WishlistItem
	for rows.Next() {
		var item WishlistItem
		if err := rows.Scan(&item.UserID, &item.ProductID, &item.Name, &item.Price, &item.ImageURL, &item.AddedAt); err != nil {
			return nil, err
		}
		items = append(items, &item)
	}
	return items, rows.Err()
}

func (r *PostgresRepository) RemoveFromWishlist(ctx context.Context, userID int64, productID string) error {
	query := `DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`
	_, err := r.db.ExecContext(ctx, query, userID, productID)
	return err
}

func (r *PostgresRepository) ClearWishlist(ctx context.Context, userID int64) error {
	query := `DELETE FROM wishlist_items WHERE user_id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *PostgresRepository) IsInWishlist(ctx context.Context, userID int64, productID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM wishlist_items WHERE user_id = $1 AND product_id = $2)`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, userID, productID).Scan(&exists)
	return exists, err
}

// Price history methods

func (r *PostgresRepository) RecordPriceChange(ctx context.Context, record *PriceHistory) error {
	query := `
	INSERT INTO price_history (id, product_id, old_price, new_price, changed_at)
	VALUES ($1, $2, $3, $4, $5)
	`
	_, err := r.db.ExecContext(ctx, query, record.ID, record.ProductID, record.OldPrice, record.NewPrice, record.ChangedAt)
	return err
}

func (r *PostgresRepository) GetPriceHistory(ctx context.Context, productID string) ([]*PriceHistory, error) {
	query := `SELECT id, product_id, old_price, new_price, changed_at
		FROM price_history WHERE product_id = $1 ORDER BY changed_at DESC`
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*PriceHistory
	for rows.Next() {
		var record PriceHistory
		if err := rows.Scan(&record.ID, &record.ProductID, &record.OldPrice, &record.NewPrice, &record.ChangedAt); err != nil {
			return nil, err
		}
		records = append(records, &record)
	}
	return records, rows.Err()
}

func (r *PostgresRepository) GetLatestPrice(ctx context.Context, productID string) (*PriceHistory, error) {
	query := `SELECT id, product_id, old_price, new_price, changed_at
		FROM price_history WHERE product_id = $1 ORDER BY changed_at DESC LIMIT 1`
	row := r.db.QueryRowContext(ctx, query, productID)

	var record PriceHistory
	if err := row.Scan(&record.ID, &record.ProductID, &record.OldPrice, &record.NewPrice, &record.ChangedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("no price history found")
		}
		return nil, err
	}
	return &record, nil
}

// Review repository methods

func (r *PostgresRepository) CreateReview(ctx context.Context, review *Review) error {
	query := `
	INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment, created_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (product_id, user_id) DO UPDATE SET
		rating = EXCLUDED.rating,
		comment = EXCLUDED.comment,
		user_name = EXCLUDED.user_name
	`
	_, err := r.db.ExecContext(ctx, query, review.ID, review.ProductID, review.UserID, review.UserName, review.Rating, review.Comment, review.CreatedAt)
	return err
}

func (r *PostgresRepository) GetProductReviews(ctx context.Context, productID string) ([]*Review, error) {
	query := `SELECT id, product_id, user_id, user_name, rating, comment, created_at
		FROM reviews WHERE product_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reviews []*Review
	for rows.Next() {
		var review Review
		if err := rows.Scan(&review.ID, &review.ProductID, &review.UserID, &review.UserName, &review.Rating, &review.Comment, &review.CreatedAt); err != nil {
			return nil, err
		}
		reviews = append(reviews, &review)
	}
	return reviews, rows.Err()
}

func (r *PostgresRepository) GetUserReviews(ctx context.Context, userID int64) ([]*Review, error) {
	query := `SELECT id, product_id, user_id, user_name, rating, comment, created_at
		FROM reviews WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reviews []*Review
	for rows.Next() {
		var review Review
		if err := rows.Scan(&review.ID, &review.ProductID, &review.UserID, &review.UserName, &review.Rating, &review.Comment, &review.CreatedAt); err != nil {
			return nil, err
		}
		reviews = append(reviews, &review)
	}
	return reviews, rows.Err()
}

func (r *PostgresRepository) GetReview(ctx context.Context, id string) (*Review, error) {
	query := `SELECT id, product_id, user_id, user_name, rating, comment, created_at
		FROM reviews WHERE id = $1`
	row := r.db.QueryRowContext(ctx, query, id)

	var review Review
	if err := row.Scan(&review.ID, &review.ProductID, &review.UserID, &review.UserName, &review.Rating, &review.Comment, &review.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("review not found")
		}
		return nil, err
	}
	return &review, nil
}

func (r *PostgresRepository) DeleteReview(ctx context.Context, id string) error {
	query := `DELETE FROM reviews WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("review not found")
	}
	return nil
}

func (r *PostgresRepository) GetAverageRating(ctx context.Context, productID string) (float64, int, error) {
	query := `SELECT COALESCE(AVG(rating), 0), COUNT(*) FROM reviews WHERE product_id = $1`
	row := r.db.QueryRowContext(ctx, query, productID)

	var avgRating float64
	var count int
	if err := row.Scan(&avgRating, &count); err != nil {
		return 0, 0, err
	}
	return avgRating, count, nil
}

// Analytics repository methods

func (r *PostgresRepository) RecordSale(ctx context.Context, productID string, quantity int, price, totalValue float64, userID int64, orderID string) error {
	query := `
	INSERT INTO sales_records (id, product_id, quantity, price, total_value, user_id, order_id, created_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`
	id := fmt.Sprintf("%d-%s", time.Now().UnixNano(), productID[:8])
	_, err := r.db.ExecContext(ctx, query, id, productID, quantity, price, totalValue, userID, orderID)
	return err
}

func (r *PostgresRepository) GetTopSellingProducts(ctx context.Context, limit int) ([]*ProductSalesStats, error) {
	query := `
	SELECT s.product_id, COALESCE(p.name, 'Unknown'),
	       SUM(s.quantity) as total_qty, SUM(s.total_value) as total_rev,
	       COUNT(DISTINCT s.order_id) as order_count
	FROM sales_records s
	LEFT JOIN products p ON s.product_id = p.id
	GROUP BY s.product_id, p.name
	ORDER BY total_rev DESC
	LIMIT $1
	`
	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*ProductSalesStats
	for rows.Next() {
		var s ProductSalesStats
		if err := rows.Scan(&s.ProductID, &s.ProductName, &s.TotalQuantity, &s.TotalRevenue, &s.OrderCount); err != nil {
			return nil, err
		}
		if s.OrderCount > 0 {
			s.AvgOrderValue = s.TotalRevenue / float64(s.OrderCount)
			s.AvgQuantity = float64(s.TotalQuantity) / float64(s.OrderCount)
		}
		stats = append(stats, &s)
	}
	return stats, rows.Err()
}

func (r *PostgresRepository) GetDailySales(ctx context.Context, days int) ([]*DailySales, error) {
	query := `
	SELECT DATE(created_at) as date,
	       COUNT(DISTINCT order_id) as total_orders,
	       COALESCE(SUM(total_value), 0) as total_revenue,
	       COALESCE(SUM(quantity), 0) as total_items
	FROM sales_records
	WHERE created_at >= NOW() - INTERVAL '1 day' * $1
	GROUP BY DATE(created_at)
	ORDER BY date DESC
	`
	rows, err := r.db.QueryContext(ctx, query, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sales []*DailySales
	for rows.Next() {
		var s DailySales
		if err := rows.Scan(&s.Date, &s.TotalOrders, &s.TotalRevenue, &s.TotalItems); err != nil {
			return nil, err
		}
		sales = append(sales, &s)
	}
	return sales, rows.Err()
}

func (r *PostgresRepository) GetSalesByCategory(ctx context.Context) ([]*CategorySales, error) {
	query := `
	SELECT COALESCE(p.category_id, 'uncategorized') as cat_id,
	       COALESCE(c.name, 'Uncategorized') as cat_name,
	       COALESCE(SUM(s.total_value), 0) as total_revenue,
	       COUNT(DISTINCT s.order_id) as order_count,
	       COALESCE(SUM(s.quantity), 0) as item_count
	FROM sales_records s
	LEFT JOIN products p ON s.product_id = p.id
	LEFT JOIN categories c ON p.category_id = c.id
	GROUP BY p.category_id, c.name
	ORDER BY total_revenue DESC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sales []*CategorySales
	for rows.Next() {
		var s CategorySales
		if err := rows.Scan(&s.CategoryID, &s.CategoryName, &s.TotalRevenue, &s.OrderCount, &s.ItemCount); err != nil {
			return nil, err
		}
		sales = append(sales, &s)
	}
	return sales, rows.Err()
}

func (r *PostgresRepository) GetTotalRevenue(ctx context.Context) (float64, error) {
	query := `SELECT COALESCE(SUM(total_value), 0) FROM sales_records`
	var revenue float64
	err := r.db.QueryRowContext(ctx, query).Scan(&revenue)
	return revenue, err
}

func (r *PostgresRepository) GetTotalOrders(ctx context.Context) (int, error) {
	query := `SELECT COUNT(DISTINCT order_id) FROM sales_records`
	var count int
	err := r.db.QueryRowContext(ctx, query).Scan(&count)
	return count, err
}
