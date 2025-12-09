package main

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"core/internal/cache"
	"core/internal/health"
	"core/internal/logger"
	"core/internal/metrics"
	"core/internal/pim"
	"core/internal/ratelimit"
	"core/internal/search"
	"core/internal/tracing"
	transport "core/internal/transport/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// Initialize structured logging
	logger.InitFromEnv()
	log := logger.WithService("core")

	log.Info().Msg("Starting Core Service...")

	// Initialize dependencies
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is not set")
	}

	var db *sql.DB
	var err error

	// Retry connection logic
	for i := 0; i < 10; i++ {
		db, err = sql.Open("postgres", dbURL)
		if err == nil {
			if err = db.Ping(); err == nil {
				break
			}
		}
		log.Warn().Int("attempt", i+1).Msg("Waiting for database...")
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}

	log.Info().Msg("Database connected successfully")

	repo, err := pim.NewPostgresRepository(db)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize repository")
	}

	// PostgresRepository implements Repository, CategoryRepository, CartRepository, WishlistRepository and PriceHistoryRepository
	service := pim.NewService(repo, repo)
	service.SetCartRepository(repo)
	service.SetWishlistRepository(repo)
	service.SetPriceHistoryRepository(repo)
	service.SetReviewRepository(repo)
	service.SetAnalyticsRepository(repo)

	// Initialize Redis cache (optional)
	var redisCache *cache.RedisCache
	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		var err error
		redisCache, err = cache.NewRedisCache(redisURL)
		if err != nil {
			log.Warn().Err(err).Msg("Redis connection failed, running without cache")
		} else {
			service.SetCache(redisCache)
			log.Info().Msg("Redis cache connected successfully")
		}
	}

	// Initialize Elasticsearch search (optional)
	var searchClient *search.Client
	esURL := os.Getenv("ELASTICSEARCH_URL")
	if esURL != "" {
		var err error
		searchClient, err = search.NewClient(esURL)
		if err != nil {
			log.Warn().Err(err).Msg("Elasticsearch connection failed, running without full-text search")
		} else {
			service.SetSearchClient(&searchAdapter{client: searchClient})
			log.Info().Msg("Elasticsearch connected successfully")
		}
	}

	// Initialize OpenTelemetry tracing (optional)
	var tracer *tracing.Tracer
	otlpEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if otlpEndpoint != "" {
		tracingConfig := tracing.DefaultConfig()
		tracingConfig.OTLPEndpoint = otlpEndpoint
		tracingConfig.ServiceName = "core-service"
		tracingConfig.Environment = os.Getenv("ENVIRONMENT")
		if tracingConfig.Environment == "" {
			tracingConfig.Environment = "development"
		}
		if sampleRate := os.Getenv("OTEL_SAMPLE_RATE"); sampleRate != "" {
			if rate, err := strconv.ParseFloat(sampleRate, 64); err == nil {
				tracingConfig.SampleRate = rate
			}
		}

		var err error
		tracer, err = tracing.New(tracingConfig)
		if err != nil {
			log.Warn().Err(err).Msg("OpenTelemetry tracing initialization failed")
		} else {
			log.Info().Str("endpoint", otlpEndpoint).Msg("OpenTelemetry tracing initialized")
		}
	}

	// Initialize health checks
	healthChecker := health.New("1.0.0")
	healthChecker.Register("database", health.DatabaseChecker(db))
	healthChecker.Register("redis", health.RedisCacheChecker(redisCache))
	healthChecker.Register("elasticsearch", health.ElasticsearchChecker(searchClient))

	handler := transport.NewHandler(service)

	// Initialize rate limiter
	rlConfig := ratelimit.DefaultConfig()
	if rps := os.Getenv("RATE_LIMIT_RPS"); rps != "" {
		if v, err := strconv.ParseFloat(rps, 64); err == nil {
			rlConfig.RequestsPerSecond = v
		}
	}
	if burst := os.Getenv("RATE_LIMIT_BURST"); burst != "" {
		if v, err := strconv.Atoi(burst); err == nil {
			rlConfig.Burst = v
		}
	}
	rateLimiter := ratelimit.NewIPRateLimiter(rlConfig)
	defer rateLimiter.Stop()
	log.Info().
		Float64("rps", rlConfig.RequestsPerSecond).
		Int("burst", rlConfig.Burst).
		Msg("Rate limiter initialized")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthChecker.Handler())
	mux.HandleFunc("/health/live", health.LivenessHandler())

	// Prometheus metrics endpoint
	mux.Handle("/metrics", promhttp.Handler())

	// OpenAPI/Swagger endpoints
	mux.HandleFunc("/api/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "api/openapi.yaml")
	})
	mux.HandleFunc("/api/docs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
    <title>Core Service API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: "/api/openapi.yaml",
            dom_id: '#swagger-ui',
        });
    </script>
</body>
</html>`))
	})

	// Product routes
	mux.HandleFunc("/feed/rozetka", handler.GenerateFeed)
	mux.HandleFunc("/products", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			handler.CreateProduct(w, r)
		case http.MethodGet:
			handler.ListProducts(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/products/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Handle special endpoints
		if len(path) > len("/products/") {
			if strings.HasSuffix(path, "/stock") {
				handler.UpdateStock(w, r)
				return
			}
			if strings.HasSuffix(path, "/image") {
				handler.UpdateImage(w, r)
				return
			}
			if strings.HasSuffix(path, "/decrement") {
				handler.DecrementStock(w, r)
				return
			}
			if strings.HasSuffix(path, "/price-history") {
				handler.GetPriceHistory(w, r)
				return
			}
			if strings.HasSuffix(path, "/latest-price-change") {
				handler.GetLatestPriceChange(w, r)
				return
			}
			if strings.HasSuffix(path, "/reviews") {
				handler.GetProductReviews(w, r)
				return
			}
			if strings.HasSuffix(path, "/rating") {
				handler.GetProductRating(w, r)
				return
			}
			if strings.HasSuffix(path, "/similar") {
				handler.GetSimilarProducts(w, r)
				return
			}
			if strings.HasSuffix(path, "/frequently-bought-together") {
				handler.GetFrequentlyBoughtTogether(w, r)
				return
			}
		}

		switch r.Method {
		case http.MethodGet:
			handler.GetProduct(w, r)
		case http.MethodPut:
			handler.UpdateProduct(w, r)
		case http.MethodDelete:
			handler.DeleteProduct(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Category routes
	mux.HandleFunc("/categories", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			handler.CreateCategory(w, r)
		case http.MethodGet:
			handler.ListCategories(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/categories/", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetCategory(w, r)
		case http.MethodDelete:
			handler.DeleteCategory(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Cart routes
	mux.HandleFunc("/cart/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// Check if it's /cart/{user_id}/item/{product_id}
		if strings.Contains(path, "/item/") {
			switch r.Method {
			case http.MethodDelete:
				handler.RemoveFromCart(w, r)
			case http.MethodPatch:
				handler.UpdateCartItemQuantity(w, r)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}
		// /cart/{user_id}
		switch r.Method {
		case http.MethodPost:
			handler.AddToCart(w, r)
		case http.MethodGet:
			handler.GetCart(w, r)
		case http.MethodDelete:
			handler.ClearCart(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Wishlist routes
	mux.HandleFunc("/wishlist/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// Check if it's /wishlist/{user_id}/item/{product_id}/to-cart
		if strings.Contains(path, "/to-cart") {
			handler.MoveWishlistToCart(w, r)
			return
		}
		// Check if it's /wishlist/{user_id}/item/{product_id}
		if strings.Contains(path, "/item/") {
			switch r.Method {
			case http.MethodGet:
				handler.IsInWishlist(w, r)
			case http.MethodDelete:
				handler.RemoveFromWishlist(w, r)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}
		// /wishlist/{user_id}
		switch r.Method {
		case http.MethodPost:
			handler.AddToWishlist(w, r)
		case http.MethodGet:
			handler.GetWishlist(w, r)
		case http.MethodDelete:
			handler.ClearWishlist(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Review routes
	mux.HandleFunc("/reviews", handler.CreateReview)
	mux.HandleFunc("/reviews/", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetReview(w, r)
		case http.MethodDelete:
			handler.DeleteReview(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// User routes (reviews, recommendations)
	mux.HandleFunc("/users/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, "/reviews") {
			handler.GetUserReviews(w, r)
			return
		}
		if strings.HasSuffix(path, "/recommendations") {
			handler.GetPersonalizedRecommendations(w, r)
			return
		}
		http.Error(w, "Not found", http.StatusNotFound)
	})

	// Popular products
	mux.HandleFunc("/recommendations/popular", handler.GetPopularProducts)

	// Inventory alerts routes
	mux.HandleFunc("/inventory/low-stock", handler.GetLowStockProducts)
	mux.HandleFunc("/inventory/out-of-stock", handler.GetOutOfStockProducts)
	mux.HandleFunc("/inventory/stats", handler.GetInventoryStats)

	// Analytics routes
	mux.HandleFunc("/analytics/dashboard", handler.GetAnalyticsDashboard)
	mux.HandleFunc("/analytics/top-products", handler.GetTopSellingProducts)
	mux.HandleFunc("/analytics/daily-sales", handler.GetDailySalesReport)
	mux.HandleFunc("/analytics/by-category", handler.GetSalesByCategory)

	// Search routes
	mux.HandleFunc("/search", handler.SearchProducts)
	mux.HandleFunc("/search/suggest", handler.SearchSuggest)
	mux.HandleFunc("/search/reindex", handler.ReindexProducts)

	// Wrap with middleware chain: rate limit -> tracing -> metrics -> logging -> handler
	var wrappedMux http.Handler = mux
	wrappedMux = logger.Middleware(wrappedMux)
	wrappedMux = metrics.Middleware(wrappedMux)
	if tracer != nil {
		wrappedMux = tracer.Middleware(wrappedMux)
	}
	wrappedMux = rateLimiter.Middleware(wrappedMux)

	// Create server with timeouts
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      wrappedMux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Channel to listen for shutdown signals
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	// Start server in goroutine
	go func() {
		log.Info().Str("port", port).Msg("Server starting")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Failed to start server")
		}
	}()

	// Wait for shutdown signal
	<-shutdown
	log.Info().Msg("Shutdown signal received, gracefully shutting down...")

	// Create context with timeout for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown server
	if err := server.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Server shutdown error")
	}

	// Shutdown tracer
	if tracer != nil {
		if err := tracer.Shutdown(ctx); err != nil {
			log.Error().Err(err).Msg("Tracer shutdown error")
		}
	}

	// Close search client
	if searchClient != nil {
		if err := searchClient.Close(); err != nil {
			log.Error().Err(err).Msg("Search client close error")
		}
	}

	// Close database connection
	if err := db.Close(); err != nil {
		log.Error().Err(err).Msg("Database close error")
	}

	log.Info().Msg("Server stopped gracefully")
}

// searchAdapter implements pim.SearchClient interface
type searchAdapter struct {
	client *search.Client
}

func (a *searchAdapter) IndexProduct(ctx context.Context, p *pim.SearchProduct) error {
	return a.client.IndexProduct(ctx, &search.Product{
		ID:          p.ID,
		Name:        p.Name,
		Description: p.Description,
		CategoryID:  p.CategoryID,
		Category:    p.Category,
		Price:       p.Price,
		Stock:       p.Stock,
		ImageURL:    p.ImageURL,
		Tags:        p.Tags,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	})
}

func (a *searchAdapter) DeleteProduct(ctx context.Context, productID string) error {
	return a.client.DeleteProduct(ctx, productID)
}

func (a *searchAdapter) Search(ctx context.Context, q *pim.SearchQuery) (*pim.SearchResult, error) {
	result, err := a.client.Search(ctx, &search.SearchQuery{
		Query:      q.Query,
		CategoryID: q.CategoryID,
		MinPrice:   q.MinPrice,
		MaxPrice:   q.MaxPrice,
		InStock:    q.InStock,
		SortBy:     q.SortBy,
		Page:       q.Page,
		PageSize:   q.PageSize,
	})
	if err != nil {
		return nil, err
	}

	products := make([]*pim.SearchProduct, len(result.Products))
	for i, p := range result.Products {
		products[i] = &pim.SearchProduct{
			ID:          p.ID,
			Name:        p.Name,
			Description: p.Description,
			CategoryID:  p.CategoryID,
			Category:    p.Category,
			Price:       p.Price,
			Stock:       p.Stock,
			ImageURL:    p.ImageURL,
			Tags:        p.Tags,
			CreatedAt:   p.CreatedAt,
			UpdatedAt:   p.UpdatedAt,
		}
	}

	return &pim.SearchResult{
		Products:   products,
		Total:      result.Total,
		TookMs:     result.TookMs,
		Page:       result.Page,
		PageSize:   result.PageSize,
		TotalPages: result.TotalPages,
	}, nil
}

func (a *searchAdapter) Suggest(ctx context.Context, prefix string, limit int) ([]string, error) {
	return a.client.Suggest(ctx, prefix, limit)
}

func (a *searchAdapter) BulkIndex(ctx context.Context, products []*pim.SearchProduct) error {
	searchProducts := make([]*search.Product, len(products))
	for i, p := range products {
		searchProducts[i] = &search.Product{
			ID:          p.ID,
			Name:        p.Name,
			Description: p.Description,
			CategoryID:  p.CategoryID,
			Category:    p.Category,
			Price:       p.Price,
			Stock:       p.Stock,
			ImageURL:    p.ImageURL,
			Tags:        p.Tags,
			CreatedAt:   p.CreatedAt,
			UpdatedAt:   p.UpdatedAt,
		}
	}
	return a.client.BulkIndex(ctx, searchProducts)
}
