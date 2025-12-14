package main

import (
	"context"
	"database/sql"
	"os"
	"time"

	"core/internal/billing"
	"core/internal/cdp"
	"core/internal/fraud"
	"core/internal/inbox"
	"core/internal/logger"
	"core/internal/onboarding"
	"core/internal/rma"
	"core/internal/tenant"
	"core/internal/visualsearch"
)

// AdvancedServices holds all advanced feature services
type AdvancedServices struct {
	Tenant       *tenant.TenantService
	Billing      *billing.BillingService
	Onboarding   *onboarding.OnboardingService
	RMA          *rma.RMAService
	CDP          *cdp.CDPService
	Inbox        *inbox.InboxService
	VisualSearch *visualsearch.VisualSearchService
	Fraud        *fraud.FraudService
}

// InitAdvancedServices initializes all advanced platform features
func InitAdvancedServices(db *sql.DB) *AdvancedServices {
	log := logger.WithService("advanced")

	services := &AdvancedServices{}

	// Initialize Tenant Service
	tenantRepo := tenant.NewPostgresRepository(db)
	services.Tenant = tenant.NewTenantService(tenantRepo)
	log.Info().Msg("Tenant service initialized")

	// Initialize Billing Service
	billingConfig := billing.Config{
		Currency:      "UAH",
		TaxRate:       20.0, // 20% VAT
		GracePeriod:   7,    // 7 days grace period
		CheckInterval: 24 * time.Hour,
	}
	billingRepo := billing.NewPostgresRepository(db)
	paymentGateway := initPaymentGateway()
	services.Billing = billing.NewBillingService(billingRepo, paymentGateway, billingConfig)
	log.Info().Msg("Billing service initialized")

	// Initialize RMA Service
	rmaRepo := rma.NewPostgresRepository(db)
	services.RMA = rma.NewRMAService(rmaRepo)
	log.Info().Msg("RMA service initialized")

	// Initialize CDP Service
	cdpConfig := cdp.Config{
		SegmentRefreshInterval: 1 * time.Hour,
		EventRetention:         90, // 90 days
	}
	cdpRepo := cdp.NewPostgresRepository(db)
	services.CDP = cdp.NewCDPService(cdpRepo, cdpConfig)
	log.Info().Msg("CDP service initialized")

	// Initialize Inbox Service
	inboxRepo := inbox.NewPostgresRepository(db)
	services.Inbox = inbox.NewInboxService(inboxRepo)
	log.Info().Msg("Inbox service initialized")

	// Initialize Visual Search Service
	services.VisualSearch = initVisualSearch(db)
	if services.VisualSearch != nil {
		log.Info().Msg("Visual Search service initialized")
	}

	// Initialize Fraud Detection Service
	fraudConfig := fraud.Config{
		BlockThreshold:      0.9,
		ReviewThreshold:     0.7,
		MaxOrdersPerHour:    10,
		MaxFailedPayments:   3,
		VelocityWindow:      1 * time.Hour,
		EnableMLScoring:     os.Getenv("FRAUD_ML_ENABLED") == "true",
	}
	fraudRepo := fraud.NewPostgresRepository(db)
	services.Fraud = fraud.NewFraudService(fraudRepo, fraudConfig)
	log.Info().Msg("Fraud detection service initialized")

	// Initialize Onboarding Service (requires all other services)
	services.Onboarding = initOnboarding(services)
	if services.Onboarding != nil {
		log.Info().Msg("Onboarding service initialized")
	}

	return services
}

// initPaymentGateway initializes payment gateway based on environment
func initPaymentGateway() billing.PaymentGateway {
	log := logger.WithService("payment")

	// Try LiqPay first (Ukrainian market)
	liqpayPublicKey := os.Getenv("LIQPAY_PUBLIC_KEY")
	liqpayPrivateKey := os.Getenv("LIQPAY_PRIVATE_KEY")
	if liqpayPublicKey != "" && liqpayPrivateKey != "" {
		log.Info().Msg("LiqPay payment gateway configured")
		return billing.NewLiqPayGateway(liqpayPublicKey, liqpayPrivateKey)
	}

	// Try Stripe
	stripeKey := os.Getenv("STRIPE_SECRET_KEY")
	if stripeKey != "" {
		log.Info().Msg("Stripe payment gateway configured")
		return billing.NewStripeGateway(stripeKey)
	}

	// Try Fondy (Ukrainian)
	fondyMerchantID := os.Getenv("FONDY_MERCHANT_ID")
	fondySecretKey := os.Getenv("FONDY_SECRET_KEY")
	if fondyMerchantID != "" && fondySecretKey != "" {
		log.Info().Msg("Fondy payment gateway configured")
		return billing.NewFondyGateway(fondyMerchantID, fondySecretKey)
	}

	log.Warn().Msg("No payment gateway configured, using mock")
	return billing.NewMockGateway()
}

// initVisualSearch initializes visual search with Qdrant or pgvector
func initVisualSearch(db *sql.DB) *visualsearch.VisualSearchService {
	log := logger.WithService("visualsearch")

	// Prefer Qdrant for large-scale deployments
	qdrantURL := os.Getenv("QDRANT_URL")
	if qdrantURL != "" {
		qdrantConfig := visualsearch.QdrantConfig{
			URL:        qdrantURL,
			APIKey:     os.Getenv("QDRANT_API_KEY"),
			Collection: os.Getenv("QDRANT_COLLECTION"),
			Timeout:    30 * time.Second,
		}
		if qdrantConfig.Collection == "" {
			qdrantConfig.Collection = "product_images"
		}

		provider := visualsearch.NewQdrantProvider(qdrantConfig)
		log.Info().Str("url", qdrantURL).Msg("Using Qdrant for visual search")

		// Initialize CLIP embedding service
		embeddingService := initEmbeddingService()
		if embeddingService == nil {
			log.Warn().Msg("No embedding service configured")
			return nil
		}

		return visualsearch.NewVisualSearchService(provider, embeddingService)
	}

	// Fallback to pgvector (for smaller deployments)
	if os.Getenv("PGVECTOR_ENABLED") == "true" {
		provider := visualsearch.NewPgVectorProvider(db)
		log.Info().Msg("Using pgvector for visual search")

		embeddingService := initEmbeddingService()
		if embeddingService == nil {
			log.Warn().Msg("No embedding service configured")
			return nil
		}

		return visualsearch.NewVisualSearchService(provider, embeddingService)
	}

	log.Warn().Msg("Visual search not configured (set QDRANT_URL or PGVECTOR_ENABLED)")
	return nil
}

// initEmbeddingService initializes CLIP embedding service
func initEmbeddingService() visualsearch.EmbeddingService {
	log := logger.WithService("embedding")

	// Option 1: OpenAI CLIP API
	openaiKey := os.Getenv("OPENAI_API_KEY")
	if openaiKey != "" {
		log.Info().Msg("Using OpenAI for embeddings")
		return visualsearch.NewOpenAIEmbedding(openaiKey)
	}

	// Option 2: Self-hosted CLIP service
	clipURL := os.Getenv("CLIP_SERVICE_URL")
	if clipURL != "" {
		log.Info().Str("url", clipURL).Msg("Using self-hosted CLIP service")
		return visualsearch.NewCLIPEmbedding(clipURL)
	}

	// Option 3: Replicate API
	replicateToken := os.Getenv("REPLICATE_API_TOKEN")
	if replicateToken != "" {
		log.Info().Msg("Using Replicate for embeddings")
		return visualsearch.NewReplicateEmbedding(replicateToken)
	}

	log.Warn().Msg("No embedding service configured")
	return nil
}

// initOnboarding initializes the onboarding service
func initOnboarding(services *AdvancedServices) *onboarding.OnboardingService {
	log := logger.WithService("onboarding")

	baseDomain := os.Getenv("BASE_DOMAIN")
	if baseDomain == "" {
		log.Warn().Msg("BASE_DOMAIN not set, onboarding disabled")
		return nil
	}

	// Initialize DNS provider
	dnsProvider := initDNSProvider()
	if dnsProvider == nil {
		log.Warn().Msg("No DNS provider configured")
		return nil
	}

	// Initialize certificate provider
	certProvider := initCertProvider()

	// Create adapters for onboarding service
	tenantAdapter := &tenantServiceAdapter{tenant: services.Tenant}
	billingAdapter := &billingServiceAdapter{billing: services.Billing}
	userAdapter := &userServiceAdapter{}
	notificationAdapter := &notificationAdapter{}
	analyticsAdapter := &analyticsAdapter{}

	config := onboarding.Config{
		BaseDomain:  baseDomain,
		TargetIP:    os.Getenv("LOAD_BALANCER_IP"),
		AdminDomain: os.Getenv("ADMIN_DOMAIN"),
	}
	if config.AdminDomain == "" {
		config.AdminDomain = "admin." + baseDomain
	}

	return onboarding.NewOnboardingService(
		dnsProvider,
		certProvider,
		userAdapter,
		tenantAdapter,
		billingAdapter,
		notificationAdapter,
		analyticsAdapter,
		config,
	)
}

// initDNSProvider initializes DNS provider (Cloudflare recommended)
func initDNSProvider() onboarding.DNSProvider {
	log := logger.WithService("dns")

	// Cloudflare
	cfAPIToken := os.Getenv("CLOUDFLARE_API_TOKEN")
	cfZoneID := os.Getenv("CLOUDFLARE_ZONE_ID")
	if cfAPIToken != "" && cfZoneID != "" {
		log.Info().Msg("Using Cloudflare DNS")
		return onboarding.NewCloudflareDNS(cfAPIToken, cfZoneID)
	}

	// AWS Route53
	awsAccessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	awsSecretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	awsHostedZone := os.Getenv("AWS_HOSTED_ZONE_ID")
	if awsAccessKey != "" && awsSecretKey != "" && awsHostedZone != "" {
		log.Info().Msg("Using AWS Route53 DNS")
		return onboarding.NewRoute53DNS(awsAccessKey, awsSecretKey, awsHostedZone)
	}

	log.Warn().Msg("No DNS provider configured")
	return nil
}

// initCertProvider initializes SSL certificate provider
func initCertProvider() onboarding.CertificateProvider {
	log := logger.WithService("cert")

	// Let's Encrypt via cert-manager (Kubernetes)
	if os.Getenv("CERT_MANAGER_ENABLED") == "true" {
		log.Info().Msg("Using cert-manager for SSL")
		return onboarding.NewCertManagerProvider()
	}

	// AWS ACM
	awsAccessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	if awsAccessKey != "" {
		log.Info().Msg("Using AWS ACM for SSL")
		return onboarding.NewACMProvider()
	}

	log.Warn().Msg("No SSL provider configured, using mock")
	return onboarding.NewMockCertProvider()
}

// ==================== SERVICE ADAPTERS ====================

// Adapters to connect onboarding with other services

type tenantServiceAdapter struct {
	tenant *tenant.TenantService
}

func (a *tenantServiceAdapter) Create(ctx context.Context, input onboarding.CreateTenantInput) (*onboarding.Tenant, error) {
	t, err := a.tenant.Create(ctx, tenant.CreateTenantInput{
		Name:    input.Name,
		Slug:    input.Slug,
		OwnerID: input.OwnerID,
		Plan:    input.Plan,
	})
	if err != nil {
		return nil, err
	}
	return &onboarding.Tenant{ID: t.ID, Slug: t.Slug}, nil
}

func (a *tenantServiceAdapter) GetBySlug(ctx context.Context, slug string) (*onboarding.Tenant, error) {
	t, err := a.tenant.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return &onboarding.Tenant{ID: t.ID, Slug: t.Slug}, nil
}

type billingServiceAdapter struct {
	billing *billing.BillingService
}

func (a *billingServiceAdapter) CreateSubscription(ctx context.Context, tenantID, planID, period string) error {
	return a.billing.CreateSubscription(ctx, tenantID, planID, period)
}

func (a *billingServiceAdapter) ApplyPromoCode(ctx context.Context, tenantID, promoCode string) error {
	return a.billing.ApplyPromoCode(ctx, tenantID, promoCode)
}

type userServiceAdapter struct{}

func (a *userServiceAdapter) CreateUser(ctx context.Context, email, password, name, phone string) (string, error) {
	// This should integrate with auth service
	// For now, return a generated ID
	return "user_" + generateID(), nil
}

func (a *userServiceAdapter) AssignRole(ctx context.Context, userID, tenantID, role string) error {
	// This should integrate with auth service
	return nil
}

func (a *userServiceAdapter) GenerateAPIKeys(ctx context.Context, tenantID string) (string, string, error) {
	return onboarding.GenerateAPIKey(), onboarding.GenerateSecretKey(), nil
}

type notificationAdapter struct{}

func (a *notificationAdapter) SendWelcomeEmail(ctx context.Context, email string, data onboarding.WelcomeEmailData) error {
	// This should integrate with email service
	return nil
}

func (a *notificationAdapter) SendAdminNotification(ctx context.Context, message string) error {
	// This should integrate with notification service
	return nil
}

type analyticsAdapter struct{}

func (a *analyticsAdapter) TrackSignup(ctx context.Context, tenantID string, metadata map[string]interface{}) error {
	// This should integrate with analytics service
	return nil
}

// generateID generates a random ID
func generateID() string {
	return time.Now().Format("20060102150405")
}
