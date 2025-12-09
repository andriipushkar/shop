// +build integration

package pim

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// getTestDB creates a test database connection
func getTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// Use environment variable or default to local test database
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/shop_test?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Skipf("Skipping integration test: %v", err)
	}

	if err := db.Ping(); err != nil {
		t.Skipf("Skipping integration test: cannot connect to database: %v", err)
	}

	return db
}

// cleanupDatabase cleans up test data
func cleanupDatabase(t *testing.T, db *sql.DB) {
	t.Helper()
	tables := []string{"sales_records", "reviews", "price_history", "cart_items", "wishlist_items", "products", "categories"}
	for _, table := range tables {
		_, _ = db.Exec("DELETE FROM " + table)
	}
}

func TestPostgresRepository_Init(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}
	if repo == nil {
		t.Fatal("Expected repository to be created")
	}
}

func TestPostgresRepository_Product_CRUD(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	ctx := context.Background()

	t.Run("Save and Get Product", func(t *testing.T) {
		product := &Product{
			ID:          "prod-001",
			Name:        "Test Product",
			Description: "Test Description",
			Price:       99.99,
			SKU:         "SKU001",
			Stock:       100,
			ImageURL:    "https://example.com/image.jpg",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		err := repo.Save(ctx, product)
		if err != nil {
			t.Fatalf("Failed to save product: %v", err)
		}

		got, err := repo.GetByID(ctx, "prod-001")
		if err != nil {
			t.Fatalf("Failed to get product: %v", err)
		}

		if got.ID != product.ID {
			t.Errorf("expected ID '%s', got '%s'", product.ID, got.ID)
		}
		if got.Name != product.Name {
			t.Errorf("expected Name '%s', got '%s'", product.Name, got.Name)
		}
		if got.Price != product.Price {
			t.Errorf("expected Price %f, got %f", product.Price, got.Price)
		}
		if got.SKU != product.SKU {
			t.Errorf("expected SKU '%s', got '%s'", product.SKU, got.SKU)
		}
	})

	t.Run("Update Product", func(t *testing.T) {
		product := &Product{
			ID:          "prod-001",
			Name:        "Updated Product",
			Description: "Updated Description",
			Price:       149.99,
			SKU:         "SKU001",
			Stock:       50,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		err := repo.Save(ctx, product)
		if err != nil {
			t.Fatalf("Failed to update product: %v", err)
		}

		got, err := repo.GetByID(ctx, "prod-001")
		if err != nil {
			t.Fatalf("Failed to get product: %v", err)
		}

		if got.Name != "Updated Product" {
			t.Errorf("expected Name 'Updated Product', got '%s'", got.Name)
		}
		if got.Price != 149.99 {
			t.Errorf("expected Price 149.99, got %f", got.Price)
		}
	})

	t.Run("List Products", func(t *testing.T) {
		// Add more products
		for i := 2; i <= 5; i++ {
			product := &Product{
				ID:        fmt.Sprintf("prod-00%d", i),
				Name:      fmt.Sprintf("Product %d", i),
				Price:     float64(i) * 10,
				SKU:       fmt.Sprintf("SKU00%d", i),
				Stock:     i * 10,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			_ = repo.Save(ctx, product)
		}

		products, err := repo.List(ctx)
		if err != nil {
			t.Fatalf("Failed to list products: %v", err)
		}

		if len(products) < 4 {
			t.Errorf("expected at least 4 products, got %d", len(products))
		}
	})

	t.Run("List With Filter", func(t *testing.T) {
		minPrice := 20.0
		maxPrice := 50.0

		products, err := repo.ListWithFilter(ctx, ProductFilter{
			MinPrice: &minPrice,
			MaxPrice: &maxPrice,
		})
		if err != nil {
			t.Fatalf("Failed to filter products: %v", err)
		}

		for _, p := range products {
			if p.Price < minPrice || p.Price > maxPrice {
				t.Errorf("Product %s price %f outside filter range", p.ID, p.Price)
			}
		}
	})

	t.Run("List With Search", func(t *testing.T) {
		products, err := repo.ListWithFilter(ctx, ProductFilter{
			Search: "Product 3",
		})
		if err != nil {
			t.Fatalf("Failed to search products: %v", err)
		}

		found := false
		for _, p := range products {
			if p.Name == "Product 3" {
				found = true
				break
			}
		}
		if !found {
			t.Error("Expected to find 'Product 3'")
		}
	})

	t.Run("Delete Product", func(t *testing.T) {
		err := repo.Delete(ctx, "prod-005")
		if err != nil {
			t.Fatalf("Failed to delete product: %v", err)
		}

		_, err = repo.GetByID(ctx, "prod-005")
		if err == nil {
			t.Error("Expected error for deleted product")
		}
	})

	t.Run("Update Stock", func(t *testing.T) {
		err := repo.UpdateStock(ctx, "prod-001", 200)
		if err != nil {
			t.Fatalf("Failed to update stock: %v", err)
		}

		product, _ := repo.GetByID(ctx, "prod-001")
		if product.Stock != 200 {
			t.Errorf("expected stock 200, got %d", product.Stock)
		}
	})

	t.Run("Decrement Stock", func(t *testing.T) {
		err := repo.DecrementStock(ctx, "prod-001", 50)
		if err != nil {
			t.Fatalf("Failed to decrement stock: %v", err)
		}

		product, _ := repo.GetByID(ctx, "prod-001")
		if product.Stock != 150 {
			t.Errorf("expected stock 150, got %d", product.Stock)
		}
	})

	t.Run("Decrement Stock Insufficient", func(t *testing.T) {
		err := repo.DecrementStock(ctx, "prod-001", 1000)
		if err == nil {
			t.Error("Expected error for insufficient stock")
		}
	})
}

func TestPostgresRepository_Category(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	ctx := context.Background()

	t.Run("Save and Get Category", func(t *testing.T) {
		category := &Category{
			ID:        "cat-001",
			Name:      "Electronics",
			CreatedAt: time.Now(),
		}

		err := repo.SaveCategory(ctx, category)
		if err != nil {
			t.Fatalf("Failed to save category: %v", err)
		}

		got, err := repo.GetCategoryByID(ctx, "cat-001")
		if err != nil {
			t.Fatalf("Failed to get category: %v", err)
		}

		if got.Name != "Electronics" {
			t.Errorf("expected Name 'Electronics', got '%s'", got.Name)
		}
	})

	t.Run("List Categories", func(t *testing.T) {
		category2 := &Category{
			ID:        "cat-002",
			Name:      "Clothing",
			CreatedAt: time.Now(),
		}
		_ = repo.SaveCategory(ctx, category2)

		categories, err := repo.ListCategories(ctx)
		if err != nil {
			t.Fatalf("Failed to list categories: %v", err)
		}

		if len(categories) < 2 {
			t.Errorf("expected at least 2 categories, got %d", len(categories))
		}
	})

	t.Run("Delete Category", func(t *testing.T) {
		err := repo.DeleteCategory(ctx, "cat-002")
		if err != nil {
			t.Fatalf("Failed to delete category: %v", err)
		}

		_, err = repo.GetCategoryByID(ctx, "cat-002")
		if err == nil {
			t.Error("Expected error for deleted category")
		}
	})

	t.Run("Product with Category", func(t *testing.T) {
		product := &Product{
			ID:         "prod-with-cat",
			Name:       "Laptop",
			Price:      999.99,
			SKU:        "LAPTOP001",
			Stock:      10,
			CategoryID: "cat-001",
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		err := repo.Save(ctx, product)
		if err != nil {
			t.Fatalf("Failed to save product with category: %v", err)
		}

		got, err := repo.GetByID(ctx, "prod-with-cat")
		if err != nil {
			t.Fatalf("Failed to get product: %v", err)
		}

		if got.Category == nil {
			t.Fatal("Expected category to be loaded")
		}
		if got.Category.Name != "Electronics" {
			t.Errorf("expected category 'Electronics', got '%s'", got.Category.Name)
		}
	})
}

func TestPostgresRepository_Cart(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	ctx := context.Background()
	userID := int64(12345)

	t.Run("Add to Cart", func(t *testing.T) {
		item := &CartItem{
			UserID:    userID,
			ProductID: "prod-001",
			Name:      "Test Product",
			Price:     99.99,
			Quantity:  2,
			ImageURL:  "https://example.com/img.jpg",
			AddedAt:   time.Now(),
		}

		err := repo.AddToCart(ctx, item)
		if err != nil {
			t.Fatalf("Failed to add to cart: %v", err)
		}
	})

	t.Run("Get Cart", func(t *testing.T) {
		items, err := repo.GetCart(ctx, userID)
		if err != nil {
			t.Fatalf("Failed to get cart: %v", err)
		}

		if len(items) != 1 {
			t.Errorf("expected 1 item, got %d", len(items))
		}
		if items[0].Quantity != 2 {
			t.Errorf("expected quantity 2, got %d", items[0].Quantity)
		}
	})

	t.Run("Add Same Product Increments Quantity", func(t *testing.T) {
		item := &CartItem{
			UserID:    userID,
			ProductID: "prod-001",
			Name:      "Test Product",
			Price:     99.99,
			Quantity:  3,
			AddedAt:   time.Now(),
		}

		err := repo.AddToCart(ctx, item)
		if err != nil {
			t.Fatalf("Failed to add to cart: %v", err)
		}

		items, _ := repo.GetCart(ctx, userID)
		if items[0].Quantity != 5 { // 2 + 3
			t.Errorf("expected quantity 5, got %d", items[0].Quantity)
		}
	})

	t.Run("Update Quantity", func(t *testing.T) {
		err := repo.UpdateCartItemQuantity(ctx, userID, "prod-001", 10)
		if err != nil {
			t.Fatalf("Failed to update quantity: %v", err)
		}

		items, _ := repo.GetCart(ctx, userID)
		if items[0].Quantity != 10 {
			t.Errorf("expected quantity 10, got %d", items[0].Quantity)
		}
	})

	t.Run("Remove from Cart", func(t *testing.T) {
		err := repo.RemoveFromCart(ctx, userID, "prod-001")
		if err != nil {
			t.Fatalf("Failed to remove from cart: %v", err)
		}

		items, _ := repo.GetCart(ctx, userID)
		if len(items) != 0 {
			t.Errorf("expected empty cart, got %d items", len(items))
		}
	})

	t.Run("Clear Cart", func(t *testing.T) {
		// Add multiple items
		for i := 1; i <= 3; i++ {
			item := &CartItem{
				UserID:    userID,
				ProductID: fmt.Sprintf("prod-00%d", i),
				Name:      fmt.Sprintf("Product %d", i),
				Price:     float64(i) * 10,
				Quantity:  1,
				AddedAt:   time.Now(),
			}
			_ = repo.AddToCart(ctx, item)
		}

		err := repo.ClearCart(ctx, userID)
		if err != nil {
			t.Fatalf("Failed to clear cart: %v", err)
		}

		items, _ := repo.GetCart(ctx, userID)
		if len(items) != 0 {
			t.Errorf("expected empty cart after clear, got %d items", len(items))
		}
	})
}

func TestPostgresRepository_Wishlist(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	ctx := context.Background()
	userID := int64(12345)

	t.Run("Add to Wishlist", func(t *testing.T) {
		item := &WishlistItem{
			UserID:    userID,
			ProductID: "prod-001",
			Name:      "Wishlist Product",
			Price:     199.99,
			ImageURL:  "https://example.com/img.jpg",
			AddedAt:   time.Now(),
		}

		err := repo.AddToWishlist(ctx, item)
		if err != nil {
			t.Fatalf("Failed to add to wishlist: %v", err)
		}
	})

	t.Run("Get Wishlist", func(t *testing.T) {
		items, err := repo.GetWishlist(ctx, userID)
		if err != nil {
			t.Fatalf("Failed to get wishlist: %v", err)
		}

		if len(items) != 1 {
			t.Errorf("expected 1 item, got %d", len(items))
		}
	})

	t.Run("Is In Wishlist", func(t *testing.T) {
		exists, err := repo.IsInWishlist(ctx, userID, "prod-001")
		if err != nil {
			t.Fatalf("Failed to check wishlist: %v", err)
		}
		if !exists {
			t.Error("Expected product to be in wishlist")
		}

		exists, err = repo.IsInWishlist(ctx, userID, "prod-999")
		if err != nil {
			t.Fatalf("Failed to check wishlist: %v", err)
		}
		if exists {
			t.Error("Expected product NOT to be in wishlist")
		}
	})

	t.Run("Add Duplicate Does Nothing", func(t *testing.T) {
		item := &WishlistItem{
			UserID:    userID,
			ProductID: "prod-001",
			Name:      "Wishlist Product",
			Price:     199.99,
			AddedAt:   time.Now(),
		}

		_ = repo.AddToWishlist(ctx, item)

		items, _ := repo.GetWishlist(ctx, userID)
		if len(items) != 1 {
			t.Errorf("expected 1 item after duplicate add, got %d", len(items))
		}
	})

	t.Run("Remove from Wishlist", func(t *testing.T) {
		err := repo.RemoveFromWishlist(ctx, userID, "prod-001")
		if err != nil {
			t.Fatalf("Failed to remove from wishlist: %v", err)
		}

		items, _ := repo.GetWishlist(ctx, userID)
		if len(items) != 0 {
			t.Errorf("expected empty wishlist, got %d items", len(items))
		}
	})
}

func TestPostgresRepository_Reviews(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	ctx := context.Background()

	t.Run("Create Review", func(t *testing.T) {
		review := &Review{
			ID:        "rev-001",
			ProductID: "prod-001",
			UserID:    12345,
			UserName:  "Іван Петренко",
			Rating:    5,
			Comment:   "Чудовий товар!",
			CreatedAt: time.Now(),
		}

		err := repo.CreateReview(ctx, review)
		if err != nil {
			t.Fatalf("Failed to create review: %v", err)
		}
	})

	t.Run("Get Review", func(t *testing.T) {
		review, err := repo.GetReview(ctx, "rev-001")
		if err != nil {
			t.Fatalf("Failed to get review: %v", err)
		}

		if review.Rating != 5 {
			t.Errorf("expected rating 5, got %d", review.Rating)
		}
		if review.UserName != "Іван Петренко" {
			t.Errorf("expected UserName 'Іван Петренко', got '%s'", review.UserName)
		}
	})

	t.Run("Get Product Reviews", func(t *testing.T) {
		// Add more reviews
		for i := 2; i <= 4; i++ {
			review := &Review{
				ID:        fmt.Sprintf("rev-00%d", i),
				ProductID: "prod-001",
				UserID:    int64(12345 + i),
				Rating:    i,
				Comment:   fmt.Sprintf("Review %d", i),
				CreatedAt: time.Now(),
			}
			_ = repo.CreateReview(ctx, review)
		}

		reviews, err := repo.GetProductReviews(ctx, "prod-001")
		if err != nil {
			t.Fatalf("Failed to get product reviews: %v", err)
		}

		if len(reviews) != 4 {
			t.Errorf("expected 4 reviews, got %d", len(reviews))
		}
	})

	t.Run("Get Average Rating", func(t *testing.T) {
		avg, count, err := repo.GetAverageRating(ctx, "prod-001")
		if err != nil {
			t.Fatalf("Failed to get average rating: %v", err)
		}

		if count != 4 {
			t.Errorf("expected count 4, got %d", count)
		}
		// (5 + 2 + 3 + 4) / 4 = 3.5
		if avg < 3.4 || avg > 3.6 {
			t.Errorf("expected avg ~3.5, got %f", avg)
		}
	})

	t.Run("Get User Reviews", func(t *testing.T) {
		reviews, err := repo.GetUserReviews(ctx, 12345)
		if err != nil {
			t.Fatalf("Failed to get user reviews: %v", err)
		}

		if len(reviews) != 1 {
			t.Errorf("expected 1 review for user, got %d", len(reviews))
		}
	})

	t.Run("Update Review On Conflict", func(t *testing.T) {
		review := &Review{
			ID:        "rev-001-new",
			ProductID: "prod-001",
			UserID:    12345,
			UserName:  "Іван Оновлений",
			Rating:    4,
			Comment:   "Оновлений відгук",
			CreatedAt: time.Now(),
		}

		err := repo.CreateReview(ctx, review)
		if err != nil {
			t.Fatalf("Failed to update review: %v", err)
		}

		reviews, _ := repo.GetProductReviews(ctx, "prod-001")
		foundUpdated := false
		for _, r := range reviews {
			if r.UserID == 12345 && r.Rating == 4 {
				foundUpdated = true
				break
			}
		}
		if !foundUpdated {
			t.Error("Expected review to be updated")
		}
	})

	t.Run("Delete Review", func(t *testing.T) {
		err := repo.DeleteReview(ctx, "rev-001")
		if err != nil {
			t.Fatalf("Failed to delete review: %v", err)
		}

		_, err = repo.GetReview(ctx, "rev-001")
		if err == nil {
			t.Error("Expected error for deleted review")
		}
	})
}

func TestPostgresRepository_PriceHistory(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	ctx := context.Background()

	t.Run("Record Price Change", func(t *testing.T) {
		record := &PriceHistory{
			ID:        "ph-001",
			ProductID: "prod-001",
			OldPrice:  100.0,
			NewPrice:  90.0,
			ChangedAt: time.Now(),
		}

		err := repo.RecordPriceChange(ctx, record)
		if err != nil {
			t.Fatalf("Failed to record price change: %v", err)
		}
	})

	t.Run("Get Price History", func(t *testing.T) {
		// Add more records
		for i := 2; i <= 5; i++ {
			record := &PriceHistory{
				ID:        fmt.Sprintf("ph-00%d", i),
				ProductID: "prod-001",
				OldPrice:  float64(100 - (i-1)*10),
				NewPrice:  float64(100 - i*10),
				ChangedAt: time.Now().Add(time.Duration(i) * time.Hour),
			}
			_ = repo.RecordPriceChange(ctx, record)
		}

		history, err := repo.GetPriceHistory(ctx, "prod-001")
		if err != nil {
			t.Fatalf("Failed to get price history: %v", err)
		}

		if len(history) != 5 {
			t.Errorf("expected 5 records, got %d", len(history))
		}
	})

	t.Run("Get Latest Price", func(t *testing.T) {
		latest, err := repo.GetLatestPrice(ctx, "prod-001")
		if err != nil {
			t.Fatalf("Failed to get latest price: %v", err)
		}

		if latest.NewPrice != 50.0 {
			t.Errorf("expected latest price 50.0, got %f", latest.NewPrice)
		}
	})
}

func TestPostgresRepository_Analytics(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo, err := NewPostgresRepository(db)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	ctx := context.Background()

	// Create products and categories for analytics
	category := &Category{ID: "cat-001", Name: "Electronics", CreatedAt: time.Now()}
	_ = repo.SaveCategory(ctx, category)

	for i := 1; i <= 3; i++ {
		product := &Product{
			ID:         fmt.Sprintf("prod-00%d", i),
			Name:       fmt.Sprintf("Product %d", i),
			Price:      float64(i) * 100,
			SKU:        fmt.Sprintf("SKU00%d", i),
			Stock:      100,
			CategoryID: "cat-001",
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		_ = repo.Save(ctx, product)
	}

	t.Run("Record Sales", func(t *testing.T) {
		for i := 1; i <= 10; i++ {
			productID := fmt.Sprintf("prod-00%d", (i%3)+1)
			err := repo.RecordSale(ctx, productID, 2, 100.0, 200.0, int64(12345+i), fmt.Sprintf("order-%d", i))
			if err != nil {
				t.Fatalf("Failed to record sale: %v", err)
			}
		}
	})

	t.Run("Get Total Revenue", func(t *testing.T) {
		revenue, err := repo.GetTotalRevenue(ctx)
		if err != nil {
			t.Fatalf("Failed to get total revenue: %v", err)
		}

		if revenue != 2000.0 { // 10 sales * 200
			t.Errorf("expected revenue 2000.0, got %f", revenue)
		}
	})

	t.Run("Get Total Orders", func(t *testing.T) {
		count, err := repo.GetTotalOrders(ctx)
		if err != nil {
			t.Fatalf("Failed to get total orders: %v", err)
		}

		if count != 10 {
			t.Errorf("expected 10 orders, got %d", count)
		}
	})

	t.Run("Get Top Selling Products", func(t *testing.T) {
		stats, err := repo.GetTopSellingProducts(ctx, 10)
		if err != nil {
			t.Fatalf("Failed to get top selling: %v", err)
		}

		if len(stats) < 3 {
			t.Errorf("expected at least 3 products, got %d", len(stats))
		}
	})

	t.Run("Get Daily Sales", func(t *testing.T) {
		sales, err := repo.GetDailySales(ctx, 7)
		if err != nil {
			t.Fatalf("Failed to get daily sales: %v", err)
		}

		if len(sales) == 0 {
			t.Error("expected at least 1 day of sales")
		}
	})

	t.Run("Get Sales By Category", func(t *testing.T) {
		sales, err := repo.GetSalesByCategory(ctx)
		if err != nil {
			t.Fatalf("Failed to get sales by category: %v", err)
		}

		if len(sales) == 0 {
			t.Error("expected at least 1 category with sales")
		}
	})
}

// Benchmark Tests

func BenchmarkPostgresRepository_Save(b *testing.B) {
	db, err := sql.Open("postgres", "postgres://postgres:postgres@localhost:5432/shop_test?sslmode=disable")
	if err != nil {
		b.Skip("Cannot connect to database")
	}
	defer db.Close()

	repo, _ := NewPostgresRepository(db)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		product := &Product{
			ID:        fmt.Sprintf("bench-prod-%d", i),
			Name:      "Benchmark Product",
			Price:     99.99,
			SKU:       fmt.Sprintf("BENCH%d", i),
			Stock:     100,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		_ = repo.Save(ctx, product)
	}

	// Cleanup
	_, _ = db.Exec("DELETE FROM products WHERE id LIKE 'bench-%'")
}

func BenchmarkPostgresRepository_GetByID(b *testing.B) {
	db, err := sql.Open("postgres", "postgres://postgres:postgres@localhost:5432/shop_test?sslmode=disable")
	if err != nil {
		b.Skip("Cannot connect to database")
	}
	defer db.Close()

	repo, _ := NewPostgresRepository(db)
	ctx := context.Background()

	// Create test product
	product := &Product{
		ID:        "bench-get-product",
		Name:      "Benchmark Product",
		Price:     99.99,
		SKU:       "BENCHGET",
		Stock:     100,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_ = repo.Save(ctx, product)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = repo.GetByID(ctx, "bench-get-product")
	}

	// Cleanup
	_, _ = db.Exec("DELETE FROM products WHERE id = 'bench-get-product'")
}
