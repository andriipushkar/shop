package onboarding

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Errors
var (
	ErrSlugTaken           = errors.New("slug is already taken")
	ErrDomainTaken         = errors.New("domain is already taken")
	ErrInvalidSlug         = errors.New("invalid slug format")
	ErrInvalidEmail        = errors.New("invalid email format")
	ErrOnboardingFailed    = errors.New("onboarding failed")
	ErrDNSProvisionFailed  = errors.New("failed to provision DNS")
)

// ==================== MODELS ====================

type OnboardingRequest struct {
	// Owner info
	OwnerEmail    string `json:"owner_email"`
	OwnerName     string `json:"owner_name"`
	OwnerPhone    string `json:"owner_phone"`
	OwnerPassword string `json:"owner_password"`

	// Store info
	StoreName     string `json:"store_name"`
	StoreSlug     string `json:"store_slug"` // subdomain
	StoreCategory string `json:"store_category"`

	// Plan
	PlanID        string `json:"plan_id"`
	BillingPeriod string `json:"billing_period"`

	// Optional
	CustomDomain   string `json:"custom_domain,omitempty"`
	ReferralCode   string `json:"referral_code,omitempty"`
	PromoCode      string `json:"promo_code,omitempty"`
}

type OnboardingResult struct {
	TenantID      string    `json:"tenant_id"`
	Slug          string    `json:"slug"`
	Domain        string    `json:"domain"`
	AdminURL      string    `json:"admin_url"`
	StorefrontURL string    `json:"storefront_url"`
	APIKey        string    `json:"api_key"`
	SecretKey     string    `json:"secret_key"`
	OwnerID       string    `json:"owner_id"`
	CreatedAt     time.Time `json:"created_at"`
}

type OnboardingStep struct {
	Name      string `json:"name"`
	Status    string `json:"status"` // pending, running, completed, failed
	StartedAt *time.Time `json:"started_at,omitempty"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`
	Error     string `json:"error,omitempty"`
}

type OnboardingProgress struct {
	RequestID string           `json:"request_id"`
	Status    string           `json:"status"` // pending, running, completed, failed
	Steps     []OnboardingStep `json:"steps"`
	Result    *OnboardingResult `json:"result,omitempty"`
}

// ==================== EXTERNAL SERVICES ====================

type DNSProvider interface {
	CreateSubdomain(ctx context.Context, subdomain, baseDomain, targetIP string) error
	CreateCNAME(ctx context.Context, customDomain, targetDomain string) error
	VerifyDomain(ctx context.Context, domain string) (bool, error)
	DeleteSubdomain(ctx context.Context, subdomain, baseDomain string) error
}

type CertificateProvider interface {
	RequestCertificate(ctx context.Context, domains []string) (string, error)
	GetCertificateStatus(ctx context.Context, certID string) (string, error)
}

type UserService interface {
	CreateUser(ctx context.Context, email, password, name, phone string) (string, error)
	AssignRole(ctx context.Context, userID, tenantID, role string) error
	GenerateAPIKeys(ctx context.Context, tenantID string) (apiKey, secretKey string, err error)
}

type TenantService interface {
	Create(ctx context.Context, input CreateTenantInput) (*Tenant, error)
	GetBySlug(ctx context.Context, slug string) (*Tenant, error)
}

type CreateTenantInput struct {
	Name    string
	Slug    string
	OwnerID string
	Plan    string
}

type Tenant struct {
	ID   string
	Slug string
}

type BillingService interface {
	CreateSubscription(ctx context.Context, tenantID, planID, period string) error
	ApplyPromoCode(ctx context.Context, tenantID, promoCode string) error
}

type NotificationService interface {
	SendWelcomeEmail(ctx context.Context, email string, data WelcomeEmailData) error
	SendAdminNotification(ctx context.Context, message string) error
}

type WelcomeEmailData struct {
	StoreName     string
	AdminURL      string
	StorefrontURL string
	APIKey        string
	DocsURL       string
}

type AnalyticsService interface {
	TrackSignup(ctx context.Context, tenantID string, metadata map[string]interface{}) error
}

// ==================== ONBOARDING SERVICE ====================

type OnboardingService struct {
	dns          DNSProvider
	cert         CertificateProvider
	users        UserService
	tenants      TenantService
	billing      BillingService
	notifications NotificationService
	analytics    AnalyticsService

	baseDomain   string
	targetIP     string
	adminDomain  string
}

type Config struct {
	BaseDomain  string // e.g., "shop.com"
	TargetIP    string // Load balancer IP
	AdminDomain string // e.g., "admin.shop.com"
}

func NewOnboardingService(
	dns DNSProvider,
	cert CertificateProvider,
	users UserService,
	tenants TenantService,
	billing BillingService,
	notifications NotificationService,
	analytics AnalyticsService,
	config Config,
) *OnboardingService {
	return &OnboardingService{
		dns:           dns,
		cert:          cert,
		users:         users,
		tenants:       tenants,
		billing:       billing,
		notifications: notifications,
		analytics:     analytics,
		baseDomain:    config.BaseDomain,
		targetIP:      config.TargetIP,
		adminDomain:   config.AdminDomain,
	}
}

// ==================== MAIN ONBOARDING FLOW ====================

func (s *OnboardingService) ProcessOnboarding(ctx context.Context, req OnboardingRequest) (*OnboardingResult, error) {
	// Validate input
	if err := s.validateRequest(req); err != nil {
		return nil, err
	}

	// Check slug availability
	if _, err := s.tenants.GetBySlug(ctx, req.StoreSlug); err == nil {
		return nil, ErrSlugTaken
	}

	var result OnboardingResult
	result.Slug = req.StoreSlug
	result.Domain = fmt.Sprintf("%s.%s", req.StoreSlug, s.baseDomain)
	result.CreatedAt = time.Now()

	// Step 1: Create owner user
	ownerID, err := s.users.CreateUser(ctx, req.OwnerEmail, req.OwnerPassword, req.OwnerName, req.OwnerPhone)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	result.OwnerID = ownerID

	// Step 2: Create tenant
	tenant, err := s.tenants.Create(ctx, CreateTenantInput{
		Name:    req.StoreName,
		Slug:    req.StoreSlug,
		OwnerID: ownerID,
		Plan:    req.PlanID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}
	result.TenantID = tenant.ID

	// Step 3: Assign admin role
	if err := s.users.AssignRole(ctx, ownerID, tenant.ID, "admin"); err != nil {
		return nil, fmt.Errorf("failed to assign role: %w", err)
	}

	// Step 4: Generate API keys
	apiKey, secretKey, err := s.users.GenerateAPIKeys(ctx, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate API keys: %w", err)
	}
	result.APIKey = apiKey
	result.SecretKey = secretKey

	// Step 5: Create subscription
	if req.PlanID != "free" {
		if err := s.billing.CreateSubscription(ctx, tenant.ID, req.PlanID, req.BillingPeriod); err != nil {
			// Non-critical, log and continue
			fmt.Printf("Warning: failed to create subscription: %v\n", err)
		}

		// Apply promo code if provided
		if req.PromoCode != "" {
			s.billing.ApplyPromoCode(ctx, tenant.ID, req.PromoCode)
		}
	}

	// Step 6: Provision DNS
	if err := s.dns.CreateSubdomain(ctx, req.StoreSlug, s.baseDomain, s.targetIP); err != nil {
		// Log but don't fail - DNS can be retried
		fmt.Printf("Warning: DNS provisioning delayed: %v\n", err)
	}

	// Step 7: Request SSL certificate
	domains := []string{result.Domain}
	if req.CustomDomain != "" {
		domains = append(domains, req.CustomDomain)
	}
	s.cert.RequestCertificate(ctx, domains)

	// Build URLs
	result.StorefrontURL = fmt.Sprintf("https://%s", result.Domain)
	result.AdminURL = fmt.Sprintf("https://%s/%s", s.adminDomain, req.StoreSlug)

	// Step 8: Send welcome email
	s.notifications.SendWelcomeEmail(ctx, req.OwnerEmail, WelcomeEmailData{
		StoreName:     req.StoreName,
		AdminURL:      result.AdminURL,
		StorefrontURL: result.StorefrontURL,
		APIKey:        result.APIKey,
		DocsURL:       "https://docs.shop.com",
	})

	// Step 9: Track analytics
	s.analytics.TrackSignup(ctx, tenant.ID, map[string]interface{}{
		"plan":          req.PlanID,
		"category":      req.StoreCategory,
		"has_referral":  req.ReferralCode != "",
		"has_promo":     req.PromoCode != "",
		"custom_domain": req.CustomDomain != "",
	})

	// Step 10: Notify admins
	s.notifications.SendAdminNotification(ctx, fmt.Sprintf(
		"New store created: %s (%s) - Plan: %s",
		req.StoreName, req.StoreSlug, req.PlanID,
	))

	return &result, nil
}

// ==================== VALIDATION ====================

func (s *OnboardingService) validateRequest(req OnboardingRequest) error {
	// Validate email
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(req.OwnerEmail) {
		return ErrInvalidEmail
	}

	// Validate slug
	if err := s.validateSlug(req.StoreSlug); err != nil {
		return err
	}

	// Validate required fields
	if req.OwnerName == "" {
		return errors.New("owner name is required")
	}
	if req.StoreName == "" {
		return errors.New("store name is required")
	}
	if req.OwnerPassword == "" || len(req.OwnerPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	return nil
}

func (s *OnboardingService) validateSlug(slug string) error {
	// Must be lowercase alphanumeric with hyphens
	slugRegex := regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)
	if !slugRegex.MatchString(slug) {
		return ErrInvalidSlug
	}

	// Length check
	if len(slug) < 3 || len(slug) > 63 {
		return errors.New("slug must be 3-63 characters")
	}

	// Reserved slugs
	reserved := []string{
		"www", "api", "admin", "app", "mail", "ftp", "cdn",
		"static", "assets", "images", "js", "css", "fonts",
		"docs", "help", "support", "blog", "status", "health",
	}
	for _, r := range reserved {
		if slug == r {
			return fmt.Errorf("slug '%s' is reserved", slug)
		}
	}

	return nil
}

// ==================== SLUG GENERATION ====================

func (s *OnboardingService) GenerateSlug(storeName string) string {
	// Convert to lowercase
	slug := strings.ToLower(storeName)

	// Replace spaces and special chars with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")

	// Remove leading/trailing hyphens
	slug = strings.Trim(slug, "-")

	// Truncate if too long
	if len(slug) > 50 {
		slug = slug[:50]
	}

	// Add random suffix to ensure uniqueness
	suffix := generateRandomString(4)
	slug = fmt.Sprintf("%s-%s", slug, suffix)

	return slug
}

func (s *OnboardingService) CheckSlugAvailability(ctx context.Context, slug string) (bool, error) {
	if err := s.validateSlug(slug); err != nil {
		return false, err
	}

	_, err := s.tenants.GetBySlug(ctx, slug)
	if err != nil {
		// Slug is available
		return true, nil
	}

	return false, nil
}

// ==================== CUSTOM DOMAIN ====================

type AddCustomDomainInput struct {
	TenantID     string
	CustomDomain string
}

func (s *OnboardingService) AddCustomDomain(ctx context.Context, input AddCustomDomainInput) error {
	// Validate domain format
	domainRegex := regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)
	if !domainRegex.MatchString(input.CustomDomain) {
		return errors.New("invalid domain format")
	}

	// Create CNAME record pointing to our platform
	targetDomain := fmt.Sprintf("custom.%s", s.baseDomain)
	if err := s.dns.CreateCNAME(ctx, input.CustomDomain, targetDomain); err != nil {
		return fmt.Errorf("failed to create CNAME: %w", err)
	}

	// Request SSL certificate
	if _, err := s.cert.RequestCertificate(ctx, []string{input.CustomDomain}); err != nil {
		return fmt.Errorf("failed to request certificate: %w", err)
	}

	return nil
}

func (s *OnboardingService) VerifyCustomDomain(ctx context.Context, tenantID, domain string) (bool, string, error) {
	verified, err := s.dns.VerifyDomain(ctx, domain)
	if err != nil {
		return false, "", err
	}

	if !verified {
		// Return instructions
		instructions := fmt.Sprintf(
			"Add a CNAME record:\nHost: %s\nPoints to: custom.%s",
			domain, s.baseDomain,
		)
		return false, instructions, nil
	}

	return true, "", nil
}

// ==================== CLEANUP / ROLLBACK ====================

func (s *OnboardingService) DeleteTenant(ctx context.Context, tenantID, slug string) error {
	// Delete DNS record
	if err := s.dns.DeleteSubdomain(ctx, slug, s.baseDomain); err != nil {
		fmt.Printf("Warning: failed to delete DNS: %v\n", err)
	}

	// Additional cleanup...
	// - Cancel subscription
	// - Archive data
	// - Remove from caches
	// etc.

	return nil
}

// ==================== HELPERS ====================

func generateRandomString(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)[:length]
}

// ==================== API KEY GENERATION ====================

func GenerateAPIKey() string {
	// Format: shop_live_xxxxxxxxxxxx or shop_test_xxxxxxxxxxxx
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return "shop_live_" + hex.EncodeToString(bytes)
}

func GenerateSecretKey() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return "shop_secret_" + hex.EncodeToString(bytes)
}
