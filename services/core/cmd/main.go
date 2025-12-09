package main

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"core/internal/alerts"
	"core/internal/analytics"
	"core/internal/auth"
	"core/internal/cache"
	"core/internal/email"
	"core/internal/erp"
	"core/internal/health"
	"core/internal/i18n"
	"core/internal/logger"
	"core/internal/loyalty"
	"core/internal/marketplace"
	"core/internal/metrics"
	"core/internal/pim"
	"core/internal/ratelimit"
	"core/internal/search"
	"core/internal/sms"
	"core/internal/storage"
	"core/internal/tracing"
	transport "core/internal/transport/http"
	"core/internal/warehouse"
	"core/internal/webhooks"

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

	// Create Router with all handlers
	router := transport.NewRouter(service)
	extHandlers := router.GetExtendedHandlers()

	// Initialize Auth service (optional)
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret != "" {
		jwtConfig := &auth.Config{
			SecretKey:            jwtSecret,
			AccessTokenDuration:  15 * time.Minute,
			RefreshTokenDuration: 7 * 24 * time.Hour,
			Issuer:               "shop-core",
		}
		jwtManager := auth.NewJWTManager(jwtConfig)
		oauthManager := auth.NewOAuthManager()

		// Configure Google OAuth if available
		googleClientID := os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
		googleClientSecret := os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
		if googleClientID != "" && googleClientSecret != "" {
			googleOAuth := auth.NewGoogleOAuth(&auth.OAuthConfig{
				ClientID:     googleClientID,
				ClientSecret: googleClientSecret,
				RedirectURL:  os.Getenv("GOOGLE_OAUTH_REDIRECT_URL"),
			})
			oauthManager.RegisterProvider(auth.ProviderGoogle, googleOAuth)
			log.Info().Msg("Google OAuth configured")
		}

		// Configure Facebook OAuth if available
		fbClientID := os.Getenv("FACEBOOK_OAUTH_CLIENT_ID")
		fbClientSecret := os.Getenv("FACEBOOK_OAUTH_CLIENT_SECRET")
		if fbClientID != "" && fbClientSecret != "" {
			fbOAuth := auth.NewFacebookOAuth(&auth.OAuthConfig{
				ClientID:     fbClientID,
				ClientSecret: fbClientSecret,
				RedirectURL:  os.Getenv("FACEBOOK_OAUTH_REDIRECT_URL"),
			})
			oauthManager.RegisterProvider(auth.ProviderFacebook, fbOAuth)
			log.Info().Msg("Facebook OAuth configured")
		}

		// Auth service needs repositories - create a simple in-memory implementation for now
		// In production, these would be backed by the database
		authService := auth.NewService(nil, nil, jwtManager, oauthManager)
		extHandlers.SetAuthService(authService)
		log.Info().Msg("Auth service initialized")
	}

	// Initialize Loyalty service (optional)
	loyaltyService := loyalty.NewService(nil) // Uses nil repo for now
	extHandlers.SetLoyaltyService(loyaltyService)

	// Initialize Email service (optional)
	emailService := email.NewEmailService()

	// Configure SendPulse if available
	sendpulseClientID := os.Getenv("SENDPULSE_CLIENT_ID")
	sendpulseClientSecret := os.Getenv("SENDPULSE_CLIENT_SECRET")
	if sendpulseClientID != "" && sendpulseClientSecret != "" {
		sendpulseClient := email.NewSendPulseClient(sendpulseClientID, sendpulseClientSecret)
		emailService.RegisterProvider(sendpulseClient)
		emailService.SetDefaultProvider("sendpulse")
		log.Info().Msg("SendPulse email provider configured")
	}

	// Configure Mailchimp if available
	mailchimpAPIKey := os.Getenv("MAILCHIMP_API_KEY")
	if mailchimpAPIKey != "" {
		mailchimpClient := email.NewMailchimpClient(mailchimpAPIKey)
		emailService.RegisterProvider(mailchimpClient)
		log.Info().Msg("Mailchimp email provider configured")
	}

	// Configure eSputnik if available
	esputnikAPIKey := os.Getenv("ESPUTNIK_API_KEY")
	if esputnikAPIKey != "" {
		esputnikClient := email.NewESputnikClient(esputnikAPIKey)
		emailService.RegisterProvider(esputnikClient)
		log.Info().Msg("eSputnik email provider configured")
	}

	extHandlers.SetEmailService(emailService)

	// Initialize SMS service (optional)
	smsService := sms.NewSMSService()

	// Configure TurboSMS if available
	turboSMSAPIKey := os.Getenv("TURBOSMS_API_KEY")
	turboSMSSender := os.Getenv("TURBOSMS_SENDER")
	if turboSMSAPIKey != "" {
		turboSMSClient := sms.NewTurboSMSClient(turboSMSAPIKey, turboSMSSender)
		smsService.RegisterProvider(turboSMSClient)
		smsService.SetDefaultProvider("turbosms")
		log.Info().Msg("TurboSMS provider configured")
	}

	// Configure AlphaSMS if available
	alphaSMSLogin := os.Getenv("ALPHASMS_LOGIN")
	alphaSMSAPIKey := os.Getenv("ALPHASMS_API_KEY")
	alphaSMSSender := os.Getenv("ALPHASMS_SENDER")
	if alphaSMSLogin != "" && alphaSMSAPIKey != "" {
		alphaSMSClient := sms.NewAlphaSMSClient(alphaSMSLogin, alphaSMSAPIKey, alphaSMSSender)
		smsService.RegisterProvider(alphaSMSClient)
		log.Info().Msg("AlphaSMS provider configured")
	}

	// Configure SMS.ua if available
	smsUAAPIKey := os.Getenv("SMSUA_API_KEY")
	smsUASender := os.Getenv("SMSUA_SENDER")
	if smsUAAPIKey != "" {
		smsUAClient := sms.NewSMSUAClient(smsUAAPIKey, smsUASender)
		smsService.RegisterProvider(smsUAClient)
		log.Info().Msg("SMS.ua provider configured")
	}

	extHandlers.SetSMSService(smsService)

	// Initialize Warehouse service (optional)
	warehouseService := warehouse.NewWarehouseService(nil) // Uses nil repo for now
	extHandlers.SetWarehouseService(warehouseService)

	// Initialize ERP service (optional)
	erpService := erp.NewERPService()

	// Configure 1C if available
	oneCBaseURL := os.Getenv("ONEC_BASE_URL")
	oneCUsername := os.Getenv("ONEC_USERNAME")
	oneCPassword := os.Getenv("ONEC_PASSWORD")
	if oneCBaseURL != "" && oneCUsername != "" {
		oneCClient := erp.NewOneCClient(erp.OneCConfig{
			BaseURL:  oneCBaseURL,
			Username: oneCUsername,
			Password: oneCPassword,
		})
		erpService.RegisterProvider(oneCClient)
		erpService.SetDefaultProvider("1c")
		log.Info().Msg("1C ERP provider configured")
	}

	// Configure BAS if available
	basBaseURL := os.Getenv("BAS_BASE_URL")
	basUsername := os.Getenv("BAS_USERNAME")
	basPassword := os.Getenv("BAS_PASSWORD")
	if basBaseURL != "" && basUsername != "" {
		basClient := erp.NewBASClient(erp.BASConfig{
			BaseURL:  basBaseURL,
			Username: basUsername,
			Password: basPassword,
		})
		erpService.RegisterProvider(basClient)
		log.Info().Msg("BAS ERP provider configured")
	}

	// Configure Dilovod if available
	dilovodAPIKey := os.Getenv("DILOVOD_API_KEY")
	dilovodCompanyID := os.Getenv("DILOVOD_COMPANY_ID")
	if dilovodAPIKey != "" && dilovodCompanyID != "" {
		dilovodClient := erp.NewDilovodClient(dilovodAPIKey, dilovodCompanyID)
		erpService.RegisterProvider(dilovodClient)
		log.Info().Msg("Dilovod ERP provider configured")
	}

	extHandlers.SetERPService(erpService)

	// Initialize Webhook service (optional)
	webhookWorkers := 5
	if workersStr := os.Getenv("WEBHOOK_WORKERS"); workersStr != "" {
		if workers, err := strconv.Atoi(workersStr); err == nil {
			webhookWorkers = workers
		}
	}
	webhookService := webhooks.NewWebhookService(nil, webhookWorkers) // Uses nil repo for now
	extHandlers.SetWebhookService(webhookService)

	// Initialize Analytics service (optional)
	analyticsService := analytics.NewAnalyticsService(nil) // Uses nil repo for now
	extHandlers.SetAnalyticsService(analyticsService)

	// Initialize S3/MinIO Storage (optional)
	s3Endpoint := os.Getenv("S3_ENDPOINT")
	s3AccessKey := os.Getenv("S3_ACCESS_KEY")
	s3SecretKey := os.Getenv("S3_SECRET_KEY")
	if s3Endpoint != "" && s3AccessKey != "" && s3SecretKey != "" {
		s3Config := &storage.Config{
			Endpoint:  s3Endpoint,
			AccessKey: s3AccessKey,
			SecretKey: s3SecretKey,
			Bucket:    os.Getenv("S3_BUCKET"),
			Region:    os.Getenv("S3_REGION"),
			UseSSL:    os.Getenv("S3_USE_SSL") == "true",
			PublicURL: os.Getenv("S3_PUBLIC_URL"),
		}
		if s3Config.Bucket == "" {
			s3Config.Bucket = "shop"
		}
		if s3Config.Region == "" {
			s3Config.Region = "us-east-1"
		}

		s3Storage, err := storage.NewS3Storage(s3Config)
		if err != nil {
			log.Warn().Err(err).Msg("S3 storage initialization failed")
		} else {
			extHandlers.SetStorage(s3Storage)
			log.Info().Str("endpoint", s3Endpoint).Msg("S3 storage initialized")
		}
	}

	// Initialize i18n Translator
	translator, err := i18n.New()
	if err != nil {
		log.Warn().Err(err).Msg("i18n translator initialization failed")
	} else {
		extHandlers.SetTranslator(translator)
		log.Info().Msg("i18n translator initialized")
	}

	// Initialize Marketplace Manager (optional)
	marketplaceManager := marketplace.NewManager(nil) // Uses nil repo for now
	extHandlers.SetMarketplaceManager(marketplaceManager)

	// Initialize Alerts Monitor (optional)
	alertsConfig := alerts.Config{
		LowStockThreshold: 10,
		Enabled:           true,
	}
	alertPublisher := alerts.NewLogPublisher()
	alertMonitor := alerts.NewInventoryMonitor(alertsConfig, alertPublisher)
	extHandlers.SetAlertMonitor(alertMonitor)

	log.Info().Msg("Extended handlers initialized")

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

	// Create a mux for special routes that need dedicated handlers
	mux := http.NewServeMux()

	// Health check routes (handled by dedicated health checker)
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

	// All API routes handled by the Router
	mux.Handle("/", router)

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
