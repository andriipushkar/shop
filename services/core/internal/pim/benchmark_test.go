package pim

import (
	"context"
	"fmt"
	"testing"
)

// BenchmarkService_GetProduct benchmarks single product retrieval
func BenchmarkService_GetProduct(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test product
	product := &Product{
		ID:    "bench-prod-1",
		Name:  "Benchmark Product",
		Price: 99.99,
		SKU:   "BENCH-001",
		Stock: 100,
	}
	repo.products["bench-prod-1"] = product

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.GetProduct(ctx, "bench-prod-1")
	}
}

// BenchmarkService_List benchmarks listing all products
func BenchmarkService_List(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test products
	for i := 0; i < 100; i++ {
		product := &Product{
			ID:    fmt.Sprintf("prod-%d", i),
			Name:  fmt.Sprintf("Product %d", i),
			Price: float64(i) * 10.99,
			SKU:   fmt.Sprintf("SKU-%d", i),
			Stock: i * 5,
		}
		repo.products[product.ID] = product
	}

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.List(ctx)
	}
}

// BenchmarkService_CreateProduct benchmarks product creation
func BenchmarkService_CreateProduct(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		product := &Product{
			Name:  fmt.Sprintf("Product %d", i),
			Price: float64(i) * 10.99,
			SKU:   fmt.Sprintf("SKU-%d", i),
			Stock: 100,
		}
		svc.CreateProduct(ctx, product)
	}
}

// BenchmarkService_UpdateStock benchmarks stock update
func BenchmarkService_UpdateStock(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test product
	repo.products["bench-prod"] = &Product{
		ID:    "bench-prod",
		Name:  "Benchmark Product",
		Price: 99.99,
		SKU:   "BENCH",
		Stock: 100,
	}

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.UpdateStock(ctx, "bench-prod", i%200)
	}
}

// BenchmarkService_SearchProducts benchmarks product search
func BenchmarkService_SearchProducts(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)
	searchClient := NewMockSearchClient()
	svc.SetSearchClient(searchClient)

	// Setup test products
	for i := 0; i < 100; i++ {
		product := &Product{
			ID:    fmt.Sprintf("prod-%d", i),
			Name:  fmt.Sprintf("iPhone %d Pro Max", i),
			Price: float64(i) * 100.99,
			SKU:   fmt.Sprintf("IPHONE-%d", i),
			Stock: i * 10,
		}
		repo.products[product.ID] = product
		// Index in search
		searchClient.IndexProduct(context.Background(), &SearchProduct{
			ID:    product.ID,
			Name:  product.Name,
			Price: product.Price,
			Stock: product.Stock,
		})
	}

	ctx := context.Background()
	query := &SearchQuery{Query: "iPhone"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.SearchProducts(ctx, query)
	}
}

// BenchmarkService_ListWithFilter benchmarks category filtering
func BenchmarkService_ListWithFilter(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test products
	catID := "cat-electronics"
	for i := 0; i < 50; i++ {
		product := &Product{
			ID:         fmt.Sprintf("prod-%d", i),
			Name:       fmt.Sprintf("Electronic Device %d", i),
			Price:      float64(i) * 50.99,
			SKU:        fmt.Sprintf("ELEC-%d", i),
			Stock:      i * 5,
			CategoryID: catID,
		}
		repo.products[product.ID] = product
	}

	ctx := context.Background()
	filter := ProductFilter{CategoryID: catID}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.ListWithFilter(ctx, filter)
	}
}

// BenchmarkProduct_Validation benchmarks product validation
func BenchmarkProduct_Validation(b *testing.B) {
	product := &Product{
		Name:  "Test Product",
		Price: 99.99,
		SKU:   "TEST-001",
		Stock: 100,
	}

	for i := 0; i < b.N; i++ {
		// Simulate validation
		_ = product.Name != "" && product.Price > 0 && product.SKU != ""
	}
}

// BenchmarkService_ListWithFilterByCategory benchmarks filtered listing
func BenchmarkService_ListWithFilterByCategory(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test products with categories
	for i := 0; i < 100; i++ {
		catID := fmt.Sprintf("cat-%d", i%10)
		product := &Product{
			ID:         fmt.Sprintf("prod-%d", i),
			Name:       fmt.Sprintf("Product %d", i),
			Price:      float64(i) * 25.99,
			SKU:        fmt.Sprintf("SKU-%d", i),
			Stock:      i * 3,
			CategoryID: catID,
		}
		repo.products[product.ID] = product
	}

	ctx := context.Background()
	filter := ProductFilter{CategoryID: "cat-5"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.ListWithFilter(ctx, filter)
	}
}

// BenchmarkParallel_GetProduct benchmarks concurrent product retrieval
func BenchmarkParallel_GetProduct(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test products
	for i := 0; i < 10; i++ {
		product := &Product{
			ID:    fmt.Sprintf("prod-%d", i),
			Name:  fmt.Sprintf("Product %d", i),
			Price: float64(i) * 10.99,
			SKU:   fmt.Sprintf("SKU-%d", i),
			Stock: 100,
		}
		repo.products[product.ID] = product
	}

	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			svc.GetProduct(ctx, "prod-5")
		}
	})
}

// BenchmarkParallel_List benchmarks concurrent product listing
func BenchmarkParallel_List(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test products
	for i := 0; i < 50; i++ {
		product := &Product{
			ID:    fmt.Sprintf("prod-%d", i),
			Name:  fmt.Sprintf("Product %d", i),
			Price: float64(i) * 10.99,
			SKU:   fmt.Sprintf("SKU-%d", i),
			Stock: 100,
		}
		repo.products[product.ID] = product
	}

	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			svc.List(ctx)
		}
	})
}

// BenchmarkCategory_List benchmarks category listing
func BenchmarkCategory_List(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)

	// Setup test categories
	for i := 0; i < 20; i++ {
		cat := &Category{
			ID:   fmt.Sprintf("cat-%d", i),
			Name: fmt.Sprintf("Category %d", i),
		}
		catRepo.categories[cat.ID] = cat
	}

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.ListCategories(ctx)
	}
}

// BenchmarkService_GetProductRating benchmarks rating retrieval
func BenchmarkService_GetProductRating(b *testing.B) {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	svc := NewService(repo, catRepo)
	reviewRepo := NewMockReviewRepository()
	svc.SetReviewRepository(reviewRepo)

	// Setup test reviews for rating
	reviewRepo.reviews["review-1"] = &Review{
		ID:        "review-1",
		ProductID: "prod-1",
		UserID:    1,
		Rating:    5,
	}
	reviewRepo.reviews["review-2"] = &Review{
		ID:        "review-2",
		ProductID: "prod-1",
		UserID:    2,
		Rating:    4,
	}

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.GetProductRating(ctx, "prod-1")
	}
}
